# Secrets exposure — what happened and what to rotate

**Status:** `.env` / `.env.local` are no longer tracked by git. They remain on
disk so local dev keeps working. `.gitignore` now blocks all `.env*` except
`.env.example`. **Git history was deliberately NOT rewritten** — see why below.

---

## Why history was not purged

Both files entered in the **initial commit** (`ca0ed24`) and are present in all
168 commits. Purging would rewrite every commit SHA and require a force-push.

It was not worth it, because **purging would not have un-leaked the values**:

| Value | Exposed via git? | Exposed via the public JS bundle? |
|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | Yes | **Yes — already public** |
| `VITE_DASHBOARD_USERNAME` | Yes | **Yes — already public** |
| `VITE_DASHBOARD_PASSWORD` | Yes | No (dead code path) |
| Make webhook URLs | Yes | **Yes — already public** |

Every `VITE_*` variable is inlined into the browser bundle at build time.
Anyone can read them from https://st-ives-law.vercel.app today by opening
DevTools. Git history is not the leak — the deployed site is.

Additionally, GitHub retains unreachable blobs in cached refs after a force-push
until GitHub Support purges them, and any existing clone or fork keeps a copy.
Rotation is the only thing that actually closes the exposure.

---

## Rotate these

### 1. Make.com webhook URLs — highest value
These are unauthenticated endpoints. Anyone with the URL can POST to them and
trigger emails to clients or create Clio matters.

Regenerate the hook URL for each scenario in Make, then set the new values as
environment variables in Vercel (not in the repo):

- `VITE_WEBHOOK_URL`
- `VITE_CLIO_MATTER_WEBHOOK`
- `VITE_SEND_FORM_EMAIL_WEBHOOK`
- `VITE_SEND_INQUIRY_FORM_WEBHOOK`
- `VITE_SEND_INTAKE_FORM_WEBHOOK`
- `VITE_SEND_BACK_WEBHOOK`
- `VITE_REMINDER_WEBHOOK`
- `VITE_EMAIL_CONFIRMATION_WEBHOOK`
- `CLIO_DOCUMENT_WEBHOOK` (server-side, no `VITE_` prefix)

Then delete the hardcoded fallback literals in
`artifacts/questionnaire/src/lib/dashboard-actions.ts` and
`api/send-to-clio-multipart.ts`.

> Note: because these are `VITE_*`, the new URLs will also be public in the
> bundle. Rotating limits damage from the old ones but does not make them
> secret. The durable fix is to move these calls server-side (a Vercel
> function that holds the URL in a non-`VITE_` env var and proxies the call).

### 2. Enable Supabase RLS — the actual critical item
The anon key is *designed* to be public, so it being in the bundle is only a
problem because **RLS is disabled** (`CLAUDE.md` notes this for the `lawyers`
table). Right now the public anon key grants direct read/write to
`lawyers`, `screening_submissions` and `forms` — every client's name, email
and estate-planning answers.

I confirmed this during testing: I read and deleted rows using only the anon
key from the committed `.env`.

Enable RLS on all three tables and add policies scoped to the authenticated
lawyer. Rotating the anon key without doing this changes nothing.

### 3. Dashboard credentials — retire, don't rotate
`VITE_DASHBOARD_USERNAME` / `VITE_DASHBOARD_PASSWORD` are only read by
`artifacts/questionnaire/src/pages/Dashboard.tsx`, which is **imported nowhere**
— dead code. It also carries a hardcoded fallback of `'password123'`.

Delete `Dashboard.tsx` and drop both variables rather than rotating them.

---

## Already done in this branch

- `.env`, `.env.local` untracked (`git rm --cached`), still present on disk
- `.gitignore`: `.env`, `.env.*`, allowing `!.env.example`
- `artifacts/questionnaire/.env.example` added as the checked-in template
- Hardcoded webhook URLs moved behind env vars (literals kept as temporary
  fallbacks so nothing breaks before the Vercel vars are set)

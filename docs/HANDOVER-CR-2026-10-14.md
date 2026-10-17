# Handover: St Ives Law change request (call of 14 Oct 2026)

For: Dilshan. From: Isuru (prepared with Claude, 16 Oct 2026).
Repo: `client-relations/st-ives-law`. Sign-off with Sarah targeted for Fri 23 Oct; changes due in 1 to 1.5 weeks from the call.

This file has four parts:
- **Part A:** what Dilshan does by hand before starting.
- **Part B:** instructions for Claude Code on Dilshan's machine. It builds and tests everything except Make.com and the email drafts.
- **Part C:** Dilshan's own to-dos: Make.com, emails and live testing.
- **Part D:** everything still pending, with an owner for each item.

---

## How to run it

1. Clone and branch:
   ```
   git clone https://github.com/client-relations/st-ives-law && cd st-ives-law
   git checkout -b feature/cr-2026-10-14
   ```
2. Apply the payload snapshot check (sent with this file as `0001-payload-snapshot-check.patch`). It's an offline before/after check of the Clio/Make payload and document variables, with fake fixtures only.
   ```
   git am /path/to/0001-payload-snapshot-check.patch
   pnpm install
   pnpm --filter @workspace/scripts payload:snapshot > ../before.json
   ```
3. Copy this file into the repo as `docs/HANDOVER-CR-2026-10-14.md`, open Claude Code in the repo, and say:
   > Follow Part B of docs/HANDOVER-CR-2026-10-14.md. Work on branch feature/cr-2026-10-14, commit in small logical commits, and do not push.
4. Review the result, push the branch, and open a PR for Isuru. **Never push to main: main deploys production on Vercel.**

---

## Part A: Dilshan, by hand, before starting (urgent)

1. **Make the GitHub repo private.** It is public today and exposes the following:
   - A live Make webhook URL in `E2E_TEST_REPORT.md` (around line 108).
   - The old `.env` files in git history, including the dashboard password (see `SECRETS_ROTATION.md`).
   - About 40 licensed precedents in `api/templates/`.
2. **Rotate every Make webhook URL** listed in `SECRETS_ROTATION.md`, then set the new values in Vercel env vars only.
3. **Give `isuruabeysekara98-dev` Write access to the repo** (Settings → Collaborators). Claude sessions are linked to that account and can't push without it.

---

## Part B: Instructions for Claude Code

### Rules

- **Git:** work only on `feature/cr-2026-10-14`. Never push, never merge, never deploy.
- **No real services:** make no real calls to Make (`*.make.com`), Clio, Supabase (`*.supabase.co`), Vercel or any email service. Mock them in tests, and block any request that isn't to localhost.
- **Secrets and test data:** don't read or print `.env`. Test data must be obviously fake ("Test Client", `isuru+test@lex-ops.io`).
- **Out of scope:** Make.com scenarios and email wording. Don't edit `*.blueprint.json` or the email text. Where a change needs Make, add the new field to the payload and list it in the hand-off under "Needs Make mapping".
- **Typecheck baseline:** `pnpm run typecheck` already fails in `scripts/src/clio-reauth.ts` (TS1375). That failure is not ours.
- **Leave alone:** anything marked PENDING. Add a clear `TODO(PENDING: <owner>)` and nothing more.

### Payload guardrails (most important)

Run `pnpm --filter @workspace/scripts payload:snapshot` before and after every workstream and diff the output. Existing keys, values and formats must stay byte-identical. **New keys may be added. Nothing may be renamed, re-valued or reformatted** unless an item below says so.

Four traps found in the code:

1. **Dates stay ISO (YYYY-MM-DD) in the stored value.**
   - `api/_lib/clio-payload.ts` (around line 172) only sends `client_date_of_birth` to Clio if it matches `^\d{4}-\d{2}-\d{2}$`. A DD/MM/YYYY value would be **silently dropped** from Clio.
   - Show and accept DD/MM/YYYY on screen only, and convert to ISO before saving.
2. **Organ donation values stay `Available` / `Not available`.**
   - They go straight to Clio as `funeral_organ_donation` (clio-payload.ts around line 420).
   - Show Yes/No to the client with `<option value="Available">Yes</option><option value="Not available">No</option>`.
3. **`signing_date` keeps its key and format.**
   - Only the label changes to "Preferred first meeting date". The value then means "first meeting date", and Clio's "signing date" field will receive it (see Part C).
   - The intake form's own draft text prints `Executed by <name> on <signing_date>` (intake-form.html around line 1461). Change that line to always print the blank `_______` version, because it's no longer a signing date.
4. **`lead_type` stays as it is.** Matter names come from a new additive field (item 14).

### Change list

#### Intake form

File: `artifacts/questionnaire/public/intake-form.html`, plus `api/submit-intake.js` only if needed. If you add a step, keep `TOTAL_STEPS` in `api/submit-intake.js` in step; the snapshot fails otherwise.

1. **Dates as DD/MM/YYYY**, typed or picked from a calendar. Store ISO.
2. **Gender**, using new keys `client_gender` and `spouse_gender` (spouse only for couples).
   - Values are exactly `Male` and `Female`.
   - Required for the will-maker(s).
   - Gender is not captured today.
3. **Full asset list** matching the St Ives instruction sheet. Keep the existing asset keys and add the new ones:
   - real estate
   - investment properties
   - motor vehicles
   - bank accounts
   - shares and other investments
   - life insurance, TPD (total and permanent disability) and income protection
   - superannuation
   - self-managed super fund, as a separate item
   - money owed to the client
   - likely future inheritance
   - companies, trusts or other entities
   - other assets
4. **Property holding:** for each property, ask "Held as: Joint tenants / Tenants in common / Don't know".
5. **Testamentary trust as a document type option.**
6. **A Testamentary trust page placed before the Special Disability Trust page:** is one wanted, and for whom.
7. **Explanatory notes** under each section, in Sarah's wording:
   - **Executor:** "An executor is a person you appoint who is responsible for managing your estate and distributing your assets. You can nominate one or more executors."
   - **Life tenancy:** "A life tenancy can be granted to someone to use, occupy or benefit from your principal place of residence or another property for the duration of their lifetime. If you hold a property with someone else as joint tenants, you don't need to give them a life tenancy."
   - **Residuary estate:** "Your residuary estate is the balance of what remains of your assets after all debts, taxes, funeral costs, administration costs and specific gifts have been paid out."
   - **Testamentary trust:** "A testamentary trust only comes into effect after the will-maker dies. Instead of passing assets like cash or real estate directly to beneficiaries, the assets are transferred into a trust managed by a trustee for the benefit of the people you name."
   - **Special disability trust:** "A special disability trust is a legal structure set up to help parents and immediate family members provide for the long-term care, accommodation and welfare of a person with a mental or physical disability."
   - **Power of attorney:** "A power of attorney is a document that allows you to appoint a trusted person or people to make financial, property and legal decisions on your behalf."
   - **Advance care directive:** "An advance care directive is a legal document that allows you to record your preferences, values and instructions for the people you nominate to make your future health care, end of life care, living arrangements and personal decisions if you are temporarily or permanently unable to make these decisions yourself."
   - **Letter of wishes:** "A letter of wishes is a private, non-legally binding document that sits alongside your will and guides your executors. It explains why you made your choices and shares personal reflections and practical details."
8. **Rename "Preferred signing date" to "Preferred first meeting date".** The key stays `signing_date`; see the guardrails.
9. **Three preferred first meeting dates:**
   - `signing_date` is the first choice; add new keys `preferred_meeting_date_2` and `preferred_meeting_date_3`.
   - Each date must fall between today and today + 14 days, in Australia/Adelaide time.
   - Store all three as ISO.
10. **Organ donation:** ask "Do you wish to be an organ donor?" with Yes/No shown. The stored values stay `Available`/`Not available` (see the guardrails).
11. **Rename "Any other funeral wishes"** to "Do you have any other wishes for your body after death?" The key stays `funeral_other`.
12. **New question after burial or cremation:** a specific burial place or place for the ashes (free text), or "leave it to my executor or family". Use new additive keys.
13. **New page: "Documents to bring to your first meeting".** Show items depending on the client's answers:
    - **Everyone:** photo ID.
    - **Existing estate planning documents:** copies of them.
    - **A Pty Ltd company:** the company constitution.
    - **A family or unit trust:** the trust deed. TODO(PENDING: Sarah to confirm).
    - **Each property:** the latest council rates notice.

#### Clio naming

Files: `api/_lib/clio-payload.ts`, `artifacts/questionnaire/src/components/ClioDocumentGeneration.tsx`, `api/send-to-clio-multipart.ts`, `artifacts/questionnaire/src/lib/documentPackages.ts` as needed.

14. **Matter name.** Add a new payload key `matter_description` with one of these values:
    - `Estate Planning - Single - <Last name>, <First name>`
    - `Estate Planning - Couple - <Last name>, <First name>`

    The name is the primary client's. Clio adds the matter number in front. Make sets the matter description today (the live scenario isn't in the repo), so add the key and list it under "Needs Make mapping". Do not change `lead_type`.
15. **Draft file names:**
    - `<yymmdd> DRAFT Will - <Client's Full Name>`
    - `<yymmdd> DRAFT POA - <Client's Full Name>`
    - `<yymmdd> DRAFT ACD - <Client's Full Name>`
    - Example: `261014 DRAFT Will - Isuru Abeysekara`.
    - `yymmdd` is the generation date in **Australia/Adelaide** time (Vercel runs in UTC). For couples, each person's file carries their own full name.
    - Today the name is built in `ClioDocumentGeneration.tsx` (around line 421) as `<label> — <suffix or client name>`.
    - Add a unit test with a fixed clock that covers the 23:30 UTC case, when the date in Adelaide is already the next day.
16. **Other document names:** TODO(PENDING: Ces is sending the naming conventions) for the testamentary trust, special disability trust, letter of wishes and other documents. Keep their current names.
17. **Matter numbers: report only, change nothing.** Does our integration set the Clio matter number, or leave it to Clio's auto-numbering? Ces renumbers by hand today; Sarah wants Clio's auto-numbering (e.g. 27xxxxx next year).

#### Documents (header and footer)

Will-type precedents only:
- Simple Will, Single TT Will and Multi TT Will
- the "with Foreign Persons Excluded Trust" variants of each
- Individual and Couple versions

That's about 12 files in `api/templates/`. Not POA, not ACD. There's no Special Disability Trust precedent in the repo; note that in the hand-off. The templates use Clio merge fields (`<< … >>`), so read `api/templates/1. Instructions for Clio Coded Precedents.docx` and `api/_lib/document-processor.ts` first. Edit the DOCX files with python-docx or direct XML, and keep all existing merge fields intact.

18. **Header on every body page:**
    - Top left: `WILL OF <FULL NAME IN CAPITALS>`.
    - Top right: `Page X of Y`, with X and Y bold.
    - The cover page has the "WILL OF" header but no page number and no signature footer. Page numbering starts on the first body page.
    - **No "St Ives Law" in the header.** The firm's address block stays on the cover pages only.
19. **Footer, left side:**
    - A signature line labelled `Testator` (male) or `Testatrix` (female), from `client_gender` / `spouse_gender`. Default to `Testator` when gender is missing, so nothing breaks before Make carries the field.
    - `Date ____/____/____` directly underneath.
20. **Footer, right side,** in this order:
    - the executor's printed name with a signature line
    - a signature line labelled `Witness 1`
    - a signature line labelled `Witness 2`

    The executor line is TODO(PENDING: Ces to confirm). Build it behind one flag or variable so it can be removed in one change.
21. **Switch Testator/Testatrix wherever the word labels the will-maker,** including signature blocks and "SIGNED by the Testator". **Do not change his/her pronouns** (PENDING: Sarah). List every place they appear.
22. **Last-page execution:** keep the current one. TODO(PENDING: Sarah to describe the new format).
23. **Clean name in the will title:** the client name in the title must never have a date or anything else appended. It happened in the 14 Oct demo; find the cause.

**Gender data path:** documents are generated from the Clio matter (`/api/clio-matter` → `toTemplateVariables`). So gender has to travel intake → payload (new keys) → Make → a Clio custom field → template variable. Add the payload keys, read the template variable with the `Testator` default, and list the new Clio custom fields under "Needs Make mapping". Also update `scripts/src/clio-create-fields.ts` if that's how fields are created; don't run it against live Clio.

#### Fixes from Isuru's questions (code traced 14 Oct)

24. **Early exit.**
    - Picking "Someone has died", "A concern about a will or estate" or "Not sure, I'd like to talk it through" on Q1 saves Q1 and Q2 and ends the form. The card stays in Appointment Sent with an "Early exit" chip.
    - The end screen still has a Back button. If the client goes back and submits, `/api/submit-form` returns **409 "already submitted"**, and the page shows a generic error. That's the most likely cause of the "Vercel rejected" error; confirm against the Vercel log for `/api/submit-form`.
    - Fixes:
      - (a) Hide the Back button after an early-exit save.
      - (b) Disable Next/Submit while a request is in flight (a double click also causes a 409).
      - (c) Show the server's error message, and show a friendly screen for "already submitted".
      - (d) In `api/_lib/server.js` `sendError`, log one line per 4xx: status, route and lead_id, no personal data. Today 4xx responses are not logged at all.
      - (e) Fix the dashboard text: the client stopped after Q2, not Q1.
25. **"I only see the last page."** `/api/get-form` deliberately returns `closed:true` with no data once an enquiry exists, and the dashboard's "View Details" opens the client link.
    - Render **all** saved enquiry answers inside the dashboard View modal, reusing the labels from `buildSummaryHtml` in lead-inquiry.html.
    - Replace "View Details" (which opens the client link) with the in-modal view.
    - For forms with no enquiry yet, offer "Copy enquiry link" instead of opening the form, so lawyers don't fill it in by mistake.
    - Do **not** send answers back to the client link (PENDING: Isuru).
26. **Moving a form from Appointment Sent to Scheduled.** Only a full enquiry submit moves it today; there's no manual control.
    - Add `markScheduled(formId)` in `dashboard-actions.ts`, modelled on `sendIntakeForm`: a conditional update on `status = 'appointment_sent'`, returning STALE when no row matches.
    - Add a confirmed "Mark as scheduled" button in the Appointment Sent modal. Warn when there's no completed enquiry or it was an early exit.
    - Default until Isuru decides: the owning lawyer or an admin can use it, and early-exit or no-enquiry forms are allowed with a warning.
    - This doesn't touch Make or Clio.

#### Small security fixes in scope

27. Redact the Make webhook URL in `E2E_TEST_REPORT.md`, and check that no other webhook URL, key or password is committed in HEAD.
28. Run `/security-review` on the branch at the end and report what it finds. Fix only what's inside this change. Larger items, such as moving `VITE_*` webhook calls server-side, go in the hand-off as follow-ups.

### Tests and definition of done

- Add tests under `tests/`, using Playwright against locally served HTML and a mocked API, plus node:test for pure functions. Use Chromium from your machine. Cover at least:
  - DD/MM typing stores ISO, including invalid dates
  - 3 meeting dates limited to the next 14 days in Adelaide time
  - organ donor Yes/No stores `Available`/`Not available`
  - conditional documents-to-bring items
  - file names with the Adelaide date edge case
  - matter_description for single and couple
  - Testator/Testatrix and the missing-gender default
  - the early-exit Back button hidden
  - Submit disabled while a request is in flight
  - Mark as scheduled stale handling
- Regenerate one male single, one female single and one couple will from fake data. Check the header, footer and page numbering in Word or via LibreOffice to PDF.
- `vite build` passes, the typecheck has only the baseline failure, and all tests pass.
- **Payload diff:** run `payload:snapshot` again, save it as `after.json`, and diff it with `before.json`. The only differences allowed are new keys, plus `matter_description` and the file names. Paste the diff into the hand-off.
- Write `docs/CR-2026-10-14-handoff.md` covering:
  - items done or not done, by number
  - files changed
  - the payload diff
  - **"Needs Make mapping"**: every new key, its suggested Clio field and its type
  - places where pronouns appear
  - follow-ups
  - what wasn't tested

---

## Part C: Dilshan's to-dos

### Make.com (not done by Claude)

- Map every new payload key from the hand-off's "Needs Make mapping" list to Clio, creating Clio custom fields where needed:
  - `client_gender`, `spouse_gender`: needed for Testator/Testatrix to work end to end
  - the new asset fields and property holding type
  - testamentary trust answers
  - `preferred_meeting_date_2`, `preferred_meeting_date_3`
  - burial or ashes location
  - `matter_description`
- **Matter name:** set the Clio matter description from `matter_description` in place of the current "Single lead"/"Couple lead" text.
- **`signing_date`:** it now holds the client's preferred **first meeting** date. Rename the Clio field label, or map it to a new field, so nobody reads it as a signing date.
- Re-import or refresh the blueprints in the repo after the change (the live scenario isn't in the repo today).

### Email drafts (not done by Claude)

- Swap the automated enquiry-form and intake-form emails for St Ives' standard email script once Ces sends it.

### Testing (Dilshan)

- **Local:** run the tests and the payload diff from Part B.
- **Live, on a Vercel preview and with a test Clio matter only:**
  1. Create a test lead, send the enquiry, and complete it with `isuru+test` emails.
  2. Try an early exit followed by Back (expect a friendly screen, not an error).
  3. Use Mark as scheduled.
  4. Send the intake and fill it as a male single, then as a couple with one female.
  5. Populate Clio and check every field in the matter, including that the DOB still arrives and organ donation still reads Available/Not available.
  6. Generate Will, POA and ACD, and check the file names, matter name, header, footer and Testator/Testatrix.
- Ask Ces to confirm whether her Clio matter numbers now auto-generate.

---

## Part D: Everything pending right now

| # | Item | Owner |
|---|---|---|
| 1 | Make the repo private; rotate the Make webhook URLs | Dilshan / Isuru (urgent) |
| 2 | Give `isuruabeysekara98-dev` Write access to `st-ives-law` | Isuru (`client-relations` account) |
| 3 | Executor in the will footer: wanted? | Ces |
| 4 | Standard email script for the enquiry and intake emails | Ces |
| 5 | File naming conventions for the remaining documents (TT, SDT, letter of wishes, others) | Ces |
| 6 | List of manual steps she still does after intake and after documents are generated | Ces |
| 7 | Contact Clio about matter auto-numbering; email IT support about Sarah's Clio desktop app | Ces |
| 8 | Trust deed as the document to bring for family/unit trusts (transcript unclear) | Sarah |
| 9 | Switch his/her pronouns in the attestation clauses by gender? | Sarah |
| 10 | New last-page execution format (mentioned, not described) | Sarah |
| 11 | Should Schedule A (trust provisions) get the "WILL OF" header and page numbers? In the executed wills it has the signature footer only | Sarah |
| 12 | Is there a Special Disability Trust precedent? None in the repo | Sarah / Ces |
| 13 | Early exit: remove the Back button (default in Part B), or let the client complete the full enquiry later? | Isuru |
| 14 | Should reopening the client link show the client's saved answers? (Privacy trade-off; default is dashboard only) | Isuru |
| 15 | Mark as scheduled: who may use it, and allowed for early-exit or no-enquiry forms? (Defaults in item 26) | Isuru |
| 16 | Vercel log line for the rejected submission, to confirm the 409 cause | Isuru / Dilshan |
| 17 | Moving `VITE_*` webhook calls server-side so webhook URLs aren't in the public bundle | Next change request |
| 18 | Book the sign-off call with Sarah for Fri 23 Oct (through Ces); send Sarah the drafts for feedback | Isuru |
| 19 | The Ultron factory run in Isuru's cloud session is paused. Only the payload check (attached patch) and the answers to Isuru's questions (used above) were finished. This handover replaces the rest of that run | for information |

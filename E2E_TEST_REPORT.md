# St Ives Law — End-to-End Production Test Report

**Target:** https://st-ives-law.vercel.app/
**Date:** 2026-09-22 (all times UTC)
**Tester:** Automated E2E walkthrough (Claude Code)
**Method:** Real lead pushed through the full pipeline on production, with Make.com
execution logs and Supabase records used as independent verification.

---

## Verdict

**The happy path is broken at the final step.** Everything from lead capture through
document generation works. The generated will **never reaches Clio** — the upload
endpoint fails with a 500 on every attempt, and the Make scenario meant to receive
the document is switched off.

Separately, there is a **serious access-control problem**: a hardcoded demo login on
the production site grants full admin access to the lawyer dashboard and all client
records in it.

| Stage | Result |
|---|---|
| 1. Create lead (screening form) | PASS |
| 2. Qualify → "Send Appointment" | PASS (webhook fired) |
| 3. Inquiry email delivery | PASS (wiring) / see Bug 3 |
| 4. Client fills 8-question inquiry form | PASS |
| 5. Status `appointment_sent` → `scheduled` | PASS |
| 6. "Send Intake Form" | PASS (webhook fired) |
| 7. Client fills 14-step intake form | PASS |
| 8. Autosave + progress tracking | PASS |
| 9. Status → `completed_intake`, 100% | PASS |
| 10. Generate DOCX + PDF | PASS |
| 11. "Populate Matter → Clio" | PASS (matter created) |
| 12. "Send to Clio" (attach will document) | **FAIL** |
| 13. Status → `submitted` | **NEVER REACHED** |

---

## Fix status (updated after remediation)

| # | Finding | Status |
|---|---|---|
| 1 | Will document never reaches Clio | **Code fixed** — Make scenario `Sending Document` (9826270) still needs enabling |
| 2 | Hardcoded demo login on production | **Fixed** — gated to dev builds, verified absent from production bundle |
| 3 | Emails report success when delivery fails | **Fixed** — recipient validation + visible warning to the lawyer |
| 4 | `Email Confirmation` scenario off | Not a code issue — enable scenario 9694082 in Make |
| 5 | Dashboard blanks to zero after creating a lead | **Fixed** — verified live |
| 6 | Success panel shows before submit | **Retracted** — false positive, see below |
| 7 | Will can be generated with no beneficiaries | Open |
| 8-11 | Prefill, console PII, lawyer list, dead endpoint | Open |

Also fixed alongside #7's area: `personal_belongings_to` now reaches Clio, and the
intake/inquiry merge order no longer lets stale inquiry answers overwrite intake ones.

---

## Test data used

A deliberately-labelled test record with a non-deliverable address
(`example.com` is reserved by RFC 2606, so no real inbox was contacted).

| Field | Value |
|---|---|
| Client name | `ZZ TEST - AUTOMATED QA` |
| Email | `qa-stives@example.com` |
| Screening ID | `e6b9db30-f6fc-4c1b-a890-1750b472b5b7` |
| Form ID | `3a943ea1-23c2-45d4-982b-c2af5cde56d7` |
| Clio matter ID | `4076893` |

---

## Timeline (verified against Make execution logs)

| Time | Event | Evidence |
|---|---|---|
| 10:45:03 | Lead created in Supabase | screenings 19 → 20 |
| 10:45:59 | `Inquiry Form Sending` (9795622) fired | status 3 — SMTP rejected test domain |
| ~10:47 | Client submitted inquiry form | summary rendered, status → `scheduled` |
| 10:48:39 | `Intake Form Sending` (9795689) fired | status 3 — SMTP rejected test domain |
| ~10:52 | Intake submitted | autosave 200, progress 100%, will text 5,148 chars |
| 10:58:27 | `Integration Webhooks, Clio Manage` (9790984) | **status 1 — SUCCESS**, 4 operations |
| ~11:00 | `POST /api/send-to-clio-multipart` | **HTTP 500** |

---

## Bugs

### 1. CRITICAL — The will document never reaches Clio

`POST /api/send-to-clio-multipart` returns **500** every time. The lawyer sees:

```
Failed to send to Clio: Unexpected token 'A', "Accepted" is not valid JSON
```

**Root cause** — [api/send-to-clio-multipart.ts:92](api/send-to-clio-multipart.ts):

```js
const result = await response.json();
```

The code POSTs the document to a Make.com webhook. Make replies with the plain
string `Accepted`, not JSON. `response.json()` throws, the catch block returns 500,
and the document is lost.

**Second, independent failure.** The webhook it targets
(`hook.eu2.make.com/5n4gkxu...`, hardcoded at line 71) produced **no scenario
execution at all** during the test. The scenario that appears to own it,
**`Sending Document` (ID 9826270), is switched OFF** in Make. So even with the JSON
bug fixed, the document would go nowhere.

**Consequence:** matters are created in Clio with client data, but with **no will
document attached**. Form status never advances past `completed_intake`.

**Fix:** change line 92 to read the response as text, and turn on the receiving
Make scenario (or repoint the hardcoded URL at a live one).

---

### 2. CRITICAL (security) — Hardcoded demo login grants admin on production

Anyone who visits https://st-ives-law.vercel.app/login can sign in with:

```
test@test.com / password123
```

This is checked **before** Supabase is contacted, in
[LoginPage.tsx:18](artifacts/questionnaire/src/pages/LoginPage.tsx). It sets a
localStorage flag that [AuthContext.tsx:29](artifacts/questionnaire/src/context/AuthContext.tsx)
maps to a real admin identity (`Sarah Southern`, `is_admin: true`).

I used this to run the test — no Supabase account was needed. It exposes the full
dashboard: every client name, email, and estate-planning answer. For a law firm
holding privileged client data this is a disclosure risk and should be removed
before anything else on this list.

The code comment already says `// Demo mode for testing (remove in production)`.

---

### 3. HIGH — Emails report success even when delivery fails

Both email sends were reported as successful by the app:

```
Inquiry form email sent successfully
Intake form email sent successfully
```

Both had **actually failed** in Make:

```
Can't send mail - all recipients were rejected:
501 5.1.5 Recipient address reserved by RFC 2606
```

The frontend treats the webhook's HTTP 200 as proof of delivery. Make acknowledges
receipt instantly and sends the mail afterwards, so any downstream failure — bad
address, expired mailbox connection, scenario off — is invisible to the lawyer.

In this test the bounce was deliberate (reserved test domain), but the same silence
would hide a genuine typo in a real client's address. The firm would believe a
client had been contacted when they had not.

---

### 4. HIGH — `Email Confirmation` scenario is switched OFF

Scenario **9694082** is disabled in Make. The app calls
`VITE_EMAIL_CONFIRMATION_WEBHOOK` on submission, so clients are currently **not**
receiving confirmation that their intake form was received. Combined with Bug 3,
this fails silently.

---

### 5. MEDIUM — Dashboard blanks to zero after creating a lead

After submitting a new screening, all three counters drop to `0` and every list
empties. The data is fine — the console showed `Fetched screenings: 20`,
`Fetched forms: 10` at the moment the UI displayed zeros. A manual page reload
restores it.

A lawyer creating a lead sees their entire dashboard apparently wipe itself.

---

### 6. RETRACTED — "Form Submitted Successfully" shows before the client submits

**This finding was wrong and has been withdrawn.**

Re-tested against a fresh, untouched intake form: `#result-wrap` is
`display: none` (set at [intake-form.html:80](artifacts/questionnaire/public/intake-form.html))
and is only revealed by the submit handler, or by `showGeneratedWillReadonly()`
which fires exclusively under `?readonly=true` — a lawyer review mode, not the
client flow.

The original observation had two causes: the detector matched the `<script>`
tag's own source text (a `<script>` element has `textContent` and no children),
and by the time it ran, the test automation had already triggered a reveal path.

No code change made. The client flow is correct.

---

### 7. MEDIUM — A will can be generated with no beneficiaries

The intake form never requires a residuary beneficiary. My test produced a complete,
downloadable will with:

```
Beneficiary 1: (not specified)
Beneficiary 2: (not specified)
Beneficiary 3: (not specified)
```

Executor, organ donation, burial/cremation, EPA and custody are all mandatory, but
the people who inherit are not. For a will-drafting product this is the most
consequential field to leave unvalidated.

---

### 8. LOW — Client re-enters details the firm already has

The inquiry form asks for name, email, phone and state, all captured during
screening. Nothing is prefilled. Same again on the intake form. Besides the friction,
it allows the client's record to diverge from the screening record.

---

### 9. LOW — Client PII logged to the browser console in production

The production build logs full client objects on every dashboard render:

```
DEBUG: viewingIntakeForm: {id: ..., client_name: ..., client_email: ...}
[AUTO-SAVE] Collected data: {client_name: ..., client_address: ...}
```

Client names, emails and addresses in console output on a production legal system.

---

### 10. LOW — Lawyer lists disagree

"Person Responsible" on the screening form offers only **Sarah Southern** (read from
the `lawyers` table), while [SignUp.tsx:5](artifacts/questionnaire/src/pages/SignUp.tsx)
hardcodes six: Colin Long, Emma Mathieson, Katrina Elizabeth Brown, Sarah Tait,
Tyler Smith, Vicki Baker. New leads cannot currently be assigned to anyone else.

---

### 11. LOW — Dead endpoint still referenced

[DocumentEditorV2.tsx:94](artifacts/questionnaire/src/components/DocumentEditorV2.tsx)
calls `/api/send-to-clio`, which was deleted in commit `93535df`. It now returns
**405**. The live UI happens to use a different component, so this is dormant rather
than broken — but it is a trap for the next person.

---

## What works well

- **Status transitions are correct** throughout: `pending` → `appointment_sent` →
  `scheduled` → `pending_intake` → `completed_intake`.
- **Autosave is solid.** Every step persisted with HTTP 200 and accurate progress.
- **Validation works** where it exists — "Select at least one document." correctly
  blocked step 3, and conditional steps (life tenancy) are skipped properly.
- **Document generation works**, including PDF. `/api/generate-document` returned
  a 739 KB DOCX plus a PDF — LibreOffice is evidently available on Vercel, contrary
  to the caveat in CLAUDE.md.
- **Data mapping is accurate.** Client name, address, executor and jurisdiction all
  flowed intake → document correctly.
- **Clio matter creation genuinely works** — scenario 9790984 succeeded with 4
  operations against `au.app.clio.com`.

---

## Cleanup required

Test artifacts created in live systems:

| System | Record | Action |
|---|---|---|
| **Clio (AU)** | Matter **`4076893`** + contact `ZZ TEST - AUTOMATED QA` | Delete — visible to firm staff |
| Supabase `forms` | `3a943ea1-23c2-45d4-982b-c2af5cde56d7` | Delete |
| Supabase `screening_submissions` | `e6b9db30-f6fc-4c1b-a890-1750b472b5b7` | Delete |
| Make history | 2 failed executions (9795622, 9795689) | None — harmless log entries |

No email reached a real person: both sends were rejected at SMTP because the test
domain is reserved.

---

## Not tested

- **"Send Back Reminder"** — would have sent another email; skipped.
- **Reminder schedule (3d / 1w / 2w)** — time-based, cannot be exercised on demand.
- **Couple scenario** — only the Single path was walked.
- **Other will templates** — only `simple_will / individual` of six was generated.
- **DOCX/PDF download** — blocked by the test sandbox; the API was verified instead.
- **Real Supabase auth login** — demo mode was used, so the genuine
  email/password path and its RLS behaviour remain unverified.

---

## Recommended order of work

1. **Remove the demo login** (Bug 2) — smallest change, largest exposure.
2. **Fix the Clio document upload** (Bug 1) — one-line parse fix, plus switch the
   `Sending Document` scenario on. This is what makes the product actually finish.
3. **Turn on `Email Confirmation`** (Bug 4).
4. **Surface real email delivery status** (Bug 3) — stop reporting success on a
   webhook ack alone.
5. **Require beneficiaries** (Bug 7).
6. Then the UI issues: dashboard refresh (5) and premature success panel (6).

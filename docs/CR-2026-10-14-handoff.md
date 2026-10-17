# CR 2026-10-14: hand-off

What Part B of [HANDOVER-CR-2026-10-14.md](HANDOVER-CR-2026-10-14.md) produced. Branch: `claude/new-session-gfqv1e` (built in a Claude Code cloud session, which works on that branch instead of `feature/cr-2026-10-14`). Nothing is merged or deployed.

## Status by item

| # | Item | Status |
|---|---|---|
| 1 | Dates as DD/MM/YYYY, stored ISO | Done. Typed or picked from a calendar; invalid dates are refused and never stored. |
| 2 | Gender (`client_gender`, `spouse_gender`) | Done. `Male`/`Female`, required for each will-maker. |
| 3 | Full asset list | Done. Existing keys kept; new repeat rows `investment_property`, `vehicle`, `shares`, `insurance`, `smsf`, `money_owed`, `inheritance`, `entity`. |
| 4 | Property holding | Done. Shown as "Held as" on each property, stored under the existing `Tenancy type` key, with a new `Don’t know` option. |
| 5 | Testamentary trust as a document type | Done (`doc_tt`). |
| 6 | Testamentary trust page before the SDT page | Done (`has_tt` Yes/No/Not sure, `tt_beneficiaries`). |
| 7 | Explanatory notes | Done, in Sarah's wording, on all eight sections. |
| 8 | "Preferred first meeting date" | Done. The key is still `signing_date`, still ISO. The draft text always prints a blank `Executed by … on ____`. |
| 9 | Three meeting dates, today to today + 14 in Adelaide | Done (`preferred_meeting_date_2`, `preferred_meeting_date_3`). |
| 10 | Organ donor Yes/No | Done. Stored values stay `Available`/`Not available`. |
| 11 | "Other wishes for your body" label | Done. The key is still `funeral_other`. |
| 12 | Burial place or place for the ashes | Done (`remains_place_choice`, `remains_place`). |
| 13 | Documents to bring page | Done. The trust deed line carries TODO(PENDING: Sarah). |
| 14 | `matter_description` | Done. Needs Make (see below). `lead_type` is unchanged. |
| 15 | Draft file names | Done. Uses the Adelaide date, and each spouse's copy carries their own name. |
| 16 | Other document names | Not changed (PENDING: Ces). TODO in `documentNames.ts`. |
| 17 | Matter numbers | Reported below; nothing changed. |
| 18 | Header | Done on the 10 will precedents. See the page-count note below. |
| 19 | Footer left (Testator/Testatrix, Date) | Done. Defaults to Testator. |
| 20 | Footer right (executor, Witness 1, Witness 2) | Done. The executor block can be switched off with `WILL_FOOTER_SHOWS_EXECUTOR` in `document-processor.ts` (PENDING: Ces). |
| 21 | Testator/Testatrix in the body | Done, through the `<< Will.TestatorLabel >>` merge field. Pronouns are unchanged; see below. |
| 22 | Last-page execution | Unchanged. TODO(PENDING: Sarah) in `document-processor.ts`. |
| 23 | Clean name in the will title | Fixed. See the cause below. |
| 24 | Early exit (a–e) | Done. See the Vercel log note under Follow-ups. |
| 25 | Enquiry answers in the dashboard | Done. Nothing is sent back to the client link (PENDING: Isuru). |
| 26 | Mark as scheduled | Done. Owning lawyer or admin; early-exit and no-enquiry forms are allowed with a warning (PENDING: Isuru). |
| 27 | Redact the webhook URL | Done. No other webhook URL, key or password is in HEAD. Git history still has old values (Part A). |
| 28 | `/security-review` | Run. No high-confidence findings. Notes are under Follow-ups. |

## Not in the handover, but fixed (important for Make)

The dashboard tells a couple from a single by parsing the Clio display number, which today embeds Make's description: `Name (Job) and Spouse (Job) - Married - … - Last, First`. Once Make sets the description from `matter_description`, every couple would have read as a single client called "Estate Planning".

`deriveFromDisplayNumber` in `api/_lib/clio-client.ts` now recognises `Estate Planning - Single|Couple - Last, First`. It takes the second spouse from a new Clio custom field, **`SpouseName`**. **Make must map `spouse_name` to `SpouseName` before (or together with) the switch to `matter_description`.** Otherwise couples' second wills will have no name.

## Needs Make mapping

Every new payload key. All of them are one-line text unless noted. Clio text fields hold 255 characters, and the payload already clamps longer values.

| Payload key | Suggested Clio custom field | Type | Notes |
|---|---|---|---|
| `matter_description` | the matter's own **description** (not a custom field) | text | Replaces the "Single lead"/"Couple lead" text. Clio prefixes the matter number. |
| `spouse_name` (existing key) | `SpouseName` | text | **Required for couples** once `matter_description` is used (see above). |
| `client_gender` | `ClientGender` | text (`Male`/`Female`) | Drives Testator/Testatrix. |
| `spouse_gender` | `SpouseGender` | text | Couples only. |
| `preferred_meeting_date_2` | `PreferredMeetingDate2` | date (ISO) | |
| `preferred_meeting_date_3` | `PreferredMeetingDate3` | date (ISO) | |
| `signing_date` (existing key) | existing field, **relabel** "Preferred first meeting date" | date | Now holds the first-meeting date (Part C). |
| `wants_testamentary_trust` | `WantsTestamentaryTrust` | text (Yes/No/Not sure) | |
| `testamentary_trust_for` | `TestamentaryTrustFor` | text | |
| `funeral_remains_place` | `FuneralRemainsPlace` | text | A place, or "Leave it to my executor or family". |
| `assets_investment_property` | `AssetsInvestmentProperty` | text (multi-line) | Includes the "Held as" value, in the same shape as `assets_real_estate`. |
| `assets_vehicles` | `AssetsVehicles` | text (multi-line) | |
| `assets_shares` | `AssetsShares` | text (multi-line) | |
| `assets_insurance` | `AssetsInsurance` | text (multi-line) | Life, TPD, income protection. |
| `assets_smsf` | `AssetsSmsf` | text (multi-line) | |
| `assets_money_owed` | `AssetsMoneyOwed` | text (multi-line) | |
| `assets_inheritance` | `AssetsInheritance` | text (multi-line) | |
| `assets_entities` | `AssetsEntities` | text (multi-line) | |
| `has_existing_documents` | `HasExistingDocuments` | text (Yes/No) | Optional. |
| `documents_to_bring` | `DocumentsToBring` | text (multi-line) | Optional; useful in the confirmation email. |

Property holding needs no separate key: it already appears in `assets_real_estate` and `assets_investment_property` (e.g. `• 1 Test St (Joint tenants) - $900000`). `documents_required` gains a `• Testamentary Trust` line when that box is ticked.

`scripts/src/clio-create-fields.ts` has `ClientGender`, `SpouseGender` and `SpouseName` added. It was **not run** against live Clio. Create the other fields in Clio, or add them to that script.

## Payload diff

`payload:snapshot` before (commit f5510bd) and after (this branch), both run with `pnpm --silent`:

- **`clio_payload`, both fixtures:** no existing key removed or changed. 18 keys added (`assets_entities`, `assets_inheritance`, `assets_insurance`, `assets_investment_property`, `assets_money_owed`, `assets_shares`, `assets_smsf`, `assets_vehicles`, `client_gender`, `documents_to_bring`, `funeral_remains_place`, `has_existing_documents`, `matter_description`, `preferred_meeting_date_2`, `preferred_meeting_date_3`, `spouse_gender`, `testamentary_trust_for`, `wants_testamentary_trust`). Their values are empty for the old fixtures, except:
  ```
  +  "matter_description": "Estate Planning - Couple - Client-Two, Test"
  +  "matter_description": "Estate Planning - Single - Client, Test"
  ```
- **Template variables:** `Will.TestatorLabel: "Testator"` is added in every version. The couple's second version also gains the swapped `Matter.CustomField.ClientGender`/`SpouseGender` (empty in the fixture). No value changed.
- **Documents:** in each will, the old `PAGE \* MERGEFORMAT` footer is replaced by the new parts. For example (single):
  ```
  -  "word/footer5.xml": "PAGE   \\* MERGEFORMAT 2"
  +  "word/header1.xml": "WILL OF Test Client",
  +  "word/header2.xml": "WILL OF Test Client\tPage  PAGE 1 of  SECTIONPAGES 1"
  +  "word/footer2.xml": "____\nTestator\nDate ____/____/____\n____\nTest Executor-One\n____\nWitness 1\n____\nWitness 2"
  ```
  Titles, execution lines, Testator counts and unfilled placeholders are unchanged.
- **Form contract:** new inputs, repeat rows and option values only (`Don’t know` added to `Tenancy type`). `step_count` and `server_total_steps` both go from 15 to 17. `lead-inquiry` is unchanged.

The file names (item 15) live in a React component, which the snapshot doesn't cover. Unit tests cover them instead.

## Item 17: matter numbers

Nothing in this repo sets a Clio matter number. The app only reads `display_number`. The only Clio blueprint in the repo (`clio_au_complete_blueprint.json`, older than the live scenario) posts `/matters` with `client_id`, `practice_area`, `description`, `status` and `custom_fields`, and **no number**, so Clio's own numbering applies. Whether that is automatic depends on the firm's Clio setting (Settings → Matters → matter numbering) and on the live Make scenario, which isn't in the repo. Ask Ces to check both. Switching to auto-numbering won't break the app: the display-number parser strips any leading number.

## Item 23: the date in the will title

The will title, header and execution block printed `Matter.Client.Name` unchecked. Two ways a tail gets onto it:

- **When Clio redacts the contact name,** the name comes from the display number. For Make-created matters that carries `(occupation) - Married - … - Last, First`.
- **The test matters made by `scripts/checks/clio-mapping-check.ts` and `clio-full-doc-test.ts`** put a date-time stamp in the contact's last name (`… DOCTEST Single 14-Oct-2026-10-22-33`). This is the most likely source of the date seen in the demo; I couldn't confirm which matter was used.

`cleanPersonName()` in `clio-client.ts` strips dates, stamps, bracketed notes and spaced ` - ` tails, and keeps hyphenated names. It runs both when the matter is read and at merge time.

## Pronouns (item 21, PENDING: Sarah)

None of the 10 will precedents contains his, her, hers, him, he, she, himself or herself. The only pronoun about the will-maker is **"their"** in the attestation clause, once per precedent: "Signed by << name >> as their last will … at their request and in their presence …". It is in Simple, Single TT and Multi TT, and their Foreign Persons Excluded variants, Individual and Couple. The roughly 900 other they/them/their uses refer to executors, trustees or beneficiaries. The "[#if Testator wishes …]" drafting notes keep the word Testator.

## Files changed

- **Intake:**
  - `artifacts/questionnaire/public/intake-form.html`
  - `api/submit-intake.js` (`TOTAL_STEPS` 17)
  - `api/_lib/send-back.js` (labels; gender checked)
- **Payload and Clio:**
  - `api/_lib/clio-payload.ts`
  - `api/_lib/clio-client.ts`
  - `scripts/src/clio-create-fields.ts`
- **File names:**
  - `artifacts/questionnaire/src/lib/documentNames.ts` (new)
  - `artifacts/questionnaire/src/components/ClioDocumentGeneration.tsx`
- **Documents:**
  - the 10 will precedents in `api/templates/`
  - `api/_lib/document-processor.ts`
  - `api/generate-document.ts`
  - `scripts/will-header-footer.py` (the edit, re-runnable; refuses to lose a merge field)
  - `scripts/checks/render-wills.ts`
- **Enquiry and dashboard:**
  - `artifacts/questionnaire/public/lead-inquiry.html`
  - `api/_lib/server.js`
  - `api/submit-form.js`
  - `artifacts/questionnaire/src/lib/dashboard-actions.ts`
  - `artifacts/questionnaire/src/lib/enquiry-summary.ts` (new)
  - `artifacts/questionnaire/src/lib/supabase.ts` (one line, so the unit tests can import it)
  - `artifacts/questionnaire/src/pages/DashboardV2.tsx`
  - `artifacts/questionnaire/src/styles/dashboard.css`
- **Tests and tooling:**
  - `tests/` (new)
  - `playwright.config.js`
  - `package.json`
  - `pnpm-lock.yaml` (adds `tsx` at the root)
  - `scripts/checks/payload-snapshot.ts` (the couple gender swap mirrored)
- **Docs:**
  - `E2E_TEST_REPORT.md` (redaction)
  - `docs/HANDOVER-CR-2026-10-14.md`
  - this file

## Checks run

- `pnpm run test:unit`: 36/36 pass.
- `pnpm run test:e2e`: 26/26 pass. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chromium, or let Playwright find its own.
- These cover every case in the handover's list:
  - DD/MM to ISO, including invalid dates
  - the 14-day Adelaide window
  - organ donor Yes/No
  - documents to bring
  - the file-name Adelaide edge case
  - `matter_description` for single and couple
  - Testator/Testatrix and the missing-gender default
  - Back hidden after an early exit
  - Submit disabled while a request is in flight
  - Mark as scheduled stale handling
- The tests make no real network calls: every non-localhost request is aborted, and `/api` is mocked.
- `pnpm run typecheck`: only the baseline `scripts/src/clio-reauth.ts` TS1375 failure.
- `vite build`: passes.
- Rendered through LibreOffice to PDF, from fake data: a male single Simple Will, a female single Single TT Will, and both halves of a couple Multi TT Will.

## Not tested

- **Page totals:** "Page X of Y" uses Word's SECTIONPAGES field, so the cover isn't counted. **LibreOffice can't calculate it and prints "of 1"**; Word should show the right total, but nobody has checked yet. Open one generated will in Word to check.
- **The dashboard in a browser:** the View modal and Mark as scheduled need a real Supabase session. Only the typecheck, the build and the unit tests cover them.
- **Live services:** nothing was tested against Make, Clio, Supabase or Vercel (Part C).
- **Calendar button:** the native date picker it opens (`showPicker`) was only checked in Chromium. Typing DD/MM/YYYY works everywhere.

## Follow-ups

- **Make must map the keys above**, `SpouseName` first (see "Not in the handover").
- **Footer height:** the new footer is about 1.3 inches tall and takes space from the body on every page. Sarah may want it smaller.
- **Schedule A** now carries the body header and footer (PENDING: Sarah, Part D #11).
- **The Foreign Persons Excluded will variants are edited but never generated:** `generateWillFromTemplate` has no entry for them. This gap predates the branch.
- **There is no Special Disability Trust precedent** in the repo (Part D #12).
- **Unescaped merge values:** `processDocxTemplate` doesn't XML-escape them, so a name with `&` or `<` could produce a DOCX that won't open. This predates the branch.
- **Test matter names:** the check scripts should stop putting date stamps in test contacts' names.
- **Resuming forms:** clients halfway through an intake resume one page earlier than before, because the testamentary trust page was inserted before the SDT page. This is harmless.
- **Webhook URLs in the public bundle:** move the `VITE_*` webhook calls server-side (Part D #17).
- **Old secrets:** rotate them and make the repo private (Part A).
- **Early exit:** confirm the 409 cause from the Vercel log for `/api/submit-form` (Part D #16). The new log line (`[api] 409 /api/submit-form lead_id=…`) will show it from now on.

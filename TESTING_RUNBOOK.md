# Intake Test Runbook

End-to-end QA for the St Ives Law intake pipeline — every workflow in the order a
real client moves through it, what to click, what should happen, and where to
check that it actually did.

**Run the stages in order.** Each one depends on data the previous stage creates.

Use recognisable test values throughout — `TEST-ExecInitial`, `TEST-Beneficiary1` —
so you can trace one client's answers from the form all the way into the finished
will.

---

## Read this first: the four-hop chain

A client's data crosses **four systems** before it reaches a document:

```
client fills form  →  Supabase  →  populate-clio flattens it  →  Make maps it  →  Clio
```

**Make does the Clio field mapping, not our code.** Our endpoint posts a flat JSON
payload to a Make webhook; the Make scenario decides which Clio custom field each
key becomes.

So when a field goes missing, work backwards rather than assuming the app is broken:

| Is it in Supabase `form_data`? | Then the problem is |
|---|---|
| Yes | Make's mapping — check the scenario's execution log |
| No | The form never captured it |

---

## 1. Create a lead

The pipeline starts inside the dashboard. Nothing is emailed at this stage.

- [ ] **New Lead → fill the screening form → save**
  - **Do:** Sidebar **+ New Lead**. Fill name, email, mobile, lead type, region,
    **person responsible**, referral and billing type.
  - **Expect:** Appears under **Leads → Pending**. No email sent.
  - **Verify:** Supabase `screening_submissions` — new row, `status = 'pending'`.
  - ⚠️ Set *person responsible* to yourself. Lawyers only see records assigned to
    them, so the wrong name makes the lead vanish from your view.

- [ ] **Reject a lead, and delete a lead**
  - **Do:** On a second test lead press **Reject**. On a third press **Delete**.
  - **Expect:** Reject → `status = 'rejected'`, row stays. Delete → row gone.
  - **Verify:** Reject only works while the lead is `pending`. Rejecting an
    already-qualified lead should refuse with a "changed since you loaded it" message.

---

## 2. Qualify → first email goes out

Qualifying turns a lead into a client record and sends the first email.

- [ ] **Qualify the lead**
  - **Do:** Open the pending lead → **Qualify**.
  - **Expect:** Screening becomes `qualified`; a new `forms` row is created at
    `appointment_sent`; the **Initial Outreach** email is sent.
  - **Verify:**
    - Card moves to the **Appointment Sent** column
    - Client inbox has the email linking to `/lead-inquiry?lead_id=…`
    - Make → the `SEND_INQUIRY_FORM_WEBHOOK` scenario shows a successful run
  - ⚠️ If no email arrives the qualify still succeeds — email failure is reported
    separately and does not roll back the form. Check the Make execution history
    first; that tells you whether the request even arrived.

---

## 3. Initial Outreach Form — the short one

8 questions. Its job is to qualify the enquiry, not collect will data.

- [ ] **Client completes it with a _qualifying_ reason**
  - **Do:** Open the emailed link. On Q1 pick **"Put a will or estate plan in place"**
    or **"Update an existing one"**. Answer all 8: contact details, complexity flags,
    assets, goals, executor confidence, funeral wishes, notes.
  - **Expect:** Status `appointment_sent` → `scheduled`. Summary screen with a tick.
  - **Verify:** Card moves to **Scheduled**. Dashboard modal → **Initial Outreach
    Form** block shows name, email, phone, state, reason.

- [ ] **Client picks a _non-qualifying_ reason (early exit)**
  - **Do:** On a separate lead pick one of: **someone has died**, **a concern about
    a will**, or **not sure, I'd like to talk it through**.
  - **Expect:** Form stops after Q2. Questions 3–8 never appear. Partial data is
    still saved so the firm can call them back.
  - **Verify:** A tailored message appears — a bereavement answer gets a condolence,
    not a form. Name and contact details are in Supabase; status does **not**
    advance to `scheduled`.
  - ⚠️ Test all three non-qualifying answers — each shows different copy. This
    branch is easy to miss and the most likely to be wrong.

---

## 4. Send the Intake Form — second email

- [ ] **Send Intake Form**
  - **Do:** Open the **Scheduled** card → **Send Intake Form**.
  - **Expect:** Status → `pending_intake`, progress resets to 0%, `intake_sent_at`
    is stamped, all three reminder flags cleared.
  - **Verify:**
    - Card moves to **Pending Intake**
    - Email arrives linking to `/intake-form?lead_id=…`
    - Make → `SEND_INTAKE_FORM_WEBHOOK` ran
  - ⚠️ Reminder flags reset here — re-sending restarts the 3-day / 1-week / 2-week
    clock. Check `reminder_3d_sent` and friends go back to null.

---

## 5. Intake Form — the long one

14 steps, **93 fields**. Everything the wills need comes from here. This is the
test that matters most.

- [ ] **Complete all 14 steps, filling every field**
  - **Steps:** 1 Scenario & client · 2 Assets · 3 Document types · 4 Executors ·
    5 Exclusions · 6 Specific gifts · 7 Company · 8 Life tenancy · 9 Residuary
    estate · 10 Special disability trust · 11 Guardians · 12 Funeral wishes ·
    13 EPA · 14 Letter of wishes
  - **Do:** Use values you can recognise later so you can grep for them in Clio
    and in the finished will.
  - **Expect:** Status → `completed_intake`, progress 100%.
  - **Verify:** Card moves to **Completed Intake**. Modal shows the **Intake Form**
    block with client, state, scenario.
  - ⚠️ Test the couple path separately. Pick **Couple** at step 1 and fill the
    spouse — couple and single take different template branches downstream and
    both must be exercised.

- [ ] **Partial save and resume**
  - **Do:** Fill 5 steps, close the tab, reopen the same link.
  - **Expect:** Answers still there, progress reflects how far they got.

---

## 6. Send Back Reminder

For a form the client marked complete but which is missing answers. Emails them a
list of exactly what's still blank.

- [ ] **Send back an incomplete intake**
  - **Setup:** Complete an intake but deliberately leave several fields blank.
  - **Do:** Open the **Completed Intake** card → **Send Back Reminder**.
  - **Expect:** Email lists the blank fields by name. `send_back_at` stamped,
    `send_back_count` increments.
  - **Verify:** Make → `SEND_BACK_WEBHOOK` ran. Re-open the client link — it should
    be editable again, not locked.
  - ⚠️ Only valid at `completed_intake`. Trying it earlier should be refused. Send
    it twice and confirm the counter goes to 2.

---

## 7. Automatic reminders

A daily job chases clients who were sent an intake form and haven't finished it.

| Tier | Fires after | Column stamped |
|---|---|---|
| 3 days | 72h from `intake_sent_at` | `reminder_3d_sent` |
| 1 week | 7 days | `reminder_1w_sent` |
| 2 weeks | 14 days | `reminder_2w_sent` |

- [ ] **Force a reminder without waiting three days**
  - **Do:** In Supabase set `intake_sent_at` on a `pending_intake` form to 4 days
    ago and clear the three reminder columns. Then trigger `/api/send-reminders`.
  - **Expect:** One email — the **highest tier due**, not all three.
    `reminder_3d_sent` stamped.
  - **Verify:** Run it a second time immediately — **no second email**. That stamp
    is what prevents duplicates.
  - ⚠️ Scheduled at 23:00 UTC daily via Vercel Cron. Only chases forms still at
    `pending_intake`; a completed form is never chased.

---

## 8. Populate Matter → Clio

Pushes the intake answers into Clio as a matter with custom fields. This feeds
document generation — if it's wrong, every document is wrong.

- [ ] **Push a completed intake to Clio**
  - **Do:** Open the **Completed Intake** card → **Populate Matter → Clio**.
  - **Expect:** Success message; `clio_populated_at` stamped on the form.
  - **Verify:**
    - Make → the Clio matter scenario ran without error
    - Clio → a new matter exists for this client
    - Open the matter's **custom fields** and find your `TEST-` values
  - ⚠️ Press it twice. The second attempt must be refused — that guard stops
    duplicate matters from a double-click or two lawyers acting at once. Only an
    explicit "force" should override it.

- [ ] **Audit every field for the four-hop journey** ← *highest-value test here*
  - **Do:** Take each value you typed in the intake form and find it in Clio's
    custom fields.
  - **Expect:** Every field you filled appears in Clio.
  - **If missing:** Is it in Supabase `form_data`? If yes it reached us — check the
    Make mapping. If no, the form never captured it.
  - ⚠️ A field silently lost here produces a will with a blank where a person's
    name belongs, and nothing upstream will warn you.

---

## 9. Generate Documents

Reads clients **from Clio**, not from the intake pipeline. Reached from the
sidebar, not from a form card.

- [ ] **Sync, then find your client**
  - **Do:** Sidebar **Generate Documents** → **Sync now** → search for the matter
    you just created.
  - **Expect:** Sync completes in two passes for ~2,000 matters. Your new matter
    appears, typed **Single** or **Couple** correctly.
  - ⚠️ A matter created seconds ago won't be listed until you sync. The table is a
    local mirror; that button is how it catches up.

- [ ] **Standard Will — single client**
  - **Needs:** `InitialExecutor` · `BackupExecutor` · `Beneficiary1` · `Jurisdiction`
  - **Do:** Pick the client → tick **Standard Will** → **Generate & Send to Clio**.
  - **Expect:** **1 document.** Result panel appears below the button.
  - **Verify:** Open it from the Clio matter. The executor and beneficiary names
    you typed should be in the text — no `<< … >>` left where you filled a value.

- [ ] **Standard Will — couple (mirror wills)**
  - **Do:** Same, on a **Couple** matter.
  - **Expect:** **2 documents**, one named per spouse.
  - **Verify:** They must be **mirrored** — each names the other spouse as executor
    and leaves the residue to them. Open both; if they're identical the mirroring
    is broken.

- [ ] **Will with Testamentary Trust — single and couple**
  - **Needs:** `InitialExecutor` · `BackupExecutor` · `InitialTrusteeTt1` ·
    `InitialAppointorTt1` · `NominatedBeneficiaryTt1` · `Jurisdiction`
  - **Expect:** Single → 1 document · Couple → 2 documents. Much longer than a
    Standard Will (~100k characters vs ~34k).
  - **Verify:** Trustee and appointor names appear in the trust clauses. The
    missing-fields warning should list the **trust** fields, not the Standard Will
    ones.

- [ ] **Undo a filing**
  - **Do:** After filing, press **Undo** on the result panel.
  - **Expect:** Panel reports the documents were removed; they disappear from the
    Clio matter.
  - **Verify:** For a couple, **both** documents go, not just one.

- [ ] **Packages, and the two that can't be generated**
  - **Do:** Select **Standard Will Package**.
  - **Expect:** It ticks three documents but generates only the will — the other
    two are skipped with "no precedent on file".
  - **Why:** Enduring Power of Attorney and Advance Care Directive have no template
    yet. Correct behaviour is to say so, not to silently hand over a third of a
    package.

---

## Reference

### Pipeline columns

| Column | Status | Arrived by | Next action |
|---|---|---|---|
| Appointment Sent | `appointment_sent` | Lead qualified | Wait for client to fill outreach form |
| Scheduled | `scheduled` | Outreach form submitted | Send Intake Form |
| Pending Intake | `pending_intake` | Intake form sent | Wait; reminders chase automatically |
| Completed Intake | `completed_intake` | Client finished intake | Send back, or push to Clio |

### Emails

| Email | Trigger | Sent at status | Webhook |
|---|---|---|---|
| Initial Outreach | Qualify a lead | `appointment_sent` | `SEND_INQUIRY_FORM_WEBHOOK` |
| Intake Form | Send Intake Form | `pending_intake` | `SEND_INTAKE_FORM_WEBHOOK` |
| Send Back | Send Back Reminder | `completed_intake` | `SEND_BACK_WEBHOOK` |
| Reminders ×3 | Daily cron, 23:00 UTC | `pending_intake` | (reminder scenario) |

### Documents

| Document | Template exists | Single | Couple |
|---|---|---|---|
| Standard Will | ✅ yes | 1 doc | 2 docs |
| Will with Testamentary Trust | ✅ yes | 1 doc | 2 docs |
| Enduring Power of Attorney | ❌ missing | Blocked — awaiting the precedent from the firm | |
| Advance Care Directive | ❌ missing | Blocked — the file supplied was a PDF, not the Word source | |

// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:80';

// ─── Navigation helpers ────────────────────────────────────────────────────────

async function load(page) {
  await page.goto(BASE);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.app-root', { timeout: 15000 });
}

async function clickTab(page, label) {
  await page.locator('.app-tab-btn').filter({ hasText: label }).first().click();
  await page.waitForTimeout(200);
}

async function clickSidebarPage(page, title) {
  await page.locator('.app-sidebar button').filter({ hasText: title }).first().click();
  await page.waitForTimeout(200);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Nautilus Estate Planning Questionnaire', () => {

  // ── 1. No required attributes or asterisks ──────────────────────────────────
  test('1 — no required attributes on inputs and no asterisk in labels', async ({ page }) => {
    await load(page);
    const required = await page.locator('input[required], select[required], textarea[required]').count();
    expect(required).toBe(0);

    const labels = await page.locator('label').allTextContents();
    for (const text of labels) {
      expect(text, `Label "${text}" should not contain *`).not.toContain('*');
    }
  });

  // ── 2. Client 2 parent radio buttons are independent ────────────────────────
  test('2 — C1 and C2 parent radio buttons are independent', async ({ page }) => {
    await load(page);
    // Select couple engagement so C2 section appears on the Family Background page
    await page.locator('label').filter({ hasText: 'Couple (Joint Matter)' }).click();
    await page.waitForTimeout(200);

    // Jump directly to Family Background via sidebar
    await clickSidebarPage(page, 'Family Background');

    // Set C1 father to "No"
    await page.locator('input[type="radio"][name="c1_father_alive"][value="No"]').click();
    // Set C2 father to "Yes"
    await page.locator('input[type="radio"][name="c2_father_alive"][value="Yes"]').click();

    // Verify they held their values independently
    await expect(page.locator('input[type="radio"][name="c1_father_alive"][value="No"]')).toBeChecked();
    await expect(page.locator('input[type="radio"][name="c2_father_alive"][value="Yes"]')).toBeChecked();
    // C1 father "Yes" must remain unchecked
    await expect(page.locator('input[type="radio"][name="c1_father_alive"][value="Yes"]')).not.toBeChecked();
  });

  // ── 3. Health Attorney 2 radio buttons are independent ──────────────────────
  test('3 — Health Attorney agreed radio buttons are independently selectable', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part D');

    // Navigate to the EPA Health page (title uses client name — defaults to "Client 1")
    await clickSidebarPage(page, 'EPA: Health');

    // Select "Yes — I wish to make a new EPA" to show the PersonList
    await page.locator('label').filter({ hasText: 'Yes — I wish to make a new EPA' }).first().click();
    await page.waitForTimeout(300);

    // Set attorney count to 2
    await page.locator('input[type="number"]').first().fill('2');
    await page.waitForTimeout(500);

    // Select "Yes" for attorney 0, "No" for attorney 1
    // name attribute pattern: ${nounKey}_${idx}_agreed  (nounKey = c1_health_att)
    const att0Yes = page.locator('input[type="radio"][name$="_0_agreed"][value="Yes"]');
    const att1No  = page.locator('input[type="radio"][name$="_1_agreed"][value="No"]');
    await att0Yes.click();
    await att1No.click();

    // Both must hold independently
    await expect(att0Yes).toBeChecked();
    await expect(att1No).toBeChecked();
    // Attorney 0 must NOT also be "No"
    await expect(page.locator('input[type="radio"][name$="_0_agreed"][value="No"]')).not.toBeChecked();
  });

  // ── 4. Guardians hidden when all children are adults ─────────────────────────
  test('4 — Guardians page is absent when child is aged 25', async ({ page }) => {
    await load(page);
    await page.locator('label').filter({ hasText: 'Single Client' }).click();
    await page.waitForTimeout(200);

    await clickSidebarPage(page, 'Children');
    // Say Yes to having children
    await page.locator('label').filter({ hasText: 'Yes' }).first().click();
    await page.waitForTimeout(200);
    // 1 child
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);
    // Date of birth ~25 years ago (adult)
    await page.locator('input[type="date"]').first().fill('2000-01-15');
    await page.waitForTimeout(200);

    // Switch to Part C — Guardians should NOT appear in the sidebar
    await clickTab(page, 'Part C');
    await page.waitForTimeout(300);
    await expect(
      page.locator('.app-sidebar button').filter({ hasText: 'Guardians' })
    ).toHaveCount(0);
  });

  // ── 5. Guardians shown when a minor child exists ──────────────────────────────
  test('5 — Guardians page appears when a child is under 18', async ({ page }) => {
    await load(page);
    await page.locator('label').filter({ hasText: 'Single Client' }).click();
    await page.waitForTimeout(200);

    await clickSidebarPage(page, 'Children');
    await page.locator('label').filter({ hasText: 'Yes' }).first().click();
    await page.waitForTimeout(200);
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);
    // Born 2016 → age ~10 in 2026
    await page.locator('input[type="date"]').first().fill('2016-03-20');
    await page.waitForTimeout(200);

    await clickTab(page, 'Part C');
    await page.waitForTimeout(300);
    await expect(
      page.locator('.app-sidebar button').filter({ hasText: 'Guardians' })
    ).toHaveCount(1);
  });

  // ── 6. Beneficiary profile dropdowns are independent ─────────────────────────
  test('6 — Financial Maturity dropdowns are independent per beneficiary', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'C1 — Distribution: Primary');

    // Add 2 residuary beneficiaries (Field has no id/for attrs when no id prop given —
    // use positional text-input selectors instead of getByLabel)
    await page.locator('input[type="number"]').first().fill('2');
    await page.waitForTimeout(500);

    // Field order per bene: First Name, Last Name, Relationship (text), Address (text)
    // So bene 0 = indices 0,1 and bene 1 = indices 4,5 (skip Relationship+Address)
    const textInputs = page.locator('#main-content input[type="text"]');
    await textInputs.nth(0).fill('Alice');   // First Name bene 0
    await textInputs.nth(1).fill('Smith');   // Last Name bene 0
    await textInputs.nth(4).fill('Bob');     // First Name bene 1
    await textInputs.nth(5).fill('Jones');   // Last Name bene 1
    await page.waitForTimeout(300);

    // Navigate to Beneficiary Profiles
    await clickSidebarPage(page, 'Beneficiary Profiles');
    await page.waitForTimeout(400);

    // Set different financial maturity values for each beneficiary
    const selects = page.locator('#main-content select');
    await selects.nth(0).selectOption('High — capable of managing a large inheritance');
    await selects.nth(1).selectOption('Low — likely to need protection');

    // Verify both held their values independently
    await expect(selects.nth(0)).toHaveValue('High — capable of managing a large inheritance');
    await expect(selects.nth(1)).toHaveValue('Low — likely to need protection');
  });

  // ── 7. Primary Distribution InfoBox text ──────────────────────────────────────
  test('7 — Primary Distribution info box mentions the primary scenario correctly', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'C1 — Distribution: Primary');
    await expect(page.locator('#main-content')).toContainText(
      'Primary Distribution applies if that spouse survives you'
    );
  });

  // ── 8. Contingency Distribution InfoBox text ───────────────────────────────────
  test('8 — Contingency Distribution info box mentions "back up choice"', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'C1 — Distribution: Contingency');
    await expect(page.locator('#main-content')).toContainText('back up choice');
  });

  // ── 9. "Yes — strongly recommended" must not exist anywhere in the DOM ─────────
  test('9 — "Yes — strongly recommended" does not appear anywhere in the page', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'C1 — Distribution: Primary');
    // Add 1 residuary bene so the TT dropdown renders
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);
    const html = await page.content();
    expect(html).not.toContain('Yes — strongly recommended');
  });

  // ── 10. Testamentary Trust field label is correct ──────────────────────────────
  test('10 — TT label is "Would you like protection for their inheritance in the form of a trust?"', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'C1 — Distribution: Primary');
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);
    await expect(page.locator('#main-content')).toContainText(
      'Would you like protection for their inheritance in the form of a trust?'
    );
  });

  // ── 11. Testamentary Trust AdviceBox contains the right description ────────────
  test('11 — TT AdviceBox on Beneficiary Profiles contains "third party managed distributions"', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    await clickSidebarPage(page, 'Beneficiary Profiles');
    // AdviceBox is collapsed by default (uses conditional rendering) — expand it
    await page.locator('#main-content button').filter({ hasText: 'Testamentary Trust' }).first().click();
    await page.waitForTimeout(200);
    await expect(page.locator('#main-content')).toContainText('third party managed distributions');
  });

  // ── 12. "At risk occupation" appears in Financial Maturity options ──────────────
  test('12 — "At risk occupation" is an option in the Financial Maturity dropdown', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part C');
    // Add one bene so the profile row renders
    await clickSidebarPage(page, 'C1 — Distribution: Primary');
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);
    await page.getByLabel('First Name').nth(0).fill('Jane');
    await page.getByLabel('Last Name').nth(0).fill('Doe');
    await page.waitForTimeout(200);

    await clickSidebarPage(page, 'Beneficiary Profiles');
    await page.waitForTimeout(400);

    // Verify the option exists in the select
    const option = page.locator('#main-content select option').filter({ hasText: 'At risk occupation' });
    await expect(option.first()).toBeAttached();
  });

  // ── 13. Mortgage question wording ──────────────────────────────────────────────
  test('13 — "Are you subject to any mortgages?" exists; old wording is gone', async ({ page }) => {
    await load(page);
    // Activate full disclosure to unlock the liabilities pages in the sidebar
    await clickSidebarPage(page, 'Disclosure Preference');
    await page.locator('input[type="radio"][value="full"]').click();
    await page.waitForTimeout(300);

    await clickSidebarPage(page, 'C1 — Other Assets');
    await expect(page.locator('#main-content')).toContainText('Are you subject to any mortgages?');
    expect(await page.content()).not.toContain('Do you hold any mortgages?');
  });

  // ── 14. Loan question wording ───────────────────────────────────────────────────
  test('14 — "Are you subject to debt by way of personal loans or credit cards?" exists', async ({ page }) => {
    await load(page);
    await clickSidebarPage(page, 'Disclosure Preference');
    await page.locator('input[type="radio"][value="full"]').click();
    await page.waitForTimeout(300);
    await clickSidebarPage(page, 'C1 — Other Assets');
    await expect(page.locator('#main-content')).toContainText(
      'Are you subject to debt by way of personal loans or credit cards?'
    );
  });

  // ── 15. Companies section — question text + two company forms ──────────────────
  test('15 — "How many companies" question appears; entering 2 shows two company forms', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'C1 — Companies');

    await expect(page.locator('#main-content')).toContainText('How many companies');

    // Enter 2 companies
    await page.locator('input[type="number"]').first().fill('2');
    await page.waitForTimeout(500);

    // Verify two company form sections appear (SectionLabel "Company 1" and "Company 2")
    const company1 = page.locator('#main-content').getByText('Company 1', { exact: false });
    const company2 = page.locator('#main-content').getByText('Company 2', { exact: false });
    await expect(company1).toBeVisible();
    await expect(company2).toBeVisible();
  });

  // ── 16. SMSF limited recourse sub-fields ───────────────────────────────────────
  test('16 — SMSF: selecting Yes for LRBA reveals sub-fields', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'C1 — SMSF');

    // Select Yes for "Do you have a Self-Managed Superannuation Fund (SMSF)?"
    await page.locator('label').filter({ hasText: 'Yes' }).first().click();
    await page.waitForTimeout(300);

    // Set SMSF count to 1 so the SMSF form appears
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(500);

    // The LRBA section label should be visible
    await expect(page.locator('#main-content')).toContainText('Limited Recourse Borrowing Arrangement');

    // Click Yes for "Does the SMSF have an LRBA?" (the 2nd Yes label visible)
    await page.locator('label').filter({ hasText: 'Yes' }).nth(1).click();
    await page.waitForTimeout(300);

    // Verify LRBA sub-fields appear
    await expect(page.locator('#main-content')).toContainText('Over what asset?');
    await expect(page.locator('#main-content')).toContainText('How much is the borrowing');
  });

  // ── 17. Document upload — file input accepts PDF/DOC/DOCX ─────────────────────
  test('17 — Document Upload page has a file input accepting PDF/DOC/DOCX', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'Document Upload');

    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    const accept = await fileInput.getAttribute('accept');
    expect(accept).toBeTruthy();
    // Accept attribute should cover PDF and DOC formats
    expect(String(accept).toLowerCase()).toMatch(/pdf|doc/);
  });

  // ── 18. Email validation — blur shows error; re-typing clears it ─────────────
  test('18 — email validation: blur shows error; re-typing clears it', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'Professional Advisors');

    const emailInput = page.locator('#main-content input[type="email"]').first();
    await emailInput.fill('notanemail');
    await emailInput.blur();
    await page.waitForTimeout(200);

    await expect(page.locator('#main-content')).toContainText('Please enter a valid email address');

    // Start typing again — hint must clear immediately
    await emailInput.press('x');
    await expect(page.locator('#main-content')).not.toContainText('Please enter a valid email address');
  });

  // ── 19. Phone validation — non-numeric input shows error on blur ──────────────
  test('19 — phone validation: blur shows error for non-numeric input', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'Professional Advisors');

    const telInput = page.locator('#main-content input[type="tel"]').first();
    await telInput.fill('abcde');
    await telInput.blur();
    await page.waitForTimeout(200);

    await expect(page.locator('#main-content')).toContainText('Please enter a valid phone number (numbers only)');
  });

  // ── 20. SMSF member name fields render dynamically ────────────────────────────
  test('20 — SMSF: entering 3 in Number of members renders 3 name inputs', async ({ page }) => {
    await load(page);
    await clickTab(page, 'Part B');
    await clickSidebarPage(page, 'C1 — SMSF');

    // Select Yes for having an SMSF
    await page.locator('label').filter({ hasText: 'Yes' }).first().click();
    await page.waitForTimeout(300);

    // Set SMSF count to 1 so the SMSF form card appears
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(500);

    // Set member count to 3 — this is the second number input on the page
    await page.locator('input[type="number"]').nth(1).fill('3');
    await page.waitForTimeout(400);

    // Verify all 3 labelled name fields appear
    await expect(page.locator('#main-content')).toContainText('Member 1 — Full name');
    await expect(page.locator('#main-content')).toContainText('Member 2 — Full name');
    await expect(page.locator('#main-content')).toContainText('Member 3 — Full name');

    // Also confirm 3 corresponding text inputs are present within the member section
    const memberInputs = page.locator('#main-content label').filter({ hasText: /Member \d+ — Full name/ });
    await expect(memberInputs).toHaveCount(3);
  });

  // ── 21. DOB validation — future date shows error on blur ──────────────────────
  test('21 — DOB validation: future date shows error on blur', async ({ page }) => {
    await load(page);
    await clickSidebarPage(page, 'Children');

    // Say Yes to having children so the DOB input appears
    await page.locator('label').filter({ hasText: 'Yes' }).first().click();
    await page.waitForTimeout(200);
    await page.locator('input[type="number"]').first().fill('1');
    await page.waitForTimeout(400);

    const dateInput = page.locator('#main-content input[type="date"]').first();
    await dateInput.fill('2099-01-01');
    await dateInput.blur();
    await page.waitForTimeout(200);

    await expect(page.locator('#main-content')).toContainText('Date of birth cannot be in the future');
  });

  // ── 22. Auto-save — values persist across a page reload ───────────────────────
  test('22 — auto-save restores form state after page reload', async ({ page }) => {
    // Load fresh with no prior session
    await load(page);

    // Navigate to C1 Personal Details and fill first + last name
    await clickSidebarPage(page, 'C1 — Personal Details');
    // Slight wait for the restore-fetch to complete (it 404s since no session yet)
    await page.waitForTimeout(800);

    const inputs = page.locator('#main-content input[type="text"]');
    await inputs.nth(0).fill('AutoSave');   // First Name
    await inputs.nth(2).fill('TestUser');   // Last Name (after Middle)

    // Wait for the 3-second debounce + network round-trip to complete
    await page.waitForTimeout(4500);

    // Reload — the app will fetch the session and restore state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.app-root', { timeout: 15000 });

    // Wait for the restore banner to appear — it's the reliable signal that
    // the async restore fetch has completed and state has been applied
    await page.waitForSelector('[data-testid="restore-banner"]', { timeout: 8000 });

    // Navigate to Personal Details and verify values
    await clickSidebarPage(page, 'C1 — Personal Details');
    await page.waitForTimeout(300);

    const firstInput = page.locator('#main-content input[type="text"]').nth(0);
    const lastInput  = page.locator('#main-content input[type="text"]').nth(2);
    await expect(firstInput).toHaveValue('AutoSave');
    await expect(lastInput).toHaveValue('TestUser');
  });

  // ── 23. Final webhook fires on Part D submission with full payload ─────────────
  test('23 — final webhook fires with full payload on Part D submission', async ({ page }) => {
    // Intercept all requests to the Make.com webhook URL
    let capturedBody = null;
    await page.route('**/hook.eu2.make.com/**', async route => {
      try { capturedBody = route.request().postDataJSON(); } catch { capturedBody = {}; }
      await route.fulfill({ status: 200, body: 'accepted', contentType: 'text/plain' });
    });

    await load(page);

    // Switch to Part D tab and navigate to its last page
    await page.locator('.app-tab-btn').filter({ hasText: 'Part D' }).click();
    await page.waitForTimeout(200);
    await clickSidebarPage(page, 'Submit');
    await page.waitForTimeout(200);

    // Click "Submit Questionnaire" (last-page label for the last part)
    await page.locator('.app-nav-btn').filter({ hasText: 'Submit' }).click();

    // Wait for the webhook fetch to fire and be intercepted
    await page.waitForTimeout(2000);

    // Verify the intercepted payload matches the Make.com structure
    expect(capturedBody).not.toBeNull();

    // form_version replaces the old 'event' field — no 'event' key should exist
    expect(capturedBody.event).toBeUndefined();
    expect(capturedBody.form_version).toBe('v3');

    // Top-level keys
    expect(capturedBody).toHaveProperty('engagement');
    expect(capturedBody).toHaveProperty('client_1');
    expect(capturedBody).toHaveProperty('client_2');
    expect(capturedBody).toHaveProperty('family');
    expect(capturedBody).toHaveProperty('guardians');
    expect(capturedBody).toHaveProperty('professional_advisors');
    expect(capturedBody).toHaveProperty('beneficiary_profiles');
    expect(capturedBody).toHaveProperty('submitted_at');
    expect(typeof capturedBody.submitted_at).toBe('string');

    // No 'data' wrapper, no old top-level keys
    expect(capturedBody.data).toBeUndefined();
    expect(capturedBody.client_name).toBeUndefined();

    // client_1 is always present; client_2 is null for single-client (default engType = '')
    expect(capturedBody.client_1).toBeTruthy();
    expect(capturedBody.client_2).toBeNull();

    // engagement.type must be the exact string value (not transformed)
    expect(typeof capturedBody.engagement.type).toBe('string');

    // session_id still present for traceability
    expect(typeof capturedBody.session_id).toBe('string');
  });

});

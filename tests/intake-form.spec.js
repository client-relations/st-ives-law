// Intake form (artifacts/questionnaire/public/intake-form.html) against a
// mocked API. Covers the CR 2026-10-14 changes: DD/MM/YYYY dates stored as
// ISO, gender, the three first-meeting dates, organ donation Yes/No and the
// documents-to-bring page.
const { test, expect } = require('./support/fixtures');

const LEAD = '00000000-0000-4000-8000-0000000000aa';

// Step indexes (0-based) in the intake form.
const STEP = { client: 0, funeral: 12, lowMeeting: 15, bring: 16 };

/** Mock the API: get-form returns `intake`, submit-intake records each save. */
async function openForm(page, { intake = {}, currentStep, inquiry } = {}) {
  const saves = [];
  await page.route('**/api/get-form**', (route) =>
    route.fulfill({
      json: {
        data: {
          inquiry: inquiry || {},
          intake,
          metadata: currentStep === undefined ? {} : { current_step: currentStep },
        },
      },
    }),
  );
  await page.route('**/api/submit-intake', async (route) => {
    saves.push(JSON.parse(route.request().postData()));
    await route.fulfill({ json: { success: true } });
  });
  await page.goto(`/intake-form.html?lead_id=${LEAD}`);
  await expect(page.locator('#progress-text')).toHaveText(/Step \d+ of 17/);
  return saves;
}

const visibleStep = (page) => page.locator('.step:not(.hidden)');

async function fillClientStep(page, dob) {
  const step = visibleStep(page);
  await step.locator('input[name=client_name]').fill('Test Client');
  await step.locator('.date-text').first().fill(dob);
  await step.locator('input[name=client_address]').fill('1 Test Street, Norwood SA 5067');
  await step.locator('select[name=client_state]').selectOption('SA');
  await step.locator('select[name=client_marital_status]').selectOption('Single');
}

test.describe('dates typed as DD/MM/YYYY', () => {
  test('a typed date of birth is stored as ISO', async ({ page }) => {
    const saves = await openForm(page);
    await fillClientStep(page, '7/3/1975');
    await page.locator('input[name=client_gender][value=Female]').check();
    await page.click('#next-btn');

    await expect(page.locator('#progress-text')).toHaveText('Step 2 of 17');
    expect(saves).toHaveLength(1);
    expect(saves[0].form_data.client_date_of_birth).toBe('1975-03-07');
    expect(saves[0].form_data.client_gender).toBe('Female');
  });

  for (const bad of ['31/02/1975', '1975-03-07', '13/13/1975', 'yesterday']) {
    test(`an invalid date (${bad}) is refused and never saved`, async ({ page }) => {
      const saves = await openForm(page);
      await fillClientStep(page, bad);
      await page.locator('input[name=client_gender][value=Male]').check();
      await page.click('#next-btn');

      await expect(page.locator('.date-error').first()).toContainText('DD/MM/YYYY');
      await expect(page.locator('#progress-text')).toHaveText('Step 1 of 17');
      expect(saves).toHaveLength(0);
      expect(await page.locator('input[name=client_date_of_birth]').inputValue()).toBe('');
    });
  }

  test('a saved ISO date shows as DD/MM/YYYY when the form is reopened', async ({ page }) => {
    await openForm(page, { intake: { client_name: 'Test Client', client_date_of_birth: '1970-03-12' } });
    await expect(page.locator('.date-text').first()).toHaveValue('12/03/1970');
  });

  test('gender is required for the will-maker', async ({ page }) => {
    const saves = await openForm(page);
    await fillClientStep(page, '07/03/1975');
    await page.click('#next-btn');
    await expect(page.locator('#progress-text')).toHaveText('Step 1 of 17');
    expect(saves).toHaveLength(0);
  });

  test("a couple must give the spouse's gender too", async ({ page }) => {
    const saves = await openForm(page);
    await page.locator('input[name=scenario][value=Couple]').check();
    await fillClientStep(page, '07/03/1975');
    await page.locator('input[name=client_gender][value=Male]').check();
    await page.locator('input[name=spouse_name]').fill('Test Spouse');
    await page.click('#next-btn');
    expect(saves).toHaveLength(0);

    await page.locator('input[name=spouse_gender][value=Female]').check();
    await page.click('#next-btn');
    await expect(page.locator('#progress-text')).toHaveText('Step 2 of 17');
    expect(saves[0].form_data.spouse_gender).toBe('Female');
  });
});

test.describe('three preferred first meeting dates, next 14 days in Adelaide', () => {
  // 23:30 UTC on 14 Oct is 10:00 on 15 Oct in Adelaide (ACDT, UTC+10:30), so
  // "today" is the 15th even though the UTC date is still the 14th.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-14T23:30:00Z'));
  });

  const atMeetingStep = { intake: { has_low: 'No', will_custody: 'Firm' }, currentStep: STEP.lowMeeting };

  test('dates inside the window are stored as ISO', async ({ page }) => {
    const saves = await openForm(page, atMeetingStep);
    await expect(page.locator('.step:not(.hidden) .step-title')).toContainText('First Meeting');
    const dates = visibleStep(page).locator('.date-text');
    await dates.nth(0).fill('15/10/2026'); // today in Adelaide
    await dates.nth(1).fill('22/10/2026');
    await dates.nth(2).fill('29/10/2026'); // today + 14
    await page.click('#next-btn');

    await expect(page.locator('#progress-text')).toHaveText('Step 17 of 17');
    const saved = saves.at(-1).form_data;
    expect(saved.signing_date).toBe('2026-10-15');
    expect(saved.preferred_meeting_date_2).toBe('2026-10-22');
    expect(saved.preferred_meeting_date_3).toBe('2026-10-29');
  });

  for (const [label, value] of [['the UTC date, already past in Adelaide', '14/10/2026'], ['today + 15', '30/10/2026']]) {
    test(`a date outside the window is refused (${label})`, async ({ page }) => {
      const saves = await openForm(page, atMeetingStep);
      await visibleStep(page).locator('.date-text').nth(1).fill(value);
      await page.click('#next-btn');

      await expect(visibleStep(page).locator('.date-error').nth(1)).toHaveText(
        'Choose a date between 15/10/2026 and 29/10/2026.',
      );
      expect(saves).toHaveLength(0);
    });
  }

  test('the label says first meeting, not signing', async ({ page }) => {
    await openForm(page, atMeetingStep);
    await expect(visibleStep(page)).toContainText('Preferred first meeting date');
    await expect(visibleStep(page)).not.toContainText('signing date');
  });
});

test.describe('funeral wishes', () => {
  test('organ donor Yes/No is stored as Available/Not available', async ({ page }) => {
    const saves = await openForm(page, { intake: { client_name: 'Test Client' }, currentStep: STEP.funeral });
    const step = visibleStep(page);
    await expect(step).toContainText('Do you wish to be an organ donor?');
    await expect(step.locator('select[name=organ_donation] option')).toHaveText(['Select…', 'Yes', 'No']);

    await step.locator('select[name=organ_donation]').selectOption({ label: 'Yes' });
    await step.locator('select[name=burial_or_cremation]').selectOption('Cremation');
    await expect(step).toContainText('Do you have a specific place in mind for your ashes?');
    await step.locator('input[name=remains_place_choice][value="Leave it to my executor or family"]').check();
    await page.click('#next-btn');
    expect(saves.at(-1).form_data.organ_donation).toBe('Available');
    expect(saves.at(-1).form_data.remains_place_choice).toBe('Leave it to my executor or family');

    await page.click('#back-btn');
    await step.locator('select[name=organ_donation]').selectOption({ label: 'No' });
    await page.click('#next-btn');
    expect(saves.at(-1).form_data.organ_donation).toBe('Not available');
  });

  test('a specific burial place must be named', async ({ page }) => {
    const saves = await openForm(page, { intake: { client_name: 'Test Client' }, currentStep: STEP.funeral });
    const step = visibleStep(page);
    await step.locator('select[name=organ_donation]').selectOption({ label: 'No' });
    await step.locator('select[name=burial_or_cremation]').selectOption('Burial');
    await step.locator('input[name=remains_place_choice][value="Specific place"]').check();
    await expect(step).toContainText('Where would you like to be buried?');
    await page.click('#next-btn');
    expect(saves).toHaveLength(0);

    await step.locator('input[name=remains_place]').fill('Test Cemetery, Test Town');
    await page.click('#next-btn');
    expect(saves.at(-1).form_data.remains_place).toBe('Test Cemetery, Test Town');
  });
});

test.describe('documents to bring to the first meeting', () => {
  const items = (page) => page.locator('#bring-list li');

  test('photo ID only, when nothing else applies', async ({ page }) => {
    await openForm(page, { intake: { has_company: 'No', has_existing_documents: 'No' }, currentStep: STEP.bring });
    await expect(items(page)).toHaveText(["Photo ID, such as a driver's licence or passport"]);
  });

  test('existing documents, a trust deed and a rates notice per property', async ({ page }) => {
    await openForm(page, {
      intake: {
        has_company: 'No',
        has_existing_documents: 'Yes',
        realestate: [{ Address: '1 Test Street, Norwood SA 5067', 'Tenancy type': 'Joint tenants' }],
        investment_property: [{ Address: '3 Test Road, Glenelg SA 5045', 'Tenancy type': 'Don’t know' }],
        entity: [{ Name: 'Test Family Trust', Type: 'Family trust' }],
      },
      currentStep: STEP.bring,
    });
    await expect(items(page)).toHaveText([
      "Photo ID, such as a driver's licence or passport",
      'Copies of your existing will, power of attorney, advance care directive or other estate planning documents',
      'The trust deed of each family or unit trust',
      'The latest council rates notice for 1 Test Street, Norwood SA 5067',
      'The latest council rates notice for 3 Test Road, Glenelg SA 5045',
    ]);
  });

  test('a company constitution for a Pty Ltd company', async ({ page }) => {
    for (const intake of [
      { has_company: 'Yes' },
      { has_company: 'No', entity: [{ Name: 'Test Pty Ltd', Type: 'Pty Ltd company' }] },
    ]) {
      await openForm(page, { intake, currentStep: STEP.bring });
      await expect(items(page)).toContainText(['The constitution of each Pty Ltd company you hold shares in or are a director of']);
      await expect(items(page)).not.toContainText(['The trust deed of each family or unit trust']);
      await page.unrouteAll();
    }
  });

  test('the list is saved with the submission', async ({ page }) => {
    const saves = await openForm(page, {
      intake: { has_company: 'No', has_existing_documents: 'Yes', will_custody: 'Firm' },
      currentStep: STEP.bring,
    });
    await page.click('#next-btn');
    await expect(page.locator('#result-wrap')).toContainText('Form Submitted Successfully');
    const final = saves.at(-1);
    expect(final.final).toBe(true);
    expect(final.step).toBe(17);
    expect(final.form_data.documents_to_bring).toHaveLength(2);
  });

  test('the enquiry seeds "already have documents"', async ({ page }) => {
    await openForm(page, { inquiry: { complexity_flags: ['Already have a will'] } });
    await expect(page.locator('input[name=has_existing_documents][value=Yes]')).toBeChecked();
  });
});

test.describe('assets', () => {
  test('each property asks how it is held, including "Don’t know"', async ({ page }) => {
    const saves = await openForm(page, { intake: { client_name: 'Test Client' }, currentStep: 1 });
    await page.click('[data-add=realestate]');
    const row = page.locator('#realestate-list .repeat-item').first();
    await expect(row).toContainText('Held as');
    await expect(row.locator('select option')).toHaveText(['Select…', 'Sole ownership', 'Joint tenants', 'Tenants in common', 'Don’t know']);
    await row.locator('input').first().fill('1 Test Street');
    await row.locator('select').selectOption('Don’t know');
    await page.click('[data-add=vehicle]');
    await page.locator('#vehicle-list input').first().fill('Test Car');
    await page.click('#next-btn');
    const saved = saves.at(-1).form_data;
    expect(saved.realestate[0]['Tenancy type']).toBe('Don’t know');
    expect(saved.vehicle[0]['Make and model']).toBe('Test Car');
  });
});

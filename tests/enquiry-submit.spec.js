// Enquiry form (lead-inquiry.html): early exit, in-flight submit and server
// errors. /api is mocked per test; the shared fixture blocks everything else.
const { test, expect } = require('./support/fixtures');

const LEAD_ID = '00000000-0000-4000-8000-000000000001';
const PAGE = `/lead-inquiry.html?lead_id=${LEAD_ID}`;

async function mockGetForm(page) {
  await page.route('**/api/get-form**', (route) => route.fulfill({
    json: { success: true, data: {}, status: 'appointment_sent', client: { name: 'Test Client', email: 'isuru+test@lex-ops.io' } },
  }));
}

/** Record every POST to /api/submit-form; answer each with respond(). */
async function mockSubmit(page, respond) {
  const posts = [];
  await page.route('**/api/submit-form', async (route) => {
    posts.push(route.request().postDataJSON());
    await respond(route);
  });
  return posts;
}

async function answerQ1andQ2(page, reason) {
  await page.getByLabel(reason).check();
  await page.locator('#next-btn').click();
  await page.locator('input[name="client_phone"]').fill('0400 000 000');
  await page.locator('select[name="client_state"]').selectOption('SA');
}

async function answerToLastQuestion(page) {
  await answerQ1andQ2(page, 'Put a will or estate plan in place');
  await page.locator('#next-btn').click(); // Q2 -> Q3
  await page.locator('#next-btn').click(); // Q3 -> Q4
  await page.locator('#next-btn').click(); // Q4 -> Q5
  await page.getByLabel('A will — who receives what').check();
  await page.locator('#next-btn').click(); // Q5 -> Q6
  await page.getByLabel('I know exactly who').check();
  await page.getByLabel('A few').check();
  await page.locator('#next-btn').click(); // Q6 -> Q7
  await page.locator('#next-btn').click(); // Q7 -> Q8
  await expect(page.locator('#next-btn')).toHaveText('Submit');
}

test.beforeEach(async ({ page }) => {
  await mockGetForm(page);
  await page.goto(PAGE);
  await expect(page.locator('input[name="client_name"]')).toHaveValue('Test Client');
});

test('early exit saves Q1-Q2 and hides the Back button', async ({ page }) => {
  const posts = await mockSubmit(page, (route) => route.fulfill({ json: { success: true } }));
  await answerQ1andQ2(page, 'Someone has died');
  await page.locator('#next-btn').click();

  await expect(page.locator('#ending-title')).toHaveText("Thanks — we'll be in touch");
  await expect(page.locator('#ending-back-btn')).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(posts[0].form_type).toBe('inquiry');
  expect(posts[0].form_data).toMatchObject({ inquiry_reason: 'Someone has died', client_state: 'SA', early_exit: true });
});

test('early exit that fails to save shows the server message and stays on Q2', async ({ page }) => {
  await mockSubmit(page, (route) => route.fulfill({
    status: 409, json: { error: 'This form can no longer be changed. Please contact the firm.' },
  }));
  await answerQ1andQ2(page, 'A concern about a will or estate');
  await page.locator('#next-btn').click();

  await expect(page.locator('#submit-error')).toHaveText('This form can no longer be changed. Please contact the firm.');
  await expect(page.locator('input[name="client_phone"]')).toBeVisible();
  await expect(page.locator('#ending-wrap')).toBeHidden();
});

test('Submit is disabled while the request is in flight, so a double click sends once', async ({ page }) => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const posts = await mockSubmit(page, async (route) => {
    await held;
    await route.fulfill({ json: { success: true } });
  });
  await answerToLastQuestion(page);

  await page.locator('#next-btn').dblclick();
  await expect(page.locator('#next-btn')).toBeDisabled();
  await expect(page.locator('#back-btn')).toBeDisabled();
  // Even a script-driven click on the guarded handler must not send again.
  await page.evaluate(() => document.getElementById('next-btn').dispatchEvent(new MouseEvent('click')));
  expect(posts).toHaveLength(1);

  release();
  await expect(page.getByText('✓ Form submitted successfully')).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('"already submitted" shows the friendly closed screen, not an error', async ({ page }) => {
  await mockSubmit(page, (route) => route.fulfill({
    status: 409,
    json: { error: 'This form has already been submitted. Please contact the firm if anything needs to change.', code: 'ALREADY_SUBMITTED' },
  }));
  await answerToLastQuestion(page);
  await page.locator('#next-btn').click();

  await expect(page.locator('#ending-title')).toHaveText('This form has already been submitted');
  await expect(page.locator('#ending-body')).toContainText('St Ives Law has your answers');
  await expect(page.locator('#intake-form')).toBeHidden();
});

test('any other error shows the server message and lets the client retry', async ({ page }) => {
  let attempt = 0;
  const posts = await mockSubmit(page, (route) => (++attempt === 1
    ? route.fulfill({ status: 400, json: { error: 'Missing form_data' } })
    : route.fulfill({ json: { success: true } })));
  await answerToLastQuestion(page);

  await page.locator('#next-btn').click();
  await expect(page.locator('#submit-error')).toHaveText('Missing form_data');
  await expect(page.locator('#next-btn')).toBeEnabled();

  await page.locator('#next-btn').click();
  await expect(page.getByText('✓ Form submitted successfully')).toBeVisible();
  expect(posts).toHaveLength(2);
});

test('a network failure explains itself instead of a generic alert', async ({ page }) => {
  await page.route('**/api/submit-form', (route) => route.abort('connectionfailed'));
  await answerToLastQuestion(page);
  await page.locator('#next-btn').click();
  await expect(page.locator('#submit-error')).toContainText("couldn't reach St Ives Law");
});

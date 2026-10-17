const { defineConfig } = require('@playwright/test');

// Chromium comes from the machine: set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, or
// let Playwright find its own install (PLAYWRIGHT_BROWSERS_PATH).
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const PORT = Number(process.env.TEST_STATIC_PORT || 4310);

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 40000,
  expect: { timeout: 8000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    timezoneId: 'Australia/Adelaide',
    launchOptions: {
      ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node tests/support/static-server.mjs',
    url: `http://localhost:${PORT}/intake-form.html`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
});

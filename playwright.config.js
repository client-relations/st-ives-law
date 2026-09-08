const { defineConfig, devices } = require('@playwright/test');

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || '/nix/store/ia69plrrvn7czdhn3flq1ll39i92ixab-chromium-92.0.4515.159/bin/chromium';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 40000,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:80',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
});

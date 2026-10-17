// Shared Playwright fixture: any request that is not to localhost is aborted,
// so no test can reach Make, Clio, Supabase, Vercel or an email service.
const base = require('@playwright/test');

const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.route(/^(?!https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)/, (route) => route.abort('blockedbyclient'));
    await use(context);
  },
});

module.exports = { test, expect: base.expect };

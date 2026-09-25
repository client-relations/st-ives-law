/**
 * Mint a new Clio refresh token.
 *
 * Changing an app's scopes in Clio does not upgrade a token already issued —
 * the old one keeps the permissions it was granted and goes on being refused.
 * The only way to pick up new scopes is to walk the OAuth flow again, which is
 * what this does.
 *
 *   pnpm --filter @workspace/scripts clio:reauth
 *
 * Reads CLIO_CLIENT_ID and CLIO_CLIENT_SECRET from the repo-root .env. The
 * redirect URI must match one registered on the Clio developer application
 * exactly; pass it as an argument if it is not the default below.
 *
 * The token it prints goes into Vercel as CLIO_REFRESH_TOKEN. It does not
 * expire unless revoked, so this should be a rare errand.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
const CLIENT_ID = process.env.CLIO_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET;
const REDIRECT_URI = process.argv[2] || 'https://st-ives-law.vercel.app/';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing CLIO_CLIENT_ID / CLIO_CLIENT_SECRET — run with --env-file=../.env');
  process.exit(1);
}

const authorizeUrl =
  `${BASE}/oauth/authorize?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n1. Open this while signed into Clio as the account the app should act as:\n');
console.log(`   ${authorizeUrl}\n`);
console.log('2. Approve it. Clio bounces you to:\n');
console.log(`   ${REDIRECT_URI}?code=SOMETHING\n`);
console.log('3. Copy the value after code= from the address bar.');
console.log('   (If Clio says the redirect URI is invalid, pass the one registered on the');
console.log('    app as an argument to this script.)\n');

const rl = createInterface({ input: stdin, output: stdout });
const code = (await rl.question('Paste the code here: ')).trim();
rl.close();

if (!code) {
  console.error('No code given.');
  process.exit(1);
}

const response = await fetch(`${BASE}/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  }).toString(),
});

const text = await response.text();
if (!response.ok) {
  console.error(`\nClio refused the code (${response.status}):\n${text.slice(0, 500)}`);
  console.error('\nA code is single-use and short-lived — if you have already exchanged it,');
  console.error('or waited too long, start again from step 1.');
  process.exit(1);
}

const token = JSON.parse(text);
if (!token.refresh_token) {
  console.error('\nClio returned no refresh_token:\n', text.slice(0, 500));
  process.exit(1);
}

console.log('\n─────────────────────────────────────────────');
console.log('New CLIO_REFRESH_TOKEN:\n');
console.log(`  ${token.refresh_token}\n`);
console.log('─────────────────────────────────────────────');
console.log('Put it in Vercel → st-ives-law → Settings → Environment Variables');
console.log('(replace the existing CLIO_REFRESH_TOKEN, All Environments), then redeploy.');
console.log('Update the repo-root .env too, so local testing uses the same token.\n');

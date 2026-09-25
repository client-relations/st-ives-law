/**
 * Mint a new Clio refresh token.
 *
 * Changing an app's scopes in Clio does not upgrade a token already issued —
 * the old one keeps the permissions it was granted and goes on being refused.
 * The only way to pick up new scopes is to walk the OAuth flow again.
 *
 * Two steps, no interactive prompt:
 *
 *   1. pnpm --filter @workspace/scripts clio:reauth
 *        prints the authorize URL. Open it signed into Clio as the account the
 *        app should act as, and approve.
 *
 *   2. pnpm --filter @workspace/scripts clio:reauth -- "<the URL you landed on>"
 *        exchanges it and prints the refresh token. Paste the whole redirect
 *        URL from the address bar, or just the code — either works.
 *
 * Reads CLIO_CLIENT_ID / CLIO_CLIENT_SECRET from the repo-root .env. The
 * redirect URI must match the one registered on the Clio developer
 * application exactly; override with CLIO_REDIRECT_URI if it is not the
 * default below.
 */

const BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
const CLIENT_ID = process.env.CLIO_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET;
const REDIRECT_URI = process.env.CLIO_REDIRECT_URI || 'https://st-ives-law.vercel.app/';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing CLIO_CLIENT_ID / CLIO_CLIENT_SECRET — run with --env-file=../.env');
  process.exit(1);
}

/** Accept the whole redirect URL, or a bare code, whichever is easier to copy. */
function extractCode(input: string): string {
  const trimmed = input.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return '';
  const match = trimmed.match(/[?&]code=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  return trimmed.includes('://') ? '' : trimmed;
}

const raw = process.argv.slice(2).join(' ');
const code = extractCode(raw);

if (!code) {
  const authorizeUrl =
    `${BASE}/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  console.log('\nStep 1 — open this, signed into Clio as the account the app should act as:\n');
  console.log(`  ${authorizeUrl}\n`);
  console.log('Approve it. Clio sends you to:\n');
  console.log(`  ${REDIRECT_URI}?code=SOMETHING\n`);
  console.log('The dashboard may redirect and clear the address bar — if it does, find the');
  console.log('URL in browser history (Ctrl+H).\n');
  console.log('Step 2 — run this with what you landed on (the whole URL is fine):\n');
  console.log('  pnpm --filter @workspace/scripts clio:reauth -- "<paste it here>"\n');
  if (raw.trim()) {
    console.error(`Could not find a code in: ${raw.trim().slice(0, 120)}\n`);
    process.exit(1);
  }
  process.exit(0);
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
  console.error('\nA code is single-use and expires quickly. Run step 1 again for a fresh one.');
  console.error(`Redirect URI used: ${REDIRECT_URI}`);
  console.error('It must match the app registration exactly — set CLIO_REDIRECT_URI if not.\n');
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
console.log('1. Vercel → st-ives-law → Settings → Environment Variables → replace');
console.log('   CLIO_REFRESH_TOKEN (All Environments), then redeploy.');
console.log('2. Update CLIO_REFRESH_TOKEN in the repo-root .env so local testing matches.\n');

/**
 * Create the Clio custom fields the EPA and ACD precedents read.
 *
 * The Enduring Power of Attorney and Advance Care Directive templates are
 * coded against 23 matter custom fields that did not exist in the firm's
 * Clio: six EPA fields (donees, capacity, commencement, conditions) and the
 * seventeen-field ACD block (four substitute decision-makers plus health
 * care refusals). Until they exist, those placeholders can never fill.
 *
 *   pnpm --filter @workspace/scripts clio:create-fields
 *
 * Safe to run more than once: a field whose name already exists is skipped,
 * so a second run creates nothing. It stops at the first refusal rather than
 * sending 23 doomed requests.
 *
 * Every field is single-line text, matching every existing template field.
 * The merge prints Clio's stored value verbatim, so a Clio date field would
 * put "1960-03-12" on a statutory form; text prints what the lawyer typed.
 *
 * Three more hold the intake's readable summaries: the calamity beneficiary
 * list, and each trust fund's block. Those summaries used to be written into
 * the template fields themselves (NominatedBeneficiaryTt1, CalamityBeneficiary1),
 * which is why generated wills printed a whole list where one name belongs.
 * With the template fields now carrying single names, the summaries — and the
 * percentages and trust class that exist nowhere else in Clio — need a home.
 * They are multi-line text, like the other summary fields.
 *
 * Creating the fields does not fill them. The ACD fields stay empty until the
 * intake form asks for them.
 */

export {};

const BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
const { CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REFRESH_TOKEN } = process.env;

if (!CLIO_CLIENT_ID || !CLIO_CLIENT_SECRET || !CLIO_REFRESH_TOKEN) {
  console.error('Missing CLIO_CLIENT_ID / CLIO_CLIENT_SECRET / CLIO_REFRESH_TOKEN in the repo-root .env');
  process.exit(1);
}

type FieldSpec = { name: string; type: 'text_line' | 'text_area' };

const TEMPLATE_FIELDS = [
  'EpaDonee',
  'EpaDoneeSecond',
  'EpaDoneeCapacity',
  'EpaCommencement',
  'EpaConditions',
  'EpaConditionsContinued',
  ...[1, 2, 3, 4].flatMap((n) => [
    `AcdSdm${n}Name`,
    `AcdSdm${n}Dob`,
    `AcdSdm${n}Address`,
    `AcdSdm${n}Phone`,
  ]),
  'AcdHealthCareRefusals',
];

const FIELDS: FieldSpec[] = [
  ...TEMPLATE_FIELDS.map((name) => ({ name, type: 'text_line' as const })),
  { name: 'calamity_beneficiaries', type: 'text_area' },
  { name: 'trust_fund_1', type: 'text_area' },
  { name: 'trust_fund_2', type: 'text_area' },
  // Intake answers the payload already sends but that had no Clio field, so
  // Make dropped them. The first two are testamentary instructions; the rest
  // are lead metadata from the screening form.
  { name: 'former_partner_exclude', type: 'text_line' },
  { name: 'foreign_persons_excluded', type: 'text_line' },
  { name: 'trust_fund_structure', type: 'text_line' },
  { name: 'lead_type', type: 'text_line' },
  { name: 'region', type: 'text_line' },
  { name: 'person_responsible', type: 'text_line' },
  { name: 'submission_date', type: 'text_line' },
];

const tokenResponse = await fetch(`${BASE}/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIO_CLIENT_ID,
    client_secret: CLIO_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: CLIO_REFRESH_TOKEN,
  }).toString(),
});
const tokenText = await tokenResponse.text();
if (!tokenResponse.ok) {
  console.error(`Clio refused the refresh token (${tokenResponse.status}): ${tokenText.slice(0, 300)}`);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${JSON.parse(tokenText).access_token}` };

const listResponse = await fetch(
  `${BASE}/api/v4/custom_fields.json?fields=id,name&limit=200`,
  { headers: auth },
);
if (!listResponse.ok) {
  console.error(`Could not list existing fields (${listResponse.status}): ${(await listResponse.text()).slice(0, 300)}`);
  process.exit(1);
}
const listed = (await listResponse.json()) as { data: { name: string }[] };
const existing = new Set(listed.data.map((f) => f.name.toLowerCase()));

let created = 0;
let skipped = 0;
for (const { name, type } of FIELDS) {
  if (existing.has(name.toLowerCase())) {
    console.log(`  skip     ${name} (already exists)`);
    skipped++;
    continue;
  }
  const response = await fetch(`${BASE}/api/v4/custom_fields.json`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { name, parent_type: 'Matter', field_type: type, displayed: true },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`\n  FAILED   ${name} (${response.status}): ${text.slice(0, 300)}`);
    if (response.status === 403) {
      console.error('\nThe Clio app lacks write access to custom fields. Enable it on the Clio');
      console.error('developer app, re-run clio:reauth, and put the new token in BOTH .env and Vercel.');
    }
    console.error(`\nStopped after ${created} created, ${skipped} skipped. Re-running is safe.`);
    process.exit(1);
  }
  console.log(`  created  ${name}  (id ${(JSON.parse(text) as { data?: { id?: number } }).data?.id})`);
  created++;
}

console.log(`\nDone: ${created} created, ${skipped} already existed, ${FIELDS.length} total.`);

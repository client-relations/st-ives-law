/**
 * End-to-end check of the intake -> Make -> Clio field mapping.
 *
 *   pnpm --filter @workspace/scripts clio:mapping-check
 *
 * Builds two intakes with the same buildClioPayload() production runs, posts
 * them to the Clio matter webhook, waits for Make to create the matters, then
 * reads every mapped field back from Clio and compares it with what was sent.
 *
 * It creates two real test matters in Clio, named "ZZMAPTEST Direct ..." and
 * "ZZMAPTEST Trust ...". Delete them afterwards if you want a tidy Clio.
 *
 * Lives outside src/ because it imports the API's payload builder, which sits
 * outside this package's rootDir and would break the package typecheck.
 */
import { randomUUID } from 'node:crypto';
import { buildClioPayload } from '../../api/_lib/clio-payload';

const BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
const CLIO = `${BASE}/api/v4`;
const CHECK_ONLY = process.argv.includes('--check-only');
const webhook = process.env.CLIO_MATTER_WEBHOOK;
const { CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REFRESH_TOKEN } = process.env;
if (!webhook && !CHECK_ONLY) throw new Error('Set CLIO_MATTER_WEBHOOK in the repo-root .env (the Make webhook that creates matters).');
if (!CLIO_CLIENT_ID || !CLIO_CLIENT_SECRET || !CLIO_REFRESH_TOKEN) throw new Error('Missing Clio credentials in .env');

const tokenResponse = await fetch(`${BASE}/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIO_CLIENT_ID, client_secret: CLIO_CLIENT_SECRET,
    grant_type: 'refresh_token', refresh_token: CLIO_REFRESH_TOKEN,
  }).toString(),
});
if (!tokenResponse.ok) throw new Error(`Clio refused the refresh token (${tokenResponse.status})`);
const token = ((await tokenResponse.json()) as { access_token: string }).access_token;

// Date plus time-of-day, so two runs on the same day cannot share a name.
// The matter lookup below takes the first name match, and a stale matter
// from an earlier run would otherwise be read before Make creates the new one.
const STAMP = new Date()
  .toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  .replace(/[ ,:]+/g, '-');

const common = {
  scenario: 'Single',
  client_state: 'SA',
  client_address: '1 Test Street, Norwood',
  client_phone: '0400000000',
  client_occupation: 'Mapping test',
  client_marital_status: 'Single',
  inquiry_reason: 'Field mapping test - safe to delete',
  exec_initial_name: 'Evelyn Executor',
  exec_backup: 'Barry Backup-Executor',
  exec_further_backup: 'Fiona Further-Executor',
  calamity1: 'Carl Calamity-One', calamity1_pct: 60,
  calamity2: 'Cara Calamity-Two', calamity2_pct: 40,
  attorney: [
    { 'Full name': 'Donna Donee-One', Address: '2 Parade, Norwood SA 5067' },
    { 'Full name': 'Derek Donee-Two', Address: '3 Parade, Norwood SA 5067' },
  ],
  epa_jointly: 'Jointly and severally',
  epa_effective: 'Only upon legal incapacity',
  doc_will: true,
  doc_epa: true,
  former_partner_exclude: 'Xavier Former-Partner',
  fpe_trust: 'on',
  realestate: [{ Address: '1 Test Street, Norwood', 'Estimated value': '900000', 'Tenancy type': 'Joint tenants', 'Mortgage details': 'ANZ $200k' }],
  bank: [{ Bank: 'ANZ', 'Account type': 'Savings', 'Held jointly or individually': 'Joint', Value: '15000' }],
  super: [{ 'Fund name': 'AustralianSuper', 'Member number': 'M123', Value: '250000', 'Nominated beneficiary': 'Spouse' }],
  doc_acd: true,
  epa_conditions: 'My attorney may not sell my home while I live in it. '.repeat(6).trim(), // ~300 chars: spills onto the second line
  acd_health_care_refusals: 'No blood transfusions',
  sdm: [
    { 'Full name': 'Sam Sdm-One', 'Date of birth': '01/02/1960', Address: '4 Parade, Norwood SA 5067', Phone: '0400 000 001' },
    { 'Full name': 'Sue Sdm-Two', 'Date of birth': '03/04/1962', Address: '5 Parade, Norwood SA 5067', Phone: '0400 000 002' },
  ],
};

const cases = [
  {
    label: 'Direct',
    intake: {
      ...common,
      fund_count: '0',
      beneficiary1: 'Bella Beneficiary-One', beneficiary1_pct: 50,
      beneficiary2: 'Ben Beneficiary-Two', beneficiary2_pct: 30,
      beneficiary3: 'Bea Beneficiary-Three', beneficiary3_pct: 20,
    },
  },
  {
    label: 'Trust',
    intake: {
      ...common,
      fund_count: '2',
      fund1_beneficiary: 'Nina Nominated-One', fund1_class: 'Children',
      fund1_trustee_initial: 'Tom Trustee-1A', fund1_trustee_backup: 'Tina Trustee-1B', fund1_trustee_further: 'Ted Trustee-1C',
      fund1_appointor_initial: 'Amy Appointor-1A', fund1_appointor_backup: 'Alan Appointor-1B', fund1_appointor_further: 'Ada Appointor-1C',
      fund2_beneficiary: 'Noah Nominated-Two', fund2_class: 'Grandchildren',
      fund2_trustee_initial: 'Tara Trustee-2A', fund2_trustee_backup: 'Theo Trustee-2B', fund2_trustee_further: 'Tess Trustee-2C',
      fund2_appointor_initial: 'Abe Appointor-2A', fund2_appointor_backup: 'Ava Appointor-2B', fund2_appointor_further: 'Axel Appointor-2C',
    },
  },
];

// Clio field -> payload key, exactly as the updated scenario maps them.
const MAP: Record<string, string> = {
  Beneficiary1: 'beneficiary_1_name', Beneficiary2: 'beneficiary_2_name', Beneficiary3: 'beneficiary_3_name',
  CalamityBeneficiary1: 'calamity_beneficiary_1_name', CalamityBeneficiary2: 'calamity_beneficiary_2_name',
  CalamityBeneficiary3: 'calamity_beneficiary_3_name',
  NominatedBeneficiaryTt1: 'tt1_nominated_beneficiary', NominatedBeneficiaryTt2: 'tt2_nominated_beneficiary',
  EpaDonee: 'epa_donee_1', EpaDoneeSecond: 'epa_donee_2', EpaDoneeCapacity: 'epa_donee_capacity', EpaCommencement: 'epa_commencement',
  calamity_beneficiaries: 'calamity_beneficiaries', trust_fund_1: 'trust_fund_1', trust_fund_2: 'trust_fund_2',
  beneficiaries_direct: 'beneficiaries_direct',
  InitialExecutor: 'executor_primary_name', BackupExecutor: 'executor_backup_name', FurtherBackupExecutor: 'executor_tertiary_name',
  former_partner_exclude: 'former_partner_exclude', foreign_persons_excluded: 'foreign_persons_excluded',
  trust_fund_structure: 'trust_fund_structure', lead_type: 'lead_type', region: 'region',
  person_responsible: 'person_responsible', submission_date: 'submission_date',
  assets_real_estate: 'assets_real_estate', assets_bank: 'assets_bank', assets_super: 'assets_super',
  EpaConditions: 'epa_conditions', EpaConditionsContinued: 'epa_conditions_continued',
  AcdHealthCareRefusals: 'acd_health_care_refusals',
};
for (const n of [1, 2, 3, 4]) {
  Object.assign(MAP, {
    [`AcdSdm${n}Name`]: `acd_sdm${n}_name`, [`AcdSdm${n}Dob`]: `acd_sdm${n}_dob`,
    [`AcdSdm${n}Address`]: `acd_sdm${n}_address`, [`AcdSdm${n}Phone`]: `acd_sdm${n}_phone`,
  });
}
for (const n of [1, 2]) {
  Object.assign(MAP, {
    [`InitialTrusteeTt${n}`]: `tt${n}_trustee_initial`, [`BackupTrusteeTt${n}`]: `tt${n}_trustee_backup`,
    [`FurtherBackupTrusteeTt${n}`]: `tt${n}_trustee_further`, [`InitialAppointorTt${n}`]: `tt${n}_appointor_initial`,
    [`BackupAppointorTt${n}`]: `tt${n}_appointor_backup`, [`FurtherBackupAppointorTt${n}`]: `tt${n}_appointor_further`,
  });
}

const clio = async (path: string) => {
  const r = await fetch(`${CLIO}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Clio ${r.status} on ${path}: ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<any>;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
for (const c of cases) {
  const lastName = `ZZMAPTEST ${c.label} ${STAMP}`;
  const form = {
    id: randomUUID(), // matches no real form, so Make's Supabase write-back updates nothing
    client_name: `ZZ Mapping ${lastName}`,
    person_responsible: 'Sarah Southern', lead_type: 'test', region: 'SA',
    created_at: new Date().toISOString(),
  };
  const intake = {
    ...c.intake,
    client_name: `ZZ Mapping ${lastName}`,
    client_first_name: 'ZZ Mapping', client_last_name: lastName,
    client_email: `zzmaptest.${c.label.toLowerCase()}@example.com`,
  };
  const payload = buildClioPayload(intake, form, {});
  // buildClioPayload splits client_name itself; pin the contact name so the matter is findable.
  payload.client_first_name = 'ZZ Mapping';
  payload.client_last_name = lastName;

  if (CHECK_ONLY) {
    console.log(`\n### ${c.label}: checking the matter an earlier run created`);
  } else {
    const sent = await fetch(webhook!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log(`\n### ${c.label}: webhook ${sent.status} ${(await sent.text()).slice(0, 60)}`);
  }

  // Make can take several minutes to pick a bundle off the webhook queue.
  let matter: any = null;
  for (let i = 0; i < (CHECK_ONLY ? 1 : 96) && !matter; i++) {
    if (!CHECK_ONLY) await sleep(5000);
    // The newest matters, not a contact search: Clio's search index lags new
    // records by minutes, which read as "no matter" when the matter existed.
    const recent = await clio('/matters.json?fields=id,display_number,client%7Bname%7D&order=id(desc)&limit=25');
    matter = recent.data?.find((m: any) => m.client?.name?.includes(lastName)) || null;
  }
  if (!matter) { console.log(CHECK_ONLY ? '   NO MATTER yet - Make has not processed it' : '   NO MATTER after 8 minutes - check the Make execution log'); failures++; continue; }

  const full = await clio(`/matters/${matter.id}.json?fields=display_number,custom_field_values%7Bfield_name,value%7D`);
  const got: Record<string, string> = {};
  for (const v of full.data.custom_field_values) if (v.field_name) got[v.field_name] = String(v.value ?? '');
  console.log(`   matter ${full.data.display_number}`);

  for (const [field, key] of Object.entries(MAP)) {
    const expected = String(payload[key] ?? '');
    const actual = got[field] ?? '';
    if (!expected && !actual) continue; // not part of this case
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${field.padEnd(26)} ${JSON.stringify(actual).slice(0, 70)}${ok ? '' : `   expected ${JSON.stringify(expected).slice(0, 70)}`}`);
  }
}
console.log(`\n${failures === 0 ? 'ALL FIELDS MATCH' : `${failures} FAILURE(S)`}`);
process.exit(failures ? 1 : 0);

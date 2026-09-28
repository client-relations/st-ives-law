/**
 * End-to-end document check: a complete intake -> Make -> Clio -> merge -> Clio.
 *
 *   pnpm --filter @workspace/scripts clio:doc-test
 *
 * 1. Builds two intakes with EVERY form field answered (one with direct
 *    beneficiaries, one with two testamentary trusts), runs them through the
 *    production payload builder and posts them to the Clio matter webhook, so
 *    Make creates the contact and matter exactly as it does for a real client.
 * 2. Resolves the person responsible to a Clio user the way populate-clio does,
 *    so Make sets the matter's responsible attorney (needs the Clio app to
 *    hold the Users read permission; otherwise it is reported and left unset).
 * 3. Reads each matter back with the same code the dashboard uses
 *    (fetchMatter + toTemplateVariables), builds the merge variables with the
 *    generator endpoint's own buildTemplateVariables, renders every document
 *    in the matter's package with generateWillFromTemplate, and files each one
 *    on the matter with the API's uploadDocumentToMatter.
 * 4. Reports, per document, every << placeholder >> still unfilled, and per
 *    matter every custom field still empty, so the manual check in Clio starts
 *    from a list rather than a hunt.
 *
 * Creates two real matters named "ZZ DOCTEST ..." with documents attached.
 * Delete them (and their contacts) when the check is done.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildClioPayload } from '../../api/_lib/clio-payload';
import { buildTemplateVariables } from '../../api/generate-document';
import { generateWillFromTemplate } from '../../api/_lib/document-processor';
import {
  CLIO_API,
  fetchMatter,
  findUserIdByName,
  getClioAccessToken,
  toTemplateVariables,
  uploadDocumentToMatter,
} from '../../api/_lib/clio-client';

// `--merge-only <clioMatterId>` skips Make and the upload: it reads that matter,
// renders its documents locally and reports the placeholders left. Read-only
// against Clio, so it is safe to run against any existing matter.
const mergeOnlyIndex = process.argv.indexOf('--merge-only');
const MERGE_ONLY_MATTER = mergeOnlyIndex >= 0 ? Number(process.argv[mergeOnlyIndex + 1]) : null;
const webhook = process.env.CLIO_MATTER_WEBHOOK;
if (!webhook && !MERGE_ONLY_MATTER) throw new Error('Set CLIO_MATTER_WEBHOOK in the repo-root .env (the Make webhook that creates matters).');
const auth = await getClioAccessToken();
if (!auth.token) throw new Error(`Clio authentication unavailable: ${auth.error}`);
const token = auth.token;

const STAMP = new Date()
  .toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  .replace(/[ ,:]+/g, '-');
const OUT_DIR = join(process.cwd(), '..', 'test-evidence', `doctest-${STAMP}`);
mkdirSync(OUT_DIR, { recursive: true });

// ── A complete intake: every named field and every repeat group answered ──
const complete = {
  // Step 1
  scenario: 'Single',
  client_name: '', // set per case
  client_former_names: 'Fiona Formerly-Known',
  client_date_of_birth: '1970-03-12',
  client_address: '1 Test Street, Norwood SA 5067',
  client_state: 'SA',
  client_occupation: 'Software tester',
  client_marital_status: 'Married',
  former_partner_exclude: 'Xavier Former-Partner',
  spouse_name: 'Sasha Spouse',
  spouse_occupation: 'Teacher',
  mirror_or_independent: 'Mirror wills',
  financial_adviser: 'Frank Adviser (Norwood Wealth)',
  governing_jurisdiction: 'SA',
  // Step 2
  realestate: [
    { Address: '1 Test Street, Norwood SA 5067', 'Estimated value': '900000', 'Tenancy type': 'Joint tenants', 'Mortgage details': 'ANZ, $200,000 owing' },
    { Address: '7 Beach Road, Glenelg SA 5045', 'Estimated value': '650000', 'Tenancy type': 'Sole ownership', 'Mortgage details': 'None' },
  ],
  bank: [
    { Bank: 'ANZ', 'Account type': 'Savings', 'Held jointly or individually': 'Joint', Value: '15000' },
    { Bank: 'CBA', 'Account type': 'Term deposit', 'Held jointly or individually': 'Individual', Value: '40000' },
  ],
  super: [
    { 'Fund name': 'AustralianSuper', 'Member number': 'M123456', Value: '250000', 'Nominated beneficiary': 'Sasha Spouse' },
  ],
  other_assets: 'Toyota Corolla 2019; share portfolio approx $30,000',
  // Step 3
  doc_will: 'on', doc_epa: 'on', doc_acd: 'on', doc_sdt: 'on',
  // Step 4
  exec_initial_name: 'Evelyn Executor',
  exec_initial_address: '2 Executor Lane, Norwood SA 5067',
  exec_initial_relationship: 'Sister',
  exec_backup: 'Barry Backup-Executor',
  exec_further_backup: 'Fiona Further-Executor',
  exec_joint: 'Act jointly',
  exec_power_of_sale: 'on',
  // Step 5
  exclusion: [{ Name: 'Eric Excluded', Reason: 'Estranged since 2010' }],
  no_contest_clause: 'on',
  // Step 6
  gift: [
    { 'Item description': 'Grandfather clock', Recipient: 'Gina Gift-One', 'Fallback if recipient predeceases': 'Gina\'s children' },
    { 'Item description': '$5,000', Recipient: 'RSPCA South Australia', 'Fallback if recipient predeceases': '' },
  ],
  // Step 7
  has_company: 'Yes',
  company_name: 'Testco Pty Ltd',
  company_acn: '123 456 789',
  company_on_death: 'Transfer/sell',
  company_share_treatment: 'Specific gift',
  // Step 8
  has_life_tenancy: 'Yes',
  life_tenant: 'Larry Life-Tenant',
  life_tenancy_property: '7 Beach Road, Glenelg SA 5045',
  life_tenancy_outgoings: 'Life tenant',
  life_tenancy_balance: 'Residuary estate',
  life_tenancy_sale_power: 'on',
  // Step 9 (fund_count / beneficiaries / funds set per case)
  fpe_trust: 'on',
  personal_belongings_to: 'Same as named beneficiaries above',
  calamity_count: '3',
  calamity1: 'Carl Calamity-One', calamity1_pct: '50',
  calamity2: 'Cara Calamity-Two', calamity2_pct: '30',
  calamity3: 'Cal Calamity-Three', calamity3_pct: '20',
  // Step 10
  has_sdt: 'Yes',
  sdt_mechanism: 'Standard executor power (distribute a trust gift directly to the beneficiary to fund an SDT they establish separately)',
  sdt_principal_beneficiary: 'Sid Sdt-Beneficiary',
  // Step 11
  has_minors: 'Yes',
  guardian_initial: 'Gail Guardian',
  guardian_backup: 'Gordon Guardian-Backup',
  // Step 12
  organ_donation: 'Available',
  burial_or_cremation: 'Cremation',
  funeral_other: 'Ashes scattered at Glenelg beach',
  // Step 13
  attorney: [
    { 'Full name': 'Donna Donee-One', Address: '2 Parade, Norwood SA 5067' },
    { 'Full name': 'Derek Donee-Two', Address: '3 Parade, Norwood SA 5067' },
  ],
  epa_jointly: 'Jointly and severally',
  epa_effective: 'Only upon legal incapacity',
  epa_power_conflict: 'on', epa_power_charge: 'on', epa_power_gifts: 'on',
  epa_power_will: 'on', epa_power_spouse: 'on', epa_power_digital: 'on',
  epa_conditions: 'My attorney may not sell my home at 1 Test Street while I am living in it. My attorney must consult my spouse before any transaction over $50,000. My attorney may not make gifts to themselves beyond $500 per year. These conditions apply until revoked in writing.',
  // Step 14
  sdm: [
    { 'Full name': 'Sam Sdm-One', 'Date of birth': '01/02/1960', Address: '4 Parade, Norwood SA 5067', Phone: '0400 000 001' },
    { 'Full name': 'Sue Sdm-Two', 'Date of birth': '03/04/1962', Address: '5 Parade, Norwood SA 5067', Phone: '0400 000 002' },
    { 'Full name': 'Sol Sdm-Three', 'Date of birth': '05/06/1964', Address: '6 Parade, Norwood SA 5067', Phone: '0400 000 003' },
    { 'Full name': 'Sia Sdm-Four', 'Date of birth': '07/08/1966', Address: '7 Parade, Norwood SA 5067', Phone: '0400 000 004' },
  ],
  acd_health_care_refusals: 'I refuse blood transfusions in all circumstances. I refuse CPR if I have a terminal illness.',
  // Step 15
  has_low: 'Yes',
  low_wishes: 'Please keep the family home in the family if at all possible.',
  signing_date: '2026-10-15',
  will_custody: 'Firm',
  add_to_wills_register: 'on',
  // From the earlier inquiry form (merged in by populate-clio)
  inquiry_reason: 'Put a will or estate plan in place',
  client_phone: '0400 123 456',
};

type DocSpec = { templateType: 'simple_will' | 'single_tt_will' | 'multi_tt_will' | 'epa' | 'acd'; label: string };
const cases: { label: string; intake: Record<string, any>; docs: DocSpec[] }[] = [
  {
    label: 'Direct',
    intake: {
      ...complete,
      fund_count: 'None (residue passes directly to named beneficiaries)',
      beneficiary_count: '3',
      beneficiary1: 'Bella Beneficiary-One', beneficiary1_pct: '50',
      beneficiary2: 'Ben Beneficiary-Two', beneficiary2_pct: '30',
      beneficiary3: 'Bea Beneficiary-Three', beneficiary3_pct: '20',
    },
    docs: [
      { templateType: 'simple_will', label: 'Standard Will' },
      { templateType: 'epa', label: 'Enduring Power of Attorney' },
      { templateType: 'acd', label: 'Advance Care Directive' },
    ],
  },
  {
    label: 'Trust',
    intake: {
      ...complete,
      fund_count: '2',
      fund1_beneficiary: 'Nina Nominated-One', fund1_class: 'Children',
      fund1_trustee_initial: 'Tom Trustee-1A', fund1_trustee_backup: 'Tina Trustee-1B', fund1_trustee_further: 'Ted Trustee-1C',
      fund1_appointor_initial: 'Amy Appointor-1A', fund1_appointor_backup: 'Alan Appointor-1B', fund1_appointor_further: 'Ada Appointor-1C',
      fund2_beneficiary: 'Noah Nominated-Two', fund2_class: 'Grandchildren',
      fund2_trustee_initial: 'Tara Trustee-2A', fund2_trustee_backup: 'Theo Trustee-2B', fund2_trustee_further: 'Tess Trustee-2C',
      fund2_appointor_initial: 'Abe Appointor-2A', fund2_appointor_backup: 'Ava Appointor-2B', fund2_appointor_further: 'Axel Appointor-2C',
      // No residuary beneficiaries in a trust will, so personal belongings go to named people.
      personal_belongings_to: 'Named person(s) below',
      personal_belongings_1: 'Pam Personal-One', personal_belongings_2: 'Pete Personal-Two', personal_belongings_3: 'Pia Personal-Three',
    },
    docs: [
      { templateType: 'multi_tt_will', label: 'Will with Testamentary Trusts' },
      { templateType: 'epa', label: 'Enduring Power of Attorney' },
      { templateType: 'acd', label: 'Advance Care Directive' },
    ],
  },
];

const clio = async (path: string, init?: RequestInit) => {
  const r = await fetch(`${CLIO_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error(`Clio ${r.status} on ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<any>;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every << placeholder >> still in a rendered DOCX, with Word's run splits rejoined. */
async function leftoverPlaceholders(docx: Buffer): Promise<string[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(docx);
  const names = Object.keys(zip.files).filter((n) => n.startsWith('word/') && n.endsWith('.xml'));
  const found = new Set<string>();
  for (const name of names) {
    const xml = await zip.file(name)!.async('string');
    for (const para of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
      const text = (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      for (const m of text.matchAll(/<<\s*([^<>]+?)\s*>>/g)) found.add(m[1]);
    }
  }
  return [...found].sort();
}

// Same lookup populate-clio performs before posting to Make.
const PERSON_RESPONSIBLE = 'Sarah Southern';
const responsibleAttorneyId = MERGE_ONLY_MATTER ? null : await findUserIdByName(token, PERSON_RESPONSIBLE);
if (!MERGE_ONLY_MATTER) {
  console.log(responsibleAttorneyId
    ? `responsible attorney "${PERSON_RESPONSIBLE}" resolved to Clio user ${responsibleAttorneyId}`
    : `responsible attorney "${PERSON_RESPONSIBLE}" could not be resolved (Clio app lacks Users read, or no such user); matters will carry none`);
}

const report: string[] = [];
let problems = 0;

for (const c of MERGE_ONLY_MATTER ? cases.slice(0, 1) : cases) {
  const lastName = `ZZ DOCTEST ${c.label} ${STAMP}`;
  const form = {
    id: randomUUID(),
    client_name: `Testa ${lastName}`,
    client_email: `zzdoctest.${c.label.toLowerCase()}@example.com`,
    person_responsible: PERSON_RESPONSIBLE,
    lead_type: 'Estate planning',
    region: 'SA',
    created_at: new Date().toISOString(),
  };
  const intake = { ...c.intake, client_name: form.client_name, client_email: form.client_email };
  const payload = buildClioPayload(intake, form, { responsible_attorney_id: responsibleAttorneyId });
  payload.client_first_name = 'Testa';
  payload.client_last_name = lastName;

  let matterRow: any = null;
  if (MERGE_ONLY_MATTER) {
    matterRow = (await clio(`/matters/${MERGE_ONLY_MATTER}.json?fields=id,display_number,client{id,name}`)).data;
    console.log(`\n### merge-only: matter ${matterRow.display_number} (id ${matterRow.id})`);
  } else {
    console.log(`\n### ${c.label}: posting a complete intake to Make`);
    const sent = await fetch(webhook!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log(`   webhook ${sent.status} ${(await sent.text()).slice(0, 40)}`);

    for (let i = 0; i < 96 && !matterRow; i++) {
      await sleep(5000);
      const recent = await clio('/matters.json?fields=id,display_number,client{id,name}&order=id(desc)&limit=25');
      matterRow = recent.data?.find((m: any) => m.client?.name?.includes(lastName)) || null;
    }
    if (!matterRow) { console.log('   NO MATTER after 8 minutes - check the Make execution log'); problems++; continue; }
    console.log(`   matter ${matterRow.display_number} (id ${matterRow.id}, contact ${matterRow.client.id})`);
  }

  // Exactly what /api/clio-matter returns to the dashboard.
  const matter = await fetchMatter(token, matterRow.id);
  const variables = toTemplateVariables(matter);
  const emptyFields = Object.entries(
    Object.fromEntries((await clio(`/matters/${matterRow.id}.json?fields=custom_field_values{field_name,value}`)).data.custom_field_values.map((v: any) => [v.field_name, v.value ?? ''])),
  ).filter(([, v]) => !v).map(([k]) => k);
  report.push(`\n${c.label} matter ${matterRow.display_number} (Clio id ${matterRow.id})`);
  report.push(`  custom fields still empty in Clio (${emptyFields.length}): ${emptyFields.join(', ') || 'none'}`);

  for (const doc of c.docs) {
    // The request the dashboard sends to /api/generate-document, and the
    // variable map that endpoint builds from it.
    const body = {
      templateType: doc.templateType,
      scenario: 'individual',
      client_name: variables['Matter.Client.Name'] || matter.client_name,
      ...variables,
    };
    const merge = buildTemplateVariables(body);
    const docx = await generateWillFromTemplate(doc.templateType, 'individual', merge, 'docx');
    let pdf: Buffer | null = null;
    try { pdf = await generateWillFromTemplate(doc.templateType, 'individual', merge, 'pdf'); } catch { /* LibreOffice optional */ }

    // Named the way the dashboard names a filed document: label, em dash, client.
    const fileBase = `${doc.label} — ${MERGE_ONLY_MATTER ? matter.client_name : form.client_name}`;
    writeFileSync(join(OUT_DIR, `${fileBase}.docx`), docx);
    if (pdf) writeFileSync(join(OUT_DIR, `${fileBase}.pdf`), pdf);

    const left = await leftoverPlaceholders(docx);
    if (MERGE_ONLY_MATTER) {
      console.log(`   ${doc.label}: rendered locally${pdf ? ' + PDF' : ''}, ${left.length} placeholder(s) left`);
    } else {
      const { documentId } = await uploadDocumentToMatter(token, matterRow.id, `${fileBase}.docx`, docx);
      if (pdf) await uploadDocumentToMatter(token, matterRow.id, `${fileBase}.pdf`, pdf);
      console.log(`   ${doc.label}: uploaded (document ${documentId}${pdf ? ' + PDF' : ''}), ${left.length} placeholder(s) left`);
    }
    report.push(`  ${doc.label}: ${left.length === 0 ? 'every placeholder filled' : 'still unfilled -> ' + left.join(', ')}`);
    if (left.length) problems++;
  }
}

console.log('\n==================== SUMMARY ====================');
console.log(report.join('\n'));
console.log(`\nLocal copies: ${OUT_DIR}`);
console.log(problems === 0 ? '\nALL DOCUMENTS COMPLETE' : `\n${problems} item(s) need attention`);
process.exit(problems ? 1 : 0);

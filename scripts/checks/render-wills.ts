/**
 * Write sample wills from fake data, offline, to look at the header and footer.
 *
 *   node --import tsx scripts/checks/render-wills.ts <out-dir>
 *   soffice --headless --convert-to pdf --outdir <out-dir> <out-dir>/*.docx
 *
 * Three cases: a male single (Simple Will), a female single (Single TT Will)
 * and a couple (Multi TT Will, both spouses, the wife's version with the
 * genders swapped the way the dashboard swaps Mr and Mrs). Fetch is blocked.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

globalThis.fetch = (async (input: unknown) => {
  throw new Error(`render-wills: network call blocked (${String(input)})`);
}) as typeof fetch;

const outDir = resolve(process.argv[2] || 'will-render');
mkdirSync(outDir, { recursive: true });

const quiet = console.log;
console.log = () => {};
const { buildTemplateVariables } = await import('../../api/generate-document');
const { generateWillFromTemplate } = await import('../../api/_lib/document-processor');

const common = {
  'Matter.CustomField.InitialExecutor': 'Test Executor-One',
  'Matter.CustomField.BackupExecutor': 'Test Executor-Two',
  'Matter.CustomField.Beneficiary1': 'Test Beneficiary-One',
  'Matter.CustomField.CalamityBeneficiary1': 'Test Calamity-One',
  'Matter.CustomField.InitialTrusteeTt1': 'Test Trustee-1A',
  'Matter.CustomField.InitialAppointorTt1': 'Test Appointor-1A',
  'Matter.CustomField.NominatedBeneficiaryTt1': 'Test Child-One',
  'Matter.CustomField.InitialTrusteeTt2': 'Test Trustee-2A',
  'Matter.CustomField.InitialAppointorTt2': 'Test Appointor-2A',
  'Matter.CustomField.NominatedBeneficiaryTt2': 'Test Child-Two',
  'Matter.Client.Address': '1 Test Street, Norwood SA 5067',
};

const couple = {
  ...common,
  'Matter.Client.Name': 'Test Husband',
  'Matter.Relationships.Mr.Name': 'Test Husband',
  'Matter.Relationships.Mrs.Name': 'Test Wife',
  'Matter.CustomField.ClientGender': 'Male',
  'Matter.CustomField.SpouseGender': 'Female',
};
// The dashboard's second version for a couple: the spouses swap, and so do
// their genders.
const coupleSwapped = {
  ...couple,
  'Matter.Client.Name': 'Test Wife',
  'Matter.Relationships.Mr.Name': 'Test Wife',
  'Matter.Relationships.Mrs.Name': 'Test Husband',
  'Matter.CustomField.ClientGender': 'Female',
  'Matter.CustomField.SpouseGender': 'Male',
};

const cases = [
  { file: 'male-single-simple-will', type: 'simple_will', scenario: 'individual', vars: { ...common, 'Matter.Client.Name': 'Test Male-Client', 'Matter.CustomField.ClientGender': 'Male' } },
  // A date-stamped name, as the scripts/checks test matters carry: the title
  // and header must print the bare name.
  { file: 'female-single-single-tt-will', type: 'single_tt_will', scenario: 'individual', vars: { ...common, 'Matter.Client.Name': 'Test Female-Client 14-Oct-2026-10-22-33', 'Matter.CustomField.ClientGender': 'Female' } },
  { file: 'couple-husband-multi-tt-will', type: 'multi_tt_will', scenario: 'couple', vars: couple },
  { file: 'couple-wife-multi-tt-will', type: 'multi_tt_will', scenario: 'couple', vars: coupleSwapped },
] as const;

for (const c of cases) {
  const body = { templateType: c.type, scenario: c.scenario, client_name: c.vars['Matter.Client.Name'], form_id: '1000001-Test', ...c.vars };
  const variables = buildTemplateVariables(body);
  const docx = await generateWillFromTemplate(c.type, c.scenario, variables, 'docx');
  writeFileSync(join(outDir, `${c.file}.docx`), docx);
  quiet(`${c.file}.docx  (${variables['Will.TestatorLabel']}, ${variables['Matter.Client.Name']})`);
}

/**
 * Payload snapshot: what a stored intake turns into, with no network at all.
 *
 *   pnpm --filter @workspace/scripts payload:snapshot > /tmp/before.json
 *   # ...make the change...
 *   pnpm --filter @workspace/scripts payload:snapshot > /tmp/after.json
 *   diff /tmp/before.json /tmp/after.json
 *
 * For each fixture in scripts/checks/fixtures (or the paths given as
 * arguments) it walks the same code production runs:
 *
 *   forms.form_data            the fixture (intake captured from the real form)
 *   -> populate-clio merge     inquiry fills gaps, intake wins (copied below)
 *   -> buildClioPayload        the exact JSON posted to the Make webhook
 *   -> Make -> Clio            SIMULATED with the field map from
 *                              clio-mapping-check.ts (the live scenario is not
 *                              in this repo, so only those fields are known)
 *   -> normaliseMatter + toTemplateVariables   what /api/clio-matter returns
 *   -> dashboard versions      couple = two versions, Mr/Mrs swapped (copied
 *                              from ClioDocumentGeneration.tsx)
 *   -> buildTemplateVariables  what /api/generate-document merges
 *   -> generateWillFromTemplate (DOCX only): title, header/footer text and
 *                              the placeholders still unfilled
 *
 * It also prints the form contract read from the two HTML forms: every input
 * name, its stored option values, the repeat-row keys, and the step count the
 * server expects. A change that renames a key or an option value, or adds a
 * step without updating TOTAL_STEPS, shows up in the diff.
 *
 * Fail closed: fetch is replaced with a function that throws, and the clock is
 * frozen (--now=ISO, default 2026-10-14T00:00:00Z) so the output only changes
 * when the code or the fixture does.
 *
 * Lives outside src/ for the same reason as clio-mapping-check: it imports the
 * API's code, which sits outside this package's rootDir.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ── Fail closed: no network, frozen clock ──────────────────────────────────
globalThis.fetch = (async (input: unknown) => {
  throw new Error(`payload-snapshot: network call blocked (${String(input)})`);
}) as typeof fetch;

const nowArg = process.argv.find((a) => a.startsWith('--now='));
const FROZEN = new Date(nowArg ? nowArg.slice('--now='.length) : '2026-10-14T00:00:00Z').getTime();
if (Number.isNaN(FROZEN)) throw new Error('--now must be an ISO date-time');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(FROZEN);
    else super(...(args as [any]));
  }
  static now() {
    return FROZEN;
  }
}
globalThis.Date = FrozenDate as DateConstructor;

// stdout carries only the JSON snapshot; any log line from the code under test
// goes to stderr so `> before.json` stays valid JSON.
console.log = (...args: unknown[]) => console.error(...args);

// Imported after the clock is frozen.
const { buildClioPayload } = await import('../../api/_lib/clio-payload');
const { normaliseMatter, toTemplateVariables } = await import('../../api/_lib/clio-client');
const { buildTemplateVariables } = await import('../../api/generate-document');
const { generateWillFromTemplate } = await import('../../api/_lib/document-processor');
const JSZip = (await import('jszip')).default;

// ── Copies of logic that is not exported (keep in step with the source) ────

/** api/populate-clio.ts: inquiry fills gaps, a non-empty intake value wins. */
function mergeForClio(inquiryData: Record<string, any>, intakeData: Record<string, any>) {
  const merged: Record<string, any> = { ...inquiryData };
  for (const [key, value] of Object.entries(intakeData)) {
    const isEmpty = value === undefined || value === null || value === '';
    if (!isEmpty || !(key in merged)) merged[key] = value;
  }
  return merged;
}

/** scripts/checks/clio-mapping-check.ts MAP: Clio custom field -> payload key. */
const CLIO_FIELD_MAP: Record<string, string> = {
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
  Object.assign(CLIO_FIELD_MAP, {
    [`AcdSdm${n}Name`]: `acd_sdm${n}_name`, [`AcdSdm${n}Dob`]: `acd_sdm${n}_dob`,
    [`AcdSdm${n}Address`]: `acd_sdm${n}_address`, [`AcdSdm${n}Phone`]: `acd_sdm${n}_phone`,
  });
}
for (const n of [1, 2]) {
  Object.assign(CLIO_FIELD_MAP, {
    [`InitialTrusteeTt${n}`]: `tt${n}_trustee_initial`, [`BackupTrusteeTt${n}`]: `tt${n}_trustee_backup`,
    [`FurtherBackupTrusteeTt${n}`]: `tt${n}_trustee_further`, [`InitialAppointorTt${n}`]: `tt${n}_appointor_initial`,
    [`BackupAppointorTt${n}`]: `tt${n}_appointor_backup`, [`FurtherBackupAppointorTt${n}`]: `tt${n}_appointor_further`,
  });
}

/** ClioDocumentGeneration.tsx handleGenerate: one version, or two for a couple. */
function dashboardVersions(variables: Record<string, string>, isCouple: boolean) {
  return isCouple
    ? [
        { suffix: variables['Matter.Relationships.Mr.Name'] || 'Client 1', variables },
        {
          suffix: variables['Matter.Relationships.Mrs.Name'] || 'Client 2',
          variables: {
            ...variables,
            'Matter.Relationships.Mr.Name': variables['Matter.Relationships.Mrs.Name'] || '',
            'Matter.Relationships.Mrs.Name': variables['Matter.Relationships.Mr.Name'] || '',
            'Matter.Client.Name': variables['Matter.Relationships.Mrs.Name'] || '',
          },
        },
      ]
    : [{ suffix: '', variables }];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Stable JSON: object keys sorted, so a diff shows only real changes. */
function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

function xmlText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Run a noisy function with console.log/warn silenced (the DOCX merge logs every replacement). */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { log, warn } = console;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

async function describeDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n)).sort();
  const unfilled = new Set<string>();
  const headersFooters: Record<string, string> = {};
  let bodyText = '';
  for (const name of names) {
    const text = xmlText(await zip.file(name)!.async('text'));
    for (const m of text.matchAll(/<<\s*([^<>]+?)\s*>>/g)) unfilled.add(m[1].replace(/\s+/g, ''));
    if (name === 'word/document.xml') bodyText = text;
    else if (text.trim()) headersFooters[name] = text.trim();
  }
  const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
  const core = await zip.file('docProps/core.xml')?.async('text');
  return {
    doc_title_property: core?.match(/<dc:title>(.*?)<\/dc:title>/)?.[1] ?? null,
    first_lines: lines.slice(0, 3),
    execution_lines: lines.filter((l) => /^(Executed by|Signed by|Signature of|Testator means|Testatrix means)/.test(l)),
    testator_word_count: (bodyText.match(/\bTestator\b/g) || []).length,
    testatrix_word_count: (bodyText.match(/\bTestatrix\b/g) || []).length,
    header_footer_text: headersFooters,
    unfilled_placeholders: [...unfilled].sort(),
  };
}

// ── Form contract, read from the HTML the client actually fills ────────────

function formContract(htmlPath: string) {
  const html = readFileSync(htmlPath, 'utf8');
  const fields: Record<string, any> = {};
  // A select is matched with its options; an input or textarea on its own.
  const tagRe = /<select\b([^>]*)>([\s\S]*?)<\/select>|<(input|textarea)\b([^>]*)>/g;
  for (const m of html.matchAll(tagRe)) {
    const tag = m[3] || 'select';
    const attrs = m[3] ? m[4] : m[1];
    const selectBody = m[3] ? '' : m[2];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    if (!name) continue;
    const type = tag === 'input' ? attrs.match(/\btype="([^"]+)"/)?.[1] || 'text' : tag;
    const entry = (fields[name] ||= { type, required: false, values: [] as string[] });
    if (/\brequired\b/.test(attrs)) entry.required = true;
    const min = attrs.match(/\bmin="([^"]+)"/)?.[1];
    const max = attrs.match(/\bmax="([^"]+)"/)?.[1];
    if (min) entry.min = min;
    if (max) entry.max = max;
    if (type === 'radio' || type === 'checkbox') {
      // A checkbox with no value attribute is stored as "on".
      entry.values.push(attrs.match(/\bvalue="([^"]*)"/)?.[1] ?? 'on');
    }
    if (tag === 'select' && selectBody) {
      // The stored value is the value attribute, or the option's text when absent.
      for (const o of selectBody.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)) {
        const v = o[1].match(/\bvalue="([^"]*)"/)?.[1] ?? o[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
        entry.values.push(v);
      }
    }
  }
  for (const entry of Object.values(fields)) if (!entry.values.length) delete entry.values;

  // Repeat rows are stored as arrays of objects keyed by each field's LABEL.
  const repeats: Record<string, any> = {};
  const tplBlock = html.match(/const templates = \{([\s\S]*?)\n\};/)?.[1] || '';
  for (const m of tplBlock.matchAll(/(\w+): \(\) => fieldRow\(\[([\s\S]*?)\]\)/g)) {
    repeats[m[1]] = [...m[2].matchAll(/\{label:'([^']+)', type:'(\w+)'(?:, options:\[([^\]]*)\])?\}/g)].map((f) => ({
      key: f[1],
      type: f[2],
      ...(f[3] ? { values: [...f[3].matchAll(/'([^']*)'/g)].map((o) => o[1]) } : {}),
    }));
  }
  const collected = html.match(/\[([^\]]+)\]\.forEach\(key => \{\s*const items/)?.[1];
  return {
    step_count: (html.match(/<div class="step"/g) || []).length,
    fields,
    repeat_rows: repeats,
    repeat_keys_collected: collected ? [...collected.matchAll(/'(\w+)'/g)].map((m) => m[1]) : [],
  };
}

const totalStepsMatch = readFileSync(join(ROOT, 'api', 'submit-intake.js'), 'utf8').match(/const TOTAL_STEPS = (\d+)/);
if (!totalStepsMatch) throw new Error('payload-snapshot: could not find "const TOTAL_STEPS = <n>" in api/submit-intake.js');
const serverTotalSteps = Number(totalStepsMatch[1]);

// ── Run the fixtures ───────────────────────────────────────────────────────

const fixtureArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fixtureDir = join(HERE, 'fixtures');
const fixturePaths = fixtureArgs.length
  ? fixtureArgs.map((p) => resolve(p))
  : readdirSync(fixtureDir).filter((f) => f.endsWith('.json')).sort().map((f) => join(fixtureDir, f));

const TEMPLATE_TYPES = ['simple_will', 'single_tt_will', 'multi_tt_will', 'epa', 'acd'] as const;

const cases: Record<string, any> = {};
for (const path of fixturePaths) {
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  const { form, form_data: formData, clio } = fixture;
  if (!form || !formData || !clio) throw new Error(`payload-snapshot: ${path} needs "form", "form_data" and "clio" blocks`);

  // 1. populate-clio: merge, then the payload posted to Make.
  const merged = mergeForClio(formData.inquiry || {}, formData.intake || {});
  const metadata = { ...(formData.metadata || {}), responsible_attorney_id: clio.responsible_attorney_id ?? null };
  const payload = buildClioPayload(merged, form, metadata);
  const postedBody = JSON.parse(JSON.stringify(payload));

  // 2. Make -> Clio (simulated): the documented custom-field map, plus the
  //    contact Make creates from the client_* keys.
  const customFieldValues = Object.entries(CLIO_FIELD_MAP).map(([field_name, key]) => ({
    field_name,
    value: postedBody[key] ?? null,
  }));
  const rawMatter = {
    id: clio.matter_id,
    display_number: clio.display_number,
    description: '',
    status: 'Open',
    client: { id: clio.matter_id + 500000, name: clio.contact_name, type: 'Person', date_of_birth: postedBody.client_date_of_birth || null },
    responsible_attorney: clio.responsible_attorney_name ? { id: clio.responsible_attorney_id, name: clio.responsible_attorney_name } : null,
    custom_field_values: customFieldValues,
  };
  const matter = normaliseMatter(rawMatter);
  // fetchMatter adds the contact's address and phone (fetchContactDetails).
  matter.client_address = [postedBody.client_address, postedBody.client_city, [postedBody.client_state, postedBody.client_postcode].filter(Boolean).join(' ')]
    .filter((p) => p && String(p).trim())
    .join(', ');
  matter.client_phone = String(postedBody.client_phone || '');
  const clioVariables = toTemplateVariables(matter);

  // 3. Dashboard -> /api/generate-document, per version and template.
  const scenario = matter.is_couple ? 'couple' : 'individual';
  const versions = [];
  for (const version of dashboardVersions(clioVariables, matter.is_couple)) {
    const documents: Record<string, any> = {};
    let requestVariables: Record<string, string> | null = null;
    for (const templateType of TEMPLATE_TYPES) {
      const body = {
        templateType,
        scenario,
        client_name: version.variables['Matter.Client.Name'] || matter.client_name,
        form_id: matter.display_number,
        ...version.variables,
      };
      const variables = buildTemplateVariables(body);
      requestVariables ||= variables; // identical for every template type
      const docx = await quietly(() => generateWillFromTemplate(templateType, scenario, variables, 'docx'));
      documents[templateType] = await describeDocx(docx);
    }
    versions.push({
      dashboard_document_name_suffix: version.suffix || matter.client_name,
      template_variables: requestVariables,
      documents,
    });
  }

  cases[fixture.label || path.split('/').pop()!.replace(/\.json$/, '')] = {
    // Keys whose value reaches Clio from the enquiry, because the intake lacks
    // the key or left it empty.
    merged_keys_taken_from_inquiry: Object.keys(formData.inquiry || {})
      .filter((k) => merged[k] === formData.inquiry[k] && merged[k] !== (formData.intake || {})[k])
      .sort(),
    clio_payload: postedBody,
    clio_payload_keys_not_mapped_to_clio_fields_by_known_map: Object.keys(postedBody)
      .filter((k) => !Object.values(CLIO_FIELD_MAP).includes(k))
      .sort(),
    clio_matter_normalised: matter,
    clio_template_variables: clioVariables,
    versions,
  };
}

const output = {
  generated_with_frozen_clock: new RealDate(FROZEN).toISOString(),
  notes: [
    'Clio custom fields are simulated with the clio-mapping-check.ts map only. Fields the live Make scenario may also map (Jurisdiction, InitialGuardian, BackupGuardian, ...) are not known in this repo, so they show as unfilled placeholders here.',
    'display_number and the contact name come from each fixture\'s "clio" block, not from Clio.',
    'Document file names (ClioDocumentGeneration.tsx) are not covered: that logic sits in a React component.',
  ],
  form_contract: {
    intake_form: formContract(join(ROOT, 'artifacts', 'questionnaire', 'public', 'intake-form.html')),
    lead_inquiry: formContract(join(ROOT, 'artifacts', 'questionnaire', 'public', 'lead-inquiry.html')),
    server_total_steps: serverTotalSteps,
  },
  cases,
};

process.stdout.write(JSON.stringify(sortKeys(output), null, 2) + '\n');

// A step added to the form without TOTAL_STEPS in api/submit-intake.js makes
// every autosave past step 15 fail with a 400. Say so loudly.
if (output.form_contract.intake_form.step_count !== serverTotalSteps) {
  console.error(
    `payload-snapshot: intake-form.html has ${output.form_contract.intake_form.step_count} steps but api/submit-intake.js TOTAL_STEPS is ${serverTotalSteps}`,
  );
  process.exitCode = 1;
}

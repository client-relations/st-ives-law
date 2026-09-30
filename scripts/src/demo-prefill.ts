/**
 * Pre-fill the intake form for a live demo: one single client, one couple.
 *
 * Create the two leads in the dashboard first (names below), qualify them,
 * then run:
 *
 *   pnpm --filter @workspace/scripts demo:prefill
 *
 * For each lead it writes a complete intake (every step of the form), fills
 * the short Initial Outreach answers if the client has not given them, and
 * moves the form to Pending Intake so the intake link opens with every answer
 * already on screen. No email is sent. The presenter opens the printed link,
 * clicks through the steps and presses Submit.
 *
 * To fill one lead that has another name, give the path and its form id (the
 * lead_id in the intake link). The lead keeps its own name:
 *
 *   pnpm --filter @workspace/scripts demo:prefill single <lead_id>
 *   pnpm --filter @workspace/scripts demo:prefill couple <lead_id>
 *
 * Safe to re-run: it only touches forms that are not yet completed.
 */

import { createClient } from '@supabase/supabase-js';

const SITE = 'https://st-ives-law.vercel.app';

// Checkboxes are stored the way the browser submits them: "on" when ticked,
// absent when not.
const TICK = 'on';

const SINGLE = {
  scenario: 'Single',
  client_name: 'Margaret Hartley',
  client_former_names: 'Margaret Ellen Wilson',
  client_date_of_birth: '1958-04-17',
  client_address: '14 Beulah Road, Norwood SA 5067',
  client_occupation: 'Retired school principal',
  client_state: 'SA',
  client_marital_status: 'Widowed',
  former_partner_exclude: '',
  financial_adviser: 'Peter Lim, Adelaide Wealth Partners',
  governing_jurisdiction: '',

  realestate: [
    { 'Address': '14 Beulah Road, Norwood SA 5067', 'Estimated value': '$1,450,000', 'Tenancy type': 'Sole ownership', 'Mortgage details': 'None' },
    { 'Address': '3/22 Esplanade, Victor Harbor SA 5211', 'Estimated value': '$620,000', 'Tenancy type': 'Sole ownership', 'Mortgage details': '$85,000 with Bank SA' },
  ],
  bank: [
    { 'Bank': 'Commonwealth Bank', 'Account type': 'Savings', 'Held jointly or individually': 'Individual', 'Value': '$48,000' },
    { 'Bank': 'Bank SA', 'Account type': 'Term deposit', 'Held jointly or individually': 'Individual', 'Value': '$120,000' },
  ],
  super: [
    { 'Fund name': 'Australian Retirement Trust', 'Member number': 'ART-4418820', 'Value': '$390,000', 'Nominated beneficiary': 'Thomas Hartley and Claire Hartley equally' },
  ],
  other_assets: 'Share portfolio with CommSec (about $210,000). Life insurance with TAL, $250,000.',

  doc_will: TICK,
  doc_epa: TICK,
  doc_acd: TICK,

  exec_initial_name: 'Thomas Hartley',
  exec_initial_address: '8 Queen Street, Glenelg SA 5045',
  exec_initial_relationship: 'Son',
  exec_backup: 'Claire Hartley',
  exec_further_backup: 'Peter Lim',
  exec_joint: 'Act jointly',
  exec_power_of_sale: TICK,

  exclusion: [
    { 'Name': 'Gregory Wilson', 'Reason': 'Adequately provided for during my lifetime' },
  ],
  no_contest_clause: TICK,

  gift: [
    { 'Item description': 'Gold wristwatch', 'Recipient': 'Thomas Hartley', 'Fallback if recipient predeceases': 'His children' },
    { 'Item description': 'Pearl necklace', 'Recipient': 'Claire Hartley', 'Fallback if recipient predeceases': 'Her children' },
    { 'Item description': '$10,000 cash', 'Recipient': 'Norwood Community Care Inc.', 'Fallback if recipient predeceases': 'Residue' },
  ],

  has_company: 'Yes',
  company_name: 'Hartley Family Investments Pty Ltd',
  company_acn: '123 456 789',
  company_on_death: 'Transfer/sell',
  company_share_treatment: 'Falls into residue',

  has_life_tenancy: 'No',

  // One testamentary trust, so the dashboard's "Will with Testamentary Trust"
  // package has every field it needs.
  fund_count: '1',
  fund1_beneficiary: 'Thomas Hartley',
  fund1_class: 'Thomas Hartley and his children',
  fund1_trustee_initial: 'Thomas Hartley',
  fund1_trustee_backup: 'Claire Hartley',
  fund1_trustee_further: 'Peter Lim',
  fund1_appointor_initial: 'Thomas Hartley',
  fund1_appointor_backup: 'Claire Hartley',
  fund1_appointor_further: 'Peter Lim',
  beneficiary_count: '1',
  personal_belongings_to: 'Named person(s) below',
  personal_belongings_1: 'Thomas Hartley',
  personal_belongings_2: 'Claire Hartley',
  personal_belongings_3: '',
  calamity_count: '2',
  calamity1: 'Norwood Community Care Inc.',
  calamity1_pct: '50',
  calamity2: 'Cancer Council SA',
  calamity2_pct: '50',

  has_sdt: 'No',
  has_minors: 'No',

  organ_donation: 'Available',
  burial_or_cremation: 'Cremation',
  funeral_other: 'A small service at St Bartholomew’s, Norwood, with ashes scattered at Victor Harbor.',

  attorney: [
    { 'Full name': 'Thomas Hartley', 'Address': '8 Queen Street, Glenelg SA 5045' },
    { 'Full name': 'Claire Hartley', 'Address': '27 Fullarton Road, Kent Town SA 5067' },
  ],
  epa_jointly: 'Jointly and severally',
  epa_effective: 'Only upon legal incapacity',
  epa_power_conflict: TICK,
  epa_power_gifts: TICK,
  epa_power_will: TICK,
  epa_power_digital: TICK,
  epa_conditions: 'My attorneys may not sell my home at 14 Beulah Road while I am living in it.',

  sdm: [
    { 'Full name': 'Claire Hartley', 'Date of birth': '09/11/1986', 'Address': '27 Fullarton Road, Kent Town SA 5067', 'Phone': '0412 555 201' },
    { 'Full name': 'Thomas Hartley', 'Date of birth': '22/06/1983', 'Address': '8 Queen Street, Glenelg SA 5045', 'Phone': '0413 555 874' },
  ],
  acd_health_care_refusals: 'If I am in a persistent vegetative state with no reasonable prospect of recovery, I refuse artificial nutrition and hydration.',

  has_low: 'Yes',
  low_wishes: 'I would like my trustees to help my grandchildren with their education costs.',
  signing_date: '2026-10-14',
  will_custody: 'Firm',
  add_to_wills_register: TICK,
};

const COUPLE = {
  scenario: 'Couple',
  client_name: 'James Carter',
  client_former_names: '',
  client_date_of_birth: '1979-08-03',
  client_address: '5 Osmond Terrace, Norwood SA 5067',
  client_occupation: 'Civil engineer',
  client_state: 'SA',
  client_marital_status: 'Married',
  former_partner_exclude: 'Rebecca Owens',
  spouse_name: 'Emily Carter',
  spouse_occupation: 'Pharmacist',
  mirror_or_independent: 'Mirror wills',
  financial_adviser: 'Sophie Nguyen, Nguyen Financial Planning',
  governing_jurisdiction: '',

  realestate: [
    { 'Address': '5 Osmond Terrace, Norwood SA 5067', 'Estimated value': '$1,100,000', 'Tenancy type': 'Joint tenants', 'Mortgage details': '$410,000 with Westpac' },
  ],
  bank: [
    { 'Bank': 'Westpac', 'Account type': 'Offset', 'Held jointly or individually': 'Joint', 'Value': '$65,000' },
    { 'Bank': 'ING', 'Account type': 'Savings', 'Held jointly or individually': 'Joint', 'Value': '$22,000' },
  ],
  super: [
    { 'Fund name': 'AustralianSuper', 'Member number': 'AS-7731902', 'Value': '$285,000', 'Nominated beneficiary': 'Emily Carter' },
    { 'Fund name': 'HESTA', 'Member number': 'HE-5520118', 'Value': '$198,000', 'Nominated beneficiary': 'James Carter' },
  ],
  other_assets: 'Toyota RAV4 (2022). Life insurance through super for each of us.',

  doc_will: TICK,
  doc_epa: TICK,
  doc_acd: TICK,

  exec_initial_name: 'Daniel Carter',
  exec_initial_address: '41 King William Road, Unley SA 5061',
  exec_initial_relationship: 'Brother',
  exec_backup: 'Sophie Nguyen',
  exec_further_backup: 'Laura Bennett',
  exec_joint: 'Sole executor may act at any time',
  exec_power_of_sale: TICK,

  exclusion: [
    { 'Name': 'Rebecca Owens', 'Reason': 'Former partner; property settlement finalised in 2012' },
  ],
  no_contest_clause: TICK,

  gift: [
    { 'Item description': 'Collection of vintage cameras', 'Recipient': 'Oliver Carter', 'Fallback if recipient predeceases': 'Charlotte Carter' },
    { 'Item description': 'Piano', 'Recipient': 'Charlotte Carter', 'Fallback if recipient predeceases': 'Oliver Carter' },
  ],

  has_company: 'No',
  has_life_tenancy: 'No',

  // Residue straight to the children, so the dashboard's "Standard Will"
  // package is the one to generate for the couple.
  fund_count: '0',
  beneficiary_count: '2',
  beneficiary1: 'Oliver Carter',
  beneficiary1_pct: '50',
  beneficiary2: 'Charlotte Carter',
  beneficiary2_pct: '50',
  personal_belongings_to: 'Same as named beneficiaries above',
  calamity_count: '1',
  calamity1: 'Daniel Carter',
  calamity1_pct: '100',

  has_sdt: 'No',

  has_minors: 'Yes',
  guardian_initial: 'Daniel Carter',
  guardian_backup: 'Laura Bennett',

  organ_donation: 'Available',
  burial_or_cremation: 'Burial',
  funeral_other: 'A simple family service; donations to the Women’s and Children’s Hospital in lieu of flowers.',

  attorney: [
    { 'Full name': 'Daniel Carter', 'Address': '41 King William Road, Unley SA 5061' },
    { 'Full name': 'Laura Bennett', 'Address': '9 Rundle Street, Kent Town SA 5067' },
  ],
  epa_jointly: 'Jointly and severally',
  epa_effective: 'Upon execution',
  epa_power_conflict: TICK,
  epa_power_charge: TICK,
  epa_power_will: TICK,
  epa_power_spouse: TICK,
  epa_power_digital: TICK,
  epa_conditions: 'My attorneys must consult my spouse before selling our home at 5 Osmond Terrace.',

  sdm: [
    { 'Full name': 'Daniel Carter', 'Date of birth': '14/02/1976', 'Address': '41 King William Road, Unley SA 5061', 'Phone': '0421 555 330' },
    { 'Full name': 'Laura Bennett', 'Date of birth': '30/09/1981', 'Address': '9 Rundle Street, Kent Town SA 5067', 'Phone': '0433 555 912' },
  ],
  acd_health_care_refusals: 'I refuse cardiopulmonary resuscitation if I have a terminal illness and my treating doctors agree it would not restore a reasonable quality of life.',

  has_low: 'Yes',
  low_wishes: 'We would like the children to attend university before receiving large distributions.',
  signing_date: '2026-10-21',
  will_custody: 'Firm',
  add_to_wills_register: TICK,
};

// The short Initial Outreach form, filled only if the client has not done it.
function inquiryFor(intake: typeof SINGLE | typeof COUPLE, email: string) {
  const couple = intake.scenario === 'Couple';
  return {
    inquiry_reason: 'Put a will or estate plan in place',
    client_name: intake.client_name,
    client_email: email,
    client_phone: couple ? '0400 555 118' : '0400 555 742',
    client_state: 'SA',
    complexity_flags: couple ? 'Planning with a partner' : 'Already have a will',
    asset_flags: couple ? 'Jointly owned property' : 'Property in my name',
    goal: 'Who manages my money and medical decisions if I lose capacity',
    executor_confidence: 'I know exactly who',
    gifts_volume: 'A few',
    funeral_wishes: 'Clear wishes on burial or cremation',
    additional_notes: '',
  };
}

const DEMOS = [
  { label: 'Single', intake: SINGLE },
  { label: 'Couple', intake: COUPLE },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (repo-root .env)');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [path, targetId] = process.argv.slice(2);
  const demos = path ? DEMOS.filter((d) => d.label.toLowerCase() === path.toLowerCase()) : DEMOS;
  if (demos.length === 0) throw new Error(`Unknown path "${path}" — use single or couple`);

  for (const demo of demos) {
    const { label } = demo;
    let query = supabase
      .from('forms')
      .select('id, client_name, client_email, status, form_data, created_at')
      .in('status', ['appointment_sent', 'scheduled', 'pending_intake']);
    query = targetId ? query.eq('id', targetId) : query.ilike('client_name', demo.intake.client_name);
    const { data: forms, error } = await query.order('created_at', { ascending: false }).limit(1);
    if (error) throw error;

    const form = forms?.[0];
    if (!form) {
      console.log(`\n✗ ${label}: no lead ${targetId || `named "${demo.intake.client_name}"`} waiting for intake.`);
      console.log('  Create it with + New Lead and press Qualify, then run this again.');
      continue;
    }

    // A lead picked by id keeps the name the firm gave it.
    const intake = targetId ? { ...demo.intake, client_name: form.client_name } : demo.intake;
    const existing = typeof form.form_data === 'string' ? JSON.parse(form.form_data) : form.form_data || {};
    const hasInquiry = existing.inquiry && Object.keys(existing.inquiry).length > 0;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: {
          ...existing,
          inquiry: hasInquiry ? existing.inquiry : inquiryFor(intake, form.client_email || ''),
          intake,
          // No current_step, so the link opens on step 1 and the presenter
          // can walk through every page.
          metadata: {},
        },
        status: 'pending_intake',
        progress_pct: 0,
        last_accessed: now,
        intake_sent_at: now,
        reminder_3d_sent: null,
        reminder_1w_sent: null,
        reminder_2w_sent: null,
      })
      .eq('id', form.id)
      .eq('status', form.status);
    if (updateError) throw updateError;

    console.log(`\n✓ ${label}: ${form.client_name} (was ${form.status}, now pending_intake)`);
    console.log(`  Intake form: ${SITE}/intake-form?lead_id=${form.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Builds the Make → Clio matter payload from a completed intake form.
// Server-side only (used by api/populate-clio.ts).

// Picklist field mapping: converts text values to Clio option IDs
const PICKLIST_OPTIONS = {
  will_custody: {
    'Firm': 60694,
    'Client': 60697,
    'Executor': 60700,
  },
  funeral_burial_cremation: {
    'Burial': 60703,
    'Cremation': 60706,
    'Not Specified': 60709,
  },
  executor_acting_arrangement: {
    'Jointly': 60712,
    'Joint': 60712,
    'Sole': 60715,
  },
  mirror_or_independent: {
    'Mirror Wills': 60718,
    'Mirror wills': 60718,
    'Independent Wills': 60721,
    'Independent wills': 60721,
  },
};

function mapPicklistValue(fieldName: string, textValue: string): string {
  // Since picklist fields are now text-only in Clio (checkboxes removed),
  // just return the text value as-is
  if (!textValue) return '';
  return textValue;
}

// Formatter functions for clean, readable Clio custom field display
function formatBeneficiaries(beneficiaries: any[]): string {
  if (!beneficiaries || beneficiaries.length === 0) return 'No beneficiaries defined';
  return 'Beneficiaries:\n' + beneficiaries
    .map(b => `• ${b.name} - ${b.percent || 'Equal'}%`)
    .join('\n');
}

function formatSpecificGifts(gifts: any[]): string {
  if (!gifts || gifts.length === 0) return 'No specific gifts defined';
  return 'Specific Gifts:\n' + gifts
    .map(g => `• ${g.item} → ${g.recipient}${g.fallback ? ` (Fallback: ${g.fallback})` : ''}`)
    .join('\n');
}

function formatAssets(assets: any[], type: 'real_estate' | 'bank' | 'super'): string {
  if (!assets || assets.length === 0) return `No ${type.replace('_', ' ')} assets defined`;

  if (type === 'real_estate') {
    return 'Real Estate:\n' + assets
      .map(a => `• ${a.address} (${a.type}) - $${a.value}${a.mortgage ? ` - Mortgage: ${a.mortgage}` : ''}`)
      .join('\n');
  }
  if (type === 'bank') {
    return 'Bank Accounts:\n' + assets
      .map(a => `• ${a.institution} (${a.type}${a.holder ? `, ${a.holder}` : ''}) - $${a.balance}`)
      .join('\n');
  }
  if (type === 'super') {
    return 'Superannuation:\n' + assets
      .map(a => `• ${a.fund_name}${a.member_number ? ` (Member ${a.member_number})` : ''} - $${a.balance}${a.nominated_beneficiary ? ` - Nominated: ${a.nominated_beneficiary}` : ''}`)
      .join('\n');
  }
  return '';
}

function formatEpaAttorneys(attorneys: any[]): string {
  if (!attorneys || attorneys.length === 0) return 'No EPA attorneys appointed';
  return 'EPA Attorneys:\n' + attorneys
    .map(a => `• ${a.name} (${a.relationship || 'Relationship not specified'})`)
    .join('\n');
}

/** Form P2 wants each donee as "Full name, address" on a single line. */
function formatDonee(attorney: { name?: string; address?: string } | undefined): string {
  if (!attorney) return '';
  return [attorney.name, attorney.address].filter((part) => part && String(part).trim()).join(', ');
}

/** The seven single-name fields a testamentary trust fills in the will templates. */
function trustFundTemplateFields(fundNum: 1 | 2, fund: any): Record<string, string> {
  const prefix = `tt${fundNum}_`;
  return {
    [`${prefix}nominated_beneficiary`]: fund?.beneficiary || '',
    [`${prefix}trustee_initial`]: fund?.trustee_initial || '',
    [`${prefix}trustee_backup`]: fund?.trustee_backup || '',
    [`${prefix}trustee_further`]: fund?.trustee_further || '',
    [`${prefix}appointor_initial`]: fund?.appointor_initial || '',
    [`${prefix}appointor_backup`]: fund?.appointor_backup || '',
    [`${prefix}appointor_further`]: fund?.appointor_further || '',
  };
}

function formatDocumentsRequired(docs: any): string {
  const items = [
    docs.will && '• Will',
    docs.epa && '• Enduring Power of Attorney (Financial)',
    docs.acd && '• Advance Care Directive',
    docs.sdt && '• Special Disability Trust',
  ].filter(Boolean);

  return items.length === 0 ? 'No documents selected' : 'Documents Required:\n' + items.join('\n');
}

function formatExclusions(exclusions: any[]): string {
  if (!exclusions || exclusions.length === 0) return 'No exclusions';
  return 'Exclusions:\n' + exclusions
    .map(e => `• ${e.name}${e.reason ? ` - Reason: ${e.reason}` : ''}`)
    .join('\n');
}

function formatCalamityBeneficiaries(calamities: any[]): string {
  if (!calamities || calamities.length === 0) return 'No calamity beneficiaries';
  return 'Calamity Beneficiaries:\n' + calamities
    .map(c => `• ${c.name} - ${c.percent || 'Equal'}%`)
    .join('\n');
}

/**
 * Clio's one-line text custom fields reject anything over 255 characters with
 * a 422, which fails the ENTIRE matter creation - no matter, no contact, and
 * the UI still reports success. Every value written to a custom field must be
 * clamped. 255 is Clio's documented limit; the ellipsis marks truncation so a
 * lawyer can tell the value is incomplete rather than trusting it.
 */
const CLIO_TEXT_FIELD_MAX = 255;

function clampForClio(value: string): string {
  if (typeof value !== 'string' || value.length <= CLIO_TEXT_FIELD_MAX) return value;
  return value.slice(0, CLIO_TEXT_FIELD_MAX - 1) + '…';
}

function formatTrustFund(fundNum: number, fundData: any): string {
  if (!fundData?.beneficiary) return '';
  // Labels deliberately terse: the verbose version reached 261 characters with
  // even short placeholder names, which exceeded Clio's limit and broke the
  // whole sync for any client with a testamentary trust.
  return [
    `Trust Fund ${fundNum}:`,
    `Benef: ${fundData.beneficiary}`,
    `Class: ${fundData.class || 'N/A'}`,
    `Trustee 1: ${fundData.trustee_initial || 'N/A'}`,
    `Trustee 2: ${fundData.trustee_backup || 'N/A'}`,
    `Trustee 3: ${fundData.trustee_further || 'N/A'}`,
    `Appointor 1: ${fundData.appointor_initial || 'N/A'}`,
    `Appointor 2: ${fundData.appointor_backup || 'N/A'}`,
    `Appointor 3: ${fundData.appointor_further || 'N/A'}`,
  ].join('\n');
}

export function buildClioPayload(intakeData: any, form: any, metadata: any) {
  // Parse full name into first and last name
  const fullName = intakeData.client_name || form.client_name || 'Unknown Client';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

  // Parse contact email and phone
  const clientEmail = intakeData.client_email || form.client_email || '';
  const clientPhone = intakeData.client_phone || '';

  // Two values Make writes into Clio's own fields rather than custom fields.
  // Both are optional in Clio and rejected when sent empty, and Make's raw
  // JSON body cannot conditionally omit a key, so each is also sent as a
  // ready-made JSON fragment (key, value and trailing comma, or nothing) that
  // the Make body inserts verbatim.
  const clientDateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(intakeData.client_date_of_birth || '')
    ? intakeData.client_date_of_birth
    : '';
  const responsibleAttorneyId = Number(metadata.responsible_attorney_id) || 0;

  // ===== SCENARIO: Fund Count =====
  const fundCount = parseInt(intakeData.fund_count) || 0;

  // Direct beneficiaries (when fund_count = 0)
  const beneficiaries = fundCount === 0 ? [
    intakeData.beneficiary1 && { name: intakeData.beneficiary1, percent: intakeData.beneficiary1_pct || 0 },
    intakeData.beneficiary2 && { name: intakeData.beneficiary2, percent: intakeData.beneficiary2_pct || 0 },
    intakeData.beneficiary3 && { name: intakeData.beneficiary3, percent: intakeData.beneficiary3_pct || 0 },
  ].filter(Boolean) : [];

  // Trust funds (when fund_count = 1 or 2)
  const trustFund1 = fundCount >= 1 ? {
    beneficiary: intakeData.fund1_beneficiary,
    class: intakeData.fund1_class,
    trustee_initial: intakeData.fund1_trustee_initial,
    trustee_backup: intakeData.fund1_trustee_backup,
    trustee_further: intakeData.fund1_trustee_further,
    appointor_initial: intakeData.fund1_appointor_initial,
    appointor_backup: intakeData.fund1_appointor_backup,
    appointor_further: intakeData.fund1_appointor_further,
  } : null;

  const trustFund2 = fundCount >= 2 ? {
    beneficiary: intakeData.fund2_beneficiary,
    class: intakeData.fund2_class,
    trustee_initial: intakeData.fund2_trustee_initial,
    trustee_backup: intakeData.fund2_trustee_backup,
    trustee_further: intakeData.fund2_trustee_further,
    appointor_initial: intakeData.fund2_appointor_initial,
    appointor_backup: intakeData.fund2_appointor_backup,
    appointor_further: intakeData.fund2_appointor_further,
  } : null;

  // Personal belongings. The will templates give them to Beneficiary1..3 (the
  // "named recipients of Personal Items" clause), so when the residue goes
  // into trusts and there are no residuary beneficiaries, the named recipients
  // the client typed fill those slots instead. When the residue goes directly
  // to named beneficiaries those slots already carry them (the Simple Will
  // uses the same three names for the residue), so separately named
  // recipients are kept in the summary field for the lawyer to place.
  const personalBelongingsNamed =
    intakeData.personal_belongings_to === 'Named person(s) below'
      ? [intakeData.personal_belongings_1, intakeData.personal_belongings_2, intakeData.personal_belongings_3].filter(Boolean)
      : [];
  const personalBelongingsSummary = personalBelongingsNamed.length
    ? `Named: ${personalBelongingsNamed.join(', ')}`
    : intakeData.personal_belongings_to || 'Not specified';
  const beneficiarySlots = fundCount === 0 ? beneficiaries.map((b) => b.name) : personalBelongingsNamed;

  // Calamity beneficiaries
  const calamityBeneficiaries = [
    intakeData.calamity1 && { name: intakeData.calamity1, percent: intakeData.calamity1_pct || 0 },
    intakeData.calamity2 && { name: intakeData.calamity2, percent: intakeData.calamity2_pct || 0 },
    intakeData.calamity3 && { name: intakeData.calamity3, percent: intakeData.calamity3_pct || 0 },
  ].filter(Boolean);

  // ===== ARRAYS: Repeatable Items =====
  const specificGifts = (intakeData.gift || []).map((g: any) => ({
    item: g['Item description'],
    recipient: g['Recipient'],
    fallback: g['Fallback if recipient predeceases'],
  }));

  const realEstate = (intakeData.realestate || []).map((r: any) => ({
    address: r['Address'] || r.address,
    type: r['Tenancy type'] || r.type,
    value: r['Estimated value'] || r.value,
    mortgage: r['Mortgage details'],
  }));

  const bankAccounts = (intakeData.bank || []).map((b: any) => ({
    institution: b['Bank'],
    type: b['Account type'],
    holder: b['Held jointly or individually'],
    balance: b['Value'],
  }));

  const superAccounts = (intakeData.super || []).map((s: any) => ({
    fund_name: s['Fund name'],
    member_number: s['Member number'],
    balance: s['Value'],
    nominated_beneficiary: s['Nominated beneficiary'],
  }));

  const exclusions = (intakeData.exclusion || []).map((e: any) => ({
    name: e['Name'] || e.name,
    reason: e['Reason'] || e.reason,
  }));

  const epaAttorneys = (intakeData.attorney || []).map((a: any) => ({
    name: a['Full name'],
    address: a['Address'],
  }));

  // Advance Care Directive substitute decision-makers. Clio has four fixed
  // slots (AcdSdm1..4 name/dob/address/phone); the form caps the list at four.
  const sdms = (intakeData.sdm || []).slice(0, 4).map((p: any) => ({
    name: p['Full name'] || '',
    dob: p['Date of birth'] || '',
    address: p['Address'] || '',
    phone: p['Phone'] || '',
  }));
  const acdFields: Record<string, string> = {};
  for (let i = 0; i < 4; i++) {
    const p = sdms[i] || { name: '', dob: '', address: '', phone: '' };
    acdFields[`acd_sdm${i + 1}_name`] = p.name;
    acdFields[`acd_sdm${i + 1}_dob`] = p.dob;
    acdFields[`acd_sdm${i + 1}_address`] = p.address;
    acdFields[`acd_sdm${i + 1}_phone`] = p.phone;
  }

  // The EPA form has two 255-character lines for conditions on the attorney's
  // powers; a longer answer continues onto the second line instead of being cut.
  const epaConditions: string = String(intakeData.epa_conditions || '');

  // ===== DOCUMENTS =====
  const docsRequired = {
    will: !!intakeData.doc_will,
    epa: !!intakeData.doc_epa,
    acd: !!intakeData.doc_acd,
    sdt: !!intakeData.doc_sdt,
  };

  // ===== CONDITIONAL BLOCKS =====
  const hasCompany = intakeData.has_company === 'Yes';
  const hasLifeTenancy = intakeData.has_life_tenancy === 'Yes';
  const hasSdt = intakeData.has_sdt === 'Yes';
  const hasMinors = intakeData.has_minors === 'Yes';
  const hasLetterOfWishes = intakeData.has_low === 'Yes';

  // Build company info
  const companyInfo = hasCompany ? `Company: ${intakeData.company_name}\nACN: ${intakeData.company_acn}\nOn Death: ${intakeData.company_on_death}\nShare Treatment: ${intakeData.company_share_treatment}` : '';

  // Build life tenancy info
  const lifeTenancyInfo = hasLifeTenancy ? `Life Tenant: ${intakeData.life_tenant}\nProperty: ${intakeData.life_tenancy_property}\nOutgoings Bearer: ${intakeData.life_tenancy_outgoings}\nBalance Recipient: ${intakeData.life_tenancy_balance}\nSale Power: ${intakeData.life_tenancy_sale_power ? 'Yes' : 'No'}` : '';

  // Build SDT info
  const sdtInfo = hasSdt ? `Mechanism: ${intakeData.sdt_mechanism}\nPrincipal Beneficiary: ${intakeData.sdt_principal_beneficiary}` : '';

  // Build will PDF filename
  const willPdfName = `Will_${form.client_name}_${new Date().toISOString().split('T')[0]}.pdf`;

  // ===== BUILD PAYLOAD =====
  const payload: any = {
    // Client Info (for Clio Contact)
    client_first_name: firstName,
    client_last_name: lastName,
    client_email: clientEmail,
    client_phone: clientPhone,
    client_date_of_birth: clientDateOfBirth,
    client_date_of_birth_json: clientDateOfBirth ? `"date_of_birth": "${clientDateOfBirth}",` : '',
    client_address: intakeData.client_address,
    client_city: intakeData.client_city || '',
    client_state: intakeData.client_state,
    client_postcode: intakeData.client_postcode || '',
    client_occupation: intakeData.client_occupation || '',
    client_marital_status: intakeData.client_marital_status || '',
    client_former_names: intakeData.client_former_names || '',

    // Scenario & Spouse Info
    scenario: intakeData.scenario,
    spouse_name: intakeData.scenario === 'Couple' ? intakeData.spouse_name : '',
    spouse_occupation: intakeData.scenario === 'Couple' ? intakeData.spouse_occupation : '',
    mirror_or_independent: intakeData.scenario === 'Couple' ? mapPicklistValue('mirror_or_independent', intakeData.mirror_or_independent) : '',

    // Matter Info
    person_responsible: form.person_responsible,
    // Clio user id of the person responsible, looked up by populate-clio when
    // the Clio app may read users. Sets the matter's own responsible attorney,
    // which the Advance Care Directive prints as the witnessing solicitor.
    responsible_attorney_id: responsibleAttorneyId ? String(responsibleAttorneyId) : '',
    responsible_attorney_json: responsibleAttorneyId ? `"responsible_attorney": { "id": ${responsibleAttorneyId} },` : '',
    inquiry_reason: intakeData.inquiry_reason,
    lead_type: form.lead_type,
    region: form.region,

    // Documents
    documents_required: formatDocumentsRequired(docsRequired),

    // BENEFICIARIES: Scenario 1 (Direct) or Scenario 2 (Trust Funds)
    trust_fund_structure: fundCount === 0 ? 'Direct Beneficiaries' : `${fundCount} Trust Fund${fundCount > 1 ? 's' : ''}`,
    beneficiaries: fundCount === 0 ? formatBeneficiaries(beneficiaries) : 'N/A (Using Trust Funds)',
    trust_fund_1: fundCount >= 1 ? formatTrustFund(1, trustFund1) : '',
    trust_fund_2: fundCount >= 2 ? formatTrustFund(2, trustFund2) : '',
    foreign_persons_excluded: fundCount > 0 ? (intakeData.fpe_trust ? 'Yes' : 'No') : 'N/A',

    // Whether personal belongings follow the named beneficiaries or pass to
    // the client's children. Collected on the intake form (step 9) and a real
    // testamentary instruction — previously dropped before reaching Clio.
    personal_belongings_to: personalBelongingsSummary,

    // Calamity Beneficiaries
    calamity_beneficiaries: formatCalamityBeneficiaries(calamityBeneficiaries),

    // Assets
    specific_gifts: formatSpecificGifts(specificGifts),
    assets_real_estate: formatAssets(realEstate, 'real_estate'),
    assets_bank: formatAssets(bankAccounts, 'bank'),
    assets_super: formatAssets(superAccounts, 'super'),
    other_assets: intakeData.other_assets || 'None listed',

    // Exclusions
    exclusions: formatExclusions(exclusions),
    no_contest_clause: intakeData.no_contest_clause ? 'Yes' : 'No',

    // Executors
    executor_primary_name: intakeData.exec_initial_name,
    executor_primary_address: intakeData.exec_initial_address || '',
    executor_primary_relationship: intakeData.exec_initial_relationship || '',
    executor_backup_name: intakeData.exec_backup || '',
    executor_tertiary_name: intakeData.exec_further_backup || '',
    executor_acting_arrangement: mapPicklistValue('executor_acting_arrangement', intakeData.exec_joint?.includes('jointly') ? 'Jointly' : 'Sole'),
    executor_power_of_sale: intakeData.exec_power_of_sale ? 'Yes' : 'No',

    // Conditional: Company
    has_company: hasCompany ? 'Yes' : 'No',
    company_info: companyInfo,

    // Conditional: Life Tenancy
    has_life_tenancy: hasLifeTenancy ? 'Yes' : 'No',
    life_tenancy_info: lifeTenancyInfo,

    // Conditional: SDT
    has_special_disability_trust: hasSdt ? 'Yes' : 'No',
    sdt_info: sdtInfo,

    // Conditional: Guardianship
    has_minors: hasMinors ? 'Yes' : 'No',
    guardian_primary: hasMinors ? (intakeData.guardian_initial || '') : '',
    guardian_backup: hasMinors ? (intakeData.guardian_backup || '') : '',

    // EPA
    epa_attorneys: formatEpaAttorneys(epaAttorneys),
    epa_acting_arrangement: intakeData.epa_jointly || '',
    epa_effective: intakeData.epa_effective || '',
    epa_power_conflict: intakeData.epa_power_conflict ? 'Yes' : 'No',
    epa_power_charge: intakeData.epa_power_charge ? 'Yes' : 'No',
    epa_power_gifts: intakeData.epa_power_gifts ? 'Yes' : 'No',
    epa_power_will: intakeData.epa_power_will ? 'Yes' : 'No',
    epa_power_spouse: intakeData.epa_power_spouse ? 'Yes' : 'No',
    epa_power_digital: intakeData.epa_power_digital ? 'Yes' : 'No',

    // Funeral Wishes
    funeral_organ_donation: intakeData.organ_donation || '',
    funeral_burial_cremation: mapPicklistValue('funeral_burial_cremation', intakeData.burial_or_cremation || ''),
    funeral_other: intakeData.funeral_other || '',

    // Conditional: Letter of Wishes
    has_letter_of_wishes: hasLetterOfWishes ? 'Yes' : 'No',
    letter_of_wishes: hasLetterOfWishes ? (intakeData.low_wishes || '') : '',

    // Will Custody & Admin
    signing_date: intakeData.signing_date || '',
    will_custody: mapPicklistValue('will_custody', intakeData.will_custody || ''),
    add_to_wills_register: intakeData.add_to_wills_register ? 'Yes' : 'No',

    // Administrative
    financial_adviser: intakeData.financial_adviser || '',
    governing_jurisdiction: intakeData.governing_jurisdiction || intakeData.client_state || '',
    former_partner_exclude: intakeData.former_partner_exclude || '',

    // Will Document Info
    will_pdf_path: metadata.will_pdf_path,
    will_pdf_name: willPdfName,

    // ===== TEMPLATE FIELDS: one value per Clio field =====
    //
    // The keys above hold readable summaries — a bulleted beneficiary list, a
    // whole trust fund block — for a lawyer skimming the matter. Make used to
    // map those same summaries into the fields the will templates read, so a
    // generated will printed "Beneficiaries: • Jane - 50%" where one person's
    // name belongs, and every trustee and appointor line stayed blank.
    //
    // These carry exactly one name each. Make maps them to the PascalCase
    // fields (Beneficiary1, InitialTrusteeTt1, EpaDonee...), and the summaries
    // go to fields of their own. Percentages are deliberately absent: the
    // templates leave "[insert %]" for the lawyer, and the summaries keep them.
    beneficiary_1_name: beneficiarySlots[0] || '',
    beneficiary_2_name: beneficiarySlots[1] || '',
    beneficiary_3_name: beneficiarySlots[2] || '',
    calamity_beneficiary_1_name: calamityBeneficiaries[0]?.name || '',
    calamity_beneficiary_2_name: calamityBeneficiaries[1]?.name || '',
    calamity_beneficiary_3_name: calamityBeneficiaries[2]?.name || '',
    ...trustFundTemplateFields(1, trustFund1),
    ...trustFundTemplateFields(2, trustFund2),
    // The form labels these "Attorney(s) / Donee(s)"; Form P2 asks for each
    // donee's full name and address on one line.
    epa_donee_1: formatDonee(epaAttorneys[0]),
    epa_donee_2: formatDonee(epaAttorneys[1]),
    // Both slots sit in capitals on the statutory form ("... JOINTLY AND
    // SEVERALLY TO BE MY ATTORNEY(S)"), so the client's choice is set to match.
    epa_donee_capacity: (intakeData.epa_jointly || '').toUpperCase(),
    epa_commencement: (intakeData.epa_effective || '').toUpperCase(),
    epa_conditions: epaConditions.slice(0, CLIO_TEXT_FIELD_MAX),
    epa_conditions_continued: epaConditions.slice(CLIO_TEXT_FIELD_MAX, CLIO_TEXT_FIELD_MAX * 2),

    // Advance Care Directive (Clio: AcdSdm1..4 + AcdHealthCareRefusals).
    ...acdFields,
    acd_health_care_refusals: intakeData.acd_health_care_refusals || '',

    // The beneficiary summary, percentages included, now that Beneficiary1
    // holds a name. Make has always mapped this key; nothing sent it before.
    beneficiaries_direct: fundCount === 0 ? formatBeneficiaries(beneficiaries) : '',

    // Meta
    form_id: form.id,
    submission_date: form.created_at,
  };

  // Final safety net: clamp every string to Clio's 255-character limit. One
  // oversized value 422s the whole request, so no matter is created at all -
  // losing one field's tail is far better than losing the entire client record.
  for (const key of Object.keys(payload)) {
    const original = payload[key];
    if (typeof original === 'string') {
      const clamped = clampForClio(original);
      if (clamped !== original) {
        console.warn(`[CLIO] "${key}" exceeded ${CLIO_TEXT_FIELD_MAX} chars (${original.length}) and was truncated.`);
        payload[key] = clamped;
      }
    }
  }

  return payload;
}

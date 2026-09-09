// Validation utility for intake form
// Returns array of missing required fields

export function validateIntakeForm(data) {
  const missing = [];

  // Step 1: Scenario & Client Details (required)
  if (!data.client_name) missing.push('client_name');
  if (!data.client_address) missing.push('client_address');
  if (!data.client_state) missing.push('client_state');
  if (!data.client_marital_status) missing.push('client_marital_status');

  // If Couple scenario, spouse name required
  if (data.scenario === 'Couple' && !data.spouse_name) {
    missing.push('spouse_name');
  }

  // Step 3: Document Type (at least one required)
  const hasDocType = data.doc_will || data.doc_epa || data.doc_acd || data.doc_sdt;
  if (!hasDocType) {
    missing.push('doc_type_selection');
  }

  // Step 4: Executor (required)
  if (!data.exec_initial_name) missing.push('exec_initial_name');
  if (!data.exec_joint) missing.push('exec_joint');

  // Step 9: Residuary Estate
  if (data.fund_count === '0' || data.fund_count === 0) {
    // Direct beneficiary distribution
    if (!data.beneficiary1) missing.push('beneficiary1');
  } else if (data.fund_count === '1' || data.fund_count === 1) {
    // Single trust fund
    if (!data.fund1_beneficiary) missing.push('fund1_beneficiary');
    if (!data.fund1_trustee_initial) missing.push('fund1_trustee_initial');
  } else if (data.fund_count === '2' || data.fund_count === 2) {
    // Multi trust funds
    if (!data.fund1_beneficiary) missing.push('fund1_beneficiary');
    if (!data.fund1_trustee_initial) missing.push('fund1_trustee_initial');
    if (!data.fund2_beneficiary) missing.push('fund2_beneficiary');
    if (!data.fund2_trustee_initial) missing.push('fund2_trustee_initial');
  }

  // Step 12: Funeral Wishes (required)
  if (!data.organ_donation) missing.push('organ_donation');
  if (!data.burial_or_cremation) missing.push('burial_or_cremation');

  // Step 13: EPA Effective (required)
  if (!data.epa_effective) missing.push('epa_effective');

  // Step 14: Will Custody (required)
  if (!data.will_custody) missing.push('will_custody');

  // Step 10: Special Disability Trust
  if (data.has_sdt === 'Yes') {
    if (!data.sdt_mechanism) missing.push('sdt_mechanism');
    if (!data.sdt_principal_beneficiary) missing.push('sdt_principal_beneficiary');
  }

  // Step 11: Guardianship
  if (data.has_minors === 'Yes') {
    if (!data.guardian_initial) missing.push('guardian_initial');
  }

  return {
    missing_fields: missing,
    has_errors: missing.length > 0,
    completion_pct: Math.round(((20 - missing.length) / 20) * 100), // rough estimate
  };
}

// Format missing fields for email/display
export function formatMissingFields(missingArray) {
  const fieldLabels = {
    client_name: 'Full legal name',
    client_address: 'Residential address',
    client_state: 'State/Territory of residence',
    client_marital_status: 'Marital/relationship status',
    spouse_name: 'Spouse/partner full legal name',
    doc_type_selection: 'Select at least one document type (Will, EPA, Advance Care Directive, SDT)',
    exec_initial_name: 'Initial executor full name',
    exec_joint: 'Executor acting arrangement (jointly or sole)',
    beneficiary1: 'Primary beneficiary name',
    fund1_beneficiary: 'Trust Fund 1 nominated beneficiary',
    fund1_trustee_initial: 'Trust Fund 1 initial trustee',
    fund2_beneficiary: 'Trust Fund 2 nominated beneficiary',
    fund2_trustee_initial: 'Trust Fund 2 initial trustee',
    organ_donation: 'Organ donation preference',
    burial_or_cremation: 'Burial or cremation preference',
    epa_effective: 'EPA effective date (upon execution or incapacity)',
    will_custody: 'Where executed Will should be lodged',
    sdt_mechanism: 'Special Disability Trust mechanism',
    sdt_principal_beneficiary: 'SDT principal beneficiary name',
    guardian_initial: 'Initial guardian for minor children',
  };

  return missingArray
    .map(field => fieldLabels[field] || field)
    .filter(Boolean);
}

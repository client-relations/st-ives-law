// Missing-field check for the "send back for completion" email.
// Moved from the dashboard bundle so the payload is built server-side from the stored form.

// Field name mapping for user-friendly messages (matching actual form field names)
const FIELD_LABELS = {
  'scenario': 'Planning Scenario (Single/Couple)',
  'client_name': 'Client Name',
  'client_address': 'Client Address',
  'client_state': 'State/Territory',
  'client_marital_status': 'Marital Status',
  'client_occupation': 'Occupation',
  'client_former_names': 'Former Names',
  'spouse_name': 'Spouse Name',
  'spouse_occupation': 'Spouse Occupation',
  'mirror_or_independent': 'Mirror or Independent Wills',
  'financial_adviser': 'Financial Adviser Name',
  'governing_jurisdiction': 'Governing Jurisdiction',
  'realestate': 'Real Estate Assets',
  'bank': 'Bank/Financial Accounts',
  'super': 'Superannuation Details',
  'other_assets': 'Other Assets',
  'doc_will': 'Document: Will',
  'doc_epa': 'Document: Enduring Power of Attorney',
  'exec_initial_name': 'Initial Executor Name',
  'exec_initial_address': 'Initial Executor Address',
  'exec_initial_relationship': 'Initial Executor Relationship',
  'exec_backup': 'Backup Executor Name',
  'exec_further_backup': 'Further Backup Executor Name',
  'exec_joint': 'Executor Acting Arrangement',
  'exec_power_of_sale': 'Executor Power of Sale',
  'exclusion': 'Exclusions from Estate',
  'no_contest_clause': 'No-Contest Clause',
  'gift': 'Specific Gifts',
  'company_name': 'Company Name',
  'company_acn': 'Company ACN',
  'company_on_death': 'Company Treatment on Death',
  'company_share_treatment': 'Company Share Treatment',
  'life_tenant': 'Life Tenant Name',
  'life_tenancy_property': 'Life Tenancy Property',
  'life_tenancy_outgoings': 'Life Tenancy Outgoings',
  'life_tenancy_balance': 'Life Tenancy Balance',
  'beneficiary1': 'Beneficiary 1 Name',
  'beneficiary1_pct': 'Beneficiary 1 Percentage',
  'beneficiary2': 'Beneficiary 2 Name',
  'beneficiary2_pct': 'Beneficiary 2 Percentage',
  'beneficiary3': 'Beneficiary 3 Name',
  'beneficiary3_pct': 'Beneficiary 3 Percentage',
  'calamity1': 'Calamity Beneficiary 1',
  'calamity1_pct': 'Calamity Beneficiary 1 Percentage',
  'sdt_mechanism': 'Special Disability Trust Mechanism',
  'sdt_principal_beneficiary': 'Special Disability Trust Principal',
  'guardian_initial': 'Primary Guardian',
  'guardian_backup': 'Backup Guardian',
  'organ_donation': 'Organ Donation Preferences',
  'burial_or_cremation': 'Burial or Cremation Preference',
  'funeral_other': 'Other Funeral Wishes',
  'epa_jointly': 'EPA Acting Arrangement',
  'epa_effective': 'EPA Effectiveness',
  'signing_date': 'Document Signing Date',
  'will_custody': 'Will Storage Location',
  'low_wishes': 'Letter of Wishes Content'
};

export function generateMissingFieldsMessage(missingFields) {
  if (missingFields.length === 0) {
    return 'All required fields are complete.';
  }

  const missingLabels = missingFields.map(field => FIELD_LABELS[field] || field);
  const groupedByCategory = missingLabels.reduce((acc, label) => {
    const category = label.split(':')[0].trim();
    if (!acc[category]) acc[category] = [];
    acc[category].push(label);
    return acc;
  }, {});

  let message = `The following ${missingFields.length} field(s) need to be completed:\n\n`;
  Object.entries(groupedByCategory).forEach(([category, fields]) => {
    message += `${category}:\n`;
    fields.forEach(field => {
      message += `  • ${field}\n`;
    });
    message += '\n';
  });

  return message;
}

export function validateIntakeForm(intakeData) {
  const missingFields = [];

  // Always check these core fields (matching actual form field names)
  const alwaysCheck = [
    'scenario', 'client_name', 'client_address', 'client_state', 'client_marital_status',
    'client_occupation', 'financial_adviser', 'governing_jurisdiction',
    'doc_will', 'doc_epa',
    'exec_initial_name', 'exec_initial_address', 'exec_initial_relationship',
    'exec_backup', 'exec_further_backup', 'exec_joint',
    'exec_power_of_sale', 'no_contest_clause',
    'beneficiary1', 'beneficiary1_pct',
    'organ_donation', 'burial_or_cremation',
    'epa_jointly', 'epa_effective',
    'signing_date', 'will_custody'
  ];

  // Conditional fields based on scenario/responses
  const conditionalFields = {
    'Couple': ['spouse_name', 'spouse_occupation', 'mirror_or_independent'],
    'has_company_yes': ['company_name', 'company_acn', 'company_on_death', 'company_share_treatment'],
    'has_life_tenancy_yes': ['life_tenant', 'life_tenancy_property', 'life_tenancy_outgoings', 'life_tenancy_balance'],
    'has_sdt_yes': ['sdt_mechanism', 'sdt_principal_beneficiary'],
    'has_minors_yes': ['guardian_initial', 'guardian_backup'],
    'has_low_yes': ['low_wishes'],
  };

  // Build the fields to check based on actual data
  let fieldsToCheck = [...alwaysCheck];

  // If scenario is Couple, add spouse fields
  if (intakeData.scenario === 'Couple') {
    fieldsToCheck.push(...conditionalFields['Couple']);
  }

  // Add conditional fields based on yes/no answers
  if (intakeData.has_company === true || intakeData.has_company === 'Yes') {
    fieldsToCheck.push(...conditionalFields['has_company_yes']);
  }
  if (intakeData.has_life_tenancy === true || intakeData.has_life_tenancy === 'Yes') {
    fieldsToCheck.push(...conditionalFields['has_life_tenancy_yes']);
  }
  if (intakeData.has_sdt === true || intakeData.has_sdt === 'Yes') {
    fieldsToCheck.push(...conditionalFields['has_sdt_yes']);
  }
  if (intakeData.has_minors === true || intakeData.has_minors === 'Yes') {
    fieldsToCheck.push(...conditionalFields['has_minors_yes']);
  }
  if (intakeData.has_low === true || intakeData.has_low === 'Yes') {
    fieldsToCheck.push(...conditionalFields['has_low_yes']);
  }

  // Check all collected fields
  fieldsToCheck.forEach(field => {
    const value = intakeData[field];
    // Consider field empty if: null, undefined, empty string, empty array, false (for checkboxes)
    if (value === null || value === undefined || value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'boolean' && !value)) {
      missingFields.push(field);
    }
  });

  return {
    missingFields,
    hasData: missingFields.length < fieldsToCheck.length
  };
}

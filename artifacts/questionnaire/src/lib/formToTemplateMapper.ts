// Map form data (from Make webhook structure) to template variables
// This stays separate from the webhook payload - no modifications to Make integration

export interface FormData {
  // Client info
  client_1?: {
    first?: string;
    middle?: string;
    last?: string;
    address?: string;
  };
  client_2?: {
    first?: string;
    middle?: string;
    last?: string;
    address?: string;
  };
  // Arrays from webhook
  executors?: Array<{ first?: string; middle?: string; last?: string }>;
  guardians?: Array<{ first?: string; middle?: string; last?: string }>;
  // Beneficiary profiles
  beneficiary_profiles?: Record<string, any>;
  // Scenario and jurisdiction
  engagement?: {
    state?: string;
  };
  // Direct fields (if available)
  [key: string]: any;
}

export interface TemplateVariables {
  client_name: string;
  spouse_name?: string;
  client_address: string;
  exec_initial_name?: string;
  exec_backup?: string;
  exec_further_backup?: string;
  guardian_initial?: string;
  guardian_backup?: string;
  beneficiary1?: string;
  beneficiary2?: string;
  beneficiary3?: string;
  calamity1?: string;
  calamity2?: string;
  calamity3?: string;
  governing_jurisdiction?: string;
  form_id?: string;
  lawyer_initials?: string;
  // TT1 fields (Testamentary Trust 1)
  initial_appointor_tt1?: string;
  backup_appointor_tt1?: string;
  further_backup_appointor_tt1?: string;
  initial_trustee_tt1?: string;
  backup_trustee_tt1?: string;
  further_backup_trustee_tt1?: string;
  nominated_beneficiary_tt1?: string;
  // TT2 fields (Testamentary Trust 2 - for Multi TT Will)
  initial_appointor_tt2?: string;
  backup_appointor_tt2?: string;
  further_backup_appointor_tt2?: string;
  initial_trustee_tt2?: string;
  backup_trustee_tt2?: string;
  further_backup_trustee_tt2?: string;
  nominated_beneficiary_tt2?: string;
}

function formatPersonName(person: any): string {
  if (!person) return '';
  const parts = [person.first || '', person.middle || '', person.last || '']
    .filter(Boolean);
  return parts.join(' ').trim();
}

export function mapFormDataToTemplate(formData: any, formId: string): TemplateVariables {
  // Handle multiple input structures
  // Priority: full form object with intake > just intake object > webhook structure
  let intake: any = null;

  // Check if this is the full form object with intake property
  if (formData?.intake && typeof formData.intake === 'object') {
    intake = formData.intake;
  }
  // Check if this IS the intake object directly (has expected intake properties)
  else if (formData?.client_name || formData?.exec_initial_name || formData?.fund1_trustee_initial) {
    intake = formData;
  }
  // Otherwise treat as webhook structure
  else {
    intake = formData;
  }

  // Extract all fields from intake/formData
  const clientName = intake?.client_name || '';
  const spouseName = intake?.spouse_name || '';
  const clientAddress = intake?.client_address || '';
  const guardianInitial = intake?.guardian_initial || '';
  const guardianBackup = intake?.guardian_backup || '';
  const jurisdiction = (intake?.governing_jurisdiction && intake.governing_jurisdiction.trim())
    ? intake.governing_jurisdiction
    : (intake?.client_state || 'VIC');

  // Executors (for Simple Will)
  const execInitialName = intake?.exec_initial_name || '';
  const execBackup = intake?.exec_backup || '';
  const execFurtherBackup = intake?.exec_further_backup || '';

  // Beneficiaries (for Simple Will)
  const beneficiary1 = intake?.beneficiary1 || '';
  const beneficiary2 = intake?.beneficiary2 || '';
  const beneficiary3 = intake?.beneficiary3 || '';
  const calamity1 = intake?.calamity1 || '';
  const calamity2 = intake?.calamity2 || '';
  const calamity3 = intake?.calamity3 || '';

  // Testamentary Trust 1 fields (for Single TT Will)
  const appointorTt1Initial = intake?.fund1_appointor_initial || '';
  const appointorTt1Backup = intake?.fund1_appointor_backup || '';
  const appointorTt1Further = intake?.fund1_appointor_further || '';
  const trusteeTt1Initial = intake?.fund1_trustee_initial || '';
  const trusteeTt1Backup = intake?.fund1_trustee_backup || '';
  const trusteeTt1Further = intake?.fund1_trustee_further || '';
  const beneficiaryTt1 = intake?.fund1_beneficiary || '';

  // Testamentary Trust 2 fields (for Multi TT Will)
  const appointorTt2Initial = intake?.fund2_appointor_initial || '';
  const appointorTt2Backup = intake?.fund2_appointor_backup || '';
  const appointorTt2Further = intake?.fund2_appointor_further || '';
  const trusteeTt2Initial = intake?.fund2_trustee_initial || '';
  const trusteeTt2Backup = intake?.fund2_trustee_backup || '';
  const trusteeTt2Further = intake?.fund2_trustee_further || '';
  const beneficiaryTt2 = intake?.fund2_beneficiary || '';

  return {
    client_name: clientName,
    spouse_name: spouseName,
    client_address: clientAddress,
    exec_initial_name: execInitialName,
    exec_backup: execBackup,
    exec_further_backup: execFurtherBackup,
    guardian_initial: guardianInitial,
    guardian_backup: guardianBackup,
    beneficiary1: beneficiary1,
    beneficiary2: beneficiary2,
    beneficiary3: beneficiary3,
    calamity1: calamity1,
    calamity2: calamity2,
    calamity3: calamity3,
    governing_jurisdiction: jurisdiction,
    form_id: formId,
    lawyer_initials: 'SA',
    initial_appointor_tt1: appointorTt1Initial,
    backup_appointor_tt1: appointorTt1Backup,
    further_backup_appointor_tt1: appointorTt1Further,
    initial_trustee_tt1: trusteeTt1Initial,
    backup_trustee_tt1: trusteeTt1Backup,
    further_backup_trustee_tt1: trusteeTt1Further,
    nominated_beneficiary_tt1: beneficiaryTt1,
    initial_appointor_tt2: appointorTt2Initial,
    backup_appointor_tt2: appointorTt2Backup,
    further_backup_appointor_tt2: appointorTt2Further,
    initial_trustee_tt2: trusteeTt2Initial,
    backup_trustee_tt2: trusteeTt2Backup,
    further_backup_trustee_tt2: trusteeTt2Further,
    nominated_beneficiary_tt2: beneficiaryTt2,
  };
}

function extractBeneficiaryNames(beneficiariesText: string): string[] {
  // Parse "Beneficiaries:\n• beneficiary 1 - 90%\n• beneficiary 2 - 10%"
  if (!beneficiariesText || beneficiariesText === 'No beneficiaries defined') return [];
  const lines = beneficiariesText.split('\n').slice(1); // Skip "Beneficiaries:" header
  return lines
    .map(line => {
      const match = line.match(/•\s*([^-]+)\s*-/);
      return match ? match[1].trim() : '';
    })
    .filter(Boolean);
}

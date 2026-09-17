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
  // TT1 fields (from distribution scenarios)
  initial_appointor_tt1?: string;
  backup_appointor_tt1?: string;
  further_backup_appointor_tt1?: string;
  initial_trustee_tt1?: string;
  backup_trustee_tt1?: string;
  further_backup_trustee_tt1?: string;
  nominated_beneficiary_tt1?: string;
}

function formatPersonName(person: any): string {
  if (!person) return '';
  const parts = [person.first || '', person.middle || '', person.last || '']
    .filter(Boolean);
  return parts.join(' ').trim();
}

export function mapFormDataToTemplate(formData: any, formId: string): TemplateVariables {
  // Handle both Supabase nested structure and webhook flat structure
  let clientName = '';
  let spouseName = '';
  let clientAddress = '';
  let guardianInitial = '';
  let guardianBackup = '';
  let jurisdiction = '';
  let appointorTt1Initial = '';
  let appointorTt1Backup = '';
  let appointorTt1Further = '';
  let trusteeTt1Initial = '';
  let trusteeTt1Backup = '';
  let trusteeTt1Further = '';
  let beneficiaryTt1 = '';

  // Check if this is Supabase nested structure (has intake/inquiry objects)
  if (formData.intake) {
    // Supabase nested structure - priority mapping
    const intake = formData.intake;
    clientName = intake.client_name || '';
    spouseName = intake.spouse_name || '';
    clientAddress = intake.client_address || '';
    guardianInitial = intake.guardian_initial || '';
    guardianBackup = intake.guardian_backup || '';
    jurisdiction = intake.governing_jurisdiction || intake.client_state || '';

    // Testamentary Trust 1 fields (appointors, trustees, beneficiary)
    appointorTt1Initial = intake.fund1_appointor_initial || '';
    appointorTt1Backup = intake.fund1_appointor_backup || '';
    appointorTt1Further = intake.fund1_appointor_further || '';
    trusteeTt1Initial = intake.fund1_trustee_initial || '';
    trusteeTt1Backup = intake.fund1_trustee_backup || '';
    trusteeTt1Further = intake.fund1_trustee_further || '';
    beneficiaryTt1 = intake.fund1_beneficiary || '';
  } else {
    // Webhook flat structure (fallback from Make.com)
    clientName = `${formData.client_first_name || ''} ${formData.client_last_name || ''}`.trim();
    spouseName = formData.spouse_name || '';
    clientAddress = formData.client_address || '';
    guardianInitial = formData.guardian_primary || '';
    guardianBackup = formData.guardian_backup || '';
    jurisdiction = formData.client_state || '';
  }

  return {
    client_name: clientName,
    spouse_name: spouseName,
    client_address: clientAddress,
    exec_initial_name: '',  // Not used in current template
    exec_backup: '',        // Not used in current template
    exec_further_backup: '',  // Not used in current template
    guardian_initial: guardianInitial,
    guardian_backup: guardianBackup,
    beneficiary1: '',  // Not used - use TT1 beneficiary instead
    beneficiary2: '',
    beneficiary3: '',
    calamity1: '',
    calamity2: '',
    calamity3: '',
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

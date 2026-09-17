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
  let execInitial = '';
  let execBackup = '';
  let execFurther = '';
  let guardianInitial = '';
  let guardianBackup = '';
  let beneficiary1 = '';
  let beneficiary2 = '';
  let beneficiary3 = '';
  let jurisdiction = '';

  // Check if this is Supabase nested structure (has intake/inquiry objects)
  if (formData.intake) {
    // Supabase nested structure
    const intake = formData.intake;
    clientName = intake.client_name || '';
    spouseName = intake.spouse_name || '';
    clientAddress = intake.client_address || '';
    execInitial = intake.exec_initial_name || '';
    execBackup = intake.exec_backup || '';
    execFurther = intake.exec_further_backup || '';
    guardianInitial = intake.guardian_initial || '';
    guardianBackup = intake.guardian_backup || '';
    beneficiary1 = intake.beneficiary1 || '';
    beneficiary2 = intake.beneficiary2 || '';
    beneficiary3 = intake.beneficiary3 || '';
    // Use governing_jurisdiction if filled, otherwise fall back to client_state
    jurisdiction = intake.governing_jurisdiction || intake.client_state || '';
  } else {
    // Webhook flat structure (fallback)
    clientName = `${formData.client_first_name || ''} ${formData.client_last_name || ''}`.trim();
    spouseName = formData.spouse_name || '';
    clientAddress = formData.client_address || '';
    execInitial = formData.executor_primary_name || '';
    execBackup = formData.executor_backup_name || '';
    execFurther = formData.executor_tertiary_name || '';
    guardianInitial = formData.guardian_primary || '';
    guardianBackup = formData.guardian_backup || '';
    // Parse beneficiaries from text format if available
    const beneNames = extractBeneficiaryNames(formData.beneficiaries || '');
    beneficiary1 = beneNames[0] || '';
    beneficiary2 = beneNames[1] || '';
    beneficiary3 = beneNames[2] || '';
    jurisdiction = formData.client_state || '';
  }

  return {
    client_name: clientName,
    client_address: clientAddress,
    exec_initial_name: execInitial,
    exec_backup: execBackup,
    exec_further_backup: execFurther,
    guardian_initial: guardianInitial,
    guardian_backup: guardianBackup,
    beneficiary1: beneficiary1,
    beneficiary2: beneficiary2,
    beneficiary3: beneficiary3,
    calamity1: '',  // TODO: extract from intake.calamity1 when available
    calamity2: '',  // TODO: extract from intake.calamity2 when available
    calamity3: '',  // TODO: extract from intake.calamity3 when available
    governing_jurisdiction: jurisdiction,
    form_id: formId,
    lawyer_initials: 'SA',
    initial_appointor_tt1: '',  // TODO: extract from intake.fund1_appointor_initial when available
    backup_appointor_tt1: '',   // TODO: extract from intake.fund1_appointor_backup when available
    further_backup_appointor_tt1: '', // TODO: extract from intake.fund1_appointor_further when available
    initial_trustee_tt1: '',    // TODO: extract from intake.fund1_trustee_initial when available
    backup_trustee_tt1: '',     // TODO: extract from intake.fund1_trustee_backup when available
    further_backup_trustee_tt1: '', // TODO: extract from intake.fund1_trustee_further when available
    nominated_beneficiary_tt1: '', // TODO: extract from intake.fund1_beneficiary when available
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

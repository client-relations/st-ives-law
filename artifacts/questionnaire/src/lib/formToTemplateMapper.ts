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

export function mapFormDataToTemplate(formData: FormData, formId: string): TemplateVariables {
  // Get client name and address (prefer client_1)
  const client = formData.client_1 || formData.client_2 || {};
  const clientName = formatPersonName(client);
  const clientAddress = client.address || '';

  // Extract executors from array (webhook structure)
  const executors = formData.executors || [];
  const execInitial = executors[0] ? formatPersonName(executors[0]) : '';
  const execBackup = executors[1] ? formatPersonName(executors[1]) : '';
  const execFurther = executors[2] ? formatPersonName(executors[2]) : '';

  // Extract guardians from array
  const guardians = formData.guardians || [];
  const guardianInitial = guardians[0] ? formatPersonName(guardians[0]) : '';
  const guardianBackup = guardians[1] ? formatPersonName(guardians[1]) : '';

  // Extract beneficiaries from profiles (structure depends on form)
  // For now, try common patterns
  const beneProfiles = formData.beneficiary_profiles || {};
  const beneNames = Object.values(beneProfiles)
    .map((b: any) => formatPersonName(b))
    .filter(Boolean);

  // Get jurisdiction from engagement state
  const jurisdiction = formData.engagement?.state || '';

  return {
    client_name: clientName,
    client_address: clientAddress,
    exec_initial_name: execInitial,
    exec_backup: execBackup,
    exec_further_backup: execFurther,
    guardian_initial: guardianInitial,
    guardian_backup: guardianBackup,
    beneficiary1: beneNames[0] || '',
    beneficiary2: beneNames[1] || '',
    beneficiary3: beneNames[2] || '',
    calamity1: '', // TBD - depends on form structure
    calamity2: '', // TBD
    calamity3: '', // TBD
    governing_jurisdiction: jurisdiction,
    form_id: formId,
    lawyer_initials: 'SA', // Will be configurable later
    // TT1 fields - TBD pending form data structure
    initial_appointor_tt1: '',
    backup_appointor_tt1: '',
    further_backup_appointor_tt1: '',
    initial_trustee_tt1: '',
    backup_trustee_tt1: '',
    further_backup_trustee_tt1: '',
    nominated_beneficiary_tt1: '',
  };
}

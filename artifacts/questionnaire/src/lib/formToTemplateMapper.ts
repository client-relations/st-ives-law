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
  // Handle both webhook structure and form object structure
  let clientName = '';
  let clientAddress = '';
  let executors: any[] = [];
  let guardians: any[] = [];
  let beneProfiles: Record<string, any> = {};
  let jurisdiction = '';

  // Check if this is a form object (has form_data) or webhook payload
  if (formData.form_data) {
    // Form object structure
    const aData = formData.form_data.aData || {};
    const cData = formData.form_data.cData || {};
    const c1 = aData.c1 || {};

    // Client name and address
    clientName = formatPersonName({ first: c1.first, last: c1.last });
    clientAddress = c1.addr || '';

    // Executors from c1Execs array
    executors = cData.c1Execs || [];

    // Guardians
    guardians = cData.guardians || [];

    // Beneficiary profiles
    beneProfiles = cData.beneProfiles || {};

    // Jurisdiction from state
    jurisdiction = aData.state || '';
  } else {
    // Webhook payload structure
    const client = formData.client_1 || formData.client_2 || {};
    clientName = formatPersonName(client);
    clientAddress = client.address || '';
    executors = formData.executors || [];
    guardians = formData.guardians || [];
    beneProfiles = formData.beneficiary_profiles || {};
    jurisdiction = formData.engagement?.state || '';
  }

  // Extract executors
  const execInitial = executors[0] ? formatPersonName(executors[0]) : '';
  const execBackup = executors[1] ? formatPersonName(executors[1]) : '';
  const execFurther = executors[2] ? formatPersonName(executors[2]) : '';

  // Extract guardians
  const guardianInitial = guardians[0] ? formatPersonName(guardians[0]) : '';
  const guardianBackup = guardians[1] ? formatPersonName(guardians[1]) : '';

  // Extract beneficiaries from profiles
  const beneNames = Object.values(beneProfiles)
    .map((b: any) => formatPersonName(b))
    .filter(Boolean);

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
    calamity1: '',
    calamity2: '',
    calamity3: '',
    governing_jurisdiction: jurisdiction,
    form_id: formId,
    lawyer_initials: 'SA',
    initial_appointor_tt1: '',
    backup_appointor_tt1: '',
    further_backup_appointor_tt1: '',
    initial_trustee_tt1: '',
    backup_trustee_tt1: '',
    further_backup_trustee_tt1: '',
    nominated_beneficiary_tt1: '',
  };
}

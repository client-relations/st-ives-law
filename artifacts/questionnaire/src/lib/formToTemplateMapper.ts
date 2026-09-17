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
  // Current webhook structure: flat JSON with client_first_name, client_last_name, etc.
  const clientName = `${formData.client_first_name || ''} ${formData.client_last_name || ''}`.trim();
  const spouseName = formData.spouse_name || '';
  const clientAddress = formData.client_address || '';

  // Executors
  const execInitial = formData.executor_primary_name || '';
  const execBackup = formData.executor_backup_name || '';
  const execFurther = formData.executor_tertiary_name || '';

  // Guardians (from has_minors and guardian fields)
  const guardianInitial = formData.guardian_primary || '';
  const guardianBackup = formData.guardian_backup || '';

  // Beneficiaries (extracted from beneficiaries text field "Beneficiaries:\n• beneficiary 1 - 90%")
  const beneNames = extractBeneficiaryNames(formData.beneficiaries || '');

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
    calamity1: extractCalamityBeneficiary(formData.calamity_beneficiaries || '', 0),
    calamity2: extractCalamityBeneficiary(formData.calamity_beneficiaries || '', 1),
    calamity3: extractCalamityBeneficiary(formData.calamity_beneficiaries || '', 2),
    governing_jurisdiction: formData.client_state || '',
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

function extractCalamityBeneficiary(calamityText: string, index: number): string {
  // Parse "Calamity Beneficiaries:\n• name1\n• name2"
  if (!calamityText || calamityText === 'No calamity beneficiaries') return '';
  const lines = calamityText.split('\n').slice(1); // Skip header
  const match = lines[index]?.match(/•\s*(.+)/);
  return match ? match[1].trim() : '';
}

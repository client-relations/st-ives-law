import { TEMPLATES, FIRM_INFO, TemplateType, ScenarioType } from './templates.js';

interface TemplateVariables {
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
}

// Map our form fields to Clio template variables
const VARIABLE_MAPPING: Record<string, string> = {
  client_name: 'Matter.Client.Name',
  client_address: 'Matter.Client.Address',
  exec_initial_name: 'Matter.CustomField.InitialExecutor',
  exec_backup: 'Matter.CustomField.BackupExecutor',
  exec_further_backup: 'Matter.CustomField.FurtherBackupExecutor',
  guardian_initial: 'Matter.CustomField.InitialGuardian',
  guardian_backup: 'Matter.CustomField.BackupGuardian',
  beneficiary1: 'Matter.CustomField.Beneficiary1',
  beneficiary2: 'Matter.CustomField.Beneficiary2',
  beneficiary3: 'Matter.CustomField.Beneficiary3',
  calamity1: 'Matter.CustomField.CalamityBeneficiary1',
  calamity2: 'Matter.CustomField.CalamityBeneficiary2',
  calamity3: 'Matter.CustomField.CalamityBeneficiary3',
  governing_jurisdiction: 'Matter.CustomField.Jurisdiction',
  form_id: 'Matter.ClientReferenceNumber',
  lawyer_initials: 'Matter.OriginatingAttorney.Initials',
};

export function generateDocument(
  templateType: TemplateType,
  scenario: ScenarioType,
  variables: TemplateVariables
): string {
  // Get template key
  const templateKey = `${templateType}_${scenario}`;
  const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];

  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  let content = template;

  // Replace all variables
  Object.entries(VARIABLE_MAPPING).forEach(([formField, templateVar]) => {
    const value = variables[formField as keyof TemplateVariables] || '';
    const pattern = new RegExp(`<<\\s*${templateVar.replace(/\./g, '\\.')}\\s*>>`, 'g');
    content = content.replace(pattern, value);
  });

  // Replace firm info
  content = content.replace(/<<\s*Firm\.Name\s*>>/g, FIRM_INFO.name);
  content = content.replace(/<<\s*Firm\.Address\s*>>/g, FIRM_INFO.address);
  content = content.replace(/<<\s*Firm\.Phone\s*>>/g, FIRM_INFO.phone);
  content = content.replace(/<<\s*Firm\.Email\s*>>/g, FIRM_INFO.email);
  content = content.replace(/<<\s*Matter\.OriginatingAttorney\.Initials\s*>>/g, variables.lawyer_initials || 'N/A');
  content = content.replace(/<<\s*Matter\.ClientReferenceNumber\s*>>/g, variables.form_id || '');

  // Replace Couple-specific variable (for couple scenarios)
  if (scenario === 'couple') {
    content = content.replace(/<<\s*Matter\.Relationships\.Mr\.Name\s*>>/g, variables.client_name);
  }

  return content;
}

export function getAvailableTemplates(): Array<{ type: TemplateType; label: string; description: string }> {
  return [
    { type: 'simple_will', label: 'Simple Will', description: 'Standard will with basic provisions' },
    { type: 'single_tt_will', label: 'Single Testamentary Trust Will', description: 'Will with single testamentary trust' },
    { type: 'multi_tt_will', label: 'Multi Testamentary Trust Will', description: 'Will with multiple testamentary trusts' },
  ];
}

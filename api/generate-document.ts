// Templates
const TEMPLATES: Record<string, string> = {
  simple_will_individual: `Last Will of<< Matter.Client.Name >> Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Client.Name >>of << Matter.Client.Address >>: GENERALIntentionsI, << Matter.Client.Name >>:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.: TESTAMENTARY DIRECTIONSExecutor and trusteeI appoint as the executor and trustee of my Will:<< Matter.CustomField.InitialExecutor >>;if << Matter.CustomField.InitialExecutor >> is unable or unwilling to act for any reason, then I appoint << Matter.CustomField.BackupExecutor >>; orif << Matter.CustomField.BackupExecutor >> is unable or unwilling to act for any reason, then I appoint << Matter.CustomField.FurtherBackupExecutor >>.Unless otherwise specifically stated in my Will:my Executor is not excluded from participating in any matter concerning the administration of my estate only because of a personal interest in the matter;a gift to a person named in the preceding sub-clause is not dependent on that person acting as my Executor; andthe words 'unable or unwilling to act' in relation to any person named as an Executor includes any scenario where that person:declines to act;is disqualified from acting pursuant to the terms of this Will or at law; is unable to complete the administration of my estate for any reason; or if the appointment otherwise fails for any reason, either before they accept the role or at any time while they hold the role.Testamentary guardian for MinorsIf there is no surviving guardian of my Minor Children, then I appoint:<< Matter.CustomField.InitialGuardian >>; orif << Matter.CustomField.InitialGuardian >> is unable or unwilling to act for any reason, then I appoint << Matter.CustomField.BackupGuardian >>.`,
  simple_will_couple: `Last Will of<< Matter.Relationships.Mr.Name >>Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Relationships.Mr.Name >>of << Matter.Client.Address >>: GENERALIntentionsI, << Matter.Relationships.Mr.Name >>:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.: TESTAMENTARY DIRECTIONSExecutor and trusteeI appoint as the executor and trustee of my Will:<< Matter.CustomField.InitialExecutor >>;if << Matter.CustomField.InitialExecutor >> is unable or unwilling to act for any reason, then I appoint << Matter.CustomField.BackupExecutor >>; orif << Matter.CustomField.BackupExecutor >> is unable or unwilling to act for any reason, then I appoint << Matter.CustomField.FurtherBackupExecutor >>.`,
  single_tt_will_individual: `Last Will of<< Matter.Client.Name >>Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Client.Name >>of << Matter.Client.Address >>: GENERALIntentionsI:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.`,
  single_tt_will_couple: `Last Will of<< Matter.Relationships.Mr.Name >>Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Relationships.Mr.Name >>of << Matter.Client.Address >>: GENERALIntentionsI:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.`,
  multi_tt_will_individual: `Last Will of<< Matter.Client.Name >>Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Client.Name >>of << Matter.Client.Address >>: GENERALIntentionsI, << Matter.Client.Name >>:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.; declare this to be my last Will.`,
  multi_tt_will_couple: `Last Will of<< Matter.Relationships.Mr.Name >>Prepared by<< Firm.Name >><< Firm.Address >>T: << Firm.Phone >>E: << Firm.Email >>Ref: <<Matter.OriginatingAttorney.Initials>>:<<Matter.ClientReferenceNumber>>Last Will of << Matter.Relationships.Mr.Name >>of << Matter.Client.Address >>: GENERALIntentionsI, << Matter.Relationships.Mr.Name >>:revoke all former wills and other testamentary acts made by me; declare this to be my last Will; andconfirm PART E and PART F titled 'interpretation' and 'definitions' apply in relation to the interpretation of this Will.`,
};

const FIRM_INFO = {
  name: 'St Ives Law',
  address: 'St Ives Law Address',
  phone: '(02) 1234 5678',
  email: 'info@stiveslaw.com.au',
};

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

function generateDocument(templateType: string, scenario: string, variables: any): string {
  const templateKey = `${templateType}_${scenario}`;
  const template = TEMPLATES[templateKey];

  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  let content = template;

  // Replace all variables
  Object.entries(VARIABLE_MAPPING).forEach(([formField, templateVar]) => {
    const value = variables[formField] || '';
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

  if (scenario === 'couple') {
    content = content.replace(/<<\s*Matter\.Relationships\.Mr\.Name\s*>>/g, variables.client_name);
  }

  return content;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateType, scenario, ...templateVars } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    const documentContent = generateDocument(templateType, scenario, templateVars);

    return res.status(200).json({
      success: true,
      documentContent,
      documentName: `${templateType}_${templateVars.client_name?.replace(/\s+/g, '_') || 'document'}_${new Date().toISOString().split('T')[0]}`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

import { generateDocument } from '../artifacts/questionnaire/src/lib/templateEngine';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      templateType,
      scenario,
      formId,
      clientName,
      clientAddress,
      execInitialName,
      execBackup,
      execFurtherBackup,
      guardianInitial,
      guardianBackup,
      beneficiary1,
      beneficiary2,
      beneficiary3,
      calamity1,
      calamity2,
      calamity3,
      governingJurisdiction,
      lawyerInitials,
    } = req.body;

    if (!templateType || !scenario || !clientName) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario, clientName',
      });
    }

    // Generate document with variables
    const documentContent = generateDocument(templateType, scenario, {
      client_name: clientName,
      client_address: clientAddress || '',
      exec_initial_name: execInitialName || '',
      exec_backup: execBackup || '',
      exec_further_backup: execFurtherBackup || '',
      guardian_initial: guardianInitial || '',
      guardian_backup: guardianBackup || '',
      beneficiary1: beneficiary1 || '',
      beneficiary2: beneficiary2 || '',
      beneficiary3: beneficiary3 || '',
      calamity1: calamity1 || '',
      calamity2: calamity2 || '',
      calamity3: calamity3 || '',
      governing_jurisdiction: governingJurisdiction || '',
      form_id: formId,
      lawyer_initials: lawyerInitials || 'SA',
    });

    return res.status(200).json({
      success: true,
      documentContent,
      documentName: `${templateType}_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error('Error generating document:', error);
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

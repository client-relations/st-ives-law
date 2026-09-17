/// <reference types="node" />
import { generateWillFromTemplate } from './document-processor';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      templateType,
      scenario,
      client_name,
      client_address,
      exec_initial_name,
      exec_backup,
      exec_further_backup,
      guardian_initial,
      guardian_backup,
      beneficiary1,
      beneficiary2,
      beneficiary3,
      calamity1,
      calamity2,
      calamity3,
      governing_jurisdiction,
      form_id,
      lawyer_initials,
      ...extraVars
    } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // Map form variables to template variables (match actual template field names)
    // Templates use Matter.Relationships.Mr.Name and Matter.Relationships.Mrs.Name for client names
    const variables: Record<string, string> = {
      // Client names (Mr/Mrs for couples, Mr or Mrs for individual)
      'Matter.Relationships.Mr.Name': client_name || '',
      'Matter.Relationships.Mrs.Name': client_name || '', // Same for both in couple scenario
      'Matter.Client.Address': client_address || '',

      // Executors
      'Matter.CustomField.InitialExecutor': exec_initial_name || '',
      'Matter.CustomField.BackupExecutor': exec_backup || '',
      'Matter.CustomField.FurtherBackupExecutor': exec_further_backup || '',

      // Guardians
      'Matter.CustomField.InitialGuardian': guardian_initial || '',
      'Matter.CustomField.BackupGuardian': guardian_backup || '',

      // Beneficiaries
      'Matter.CustomField.Beneficiary1': beneficiary1 || '',
      'Matter.CustomField.Beneficiary2': beneficiary2 || '',
      'Matter.CustomField.Beneficiary3': beneficiary3 || '',

      // Calamity beneficiaries
      'Matter.CustomField.CalamityBeneficiary1': calamity1 || '',
      'Matter.CustomField.CalamityBeneficiary2': calamity2 || '',
      'Matter.CustomField.CalamityBeneficiary3': calamity3 || '',

      // Matter details
      'Matter.Jurisdiction': governing_jurisdiction || 'NSW',
      'Matter.ClientReferenceNumber': form_id || '',
      'Matter.OriginatingAttorney.Initials': lawyer_initials || 'SA',

      // Firm details
      'Firm.Name': 'St Ives Law',
      'Firm.Address': 'St Ives Law Address',
      'Firm.Phone': '(02) 1234 5678',
      'Firm.Email': 'info@stiveslaw.com.au',
    };

    // Add any extra variables passed in
    Object.entries(extraVars).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        variables[key] = String(value);
      }
    });

    // Generate DOCX from template
    const docxBuffer = await generateWillFromTemplate(
      templateType as any,
      scenario as any,
      variables,
      'docx'
    );

    // Try to generate PDF for preview (optional - some environments may not have LibreOffice)
    let pdfBuffer: Buffer | null = null;
    if (process.env.SKIP_PDF_GENERATION !== 'true') {
      try {
        pdfBuffer = await generateWillFromTemplate(
          templateType as any,
          scenario as any,
          variables,
          'pdf'
        );
      } catch (pdfError) {
        console.warn('PDF generation skipped (LibreOffice not available or error):', pdfError);
        // PDF is optional - continue with DOCX only
      }
    }

    // Store DOCX in base64
    const docxBase64 = docxBuffer.toString('base64');
    const pdfBase64 = pdfBuffer ? pdfBuffer.toString('base64') : null;

    // Return document metadata
    return res.status(200).json({
      success: true,
      documentName: `Will - ${scenario} (${templateType})`,
      documentBase64: docxBase64, // Base64 for DOCX download
      documentPdfBase64: pdfBase64, // Base64 for PDF viewer (null if generation failed)
      templateType,
      scenario,
      clientName: client_name || 'Client',
      clientAddress: client_address || '',
      variables, // Include variables for reference (helps with debugging)
    });
  } catch (error: any) {
    console.error('Document generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

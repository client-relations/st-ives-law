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
      spouse_name,
      client_address,
      guardian_initial,
      guardian_backup,
      governing_jurisdiction,
      form_id,
      lawyer_initials,
      initial_appointor_tt1,
      backup_appointor_tt1,
      further_backup_appointor_tt1,
      initial_trustee_tt1,
      backup_trustee_tt1,
      further_backup_trustee_tt1,
      nominated_beneficiary_tt1,
      ...extraVars
    } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // Map form variables to actual template field names in the DOCX
    // Template uses Clio-style field names with TT1 (Testamentary Trust 1) suffixes
    const variables: Record<string, string> = {
      // Client names for couple templates
      'Matter.Relationships.Mr.Name': client_name || '',
      'Matter.Relationships.Mrs.Name': spouse_name || '',
      'Matter.Client.Address': client_address || '',

      // Testamentary Trust 1 - Appointors (successor trustees if trust modified)
      'Matter.CustomField.InitialAppointorTt1': initial_appointor_tt1 || '',
      'Matter.CustomField.BackupAppointorTt1': backup_appointor_tt1 || '',
      'Matter.CustomField.FurtherBackupAppointorTt1': further_backup_appointor_tt1 || '',

      // Testamentary Trust 1 - Trustees (manage trust assets after death)
      'Matter.CustomField.InitialTrusteeTt1': initial_trustee_tt1 || '',
      'Matter.CustomField.BackupTrusteeTt1': backup_trustee_tt1 || '',
      'Matter.CustomField.FurtherBackupTrusteeTt1': further_backup_trustee_tt1 || '',

      // Testamentary Trust 1 - Beneficiary
      'Matter.CustomField.NominatedBeneficiaryTt1': nominated_beneficiary_tt1 || '',

      // Guardians (for minor children)
      'Matter.CustomField.InitialGuardian': guardian_initial || '',
      'Matter.CustomField.BackupGuardian': guardian_backup || '',

      // Matter details
      'Matter.CustomField.Jurisdiction': governing_jurisdiction || 'VIC',
      'Matter.ClientReferenceNumber': form_id || '',
      'Matter.OriginatingAttorney.Initials': lawyer_initials || 'SA',

      // Firm details
      'Firm.Name': 'St Ives Law',
      'Firm.Address': 'St Ives Law Address',
      'Firm.Phone': '(02) 1234 5678',
      'Firm.Email': 'info@stiveslaw.com.au',
    };

    // Add any extra variables passed in (for expansion to TT2, TT3, etc in future)
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

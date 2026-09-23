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
      // Executor fields (for Simple Will)
      exec_initial_name,
      exec_backup,
      exec_further_backup,
      // Beneficiary fields (for Simple Will)
      beneficiary1,
      beneficiary2,
      beneficiary3,
      calamity1,
      calamity2,
      calamity3,
      // Testamentary Trust 1 fields (for Single TT Will)
      initial_appointor_tt1,
      backup_appointor_tt1,
      further_backup_appointor_tt1,
      initial_trustee_tt1,
      backup_trustee_tt1,
      further_backup_trustee_tt1,
      nominated_beneficiary_tt1,
      // Testamentary Trust 2 fields (for Multi TT Will)
      initial_appointor_tt2,
      backup_appointor_tt2,
      further_backup_appointor_tt2,
      initial_trustee_tt2,
      backup_trustee_tt2,
      further_backup_trustee_tt2,
      nominated_beneficiary_tt2,
      ...extraVars
    } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // Map form variables to actual template field names in the DOCX
    // Supports both Simple Will and Testamentary Trust Will templates
    const variables: Record<string, string> = {
      // Client names (used by both Simple Will and TT Will).
      // The INDIVIDUAL templates address the testator as Matter.Client.Name
      // (title, "I, ...", "Testator means ...", and the execution block - 10
      // occurrences). Only the COUPLE templates use Relationships.Mr.Name.
      // Without this line every individual will was produced with the literal
      // text "<< Matter.Client.Name >>" wherever the client's name belongs.
      'Matter.Client.Name': client_name || '',
      'Matter.Relationships.Mr.Name': client_name || '',
      'Matter.Relationships.Mrs.Name': spouse_name || '',
      'Matter.Client.Address': client_address || '',

      // Executors (Simple Will templates)
      'Matter.CustomField.InitialExecutor': exec_initial_name || '',
      'Matter.CustomField.BackupExecutor': exec_backup || '',
      'Matter.CustomField.FurtherBackupExecutor': exec_further_backup || '',

      // Beneficiaries (Simple Will templates)
      'Matter.CustomField.Beneficiary1': beneficiary1 || '',
      'Matter.CustomField.Beneficiary2': beneficiary2 || '',
      'Matter.CustomField.Beneficiary3': beneficiary3 || '',

      // Calamity beneficiaries (Simple Will templates)
      'Matter.CustomField.CalamityBeneficiary1': calamity1 || '',
      'Matter.CustomField.CalamityBeneficiary2': calamity2 || '',
      'Matter.CustomField.CalamityBeneficiary3': calamity3 || '',

      // Testamentary Trust 1 - Appointors (Single TT Will)
      'Matter.CustomField.InitialAppointorTt1': initial_appointor_tt1 || '',
      'Matter.CustomField.BackupAppointorTt1': backup_appointor_tt1 || '',
      'Matter.CustomField.FurtherBackupAppointorTt1': further_backup_appointor_tt1 || '',

      // Testamentary Trust 1 - Trustees (Single TT Will)
      'Matter.CustomField.InitialTrusteeTt1': initial_trustee_tt1 || '',
      'Matter.CustomField.BackupTrusteeTt1': backup_trustee_tt1 || '',
      'Matter.CustomField.FurtherBackupTrusteeTt1': further_backup_trustee_tt1 || '',

      // Testamentary Trust 1 - Beneficiary (Single TT Will)
      'Matter.CustomField.NominatedBeneficiaryTt1': nominated_beneficiary_tt1 || '',

      // Testamentary Trust 2 - Appointors (Multi TT Will)
      'Matter.CustomField.InitialAppointorTt2': initial_appointor_tt2 || '',
      'Matter.CustomField.BackupAppointorTt2': backup_appointor_tt2 || '',
      'Matter.CustomField.FurtherBackupAppointorTt2': further_backup_appointor_tt2 || '',

      // Testamentary Trust 2 - Trustees (Multi TT Will)
      'Matter.CustomField.InitialTrusteeTt2': initial_trustee_tt2 || '',
      'Matter.CustomField.BackupTrusteeTt2': backup_trustee_tt2 || '',
      'Matter.CustomField.FurtherBackupTrusteeTt2': further_backup_trustee_tt2 || '',

      // Testamentary Trust 2 - Beneficiary (Multi TT Will)
      'Matter.CustomField.NominatedBeneficiaryTt2': nominated_beneficiary_tt2 || '',

      // Guardians (both templates)
      'Matter.CustomField.InitialGuardian': guardian_initial || '',
      'Matter.CustomField.BackupGuardian': guardian_backup || '',

      // Matter details (both templates)
      'Matter.CustomField.Jurisdiction': governing_jurisdiction || 'VIC',
      'Matter.ClientReferenceNumber': form_id || '',
      'Matter.OriginatingAttorney.Initials': lawyer_initials || 'SA',

      // Firm details (both templates)
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

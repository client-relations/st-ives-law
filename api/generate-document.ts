/// <reference types="node" />
import { generateWillFromTemplate } from './document-processor';

// Helper to extract text content from DOCX for preview
async function extractTextFromDocx(docxBuffer: Buffer): Promise<string> {
  try {
    const JSZip = require('jszip');

    // Parse DOCX as ZIP
    const zip = await JSZip.loadAsync(docxBuffer);

    // Extract document.xml which contains the actual text content
    const documentXml = await zip.file('word/document.xml')?.async('text');

    if (!documentXml) {
      return '[Document content could not be extracted]';
    }

    // Extract text from XML by removing tags
    let textContent = documentXml
      .replace(/<[^>]*>/g, '') // Remove XML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return textContent || '[Document appears to be empty or unreadable]';
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    return '[Unable to extract document preview - document is generated correctly for download]';
  }
}

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

    // Map form variables to Clio format template variables
    const variables: Record<string, string> = {
      'Matter.Client.Name': client_name || '',
      'Matter.Client.Address': client_address || '',
      'Matter.CustomField.InitialExecutor': exec_initial_name || '',
      'Matter.CustomField.BackupExecutor': exec_backup || '',
      'Matter.CustomField.FurtherBackupExecutor': exec_further_backup || '',
      'Matter.CustomField.InitialGuardian': guardian_initial || '',
      'Matter.CustomField.BackupGuardian': guardian_backup || '',
      'Matter.CustomField.Beneficiary1': beneficiary1 || '',
      'Matter.CustomField.Beneficiary2': beneficiary2 || '',
      'Matter.CustomField.Beneficiary3': beneficiary3 || '',
      'Matter.CustomField.CalamityBeneficiary1': calamity1 || '',
      'Matter.CustomField.CalamityBeneficiary2': calamity2 || '',
      'Matter.CustomField.CalamityBeneficiary3': calamity3 || '',
      'Matter.Jurisdiction': governing_jurisdiction || 'NSW',
      'Matter.ClientReferenceNumber': form_id || '',
      'Matter.OriginatingAttorney.Initials': lawyer_initials || 'SA',
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
    });
  } catch (error: any) {
    console.error('Document generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

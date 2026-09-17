/// <reference types="node" />
import { generateWillFromTemplate } from './document-processor';

// Helper to extract text content from DOCX for preview
async function extractTextFromDocx(docxBuffer: Buffer): Promise<string> {
  try {
    // DOCX is a ZIP file, we need to extract document.xml and get text
    // For now, convert to UTF-8 string and extract text
    let textContent = '';
    const utf8Content = docxBuffer.toString('utf-8', 0, Math.min(1000000, docxBuffer.length));

    // Remove XML tags to get readable text
    textContent = utf8Content
      .replace(/<[^>]*>/g, '') // Remove XML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return textContent;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    return '';
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

    // Extract text content for preview
    const documentContent = await extractTextFromDocx(docxBuffer);

    // Store DOCX in a cache (using base64 in response for now)
    const docxBase64 = docxBuffer.toString('base64');

    // Return document metadata + preview content
    return res.status(200).json({
      success: true,
      documentName: `Will - ${scenario} (${templateType})`,
      documentContent, // Text preview for display
      documentBase64: docxBase64, // Base64 for actual DOCX download
      templateType,
      scenario,
      clientName: client_name || 'Client',
      clientAddress: client_address || '',
      variables, // Include variables for reference
    });
  } catch (error: any) {
    console.error('Document generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

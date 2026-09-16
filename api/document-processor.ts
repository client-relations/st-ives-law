import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Document processor - handles DOCX template processing and PDF conversion
// Uses simple file-based approach with LibreOffice for PDF conversion

export async function processDocxTemplate(
  templatePath: string,
  variables: Record<string, string>
): Promise<Buffer> {
  try {
    // Read the template DOCX file
    const docxBuffer = readFileSync(templatePath);

    // Simple variable replacement - works by reading content as UTF-8
    // This is a basic approach; production would use proper DOCX library
    let content = docxBuffer.toString('utf-8', 0, Math.min(100000, docxBuffer.length));

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`<<\\s*${key}\\s*>>`, 'g');
      content = content.replace(pattern, value || '');
    });

    // For now, return the modified buffer (real implementation would repackage DOCX XML)
    return Buffer.from(content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to process DOCX template: ${error}`);
  }
}

export async function convertDocxToPdf(docxPath: string): Promise<Buffer> {
  const tempPdfPath = join(tmpdir(), `will_${Date.now()}.pdf`);

  try {
    // Use LibreOffice to convert DOCX to PDF
    // This requires LibreOffice to be installed on the server
    execSync(
      `libreoffice --headless --convert-to pdf --outdir ${tmpdir()} "${docxPath}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // Read the generated PDF
    const pdfBuffer = readFileSync(tempPdfPath);
    return pdfBuffer;
  } catch (error) {
    // Fallback: return DOCX as binary if PDF conversion fails
    console.warn('PDF conversion failed, returning DOCX:', error);
    return readFileSync(docxPath);
  } finally {
    // Clean up temp PDF
    try {
      unlinkSync(tempPdfPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

export async function generateWillFromTemplate(
  willType: 'simple_will' | 'single_tt_will' | 'multi_tt_will',
  scenario: 'individual' | 'couple',
  variables: Record<string, string>,
  outputFormat: 'docx' | 'pdf' = 'docx'
): Promise<Buffer> {
  const templateMap: Record<string, string> = {
    simple_will_individual: 'Simple Will - Individual (Clio).docx',
    simple_will_couple: 'Simple Will - Couple (Clio).docx',
    single_tt_will_individual: 'Single TT Will - Individual (Clio).docx',
    single_tt_will_couple: 'Single TT Will - Couple (Clio).docx',
    multi_tt_will_individual: 'Multi TT Will - Individual (Clio).docx',
    multi_tt_will_couple: 'Multi TT Will - Couple (Clio).docx',
  };

  const templateKey = `${willType}_${scenario}`;
  const templateFile = templateMap[templateKey];

  if (!templateFile) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  // Look for template in multiple locations
  const possiblePaths = [
    join(process.cwd(), 'public', 'templates', templateFile),
    join(process.cwd(), 'templates', templateFile),
    join(process.cwd(), '..', 'OneDrive_2_9-3-2026', templateFile),
    `C:\\Users\\yxzu\\Desktop\\st ives\\OneDrive_2_9-3-2026\\${templateFile}`,
  ];

  let templatePath = '';
  for (const path of possiblePaths) {
    try {
      readFileSync(path);
      templatePath = path;
      break;
    } catch (e) {
      // Try next path
    }
  }

  if (!templatePath) {
    throw new Error(`Template not found: ${templateFile}. Searched: ${possiblePaths.join(', ')}`);
  }

  // Process the template
  let result = await processDocxTemplate(templatePath, variables);

  // Convert to PDF if requested
  if (outputFormat === 'pdf') {
    const tempDocxPath = join(tmpdir(), `will_${Date.now()}.docx`);
    try {
      writeFileSync(tempDocxPath, result);
      result = await convertDocxToPdf(tempDocxPath);
    } finally {
      try {
        unlinkSync(tempDocxPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  return result;
}

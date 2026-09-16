/// <reference types="node" />
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

// Document processor - handles DOCX template processing using docxtemplater
// PizZip handles the DOCX ZIP structure, Docxtemplater replaces variables

export async function processDocxTemplate(
  templatePath: string,
  variables: Record<string, string>
): Promise<Buffer> {
  try {
    // Read the template DOCX file as binary
    const docxBuffer = readFileSync(templatePath);

    // Load the DOCX using PizZip (DOCX is a ZIP file)
    const zip = new PizZip(docxBuffer);

    // Create Docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Convert variables to plain object (remove angle brackets if present)
    const cleanVars: Record<string, string> = {};
    Object.entries(variables).forEach(([key, value]) => {
      // Handle both << Variable >> and Variable formats
      const cleanKey = key.replace(/[<>\s]/g, '');
      cleanVars[cleanKey] = value || '';
    });

    // Set template variables and render
    doc.render(cleanVars);

    // Get the generated document as Buffer
    const output = doc.getZip().generate({ type: 'nodebuffer' });
    return output;
  } catch (error) {
    throw new Error(`Failed to process DOCX template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function convertDocxToPdf(docxPath: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const fileName = `will_${Date.now()}`;
  const tempPdfPath = join(tempDir, `${fileName}.pdf`);

  try {
    // Use LibreOffice to convert DOCX to PDF
    // This requires LibreOffice to be installed on the server
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // Read the generated PDF
    const pdfBuffer = readFileSync(tempPdfPath);
    return pdfBuffer;
  } catch (error) {
    // Fallback: return DOCX as binary if PDF conversion fails
    console.warn('PDF conversion failed, returning DOCX as fallback:', error);
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
      console.log(`Found template at: ${path}`);
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

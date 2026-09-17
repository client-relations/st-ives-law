/// <reference types="node" />
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Dynamic imports to handle optional dependencies
let Docxtemplater: any;
let PizZip: any;

try {
  Docxtemplater = require('docxtemplater');
  PizZip = require('pizzip');
} catch (e) {
  console.warn('docxtemplater/pizzip not available, using fallback mode');
}

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

    // Create Docxtemplater instance with proper configuration
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '<<',
        end: '>>',
      },
    });

    // docxtemplater expects dot notation (e.g., Matter.Client.Name)
    // Build nested structure for complex keys
    const templateVars: Record<string, any> = {};

    Object.entries(variables).forEach(([key, value]) => {
      // Split by dots to create nested structure
      const parts = key.split('.');
      let current = templateVars;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      // Set the final value
      const lastPart = parts[parts.length - 1];
      current[lastPart] = value || '';
    });

    // Set template variables and render
    doc.render(templateVars);

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
  // __dirname in Vercel points to the function directory
  const possiblePaths = [
    join(__dirname, 'templates', templateFile), // api/templates (for Vercel)
    join(__dirname, templateFile), // Direct in api/
    join(process.cwd(), 'api', 'templates', templateFile),
    join(process.cwd(), 'public', 'templates', templateFile),
    join(process.cwd(), 'templates', templateFile),
  ];

  // Add local development paths
  if (!process.env.VERCEL) {
    possiblePaths.push(
      join(process.cwd(), '..', 'OneDrive_2_9-3-2026', templateFile),
      `C:\\Users\\yxzu\\Desktop\\st ives\\OneDrive_2_9-3-2026\\${templateFile}`
    );
  }

  let templatePath = '';
  for (const path of possiblePaths) {
    try {
      readFileSync(path);
      templatePath = path;
      console.log(`Found template at: ${path}`);
      break;
    } catch (e) {
      console.log(`Template not found at: ${path}`);
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

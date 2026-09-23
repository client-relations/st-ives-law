/// <reference types="node" />
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Dynamic imports - try docxtemplater first, fall back to simple replacement
let AdmZip: any;
try {
  AdmZip = require('adm-zip');
} catch (e) {
  console.warn('adm-zip not available, will use fallback');
}

// Simple but reliable DOCX variable replacement using JSZip
export async function processDocxTemplate(
  templatePath: string,
  variables: Record<string, string>,
  documentTitle?: string
): Promise<Buffer> {
  try {
    const JSZip = require('jszip');

    // Read the template DOCX file (it's a ZIP)
    const docxBuffer = readFileSync(templatePath);
    const zip = await JSZip.loadAsync(docxBuffer);

    // Files to process: document.xml and all headers/footers
    const filesToProcess = ['word/document.xml'];

    // Add header files if they exist
    const allFiles = Object.keys(zip.files);
    allFiles.forEach((filename) => {
      if (filename.startsWith('word/header') && filename.endsWith('.xml')) {
        filesToProcess.push(filename);
      }
      if (filename.startsWith('word/footer') && filename.endsWith('.xml')) {
        filesToProcess.push(filename);
      }
    });

    // Process each XML file
    for (const xmlFile of filesToProcess) {
      try {
        const fileObj = zip.file(xmlFile);
        if (!fileObj) {
          console.warn(`File not found in ZIP: ${xmlFile}`);
          continue;
        }

        let xmlContent = await fileObj.async('text');
        if (!xmlContent) continue;

        console.log(`Processing ${xmlFile}, original size: ${xmlContent.length}`);

        // Replace all variables with their values
        // Sort by length (longest first) to avoid partial matches
        // E.g., replace "Mr.Name" before "Name", replace "Mrs.Name" before "Mr.Name" within it
        const sortedVariables = Object.entries(variables).sort((a, b) => b[0].length - a[0].length);

        sortedVariables.forEach(([key, value]) => {
          // Leave the placeholder alone when we have nothing to put in it.
          // A matter created straight in Clio has empty custom fields, and a
          // blank line in a will is easy to miss in a way that a visible
          // << Matter.CustomField.InitialExecutor >> is not — the lawyer can
          // see exactly what still needs filling before the document is signed.
          if (value === undefined || value === null || value === '') return;

          const escapedKey = key.replace(/\./g, '\\.');

          // Replace HTML-encoded format: &lt;&lt; Variable &gt;&gt; (most common in templates)
          const htmlPattern = new RegExp(`&lt;&lt;\\s*${escapedKey}\\s*&gt;&gt;`, 'g');
          const beforeHtml = xmlContent.length;
          xmlContent = xmlContent.replace(htmlPattern, value || '');
          if (xmlContent.length !== beforeHtml) {
            console.log(`  Replaced &lt;&lt;${key}&gt;&gt;`);
          }

          // Handle split placeholders (Word breaks them across runs)
          // Match: &lt;&lt; [any chars except &] KEY [any chars except &] &gt;&gt;
          // This allows XML tags to be interspersed within the placeholder
          const splitPattern = new RegExp(
            `&lt;&lt;[^&]*?${escapedKey}[^&]*?&gt;&gt;`,
            'g'
          );
          const beforeSplit = xmlContent.length;
          xmlContent = xmlContent.replace(splitPattern, value || '');
          if (xmlContent.length !== beforeSplit && xmlContent.length !== beforeHtml) {
            console.log(`  Replaced ${key} (split format)`);
          }

          // Also handle plain format in case it exists
          const plainPattern = new RegExp(`<<\\s*${escapedKey}\\s*>>`, 'g');
          const beforePlain = xmlContent.length;
          xmlContent = xmlContent.replace(plainPattern, value || '');
          if (xmlContent.length !== beforePlain) {
            console.log(`  Replaced <<${key}>>`);
          }
        });

        console.log(`After replacements, size: ${xmlContent.length}`);

        // Update the file in the ZIP
        zip.file(xmlFile, xmlContent);
      } catch (e) {
        console.warn(`Failed to process ${xmlFile}:`, e);
      }
    }

    // Correct the document's own title.
    //
    // Every precedent in api/templates carries "Multi TT Will" in
    // docProps/core.xml — the provider built the whole set by copying that one
    // file and never updated the properties. Left alone, a Simple Will opens in
    // Word and in PDF readers titled "Multi TT Will", which is confusing for
    // the lawyer and embarrassing in front of a client.
    if (documentTitle) {
      const coreFile = zip.file('docProps/core.xml');
      if (coreFile) {
        const core = await coreFile.async('text');
        const escaped = documentTitle
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        zip.file(
          'docProps/core.xml',
          core.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${escaped}</dc:title>`)
        );
      }
    }

    // Generate new DOCX buffer
    const resultBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return resultBuffer;
  } catch (error) {
    console.error('Template processing error:', error);
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
    // Fail loudly rather than returning DOCX bytes that the caller will label
    // as a PDF. That fallback shipped a file named .pdf which was really a
    // zipped DOCX — it opens in nothing, and the lawyer only finds out after
    // sending it. Callers treat a throw here as "no PDF available", which is
    // the truth: Vercel has no LibreOffice, and two concurrent headless
    // conversions clash over the same user profile even where it is installed.
    console.warn('PDF conversion failed; no PDF will be returned:', error);
    throw error instanceof Error ? error : new Error(String(error));
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

  // Name the document after the precedent actually used, not whatever the
  // provider left in the file's properties.
  const documentTitle = templateFile.replace(/\s*\(Clio\)\.docx$/i, '');

  // Process the template
  let result = await processDocxTemplate(templatePath, variables, documentTitle);

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

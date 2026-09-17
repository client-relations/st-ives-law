/// <reference types="node" />
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

/**
 * Convert DOCX Base64 to HTML for editing
 * Returns HTML string that can be displayed/edited in browser
 */
export async function convertDocxToHtml(docxBase64: string): Promise<string> {
  try {
    const Mammoth = await import('mammoth');

    // Decode Base64 to buffer
    const docxBuffer = Buffer.from(docxBase64, 'base64');

    // Convert DOCX to HTML
    const result = await Mammoth.convertToHtml({ arrayBuffer: docxBuffer.buffer });

    return result.value; // HTML content
  } catch (error) {
    console.error('DOCX to HTML conversion error:', error);
    throw new Error(`Failed to convert DOCX to HTML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert edited HTML back to DOCX
 * Returns DOCX as Base64
 * NOTE: Requires 'docx' package - not currently installed
 */
export async function convertHtmlToDocx(htmlContent: string): Promise<string> {
  throw new Error('HTML to DOCX conversion not available. Install docx package to enable.');
}

/**
 * Convert DOCX Base64 to PDF Base64
 * Uses LibreOffice if available
 */
export async function convertDocxToPdf(docxBase64: string): Promise<string> {
  try {
    const tempDir = tmpdir();
    const docxPath = join(tempDir, `doc_${Date.now()}.docx`);
    const pdfPath = join(tempDir, `doc_${Date.now()}.pdf`);

    // Write DOCX from Base64
    const docxBuffer = Buffer.from(docxBase64, 'base64');
    writeFileSync(docxPath, docxBuffer);

    // Convert using LibreOffice
    try {
      execSync(
        `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 }
      );

      // Read PDF and convert to Base64
      const pdfBuffer = readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Cleanup
      try {
        unlinkSync(docxPath);
        unlinkSync(pdfPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      return pdfBase64;
    } catch (error) {
      console.warn('LibreOffice conversion failed, PDF not available:', error);
      throw new Error('PDF conversion not available. LibreOffice may not be installed.');
    }
  } catch (error) {
    console.error('DOCX to PDF conversion error:', error);
    throw new Error(`Failed to convert DOCX to PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, docxBase64, htmlContent } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    if (action === 'docx-to-html') {
      if (!docxBase64) {
        return res.status(400).json({ error: 'Missing docxBase64' });
      }
      const html = await convertDocxToHtml(docxBase64);
      return res.status(200).json({ success: true, html });
    } else if (action === 'html-to-docx') {
      if (!htmlContent) {
        return res.status(400).json({ error: 'Missing htmlContent' });
      }
      const docxBase64 = await convertHtmlToDocx(htmlContent);
      return res.status(200).json({ success: true, docxBase64 });
    } else if (action === 'docx-to-pdf') {
      if (!docxBase64) {
        return res.status(400).json({ error: 'Missing docxBase64' });
      }
      const pdfBase64 = await convertDocxToPdf(docxBase64);
      return res.status(200).json({ success: true, pdfBase64 });
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error('Conversion error:', error);
    return res.status(500).json({
      error: 'Conversion failed',
      details: error.message,
    });
  }
}

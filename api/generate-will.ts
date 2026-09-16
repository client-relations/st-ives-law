import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Simple DOCX variable replacement utility
// This works by manipulating the XML inside the DOCX file (which is a ZIP)

export async function generateWillDocx(
  willType: 'simple_will' | 'single_tt_will' | 'multi_tt_will',
  scenario: 'individual' | 'couple',
  variables: Record<string, string>
): Promise<Buffer> {
  // Template mapping
  const templateMap: Record<string, string> = {
    'simple_will_individual': 'Simple Will - Individual (Clio).docx',
    'simple_will_couple': 'Simple Will - Couple (Clio).docx',
    'single_tt_will_individual': 'Single TT Will - Individual (Clio).docx',
    'single_tt_will_couple': 'Single TT Will - Couple (Clio).docx',
    'multi_tt_will_individual': 'Multi TT Will - Individual (Clio).docx',
    'multi_tt_will_couple': 'Multi TT Will - Couple (Clio).docx',
  };

  const templateKey = `${willType}_${scenario}`;
  const templateFile = templateMap[templateKey];

  if (!templateFile) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  try {
    // For now, return a placeholder indicating we need to implement DOCX processing
    // This will be enhanced with actual DOCX manipulation
    return Buffer.from(`DOCX: ${templateFile} with variables replaced`);
  } catch (error) {
    throw new Error(`Failed to generate Will DOCX: ${error}`);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { willType, scenario, variables } = req.body;

    if (!willType || !scenario || !variables) {
      return res.status(400).json({
        error: 'Missing required fields: willType, scenario, variables',
      });
    }

    const docxBuffer = await generateWillDocx(willType, scenario, variables);

    // Set response headers for DOCX download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Will_${variables.client_name || 'Document'}.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);

    return res.status(200).send(docxBuffer);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to generate Will DOCX',
      details: error.message,
    });
  }
}

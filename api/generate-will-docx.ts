/// <reference types="node" />
import { generateWillFromTemplate } from './document-processor';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateType, scenario, clientName, variables } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // Generate DOCX from template
    const docxBuffer = await generateWillFromTemplate(
      templateType,
      scenario,
      variables || { 'Matter.Client.Name': clientName || 'Client' },
      'docx'
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${clientName || 'Will'}.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);

    return res.status(200).send(docxBuffer);
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate DOCX',
      details: error.message,
    });
  }
}

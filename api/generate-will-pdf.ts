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

    // Generate PDF from template
    const pdfBuffer = await generateWillFromTemplate(
      templateType,
      scenario,
      variables || { 'Matter.Client.Name': clientName || 'Client' },
      'pdf'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${clientName || 'Will'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message,
    });
  }
}

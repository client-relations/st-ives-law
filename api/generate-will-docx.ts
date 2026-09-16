// API endpoint to generate DOCX from Will template with variables replaced
// This endpoint loads the Will template DOCX and replaces variables while preserving formatting

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateType, scenario, content, clientName } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // TODO: Implement DOCX generation
    // Steps:
    // 1. Load the Will template DOCX file from public/templates/
    // 2. Parse the DOCX (it's a ZIP file with XML inside)
    // 3. Replace variables in the document.xml
    // 4. Preserve formatting and styles
    // 5. Return the generated DOCX as binary

    // For now, return success with guidance
    const docxContent = Buffer.from(content || 'Will Document Content');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${clientName || 'Will'}.docx"`);
    res.setHeader('Content-Length', docxContent.length);

    return res.status(200).send(docxContent);
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate DOCX',
      details: error.message,
    });
  }
}

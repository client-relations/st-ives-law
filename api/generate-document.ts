import { generateDocument } from '../artifacts/questionnaire/src/lib/templateEngine';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateType, scenario, ...templateVars } = req.body;

    if (!templateType || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, scenario',
      });
    }

    // Generate document with variables (already mapped by formToTemplateMapper)
    const documentContent = generateDocument(templateType, scenario, templateVars);

    return res.status(200).json({
      success: true,
      documentContent,
      documentName: `${templateType}_${templateVars.client_name?.replace(/\s+/g, '_') || 'document'}_${new Date().toISOString().split('T')[0]}`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to generate document',
      details: error.message,
    });
  }
}

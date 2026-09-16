/// <reference types="node" />
// API endpoint to send generated PDF to Clio via Make webhook
// This receives the PDF and forwards it to the Make workflow for Clio intake

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      form_id,
      document_type,
      scenario,
      client_name,
      pdf_data,
      pdf_filename,
    } = req.body;

    if (!form_id || !pdf_data) {
      return res.status(400).json({
        error: 'Missing required fields: form_id, pdf_data',
      });
    }

    // Get Make webhook URL from environment
    const webhookUrl = process.env.MAKE_SEND_TO_CLIO_WEBHOOK;
    if (!webhookUrl) {
      return res.status(500).json({
        error: 'Make webhook URL not configured',
      });
    }

    // Send to Make webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        form_id,
        document_type,
        scenario,
        client_name,
        pdf_data, // Base64 encoded PDF
        pdf_filename,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(
        `Make webhook failed with status ${webhookResponse.status}: ${await webhookResponse.text()}`
      );
    }

    const webhookResult = await webhookResponse.json();

    return res.status(200).json({
      success: true,
      message: 'Document sent to Clio successfully',
      webhookResponse: webhookResult,
    });
  } catch (error: any) {
    console.error('Send to Clio error:', error);
    return res.status(500).json({
      error: 'Failed to send document to Clio',
      details: error.message,
    });
  }
}

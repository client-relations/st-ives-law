/// <reference types="node" />

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      docxBase64,
      matter_id,
      documentName,
      templateType,
      scenario,
      formId,
    } = req.body;

    if (!docxBase64 || !matter_id) {
      return res.status(400).json({
        error: 'Missing required fields: docxBase64, matter_id',
      });
    }

    // Convert Base64 to Buffer
    const docxBuffer = Buffer.from(docxBase64, 'base64');

    // Manually construct multipart/form-data payload
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // Helper to add form field
    const addField = (name: string, value: string) => {
      let part = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`;
      parts.push(Buffer.from(part));
      parts.push(Buffer.from(value));
      parts.push(Buffer.from('\r\n'));
    };

    // Helper to add file field
    const addFile = (name: string, filename: string, buffer: Buffer, contentType: string) => {
      let part = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
      parts.push(Buffer.from(part));
      parts.push(buffer);
      parts.push(Buffer.from('\r\n'));
    };

    // Clio API v4 requires wrapped data structure
    addField('data[matter][id]', matter_id);
    addField('matter_id', matter_id); // Also send as top-level field for Make.com reference
    addField('data[description]', documentName || 'Generated Will Document');
    addField('data[document_category][name]', 'Legal Documents');
    addField('data[document_version][filename]', `${documentName || 'document'}.docx`);

    // Add the binary DOCX file
    addFile(
      'data[document_version][uploaded_data]',
      `${documentName || 'document'}.docx`,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Add metadata for Make.com
    addField('metadata[templateType]', templateType || '');
    addField('metadata[scenario]', scenario || '');
    addField('metadata[formId]', formId || '');
    addField('metadata[timestamp]', new Date().toISOString());

    // Final boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    // Combine all parts
    const body = Buffer.concat(parts);

    // Send to Make.com webhook
    const webhookUrl = 'https://hook.eu2.make.com/5n4gkxudn5a79qwbl99wtmr9xg0ddpu8';

    console.log(`Sending multipart form to webhook: ${webhookUrl}`);
    console.log(`Body size: ${body.length} bytes`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Webhook error: ${response.status} - ${text}`);
      throw new Error(`Webhook returned ${response.status}: ${text}`);
    }

    console.log('Multipart document sent successfully to webhook');

    return res.status(200).json({
      success: true,
      message: 'Document sent to Clio via Make.com webhook (multipart/form-data)',
      matter_id: matter_id,
      documentName: documentName,
    });
  } catch (error: any) {
    console.error('Send to Clio multipart error:', error);
    return res.status(500).json({
      error: 'Failed to send document to Clio',
      details: error.message,
    });
  }
}

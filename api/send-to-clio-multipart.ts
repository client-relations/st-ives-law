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
    addField('data[name]', documentName || 'Generated Will Document');
    addField('data[parent][id]', matter_id);
    addField('data[parent][type]', 'Matter');
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

    // Final boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    // Combine all parts
    const body = Buffer.concat(parts);

    // Send multipart to Make.com webhook for Clio forwarding
    const makeWebhookUrl = 'https://hook.eu2.make.com/5n4gkxudn5a79qwbl99wtmr9xg0ddpu8';

    console.log(`Sending multipart document to Make.com webhook: ${makeWebhookUrl}`);
    console.log(`Matter ID: ${matter_id}, Document: ${documentName}`);
    console.log(`Body size: ${body.length} bytes`);

    const response = await fetch(makeWebhookUrl, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
    } as any);

    if (!(response as any).ok) {
      const text = await (response as any).text();
      console.error(`Clio API error: ${(response as any).status} - ${text}`);
      throw new Error(`Clio API returned ${(response as any).status}: ${text}`);
    }

    const result = await (response as any).json();
    console.log('Document uploaded to Clio successfully');

    return res.status(200).json({
      success: true,
      message: 'Document sent to Make.com webhook for Clio upload',
      matter_id: matter_id,
      documentName: documentName,
      webhookResponse: result,
    });
  } catch (error: any) {
    console.error('Send to Clio multipart error:', error);
    return res.status(500).json({
      error: 'Failed to send document to Clio',
      details: error.message,
    });
  }
}

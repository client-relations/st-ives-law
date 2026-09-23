/// <reference types="node" />

/**
 * Hand a generated DOCX to the Make "Sending Document" scenario, which uploads
 * it into the Clio matter using Make's stored Clio OAuth connection.
 *
 * The scenario reads three JSON fields — docxBase64, matter_id and
 * documentName — and posts them to Clio's /documents endpoint. An earlier
 * revision of this endpoint sent multipart/form-data instead, so
 * {{1.docxBase64}} resolved to empty and Clio rejected every request with
 * "Bad Request". Sending plain JSON with exactly those keys is what the
 * scenario has always expected.
 *
 * Make replies with the literal string "Accepted" (not JSON) the moment it
 * queues the payload, so the response is read as text and a 2xx here means
 * "queued", not "delivered".
 */

const MAKE_DOCUMENT_WEBHOOK =
  process.env.CLIO_DOCUMENT_WEBHOOK ||
  'https://hook.eu2.make.com/5n4gkxudn5a79qwbl99wtmr9xg0ddpu8';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { docxBase64, matter_id, documentName } = req.body || {};

  if (!docxBase64 || !matter_id) {
    return res.status(400).json({
      error: 'Missing required fields: docxBase64, matter_id',
    });
  }

  try {
    // Field names must match the scenario's mappings exactly.
    const payload = {
      docxBase64,
      matter_id: String(matter_id),
      documentName: documentName || 'document',
    };

    console.log(
      `Sending document to Make for Clio matter ${matter_id} ` +
        `(${docxBase64.length} base64 chars)`,
    );

    const response = await fetch(MAKE_DOCUMENT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = (await response.text().catch(() => '')).trim();

    if (!response.ok) {
      console.error('Make webhook rejected the document:', response.status, body);
      return res.status(502).json({
        error: 'Could not queue the document for Clio',
        details: `Automation returned ${response.status}: ${body.slice(0, 300)}`,
      });
    }

    // Make acknowledges with "Accepted" before it runs the scenario, so the
    // upload itself may still fail downstream (e.g. scenario switched off).
    if (body && !/^accepted$/i.test(body)) {
      console.error('Unexpected Make response:', body);
      return res.status(502).json({
        error: 'The automation rejected the document',
        details: body.slice(0, 300),
      });
    }

    console.log(`Document queued for Clio matter ${matter_id}`);

    return res.status(200).json({
      success: true,
      message: 'Document queued for upload to Clio',
      matter_id,
      documentName: payload.documentName,
    });
  } catch (error: any) {
    console.error('Send to Clio error:', error);
    return res.status(500).json({
      error: 'Failed to send document to Clio',
      details: error?.message,
    });
  }
}

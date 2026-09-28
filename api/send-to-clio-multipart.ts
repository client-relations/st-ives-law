/// <reference types="node" />

/**
 * Upload a generated DOCX into a Clio matter.
 *
 * Clio's v4 API does not accept a file inline (not base64 in JSON, not a
 * single multipart POST). Uploading is a three-step handshake:
 *
 *   1. POST   /documents.json      -> create the record, receive a signed
 *                                     put_url + put_headers
 *   2. PUT    <put_url>            -> upload the raw bytes to storage
 *   3. PATCH  /documents/{id}.json -> mark fully_uploaded so Clio shows it
 *
 * The Make "Sending Document" scenario only ever did step 1 with the file
 * inline, which is why Clio answered "Bad Request" on 28 of its 32 runs.
 *
 * AUTH is shared with the rest of the Clio integration — see clio-client.ts.
 */

import { CLIO_API, getClioAccessToken, uploadDocumentToMatter } from './_lib/clio-client';
import { requireLawyer, sendError } from './_lib/server.js';

function fail(res: any, status: number, error: string, details?: unknown) {
  return res.status(status).json({ error, details });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return fail(res, 405, 'Method not allowed');
  }

  // Touches the firm's Clio account, so only a signed-in lawyer may call it.
  try {
    await requireLawyer(req);
  } catch (err) {
    return sendError(res, err);
  }

  // DELETE undoes a filing. Generating and filing happen on one press now, so
  // a mis-picked client puts documents on a real matter with no way back —
  // this is that way back. Clio moves them to the trash rather than destroying
  // them, so a wrong undo is recoverable too.
  if (req.method === 'DELETE') {
    const ids: unknown[] = req.body?.document_ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return fail(res, 400, 'Missing required field: document_ids');
    }

    const auth = await getClioAccessToken();
    if (!auth.token) return fail(res, 500, 'Clio authentication unavailable', auth.error);

    const removed: number[] = [];
    for (const id of ids) {
      const response = await fetch(`${CLIO_API}/documents/${Number(id)}.json`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      // 404 means it is already gone, which is the outcome we wanted anyway.
      if (!response.ok && response.status !== 404) {
        const text = await response.text().catch(() => '');
        return fail(res, 502, 'Clio refused to remove a document', {
          documentId: id,
          status: response.status,
          response: text.slice(0, 300),
          removedBeforeFailure: removed,
        });
      }
      removed.push(Number(id));
    }

    console.log(`Removed ${removed.length} document(s) from Clio`);
    return res.status(200).json({ success: true, removed });
  }

  const { docxBase64, matter_id, documentName } = req.body || {};
  if (!docxBase64 || !matter_id) {
    return fail(res, 400, 'Missing required fields: docxBase64, matter_id');
  }

  const auth = await getClioAccessToken();
  if (!auth.token) return fail(res, 500, 'Clio authentication unavailable', auth.error);

  const fileName = `${documentName || 'document'}.docx`;
  const docxBuffer = Buffer.from(docxBase64, 'base64');

  try {
    const { documentId } = await uploadDocumentToMatter(auth.token, Number(matter_id), fileName, docxBuffer);
    console.log(`Document ${documentId} uploaded to Clio matter ${matter_id}`);

    // A 200 here means the file is genuinely visible on the matter.
    return res.status(200).json({
      success: true,
      message: 'Document uploaded to Clio',
      matter_id,
      documentName: fileName,
      clioDocumentId: documentId,
    });
  } catch (error: any) {
    console.error('Send to Clio error:', error);
    return fail(res, 502, 'Failed to send document to Clio', error?.message);
  }
}

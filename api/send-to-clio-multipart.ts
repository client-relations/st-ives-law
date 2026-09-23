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

import { CLIO_API, getClioAccessToken } from './clio-client';

type PutHeader = { name: string; value: string };

function fail(res: any, status: number, error: string, details?: unknown) {
  return res.status(status).json({ error, details });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');

  const { docxBase64, matter_id, documentName } = req.body || {};
  if (!docxBase64 || !matter_id) {
    return fail(res, 400, 'Missing required fields: docxBase64, matter_id');
  }

  const auth = await getClioAccessToken();
  if (!auth.token) return fail(res, 500, 'Clio authentication unavailable', auth.error);

  const fileName = `${documentName || 'document'}.docx`;
  const docxBuffer = Buffer.from(docxBase64, 'base64');
  const jsonHeaders = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  };

  try {
    // ---- 1. Create the document record, ask for the signed upload URL ----
    const createResponse = await fetch(
      `${CLIO_API}/documents.json?fields=id,name,latest_document_version{uuid,put_url,put_headers}`,
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          data: {
            name: fileName,
            parent: { id: Number(matter_id), type: 'Matter' },
            document_version: { fully_uploaded: false },
          },
        }),
      },
    );

    const createText = await createResponse.text();
    if (!createResponse.ok) {
      console.error('Clio create failed:', createResponse.status, createText);
      return fail(res, 502, 'Clio rejected the document record', {
        step: 'create',
        status: createResponse.status,
        response: createText.slice(0, 800),
      });
    }

    const created = JSON.parse(createText);
    const documentId = created?.data?.id;
    const version = created?.data?.latest_document_version;
    const putUrl: string | undefined = version?.put_url;
    const versionUuid: string | undefined = version?.uuid;
    const putHeaders: PutHeader[] = version?.put_headers || [];

    if (!documentId || !putUrl || !versionUuid) {
      return fail(res, 502, 'Clio did not return an upload URL', {
        step: 'create',
        response: createText.slice(0, 800),
      });
    }

    // ---- 2. PUT the raw bytes to the signed URL, with Clio's headers ----
    const uploadHeaders: Record<string, string> = {};
    for (const h of putHeaders) uploadHeaders[h.name] = h.value;

    const uploadResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: docxBuffer,
    });

    if (!uploadResponse.ok) {
      const uploadText = await uploadResponse.text().catch(() => '');
      console.error('Clio storage upload failed:', uploadResponse.status, uploadText);
      return fail(res, 502, 'Uploading the file to Clio storage failed', {
        step: 'upload',
        status: uploadResponse.status,
        response: uploadText.slice(0, 800),
      });
    }

    // ---- 3. Finalise so Clio surfaces the document on the matter ----
    const finaliseResponse = await fetch(
      `${CLIO_API}/documents/${documentId}.json?fields=id,name`,
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ data: { uuid: versionUuid, fully_uploaded: true } }),
      },
    );

    const finaliseText = await finaliseResponse.text();
    if (!finaliseResponse.ok) {
      console.error('Clio finalise failed:', finaliseResponse.status, finaliseText);
      return fail(res, 502, 'Clio stored the file but could not finalise it', {
        step: 'finalise',
        status: finaliseResponse.status,
        response: finaliseText.slice(0, 800),
      });
    }

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
    return fail(res, 500, 'Failed to send document to Clio', error?.message);
  }
}

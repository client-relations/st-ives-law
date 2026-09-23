/// <reference types="node" />

/**
 * Upload a generated DOCX straight into a Clio matter.
 *
 * Clio's v4 API does NOT accept a file inline (neither base64 in JSON nor a
 * single multipart POST). Uploading is a three-step handshake:
 *
 *   1. POST   /documents.json          -> create the record, receive a signed
 *                                         put_url + put_headers for S3
 *   2. PUT    <put_url>                -> upload the raw bytes to S3
 *   3. PATCH  /documents/{id}.json     -> mark fully_uploaded so Clio exposes it
 *
 * Earlier revisions tried to do this in one call (and against the US host),
 * which is why Clio answered "Bad Request" every time.
 */

const CLIO_API_BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com/api/v4';

type PutHeader = { name: string; value: string };

function jsonError(res: any, status: number, error: string, details?: unknown) {
  return res.status(status).json({ error, details });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const { docxBase64, matter_id, documentName } = req.body || {};

  if (!docxBase64 || !matter_id) {
    return jsonError(res, 400, 'Missing required fields: docxBase64, matter_id');
  }

  const clioToken = process.env.CLIO_API_TOKEN;
  if (!clioToken) {
    return jsonError(
      res,
      500,
      'CLIO_API_TOKEN is not configured',
      'Set CLIO_API_TOKEN in the Vercel project environment variables.',
    );
  }

  const fileName = `${documentName || 'document'}.docx`;
  const docxBuffer = Buffer.from(docxBase64, 'base64');

  const authHeaders = {
    Authorization: `Bearer ${clioToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // ---- Step 1: create the document record and get a signed upload URL ----
    const createUrl =
      `${CLIO_API_BASE}/documents.json` +
      `?fields=id,name,latest_document_version{uuid,put_url,put_headers}`;

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        data: {
          name: fileName,
          parent: { id: Number(matter_id), type: 'Matter' },
          document_version: { fully_uploaded: false },
        },
      }),
    });

    const createBody = await createResponse.text();
    if (!createResponse.ok) {
      console.error('Clio create failed:', createResponse.status, createBody);
      return jsonError(res, 502, 'Clio rejected the document record', {
        step: 'create',
        status: createResponse.status,
        response: createBody.slice(0, 1000),
      });
    }

    const created = JSON.parse(createBody);
    const documentId = created?.data?.id;
    const version = created?.data?.latest_document_version;
    const putUrl: string | undefined = version?.put_url;
    const putHeaders: PutHeader[] = version?.put_headers || [];
    const versionUuid: string | undefined = version?.uuid;

    if (!documentId || !putUrl || !versionUuid) {
      console.error('Clio create response missing upload fields:', createBody);
      return jsonError(res, 502, 'Clio did not return an upload URL', {
        step: 'create',
        response: createBody.slice(0, 1000),
      });
    }

    // ---- Step 2: PUT the raw bytes to the signed URL Clio handed back ----
    const uploadHeaders: Record<string, string> = {};
    for (const h of putHeaders) uploadHeaders[h.name] = h.value;

    const uploadResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: docxBuffer,
    });

    if (!uploadResponse.ok) {
      const uploadBody = await uploadResponse.text().catch(() => '');
      console.error('Clio S3 upload failed:', uploadResponse.status, uploadBody);
      return jsonError(res, 502, 'Uploading the file to Clio storage failed', {
        step: 'upload',
        status: uploadResponse.status,
        response: uploadBody.slice(0, 1000),
      });
    }

    // ---- Step 3: mark the version fully uploaded so Clio surfaces it ----
    const finalizeResponse = await fetch(
      `${CLIO_API_BASE}/documents/${documentId}.json?fields=id,name`,
      {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          data: { uuid: versionUuid, fully_uploaded: true },
        }),
      },
    );

    const finalizeBody = await finalizeResponse.text();
    if (!finalizeResponse.ok) {
      console.error('Clio finalize failed:', finalizeResponse.status, finalizeBody);
      return jsonError(res, 502, 'Clio accepted the file but could not finalise it', {
        step: 'finalize',
        status: finalizeResponse.status,
        response: finalizeBody.slice(0, 1000),
      });
    }

    console.log(`Document ${documentId} uploaded to Clio matter ${matter_id}`);

    // Only now is the document genuinely in Clio and visible on the matter.
    return res.status(200).json({
      success: true,
      message: 'Document uploaded to Clio',
      matter_id,
      documentName: fileName,
      clioDocumentId: documentId,
    });
  } catch (error: any) {
    console.error('Send to Clio error:', error);
    return jsonError(res, 500, 'Failed to send document to Clio', error?.message);
  }
}

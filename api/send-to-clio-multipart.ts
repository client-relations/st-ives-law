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
 * AUTH: prefers a refresh-token exchange (what Make does internally) so the
 * credential never expires. Falls back to a static CLIO_API_TOKEN, which does
 * expire — fine for a demo, not for production.
 */

import { requireLawyer, sendError } from './_lib/server.js';

const CLIO_BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
const CLIO_API = `${CLIO_BASE}/api/v4`;

type PutHeader = { name: string; value: string };

/** Cached across warm invocations so we don't re-exchange on every request. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Obtain a usable Clio access token.
 *
 * With CLIO_CLIENT_ID + CLIO_CLIENT_SECRET + CLIO_REFRESH_TOKEN set, this
 * mints a fresh access token on demand and nobody ever pastes a token again.
 * Refresh tokens do not expire unless revoked.
 */
async function getClioAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  const refreshToken = process.env.CLIO_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    // Reuse a cached token until a minute before it lapses.
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return { token: cachedToken.value };
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(`${CLIO_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('Clio token refresh failed:', response.status, text);
      return { error: `Clio refused the refresh token (${response.status}): ${text.slice(0, 300)}` };
    }

    try {
      const json = JSON.parse(text);
      if (!json.access_token) return { error: 'Clio returned no access_token' };
      cachedToken = {
        value: json.access_token,
        // expires_in is seconds; default to 1h if Clio omits it.
        expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
      };
      console.log('Clio access token refreshed');
      return { token: cachedToken.value };
    } catch {
      return { error: 'Clio token response was not valid JSON' };
    }
  }

  // Fallback: a manually pasted access token. Expires in days.
  const staticToken = process.env.CLIO_API_TOKEN;
  if (staticToken) return { token: staticToken };

  return {
    error:
      'No Clio credentials configured. Set CLIO_CLIENT_ID + CLIO_CLIENT_SECRET + ' +
      'CLIO_REFRESH_TOKEN (self-renewing), or CLIO_API_TOKEN (expires).',
  };
}

function fail(res: any, status: number, error: string, details?: unknown) {
  return res.status(status).json({ error, details });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');

  // Uploads into the firm's Clio account, so only a signed-in lawyer may call it.
  try {
    await requireLawyer(req);
  } catch (err) {
    return sendError(res, err);
  }

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

/// <reference types="node" />

/**
 * Fetch one Clio matter live, at the moment its documents are generated.
 *
 * The client table is served from the nightly mirror, but the values that go
 * into a will are read from Clio here, fresh. A day-old executor name is not an
 * acceptable thing to merge into a legal document.
 */

import { fetchMatter, getClioAccessToken, toTemplateVariables } from './clio-client';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const matterId = req.query?.matter_id;
  if (!matterId) {
    return res.status(400).json({ error: 'Missing required query param: matter_id' });
  }

  const auth = await getClioAccessToken();
  if (!auth.token) {
    return res.status(500).json({ error: 'Clio authentication unavailable', details: auth.error });
  }

  try {
    const matter = await fetchMatter(auth.token, matterId);
    return res.status(200).json({
      success: true,
      matter,
      // Pre-mapped so the caller can hand these straight to /api/generate-document.
      variables: toTemplateVariables(matter),
    });
  } catch (error: any) {
    console.error(`Failed to fetch Clio matter ${matterId}:`, error);
    return res.status(502).json({ error: 'Could not read the matter from Clio', details: error?.message });
  }
}

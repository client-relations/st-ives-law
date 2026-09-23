/// <reference types="node" />

/**
 * Refresh the local mirror of Clio matters.
 *
 * Runs on a schedule (a Make scenario hitting this URL — Vercel Cron on the
 * Hobby plan is capped at one run per day, and Make is already in this stack),
 * and on demand from the "Sync now" button on the document generation screen.
 *
 * Guard it with SYNC_SECRET. Without one this is a public URL that will happily
 * spend the firm's Clio rate limit for anyone who finds it.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchAllMatters, getClioAccessToken } from './clio-client';

export const config = {
  // A full pull is one request per 200 matters, plus any rate-limit backoff.
  // The Hobby ceiling is 60s; if the firm ever outgrows that, sync in pages.
  maxDuration: 60,
};

/**
 * Allow the scheduler (shared secret) or a signed-in lawyer (Supabase session).
 *
 * Vercel Cron can only issue a plain GET, so the secret is accepted as a query
 * param too. If neither SYNC_SECRET nor the anon key is configured there is
 * nothing to check against, and the endpoint refuses rather than opening up.
 */
async function isAuthorised(req: any, supabaseUrl: string): Promise<boolean> {
  const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');

  const expectedSecret = process.env.SYNC_SECRET;
  if (expectedSecret) {
    if (bearer === expectedSecret) return true;
    if (String(req.query?.secret || '') === expectedSecret) return true;
  }

  // Otherwise the caller must hold a valid Supabase session.
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (bearer && anonKey) {
    try {
      const client = createClient(supabaseUrl, anonKey);
      const { data, error } = await client.auth.getUser(bearer);
      if (!error && data?.user) return true;
    } catch (err) {
      console.warn('Could not verify the caller session:', err);
    }
  }

  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // Writing needs the service role: clio_matters is readable by signed-in
  // lawyers but not writable through the anon key, which ships in the bundle.
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Supabase not configured for writes',
      details:
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The anon key cannot write ' +
        'to clio_matters by design — see supabase_clio_matters.sql.',
    });
  }

  // Two callers, two ways in: the scheduler presents SYNC_SECRET, and the
  // "Sync now" button presents the signed-in lawyer's Supabase session. The
  // secret must never reach the browser, hence the second path.
  const allowed = await isAuthorised(req, supabaseUrl);
  if (!allowed) return res.status(401).json({ error: 'Unauthorized' });

  const auth = await getClioAccessToken();
  if (!auth.token) {
    return res.status(500).json({ error: 'Clio authentication unavailable', details: auth.error });
  }

  const startedAt = new Date();
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const matters = await fetchAllMatters(auth.token);
    console.log(`Fetched ${matters.length} matters from Clio`);

    if (matters.length === 0) {
      // An empty result is far more likely to be a permissions or filter
      // problem than a firm with no matters, and acting on it would delete the
      // entire mirror. Stop instead.
      return res.status(200).json({
        success: true,
        synced: 0,
        removed: 0,
        warning: 'Clio returned no matters; the mirror was left untouched.',
      });
    }

    const rows = matters.map((matter) => ({
      clio_id: matter.clio_id,
      display_number: matter.display_number,
      description: matter.description,
      status: matter.status,
      client_name: matter.client_name,
      client_type: matter.client_type,
      is_couple: matter.is_couple,
      mr_name: matter.mr_name,
      mrs_name: matter.mrs_name,
      custom_fields: matter.custom_fields,
      synced_at: startedAt.toISOString(),
    }));

    // Chunked so one oversized request can't fail the whole sync.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from('clio_matters')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'clio_id' });
      if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    // Anything the full pull didn't touch no longer exists in Clio. Safe to do
    // only because we reached here, meaning every page came back cleanly.
    const { data: removed, error: deleteError } = await supabase
      .from('clio_matters')
      .delete()
      .lt('synced_at', startedAt.toISOString())
      .select('clio_id');

    if (deleteError) {
      console.warn('Could not prune removed matters:', deleteError.message);
    }

    const durationMs = Date.now() - startedAt.getTime();
    console.log(`Clio sync complete: ${rows.length} matters in ${durationMs}ms`);

    return res.status(200).json({
      success: true,
      synced: rows.length,
      removed: removed?.length ?? 0,
      durationMs,
      syncedAt: startedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Clio sync failed:', error);
    return res.status(502).json({ error: 'Clio sync failed', details: error?.message });
  }
}

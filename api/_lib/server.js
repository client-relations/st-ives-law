// Shared helpers for the serverless API. Files under api/_lib are not routes.
//
// Every endpoint talks to Supabase with the SERVICE ROLE key, server-side only.
// The anon key is public (it ships in the browser bundle), so row-level
// security denies it everything; these endpoints are the only way a client
// reaches a form, and each one touches exactly the row it was asked about.

import { createClient } from '@supabase/supabase-js';

let adminClient = null;

/** Service-role Supabase client. Throws if the server is not configured. */
export function getAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(500, 'Server is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Send an error as JSON. Unexpected errors are logged and reported generically. */
export function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Server error' });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a form id taken from a request. */
export function requireFormId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!UUID.test(id)) throw new HttpError(400, 'Missing or invalid lead_id');
  return id;
}

/** Fetch one form by id, or throw 404. */
export async function loadForm(supabase, formId, columns = '*') {
  const { data, error } = await supabase.from('forms').select(columns).eq('id', formId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Form not found');
  return data;
}

/** form_data is jsonb, but some legacy rows hold a JSON string. */
export function parseFormData(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

/**
 * Authenticate a dashboard request. The browser sends the lawyer's Supabase
 * access token as `Authorization: Bearer <jwt>`; we verify it and resolve the
 * lawyer record by auth user id (falling back to a case-insensitive email
 * match for profiles that pre-date the auth_user_id column).
 */
export async function requireLawyer(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Not signed in');

  const supabase = getAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw new HttpError(401, 'Session expired — please sign in again');
  const user = userData.user;

  const { data: byId, error: byIdError } = await supabase
    .from('lawyers')
    .select('id, full_name, email, is_admin')
    .eq('auth_user_id', user.id)
    .limit(2);
  if (byIdError) throw byIdError;
  let rows = byId || [];

  if (rows.length === 0 && user.email) {
    const { data: byEmail, error: byEmailError } = await supabase
      .from('lawyers')
      .select('id, full_name, email, is_admin')
      .ilike('email', escapeLike(user.email.trim()))
      .is('auth_user_id', null)
      .limit(2);
    if (byEmailError) throw byEmailError;
    rows = byEmail || [];
  }

  if (rows.length === 0) throw new HttpError(403, 'No lawyer profile is linked to this account');
  if (rows.length > 1) throw new HttpError(403, 'More than one lawyer profile matches this account');
  return { user, lawyer: rows[0], supabase };
}

/** Can this lawyer act on this form? Admins can act on any. */
export function assertCanAccessForm(lawyer, form) {
  if (lawyer.is_admin) return;
  if (String(form.lawyer_id) !== String(lawyer.id)) {
    throw new HttpError(403, 'You do not have access to this form');
  }
}

/** Escape % and _ so a value can be used as an exact, case-insensitive ilike pattern. */
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Absolute URL for a link that is emailed to a client. Built from the
 * configured public origin — never from the request host or a preview
 * deployment URL, which the client could not open.
 */
export function publicUrl(path) {
  const base = process.env.PUBLIC_APP_URL;
  if (!base) throw new HttpError(500, 'PUBLIC_APP_URL is not configured');
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

const UNDELIVERABLE_DOMAINS = ['example.com', 'example.org', 'example.net', 'test', 'invalid', 'localhost'];

/** Returns a human-readable reason the address cannot receive mail, or null. */
export function validateRecipient(email) {
  const address = (email || '').trim();
  if (!address) return 'No email address on file for this client.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return `"${address}" is not a valid email address.`;
  const domain = address.split('@')[1].toLowerCase();
  if (UNDELIVERABLE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return `"${address}" uses a reserved test domain and cannot receive mail.`;
  }
  return null;
}

/**
 * POST a payload to a Make.com webhook.
 *
 * Make answers "Accepted" as soon as it has queued the scenario run, before any
 * email is sent or any Clio call is made. A success here therefore means
 * "queued", never "delivered".
 */
export async function postWebhook(url, payload, label) {
  if (!url) return { ok: false, detail: `${label} is not configured on the server.` };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.text().catch(() => '')).trim();
    if (!response.ok) {
      return { ok: false, detail: `${label} could not be queued (automation returned ${response.status}).` };
    }
    if (body && !/^accepted$/i.test(body)) {
      return { ok: false, detail: `${label} was rejected by the automation: ${body.slice(0, 200)}` };
    }
    return { ok: true, detail: `${label} queued.` };
  } catch (err) {
    console.error(`[webhook] ${label} failed`, err);
    return { ok: false, detail: `${label} could not reach the automation service.` };
  }
}

/** Read a JSON body regardless of whether the platform already parsed it. */
export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
  }
  return req.body;
}

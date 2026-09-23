import { supabase } from './supabase';

// Every dashboard mutation returns an ActionResult so the UI can always tell
// the lawyer what happened — never a bare boolean, never a console-only error.
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data: T }
  | { ok: false; error: string; code?: string };

const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
const fail = (error: string, code?: string): ActionResult<never> => ({ ok: false, error, code });

/** Turn any thrown value or PostgREST/network error into something readable. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    const message = (err as any).message as string;
    // supabase-js returns network failures as an error object, not a throw.
    if (/failed to fetch|networkerror|fetch failed|load failed/i.test(message)) {
      return 'Could not reach the server — check your internet connection and try again.';
    }
    if (/JWT|expired/i.test(message)) return 'Your session has expired — please sign in again.';
    if (/row-level security|permission denied/i.test(message)) return 'You do not have permission to do that.';
    return message;
  }
  return 'Something went wrong. Please try again.';
}

const STALE = 'This record was changed by someone else — the list has been refreshed.';

/**
 * Link shown to the lawyer to copy and send to a client. Built from the
 * configured public origin; a localhost or preview-deploy origin would give
 * the client a link only this browser can open.
 */
export function publicLink(path: string): { url: string; warning?: string } {
  const base = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (base) return { url: new URL(path, base.endsWith('/') ? base : `${base}/`).toString() };
  return {
    url: new URL(path, window.location.origin).toString(),
    warning: 'VITE_PUBLIC_APP_URL is not set, so this link uses the address in your browser. Check the client can open it.',
  };
}

/** JSON headers carrying the signed-in lawyer's token, for our /api endpoints. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your session has expired — please sign in again.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Call one of our /api endpoints as the signed-in lawyer. */
async function callApi<T = any>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status}).`);
  return json as T;
}

type EmailResult = { ok: boolean; detail: string };

async function sendClientEmail(kind: 'inquiry' | 'intake' | 'send_back', formId: string): Promise<EmailResult> {
  try {
    return await callApi<EmailResult>('/api/send-email', { kind, form_id: formId });
  } catch (err) {
    return { ok: false, detail: errorMessage(err) };
  }
}

// ── Leads ──────────────────────────────────────────────────────────────────

const QUALIFY_ERRORS: Record<string, string> = {
  LEAD_ALREADY_ACTIONED: 'This lead has already been qualified or rejected by someone else.',
  LEAD_NOT_FOUND: 'This lead no longer exists.',
  LAWYER_AMBIGUOUS: 'More than one lawyer has the name in "Person Responsible". Ask an admin to fix the lawyer list.',
  LAWYER_NOT_FOUND: 'The lawyer this lead belongs to no longer exists.',
  NOT_AUTHORISED: 'You do not have permission to qualify this lead.',
};

export type QualifyResult = { formId: string; email: EmailResult };

/**
 * Qualify a pending lead: creates the form and marks the lead qualified in
 * one database transaction (qualify_lead), then emails the inquiry form.
 * If the email fails the lead is still qualified; the result says so.
 */
export async function qualifyLead(screeningId: string): Promise<ActionResult<QualifyResult>> {
  try {
    const { data, error } = await supabase.rpc('qualify_lead', { p_screening_id: screeningId });
    if (error) {
      const known = Object.keys(QUALIFY_ERRORS).find((code) => error.message?.includes(code));
      return known ? fail(QUALIFY_ERRORS[known], known) : fail(errorMessage(error));
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.form_id) return fail('The lead was not qualified. Please try again.');

    const email = await sendClientEmail('inquiry', row.form_id);
    return ok({ formId: row.form_id, email });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Reject a lead — only if it is still pending. */
export async function rejectLead(screeningId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase
      .from('screening_submissions')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', screeningId)
      .eq('status', 'pending')
      .select('id');
    if (error) return fail(errorMessage(error));
    if (!data || data.length === 0) return fail(STALE, 'STALE');
    return ok(undefined, 'Lead rejected.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteLead(screeningId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.from('screening_submissions').delete().eq('id', screeningId).select('id');
    if (error) return fail(errorMessage(error));
    if (!data || data.length === 0) return fail('Nothing was deleted — it may already have been removed, or you lack permission.');
    return ok(undefined, 'Lead deleted.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export type NewPersonLead = {
  title: string;
  name: string;
  mobile: string;
  email: string;
  leadType: string;
  region: string;
  billingType: string;
  /** lawyers.id of the person responsible. */
  lawyerId: string;
  /** lawyers.full_name of the person responsible. */
  lawyerName: string;
};

/**
 * Create a pending lead, refusing duplicates: an email that is already a
 * pending lead, or that has a form still in the pipeline.
 * Emails are compared case-insensitively and stored lower-cased.
 */
export async function createPersonLead(input: NewPersonLead): Promise<ActionResult> {
  try {
    const email = input.email.trim().toLowerCase();

    // Checked across every lawyer's records by the database.
    const { data: inUse, error: checkError } = await supabase.rpc('lead_email_in_use', { p_email: email });
    if (checkError) return fail(errorMessage(checkError));
    if (inUse === 'PENDING_LEAD') return fail('This email is already a pending lead.');
    if (inUse === 'ACTIVE_FORM') return fail('This email already has a form in progress.');

    const { error: insertError } = await supabase.from('screening_submissions').insert({
      lawyer_id: input.lawyerId,
      contact_type: 'person',
      contact_data: {
        title: input.title,
        name: input.name.trim(),
        mobile: input.mobile.trim(),
        email,
      },
      lead_type: input.leadType,
      region: input.region,
      person_responsible: input.lawyerName,
      billing_type: input.billingType,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (insertError) {
      // 23505: the unique index on pending lead emails caught a race.
      if ((insertError as any).code === '23505') return fail('This email is already a pending lead.');
      return fail(errorMessage(insertError));
    }
    return ok(undefined, 'Lead added.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ── Forms ──────────────────────────────────────────────────────────────────

export type IntakeSentResult = { email: EmailResult };

/**
 * Move a scheduled form to pending_intake and email the intake form. The
 * status change is conditional on the form still being 'scheduled', so a
 * stale modal or a double-click cannot reset a client's progress.
 */
export async function sendIntakeForm(formId: string): Promise<ActionResult<IntakeSentResult>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('forms')
      .update({
        status: 'pending_intake',
        progress_pct: 0,
        last_accessed: now,
        intake_sent_at: now,
        reminder_3d_sent: null,
        reminder_1w_sent: null,
        reminder_2w_sent: null,
      })
      .eq('id', formId)
      .eq('status', 'scheduled')
      .select('id');
    if (error) return fail(errorMessage(error));
    if (!data || data.length === 0) return fail(STALE, 'STALE');

    const email = await sendClientEmail('intake', formId);
    return ok({ email });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Re-send the intake email for a form already waiting on the client. */
export async function resendIntakeEmail(formId: string): Promise<ActionResult> {
  const email = await sendClientEmail('intake', formId);
  return email.ok ? ok(undefined, email.detail) : fail(email.detail);
}

/** Email the client a list of the intake fields still missing. */
export async function sendBackForm(formId: string): Promise<ActionResult> {
  const email = await sendClientEmail('send_back', formId);
  return email.ok ? ok(undefined, email.detail) : fail(email.detail);
}

export async function deleteForm(formId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.from('forms').delete().eq('id', formId).select('id');
    if (error) return fail(errorMessage(error));
    if (!data || data.length === 0) return fail('Nothing was deleted — it may already have been removed, or you lack permission.');
    return ok(undefined, 'Form deleted.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/**
 * Queue the Clio matter for a completed intake. The server refuses a second
 * send unless `force` is set, and reports that as code ALREADY_SENT.
 */
export async function populateMatterToClio(formId: string, force = false): Promise<ActionResult> {
  try {
    const result = await callApi<{ ok: boolean; detail: string; already_populated_at?: unknown }>(
      '/api/populate-clio',
      { form_id: formId, force },
    );
    if (result.ok) return ok(undefined, result.detail);
    return fail(result.detail, result.already_populated_at ? 'ALREADY_SENT' : undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

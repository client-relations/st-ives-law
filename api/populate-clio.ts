/// <reference types="node" />

// Queues the Make scenario that creates a Clio matter for a completed intake.
//
// Guarded by a claim on forms.clio_populated_at so a double-click, a second
// lawyer, or a stale modal cannot create a duplicate matter. Re-sending an
// already-populated form needs an explicit `force: true` from the lawyer.
//
// Make acknowledges before it calls Clio, so success here means "queued".

import {
  HttpError,
  assertCanAccessForm,
  loadForm,
  parseFormData,
  postWebhook,
  readBody,
  requireFormId,
  requireLawyer,
  sendError,
} from './_lib/server.js';
import { buildClioPayload } from './_lib/clio-payload';

const CLIO_WEBHOOK = process.env.CLIO_MATTER_WEBHOOK || process.env.VITE_CLIO_MATTER_WEBHOOK || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lawyer, supabase } = await requireLawyer(req);
    const { form_id, force } = readBody(req);
    const formId = requireFormId(form_id);

    const form = await loadForm(supabase, formId);
    assertCanAccessForm(lawyer, form);
    if (form.status !== 'completed_intake') {
      throw new HttpError(409, 'Only completed intake forms can be sent to Clio.');
    }

    let claimed = false;
    if (!force) {
      const { data: claim, error: claimError } = await supabase
        .from('forms')
        .update({ clio_populated_at: new Date().toISOString() })
        .eq('id', formId)
        .is('clio_populated_at', null)
        .select('id');
      if (claimError) throw claimError;
      if (!claim || claim.length === 0) {
        return res.status(200).json({
          ok: false,
          already_populated_at: form.clio_populated_at || true,
          detail: 'This form has already been sent to Clio.',
        });
      }
      claimed = true;
    }

    let result: { ok: boolean; detail: string };
    try {
      const formData = parseFormData(form.form_data);
      const intakeData = formData.intake || {};
      const inquiryData = formData.inquiry || {};

      // The intake form is the later, more detailed source and wins on any field
      // both collect; inquiry only fills genuine gaps.
      const merged: Record<string, any> = { ...inquiryData };
      for (const [key, value] of Object.entries(intakeData as Record<string, any>)) {
        const isEmpty = value === undefined || value === null || value === '';
        if (!isEmpty || !(key in merged)) merged[key] = value;
      }

      result = await postWebhook(CLIO_WEBHOOK, buildClioPayload(merged, form, formData.metadata || {}), 'Clio matter');
    } catch (err) {
      console.error('[populate-clio] building or sending the payload failed', err);
      result = { ok: false, detail: 'The Clio payload could not be built from this form. Nothing was sent.' };
    }

    if (!result.ok) {
      if (claimed) {
        await supabase.from('forms').update({ clio_populated_at: null }).eq('id', formId);
      }
      return res.status(200).json({ ok: false, detail: result.detail });
    }

    if (force) {
      await supabase.from('forms').update({ clio_populated_at: new Date().toISOString() }).eq('id', formId);
    }

    return res.status(200).json({
      ok: true,
      detail: 'Sent to Make for Clio. Check Clio in a minute — this confirms Make received it, not that Clio accepted it.',
    });
  } catch (err) {
    return sendError(res, err);
  }
}

import {
  HttpError,
  getAdminClient,
  loadForm,
  parseFormData,
  readBody,
  requireFormId,
  sendError,
} from './_lib/server.js';

const TOTAL_STEPS = 14;
const EDITABLE_STATUSES = ['pending_intake', 'completed_intake'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lead_id, form_data, step: rawStep } = readBody(req);
    const formId = requireFormId(lead_id);
    if (!form_data || typeof form_data !== 'object' || Array.isArray(form_data)) {
      throw new HttpError(400, 'Missing form_data');
    }
    const step = Number(rawStep);
    if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) {
      throw new HttpError(400, `step must be a whole number from 1 to ${TOTAL_STEPS}`);
    }

    const supabase = getAdminClient();
    const form = await loadForm(supabase, formId, 'id, status, form_data');
    if (!EDITABLE_STATUSES.includes(form.status)) {
      throw new HttpError(409, 'This form can no longer be changed. Please contact the firm.');
    }

    const existing = parseFormData(form.form_data);
    const metadata = { ...(existing.metadata || {}), current_step: step };
    if (step === TOTAL_STEPS) {
      metadata.will_pdf_path = `/wills/will_${formId}_${Date.now()}.pdf`;
    }

    const newStatus = step === TOTAL_STEPS && form.status === 'pending_intake' ? 'completed_intake' : form.status;
    const progressPct = Math.round((step / TOTAL_STEPS) * 100);

    const { data: updated, error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: { ...existing, intake: form_data, metadata },
        progress_pct: progressPct,
        last_accessed: new Date().toISOString(),
        status: newStatus,
      })
      .eq('id', formId)
      .eq('status', form.status)
      .select('id');

    if (updateError) throw updateError;
    if (!updated || updated.length === 0) {
      throw new HttpError(409, 'This form was changed by the firm while you were editing. Please reload the page.');
    }

    return res.status(200).json({
      success: true,
      message: 'Intake form saved',
      lead_id: formId,
      step,
      progress_pct: progressPct,
      status: newStatus,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

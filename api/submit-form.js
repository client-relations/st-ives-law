import {
  HttpError,
  getAdminClient,
  loadForm,
  parseFormData,
  readBody,
  requireFormId,
  sendError,
} from './_lib/server.js';

// Which stage of the pipeline may still write each part of form_data, and the
// status it moves to on submission. Anything else is rejected, so a client
// cannot rewrite a form after the firm has moved it on, and cannot overwrite
// other keys (metadata, the other form) by choosing their own form_type.
const RULES = {
  inquiry: { allowed: ['appointment_sent', 'scheduled'], advance: { appointment_sent: 'scheduled' } },
  intake: { allowed: ['pending_intake', 'completed_intake'], advance: { pending_intake: 'completed_intake' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lead_id, form_data, form_type } = readBody(req);
    const formId = requireFormId(lead_id);
    const rule = RULES[form_type];
    if (!rule) throw new HttpError(400, 'Invalid form_type');
    if (!form_data || typeof form_data !== 'object' || Array.isArray(form_data)) {
      throw new HttpError(400, 'Missing form_data');
    }

    const supabase = getAdminClient();
    const form = await loadForm(supabase, formId, 'id, status, form_data');
    if (!rule.allowed.includes(form.status)) {
      throw new HttpError(409, 'This form can no longer be changed. Please contact the firm.');
    }

    const newStatus = rule.advance[form.status] || form.status;
    const existing = parseFormData(form.form_data);

    // Conditional on the status we read, so a concurrent change by the firm
    // wins instead of being overwritten.
    const { data: updated, error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: { ...existing, [form_type]: form_data },
        status: newStatus,
        last_accessed: new Date().toISOString(),
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
      message: 'Form submitted successfully',
      lead_id: formId,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

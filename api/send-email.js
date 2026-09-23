// Sends a client email through Make, on behalf of a signed-in lawyer.
//
// The webhook URLs live only in server env vars, and the recipient, name and
// link are read from the stored form — the browser only says which form and
// which email. Previously the dashboard posted straight to Make with URLs
// shipped in the JS bundle, so anyone could send firm-branded mail anywhere.

import {
  HttpError,
  assertCanAccessForm,
  loadForm,
  parseFormData,
  postWebhook,
  publicUrl,
  readBody,
  requireFormId,
  requireLawyer,
  sendError,
  validateRecipient,
} from './_lib/server.js';
import { generateMissingFieldsMessage, validateIntakeForm } from './_lib/send-back.js';

const env = (name) => process.env[name] || process.env[`VITE_${name}`] || '';

const KINDS = {
  inquiry: {
    label: 'Inquiry form email',
    webhook: () => env('SEND_INQUIRY_FORM_WEBHOOK'),
    statuses: ['appointment_sent'],
    path: (id) => `/lead-inquiry?lead_id=${id}`,
  },
  intake: {
    label: 'Intake form email',
    webhook: () => env('SEND_INTAKE_FORM_WEBHOOK'),
    statuses: ['pending_intake'],
    path: (id) => `/intake-form?lead_id=${id}`,
  },
  send_back: {
    label: 'Send-back email',
    webhook: () => env('SEND_BACK_WEBHOOK'),
    statuses: ['completed_intake'],
    path: (id) => `/intake-form?lead_id=${id}`,
  },
};

/**
 * qualify_lead() gives the new form to the lead's person responsible, who may
 * not be the lawyer qualifying it. That lawyer still sends the first
 * (inquiry) email, so they may act on a form created from their own lead.
 */
async function ownsSourceLead(supabase, lawyer, form, kind) {
  if (kind !== 'inquiry' || !form.screening_id) return false;
  const { data, error } = await supabase
    .from('screening_submissions')
    .select('lawyer_id')
    .eq('id', form.screening_id)
    .maybeSingle();
  if (error) throw error;
  return !!data && String(data.lawyer_id) === String(lawyer.id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lawyer, supabase } = await requireLawyer(req);
    const { kind, form_id } = readBody(req);
    const spec = KINDS[kind];
    if (!spec) throw new HttpError(400, 'Unknown email kind');
    const formId = requireFormId(form_id);

    const form = await loadForm(supabase, formId);
    if (!(await ownsSourceLead(supabase, lawyer, form, kind))) {
      assertCanAccessForm(lawyer, form);
    }
    if (!spec.statuses.includes(form.status)) {
      throw new HttpError(409, `This form is no longer at a stage where the ${spec.label.toLowerCase()} can be sent.`);
    }

    const invalid = validateRecipient(form.client_email);
    if (invalid) {
      return res.status(200).json({ ok: false, detail: invalid });
    }

    const payload = {
      form_id: form.id,
      client_name: form.client_name,
      client_email: form.client_email.trim(),
      form_link: publicUrl(spec.path(form.id)),
      sent_at: new Date().toISOString(),
    };

    if (kind === 'send_back') {
      const formData = parseFormData(form.form_data);
      const validation = validateIntakeForm({ ...(formData.intake || {}), ...(formData.inquiry || {}) });
      payload.missing_fields = validation.missingFields;
      payload.missing_count = validation.missingFields.length;
      payload.missing_fields_message = generateMissingFieldsMessage(validation.missingFields);
    }

    const result = await postWebhook(spec.webhook(), payload, spec.label);

    if (result.ok && kind === 'send_back') {
      const { error } = await supabase
        .from('forms')
        .update({ send_back_at: new Date().toISOString(), send_back_count: (form.send_back_count || 0) + 1 })
        .eq('id', form.id);
      if (error) console.error('Could not record send-back', error);
    }

    return res.status(200).json({
      ok: result.ok,
      detail: result.ok ? `${spec.label} queued for ${payload.client_email}.` : result.detail,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

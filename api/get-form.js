import { getAdminClient, loadForm, parseFormData, requireFormId, sendError } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formId = requireFormId(req.query.lead_id);
    const supabase = getAdminClient();
    const form = await loadForm(supabase, formId, 'form_data, status, client_name, client_email');

    return res.status(200).json({
      success: true,
      data: parseFormData(form.form_data),
      status: form.status,
      // Returned so the client-facing forms can prefill the details the firm
      // already captured at screening, instead of asking for them again.
      client: {
        name: form.client_name || '',
        email: form.client_email || '',
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

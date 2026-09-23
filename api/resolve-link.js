// Resolves a legacy `/?uniqueLink=<token>` link (sent in older reminder
// emails) to the form id, so the app can forward the client to the real
// intake form. Returns only the id — nothing about the client.

import { HttpError, getAdminClient, sendError } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!/^[a-z0-9]{8,64}$/i.test(token)) throw new HttpError(400, 'Invalid link');

    const { data, error } = await getAdminClient()
      .from('forms')
      .select('id, status')
      .eq('unique_link', token)
      .limit(2);
    if (error) throw error;
    if (!data || data.length !== 1) throw new HttpError(404, 'This link is no longer valid');

    const { id, status } = data[0];
    const target = status === 'appointment_sent' || status === 'scheduled' ? 'lead-inquiry' : 'intake-form';
    return res.status(200).json({ lead_id: id, target });
  } catch (err) {
    return sendError(res, err);
  }
}

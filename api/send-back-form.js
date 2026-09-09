import { createClient } from '@supabase/supabase-js';
import { validateIntakeForm, formatMissingFields } from './validate-intake.js';

const SEND_BACK_WEBHOOK = process.env.VITE_SEND_BACK_WEBHOOK || 'https://hook.eu2.make.com/placeholder';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { lead_id, reason } = req.body; // reason: 'incomplete' | 'reminder_3d' | 'reminder_1w' | 'reminder_2w'

    if (!lead_id) {
      return res.status(400).json({ error: 'Missing lead_id' });
    }

    // Fetch form
    const { data: form, error: fetchError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Parse form data
    let intakeData = form.form_data;
    if (typeof intakeData === 'string') {
      intakeData = JSON.parse(intakeData || '{}');
    }
    intakeData = intakeData.intake || {};

    // Validate and get missing fields
    const validation = validateIntakeForm(intakeData);
    const formattedMissing = formatMissingFields(validation.missing_fields);

    // Build email payload
    const emailPayload = {
      form_id: lead_id,
      client_name: form.client_name,
      client_email: form.client_email,
      reason: reason || 'incomplete',
      missing_fields: formattedMissing,
      missing_count: validation.missing_fields.length,
      form_link: `${process.env.VERCEL_URL || 'https://st-ives.vercel.app'}/intake-form?lead_id=${lead_id}`,
      message: reason === 'incomplete'
        ? `Please complete your estate planning form. The following information is missing:`
        : `Reminder: Your estate planning form is incomplete. Please complete the following:`,
      sent_at: new Date().toISOString(),
    };

    // Send email via webhook
    let webhookResponse;
    try {
      webhookResponse = await fetch(SEND_BACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!webhookResponse.ok) {
        console.warn('Webhook send failed but form was flagged for send-back');
      }
    } catch (webhookErr) {
      console.warn('Webhook error:', webhookErr.message);
    }

    // Update form: record send-back attempt
    const { error: updateError } = await supabase
      .from('forms')
      .update({
        send_back_at: new Date().toISOString(),
        send_back_count: (form.send_back_count || 0) + 1,
        last_accessed: new Date().toISOString(),
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('Error updating form:', updateError);
    }

    return res.status(200).json({
      success: true,
      message: 'Form send-back initiated',
      lead_id,
      missing_fields: validation.missing_fields,
      formatted_missing: formattedMissing,
      email_sent: webhookResponse?.ok || false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}

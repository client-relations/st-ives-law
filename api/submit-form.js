import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check env vars
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return res.status(500).json({ error: 'SUPABASE_URL not set' });
    }
    if (!supabaseKey) {
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY not set' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { lead_id, form_data, form_type } = req.body;

    if (!lead_id || !form_data) {
      return res.status(400).json({ error: 'Missing lead_id or form_data' });
    }

    // Fetch form
    const { data: form, error: fetchError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Form not found', details: fetchError.message });
    }

    // Parse form_data
    const parsedFormData = typeof form.form_data === 'string'
      ? JSON.parse(form.form_data || '{}')
      : (form.form_data || {});

    // Determine new status
    let newStatus = form.status;
    console.log('DEBUG:', { form_type, current_status: form.status, newStatus_before: newStatus });

    if (form_type === 'inquiry' && form.status === 'appointment_sent') {
      newStatus = 'scheduled';
    } else if (form_type === 'intake' && form.status === 'pending_intake') {
      newStatus = 'completed_intake';
    }

    console.log('DEBUG:', { newStatus_after: newStatus });

    // Update
    const { error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: {
          ...parsedFormData,
          [form_type]: form_data,
        },
        status: newStatus,
        last_accessed: new Date().toISOString(),
      })
      .eq('id', lead_id);

    if (updateError) {
      return res.status(500).json({ error: 'Update failed', details: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Form submitted successfully',
      lead_id,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message, stack: error.stack });
  }
}

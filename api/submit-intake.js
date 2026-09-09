import { createClient } from '@supabase/supabase-js';

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
    const { lead_id, form_data, step, form_type } = req.body;

    if (!lead_id || !form_data || step === undefined) {
      return res.status(400).json({ error: 'Missing lead_id, form_data, or step' });
    }

    // Fetch current form
    const { data: form, error: fetchError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Form not found', details: fetchError.message });
    }

    // Parse existing form_data
    const parsedFormData = typeof form.form_data === 'string'
      ? JSON.parse(form.form_data || '{}')
      : (form.form_data || {});

    // Merge intake data
    const updatedFormData = {
      ...parsedFormData,
      intake: form_data,
    };

    // Calculate progress percentage (step/14 * 100)
    const progressPct = Math.round((step / 14) * 100);

    // Determine new status based on step completion
    let newStatus = form.status;
    if (step === 14 && form.status === 'pending_intake') {
      // Form fully completed
      newStatus = 'completed_intake';
    }

    // Update form
    const { error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: updatedFormData,
        progress_pct: progressPct,
        last_accessed: new Date().toISOString(),
        status: newStatus,
      })
      .eq('id', lead_id);

    if (updateError) {
      return res.status(500).json({ error: 'Update failed', details: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Intake form saved',
      lead_id,
      step,
      progress_pct: progressPct,
      status: newStatus,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}

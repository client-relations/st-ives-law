import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('Supabase Key:', supabaseKey ? 'SET' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lead_id, form_data, form_type } = req.body;

    console.log('Received submission:', { lead_id, form_type, dataKeys: Object.keys(form_data || {}) });

    if (!lead_id || !form_data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the form record
    console.log('Fetching form:', lead_id);
    const { data: form, error: fetchError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(404).json({ error: 'Form not found', details: fetchError.message });
    }

    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    console.log('Form found, current status:', form.status);

    // Determine new status based on form type
    let newStatus = form.status;
    if (form_type === 'inquiry' && form.status === 'appointment_sent') {
      newStatus = 'scheduled';
    } else if (form_type === 'intake' && form.status === 'pending_intake') {
      newStatus = 'completed_intake';
    }

    console.log('Updating form, new status:', newStatus);

    // Update form_data in the forms table
    const { error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: {
          ...form.form_data,
          [form_type]: form_data,
        },
        status: newStatus,
        last_accessed: new Date().toISOString(),
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to save form data', details: updateError.message });
    }

    console.log('Form updated successfully');
    return res.status(200).json({
      success: true,
      message: 'Form submitted successfully',
      lead_id,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return res.status(500).json({ error: error.message });
  }
}

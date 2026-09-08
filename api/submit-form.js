import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

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

    if (!lead_id || !form_data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the form record
    const { data: form, error: fetchError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError || !form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Update form_data in the forms table
    const { error: updateError } = await supabase
      .from('forms')
      .update({
        form_data: {
          ...form.form_data,
          [form_type]: form_data,
        },
        status: 'in_progress',
        last_accessed: new Date().toISOString(),
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to save form data' });
    }

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

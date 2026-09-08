import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lead_id } = req.query;

    if (!lead_id) {
      return res.status(400).json({ error: 'Missing lead_id' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: form, error } = await supabase
      .from('forms')
      .select('form_data, status')
      .eq('id', lead_id)
      .single();

    if (error || !form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Parse form_data if it's a string
    const formData = typeof form.form_data === 'string'
      ? JSON.parse(form.form_data || '{}')
      : (form.form_data || {});

    return res.status(200).json({
      success: true,
      data: formData.inquiry || {},
      status: form.status,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

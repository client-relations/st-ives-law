import { useState, useEffect, useCallback } from 'react';
import { supabase, Form, Submission } from '../lib/supabase';

export function useSupabaseForms() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all forms for current user
  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setForms(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch forms');
      console.error('Error fetching forms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new form
  const createForm = useCallback(async (clientName: string, clientEmail?: string, formType: string = 'estate_planning') => {
    try {
      const uniqueLink = `${formType}-${Math.random().toString(36).slice(2, 10)}`;

      const { data, error: err } = await supabase
        .from('forms')
        .insert({
          form_type: formType,
          client_name: clientName,
          client_email: clientEmail,
          status: 'not_sent',
          progress_pct: 0,
          unique_link: uniqueLink,
          form_data: {},
        })
        .select()
        .single();

      if (err) throw err;
      setForms(prev => [data, ...prev]);
      return { formId: data.id, uniqueLink };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create form';
      setError(errorMsg);
      throw err;
    }
  }, []);

  // Get single form by ID
  const getForm = useCallback(async (formId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (err) throw err;
      return data as Form;
    } catch (err) {
      console.error('Error fetching form:', err);
      throw err;
    }
  }, []);

  // Get form by unique link
  const getFormByLink = useCallback(async (uniqueLink: string) => {
    try {
      const { data, error: err } = await supabase
        .from('forms')
        .select('*')
        .eq('unique_link', uniqueLink)
        .single();

      if (err) throw err;
      return data as Form;
    } catch (err) {
      console.error('Error fetching form by link:', err);
      throw err;
    }
  }, []);

  // Auto-save form data
  const updateFormData = useCallback(async (formId: string, formData: Record<string, any>, progressPct: number) => {
    try {
      const { error: err } = await supabase
        .from('forms')
        .update({
          form_data: formData,
          progress_pct: progressPct,
          last_accessed: new Date().toISOString(),
        })
        .eq('id', formId);

      if (err) throw err;
    } catch (err) {
      console.error('Error updating form:', err);
      // Don't throw - auto-save should be silent
    }
  }, []);

  // Mark form as complete (client finishes filling it out)
  const completeForm = useCallback(async (formId: string) => {
    try {
      // Fetch form data first
      const { data: form } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (!form) throw new Error('Form not found');

      // Update form status
      const { error: err } = await supabase
        .from('forms')
        .update({
          status: 'completed',
          progress_pct: 100,
          marked_complete_at: new Date().toISOString(),
        })
        .eq('id', formId);

      if (err) throw err;

      // Send completion webhook
      const EMAIL_CONFIRMATION_WEBHOOK = import.meta.env.VITE_EMAIL_CONFIRMATION_WEBHOOK || 'https://hook.eu2.make.com/6xtuj8hqbt68f90v8y4iy3u3lylrs2hw';
      try {
        await fetch(EMAIL_CONFIRMATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            form_id: formId,
            client_name: form.client_name,
            client_email: form.client_email,
            completed_at: new Date().toISOString(),
          }),
        });
      } catch (webhookErr) {
        console.warn('Webhook send failed but form was marked complete:', webhookErr);
      }

      await fetchForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete form');
      throw err;
    }
  }, [fetchForms]);

  // Send form to Smokeball (lawyer clicks button)
  const sendToSmokeball = useCallback(async (formId: string, webhookUrl: string) => {
    try {
      // Get the completed form data
      const form = await getForm(formId);
      const { aData, bData, cData, dData } = form.form_data;

      // Dynamic import to avoid circular dependency
      const { buildFinalPayload } = await import('../utils/webhookBuilder');
      const payload = buildFinalPayload(aData, bData, cData, dData, formId);

      // Send to Smokeball webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);

      // Update form status to submitted
      const { error: updateErr } = await supabase
        .from('forms')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', formId);

      if (updateErr) throw updateErr;
      await fetchForms();

      return { status: 'submitted', form_id: formId };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send to Smokeball';
      setError(errorMsg);
      throw err;
    }
  }, [getForm, fetchForms]);

  // Get form progress
  const getFormProgress = useCallback(async (formId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('forms')
        .select('progress_pct, status')
        .eq('id', formId)
        .single();

      if (err) throw err;
      return data;
    } catch (err) {
      console.error('Error getting form progress:', err);
      throw err;
    }
  }, []);

  // Subscribe to form updates (real-time)
  const subscribeToForm = useCallback((formId: string, callback: (form: Form) => void) => {
    const subscription = supabase
      .from(`forms:id=eq.${formId}`)
      .on('*', payload => {
        callback(payload.new as Form);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Delete form
  const deleteForm = useCallback(async (formId: string) => {
    try {
      const { error: err } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);

      if (err) throw err;
      setForms(prev => prev.filter(f => f.id !== formId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete form';
      setError(errorMsg);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  return {
    forms,
    loading,
    error,
    fetchForms,
    createForm,
    getForm,
    getFormByLink,
    updateFormData,
    completeForm,
    sendToSmokeball,
    getFormProgress,
    subscribeToForm,
    deleteForm,
  };
}

import { supabase } from './supabase';

// Webhook URLs (Make integration)
const MAKE_CLIO_WEBHOOK = 'https://hook.eu2.make.com/7kdud7kq1fjfb4d83f5h4o9o0qou1lgr';
const SMOKEBALL_WEBHOOK = import.meta.env.VITE_WEBHOOK_URL || 'https://hook.eu2.make.com/fou12e2mjy2wgv2h0e3jgqor7fu81rec';
const SEND_FORM_EMAIL_WEBHOOK = import.meta.env.VITE_SEND_FORM_EMAIL_WEBHOOK || 'https://hook.eu2.make.com/f6lbcoppzzdjl7r5dh7i0uqpo3yx68y2';
const REMINDER_WEBHOOK = import.meta.env.VITE_REMINDER_WEBHOOK || 'https://hook.eu2.make.com/mjiv8gg69a3dn5ktex4tqlj5j1oji5fk';
const EMAIL_CONFIRMATION_WEBHOOK = import.meta.env.VITE_EMAIL_CONFIRMATION_WEBHOOK || 'https://hook.eu2.make.com/6xtuj8hqbt68f90v8y4iy3u3lylrs2hw';

export async function qualifyLead(screeningId: string, personResponsible: string) {
  try {
    console.log('qualifyLead called with personResponsible:', personResponsible);

    if (!supabase) throw new Error('Database connection error');

    // Create a form from the screening submission
    const { data: screening } = await supabase
      .from('screening_submissions')
      .select('*')
      .eq('id', screeningId)
      .single();

    if (!screening) throw new Error('Screening not found');
    console.log('Screening found:', screening);

    // Look up lawyer ID by person_responsible name
    const { data: lawyer, error: lawyerError } = await supabase
      .from('lawyers')
      .select('id')
      .eq('full_name', personResponsible)
      .single();

    console.log('Lawyer lookup result:', { lawyer, lawyerError });

    if (lawyerError) throw lawyerError;
    if (!lawyer) throw new Error(`Lawyer "${personResponsible}" not found`);

    // Insert new form (extract name/email from contact_data)
    const uniqueLink = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .insert({
        lawyer_id: lawyer.id,
        client_name: screening.contact_data?.name || 'Unknown',
        client_email: screening.contact_data?.email || '',
        lead_type: screening.lead_type,
        region: screening.region,
        referral_type: screening.referral_type,
        billing_type: screening.billing_type,
        person_responsible: screening.person_responsible || '',
        status: 'appointment_sent',
        progress_pct: 0,
        unique_link: uniqueLink,
        created_at: new Date().toISOString(),
      })
      .select();

    if (formError) throw formError;

    const formRecord = formData?.[0];
    if (!formRecord) throw new Error('Failed to create form record');

    // WEBHOOK DISABLED - will re-enable with new Supabase
    // Trigger webhook to send form to client
    if (formRecord) {
      try {
        // const response = await fetch(SEND_FORM_EMAIL_WEBHOOK, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     form_id: formRecord.id,
        //     client_name: formRecord.client_name,
        //     client_email: formRecord.client_email,
        //     lead_type: formRecord.lead_type,
        //     form_link: `${window.location.origin}/lead-inquiry?lead_id=${formRecord.id}`,
        //   }),
        // });
        // if (!response.ok) {
        //   console.warn('Webhook send failed but form was created');
        // }
      } catch (webhookErr) {
        // console.error('Error triggering form send webhook:', webhookErr);
      }
    }

    // Update screening status to qualified
    const { error: updateError } = await supabase
      .from('screening_submissions')
      .update({ status: 'qualified' })
      .eq('id', screeningId);

    if (updateError) throw updateError;
    return formRecord.id;
  } catch (err) {
    console.error('Error qualifying lead:', err);
    return null;
  }
}

export async function rejectLead(screeningId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { error } = await supabase
      .from('screening_submissions')
      .update({ status: 'rejected' })
      .eq('id', screeningId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error rejecting lead:', err);
    return false;
  }
}

export async function deprioritizeLead(screeningId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { error } = await supabase
      .from('screening_submissions')
      .update({ status: 'deprioritized' })
      .eq('id', screeningId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deprioritizing lead:', err);
    return false;
  }
}

export async function updateFormProgress(formId: string, progressPct: number) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { error } = await supabase
      .from('forms')
      .update({ progress_pct: progressPct })
      .eq('id', formId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating form progress:', err);
    return false;
  }
}

export async function markFormComplete(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch form data before updating
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form not found');

    // Update form status
    const { error } = await supabase
      .from('forms')
      .update({
        status: 'completed',
        progress_pct: 100,
        marked_complete_at: new Date().toISOString(),
      })
      .eq('id', formId);

    if (error) throw error;

    // Send completion confirmation webhook
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

    return true;
  } catch (err) {
    console.error('Error marking form complete:', err);
    return false;
  }
}

export async function submitFormToSmokeball(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch form data
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form not found');

    // Update status in database
    const { error } = await supabase
      .from('forms')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', formId);

    if (error) throw error;

    // Parse form data and build proper Smokeball webhook payload
    let formData = form.form_data;
    if (typeof formData === 'string') {
      formData = JSON.parse(formData);
    }

    const aData = formData?.aData || {};
    const bData = formData?.bData || {};
    const cData = formData?.cData || {};
    const dData = formData?.dData || {};

    // Dynamic import to avoid circular dependency
    const { buildFinalPayload } = await import('../utils/webhookBuilder');
    const payload = buildFinalPayload(aData, bData, cData, dData, formId);

    // WEBHOOK DISABLED - will re-enable with new Supabase
    // Send webhook to Make for Smokeball submission
    // await fetch(SMOKEBALL_WEBHOOK, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });

    return true;
  } catch (err) {
    console.error('Error submitting to Smokeball:', err);
    return false;
  }
}

export async function markFormOverdue(formId: string, daysOverdue: number) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch form to get client details for webhook
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form not found');

    const { error } = await supabase
      .from('forms')
      .update({
        status: 'overdue',
        days_overdue: daysOverdue,
      })
      .eq('id', formId);

    if (error) throw error;

    // Send overdue reminder webhook
    try {
      await fetch(REMINDER_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: formId,
          client_name: form.client_name,
          client_email: form.client_email,
          reminder_type: 'overdue',
          days_overdue: daysOverdue,
          sent_at: new Date().toISOString(),
        }),
      });
    } catch (webhookErr) {
      console.warn('Overdue webhook send failed:', webhookErr);
    }

    return true;
  } catch (err) {
    console.error('Error marking form overdue:', err);
    return false;
  }
}

export async function sendFormToClient(formId: string, clientEmail: string, clientName: string, formLink: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const payload = {
      form_id: formId,
      client_name: clientName,
      client_email: clientEmail,
      form_link: formLink,
      sent_at: new Date().toISOString(),
    };

    await fetch(SEND_FORM_EMAIL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (err) {
    console.error('Error sending form to client:', err);
    return false;
  }
}

export async function sendReminder(formId: string, clientEmail: string, clientName: string, reminderType: '3d' | '1w' | '2w') {
  try {
    if (!supabase) throw new Error('Database connection error');

    const payload = {
      form_id: formId,
      client_name: clientName,
      client_email: clientEmail,
      reminder_type: reminderType,
      sent_at: new Date().toISOString(),
    };

    await fetch(REMINDER_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (err) {
    console.error('Error sending reminder:', err);
    return false;
  }
}

export async function deprioritizeForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { error } = await supabase
      .from('forms')
      .update({ status: 'deprioritized' })
      .eq('id', formId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deprioritizing form:', err);
    return false;
  }
}

export async function sendIntakeForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form not found');

    // Update status: scheduled → pending_intake, reset progress to 0
    const { error } = await supabase
      .from('forms')
      .update({
        status: 'pending_intake',
        progress_pct: 0,
        last_accessed: new Date().toISOString(),
      })
      .eq('id', formId);

    if (error) throw error;

    console.log('Intake form sent, status updated to pending_intake');
    return true;
  } catch (err) {
    console.error('Error sending intake form:', err);
    return false;
  }
}

export async function deleteForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const { error } = await supabase
      .from('forms')
      .delete()
      .eq('id', formId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting form:', err);
    return false;
  }
}

export async function sendBackForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    const response = await fetch('/api/send-back-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: formId,
        reason: 'incomplete',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send back form');
    }

    const result = await response.json();
    console.log('Form send-back initiated:', result);
    return true;
  } catch (err) {
    console.error('Error sending back form:', err);
    return false;
  }
}

export async function duplicateForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch original form
    const { data: originalForm } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!originalForm) throw new Error('Form not found');

    // Create new form with same data
    const { data: newForm, error } = await supabase
      .from('forms')
      .insert({
        lawyer_id: originalForm.lawyer_id,
        client_name: originalForm.client_name,
        client_email: originalForm.client_email,
        lead_type: originalForm.lead_type,
        region: originalForm.region,
        referral_type: originalForm.referral_type,
        billing_type: originalForm.billing_type,
        person_responsible: originalForm.person_responsible,
        status: originalForm.status,
        progress_pct: originalForm.progress_pct,
        unique_link: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        form_data: originalForm.form_data,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;

    const duplicatedForm = newForm?.[0];
    console.log('Form duplicated:', duplicatedForm?.id);
    return duplicatedForm?.id || null;
  } catch (err) {
    console.error('Error duplicating form:', err);
    return null;
  }
}

export async function populateMatterToClio(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch complete form data
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (!form) throw new Error('Form not found');

    // Parse form data
    let formData = form.form_data;
    if (typeof formData === 'string') {
      formData = JSON.parse(formData);
    }

    const intakeData = formData.intake || {};
    const metadata = formData.metadata || {};

    // Build Clio payload
    const payload = buildClioPayload(intakeData, form, metadata);

    console.log('[CLIO] Sending payload to Make.com:', payload);

    const response = await fetch(MAKE_CLIO_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Make webhook failed: ${error.message}`);
    }

    const result = await response.json();
    console.log('[CLIO] Matter created successfully:', result);
    return true;
  } catch (err) {
    console.error('[CLIO] Error populating matter:', err);
    return false;
  }
}

// Formatter functions for clean, readable Clio custom field display
function formatBeneficiaries(beneficiaries: any[]): string {
  if (!beneficiaries || beneficiaries.length === 0) return 'No beneficiaries defined';
  return 'Beneficiaries:\n' + beneficiaries
    .map(b => `• ${b.name} - ${b.percent || 'Equal'}%`)
    .join('\n');
}

function formatSpecificGifts(gifts: any[]): string {
  if (!gifts || gifts.length === 0) return 'No specific gifts defined';
  return 'Specific Gifts:\n' + gifts
    .map(g => `• ${g.item} → ${g.recipient}${g.fallback ? ` (Fallback: ${g.fallback})` : ''}`)
    .join('\n');
}

function formatAssets(assets: any[], type: 'real_estate' | 'bank' | 'super'): string {
  if (!assets || assets.length === 0) return `No ${type.replace('_', ' ')} assets defined`;

  if (type === 'real_estate') {
    return 'Real Estate:\n' + assets
      .map(a => `• ${a.address} (${a.type}) - $${a.value}`)
      .join('\n');
  }
  if (type === 'bank') {
    return 'Bank Accounts:\n' + assets
      .map(a => `• ${a.institution} (${a.type}) - $${a.balance}`)
      .join('\n');
  }
  if (type === 'super') {
    return 'Superannuation:\n' + assets
      .map(a => `• ${a.fund_name} - $${a.balance}`)
      .join('\n');
  }
  return '';
}

function formatEpaAttorneys(attorneys: any[]): string {
  if (!attorneys || attorneys.length === 0) return 'No EPA attorneys appointed';
  return 'EPA Attorneys:\n' + attorneys
    .map(a => `• ${a.name} (${a.relationship || 'Relationship not specified'})`)
    .join('\n');
}

function formatDocumentsRequired(docs: any): string {
  const items = [
    docs.will && '• Will',
    docs.epa && '• Enduring Power of Attorney (Financial)',
    docs.acd && '• Advance Care Directive',
    docs.sdt && '• Special Disability Trust',
  ].filter(Boolean);

  return items.length === 0 ? 'No documents selected' : 'Documents Required:\n' + items.join('\n');
}

function buildClioPayload(intakeData: any, form: any, metadata: any) {
  const isCouple = intakeData.scenario === 'Couple';

  // Build array fields
  const beneficiaries = [
    intakeData.beneficiary1 && { name: intakeData.beneficiary1, percent: intakeData.beneficiary1_pct || 0 },
    intakeData.beneficiary2 && { name: intakeData.beneficiary2, percent: intakeData.beneficiary2_pct || 0 },
    intakeData.beneficiary3 && { name: intakeData.beneficiary3, percent: intakeData.beneficiary3_pct || 0 },
  ].filter(Boolean);

  const specificGifts = (intakeData.gift || []).map((g: any) => ({
    item: g['Item description'],
    recipient: g['Recipient'],
    fallback: g['Fallback if recipient predeceases'],
  }));

  const realEstate = (intakeData.realestate || []).map((r: any) => ({
    address: r.address,
    type: r.type,
    value: r.value,
  }));

  const bankAccounts = (intakeData.bank || []).map((b: any) => ({
    institution: b.institution,
    type: b.type,
    balance: b.balance,
  }));

  const superAccounts = (intakeData.super || []).map((s: any) => ({
    fund_name: s.fund_name,
    balance: s.balance,
  }));

  const epaAttorneys = (intakeData.attorney || []).map((a: any) => ({
    name: a.name,
    relationship: a.relationship,
  }));

  const docsRequired = {
    will: !!intakeData.doc_will,
    epa: !!intakeData.doc_epa,
    acd: !!intakeData.doc_acd,
    sdt: !!intakeData.doc_sdt,
  };

  // Build will PDF filename
  const willPdfName = `Will_${form.client_name}_${new Date().toISOString().split('T')[0]}.pdf`;

  // Return Make.com webhook payload for Clio
  return {
    // Client Info (for Clio Contact)
    client_name: intakeData.client_name || form.client_name,
    client_email: intakeData.client_email || form.client_email,
    client_address: intakeData.client_address,
    client_state: intakeData.client_state,
    client_occupation: intakeData.client_occupation,
    client_marital_status: intakeData.client_marital_status,

    // Spouse Info (if couple)
    scenario: intakeData.scenario,
    spouse_name: intakeData.spouse_name,
    spouse_occupation: intakeData.spouse_occupation,
    mirror_or_independent: intakeData.mirror_or_independent,

    // Matter Info
    person_responsible: form.person_responsible,
    inquiry_reason: intakeData.inquiry_reason,
    lead_type: form.lead_type,
    region: form.region,

    // Estate Planning Details (formatted for readable Clio display)
    documents_required: formatDocumentsRequired(docsRequired),
    specific_gifts: formatSpecificGifts(specificGifts),
    assets_real_estate: formatAssets(realEstate, 'real_estate'),
    assets_bank: formatAssets(bankAccounts, 'bank'),
    assets_super: formatAssets(superAccounts, 'super'),

    executor_primary_name: intakeData.exec_initial_name,
    executor_backup_name: intakeData.exec_backup,
    executor_acting_arrangement: intakeData.exec_joint === 'true' ? 'Joint' : 'Sole',

    epa_attorneys: formatEpaAttorneys(epaAttorneys),
    epa_effective: intakeData.epa_effective,

    has_minors: intakeData.has_minors === 'Yes',
    guardian_primary: intakeData.guardian_initial,

    funeral_organ_donation: intakeData.organ_donation,
    funeral_burial_cremation: intakeData.burial_or_cremation,

    will_custody: intakeData.will_custody,
    letter_of_wishes: intakeData.has_low === 'Yes',

    // Will Document Info
    will_pdf_path: metadata.will_pdf_path,
    will_pdf_name: willPdfName,

    // Meta
    form_id: form.id,
    submission_date: form.created_at,
  };
}

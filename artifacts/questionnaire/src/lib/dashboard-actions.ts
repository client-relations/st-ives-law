import { supabase } from './supabase';

// Webhook URLs (Make integration)
const MAKE_CLIO_WEBHOOK = 'https://hook.eu2.make.com/7kdud7kq1fjfb4d83f5h4o9o0qou1lgr';
const SMOKEBALL_WEBHOOK = import.meta.env.VITE_WEBHOOK_URL || 'https://hook.eu2.make.com/fou12e2mjy2wgv2h0e3jgqor7fu81rec';
const SEND_FORM_EMAIL_WEBHOOK = import.meta.env.VITE_SEND_FORM_EMAIL_WEBHOOK || 'https://hook.eu2.make.com/f6lbcoppzzdjl7r5dh7i0uqpo3yx68y2';
const SEND_INQUIRY_FORM_WEBHOOK = 'https://hook.eu2.make.com/x9outby9rqyxbwaf4g86jht5vic11dl2';
const SEND_INTAKE_FORM_WEBHOOK = 'https://hook.eu2.make.com/uqjnkwsk8kx3ujsrancfkesdybyufw17';
const REMINDER_WEBHOOK = import.meta.env.VITE_REMINDER_WEBHOOK || 'https://hook.eu2.make.com/mjiv8gg69a3dn5ktex4tqlj5j1oji5fk';
const EMAIL_CONFIRMATION_WEBHOOK = import.meta.env.VITE_EMAIL_CONFIRMATION_WEBHOOK || 'https://hook.eu2.make.com/6xtuj8hqbt68f90v8y4iy3u3lylrs2hw';
const SEND_BACK_WEBHOOK = 'https://hook.eu2.make.com/uqjnkwsk8kx3ujsrancfkesdybyufw17';

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

    // Send inquiry form email
    if (formRecord.client_email) {
      await sendInquiryFormEmail(formRecord.id, formRecord.client_name, formRecord.client_email);
    }

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

    // Send intake form email
    if (form.client_email) {
      await sendIntakeFormEmail(form.id, form.client_name, form.client_email);
    }

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

function validateIntakeForm(intakeData: any): { missingFields: string[]; hasData: boolean } {
  const missingFields: string[] = [];

  // Check all common intake form fields
  const fieldsToCheck = [
    'scenario', 'client_name', 'client_address', 'client_state', 'client_marital_status',
    'client_occupation', 'client_former_names', 'spouse_name', 'spouse_occupation',
    'mirror_or_independent', 'financial_adviser', 'governing_jurisdiction',
    'realestate', 'bank', 'super', 'other_assets',
    'doc_will', 'doc_epa', 'doc_acd', 'doc_sdt',
    'exec_initial_name', 'exec_initial_address', 'exec_initial_relationship',
    'exec_backup', 'exec_further_backup', 'exec_joint',
    'exec_power_of_sale', 'exclusion', 'no_contest_clause',
    'gift', 'has_company', 'company_name', 'company_acn',
    'company_on_death', 'company_share_treatment',
    'has_life_tenancy', 'life_tenant', 'life_tenancy_property',
    'life_tenancy_outgoings', 'life_tenancy_balance', 'life_tenancy_sale',
    'fund_count', 'benef1_name', 'benef1_pct', 'benef2_name', 'benef2_pct',
    'benef3_name', 'benef3_pct', 'calamity1', 'calamity1_pct',
    'has_sdt', 'sdt_mechanism', 'sdt_principal',
    'has_minors', 'guardian_initial', 'guardian_backup',
    'organ_donation', 'burial_or_cremation', 'funeral_other',
    'epa_initial_name', 'epa_backup', 'epa_further_backup',
    'epa_jointly', 'epa_effective', 'epa_power_conflict',
    'epa_power_charge', 'epa_power_gifts', 'epa_power_will',
    'epa_power_spouse', 'epa_power_digital', 'has_letter_of_wishes',
    'low_wishes', 'signing_date', 'will_custody', 'add_to_wills_register'
  ];

  fieldsToCheck.forEach(field => {
    const value = intakeData[field];
    // Consider field empty if: null, undefined, empty string, empty array, false (for checkboxes)
    if (value === null || value === undefined || value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'boolean' && !value)) {
      missingFields.push(field);
    }
  });

  return {
    missingFields,
    hasData: missingFields.length < fieldsToCheck.length
  };
}

export async function sendBackForm(formId: string) {
  try {
    if (!supabase) throw new Error('Database connection error');

    // Fetch form data
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
    const inquiryData = formData.inquiry || {};

    // Validate form and get missing fields
    const validation = validateIntakeForm({ ...intakeData, ...inquiryData });

    // Send webhook with missing fields
    const formLink = `${window.location.origin}/intake-form?lead_id=${formId}`;

    const response = await fetch(SEND_BACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: formId,
        client_name: form.client_name,
        client_email: form.client_email,
        form_link: formLink,
        missing_fields: validation.missingFields,
        missing_count: validation.missingFields.length,
        sent_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Send-back webhook failed:', response.status);
      return false;
    }

    console.log('Form send-back initiated successfully');
    return true;
  } catch (err) {
    console.error('Error sending back form:', err);
    return false;
  }
}

export async function sendInquiryFormEmail(formId: string, clientName: string, clientEmail: string) {
  try {
    const formLink = `${window.location.origin}/lead-inquiry?lead_id=${formId}`;

    const response = await fetch(SEND_INQUIRY_FORM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: formId,
        client_name: clientName,
        client_email: clientEmail,
        form_link: formLink,
        sent_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Inquiry form email webhook failed:', response.status);
      return false;
    }

    console.log('Inquiry form email sent successfully');
    return true;
  } catch (err) {
    console.error('Error sending inquiry form email:', err);
    return false;
  }
}

export async function sendIntakeFormEmail(formId: string, clientName: string, clientEmail: string) {
  try {
    const formLink = `${window.location.origin}/intake-form?lead_id=${formId}`;

    const response = await fetch(SEND_INTAKE_FORM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: formId,
        client_name: clientName,
        client_email: clientEmail,
        form_link: formLink,
        sent_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Intake form email webhook failed:', response.status);
      return false;
    }

    console.log('Intake form email sent successfully');
    return true;
  } catch (err) {
    console.error('Error sending intake form email:', err);
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
    const inquiryData = formData.inquiry || {};
    const metadata = formData.metadata || {};

    // Merge intake and inquiry data - inquiry takes priority for missing fields
    const completeFormData = { ...intakeData, ...inquiryData };

    // Build Clio payload
    const payload = buildClioPayload(completeFormData, form, metadata);

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

    const text = await response.text();
    console.log('[CLIO] Matter created successfully. Response:', text);
    return true;
  } catch (err) {
    console.error('[CLIO] Error populating matter:', err);
    return false;
  }
}

// Picklist field mapping: converts text values to Clio option IDs
const PICKLIST_OPTIONS = {
  will_custody: {
    'Firm': 60694,
    'Client': 60697,
    'Executor': 60700,
  },
  funeral_burial_cremation: {
    'Burial': 60703,
    'Cremation': 60706,
    'Not Specified': 60709,
  },
  executor_acting_arrangement: {
    'Jointly': 60712,
    'Joint': 60712,
    'Sole': 60715,
  },
  mirror_or_independent: {
    'Mirror Wills': 60718,
    'Mirror wills': 60718,
    'Independent Wills': 60721,
    'Independent wills': 60721,
  },
};

function mapPicklistValue(fieldName: string, textValue: string): number | string {
  if (!textValue) return '';
  const options = PICKLIST_OPTIONS[fieldName as keyof typeof PICKLIST_OPTIONS];
  if (!options) return textValue; // Not a picklist field, return as-is
  return options[textValue as keyof typeof options] || textValue; // Return ID if found, else text
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

function formatExclusions(exclusions: any[]): string {
  if (!exclusions || exclusions.length === 0) return 'No exclusions';
  return 'Exclusions:\n' + exclusions
    .map(e => `• ${e.name}${e.reason ? ` - Reason: ${e.reason}` : ''}`)
    .join('\n');
}

function formatCalamityBeneficiaries(calamities: any[]): string {
  if (!calamities || calamities.length === 0) return 'No calamity beneficiaries';
  return 'Calamity Beneficiaries:\n' + calamities
    .map(c => `• ${c.name} - ${c.percent || 'Equal'}%`)
    .join('\n');
}

function formatTrustFund(fundNum: number, fundData: any): string {
  if (!fundData?.beneficiary) return '';
  return `Trust Fund ${fundNum}:\nBeneficiary: ${fundData.beneficiary}\nClass: ${fundData.class || 'N/A'}\nPrimary Trustee: ${fundData.trustee_initial || 'N/A'}\nBackup Trustee: ${fundData.trustee_backup || 'N/A'}\nFurther Trustee: ${fundData.trustee_further || 'N/A'}\nPrimary Appointor: ${fundData.appointor_initial || 'N/A'}\nBackup Appointor: ${fundData.appointor_backup || 'N/A'}\nFurther Appointor: ${fundData.appointor_further || 'N/A'}`;
}

function buildClioPayload(intakeData: any, form: any, metadata: any) {
  // Parse full name into first and last name
  const fullName = intakeData.client_name || form.client_name || 'Unknown Client';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

  // Parse contact email and phone
  const clientEmail = intakeData.client_email || form.client_email || '';
  const clientPhone = intakeData.client_phone || '';

  // ===== SCENARIO: Fund Count =====
  const fundCount = parseInt(intakeData.fund_count) || 0;

  // Direct beneficiaries (when fund_count = 0)
  const beneficiaries = fundCount === 0 ? [
    intakeData.beneficiary1 && { name: intakeData.beneficiary1, percent: intakeData.beneficiary1_pct || 0 },
    intakeData.beneficiary2 && { name: intakeData.beneficiary2, percent: intakeData.beneficiary2_pct || 0 },
    intakeData.beneficiary3 && { name: intakeData.beneficiary3, percent: intakeData.beneficiary3_pct || 0 },
  ].filter(Boolean) : [];

  // Trust funds (when fund_count = 1 or 2)
  const trustFund1 = fundCount >= 1 ? {
    beneficiary: intakeData.fund1_beneficiary,
    class: intakeData.fund1_class,
    trustee_initial: intakeData.fund1_trustee_initial,
    trustee_backup: intakeData.fund1_trustee_backup,
    trustee_further: intakeData.fund1_trustee_further,
    appointor_initial: intakeData.fund1_appointor_initial,
    appointor_backup: intakeData.fund1_appointor_backup,
    appointor_further: intakeData.fund1_appointor_further,
  } : null;

  const trustFund2 = fundCount >= 2 ? {
    beneficiary: intakeData.fund2_beneficiary,
    class: intakeData.fund2_class,
    trustee_initial: intakeData.fund2_trustee_initial,
    trustee_backup: intakeData.fund2_trustee_backup,
    trustee_further: intakeData.fund2_trustee_further,
    appointor_initial: intakeData.fund2_appointor_initial,
    appointor_backup: intakeData.fund2_appointor_backup,
    appointor_further: intakeData.fund2_appointor_further,
  } : null;

  // Calamity beneficiaries
  const calamityBeneficiaries = [
    intakeData.calamity1 && { name: intakeData.calamity1, percent: intakeData.calamity1_pct || 0 },
    intakeData.calamity2 && { name: intakeData.calamity2, percent: intakeData.calamity2_pct || 0 },
    intakeData.calamity3 && { name: intakeData.calamity3, percent: intakeData.calamity3_pct || 0 },
  ].filter(Boolean);

  // ===== ARRAYS: Repeatable Items =====
  const specificGifts = (intakeData.gift || []).map((g: any) => ({
    item: g['Item description'],
    recipient: g['Recipient'],
    fallback: g['Fallback if recipient predeceases'],
  }));

  const realEstate = (intakeData.realestate || []).map((r: any) => ({
    address: r['Address'] || r.address,
    type: r['Tenancy type'] || r.type,
    value: r['Estimated value'] || r.value,
    mortgage: r['Mortgage details'],
  }));

  const bankAccounts = (intakeData.bank || []).map((b: any) => ({
    institution: b['Bank'],
    type: b['Account type'],
    holder: b['Held jointly or individually'],
    balance: b['Value'],
  }));

  const superAccounts = (intakeData.super || []).map((s: any) => ({
    fund_name: s['Fund name'],
    member_number: s['Member number'],
    balance: s['Value'],
    nominated_beneficiary: s['Nominated beneficiary'],
  }));

  const exclusions = (intakeData.exclusion || []).map((e: any) => ({
    name: e['Name'] || e.name,
    reason: e['Reason'] || e.reason,
  }));

  const epaAttorneys = (intakeData.attorney || []).map((a: any) => ({
    name: a['Full name'],
    address: a['Address'],
  }));

  // ===== DOCUMENTS =====
  const docsRequired = {
    will: !!intakeData.doc_will,
    epa: !!intakeData.doc_epa,
    acd: !!intakeData.doc_acd,
    sdt: !!intakeData.doc_sdt,
  };

  // ===== CONDITIONAL BLOCKS =====
  const hasCompany = intakeData.has_company === 'Yes';
  const hasLifeTenancy = intakeData.has_life_tenancy === 'Yes';
  const hasSdt = intakeData.has_sdt === 'Yes';
  const hasMinors = intakeData.has_minors === 'Yes';
  const hasLetterOfWishes = intakeData.has_low === 'Yes';

  // Build company info
  const companyInfo = hasCompany ? `Company: ${intakeData.company_name}\nACN: ${intakeData.company_acn}\nOn Death: ${intakeData.company_on_death}\nShare Treatment: ${intakeData.company_share_treatment}` : '';

  // Build life tenancy info
  const lifeTenancyInfo = hasLifeTenancy ? `Life Tenant: ${intakeData.life_tenant}\nProperty: ${intakeData.life_tenancy_property}\nOutgoings Bearer: ${intakeData.life_tenancy_outgoings}\nBalance Recipient: ${intakeData.life_tenancy_balance}\nSale Power: ${intakeData.life_tenancy_sale_power ? 'Yes' : 'No'}` : '';

  // Build SDT info
  const sdtInfo = hasSdt ? `Mechanism: ${intakeData.sdt_mechanism}\nPrincipal Beneficiary: ${intakeData.sdt_principal_beneficiary}` : '';

  // Build will PDF filename
  const willPdfName = `Will_${form.client_name}_${new Date().toISOString().split('T')[0]}.pdf`;

  // ===== BUILD PAYLOAD =====
  const payload: any = {
    // Client Info (for Clio Contact)
    client_first_name: firstName,
    client_last_name: lastName,
    client_email: clientEmail,
    client_phone: clientPhone,
    client_address: intakeData.client_address,
    client_city: intakeData.client_city || '',
    client_state: intakeData.client_state,
    client_postcode: intakeData.client_postcode || '',
    client_occupation: intakeData.client_occupation || '',
    client_marital_status: intakeData.client_marital_status || '',
    client_former_names: intakeData.client_former_names || '',

    // Scenario & Spouse Info
    scenario: intakeData.scenario,
    spouse_name: intakeData.scenario === 'Couple' ? intakeData.spouse_name : '',
    spouse_occupation: intakeData.scenario === 'Couple' ? intakeData.spouse_occupation : '',
    mirror_or_independent: intakeData.scenario === 'Couple' ? mapPicklistValue('mirror_or_independent', intakeData.mirror_or_independent) : '',

    // Matter Info
    person_responsible: form.person_responsible,
    inquiry_reason: intakeData.inquiry_reason,
    lead_type: form.lead_type,
    region: form.region,

    // Documents
    documents_required: formatDocumentsRequired(docsRequired),

    // BENEFICIARIES: Scenario 1 (Direct) or Scenario 2 (Trust Funds)
    trust_fund_structure: fundCount === 0 ? 'Direct Beneficiaries' : `${fundCount} Trust Fund${fundCount > 1 ? 's' : ''}`,
    beneficiaries: fundCount === 0 ? formatBeneficiaries(beneficiaries) : 'N/A (Using Trust Funds)',
    trust_fund_1: fundCount >= 1 ? formatTrustFund(1, trustFund1) : '',
    trust_fund_2: fundCount >= 2 ? formatTrustFund(2, trustFund2) : '',
    foreign_persons_excluded: fundCount > 0 ? (intakeData.fpe_trust ? 'Yes' : 'No') : 'N/A',

    // Calamity Beneficiaries
    calamity_beneficiaries: formatCalamityBeneficiaries(calamityBeneficiaries),

    // Assets
    specific_gifts: formatSpecificGifts(specificGifts),
    assets_real_estate: formatAssets(realEstate, 'real_estate'),
    assets_bank: formatAssets(bankAccounts, 'bank'),
    assets_super: formatAssets(superAccounts, 'super'),
    other_assets: intakeData.other_assets || 'None listed',

    // Exclusions
    exclusions: formatExclusions(exclusions),
    no_contest_clause: intakeData.no_contest_clause ? 'Yes' : 'No',

    // Executors
    executor_primary_name: intakeData.exec_initial_name,
    executor_primary_address: intakeData.exec_initial_address || '',
    executor_primary_relationship: intakeData.exec_initial_relationship || '',
    executor_backup_name: intakeData.exec_backup || '',
    executor_tertiary_name: intakeData.exec_further_backup || '',
    executor_acting_arrangement: mapPicklistValue('executor_acting_arrangement', intakeData.exec_joint?.includes('jointly') ? 'Jointly' : 'Sole'),
    executor_power_of_sale: intakeData.exec_power_of_sale ? 'Yes' : 'No',

    // Conditional: Company
    has_company: hasCompany ? 'Yes' : 'No',
    company_info: companyInfo,

    // Conditional: Life Tenancy
    has_life_tenancy: hasLifeTenancy ? 'Yes' : 'No',
    life_tenancy_info: lifeTenancyInfo,

    // Conditional: SDT
    has_special_disability_trust: hasSdt ? 'Yes' : 'No',
    sdt_info: sdtInfo,

    // Conditional: Guardianship
    has_minors: hasMinors ? 'Yes' : 'No',
    guardian_primary: hasMinors ? (intakeData.guardian_initial || '') : '',
    guardian_backup: hasMinors ? (intakeData.guardian_backup || '') : '',

    // EPA
    epa_attorneys: formatEpaAttorneys(epaAttorneys),
    epa_acting_arrangement: intakeData.epa_jointly || '',
    epa_effective: intakeData.epa_effective || '',
    epa_power_conflict: intakeData.epa_power_conflict ? 'Yes' : 'No',
    epa_power_charge: intakeData.epa_power_charge ? 'Yes' : 'No',
    epa_power_gifts: intakeData.epa_power_gifts ? 'Yes' : 'No',
    epa_power_will: intakeData.epa_power_will ? 'Yes' : 'No',
    epa_power_spouse: intakeData.epa_power_spouse ? 'Yes' : 'No',
    epa_power_digital: intakeData.epa_power_digital ? 'Yes' : 'No',

    // Funeral Wishes
    funeral_organ_donation: intakeData.organ_donation || '',
    funeral_burial_cremation: mapPicklistValue('funeral_burial_cremation', intakeData.burial_or_cremation || ''),
    funeral_other: intakeData.funeral_other || '',

    // Conditional: Letter of Wishes
    has_letter_of_wishes: hasLetterOfWishes ? 'Yes' : 'No',
    letter_of_wishes: hasLetterOfWishes ? (intakeData.low_wishes || '') : '',

    // Will Custody & Admin
    signing_date: intakeData.signing_date || '',
    will_custody: mapPicklistValue('will_custody', intakeData.will_custody || ''),
    add_to_wills_register: intakeData.add_to_wills_register ? 'Yes' : 'No',

    // Administrative
    financial_adviser: intakeData.financial_adviser || '',
    governing_jurisdiction: intakeData.governing_jurisdiction || intakeData.client_state || '',
    former_partner_exclude: intakeData.former_partner_exclude || '',

    // Will Document Info
    will_pdf_path: metadata.will_pdf_path,
    will_pdf_name: willPdfName,

    // Meta
    form_id: form.id,
    submission_date: form.created_at,
  };

  return payload;
}

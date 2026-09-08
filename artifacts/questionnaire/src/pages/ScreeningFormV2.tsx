import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type ContactType = 'person' | 'firm';

const LAWYERS = ['Colin Long', 'Emma Mathieson', 'Katrina Elizabeth Brown', 'Sarah Tait', 'Tyler Smith', 'Vicki Baker'];
const REFERRAL_TYPES = ['None', 'Accountant', 'Barrister', 'Builder', 'Developer', 'Direct', "Doyle's Guide", 'Existing Client', 'Facebook', 'Financial Institution', 'Financial Planner', 'Flyer', 'Friend', 'Google', 'Instagram', 'Lead generator', 'LinkedIn', 'Mortgage Broker', 'Networking Group', 'Newspaper', 'Other', 'Previous Client', "Purchaser's Advocate", 'Radio', 'Real Estate Agent', 'Social Media', 'Solicitor', 'Staff Member', 'Surveyor', "Vendor's Advocate", 'Walk-in', 'Web', 'Word of Mouth', 'Yellow Pages'];
const BILLING_TYPES = ['Fixed Fee', 'Fixed Fee Per Appearance', 'Time Based', 'Contingency ($)', 'Contingency (%)', 'Not Billable'];
const REGIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export interface ScreeningFormV2Props {
  lawyerId: string;
  onSubmit?: (data: any) => void;
  onClose?: () => void;
}

export default function ScreeningFormV2({ lawyerId, onSubmit, onClose }: ScreeningFormV2Props) {
  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [personData, setPersonData] = useState({
    title: '',
    name: '',
    mobile: '',
    email: '',
    leadType: '',
    region: '',
    personResponsible: '',
    referralType: '',
    billingType: '',
  });

  const [firmData, setFirmData] = useState({
    organisationName: '',
    organisationPhone: '',
    organisationEmail: '',
    contactName: '',
    contactMobile: '',
    contactEmail: '',
    businessRole: '',
    leadType: '',
    region: '',
    personResponsible: '',
    referralType: '',
    billingType: '',
  });

  const handlePersonChange = (field: string, value: string) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
  };

  const handleFirmChange = (field: string, value: string) => {
    setFirmData(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!personData.email || !personData.name) {
      setError('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      if (!supabase) {
        throw new Error('Database connection error');
      }

      const { data: existingScreening } = await supabase
        .from('screening_submissions')
        .select('id')
        .eq('contact_data->>email', personData.email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingScreening) {
        setError('This email already exists as a pending lead');
        setSubmitting(false);
        return;
      }

      const { data: existingForm } = await supabase
        .from('forms')
        .select('id')
        .eq('client_email', personData.email)
        .in('status', ['sent', 'opened', 'in_progress', 'completed'])
        .maybeSingle();

      if (existingForm) {
        setError('This email already has an active form');
        setSubmitting(false);
        return;
      }

      let assignedLawyerId = lawyerId;
      if (personData.personResponsible) {
        const { data: lawyer } = await supabase
          .from('lawyers')
          .select('id')
          .eq('full_name', personData.personResponsible)
          .single();
        if (lawyer) {
          assignedLawyerId = lawyer.id;
        }
      }

      const { error: insertError } = await supabase
        .from('screening_submissions')
        .insert({
          lawyer_id: assignedLawyerId,
          contact_type: 'person',
          contact_data: {
            title: personData.title,
            name: personData.name,
            mobile: personData.mobile,
            email: personData.email,
          },
          lead_type: personData.leadType,
          region: personData.region,
          person_responsible: personData.personResponsible,
          referral_type: personData.referralType,
          billing_type: personData.billingType,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      setSubmitted(true);
      if (onSubmit) {
        onSubmit({ contactType: 'person', data: personData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firmData.organisationName || !firmData.contactName) {
      setError('Organisation name and contact name are required');
      return;
    }

    setSubmitting(true);
    try {
      if (!supabase) {
        throw new Error('Database connection error');
      }

      const { data: existingScreening } = await supabase
        .from('screening_submissions')
        .select('id')
        .eq('contact_data->>email', firmData.contactEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingScreening) {
        setError('This email already exists as a pending lead');
        setSubmitting(false);
        return;
      }

      const { data: existingForm } = await supabase
        .from('forms')
        .select('id')
        .eq('client_email', firmData.contactEmail)
        .in('status', ['sent', 'opened', 'in_progress', 'completed'])
        .maybeSingle();

      if (existingForm) {
        setError('This email already has an active form');
        setSubmitting(false);
        return;
      }

      let assignedLawyerId = lawyerId;
      if (firmData.personResponsible) {
        const { data: lawyer } = await supabase
          .from('lawyers')
          .select('id')
          .eq('full_name', firmData.personResponsible)
          .single();
        if (lawyer) {
          assignedLawyerId = lawyer.id;
        }
      }

      const { error: insertError } = await supabase
        .from('screening_submissions')
        .insert({
          lawyer_id: assignedLawyerId,
          contact_type: 'firm',
          client_name: firmData.contactName,
          client_email: firmData.contactEmail,
          contact_data: {
            organisationName: firmData.organisationName,
            organisationPhone: firmData.organisationPhone,
            organisationEmail: firmData.organisationEmail,
            contactName: firmData.contactName,
            contactMobile: firmData.contactMobile,
            contactEmail: firmData.contactEmail,
            businessRole: firmData.businessRole,
          },
          lead_type: firmData.leadType,
          region: firmData.region,
          person_responsible: firmData.personResponsible,
          referral_type: firmData.referralType,
          billing_type: firmData.billingType,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      setSubmitted(true);
      if (onSubmit) {
        onSubmit({ contactType: 'firm', data: firmData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (label: string, input: ReactNode, required = false,): ReactNode => (
    <div className='nv-screen-field'>
      <label className='nv-screen-label'>
        {label}
        {required ? <span className='req'>*</span> : null}
      </label>
      {input}
    </div>
  );

  const renderTextInput = (value: string, onChange: (value: string) => void, placeholder: string, type: string = 'text',): ReactNode => (
    <input
      type={type}
      className='nv-screen-input'
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );

  const renderSelect = (value: string, onChange: (value: string) => void, options: string[],): ReactNode => (
    <select
      className='nv-screen-select'
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
      <option value="">Select...</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  );

  const renderLeadDetails = (): ReactNode => {
    const isPerson = contactType === 'person';
    const leadType = isPerson ? personData.leadType : firmData.leadType;
    const region = isPerson ? personData.region : firmData.region;
    const personResponsible = isPerson ? personData.personResponsible : firmData.personResponsible;
    const referralType = isPerson ? personData.referralType : firmData.referralType;
    const billingType = isPerson ? personData.billingType : firmData.billingType;
    const setLead = isPerson ? handlePersonChange : handleFirmChange;

    return (
      <section className='nv-screen-section'>
        <h3 className='nv-screen-section-title'>Lead Details</h3>
        {renderField('Lead Type', renderTextInput(leadType, (v) => setLead('leadType', v), 'e.g. Estate Planning, Family Law'))}
        {renderField('Region (Australia)', renderSelect(region, (v) => setLead('region', v), REGIONS))}
        {renderField('Person Responsible', renderSelect(personResponsible, (v) => setLead('personResponsible', v), LAWYERS))}
        {renderField('Referral Type', renderSelect(referralType, (v) => setLead('referralType', v), REFERRAL_TYPES))}
        {renderField('Billing Type', renderSelect(billingType, (v) => setLead('billingType', v), BILLING_TYPES))}
      </section>
    );
  };

  const renderPersonFields = (): ReactNode => (
    <section className='nv-screen-section'>
      <h3 className='nv-screen-section-title'>Contact Information</h3>
      {renderField('Name', renderTextInput(personData.name, (v) => handlePersonChange('name', v), 'Your full name'), true)}
      {renderField('Email', renderTextInput(personData.email, (v) => handlePersonChange('email', v), 'your@email.com', 'email'), true)}
      {renderField('Mobile', renderTextInput(personData.mobile, (v) => handlePersonChange('mobile', v), '0400 000 000', 'tel'))}
    </section>
  );

  const renderFirmFields = (): ReactNode => (
    <>
      <section className='nv-screen-section'>
        <h3 className='nv-screen-section-title'>Organisation</h3>
        {renderField('Organisation Name', renderTextInput(firmData.organisationName, (v) => handleFirmChange('organisationName', v), 'Company name'), true)}
        {renderField('Phone', renderTextInput(firmData.organisationPhone, (v) => handleFirmChange('organisationPhone', v), 'Phone number', 'tel'))}
        {renderField('Email', renderTextInput(firmData.organisationEmail, (v) => handleFirmChange('organisationEmail', v), 'organisation@company.com', 'email'))}
      </section>

      <section className='nv-screen-section'>
        <h3 className='nv-screen-section-title'>Contact Person</h3>
        {renderField('Contact Name', renderTextInput(firmData.contactName, (v) => handleFirmChange('contactName', v), 'Contact person name'), true)}
        {renderField('Mobile', renderTextInput(firmData.contactMobile, (v) => handleFirmChange('contactMobile', v), '0400 000 000', 'tel'))}
        {renderField('Email', renderTextInput(firmData.contactEmail, (v) => handleFirmChange('contactEmail', v), 'contact@company.com', 'email'))}
        {renderField('Business Role', renderTextInput(firmData.businessRole, (v) => handleFirmChange('businessRole', v), 'e.g. Manager, Director'))}
      </section>
    </>
  );

  const renderTypeSelect = (): ReactNode => (
    <div className='nv-screen-type-grid'>
      <button
        type='button'
        className='nv-screen-type-card'
        onClick={() => { setContactType('person'); setError(''); }}>
        <span className='nv-screen-type-icon' aria-hidden='true'>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M20 21a8 8 0 0 0-16 0' />
            <circle cx='12' cy='8' r='4' />
          </svg>
        </span>
        <span className='nv-screen-type-label'>Individual</span>
        <span className='nv-screen-type-hint'>Personal client or private individual</span>
      </button>
      <button
        type='button'
        className='nv-screen-type-card business'
        onClick={() => { setContactType('firm'); setError(''); }}>
        <span className='nv-screen-type-icon' aria-hidden='true'>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M3 21h18' />
            <path d='M5 21V7l7-4 7 4v14' />
            <path d='M9 21v-6h6v6' />
            <path d='M9 10h.01M15 10h.01M9 14h.01M15 14h.01' />
          </svg>
        </span>
        <span className='nv-screen-type-label'>Business</span>
        <span className='nv-screen-type-hint'>Firm, company, or organisation</span>
      </button>
    </div>
  );

  if (submitted) {
    return (
      <div className='nv-screen'>
        <div className='nv-screen-success'>
          <div className='nv-screen-success-icon'>✓</div>
          <h3>Thank You!</h3>
          <p>Your screening submission has been received. Our team will review and get back to you soon.</p>
        </div>
      </div>
    );
  }

  const introTitle = !contactType
    ? 'Choose lead type'
    : contactType === 'person'
      ? 'Individual lead'
      : 'Business lead';
  const introSub = !contactType
    ? 'Add a new lead for screening'
    : contactType === 'person'
      ? 'Enter contact details and assign intake ownership'
      : 'Enter organisation and contact details for screening';

  return (
    <div className='nv-screen'>
      <div className='nv-screen-intro'>
        <h3>{introTitle}</h3>
        <p>{introSub}</p>
      </div>

      {!contactType
        ? renderTypeSelect()
        : (
          <form
            className='nv-screen-form'
            onSubmit={contactType === 'person' ? handlePersonSubmit : handleFirmSubmit}>
            {error
              ? <div className='nv-screen-error'>{error}</div>
              : null}

            {contactType === 'person' ? renderPersonFields() : renderFirmFields()}
            {renderLeadDetails()}

            <div className='nv-screen-actions'>
              <button
                type='button'
                className='nv-screen-btn-back'
                onClick={() => { setContactType(null); setError(''); }}>
                Back
              </button>
              <button
                type='submit'
                className='nv-screen-btn-submit'
                disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
    </div>
  );
}

import { useState, useEffect, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { createPersonLead, errorMessage } from '../lib/dashboard-actions';

const BILLING_TYPES = ['Fixed Fee', 'Fixed Fee Per Appearance', 'Time Based', 'Contingency ($)', 'Contingency (%)', 'Not Billable'];
const REGIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

type LawyerOption = { id: string; full_name: string };

interface ScreeningFormV2Props {
  /** The signed-in lawyer; preselected as the person responsible. */
  lawyerId: string;
  onSubmit?: () => void;
  onClose?: () => void;
}

export default function ScreeningFormV2({ lawyerId, onSubmit, onClose }: ScreeningFormV2Props) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [lawyers, setLawyers] = useState<LawyerOption[]>([]);
  const [lawyersError, setLawyersError] = useState('');

  const [personData, setPersonData] = useState({
    title: '',
    name: '',
    mobile: '',
    email: '',
    leadType: '',
    region: '',
    lawyerId,
    billingType: '',
  });

  // The dropdown is populated from the lawyers table and submits the lawyer's
  // id, so the lead's owner can never drift from the name shown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('lawyers')
          .select('id, full_name')
          .order('full_name', { ascending: true });
        if (cancelled) return;
        if (loadError) throw loadError;
        setLawyers((data || []).filter((l: LawyerOption) => l.full_name));
      } catch (err) {
        if (!cancelled) setLawyersError(`Could not load the lawyer list: ${errorMessage(err)}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePersonChange = (field: string, value: string) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!personData.email.trim() || !personData.name.trim()) {
      setError('Name and email are required');
      return;
    }
    const owner = lawyers.find(l => String(l.id) === String(personData.lawyerId));
    if (!owner) {
      setError('Choose the person responsible for this lead.');
      return;
    }

    setError('');
    setSubmitting(true);
    const result = await createPersonLead({
      title: personData.title,
      name: personData.name,
      mobile: personData.mobile,
      email: personData.email,
      leadType: personData.leadType,
      region: personData.region,
      billingType: personData.billingType,
      lawyerId: owner.id,
      lawyerName: owner.full_name,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    onSubmit?.();
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

  const renderSelect = (value: string, onChange: (value: string) => void, options: { value: string; label: string }[],): ReactNode => (
    <select
      className='nv-screen-select'
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
      <option value="">Select...</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );

  const asOptions = (values: string[]) => values.map(v => ({ value: v, label: v }));

  const renderLeadDetails = (): ReactNode => (
    <section className='nv-screen-section'>
      <h3 className='nv-screen-section-title'>Lead Details</h3>
      {renderField('Lead Type', renderTextInput(personData.leadType, (v) => handlePersonChange('leadType', v), 'e.g. Estate Planning, Family Law'))}
      {renderField('Region (Australia)', renderSelect(personData.region, (v) => handlePersonChange('region', v), asOptions(REGIONS)))}
      {renderField(
        'Person Responsible',
        renderSelect(
          String(personData.lawyerId || ''),
          (v) => handlePersonChange('lawyerId', v),
          lawyers.map(l => ({ value: String(l.id), label: l.full_name })),
        ),
        true,
      )}
      {renderField('Billing Type', renderSelect(personData.billingType, (v) => handlePersonChange('billingType', v), asOptions(BILLING_TYPES)))}
    </section>
  );

  const renderPersonFields = (): ReactNode => (
    <section className='nv-screen-section'>
      <h3 className='nv-screen-section-title'>Contact Information</h3>
      {renderField('Name', renderTextInput(personData.name, (v) => handlePersonChange('name', v), 'Your full name'), true)}
      {renderField('Email', renderTextInput(personData.email, (v) => handlePersonChange('email', v), 'your@email.com', 'email'), true)}
      {renderField('Mobile', renderTextInput(personData.mobile, (v) => handlePersonChange('mobile', v), '0400 000 000', 'tel'))}
    </section>
  );

  if (submitted) {
    return (
      <div className='nv-screen'>
        <div className='nv-screen-success'>
          <div className='nv-screen-success-icon'>✓</div>
          <h3>Lead added</h3>
          <p>The lead is now in Pending Leads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='nv-screen'>
      <div className='nv-screen-intro'>
        <h3>Individual lead</h3>
        <p>Enter contact details and assign intake ownership</p>
      </div>

      <form
        className='nv-screen-form'
        onSubmit={handlePersonSubmit}>
        {error || lawyersError
          ? <div className='nv-screen-error'>{error || lawyersError}</div>
          : null}

        {renderPersonFields()}
        {renderLeadDetails()}

        <div className='nv-screen-actions'>
          {onClose
            ? (
              <button
                type='button'
                className='nv-screen-btn-back'
                onClick={onClose}
                disabled={submitting}>
                Cancel
              </button>
            )
            : null}
          <button
            type='submit'
            className='nv-screen-btn-submit'
            disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

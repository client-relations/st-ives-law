import { useState, useEffect, useCallback, useRef, lazy, Suspense, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { C } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  qualifyLead,
  rejectLead,
  sendIntakeForm,
  resendIntakeEmail,
  deleteForm,
  deleteLead,
  populateMatterToClio,
  sendBackForm,
  publicLink,
  errorMessage,
  type ActionResult,
} from '../lib/dashboard-actions';
import { ALL_DATES, formatDbTimestamp, matchesDateFilter, type DateFilter, type DatePreset } from '../lib/dates';
import { DocumentSelection, DocumentEditor } from '../components/DocumentGenerator';
import '../styles/dashboard.css';

const ScreeningFormV2 = lazy(() => import('./ScreeningFormV2'));

const POLL_MS = 10_000;

// Statuses each pipeline column shows. A form in any other status is listed
// under "Needs attention" so no record can silently vanish from the board.
const INTAKE_STATUSES = ['appointment_sent', 'scheduled', 'pending_intake', 'completed_intake'];
const LEAD_STATUSES = ['pending', 'qualified', 'rejected', 'deprioritized'];

/** Filter value for records with no person responsible. */
const UNASSIGNED = '__unassigned__';

type Notice = { kind: 'success' | 'error'; text: string } | null;

interface PageFilters {
  search: string;
  person: string;
  date: DateFilter;
}

const EMPTY_FILTERS: PageFilters = { search: '', person: '', date: ALL_DATES };

const normalise = (value: string | null | undefined) => (value || '').trim().toLowerCase();

/** One mapping for screening rows, used by every fetch. */
function mapLead(s: any) {
  const cd = s.contact_data || {};
  return {
    ...s,
    name: cd.name || cd.contactName || 'Unknown',
    email: cd.email || cd.contactEmail || '',
    personResponsible: s.person_responsible || '',
    region: s.region || '',
    referralType: s.referral_type || '',
    leadType: s.lead_type || '',
  };
}

/** One mapping for form rows, used by every fetch. */
function mapForm(f: any) {
  return {
    ...f,
    name: f.client_name || 'Unknown',
    email: f.client_email || '',
    progress: f.progress_pct || 0,
    personResponsible: f.person_responsible || '',
  };
}

function matchesSearch(item: any, query: string) {
  const q = normalise(query);
  if (!q) return true;
  return normalise(item.name).includes(q) || normalise(item.email).includes(q);
}

function matchesPerson(item: any, person: string) {
  if (!person) return true;
  if (person === UNASSIGNED) return !normalise(item.personResponsible);
  return normalise(item.personResponsible) === normalise(person);
}

function applyFilters<T>(items: T[], filters: PageFilters): T[] {
  return items.filter((item: any) =>
    matchesSearch(item, filters.search)
    && matchesPerson(item, filters.person)
    && matchesDateFilter(item.created_at, filters.date));
}

export default function DashboardV2() {
  const { user, lawyer, lawyerError, loading, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [pendingLeadsTab, setPendingLeadsTab] = useState('pending');

  // Data from Supabase
  const [leads, setLeads] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [lawyerNames, setLawyerNames] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lawyerListError, setLawyerListError] = useState('');
  const loadSeq = useRef(0);

  // Result of the last action, shown as a banner
  const [notice, setNotice] = useState<Notice>(null);
  // Key of the action in flight; every action button is disabled while set
  const [busy, setBusy] = useState<string | null>(null);

  // Screening modal
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showScreenScrollHint, setShowScreenScrollHint] = useState(false);
  const screeningScrollRef = useRef<HTMLDivElement>(null);

  // Detail modals hold an id; the record itself is always read from the
  // latest polled data, never from a snapshot taken when the modal opened.
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null);
  const [viewingFormId, setViewingFormId] = useState<string | null>(null);

  // Share-link modal
  const [shareLink, setShareLink] = useState<{ url: string; warning?: string } | null>(null);

  // Send back modal
  const [sendBackFormId, setSendBackFormId] = useState<string | null>(null);

  // Document generation
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [documentFormId, setDocumentFormId] = useState<string | null>(null);

  // Each page owns its own search and filters.
  const [overviewSearch, setOverviewSearch] = useState({ leads: '', intake: '', completed: '' });
  const [leadsFilters, setLeadsFilters] = useState<PageFilters>(EMPTY_FILTERS);
  const [intakeFilters, setIntakeFilters] = useState<PageFilters>(EMPTY_FILTERS);
  const [deprioritizedTypeFilter, setDeprioritizedTypeFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [user, loading]);

  useEffect(() => {
    if (!notice || notice.kind !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!showScreeningModal) {
      setShowScreenScrollHint(false);
      return;
    }

    let scrollEl: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let cancelled = false;

    const updateScrollHint = () => {
      if (!scrollEl || cancelled) return;
      const remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      setShowScreenScrollHint(remaining > 40);
    };

    const attach = () => {
      scrollEl = screeningScrollRef.current;
      if (!scrollEl) return;

      updateScrollHint();
      scrollEl.addEventListener('scroll', updateScrollHint, { passive: true });
      resizeObserver = new ResizeObserver(updateScrollHint);
      resizeObserver.observe(scrollEl);
      mutationObserver = new MutationObserver(updateScrollHint);
      mutationObserver.observe(scrollEl, { childList: true, subtree: true });
    };

    const raf = requestAnimationFrame(attach);
    const retryA = window.setTimeout(updateScrollHint, 120);
    const retryB = window.setTimeout(updateScrollHint, 400);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(retryA);
      window.clearTimeout(retryB);
      scrollEl?.removeEventListener('scroll', updateScrollHint);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [showScreeningModal]);

  // DocumentSelection announces a finished generation; switch to the editor.
  useEffect(() => {
    const handleDocumentGenerated = () => {
      setShowDocumentGenerator(false);
      setShowDocumentEditor(true);
    };
    window.addEventListener('documentGenerated', handleDocumentGenerated);
    return () => window.removeEventListener('documentGenerated', handleDocumentGenerated);
  }, []);

  const handleScreenScrollHint = () => {
    const scrollEl = screeningScrollRef.current;
    if (!scrollEl) return;
    const remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    scrollEl.scrollBy({ top: Math.min(320, remaining), behavior: 'smooth' });
  };

  /**
   * The single loader used on mount, by the poll, and after every action.
   * Admins see every record; other lawyers see their own. A failed fetch keeps
   * the last good data on screen and shows an error instead of empty lists.
   */
  const loadData = useCallback(async () => {
    if (!lawyer?.id || !supabase) return;
    // Only the newest request may update the screen, so a slow poll that
    // started before an action cannot overwrite the refresh that follows it.
    const request = ++loadSeq.current;
    try {
      let leadsQuery = supabase.from('screening_submissions').select('*');
      let formsQuery = supabase.from('forms').select('*');
      if (!lawyer.is_admin) {
        leadsQuery = leadsQuery.eq('lawyer_id', lawyer.id);
        formsQuery = formsQuery.eq('lawyer_id', lawyer.id);
      }

      const [leadsRes, formsRes] = await Promise.all([
        leadsQuery.order('created_at', { ascending: false }),
        formsQuery.order('created_at', { ascending: false }),
      ]);
      if (request !== loadSeq.current) return;
      if (leadsRes.error) throw leadsRes.error;
      if (formsRes.error) throw formsRes.error;

      setLeads((leadsRes.data || []).map(mapLead));
      setForms((formsRes.data || []).map(mapForm));
      setLoadError('');
      setHasLoaded(true);
    } catch (err) {
      if (request !== loadSeq.current) return;
      setLoadError(`Could not load the latest data: ${errorMessage(err)}`);
    }
  }, [lawyer?.id, lawyer?.is_admin]);

  useEffect(() => {
    if (!lawyer?.id || !supabase) return;
    loadData();
    const interval = setInterval(loadData, POLL_MS);
    return () => clearInterval(interval);
  }, [lawyer?.id, loadData]);

  // Lawyer names for the "person responsible" filters.
  const loadLawyerNames = useCallback(async () => {
    if (!lawyer?.id || !supabase) return;
    const { data, error } = await supabase.from('lawyers').select('full_name').order('full_name');
    if (error) {
      setLawyerListError(`Could not load the lawyer list: ${errorMessage(error)}`);
      return;
    }
    setLawyerListError('');
    setLawyerNames((data || []).map((l: { full_name: string }) => l.full_name).filter(Boolean));
  }, [lawyer?.id]);

  useEffect(() => {
    loadLawyerNames();
  }, [loadLawyerNames]);

  /** Run one action at a time; report its result; refresh the data. */
  const runAction = async <T,>(
    key: string,
    action: () => Promise<ActionResult<T>>,
    onSuccess?: (data: T) => void,
  ) => {
    if (busy) return;
    setBusy(key);
    try {
      const result = await action();
      if (result.ok) {
        onSuccess?.(result.data);
        if (result.message) setNotice({ kind: 'success', text: result.message });
      } else {
        setNotice({ kind: 'error', text: result.error });
      }
    } catch (err) {
      setNotice({ kind: 'error', text: errorMessage(err) });
    } finally {
      await loadData();
      setBusy(null);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const viewingLead = viewingLeadId ? leads.find(l => l.id === viewingLeadId) || null : null;
  const viewingForm = viewingFormId ? forms.find(f => f.id === viewingFormId) || null : null;
  const documentForm = documentFormId ? forms.find(f => f.id === documentFormId) || null : null;

  // Close a modal whose record was removed or actioned elsewhere.
  useEffect(() => {
    if (!viewingLeadId || !hasLoaded || busy) return;
    if (!viewingLead || viewingLead.status !== 'pending') {
      setViewingLeadId(null);
      setNotice({
        kind: 'error',
        text: viewingLead
          ? `This lead was ${String(viewingLead.status).replace(/_/g, ' ')} by someone else.`
          : 'This lead was removed by someone else.',
      });
    }
  }, [viewingLeadId, viewingLead, hasLoaded, busy]);

  useEffect(() => {
    if (!viewingFormId || !hasLoaded || busy) return;
    if (!viewingForm) {
      setViewingFormId(null);
      setNotice({ kind: 'error', text: 'This form was removed by someone else.' });
    }
  }, [viewingFormId, viewingForm, hasLoaded, busy]);

  // Unfiltered status buckets — the Overview stat cards count these.
  const pendingLeadsAll = leads.filter(l => l.status === 'pending');
  const deprioritizedAll = [
    ...leads.filter(l => l.status === 'rejected' || l.status === 'deprioritized'),
    ...forms.filter(f => f.status === 'deprioritized'),
  ];
  const unknownLeads = leads.filter(l => !LEAD_STATUSES.includes(l.status));
  const appointmentSentAll = forms.filter(f => f.status === 'appointment_sent');
  const scheduledAll = forms.filter(f => f.status === 'scheduled');
  const pendingIntakeAll = forms.filter(f => f.status === 'pending_intake');
  const completedIntakeAll = forms.filter(f => f.status === 'completed_intake');
  const needsAttentionAll = forms.filter(f => !INTAKE_STATUSES.includes(f.status) && f.status !== 'deprioritized');

  // Overview panels: each has its own search box.
  const overviewLeads = pendingLeadsAll.filter(l => matchesSearch(l, overviewSearch.leads));
  const overviewIntake = pendingIntakeAll.filter(f => matchesSearch(f, overviewSearch.intake));
  const overviewCompleted = completedIntakeAll.filter(f => matchesSearch(f, overviewSearch.completed));

  // Leads page: one set of filters for both tabs.
  const pendingLeads = applyFilters(pendingLeadsAll, leadsFilters);
  const deprioritizedLeads = applyFilters(deprioritizedAll, leadsFilters)
    .filter(item => deprioritizedTypeFilter === 'all' || item.status === 'rejected');

  // Intake page: one set of filters for every column.
  const appointmentSentForms = applyFilters(appointmentSentAll, intakeFilters);
  const scheduledForms = applyFilters(scheduledAll, intakeFilters);
  const pendingIntakeForms = applyFilters(pendingIntakeAll, intakeFilters);
  const completedIntakeForms = applyFilters(completedIntakeAll, intakeFilters);
  const needsAttentionForms = applyFilters(needsAttentionAll, intakeFilters);

  // Everyone who can appear in "Person Responsible": the lawyer list plus any
  // name already on a record (older records may name someone not in the list).
  const personOptions = Array.from(
    new Map(
      [...lawyerNames, ...leads.map(l => l.personResponsible), ...forms.map(f => f.personResponsible)]
        .filter(name => name && name.trim())
        .map(name => [normalise(name), name.trim()] as [string, string]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

  const loadingText = hasLoaded ? null : (loadError ? 'Could not load' : 'Loading…');
  const count = (n: number) => (hasLoaded ? n : '…');

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleQualifyLead = (leadId: string) => runAction('qualify', () => qualifyLead(leadId), ({ formId, email }) => {
    setViewingLeadId(null);
    setShareLink(publicLink(`/lead-inquiry?lead_id=${formId}`));
    setNotice(email.ok
      ? { kind: 'success', text: `Lead qualified. ${email.detail}` }
      : { kind: 'error', text: `Lead qualified, but the inquiry email was NOT sent: ${email.detail}\nShare the link with the client directly.` });
  });

  const handleRejectLead = (leadId: string) => runAction('reject', () => rejectLead(leadId), () => setViewingLeadId(null));

  const handleDeleteLead = (lead: any) => {
    if (!window.confirm(`Delete lead for ${lead.name}? This cannot be undone.`)) return;
    runAction(`delete-lead-${lead.id}`, () => deleteLead(lead.id));
  };

  const handleDeleteForm = (form: any) => {
    if (!window.confirm(`Delete form for ${form.name}? This cannot be undone.`)) return;
    runAction(`delete-form-${form.id}`, () => deleteForm(form.id), () => {
      if (viewingFormId === form.id) setViewingFormId(null);
    });
  };

  const handleSendIntake = (form: any) => runAction('send-intake', () => sendIntakeForm(form.id), ({ email }) => {
    setShareLink(publicLink(`/intake-form?lead_id=${form.id}`));
    setNotice(email.ok
      ? { kind: 'success', text: `Intake form sent. ${email.detail}` }
      : { kind: 'error', text: `The form moved to Pending intake, but the email was NOT sent: ${email.detail}\nShare the link with the client directly, or use "Resend intake email".` });
  });

  const handleResendIntake = (form: any) => runAction('resend-intake', () => resendIntakeEmail(form.id));

  const handleSendBack = (formId: string) => runAction('send-back', () => sendBackForm(formId), () => setSendBackFormId(null));

  const handlePopulateClio = async (form: any) => {
    if (busy) return;
    if (!window.confirm('Send to Clio? This will create a matter with all form data.')) return;
    setBusy('clio');
    try {
      let result = await populateMatterToClio(form.id);
      if (!result.ok && result.code === 'ALREADY_SENT') {
        const again = window.confirm('This form has already been sent to Clio. Sending again will create a SECOND matter. Send anyway?');
        if (!again) return;
        result = await populateMatterToClio(form.id, true);
      }
      setNotice(result.ok ? { kind: 'success', text: result.message || 'Sent to Clio.' } : { kind: 'error', text: result.error });
    } finally {
      setBusy(null);
    }
  };

  const handleScreeningFormSubmit = () => {
    setShowScreeningModal(false);
    setNotice({ kind: 'success', text: 'Lead added.' });
    loadData();
  };

  const getLeadDisplay = (lead: any) => {
    const cd = lead.contact_data || {};
    return {
      isFirm: lead.contact_type === 'firm',
      name: lead.name || 'Unknown',
      email: lead.email || '',
      phone: cd.mobile || cd.contactMobile || '',
      title: cd.title || '',
      organisationName: cd.organisationName || '',
      organisationPhone: cd.organisationPhone || '',
      organisationEmail: cd.organisationEmail || '',
      contactName: cd.contactName || '',
      businessRole: cd.businessRole || '',
      leadType: lead.leadType,
      region: lead.region,
      referralType: lead.referralType,
      billingType: lead.billing_type || '',
      personResponsible: lead.personResponsible,
      createdAt: formatDbTimestamp(lead.created_at),
      status: lead.status || 'pending',
    };
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderPersonSelect = (filters: PageFilters, setFilters: (f: PageFilters) => void) => (
    <select
      className='nv-select'
      value={filters.person}
      onChange={(e) => setFilters({ ...filters, person: e.target.value })}
    >
      <option value="">All Lawyers</option>
      {personOptions.map(name => <option key={name} value={name}>{name}</option>)}
      <option value={UNASSIGNED}>Unassigned</option>
    </select>
  );

  const renderDateSelect = (filters: PageFilters, setFilters: (f: PageFilters) => void) => (
    <>
      <select
        className='nv-select'
        value={filters.date.preset}
        onChange={(e) => setFilters({ ...filters, date: { ...filters.date, preset: e.target.value as DatePreset } })}
      >
        <option value="all">All Dates</option>
        <option value="today">Today</option>
        <option value="week">This Week (from Monday)</option>
        <option value="month">This Month (from the 1st)</option>
        <option value="custom">Custom Range</option>
      </select>
      {filters.date.preset === 'custom' && (
        <>
          <input
            className='nv-date'
            type='date'
            aria-label='From date'
            value={filters.date.start}
            onChange={(e) => setFilters({ ...filters, date: { ...filters.date, start: e.target.value } })}
          />
          <input
            className='nv-date'
            type='date'
            aria-label='To date'
            value={filters.date.end}
            onChange={(e) => setFilters({ ...filters, date: { ...filters.date, end: e.target.value } })}
          />
        </>
      )}
    </>
  );

  const renderSearch = (filters: PageFilters, setFilters: (f: PageFilters) => void) => (
    <input
      className='nv-search'
      type='text'
      placeholder='Search by name or email...'
      value={filters.search}
      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
    />
  );

  const renderLeadDetailModal = () => {
    if (!viewingLead) return null;

    const d = getLeadDisplay(viewingLead);
    const actionBusy = busy === 'qualify' || busy === 'reject';
    const detailRow = (label: string, value: string) => (
      value
        ? (
          <div key={label} className='nv-detail-row'>
            <div className='nv-detail-label'>{label}</div>
            <div className='nv-detail-value'>{value}</div>
          </div>
        )
        : null
    );

    return (
      <div
        className='nv-modal-overlay'
        onClick={() => { if (!actionBusy) setViewingLeadId(null); }}
      >
        <div className='nv-modal' onClick={(e) => e.stopPropagation()}>
          <div className='nv-modal-head'>
            <div className='nv-modal-head-main'>
              <p className='nv-modal-eyebrow'>Lead Details</p>
              <h2 className='nv-modal-title'>{d.name || 'Untitled Lead'}</h2>
              <div className='nv-modal-meta'>
                <span className='nv-chip'>
                  <span className='nv-chip-dot' />
                  {d.isFirm ? 'Firm' : 'Person'}
                </span>
                <span className={`nv-chip${d.status === 'rejected' ? ' danger' : d.status === 'qualified' ? ' warm' : ''}`}>
                  <span className='nv-chip-dot' />
                  {String(d.status).replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => { if (!actionBusy) setViewingLeadId(null); }}
              disabled={actionBusy}
              aria-label='Close'
            >
              ×
            </button>
          </div>

          <div className='nv-modal-body'>
            {d.isFirm
              ? (
                <>
                  {detailRow('Organisation', d.organisationName)}
                  {detailRow('Org Phone', d.organisationPhone)}
                  {detailRow('Org Email', d.organisationEmail)}
                  {detailRow('Contact Name', d.contactName)}
                  {detailRow('Contact Mobile', d.phone)}
                  {detailRow('Contact Email', d.email)}
                  {detailRow('Business Role', d.businessRole)}
                </>
              )
              : (
                <>
                  {detailRow('Title', d.title)}
                  {detailRow('Name', d.name)}
                  {detailRow('Email', d.email)}
                  {detailRow('Mobile', d.phone)}
                </>
              )}
            {detailRow('Lead Type', d.leadType)}
            {detailRow('Region', d.region)}
            {detailRow('Referral Type', d.referralType)}
            {detailRow('Billing Type', d.billingType)}
            {detailRow('Person Responsible', d.personResponsible)}
            {detailRow('Created', d.createdAt)}
          </div>

          <div className='nv-modal-actions'>
            <button
              className='nv-btn-reject'
              onClick={() => handleRejectLead(viewingLead.id)}
              disabled={!!busy}
              title='Disqualify this lead'
            >
              {busy === 'reject' ? 'Disqualifying...' : 'Disqualify'}
            </button>
            <button
              className='nv-btn-qualify'
              onClick={() => handleQualifyLead(viewingLead.id)}
              disabled={!!busy}
              title='Send appointment and move to next stage'
            >
              {busy === 'qualify' ? 'Sending...' : 'Send Appointment'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLinkModal = () => {
    if (!shareLink) return null;

    return (
      <div
        className='nv-modal-overlay'
        onClick={() => setShareLink(null)}
      >
        <div className='nv-modal' onClick={(e) => e.stopPropagation()}>
          <div className='nv-modal-head'>
            <div className='nv-modal-head-main'>
              <p className='nv-modal-eyebrow'>Form Link</p>
              <h2 className='nv-modal-title'>Share with Client</h2>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => setShareLink(null)}
              title='Close'
            >
              ×
            </button>
          </div>
          <div className='nv-modal-body' style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
              Copy this link and send it to your client:
            </p>
            {shareLink.warning && <p className='nv-link-warning'>{shareLink.warning}</p>}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <input
                type='text'
                readOnly
                value={shareLink.url}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink.url);
                    setNotice({ kind: 'success', text: 'Link copied to clipboard.' });
                  } catch {
                    setNotice({ kind: 'error', text: 'Could not copy automatically — select the link and copy it.' });
                  }
                }}
                style={{
                  padding: '0.75rem 1.2rem',
                  background: '#4a8fa0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Copy
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1rem' }}>
              The form will be available at this link until they submit their responses.
            </p>
            <button
              onClick={() => setShareLink(null)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderIntakeFormModal = () => {
    if (!viewingForm) return null;

    // Parse form_data if it's a string
    let formData = viewingForm.form_data;

    if (typeof formData === 'string') {
      try {
        formData = JSON.parse(formData);
      } catch (e) {
        formData = {};
      }
    }

    const isCompletedIntake = viewingForm.status === 'completed_intake';
    const isPendingIntake = viewingForm.status === 'pending_intake';
    const showBothForms = isPendingIntake || isCompletedIntake;

    return (
      <div
        className='nv-modal-overlay'
        onClick={() => { if (!busy) setViewingFormId(null); }}
      >
        <div className='nv-modal' onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className='nv-modal-head'>
            <div className='nv-modal-head-main'>
              <p className='nv-modal-eyebrow'>Lead Information</p>
              <h2 className='nv-modal-title'>{viewingForm.name || 'Untitled'}</h2>
              <div className='nv-modal-meta'>
                <span className='nv-chip'>
                  <span className='nv-chip-dot' />
                  {viewingForm.status ? String(viewingForm.status).replace(/_/g, ' ') : 'Unknown'}
                </span>
              </div>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => { if (!busy) setViewingFormId(null); }}
              disabled={!!busy}
              aria-label='Close'
            >
              ×
            </button>
          </div>

          <div className='nv-modal-body'>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Lead Details</h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                <div><strong>Name:</strong> {viewingForm.name}</div>
                <div><strong>Email:</strong> {viewingForm.client_email || '—'}</div>
                <div><strong>Responsible:</strong> {viewingForm.personResponsible || 'Unassigned'}</div>
                <div><strong>Created:</strong> {formatDbTimestamp(viewingForm.created_at) || '—'}</div>
                {viewingForm.intake_sent_at && (
                  <div><strong>Intake sent:</strong> {formatDbTimestamp(viewingForm.intake_sent_at)}</div>
                )}
                {viewingForm.clio_populated_at && (
                  <div><strong>Sent to Clio:</strong> {formatDbTimestamp(viewingForm.clio_populated_at)}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Forms</h3>

              <div style={{ marginBottom: '16px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>Initial Outreach Form</div>

                {/* Display inquiry form summary if submitted */}
                {formData?.inquiry ? (
                  <div style={{ marginBottom: '12px', padding: '12px', background: '#f9f9f9', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
                    {formData.inquiry?.client_name && (
                      <div><strong>Name:</strong> {formData.inquiry.client_name}</div>
                    )}
                    {formData.inquiry?.client_email && (
                      <div><strong>Email:</strong> {formData.inquiry.client_email}</div>
                    )}
                    {formData.inquiry?.client_phone && (
                      <div><strong>Phone:</strong> {formData.inquiry.client_phone}</div>
                    )}
                    {formData.inquiry?.client_state && (
                      <div><strong>State:</strong> {formData.inquiry.client_state}</div>
                    )}
                    {formData.inquiry?.inquiry_reason && (
                      <div><strong>Reason:</strong> {formData.inquiry.inquiry_reason}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px', padding: '12px', background: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
                    No inquiry data yet
                  </div>
                )}

                <button
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: '#4a8fa0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.open(`/lead-inquiry?lead_id=${viewingForm.id}`, '_blank')}
                >
                  {formData?.inquiry ? 'View Details' : 'View Form'}
                </button>
              </div>

              {showBothForms ? (
                <div style={{ padding: '12px', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
                    Intake Form
                    <span style={{ float: 'right', color: '#666' }}>
                      {viewingForm.progress}% complete
                    </span>
                  </div>
                  {/* Show intake data summary if available */}
                  {formData?.intake && (
                    <div style={{ marginBottom: '12px', padding: '12px', background: '#f9f9f9', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
                      {formData.intake.client_name && (
                        <div><strong>Client:</strong> {formData.intake.client_name}</div>
                      )}
                      {formData.intake.client_state && (
                        <div><strong>State:</strong> {formData.intake.client_state}</div>
                      )}
                      {formData.intake.scenario && (
                        <div><strong>Scenario:</strong> {formData.intake.scenario}</div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isCompletedIntake && (
                      <button
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: '#2f4858',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                        onClick={() => window.open(`/intake-form?lead_id=${viewingForm.id}&edit=true`, '_blank')}
                      >
                        ✏️ Edit Form
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px', border: '1px dashed #ddd', borderRadius: '4px', background: '#fafafa', color: '#999', fontSize: '12px' }}>
                  Intake form will be available after appointment is scheduled
                </div>
              )}
            </div>
          </div>

          {viewingForm.status === 'scheduled' && (
            <div className='nv-modal-actions'>
              <button
                className='nv-btn-qualify'
                disabled={!!busy}
                onClick={() => handleSendIntake(viewingForm)}
              >
                {busy === 'send-intake' ? 'Sending...' : 'Send Intake Form'}
              </button>
            </div>
          )}

          {isPendingIntake && (
            <div className='nv-modal-actions'>
              <button
                className='nv-btn-view'
                disabled={!!busy}
                onClick={() => setShareLink(publicLink(`/intake-form?lead_id=${viewingForm.id}`))}
              >
                Show intake link
              </button>
              <button
                className='nv-btn-qualify'
                disabled={!!busy}
                onClick={() => handleResendIntake(viewingForm)}
              >
                {busy === 'resend-intake' ? 'Sending...' : 'Resend intake email'}
              </button>
            </div>
          )}

          {isCompletedIntake && (
            <div className='nv-modal-actions'>
              <button
                className='nv-btn-qualify'
                style={{ background: '#2f7c94' }}
                disabled={!!busy}
                onClick={() => {
                  setDocumentFormId(viewingForm.id);
                  setShowDocumentGenerator(true);
                }}
              >
                📄 Generate Documents
              </button>
              <button
                className='nv-btn-view'
                disabled={!!busy}
                onClick={() => {
                  setSendBackFormId(viewingForm.id);
                  setViewingFormId(null);
                }}
              >
                Send Back Reminder
              </button>
              <button
                className='nv-btn-qualify'
                disabled={!!busy}
                onClick={() => handlePopulateClio(viewingForm)}
              >
                {busy === 'clio' ? 'Sending...' : 'Populate Matter → Clio'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPipeCard = (form: any, extraActions?: ReactNode) => (
    <div key={form.id} className='nv-pipe-card'>
      <h4 className='nv-pipe-name'>{form.name}</h4>
      <p className='nv-pipe-email'>{form.client_email || '—'}</p>
      <div className='nv-pipe-meta'>
        <span className='nv-chip'>
          <span className='nv-chip-dot' />
          {form.personResponsible || 'Unassigned'}
        </span>
        {!INTAKE_STATUSES.includes(form.status) && (
          <span className='nv-chip danger'>
            <span className='nv-chip-dot' />
            {String(form.status || 'no status').replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className='nv-progress'>
        <div className='nv-progress-track'>
          <div className='nv-progress-fill' style={{ width: `${Math.min(100, form.progress)}%` }} />
        </div>
        <span className='nv-progress-pct'>{form.progress}%</span>
      </div>
      <div className='nv-pipe-actions'>
        <button
          type='button'
          className='nv-btn-view'
          onClick={() => setViewingFormId(form.id)}
        >
          View
        </button>
        {extraActions}
        <button
          type='button'
          className='nv-btn-delete'
          disabled={!!busy}
          onClick={() => handleDeleteForm(form)}
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderKanbanColumn = (title: string, items: any[], empty: string, extraActions?: (form: any) => ReactNode) => (
    <section className='nv-kanban-col'>
      <div className='nv-kanban-col-head'>
        <h3 className='nv-kanban-col-title'>{title}</h3>
        <span className='nv-kanban-col-count'>{count(items.length)}</span>
      </div>
      <div className='nv-kanban-col-body'>
        {loadingText
          ? <div className='nv-kanban-empty'>{loadingText}</div>
          : items.length === 0
            ? <div className='nv-kanban-empty'>{empty}</div>
            : items.map(form => renderPipeCard(form, extraActions?.(form)))}
      </div>
    </section>
  );

  const pageTitle =
    activeNav === 'overview'
      ? 'Overview'
      : activeNav === 'pending-leads'
        ? 'Leads'
        : 'Intake';
  const pageDesc =
    activeNav === 'pending-leads'
      ? 'Review inbound enquiries before qualifying or declining.'
      : activeNav === 'qualified-leads'
        ? 'Track intake progress for qualified clients.'
        : 'Your practice at a glance, what needs attention today.';

  const userInitials = (lawyer?.full_name || 'NL')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
        <div style={{ textAlign: 'center', color: C.charcoal }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!lawyer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg, padding: '20px' }}>
        <div style={{ maxWidth: '440px', textAlign: 'center', color: C.charcoal }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>No lawyer profile</div>
          <p style={{ marginBottom: '20px' }}>{lawyerError || 'Your account is not linked to a lawyer profile.'}</p>
          <button type='button' className='auth-button' onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className='nv-app'>
      <aside className='nv-sidebar'>
        <div className='nv-brand' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo.png" alt="St Ives Law" style={{ height: '60px', width: 'auto', marginBottom: '12px', maxWidth: '90%', objectFit: 'contain' }} />
          <div className='nv-brand-sub' style={{ textAlign: 'center' }}>Client Intake</div>
          <div className='nv-brand-rule' />
        </div>

        <nav className='nv-nav'>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'pending-leads', label: 'Leads' },
            { id: 'qualified-leads', label: 'Intake' },
          ].map(item => (
            <button
              key={item.id}
              type='button'
              className={`nv-nav-btn${activeNav === item.id ? ' active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type='button'
          className='nv-sidebar-cta'
          onClick={() => setShowScreeningModal(true)}
        >
          <Plus className='nv-sidebar-cta-icon' strokeWidth={2.5} aria-hidden />
          New Lead
        </button>

        <div className='nv-sidebar-foot'>
          <div className='nv-sidebar-user'>{lawyer.full_name}</div>
          <button type='button' className='nv-logout' onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className='nv-main'>
        <header className='nv-topbar'>
          <div>
            <p className='nv-topbar-eyebrow'>St Ives Law</p>
            <h1 className='nv-topbar-title'>{pageTitle}</h1>
            <p className='nv-topbar-desc'>{pageDesc}</p>
          </div>
          <div className='nv-user-chip'>
            <div className='nv-user-avatar'>{userInitials}</div>
            <span className='nv-user-name'>{lawyer.full_name}</span>
          </div>
        </header>

        {(loadError || lawyerListError) && (
          <div className='nv-banner error' role='alert'>
            <span className='nv-banner-text'>
              {[
                loadError && `${loadError}${hasLoaded ? ' Showing the last data that loaded.' : ''}`,
                lawyerListError,
              ].filter(Boolean).join('\n')}
            </span>
            <button
              type='button'
              className='nv-banner-btn'
              onClick={() => { loadData(); loadLawyerNames(); }}
            >
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div className={`nv-banner ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <span className='nv-banner-text'>{notice.text}</span>
            <button type='button' className='nv-banner-btn' onClick={() => setNotice(null)} aria-label='Dismiss'>×</button>
          </div>
        )}

        {/* Overview */}
        {activeNav === 'overview' && (
          <div className='nv-overview'>
            <div className='nv-stats'>
              <div className='nv-stat-card'>
                <p className='nv-stat-label'>Pending Leads</p>
                <p className='nv-stat-value'>{count(pendingLeadsAll.length)}</p>
                <p className='nv-stat-hint'>Awaiting qualify or reject</p>
              </div>

              <div className='nv-stat-card warm'>
                <p className='nv-stat-label'>Pending Intake Forms</p>
                <p className='nv-stat-value'>{count(pendingIntakeAll.length)}</p>
                <p className='nv-stat-hint'>Clients still completing forms</p>
              </div>

              <div className='nv-stat-card green'>
                <p className='nv-stat-label'>Completed Forms</p>
                <p className='nv-stat-value'>{count(completedIntakeAll.length)}</p>
                <p className='nv-stat-hint'>Ready for lawyer review</p>
              </div>
            </div>

            <div className='nv-overview-grid'>
              <section className='nv-panel'>
                <div className='nv-panel-head'>
                  <h2 className='nv-panel-title'>Pending Leads</h2>
                  <span className='nv-panel-count'>{count(overviewLeads.length)}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name or email...'
                  value={overviewSearch.leads}
                  onChange={(e) => setOverviewSearch({ ...overviewSearch, leads: e.target.value })}
                />
                <div className='nv-panel-list'>
                  {loadingText
                    ? <div className='nv-panel-empty'>{loadingText}</div>
                    : overviewLeads.length === 0
                      ? <div className='nv-panel-empty'>No pending leads</div>
                      : overviewLeads.map(lead => (
                        <div key={lead.id} className='nv-panel-item' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className='nv-panel-item-name'>{lead.name}</p>
                              <p className='nv-panel-item-meta'>{lead.email}</p>
                              <p className='nv-panel-item-meta'>{lead.personResponsible || 'Unassigned'}</p>
                            </div>
                            <div style={{ minWidth: '80px', textAlign: 'center' }}>
                              {lead.region && <span className='nv-chip'><span className='nv-chip-dot' />{lead.region}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button
                                type='button'
                                className='nv-btn-view'
                                onClick={() => setViewingLeadId(lead.id)}
                                style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                              >
                                View
                              </button>
                              <button
                                type='button'
                                className='nv-btn-delete'
                                disabled={!!busy}
                                onClick={() => handleDeleteLead(lead)}
                                style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </section>

              <section className='nv-panel'>
                <div className='nv-panel-head'>
                  <h2 className='nv-panel-title'>Pending Intake</h2>
                  <span className='nv-panel-count'>{count(overviewIntake.length)}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name or email...'
                  value={overviewSearch.intake}
                  onChange={(e) => setOverviewSearch({ ...overviewSearch, intake: e.target.value })}
                />
                <div className='nv-panel-list'>
                  {loadingText
                    ? <div className='nv-panel-empty'>{loadingText}</div>
                    : overviewIntake.length === 0
                      ? <div className='nv-panel-empty'>No forms in progress</div>
                      : overviewIntake.map(form => (
                        <div key={form.id} className='nv-panel-item' onClick={() => setViewingFormId(form.id)} style={{ cursor: 'pointer' }}>
                          <p className='nv-panel-item-name'>{form.name}</p>
                          <p className='nv-panel-item-meta'>{form.client_email || form.personResponsible || '—'}</p>
                          <div className='nv-panel-item-row'>
                            <div className='nv-progress'>
                              <div className='nv-progress-track'>
                                <div className='nv-progress-fill' style={{ width: `${Math.min(100, form.progress)}%` }} />
                              </div>
                              <span className='nv-progress-pct'>{form.progress}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </section>

              <section className='nv-panel'>
                <div className='nv-panel-head'>
                  <h2 className='nv-panel-title'>Completed Forms</h2>
                  <span className='nv-panel-count'>{count(overviewCompleted.length)}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name or email...'
                  value={overviewSearch.completed}
                  onChange={(e) => setOverviewSearch({ ...overviewSearch, completed: e.target.value })}
                />
                <div className='nv-panel-list'>
                  {loadingText
                    ? <div className='nv-panel-empty'>{loadingText}</div>
                    : overviewCompleted.length === 0
                      ? <div className='nv-panel-empty'>No completed forms yet</div>
                      : overviewCompleted.map(form => (
                        <div key={form.id} className='nv-panel-item' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className='nv-panel-item-name'>{form.name}</p>
                            <p className='nv-panel-item-meta'>{form.client_email || '—'}</p>
                            <div className='nv-panel-item-row'>
                              <p className='nv-panel-item-meta'>{form.personResponsible || 'Unassigned'}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => setViewingFormId(form.id)}
                              style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              View
                            </button>
                            <button
                              type='button'
                              className='nv-btn-delete'
                              disabled={!!busy}
                              onClick={() => handleDeleteForm(form)}
                              style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Leads */}
        {activeNav === 'pending-leads' && (
          <div>
            <div className='nv-toolbar'>
              <div className='nv-filters'>
                {renderSearch(leadsFilters, setLeadsFilters)}
                {renderPersonSelect(leadsFilters, setLeadsFilters)}
                {renderDateSelect(leadsFilters, setLeadsFilters)}
              </div>

              <div className='nv-tabs'>
                <button
                  type='button'
                  className={`nv-tab${pendingLeadsTab === 'pending' ? ' active' : ''}`}
                  onClick={() => setPendingLeadsTab('pending')}
                >
                  Pending
                  <span className='nv-tab-count'>{count(pendingLeads.length)}</span>
                </button>
                <button
                  type='button'
                  className={`nv-tab${pendingLeadsTab === 'deprioritized' ? ' active' : ''}`}
                  onClick={() => setPendingLeadsTab('deprioritized')}
                >
                  Deprioritized
                  <span className='nv-tab-count'>{count(deprioritizedLeads.length)}</span>
                </button>
              </div>
            </div>

            {unknownLeads.length > 0 && (
              <div className='nv-banner error'>
                <span className='nv-banner-text'>
                  {unknownLeads.length} lead(s) have an unrecognised status and are not shown in either tab:
                  {' '}{unknownLeads.map(l => `${l.name} (${l.status || 'no status'})`).join(', ')}
                </span>
              </div>
            )}

            {pendingLeadsTab === 'pending' && (
              <div className='nv-lead-list'>
                {loadingText
                  ? <div className='nv-empty'>{loadingText}</div>
                  : pendingLeads.length === 0
                    ? <div className='nv-empty'>No pending leads match these filters.</div>
                    : pendingLeads.map(lead => (
                      <div key={lead.id} className='nv-lead-card'>
                        <div className='nv-lead-main'>
                          <h3 className='nv-lead-name'>{lead.name}</h3>
                          <p className='nv-lead-email'>{lead.email}</p>
                          <div className='nv-lead-meta'>
                            {lead.region && (
                              <span className='nv-chip'>
                                <span className='nv-chip-dot' />
                                {lead.region}
                              </span>
                            )}
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {lead.personResponsible || 'Unassigned'}
                            </span>
                            {lead.referralType && (
                              <span className='nv-chip warm'>
                                <span className='nv-chip-dot' />
                                {lead.referralType}
                              </span>
                            )}
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {formatDbTimestamp(lead.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className='nv-pipe-actions'>
                          <button
                            type='button'
                            className='nv-btn-view'
                            onClick={() => setViewingLeadId(lead.id)}
                          >
                            View
                          </button>
                          <button
                            type='button'
                            className='nv-btn-delete'
                            disabled={!!busy}
                            onClick={() => handleDeleteLead(lead)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            )}

            {pendingLeadsTab === 'deprioritized' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'rejected', label: 'Rejected' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type='button'
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        background: deprioritizedTypeFilter === option.id ? '#f0f0f0' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                      onClick={() => setDeprioritizedTypeFilter(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className='nv-lead-list'>
                  {loadingText
                    ? <div className='nv-empty'>{loadingText}</div>
                    : deprioritizedLeads.length === 0
                      ? <div className='nv-empty'>No deprioritized or rejected leads match these filters.</div>
                      : deprioritizedLeads.map(lead => (
                        <div key={lead.id} className='nv-lead-card'>
                          <div className='nv-lead-main'>
                            <h3 className='nv-lead-name'>{lead.name}</h3>
                            <p className='nv-lead-email'>{lead.email}</p>
                            <div className='nv-lead-meta'>
                              {lead.region && (
                                <span className='nv-chip'>
                                  <span className='nv-chip-dot' />
                                  {lead.region}
                                </span>
                              )}
                              <span className='nv-chip'>
                                <span className='nv-chip-dot' />
                                {lead.personResponsible || 'Unassigned'}
                              </span>
                              {lead.referralType && (
                                <span className='nv-chip warm'>
                                  <span className='nv-chip-dot' />
                                  {lead.referralType}
                                </span>
                              )}
                              <span className={`nv-chip${lead.status === 'rejected' ? ' danger' : ''}`}>
                                <span className='nv-chip-dot' />
                                {lead.status === 'rejected' ? 'Rejected' : 'Deprioritized'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Intake */}
        {activeNav === 'qualified-leads' && (
          <div className='nv-qualified'>
            <div className='nv-toolbar'>
              <div className='nv-filters'>
                {renderSearch(intakeFilters, setIntakeFilters)}
                {renderPersonSelect(intakeFilters, setIntakeFilters)}
                {renderDateSelect(intakeFilters, setIntakeFilters)}
              </div>
            </div>

            <div className='nv-kanban'>
              <div className='nv-kanban-track'>
                {renderKanbanColumn('Appointment Sent', appointmentSentForms, 'No appointments sent')}
                {renderKanbanColumn('Scheduled', scheduledForms, 'Nothing scheduled')}
                {renderKanbanColumn('Pending intake', pendingIntakeForms, 'No pending forms')}
                {renderKanbanColumn('Completed Intake', completedIntakeForms, 'None completed yet', (form) => (
                  <>
                    <button
                      type='button'
                      className='nv-btn-view'
                      disabled={!!busy}
                      onClick={() => setSendBackFormId(form.id)}
                    >
                      Send Back
                    </button>
                    <button
                      type='button'
                      className='nv-btn-qualify'
                      disabled={!!busy}
                      onClick={() => handlePopulateClio(form)}
                    >
                      {form.clio_populated_at ? 'Re-send to Clio' : 'Populate'}
                    </button>
                  </>
                ))}
                {needsAttentionForms.length > 0
                  && renderKanbanColumn('Needs attention', needsAttentionForms, '')}
              </div>
            </div>
          </div>
        )}

        {/* Lead Detail Modal */}
        {renderLeadDetailModal()}

        {/* Intake Form Modal */}
        {renderIntakeFormModal()}

        {/* Form Link Modal */}
        {renderLinkModal()}

        {/* Document Generator */}
        {showDocumentGenerator && documentFormId && (
          <div className='nv-modal-overlay' onClick={() => setShowDocumentGenerator(false)}>
            <div
              className='nv-modal'
              style={{ maxWidth: '1200px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className='nv-modal-head'>
                <div className='nv-modal-head-main'>
                  <p className='nv-modal-eyebrow'>Generate Documents</p>
                  <h2 className='nv-modal-title'>Select & Customize Documents</h2>
                </div>
                <button
                  type='button'
                  className='nv-modal-close'
                  onClick={() => setShowDocumentGenerator(false)}
                  aria-label='Close'
                >
                  ×
                </button>
              </div>
              <div className='nv-modal-body' style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <DocumentSelection
                  formId={documentFormId}
                  intakeData={documentForm?.form_data?.intake || {}}
                  onClose={() => setShowDocumentGenerator(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Document Editor */}
        {showDocumentEditor && documentFormId && (
          <div className='nv-modal-overlay' onClick={() => setShowDocumentEditor(false)}>
            <div
              className='nv-modal'
              style={{ maxWidth: '1400px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className='nv-modal-head'>
                <div className='nv-modal-head-main'>
                  <p className='nv-modal-eyebrow'>Edit Documents</p>
                  <h2 className='nv-modal-title'>Document Editor</h2>
                </div>
                <button
                  type='button'
                  className='nv-modal-close'
                  onClick={() => setShowDocumentEditor(false)}
                  aria-label='Close'
                >
                  ×
                </button>
              </div>
              <div className='nv-modal-body' style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <DocumentEditor
                  formId={documentFormId}
                  onClose={() => setShowDocumentEditor(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Send Back Modal */}
        {sendBackFormId && (
          <div
            className='nv-modal-overlay'
            onClick={() => { if (!busy) setSendBackFormId(null); }}>
            <div
              className='nv-modal'
              onClick={(e) => e.stopPropagation()}>
              <div className='nv-modal-head'>
                <div className='nv-modal-head-main'>
                  <p className='nv-modal-eyebrow'>Form Validation</p>
                  <h2 className='nv-modal-title'>Send Back for Completion</h2>
                </div>
                <button
                  type='button'
                  className='nv-modal-close'
                  onClick={() => setSendBackFormId(null)}
                  disabled={!!busy}
                  aria-label='Close'>
                  ×
                </button>
              </div>
              <div className='nv-modal-body'>
                <p style={{ marginBottom: '16px', color: '#555' }}>
                  This will email the client with a summary of the fields they need to complete.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    type='button'
                    onClick={() => setSendBackFormId(null)}
                    disabled={!!busy}
                    style={{
                      padding: '8px 16px',
                      background: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}>
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={() => handleSendBack(sendBackFormId)}
                    disabled={!!busy}
                    style={{
                      padding: '8px 16px',
                      background: '#d97706',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}>
                    {busy === 'send-back' ? 'Sending...' : 'Send Back'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Screening Form Modal */}
        {showScreeningModal && (
          <div
            className='nv-modal-overlay'
            onClick={() => setShowScreeningModal(false)}>
            <div
              className='nv-modal screening'
              onClick={(e) => e.stopPropagation()}>
              <div className='nv-modal-head'>
                <div className='nv-modal-head-main'>
                  <p className='nv-modal-eyebrow'>Client Intake</p>
                  <h2 className='nv-modal-title'>New Screening</h2>
                </div>
                <button
                  type='button'
                  className='nv-modal-close'
                  onClick={() => setShowScreeningModal(false)}
                  aria-label='Close'>
                  ×
                </button>
              </div>
              <div className='nv-modal-scroll' ref={screeningScrollRef}>
                <div className='nv-modal-body'>
                  <Suspense fallback={<div className='nv-empty'>Loading form...</div>}>
                    <ScreeningFormV2
                      lawyerId={lawyer.id}
                      onSubmit={handleScreeningFormSubmit}
                      onClose={() => setShowScreeningModal(false)}/>
                  </Suspense>
                </div>
              </div>
              {showScreenScrollHint
                ?
                  <button
                    type='button'
                    className='nv-screen-scroll-hint'
                    onClick={handleScreenScrollHint}
                    aria-label='Scroll for more'
                    title='Scroll for more'
                  >
                    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                      <path d='M6 9l6 6 6-6' />
                    </svg>
                  </button>

                : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

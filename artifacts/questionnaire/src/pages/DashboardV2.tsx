import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { C } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  qualifyLead,
  rejectLead,
  deprioritizeLead,
  deprioritizeForm,
  markFormComplete,
  submitFormToSmokeball,
  sendIntakeForm,
  deleteForm,
} from '../lib/dashboard-actions';
import '../styles/dashboard.css';

const ScreeningFormV2 = lazy(() => import('./ScreeningFormV2'));

// Constants
const LAWYERS = ['John Smith', 'Emma Taylor', 'Michael Brown'];

// Mock data
const pendingLeads = [
  { id: '1', name: 'John Smith', email: 'john@example.com', leadType: 'Direct', region: 'NSW', referralType: 'Accountant', personResponsible: 'Colin Long' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', leadType: 'Referral', region: 'VIC', referralType: 'Existing Client', personResponsible: 'Emma Mathieson' },
  { id: '3', name: 'Mike Brown', email: 'mike@example.com', leadType: 'Direct', region: 'QLD', referralType: 'Google', personResponsible: 'Katrina Elizabeth Brown' },
];

const inProgressForms = [
  { id: 'f1', name: 'Alice Chen', progress: 45, personResponsible: 'Sarah Tait', daysOverdue: 0 },
  { id: 'f2', name: 'Bob Wilson', progress: 78, personResponsible: 'Tyler Smith', daysOverdue: 0 },
];

const completedForms = [
  { id: 'f3', name: 'Carol Davis', personResponsible: 'Vicki Baker', lastAction: '2 days ago' },
];

const submittedForms = [
  { id: 'f4', name: 'David Miller', personResponsible: 'Colin Long', submittedAt: '1 week ago' },
];

const overdueForms = [
  { id: 'f5', name: 'Emma White', daysOverdue: 15, personResponsible: 'Emma Mathieson', progress: 25 },
  { id: 'f6', name: 'Frank Green', daysOverdue: 8, personResponsible: 'Katrina Elizabeth Brown', progress: 40 },
];

export default function DashboardV2() {
  const { user, lawyer, loading, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [pendingLeadsTab, setPendingLeadsTab] = useState('pending');
  const [completedFormsTab, setCompletedFormsTab] = useState('completed');

  // Real data from Supabase
  const [realPendingLeads, setRealPendingLeads] = useState<any[]>([]);
  const [realForms, setRealForms] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Screening modal
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showScreenScrollHint, setShowScreenScrollHint] = useState(false);
  const screeningScrollRef = useRef<HTMLDivElement>(null);

  // Lead detail modal (view → then qualify/reject)
  const [viewingLead, setViewingLead] = useState<any | null>(null);
  const [leadActionLoading, setLeadActionLoading] = useState(false);

  // Intake form modal
  const [viewingIntakeForm, setViewingIntakeForm] = useState<any | null>(null);
  const [intakeActionLoading, setIntakeActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'pending_intake' | 'completed_intake' | null>(null);

  // Form link modal (temporary - until webhook automation)
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  // Send back modal
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [sendBackFormId, setSendBackFormId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [user, loading]);

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

  const handleScreenScrollHint = () => {
    const scrollEl = screeningScrollRef.current;
    if (!scrollEl) return;
    const remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    scrollEl.scrollBy({ top: Math.min(320, remaining), behavior: 'smooth' });
  };
  const fetchData = useCallback(async () => {
      setDataLoading(true);
      console.log('Fetching data for lawyer:', lawyer.id, 'Admin:', lawyer.is_admin);
      try {
        let screeningQuery = supabase.from('screening_submissions').select('*');
        let formsQuery = supabase.from('forms').select('*');

        // Admin can see all, regular lawyers see only their own
        if (!lawyer.is_admin) {
          screeningQuery = screeningQuery.eq('lawyer_id', lawyer.id);
          formsQuery = formsQuery.eq('lawyer_id', lawyer.id);
        }

        const { data: screenings, error: screeningError } = await screeningQuery.order('created_at', { ascending: false });
        const { data: forms, error: formsError } = await formsQuery.order('created_at', { ascending: false });

        if (screeningError) console.error('Screening error:', screeningError);
        if (formsError) console.error('Forms error:', formsError);

        console.log('Fetched screenings:', screenings?.length || 0);
        console.log('Fetched forms:', forms?.length || 0);

        // Extract names from contact_data
        const processedScreenings = (screenings || []).map(s => ({
          ...s,
          name: s.contact_data?.name || s.contact_data?.contactName || 'Unknown',
          email: s.contact_data?.email || s.contact_data?.contactEmail || '',
          personResponsible: s.person_responsible || '',
          region: s.region || '',
          referralType: s.referral_type || '',
          leadType: s.lead_type || '',
        }));

        setRealPendingLeads(processedScreenings);

        // Map forms data to expected field names
        const processedForms = (forms || []).map(f => {
          // Calculate days overdue
          const createdDate = new Date(f.created_at);
          const today = new Date();
          const daysOverdue = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            ...f,
            name: f.client_name || 'Unknown',
            progress: f.progress_pct || 0,
            personResponsible: f.person_responsible || '',
            daysOverdue: f.status === 'overdue' ? daysOverdue : 0,
          };
        });

        setRealForms(processedForms);

        // DISABLED - Check for overdue forms and send reminders (will re-enable later)
        // if (forms && forms.length > 0 && supabase) {
        //   await checkAndSendOverdueReminders(forms, supabase);
        // }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setDataLoading(false);
      }
  }, [lawyer?.id, lawyer?.is_admin, supabase]);

  const checkAndSendOverdueReminders = useCallback(async (forms: any[], sb: any) => {
      const REMINDER_WEBHOOK = 'https://hook.eu2.make.com/mjiv8gg69a3dn5ktex4tqlj5j1oji5fk';
      const now = new Date();

      for (const form of forms) {
        if (!form.created_at) continue;

        const createdDate = new Date(form.created_at);
        const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        // 3-day reminder (mark as overdue)
        if (daysOld >= 3 && !form.reminder_3d_sent && form.status !== 'completed' && form.status !== 'submitted') {
          console.log('3-day reminder triggering for form:', form.id, 'daysOld:', daysOld, 'reminder_3d_sent:', form.reminder_3d_sent);
          try {
            const formLink = `${window.location.origin}/?uniqueLink=${form.unique_link}`;
            // WEBHOOK DISABLED - will re-enable with new Supabase
            // const webhookRes = await fetch(REMINDER_WEBHOOK, {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({
            //     form_id: form.id,
            //     client_name: form.client_name,
            //     client_email: form.client_email,
            //     form_link: formLink,
            //     reminder_type: '3d',
            //     days_old: daysOld,
            //     sent_at: new Date().toISOString(),
            //   }),
            // });
            // console.log('Webhook sent, status:', webhookRes.status);

            // Mark form as overdue at 3-day threshold
            console.log('Attempting to update form', form.id, 'to overdue status');
            const { data, error } = await sb
              .from('forms')
              .update({
                reminder_3d_sent: new Date().toISOString(),
                status: 'overdue',
              })
              .eq('id', form.id)
              .select();

            console.log('Update response - data:', data, 'error:', error);

            if (error) {
              console.error('Error updating form to overdue:', form.id, error);
            } else {
              console.log('Form updated successfully, updating local state');
              // Update local state after successful database update
              setRealForms(prev =>
                prev.map(f => f.id === form.id ? { ...f, status: 'overdue', reminder_3d_sent: new Date().toISOString() } : f)
              );
            }
          } catch (err) {
            console.error('Error sending 3-day reminder for form', form.id, err);
          }
        }

        // 1-week reminder
        if (daysOld >= 7 && !form.reminder_1w_sent && form.status !== 'completed' && form.status !== 'submitted') {
          try {
            const formLink = `${window.location.origin}/?uniqueLink=${form.unique_link}`;
            await fetch(REMINDER_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                form_id: form.id,
                client_name: form.client_name,
                client_email: form.client_email,
                form_link: formLink,
                reminder_type: '1w',
                days_old: daysOld,
                sent_at: new Date().toISOString(),
              }),
            });

            await sb
              .from('forms')
              .update({ reminder_1w_sent: new Date().toISOString() })
              .eq('id', form.id);
          } catch (err) {
            console.error('Error sending 1-week reminder for form', form.id, err);
          }
        }

        // 2-week reminder
        if (daysOld >= 14 && !form.reminder_2w_sent && form.status !== 'completed' && form.status !== 'submitted') {
          try {
            const formLink = `${window.location.origin}/?uniqueLink=${form.unique_link}`;
            await fetch(REMINDER_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                form_id: form.id,
                client_name: form.client_name,
                client_email: form.client_email,
                form_link: formLink,
                reminder_type: '2w',
                days_old: daysOld,
                sent_at: new Date().toISOString(),
              }),
            });

            await sb
              .from('forms')
              .update({ reminder_2w_sent: new Date().toISOString() })
              .eq('id', form.id);
          } catch (err) {
            console.error('Error sending 2-week reminder for form', form.id, err);
          }
        }
      }
  }, []);

  useEffect(() => {
    if (!lawyer?.id || !supabase) return;

    fetchData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [lawyer?.id, lawyer?.is_admin, supabase, fetchData]);

  // Overview filters
  const [pendingLeadsSearch, setPendingLeadsSearch] = useState('');
  const [intakeFormSearch, setIntakeFormSearch] = useState('');
  const [intakeFormPersonFilter, setIntakeFormPersonFilter] = useState('');
  const [intakeDateFilter, setIntakeDateFilter] = useState('all');
  const [intakeDateStart, setIntakeDateStart] = useState('');
  const [intakeDateEnd, setIntakeDateEnd] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedPersonFilter, setCompletedPersonFilter] = useState('');
  const [completedDateFilter, setCompletedDateFilter] = useState('all');
  const [completedDateStart, setCompletedDateStart] = useState('');
  const [completedDateEnd, setCompletedDateEnd] = useState('');

  // Overdue filter
  const [overdueFilter, setOverdueFilter] = useState('all');

  // Pending leads filters
  const [pendingLeadsPersonFilter, setPendingLeadsPersonFilter] = useState('');
  const [pendingLeadsDateFilter, setPendingLeadsDateFilter] = useState('all');
  const [pendingLeadsDateStart, setPendingLeadsDateStart] = useState('');
  const [pendingLeadsDateEnd, setPendingLeadsDateEnd] = useState('');

  // Deprioritized filter
  const [deprioritizedTypeFilter, setDeprioritizedTypeFilter] = useState('all');

  // Qualified leads filters
  const [qualifiedLeadsSearch, setQualifiedLeadsSearch] = useState('');
  const [qualifiedLeadsPersonFilter, setQualifiedLeadsPersonFilter] = useState('');
  const [qualifiedLeadsDateFilter, setQualifiedLeadsDateFilter] = useState('all');
  const [qualifiedLeadsDateStart, setQualifiedLeadsDateStart] = useState('');
  const [qualifiedLeadsDateEnd, setQualifiedLeadsDateEnd] = useState('');

  // Helper to calculate days overdue
  const calculateDaysOverdue = (createdAt: string) => {
    if (!createdAt) return 0;
    const createdDate = new Date(createdAt);
    return Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Date filter helper
  const matchesPendingLeadsDate = (lead: any) => {
    if (pendingLeadsDateFilter === 'all') return true;
    if (!lead.created_at) return false;
    const leadDate = new Date(lead.created_at);
    if (isNaN(leadDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadDateOnly = new Date(leadDate);
    leadDateOnly.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - leadDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    switch(pendingLeadsDateFilter) {
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays >= 0 && diffDays <= 7;
      case 'month':
        return diffDays >= 0 && diffDays <= 30;
      case 'custom':
        const startDate = pendingLeadsDateStart ? new Date(pendingLeadsDateStart) : null;
        const endDate = pendingLeadsDateEnd ? new Date(pendingLeadsDateEnd) : null;
        if (startDate && endDate) {
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          return leadDate >= startDate && leadDate <= endDate;
        }
        return true;
      default:
        return true;
    }
  };

  // Use only real data from Supabase
  const pendingLeads = realPendingLeads
    .filter(lead => lead.status === 'pending')
    .filter(lead => {
      if (!pendingLeadsSearch) return true;
      const cd = lead.contact_data || {};
      const name = lead.client_name || cd.name || cd.contactName || '';
      const email = lead.client_email || cd.email || cd.contactEmail || '';
      return name.toLowerCase().includes(pendingLeadsSearch.toLowerCase()) ||
             email.toLowerCase().includes(pendingLeadsSearch.toLowerCase());
    })
    .filter(lead => !pendingLeadsPersonFilter || lead.person_responsible === pendingLeadsPersonFilter)
    .filter(matchesPendingLeadsDate);

  // Combine deprioritized screening leads and deprioritized forms
  const deprioritizedLeads = [
    ...realPendingLeads.filter(lead => lead.status === 'deprioritized' || lead.status === 'rejected'),
    ...realForms.filter(form => form.status === 'deprioritized'),
  ]
    .filter(item => {
      if (deprioritizedTypeFilter === 'all') return true;
      if (deprioritizedTypeFilter === 'rejected') return item.status === 'rejected';
      if (deprioritizedTypeFilter === 'no-response') return item.status === 'deprioritized';
      return true;
    })
    .filter(item => {
      if (!pendingLeadsSearch) return true;
      const name = item.client_name || item.name || '';
      const email = item.client_email || item.email || '';
      return name.toLowerCase().includes(pendingLeadsSearch.toLowerCase()) ||
             email.toLowerCase().includes(pendingLeadsSearch.toLowerCase());
    })
    .filter(item => !pendingLeadsPersonFilter || item.person_responsible === pendingLeadsPersonFilter || item.personResponsible === pendingLeadsPersonFilter)
    .filter(item => {
      if (pendingLeadsDateFilter === 'all') return true;
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      if (isNaN(itemDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const itemDateOnly = new Date(itemDate);
      itemDateOnly.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - itemDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      switch(pendingLeadsDateFilter) {
        case 'today':
          return diffDays === 0;
        case 'week':
          return diffDays >= 0 && diffDays <= 7;
        case 'month':
          return diffDays >= 0 && diffDays <= 30;
        default:
          return true;
      }
    });

  const matchesQualifiedLeadsDate = (form: any) => {
    if (qualifiedLeadsDateFilter === 'all') return true;
    const dateStr = form.created_at;
    if (!dateStr) return false;
    const formDate = new Date(dateStr);
    if (isNaN(formDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formDateOnly = new Date(formDate);
    formDateOnly.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - formDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    switch (qualifiedLeadsDateFilter) {
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays >= 0 && diffDays <= 7;
      case 'month':
        return diffDays >= 0 && diffDays <= 30;
      case 'custom': {
        const startDate = qualifiedLeadsDateStart ? new Date(qualifiedLeadsDateStart) : null;
        const endDate = qualifiedLeadsDateEnd ? new Date(qualifiedLeadsDateEnd) : null;
        if (startDate && endDate) {
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          return formDate >= startDate && formDate <= endDate;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const sentFormsAll = realForms.filter(f => f.status === 'to_send_appointment');
  const sentForms = sentFormsAll
    .filter(f => !qualifiedLeadsSearch || (f.name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.personResponsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate);

  const openedFormsAll = realForms.filter(f => f.status === 'appointment_sent');
  const openedForms = openedFormsAll
    .filter(f => !qualifiedLeadsSearch || (f.name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.personResponsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate);

  const inProgressFormsAll = realForms.filter(f => f.status === 'scheduled');
  // Intake section forms organized by status
  const appointmentSentForms = realForms.filter(f => f.status === 'appointment_sent');
  const scheduledForms = realForms.filter(f => f.status === 'scheduled');
  const pendingIntakeForms = realForms.filter(f => f.status === 'pending_intake');
  const completedIntakeForms = realForms.filter(f => f.status === 'completed_intake');

  // Apply filters to pending intake forms (for Overview)
  const filteredPendingIntakeForms = pendingIntakeForms
    .filter(f => !qualifiedLeadsSearch || (f.client_name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.person_responsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate);

  // Keep legacy names for now
  const inProgressForms = inProgressFormsAll
    .filter(f => !qualifiedLeadsSearch || (f.client_name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.person_responsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate);

  const trulyCompletedFormsAll = pendingIntakeForms;
  const trulyCompletedForms = trulyCompletedFormsAll
    .filter(f => !completedSearch || (f.client_name || '').toLowerCase().includes(completedSearch.toLowerCase()))
    .filter(f => !completedPersonFilter || f.person_responsible === completedPersonFilter);

  const submittedForms = realForms
    .filter(f => f.status === 'completed_intake')
    .filter(f => !qualifiedLeadsSearch || (f.client_name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.person_responsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate);
  const overdueForms = realForms
    .filter(f => f.status === 'overdue')
    .filter(f => !qualifiedLeadsSearch || (f.name || '').toLowerCase().includes(qualifiedLeadsSearch.toLowerCase()))
    .filter(f => !qualifiedLeadsPersonFilter || f.personResponsible === qualifiedLeadsPersonFilter)
    .filter(matchesQualifiedLeadsDate)
    .filter(f => {
      if (overdueFilter === 'all') return true;
      const createdDate = new Date(f.created_at);
      const daysOverdue = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue >= Number(overdueFilter);
    });

  const matchesCompletedPageDate = (form: any) => {
    if (completedDateFilter === 'all') return true;
    const dateStr = form.created_at || form.marked_complete_at || form.updated_at;
    if (!dateStr) return false;
    const formDate = new Date(dateStr);
    if (isNaN(formDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formDateOnly = new Date(formDate);
    formDateOnly.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - formDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    switch (completedDateFilter) {
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays >= 0 && diffDays <= 7;
      case 'month':
        return diffDays >= 0 && diffDays <= 30;
      case 'custom': {
        const startDate = completedDateStart ? new Date(completedDateStart) : null;
        const endDate = completedDateEnd ? new Date(completedDateEnd) : null;
        if (startDate && endDate) {
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          return formDate >= startDate && formDate <= endDate;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const completedPageForms = trulyCompletedForms
    .filter(f => !completedSearch || (f.name || '').toLowerCase().includes(completedSearch.toLowerCase()))
    .filter(f => !completedPersonFilter || f.personResponsible === completedPersonFilter)
    .filter(matchesCompletedPageDate);
  const submittedPageForms = submittedForms
    .filter(f => !completedSearch || (f.name || '').toLowerCase().includes(completedSearch.toLowerCase()))
    .filter(f => !completedPersonFilter || f.personResponsible === completedPersonFilter)
    .filter(matchesCompletedPageDate);

  const refreshData = async () => {
    if (!lawyer?.id || !supabase) return;
    try {
      const { data: screenings } = await supabase
        .from('screening_submissions')
        .select('*')
        .eq('lawyer_id', lawyer.id)
        .order('created_at', { ascending: false });
      const processedScreenings = (screenings || []).map(s => ({
        ...s,
        name: s.client_name || s.contact_data?.name || s.contact_data?.contactName || 'Unknown',
        email: s.client_email || s.contact_data?.email || s.contact_data?.contactEmail || '',
        personResponsible: s.person_responsible || '',
        region: s.region || '',
        referralType: s.referral_type || '',
        leadType: s.lead_type || '',
      }));
      setRealPendingLeads(processedScreenings);

      const { data: forms } = await supabase
        .from('forms')
        .select('*')
        .eq('lawyer_id', lawyer.id)
        .order('created_at', { ascending: false });
      const processedForms = (forms || []).map(f => {
        // Calculate days overdue
        const createdDate = new Date(f.created_at);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...f,
          name: f.client_name || 'Unknown',
          progress: f.progress_pct || 0,
          personResponsible: f.person_responsible || '',
          daysOverdue: f.status === 'overdue' ? daysOverdue : 0,
        };
      });
      setRealForms(processedForms);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const handleQualifyLead = async (leadId: string) => {
    setLeadActionLoading(true);
    const personResponsible = viewingLead?.personResponsible || viewingLead?.person_responsible;
    if (personResponsible) {
      const formId = await qualifyLead(leadId, personResponsible);
      if (formId) {
        await refreshData();
        setViewingLead(null);
        // Show link modal for manual sharing
        const link = `${window.location.origin}/lead-inquiry?lead_id=${formId}`;
        setGeneratedLink(link);
        setShowLinkModal(true);
      }
    } else {
      console.error('No person_responsible assigned to this lead');
    }
    setLeadActionLoading(false);
  };

  const handleRejectLead = async (leadId: string) => {
    setLeadActionLoading(true);
    if (await rejectLead(leadId)) {
      await refreshData();
      setViewingLead(null);
    }
    setLeadActionLoading(false);
  };

  const getLeadDisplay = (lead: any) => {
    const cd = lead.contact_data || {};
    return {
      isFirm: lead.contact_type === 'firm',
      name: lead.client_name || cd.name || cd.contactName || lead.name || 'Unknown',
      email: lead.client_email || cd.email || cd.contactEmail || lead.email || '',
      phone: lead.client_phone || cd.mobile || cd.contactMobile || '',
      title: cd.title || '',
      organisationName: cd.organisationName || '',
      organisationPhone: cd.organisationPhone || '',
      organisationEmail: cd.organisationEmail || '',
      contactName: cd.contactName || '',
      businessRole: cd.businessRole || '',
      leadType: lead.lead_type || lead.leadType || '',
      region: lead.region || '',
      referralType: lead.referral_type || lead.referralType || '',
      billingType: lead.billing_type || '',
      personResponsible: lead.person_responsible || lead.personResponsible || '',
      createdAt: lead.created_at
        ? new Date(lead.created_at).toLocaleString()
        : '',
      status: lead.status || 'pending',
    };
  };

  const handleDeprioritizeLead = async (leadId: string) => {
    if (await deprioritizeLead(leadId)) {
      await refreshData();
    }
  };

  const handleCompleteForm = async (formId: string) => {
    if (await markFormComplete(formId)) {
      await refreshData();
    }
  };

  const handleSubmitToClio = async (formId: string) => {
    if (await submitFormToSmokeball(formId)) {
      await refreshData();
    }
  };

  const handleScreeningFormSubmit = () => {
    setShowScreeningModal(false);
    refreshData();
  };

  const renderLeadDetailModal = () => {
    if (!viewingLead) return null;

    const d = getLeadDisplay(viewingLead);
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
        onClick={() => { if (!leadActionLoading) setViewingLead(null); }}
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
                {d.status
                  ? (
                    <span className={`nv-chip${d.status === 'rejected' ? ' danger' : d.status === 'qualified' ? ' warm' : ''}`}>
                      <span className='nv-chip-dot' />
                      {String(d.status).replace(/_/g, ' ')}
                    </span>
                  )
                  : null}
              </div>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => { if (!leadActionLoading) setViewingLead(null); }}
              disabled={leadActionLoading}
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
              disabled={leadActionLoading}
              title='Disqualify this lead'
            >
              Disqualify
            </button>
            <button
              className='nv-btn-qualify'
              onClick={() => handleQualifyLead(viewingLead.id)}
              disabled={leadActionLoading}
              title='Send appointment and move to next stage'
            >
              {leadActionLoading ? 'Sending...' : 'Send Appointment'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLinkModal = () => {
    if (!showLinkModal) return null;

    return (
      <div
        className='nv-modal-overlay'
        onClick={() => setShowLinkModal(false)}
      >
        <div className='nv-modal' onClick={(e) => e.stopPropagation()}>
          <div className='nv-modal-head'>
            <div className='nv-modal-head-main'>
              <p className='nv-modal-eyebrow'>Form Link</p>
              <h2 className='nv-modal-title'>Share with Client</h2>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => setShowLinkModal(false)}
              title='Close'
            >
              ×
            </button>
          </div>
          <div className='nv-modal-body' style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
              Copy this link and send it to your client:
            </p>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <input
                type='text'
                readOnly
                value={generatedLink}
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
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  alert('Link copied to clipboard!');
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
              onClick={() => setShowLinkModal(false)}
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
    if (!viewingIntakeForm) return null;

    const isCompletedIntake = viewingIntakeForm.status === 'completed_intake';
    const isPendingIntake = viewingIntakeForm.status === 'pending_intake';
    const showBothForms = isPendingIntake || isCompletedIntake;

    return (
      <div
        className='nv-modal-overlay'
        onClick={() => { if (!intakeActionLoading) setViewingIntakeForm(null); }}
      >
        <div className='nv-modal' onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className='nv-modal-head'>
            <div className='nv-modal-head-main'>
              <p className='nv-modal-eyebrow'>Lead Information</p>
              <h2 className='nv-modal-title'>{viewingIntakeForm.name || 'Untitled'}</h2>
              <div className='nv-modal-meta'>
                <span className='nv-chip'>
                  <span className='nv-chip-dot' />
                  {viewingIntakeForm.status ? String(viewingIntakeForm.status).replace(/_/g, ' ') : 'Unknown'}
                </span>
              </div>
            </div>
            <button
              className='nv-modal-close'
              onClick={() => { if (!intakeActionLoading) setViewingIntakeForm(null); }}
              disabled={intakeActionLoading}
              aria-label='Close'
            >
              ×
            </button>
          </div>

          <div className='nv-modal-body'>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Lead Details</h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                <div><strong>Name:</strong> {viewingIntakeForm.name}</div>
                <div><strong>Email:</strong> {viewingIntakeForm.client_email}</div>
                <div><strong>Responsible:</strong> {viewingIntakeForm.personResponsible || 'Unassigned'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Forms</h3>

              <div style={{ marginBottom: '16px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>Initial Outreach Form</div>

                {/* Display inquiry form summary if submitted */}
                {viewingIntakeForm.form_data?.inquiry && (
                  <div style={{ marginBottom: '12px', padding: '12px', background: '#f9f9f9', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
                    {viewingIntakeForm.form_data.inquiry.client_name && (
                      <div><strong>Name:</strong> {viewingIntakeForm.form_data.inquiry.client_name}</div>
                    )}
                    {viewingIntakeForm.form_data.inquiry.client_email && (
                      <div><strong>Email:</strong> {viewingIntakeForm.form_data.inquiry.client_email}</div>
                    )}
                    {viewingIntakeForm.form_data.inquiry.client_phone && (
                      <div><strong>Phone:</strong> {viewingIntakeForm.form_data.inquiry.client_phone}</div>
                    )}
                    {viewingIntakeForm.form_data.inquiry.client_state && (
                      <div><strong>State:</strong> {viewingIntakeForm.form_data.inquiry.client_state}</div>
                    )}
                    {viewingIntakeForm.form_data.inquiry.inquiry_reason && (
                      <div><strong>Reason:</strong> {viewingIntakeForm.form_data.inquiry.inquiry_reason}</div>
                    )}
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
                  onClick={() => window.open(`/lead-inquiry?lead_id=${viewingIntakeForm.id}`, '_blank')}
                >
                  {viewingIntakeForm.form_data?.inquiry ? 'View Details' : 'View Form'}
                </button>
              </div>

              {showBothForms ? (
                <>
                  <div style={{ padding: '12px', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
                      Intake Form
                      {viewingIntakeForm.progress_pct !== undefined && (
                        <span style={{ float: 'right', color: '#666' }}>
                          {viewingIntakeForm.progress_pct}% complete
                        </span>
                      )}
                    </div>
                    {/* Show intake data summary if available */}
                    {viewingIntakeForm.form_data?.intake && (
                      <div style={{ marginBottom: '12px', padding: '12px', background: '#f9f9f9', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
                        {viewingIntakeForm.form_data.intake.client_name && (
                          <div><strong>Client:</strong> {viewingIntakeForm.form_data.intake.client_name}</div>
                        )}
                        {viewingIntakeForm.form_data.intake.client_state && (
                          <div><strong>State:</strong> {viewingIntakeForm.form_data.intake.client_state}</div>
                        )}
                        {viewingIntakeForm.form_data.intake.scenario && (
                          <div><strong>Scenario:</strong> {viewingIntakeForm.form_data.intake.scenario}</div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                        onClick={() => window.open(`/intake-form?lead_id=${viewingIntakeForm.id}&readonly=true&show_will=true`, '_blank')}
                      >
                        📄 View Generated Will
                      </button>
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
                          onClick={() => window.open(`/intake-form?lead_id=${viewingIntakeForm.id}&edit=true`, '_blank')}
                        >
                          ✏️ Edit Form
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px', border: '1px dashed #ddd', borderRadius: '4px', background: '#fafafa', color: '#999', fontSize: '12px' }}>
                  Intake form will be available after appointment is scheduled
                </div>
              )}
            </div>
          </div>

          {viewingIntakeForm.status === 'scheduled' && (
            <div className='nv-modal-actions'>
              <button
                className='nv-btn-qualify'
                onClick={async () => {
                  const success = await sendIntakeForm(viewingIntakeForm.id);
                  if (success) {
                    const intakeLink = `${window.location.origin}/intake-form?lead_id=${viewingIntakeForm.id}`;
                    // Update local state and refresh
                    setRealForms(prev => prev.map(f =>
                      f.id === viewingIntakeForm.id
                        ? { ...f, status: 'pending_intake' }
                        : f
                    ));
                    setViewingIntakeForm(prev => ({ ...prev, status: 'pending_intake' }));
                    setGeneratedLink(intakeLink);
                    setShowLinkModal(true);
                  }
                }}
              >
                Send Intake Form
              </button>
            </div>
          )}

          {isCompletedIntake && (
            <div className='nv-modal-actions'>
              <button
                className='nv-btn-view'
                onClick={() => {
                  setShowSendBackModal(true);
                  setSendBackFormId(viewingIntakeForm.id);
                  setViewingIntakeForm(null);
                }}
              >
                Send Back Reminder
              </button>
              <button
                className='nv-btn-qualify'
                onClick={() => console.log('Populate Matter to Clio - to be implemented')}
              >
                Populate Matter → Clio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

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

  const overviewIntakeForms = filteredPendingIntakeForms;
  const overviewCompletedForms = completedIntakeForms;
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
          {lawyer && (
            <div className='nv-sidebar-user'>{lawyer.full_name}</div>
          )}
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
          {lawyer && (
            <div className='nv-user-chip'>
              <div className='nv-user-avatar'>{userInitials}</div>
              <span className='nv-user-name'>{lawyer.full_name}</span>
              {lawyer.is_admin && <span className='nv-user-badge'>Admin</span>}
            </div>
          )}
        </header>

        {/* Overview */}
        {activeNav === 'overview' && (
          <div className='nv-overview'>
            <div className='nv-stats'>
              <div className='nv-stat-card'>
                <p className='nv-stat-label'>Pending Leads</p>
                <p className='nv-stat-value'>{pendingLeads.length}</p>
                <p className='nv-stat-hint'>Awaiting qualify or reject</p>
              </div>

              <div className='nv-stat-card warm'>
                <p className='nv-stat-label'>Pending Intake Forms</p>
                <p className='nv-stat-value'>{overviewIntakeForms.length}</p>
                <p className='nv-stat-hint'>Clients still completing forms</p>
              </div>

              <div className='nv-stat-card green'>
                <p className='nv-stat-label'>Completed Forms</p>
                <p className='nv-stat-value'>{overviewCompletedForms.length}</p>
                <p className='nv-stat-hint'>Ready for lawyer review</p>
              </div>
            </div>

            <div className='nv-overview-grid'>
              <section className='nv-panel'>
                <div className='nv-panel-head'>
                  <h2 className='nv-panel-title'>Pending Leads</h2>
                  <span className='nv-panel-count'>{pendingLeads.length}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name...'
                  value={pendingLeadsSearch}
                  onChange={(e) => setPendingLeadsSearch(e.target.value)}
                />
                <div className='nv-panel-list'>
                  {pendingLeads.length === 0
                    ? <div className='nv-panel-empty'>No pending leads</div>
                    : pendingLeads.map(lead => (
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
                            onClick={() => setViewingLead(lead)}
                            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          >
                            View
                          </button>
                          <button
                            type='button'
                            className='nv-btn-delete'
                            onClick={() => console.log('Delete - disabled')}
                            disabled
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
                  <span className='nv-panel-count'>{overviewIntakeForms.length}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name...'
                  value={intakeFormSearch}
                  onChange={(e) => setIntakeFormSearch(e.target.value)}
                />
                <div className='nv-panel-list'>
                  {overviewIntakeForms.length === 0
                    ? <div className='nv-panel-empty'>No forms in progress</div>
                    : overviewIntakeForms.map(form => (
                      <div key={form.id} className='nv-panel-item'>
                        <p className='nv-panel-item-name'>{form.name}</p>
                        <p className='nv-panel-item-meta'>{form.client_email || form.personResponsible || '—'}</p>
                        <div className='nv-panel-item-row'>
                          <div className='nv-progress'>
                            <div className='nv-progress-track'>
                              <div className='nv-progress-fill' style={{ width: `${Math.min(100, form.progress || 0)}%` }} />
                            </div>
                            <span className='nv-progress-pct'>{form.progress || 0}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              <section className='nv-panel'>
                <div className='nv-panel-head'>
                  <h2 className='nv-panel-title'>Completed Forms</h2>
                  <span className='nv-panel-count'>{overviewCompletedForms.length}</span>
                </div>
                <input
                  className='nv-panel-search'
                  type='text'
                  placeholder='Search by name...'
                  value={completedSearch}
                  onChange={(e) => setCompletedSearch(e.target.value)}
                />
                <div className='nv-panel-list'>
                  {overviewCompletedForms.length === 0
                    ? <div className='nv-panel-empty'>No completed forms yet</div>
                    : overviewCompletedForms.map(form => (
                      <div key={form.id} className='nv-panel-item' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className='nv-panel-item-name'>{form.name}</p>
                          <p className='nv-panel-item-meta'>{form.client_email || form.personResponsible || '—'}</p>
                          <div className='nv-panel-item-row'>
                            <p className='nv-panel-item-meta'>{form.personResponsible || 'Unassigned'}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            type='button'
                            className='nv-btn-view'
                            onClick={() => console.log('Review - disabled')}
                            disabled
                            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          >
                            Review
                          </button>
                          <button
                            type='button'
                            className='nv-btn-edit'
                            onClick={() => console.log('Send - disabled')}
                            disabled
                            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Pending Leads */}
        {activeNav === 'pending-leads' && (
          <div>
            <div className='nv-toolbar'>
              <div className='nv-filters'>
                <select
                  className='nv-select'
                  value={pendingLeadsPersonFilter}
                  onChange={(e) => setPendingLeadsPersonFilter(e.target.value)}
                >
                  <option value="">All Lawyers</option>
                  {LAWYERS.map(lawyer => <option key={lawyer} value={lawyer}>{lawyer}</option>)}
                </select>

                <select
                  className='nv-select'
                  value={pendingLeadsDateFilter}
                  onChange={(e) => setPendingLeadsDateFilter(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                {pendingLeadsDateFilter === 'custom' && (
                  <>
                    <input
                      className='nv-date'
                      type="date"
                      value={pendingLeadsDateStart}
                      onChange={(e) => setPendingLeadsDateStart(e.target.value)}
                    />
                    <input
                      className='nv-date'
                      type="date"
                      value={pendingLeadsDateEnd}
                      onChange={(e) => setPendingLeadsDateEnd(e.target.value)}
                    />
                  </>
                )}
              </div>

              <div className='nv-tabs'>
                <button
                  type='button'
                  className={`nv-tab${pendingLeadsTab === 'pending' ? ' active' : ''}`}
                  onClick={() => setPendingLeadsTab('pending')}
                >
                  Pending
                  <span className='nv-tab-count'>{pendingLeads.length}</span>
                </button>
                <button
                  type='button'
                  className={`nv-tab${pendingLeadsTab === 'deprioritized' ? ' active' : ''}`}
                  onClick={() => setPendingLeadsTab('deprioritized')}
                >
                  Deprioritized
                  <span className='nv-tab-count'>{deprioritizedLeads.length}</span>
                </button>
              </div>
            </div>

            {pendingLeadsTab === 'pending' && (
              <div className='nv-lead-list'>
                {pendingLeads.length === 0
                  ? <div className='nv-empty'>No pending leads at the moment.</div>
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
                          {lead.personResponsible && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {lead.personResponsible}
                            </span>
                          )}
                          {lead.referralType && (
                            <span className='nv-chip warm'>
                              <span className='nv-chip-dot' />
                              {lead.referralType}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='nv-pipe-actions'>
                        <button
                          type='button'
                          className='nv-btn-view'
                          onClick={() => setViewingLead(lead)}
                        >
                          View
                        </button>
                        <button
                          type='button'
                          className='nv-btn-delete'
                          onClick={() => console.log('Delete - disabled')}
                          disabled
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
                  <button
                    type='button'
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      background: deprioritizedTypeFilter === 'all' ? '#f0f0f0' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                    onClick={() => setDeprioritizedTypeFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type='button'
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      background: deprioritizedTypeFilter === 'rejected' ? '#f0f0f0' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                    onClick={() => setDeprioritizedTypeFilter('rejected')}
                  >
                    Rejected
                  </button>
                  <button
                    type='button'
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      background: deprioritizedTypeFilter === 'no-response' ? '#f0f0f0' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                    onClick={() => setDeprioritizedTypeFilter('no-response')}
                  >
                    No Response
                  </button>
                </div>
                <div className='nv-lead-list'>
                  {deprioritizedLeads.length === 0
                    ? <div className='nv-empty'>No deprioritized or rejected leads</div>
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
                          {lead.personResponsible && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {lead.personResponsible}
                            </span>
                          )}
                          {lead.referralType && (
                            <span className='nv-chip warm'>
                              <span className='nv-chip-dot' />
                              {lead.referralType}
                            </span>
                          )}
                          <span className={`nv-chip${lead.status === 'rejected' ? ' danger' : ''}`}>
                            <span className='nv-chip-dot' />
                            {lead.status === 'rejected' ? 'Rejected' : 'No Response'}
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

        {/* Completed Forms */}
        {activeNav === 'completed-forms' && (
          <div>
            <div className='nv-toolbar'>
              <div className='nv-filters'>
                <select
                  className='nv-select'
                  value={completedPersonFilter}
                  onChange={(e) => setCompletedPersonFilter(e.target.value)}
                >
                  <option value="">All Lawyers</option>
                  {LAWYERS.map(lawyer => <option key={lawyer} value={lawyer}>{lawyer}</option>)}
                </select>

                <select
                  className='nv-select'
                  value={completedDateFilter}
                  onChange={(e) => setCompletedDateFilter(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                {completedDateFilter === 'custom' && (
                  <>
                    <input
                      className='nv-date'
                      type="date"
                      value={completedDateStart}
                      onChange={(e) => setCompletedDateStart(e.target.value)}
                    />
                    <input
                      className='nv-date'
                      type="date"
                      value={completedDateEnd}
                      onChange={(e) => setCompletedDateEnd(e.target.value)}
                    />
                  </>
                )}
              </div>

              <div className='nv-tabs'>
                <button
                  type='button'
                  className={`nv-tab${completedFormsTab === 'completed' ? ' active' : ''}`}
                  onClick={() => setCompletedFormsTab('completed')}
                >
                  Completed
                  <span className='nv-tab-count'>{completedPageForms.length}</span>
                </button>
                <button
                  type='button'
                  className={`nv-tab${completedFormsTab === 'submitted' ? ' active' : ''}`}
                  onClick={() => setCompletedFormsTab('submitted')}
                >
                  Submitted
                  <span className='nv-tab-count'>{submittedPageForms.length}</span>
                </button>
              </div>
            </div>

            {completedFormsTab === 'completed' && (
              <div className='nv-lead-list'>
                {completedPageForms.length === 0
                  ? <div className='nv-empty'>No completed forms at the moment.</div>
                  : completedPageForms.map(form => (
                    <div key={form.id} className='nv-lead-card'>
                      <div className='nv-lead-main'>
                        <h3 className='nv-lead-name'>{form.name}</h3>
                        <p className='nv-lead-email'>{form.client_email || '—'}</p>
                        <div className='nv-lead-meta'>
                          {form.region && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.region}
                            </span>
                          )}
                          {form.personResponsible && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible}
                            </span>
                          )}
                          {form.referral_type && (
                            <span className='nv-chip warm'>
                              <span className='nv-chip-dot' />
                              {form.referral_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='nv-pipe-actions'>
                        <button
                          type='button'
                          className='nv-btn-view'
                          onClick={() => { window.location.href = `/?formId=${form.id}&summary=true`; }}
                        >
                          Review
                        </button>
                        <button
                          type='button'
                          className='nv-btn-edit'
                          onClick={() => handleSubmitToClio(form.id)}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {completedFormsTab === 'submitted' && (
              <div className='nv-lead-list'>
                {submittedPageForms.length === 0
                  ? <div className='nv-empty'>No forms submitted to Clio yet.</div>
                  : submittedPageForms.map(form => (
                    <div key={form.id} className='nv-lead-card'>
                      <div className='nv-lead-main'>
                        <h3 className='nv-lead-name'>{form.name}</h3>
                        <p className='nv-lead-email'>{form.client_email || '—'}</p>
                        <div className='nv-lead-meta'>
                          {form.region && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.region}
                            </span>
                          )}
                          {form.personResponsible && (
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible}
                            </span>
                          )}
                          <span className='nv-chip warm'>
                            <span className='nv-chip-dot' />
                            Clio
                          </span>
                        </div>
                      </div>
                      <button
                        type='button'
                        className='nv-btn-view'
                        onClick={() => { window.location.href = `/?formId=${form.id}&summary=true`; }}
                      >
                        Review
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Qualified Leads / Intake */}
        {activeNav === 'qualified-leads' && (
          <div className='nv-qualified'>
            <div className='nv-toolbar'>
              <div className='nv-filters'>
                <input
                  className='nv-search'
                  type='text'
                  placeholder='Search by name...'
                  value={qualifiedLeadsSearch}
                  onChange={(e) => setQualifiedLeadsSearch(e.target.value)}
                />
                <select
                  className='nv-select'
                  value={qualifiedLeadsPersonFilter}
                  onChange={(e) => setQualifiedLeadsPersonFilter(e.target.value)}
                >
                  <option value="">All Lawyers</option>
                  {LAWYERS.map(lawyer => <option key={lawyer} value={lawyer}>{lawyer}</option>)}
                </select>
                <select
                  className='nv-select'
                  value={qualifiedLeadsDateFilter}
                  onChange={(e) => setQualifiedLeadsDateFilter(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                {qualifiedLeadsDateFilter === 'custom' && (
                  <>
                    <input
                      className='nv-date'
                      type='date'
                      value={qualifiedLeadsDateStart}
                      onChange={(e) => setQualifiedLeadsDateStart(e.target.value)}
                    />
                    <input
                      className='nv-date'
                      type='date'
                      value={qualifiedLeadsDateEnd}
                      onChange={(e) => setQualifiedLeadsDateEnd(e.target.value)}
                    />
                  </>
                )}
              </div>
              <div className='nv-toolbar-right'>
                <span className='nv-toolbar-label'>Overdue</span>
                <select
                  className='nv-select'
                  value={overdueFilter}
                  onChange={(e) => setOverdueFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="7">7+ Days</option>
                  <option value="14">14+ Days</option>
                  <option value="30">30+ Days</option>
                </select>
              </div>
            </div>

            <div className='nv-kanban'>
              <div className='nv-kanban-track'>
                <section className='nv-kanban-col'>
                  <div className='nv-kanban-col-head'>
                    <h3 className='nv-kanban-col-title'>Appointment Sent</h3>
                    <span className='nv-kanban-col-count'>{openedForms.length}</span>
                  </div>
                  <div className='nv-kanban-col-body'>
                    {openedForms.length === 0
                      ? <div className='nv-kanban-empty'>No opened forms</div>
                      : openedForms.map(form => (
                        <div key={form.id} className='nv-pipe-card'>
                          <h4 className='nv-pipe-name'>{form.name}</h4>
                          <p className='nv-pipe-email'>{form.client_email || '—'}</p>
                          <div className='nv-pipe-meta'>
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible || 'Unassigned'}
                            </span>
                          </div>
                          <div className='nv-progress'>
                            <div className='nv-progress-track'>
                              <div className='nv-progress-fill' style={{ width: `${Math.min(100, form.progress || 0)}%` }} />
                            </div>
                            <span className='nv-progress-pct'>{form.progress || 0}%</span>
                          </div>
                          <div className='nv-pipe-actions'>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => setViewingIntakeForm(form)}
                            >
                              View
                            </button>
                            <button
                              type='button'
                              className='nv-btn-delete'
                              onClick={async () => {
                                if (confirm(`Delete form for ${form.name}?`)) {
                                  const success = await deleteForm(form.id);
                                  if (success) {
                                    setRealForms(prev => prev.filter(f => f.id !== form.id));
                                  } else {
                                    alert('Failed to delete form');
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>

                <section className='nv-kanban-col'>
                  <div className='nv-kanban-col-head'>
                    <h3 className='nv-kanban-col-title'>Scheduled</h3>
                    <span className='nv-kanban-col-count'>{inProgressForms.length}</span>
                  </div>
                  <div className='nv-kanban-col-body'>
                    {inProgressForms.length === 0
                      ? <div className='nv-kanban-empty'>Nothing in progress</div>
                      : inProgressForms.map(form => (
                        <div key={form.id} className='nv-pipe-card'>
                          <h4 className='nv-pipe-name'>{form.name}</h4>
                          <p className='nv-pipe-email'>{form.client_email || '—'}</p>
                          <div className='nv-pipe-meta'>
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible || 'Unassigned'}
                            </span>
                          </div>
                          <div className='nv-progress'>
                            <div className='nv-progress-track'>
                              <div className='nv-progress-fill' style={{ width: `${Math.min(100, form.progress || 0)}%` }} />
                            </div>
                            <span className='nv-progress-pct'>{form.progress || 0}%</span>
                          </div>
                          <div className='nv-pipe-actions'>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => setViewingIntakeForm(form)}
                            >
                              View
                            </button>
                            <button
                              type='button'
                              className='nv-btn-delete'
                              onClick={async () => {
                                if (confirm(`Delete form for ${form.name}?`)) {
                                  const success = await deleteForm(form.id);
                                  if (success) {
                                    setRealForms(prev => prev.filter(f => f.id !== form.id));
                                  } else {
                                    alert('Failed to delete form');
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>

                <section className='nv-kanban-col'>
                  <div className='nv-kanban-col-head'>
                    <h3 className='nv-kanban-col-title'>Pending intake</h3>
                    <span className='nv-kanban-col-count'>{trulyCompletedForms.length}</span>
                  </div>
                  <div className='nv-kanban-col-body'>
                    {trulyCompletedForms.length === 0
                      ? <div className='nv-kanban-empty'>No pending forms</div>
                      : trulyCompletedForms.map(form => (
                        <div key={form.id} className='nv-pipe-card'>
                          <h4 className='nv-pipe-name'>{form.name}</h4>
                          <p className='nv-pipe-email'>{form.client_email || '—'}</p>
                          <div className='nv-pipe-meta'>
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible || 'Unassigned'}
                            </span>
                          </div>
                          <div className='nv-pipe-actions'>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => setViewingIntakeForm(form)}
                            >
                              View
                            </button>
                            <button
                              type='button'
                              className='nv-btn-delete'
                              onClick={async () => {
                                if (confirm(`Delete form for ${form.name}?`)) {
                                  const success = await deleteForm(form.id);
                                  if (success) {
                                    setRealForms(prev => prev.filter(f => f.id !== form.id));
                                  } else {
                                    alert('Failed to delete form');
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>

                <section className='nv-kanban-col'>
                  <div className='nv-kanban-col-head'>
                    <h3 className='nv-kanban-col-title'>Completed Intake</h3>
                    <span className='nv-kanban-col-count'>{submittedForms.length}</span>
                  </div>
                  <div className='nv-kanban-col-body'>
                    {submittedForms.length === 0
                      ? <div className='nv-kanban-empty'>None completed yet</div>
                      : submittedForms.map(form => (
                        <div key={form.id} className='nv-pipe-card' style={{ position: 'relative' }}>
                          <button
                            type='button'
                            onClick={async () => {
                              if (window.confirm('Delete this form? This cannot be undone.')) {
                                const success = await deleteForm(form.id);
                                if (success) {
                                  setRealForms(prev => prev.filter(f => f.id !== form.id));
                                }
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'none',
                              border: 'none',
                              fontSize: '1.2rem',
                              cursor: 'pointer',
                              color: '#999',
                              padding: '0',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title='Delete form'
                          >
                            ×
                          </button>
                          <h4 className='nv-pipe-name'>{form.name}</h4>
                          <p className='nv-pipe-email'>{form.client_email || '—'}</p>
                          <div className='nv-pipe-meta'>
                            <span className='nv-chip'>
                              <span className='nv-chip-dot' />
                              {form.personResponsible || 'Unassigned'}
                            </span>
                          </div>
                          <div className='nv-pipe-actions'>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => {
                                setViewingIntakeForm(form);
                                setViewMode('completed_intake');
                              }}
                            >
                              View
                            </button>
                            <button
                              type='button'
                              className='nv-btn-view'
                              onClick={() => {
                                setShowSendBackModal(true);
                                setSendBackFormId(form.id);
                              }}
                            >
                              Send Back
                            </button>
                            <button
                              type='button'
                              className='nv-btn-qualify'
                              onClick={() => console.log('Populate Matter - to be implemented')}
                            >
                              Populate
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>

                {/* Overdue column hidden for now */}
              </div>
            </div>
          </div>
        )}

        {/* Lead Detail Modal */}
        {renderLeadDetailModal()}

        {/* Intake Form Modal */}
        {renderIntakeFormModal()}

        {/* Form Link Modal (temporary - until webhook automation) */}
        {renderLinkModal()}

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
                      lawyerId={lawyer?.id || ''}
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

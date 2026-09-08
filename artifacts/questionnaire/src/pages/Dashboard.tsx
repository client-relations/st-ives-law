import { useState, useEffect } from 'react';
import { useSupabaseForms } from '../hooks/useSupabaseForms';
import { supabase } from '../lib/supabase';
import { C } from '../constants/colors';

export default function Dashboard() {
  const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "https://hook.eu2.make.com/fou12e2mjy2wgv2h0e3jgqor7fu81rec";

  const { forms, loading, createForm, sendToSmokeball, deleteForm, fetchForms } = useSupabaseForms();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('dashboard_auth') === 'true';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('pending-leads');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [screeningCount, setScreeningCount] = useState(0);
  const [disqualifiedScreeningCount, setDisqualifiedScreeningCount] = useState(0);
  const [showPreFillModal, setShowPreFillModal] = useState(false);
  const [preFillName, setPreFillName] = useState('');
  const [preFillEmail, setPreFillEmail] = useState('');
  const [preFillingId, setPreFillingId] = useState<string | null>(null);

  // Fetch screening submissions count
  useEffect(() => {
    const fetchScreeningCount = async () => {
      try {
        const { count, error } = await supabase
          .from('screening_submissions')
          .select('*', { count: 'exact' })
          .eq('status', 'pending');

        if (error) throw error;
        setScreeningCount(count || 0);
      } catch (err) {
        console.error('Error fetching screening count:', err);
      }
    };

    const fetchDisqualifiedCount = async () => {
      try {
        const { count, error } = await supabase
          .from('screening_submissions')
          .select('*', { count: 'exact' })
          .eq('status', 'disqualified_not_proceeding');

        if (error) throw error;
        setDisqualifiedScreeningCount(count || 0);
      } catch (err) {
        console.error('Error fetching disqualified count:', err);
      }
    };

    fetchScreeningCount();
    fetchDisqualifiedCount();
  }, []);

  // Auto-refresh forms and screening count every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchForms();
      // Also refetch screening counts
      const fetchScreeningCount = async () => {
        try {
          const { count, error } = await supabase
            .from('screening_submissions')
            .select('*', { count: 'exact' })
            .eq('status', 'pending');

          if (error) throw error;
          setScreeningCount(count || 0);
        } catch (err) {
          console.error('Error fetching screening count:', err);
        }
      };

      const fetchDisqualifiedCount = async () => {
        try {
          const { count, error } = await supabase
            .from('screening_submissions')
            .select('*', { count: 'exact' })
            .eq('status', 'disqualified_not_proceeding');

          if (error) throw error;
          setDisqualifiedScreeningCount(count || 0);
        } catch (err) {
          console.error('Error fetching disqualified count:', err);
        }
      };

      fetchScreeningCount();
      fetchDisqualifiedCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchForms]);

  // Manual refresh on Ctrl+R or Cmd+R
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        fetchForms();
        // Also refetch screening count
        const fetchScreeningCount = async () => {
          try {
            const { count, error } = await supabase
              .from('screening_submissions')
              .select('*', { count: 'exact' })
              .eq('status', 'pending');

            if (error) throw error;
            setScreeningCount(count || 0);
          } catch (err) {
            console.error('Error fetching screening count:', err);
          }
        };
        fetchScreeningCount();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchForms]);

  // Helper functions (defined before useEffect that uses them)
  const updateReminderTimestamp = async (formId: string, columnName: string) => {
    try {
      const { supabase } = await import('../lib/supabase');
      if (!supabase) return;
      await supabase
        .from('forms')
        .update({ [columnName]: new Date().toISOString() })
        .eq('id', formId);
    } catch (err) {
      console.error(`Error updating ${columnName}:`, err);
    }
  };

  const sendReminderWebhook = async (form: any, type: string, webhookUrl: string) => {
    try {
      const formLink = `${window.location.origin}/?formId=${form.id}`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reminder',
          reminder_type: type,
          client_name: form.client_name,
          client_email: form.client_email,
          form_link: formLink,
          form_id: form.id,
        }),
      });
    } catch (err) {
      console.error(`Error sending ${type} reminder:`, err);
    }
  };

  const checkAndSendReminders = async () => {
    const now = new Date();
    const reminderWebhookUrl = import.meta.env.VITE_REMINDER_WEBHOOK;

    for (const form of forms) {
      // Only check forms in progress or opened
      if (form.status !== 'in_progress' && form.status !== 'opened') {
        continue;
      }

      const createdAt = new Date(form.created_at);
      const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check 3 days
      if (daysOld >= 3 && !form.reminder_3d_sent) {
        await sendReminderWebhook(form, '3d', reminderWebhookUrl);
        await updateReminderTimestamp(form.id, 'reminder_3d_sent');
      }

      // Check 1 week
      if (daysOld >= 7 && !form.reminder_1w_sent) {
        await sendReminderWebhook(form, '1w', reminderWebhookUrl);
        await updateReminderTimestamp(form.id, 'reminder_1w_sent');
      }

      // Check 2 weeks
      if (daysOld >= 14 && !form.reminder_2w_sent) {
        await sendReminderWebhook(form, '2w', reminderWebhookUrl);
        await updateReminderTimestamp(form.id, 'reminder_2w_sent');
        // Auto-move to overdue
        // await supabase.from('forms').update({ status: 'overdue' }).eq('id', form.id);
      }
    }
  };

  // Check and send reminders on dashboard load
  useEffect(() => {
    if (!loading && forms.length > 0) {
      checkAndSendReminders();
    }
  }, [loading, forms.length]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const correctUsername = import.meta.env.VITE_DASHBOARD_USERNAME || 'admin';
    const correctPassword = import.meta.env.VITE_DASHBOARD_PASSWORD || 'password123';

    if (loginUsername === correctUsername && loginPassword === correctPassword) {
      localStorage.setItem('dashboard_auth', 'true');
      setIsLoggedIn(true);
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dashboard_auth');
    setIsLoggedIn(false);
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <div style={{
        background: C.bg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: C.white,
          borderRadius: '8px',
          padding: '40px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/nautilus-logo.png" alt="Nautilus" style={{ height: '60px', width: 'auto', marginBottom: '16px', maxWidth: '100%' }} />
            <h1 style={{
              fontFamily: C.fontHeading,
              fontSize: '24px',
              color: C.charcoal,
              margin: 0,
            }}>
              Nautilus Law Dashboard
            </h1>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontFamily: C.fontBody,
                fontSize: '13px',
                fontWeight: 600,
                color: C.charcoal,
                marginBottom: '6px',
              }}>
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontFamily: C.fontBody,
                fontSize: '13px',
                fontWeight: 600,
                color: C.charcoal,
                marginBottom: '6px',
              }}>
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {loginError && (
              <div style={{
                background: '#fee',
                color: '#c33',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: C.teal,
                color: C.white,
                border: 'none',
                borderRadius: '4px',
                padding: '10px 16px',
                fontFamily: C.fontBody,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleCreateForm = async () => {
    if (!clientName.trim()) return;
    setCreating(true);
    try {
      const { formId, uniqueLink } = await createForm(clientName, clientEmail);
      setCreatedLink(`${window.location.origin}/?formId=${formId}`);
      setClientName('');
      setClientEmail('');
    } catch (err) {
      console.error('Failed to create form with Supabase:', err);
      // Fallback: generate a demo link if Supabase fails
      const demoFormId = 'form-' + Math.random().toString(36).slice(2, 10);
      setCreatedLink(`${window.location.origin}/?formId=${demoFormId}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSendToSmokeball = async (formId: string) => {
    setSendingId(formId);
    setSendError(null);
    try {
      await sendToSmokeball(formId, WEBHOOK_URL);
      setTimeout(() => setSendingId(null), 1500);
    } catch (err) {
      setSendError(`Failed to send form: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSendingId(null);
    }
  };

  const handleDelete = async (formId: string) => {
    setDeleting(true);
    try {
      await deleteForm(formId);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete form:', err);
    } finally {
      setDeleting(false);
    }
  };


  // Filter by search term
  const filteredForms = forms.filter(f => {
    const search = searchTerm.toLowerCase();
    return (
      (f.client_name?.toLowerCase().includes(search) || '') ||
      (f.client_email?.toLowerCase().includes(search) || '')
    );
  });

  // Group forms by status (new workflow)
  const pendingLeadsForms = filteredForms.filter(f => f.status === 'pending_leads');
  const notSentForms = filteredForms.filter(f => f.status === 'not_sent');
  const sentForms = filteredForms.filter(f => f.status === 'sent');
  const openedForms = filteredForms.filter(f => f.status === 'opened');
  const inProgressForms = filteredForms.filter(f => f.status === 'in_progress');
  const completedForms = filteredForms.filter(f => f.status === 'completed');
  const submittedForms = filteredForms.filter(f => f.status === 'submitted');
  const overdueForms = filteredForms.filter(f => f.status === 'overdue');
  const noResponseForms = filteredForms.filter(f => f.status === 'no_response');

  const pendingLeadsCount = pendingLeadsForms.length + screeningCount;
  const notSentCount = notSentForms.length;
  const sentCount = sentForms.length;
  const openedCount = openedForms.length;
  const inProgressCount = inProgressForms.length;
  const completedCount = completedForms.length;
  const submittedCount = submittedForms.length;
  const overdueCount = overdueForms.length;
  const noResponseCount = noResponseForms.length;
  const disqualifiedCount = noResponseCount + disqualifiedScreeningCount;
  const totalCount = forms.length;

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: C.white,
        borderBottom: `2px solid ${C.warm}`,
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/nautilus-logo.png" alt="Nautilus" style={{ height: '28px', width: 'auto' }} />
          <h1 style={{
            fontFamily: C.fontHeading,
            fontSize: '24px',
            color: C.charcoal,
            margin: 0,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            Nautilus Law Dashboard
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => {
              window.location.href = `${window.location.origin}/screening`;
            }}
            style={{
              background: C.warm,
              color: C.white,
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontFamily: C.fontBody,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Screening Form
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: C.teal,
              color: C.white,
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontFamily: C.fontBody,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            + Create New Form
          </button>
          <button
            onClick={() => setShowPreFillModal(true)}
            style={{
              background: C.warm,
              color: C.white,
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontFamily: C.fontBody,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Pre-fill a Form
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              color: C.charcoal,
              border: `1px solid ${C.bgBorder}`,
              borderRadius: '6px',
              padding: '10px 16px',
              fontFamily: C.fontBody,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        background: C.white,
        padding: '20px 32px',
        borderBottom: `1px solid ${C.bgBorder}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '16px',
      }}>
        {[
          { label: 'Pending Leads', count: pendingLeadsCount, color: C.warm },
          { label: 'Not Sent', count: notSentCount, color: C.teal },
          { label: 'Sent', count: sentCount, color: C.teal },
          { label: 'Opened Only', count: openedCount, color: C.teal },
          { label: 'In Progress', count: inProgressCount, color: C.teal },
          { label: 'Completed', count: completedCount, color: C.teal },
          { label: 'Submitted', count: submittedCount, color: C.warm },
          { label: 'Overdue', count: overdueCount, color: C.teal },
          { label: 'Disqualified', count: disqualifiedCount, color: C.teal },
          { label: 'Total', count: totalCount, color: C.teal },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center', padding: '12px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color, marginBottom: '4px', fontFamily: C.fontBody, fontVariantNumeric: 'tabular-nums' }}>
              {stat.count}
            </div>
            <div style={{
              fontSize: '11px',
              color: C.textL,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        background: C.white,
        display: 'flex',
        borderBottom: `1px solid ${C.bgBorder}`,
        padding: '0 32px',
      }}>
        {[
          { id: 'pending-leads', label: 'Pending Leads' },
          { id: 'not-sent', label: 'Not Sent' },
          { id: 'sent', label: 'Sent' },
          { id: 'opened', label: 'Opened Only' },
          { id: 'incomplete', label: 'In Progress' },
          { id: 'completed', label: 'Completed' },
          { id: 'submitted', label: 'Submitted' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'disqualified', label: 'Disqualified Leads' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? C.teal : 'transparent',
              color: activeTab === tab.id ? C.white : C.textL,
              border: 'none',
              padding: '16px 24px',
              cursor: 'pointer',
              fontFamily: C.fontBody,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              borderBottom: activeTab === tab.id ? `3px solid ${C.warm}` : 'none',
              position: 'relative',
              top: '1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: C.textL,
            fontFamily: C.fontBody,
          }}>
            Loading forms...
          </div>
        ) : activeTab === 'pending-leads' ? (
          <PendingLeadsTab pendingLeadsForms={pendingLeadsForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'not-sent' ? (
          <NotSentTab notSentForms={notSentForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'sent' ? (
          <SentTab sentForms={sentForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'opened' ? (
          <OpenedOnlyTab openedForms={openedForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'incomplete' ? (
          <IncompleteTab inProgressForms={inProgressForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'completed' ? (
          <CompletedTab completedForms={completedForms} onSend={handleSendToSmokeball} sendingId={sendingId} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'submitted' ? (
          <SubmittedTab submittedForms={submittedForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : activeTab === 'overdue' ? (
          <OverdueTab overdueForms={overdueForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        ) : (
          <DisqualifiedTab noResponseForms={noResponseForms} searchTerm={searchTerm} onSearchChange={setSearchTerm} onDelete={setDeleteConfirm} />
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => {
          setShowCreateModal(false);
          setCreatedLink(null);
        }}>
          <div style={{
            background: C.white,
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontFamily: C.fontHeading,
              fontSize: '20px',
              color: C.charcoal,
              margin: '0 0 20px 0',
            }}>
              Create New Form
            </h2>

            {createdLink ? (
              <div>
                <p style={{ color: C.textL, marginBottom: '12px', fontSize: '13px' }}>
                  Form link created! Copy and send to your client:
                </p>
                <div style={{
                  background: C.bg,
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  wordBreak: 'break-all',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: C.charcoal,
                }}>
                  {createdLink}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdLink);
                    setTimeout(() => {
                      setCreatedLink(null);
                      setShowCreateModal(false);
                    }, 1000);
                  }}
                  style={{
                    width: '100%',
                    background: C.teal,
                    color: C.white,
                    border: 'none',
                    borderRadius: '4px',
                    padding: '10px 16px',
                    fontFamily: C.fontBody,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Copied!
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontFamily: C.fontBody,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: C.charcoal,
                    marginBottom: '6px',
                  }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g., John Doe"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${C.bgBorder}`,
                      borderRadius: '4px',
                      fontFamily: C.fontBody,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontFamily: C.fontBody,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: C.charcoal,
                    marginBottom: '6px',
                  }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="john@example.com"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${C.bgBorder}`,
                      borderRadius: '4px',
                      fontFamily: C.fontBody,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedLink(null);
                    }}
                    disabled={creating}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${C.bgBorder}`,
                      borderRadius: '4px',
                      padding: '10px 16px',
                      fontFamily: C.fontBody,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: C.charcoal,
                      cursor: 'pointer',
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateForm}
                    disabled={creating || !clientName.trim()}
                    style={{
                      background: C.teal,
                      color: C.white,
                      border: 'none',
                      borderRadius: '4px',
                      padding: '10px 16px',
                      fontFamily: C.fontBody,
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: (creating || !clientName.trim()) ? 0.6 : 1,
                    }}
                  >
                    {creating ? 'Creating...' : '+ Create Form Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-fill Form Modal */}
      {showPreFillModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => {
          setShowPreFillModal(false);
          setPreFillName('');
          setPreFillEmail('');
        }}>
          <div style={{
            background: C.white,
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontFamily: C.fontHeading,
              fontSize: '20px',
              color: C.charcoal,
              margin: '0 0 20px 0',
            }}>
              Pre-fill a Form
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontFamily: C.fontBody,
                fontSize: '13px',
                fontWeight: 600,
                color: C.charcoal,
                marginBottom: '6px',
              }}>
                Client Name *
              </label>
              <input
                type="text"
                value={preFillName}
                onChange={(e) => setPreFillName(e.target.value)}
                placeholder="e.g., John Doe"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontFamily: C.fontBody,
                fontSize: '13px',
                fontWeight: 600,
                color: C.charcoal,
                marginBottom: '6px',
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={preFillEmail}
                onChange={(e) => setPreFillEmail(e.target.value)}
                placeholder="john@example.com"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowPreFillModal(false);
                  setPreFillName('');
                  setPreFillEmail('');
                }}
                disabled={preFillingId !== null}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.charcoal,
                  cursor: 'pointer',
                  opacity: preFillingId !== null ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!preFillName.trim() || !preFillEmail.trim()) return;

                  setPreFillingId('creating');
                  try {
                    const { data, error } = await supabase
                      .from('forms')
                      .insert({
                        form_type: 'estate_planning',
                        client_name: preFillName,
                        client_email: preFillEmail,
                        status: 'not_sent',
                        progress_pct: 0,
                        unique_link: `prefill-${Math.random().toString(36).slice(2, 10)}`,
                        form_data: {},
                      })
                      .select()
                      .single();

                    if (error) throw error;

                    // Redirect to form
                    window.location.href = `${window.location.origin}/?formId=${data.id}`;
                  } catch (err) {
                    console.error('Error creating form:', err);
                    setPreFillingId(null);
                  }
                }}
                disabled={!preFillName.trim() || !preFillEmail.trim() || preFillingId !== null}
                style={{
                  background: C.teal,
                  color: C.white,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: preFillingId === null && preFillName.trim() && preFillEmail.trim() ? 'pointer' : 'not-allowed',
                  opacity: preFillingId === null && preFillName.trim() && preFillEmail.trim() ? 1 : 0.6,
                }}
              >
                {preFillingId === null ? 'Go to Form' : 'Creating...'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
        }}
        onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div style={{
            background: C.white,
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontFamily: C.fontHeading,
              fontSize: '20px',
              color: C.charcoal,
              margin: '0 0 12px 0',
            }}>
              Delete Form?
            </h2>
            <p style={{ color: C.textL, fontSize: '14px', marginBottom: '20px' }}>
              This action cannot be undone. The form and all its data will be permanently deleted.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => !deleting && setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.bgBorder}`,
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.charcoal,
                  cursor: 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                style={{
                  background: '#dc3545',
                  color: C.white,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontFamily: C.fontBody,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SentTab({ sentForms, searchTerm, onSearchChange, onDelete }: any) {
  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Link Sent (Not Opened)
      </div>
      {sentForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No forms in this category
        </div>
      ) : (
        <FormTable forms={sentForms} showProgress={false} onDelete={onDelete} />
      )}
    </div>
  );
}

function OpenedOnlyTab({ openedForms, searchTerm, onSearchChange, onDelete }: any) {
  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Opened Only (0%)
      </div>
      {openedForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No forms in this category
        </div>
      ) : (
        <FormTable forms={openedForms} showProgress onDelete={onDelete} />
      )}
    </div>
  );
}

function IncompleteTab({ inProgressForms, searchTerm, onSearchChange, onDelete }: any) {
  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Filled But Not Complete (1-99%)
      </div>
      {inProgressForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No forms in this category
        </div>
      ) : (
        <FormTable forms={inProgressForms} showProgress onDelete={onDelete} />
      )}
    </div>
  );
}

function CompletedTab({ completedForms, onSend, sendingId, searchTerm, onSearchChange, onDelete }: any) {
  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
Ready for Lawyer Review (100%)
      </div>
      {completedForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No completed forms yet
        </div>
      ) : (
        <div style={{
          background: C.white,
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: C.fontBody,
          }}>
            <thead>
              <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {completedForms.map((form: any) => (
                <tr key={form.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{form.client_name}</td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{form.client_email || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '100px', height: '6px', background: C.bgBorder, borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: C.teal }} />
                      </div>
                      <span style={{ minWidth: '35px', fontWeight: 600 }}>100%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          window.location.href = `${window.location.origin}/?formId=${form.id}&summary=true`;
                        }}
                        style={{
                          background: C.teal,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
Review
                      </button>
                      <button
                        onClick={() => onSend(form.id)}
                        disabled={sendingId === form.id}
                        style={{
                          background: sendingId === form.id ? '#999' : C.warm,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: sendingId === form.id ? 'not-allowed' : 'pointer',
                          opacity: sendingId === form.id ? 0.7 : 1,
                        }}
                      >
                        {sendingId === form.id ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubmittedTab({ submittedForms, searchTerm, onSearchChange, onDelete }: any) {
  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Sent to Smokeball
      </div>
      {submittedForms.length === 0 ? (
        <div style={{ background: C.white, padding: '40px', borderRadius: '6px', textAlign: 'center', color: C.textL }}>
          <p>No submitted forms yet</p>
        </div>
      ) : (
        <div style={{
          background: C.white,
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: C.fontBody,
          }}>
            <thead>
              <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent At</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {submittedForms.map((form: any) => (
                <tr key={form.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{form.client_name}</td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{form.client_email || '-'}</td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>
                    {form.submitted_at ? new Date(form.submitted_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          window.location.href = `${window.location.origin}/?formId=${form.id}&summary=true`;
                        }}
                        style={{
                          background: C.teal,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PendingLeadsTab({ pendingLeadsForms, searchTerm, onSearchChange, onDelete }: any) {
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [disengagingId, setDisengagingId] = useState<string | null>(null);
  const [screeningSubmissions, setScreeningSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const { data, error } = await supabase
          .from('screening_submissions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setScreeningSubmissions(data || []);
      } catch (err) {
        console.error('Error fetching screening submissions:', err);
      } finally {
        setLoadingSubmissions(false);
      }
    };

    fetchSubmissions();
  }, []);

  const handleQualify = async (submissionId: string, contactData: any) => {
    setQualifyingId(submissionId);
    try {
      const clientName = contactData.name || contactData.contactName || '';
      const clientEmail = contactData.email || '';

      const { data, error: formError } = await supabase
        .from('forms')
        .insert({
          form_type: 'estate_planning',
          client_name: clientName,
          client_email: clientEmail,
          status: 'not_sent',
          progress_pct: 0,
          unique_link: `estate-${Math.random().toString(36).slice(2, 10)}`,
          form_data: {},
        })
        .select()
        .single();

      if (formError) throw formError;

      const { error: updateError } = await supabase
        .from('screening_submissions')
        .update({ form_id: data.id, status: 'qualified' })
        .eq('id', submissionId);

      if (updateError) throw updateError;
      window.location.reload();
    } catch (err) {
      console.error('Error qualifying lead:', err);
      setQualifyingId(null);
    }
  };

  const handleDisengage = async (submissionId: string) => {
    setDisengagingId(submissionId);
    try {
      const { error } = await supabase
        .from('screening_submissions')
        .update({ status: 'disqualified_not_proceeding' })
        .eq('id', submissionId);

      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('Error disengaging lead:', err);
      setDisengagingId(null);
    }
  };

  const filteredSubmissions = screeningSubmissions.filter(s => {
    const search = searchTerm.toLowerCase();
    const data = s.contact_data;
    const name = data.name || data.contactName || '';
    const email = data.email || '';
    return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Screening Responses
      </div>
      {loadingSubmissions ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          Loading...
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No pending leads. Share the screening form link to start collecting responses.
        </div>
      ) : (
        <div style={{
          background: C.white,
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: C.fontBody,
          }}>
            <thead>
              <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((submission: any) => {
                const data = submission.contact_data;
                const name = data.name || data.contactName || '';
                const email = data.email || '';
                return (
                  <tr key={submission.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{name}</td>
                    <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{email}</td>
                    <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px', textTransform: 'capitalize' }}>{submission.contact_type}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleQualify(submission.id, data)}
                          disabled={qualifyingId === submission.id}
                          style={{
                            background: qualifyingId === submission.id ? '#999' : C.green,
                            color: C.white,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: qualifyingId === submission.id ? 'not-allowed' : 'pointer',
                            opacity: qualifyingId === submission.id ? 0.7 : 1,
                          }}
                        >
                          {qualifyingId === submission.id ? 'Qualifying...' : 'Qualify'}
                        </button>
                        <button
                          onClick={() => handleDisengage(submission.id)}
                          disabled={disengagingId === submission.id}
                          style={{
                            background: disengagingId === submission.id ? '#999' : '#dc3545',
                            color: C.white,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: disengagingId === submission.id ? 'not-allowed' : 'pointer',
                            opacity: disengagingId === submission.id ? 0.7 : 1,
                          }}
                        >
                          {disengagingId === submission.id ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NotSentTab({ notSentForms, searchTerm, onSearchChange, onDelete }: any) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleCopyLink = (form: any) => {
    const baseUrl = `${window.location.origin}/?formId=${form.id}`;
    navigator.clipboard.writeText(baseUrl);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendForm = async (form: any) => {
    if (!form.client_email) {
      alert('No email address on file for this client');
      return;
    }

    setSendingId(form.id);
    try {
      const formLink = `${window.location.origin}/?formId=${form.id}`;
      const webhookUrl = import.meta.env.VITE_SEND_FORM_EMAIL_WEBHOOK || import.meta.env.VITE_WEBHOOK_URL;

      // Send webhook to Make
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: form.client_name,
          client_email: form.client_email,
          form_link: formLink,
          form_id: form.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to send email');

      // Update form status to 'sent'
      const { error } = await supabase
        .from('forms')
        .update({ status: 'sent' })
        .eq('id', form.id);

      if (error) throw error;

      window.location.reload();
    } catch (err) {
      console.error('Error sending form:', err);
      alert('Failed to send form email');
      setSendingId(null);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Ready to Send
      </div>
      {notSentForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No forms waiting to be sent
        </div>
      ) : (
        <div style={{
          background: C.white,
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: C.fontBody,
          }}>
            <thead>
              <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {notSentForms.map((form: any) => (
                <tr key={form.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{form.client_name}</td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{form.client_email || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleSendForm(form)}
                        disabled={sendingId === form.id}
                        style={{
                          background: sendingId === form.id ? '#999' : C.teal,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: sendingId === form.id ? 'not-allowed' : 'pointer',
                          opacity: sendingId === form.id ? 0.7 : 1,
                        }}
                      >
                        {sendingId === form.id ? 'Sending...' : 'Send Form'}
                      </button>
                      <button
                        onClick={() => handleCopyLink(form)}
                        style={{
                          background: copiedId === form.id ? C.green : C.warm,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedId === form.id ? 'Copied' : 'Copy Link'}
                      </button>
                      <button
                        onClick={() => onDelete && onDelete(form.id)}
                        style={{
                          background: '#dc3545',
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverdueTab({ overdueForms, searchTerm, onSearchChange, onDelete }: any) {
  const [deprioritizingId, setDeprioritizingId] = useState<string | null>(null);

  const handleDeprioritize = async (formId: string) => {
    setDeprioritizingId(formId);
    try {
      const { error } = await supabase
        .from('forms')
        .update({ status: 'no_response' })
        .eq('id', formId);

      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('Error deprioritizing form:', err);
      setDeprioritizingId(null);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by client name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: C.textL,
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Overdue ({'>'}2 weeks)
      </div>
      {overdueForms.length === 0 ? (
        <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
          No overdue forms
        </div>
      ) : (
        <div style={{
          background: C.white,
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            fontFamily: C.fontBody,
          }}>
            <thead>
              <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {overdueForms.map((form: any) => (
                <tr key={form.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{form.client_name}</td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{form.client_email || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '100px', height: '6px', background: C.bgBorder, borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${form.progress_pct}%`, height: '100%', background: C.teal, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ minWidth: '35px', fontWeight: 600 }}>{form.progress_pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>
                    {form.created_at ? new Date(form.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          window.location.href = `${window.location.origin}/?formId=${form.id}&summary=true`;
                        }}
                        style={{
                          background: C.teal,
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeprioritize(form.id)}
                        disabled={deprioritizingId === form.id}
                        style={{
                          background: deprioritizingId === form.id ? '#999' : '#dc3545',
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: deprioritizingId === form.id ? 'not-allowed' : 'pointer',
                          opacity: deprioritizingId === form.id ? 0.7 : 1,
                        }}
                      >
                        {deprioritizingId === form.id ? 'Moving...' : 'Deprioritize'}
                      </button>
                      <button
                        onClick={() => onDelete && onDelete(form.id)}
                        style={{
                          background: '#999',
                          color: C.white,
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DisqualifiedTab({ noResponseForms, searchTerm, onSearchChange, onDelete }: any) {
  const [disqualifiedScreenings, setDisqualifiedScreenings] = useState<any[]>([]);
  const [loadingScreenings, setLoadingScreenings] = useState(true);

  useEffect(() => {
    const fetchDisqualified = async () => {
      try {
        const { data, error } = await supabase
          .from('screening_submissions')
          .select('*')
          .eq('status', 'disqualified_not_proceeding')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDisqualifiedScreenings(data || []);
      } catch (err) {
        console.error('Error fetching disqualified screenings:', err);
      } finally {
        setLoadingScreenings(false);
      }
    };

    fetchDisqualified();
  }, []);

  const filteredScreenings = disqualifiedScreenings.filter(s => {
    const search = searchTerm.toLowerCase();
    const data = s.contact_data;
    const name = data.name || data.contactName || '';
    const email = data.email || '';
    return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  const filteredNoResponse = noResponseForms.filter(f => {
    const search = searchTerm.toLowerCase();
    return (
      (f.client_name?.toLowerCase().includes(search) || '') ||
      (f.client_email?.toLowerCase().includes(search) || '')
    );
  });

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or email..."
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '10px 12px',
          border: `1px solid ${C.bgBorder}`,
          borderRadius: '4px',
          fontFamily: C.fontBody,
          fontSize: '13px',
          boxSizing: 'border-box',
          marginBottom: '24px',
        }}
      />

      {/* Section 1: Not Proceeding */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: C.textL,
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Not Proceeding (Disengaged from Screening)
        </div>
        {loadingScreenings ? (
          <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
            Loading...
          </div>
        ) : filteredScreenings.length === 0 ? (
          <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
            No disengaged leads
          </div>
        ) : (
          <div style={{
            background: C.white,
            border: `1px solid ${C.bgBorder}`,
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              fontFamily: C.fontBody,
            }}>
              <thead>
                <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredScreenings.map((submission: any) => {
                  const data = submission.contact_data;
                  const name = data.name || data.contactName || '';
                  const email = data.email || '';
                  return (
                    <tr key={submission.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{name}</td>
                      <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{email}</td>
                      <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px', textTransform: 'capitalize' }}>{submission.contact_type}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('screening_submissions')
                                .delete()
                                .eq('id', submission.id);
                              if (error) throw error;
                              setDisqualifiedScreenings(prev => prev.filter(s => s.id !== submission.id));
                            } catch (err) {
                              console.error('Error deleting submission:', err);
                            }
                          }}
                          style={{
                            background: '#dc3545',
                            color: C.white,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: No Response */}
      <div>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: C.textL,
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          No Response (Deprioritized from Overdue)
        </div>
        {filteredNoResponse.length === 0 ? (
          <div style={{ background: C.white, padding: '20px', borderRadius: '6px', color: C.textL }}>
            No overdue deprioritized forms
          </div>
        ) : (
          <FormTable forms={filteredNoResponse} showProgress={false} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}

function FormTable({ forms, showProgress, onDelete }: any) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.bgBorder}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
        fontFamily: C.fontBody,
      }}>
        <thead>
          <tr style={{ background: C.bgD, borderBottom: `1px solid ${C.bgBorder}` }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Name</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
            {showProgress && <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>}
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opened</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: C.charcoal, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {forms.map((form: any) => (
            <tr key={form.id} style={{ borderBottom: `1px solid ${C.bgBorder}` }}>
              <td style={{ padding: '12px 16px', fontWeight: 600, color: C.charcoal }}>{form.client_name}</td>
              <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>{form.client_email || '-'}</td>
              {showProgress && (
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '100px', height: '6px', background: C.bgBorder, borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${form.progress_pct}%`, height: '100%', background: C.teal, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ minWidth: '35px', fontWeight: 600 }}>{form.progress_pct}%</span>
                  </div>
                </td>
              )}
              <td style={{ padding: '12px 16px', color: C.textL, fontSize: '12px' }}>
                {form.created_at
                  ? new Date(form.created_at).toLocaleDateString()
                  : '—'}
              </td>
              <td style={{ padding: '12px 16px', color: form.last_accessed ? C.charcoal : C.textL, fontSize: '12px' }}>
                {form.last_accessed
                  ? new Date(form.last_accessed).toLocaleDateString()
                  : '—'}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      window.location.href = `${window.location.origin}/?formId=${form.id}`;
                    }}
                    style={{
                      background: C.teal,
                      color: C.white,
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
View
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(form.id)}
                    style={{
                      background: '#dc3545',
                      color: C.white,
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

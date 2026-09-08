import { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from './components/Toast.jsx';
import { C } from './constants/colors.js';
import { usePartA } from './hooks/usePartA.jsx';
import { usePartB } from './hooks/usePartB.jsx';
import { usePartC } from './hooks/usePartC.jsx';
import { usePartD } from './hooks/usePartD.jsx';
import ThankYou from './submission/ThankYou.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import RestoreBanner from './components/RestoreBanner.jsx';
import { submitFinalWebhook } from './submission/webhook.js';
import { useSupabaseForms } from './hooks/useSupabaseForms';
import { useAutoSaveSupabase } from './hooks/useAutoSaveSupabase';
import { calculateFormProgress } from './utils/calculateProgress';
import { supabase } from './lib/supabase';

// ─── Initial State ───────────────────────────────────────────────────────────

function initClient() {
  return {
    salut: '', first: '', middle: '', last: '', nick: '',
    dob: '', pob: '', gender: '', citizen: '', pr: '',
    email: '', mobile: '', homePhone: '', addr: '', postalSame: '', postal: '',
    occ: '', employer: '',
    relStatus: '', relDate: '',
    priorRel: '', priorRelDetail: '', priorRelChildren: '',
    religion: '', interpreter: '',
    capacity: '', capacityDetail: '',
  };
}

function newScenario() {
  return { hasGifts: '', giftCount: 0, gifts: [], resBeneCount: '', resBenes: [] };
}

function initAData() {
  return {
    engType: '', state: 'NSW', referral: '',
    refFirst: '', refLast: '', refFirm: '', refPhone: '', refEmail: '',
    contactPref: '', urgent: '', urgentDetail: '',
    c1: initClient(), c2: initClient(),
    hasChildren: '', childJointCount: 0, childJoint: [],
    grandchildren: '', grandchildrenDetail: '',
    otherDependants: '', otherDependantsDetail: '',
    c1FatherName: '', c1FatherAlive: '', c1MotherName: '', c1MotherAlive: '',
    c2FatherName: '', c2FatherAlive: '', c2MotherName: '', c2MotherAlive: '',
    familyProvisionRisk: '', familyProvisionDetail: '',
    disclosureLevel: '',
    c1HasProperty: '', c1PropCount: 0, c1Props: [],
    c1HasBank: '', c1BankCount: 0, c1Banks: [],
    c1HasShares: '', c1ShareCount: 0, c1Shares: [],
    c1HasCrypto: '', c1CryptoDetail: '',
    c1ForeignAssets: '', c1ForeignDetail: '',
    c1HasSuper: '', c1SuperCount: 0, c1Supers: [],
    c1OtherAssetNotes: '', c1HasMortgages: '', c1MortCount: 0, c1Morts: [],
    c1HasLoans: '', c1LoanCount: 0, c1Loans: [],
    c1Guarantees: '', c1GuaranteeDetail: '',
    c2HasProperty: '', c2PropCount: 0, c2Props: [],
    c2HasBank: '', c2BankCount: 0, c2Banks: [],
    c2HasShares: '', c2ShareCount: 0, c2Shares: [],
    c2HasCrypto: '', c2CryptoDetail: '',
    c2ForeignAssets: '', c2ForeignDetail: '',
    c2HasSuper: '', c2SuperCount: 0, c2Supers: [],
    c2OtherAssetNotes: '', c2HasMortgages: '', c2MortCount: 0, c2Morts: [],
    c2HasLoans: '', c2LoanCount: 0, c2Loans: [],
    c2Guarantees: '', c2GuaranteeDetail: '',
    c1PropTotal: '', c1BankTotal: '', c1ShareTotal: '', c1OtherTotal: '', c1DebtTotal: '',
    c2PropTotal: '', c2BankTotal: '', c2ShareTotal: '', c2OtherTotal: '', c2DebtTotal: '',
  };
}

function initBData() {
  return {
    c1HasBiz: '', c1BizCount: 0, c1Businesses: [],
    c1HasTrusts: '', c1TrustCount: 0, c1Trusts: [],
    c1HasSmsf: '',
    c1HasIns: '', c1LifeCount: 0, c1Life: [],
    c1TraumaCount: '', c1IncomeCount: '',
    c2HasBiz: '', c2BizCount: 0, c2Businesses: [],
    c2HasTrusts: '', c2TrustCount: 0, c2Trusts: [],
    c2HasSmsf: '',
    c2HasIns: '', c2LifeCount: 0, c2Life: [],
    c2TraumaCount: '', c2IncomeCount: '',
    accountant: '', accountantPhone: '', accountantEmail: '', accountantAuthority: '',
    uploadedFiles: [] as { name: string; url: string }[],
  };
}

function initCData() {
  return {
    mirrorWill: '',
    c1Scen1: newScenario(), c1Scen2: newScenario(),
    c2Scen1: newScenario(), c2Scen2: newScenario(),
    beneProfiles: {},
    c1ExecCount: '', c1Execs: [], c1WillLoc: '',
    c2ExecCount: '', c2Execs: [], c2WillLoc: '',
    guardianCount: '', guardians: [],
    c1HasExistingWill: '', c1WillDate: '', c1WillKept: '',
    c2HasExistingWill: '', c2WillDate: '', c2WillKept: '',
  };
}

function initDData() {
  return {
    c1EpaHealth: '', c1HealthAttCount: '', c1HealthAtts: [],
    c1Ahd: '', c1LifeSustaining: '', c1OrganDonation: '',
    c1EpaFin: '', c1EpaFinTrigger: '', c1FinAttCount: '', c1FinAtts: [],
    c1BurialPref: '', c1FuneralReligion: '', c1Legacy: '',
    c2EpaHealth: '', c2HealthAttCount: '', c2HealthAtts: [],
    c2Ahd: '', c2LifeSustaining: '', c2OrganDonation: '',
    c2EpaFin: '', c2EpaFinTrigger: '', c2FinAttCount: '', c2FinAtts: [],
    c2BurialPref: '', c2FuneralReligion: '', c2Legacy: '',
    c1Litigation: '', c1AdditionalInfo: '',
    c1SignDate: '', c2SignDate: '',
  };
}

// ─── Session helpers ──────────────────────────────────────────────────────────

const SESSION_LS_KEY = 'nlg_session_id';
const SESSION_DEBOUNCE_MS = 3000;

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_LS_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_LS_KEY, id);
  }
  return id;
}


// ─── Part Wrapper ─────────────────────────────────────────────────────────────

function PartWrapper({ hook, onAdvance, isLastPart, isFirstPart, onBack, aData, bData, cData, dData, formId, lastSaved }) {
  const { pages, pg, setPg, total, pct, title, visited, renderPage, errors, clearErrors } = hook;
  const isLastPage = pg === total - 1;
  const isFirstPage = pg === 0;

  const handleNextClick = () => {
    const ok = hook.handleNext(aData, bData, cData, dData);
    if (ok && isLastPage) {
      onAdvance?.();
    }
  };

  const handleBackClick = () => {
    clearErrors();
    if (isFirstPage) {
      if (onBack) onBack();
    } else {
      setPg(Math.max(pg - 1, 0));
    }
  };

  const progressBarStyle = {
    height: 5, borderRadius: 3, background: C.bgBorder, overflow: 'hidden', marginBottom: 6,
  };
  const progressFillStyle = {
    height: '100%', width: `${pct}%`, background: C.teal,
    transition: 'width 0.3s ease', borderRadius: 3,
  };
  const btnBase = {
    padding: '10px 28px', borderRadius: 22, border: 'none', cursor: 'pointer',
    fontFamily: C.fontBody, fontSize: 13, fontWeight: 600,
    transition: 'opacity 0.15s, background 0.15s',
    letterSpacing: '0.03em',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={progressBarStyle}><div style={progressFillStyle} /></div>
        <div style={{ fontFamily: C.fontBody, fontSize: 11, color: C.textL, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Page {pg + 1} of {total} &nbsp;·&nbsp; {pct}% complete</span>
          {lastSaved && <span style={{ fontSize: 10, opacity: 0.7 }}>Last saved: {lastSaved}</span>}
        </div>
      </div>
      <div id="main-content" className="app-card" style={{
        background: C.white, border: `1px solid ${C.bgBorder}`,
        borderRadius: 8, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        <ErrorBanner errors={errors} />
        {renderPage()}
      </div>
      <div className="app-nav-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={handleBackClick}
          disabled={isFirstPage && isFirstPart}
          className="app-nav-btn"
          style={{
            ...btnBase,
            background: 'transparent',
            border: `1.5px solid ${(isFirstPage && isFirstPart) ? C.bgBorder : C.charcoal}`,
            color: (isFirstPage && isFirstPart) ? C.textL : C.charcoal,
            opacity: (isFirstPage && isFirstPart) ? 0.45 : 1,
          }}
        >
          ← Back
        </button>
        <div className="app-page-title" style={{ fontFamily: C.fontBody, fontSize: 12, color: C.textL, textAlign: 'center', flex: 1, padding: '0 10px' }}>
          {title}
        </div>
        <button
          onClick={handleNextClick}
          className="app-nav-btn"
          style={{
            ...btnBase,
            background: isLastPage ? C.green : C.teal,
            color: C.white,
            border: 'none',
          }}
        >
          {isLastPage ? (isLastPart ? (formId ? 'Mark as Complete' : 'Submit Questionnaire') : 'Proceed →') : 'Next →'}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

interface AppProps {
  formId?: string | null;
}

export default function App({ formId }: AppProps) {
  const [aData, setAData] = useState(initAData);
  const [bData, setBData] = useState(initBData);
  const [cData, setCData] = useState(initCData);
  const [dData, setDData] = useState(initDData);
  const [activePart, setActivePart] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(!!formId);
  const [actualFormId, setActualFormId] = useState<string | null>(formId || null);

  // ── Validate/lookup form ID (handle unique_link → UUID mapping) ────────────
  useEffect(() => {
    if (!formId || !supabase) return;

    // Check if formId is a valid UUID (contains dashes)
    if (formId.includes('-')) {
      // Already a UUID
      setActualFormId(formId);
      return;
    }

    // It's a unique_link, look up the real form ID
    const lookupFormId = async () => {
      try {
        const { data: form } = await supabase
          .from('forms')
          .select('id')
          .eq('unique_link', formId)
          .single();

        if (form?.id) {
          setActualFormId(form.id);
        } else {
          console.error('Form not found with unique_link:', formId);
          setActualFormId(null);
        }
      } catch (err) {
        console.error('Error looking up form ID:', err);
        setActualFormId(null);
      }
    };

    lookupFormId();
  }, [formId, supabase]);

  // ── Supabase form management ───────────────────────────────────────────────
  const { getForm, updateFormData, completeForm } = useSupabaseForms();

  // ── Auto-save to Supabase ──────────────────────────────────────────────────
  const handleAutoSave = async (formData: any, progress: number) => {
    if (actualFormId) {
      try {
        await updateFormData(actualFormId, formData, progress);
        setLastSaved(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }
  };

  useAutoSaveSupabase(actualFormId, aData, bData, cData, dData, handleAutoSave);

  // ── Session / auto-save state ──────────────────────────────────────────────
  const [sessionId] = useState<string>(formId || getOrCreateSessionId);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessTrackedRef = useRef(false);
  const initialLoadRef = useRef(true);

  // Restore form from Supabase (if actualFormId provided) or localStorage
  useEffect(() => {
    const restoreForm = async () => {
      try {
        // Check if viewing summary of submitted form
        const params = new URLSearchParams(window.location.search);
        const viewSummary = params.get('summary') === 'true';

        if (actualFormId) {
          // Load from Supabase
          const form = await getForm(actualFormId);
          if (form?.form_data) {
            const { aData: a, bData: b, cData: c, dData: d } = form.form_data;
            if (a) setAData(a);
            if (b) setBData(b);
            if (c) setCData(c);
            if (d) setDData(d);
            if (form.last_saved) {
              setLastSaved(new Date(form.last_saved).toLocaleTimeString());
            }
            // Show summary view if requested
            if (viewSummary) {
              setSubmitted(true);
            } else {
              setShowRestoreBanner(true);
            }
          }
        } else {
          // Load from localStorage (legacy, local session)
          const response = await fetch(`/api/session/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            if (data?.state) {
              const { aData: a, bData: b, cData: c, dData: d } = data.state;
              if (a) setAData(a as ReturnType<typeof initAData>);
              if (b) setBData(b as ReturnType<typeof initBData>);
              if (c) setCData(c as ReturnType<typeof initCData>);
              if (d) setDData(d as ReturnType<typeof initDData>);
              setShowRestoreBanner(true);
            }
          }
        }
      } catch (err) {
        console.error('Error restoring form:', err);
      } finally {
        restoredRef.current = true;
        setLoadingForm(false);
      }
    };

    const timer = setTimeout(() => {
      initialLoadRef.current = false;
    }, 100);

    restoreForm();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualFormId]);

  // Track form access (when first opened) - mark immediately when actualFormId is present
  useEffect(() => {
    if (actualFormId && !accessTrackedRef.current) {
      // Don't mark as accessed if just viewing summary of submitted form
      const params = new URLSearchParams(window.location.search);
      const viewSummary = params.get('summary') === 'true';

      if (viewSummary) {
        accessTrackedRef.current = true;
        return; // Skip status update when viewing summary
      }

      accessTrackedRef.current = true;

      const markAccessed = async () => {
        try {
          const { data: form } = await supabase
            .from('forms')
            .select('status')
            .eq('id', actualFormId)
            .single();

          const { data, error } = await supabase
            .from('forms')
            .update({
              last_accessed: new Date().toISOString(),
              status: form?.status === 'sent' ? 'opened' : form?.status,
            })
            .eq('id', actualFormId)
            .select();
          if (error) throw error;
        } catch (err) {
          console.error('Error marking form as accessed:', err);
        }
      };
      markAccessed();
    }
  }, [actualFormId]);

  // Auto-save on state change (debounced, only after initial restore)
  useEffect(() => {
    if (!restoredRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Don't auto-save when viewing summary or on initial load
    const params = new URLSearchParams(window.location.search);
    const viewSummary = params.get('summary') === 'true';
    if (viewSummary || initialLoadRef.current) return;

    saveTimerRef.current = setTimeout(() => {
      if (actualFormId) {
        // Save to Supabase
        const formData = { aData, bData, cData, dData };
        const progress = calculateFormProgress(aData, bData, cData, dData);

        // Determine status based on progress
        let newStatus = 'opened';
        if (progress > 0) {
          newStatus = 'in_progress';
        }

        // Update form
        supabase
          .from('forms')
          .update({
            form_data: formData,
            progress_pct: progress,
            status: newStatus,
          })
          .eq('id', actualFormId)
          .then(() => setLastSaved(new Date().toLocaleTimeString()))
          .catch((err) => console.error('Auto-save error:', err));
      } else {
        // Save to localStorage (legacy)
        fetch(`/api/session/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: { aData, bData, cData, dData } }),
        }).catch(() => {});
      }
    }, SESSION_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aData, bData, cData, dData, actualFormId]);

  const handleClearSession = () => {
    fetch(`/api/session/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem(SESSION_LS_KEY);
    window.location.reload();
  };

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const partA = usePartA(aData, setAData);
  const partB = usePartB(bData, setBData, aData);
  const partC = usePartC(cData, setCData, aData);
  const partD = usePartD(dData, setDData, aData);

  const parts = [
    { label: 'Part A', sub: 'Identity & Assets', hook: partA },
    { label: 'Part B', sub: 'Business & Insurance', hook: partB },
    { label: 'Part C', sub: 'Wills & Executors', hook: partC },
    { label: 'Part D', sub: 'EPA & Wills', hook: partD },
  ];

  const currentHook = parts[activePart].hook;
  const isWelcomePage = activePart === 0 && currentHook.pg === 0;

  const handleAdvance = () => {
    if (activePart < 3) {
      setActivePart(activePart + 1);
    } else {
      if (!aData.engType) {
        toast.warning('Please go back to the Welcome page and select an Engagement Type before submitting.');
        return;
      }

      if (actualFormId) {
        // Supabase mode: Mark as complete (lawyer will send to Smokeball later)
        completeForm(actualFormId)
          .then(() => {
            // Send webhook to Make for confirmation email
            const webhookUrl = 'https://hook.eu2.make.com/6xtuj8hqbt68f90v8y4iy3u3lylrs2hw';
            fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                form_id: actualFormId,
                client_name_c1: aData.c1?.first + ' ' + aData.c1?.last,
                client_email_c1: aData.c1?.email,
                client_name_c2: aData.c2?.first + ' ' + aData.c2?.last,
                client_email_c2: aData.c2?.email,
                form_data: { aData, bData, cData, dData },
                completed_at: new Date().toISOString(),
              }),
            }).catch(err => console.error('Webhook error:', err));

            toast.success('Form marked as complete. Your lawyer will review and send to Smokeball.');
            setSubmitted(true);
          })
          .catch(() => toast.warning('Could not mark form as complete — please try again'));
      } else {
        // Legacy mode: Submit directly to webhook
        submitFinalWebhook(aData, bData, cData, dData, sessionId)
          .then(() => toast.success('Your form has been submitted successfully'))
          .catch(() => toast.warning('Form data could not be sent — please contact us directly'));
        setSubmitted(true);
      }
    }
  };

  const handleBack = () => {
    if (activePart > 0) {
      setActivePart(activePart - 1);
      const prevHook = parts[activePart - 1].hook;
      prevHook.setPg(prevHook.total - 1);
    }
  };

  const sidebarPageStyle = (idx: number, current: number, vis: Set<number>) => ({
    padding: '7px 12px', fontFamily: C.fontBody, fontSize: 12,
    color: idx === current ? C.white : vis.has(idx) ? C.teal : C.textL,
    background: idx === current ? C.teal : 'transparent',
    borderRadius: 4, cursor: 'pointer',
    borderLeft: idx === current ? `3px solid ${C.warm}` : '3px solid transparent',
    display: 'block', width: '100%', textAlign: 'left' as const,
    border: 'none', transition: 'background 0.15s', marginBottom: 2,
  });

  if (loadingForm) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: C.bg,
        fontFamily: C.fontBody,
      }}>
        <div style={{ textAlign: 'center', color: C.textL }}>
          <p>Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root" style={{ background: C.bg, fontFamily: C.fontBody }}>
      <ToastContainer />

      {/* ── Sticky header block ─────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>

        {/* Contact bar */}
        <div style={{
          background: C.white,
          borderBottom: `1px solid ${C.bgBorder}`,
          padding: '5px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 18,
          fontSize: 12,
          fontFamily: C.fontBody,
          color: C.charcoal,
        }}>
          <a
            href="tel:0755743560"
            style={{ color: C.teal, textDecoration: 'none' }}
          >
            07 5574 3560
          </a>
          <a
            href="mailto:info@stiveslaw.com.au"
            style={{ color: C.teal, textDecoration: 'none' }}
          >
            info@stiveslaw.com.au
          </a>
          <a
            href="https://www.facebook.com/stiveslaw/"
            target="_blank"
            rel="noreferrer"
            style={{ color: C.teal, textDecoration: 'none' }}
          >
            Facebook
          </a>
          <a
            href="https://www.stiveslaw.com.au/"
            target="_blank"
            rel="noreferrer"
            style={{ color: C.teal, textDecoration: 'none' }}
          >
            Website
          </a>
        </div>

        {/* Logo / banner header */}
        <div style={{
          background: C.white,
          borderBottom: `1px solid ${C.bgBorder}`,
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 24px',
        }}>
          {/* Logo */}
          <img
            src={C.logoUrl}
            alt={C.logoAlt}
            style={{ height: 52, objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Subtitle */}
          <span style={{
            marginLeft: 18,
            fontFamily: C.fontHeading,
            fontSize: 11,
            color: C.teal,
            letterSpacing: C.trackingXWide,
            textTransform: 'uppercase',
          }}>
            Estate Planning Questionnaire
          </span>
        </div>

        {/* Tab bar */}
        <div style={{ background: C.warm, display: 'flex', alignItems: 'stretch', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flex: 1, overflowX: 'auto', padding: '0 0 0 16px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {parts.map((part, idx) => (
              <button key={idx} onClick={() => { setActivePart(idx); setSideMenuOpen(false); }} className="app-tab-btn" style={{
                border: 'none', cursor: 'pointer', flexShrink: 0,
                background: idx === activePart ? C.white : 'transparent',
                color: idx === activePart ? C.warm : C.white,
                fontFamily: C.fontBody, fontSize: C.sizeXs, fontWeight: 700,
                letterSpacing: C.trackingWide, textTransform: 'uppercase',
                borderRadius: '6px 6px 0 0', marginRight: 4, transition: 'background 0.15s', whiteSpace: 'nowrap',
              }}>
                {part.label}
                <span className="app-tab-sub" style={{ display: 'block', fontSize: 10, opacity: 0.75 }}>{part.sub}</span>
              </button>
            ))}
          </div>
          <button
            className="mobile-menu-btn"
            onClick={() => setSideMenuOpen(o => !o)}
            style={{
              border: 'none', borderLeft: `1px solid rgba(255,255,255,0.2)`, cursor: 'pointer',
              background: sideMenuOpen ? C.white : 'rgba(255,255,255,0.12)',
              color: sideMenuOpen ? C.warm : C.white, fontFamily: C.fontBody, fontSize: 12,
              fontWeight: 700, padding: '0 16px', flexShrink: 0,
              transition: 'background 0.15s', whiteSpace: 'nowrap',
            }}
            aria-label="Toggle page navigation"
          >
            {sideMenuOpen ? '✕ Close' : '☰ Pages'}
          </button>
        </div>
      </div>
      {/* ── End sticky block ─────────────────────────────────────────────── */}

      {/* Restore banner */}
      {showRestoreBanner && (
        <RestoreBanner
          onDismiss={() => setShowRestoreBanner(false)}
          onClear={handleClearSession}
        />
      )}


      {/* Intro banner — always visible */}
      <div style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '28px 32px',
          textAlign: 'center',
          borderBottom: `2px solid ${C.tealD}`,
        }}>
          {/* Shell beach image base */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${C.heroUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            pointerEvents: 'none',
          }} />
          {/* Dark teal wash for readability */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `${C.tealD}dd`,
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontFamily: C.fontHeading,
              fontWeight: 300,
              fontSize: 20,
              color: C.white,
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}>
              Start your estate planning journey with us.
            </div>
            <div style={{
              fontFamily: C.fontBody,
              fontSize: 13,
              color: C.white,
              opacity: 0.88,
              letterSpacing: '0.01em',
            }}>
              Complete this intake form and our team will be in touch to guide you through the process.
            </div>
          </div>
        </div>

      {/* Mobile Sidebar Panel */}
      {sideMenuOpen && (
        <div className="mobile-sidebar-panel" style={{ background: C.white, borderBottom: `2px solid ${C.teal}`, padding: '10px 12px', boxShadow: '0 3px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontFamily: C.fontBody, fontSize: 10, fontWeight: 700, color: C.textL, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>
            {parts[activePart].label} — Pages
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {currentHook.pages.map((page: { key: string; title: string }, idx: number) => (
              <button key={page.key}
                onClick={() => { currentHook.setPg(idx); setSideMenuOpen(false); }}
                style={{
                  fontFamily: C.fontBody, fontSize: 12, fontWeight: 600,
                  color: idx === currentHook.pg ? C.white : currentHook.visited.has(idx) ? C.teal : C.textL,
                  background: idx === currentHook.pg ? C.teal : C.bg,
                  border: `1px solid ${idx === currentHook.pg ? C.teal : C.bgBorder}`,
                  borderRadius: 4, padding: '8px 12px', cursor: 'pointer',
                  minHeight: 44, display: 'flex', alignItems: 'center',
                }}>
                {currentHook.visited.has(idx) && idx !== currentHook.pg ? '✓ ' : ''}{page.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="app-layout">
        {/* Sidebar */}
        <div className="app-sidebar" style={{
          background: C.white, border: `1px solid ${C.bgBorder}`,
          borderRadius: 8, padding: '12px 8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontFamily: C.fontBody, fontSize: 10, fontWeight: 700, color: C.textL, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, padding: '0 6px' }}>
            {parts[activePart].label} Pages
          </div>
          {currentHook.pages.map((page: { key: string; title: string }, idx: number) => (
            <button key={page.key} onClick={() => currentHook.setPg(idx)}
              style={sidebarPageStyle(idx, currentHook.pg, currentHook.visited)}>
              {currentHook.visited.has(idx) && idx !== currentHook.pg ? '✓ ' : ''}{page.title}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${C.bgBorder}`, marginTop: 12, paddingTop: 10 }}>
            <button
              onClick={handleClearSession}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: C.fontBody, fontSize: 11, color: C.textL,
                textDecoration: 'underline', padding: '4px 6px', width: '100%',
                textAlign: 'left' as const,
              }}
            >
              Clear &amp; start over
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="app-content">
          {submitted ? (
            <div className="app-card" style={{ background: C.white, border: `1px solid ${C.bgBorder}`, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <ThankYou aData={aData} bData={bData} cData={cData} dData={dData} />
            </div>
          ) : (
            <PartWrapper
              hook={currentHook}
              onAdvance={handleAdvance}
              onBack={handleBack}
              isLastPart={activePart === 3}
              isFirstPart={activePart === 0}
              aData={aData}
              bData={bData}
              cData={cData}
              dData={dData}
              formId={formId}
              lastSaved={lastSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}

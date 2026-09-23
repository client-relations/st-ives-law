import { Suspense, lazy, useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const Dashboard = lazy(() =>
  import('./pages/DashboardV2').catch(err => {
    console.error('Dashboard load error:', err);
    return { default: () => <div>Error loading dashboard</div> };
  })
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').catch(err => {
    console.error('LoginPage load error:', err);
    return { default: () => <div>Error loading login page</div> };
  })
);
const SignUp = lazy(() =>
  import('./pages/SignUp').catch(err => {
    console.error('SignUp load error:', err);
    return { default: () => <div>Error loading sign up page</div> };
  })
);

type View = 'loading' | 'dashboard' | 'login' | 'signup' | 'link-error';

export default function AppRouter() {
  const [view, setView] = useState<View>('loading');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    const route = async () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;

      if (path === '/login') {
        setView('login');
        return;
      }

      if (path === '/signup') {
        setView('signup');
        return;
      }

      // Older reminder emails linked to /?uniqueLink=<token>, which opened a
      // legacy questionnaire that overwrote the client's saved answers. Forward
      // those links to the real client form instead.
      const uniqueLink = params.get('uniqueLink');
      if (uniqueLink) {
        try {
          const response = await fetch(`/api/resolve-link?token=${encodeURIComponent(uniqueLink)}`);
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.lead_id) throw new Error(result.error || 'This link is no longer valid.');
          window.location.replace(`/${result.target}?lead_id=${encodeURIComponent(result.lead_id)}`);
        } catch (err) {
          setLinkError(err instanceof Error ? err.message : 'This link is no longer valid.');
          setView('link-error');
        }
        return;
      }

      // The standalone /screening page and the legacy ?formId= questionnaire
      // were removed; new leads are added from the dashboard.
      if (path === '/screening' || params.has('formId')) {
        window.history.replaceState(null, '', '/');
      }

      // Demo mode (development builds only — grants dashboard access without
      // a Supabase session).
      if (import.meta.env.DEV && localStorage.getItem('supabase_user_id') === 'demo-user-id') {
        setView('dashboard');
        return;
      }

      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!session?.user) {
        window.location.href = '/login';
        return;
      }
      setView('dashboard');
    };

    route();
  }, []);

  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
      {view === 'login' ? (
        <LoginPage />
      ) : view === 'signup' ? (
        <SignUp />
      ) : view === 'dashboard' ? (
        <Dashboard />
      ) : view === 'link-error' ? (
        <div style={{ padding: '40px', maxWidth: '520px', margin: '0 auto', fontFamily: 'sans-serif' }}>
          <h2>This link can't be opened</h2>
          <p>{linkError} Please contact St Ives Law and we'll send you a new one.</p>
        </div>
      ) : (
        <div style={{ padding: '20px' }}>Loading...</div>
      )}
    </Suspense>
  );
}

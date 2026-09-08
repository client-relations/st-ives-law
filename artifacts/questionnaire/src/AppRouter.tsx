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
const ScreeningForm = lazy(() =>
  import('./pages/ScreeningFormV2').catch(err => {
    console.error('ScreeningForm load error:', err);
    return { default: () => <div>Error loading screening form</div> };
  })
);
const EmailVerification = lazy(() =>
  import('./pages/EmailVerification').catch(err => {
    console.error('EmailVerification load error:', err);
    return { default: () => <div>Error loading verification</div> };
  })
);
const SignUp = lazy(() =>
  import('./pages/SignUp').catch(err => {
    console.error('SignUp load error:', err);
    return { default: () => <div>Error loading sign up page</div> };
  })
);
const App = lazy(() =>
  import('./App').catch(err => {
    console.error('App load error:', err);
    return { default: () => <div>Error loading form</div> };
  })
);

export default function AppRouter() {
  const [view, setView] = useState<'dashboard' | 'form' | 'screening' | 'login' | 'signup' | 'email-verification'>('dashboard');
  const [formId, setFormId] = useState<string | null>(null);
  const [uniqueLink, setUniqueLink] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      if (!supabase) {
        setView('dashboard');
        return;
      }

      const params = new URLSearchParams(window.location.search);

      // Routes that don't require auth
      if (window.location.pathname === '/login') {
        setView('login');
        return;
      }

      if (window.location.pathname === '/signup') {
        setView('signup');
        return;
      }

      if (window.location.pathname === '/screening') {
        setView('screening');
        return;
      }

      // Check for external form access via unique_link
      const uniqueLinkParam = params.get('uniqueLink');
      if (uniqueLinkParam) {
        try {
          // Validate token exists
          const { data } = await supabase
            .from('forms')
            .select('id, client_email')
            .eq('unique_link', uniqueLinkParam)
            .single();

          if (data) {
            // This is an external form access, show email verification first
            setUniqueLink(uniqueLinkParam);
            setView('email-verification');
            return;
          }
        } catch (err) {
          console.error('Invalid form link:', err);
          setView('dashboard');
          return;
        }
      }

      // Check for demo mode first
      const demoUserId = localStorage.getItem('supabase_user_id');
      if (demoUserId === 'demo-user-id') {
        // Demo mode - allow access with admin lawyer context
        const urlFormId = params.get('formId');
        if (urlFormId) {
          setFormId(urlFormId);
          setView('form');
        } else {
          setView('dashboard');
        }
        return;
      }

      // Check authentication for dashboard/authenticated routes
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session?.user;

      if (!isAuthenticated) {
        window.location.href = '/login';
        return;
      }

      // Authenticated routes
      const urlFormId = params.get('formId');
      if (urlFormId) {
        setFormId(urlFormId);
        setView('form');
      } else {
        setView('dashboard');
      }
    };

    checkAuth();
  }, []);

  const handleEmailVerified = async () => {
    if (!uniqueLink || !supabase) return;
    try {
      // Fetch the actual form ID using unique_link
      const { data: form } = await supabase
        .from('forms')
        .select('id')
        .eq('unique_link', uniqueLink)
        .single();

      if (form) {
        setFormId(form.id);
        setView('form');
      }
    } catch (err) {
      console.error('Error fetching form ID:', err);
    }
  };

  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
      {view === 'login' ? (
        <LoginPage />
      ) : view === 'signup' ? (
        <SignUp />
      ) : view === 'dashboard' ? (
        <Dashboard />
      ) : view === 'screening' ? (
        <ScreeningForm />
      ) : view === 'email-verification' && uniqueLink ? (
        <EmailVerification uniqueLink={uniqueLink} onVerified={handleEmailVerified} />
      ) : (
        <App formId={formId} />
      )}
    </Suspense>
  );
}

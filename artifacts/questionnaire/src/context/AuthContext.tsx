import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Lawyer {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: any | null;
  lawyer: Lawyer | null;
  /** Why the signed-in user has no lawyer profile, if they don't. */
  lawyerError: string;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_ERRORS: Record<string, string> = {
  NO_PROFILE: 'No lawyer profile exists for this email. Ask an admin to add you to the lawyer list.',
  PROFILE_ALREADY_CLAIMED: 'The lawyer profile for this email is already linked to another account. Ask an admin to check it.',
  DUPLICATE_PROFILE: 'More than one lawyer profile uses this email. Ask an admin to remove the duplicate.',
};

/**
 * Resolve the lawyer record for the signed-in user. link_my_lawyer_profile()
 * returns the profile already linked to this account, or links the one
 * unclaimed profile an admin created for this email — never someone else's.
 */
async function loadLawyer(): Promise<{ lawyer: Lawyer | null; error: string }> {
  const { data, error } = await supabase.rpc('link_my_lawyer_profile');
  if (error) {
    const code = Object.keys(PROFILE_ERRORS).find((c) => error.message?.includes(c));
    return { lawyer: null, error: code ? PROFILE_ERRORS[code] : `Could not load your lawyer profile: ${error.message}` };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { lawyer: row as Lawyer, error: '' } : { lawyer: null, error: PROFILE_ERRORS.NO_PROFILE };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [lawyerError, setLawyerError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const applySession = async (session: any) => {
      if (!session?.user) {
        setUser(null);
        setLawyer(null);
        setLawyerError('');
        return;
      }
      setUser(session.user);
      const result = await loadLawyer();
      setLawyer(result.lawyer);
      setLawyerError(result.error);
    };

    const initAuth = async () => {
      try {
        // Check for demo mode (development builds only — this grants admin
        // access without authenticating, so it must not ship to production).
        const demoUserId = localStorage.getItem('supabase_user_id');
        if (import.meta.env.DEV && demoUserId === 'demo-user-id') {
          setUser({ id: 'demo-user-id', email: 'test@test.com' });
          setLawyer({
            id: '5d136c20-1dc8-4b9f-a123-a01a56d763a0',
            email: 'admin@lex-ops.io',
            full_name: 'Sarah Southern',
            is_admin: true,
          });
          return;
        }

        if (!supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, next: any) => {
          // TOKEN_REFRESHED fires hourly; the profile does not change with it.
          if (event === 'TOKEN_REFRESHED') return;
          // Deferred: calling Supabase inside this callback can deadlock the
          // client's auth lock (supabase-js v2).
          setTimeout(() => { applySession(next); }, 0);
        });
        unsubscribe = () => subscription?.unsubscribe();
      } catch (err) {
        setLawyerError(`Could not check your sign-in: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    return () => unsubscribe?.();
  }, []);

  const logout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setLawyer(null);
      // Clear any stored data
      localStorage.clear();
      sessionStorage.clear();
      // Navigate to login
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, lawyer, lawyerError, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

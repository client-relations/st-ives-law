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
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for demo mode
        const demoUserId = localStorage.getItem('supabase_user_id');
        if (demoUserId === 'demo-user-id') {
          setUser({ id: 'demo-user-id', email: 'test@test.com' });
          setLawyer({
            id: '5d136c20-1dc8-4b9f-a123-a01a56d763a0',
            email: 'admin@lex-ops.io',
            full_name: 'Admin Lawyer',
            is_admin: true,
          });
          setLoading(false);
          return;
        }

        if (!supabase) {
          setLoading(false);
          return;
        }

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Fetch lawyer record
          const { data: lawyerData } = await supabase
            .from('lawyers')
            .select('*')
            .eq('email', session.user.email)
            .single();
          if (lawyerData) {
            setLawyer(lawyerData);
          }
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            setUser(session.user);
            const { data: lawyerData } = await supabase
              .from('lawyers')
              .select('*')
              .eq('email', session.user.email)
              .single();
            if (lawyerData) {
              setLawyer(lawyerData);
            }
          } else {
            setUser(null);
            setLawyer(null);
          }
        });

        return () => subscription?.unsubscribe();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
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
    <AuthContext.Provider value={{ user, lawyer, loading, logout }}>
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

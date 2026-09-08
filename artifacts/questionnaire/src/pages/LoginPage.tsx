import { useState } from 'react';
import { C } from '../constants/colors';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Login only - no public signup for security

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Demo mode for testing (remove in production)
      const demoEmail = 'test@test.com';
      const demoPassword = 'password123';

      console.log('Login attempt:', { email, password, demoEmail, demoPassword });
      console.log('Demo check:', email.trim() === demoEmail && password.trim() === demoPassword);

      if (email.trim() === demoEmail && password.trim() === demoPassword) {
        console.log('Demo mode activated');
        localStorage.setItem('supabase_user_id', 'demo-user-id');
        window.location.href = '/';
        return;
      }

      if (!supabase) {
        throw new Error('Supabase not configured');
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) throw authError;
      if (data?.session) {
        localStorage.setItem('supabase_user_id', data.user.id);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password
      });
      if (authError) throw authError;
      if (data?.user) {
        setError('');
        setView('login');
        setEmail('');
        setPassword('');
        // Show success message or auto-login
        alert('Account created! Please log in with your credentials.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.fontBody,
      padding: '20px',
    }}>
      <div style={{
        background: C.white,
        borderRadius: '8px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.png" alt="St Ives Law" style={{ height: '60px', width: 'auto', marginBottom: '16px', maxWidth: '100%' }} />
          <div style={{ fontSize: '12px', color: C.textL }}>
            Lawyer Dashboard Login
          </div>
        </div>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{
              background: '#f8d7da',
              border: `1px solid #f5c6cb`,
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              color: '#721c24',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: C.charcoal }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${C.bgBorder}`,
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: C.charcoal }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${C.bgBorder}`,
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: C.teal,
              color: C.white,
              border: 'none',
              borderRadius: '4px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginBottom: '16px',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: `1px solid ${C.bgBorder}`,
          fontSize: '12px',
          color: C.textL,
          textAlign: 'center',
        }}>
          Don't have an account? <a href="/signup" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>Sign up here</a>
        </div>
      </div>
    </div>
  );
}

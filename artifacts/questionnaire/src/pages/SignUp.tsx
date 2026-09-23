import { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/auth.css';

// Sign-up creates the sign-in account only. The lawyer profile is linked on
// first sign-in by link_my_lawyer_profile(), and only if an admin has already
// created an UNCLAIMED profile for this exact email — so nobody can take over
// another lawyer's profile by picking their name.
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email: address, password });
      if (authError) throw authError;

      if (data.session) {
        window.location.href = '/';
        return;
      }
      setNotice('Check your inbox to confirm your email, then sign in. Your firm admin must have added this email to the lawyer list.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='auth-container'>
      <div className='auth-card'>
        <h1 className='auth-title'>Create Lawyer Account</h1>
        <form onSubmit={handleSignUp} className='auth-form'>
          <div className='form-group'>
            <label>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='your@email.com'
              disabled={loading}
            />
          </div>

          <div className='form-group'>
            <label>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='••••••••'
              disabled={loading}
            />
          </div>

          {error && <div className='auth-error'>{error}</div>}
          {notice && <div className='auth-notice'>{notice}</div>}

          <button type='submit' disabled={loading} className='auth-button'>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className='auth-footer'>
          Already have an account?{' '}
          <a href='/login'>Sign in here</a>
        </p>
      </div>
    </div>
  );
}

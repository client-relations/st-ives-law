import { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/auth.css';

const LAWYERS = ['Colin Long', 'Emma Mathieson', 'Katrina Elizabeth Brown', 'Sarah Tait', 'Tyler Smith', 'Vicki Baker'];

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password || !selectedLawyer) {
        setError('Email, password, and lawyer name are required');
        setLoading(false);
        return;
      }

      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // Upsert lawyer record (update if exists by name, create if not)
      const lawyerName = selectedLawyer;

      console.log('Sign up: Looking for lawyer:', lawyerName);

      // First try to find existing lawyer by name
      const { data: existingLawyer, error: selectError } = await supabase
        .from('lawyers')
        .select('id')
        .eq('full_name', lawyerName);

      if (selectError) {
        console.error('Error finding lawyer:', selectError);
        throw selectError;
      }

      console.log('Found lawyers:', existingLawyer);

      if (existingLawyer && existingLawyer.length > 0) {
        // Update existing lawyer with email only (keep ID intact)
        console.log('Updating existing lawyer:', lawyerName);
        const { error: updateError } = await supabase
          .from('lawyers')
          .update({ email })
          .eq('full_name', lawyerName);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        console.log('Lawyer updated successfully');
      } else {
        // Create new lawyer record
        console.log('Creating new lawyer:', lawyerName);
        const { error: insertError } = await supabase.from('lawyers').insert({
          id: authData.user.id,
          email,
          full_name: lawyerName,
          is_admin: false,
        });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
        console.log('New lawyer created');
      }

      // Redirect to login
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      console.error('Sign up error:', err);
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

          <div className='form-group'>
            <label>Select Your Name</label>
            <select
              value={selectedLawyer}
              onChange={(e) => setSelectedLawyer(e.target.value)}
              disabled={loading}
            >
              <option value=''>-- Choose a name --</option>
              {LAWYERS.map((lawyer) => (
                <option key={lawyer} value={lawyer}>
                  {lawyer}
                </option>
              ))}
            </select>
          </div>

          {error && <div className='auth-error'>{error}</div>}

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

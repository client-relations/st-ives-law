import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { C } from '../constants/colors';

interface EmailVerificationProps {
  uniqueLink: string;
  onVerified: () => void;
}

export default function EmailVerification({ uniqueLink, onVerified }: EmailVerificationProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formInfo, setFormInfo] = useState<any>(null);

  useEffect(() => {
    const fetchFormInfo = async () => {
      if (!supabase || !uniqueLink) return;
      try {
        const { data: form } = await supabase
          .from('forms')
          .select('client_email, client_name')
          .eq('unique_link', uniqueLink)
          .single();

        if (form) {
          setFormInfo(form);
        } else {
          setError('Form not found. Invalid or expired link.');
        }
      } catch (err) {
        setError('Error loading form information.');
        console.error(err);
      }
    };

    fetchFormInfo();
  }, [uniqueLink]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      if (!formInfo) {
        setError('Form information could not be loaded');
        setLoading(false);
        return;
      }

      // Check if email matches
      if (email.toLowerCase() !== formInfo.client_email.toLowerCase()) {
        setError('Email does not match the one this form was sent to. Please check and try again.');
        setLoading(false);
        return;
      }

      // Email verified - call callback
      onVerified();
    } catch (err) {
      setError('Error verifying email');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.bg,
      padding: '20px',
    }}>
      <div style={{
        background: C.white,
        borderRadius: '8px',
        border: `1px solid ${C.bgBorder}`,
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: C.charcoal,
          marginBottom: '12px',
          textAlign: 'center',
        }}>
          Verify Your Email
        </h1>

        <p style={{
          fontSize: '14px',
          color: C.textL,
          marginBottom: '28px',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          Please enter the email address this form was sent to verify your identity.
        </p>

        {formInfo && (
          <div style={{
            background: C.bg,
            border: `1px solid ${C.bgBorder}`,
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '20px',
          }}>
            <p style={{
              fontSize: '12px',
              color: C.textL,
              marginBottom: '4px',
            }}>
              Form sent to:
            </p>
            <p style={{
              fontSize: '14px',
              fontWeight: 600,
              color: C.charcoal,
            }}>
              {formInfo.client_name}
            </p>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${C.bgBorder}`,
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
              marginBottom: '16px',
              fontFamily: C.fontBody,
            }}
          />

          {error && (
            <div style={{
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              color: '#c33',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? C.textL : C.warm,
              color: C.white,
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <p style={{
          fontSize: '12px',
          color: C.textL,
          marginTop: '20px',
          textAlign: 'center',
        }}>
          This form requires email verification for security.
        </p>
      </div>
    </div>
  );
}

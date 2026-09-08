import { useState } from 'react';
import { C } from '../constants/colors';
import { supabase } from '../lib/supabase';

type ContactType = 'person' | 'firm';

export default function ScreeningForm() {
  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Person form state
  const [personData, setPersonData] = useState({
    title: '',
    name: '',
    mobile: '',
    email: '',
  });

  // Firm form state
  const [firmData, setFirmData] = useState({
    organisationName: '',
    phone: '',
    email: '',
    contactTitle: '',
    contactName: '',
    contactMobile: '',
    businessRole: '',
  });

  const handlePersonChange = (field: string, value: string) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
  };

  const handleFirmChange = (field: string, value: string) => {
    setFirmData(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personData.email || !personData.name) {
      setError('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      // Save screening submission - forms are created when lawyer qualifies
      const { error: err } = await supabase
        .from('screening_submissions')
        .insert({
          contact_type: 'person',
          contact_data: personData,
        });

      if (err) throw err;
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmData.organisationName || !firmData.email || !firmData.contactName) {
      setError('Organisation name, email, and contact name are required');
      return;
    }

    setSubmitting(true);
    try {
      // Save screening submission - forms are created when lawyer qualifies
      const { error: err } = await supabase
        .from('screening_submissions')
        .insert({
          contact_type: 'firm',
          contact_data: firmData,
        });

      if (err) throw err;
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
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
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <h2 style={{
            fontFamily: C.fontHeading,
            fontSize: '24px',
            color: C.charcoal,
            marginBottom: '12px',
          }}>
            Thank You
          </h2>
          <p style={{
            fontFamily: C.fontBody,
            fontSize: '14px',
            color: C.textL,
            marginBottom: '24px',
          }}>
            We've received your information. Our team will review it and contact you soon.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: C.teal,
              color: C.white,
              border: 'none',
              borderRadius: '4px',
              padding: '10px 24px',
              fontFamily: C.fontBody,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  if (!contactType) {
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
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/logo.png" alt="St Ives Law" style={{ height: '60px', width: 'auto', marginBottom: '16px', maxWidth: '100%' }} />
            <h1 style={{
              fontFamily: C.fontHeading,
              fontSize: '24px',
              color: C.charcoal,
              margin: 0,
            }}>
              Initial Inquiry Form
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setContactType('person')}
              style={{
                background: C.teal,
                color: C.white,
                border: 'none',
                borderRadius: '6px',
                padding: '16px',
                fontFamily: C.fontBody,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#0d7b74')}
              onMouseOut={(e) => (e.currentTarget.style.background = C.teal)}
            >
              Individual
            </button>
            <button
              onClick={() => setContactType('firm')}
              style={{
                background: C.warm,
                color: C.white,
                border: 'none',
                borderRadius: '6px',
                padding: '16px',
                fontFamily: C.fontBody,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#d9915f')}
              onMouseOut={(e) => (e.currentTarget.style.background = C.warm)}
            >
              Firm/Business/Organisation
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <button
          onClick={() => setContactType(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textL,
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: C.fontBody,
            marginBottom: '16px',
          }}
        >
          ← Back
        </button>

        <h2 style={{
          fontFamily: C.fontHeading,
          fontSize: '20px',
          color: C.charcoal,
          margin: '0 0 24px 0',
        }}>
          {contactType === 'person' ? 'Individual Information' : 'Organisation Information'}
        </h2>

        {error && (
          <div style={{
            background: '#ffebee',
            border: `1px solid #ef5350`,
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#c62828',
            fontFamily: C.fontBody,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={contactType === 'person' ? handlePersonSubmit : handleFirmSubmit}>
          {contactType === 'person' ? (
            <>
              {/* Person Form */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Title
                </label>
                <select
                  value={personData.title}
                  onChange={(e) => handlePersonChange('title', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${C.bgBorder}`,
                    borderRadius: '4px',
                    fontFamily: C.fontBody,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select Title</option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={personData.name}
                  onChange={(e) => handlePersonChange('name', e.target.value)}
                  placeholder="Your name"
                  required
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Mobile
                </label>
                <input
                  type="tel"
                  value={personData.mobile}
                  onChange={(e) => handlePersonChange('mobile', e.target.value)}
                  placeholder="+61..."
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

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={personData.email}
                  onChange={(e) => handlePersonChange('email', e.target.value)}
                  placeholder="your@email.com"
                  required
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
            </>
          ) : (
            <>
              {/* Firm Form */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Organisation Name *
                </label>
                <input
                  type="text"
                  value={firmData.organisationName}
                  onChange={(e) => handleFirmChange('organisationName', e.target.value)}
                  placeholder="Company name"
                  required
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={firmData.phone}
                  onChange={(e) => handleFirmChange('phone', e.target.value)}
                  placeholder="+61..."
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={firmData.email}
                  onChange={(e) => handleFirmChange('email', e.target.value)}
                  placeholder="contact@company.com"
                  required
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Contact Title
                </label>
                <select
                  value={firmData.contactTitle}
                  onChange={(e) => handleFirmChange('contactTitle', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${C.bgBorder}`,
                    borderRadius: '4px',
                    fontFamily: C.fontBody,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select Title</option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={firmData.contactName}
                  onChange={(e) => handleFirmChange('contactName', e.target.value)}
                  placeholder="Name"
                  required
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Contact Mobile
                </label>
                <input
                  type="tel"
                  value={firmData.contactMobile}
                  onChange={(e) => handleFirmChange('contactMobile', e.target.value)}
                  placeholder="+61..."
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

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: C.fontBody,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.charcoal,
                  marginBottom: '6px',
                }}>
                  Business Role
                </label>
                <input
                  type="text"
                  value={firmData.businessRole}
                  onChange={(e) => handleFirmChange('businessRole', e.target.value)}
                  placeholder="e.g. Director, Manager"
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
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              background: C.teal,
              color: C.white,
              border: 'none',
              borderRadius: '4px',
              padding: '12px 16px',
              fontFamily: C.fontBody,
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}

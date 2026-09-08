import { useState } from 'react';
import { C } from '../constants/colors.js';

const MAX_TEXT     = 255;
const MAX_TEXTAREA = 1000;

// ─── Phone normalisation ──────────────────────────────────────────────────────
// Strips formatting, converts leading 0 → +61. Returns '' for empty input.
function normalisePhone(v) {
  if (!v || !String(v).trim()) return '';
  const s = String(v).trim();
  if (s.startsWith('+61')) {
    const digits = s.slice(3).replace(/\D/g, '');
    return digits ? `+61${digits}` : '';
  }
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('61')) return `+61${digits.slice(2)}`;
  if (digits.startsWith('0'))  return `+61${digits.slice(1)}`;
  return digits;
}

// ─── Blur validation ──────────────────────────────────────────────────────────
function validateBlur(type, format, value) {
  if (!value) return '';
  const v = String(value);

  if (type === 'email') {
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v.trim()))
      return 'Please enter a valid email address (e.g. name@domain.com or user+alias@domain.com)';
  }

  if (type === 'tel') {
    const d = v.replace(/[\s\-]/g, '');
    const isMobile   = d => /^04\d{8}$/.test(d)   || /^\+614\d{8}$/.test(d);
    const isLandline = d => /^0[23780]\d{8}$/.test(d) || /^\+61[23780]\d{8}$/.test(d);
    const isAnyAu    = d => isMobile(d) || isLandline(d);
    if (format === 'mobile') {
      if (!isMobile(d)) return 'Please enter a valid mobile number (e.g. 0412 345 678)';
    } else if (format === 'phone') {
      if (!isLandline(d)) return 'Please enter a valid landline (e.g. 02 1234 5678)';
    } else {
      if (!isAnyAu(d)) return 'Please enter a valid Australian phone number (e.g. 0412 345 678)';
    }
  }

  if (type === 'date') {
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'Please enter a valid date';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (format === 'dob') {
      if (d > now) return 'Date of birth cannot be in the future';
      const tooOld = new Date();
      tooOld.setFullYear(tooOld.getFullYear() - 120);
      if (d < tooOld) return 'Please enter a valid date of birth';
      const adultCutoff = new Date();
      adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
      if (d > adultCutoff) return 'Client must be at least 18 years old';
    } else {
      if (d > now) return 'Date cannot be in the future';
      const tooOld = new Date();
      tooOld.setFullYear(tooOld.getFullYear() - 150);
      if (d < tooOld) return 'Please enter a valid date';
    }
  }

  if (format === 'dollar') {
    const s = v.replace(/[,\s]/g, '');
    if (s && !/^\d+(\.\d{1,2})?$/.test(s)) return 'Please enter a valid amount (e.g. 500,000 or 0)';
    if (parseFloat(s) < 0) return 'Amount cannot be negative';
  }

  if (format === 'address') {
    if (v.trim().length > 0 && v.trim().length < 10)
      return 'Please enter a complete address (at least 10 characters)';
  }

  if (format === 'percent') {
    const n = parseFloat(v);
    if (!isNaN(n) && (n < 0 || n > 100)) return 'Percentage must be between 0 and 100';
  }

  if (format === 'abn') {
    const d = v.replace(/\s/g, '');
    if (d && !/^\d{11}$/.test(d)) return 'ABN must be exactly 11 digits';
  }

  if (format === 'acn') {
    const d = v.replace(/\s/g, '');
    if (d && !/^\d{9}$/.test(d)) return 'ACN must be exactly 9 digits';
  }

  if (type === 'textarea' && v.length > MAX_TEXTAREA) {
    return `Maximum ${MAX_TEXTAREA.toLocaleString()} characters (currently ${v.length.toLocaleString()})`;
  }

  return '';
}

export default function Field({ label, name, type = 'text', opts = [], value, onChange, required, placeholder, rows = 3, sub, warn, error, format }) {
  const [blurHint, setBlurHint] = useState('');

  const id = label ? label.replace(/\s+/g, '_').toLowerCase() : Math.random().toString(36).slice(2);
  const radioName = name || id;
  const borderColor = error ? C.red : C.border;
  const bgColor = error ? '#fff5f5' : C.white;

  const inputBase = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${borderColor}`,
    borderRadius: 4,
    fontFamily: C.fontBody,
    fontSize: 14,
    color: C.text,
    background: bgColor,
    boxSizing: 'border-box',
    outline: 'none',
  };

  function handleChange(val) {
    setBlurHint('');
    onChange(val);
  }

  function handleBlur(e) {
    let val = e.target.value;
    if (type === 'tel') {
      const normalised = normalisePhone(val);
      if (normalised !== val) {
        onChange(normalised);
        val = normalised;
      }
    }
    setBlurHint(validateBlur(type, format, val));
  }

  // Character counter
  const rawLen   = String(value || '').length;
  const maxLen   = type === 'textarea' ? MAX_TEXTAREA : MAX_TEXT;
  const remaining = maxLen - rawLen;
  const showCounter = type === 'textarea'
    ? rawLen >= 800
    : (type === 'text' || type === 'email') && rawLen >= 200;
  const counterColor = remaining <= 20 ? C.red : remaining <= 50 ? C.amber : C.textL;

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label htmlFor={id} style={{ display: 'block', fontFamily: C.fontBody, fontSize: 13, fontWeight: 600, color: error ? C.red : C.text, marginBottom: 4 }}>
          {label}
        </label>
      )}
      {sub && (
        <div style={{ fontSize: 12, color: C.textL, marginBottom: 5, fontFamily: C.fontBody }}>{sub}</div>
      )}
      {warn && (
        <div style={{ background: C.warmPale, border: `1px solid ${C.warmL}`, borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12, color: C.amber, fontFamily: C.fontBody }}>
          ⚠ {warn}
        </div>
      )}
      {type === 'textarea' && (
        <textarea
          id={id}
          value={value || ''}
          onChange={e => { setBlurHint(''); onChange(e.target.value.slice(0, MAX_TEXTAREA)); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          maxLength={MAX_TEXTAREA}
          className="field-input"
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
        />
      )}
      {type === 'select' && (
        <select
          id={id}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="field-input"
          style={{ ...inputBase, cursor: 'pointer' }}
        >
          <option value="">— Select —</option>
          {opts.map(o => (
            <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </select>
      )}
      {type === 'radio' && (
        <div style={error ? {
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2,
          borderLeft: `3px solid ${C.red}`,
          paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 10,
          background: '#fff5f5', borderRadius: 4,
        } : {
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2,
        }}>
          {opts.map(o => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: C.fontBody, fontSize: 14, color: C.text, padding: '5px 12px', border: `1px solid ${value === v ? C.teal : C.border}`, borderRadius: 4, background: value === v ? C.slatePale : C.white }}>
                <input type="radio" name={radioName} value={v} checked={value === v} onChange={() => onChange(v)} style={{ accentColor: C.teal }} />
                {l}
              </label>
            );
          })}
        </div>
      )}
      {(type === 'text' || type === 'email') && (
        <input
          id={id}
          type={type}
          value={value || ''}
          onChange={e => handleChange(e.target.value.slice(0, MAX_TEXT))}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={MAX_TEXT}
          className="field-input"
          style={inputBase}
        />
      )}
      {(type === 'tel' || type === 'date' || type === 'number') && (
        <input
          id={id}
          type={type}
          value={value || ''}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="field-input"
          style={inputBase}
        />
      )}
      {showCounter && (
        <div style={{ textAlign: 'right', fontSize: 11, marginTop: 2, fontFamily: C.fontBody, color: counterColor }}>
          {remaining >= 0
            ? `${remaining} character${remaining === 1 ? '' : 's'} remaining`
            : `${-remaining} character${-remaining === 1 ? '' : 's'} over limit`}
        </div>
      )}
      {error && (
        <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontFamily: C.fontBody, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {error}
        </div>
      )}
      {!error && blurHint && (
        <div data-blur-hint style={{ color: C.red, fontSize: 11, marginTop: 4, fontFamily: C.fontBody, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {blurHint}
        </div>
      )}
    </div>
  );
}

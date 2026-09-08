import { C } from '../constants/colors.js';

export default function RestoreBanner({ onDismiss, onClear }) {
  return (
    <div
      data-testid="restore-banner"
      style={{
        background: '#f0f9ff',
        borderBottom: `1px solid ${C.slateL || '#b0c4d8'}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontFamily: C.fontBody,
        fontSize: 13,
        color: C.teal,
        flexWrap: 'wrap',
      }}
    >
      <span>✓ Welcome back — your progress has been restored.</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.textL,
            fontSize: 12,
            fontFamily: C.fontBody,
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Clear &amp; start over
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.teal,
            fontSize: 20,
            lineHeight: 1,
            padding: '0 4px',
            fontWeight: 700,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { C } from '../constants/colors.js';

export default function AdviceBox({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.warmL}`, borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.warmPale, border: 'none', cursor: 'pointer', fontFamily: C.fontBody, fontSize: 13, fontWeight: 600, color: C.amber, textAlign: 'left' }}
      >
        <span>⚖ {title}</span>
        <span style={{ fontSize: 12, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', background: C.white, fontFamily: C.fontBody, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

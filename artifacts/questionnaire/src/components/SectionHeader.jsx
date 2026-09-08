import { C } from '../constants/colors.js';

export default function SectionHeader({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontFamily: C.fontHeading, fontSize: C.sizeLg, color: C.teal, fontWeight: 600, letterSpacing: C.trackingWide, textTransform: 'uppercase' }}>{title}</h2>
      </div>
      {sub && <p style={{ margin: '0 0 8px', fontFamily: C.fontBody, fontSize: 14, color: C.textL }}>{sub}</p>}
      <hr style={{ border: 'none', borderTop: `2px solid ${C.bgBorder}`, margin: 0 }} />
    </div>
  );
}

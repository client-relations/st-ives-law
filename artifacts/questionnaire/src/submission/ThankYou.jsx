import { C } from '../constants/colors.js';
import SummaryView from './SummaryView.jsx';

export default function ThankYou({ aData, bData, cData, dData }) {
  const c1 = aData.c1 || {};
  const n1 = c1.nick || c1.first || 'there';

  return (
    <div>
      {/* ── Banner ── */}
      <div style={{
        background: C.greenL, border: `1px solid ${C.green}`, borderRadius: 8,
        padding: '24px 28px', marginBottom: 28,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 42 }}>✅</span>
          <div>
            <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, color: C.green, margin: 0, fontWeight: 700 }}>
              Thank you, {n1}!
            </h2>
            <p style={{ fontFamily: C.fontBody, fontSize: 14, color: C.text, margin: '4px 0 0', lineHeight: 1.6 }}>
              Your information has all been captured and sent to <strong>St Ives Law</strong>. A member of our team will be in touch shortly.
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: C.fontHeading, fontSize: 17, color: C.tealD, fontWeight: 700 }}>
          Your Submitted Information
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: C.teal, color: C.white, border: 'none', borderRadius: 5,
            padding: '8px 18px', fontFamily: C.fontBody, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          🖨 Print / Save PDF
        </button>
      </div>
      <div style={{ height: 2, background: C.bgBorder, marginBottom: 16, borderRadius: 1 }} />

      {/* ── Data summary ── */}
      <SummaryView aData={aData} bData={bData} cData={cData} dData={dData} />
    </div>
  );
}

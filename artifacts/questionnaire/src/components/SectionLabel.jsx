import { C } from '../constants/colors.js';

export default function SectionLabel({ text }) {
  return (
    <div style={{
      background: C.teal,
      color: C.white,
      fontFamily: C.fontBody,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '4px 12px',
      borderRadius: 3,
      marginBottom: 14,
      marginTop: 4,
      display: 'inline-block',
    }}>
      {text}
    </div>
  );
}

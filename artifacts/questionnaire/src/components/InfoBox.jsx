import { C } from '../constants/colors.js';

export default function InfoBox({ children, color, border }) {
  return (
    <div style={{
      background: color || C.slatePale,
      border: `1px solid ${border || C.slateL}`,
      borderRadius: 6,
      padding: '12px 16px',
      marginBottom: 16,
      fontFamily: C.fontBody,
      fontSize: 13,
      color: C.text,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

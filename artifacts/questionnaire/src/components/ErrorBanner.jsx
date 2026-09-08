import { C } from '../constants/colors.js';

export default function ErrorBanner({ errors }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div style={{
      background: '#fff0f0',
      border: `1px solid ${C.red}`,
      borderRadius: 6,
      padding: '12px 16px',
      marginBottom: 16,
      fontFamily: C.fontBody,
    }}>
      <div style={{ fontWeight: 700, color: C.red, fontSize: C.sizeSm, marginBottom: 6 }}>
        ⚠ Please complete the following required fields before continuing:
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {errors.map((e, i) => (
          <li key={i} style={{ fontSize: C.sizeSm, color: C.red, marginBottom: 2 }}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { C } from '../constants/colors.js';

let _addToast = null;

export function toast(message, type = 'success') {
  if (_addToast) _addToast({ message, type, id: Date.now() });
}
toast.success = (msg) => toast(msg, 'success');
toast.warning = (msg) => toast(msg, 'warning');
toast.error   = (msg) => toast(msg, 'error');

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    setToasts(prev => [...prev, t]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, 4500);
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 340, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 16px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontFamily: C.fontBody,
          fontSize: 13,
          fontWeight: 600,
          color: C.white,
          background:
            t.type === 'success' ? C.green :
            t.type === 'warning' ? C.warm :
            C.red,
          pointerEvents: 'auto',
          animation: 'slideInRight 0.2s ease',
        }}>
          {t.type === 'success' ? '✓ ' : t.type === 'warning' ? '⚠ ' : '✕ '}
          {t.message}
        </div>
      ))}
      <style>{`@keyframes slideInRight { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}

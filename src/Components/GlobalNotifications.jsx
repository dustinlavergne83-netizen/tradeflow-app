import { useState, useEffect, useRef } from 'react';
import { _subscribe } from '../lib/notify';

const STYLES = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✅', color: '#166534' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '❌', color: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '⚠️', color: '#92400e' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ️',  color: '#1e40af' },
};

export default function GlobalNotifications() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { kind:'confirm'|'prompt', message, resolve, defaultValue? }
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    return _subscribe(event => {
      if (event.kind === 'toast') {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message: event.message, type: event.type || 'info' }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
      } else {
        setDialog(event);
        if (event.kind === 'prompt') setPromptValue(event.defaultValue || '');
      }
    });
  }, []);

  // Auto-focus prompt input
  useEffect(() => {
    if (dialog?.kind === 'prompt' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialog]);

  function resolveDialog(result) {
    dialog?.resolve(result);
    setDialog(null);
    setPromptValue('');
  }

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <>
      {/* ── Toast stack (top-right) ──────────────────────────────────── */}
      <div style={{ position:'fixed', top:20, right:20, zIndex:99999, display:'flex', flexDirection:'column', gap:10, maxWidth:400, width:'calc(100vw - 40px)', pointerEvents:'none' }}>
        {toasts.map(t => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div key={t.id} style={{ background:s.bg, border:`2px solid ${s.border}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:10, boxShadow:'0 4px 24px rgba(0,0,0,0.18)', animation:'tfSlideIn 0.25s ease', pointerEvents:'auto' }}>
              <span style={{ fontSize:18, flexShrink:0, lineHeight:1 }}>{s.icon}</span>
              <p style={{ margin:0, fontSize:14, fontWeight:600, color:s.color, lineHeight:1.55, flex:1 }}>{t.message}</p>
              <button onClick={() => dismissToast(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:s.color, fontSize:20, padding:0, lineHeight:1, flexShrink:0, opacity:0.6 }}>×</button>
            </div>
          );
        })}
      </div>

      {/* ── Confirm / Prompt modal overlay ───────────────────────────── */}
      {dialog && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99998, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px 32px', maxWidth:440, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
            <p style={{ margin:'0 0 20px', fontSize:16, fontWeight:700, color:'#111', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {dialog.message}
            </p>

            {dialog.kind === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') resolveDialog(promptValue);
                  if (e.key === 'Escape') resolveDialog(null);
                }}
                style={{ width:'100%', padding:'10px 14px', fontSize:15, border:'2px solid #d1d5db', borderRadius:8, boxSizing:'border-box', marginBottom:20, outline:'none' }}
              />
            )}

            <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
              <button
                onClick={() => resolveDialog(dialog.kind === 'prompt' ? null : false)}
                style={{ padding:'10px 24px', border:'2px solid #d1d5db', background:'#fff', color:'#374151', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700 }}
              >
                Cancel
              </button>
              <button
                onClick={() => resolveDialog(dialog.kind === 'prompt' ? promptValue : true)}
                style={{ padding:'10px 28px', border:'none', background:'#0b3ea8', color:'#fff', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tfSlideIn {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

/**
 * PayrollUpload — Manual pay stub uploader + SmartVault setup guide
 *
 * Lets you drag-and-drop PDF pay stubs from SmartVault (or anywhere)
 * directly into TradeFlow.  Also shows the Zapier / Make webhook URL
 * so the CPA's SmartVault can auto-send stubs without you lifting a finger.
 */
import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_URL   = `${SUPABASE_URL}/functions/v1/smartvault-upload`;

export default function PayrollUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [files, setFiles]               = useState([]);  // { file, status, result }
  const [dragging, setDragging]         = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [activeTab, setActiveTab]       = useState('upload'); // 'upload' | 'zapier' | 'make'

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    addFiles(dropped);
  }, []);

  const addFiles = (newFiles) => {
    const entries = newFiles.map((f) => ({ file: f, status: 'pending', result: null }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const onFileSelect = (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // ── Convert File → base64 ───────────────────────────────────────────────
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ── Upload all pending files ─────────────────────────────────────────────
  const handleUploadAll = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;
    setProcessing(true);

    const { data: { session } } = await supabase.auth.getSession();

    for (const entry of pending) {
      setFiles((prev) =>
        prev.map((f) => f.file === entry.file ? { ...f, status: 'uploading' } : f)
      );
      try {
        const contentBase64 = await toBase64(entry.file);
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': SUPABASE_ANON,
          },
          body: JSON.stringify({
            source: 'manual-upload',
            filename: entry.file.name,
            contentBase64,
            contentType: 'application/pdf',
            from: session?.user?.email || 'manual-upload',
            subject: `Pay Stub Manual Upload: ${entry.file.name}`,
          }),
        });
        const result = await res.json();
        setFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file
              ? { ...f, status: res.ok ? 'done' : 'error', result }
              : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file
              ? { ...f, status: 'error', result: { error: err.message } }
              : f
          )
        );
      }
    }
    setProcessing(false);
  };

  const clearDone = () => setFiles((prev) => prev.filter((f) => f.status !== 'done'));
  const removeFile = (file) => setFiles((prev) => prev.filter((f) => f.file !== file));

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyApiKey = async () => {
    // The user needs to set a secret in Supabase — show placeholder text
    await navigator.clipboard.writeText('YOUR_SMARTVAULT_WEBHOOK_SECRET');
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2500);
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const s = {
    page:      { padding: '20px 24px', maxWidth: 900, margin: '0 auto' },
    title:     { color: '#f97316', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
    subtitle:  { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
    tabs:      { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #1e293b' },
    tab:       (active) => ({ padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, borderRadius: '6px 6px 0 0', marginBottom: -2, backgroundColor: active ? '#f97316' : 'transparent', color: active ? '#fff' : '#94a3b8', borderBottom: active ? '2px solid #f97316' : '2px solid transparent' }),
    card:      { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 20 },
    dropzone:  (drag) => ({ border: `2px dashed ${drag ? '#f97316' : '#475569'}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: drag ? 'rgba(249,115,22,0.08)' : 'rgba(15,23,42,0.4)' }),
    btn:       { padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
    btnOrange: { backgroundColor: '#f97316', color: '#fff' },
    btnBlue:   { backgroundColor: '#3b82f6', color: '#fff' },
    btnGray:   { backgroundColor: '#475569', color: '#fff' },
    btnGreen:  { backgroundColor: '#22c55e', color: '#fff' },
    fileRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 8 },
    code:      { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: '#22c55e', wordBreak: 'break-all' },
    step:      { display: 'flex', gap: 14, marginBottom: 18 },
    stepNum:   { width: 28, height: 28, borderRadius: '50%', backgroundColor: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0, marginTop: 2 },
    stepTxt:   { flex: 1, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 },
    label:     { color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' },
  };

  const statusIcon = (status) => ({ pending: '📄', uploading: '⏳', done: '✅', error: '❌' }[status] || '📄');
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount    = files.filter((f) => f.status === 'done').length;

  return (
    <div style={s.page}>
      <h1 style={s.title}>📤 Pay Stub Upload</h1>
      <p style={s.subtitle}>Upload pay stub PDFs from SmartVault manually, or set up automatic delivery via Zapier / Make.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={{ ...s.btn, ...s.btnGray }} onClick={() => navigate('/payroll-approval')}>💰 Approval Queue</button>
        {doneCount > 0 && <button style={{ ...s.btn, ...s.btnGray, fontSize: 12 }} onClick={clearDone}>Clear Completed</button>}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[['upload', '📁 Manual Upload'], ['zapier', '⚡ Zapier Setup'], ['make', '🔧 Make Setup']].map(([id, label]) => (
          <button key={id} style={s.tab(activeTab === id)} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── MANUAL UPLOAD TAB ── */}
      {activeTab === 'upload' && (
        <>
          <div style={s.card}>
            <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 12 }}>Drag &amp; Drop Pay Stubs</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Download PDFs from SmartVault, then drop them here. AI will extract each employee's wages, taxes, and garnishments and queue them for your approval.
            </p>

            {/* Drop zone */}
            <div
              style={s.dropzone(dragging)}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div style={{ color: dragging ? '#f97316' : '#cbd5e1', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                {dragging ? 'Drop PDFs here!' : 'Drop pay stub PDFs here'}
              </div>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>or click to browse</div>
              <button
                style={{ ...s.btn, ...s.btnBlue }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse Files
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={onFileSelect} />
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ color: '#f8fafc', fontSize: 16, margin: 0 }}>
                  {files.length} file{files.length !== 1 ? 's' : ''} queued
                </h3>
                <button
                  style={{ ...s.btn, ...s.btnGreen, opacity: pendingCount === 0 || processing ? 0.6 : 1 }}
                  onClick={handleUploadAll}
                  disabled={pendingCount === 0 || processing}
                >
                  {processing ? '⏳ Processing…' : `🤖 Process ${pendingCount} Stub${pendingCount !== 1 ? 's' : ''} with AI`}
                </button>
              </div>

              {files.map((entry, i) => (
                <div key={i} style={s.fileRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{statusIcon(entry.status)}</span>
                    <div>
                      <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{entry.file.name}</div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>{(entry.file.size / 1024).toFixed(1)} KB</div>
                      {entry.result && (
                        <div style={{ fontSize: 11, color: entry.status === 'done' ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                          {entry.result.message || entry.result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {entry.status === 'pending' && (
                    <button onClick={() => removeFile(entry.file)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  )}
                  {entry.status === 'done' && (
                    <button style={{ ...s.btn, ...s.btnBlue, fontSize: 11, padding: '4px 12px' }} onClick={() => navigate('/payroll-approval')}>Review →</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ZAPIER SETUP TAB ── */}
      {activeTab === 'zapier' && (
        <div style={s.card}>
          <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>⚡ Auto-Import via Zapier</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
            When your CPA uploads a pay stub to SmartVault, Zapier automatically sends it to TradeFlow for AI processing — no manual steps needed.
          </p>

          <div style={{ marginBottom: 24 }}>
            <span style={s.label}>Your Webhook URL (paste this into Zapier)</span>
            <div style={s.code}>{WEBHOOK_URL}</div>
            <button style={{ ...s.btn, ...s.btnBlue, marginTop: 8, fontSize: 12 }} onClick={copyUrl}>
              {copied ? '✅ Copied!' : '📋 Copy URL'}
            </button>
          </div>

          <h3 style={{ color: '#f97316', fontSize: 15, marginBottom: 16 }}>Setup Steps</h3>

          {[
            ['Create a free Zapier account', 'Go to zapier.com → Create Account (the free plan supports this Zap).'],
            ['Create a new Zap', 'Click "Create" → "Zaps" → "+ Create Zap".'],
            ['Set Trigger: SmartVault → New File', 'Search for "SmartVault" as the trigger app. Select "New File" or "New Document". Connect your SmartVault account and select the vault/folder your CPA uploads to (e.g., "Payroll / 2026").'],
            ['Set Action: Webhooks by Zapier → POST', 'Search for "Webhooks by Zapier" as the action app. Select "POST". ⚠️ This requires Zapier Professional ($19/mo). Alternative: use Make.com (free).'],
            ['Configure the POST', `URL: paste the webhook URL above.\nPayload Type: json\nData:\n  file_name → (map from SmartVault: File Name)\n  file_content → (map from SmartVault: File Content / Base64)\n  uploaded_by → your CPA's email`],
            ['Test & Activate', 'Click "Test" to send a sample file. Check the Payroll Approval queue in TradeFlow. Turn on the Zap.'],
          ].map(([title, desc], i) => (
            <div key={i} style={s.step}>
              <div style={s.stepNum}>{i + 1}</div>
              <div style={s.stepTxt}>
                <strong style={{ color: '#f8fafc' }}>{title}</strong><br />
                <span style={{ whiteSpace: 'pre-wrap' }}>{desc}</span>
              </div>
            </div>
          ))}

          <div style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid #ca8a04', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
            <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>💡 Zapier Costs Money for Webhooks</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Zapier's "Webhooks by Zapier" action requires a Professional plan (~$19/mo). 
              The <strong style={{ color: '#f8fafc' }}>Make (Integromat)</strong> tab shows how to do the same thing for free.
            </div>
          </div>
        </div>
      )}

      {/* ── MAKE SETUP TAB ── */}
      {activeTab === 'make' && (
        <div style={s.card}>
          <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>🔧 Auto-Import via Make (Free)</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
            Make.com (formerly Integromat) lets you watch SmartVault for new files and POST them to TradeFlow for free.
          </p>

          <div style={{ marginBottom: 24 }}>
            <span style={s.label}>Your Webhook URL</span>
            <div style={s.code}>{WEBHOOK_URL}</div>
            <button style={{ ...s.btn, ...s.btnBlue, marginTop: 8, fontSize: 12 }} onClick={copyUrl}>
              {copied ? '✅ Copied!' : '📋 Copy URL'}
            </button>
          </div>

          <h3 style={{ color: '#f97316', fontSize: 15, marginBottom: 16 }}>Setup Steps</h3>

          {[
            ['Create a free Make account', 'Go to make.com → Sign Up (free plan includes 1,000 operations/month — more than enough for payroll runs).'],
            ['Create a new Scenario', 'Click "Create a new scenario". In the module search, type "SmartVault" and add the "Watch New Files" trigger. Connect your SmartVault account and select the payroll folder.'],
            ['Add an HTTP module', 'Click the + to add a module. Search "HTTP" → "Make a Request".\n  URL: paste the webhook URL above\n  Method: POST\n  Body type: Raw\n  Content type: application/json'],
            ['Map the file data', `In the request body, enter:\n{\n  "file_name": "{{1.name}}",\n  "file_url": "{{1.downloadUrl}}",\n  "uploaded_by": "cc@sass.tax"\n}\n\nMake will auto-download the file from the URL.`],
            ['Set the schedule', 'Click the clock icon on the trigger → set to run every 15 or 60 minutes (or "Immediately" if on a paid plan).'],
            ['Run once to test', 'Click "Run once" → upload a test PDF to your SmartVault folder → check TradeFlow\'s Payroll Approval queue.'],
            ['Activate the scenario', 'Toggle the scenario ON. From now on, every time your CPA uploads a pay stub, it will automatically appear in your approval queue.'],
          ].map(([title, desc], i) => (
            <div key={i} style={s.step}>
              <div style={s.stepNum}>{i + 1}</div>
              <div style={s.stepTxt}>
                <strong style={{ color: '#f8fafc' }}>{title}</strong><br />
                <span style={{ whiteSpace: 'pre-wrap' }}>{desc}</span>
              </div>
            </div>
          ))}

          <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
            <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>✅ Make is the Recommended Option</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Completely free for your usage level. No credit card required. 
              Once set up (about 20 minutes), pay stubs flow from SmartVault → TradeFlow automatically with zero manual steps.
            </div>
          </div>

          <div style={{ marginTop: 20, backgroundColor: '#0f172a', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ color: '#f97316', fontWeight: 700, marginBottom: 8 }}>🔒 Optional: Secure the Webhook</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              To prevent unauthorized uploads, set a secret in Supabase and send it as an <code style={{ color: '#22c55e' }}>x-api-key</code> header in Make:
            </div>
            <ol style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
              <li>Go to <strong>Supabase Dashboard → Edge Functions → Secrets</strong></li>
              <li>Add secret: <code style={{ color: '#22c55e' }}>SMARTVAULT_WEBHOOK_SECRET</code> = any random string (e.g. <code style={{ color: '#22c55e' }}>sv_dml_2026_secure</code>)</li>
              <li>In Make's HTTP module → Headers → add: <code style={{ color: '#22c55e' }}>x-api-key: sv_dml_2026_secure</code></li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

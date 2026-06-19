/**
 * EmailInbox — Microsoft Graph email reader
 *
 * Auth: Direct OAuth 2.0 Authorization Code + PKCE (NO MSAL LIBRARY)
 * MSAL was removed because it throws "block_nested_popups" in certain
 * browser/context combinations regardless of config. Direct PKCE is
 * simpler, has zero internal popup detection, and works everywhere.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Microsoft OAuth 2.0 PKCE — no external library required
// ─────────────────────────────────────────────────────────────────────────────
const MS_TENANT    = '9bd3d089-ecc6-4777-9198-41f0d40f95d6';
const MS_CLIENT    = '1101ddc0-5dc1-4275-beb6-34b2ef897452';
const REDIRECT_URI = window.location.origin + '/email-inbox';
const SCOPES       = 'Mail.Read Mail.ReadBasic offline_access';
const AUTH_URL     = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL    = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

const TOKEN_KEY    = 'ms_graph_token_v3';   // localStorage key for token cache
const VERIFIER_KEY = 'ms_pkce_verifier';    // sessionStorage key
const STATE_KEY    = 'ms_oauth_state';      // sessionStorage key

// Crypto helpers
function randomString(len = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

async function pkceChallenge(verifier) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Redirect user to Microsoft login page
async function startSignIn() {
  const verifier  = randomString(64);
  const state     = randomString(32);
  const challenge = await pkceChallenge(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id:             MS_CLIENT,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    response_mode:         'fragment',   // code comes back in URL hash
    state,
    prompt:                'select_account',
  });

  window.location.href = `${AUTH_URL}?${params}`;
}

// Exchange auth code → access_token + refresh_token
async function exchangeCode(code, returnedState) {
  const storedState = sessionStorage.getItem(STATE_KEY);
  const verifier    = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  // State check (skip if we didn't store one — older redirect)
  if (storedState && returnedState && returnedState !== storedState) {
    throw new Error('OAuth state mismatch — please try signing in again.');
  }
  if (!verifier) {
    throw new Error('PKCE verifier not found — session may have expired. Please try again.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     MS_CLIENT,
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || `Token exchange failed (HTTP ${res.status})`);
  }

  const t = await res.json();
  const tokenData = {
    access_token:  t.access_token,
    refresh_token: t.refresh_token,
    expires_at:    Date.now() + t.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

  // Remove the auth code from the URL so refreshing doesn't re-trigger
  window.history.replaceState({}, document.title, '/email-inbox');
  return tokenData.access_token;
}

// Return valid access_token from cache, refreshing silently if needed
async function getValidToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  let td;
  try { td = JSON.parse(raw); } catch { localStorage.removeItem(TOKEN_KEY); return null; }

  // Token still valid (5-minute buffer)
  if (Date.now() < td.expires_at - 300_000) return td.access_token;

  // Expired — try refresh_token
  if (!td.refresh_token) { localStorage.removeItem(TOKEN_KEY); return null; }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     MS_CLIENT,
      refresh_token: td.refresh_token,
      scope:         SCOPES,
    }),
  });

  if (!res.ok) { localStorage.removeItem(TOKEN_KEY); return null; }

  const t = await res.json();
  const newTd = {
    access_token:  t.access_token,
    refresh_token: t.refresh_token || td.refresh_token,
    expires_at:    Date.now() + t.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(newTd));
  return newTd.access_token;
}

function doSignOut() {
  localStorage.removeItem(TOKEN_KEY);
  const logoutUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/logout`
    + `?post_logout_redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.href = logoutUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// CPA detection
// ─────────────────────────────────────────────────────────────────────────────
const CPA_EMAIL = 'cc@sass.tax';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function EmailInbox() {
  const navigate = useNavigate();

  const [emails, setEmails]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [initLoading, setInitLoading]     = useState(true);
  const [signedIn, setSignedIn]           = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [attachments, setAttachments]     = useState([]);
  const [processing, setProcessing]       = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const [batchResult, setBatchResult]     = useState(null);
  const [error, setError]                 = useState(null);

  // ── On mount: handle OAuth callback OR check stored token ────────────────
  useEffect(() => {
    (async () => {
      try {
        // Parse hash OR query string for OAuth callback params
        const fragment = window.location.hash.replace(/^#/, '');
        const search   = window.location.search.replace(/^\?/, '');
        const params   = new URLSearchParams(fragment || search);

        const code        = params.get('code');
        const state       = params.get('state');
        const errorParam  = params.get('error');
        const errorDesc   = params.get('error_description');

        if (errorParam) {
          setError('Microsoft sign-in error: ' + (errorDesc || errorParam).replace(/\+/g, ' '));
          window.history.replaceState({}, document.title, '/email-inbox');
          return;
        }

        if (code) {
          // Complete the PKCE exchange
          await exchangeCode(code, state || '');
          setSignedIn(true);
          return;
        }

        // No callback — check if we have a stored (possibly refreshable) token
        const token = await getValidToken();
        if (token) setSignedIn(true);

      } catch (err) {
        console.error('Auth init error:', err.message);
        setError(err.message);
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  // ── Load emails once authenticated ──────────────────────────────────────
  useEffect(() => {
    if (signedIn && !initLoading) loadEmails();
  }, [signedIn, initLoading]);

  // ── Microsoft Graph fetch helper ─────────────────────────────────────────
  const graphFetch = useCallback(async (url) => {
    const token = await getValidToken();
    if (!token) {
      setSignedIn(false);
      setError('Session expired — please sign in again.');
      return null;
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      setSignedIn(false);
      setError('Session expired — please sign in again.');
      return null;
    }
    if (!res.ok) throw new Error(`Graph API error ${res.status}: ${res.statusText}`);
    return res.json();
  }, []);

  // ── Sign In button handler ───────────────────────────────────────────────
  const handleSignIn = async () => {
    try {
      setError(null);
      await startSignIn(); // Page navigates away — no popup, no MSAL
    } catch (err) {
      setError('Failed to start sign-in: ' + err.message);
    }
  };

  // ── Load Emails ──────────────────────────────────────────────────────────
  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await graphFetch(
        'https://graph.microsoft.com/v1.0/me/messages'
        + '?$top=50&$orderby=receivedDateTime desc'
        + '&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead'
      );
      if (data) setEmails(data.value || []);
    } catch (err) {
      setError('Failed to load emails: ' + err.message);
    }
    setLoading(false);
  }, [graphFetch]);

  // ── CPA / payroll email detection ────────────────────────────────────────
  const isPayrollEmail = (email) => {
    const from    = email.from?.emailAddress?.address?.toLowerCase() || '';
    const subject = email.subject?.toLowerCase() || '';
    return (
      from === CPA_EMAIL.toLowerCase() ||
      subject.includes('pay stub') ||
      subject.includes('paystub') ||
      subject.includes('payroll') ||
      subject.includes('check stub')
    );
  };
  const payrollEmails = emails.filter(isPayrollEmail);

  // ── Select email + load attachments ─────────────────────────────────────
  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    setAttachments([]);
    setProcessResult(null);
    setBatchResult(null);
    if (email.hasAttachments) {
      try {
        const data = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/messages/${email.id}/attachments`
        );
        if (data) setAttachments(data.value || []);
      } catch (err) {
        setError('Failed to load attachments: ' + err.message);
      }
    }
  };

  // ── Process a single PDF stub ────────────────────────────────────────────
  const handleProcessPayStub = async (attachment) => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-check-stub-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            source: 'email-inbox',
            filename: attachment.name,
            contentBase64: attachment.contentBytes,
            contentType: attachment.contentType,
            from: selectedEmail.from?.emailAddress?.address || 'unknown',
            subject: selectedEmail.subject || '',
          }),
        }
      );
      const result = await res.json();
      setProcessResult({
        success: res.ok,
        message: res.ok
          ? (result.message || `✅ Processed! ${result.processed} stub(s) queued for approval.`)
          : (result.error || 'Processing failed'),
      });
    } catch (err) {
      setProcessResult({ success: false, message: err.message });
    }
    setProcessing(false);
  };

  // ── Batch process all PDFs in selected email ─────────────────────────────
  const handleBatchProcessAll = async () => {
    const pdfs = attachments.filter(
      (a) => a.contentType === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length === 0) {
      setBatchResult({ success: false, message: 'No PDF attachments found in this email.' });
      return;
    }

    setBatchProcessing(true);
    setBatchResult(null);
    setProcessResult(null);

    const ok = [], fail = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();

      for (const att of pdfs) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-check-stub-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                source: 'email-inbox-batch',
                filename: att.name,
                contentBase64: att.contentBytes,
                contentType: att.contentType,
                from: selectedEmail.from?.emailAddress?.address || 'unknown',
                subject: selectedEmail.subject || '',
              }),
            }
          );
          const result = await res.json();
          res.ok ? ok.push(att.name) : fail.push({ name: att.name, reason: result.error || 'error' });
        } catch (err) {
          fail.push({ name: att.name, reason: err.message });
        }
      }

      const msg = [
        ok.length   ? `✅ ${ok.length} stub(s) processed and queued for your approval.` : '',
        fail.length ? `❌ ${fail.length} failed: ${fail.map((f) => f.name).join(', ')}` : '',
      ].filter(Boolean).join('\n');

      setBatchResult({ success: fail.length === 0, message: msg });
    } catch (err) {
      setBatchResult({ success: false, message: 'Batch failed: ' + err.message });
    }
    setBatchProcessing(false);
  };

  // ── Download attachment ──────────────────────────────────────────────────
  const handleDownload = (att) => {
    const bytes = Uint8Array.from(atob(att.contentBytes), (c) => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: att.contentType });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const s = {
    page:     { padding: 20, minHeight: 400 },
    title:    { color: '#f97316', fontSize: 26, fontWeight: 'bold', marginBottom: 16 },
    btn:      { padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    btnOrange: { backgroundColor: '#f97316', color: '#fff' },
    btnBlue:  { backgroundColor: '#3b82f6', color: '#fff' },
    btnGreen: { backgroundColor: '#22c55e', color: '#fff' },
    btnPurple: { backgroundColor: '#7c3aed', color: '#fff' },
    btnGray:  { backgroundColor: '#475569', color: '#fff' },
    box:      { backgroundColor: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 500, margin: '0 auto' },
    split:    { display: 'flex', gap: 16, height: 'calc(100vh - 220px)', minHeight: 400 },
    list:     { width: 380, minWidth: 280, overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: 10 },
    detail:   { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 20, overflowY: 'auto' },
    item:     { padding: '10px 14px', borderBottom: '1px solid #334155', cursor: 'pointer' },
    itemActive: { backgroundColor: '#334155' },
    unread:   { borderLeft: '3px solid #f97316' },
    payrollItem: { borderLeft: '3px solid #22c55e', backgroundColor: 'rgba(34,197,94,0.05)' },
    attCard:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 8 },
    error:    { backgroundColor: '#dc2626', color: '#fff', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
    success:  { backgroundColor: '#22c55e', color: '#fff', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
    badge:    { display: 'inline-block', padding: '2px 6px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', marginLeft: 6 },
    payrollBanner: {
      backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e',
      borderRadius: 10, padding: '12px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    },
  };

  // ── Initialising ─────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>📧 Email Inbox</h1>
        <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>
          ⏳ {window.location.hash.includes('code=') || window.location.search.includes('code=')
            ? 'Completing Microsoft sign-in…'
            : 'Checking authentication…'}
        </div>
      </div>
    );
  }

  // ── Sign-in screen ───────────────────────────────────────────────────────
  if (!signedIn) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>📧 Email Inbox</h1>
        {error && (
          <div style={{ ...s.error, maxWidth: 500, margin: '0 auto 16px' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8 }}>✕</button>
          </div>
        )}
        <div style={s.box}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
          <h2 style={{ color: '#f8fafc', marginBottom: 8 }}>Connect Your Outlook</h2>
          <p style={{ color: '#94a3b8', marginBottom: 8 }}>
            Sign in with your Microsoft account (dustin@dmlelectrical.com) to view emails here.
          </p>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 24 }}>
            📌 Emails from <strong style={{ color: '#22c55e' }}>cc@sass.tax</strong> (your CPA) will be automatically flagged for payroll processing.
          </p>
          <button
            style={{ ...s.btn, ...s.btnOrange, fontSize: 16, padding: '14px 32px' }}
            onClick={handleSignIn}
          >
            🔑 Sign In with Microsoft
          </button>
        </div>
      </div>
    );
  }

  // ── Main inbox view ──────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={s.title}>📧 Email Inbox</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btn, ...s.btnPurple }} onClick={() => navigate('/payroll-approval')}>
            💰 Payroll Queue
          </button>
          <button style={{ ...s.btn, ...s.btnBlue }} onClick={loadEmails} disabled={loading}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          <button style={{ ...s.btn, ...s.btnGray }} onClick={doSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div style={s.error}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8 }}>✕</button>
        </div>
      )}

      {/* ── CPA Payroll Banner ── */}
      {payrollEmails.length > 0 && (
        <div style={s.payrollBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🧾</span>
            <div>
              <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 15 }}>
                {payrollEmails.length} Payroll Email{payrollEmails.length !== 1 ? 's' : ''} from Your CPA
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                Select one below and click "Process All Pay Stubs" — AI will separate and queue them for your approval.
              </div>
            </div>
          </div>
          <button
            style={{ ...s.btn, ...s.btnGreen, fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
            onClick={() => navigate('/payroll-approval')}
          >
            💰 Review Approval Queue
          </button>
        </div>
      )}

      <div style={s.split}>
        {/* ── Email List ── */}
        <div style={s.list}>
          {loading && <p style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>⏳ Loading emails…</p>}
          {!loading && emails.length === 0 && (
            <p style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>No emails found</p>
          )}
          {emails.map((email) => {
            const isPayroll = isPayrollEmail(email);
            return (
              <div
                key={email.id}
                style={{
                  ...s.item,
                  ...(selectedEmail?.id === email.id ? s.itemActive : {}),
                  ...(!email.isRead ? s.unread : {}),
                  ...(isPayroll ? s.payrollItem : {}),
                }}
                onClick={() => handleSelectEmail(email)}
              >
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#f8fafc' }}>
                  {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown'}
                  {email.hasAttachments && (
                    <span style={{ ...s.badge, backgroundColor: '#6366f1', color: '#fff' }}>📎</span>
                  )}
                  {isPayroll && (
                    <span style={{ ...s.badge, backgroundColor: '#22c55e', color: '#fff' }}>🧾 Payroll</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>{email.subject || '(no subject)'}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {new Date(email.receivedDateTime).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.bodyPreview}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Detail Pane ── */}
        <div style={s.detail}>
          {!selectedEmail ? (
            <div style={{ textAlign: 'center', color: '#64748b', paddingTop: 80 }}>
              <div style={{ fontSize: 48 }}>📨</div>
              <p>Select an email to view details</p>
              {payrollEmails.length > 0 && (
                <p style={{ color: '#22c55e', fontSize: 13 }}>
                  👆 Green-highlighted emails are from your CPA (cc@sass.tax)
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>
                {selectedEmail.subject || '(no subject)'}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
                <strong>From:</strong> {selectedEmail.from?.emailAddress?.name}{' '}
                &lt;{selectedEmail.from?.emailAddress?.address}&gt;
                {isPayrollEmail(selectedEmail) && (
                  <span style={{ ...s.badge, backgroundColor: '#22c55e', color: '#fff', marginLeft: 8 }}>
                    🧾 CPA / Payroll
                  </span>
                )}
              </p>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 14 }}>
                {new Date(selectedEmail.receivedDateTime).toLocaleString()}
              </p>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
                {selectedEmail.bodyPreview}
              </div>

              {/* Batch process banner for payroll emails */}
              {isPayrollEmail(selectedEmail) && attachments.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
                  borderRadius: 8, padding: '14px 16px', marginBottom: 16,
                }}>
                  <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
                    🧾 Payroll Email Detected — from cc@sass.tax
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px 0' }}>
                    AI will read all{' '}
                    {attachments.filter((a) => a.contentType === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf')).length}{' '}
                    PDF stub(s), extract wages/taxes/garnishments, save to each employee's folder, and queue for your approval.
                  </p>
                  <button
                    style={{ ...s.btn, ...s.btnGreen, width: '100%' }}
                    onClick={handleBatchProcessAll}
                    disabled={batchProcessing}
                  >
                    {batchProcessing
                      ? '⏳ Processing all stubs…'
                      : `🤖 Process All ${attachments.filter((a) => a.contentType === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf')).length} Pay Stubs with AI`}
                  </button>
                  {batchResult && (
                    <div style={{ ...(batchResult.success ? s.success : s.error), marginTop: 10, whiteSpace: 'pre-wrap' }}>
                      {batchResult.success ? '✅ ' : '❌ '}{batchResult.message}
                      {batchResult.success && (
                        <button
                          style={{ ...s.btn, backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 14px', fontSize: 12, marginLeft: 12 }}
                          onClick={() => navigate('/payroll-approval')}
                        >
                          Review &amp; Approve →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Attachments list */}
              {attachments.length > 0 && (
                <>
                  <h3 style={{ color: '#f97316', marginBottom: 10, fontSize: 15 }}>📎 Attachments</h3>
                  {attachments.map((att, i) => {
                    const isPdf = att.contentType === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={i} style={s.attCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{isPdf ? '📄' : '📁'}</span>
                          <div>
                            <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 'bold' }}>{att.name}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>
                              {(att.size / 1024).toFixed(1)} KB
                              {isPdf && <span style={{ ...s.badge, backgroundColor: '#dc2626', color: '#fff' }}>PDF</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{ ...s.btn, ...s.btnBlue, fontSize: 12, padding: '6px 12px' }}
                            onClick={() => handleDownload(att)}
                          >
                            ⬇ Download
                          </button>
                          {isPdf && (
                            <button
                              style={{ ...s.btn, ...s.btnGreen, fontSize: 12, padding: '6px 12px' }}
                              onClick={() => handleProcessPayStub(att)}
                              disabled={processing}
                            >
                              {processing ? '⏳' : '🧾 Process This Stub'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {processResult && (
                <div style={{ ...(processResult.success ? s.success : s.error), marginTop: 8 }}>
                  {processResult.success ? '✅ ' : '❌ '}{processResult.message}
                  {processResult.success && (
                    <button
                      style={{ ...s.btn, backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 14px', fontSize: 12, marginLeft: 12 }}
                      onClick={() => navigate('/payroll-approval')}
                    >
                      Review &amp; Approve →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

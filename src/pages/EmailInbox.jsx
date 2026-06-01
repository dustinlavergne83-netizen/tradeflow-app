import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { supabase } from '../lib/supabase';

const MSAL_CONFIG = {
  auth: {
    clientId: '1101ddc0-5dc1-4275-beb6-34b2ef897452',
    authority: 'https://login.microsoftonline.com/9bd3d089-ecc6-4777-9198-41f0d40f95d6',
    redirectUri: window.location.origin + '/email-inbox',
  },
  cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
};

const LOGIN_REQUEST = { scopes: ['Mail.Read', 'Mail.ReadBasic'] };

// ── Component ────────────────────────────────────────────────────────
export default function EmailInbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msalLoading, setMsalLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const [error, setError] = useState(null);
  const msalRef = useRef(null);

  // ── Initialize MSAL inside useEffect ────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Clear any stale MSAL locks from sessionStorage
        Object.keys(sessionStorage).forEach((key) => {
          if (key.includes('msal') || key.includes('login.windows')) {
            sessionStorage.removeItem(key);
          }
        });

        const instance = new PublicClientApplication(MSAL_CONFIG);
        await instance.initialize();
        
        // Handle any pending redirect response
        try {
          await instance.handleRedirectPromise();
        } catch (e) {
          console.warn('MSAL redirect promise error (non-fatal):', e.message);
        }

        msalRef.current = instance;

        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          setSignedIn(true);
        }
      } catch (err) {
        console.error('MSAL init error:', err);
        setError('Microsoft auth initialization failed: ' + err.message);
      } finally {
        setMsalLoading(false);
      }
    };
    init();
  }, []);

  // ── Load emails when signed in ───────────────────────────────────
  useEffect(() => {
    if (signedIn && !msalLoading) loadEmails();
  }, [signedIn, msalLoading]);

  // ── Get access token ─────────────────────────────────────────────
  const getAccessToken = useCallback(async () => {
    const instance = msalRef.current;
    if (!instance) throw new Error('MSAL not initialized');
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const resp = await instance.acquireTokenSilent({ ...LOGIN_REQUEST, account: accounts[0] });
        return resp.accessToken;
      } catch {
        const resp = await instance.acquireTokenPopup(LOGIN_REQUEST);
        return resp.accessToken;
      }
    }
    const resp = await instance.loginPopup(LOGIN_REQUEST);
    return resp.accessToken;
  }, []);

  // ── Graph API helper ─────────────────────────────────────────────
  const graphFetch = useCallback(async (url) => {
    const token = await getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${res.statusText}`);
    return res.json();
  }, [getAccessToken]);

  // ── Sign In ──────────────────────────────────────────────────────
  const handleSignIn = async () => {
    const instance = msalRef.current;
    if (!instance) { setError('MSAL not ready. Please refresh the page.'); return; }
    try {
      setError(null);
      await instance.loginPopup(LOGIN_REQUEST);
      setSignedIn(true);
    } catch (err) {
      setError('Sign in failed: ' + err.message);
    }
  };

  // ── Load Emails ──────────────────────────────────────────────────
  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await graphFetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead'
      );
      setEmails(data.value || []);
    } catch (err) {
      setError('Failed to load emails: ' + err.message);
    }
    setLoading(false);
  }, [graphFetch]);

  // ── Select Email + Load Attachments ──────────────────────────────
  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    setAttachments([]);
    setProcessResult(null);
    if (email.hasAttachments) {
      try {
        const data = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/messages/${email.id}/attachments`
        );
        setAttachments(data.value || []);
      } catch (err) {
        setError('Failed to load attachments: ' + err.message);
      }
    }
  };

  // ── Process Pay Stub PDF ─────────────────────────────────────────
  const handleProcessPayStub = async (attachment) => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        'https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/process-check-stub-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
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
      if (res.ok) {
        setProcessResult({ success: true, message: result.message || 'Pay stubs processed successfully!' });
      } else {
        setProcessResult({ success: false, message: result.error || 'Processing failed' });
      }
    } catch (err) {
      setProcessResult({ success: false, message: err.message });
    }
    setProcessing(false);
  };

  // ── Download attachment ──────────────────────────────────────────
  const handleDownload = (attachment) => {
    const byteCharacters = atob(attachment.contentBytes);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Styles ───────────────────────────────────────────────────────
  const s = {
    page: { padding: 20, minHeight: 400 },
    title: { color: '#f97316', fontSize: 26, fontWeight: 'bold', marginBottom: 16 },
    btn: { padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    btnOrange: { backgroundColor: '#f97316', color: '#fff' },
    btnBlue: { backgroundColor: '#3b82f6', color: '#fff' },
    btnGreen: { backgroundColor: '#22c55e', color: '#fff' },
    btnGray: { backgroundColor: '#475569', color: '#fff' },
    box: { backgroundColor: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 500, margin: '0 auto' },
    split: { display: 'flex', gap: 16, height: 'calc(100vh - 220px)', minHeight: 400 },
    list: { width: 380, minWidth: 280, overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: 10 },
    detail: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 20, overflowY: 'auto' },
    item: { padding: '10px 14px', borderBottom: '1px solid #334155', cursor: 'pointer' },
    itemActive: { backgroundColor: '#334155' },
    unread: { borderLeft: '3px solid #f97316' },
    attCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 8 },
    error: { backgroundColor: '#dc2626', color: '#fff', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
    success: { backgroundColor: '#22c55e', color: '#fff', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
    badge: { display: 'inline-block', padding: '2px 6px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', marginLeft: 6 },
  };

  // ── Loading state ────────────────────────────────────────────────
  if (msalLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>📧 Email Inbox</h1>
        <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>
          ⏳ Initializing Microsoft authentication...
        </div>
      </div>
    );
  }

  // ── Sign in screen ───────────────────────────────────────────────
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
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>
            Sign in with your Microsoft account (dustin@dmlelectrical.com) to view emails here.
          </p>
          <button style={{ ...s.btn, ...s.btnOrange, fontSize: 16, padding: '14px 32px' }} onClick={handleSignIn}>
            🔑 Sign In with Microsoft
          </button>
        </div>
      </div>
    );
  }

  // ── Main inbox view ──────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={s.title}>📧 Email Inbox</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btn, ...s.btnBlue }} onClick={loadEmails} disabled={loading}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          <button style={{ ...s.btn, ...s.btnGray }} onClick={() => {
            msalRef.current?.logoutPopup();
            setSignedIn(false);
            setEmails([]);
            setSelectedEmail(null);
          }}>
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

      <div style={s.split}>
        {/* ── Email List ── */}
        <div style={s.list}>
          {loading && <p style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>⏳ Loading emails...</p>}
          {!loading && emails.length === 0 && (
            <p style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>No emails found</p>
          )}
          {emails.map((email) => (
            <div
              key={email.id}
              style={{
                ...s.item,
                ...(selectedEmail?.id === email.id ? s.itemActive : {}),
                ...(!email.isRead ? s.unread : {}),
              }}
              onClick={() => handleSelectEmail(email)}
            >
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#f8fafc' }}>
                {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown'}
                {email.hasAttachments && <span style={{ ...s.badge, backgroundColor: '#6366f1', color: '#fff' }}>📎</span>}
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>{email.subject || '(no subject)'}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{new Date(email.receivedDateTime).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.bodyPreview}</div>
            </div>
          ))}
        </div>

        {/* ── Detail Pane ── */}
        <div style={s.detail}>
          {!selectedEmail ? (
            <div style={{ textAlign: 'center', color: '#64748b', paddingTop: 80 }}>
              <div style={{ fontSize: 48 }}>📨</div>
              <p>Select an email to view details</p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>{selectedEmail.subject || '(no subject)'}</h2>
              <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
                <strong>From:</strong> {selectedEmail.from?.emailAddress?.name} &lt;{selectedEmail.from?.emailAddress?.address}&gt;
              </p>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 14 }}>{new Date(selectedEmail.receivedDateTime).toLocaleString()}</p>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
                {selectedEmail.bodyPreview}
              </div>
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
                          <button style={{ ...s.btn, ...s.btnBlue, fontSize: 12, padding: '6px 12px' }} onClick={() => handleDownload(att)}>⬇ Download</button>
                          {isPdf && (
                            <button style={{ ...s.btn, ...s.btnGreen, fontSize: 12, padding: '6px 12px' }} onClick={() => handleProcessPayStub(att)} disabled={processing}>
                              {processing ? '⏳' : '🧾 Process Pay Stubs'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {processResult && (
                <div style={processResult.success ? s.success : s.error}>
                  {processResult.success ? '✅ ' : '❌ '}{processResult.message}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

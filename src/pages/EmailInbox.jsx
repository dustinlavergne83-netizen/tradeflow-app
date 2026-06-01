import { useState, useEffect, useCallback } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { supabase } from '../lib/supabase';

// ── MSAL Config ──────────────────────────────────────────────────────
const msalConfig = {
  auth: {
    clientId: '1101ddc0-5dc1-4275-beb6-34b2ef897452',
    authority: 'https://login.microsoftonline.com/9bd3d089-ecc6-4777-9198-41f0d40f95d6',
    redirectUri: window.location.origin + '/email-inbox',
  },
  cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
};

const loginRequest = { scopes: ['Mail.Read', 'Mail.ReadBasic'] };
const msalInstance = new PublicClientApplication(msalConfig);
const msalReady = msalInstance.initialize().then(() => {
  // Handle redirect response if we came back from Microsoft login
  return msalInstance.handleRedirectPromise();
});

// ── Graph API helpers ────────────────────────────────────────────────
async function getAccessToken() {
  await msalReady;
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const resp = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
      return resp.accessToken;
    } catch {
      const resp = await msalInstance.acquireTokenPopup(loginRequest);
      return resp.accessToken;
    }
  }
  const resp = await msalInstance.loginPopup(loginRequest);
  return resp.accessToken;
}

async function graphFetch(url) {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function graphFetchRaw(url) {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph API ${res.status}`);
  return res;
}

// ── Component ────────────────────────────────────────────────────────
export default function EmailInbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const [error, setError] = useState(null);

  // Check if already signed in
  useEffect(() => {
    (async () => {
      await msalReady;
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) setSignedIn(true);
    })();
  }, []);

  // ── Sign In ──────────────────────────────────────────────────────
  const handleSignIn = async () => {
    try {
      setError(null);
      await msalReady;
      await msalInstance.loginPopup(loginRequest);
      setSignedIn(true);
      loadEmails();
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
  }, []);

  useEffect(() => {
    if (signedIn) loadEmails();
  }, [signedIn, loadEmails]);

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
      // attachment.contentBytes is base64-encoded
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

  // ── Render ───────────────────────────────────────────────────────
  const styles = {
    container: { maxWidth: 1200, margin: '0 auto', padding: 20 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { color: '#f97316', fontSize: 28, fontWeight: 'bold', margin: 0 },
    btn: { padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    btnPrimary: { backgroundColor: '#f97316', color: '#fff' },
    btnSuccess: { backgroundColor: '#22c55e', color: '#fff' },
    btnBlue: { backgroundColor: '#3b82f6', color: '#fff' },
    signInBox: { textAlign: 'center', padding: 60, backgroundColor: '#1e293b', borderRadius: 12 },
    splitView: { display: 'flex', gap: 20, height: 'calc(100vh - 200px)' },
    emailList: { flex: '0 0 400px', overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: 12, padding: 0 },
    emailItem: { padding: '12px 16px', borderBottom: '1px solid #334155', cursor: 'pointer', transition: 'background 0.2s' },
    emailItemActive: { backgroundColor: '#334155' },
    emailFrom: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc', marginBottom: 2 },
    emailSubject: { fontSize: 13, color: '#cbd5e1', marginBottom: 2 },
    emailDate: { fontSize: 11, color: '#64748b' },
    emailPreview: { fontSize: 12, color: '#94a3b8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    detailPane: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 24, overflowY: 'auto' },
    attachmentCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 8 },
    attachIcon: { fontSize: 20, marginRight: 10 },
    badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', marginLeft: 8 },
    badgePdf: { backgroundColor: '#dc2626', color: '#fff' },
    unread: { borderLeft: '3px solid #f97316' },
    error: { backgroundColor: '#dc2626', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 16 },
    success: { backgroundColor: '#22c55e', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 16 },
  };

  if (!signedIn) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>📧 Email Inbox</h1>
        <div style={styles.signInBox}>
          <h2 style={{ color: '#f8fafc', marginBottom: 10 }}>Connect Your Outlook</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>
            Sign in with your Microsoft account to view your emails here.
          </p>
          <button style={{ ...styles.btn, ...styles.btnPrimary, fontSize: 16, padding: '14px 32px' }} onClick={handleSignIn}>
            🔑 Sign In with Microsoft
          </button>
          {error && <p style={{ ...styles.error, marginTop: 16 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📧 Email Inbox</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...styles.btn, ...styles.btnBlue }} onClick={loadEmails} disabled={loading}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          <button style={{ ...styles.btn, backgroundColor: '#475569', color: '#fff' }} onClick={async () => {
            await msalReady;
            msalInstance.logoutPopup();
            setSignedIn(false);
            setEmails([]);
            setSelectedEmail(null);
          }}>
            Sign Out
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 10 }}>✕</button></div>}

      <div style={styles.splitView}>
        {/* Email List */}
        <div style={styles.emailList}>
          {emails.length === 0 && !loading && (
            <p style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>No emails found</p>
          )}
          {emails.map((email) => (
            <div
              key={email.id}
              style={{
                ...styles.emailItem,
                ...(selectedEmail?.id === email.id ? styles.emailItemActive : {}),
                ...(!email.isRead ? styles.unread : {}),
              }}
              onClick={() => handleSelectEmail(email)}
            >
              <div style={styles.emailFrom}>
                {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown'}
                {email.hasAttachments && <span style={{ ...styles.badge, backgroundColor: '#6366f1', color: '#fff' }}>📎</span>}
              </div>
              <div style={styles.emailSubject}>{email.subject || '(no subject)'}</div>
              <div style={styles.emailDate}>
                {new Date(email.receivedDateTime).toLocaleString()}
              </div>
              <div style={styles.emailPreview}>{email.bodyPreview}</div>
            </div>
          ))}
        </div>

        {/* Detail Pane */}
        <div style={styles.detailPane}>
          {!selectedEmail ? (
            <div style={{ textAlign: 'center', color: '#64748b', paddingTop: 100 }}>
              <p style={{ fontSize: 48 }}>📨</p>
              <p>Select an email to view details</p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#f8fafc', marginBottom: 4, fontSize: 20 }}>{selectedEmail.subject || '(no subject)'}</h2>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>
                <strong>From:</strong> {selectedEmail.from?.emailAddress?.name} &lt;{selectedEmail.from?.emailAddress?.address}&gt;
              </p>
              <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                {new Date(selectedEmail.receivedDateTime).toLocaleString()}
              </p>

              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
                {selectedEmail.bodyPreview}
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <>
                  <h3 style={{ color: '#f97316', marginBottom: 12, fontSize: 16 }}>📎 Attachments</h3>
                  {attachments.map((att, i) => {
                    const isPdf = att.contentType === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={i} style={styles.attachmentCard}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={styles.attachIcon}>{isPdf ? '📄' : '📁'}</span>
                          <div>
                            <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 'bold' }}>{att.name}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>
                              {(att.size / 1024).toFixed(1)} KB
                              {isPdf && <span style={{ ...styles.badge, ...styles.badgePdf }}>PDF</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ ...styles.btn, ...styles.btnBlue, fontSize: 12, padding: '6px 12px' }} onClick={() => handleDownload(att)}>
                            ⬇ Download
                          </button>
                          {isPdf && (
                            <button
                              style={{ ...styles.btn, ...styles.btnSuccess, fontSize: 12, padding: '6px 12px' }}
                              onClick={() => handleProcessPayStub(att)}
                              disabled={processing}
                            >
                              {processing ? '⏳ Processing...' : '🧾 Process Pay Stubs'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Process Result */}
              {processResult && (
                <div style={processResult.success ? styles.success : styles.error}>
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

import { useState, useEffect, useRef, useCallback } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const BLUE   = "#0b3ea8";
const ORANGE = "#fc6b04";
const GREEN  = "#22c55e";

// ── MSAL (Microsoft Outlook) config ─────────────────────────────────────────
const MSAL_CONFIG = {
  auth: {
    clientId: "1101ddc0-5dc1-4275-beb6-34b2ef897452",
    authority: "https://login.microsoftonline.com/9bd3d089-ecc6-4777-9198-41f0d40f95d6",
    redirectUri: window.location.origin + "/email-inbox",
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};
const EMAIL_SCOPES = { scopes: ["Mail.Read", "Mail.ReadBasic"] };

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatPhone(num = "") {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return num;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const TYPE_ICONS  = { sms: "💬", call: "📞", ai_call: "🤖" };
const TYPE_LABELS = { sms: "Text", call: "Call", ai_call: "AI Call" };

// ── Component ────────────────────────────────────────────────────────────────
export default function Communications() {
  const navigate = useNavigate();

  // ── SMS / call state ──────────────────────────────────────────────────────
  const [companyId, setCompanyId]     = useState(null);
  const [bizPhone, setBizPhone]        = useState(null);
  const [threads, setThreads]          = useState([]);
  const [selected, setSelected]        = useState(null);
  const [messages, setMessages]        = useState([]);
  const [newMsg, setNewMsg]            = useState("");
  const [filter, setFilter]            = useState("all");
  const [search, setSearch]            = useState("");
  const [sending, setSending]          = useState(false);
  const [unreadCount, setUnreadCount]  = useState(0);
  const [showTranscript, setShowTranscript] = useState(null);
  const messagesEndRef = useRef(null);

  // ── Email / MSAL state ────────────────────────────────────────────────────
  const msalRef                           = useRef(null);
  const [msalLoading, setMsalLoading]     = useState(true);
  const [emailSignedIn, setEmailSignedIn] = useState(false);
  const [emails, setEmails]               = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [emailError, setEmailError]       = useState(null);
  const [emailProcessing, setEmailProcessing] = useState(false);
  const [emailProcessResult, setEmailProcessResult] = useState(null);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { init(); initMsal(); }, []);
  useEffect(() => { if (selected) loadThread(selected.contactNumber); }, [selected]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load emails when email tab becomes active and user is signed in
  useEffect(() => {
    if (filter === "email" && emailSignedIn && !msalLoading && emails.length === 0) {
      loadEmails();
    }
  }, [filter, emailSignedIn, msalLoading]);

  // ── SMS / call init ───────────────────────────────────────────────────────
  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      let cid = null;
      try {
        const { data: emp } = await supabase
          .from("employees").select("company_id").eq("user_id", user.id).maybeSingle();
        cid = emp?.company_id || null;
      } catch (_) {}
      if (!cid) cid = user.id;
      setCompanyId(cid);

      try {
        const { data: cfg } = await supabase
          .from("twilio_config").select("phone_number").eq("company_id", cid).maybeSingle();
        if (cfg) setBizPhone(cfg.phone_number);
      } catch (_) {}

      await loadThreads(cid);

      const sub = supabase
        .channel("comms")
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "communications",
          filter: `company_id=eq.${cid}`,
        }, (payload) => {
          loadThreads(cid);
          if (selected && [payload.new.from_number, payload.new.to_number].includes(selected.contactNumber)) {
            setMessages(prev => [...prev, payload.new]);
          }
        })
        .subscribe();

      return () => sub.unsubscribe();
    } catch (err) {
      console.error("Communications init error:", err);
    }
  }

  // ── MSAL init ─────────────────────────────────────────────────────────────
  async function initMsal() {
    try {
      const instance = new PublicClientApplication(MSAL_CONFIG);
      await instance.initialize();
      try {
        await instance.handleRedirectPromise();
      } catch (e) {
        console.warn("MSAL redirect promise error (non-fatal):", e.message);
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes("msal") || key.includes("login.windows")) {
            sessionStorage.removeItem(key);
          }
        });
      }
      msalRef.current = instance;
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) setEmailSignedIn(true);
    } catch (err) {
      console.error("MSAL init error:", err);
    } finally {
      setMsalLoading(false);
    }
  }

  // ── Email helpers ─────────────────────────────────────────────────────────
  const getEmailToken = useCallback(async () => {
    const instance = msalRef.current;
    if (!instance) throw new Error("MSAL not initialized");
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const resp = await instance.acquireTokenSilent({ ...EMAIL_SCOPES, account: accounts[0] });
        return resp.accessToken;
      } catch {
        const resp = await instance.acquireTokenPopup(EMAIL_SCOPES);
        return resp.accessToken;
      }
    }
    const resp = await instance.loginPopup(EMAIL_SCOPES);
    setEmailSignedIn(true);
    return resp.accessToken;
  }, []);

  const graphFetch = useCallback(async (url) => {
    const token = await getEmailToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${res.statusText}`);
    return res.json();
  }, [getEmailToken]);

  async function handleEmailSignIn() {
    const instance = msalRef.current;
    if (!instance) { setEmailError("Auth not ready. Please refresh."); return; }
    try {
      setEmailError(null);
      await instance.loginPopup(EMAIL_SCOPES);
      setEmailSignedIn(true);
      await loadEmails();
    } catch (err) {
      if (!err.message?.includes("user_cancelled") && !err.message?.includes("cancelled")) {
        setEmailError("Sign in failed: " + err.message);
      }
    }
  }

  async function handleEmailSignOut() {
    const instance = msalRef.current;
    if (instance) {
      try { await instance.logoutPopup(); } catch (_) {}
    }
    setEmailSignedIn(false);
    setEmails([]);
    setSelectedEmail(null);
    setEmailAttachments([]);
    setEmailError(null);
  }

  async function loadEmails() {
    setEmailsLoading(true);
    setEmailError(null);
    try {
      const data = await graphFetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=30&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead"
      );
      setEmails(data.value || []);
    } catch (err) {
      setEmailError("Failed to load emails: " + err.message);
    }
    setEmailsLoading(false);
  }

  async function handleSelectEmail(email) {
    setSelectedEmail(email);
    setEmailAttachments([]);
    setEmailProcessResult(null);
    if (email.hasAttachments) {
      try {
        const data = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/messages/${email.id}/attachments`
        );
        setEmailAttachments(data.value || []);
      } catch (err) {
        console.error("Failed to load attachments:", err);
      }
    }
  }

  function handleDownloadAttachment(att) {
    const byteChars = atob(att.contentBytes);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: att.contentType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleProcessPayStub(att) {
    setEmailProcessing(true);
    setEmailProcessResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        "https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/process-check-stub-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            source: "email-inbox",
            filename: att.name,
            contentBase64: att.contentBytes,
            contentType: att.contentType,
            from: selectedEmail?.from?.emailAddress?.address || "unknown",
            subject: selectedEmail?.subject || "",
          }),
        }
      );
      const result = await res.json();
      setEmailProcessResult({ success: res.ok, message: res.ok ? (result.message || "Pay stubs processed!") : (result.error || "Processing failed") });
    } catch (err) {
      setEmailProcessResult({ success: false, message: err.message });
    }
    setEmailProcessing(false);
  }

  // ── SMS helpers ───────────────────────────────────────────────────────────
  async function loadThreads(cid) {
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });
    if (!data) return;
    const threadMap = new Map();
    for (const msg of data) {
      const contactNum = msg.direction === "inbound" ? msg.from_number : msg.to_number;
      if (!threadMap.has(contactNum)) {
        threadMap.set(contactNum, { ...msg, contactNumber: contactNum, unread: 0 });
      }
      if (!msg.read_at && msg.direction === "inbound") {
        threadMap.get(contactNum).unread++;
      }
    }
    setThreads(Array.from(threadMap.values()));
    setUnreadCount(data.filter(m => !m.read_at && m.direction === "inbound").length);
  }

  async function loadThread(contactNumber) {
    if (!companyId) return;
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("company_id", companyId)
      .or(`from_number.eq.${contactNumber},to_number.eq.${contactNumber}`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await supabase
      .from("communications")
      .update({ read_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("from_number", contactNumber)
      .is("read_at", null);
  }

  async function sendMessage() {
    if (!newMsg.trim() || !selected || !companyId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: selected.contactNumber,
          body: newMsg.trim(),
          company_id: companyId,
          customer_id: selected.customerId || null,
          customer_name: selected.customerName || null,
        },
      });
      if (error) throw error;
      setNewMsg("");
      await loadThread(selected.contactNumber);
    } catch (err) {
      alert("Failed to send: " + err.message);
    } finally {
      setSending(false);
    }
  }

  const filteredThreads = threads.filter(t => {
    if (filter !== "all" && t.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.customer_name || "").toLowerCase().includes(q) ||
        (t.contactNumber || "").includes(q) ||
        (t.body || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)", background: "#f3f4f6", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ══════════════ LEFT PANEL ══════════════ */}
        <div style={{ width: 320, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: BLUE }}>
                💬 Communications
                {unreadCount > 0 && (
                  <span style={{ marginLeft: 8, backgroundColor: ORANGE, color: "#fff", borderRadius: 12, fontSize: 11, fontWeight: 800, padding: "2px 8px" }}>
                    {unreadCount}
                  </span>
                )}
              </h2>
              <button
                onClick={() => navigate("/twilio-settings")}
                style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}
              >
                ⚙️ Setup
              </button>
            </div>

            {/* Search (only for messages mode) */}
            {filter !== "email" && (
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations..."
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 10 }}
              />
            )}

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", "sms", "call", "ai_call", "email"].map(f => (
                <button key={f} onClick={() => { setFilter(f); setSelected(null); setSelectedEmail(null); }} style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  backgroundColor: filter === f ? BLUE : "#f3f4f6",
                  color: filter === f ? "#fff" : "#374151",
                  border: "none",
                }}>
                  {f === "all" ? "All" : f === "email" ? "📧 Email" : TYPE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* ── EMAIL list OR SMS/Call thread list ── */}
          {filter === "email" ? (

            /* ─── EMAIL LIST ─── */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Email toolbar */}
              {emailSignedIn && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}>
                  <button
                    onClick={loadEmails}
                    disabled={emailsLoading}
                    style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: emailsLoading ? "not-allowed" : "pointer", color: "#6b7280" }}
                  >
                    {emailsLoading ? "⏳" : "🔄"} Refresh
                  </button>
                  <button
                    onClick={handleEmailSignOut}
                    style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", color: "#9ca3af" }}
                  >
                    Sign Out
                  </button>
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto" }}>
                {msalLoading ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    ⏳ Connecting to Outlook...
                  </div>

                ) : !emailSignedIn ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📬</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 6 }}>Connect Your Outlook</div>
                    <div style={{ fontSize: 12, marginBottom: 16 }}>Sign in to view emails alongside your texts and calls.</div>
                    <button
                      onClick={handleEmailSignIn}
                      style={{ padding: "9px 18px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      🔑 Sign In with Microsoft
                    </button>
                    {emailError && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 10 }}>{emailError}</div>}
                  </div>

                ) : emailsLoading ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    ⏳ Loading emails...
                  </div>

                ) : emails.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No emails found.
                    {emailError && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 8 }}>{emailError}</div>}
                  </div>

                ) : (
                  emails.map(email => {
                    const senderName = email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown";
                    const isActive   = selectedEmail?.id === email.id;
                    return (
                      <div
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #f3f4f6",
                          cursor: "pointer",
                          backgroundColor: isActive ? "#eff6ff" : "#fff",
                          borderLeft: isActive ? `3px solid ${BLUE}` : "3px solid transparent",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: isActive ? BLUE : "#e0e7ff", color: isActive ? "#fff" : BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                              {senderName[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: email.isRead ? 600 : 800, fontSize: 13, color: "#111", display: "flex", alignItems: "center", gap: 5 }}>
                                {senderName}
                                {!email.isRead && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: BLUE, display: "inline-block", flexShrink: 0 }} />}
                                {email.hasAttachments && <span style={{ fontSize: 11 }}>📎</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, paddingTop: 2 }}>
                            {formatTime(email.receivedDateTime)}
                          </div>
                        </div>
                        <div style={{ paddingLeft: 44 }}>
                          <div style={{ fontSize: 12, fontWeight: email.isRead ? 400 : 700, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                            {email.subject || "(no subject)"}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {email.bodyPreview}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          ) : (

            /* ─── SMS / CALL THREAD LIST ─── */
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredThreads.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  No conversations yet.<br />
                  <span style={{ fontSize: 12 }}>Configure Twilio to start receiving calls & texts.</span>
                </div>
              ) : (
                filteredThreads.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelected({ contactNumber: t.contactNumber, customerName: t.customer_name, customerId: t.customer_id })}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      backgroundColor: selected?.contactNumber === t.contactNumber ? "#eff6ff" : "#fff",
                      borderLeft: selected?.contactNumber === t.contactNumber ? `3px solid ${BLUE}` : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                          {(t.customer_name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                            {t.customer_name || formatPhone(t.contactNumber)}
                            {t.unread > 0 && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: BLUE, display: "inline-block" }} />}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatPhone(t.contactNumber)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatTime(t.created_at)}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{TYPE_ICONS[t.type]} {TYPE_LABELS[t.type]}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 44 }}>
                      {t.direction === "outbound" ? "You: " : ""}{t.ai_summary || t.body || "View conversation"}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {/* ══ end LEFT PANEL ══ */}

        {/* ══════════════ RIGHT PANEL ══════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f3f4f6" }}>

          {filter === "email" ? (
            /* ─── EMAIL DETAIL PANE ─── */
            !emailSignedIn ? (
              /* Sign-in prompt (right panel) */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: "#9ca3af" }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>📬</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#374151", marginBottom: 8 }}>Connect Your Outlook</div>
                <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 380, textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
                  Sign in with your Microsoft account to read emails right here alongside your texts and calls.
                </p>
                <button
                  onClick={handleEmailSignIn}
                  style={{ padding: "13px 32px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer" }}
                >
                  🔑 Sign In with Microsoft
                </button>
                {emailError && (
                  <div style={{ color: "#ef4444", fontSize: 13, marginTop: 12, maxWidth: 400, textAlign: "center" }}>{emailError}</div>
                )}
              </div>

            ) : !selectedEmail ? (
              /* No email selected */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Select an email</div>
                <div style={{ fontSize: 14 }}>Your Outlook inbox appears on the left.</div>
                {emailsLoading && <div style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>⏳ Loading emails...</div>}
                {emailError && <div style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{emailError}</div>}
              </div>

            ) : (
              /* Email detail */
              <>
                {/* Email header */}
                <div style={{ padding: "14px 20px", backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 4, lineHeight: 1.3 }}>
                      {selectedEmail.subject || "(no subject)"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                      <strong>From:</strong> {selectedEmail.from?.emailAddress?.name}{" "}
                      {selectedEmail.from?.emailAddress?.address && (
                        <span style={{ color: "#9ca3af" }}>&lt;{selectedEmail.from.emailAddress.address}&gt;</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {new Date(selectedEmail.receivedDateTime).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <a
                      href={`mailto:${selectedEmail.from?.emailAddress?.address}`}
                      style={{ padding: "6px 14px", backgroundColor: GREEN, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      ✉️ Reply
                    </a>
                    <button
                      onClick={loadEmails}
                      disabled={emailsLoading}
                      style={{ padding: "6px 12px", backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: emailsLoading ? "not-allowed" : "pointer", color: "#374151" }}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {/* Email body + attachments */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                  {/* Body preview */}
                  <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #e5e7eb", fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {selectedEmail.bodyPreview || "(no preview available)"}
                    {selectedEmail.bodyPreview && (
                      <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                        Showing preview only. Open Outlook to read the full email.
                      </p>
                    )}
                  </div>

                  {/* Attachments */}
                  {emailAttachments.length > 0 && (
                    <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: BLUE, marginBottom: 12 }}>
                        📎 Attachments ({emailAttachments.length})
                      </div>
                      {emailAttachments.map((att, i) => {
                        const isPdf = att.contentType === "application/pdf" || att.name?.toLowerCase().endsWith(".pdf");
                        return (
                          <div
                            key={i}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#f9fafb", borderRadius: 8, marginBottom: 8, border: "1px solid #e5e7eb" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 22 }}>{isPdf ? "📄" : "📁"}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{att.name}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                  {(att.size / 1024).toFixed(1)} KB
                                  {isPdf && <span style={{ backgroundColor: "#fef2f2", color: "#ef4444", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "1px 5px", marginLeft: 6 }}>PDF</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => handleDownloadAttachment(att)}
                                style={{ padding: "6px 12px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                ⬇ Download
                              </button>
                              {isPdf && (
                                <button
                                  onClick={() => handleProcessPayStub(att)}
                                  disabled={emailProcessing}
                                  style={{ padding: "6px 12px", backgroundColor: GREEN, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: emailProcessing ? "not-allowed" : "pointer", opacity: emailProcessing ? 0.7 : 1 }}
                                >
                                  {emailProcessing ? "⏳" : "🧾 Process Pay Stubs"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {emailProcessResult && (
                        <div style={{ padding: "10px 14px", borderRadius: 8, marginTop: 10, backgroundColor: emailProcessResult.success ? "#f0fdf4" : "#fef2f2", color: emailProcessResult.success ? "#166534" : "#991b1b", fontSize: 13, fontWeight: 600, border: `1px solid ${emailProcessResult.success ? "#86efac" : "#fca5a5"}` }}>
                          {emailProcessResult.success ? "✅ " : "❌ "}{emailProcessResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )

          ) : (
            /* ─── SMS / CALL THREAD VIEW ─── */
            !selected ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Select a conversation</div>
                <div style={{ fontSize: 14 }}>All calls and texts from customers appear here.</div>
                {!bizPhone && (
                  <button
                    onClick={() => navigate("/twilio-settings")}
                    style={{ marginTop: 20, padding: "12px 24px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    ⚙️ Set Up Twilio
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div style={{ padding: "14px 20px", backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                      {(selected.customerName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>{selected.customerName || formatPhone(selected.contactNumber)}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{formatPhone(selected.contactNumber)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {selected.customerId && (
                      <button
                        onClick={() => navigate("/customers")}
                        style={{ padding: "6px 14px", backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#374151", fontWeight: 600 }}
                      >
                        👤 View Customer
                      </button>
                    )}
                    <a
                      href={`tel:${selected.contactNumber}`}
                      style={{ padding: "6px 14px", backgroundColor: GREEN, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                    >
                      📞 Call
                    </a>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((msg, i) => {
                    const isOutbound = msg.direction === "outbound";
                    const isCall     = msg.type === "call" || msg.type === "ai_call";

                    if (isCall) {
                      return (
                        <div key={msg.id || i} style={{ alignSelf: "center", textAlign: "center" }}>
                          <div
                            style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 16px", cursor: msg.transcript ? "pointer" : "default" }}
                            onClick={() => msg.transcript ? setShowTranscript(msg) : null}
                          >
                            <span style={{ fontSize: 18 }}>{msg.type === "ai_call" ? "🤖" : "📞"}</span>
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                                {msg.type === "ai_call" ? "AI After-Hours Call" : msg.direction === "inbound" ? "Inbound Call" : "Outbound Call"}
                                {msg.status === "missed" && <span style={{ color: "#ef4444", marginLeft: 6 }}>• Missed</span>}
                              </div>
                              {msg.ai_summary    && <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 300 }}>{msg.ai_summary}</div>}
                              {msg.duration_seconds && <div style={{ fontSize: 11, color: "#9ca3af" }}>{Math.floor(msg.duration_seconds / 60)}:{String(msg.duration_seconds % 60).padStart(2, "0")}</div>}
                              {msg.transcript    && <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginTop: 2 }}>View transcript →</div>}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{formatTime(msg.created_at)}</div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id || i} style={{ display: "flex", justifyContent: isOutbound ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "65%",
                          backgroundColor: isOutbound ? BLUE : "#fff",
                          color: isOutbound ? "#fff" : "#111",
                          borderRadius: isOutbound ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          padding: "10px 14px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                          border: isOutbound ? "none" : "1px solid #e5e7eb",
                        }}>
                          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.body}</div>
                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: isOutbound ? "right" : "left" }}>
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Box */}
                <div style={{ padding: "12px 20px", backgroundColor: "#fff", borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Type a text message..."
                      style={{ flex: 1, padding: "10px 16px", border: "1px solid #e5e7eb", borderRadius: 24, fontSize: 14, outline: "none" }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !newMsg.trim()}
                      style={{ padding: "10px 20px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 24, fontSize: 14, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", opacity: sending || !newMsg.trim() ? 0.6 : 1 }}
                    >
                      {sending ? "..." : "Send ➤"}
                    </button>
                  </div>
                  {bizPhone && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, textAlign: "center" }}>
                      Sending from {formatPhone(bizPhone)}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </div>
        {/* ══ end RIGHT PANEL ══ */}

      </div>

      {/* ── AI CALL TRANSCRIPT MODAL ─────────────────────────────────────── */}
      {showTranscript && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, maxWidth: 600, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🤖 AI Call Transcript</h3>
              <button onClick={() => setShowTranscript(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            {showTranscript.ai_summary && (
              <div style={{ padding: "12px 20px", backgroundColor: "#eff6ff", borderBottom: "1px solid #e5e7eb", fontSize: 13, color: BLUE }}>
                <strong>Summary:</strong> {showTranscript.ai_summary}
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {(showTranscript.transcript || []).map((turn, i) => (
                <div key={i} style={{ display: "flex", justifyContent: turn.role === "assistant" ? "flex-start" : "flex-end" }}>
                  <div style={{
                    maxWidth: "75%", padding: "8px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                    backgroundColor: turn.role === "assistant" ? "#f3f4f6" : BLUE,
                    color: turn.role === "assistant" ? "#111" : "#fff",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
                      {turn.role === "assistant" ? "🤖 AI" : "👤 Caller"}
                    </div>
                    {turn.content}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#9ca3af" }}>
              {formatTime(showTranscript.created_at)} · {formatPhone(showTranscript.from_number)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const BLUE   = "#0b3ea8";
const ORANGE = "#fc6b04";

function inp(overrides = {}) {
  return {
    width: "100%", padding: "10px 14px", border: "1px solid #d1d5db",
    borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none",
    ...overrides,
  };
}

export default function TwilioSettings() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [config, setConfig]       = useState({
    account_sid:           "",
    auth_token:            "",
    phone_number:          "",
    forward_to_number:     "",
    business_hours_start:  7,
    business_hours_end:    18,
    business_days:         ["Mon","Tue","Wed","Thu","Fri"],
    timezone:              "America/Chicago",
    ai_enabled:            true,
    sms_auto_reply_enabled: true,
    sms_auto_reply_message: "Thanks for texting DML Electrical! We received your message and will respond during business hours (Mon-Fri 7am-6pm). For emergencies call (337) 288-0395.",
  });

  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const HOURS = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    const ampm = i < 12 ? "AM" : "PM";
    return { value: i, label: `${h}:00 ${ampm}` };
  });

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      // Try employees table first, then profiles, fall back to user.id
      let cid = null;
      try {
        const { data: emp } = await supabase.from("employees").select("company_id").eq("user_id", user.id).maybeSingle();
        cid = emp?.company_id || null;
      } catch (_) {}

      // If no company from employees, use user.id as the company identifier
      if (!cid) cid = user.id;
      setCompanyId(cid);

      try {
        const { data: existing } = await supabase.from("twilio_config").select("*").eq("company_id", cid).maybeSingle();
        if (existing) setConfig(c => ({ ...c, ...existing }));
      } catch (_) {}
    } catch (err) {
      console.error("TwilioSettings init error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = { ...config, company_id: companyId, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("twilio_config").upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day) {
    setConfig(c => ({
      ...c,
      business_days: c.business_days.includes(day)
        ? c.business_days.filter(d => d !== day)
        : [...c.business_days, day],
    }));
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : "<YOUR_SUPABASE_URL>/functions/v1";

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate("/communications")} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>← Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BLUE }}>⚙️ Communications Setup</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Configure Twilio for SMS & AI phone calls</p>
        </div>
      </div>

      {/* ===== WEBHOOK URLS (read-only) ===== */}
      <div style={card}>
        <h3 style={cardTitle}>📋 Your Twilio Webhook URLs</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Copy these into your <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{ color: BLUE }}>Twilio Console</a> under your phone number settings:
        </p>
        {[
          { label: "Voice Webhook (Incoming Calls)", url: `${webhookBase}/twilio-voice-inbound`, method: "HTTP POST" },
          { label: "SMS Webhook (Incoming Texts)", url: `${webhookBase}/twilio-inbound-sms`, method: "HTTP POST" },
        ].map(({ label, url, method }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{label}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={url} style={{ ...inp(), backgroundColor: "#f9fafb", color: "#374151", flex: 1, fontFamily: "monospace", fontSize: 12 }} />
              <button
                onClick={() => { navigator.clipboard.writeText(url); }}
                style={{ padding: "8px 14px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Copy
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Method: {method}</div>
          </div>
        ))}
      </div>

      {/* ===== TWILIO CREDENTIALS ===== */}
      <div style={card}>
        <h3 style={cardTitle}>🔑 Twilio Credentials</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Find these at <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{ color: BLUE }}>console.twilio.com</a> → Account Info
        </p>
        <div style={grid2}>
          <div>
            <label style={label}>Account SID</label>
            <input value={config.account_sid} onChange={e => setConfig(c => ({ ...c, account_sid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={inp()} />
          </div>
          <div>
            <label style={label}>Auth Token</label>
            <input type="password" value={config.auth_token} onChange={e => setConfig(c => ({ ...c, auth_token: e.target.value }))}
              placeholder="Your auth token" style={inp()} />
          </div>
          <div>
            <label style={label}>Your Twilio Phone Number</label>
            <input value={config.phone_number} onChange={e => setConfig(c => ({ ...c, phone_number: e.target.value }))}
              placeholder="+13372880395" style={inp()} />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Must be in +1XXXXXXXXXX format</div>
          </div>
          <div>
            <label style={label}>Forward Calls To (Your Cell)</label>
            <input value={config.forward_to_number} onChange={e => setConfig(c => ({ ...c, forward_to_number: e.target.value }))}
              placeholder="+13371234567" style={inp()} />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>During business hours, calls ring this number first</div>
          </div>
        </div>
      </div>

      {/* ===== BUSINESS HOURS ===== */}
      <div style={card}>
        <h3 style={cardTitle}>🕐 Business Hours</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Outside these hours, calls go to the AI agent and texts get an auto-reply.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Business Days</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => toggleDay(day)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer",
                backgroundColor: config.business_days?.includes(day) ? BLUE : "#f3f4f6",
                color: config.business_days?.includes(day) ? "#fff" : "#374151",
                border: "none",
              }}>
                {day}
              </button>
            ))}
          </div>
        </div>
        <div style={grid2}>
          <div>
            <label style={label}>Opens At</label>
            <select value={config.business_hours_start} onChange={e => setConfig(c => ({ ...c, business_hours_start: parseInt(e.target.value) }))} style={inp()}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Closes At</label>
            <select value={config.business_hours_end} onChange={e => setConfig(c => ({ ...c, business_hours_end: parseInt(e.target.value) }))} style={inp()}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={label}>Timezone</label>
          <select value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))} style={{ ...inp(), maxWidth: 300 }}>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
          </select>
        </div>
      </div>

      {/* ===== AI SETTINGS ===== */}
      <div style={card}>
        <h3 style={cardTitle}>🤖 AI Phone Agent</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Enable AI After-Hours Agent</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>AI answers calls outside business hours using OpenAI</div>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, ai_enabled: !c.ai_enabled }))}
            style={{ padding: "8px 20px", backgroundColor: config.ai_enabled ? "#22c55e" : "#e5e7eb", color: config.ai_enabled ? "#fff" : "#374151", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {config.ai_enabled ? "✓ ON" : "OFF"}
          </button>
        </div>
        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, fontSize: 13, color: BLUE }}>
          <strong>How it works:</strong> When someone calls after hours, the AI answers with a natural voice, 
          finds out if it's an emergency, collects their name and issue, and saves a full transcript in Communications.
          You'll see every call logged here with an AI summary.
        </div>
      </div>

      {/* ===== SMS AUTO-REPLY ===== */}
      <div style={card}>
        <h3 style={cardTitle}>💬 SMS Auto-Reply (After Hours)</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Enable Auto-Reply</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Automatically reply to texts received outside business hours</div>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, sms_auto_reply_enabled: !c.sms_auto_reply_enabled }))}
            style={{ padding: "8px 20px", backgroundColor: config.sms_auto_reply_enabled ? "#22c55e" : "#e5e7eb", color: config.sms_auto_reply_enabled ? "#fff" : "#374151", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {config.sms_auto_reply_enabled ? "✓ ON" : "OFF"}
          </button>
        </div>
        <div>
          <label style={label}>Auto-Reply Message</label>
          <textarea
            value={config.sms_auto_reply_message}
            onChange={e => setConfig(c => ({ ...c, sms_auto_reply_message: e.target.value }))}
            rows={3}
            style={{ ...inp(), resize: "vertical" }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            {config.sms_auto_reply_message?.length || 0}/160 characters
          </div>
        </div>
      </div>

      {/* ===== SETUP GUIDE ===== */}
      <div style={{ ...card, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <h3 style={{ ...cardTitle, color: "#166534" }}>🚀 Quick Setup Guide</h3>
        <ol style={{ fontSize: 13, color: "#374151", lineHeight: 2, paddingLeft: 20, margin: 0 }}>
          <li>Sign up at <a href="https://twilio.com" target="_blank" rel="noreferrer" style={{ color: BLUE }}>twilio.com</a> (free trial available)</li>
          <li>Buy a phone number (approx. $1.15/month)</li>
          <li>Copy your Account SID and Auth Token from the Twilio Console</li>
          <li>Paste them above and click Save</li>
          <li>In Twilio Console → Phone Numbers → Your Number → Voice Webhook: paste the URL above</li>
          <li>In Twilio Console → Your Number → SMS Webhook: paste the SMS URL above</li>
          <li>Add your OpenAI API key in Supabase: <code style={{ backgroundColor: "#e5e7eb", padding: "1px 6px", borderRadius: 4 }}>OPENAI_API_KEY</code></li>
          <li>Done! Test by texting or calling your Twilio number</li>
        </ol>
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          💡 Estimated monthly cost: <strong>$5–20/month</strong> depending on call/text volume
        </div>
      </div>

      {/* ===== SAVE BUTTON ===== */}
      <div style={{ position: "sticky", bottom: 0, backgroundColor: "#fff", padding: "16px 0", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
        {saved && <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 700, alignSelf: "center" }}>✅ Saved!</div>}
        <button onClick={() => navigate("/communications")} style={{ padding: "12px 24px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, cursor: "pointer", backgroundColor: "#fff" }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} style={{ padding: "12px 28px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "💾 Save Settings"}
        </button>
      </div>
    </div>
  );
}

const card = { backgroundColor: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const cardTitle = { fontSize: 16, fontWeight: 800, color: BLUE, margin: "0 0 16px 0" };
const label = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 };
const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 };

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const BLUE   = "#0b3ea8";
const GREEN  = "#22c55e";
const RED    = "#ef4444";
const ORANGE = "#fc6b04";

function inp(overrides = {}) {
  return {
    width: "100%", padding: "10px 14px", border: "1px solid #d1d5db",
    borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none",
    ...overrides,
  };
}

function formatPhone(num = "") {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return num;
}

const DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${h}:00 ${ampm}` };
});

export default function TwilioSettings() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [newVip, setNewVip]       = useState({ number: "", label: "" });
  const [config, setConfig]       = useState({
    account_sid:              "",
    auth_token:               "",
    phone_number:             "+13377171182",
    business_number:          "+13372880395",
    forward_to_number:        "+13377177234",
    emergency_forward_number: "+13377177234",
    owner_name:               "Dustin",
    business_name:            "DML Electrical Service",
    service_area:             "Jennings and surrounding south Louisiana areas",
    ai_greeting:              "Thank you for calling DML Electrical Service. I'm the automated assistant. Please briefly describe what you need and I'll make sure {owner} gets back to you right away.",
    business_hours_start:     7,
    business_hours_end:       18,
    business_days:            ["Mon","Tue","Wed","Thu","Fri"],
    timezone:                 "America/Chicago",
    ai_enabled:               true,
    sms_auto_reply_enabled:   true,
    sms_auto_reply_message:   "Thanks for texting DML Electrical! We received your message and will respond during business hours (Mon-Fri 7am-6pm). For emergencies call (337) 288-0395.",
    vip_numbers:              [],
  });

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      let cid = null;
      try {
        const { data: emp } = await supabase.from("employees").select("company_id").eq("user_id", user.id).maybeSingle();
        cid = emp?.company_id || null;
      } catch (_) {}
      if (!cid) cid = user.id;
      setCompanyId(cid);

      try {
        const { data: existing } = await supabase.from("twilio_config").select("*").eq("company_id", cid).maybeSingle();
        if (existing) setConfig(c => ({
          ...c,
          ...existing,
          vip_numbers: existing.vip_numbers || [],
          business_days: existing.business_days || ["Mon","Tue","Wed","Thu","Fri"],
        }));
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

  function addVip() {
    const num = newVip.number.trim().replace(/[^\d+]/g, "");
    if (!num) return;
    const formatted = num.startsWith("+") ? num : `+1${num.replace(/\D/g, "").slice(-10)}`;
    setConfig(c => ({
      ...c,
      vip_numbers: [...(c.vip_numbers || []), { number: formatted, label: newVip.label.trim() || "VIP Contact" }],
    }));
    setNewVip({ number: "", label: "" });
  }

  function removeVip(idx) {
    setConfig(c => ({ ...c, vip_numbers: c.vip_numbers.filter((_, i) => i !== idx) }));
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : "<YOUR_SUPABASE_URL>/functions/v1";

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 100px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate("/communications")} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>← Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BLUE }}>⚙️ AI Phone Settings</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Configure your AI phone assistant, business hours, and call routing</p>
        </div>
      </div>

      {/* ── WEBHOOK URLS ─────────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>📋 Twilio Webhook URLs</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          These are already set in your Twilio console. Copy them if you ever need to reset.
        </p>
        {[
          { label: "Voice Webhook (Incoming Calls — AI answers)", url: `${webhookBase}/twilio-voice-inbound` },
          { label: "SMS Webhook (Incoming Texts)", url: `${webhookBase}/twilio-inbound-sms` },
        ].map(({ label, url }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{label}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={url} style={{ ...inp(), backgroundColor: "#f9fafb", flex: 1, fontFamily: "monospace", fontSize: 11 }} />
              <button onClick={() => navigator.clipboard.writeText(url)}
                style={{ padding: "8px 14px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── BUSINESS INFO ────────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>🏢 Business Info (used by AI greeting)</h3>
        <div style={grid2}>
          <div>
            <label style={lbl}>Business Name</label>
            <input value={config.business_name} onChange={e => setConfig(c => ({ ...c, business_name: e.target.value }))}
              placeholder="DML Electrical Service" style={inp()} />
          </div>
          <div>
            <label style={lbl}>Owner / Contact Name</label>
            <input value={config.owner_name} onChange={e => setConfig(c => ({ ...c, owner_name: e.target.value }))}
              placeholder="Dustin" style={inp()} />
            <div style={hint}>The AI will say "I'll have {"{owner}"} call you back"</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Service Area</label>
          <input value={config.service_area} onChange={e => setConfig(c => ({ ...c, service_area: e.target.value }))}
            placeholder="Jennings and surrounding south Louisiana areas" style={inp()} />
        </div>
      </div>

      {/* ── PHONE NUMBERS ────────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>📞 Phone Numbers</h3>
        <div style={grid2}>
          <div>
            <label style={lbl}>Twilio AI Number (receives calls)</label>
            <input value={config.phone_number} onChange={e => setConfig(c => ({ ...c, phone_number: e.target.value }))}
              placeholder="+13377171182" style={inp()} />
            <div style={hint}>Customers call this number, AI answers</div>
          </div>
          <div>
            <label style={lbl}>Business Caller ID (outbound)</label>
            <input value={config.business_number} onChange={e => setConfig(c => ({ ...c, business_number: e.target.value }))}
              placeholder="+13372880395" style={inp()} />
            <div style={hint}>Shows on customer's phone when you call back</div>
          </div>
          <div>
            <label style={lbl}>Your Personal Cell (ring for known customers)</label>
            <input value={config.forward_to_number} onChange={e => setConfig(c => ({ ...c, forward_to_number: e.target.value }))}
              placeholder="+13377177234" style={inp()} />
            <div style={hint}>Known customers & VIPs ring this number directly</div>
          </div>
          <div>
            <label style={lbl}>🚨 Emergency Forward Number</label>
            <input value={config.emergency_forward_number} onChange={e => setConfig(c => ({ ...c, emergency_forward_number: e.target.value }))}
              placeholder="+13377177234" style={{ ...inp(), borderColor: RED }} />
            <div style={{ ...hint, color: RED }}>Fires, sparks, power outages — connects immediately</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Twilio Account SID</label>
          <input value={config.account_sid} onChange={e => setConfig(c => ({ ...c, account_sid: e.target.value }))}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={inp()} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Twilio Auth Token</label>
          <input type="password" value={config.auth_token} onChange={e => setConfig(c => ({ ...c, auth_token: e.target.value }))}
            placeholder="Your auth token" style={inp()} />
        </div>
      </div>

      {/* ── BUSINESS HOURS ───────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>🕐 Business Hours</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Outside these hours calls are always screened by AI. During hours, calls ring your phone first.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Business Days</label>
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
            <label style={lbl}>Opens At</label>
            <select value={config.business_hours_start} onChange={e => setConfig(c => ({ ...c, business_hours_start: parseInt(e.target.value) }))} style={inp()}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Closes At</label>
            <select value={config.business_hours_end} onChange={e => setConfig(c => ({ ...c, business_hours_end: parseInt(e.target.value) }))} style={inp()}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={lbl}>Timezone</label>
          <select value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))} style={{ ...inp(), maxWidth: 300 }}>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
          </select>
        </div>
      </div>

      {/* ── AI GREETING SCRIPT ───────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>🤖 AI Greeting Script</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Enable AI Phone Agent</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>AI answers, screens callers, detects emergencies</div>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, ai_enabled: !c.ai_enabled }))}
            style={{ padding: "8px 20px", backgroundColor: config.ai_enabled ? GREEN : "#e5e7eb", color: config.ai_enabled ? "#fff" : "#374151", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {config.ai_enabled ? "✓ ON" : "OFF"}
          </button>
        </div>
        <div>
          <label style={lbl}>Opening Greeting <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>(use {"{owner}"} for owner name)</span></label>
          <textarea value={config.ai_greeting} onChange={e => setConfig(c => ({ ...c, ai_greeting: e.target.value }))}
            rows={3} style={{ ...inp(), resize: "vertical" }} />
        </div>
        <div style={{ marginTop: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, fontSize: 13, color: BLUE }}>
          <strong>Emergency keywords</strong> (always forward): fire, smoke, burning, sparks, shocked, no power, power out, breaker, exposed wire, wire down, emergency, dangerous
        </div>
      </div>

      {/* ── VIP NUMBERS ─────────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>⭐ VIP Numbers (always connect directly)</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Calls from these numbers skip the AI and ring you directly — no screening, no greeting. Great for important contractors, suppliers, or frequent customers not yet in your database.
        </p>

        {/* Existing VIP list */}
        {config.vip_numbers?.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            {config.vip_numbers.map((vip, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", backgroundColor: "#f9fafb", borderRadius: 8, marginBottom: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{vip.label}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{formatPhone(vip.number)}</div>
                </div>
                <button onClick={() => removeVip(idx)} style={{ padding: "4px 12px", backgroundColor: "#fef2f2", color: RED, border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
            No VIP numbers added yet
          </div>
        )}

        {/* Add new VIP */}
        <div style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: 16, border: "1px dashed #d1d5db" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Add a VIP Number</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={newVip.number} onChange={e => setNewVip(v => ({ ...v, number: e.target.value }))}
              placeholder="Phone number e.g. (337) 555-1234" style={{ ...inp(), flex: 2, minWidth: 180 }} />
            <input value={newVip.label} onChange={e => setNewVip(v => ({ ...v, label: e.target.value }))}
              placeholder="Label e.g. Joe the Plumber" style={{ ...inp(), flex: 3, minWidth: 180 }} />
            <button onClick={addVip} style={{ padding: "10px 20px", backgroundColor: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* ── SMS AUTO-REPLY ───────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={cardTitle}>💬 SMS Auto-Reply (After Hours)</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Enable Auto-Reply</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Auto-reply to texts received outside business hours</div>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, sms_auto_reply_enabled: !c.sms_auto_reply_enabled }))}
            style={{ padding: "8px 20px", backgroundColor: config.sms_auto_reply_enabled ? GREEN : "#e5e7eb", color: config.sms_auto_reply_enabled ? "#fff" : "#374151", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {config.sms_auto_reply_enabled ? "✓ ON" : "OFF"}
          </button>
        </div>
        <div>
          <label style={lbl}>Auto-Reply Message</label>
          <textarea value={config.sms_auto_reply_message} onChange={e => setConfig(c => ({ ...c, sms_auto_reply_message: e.target.value }))}
            rows={3} style={{ ...inp(), resize: "vertical" }} />
          <div style={hint}>{config.sms_auto_reply_message?.length || 0}/160 characters</div>
        </div>
      </div>

      {/* ── AT&T FORWARDING INSTRUCTIONS ─────────────────────────────────── */}
      <div style={{ ...card, backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
        <h3 style={{ ...cardTitle, color: "#92400e" }}>📱 AT&T Call Forwarding Setup</h3>
        <p style={{ fontSize: 13, color: "#78350f", marginBottom: 12 }}>
          To activate the AI for missed calls on your AT&T line, dial these from your business phone:
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { code: `*71 ${(config.phone_number || "+13377171182").replace(/\D/g,"")}`, desc: "Forward when you DON'T answer (recommended)" },
            { code: `*72 ${(config.phone_number || "+13377171182").replace(/\D/g,"")}`, desc: "Forward ALL calls (AI answers everything)" },
            { code: "*73", desc: "Turn off all forwarding" },
          ].map(({ code, desc }) => (
            <div key={code} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #fde68a" }}>
              <code style={{ backgroundColor: "#fef3c7", padding: "4px 12px", borderRadius: 6, fontWeight: 800, fontSize: 15, color: "#92400e", whiteSpace: "nowrap" }}>{code}</code>
              <span style={{ fontSize: 13, color: "#374151" }}>{desc}</span>
              <button onClick={() => navigator.clipboard.writeText(code)} style={{ marginLeft: "auto", padding: "4px 10px", backgroundColor: ORANGE, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── SAVE ────────────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", bottom: 0, backgroundColor: "#fff", padding: "16px 0", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
        {saved && <div style={{ color: GREEN, fontSize: 14, fontWeight: 700, alignSelf: "center" }}>✅ Saved!</div>}
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

const card      = { backgroundColor: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const cardTitle = { fontSize: 16, fontWeight: 800, color: BLUE, margin: "0 0 16px 0" };
const lbl       = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 };
const hint      = { fontSize: 11, color: "#9ca3af", marginTop: 4 };
const grid2     = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 };

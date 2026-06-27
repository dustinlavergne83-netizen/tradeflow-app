import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import DesktopHeader from "../Components/DesktopHeader";
import { notify, confirmDialog } from '../lib/notify';

const BRAND = { bg: "#0b3ea8", primary: "#fc6b04ff" };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const BLANK_FORM = {
  title: "TradeFlow",
  message: "Good morning {{name}}! Don't forget to check in today.",
  send_time: "07:00",
  timezone: "America/Chicago",
  days_of_week: [1, 2, 3, 4, 5], // Mon–Fri default
  notify_all: true,
  notify_employee_ids: [],
  enabled: true,
};

// ── NotificationCard — top-level so it never remounts ────────────────────────
function NotificationCard({ sn, employees, onToggleEnabled, onEdit, onDelete, onSendNow, sendingNow }) {
  const dayStr = sn.days_of_week
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");
  const [h, m] = sn.send_time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${hour12}:${m} ${ampm}`;

  const recipientLabel = sn.notify_all
    ? "All employees"
    : sn.notify_employee_ids?.length
      ? `${sn.notify_employee_ids.length} employee${sn.notify_employee_ids.length !== 1 ? "s" : ""}`
      : "No recipients";

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, border: `2px solid ${sn.enabled ? "#10b981" : "#d1d5db"}`, overflow: "hidden", marginBottom: 16 }}>
      {/* Header row */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{sn.title}</span>
            <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, backgroundColor: sn.enabled ? "#d1fae5" : "#f3f4f6", color: sn.enabled ? "#059669" : "#6b7280", fontWeight: 700 }}>
              {sn.enabled ? "Active" : "Paused"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 6, fontStyle: "italic" }}>"{sn.message}"</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
            <span>🕐 {timeStr} ({sn.timezone?.split("/")[1]?.replace("_", " ") || sn.timezone})</span>
            <span>📅 {dayStr}</span>
            <span>👥 {recipientLabel}</span>
            {sn.last_sent_at && (
              <span>✅ Last sent: {new Date(sn.last_sent_at).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={() => onSendNow(sn)}
            disabled={sendingNow === sn.id}
            style={{ backgroundColor: BRAND.primary, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: sendingNow === sn.id ? 0.6 : 1 }}
          >
            {sendingNow === sn.id ? "Sending..." : "▶ Send Now"}
          </button>
          <button
            onClick={() => onToggleEnabled(sn)}
            style={{ backgroundColor: sn.enabled ? "#fef3c7" : "#d1fae5", color: sn.enabled ? "#92400e" : "#065f46", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {sn.enabled ? "⏸ Pause" : "▶ Enable"}
          </button>
          <button
            onClick={() => onEdit(sn)}
            style={{ backgroundColor: BRAND.bg, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(sn)}
            style={{ backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NotificationForm — top-level so inputs never lose focus ──────────────────
function NotificationForm({ form, setForm, employees, saving, onSave, onCancel, isEditing }) {
  function toggleDay(d) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d],
    }));
  }

  function toggleEmployee(uid) {
    setForm((f) => {
      const ids = f.notify_employee_ids || [];
      return {
        ...f,
        notify_employee_ids: ids.includes(uid)
          ? ids.filter((x) => x !== uid)
          : [...ids, uid],
      };
    });
  }

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, border: "2px solid #0b3ea8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111" }}>
          {isEditing ? "✏️ Edit Scheduled Notification" : "➕ New Scheduled Notification"}
        </h3>
        <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left column */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Notification Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111", backgroundColor: "#fff", marginBottom: 14 }}
            placeholder="TradeFlow"
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
            Message &nbsp;<span style={{ fontWeight: 400, color: "#6b7280" }}>— use <code style={{ backgroundColor: "#f3f4f6", padding: "1px 4px", borderRadius: 4 }}>{"{{name}}"}</code> for employee's first name</span>
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            rows={3}
            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111", backgroundColor: "#fff", resize: "vertical", marginBottom: 14 }}
            placeholder="Good morning {{name}}! Reminder to check in today."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Send Time</label>
              <input
                type="time"
                value={form.send_time}
                onChange={(e) => setForm((f) => ({ ...f, send_time: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "2px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("America/", "").replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Days of Week</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {DAY_LABELS.map((label, i) => {
              const selected = form.days_of_week.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${selected ? BRAND.bg : "#d1d5db"}`, backgroundColor: selected ? BRAND.bg : "#fff", color: selected ? "#fff" : "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Active (enabled)</span>
          </label>
        </div>

        {/* Right column — recipients */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Who to Notify</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12, backgroundColor: form.notify_all ? "#d1fae5" : "#f9fafb", border: `2px solid ${form.notify_all ? "#10b981" : "#d1d5db"}`, borderRadius: 8, padding: "10px 14px" }}>
            <input
              type="checkbox"
              checked={form.notify_all}
              onChange={(e) => setForm((f) => ({ ...f, notify_all: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "#10b981" }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>All Employees</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Notify everyone in your company</div>
            </div>
          </label>

          {!form.notify_all && (
            <div>
              <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 8 }}>Select specific employees:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {employees.map((emp) => {
                  const uid = emp.user_id;
                  const selected = (form.notify_employee_ids || []).includes(uid);
                  return (
                    <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", backgroundColor: selected ? "#dbeafe" : "#f9fafb", border: `2px solid ${selected ? "#3b82f6" : "#d1d5db"}`, borderRadius: 8, padding: "8px 12px" }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleEmployee(uid)}
                        style={{ width: 14, height: 14, accentColor: "#3b82f6" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{emp.first_name} {emp.last_name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          <div style={{ marginTop: 20, backgroundColor: "#f0f4ff", borderRadius: 10, padding: 14, border: "2px solid #c7d2fe" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4338ca", marginBottom: 8 }}>📱 Notification Preview</div>
            <div style={{ backgroundColor: "#1f2937", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>TradeFlow • now</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{form.title || "TradeFlow"}</div>
              <div style={{ fontSize: 12, color: "#d1d5db" }}>{form.message.replace("{{name}}", "John") || "Your message here..."}</div>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>↑ This is what the employee's phone will show</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onSave}
          disabled={saving || !form.message.trim() || form.days_of_week.length === 0}
          style={{ backgroundColor: "#10b981", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (saving || !form.message.trim() || form.days_of_week.length === 0) ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : "💾 Save Schedule"}
        </button>
        <button
          onClick={onCancel}
          style={{ backgroundColor: "#fff", color: "#374151", border: "2px solid #d1d5db", padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ScheduledNotifications() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => { if (user) loadAll(); }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [schRes, empRes] = await Promise.all([
        supabase.from("scheduled_notifications").select("*").eq("company_id", user.id).order("send_time"),
        supabase.from("employees").select("id, user_id, first_name, last_name").order("first_name"),
      ]);
      setSchedules(schRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK_FORM });
    setShowForm(true);
  }

  function openEdit(sn) {
    setEditingId(sn.id);
    setForm({
      title: sn.title,
      message: sn.message,
      send_time: sn.send_time.substring(0, 5), // "HH:MM"
      timezone: sn.timezone,
      days_of_week: sn.days_of_week || [],
      notify_all: sn.notify_all,
      notify_employee_ids: sn.notify_employee_ids || [],
      enabled: sn.enabled,
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.message.trim() || form.days_of_week.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        company_id: user.id,
        title: form.title || "TradeFlow",
        message: form.message,
        send_time: form.send_time + ":00",
        timezone: form.timezone,
        days_of_week: form.days_of_week,
        notify_all: form.notify_all,
        notify_employee_ids: form.notify_all ? [] : (form.notify_employee_ids || []),
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from("scheduled_notifications").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("scheduled_notifications").insert([payload]);
        if (error) throw error;
      }
      setSuccessMsg(editingId ? "Schedule updated!" : "Schedule created!");
      setTimeout(() => setSuccessMsg(""), 3000);
      setShowForm(false);
      await loadAll();
    } catch (err) { notify("Error saving: " + err.message); }
    finally { setSaving(false); }
  }

  async function toggleEnabled(sn) {
    await supabase.from("scheduled_notifications").update({ enabled: !sn.enabled, updated_at: new Date().toISOString() }).eq("id", sn.id);
    await loadAll();
  }

  async function deleteSchedule(sn) {
    if (!await confirmDialog(`Delete "${sn.title}" schedule?`)) return;
    await supabase.from("scheduled_notifications").delete().eq("id", sn.id);
    await loadAll();
  }

  async function sendNow(sn) {
    setSendingNow(sn.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-scheduled-notification", {
        body: {
          schedule_id: sn.id,
          company_id: sn.company_id,
          title: sn.title,
          message: sn.message,
          notify_all: sn.notify_all,
          notify_employee_ids: sn.notify_employee_ids,
        },
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      const sent = data?.sent ?? 0;
      if (sent === 0) {
        const reason = data?.reason || "No devices received it";
        const errDetail = data?.errors?.length > 0 ? `\n\nExpo error: ${data.errors.map(e => e.message || JSON.stringify(e)).join(", ")}` : "";
        notify(`Sent to 0 devices.\n\nReason: ${reason}${errDetail}\n\nEmployees found: ${data?.employees_found ?? "unknown"}\n\nMake sure employees have opened the TradeFlow mobile app at least once to register their push token.`);
      } else if (data?.errors?.length > 0) {
        notify(`⚠️ Attempted to send to ${data.total} device(s) but had errors:\n\n${data.errors.map(e => e.message || JSON.stringify(e)).join("\n")}\n\nTickets: ${JSON.stringify(data.tickets)}`);
      } else {
        setSuccessMsg(`✅ Sent to ${sent} device${sent !== 1 ? "s" : ""}!`);
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) { notify("Error sending: " + err.message); }
    finally { setSendingNow(null); }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
        <DesktopHeader />
        <div style={{ padding: 40, textAlign: "center", color: "#fff" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <button onClick={() => nav(-1)} style={{ backgroundColor: "#374151", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
              ← Back
            </button>
            <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 700, margin: 0, marginBottom: 4 }}>⏰ Scheduled Notifications</h1>
            <p style={{ color: "#e5e7eb", fontSize: 14, margin: 0 }}>
              Send push notifications to employees at set times — no GPS or clock-in required.
              Use <code style={{ backgroundColor: "rgba(255,255,255,0.15)", padding: "1px 5px", borderRadius: 4 }}>{"{{name}}"}</code> in your message for personalization.
            </p>
          </div>
          {!showForm && (
            <button onClick={openNew} style={{ backgroundColor: BRAND.primary, color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>
              + New Schedule
            </button>
          )}
        </div>

        {successMsg && (
          <div style={{ backgroundColor: "#10b981", color: "#fff", padding: 14, borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
            {successMsg}
          </div>
        )}

        {/* How it works */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ color: "#e5e7eb", fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: "#fff" }}>ℹ️ How it works: </span>
            The schedule runs automatically every minute on the server — employees receive a push notification on their phone at the exact time you set, whether or not they're clocked in or have the app open.
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <NotificationForm
            form={form}
            setForm={setForm}
            employees={employees}
            saving={saving}
            onSave={save}
            onCancel={() => setShowForm(false)}
            isEditing={!!editingId}
          />
        )}

        {/* Schedule list */}
        {schedules.length === 0 ? (
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 40, textAlign: "center", color: "#e5e7eb" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No scheduled notifications yet</div>
            <div style={{ fontSize: 14 }}>Click "+ New Schedule" to create your first one — like a daily morning reminder for your crew.</div>
          </div>
        ) : (
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {schedules.length} Schedule{schedules.length !== 1 ? "s" : ""}
            </h2>
            {schedules.map((sn) => (
              <NotificationCard
                key={sn.id}
                sn={sn}
                employees={employees}
                onToggleEnabled={toggleEnabled}
                onEdit={openEdit}
                onDelete={deleteSchedule}
                onSendNow={sendNow}
                sendingNow={sendingNow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

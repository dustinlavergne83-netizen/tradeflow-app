import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DesktopHeader from "../Components/DesktopHeader";

const BRAND = { bg: "#0b3ea8", accent: "#fc6b04", green: "#16a34a", red: "#ef4444" };

// ─── Helpers ────────────────────────────────────────────────────────────────
function elapsed(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt12(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calcHours(start, end) {
  if (!start || !end) return "—";
  const diff = (new Date(end) - new Date(start)) / 3600000;
  return diff.toFixed(2) + " hrs";
}

function toYMD(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Tab Button ─────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        borderRadius: "10px 10px 0 0",
        border: "none",
        borderBottom: active ? `3px solid ${BRAND.accent}` : "3px solid transparent",
        background: active ? "#fff" : "#f3f4f6",
        fontWeight: active ? 800 : 600,
        color: active ? BRAND.bg : "#6b7280",
        cursor: "pointer",
        fontSize: 14,
        marginRight: 4,
      }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function TimeclockAdmin() {
  const { employee, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("live");
  const [companyId, setCompanyId] = useState(null);

  // Guard
  useEffect(() => {
    if (employee && employee.role !== "admin" && employee.role !== "supervisor") {
      navigate("/");
    }
  }, [employee, navigate]);

  // Load company_id
  useEffect(() => {
    if (!employee) return;
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("company_id")
        .eq("id", employee.id)
        .maybeSingle();
      if (data?.company_id) setCompanyId(data.company_id);
    })();
  }, [employee]);

  if (!employee) return null;

  return (
    <>
      <DesktopHeader title="⏱️ Timeclock Admin" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 0 }}>
          <TabBtn label="📊 Live"       active={tab === "live"}       onClick={() => setTab("live")} />
          <TabBtn label="📋 Timesheets" active={tab === "timesheets"} onClick={() => setTab("timesheets")} />
          <TabBtn label="🔧 Job List"   active={tab === "jobs"}       onClick={() => setTab("jobs")} />
          <TabBtn label="👷 Employees"  active={tab === "employees"}  onClick={() => setTab("employees")} />
        </div>

        <div style={{ background: "#fff", borderRadius: "0 12px 12px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", padding: 24 }}>
          {tab === "live"       && <LiveTab companyId={companyId} />}
          {tab === "timesheets" && <TimesheetsTab companyId={companyId} />}
          {tab === "jobs"       && <JobsTab companyId={companyId} />}
          {tab === "employees"  && <EmployeesTab companyId={companyId} />}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: LIVE
// ═══════════════════════════════════════════════════════════════════════════
function LiveTab({ companyId }) {
  const [clockedIn, setClockedIn] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, clock_in, user_id, clock_in_latitude, clock_in_longitude")
        .is("clock_out", null)
        .order("clock_in");

      if (!shifts?.length) { setClockedIn([]); setLoading(false); return; }

      const userIds = shifts.map(s => s.user_id).filter(Boolean);
      const [empRes, segRes] = await Promise.all([
        supabase.from("employees").select("user_id, first_name, last_name, phone").in("user_id", userIds),
        supabase.from("shift_segments").select("shift_id, project_task, start_at, end_at")
          .in("shift_id", shifts.map(s => s.id)).order("start_at", { ascending: false }),
      ]);

      const empMap = {};
      for (const e of (empRes.data || [])) empMap[e.user_id] = e;
      const segMap = {};
      for (const seg of (segRes.data || [])) {
        segMap[seg.shift_id] = segMap[seg.shift_id] || [];
        segMap[seg.shift_id].push(seg);
      }

      setClockedIn(shifts.map(s => {
        const emp = empMap[s.user_id];
        const segs = segMap[s.id] || [];
        const openSeg = segs.find(sg => !sg.end_at);
        return {
          id: s.id,
          name: emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "Unknown",
          phone: emp?.phone || "",
          clockIn: s.clock_in,
          project: openSeg?.project_task || segs[0]?.project_task || "No Project",
          lat: s.clock_in_latitude,
          lng: s.clock_in_longitude,
        };
      }));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BRAND.bg }}>
            🟢 {clockedIn.length} Employee{clockedIn.length !== 1 ? "s" : ""} Clocked In
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
            Auto-refreshes every 30s · Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          style={{ background: BRAND.bg, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}

      {!loading && clockedIn.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, background: "#f9fafb", borderRadius: 12, color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
          <p style={{ fontWeight: 700 }}>No employees are currently clocked in</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {clockedIn.map(emp => (
          <div key={emp.id} style={{
            background: "#f0fdf4",
            border: "2px solid #86efac",
            borderRadius: 14,
            padding: 18,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#111" }}>👷 {emp.name}</p>
                {emp.phone && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>📞 {emp.phone}</p>}
              </div>
              <span style={{
                background: BRAND.green, color: "#fff", borderRadius: 8,
                padding: "4px 10px", fontWeight: 800, fontSize: 13,
              }}>
                {elapsed(emp.clockIn)}
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
              <p style={{ margin: "4px 0" }}>⏰ Clocked in: <strong>{fmt12(emp.clockIn)}</strong></p>
              <p style={{ margin: "4px 0" }}>📁 Project: <strong style={{ color: BRAND.bg }}>{emp.project}</strong></p>
              {emp.lat && <p style={{ margin: "4px 0", fontSize: 11, color: "#9ca3af" }}>📍 {emp.lat.toFixed(5)}, {emp.lng.toFixed(5)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: TIMESHEETS
// ═══════════════════════════════════════════════════════════════════════════
function TimesheetsTab({ companyId }) {
  const today = toYMD(new Date());
  const weekAgo = toYMD(new Date(Date.now() - 7 * 86400000));

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [empFilter, setEmpFilter] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("employees")
        .select("id, user_id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      setEmployees(data || []);
    })();
  }, []);

  async function loadTimesheets() {
    setLoading(true);
    try {
      let q = supabase
        .from("shift_segments")
        .select("id, shift_id, user_id, project_task, start_at, end_at, is_lunch")
        .gte("start_at", startDate + "T00:00:00")
        .lte("start_at", endDate + "T23:59:59")
        .order("start_at", { ascending: false });

      const { data } = await q;
      let rows = data || [];

      // Filter by employee if selected
      if (empFilter !== "all") {
        const emp = employees.find(e => e.id === empFilter);
        if (emp?.user_id) rows = rows.filter(r => r.user_id === emp.user_id);
      }

      // Attach employee names
      const userIdMap = {};
      for (const e of employees) if (e.user_id) userIdMap[e.user_id] = `${e.first_name} ${e.last_name}`.trim();

      setSegments(rows.map(r => ({ ...r, empName: userIdMap[r.user_id] || "Unknown" })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTimesheets(); }, [startDate, endDate, empFilter, employees]);

  const totalHours = segments.reduce((sum, s) => {
    if (!s.end_at || s.is_lunch) return sum;
    return sum + (new Date(s.end_at) - new Date(s.start_at)) / 3600000;
  }, 0);

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontWeight: 900, color: BRAND.bg }}>📋 Timesheets</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Employee</label>
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
            <option value="all">All Employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        </div>
        <button onClick={loadTimesheets}
          style={{ background: BRAND.bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>
          Load
        </button>
      </div>

      {/* Summary */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "inline-block" }}>
        <span style={{ fontWeight: 900, color: BRAND.bg, fontSize: 16 }}>
          {segments.filter(s => !s.is_lunch).length} entries · {totalHours.toFixed(2)} total hours
        </span>
      </div>

      {loading && <p>Loading…</p>}

      {/* Table */}
      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                {["Employee", "Date", "Project / Task", "Clock In", "Clock Out", "Hours", "Lunch"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No entries found for this range</td></tr>
              )}
              {segments.map((s, i) => {
                const hrs = s.end_at && !s.is_lunch
                  ? ((new Date(s.end_at) - new Date(s.start_at)) / 3600000).toFixed(2)
                  : s.is_lunch ? "lunch" : "open";
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{s.empName}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{fmtDate(s.start_at)}</td>
                    <td style={{ padding: "10px 12px" }}>{s.project_task || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{fmt12(s.start_at)}</td>
                    <td style={{ padding: "10px 12px", color: s.end_at ? "#111" : "#f59e0b" }}>
                      {s.end_at ? fmt12(s.end_at) : "⏳ Open"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: s.is_lunch ? "#9ca3af" : BRAND.bg }}>
                      {s.is_lunch ? "—" : s.end_at ? hrs : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {s.is_lunch ? "✅" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: JOB LIST
// ═══════════════════════════════════════════════════════════════════════════
function JobsTab({ companyId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id, name, status")
      .order("name");
    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addJob() {
    const name = newName.trim();
    if (!name) return;
    if (!companyId) return alert("Company ID not loaded yet. Please wait.");
    setSaving(true);
    await supabase.from("projects").insert([{ name, status: "active", company_id: companyId }]);
    setNewName("");
    setSaving(false);
    await load();
  }

  async function saveEdit(id) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    await supabase.from("projects").update({ name }).eq("id", id);
    setEditId(null);
    setSaving(false);
    await load();
  }

  async function toggleActive(job) {
    const newStatus = job.status === "active" ? "inactive" : "active";
    await supabase.from("projects").update({ status: newStatus }).eq("id", job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
  }

  async function deleteJob(job) {
    if (!window.confirm(`Delete "${job.name}"? This won't affect existing time entries.`)) return;
    await supabase.from("projects").delete().eq("id", job.id);
    setJobs(prev => prev.filter(j => j.id !== job.id));
  }

  const active = jobs.filter(j => j.status === "active");
  const inactive = jobs.filter(j => j.status !== "active");

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: BRAND.bg }}>🔧 Job List</h2>
      <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 13 }}>
        Active jobs appear in the clock-in picker on the mobile app
      </p>

      {/* Add new job */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addJob()}
          placeholder="New job name (e.g. Smith Residence – Plumbing)"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        <button
          onClick={addJob}
          disabled={saving || !newName.trim()}
          style={{
            background: saving || !newName.trim() ? "#9ca3af" : BRAND.green,
            color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px",
            fontWeight: 800, cursor: saving || !newName.trim() ? "default" : "pointer", fontSize: 15,
          }}
        >
          + Add Job
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {/* Active Jobs */}
      {active.length > 0 && (
        <>
          <h3 style={{ fontWeight: 900, color: BRAND.green, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Active ({active.length})
          </h3>
          {active.map(job => <JobRow key={job.id} job={job} editId={editId} editName={editName}
            setEditId={setEditId} setEditName={setEditName} saving={saving}
            onSave={saveEdit} onToggle={toggleActive} onDelete={deleteJob} />)}
        </>
      )}

      {/* Inactive Jobs */}
      {inactive.length > 0 && (
        <>
          <h3 style={{ fontWeight: 900, color: "#9ca3af", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "24px 0 8px" }}>
            Hidden from clock-in ({inactive.length})
          </h3>
          {inactive.map(job => <JobRow key={job.id} job={job} editId={editId} editName={editName}
            setEditId={setEditId} setEditName={setEditName} saving={saving}
            onSave={saveEdit} onToggle={toggleActive} onDelete={deleteJob} />)}
        </>
      )}

      {!loading && jobs.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, background: "#f9fafb", borderRadius: 12, color: "#9ca3af", border: "2px dashed #e5e7eb" }}>
          <p style={{ fontWeight: 700 }}>No jobs yet. Add your first job above.</p>
        </div>
      )}
    </div>
  );
}

function JobRow({ job, editId, editName, setEditId, setEditName, saving, onSave, onToggle, onDelete }) {
  const isEditing = editId === job.id;
  const isActive = job.status === "active";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", background: "#fff",
      border: `1px solid ${isActive ? "#86efac" : "#e5e7eb"}`,
      borderRadius: 10, marginBottom: 8,
    }}>
      {/* Toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
        <input type="checkbox" checked={isActive} onChange={() => onToggle(job)}
          style={{ width: 18, height: 18, cursor: "pointer", accentColor: BRAND.green }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? BRAND.green : "#9ca3af" }}>
          {isActive ? "Active" : "Hidden"}
        </span>
      </label>

      {/* Name / Edit field */}
      {isEditing ? (
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === "Enter" && onSave(job.id)}
          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "2px solid " + BRAND.bg, fontSize: 15, fontWeight: 600 }}
        />
      ) : (
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: isActive ? "#111" : "#9ca3af" }}>
          {job.name}
        </span>
      )}

      {/* Buttons */}
      {isEditing ? (
        <>
          <button onClick={() => onSave(job.id)} disabled={saving}
            style={{ background: BRAND.bg, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 700, cursor: "pointer" }}>
            Save
          </button>
          <button onClick={() => setEditId(null)}
            style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button onClick={() => { setEditId(job.id); setEditName(job.name); }}
            style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            ✏️ Edit
          </button>
          <button onClick={() => onDelete(job)}
            style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: BRAND.red, borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            🗑️ Delete
          </button>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════
function EmployeesTab({ companyId }) {
  const [employees, setEmployees] = useState([]);
  const [clockedIn, setClockedIn] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [empRes, shiftRes] = await Promise.all([
        supabase.from("employees").select("id, user_id, first_name, last_name, role, phone, email, is_active").order("first_name"),
        supabase.from("shifts").select("user_id").is("clock_out", null),
      ]);
      setEmployees(empRes.data || []);
      setClockedIn(new Set((shiftRes.data || []).map(s => s.user_id)));
      setLoading(false);
    })();
  }, []);

  const active = employees.filter(e => e.is_active !== false);
  const inactive = employees.filter(e => e.is_active === false);

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: BRAND.bg }}>👷 Employees</h2>
      <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 13 }}>
        {employees.filter(e => clockedIn.has(e.user_id)).length} currently clocked in
      </p>

      {loading && <p>Loading…</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              {["Status", "Name", "Role", "Phone", "Email", "Clock Status"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((emp, i) => {
              const isClockedIn = clockedIn.has(emp.user_id);
              return (
                <tr key={emp.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: "#dcfce7", color: BRAND.green, borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>Active</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{emp.first_name} {emp.last_name}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", textTransform: "capitalize" }}>{emp.role || "employee"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{emp.phone || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{emp.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {isClockedIn
                      ? <span style={{ color: BRAND.green, fontWeight: 800 }}>🟢 Clocked In</span>
                      : <span style={{ color: "#9ca3af" }}>⚪ Out</span>
                    }
                  </td>
                </tr>
              );
            })}
            {inactive.map((emp, i) => (
              <tr key={emp.id} style={{ background: "#f9fafb", opacity: 0.6, borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ background: "#f3f4f6", color: "#9ca3af", borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>Inactive</span>
                </td>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>{emp.first_name} {emp.last_name}</td>
                <td colSpan={4} style={{ padding: "10px 12px", color: "#9ca3af" }}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

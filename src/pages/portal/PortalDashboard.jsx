import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

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

function toYMD(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Tab Button ─────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 22px",
        borderRadius: "10px 10px 0 0",
        border: "none",
        borderBottom: active ? `3px solid ${accent}` : "3px solid transparent",
        background: active ? "#fff" : "#f1f5f9",
        fontWeight: active ? 800 : 600,
        color: active ? "#0b3ea8" : "#64748b",
        cursor: "pointer",
        fontSize: 14,
        marginRight: 4,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PortalDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("live");

  // Load company + verify session
  useEffect(() => {
    (async () => {
      // Load company by slug
      const { data: co } = await supabase
        .from("companies")
        .select("id, name, logo_url, primary_color, slug")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (!co) { navigate(`/${slug}`, { replace: true }); return; }
      setCompany(co);
      setCompanyId(co.id);

      // Check session
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { navigate(`/${slug}`, { replace: true }); return; }

      // Verify admin/supervisor
      const { data: emp } = await supabase
        .from("employees")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (
        !emp ||
        emp.company_id !== co.id ||
        (emp.role !== "admin" && emp.role !== "supervisor")
      ) {
        await supabase.auth.signOut();
        navigate(`/${slug}`, { replace: true });
        return;
      }

      setChecking(false);
    })();
  }, [slug, navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate(`/${slug}`, { replace: true });
  }

  const accent = company?.primary_color || "#fc6b04";

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b3ea8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      {/* ── Top Bar ── */}
      <div style={{
        background: "#0b3ea8",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name}
              style={{ height: 36, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          ) : (
            <span style={{ fontSize: 22 }}>⏱️</span>
          )}
          <div>
            <p style={{ margin: 0, fontWeight: 900, color: "#fff", fontSize: 15 }}>{company.name}</p>
            <p style={{ margin: 0, color: "#93c5fd", fontSize: 11 }}>Admin Portal</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", borderRadius: 8, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13,
          }}
        >
          Sign Out
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 0, flexWrap: "wrap" }}>
          <TabBtn label="📊 Live"       active={tab === "live"}       onClick={() => setTab("live")}       accent={accent} />
          <TabBtn label="📋 Timesheets" active={tab === "timesheets"} onClick={() => setTab("timesheets")} accent={accent} />
          <TabBtn label="🔧 Job List"   active={tab === "jobs"}       onClick={() => setTab("jobs")}       accent={accent} />
          <TabBtn label="👷 Employees"  active={tab === "employees"}  onClick={() => setTab("employees")}  accent={accent} />
        </div>

        <div style={{
          background: "#fff",
          borderRadius: "0 12px 12px 12px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          padding: 28,
          color: "#111",
        }}>
          {tab === "live"       && <LiveTab accent={accent} />}
          {tab === "timesheets" && <TimesheetsTab accent={accent} />}
          {tab === "jobs"       && <JobsTab companyId={companyId} accent={accent} />}
          {tab === "employees"  && <EmployeesTab accent={accent} />}
        </div>
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", padding: "16px 0 32px", fontSize: 12, color: "#94a3b8" }}>
        Powered by <strong style={{ color: accent }}>TradeFlow</strong>
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: LIVE
// ═══════════════════════════════════════════════════════════════════════════
function LiveTab({ accent }) {
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
        supabase.from("shift_segments")
          .select("shift_id, project_task, start_at, end_at")
          .in("shift_id", shifts.map(s => s.id))
          .order("start_at", { ascending: false }),
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
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0b3ea8" }}>
            🟢 {clockedIn.length} Employee{clockedIn.length !== 1 ? "s" : ""} Clocked In
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Auto-refreshes every 30s · {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={load}
          style={{ background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer" }}>
          🔄 Refresh
        </button>
      </div>

      {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

      {!loading && clockedIn.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, background: "#f8fafc", borderRadius: 14, border: "2px dashed #e2e8f0" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>😴</div>
          <p style={{ fontWeight: 700, color: "#64748b" }}>No employees currently clocked in</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {clockedIn.map(emp => (
          <div key={emp.id} style={{
            background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 14, padding: 18,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: "#111" }}>👷 {emp.name}</p>
                {emp.phone && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>📞 {emp.phone}</p>}
              </div>
              <span style={{ background: "#16a34a", color: "#fff", borderRadius: 8, padding: "4px 10px", fontWeight: 800, fontSize: 13 }}>
                {elapsed(emp.clockIn)}
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <p style={{ margin: "4px 0", color: "#374151" }}>⏰ In: <strong>{fmt12(emp.clockIn)}</strong></p>
              <p style={{ margin: "4px 0", color: "#374151" }}>📁 <strong style={{ color: "#0b3ea8" }}>{emp.project}</strong></p>
              {emp.lat && <p style={{ margin: "4px 0", fontSize: 11, color: "#94a3b8" }}>📍 {emp.lat.toFixed(5)}, {emp.lng.toFixed(5)}</p>}
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
function TimesheetsTab({ accent }) {
  const today = toYMD(new Date());
  const weekAgo = toYMD(new Date(Date.now() - 7 * 86400000));

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [empFilter, setEmpFilter] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load employees (no is_active filter — matches EmployeeTimesheets.jsx which works)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("employees")
        .select("id, user_id, first_name, last_name")
        .order("first_name");
      setEmployees(data || []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Query shift_segments directly — they store user_id and start_at (same as EmployeeTimesheets.jsx)
      let segQuery = supabase
        .from("shift_segments")
        .select("id, user_id, project_task, start_at, end_at, is_lunch")
        .gte("start_at", startDate + "T00:00:00")
        .lte("start_at", endDate + "T23:59:59")
        .order("start_at", { ascending: false });

      if (empFilter !== "all") {
        const emp = employees.find(e => e.id === empFilter);
        if (emp?.user_id) segQuery = segQuery.eq("user_id", emp.user_id);
      }

      const { data: segs } = await segQuery;

      // Build name map from employees (user_id → full name)
      const nameMap = {};
      for (const e of employees) if (e.user_id) nameMap[e.user_id] = `${e.first_name} ${e.last_name}`.trim();

      setSegments((segs || []).map(seg => ({
        ...seg,
        empName: nameMap[seg.user_id] || (seg.user_id ? "Unknown" : "—"),
      })));
    } finally { setLoading(false); }
  }, [startDate, endDate, empFilter, employees]);

  // Load timesheets on mount and whenever filters change (don't require employees to be loaded first)
  useEffect(() => { load(); }, [load]);

  const totalHours = segments.reduce((s, r) => {
    if (!r.end_at || r.is_lunch) return s;
    return s + (new Date(r.end_at) - new Date(r.start_at)) / 3600000;
  }, 0);

  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontWeight: 900, color: "#0b3ea8" }}>📋 Timesheets</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        {[["From", startDate, setStartDate], ["To", endDate, setEndDate]].map(([lbl, val, set]) => (
          <div key={lbl}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{lbl}</label>
            <input type="date" value={val} onChange={e => set(e.target.value)} style={inputStyle} />
          </div>
        ))}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Employee</label>
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={inputStyle}>
            <option value="all">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>
        <button onClick={load}
          style={{ background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>
          Load
        </button>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "inline-block" }}>
        <span style={{ fontWeight: 900, color: "#0b3ea8", fontSize: 15 }}>
          {segments.filter(s => !s.is_lunch).length} entries · {totalHours.toFixed(2)} hrs total
        </span>
      </div>

      {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Employee", "Date", "Project / Task", "In", "Out", "Hours"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && segments.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No entries found</td></tr>
            )}
            {segments.map((s, i) => {
              const hrs = s.end_at && !s.is_lunch
                ? ((new Date(s.end_at) - new Date(s.start_at)) / 3600000).toFixed(2)
                : null;
              return (
              <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9", color: "#111" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111" }}>{s.empName}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{fmtDate(s.start_at)}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{s.project_task || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{fmt12(s.start_at)}</td>
                  <td style={{ padding: "10px 12px", color: s.end_at ? "#111" : "#f59e0b" }}>
                    {s.end_at ? fmt12(s.end_at) : "⏳ Open"}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: s.is_lunch ? "#94a3b8" : "#0b3ea8" }}>
                    {s.is_lunch ? "Lunch" : hrs ? hrs : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: JOB LIST
// ═══════════════════════════════════════════════════════════════════════════
function JobsTab({ companyId, accent }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("id, name, status").order("name");
    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addJob() {
    const name = newName.trim();
    if (!name) return;
    if (!companyId) return alert("Company not loaded yet.");
    setSaving(true);
    await supabase.from("projects").insert([{ name, status: "active", company_id: companyId }]);
    setNewName("");
    setSaving(false);
    load();
  }

  async function saveEdit(id) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    await supabase.from("projects").update({ name }).eq("id", id);
    setEditId(null);
    setSaving(false);
    load();
  }

  async function toggleActive(job) {
    const ns = job.status === "active" ? "inactive" : "active";
    await supabase.from("projects").update({ status: ns }).eq("id", job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: ns } : j));
  }

  async function deleteJob(job) {
    if (!window.confirm(`Delete "${job.name}"?`)) return;
    await supabase.from("projects").delete().eq("id", job.id);
    setJobs(prev => prev.filter(j => j.id !== job.id));
  }

  const active = jobs.filter(j => j.status === "active");
  const inactive = jobs.filter(j => j.status !== "active");

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: "#0b3ea8" }}>🔧 Job List</h2>
      <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>Active jobs appear in the mobile clock-in picker</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addJob()}
          placeholder="New job name…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 15 }}
        />
        <button onClick={addJob} disabled={saving || !newName.trim()}
          style={{
            background: saving || !newName.trim() ? "#94a3b8" : "#16a34a",
            color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px",
            fontWeight: 800, cursor: saving || !newName.trim() ? "default" : "pointer",
          }}>
          + Add
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {active.length > 0 && (
        <><h3 style={{ fontSize: 12, fontWeight: 900, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Active ({active.length})</h3>
          {active.map(j => <JobRow key={j.id} job={j} editId={editId} editName={editName}
            setEditId={setEditId} setEditName={setEditName} saving={saving}
            onSave={saveEdit} onToggle={toggleActive} onDelete={deleteJob} />)}
        </>
      )}
      {inactive.length > 0 && (
        <><h3 style={{ fontSize: 12, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "24px 0 8px" }}>Hidden ({inactive.length})</h3>
          {inactive.map(j => <JobRow key={j.id} job={j} editId={editId} editName={editName}
            setEditId={setEditId} setEditName={setEditName} saving={saving}
            onSave={saveEdit} onToggle={toggleActive} onDelete={deleteJob} />)}
        </>
      )}
      {!loading && jobs.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, background: "#f8fafc", borderRadius: 12, border: "2px dashed #e2e8f0", color: "#94a3b8" }}>
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
      padding: "11px 14px", background: "#fff",
      border: `1px solid ${isActive ? "#86efac" : "#e2e8f0"}`,
      borderRadius: 10, marginBottom: 8,
    }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
        <input type="checkbox" checked={isActive} onChange={() => onToggle(job)}
          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#16a34a" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#16a34a" : "#94a3b8" }}>
          {isActive ? "Active" : "Hidden"}
        </span>
      </label>

      {isEditing ? (
        <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
          onKeyDown={e => e.key === "Enter" && onSave(job.id)}
          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "2px solid #0b3ea8", fontSize: 15 }} />
      ) : (
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: isActive ? "#111" : "#94a3b8" }}>{job.name}</span>
      )}

      {isEditing ? (
        <>
          <button onClick={() => onSave(job.id)} disabled={saving}
            style={{ background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 700, cursor: "pointer" }}>Save</button>
          <button onClick={() => setEditId(null)}
            style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
        </>
      ) : (
        <>
          <button onClick={() => { setEditId(job.id); setEditName(job.name); }}
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            ✏️ Edit
          </button>
          <button onClick={() => onDelete(job)}
            style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            🗑️
          </button>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════
function EmployeesTab({ accent }) {
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
  const clockedInCount = active.filter(e => clockedIn.has(e.user_id)).length;

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: "#0b3ea8" }}>👷 Employees</h2>
      <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>
        {clockedInCount} of {active.length} active employees currently clocked in
      </p>

      {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name", "Role", "Phone", "Email", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((emp, i) => {
              const ci = clockedIn.has(emp.user_id);
              return (
                <tr key={emp.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{emp.first_name} {emp.last_name}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b", textTransform: "capitalize" }}>{emp.role || "employee"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{emp.phone || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{emp.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {ci
                      ? <span style={{ color: "#16a34a", fontWeight: 800 }}>🟢 Clocked In</span>
                      : <span style={{ color: "#94a3b8" }}>⚪ Out</span>}
                  </td>
                </tr>
              );
            })}
            {inactive.map(emp => (
              <tr key={emp.id} style={{ background: "#f8fafc", opacity: 0.5, borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#94a3b8" }}>{emp.first_name} {emp.last_name}</td>
                <td colSpan={4} style={{ padding: "10px 12px", color: "#94a3b8", fontStyle: "italic" }}>Inactive employee</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

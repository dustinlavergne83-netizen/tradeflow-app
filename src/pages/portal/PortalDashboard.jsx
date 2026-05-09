
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

function fmt24(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
          {tab === "timesheets" && <TimesheetsTab accent={accent} companyId={companyId} />}
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
function TimesheetsTab({ accent, companyId }) {
  const today = toYMD(new Date());
  const weekAgo = toYMD(new Date(Date.now() - 7 * 86400000));

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [empFilter, setEmpFilter] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Add punch modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ empId: "", date: today, inTime: "07:00", outTime: "15:30", project: "", hadLunch: false });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [empRes, jobRes] = await Promise.all([
        supabase.from("employees").select("id, user_id, first_name, last_name").order("first_name"),
        supabase.from("projects").select("id, name").eq("status", "active").order("name"),
      ]);
      setEmployees(empRes.data || []);
      setJobs(jobRes.data || []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let shiftQuery = supabase
        .from("shifts")
        .select("id, user_id, clock_in, clock_out")
        .gte("clock_in", startDate + "T00:00:00")
        .lte("clock_in", endDate + "T23:59:59")
        .order("clock_in", { ascending: false });

      if (empFilter !== "all") {
        const emp = employees.find(e => e.id === empFilter);
        if (emp?.user_id) shiftQuery = shiftQuery.eq("user_id", emp.user_id);
      }

      const { data: shifts } = await shiftQuery;
      if (!shifts?.length) { setSegments([]); setLoading(false); return; }

      const { data: segs } = await supabase
        .from("shift_segments")
        .select("id, shift_id, user_id, project_task, start_at, end_at, is_lunch")
        .in("shift_id", shifts.map(s => s.id))
        .order("start_at", { ascending: false });

      const nameMap = {};
      for (const e of employees) if (e.user_id) nameMap[e.user_id] = `${e.first_name} ${e.last_name}`.trim();

      const segsByShift = {};
      for (const seg of (segs || [])) {
        if (!segsByShift[seg.shift_id]) segsByShift[seg.shift_id] = { work: [], lunch: [] };
        if (seg.is_lunch) segsByShift[seg.shift_id].lunch.push(seg);
        else segsByShift[seg.shift_id].work.push(seg);
      }

      const rows = [];
      for (const shift of shifts) {
        const { work = [], lunch = [] } = segsByShift[shift.id] || {};
        const hadLunch = lunch.length > 0;
        const empName = nameMap[shift.user_id] || "Unknown";
        if (work.length > 0) {
          for (const seg of work) {
            const hrs = seg.end_at ? ((new Date(seg.end_at) - new Date(seg.start_at)) / 3600000).toFixed(2) : null;
            rows.push({ id: seg.id, shiftId: seg.shift_id, userId: shift.user_id, empName, start_at: seg.start_at, end_at: seg.end_at, project_task: seg.project_task, hrs, hadLunch });
          }
        } else {
          const lunchProject = lunch.length > 0 ? lunch[0].project_task : null;
          const hrs = shift.clock_out ? ((new Date(shift.clock_out) - new Date(shift.clock_in)) / 3600000).toFixed(2) : null;
          rows.push({ id: shift.id + "_s", shiftId: shift.id, userId: shift.user_id, empName, start_at: shift.clock_in, end_at: shift.clock_out, project_task: lunchProject, hrs, hadLunch });
        }
      }
      setSegments(rows);
    } finally { setLoading(false); }
  }, [startDate, endDate, empFilter, employees]);

  useEffect(() => { load(); }, [load]);

  const totalHours = segments.reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0);

  function startEdit(s) {
    setEditRow(s.id);
    setEditForm({ date: toYMD(new Date(s.start_at)), inTime: fmt24(s.start_at), outTime: s.end_at ? fmt24(s.end_at) : "", project: s.project_task || "", hadLunch: s.hadLunch, origHadLunch: s.hadLunch });
  }

  async function saveEdit(s) {
    const d = editForm.date;
    const startISO = d + "T" + editForm.inTime + ":00";
    const endISO = editForm.outTime ? d + "T" + editForm.outTime + ":00" : null;
    setEditSaving(true);
    try {
      if (String(s.id).endsWith("_s")) {
        await supabase.from("shift_segments").insert([{ user_id: s.userId, shift_id: s.shiftId, company_id: companyId, project_task: editForm.project || null, start_at: startISO, end_at: endISO, is_lunch: false }]);
        await supabase.from("shifts").update({ clock_in: startISO, clock_out: endISO }).eq("id", s.shiftId);
      } else {
        await supabase.from("shift_segments").update({ project_task: editForm.project || null, start_at: startISO, end_at: endISO }).eq("id", s.id);
      }
      // Toggle lunch segment if changed
      if (editForm.hadLunch !== editForm.origHadLunch) {
        if (editForm.hadLunch) {
          await supabase.from("shift_segments").insert([{ user_id: s.userId, shift_id: s.shiftId, company_id: companyId, project_task: editForm.project || null, start_at: d + "T12:00:00", end_at: d + "T12:30:00", is_lunch: true }]);
        } else {
          await supabase.from("shift_segments").delete().eq("shift_id", s.shiftId).eq("is_lunch", true);
        }
      }
      setEditRow(null);
      load();
    } finally { setEditSaving(false); }
  }

  async function deleteRow(s) {
    if (!window.confirm("Delete this punch?")) return;
    if (!String(s.id).endsWith("_s")) await supabase.from("shift_segments").delete().eq("id", s.id);
    load();
  }

  async function addPunch() {
    if (!addForm.empId) { alert("Please select an employee"); return; }
    const emp = employees.find(e => e.id === addForm.empId);
    if (!emp?.user_id) return;
    const startISO = addForm.date + "T" + addForm.inTime + ":00";
    const endISO = addForm.outTime ? addForm.date + "T" + addForm.outTime + ":00" : null;
    setAddSaving(true);
    try {
      const { data: existing } = await supabase.from("shifts").select("id").eq("user_id", emp.user_id).gte("clock_in", addForm.date + "T00:00:00").lte("clock_in", addForm.date + "T23:59:59").maybeSingle();
      let shiftId;
      if (existing) {
        shiftId = existing.id;
        if (endISO) await supabase.from("shifts").update({ clock_out: endISO }).eq("id", shiftId);
      } else {
        const { data: ns } = await supabase.from("shifts").insert([{ user_id: emp.user_id, company_id: companyId, clock_in: startISO, clock_out: endISO }]).select().single();
        shiftId = ns.id;
      }
      await supabase.from("shift_segments").insert([{ user_id: emp.user_id, shift_id: shiftId, company_id: companyId, project_task: addForm.project || null, start_at: startISO, end_at: endISO, is_lunch: false }]);
      if (addForm.hadLunch) {
        await supabase.from("shift_segments").insert([{ user_id: emp.user_id, shift_id: shiftId, company_id: companyId, project_task: addForm.project || null, start_at: addForm.date + "T12:00:00", end_at: addForm.date + "T12:30:00", is_lunch: true }]);
      }
      setShowAdd(false);
      setAddForm({ empId: "", date: today, inTime: "07:00", outTime: "15:30", project: "", hadLunch: false });
      load();
    } finally { setAddSaving(false); }
  }

  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 };
  const tinyIn = { padding: "5px 8px", borderRadius: 6, border: "1px solid #bfdbfe", fontSize: 13, width: "100%", boxSizing: "border-box" };

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
        <button onClick={load} style={{ background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>Load</button>
        <button onClick={() => setShowAdd(true)} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>+ Add Punch</button>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "inline-block" }}>
        <span style={{ fontWeight: 900, color: "#0b3ea8", fontSize: 15 }}>{segments.length} entries · {totalHours.toFixed(2)} hrs total</span>
      </div>

      {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Employee", "Date", "Project / Task", "In", "Out", "Hours", "Lunch", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && segments.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No entries found</td></tr>
            )}
            {segments.map((s, i) => {
              const isEditing = editRow === s.id;
              if (isEditing) return (
                <tr key={s.id} style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{s.empName}</td>
                  <td style={{ padding: "8px 6px" }}><input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={tinyIn} /></td>
                  <td style={{ padding: "8px 6px" }}>
                    <select value={editForm.project} onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))} style={tinyIn}>
                      <option value="">— No Project —</option>
                      {jobs.map(j => <option key={j.id} value={j.name}>{j.name}</option>)}
                      {editForm.project && !jobs.find(j => j.name === editForm.project) && <option value={editForm.project}>{editForm.project}</option>}
                    </select>
                  </td>
                  <td style={{ padding: "8px 6px" }}><input type="time" value={editForm.inTime} onChange={e => setEditForm(f => ({ ...f, inTime: e.target.value }))} style={tinyIn} /></td>
                  <td style={{ padding: "8px 6px" }}><input type="time" value={editForm.outTime} onChange={e => setEditForm(f => ({ ...f, outTime: e.target.value }))} style={tinyIn} /></td>
                  <td style={{ padding: "8px 6px", color: "#94a3b8", fontSize: 12 }}>auto</td>
                  <td style={{ padding: "8px 6px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="checkbox" checked={editForm.hadLunch || false} onChange={e => setEditForm(f => ({ ...f, hadLunch: e.target.checked }))} style={{ width: 15, height: 15, accentColor: "#16a34a" }} />
                      <span style={{ fontSize: 12 }}>Lunch</span>
                    </label>
                  </td>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                    <button onClick={() => saveEdit(s)} disabled={editSaving} style={{ background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 700, cursor: "pointer", marginRight: 4 }}>{editSaving ? "…" : "Save"}</button>
                    <button onClick={() => setEditRow(null)} style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontWeight: 700, cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              );
              return (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9", color: "#111" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{s.empName}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{fmtDate(s.start_at)}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{s.project_task || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{fmt12(s.start_at)}</td>
                  <td style={{ padding: "10px 12px", color: s.end_at ? "#111" : "#f59e0b" }}>{s.end_at ? fmt12(s.end_at) : "⏳ Open"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0b3ea8" }}>{s.hrs || "—"}</td>
                  <td style={{ padding: "10px 12px", color: s.hadLunch ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>{s.hadLunch ? "✓ Yes" : "No"}</td>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    <button onClick={() => startEdit(s)} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, marginRight: 4 }}>✏️</button>
                    <button onClick={() => deleteRow(s)} style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add Punch Modal ── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 20px", fontWeight: 900, color: "#0b3ea8", fontSize: 18 }}>+ Add Punch</h3>
            {[
              ["Employee", <select value={addForm.empId} onChange={e => setAddForm(f => ({ ...f, empId: e.target.value }))} style={{ ...inputStyle, width: "100%" }}>
                <option value="">— Select Employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>],
              ["Date", <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />],
              ["In Time", <input type="time" value={addForm.inTime} onChange={e => setAddForm(f => ({ ...f, inTime: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />],
              ["Out Time", <input type="time" value={addForm.outTime} onChange={e => setAddForm(f => ({ ...f, outTime: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />],
              ["Project / Task", <select value={addForm.project} onChange={e => setAddForm(f => ({ ...f, project: e.target.value }))} style={{ ...inputStyle, width: "100%" }}>
                <option value="">— No Project —</option>
                {jobs.map(j => <option key={j.id} value={j.name}>{j.name}</option>)}
              </select>],
            ].map(([lbl, ctrl]) => (
              <div key={lbl} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 4 }}>{lbl}</label>
                {ctrl}
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: addForm.hadLunch ? "#f0fdf4" : "#f8fafc", borderRadius: 10, border: `1px solid ${addForm.hadLunch ? "#86efac" : "#e2e8f0"}` }}>
                <input type="checkbox" checked={addForm.hadLunch} onChange={e => setAddForm(f => ({ ...f, hadLunch: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: "pointer" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: addForm.hadLunch ? "#16a34a" : "#64748b" }}>
                  🍽️ Employee took a lunch break
                </span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addPunch} disabled={addSaving}
                style={{ flex: 1, background: addSaving ? "#94a3b8" : "#0b3ea8", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 800, cursor: addSaving ? "default" : "pointer", fontSize: 15 }}>
                {addSaving ? "Saving…" : "Save Punch"}
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

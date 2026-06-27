
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { notify, confirmDialog } from '../../lib/notify';

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
        .select("id, name, logo_url, primary_color, slug, subscription_status, trial_ends_at")
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

        {/* ── Trial Banner ── */}
        {company && company.subscription_status === "trial" && (() => {
          const daysLeft = company.trial_ends_at
            ? Math.ceil((new Date(company.trial_ends_at) - Date.now()) / 86400000)
            : null;
          const isExpired = daysLeft !== null && daysLeft < 0;
          const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
          return (
            <div style={{
              background: isExpired ? "#fee2e2" : isUrgent ? "#fef3c7" : "#f0f9ff",
              border: `1px solid ${isExpired ? "#fca5a5" : isUrgent ? "#fcd34d" : "#bae6fd"}`,
              borderRadius: 12, padding: "12px 18px", marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            }}>
              <div>
                <span style={{ fontWeight: 800, color: isExpired ? "#dc2626" : isUrgent ? "#d97706" : "#0284c7", fontSize: 14 }}>
                  {isExpired ? "⚠️ Trial expired" : `⏳ ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
                </span>
                <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 13 }}>
                  {isExpired ? " — your portal has been suspended." : " — add a payment method to keep access."}
                </span>
              </div>
              <a href={`/${slug}/billing`} style={{
                background: isExpired ? "#dc2626" : accent, color: "#fff",
                borderRadius: 8, padding: "7px 18px", fontWeight: 800, fontSize: 13,
                textDecoration: "none", flexShrink: 0,
              }}>
                {isExpired ? "Reactivate →" : "Add Payment Method →"}
              </a>
            </div>
          );
        })()}

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
    // Convert local-time strings to proper UTC ISO strings so Supabase stores them correctly
    const startISO = new Date(d + "T" + editForm.inTime).toISOString();
    const endISO = editForm.outTime ? new Date(d + "T" + editForm.outTime).toISOString() : null;
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
          await supabase.from("shift_segments").insert([{ user_id: s.userId, shift_id: s.shiftId, company_id: companyId, project_task: editForm.project || null, start_at: new Date(d + "T12:00").toISOString(), end_at: new Date(d + "T12:30").toISOString(), is_lunch: true }]);
        } else {
          await supabase.from("shift_segments").delete().eq("shift_id", s.shiftId).eq("is_lunch", true);
        }
      }
      setEditRow(null);
      load();
    } finally { setEditSaving(false); }
  }

  async function deleteRow(s) {
    if (!await confirmDialog("Delete this punch?")) return;
    if (!String(s.id).endsWith("_s")) await supabase.from("shift_segments").delete().eq("id", s.id);
    load();
  }

  async function addPunch() {
    if (!addForm.empId) { notify("Please select an employee"); return; }
    const emp = employees.find(e => e.id === addForm.empId);
    if (!emp?.user_id) return;
    // Convert local time strings to proper UTC ISO strings so Supabase stores them correctly
    const startISO = new Date(addForm.date + "T" + addForm.inTime).toISOString();
    const endISO = addForm.outTime ? new Date(addForm.date + "T" + addForm.outTime).toISOString() : null;
    // Use UTC midnight to find shifts for this date
    const dayStart = new Date(addForm.date + "T00:00:00").toISOString();
    const dayEnd = new Date(addForm.date + "T23:59:59").toISOString();
    setAddSaving(true);
    try {
      const { data: existing } = await supabase.from("shifts").select("id").eq("user_id", emp.user_id).gte("clock_in", dayStart).lte("clock_in", dayEnd).maybeSingle();
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
        await supabase.from("shift_segments").insert([{ user_id: emp.user_id, shift_id: shiftId, company_id: companyId, project_task: addForm.project || null, start_at: new Date(addForm.date + "T12:00").toISOString(), end_at: new Date(addForm.date + "T12:30").toISOString(), is_lunch: true }]);
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
    if (!companyId) return notify("Company not loaded yet.");
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
    if (!await confirmDialog(`Delete "${job.name}"?`)) return;
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
// TAB 4: EMPLOYEES  (with invite flow)
// ═══════════════════════════════════════════════════════════════════════════
function EmployeesTab({ accent }) {
  const { slug } = useParams();
  const [employees, setEmployees] = useState([]);
  const [clockedIn, setClockedIn] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "employee" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    (async () => {
      // Get company id from slug
      const { data: co } = await supabase.from("companies").select("id").eq("slug", slug.toLowerCase()).maybeSingle();
      if (co) setCompanyId(co.id);

      const [empRes, shiftRes] = await Promise.all([
        supabase.from("employees")
          .select("id, user_id, first_name, last_name, role, phone, email, is_active, invite_token")
          .eq("company_id", co?.id || "")
          .order("first_name"),
        supabase.from("shifts").select("employee_id").is("clock_out_at", null),
      ]);
      setEmployees(empRes.data || []);
      setClockedIn(new Set((shiftRes.data || []).map(s => s.employee_id)));
      setLoading(false);
    })();
  }, [slug]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteForm.firstName.trim() || !inviteForm.email.trim()) {
      setInviteError("First name and email are required.");
      return;
    }
    setInviteError("");
    setInviting(true);
    try {
      // Generate a unique invite token
      const token = crypto.randomUUID();

      // Check if employee with this email already exists
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", inviteForm.email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        setInviteError("An employee with this email already exists.");
        setInviting(false);
        return;
      }

      // Create employee record (no user_id yet — pending invite)
      const { error: insertError } = await supabase.from("employees").insert({
        company_id: companyId,
        first_name: inviteForm.firstName.trim(),
        last_name: inviteForm.lastName.trim(),
        email: inviteForm.email.toLowerCase().trim(),
        phone: inviteForm.phone.trim() || null,
        role: inviteForm.role,
        is_active: true,
        invite_token: token,
      });

      if (insertError) throw insertError;

      // Build invite link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/${slug}/clock?invite=${token}`;
      setInviteLink(link);

      // Refresh employee list
      const { data: empRes } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, role, phone, email, is_active, invite_token")
        .eq("company_id", companyId)
        .order("first_name");
      setEmployees(empRes || []);

      // Reset form
      setInviteForm({ firstName: "", lastName: "", email: "", phone: "", role: "employee" });

    } catch (err) {
      setInviteError(err.message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  function copyInviteLink(link) {
    navigator.clipboard.writeText(link);
    notify("✅ Invite link copied!");
  }

  function buildInviteLink(token) {
    return `${window.location.origin}/${slug}/clock?invite=${token}`;
  }

  const active = employees.filter(e => e.is_active !== false);
  const inactive = employees.filter(e => e.is_active === false);
  const clockedInCount = active.filter(e => clockedIn.has(e.id)).length;
  const pendingInvites = active.filter(e => !e.user_id && e.invite_token);

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, boxSizing: "border-box", outline: "none" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontWeight: 900, color: "#0b3ea8" }}>👷 Employees</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            {clockedInCount} of {active.length} active employees currently clocked in
            {pendingInvites.length > 0 && <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 700 }}>· {pendingInvites.length} pending invite{pendingInvites.length > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteLink(""); setInviteError(""); }}
          style={{
            background: accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer",
          }}
        >
          {showInvite ? "✕ Cancel" : "➕ Invite Employee"}
        </button>
      </div>

      {/* ── Invite Form ── */}
      {showInvite && (
        <div style={{ background: "#f0f9ff", border: "2px solid #bae6fd", borderRadius: 16, padding: "24px", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontWeight: 900, color: "#0284c7", fontSize: 16 }}>📨 Invite a New Employee</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#0369a1" }}>
            Fill in their info and you'll get a link to share with them. They'll use the link to create their account and start clocking in.
          </p>

          <form onSubmit={handleInvite}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input type="text" value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="John" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Smith" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@email.com" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 555-5555" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...inputStyle, backgroundColor: "#fff" }}>
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {inviteError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {inviteError}
              </div>
            )}

            <button type="submit" disabled={inviting} style={{
              background: inviting ? "#9ca3af" : "#0284c7", color: "#fff", border: "none",
              borderRadius: 10, padding: "11px 28px", fontWeight: 800, fontSize: 15,
              cursor: inviting ? "default" : "pointer",
            }}>
              {inviting ? "⏳ Creating invite…" : "Generate Invite Link →"}
            </button>
          </form>

          {/* Invite link success */}
          {inviteLink && (
            <div style={{ marginTop: 20, background: "#dcfce7", border: "2px solid #86efac", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 900, color: "#15803d", fontSize: 15 }}>
                🎉 Invite ready! Share this link with your employee:
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <code style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0b3ea8", fontWeight: 700, wordBreak: "break-all", border: "1px solid #86efac" }}>
                  {inviteLink}
                </code>
                <button onClick={() => copyInviteLink(inviteLink)} style={{
                  background: "#16a34a", color: "#fff", border: "none", borderRadius: 8,
                  padding: "9px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0,
                }}>
                  📋 Copy Link
                </button>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#15803d" }}>
                The employee will visit this link and create their own password to activate their account.
              </p>
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

      {/* ── Employee Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name", "Role", "Phone", "Email", "Status", "Invite"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: "#374151", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((emp, i) => {
              const ci = clockedIn.has(emp.id);
              const isPending = !emp.user_id && emp.invite_token;
              return (
                <tr key={emp.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9", opacity: isPending ? 0.8 : 1 }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                    {emp.first_name} {emp.last_name}
                    {isPending && <span style={{ marginLeft: 6, fontSize: 11, color: "#f59e0b", fontWeight: 800, background: "#fef3c7", padding: "2px 8px", borderRadius: 20 }}>PENDING</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b", textTransform: "capitalize" }}>{emp.role || "employee"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{emp.phone || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{emp.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {isPending
                      ? <span style={{ color: "#f59e0b", fontWeight: 800 }}>⏳ Invite Sent</span>
                      : ci
                        ? <span style={{ color: "#16a34a", fontWeight: 800 }}>🟢 Clocked In</span>
                        : <span style={{ color: "#94a3b8" }}>⚪ Out</span>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {emp.invite_token && (
                      <button
                        onClick={() => copyInviteLink(buildInviteLink(emp.invite_token))}
                        style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#0284c7" }}
                      >
                        📋 Copy Link
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {inactive.map(emp => (
              <tr key={emp.id} style={{ background: "#f8fafc", opacity: 0.5, borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#94a3b8" }}>{emp.first_name} {emp.last_name}</td>
                <td colSpan={5} style={{ padding: "10px 12px", color: "#94a3b8", fontStyle: "italic" }}>Inactive employee</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && active.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: 12, border: "2px dashed #e2e8f0", color: "#94a3b8", marginTop: 12 }}>
            <p style={{ fontWeight: 700 }}>No employees yet. Invite your first crew member above!</p>
          </div>
        )}
      </div>
    </div>
  );
}

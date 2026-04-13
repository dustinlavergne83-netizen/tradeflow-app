import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";

const BRAND = { bg: "#0b3ea8", accent: "#fc6b04ff", primary: "#0b3ea8" };

// ─── helpers ────────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function segDate(seg) {
  const d = new Date(seg.start_at);
  return toYMD(d);
}

function calcDayHours(segs) {
  const raw = segs.reduce((sum, s) => {
    if (!s.end_at) return sum;
    return sum + (new Date(s.end_at) - new Date(s.start_at)) / 3600000;
  }, 0);
  const hasLunch = segs.some((s) => s.is_lunch);
  return Math.max(0, raw - (hasLunch ? 0.5 : 0));
}

function fmt(d, style = "time") {
  const date = new Date(d);
  if (style === "time") return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function elapsed(start) {
  const ms = Date.now() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function EmployeeTimesheets() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [segments, setSegments] = useState([]);
  const [openSegs, setOpenSegs] = useState([]); // currently clocked-in
  const [editCell, setEditCell] = useState(null); // { userId, dateStr, empName }
  const [cellSegs, setCellSegs] = useState([]);
  const [editSeg, setEditSeg] = useState(null); // segment being edited
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // ── add punch ────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false); // standalone modal
  const [addingInPanel, setAddingInPanel] = useState(false); // add inside cell panel
  const blankAdd = { userId: "", date: toYMD(new Date()), startTime: "07:00", endTime: "15:30", project: "", is_lunch: false };
  const [addForm, setAddForm] = useState(blankAdd);

  const weekDays = Array.from({ length: 7 }, (_, i) => toYMD(addDays(weekStart, i)));
  const weekEnd = weekDays[6];
  const weekLabel = `${addDays(weekStart, 0).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => { loadData(); }, [weekStart]); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: emps }, { data: segs }, { data: open }] = await Promise.all([
        supabase.from("employees").select("user_id, first_name, last_name").order("first_name"),
        supabase.from("shift_segments")
          .select("id, user_id, start_at, end_at, is_lunch, project_task")
          .gte("start_at", weekDays[0] + "T00:00:00")
          .lte("start_at", weekEnd + "T23:59:59")
          .order("start_at", { ascending: true }),
        supabase.from("shift_segments")
          .select("id, user_id, start_at, project_task")
          .is("end_at", null)
          .order("start_at", { ascending: false }),
      ]);
      setEmployees(emps || []);
      setSegments(segs || []);
      setOpenSegs(open || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getEmpName(uid) {
    const e = employees.find((x) => x.user_id === uid);
    return e ? `${e.first_name} ${e.last_name}` : "Unknown";
  }

  function getSegsForDay(uid, dateStr) {
    return segments.filter((s) => s.user_id === uid && segDate(s) === dateStr);
  }

  function getDayProjects(segs) {
    return [...new Set(segs.map((s) => s.project_task).filter(Boolean))];
  }

  // active employees this week
  const activeUids = [...new Set(segments.map((s) => s.user_id).filter(Boolean))];
  const activeEmployees = activeUids
    .map((uid) => ({ uid, name: getEmpName(uid) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function getWeekTotal(uid) {
    return weekDays.reduce((sum, d) => sum + calcDayHours(getSegsForDay(uid, d)), 0);
  }

  const grandTotal = activeEmployees.reduce((sum, e) => sum + getWeekTotal(e.uid), 0);

  // ── cell click ────────────────────────────────────────────────────────────
  function openCellEdit(uid, dateStr, empName) {
    const segs = getSegsForDay(uid, dateStr);
    setEditCell({ uid, dateStr, empName });
    setCellSegs(segs);
    setEditSeg(null);
    setEditForm({});
  }

  function startEditSeg(seg) {
    const start = new Date(seg.start_at);
    const end = seg.end_at ? new Date(seg.end_at) : null;
    setEditSeg(seg.id);
    setEditForm({
      date: toYMD(start),
      startTime: `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`,
      endTime: end ? `${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}` : "",
      project: seg.project_task || "",
      is_lunch: !!seg.is_lunch,
    });
  }

  async function saveSeg() {
    setSaving(true);
    try {
      const newStart = new Date(`${editForm.date}T${editForm.startTime}:00`);
      let newEnd = editForm.endTime ? new Date(`${editForm.date}T${editForm.endTime}:00`) : null;
      if (newEnd && newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);
      const { error } = await supabase.from("shift_segments").update({
        start_at: newStart.toISOString(),
        end_at: newEnd ? newEnd.toISOString() : null,
        project_task: editForm.project || null,
        is_lunch: editForm.is_lunch,
      }).eq("id", editSeg);
      if (error) throw error;
      setEditSeg(null);
      await loadData();
      // refresh cell segs
      if (editCell) setCellSegs(getSegsForDay(editCell.uid, editCell.dateStr));
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSeg(id) {
    if (!confirm("Delete this time entry? This cannot be undone.")) return;
    const { error } = await supabase.from("shift_segments").delete().eq("id", id);
    if (error) { alert("Delete failed: " + error.message); return; }
    await loadData();
    if (editCell) setCellSegs(getSegsForDay(editCell.uid, editCell.dateStr));
    setEditSeg(null);
  }

  async function toggleLunch(seg) {
    const newVal = !seg.is_lunch;
    // Set all segments for this employee-day to false, then set this one
    const daySegs = getSegsForDay(seg.user_id, segDate(seg));
    if (newVal) {
      // clear others
      const otherIds = daySegs.filter(s => s.id !== seg.id).map(s => s.id);
      if (otherIds.length) await supabase.from("shift_segments").update({ is_lunch: false }).in("id", otherIds);
    }
    const { error } = await supabase.from("shift_segments").update({ is_lunch: newVal }).eq("id", seg.id);
    if (error) { alert("Failed: " + error.message); return; }
    await loadData();
    if (editCell) setCellSegs(getSegsForDay(seg.user_id, segDate(seg)));
  }

  // ── create new punch ─────────────────────────────────────────────────────
  async function createSeg(form, uid) {
    if (!uid) { alert("Please select an employee."); return; }
    if (!form.startTime) { alert("Please enter a start time."); return; }
    setSaving(true);
    try {
      const newStart = new Date(`${form.date}T${form.startTime}:00`);
      let newEnd = form.endTime ? new Date(`${form.date}T${form.endTime}:00`) : null;
      if (newEnd && newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);
      const { error } = await supabase.from("shift_segments").insert({
        user_id: uid,
        start_at: newStart.toISOString(),
        end_at: newEnd ? newEnd.toISOString() : null,
        project_task: form.project || null,
        is_lunch: form.is_lunch,
      });
      if (error) throw error;
      setShowAddModal(false);
      setAddingInPanel(false);
      setAddForm(blankAdd);
      await loadData();
      // refresh panel if open
      if (editCell) setCellSegs(getSegsForDay(editCell.uid, editCell.dateStr));
      alert("✅ Punch added successfully!");
    } catch (e) {
      alert("Failed to add punch: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── email CPA (PDF attachment via Resend) ────────────────────────────────
  async function emailCPA() {
    try {
      // Build the PDF using jsPDF
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

      // Header
      doc.setFillColor(11, 62, 168);
      doc.rect(0, 0, doc.internal.pageSize.width, 60, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(252, 107, 4);
      doc.text("DML Electrical Service, LLC", 40, 30);
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`Employee Timesheets — Week of ${weekLabel}`, 40, 50);

      // Date generated
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 75);

      // Build table data — hours only (no projects)
      const dayHeaders = weekDays.map((d, i) => {
        const dt = new Date(d + "T12:00:00");
        return `${DAY_SHORT[i]}\n${dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`;
      });

      const head = [["Employee", ...dayHeaders, "TOTAL"]];

      const body = activeEmployees.map((emp) => {
        const days = weekDays.map((d) => {
          const h = calcDayHours(getSegsForDay(emp.uid, d));
          return h > 0 ? h.toFixed(1) : "—";
        });
        return [emp.name, ...days, getWeekTotal(emp.uid).toFixed(1) + "h"];
      });

      // Totals row
      const dayTotals = weekDays.map((d) =>
        activeEmployees.reduce((sum, emp) => sum + calcDayHours(getSegsForDay(emp.uid, d)), 0)
      );
      body.push(["WEEK TOTAL", ...dayTotals.map((h) => h > 0 ? h.toFixed(1) : "—"), grandTotal.toFixed(1) + "h"]);

      doc.autoTable({
        head,
        body,
        startY: 90,
        styles: { fontSize: 10, cellPadding: 6, halign: "center" },
        headStyles: { fillColor: [11, 62, 168], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 140 } },
        alternateRowStyles: { fillColor: [240, 244, 255] },
        footStyles: { fillColor: [11, 62, 168], textColor: [252, 107, 4], fontStyle: "bold" },
        didParseCell(data) {
          // Style totals row
          if (data.row.index === body.length - 1) {
            data.cell.styles.fillColor = [11, 62, 168];
            data.cell.styles.textColor = [252, 107, 4];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Convert to base64 (strip the data:application/pdf;base64, prefix)
      const pdfBase64 = doc.output("datauristring").split(",")[1];

      // Send via edge function
      const { data, error } = await supabase.functions.invoke("send-timesheet", {
        body: { weekLabel, pdfBase64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      alert(`✅ Timesheet sent to CPA (cc@sass.tax) — a copy was sent to dustin@dmlelectrical.com`);
    } catch (e) {
      alert("Failed to send email: " + e.message);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: BRAND.bg, minHeight: "100vh", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/timeclock")}
          style={{ padding: "6px 14px", backgroundColor: "transparent", border: "2px solid #fff", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          ← Back
        </button>
        <h1 style={{ color: BRAND.accent, fontSize: 28, fontWeight: 900, margin: "0 0 4px" }}>⏱ Weekly Timesheets</h1>
        <p style={{ color: "#fff", margin: 0, fontSize: 14 }}>DML Electrical</p>
      </div>

      {/* ── Live Status Bar ─────────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          🟢 Currently Clocked In
        </div>
        {openSegs.length === 0 ? (
          <div style={{ color: "#999", fontSize: 14 }}>No one is currently clocked in.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {openSegs.map((seg) => (
              <div key={seg.id} style={{ backgroundColor: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "8px 14px", fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: "#065f46" }}>{getEmpName(seg.user_id)}</span>
                <span style={{ color: "#6b7280", marginLeft: 8 }}>{elapsed(seg.start_at)} ago</span>
                {seg.project_task && (
                  <span style={{ color: "#0b3ea8", marginLeft: 8, fontSize: 12 }}>· {seg.project_task}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Week Navigation + Actions ───────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 900, fontSize: 18, color: "#0b3ea8" }}>
            ←
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Week of {weekLabel}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 900, fontSize: 18, color: "#0b3ea8" }}>
            →
          </button>
          <button onClick={() => setWeekStart(getMonday(new Date()))}
            style={{ padding: "6px 12px", backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid #fff", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            This Week
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { setAddForm(blankAdd); setShowAddModal(true); }}
            style={{ padding: "10px 18px", backgroundColor: BRAND.accent, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            ➕ Add Manual Punch
          </button>
          <button onClick={emailCPA}
            style={{ padding: "10px 18px", backgroundColor: "#059669", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            📧 Email CPA
          </button>
          <button onClick={() => window.print()}
            style={{ padding: "10px 18px", backgroundColor: "#7c3aed", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* ── Weekly Grid Table ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#999" }}>
          Loading...
        </div>
      ) : (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: BRAND.bg }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#fff", fontWeight: 700, minWidth: 160 }}>Employee</th>
                {weekDays.map((d, i) => {
                  const dt = new Date(d + "T12:00:00");
                  const isToday = toYMD(new Date()) === d;
                  return (
                    <th key={d} style={{ padding: "12px 10px", textAlign: "center", color: "#fff", fontWeight: 700, minWidth: 90, backgroundColor: isToday ? "#1e50c8" : undefined }}>
                      <div>{DAY_SHORT[i]}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
                        {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </th>
                  );
                })}
                <th style={{ padding: "12px 14px", textAlign: "center", color: BRAND.accent, fontWeight: 800, minWidth: 80 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                    No time entries for this week.
                  </td>
                </tr>
              )}
              {activeEmployees.map((emp, empIdx) => {
                const weekTotal = getWeekTotal(emp.uid);
                const isIn = openSegs.some((s) => s.user_id === emp.uid);
                return (
                  <tr key={emp.uid} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: empIdx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#111" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isIn && <span title="Currently clocked in" style={{ color: "#10b981", fontSize: 10 }}>●</span>}
                        {emp.name}
                      </div>
                    </td>
                    {weekDays.map((d) => {
                      const daySeg = getSegsForDay(emp.uid, d);
                      const hours = calcDayHours(daySeg);
                      const projects = getDayProjects(daySeg);
                      const hasLunch = daySeg.some((s) => s.is_lunch);
                      const hasOpen = daySeg.some((s) => !s.end_at);
                      const isToday = toYMD(new Date()) === d;
                      return (
                        <td key={d}
                          onClick={() => openCellEdit(emp.uid, d, emp.name)}
                          title="Click to view/edit or add punch"
                          style={{
                            padding: "10px 8px",
                            textAlign: "center",
                            cursor: "pointer",
                            backgroundColor: isToday ? "#eff6ff" : undefined,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#dbeafe"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isToday ? "#eff6ff" : (empIdx % 2 === 0 ? "#fff" : "#f9fafb"); }}
                        >
                          {daySeg.length === 0 ? (
                            <span style={{ color: "#d1d5db", fontSize: 18 }}>+</span>
                          ) : (
                            <>
                              <div style={{ fontWeight: 700, color: hasOpen ? "#f59e0b" : "#111", fontSize: 14 }}>
                                {hasOpen ? "In…" : `${hours.toFixed(1)}h`}
                                {hasLunch && <span style={{ fontSize: 10, marginLeft: 3 }} title="Lunch taken">🍽</span>}
                              </div>
                              {projects.slice(0, 2).map((p, pi) => (
                                <div key={pi} style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 88 }} title={p}>
                                  {p}
                                </div>
                              ))}
                              {projects.length > 2 && (
                                <div style={{ fontSize: 10, color: "#9ca3af" }}>+{projects.length - 2} more</div>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, fontSize: 15, color: weekTotal > 0 ? BRAND.primary : "#d1d5db" }}>
                      {weekTotal > 0 ? `${weekTotal.toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              {activeEmployees.length > 0 && (
                <tr style={{ borderTop: "3px solid #0b3ea8", backgroundColor: "#f0f4ff" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: "#111", fontSize: 13, textTransform: "uppercase" }}>Week Total</td>
                  {weekDays.map((d) => {
                    const dayTotal = activeEmployees.reduce((sum, emp) => sum + calcDayHours(getSegsForDay(emp.uid, d)), 0);
                    return (
                      <td key={d} style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: dayTotal > 0 ? "#111" : "#d1d5db" }}>
                        {dayTotal > 0 ? `${dayTotal.toFixed(1)}h` : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 900, fontSize: 16, color: BRAND.accent }}>
                    {grandTotal.toFixed(1)}h
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cell Edit Panel ─────────────────────────────────────────────── */}
      {editCell && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, backgroundColor: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.2)", zIndex: 2000, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* Panel header */}
          <div style={{ backgroundColor: BRAND.bg, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: BRAND.accent, fontWeight: 800, fontSize: 18 }}>{editCell.empName}</div>
              <div style={{ color: "#fff", fontSize: 13, marginTop: 2 }}>
                {new Date(editCell.dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>
            <button onClick={() => { setEditCell(null); setEditSeg(null); }}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ padding: 20, flex: 1 }}>
            {/* Summary */}
            <div style={{ backgroundColor: "#f0f4ff", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>DAY TOTAL</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: BRAND.primary }}>
                {calcDayHours(cellSegs).toFixed(2)}h
              </div>
              {cellSegs.some((s) => s.is_lunch) && (
                <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>🍽 30 min lunch deducted</div>
              )}
            </div>

            {/* Segments */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>Time Entries</div>
            {cellSegs.map((seg) => {
              const hours = seg.end_at
                ? ((new Date(seg.end_at) - new Date(seg.start_at)) / 3600000).toFixed(2)
                : null;
              const isEditing = editSeg === seg.id;

              return (
                <div key={seg.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                  {/* Segment header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f9fafb", borderBottom: isEditing ? "1px solid #e5e7eb" : "none" }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#111", fontSize: 14 }}>
                        {fmt(seg.start_at)} → {seg.end_at ? fmt(seg.end_at) : <span style={{ color: "#f59e0b" }}>In progress</span>}
                      </span>
                      {hours && <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 12 }}>({hours}h)</span>}
                      {seg.is_lunch && <span style={{ marginLeft: 6, fontSize: 11, color: "#f59e0b" }}>🍽</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => isEditing ? setEditSeg(null) : startEditSeg(seg)}
                        style={{ padding: "4px 10px", backgroundColor: isEditing ? "#e5e7eb" : "#3b82f6", color: isEditing ? "#111" : "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        {isEditing ? "Cancel" : "✏️ Edit"}
                      </button>
                      <button onClick={() => deleteSeg(seg.id)}
                        style={{ padding: "4px 10px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
                    </div>
                  </div>

                  {/* Project + lunch badges */}
                  {!isEditing && (
                    <div style={{ padding: "8px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {seg.project_task && (
                        <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>{seg.project_task}</span>
                      )}
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                        <input type="checkbox" checked={seg.is_lunch} onChange={() => toggleLunch(seg)} style={{ accentColor: "#f59e0b" }} />
                        Lunch taken
                      </label>
                    </div>
                  )}

                  {/* Edit form */}
                  {isEditing && (
                    <div style={{ padding: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={labelStyle}>Start Time</label>
                          <input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Time</label>
                          <input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={labelStyle}>Date</label>
                        <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} style={inputStyle} />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Project</label>
                        <input type="text" value={editForm.project} onChange={(e) => setEditForm({ ...editForm, project: e.target.value })} style={inputStyle} placeholder="Project name..." />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
                        <input type="checkbox" checked={editForm.is_lunch} onChange={(e) => setEditForm({ ...editForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                        <span style={{ fontWeight: 600 }}>🍽 Lunch break (deduct 30 min)</span>
                      </label>
                      {/* Preview */}
                      {editForm.startTime && editForm.endTime && (
                        <div style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
                          Hours: <strong>
                            {(() => {
                              const [sh, sm] = editForm.startTime.split(":").map(Number);
                              const [eh, em] = editForm.endTime.split(":").map(Number);
                              let mins = (eh * 60 + em) - (sh * 60 + sm);
                              if (mins < 0) mins += 1440;
                              return (mins / 60).toFixed(2);
                            })()}h
                          </strong>
                          {editForm.is_lunch && <span style={{ color: "#f59e0b", marginLeft: 8 }}>(-30 min lunch)</span>}
                        </div>
                      )}
                      <button onClick={saveSeg} disabled={saving}
                        style={{ width: "100%", padding: "10px 0", backgroundColor: "#10b981", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        {saving ? "Saving..." : "💾 Save Changes"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {cellSegs.length === 0 && !addingInPanel && (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: "20px 0 10px" }}>No entries for this day.</div>
            )}

            {/* ── Add Punch inline form ── */}
            {addingInPanel ? (
              <div style={{ border: "2px solid #fc6b04", borderRadius: 10, padding: 16, marginTop: 8 }}>
                <div style={{ fontWeight: 700, color: "#fc6b04", fontSize: 14, marginBottom: 12 }}>➕ New Punch</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input type="time" value={addForm.startTime} onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="time" value={addForm.endTime} onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Project (optional)</label>
                  <input type="text" value={addForm.project} onChange={(e) => setAddForm({ ...addForm, project: e.target.value })} style={inputStyle} placeholder="Project name..." />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={addForm.is_lunch} onChange={(e) => setAddForm({ ...addForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                  <span style={{ fontWeight: 600 }}>🍽 Lunch break (deduct 30 min)</span>
                </label>
                {addForm.startTime && addForm.endTime && (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
                    Hours: <strong>{(() => {
                      const [sh, sm] = addForm.startTime.split(":").map(Number);
                      const [eh, em] = addForm.endTime.split(":").map(Number);
                      let mins = (eh * 60 + em) - (sh * 60 + sm);
                      if (mins < 0) mins += 1440;
                      return (mins / 60).toFixed(2);
                    })()}h</strong>
                    {addForm.is_lunch && <span style={{ color: "#f59e0b", marginLeft: 8 }}>(-30 min lunch)</span>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => createSeg({ ...addForm, date: editCell.dateStr }, editCell.uid)} disabled={saving}
                    style={{ flex: 1, padding: "10px 0", backgroundColor: "#10b981", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {saving ? "Saving..." : "💾 Save Punch"}
                  </button>
                  <button onClick={() => { setAddingInPanel(false); setAddForm(blankAdd); }}
                    style={{ padding: "10px 16px", backgroundColor: "#e5e7eb", border: "none", borderRadius: 8, color: "#111", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAddingInPanel(true); setAddForm({ ...blankAdd, date: editCell.dateStr }); }}
                style={{ width: "100%", marginTop: 12, padding: "10px 0", backgroundColor: "#f0f4ff", border: "2px dashed #0b3ea8", borderRadius: 8, color: "#0b3ea8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                ➕ Add Punch for This Day
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overlay when panel is open */}
      {editCell && (
        <div onClick={() => { setEditCell(null); setEditSeg(null); }}
          style={{ position: "fixed", top: 0, left: 0, right: 420, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 1999 }} />
      )}

      {/* ── Standalone Add Manual Punch Modal ──────────────────────────── */}
      {showAddModal && (
        <>
          <div onClick={() => { setShowAddModal(false); setAddForm(blankAdd); }}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 3000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 460, maxWidth: "95vw", backgroundColor: "#fff", borderRadius: 14, zIndex: 3001, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* Modal header */}
            <div style={{ backgroundColor: BRAND.bg, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: BRAND.accent, fontWeight: 800, fontSize: 18 }}>➕ Add Manual Punch</div>
              <button onClick={() => { setShowAddModal(false); setAddForm(blankAdd); }}
                style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 22 }}>
              {/* Employee */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Employee</label>
                <select value={addForm.userId} onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}
                  style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  <option value="">— Select employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              {/* Date */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} style={inputStyle} />
              </div>
              {/* Times */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Clock In</label>
                  <input type="time" value={addForm.startTime} onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Clock Out</label>
                  <input type="time" value={addForm.endTime} onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })} style={inputStyle} />
                </div>
              </div>
              {/* Project */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Project (optional)</label>
                <input type="text" value={addForm.project} onChange={(e) => setAddForm({ ...addForm, project: e.target.value })} style={inputStyle} placeholder="Project name..." />
              </div>
              {/* Lunch */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
                <input type="checkbox" checked={addForm.is_lunch} onChange={(e) => setAddForm({ ...addForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                <span style={{ fontWeight: 600 }}>🍽 Lunch break (deduct 30 min)</span>
              </label>
              {/* Hours preview */}
              {addForm.startTime && addForm.endTime && (
                <div style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>
                  Total Hours: <strong>{(() => {
                    const [sh, sm] = addForm.startTime.split(":").map(Number);
                    const [eh, em] = addForm.endTime.split(":").map(Number);
                    let mins = (eh * 60 + em) - (sh * 60 + sm);
                    if (mins < 0) mins += 1440;
                    if (addForm.is_lunch) mins -= 30;
                    return Math.max(0, mins / 60).toFixed(2);
                  })()}h</strong>
                  {addForm.is_lunch && <span style={{ color: "#f59e0b", marginLeft: 8, fontSize: 12 }}>(30 min lunch deducted)</span>}
                </div>
              )}
              <button onClick={() => createSeg(addForm, addForm.userId)} disabled={saving}
                style={{ width: "100%", padding: "12px 0", backgroundColor: BRAND.accent, border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                {saving ? "Saving..." : "✅ Add Punch"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          button, .no-print { display: none !important; }
          table { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", color: "#111" };

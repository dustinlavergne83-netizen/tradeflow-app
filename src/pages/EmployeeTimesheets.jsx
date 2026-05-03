import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import logoUrl from "../assets/LOGOD.jpg";

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

/** Round a "HH:MM" string to nearest 15 min, return "HH:MM" */
function roundTimeStrTo15(timeStr) {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m;
  const rounded = Math.round(totalMins / 15) * 15;
  const rh = Math.floor(rounded / 60) % 24;
  const rm = rounded % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
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
  const total = Math.max(0, raw - (hasLunch ? 0.5 : 0));
  // Round to nearest 15-minute (0.25 hr) increment
  return Math.round(total * 4) / 4;
}

/** Format hours as quarter-hour decimal: 6.75, 7.5, 40 */
function fmtH(h) {
  if (!h) return "0";
  const r = Math.round(h * 4) / 4;
  const s = r.toFixed(2);
  // Trim unnecessary trailing zeros: 7.50 → 7.5, 40.00 → 40
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
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
  const [copiedTime, setCopiedTime] = useState(null); // {fromEmp, fromUid, day, segs, hours, hasLunch, projects}
  const [pasteModal, setPasteModal] = useState(null); // {targetUid, targetEmpName, day}
  const [pasteSaving, setPasteSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [segments, setSegments] = useState([]);
  const [openSegs, setOpenSegs] = useState([]); // currently clocked-in
  const [editCell, setEditCell] = useState(null); // { userId, dateStr, empName }
  const [cellSegs, setCellSegs] = useState([]);
  const [editSeg, setEditSeg] = useState(null); // segment being edited
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // ── reports modal ─────────────────────────────────────────────────────────
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportType, setReportType] = useState(null); // 'employee' | 'job' | 'daterange'
  const [reportFilters, setReportFilters] = useState({ employeeId: "", projectName: "", startDate: toYMD(addDays(new Date(), -30)), endDate: toYMD(new Date()) });
  const [reportLoading, setReportLoading] = useState(false);

  // ── add punch ────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false); // standalone modal
  const [addingInPanel, setAddingInPanel] = useState(false); // add inside cell panel
  const blankAdd = { userId: "", startDate: toYMD(new Date()), endDate: toYMD(new Date()), startTime: "07:00", endTime: "15:30", project: "", is_lunch: false };
  const [addForm, setAddForm] = useState(blankAdd);

  const weekDays = Array.from({ length: 7 }, (_, i) => toYMD(addDays(weekStart, i)));
  const weekEnd = weekDays[6];
  const weekLabel = `${addDays(weekStart, 0).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => { loadData(); }, [weekStart]); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: emps }, { data: segs }, { data: open }, { data: projs }] = await Promise.all([
        supabase.from("employees").select("user_id, first_name, last_name").order("first_name"),
        supabase.from("shift_segments")
          .select("id, user_id, start_at, end_at, is_lunch, project_task, project_id")
          .gte("start_at", weekDays[0] + "T00:00:00")
          .lte("start_at", weekEnd + "T23:59:59")
          .order("start_at", { ascending: true }),
        supabase.from("shift_segments")
          .select("id, user_id, start_at, project_task")
          .is("end_at", null)
          .order("start_at", { ascending: false }),
        supabase.from("projects")
          .select("id, name, status")
          .not("status", "ilike", "%complete%")
          .order("name"),
      ]);
      setEmployees(emps || []);
      setSegments(segs || []);
      setOpenSegs(open || []);
      setProjects(projs || []);
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

  // active employees this week (those with segments + any manually added)
  const [extraEmpUids, setExtraEmpUids] = useState([]);
  const [showAddEmpDropdown, setShowAddEmpDropdown] = useState(false);

  const activeUids = [...new Set(segments.map((s) => s.user_id).filter(Boolean))];
  const allShownUids = [...new Set([...activeUids, ...extraEmpUids])];
  const activeEmployees = allShownUids
    .map((uid) => {
      const emp = employees.find(e => e.user_id === uid);
      if (!emp) return null;
      return { uid, name: `${emp.first_name} ${emp.last_name}` };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Employees not yet shown (available to add)
  const availableToAdd = employees.filter(e => !allShownUids.includes(e.user_id));

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
      const rStart = roundTimeStrTo15(editForm.startTime);
      const rEnd = editForm.endTime ? roundTimeStrTo15(editForm.endTime) : "";
      if (rStart !== editForm.startTime || rEnd !== editForm.endTime) {
        setEditForm(f => ({ ...f, startTime: rStart, endTime: rEnd }));
      }
      const newStart = new Date(`${editForm.date}T${rStart}:00`);
      let newEnd = rEnd ? new Date(`${editForm.date}T${rEnd}:00`) : null;
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
      const rStart = roundTimeStrTo15(form.startTime);
      const rEnd = form.endTime ? roundTimeStrTo15(form.endTime) : "";
      const newStart = new Date(`${form.startDate}T${rStart}:00`);
      const endDateStr = form.endDate || form.startDate;
      let newEnd = rEnd ? new Date(`${endDateStr}T${rEnd}:00`) : null;

      // Create the parent shift record first (shift_segments requires a shift_id)
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .insert({
          user_id: uid,
          clock_in: newStart.toISOString(),
          clock_out: newEnd ? newEnd.toISOString() : null,
        })
        .select("id")
        .single();
      if (shiftError) throw shiftError;

      const { error } = await supabase.from("shift_segments").insert({
        user_id: uid,
        shift_id: shiftData.id,
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

  // ── load + compress logo for jsPDF (keeps PDF small for email) ──────────
  async function getLogoBase64() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 320;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75)); // ~30-50 KB
      };
      img.onerror = () => resolve(null); // graceful fallback — no logo
      img.src = logoUrl;
    });
  }

  // ── build timesheet PDF (shared by print + email) ────────────────────────
  async function buildTimesheetPDF() {
    const logoBase64 = await getLogoBase64();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.width;

    // ── Logo centered at top ──────────────────────────────────────────────
    const logoW = 220;
    const logoH = 72;
    doc.addImage(logoBase64, "JPEG", (pageW - logoW) / 2, 18, logoW, logoH);

    // ── Title ─────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text("Weekly Timesheet", pageW / 2, 108, { align: "center" });

    // ── Week range ────────────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99);
    doc.text(weekLabel, pageW / 2, 124, { align: "center" });

    // ── Thin separator line ───────────────────────────────────────────────
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(40, 134, pageW - 40, 134);

    // ── Generated date ────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      pageW / 2, 146, { align: "center" }
    );

    // ── Table — hours only, no blue fills ────────────────────────────────
    const dayHeaders = weekDays.map((d, i) => {
      const dt = new Date(d + "T12:00:00");
      return `${DAY_SHORT[i]}\n${dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`;
    });

    const head = [["Employee", ...dayHeaders, "Total"]];

    const body = activeEmployees.map((emp) => {
      const days = weekDays.map((d) => {
        const h = calcDayHours(getSegsForDay(emp.uid, d));
        return h > 0 ? h.toFixed(2) : "—";
      });
      return [emp.name, ...days, getWeekTotal(emp.uid).toFixed(2)];
    });

    const dayTotals = weekDays.map((d) =>
      activeEmployees.reduce((sum, emp) => sum + calcDayHours(getSegsForDay(emp.uid, d)), 0)
    );
    body.push(["WEEK TOTAL", ...dayTotals.map((h) => h > 0 ? h.toFixed(2) : "—"), grandTotal.toFixed(2)]);

    doc.autoTable({
      head,
      body,
      startY: 156,
      styles: { fontSize: 10, cellPadding: 7, halign: "center", valign: "middle", lineColor: [209, 213, 219], lineWidth: 0.4 },
      // Light gray header — no dark blue
      headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold", fontSize: 10, lineColor: [209, 213, 219], lineWidth: 0.4 },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 160 },
        8: { fillColor: [255, 251, 235], fontStyle: "bold", textColor: [17, 24, 39] },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      didParseCell(data) {
        // WEEK TOTAL row — light orange tint, bold, no dark blue
        if (data.row.index === body.length - 1) {
          data.cell.styles.fillColor = [255, 247, 237];
          data.cell.styles.textColor = [180, 70, 0];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    return doc;
  }

  // ── generate report PDF ──────────────────────────────────────────────────
  async function generateReport() {
    if (!reportFilters.startDate || !reportFilters.endDate) { alert("Please select a date range."); return; }
    if (reportType === "employee" && !reportFilters.employeeId) { alert("Please select an employee."); return; }
    if (reportType === "job" && !reportFilters.projectName) { alert("Please select a project."); return; }
    setReportLoading(true);
    try {
      const logoBase64 = await getLogoBase64();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.width;

      // Logo
      const lw = 180, lh = 59;
      doc.addImage(logoBase64, "JPEG", (pageW - lw) / 2, 18, lw, lh);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(17, 24, 39);

      const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const rangeLabel = `${fmtDate(reportFilters.startDate)} – ${fmtDate(reportFilters.endDate)}`;

      if (reportType === "employee") {
        const emp = employees.find(e => e.user_id === reportFilters.employeeId);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
        doc.text(`Employee Hours Report`, pageW / 2, 92, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(75, 85, 99);
        doc.text(empName, pageW / 2, 108, { align: "center" });
        doc.text(rangeLabel, pageW / 2, 122, { align: "center" });

        const { data: segs } = await supabase.from("shift_segments")
          .select("start_at, end_at, is_lunch, project_task")
          .eq("user_id", reportFilters.employeeId)
          .gte("start_at", reportFilters.startDate + "T00:00:00")
          .lte("start_at", reportFilters.endDate + "T23:59:59")
          .order("start_at");

        // Group by date
        const byDate = {};
        (segs || []).forEach(s => {
          const d = s.start_at.split("T")[0];
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(s);
        });

        let totalHours = 0;
        const body = Object.entries(byDate).map(([date, daySegs]) => {
          const h = calcDayHours(daySegs);
          totalHours += h;
          const projs = [...new Set(daySegs.map(s => s.project_task).filter(Boolean))].join(", ") || "—";
          const hasLunch = daySegs.some(s => s.is_lunch);
          return [
            new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
            h.toFixed(2),
            hasLunch ? "Yes" : "—",
            projs,
          ];
        });
        body.push(["TOTAL", totalHours.toFixed(2), "", ""]);

        doc.autoTable({
          head: [["Date", "Hours", "Lunch", "Project(s)"]],
          body,
          startY: 136,
          styles: { fontSize: 10, cellPadding: 6, lineColor: [209, 213, 219], lineWidth: 0.4 },
          headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 60, halign: "center" }, 2: { cellWidth: 50, halign: "center" }, 3: {} },
          didParseCell(data) {
            if (data.row.index === body.length - 1) {
              data.cell.styles.fillColor = [255, 247, 237];
              data.cell.styles.textColor = [180, 70, 0];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        doc.save(`Hours_${empName.replace(/\s/g, "_")}_${reportFilters.startDate}.pdf`);

      } else if (reportType === "job") {
        doc.text(`Job/Project Report`, pageW / 2, 92, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(75, 85, 99);
        doc.text(reportFilters.projectName, pageW / 2, 108, { align: "center" });
        doc.text(rangeLabel, pageW / 2, 122, { align: "center" });

        const { data: segs } = await supabase.from("shift_segments")
          .select("start_at, end_at, is_lunch, user_id, project_task")
          .eq("project_task", reportFilters.projectName)
          .gte("start_at", reportFilters.startDate + "T00:00:00")
          .lte("start_at", reportFilters.endDate + "T23:59:59")
          .order("start_at");

        // Group by employee
        const byEmp = {};
        (segs || []).forEach(s => {
          if (!byEmp[s.user_id]) byEmp[s.user_id] = [];
          byEmp[s.user_id].push(s);
        });

        // Per-day rows
        const allDates = [...new Set((segs || []).map(s => s.start_at.split("T")[0]))].sort();
        const empIds = Object.keys(byEmp);
        const empNames = empIds.map(uid => { const e = employees.find(x => x.user_id === uid); return e ? `${e.first_name} ${e.last_name}` : uid; });

        const body = allDates.map(date => {
          const row = [new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })];
          empIds.forEach(uid => {
            const daySegs = (byEmp[uid] || []).filter(s => s.start_at.split("T")[0] === date);
            const h = calcDayHours(daySegs);
            row.push(h > 0 ? h.toFixed(2) : "—");
          });
          return row;
        });
        const totals = ["TOTAL", ...empIds.map(uid => {
          const h = calcDayHours(byEmp[uid] || []);
          return h.toFixed(2);
        })];
        body.push(totals);

        doc.autoTable({
          head: [["Date", ...empNames]],
          body,
          startY: 136,
          styles: { fontSize: 10, cellPadding: 6, halign: "center", lineColor: [209, 213, 219], lineWidth: 0.4 },
          headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
          columnStyles: { 0: { halign: "left" } },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          didParseCell(data) {
            if (data.row.index === body.length - 1) {
              data.cell.styles.fillColor = [255, 247, 237];
              data.cell.styles.textColor = [180, 70, 0];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        doc.save(`Job_Report_${reportFilters.projectName.replace(/\s/g, "_")}_${reportFilters.startDate}.pdf`);

      } else if (reportType === "daterange") {
        doc.text(`All Employee Hours Report`, pageW / 2, 92, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(75, 85, 99);
        doc.text(rangeLabel, pageW / 2, 108, { align: "center" });

        const { data: segs } = await supabase.from("shift_segments")
          .select("start_at, end_at, is_lunch, user_id, project_task")
          .gte("start_at", reportFilters.startDate + "T00:00:00")
          .lte("start_at", reportFilters.endDate + "T23:59:59")
          .order("start_at");

        // Group by employee
        const byEmp = {};
        (segs || []).forEach(s => {
          if (!byEmp[s.user_id]) byEmp[s.user_id] = [];
          byEmp[s.user_id].push(s);
        });

        let grandTot = 0;
        const body = Object.entries(byEmp).map(([uid, empSegs]) => {
          const emp = employees.find(e => e.user_id === uid);
          const name = emp ? `${emp.first_name} ${emp.last_name}` : uid;
          const h = calcDayHours(empSegs);
          grandTot += h;
          const projs = [...new Set(empSegs.map(s => s.project_task).filter(Boolean))].join(", ") || "—";
          return [name, h.toFixed(2), projs];
        }).sort((a, b) => a[0].localeCompare(b[0]));
        body.push(["TOTAL", grandTot.toFixed(2), ""]);

        doc.autoTable({
          head: [["Employee", "Total Hours", "Projects Worked"]],
          body,
          startY: 124,
          styles: { fontSize: 10, cellPadding: 6, lineColor: [209, 213, 219], lineWidth: 0.4 },
          headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
          columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 80, halign: "center" }, 2: {} },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          didParseCell(data) {
            if (data.row.index === body.length - 1) {
              data.cell.styles.fillColor = [255, 247, 237];
              data.cell.styles.textColor = [180, 70, 0];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        doc.save(`All_Employees_${reportFilters.startDate}_to_${reportFilters.endDate}.pdf`);
      }

      setShowReportsModal(false);
      setReportType(null);
    } catch (e) {
      alert("Report failed: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }

  // ── print: download PDF ──────────────────────────────────────────────────
  async function printTimesheet() {
    try {
      const doc = await buildTimesheetPDF();
      const safeLabel = weekLabel.replace(/[^a-z0-9]/gi, "_");
      doc.save(`Weekly_Timesheet_${safeLabel}.pdf`);
    } catch (e) {
      alert("PDF generation failed: " + e.message);
      console.error("printTimesheet error:", e);
    }
  }

  // ── email CPA (PDF attachment via Resend) ────────────────────────────────
  async function emailCPA() {
    try {
      const doc = await buildTimesheetPDF();
      const pdfBase64 = doc.output("datauristring").split(",")[1];

      // Use raw fetch so we always get the actual response body (even on 500)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/send-timesheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ weekLabel, pdfBase64 }),
      });

      const result = await resp.json();
      console.log("send-timesheet response:", resp.status, result);

      if (!resp.ok || result?.error) {
        throw new Error(result?.error || `Server error ${resp.status}`);
      }

      alert(`✅ Timesheet PDF sent to dustin@dmlelectrical.com — forward it to your CPA from there.\n\n(Note: to send directly to cc@sass.tax you'll need a verified domain in Resend.)`);
    } catch (e) {
      alert("Email failed: " + e.message);
      console.error("emailCPA error:", e);
    }
  }

  async function pasteTimeToEmployee() {
    if (!pasteModal || !copiedTime) return;
    setPasteSaving(true);
    try {
      const { targetUid } = pasteModal;
      const { day, segs } = copiedTime;

      // Find existing shift for target employee on this day
      const { data: existingShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("user_id", targetUid)
        .gte("clock_in", day + "T00:00:00")
        .lte("clock_in", day + "T23:59:59")
        .limit(1);

      let shiftId;
      if (existingShifts && existingShifts.length > 0) {
        shiftId = existingShifts[0].id;
      } else {
        const firstSeg = segs[0];
        const lastSeg = segs[segs.length - 1];
        const { data: newShift, error: shiftErr } = await supabase
          .from("shifts")
          .insert({ user_id: targetUid, clock_in: firstSeg.start_at, clock_out: lastSeg.end_at || null })
          .select()
          .single();
        if (shiftErr) throw shiftErr;
        shiftId = newShift.id;
      }

      for (const sourceSeg of segs) {
        const { error: segErr } = await supabase.from("shift_segments").insert({
          shift_id: shiftId,
          user_id: targetUid,
          start_at: sourceSeg.start_at,
          end_at: sourceSeg.end_at || null,
          project_task: sourceSeg.project_task || null,
          project_id: sourceSeg.project_id || null,
          is_lunch: sourceSeg.is_lunch || false,
        });
        if (segErr) throw segErr;
      }

      setPasteModal(null);
      await loadData();
    } catch (err) {
      alert("Paste failed: " + err.message);
    } finally {
      setPasteSaving(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: BRAND.bg, minHeight: "100vh", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
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
          <button onClick={() => navigate("/time-off")}
            style={{ padding: "10px 18px", backgroundColor: "#10b981", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            🏖️ Time Off Requests
          </button>
          <button onClick={() => navigate("/pending-jobs")}
            style={{ padding: "10px 18px", backgroundColor: "#f59e0b", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            📋 Pending Jobs
          </button>
          <button onClick={() => { setShowReportsModal(true); setReportType(null); }}
            style={{ padding: "10px 18px", backgroundColor: "#2563eb", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            📊 Reports
          </button>
          <button onClick={emailCPA}
            style={{ padding: "10px 18px", backgroundColor: "#059669", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            📧 Email CPA
          </button>
          <button onClick={printTimesheet}
            style={{ padding: "10px 18px", backgroundColor: "#7c3aed", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Clipboard Banner */}
      {copiedTime && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", backgroundColor: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div style={{ flex: 1, fontSize: 13, color: "#111" }}>
            <strong>Copied:</strong> {copiedTime.fromEmp} on {new Date(copiedTime.day + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} — {fmtH(copiedTime.hours)}h{copiedTime.hasLunch ? " 🍽️" : ""}
            <span style={{ marginLeft: 8, fontSize: 12, color: "#92400e" }}>← Click 📋 on any empty day cell to paste</span>
          </div>
          <button onClick={() => setCopiedTime(null)} style={{ border: "none", background: "#fde68a", color: "#92400e", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✕ Clear</button>
        </div>
      )}

      {/* ── Weekly Grid Table ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#999" }}>
          Loading...
        </div>
      ) : (
        <div id="timesheet-print-area" style={{ backgroundColor: "#fff", borderRadius: 12, overflowX: "auto" }}>
          {/* Print-only header */}
          <div id="timesheet-print-header">
            <div style={{ borderBottom: "3px solid #0b3ea8", paddingBottom: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0b3ea8" }}>DML Electrical Service, LLC</div>
              <div style={{ fontSize: 14, color: "#374151", marginTop: 4 }}>Employee Timesheets — Week of {weekLabel}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Printed: {new Date().toLocaleString()}</div>
            </div>
          </div>
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
                            copiedTime && copiedTime.day === d ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPasteModal({ targetUid: emp.uid, targetEmpName: emp.name, day: d }); }}
                                style={{ border: "2px solid #3b82f6", background: "#eff6ff", color: "#2563eb", borderRadius: 6, fontSize: 11, padding: "3px 7px", cursor: "pointer", fontWeight: 700 }}
                              >
                                📋 Paste
                              </button>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 18 }}>+</span>
                            )
                          ) : (
                            <>
                              <div style={{ fontWeight: 700, color: hasOpen ? "#f59e0b" : "#111", fontSize: 14 }}>
                                {hasOpen ? "In…" : (
                                  <span>
                                    {fmtH(hours)}h
                                    <button
                                      title={`Copy ${emp.name}'s time`}
                                      onClick={(e) => { e.stopPropagation(); setCopiedTime({ fromEmp: emp.name, fromUid: emp.uid, day: d, segs: daySeg, hours, hasLunch, projects }); }}
                                      style={{ marginLeft: 4, border: "none", background: copiedTime?.fromUid === emp.uid && copiedTime?.day === d ? "#10b981" : "#e5e7eb", color: copiedTime?.fromUid === emp.uid && copiedTime?.day === d ? "#fff" : "#374151", borderRadius: 4, fontSize: 10, padding: "1px 4px", cursor: "pointer" }}
                                    >📋</button>
                                  </span>
                                )}
                                {hasLunch && <span style={{ fontSize: 10, marginLeft: 3 }} title="Lunch taken">🍽</span>}
                              </div>
                              {projects.slice(0, 2).map((p, pi) => (
                                <div key={pi} className="print-hide" style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 88 }} title={p}>
                                  {p}
                                </div>
                              ))}
                              {projects.length > 2 && (
                                <div className="print-hide" style={{ fontSize: 10, color: "#9ca3af" }}>+{projects.length - 2} more</div>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, fontSize: 15, color: weekTotal > 0 ? BRAND.primary : "#d1d5db" }}>
                      {weekTotal > 0 ? `${fmtH(weekTotal)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
              {/* Add Employee Row button */}
              <tr>
                <td colSpan={9} style={{ padding: "8px 16px", borderTop: "1px solid #e5e7eb" }}>
                  {showAddEmpDropdown ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <select
                        autoFocus
                        onChange={(e) => {
                          if (e.target.value) {
                            setExtraEmpUids(prev => [...prev, e.target.value]);
                          }
                          setShowAddEmpDropdown(false);
                        }}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #0b3ea8", fontSize: 14, flex: 1, backgroundColor: "#fff", color: "#111" }}
                        defaultValue=""
                      >
                        <option value="" style={{ color: "#111" }}>— Select employee to add —</option>
                        {availableToAdd.map(emp => (
                          <option key={emp.user_id} value={emp.user_id} style={{ color: "#111" }}>{emp.first_name} {emp.last_name}</option>
                        ))}
                      </select>
                      <button onClick={() => setShowAddEmpDropdown(false)} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 8, background: "#f3f4f6", color: "#111", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddEmpDropdown(true)}
                      style={{ padding: "6px 14px", border: "2px dashed #0b3ea8", borderRadius: 8, background: "#f0f4ff", color: "#0b3ea8", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                    >
                      ➕ Add Employee Row
                    </button>
                  )}
                </td>
              </tr>

              {/* Totals row */}
              {activeEmployees.length > 0 && (
                <tr style={{ borderTop: "3px solid #0b3ea8", backgroundColor: "#f0f4ff" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: "#111", fontSize: 13, textTransform: "uppercase" }}>Week Total</td>
                  {weekDays.map((d) => {
                    const dayTotal = activeEmployees.reduce((sum, emp) => sum + calcDayHours(getSegsForDay(emp.uid, d)), 0);
                    return (
                      <td key={d} style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: dayTotal > 0 ? "#111" : "#d1d5db" }}>
                        {dayTotal > 0 ? `${fmtH(dayTotal)}h` : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 900, fontSize: 16, color: BRAND.accent }}>
                    {fmtH(grandTotal)}h
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
                          <input type="time" step="900" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} onBlur={(e) => setEditForm(f => ({ ...f, startTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Time</label>
                          <input type="time" step="900" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} onBlur={(e) => setEditForm(f => ({ ...f, endTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
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
                      <label style={lunchLabelStyle}>
                        <input type="checkbox" checked={editForm.is_lunch} onChange={(e) => setEditForm({ ...editForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                        <span>🍽 Lunch break (deduct 30 min)</span>
                      </label>
                      {/* Preview */}
                      {editForm.startTime && editForm.endTime && (
                        <div style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#111" }}>
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
                    <input type="time" step="900" value={addForm.startTime} onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })} onBlur={(e) => setAddForm(f => ({ ...f, startTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="time" step="900" value={addForm.endTime} onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })} onBlur={(e) => setAddForm(f => ({ ...f, endTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Project (optional)</label>
                  <select value={addForm.project} onChange={(e) => setAddForm({ ...addForm, project: e.target.value })} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                    <option value="">— No project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <label style={lunchLabelStyle}>
                  <input type="checkbox" checked={addForm.is_lunch} onChange={(e) => setAddForm({ ...addForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                  <span>🍽 Lunch break (deduct 30 min)</span>
                </label>
                {addForm.startTime && addForm.endTime && (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#111" }}>
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
                  <button onClick={() => createSeg({ ...addForm, startDate: editCell.dateStr, endDate: editCell.dateStr }, editCell.uid)} disabled={saving}
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
              <button onClick={() => { setAddingInPanel(true); setAddForm({ ...blankAdd, startDate: editCell.dateStr, endDate: editCell.dateStr }); }}
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
              {/* Dates + Times */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Clock-In Date</label>
                  <input type="date" value={addForm.startDate} onChange={(e) => setAddForm({ ...addForm, startDate: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Clock-Out Date</label>
                  <input type="date" value={addForm.endDate} onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Clock In</label>
                  <input type="time" step="900" value={addForm.startTime} onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })} onBlur={(e) => setAddForm(f => ({ ...f, startTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Clock Out</label>
                  <input type="time" step="900" value={addForm.endTime} onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })} onBlur={(e) => setAddForm(f => ({ ...f, endTime: roundTimeStrTo15(e.target.value) }))} style={inputStyle} />
                </div>
              </div>
              {/* Project */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Project (optional)</label>
                <select value={addForm.project} onChange={(e) => setAddForm({ ...addForm, project: e.target.value })} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  <option value="">— No project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              {/* Lunch */}
              <label style={{ ...lunchLabelStyle, marginBottom: 16 }}>
                <input type="checkbox" checked={addForm.is_lunch} onChange={(e) => setAddForm({ ...addForm, is_lunch: e.target.checked })} style={{ accentColor: "#f59e0b", width: 16, height: 16 }} />
                <span>🍽 Lunch break (deduct 30 min)</span>
              </label>
              {/* Hours preview */}
              {addForm.startTime && addForm.endTime && (
                <div style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#111" }}>
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

      {/* ── Reports Modal ────────────────────────────────────────────────── */}
      {showReportsModal && (
        <>
          <div onClick={() => { setShowReportsModal(false); setReportType(null); }}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 4000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 520, maxWidth: "95vw", backgroundColor: "#fff", borderRadius: 16, zIndex: 4001, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
            {/* Modal header */}
            <div style={{ backgroundColor: "#2563eb", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>📊 Generate Report</div>
              <button onClick={() => { setShowReportsModal(false); setReportType(null); }}
                style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* ── Step 1: Pick report type ── */}
              {!reportType && (
                <>
                  <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>Select the type of report you want to generate:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { key: "employee", icon: "👤", label: "Employee Hours Report", desc: "Hours for one employee over any date range — daily breakdown by project" },
                      { key: "job", icon: "🏗️", label: "Job / Project Report", desc: "All employees who worked on a specific project — hours per day" },
                      { key: "daterange", icon: "📅", label: "All Employees Summary", desc: "Total hours for every employee across any date range" },
                    ].map((opt) => (
                      <button key={opt.key} onClick={() => setReportType(opt.key)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", border: "2px solid #e5e7eb", borderRadius: 12, cursor: "pointer", backgroundColor: "#fff", textAlign: "left", transition: "border-color 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.backgroundColor = "#eff6ff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.backgroundColor = "#fff"; }}
                      >
                        <span style={{ fontSize: 28, lineHeight: 1 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 3 }}>{opt.label}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Step 2: Filters ── */}
              {reportType && (
                <>
                  <button onClick={() => setReportType(null)}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 }}>
                    ← Back to report types
                  </button>

                  <div style={{ fontWeight: 800, fontSize: 17, color: "#111", marginBottom: 18 }}>
                    {reportType === "employee" && "👤 Employee Hours Report"}
                    {reportType === "job" && "🏗️ Job / Project Report"}
                    {reportType === "daterange" && "📅 All Employees Summary"}
                  </div>

                  {/* Employee picker */}
                  {reportType === "employee" && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Employee</label>
                      <select value={reportFilters.employeeId}
                        onChange={(e) => setReportFilters({ ...reportFilters, employeeId: e.target.value })}
                        style={{ ...inputStyle, backgroundColor: "#fff" }}>
                        <option value="">— Select employee —</option>
                        {employees.map((emp) => (
                          <option key={emp.user_id} value={emp.user_id}>{emp.first_name} {emp.last_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Project picker */}
                  {reportType === "job" && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Project / Job</label>
                      <select value={reportFilters.projectName}
                        onChange={(e) => setReportFilters({ ...reportFilters, projectName: e.target.value })}
                        style={{ ...inputStyle, backgroundColor: "#fff" }}>
                        <option value="">— Select project —</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date range */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input type="date" value={reportFilters.startDate}
                        onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input type="date" value={reportFilters.endDate}
                        onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                        style={inputStyle} />
                    </div>
                  </div>

                  {/* Quick date range shortcuts */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                    {[
                      { label: "Last 7 days", days: 7 },
                      { label: "Last 30 days", days: 30 },
                      { label: "Last 90 days", days: 90 },
                      { label: "This year", year: true },
                    ].map((r) => (
                      <button key={r.label}
                        onClick={() => {
                          const end = toYMD(new Date());
                          const start = r.year
                            ? `${new Date().getFullYear()}-01-01`
                            : toYMD(addDays(new Date(), -(r.days)));
                          setReportFilters({ ...reportFilters, startDate: start, endDate: end });
                        }}
                        style={{ padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 20, fontSize: 12, cursor: "pointer", backgroundColor: "#f9fafb", color: "#374151", fontWeight: 600 }}>
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <button onClick={generateReport} disabled={reportLoading}
                    style={{ width: "100%", padding: "13px 0", backgroundColor: reportLoading ? "#93c5fd" : "#2563eb", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 16, cursor: reportLoading ? "not-allowed" : "pointer" }}>
                    {reportLoading ? "⏳ Generating PDF..." : "📥 Download Report PDF"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Paste Confirmation Modal */}
      {pasteModal && copiedTime && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000, padding: 20 }}
          onClick={() => setPasteModal(null)}
        >
          <div
            style={{ backgroundColor: "#fff", borderRadius: 12, maxWidth: 460, width: "100%", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>📋 Paste Time Entry</h3>
              <button onClick={() => setPasteModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>

            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: "#166534", marginBottom: 6 }}>Copying from: {copiedTime.fromEmp}</div>
              <div style={{ color: "#374151" }}>📅 Date: <strong>{new Date(copiedTime.day + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong></div>
              <div style={{ color: "#374151" }}>⏱ Hours: <strong>{fmtH(copiedTime.hours)}h</strong></div>
              {copiedTime.projects && copiedTime.projects.length > 0 && (
                <div style={{ color: "#374151" }}>📁 Projects: <strong>{copiedTime.projects.join(", ")}</strong></div>
              )}
              <div style={{ color: "#374151" }}>🍽️ Lunch: <strong>{copiedTime.hasLunch ? "Yes (−30 min)" : "No"}</strong></div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Paste to employee:</label>
              <select
                value={pasteModal.targetUid}
                onChange={(e) => {
                  const emp = employees.find(x => x.user_id === e.target.value);
                  setPasteModal(p => ({ ...p, targetUid: e.target.value, targetEmpName: emp ? `${emp.first_name} ${emp.last_name}` : "" }));
                }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #d1d5db", fontSize: 14, backgroundColor: "#fff" }}
              >
                {employees
                  .filter(e => e.user_id !== copiedTime.fromUid)
                  .map(e => (
                    <option key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</option>
                  ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={pasteTimeToEmployee}
                disabled={pasteSaving}
                style={{ flex: 1, backgroundColor: "#0b3ea8", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: pasteSaving ? "not-allowed" : "pointer", opacity: pasteSaving ? 0.7 : 1 }}
              >
                {pasteSaving ? "Pasting…" : "✅ Confirm Paste"}
              </button>
              <button
                onClick={() => setPasteModal(null)}
                disabled={pasteSaving}
                style={{ flex: 1, backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @page { size: landscape; margin: 20px; }

        @media print {
          /* Make everything invisible but keep layout so absolute positioning works */
          body * { visibility: hidden; }

          /* Show only the timesheet area — use absolute (NOT fixed) so it doesn't repeat */
          #timesheet-print-area {
            visibility: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          #timesheet-print-area * { visibility: visible !important; }

          /* Print header */
          #timesheet-print-header {
            display: block !important;
            margin-bottom: 14px;
            padding: 0 8px;
          }

          /* Hide job/project names — hours only */
          .print-hide { display: none !important; visibility: hidden !important; }

          body { background: white !important; }
          table { font-size: 12px !important; width: 100% !important; border-collapse: collapse !important; }
          th, td { padding: 8px 10px !important; }
        }

        /* Hide the print header on screen */
        @media screen {
          #timesheet-print-header { display: none; }
        }
      `}</style>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", color: "#111", backgroundColor: "#fff", colorScheme: "light" };
const lunchLabelStyle = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer", color: "#374151", fontWeight: 600 };

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const BRAND = { bg: "#0b3ea8", accent: "#fc6b04ff" };

const TABS = ["🏦 Banked OT", "💸 Pay Out", "📋 History"];

export default function OvertimeBank() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);

  // Data
  const [bankRecords, setBankRecords] = useState([]);   // ot_bank_entries with status='banked'
  const [paidRecords, setPaidRecords] = useState([]);   // ot_bank_entries with status='paid'
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  // Pay Out modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Add bank entry modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    employee_id: "",
    project_id: "",
    week_start: "",
    regular_hours: 40,
    actual_hours: "",
    ot_hours: "",
    hourly_rate: "",
    notes: "",
  });

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: entries }, { data: emps }, { data: projs }] = await Promise.all([
        supabase.from("ot_bank_entries").select("*, employees(first_name, last_name, hourly_rate), projects(name)").eq("company_id", user.id).order("week_start", { ascending: false }),
        supabase.from("employees").select("user_id, first_name, last_name, hourly_rate").order("first_name"),
        supabase.from("projects").select("id, name").not("status", "ilike", "%complete%").order("name"),
      ]);
      const all = entries || [];
      setBankRecords(all.filter(e => e.status === "banked"));
      setPaidRecords(all.filter(e => e.status === "paid"));
      setEmployees(emps || []);
      setProjects(projs || []);
    } catch (err) {
      console.error("OT Bank load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── totals per employee for banked records ──────────────────────────────
  function getBankedByEmployee() {
    const map = {};
    bankRecords.forEach(r => {
      const uid = r.employee_id;
      if (!map[uid]) {
        map[uid] = {
          name: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "Unknown",
          rate: r.employees?.hourly_rate || r.hourly_rate || 0,
          ot_hours: 0,
          ot_pay: 0,
          entries: [],
        };
      }
      map[uid].ot_hours += r.ot_hours || 0;
      map[uid].ot_pay += (r.ot_hours || 0) * (r.hourly_rate || r.employees?.hourly_rate || 0) * 1.5;
      map[uid].entries.push(r);
    });
    return Object.entries(map).map(([uid, v]) => ({ uid, ...v }));
  }

  const bankedByEmp = getBankedByEmployee();

  // ── Pay Out: mark all banked entries for selected employee as paid ───────
  async function handlePayout() {
    if (!selectedEmpId) { alert("Please select an employee"); return; }
    setSaving(true);
    try {
      const toPayIds = bankRecords
        .filter(r => r.employee_id === selectedEmpId && (!selectedProjectId || r.project_id === selectedProjectId))
        .map(r => r.id);

      if (toPayIds.length === 0) { alert("No banked OT found for this selection."); setSaving(false); return; }

      const { error } = await supabase
        .from("ot_bank_entries")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_notes: payoutNotes || null })
        .in("id", toPayIds);

      if (error) throw error;

      alert(`✅ Paid out OT for ${employees.find(e => e.user_id === selectedEmpId)?.first_name || "employee"}!`);
      setShowPayoutModal(false);
      setSelectedEmpId("");
      setSelectedProjectId("");
      setPayoutNotes("");
      loadData();
    } catch (err) {
      alert("Payout failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Add manual bank entry ────────────────────────────────────────────────
  async function handleAddEntry() {
    if (!addForm.employee_id) { alert("Select an employee"); return; }
    if (!addForm.week_start) { alert("Enter the week start date"); return; }
    const otHours = parseFloat(addForm.ot_hours);
    if (!otHours || otHours <= 0) { alert("Enter valid OT hours (hours above 40)"); return; }

    const emp = employees.find(e => e.user_id === addForm.employee_id);
    const rate = parseFloat(addForm.hourly_rate) || parseFloat(emp?.hourly_rate) || 0;

    setSaving(true);
    try {
      const { error } = await supabase.from("ot_bank_entries").insert([{
        company_id: user.id,
        employee_id: addForm.employee_id,
        project_id: addForm.project_id || null,
        week_start: addForm.week_start,
        regular_hours: parseFloat(addForm.regular_hours) || 40,
        actual_hours: parseFloat(addForm.actual_hours) || (40 + otHours),
        ot_hours: otHours,
        hourly_rate: rate,
        ot_rate: rate * 1.5,
        ot_pay_owed: otHours * rate * 1.5,
        status: "banked",
        notes: addForm.notes || null,
      }]);

      if (error) throw error;

      alert(`✅ Banked ${otHours}h OT for ${emp?.first_name || "employee"}!`);
      setShowAddModal(false);
      setAddForm({ employee_id: "", project_id: "", week_start: "", regular_hours: 40, actual_hours: "", ot_hours: "", hourly_rate: "", notes: "" });
      loadData();
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalBankedHours = bankRecords.reduce((s, r) => s + (r.ot_hours || 0), 0);
  const totalBankedPay = bankRecords.reduce((s, r) => s + (r.ot_pay_owed || 0), 0);

  return (
    <div style={{ backgroundColor: BRAND.bg, minHeight: "100vh", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: BRAND.accent, fontSize: 28, fontWeight: 900, margin: "0 0 4px" }}>🏦 OT Bank</h1>
          <p style={{ color: "#fff", margin: 0, fontSize: 14 }}>Track overtime owed, pay it out when projects collect</p>
        </div>
        <button onClick={() => navigate("/employee-timesheets")}
          style={{ padding: "10px 18px", backgroundColor: "transparent", border: "2px solid #fff", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
          ← Timesheets
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total OT Hours Owed", value: `${totalBankedHours.toFixed(2)} hrs`, color: "#f59e0b" },
          { label: "Total OT Pay Owed", value: `$${totalBankedPay.toFixed(2)}`, color: "#10b981" },
          { label: "Employees with OT", value: bankedByEmp.length, color: "#3b82f6" },
          { label: "Paid Out (All Time)", value: paidRecords.length + " entries", color: "#8b5cf6" },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: "#fff", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            style={{
              padding: "10px 20px", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer",
              fontWeight: 700, fontSize: 14,
              backgroundColor: tab === i ? "#fff" : "rgba(255,255,255,0.15)",
              color: tab === i ? "#0b3ea8" : "#fff",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ backgroundColor: "#fff", borderRadius: "0 12px 12px 12px", padding: 24, minHeight: 400 }}>

        {/* ── Tab 0: Banked OT ── */}
        {tab === 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111" }}>Banked Overtime</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowPayoutModal(true)} disabled={bankedByEmp.length === 0}
                  style={{ padding: "10px 20px", backgroundColor: "#10b981", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  💸 Pay Out OT
                </button>
                <button onClick={() => setShowAddModal(true)}
                  style={{ padding: "10px 20px", backgroundColor: BRAND.accent, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  ➕ Add OT Entry
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#999", padding: 40 }}>Loading...</div>
            ) : bankedByEmp.length === 0 ? (
              <div style={{ textAlign: "center", color: "#999", padding: 40, fontSize: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
                <div>No banked overtime yet.</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Click "➕ Add OT Entry" to bank overtime hours for an employee.</div>
              </div>
            ) : (
              <>
                {/* Per-employee summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
                  {bankedByEmp.map(emp => (
                    <div key={emp.uid} style={{ border: "2px solid #f59e0b", borderRadius: 12, padding: 16, backgroundColor: "#fffbeb" }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 8 }}>{emp.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#6b7280", fontSize: 14 }}>Banked OT Hours</span>
                        <span style={{ fontWeight: 700, color: "#f59e0b" }}>{emp.ot_hours.toFixed(2)} hrs</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#6b7280", fontSize: 14 }}>OT Pay Owed (1.5×)</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "#10b981" }}>${emp.ot_pay.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#6b7280", fontSize: 13 }}>{emp.entries.length} week{emp.entries.length !== 1 ? "s" : ""} banked</span>
                        <button
                          onClick={() => { setSelectedEmpId(emp.uid); setShowPayoutModal(true); }}
                          style={{ padding: "4px 12px", backgroundColor: "#10b981", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          Pay Out
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detail table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f3f4f6" }}>
                        {["Employee", "Week of", "Project", "Reg Hrs", "Actual Hrs", "OT Hrs", "OT Rate", "OT Pay Owed", ""].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bankRecords.map((r, idx) => (
                        <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                            {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "Unknown"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#555" }}>
                            {r.week_start ? new Date(r.week_start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#555" }}>{r.projects?.name || "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>{r.regular_hours || 40}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>{(r.actual_hours || 0).toFixed(2)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#f59e0b" }}>{(r.ot_hours || 0).toFixed(2)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#6b7280" }}>${((r.hourly_rate || 0) * 1.5).toFixed(2)}/hr</td>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: "#10b981" }}>${(r.ot_pay_owed || 0).toFixed(2)}</td>
                          <td style={{ padding: "10px 6px" }}>
                            <button
                              onClick={async () => {
                                if (confirm("Delete this OT bank entry?")) {
                                  await supabase.from("ot_bank_entries").delete().eq("id", r.id);
                                  loadData();
                                }
                              }}
                              style={{ padding: "4px 8px", backgroundColor: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: 700 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: "#0b3ea8" }}>
                        <td colSpan={5} style={{ padding: 12, color: "#fff", fontWeight: 700 }}>TOTALS</td>
                        <td style={{ padding: 12, color: "#fbbf24", fontWeight: 800, textAlign: "center" }}>{totalBankedHours.toFixed(2)} hrs</td>
                        <td></td>
                        <td style={{ padding: 12, color: "#6ee7b7", fontWeight: 900, fontSize: 15 }}>${totalBankedPay.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Tab 1: Pay Out ── */}
        {tab === 1 && (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#111" }}>💸 Pay Out OT Bonus</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
              When you collect on a project, use this to mark the banked OT as paid out so employees receive their 1.5× bonus.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Select Employee *</label>
              <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} style={inputStyle}>
                <option value="">— Choose employee —</option>
                {bankedByEmp.map(e => (
                  <option key={e.uid} value={e.uid}>
                    {e.name} — {e.ot_hours.toFixed(2)} hrs banked (${e.ot_pay.toFixed(2)} owed)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Filter by Project (optional)</label>
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={inputStyle}>
                <option value="">— All projects —</option>
                {[...new Set(bankRecords.filter(r => !selectedEmpId || r.employee_id === selectedEmpId).map(r => r.project_id).filter(Boolean))].map(pid => {
                  const proj = projects.find(p => p.id === pid);
                  return proj ? <option key={pid} value={pid}>{proj.name}</option> : null;
                })}
              </select>
            </div>

            {selectedEmpId && (() => {
              const empEntries = bankRecords.filter(r => r.employee_id === selectedEmpId && (!selectedProjectId || r.project_id === selectedProjectId));
              const totalHrs = empEntries.reduce((s, r) => s + (r.ot_hours || 0), 0);
              const totalPay = empEntries.reduce((s, r) => s + (r.ot_pay_owed || 0), 0);
              return (
                <div style={{ backgroundColor: "#f0fdf4", border: "2px solid #10b981", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: "#111", marginBottom: 12 }}>
                    Pay Out Summary for {employees.find(e => e.user_id === selectedEmpId)?.first_name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "#6b7280" }}>Entries to pay:</span>
                    <span style={{ fontWeight: 700 }}>{empEntries.length} week{empEntries.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "#6b7280" }}>Total OT hours:</span>
                    <span style={{ fontWeight: 700, color: "#f59e0b" }}>{totalHrs.toFixed(2)} hrs</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6b7280" }}>Bonus amount (1.5×):</span>
                    <span style={{ fontWeight: 900, fontSize: 20, color: "#10b981" }}>${totalPay.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="e.g., Paid with paycheck 6/15/2026 — Moultrie project final payment..." />
            </div>

            <button onClick={handlePayout} disabled={!selectedEmpId || saving}
              style={{ width: "100%", padding: "14px 0", backgroundColor: selectedEmpId ? "#10b981" : "#d1d5db", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 16, cursor: selectedEmpId ? "pointer" : "not-allowed" }}>
              {saving ? "⏳ Saving..." : "💸 Confirm Pay Out"}
            </button>
          </div>
        )}

        {/* ── Tab 2: History ── */}
        {tab === 2 && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#111" }}>📋 Pay Out History</h2>
            {paidRecords.length === 0 ? (
              <div style={{ textAlign: "center", color: "#999", padding: 40, fontSize: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div>No paid-out OT records yet.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6" }}>
                      {["Employee", "Week of", "Project", "OT Hrs", "OT Pay", "Paid At", "Notes"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paidRecords.map((r, idx) => (
                      <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                          {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "Unknown"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#555" }}>
                          {r.week_start ? new Date(r.week_start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#555" }}>{r.projects?.name || "—"}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f59e0b", textAlign: "center" }}>{(r.ot_hours || 0).toFixed(2)}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#8b5cf6" }}>${(r.ot_pay_owed || 0).toFixed(2)}</td>
                        <td style={{ padding: "10px 12px", color: "#555" }}>
                          {r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 13 }}>{r.paid_notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#0b3ea8" }}>
                      <td colSpan={3} style={{ padding: 12, color: "#fff", fontWeight: 700 }}>TOTAL PAID OUT</td>
                      <td style={{ padding: 12, color: "#fbbf24", fontWeight: 800, textAlign: "center" }}>
                        {paidRecords.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(2)} hrs
                      </td>
                      <td style={{ padding: 12, color: "#c4b5fd", fontWeight: 900, fontSize: 15 }}>
                        ${paidRecords.reduce((s, r) => s + (r.ot_pay_owed || 0), 0).toFixed(2)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add OT Entry Modal ──────────────────────────────────────────── */}
      {showAddModal && (
        <>
          <div onClick={() => setShowAddModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 3000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, maxWidth: "95vw", backgroundColor: "#fff", borderRadius: 16, zIndex: 3001, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ backgroundColor: BRAND.bg, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: BRAND.accent, fontWeight: 800, fontSize: 18 }}>🏦 Bank Overtime Hours</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
                Record overtime hours earned but not yet paid. The employee will receive 1.5× their regular rate when paid out.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Employee *</label>
                <select value={addForm.employee_id} onChange={e => {
                  const emp = employees.find(x => x.user_id === e.target.value);
                  setAddForm(f => ({ ...f, employee_id: e.target.value, hourly_rate: emp?.hourly_rate || "" }));
                }} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  <option value="">— Select employee —</option>
                  {employees.map(emp => (
                    <option key={emp.user_id} value={emp.user_id}>{emp.first_name} {emp.last_name} {emp.hourly_rate ? `($${emp.hourly_rate}/hr)` : ""}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Project (optional)</label>
                <select value={addForm.project_id} onChange={e => setAddForm(f => ({ ...f, project_id: e.target.value }))} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  <option value="">— No specific project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Week Start Date *</label>
                  <input type="date" value={addForm.week_start} onChange={e => setAddForm(f => ({ ...f, week_start: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hourly Rate ($)</label>
                  <input type="number" value={addForm.hourly_rate} onChange={e => setAddForm(f => ({ ...f, hourly_rate: e.target.value }))} style={inputStyle} placeholder="e.g., 25" min="0" step="0.01" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Regular Hrs</label>
                  <input type="number" value={addForm.regular_hours} onChange={e => setAddForm(f => ({ ...f, regular_hours: e.target.value }))} style={inputStyle} min="0" step="0.5" />
                </div>
                <div>
                  <label style={labelStyle}>Actual Hrs</label>
                  <input type="number" value={addForm.actual_hours} onChange={e => setAddForm(f => ({ ...f, actual_hours: e.target.value }))} style={inputStyle} placeholder="e.g., 52" min="0" step="0.5" />
                </div>
                <div>
                  <label style={labelStyle}>OT Hrs *</label>
                  <input type="number" value={addForm.ot_hours} onChange={e => setAddForm(f => ({ ...f, ot_hours: e.target.value }))} style={inputStyle} placeholder="e.g., 12" min="0" step="0.5" />
                </div>
              </div>

              {/* Preview */}
              {addForm.ot_hours && addForm.hourly_rate && (
                <div style={{ backgroundColor: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 6 }}>OT Pay Preview</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span>{parseFloat(addForm.ot_hours).toFixed(2)} hrs × ${(parseFloat(addForm.hourly_rate) * 1.5).toFixed(2)}/hr (1.5×)</span>
                    <span style={{ fontWeight: 900, fontSize: 18, color: "#10b981" }}>
                      ${(parseFloat(addForm.ot_hours) * parseFloat(addForm.hourly_rate) * 1.5).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} placeholder="Optional notes..." />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 14, backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, color: "#374151", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleAddEntry} disabled={saving} style={{ flex: 2, padding: 14, backgroundColor: BRAND.accent, border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  {saving ? "Saving..." : "🏦 Bank OT Hours"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Pay Out Modal ────────────────────────────────────────────────── */}
      {showPayoutModal && (
        <>
          <div onClick={() => setShowPayoutModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 3000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 480, maxWidth: "95vw", backgroundColor: "#fff", borderRadius: 16, zIndex: 3001, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ backgroundColor: "#10b981", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>💸 Pay Out OT Bonus</div>
              <button onClick={() => setShowPayoutModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Select Employee *</label>
                <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  <option value="">— Choose employee —</option>
                  {bankedByEmp.map(e => (
                    <option key={e.uid} value={e.uid}>{e.name} — ${e.ot_pay.toFixed(2)} owed</option>
                  ))}
                </select>
              </div>

              {selectedEmpId && (() => {
                const empEntries = bankRecords.filter(r => r.employee_id === selectedEmpId);
                const totalPay = empEntries.reduce((s, r) => s + (r.ot_pay_owed || 0), 0);
                const totalHrs = empEntries.reduce((s, r) => s + (r.ot_hours || 0), 0);
                return (
                  <div style={{ backgroundColor: "#f0fdf4", border: "2px solid #10b981", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#6b7280" }}>OT Hours Banked:</span>
                      <span style={{ fontWeight: 800, color: "#f59e0b" }}>{totalHrs.toFixed(2)} hrs</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7280" }}>Bonus to Pay (1.5×):</span>
                      <span style={{ fontWeight: 900, fontSize: 20, color: "#10b981" }}>${totalPay.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Notes (e.g., paycheck date, project name)</label>
                <textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                  placeholder="e.g., Paid with 6/20/2026 paycheck — Moultrie YMCA final payment" />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowPayoutModal(false)} style={{ flex: 1, padding: 14, backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, color: "#374151", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handlePayout} disabled={!selectedEmpId || saving} style={{ flex: 2, padding: 14, backgroundColor: "#10b981", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  {saving ? "⏳ Saving..." : "✅ Confirm Pay Out"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", color: "#111" };

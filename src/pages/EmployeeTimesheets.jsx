import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  cardBg: "#e5e7eb",
  cardText: "#fc6b04ff",
  border: "#1f2937",
  primary: "#0b3ea8",
  accent: "#fc6b04ff",
};

export default function EmployeeTimesheets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', start_time: '', end_time: '', project: '', is_lunch: false });
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Last 2 weeks
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    try {
      // Load all employees
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name, preferred_name")
        .order("first_name");

      if (empError) throw empError;

      setEmployees(employeesData || []);

      // Load all time entries (shift_segments) for date range
      // Try with is_lunch column first, fall back without it
      let segmentsData = null;
      let segError = null;
      
      const result1 = await supabase
        .from("shift_segments")
        .select("id, user_id, project_task, start_at, end_at, shift_id, is_lunch")
        .gte("start_at", startDate + "T00:00:00")
        .lte("start_at", endDate + "T23:59:59")
        .order("start_at", { ascending: false });

      if (result1.error && result1.error.message?.includes("is_lunch")) {
        // Column doesn't exist yet, query without it
        const result2 = await supabase
          .from("shift_segments")
          .select("id, user_id, project_task, start_at, end_at, shift_id")
          .gte("start_at", startDate + "T00:00:00")
          .lte("start_at", endDate + "T23:59:59")
          .order("start_at", { ascending: false });
        segmentsData = result2.data;
        segError = result2.error;
      } else {
        segmentsData = result1.data;
        segError = result1.error;
      }

      if (segError) throw segError;

      // Calculate hours and map to entries
      const entries = (segmentsData || []).map(seg => {
        const start = new Date(seg.start_at);
        const end = seg.end_at ? new Date(seg.end_at) : null;
        const hours = end ? ((end - start) / 3600000) : 0;

        // Find employee
        const employee = employeesData.find(e => e.user_id === seg.user_id);
        const employeeName = employee 
          ? `${employee.first_name} ${employee.last_name}` 
          : "Unknown";

        return {
          id: seg.id,
          user_id: seg.user_id,
          employee_name: employeeName,
          project: seg.project_task || "No project",
          date: start.toLocaleDateString(),
          raw_date: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
          raw_start: seg.start_at,
          raw_end: seg.end_at,
          start_time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          end_time: end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "In Progress",
          start_time_24: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
          end_time_24: end ? `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}` : '',
          hours: hours,
          is_ongoing: !seg.end_at,
          is_lunch: !!seg.is_lunch
        };
      });

      setTimeEntries(entries);
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Failed to load timesheets: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter entries
  const filteredEntries = timeEntries.filter(entry => {
    if (selectedEmployee !== "all" && entry.user_id !== selectedEmployee) return false;
    if (selectedProject !== "all" && entry.project !== selectedProject) return false;
    return true;
  });

  // Get unique projects
  const projects = [...new Set(timeEntries.map(e => e.project))].sort();

  // Calculate totals by employee (deduct 30 min for lunch entries)
  const employeeTotals = {};
  filteredEntries.forEach(entry => {
    if (!employeeTotals[entry.user_id]) {
      employeeTotals[entry.user_id] = {
        name: entry.employee_name,
        hours: 0,
        entries: 0
      };
    }
    const effectiveHours = entry.is_lunch ? Math.max(0, entry.hours - 0.5) : entry.hours;
    employeeTotals[entry.user_id].hours += effectiveHours;
    employeeTotals[entry.user_id].entries += 1;
  });

  const totalHours = Object.values(employeeTotals).reduce((sum, e) => sum + e.hours, 0);

  function openEditModal(entry) {
    setEditForm({
      date: entry.raw_date,
      start_time: entry.start_time_24,
      end_time: entry.end_time_24,
      project: entry.project,
      is_lunch: entry.is_lunch,
    });
    setEditingEntry(entry);
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    try {
      const newStart = new Date(`${editForm.date}T${editForm.start_time}:00`);
      const newEnd = editForm.end_time ? new Date(`${editForm.date}T${editForm.end_time}:00`) : null;
      
      // Handle overnight shifts
      if (newEnd && newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1);
      }

      const updateData = {
        start_at: newStart.toISOString(),
        end_at: newEnd ? newEnd.toISOString() : null,
        project_task: editForm.project || null,
        is_lunch: editForm.is_lunch,
      };

      const { error } = await supabase
        .from("shift_segments")
        .update(updateData)
        .eq("id", editingEntry.id);

      if (error) throw error;

      setEditingEntry(null);
      loadData();
    } catch (err) {
      console.error("Error saving edit:", err);
      alert("Failed to save: " + err.message);
    }
  }

  async function handleDeleteEntry(entry) {
    if (!confirm(`Delete this time entry for ${entry.employee_name} on ${entry.date}?\n\nThis cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from("shift_segments")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;
      loadData();
    } catch (err) {
      console.error("Error deleting entry:", err);
      alert("Failed to delete: " + err.message);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading employee timesheets...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/timeclock')} style={styles.backButton}>
            ← Back
          </button>
          <h1 style={styles.title}>📋 Employee Timesheets</h1>
          <p style={styles.subtitle}>View all employee time entries</p>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersCard}>
        <div style={styles.filtersGrid}>
          <div>
            <label style={styles.label}>From Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
            />
          </div>
          
          <div>
            <label style={styles.label}>To Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Employee:</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Project:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Projects</option>
              {projects.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Employees</div>
          <div style={styles.summaryValue}>{Object.keys(employeeTotals).length}</div>
        </div>
        
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Hours</div>
          <div style={{...styles.summaryValue, color: BRAND.accent}}>
            {totalHours.toFixed(2)}h
          </div>
        </div>
        
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Entries</div>
          <div style={styles.summaryValue}>{filteredEntries.length}</div>
        </div>
      </div>

      {/* Employee Totals */}
      {Object.keys(employeeTotals).length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Employee Totals</h3>
          <div style={styles.employeeGrid}>
            {Object.values(employeeTotals)
              .sort((a, b) => b.hours - a.hours)
              .map((emp, idx) => (
                <div key={idx} style={styles.employeeRow}>
                  <div style={styles.employeeName}>{emp.name}</div>
                  <div style={styles.employeeStats}>
                    <span style={{color: BRAND.accent, fontWeight: 'bold'}}>
                      {emp.hours.toFixed(2)}h
                    </span>
                    <span style={{color: '#999', fontSize: 13}}>
                      ({emp.entries} {emp.entries === 1 ? 'entry' : 'entries'})
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Time Entries Table */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Time Entries</h3>
        
        {filteredEntries.length === 0 ? (
          <div style={styles.noData}>No time entries found for selected filters</div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Project</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Start</th>
                  <th style={styles.th}>End</th>
                  <th style={styles.th}>Hours</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Lunch</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} style={{...styles.tr, cursor: 'pointer'}} onDoubleClick={() => openEditModal(entry)}>
                    <td style={styles.td}>{entry.employee_name}</td>
                    <td style={styles.td}>{entry.project}</td>
                    <td style={styles.td}>{entry.date}</td>
                    <td style={styles.td}>{entry.start_time}</td>
                    <td style={styles.td}>
                      {entry.is_ongoing ? (
                        <span style={{color: '#10b981'}}>In Progress</span>
                      ) : (
                        entry.end_time
                      )}
                    </td>
                    <td style={{...styles.td, fontWeight: 'bold', color: entry.is_lunch ? '#f59e0b' : BRAND.accent}}>
                      {entry.is_ongoing ? "—" : (
                        entry.is_lunch ? (
                          <span title={`${entry.hours.toFixed(2)} - 0.50 lunch = ${Math.max(0, entry.hours - 0.5).toFixed(2)}`}>
                            {Math.max(0, entry.hours - 0.5).toFixed(2)}
                            <span style={{fontSize: 11, color: '#999', marginLeft: 4}}>(-30m)</span>
                          </span>
                        ) : entry.hours.toFixed(2)
                      )}
                    </td>
                    <td style={{...styles.td, textAlign: 'center'}}>
                      <input
                        type="checkbox"
                        checked={entry.is_lunch}
                        onChange={async (e) => {
                          e.stopPropagation();
                          try {
                            const { error } = await supabase
                              .from("shift_segments")
                              .update({ is_lunch: !entry.is_lunch })
                              .eq("id", entry.id);
                            if (error) throw error;
                            loadData();
                          } catch (err) {
                            alert("Failed to update: " + err.message);
                          }
                        }}
                        style={{width: 18, height: 18, cursor: 'pointer', accentColor: '#f59e0b'}}
                        title={entry.is_lunch ? "Took lunch" : "No lunch"}
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={{display: 'flex', gap: 6}}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(entry); }}
                          style={{padding: '4px 10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600}}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry); }}
                          style={{padding: '4px 10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600}}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Time Entry Modal */}
      {editingEntry && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}} onClick={() => setEditingEntry(null)}>
          <div style={{backgroundColor: '#fff', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={{fontSize: 22, fontWeight: 'bold', color: '#111', marginTop: 0, marginBottom: 8}}>✏️ Edit Time Entry</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 24}}>
              {editingEntry.employee_name}
            </p>

            <div style={{marginBottom: 16}}>
              <label style={{display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333'}}>Date</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                style={{width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, boxSizing: 'border-box'}}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16}}>
              <div>
                <label style={{display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333'}}>Start Time</label>
                <input
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
                  style={{width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, boxSizing: 'border-box'}}
                />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333'}}>End Time</label>
                <input
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm({...editForm, end_time: e.target.value})}
                  style={{width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, boxSizing: 'border-box'}}
                />
              </div>
            </div>

            <div style={{marginBottom: 16}}>
              <label style={{display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#333'}}>Project</label>
              <input
                type="text"
                value={editForm.project}
                onChange={(e) => setEditForm({...editForm, project: e.target.value})}
                list="edit-project-list"
                style={{width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, boxSizing: 'border-box'}}
                placeholder="Project name..."
              />
              <datalist id="edit-project-list">
                {projects.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>

            {/* Lunch Break Checkbox */}
            <label style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', backgroundColor: editForm.is_lunch ? '#fef3c7' : '#f9fafb', border: editForm.is_lunch ? '2px solid #f59e0b' : '2px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s'}}>
              <input
                type="checkbox"
                checked={editForm.is_lunch}
                onChange={(e) => setEditForm({...editForm, is_lunch: e.target.checked})}
                style={{width: 20, height: 20, cursor: 'pointer'}}
              />
              <div>
                <div style={{fontSize: 15, fontWeight: 600, color: '#111'}}>🍽️ Lunch Break</div>
                <div style={{fontSize: 12, color: '#666'}}>Deducts 30 minutes from this entry's hours</div>
              </div>
            </label>

            {/* Preview calculated hours */}
            {editForm.start_time && editForm.end_time && (
              <div style={{padding: 12, backgroundColor: '#f0fdf4', borderRadius: 6, marginBottom: 20}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontSize: 14, color: '#666'}}>Calculated Hours:</span>
                  <span style={{fontSize: 18, fontWeight: 'bold', color: '#10b981'}}>
                    {(() => {
                      const [sh, sm] = editForm.start_time.split(':').map(Number);
                      const [eh, em] = editForm.end_time.split(':').map(Number);
                      let mins = (eh * 60 + em) - (sh * 60 + sm);
                      if (mins < 0) mins += 24 * 60;
                      return (mins / 60).toFixed(2);
                    })()}h
                  </span>
                </div>
              </div>
            )}

            <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
              <button
                onClick={() => setEditingEntry(null)}
                style={{padding: '12px 24px', backgroundColor: 'transparent', border: '2px solid #d1d5db', color: '#374151', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600}}
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDeleteEntry(editingEntry); setEditingEntry(null); }}
                style={{padding: '12px 24px', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600}}
              >
                🗑️ Delete
              </button>
              <button
                onClick={handleSaveEdit}
                style={{padding: '12px 24px', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600}}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: BRAND.bg,
    minHeight: "100vh",
  },
  header: {
    marginBottom: 30,
  },
  backButton: {
    padding: "8px 16px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
    opacity: 0.9,
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  filtersCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 20,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginTop: 0,
    marginBottom: 16,
  },
  employeeGrid: {
    display: "grid",
    gap: 12,
  },
  employeeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  employeeStats: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  noData: {
    textAlign: "center",
    padding: 40,
    color: "#999",
    fontSize: 15,
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: "bold",
    color: "#111",
    fontSize: 13,
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: "12px 16px",
    color: "#333",
  },
};

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
      const { data: segmentsData, error: segError } = await supabase
        .from("shift_segments")
        .select(`
          id,
          user_id,
          project_task,
          start_at,
          end_at,
          shift_id
        `)
        .gte("start_at", startDate + "T00:00:00")
        .lte("start_at", endDate + "T23:59:59")
        .order("start_at", { ascending: false });

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
          start_time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          end_time: end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "In Progress",
          hours: hours,
          is_ongoing: !seg.end_at
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

  // Calculate totals by employee
  const employeeTotals = {};
  filteredEntries.forEach(entry => {
    if (!employeeTotals[entry.user_id]) {
      employeeTotals[entry.user_id] = {
        name: entry.employee_name,
        hours: 0,
        entries: 0
      };
    }
    employeeTotals[entry.user_id].hours += entry.hours;
    employeeTotals[entry.user_id].entries += 1;
  });

  const totalHours = Object.values(employeeTotals).reduce((sum, e) => sum + e.hours, 0);

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
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} style={styles.tr}>
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
                    <td style={{...styles.td, fontWeight: 'bold', color: BRAND.accent}}>
                      {entry.is_ongoing ? "—" : entry.hours.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

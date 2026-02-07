import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function TimeOffRequests() {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // For admins
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    hours_requested: 8,
    reason: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) return;

      // Get employee info
      const { data: empData } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", userId)
        .single();

      setEmployee(empData);
      setIsAdmin(empData?.role === "admin");

      // Load user's own requests
      const { data: myRequests, error } = await supabase
        .from("time_off_requests")
        .select(`
          *,
          employees!time_off_requests_employee_id_fkey(first_name, last_name, vacation_hours_used, hire_date)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(myRequests || []);

      // If admin, load all requests
      if (empData?.role === "admin") {
        const { data: all, error: allError } = await supabase
          .from("time_off_requests")
          .select(`
            *,
            employees!time_off_requests_employee_id_fkey(first_name, last_name, email, vacation_hours_used, hire_date)
          `)
          .order("created_at", { ascending: false });

        if (allError) throw allError;
        setAllRequests(all || []);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage({ type: "error", text: "Failed to load time off requests" });
    } finally {
      setLoading(false);
    }
  }

  function calculateVacationHoursAccrued(hireDate) {
    if (!hireDate) return 0;
    const hire = new Date(hireDate);
    const today = new Date();
    const oneYearAfterHire = new Date(hire);
    oneYearAfterHire.setFullYear(hire.getFullYear() + 1);
    if (today < oneYearAfterHire) return 0;
    return 40;
  }

  async function submitRequest(e) {
    e.preventDefault();

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId || !employee) {
        setMessage({ type: "error", text: "Not logged in" });
        return;
      }

      const { error } = await supabase.from("time_off_requests").insert({
        user_id: userId,
        employee_id: employee.id,
        start_date: form.start_date,
        end_date: form.end_date,
        hours_requested: parseFloat(form.hours_requested),
        reason: form.reason.trim(),
        status: "pending",
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Time off request submitted successfully!" });
      setShowForm(false);
      setForm({ start_date: "", end_date: "", hours_requested: 8, reason: "" });
      loadData();
    } catch (err) {
      console.error("Error submitting request:", err);
      setMessage({ type: "error", text: "Failed to submit request" });
    }
  }

  async function approveRequest(requestId) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      setMessage({ type: "success", text: "Request approved! Vacation hours deducted automatically." });
      loadData();
    } catch (err) {
      console.error("Error approving request:", err);
      setMessage({ type: "error", text: "Failed to approve request" });
    }
  }

  async function denyRequest(requestId, reason) {
    try {
      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: "denied",
          denial_reason: reason,
        })
        .eq("id", requestId);

      if (error) throw error;

      setMessage({ type: "success", text: "Request denied" });
      loadData();
    } catch (err) {
      console.error("Error denying request:", err);
      setMessage({ type: "error", text: "Failed to deny request" });
    }
  }

  function RequestCard({ request, showEmployeeName = false }) {
    const accrued = calculateVacationHoursAccrued(request.employees?.hire_date);
    const used = request.employees?.vacation_hours_used || 0;
    const remaining = accrued - used;

    return (
      <div style={styles.card}>
        {showEmployeeName && (
          <div style={styles.employeeName}>
            {request.employees?.first_name} {request.employees?.last_name}
          </div>
        )}
        
        <div style={styles.requestDetails}>
          <div style={styles.dateRange}>
            <strong>{new Date(request.start_date).toLocaleDateString()}</strong>
            {" → "}
            <strong>{new Date(request.end_date).toLocaleDateString()}</strong>
          </div>
          
          <div style={styles.hours}>
            {request.hours_requested} hours requested
          </div>

          {request.reason && (
            <div style={styles.reason}>
              <strong>Reason:</strong> {request.reason}
            </div>
          )}

          <div style={styles.statusBadge}>
            <span style={{
              ...styles.badge,
              backgroundColor: 
                request.status === "approved" ? "#10b981" :
                request.status === "denied" ? "#ef4444" : "#f59e0b"
            }}>
              {request.status.toUpperCase()}
            </span>
          </div>

          {request.status === "denied" && request.denial_reason && (
            <div style={styles.denialReason}>
              <strong>Denial Reason:</strong> {request.denial_reason}
            </div>
          )}

          {showEmployeeName && (
            <div style={styles.vacationInfo}>
              Available: {remaining.toFixed(2)} hrs | Used: {used.toFixed(2)} hrs | Accrued: {accrued.toFixed(2)} hrs
            </div>
          )}
        </div>

        {isAdmin && request.status === "pending" && (
          <div style={styles.actions}>
            <button
              onClick={() => approveRequest(request.id)}
              style={{...styles.actionBtn, backgroundColor: "#10b981"}}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => {
                const reason = prompt("Reason for denial (optional):");
                if (reason !== null) denyRequest(request.id, reason);
              }}
              style={{...styles.actionBtn, backgroundColor: "#ef4444"}}
            >
              ✗ Deny
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const accrued = calculateVacationHoursAccrued(employee?.hire_date);
  const used = employee?.vacation_hours_used || 0;
  const remaining = accrued - used;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h2 style={styles.title}>Time Off Requests</h2>
          <button onClick={() => setShowForm(!showForm)} style={styles.newRequestBtn}>
            {showForm ? "Cancel" : "+ New Request"}
          </button>
        </div>

        {message.text && (
          <div style={{
            ...styles.message,
            backgroundColor: message.type === "success" ? "#10b981" : "#ef4444"
          }}>
            {message.text}
          </div>
        )}

        {/* Vacation Balance */}
        <div style={styles.balanceCard}>
          <h3 style={styles.balanceTitle}>Your Vacation Balance</h3>
          <div style={styles.balanceGrid}>
            <div style={styles.balanceItem}>
              <div style={styles.balanceLabel}>Available</div>
              <div style={{...styles.balanceValue, color: "#10b981"}}>
                {remaining.toFixed(2)} hrs
              </div>
            </div>
            <div style={styles.balanceItem}>
              <div style={styles.balanceLabel}>Used</div>
              <div style={styles.balanceValue}>{used.toFixed(2)} hrs</div>
            </div>
            <div style={styles.balanceItem}>
              <div style={styles.balanceLabel}>Accrued</div>
              <div style={styles.balanceValue}>{accrued.toFixed(2)} hrs</div>
            </div>
          </div>
        </div>

        {/* Request Form */}
        {showForm && (
          <form onSubmit={submitRequest} style={styles.form}>
            <h3 style={styles.formTitle}>Request Time Off</h3>
            
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Start Date *</label>
                <input
                  type="date"
                  style={styles.input}
                  value={form.start_date}
                  onChange={(e) => setForm({...form, start_date: e.target.value})}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>End Date *</label>
                <input
                  type="date"
                  style={styles.input}
                  value={form.end_date}
                  onChange={(e) => setForm({...form, end_date: e.target.value})}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Hours Requested *</label>
                <input
                  type="number"
                  step="0.5"
                  style={styles.input}
                  value={form.hours_requested}
                  onChange={(e) => setForm({...form, hours_requested: e.target.value})}
                  required
                />
                <p style={styles.helpText}>8 hours = 1 day</p>
              </div>

              <div style={{...styles.formGroup, gridColumn: "1 / -1"}}>
                <label style={styles.label}>Reason (optional)</label>
                <textarea
                  style={{...styles.input, minHeight: 80}}
                  value={form.reason}
                  onChange={(e) => setForm({...form, reason: e.target.value})}
                  placeholder="Reason for time off request..."
                />
              </div>
            </div>

            <button type="submit" style={styles.submitBtn}>Submit Request</button>
          </form>
        )}

        {/* My Requests */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>My Requests</h3>
          {requests.length === 0 ? (
            <p style={styles.empty}>No requests yet</p>
          ) : (
            requests.map((req) => <RequestCard key={req.id} request={req} />)
          )}
        </div>

        {/* Admin: All Requests */}
        {isAdmin && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>All Employee Requests (Admin)</h3>
            {allRequests.filter(r => r.user_id !== employee?.user_id).length === 0 ? (
              <p style={styles.empty}>No requests from other employees</p>
            ) : (
              allRequests
                .filter(r => r.user_id !== employee?.user_id)
                .map((req) => <RequestCard key={req.id} request={req} showEmployeeName />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: BRAND.bg,
    minHeight: "100vh",
    paddingTop: 120,
  },
  content: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
  },
  newRequestBtn: {
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  message: {
    padding: 16,
    borderRadius: 8,
    color: "#fff",
    marginBottom: 24,
    fontWeight: 600,
  },
  balanceCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  balanceTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 16,
  },
  balanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  balanceItem: {
    textAlign: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#111",
  },
  form: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 16,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 0,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
    color: "#111",
  },
  input: {
    width: "100%",
    padding: 12,
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
  },
  helpText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    fontStyle: "italic",
  },
  submitBtn: {
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    padding: "14px 28px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 16,
  },
  empty: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    padding: 40,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111",
    marginBottom: 12,
  },
  requestDetails: {
    marginBottom: 16,
  },
  dateRange: {
    fontSize: 16,
    color: "#111",
    marginBottom: 8,
  },
  hours: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  reason: {
    fontSize: 14,
    color: "#111",
    marginBottom: 8,
  },
  statusBadge: {
    marginTop: 12,
  },
  badge: {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
  },
  denialReason: {
    fontSize: 14,
    color: "#ef4444",
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  vacationInfo: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
  },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  actionBtn: {
    flex: 1,
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 100,
    backgroundColor: BRAND.bg,
    minHeight: "100vh",
  },
};

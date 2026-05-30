import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
  });
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showRolePicker, setShowRolePicker] = useState(null); // employee id when picker is open
  const [selectedRole, setSelectedRole] = useState("employee");
  const [resettingPassword, setResettingPassword] = useState(null); // employee id when resetting

  useEffect(() => {
    loadEmployees();
  }, [showArchived]);

  async function loadEmployees() {
    try {
      let query = supabase
        .from("employees")
        .select("*");
      
      // Filter by archived status
      if (showArchived) {
        query = query.eq("archived", true);
      } else {
        query = query.or("archived.is.null,archived.eq.false");
      }
      
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Error loading employees:", err);
      setMessage({ type: "error", text: "Failed to load employees" });
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setMessage({ type: "", text: "" });

    try {
      const email = inviteForm.email.trim().toLowerCase();
      
      // Call the Edge Function to create employee with temp password
      const { data, error } = await supabase.functions.invoke('invite-employee', {
        body: { email }
      });

      if (error) throw error;

      if (data.error) {
        setMessage({ type: "error", text: data.error });
        return;
      }

      if (data.emailError) {
        setMessage({
          type: "error",
          text: `⚠️ Employee record created but the invite email failed to send.\n\nResend error: ${data.emailError}\n\nCheck that RESEND_API_KEY is set in Supabase → Edge Functions → Secrets.`,
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ Invitation sent to ${email}! They will receive an email with a link to set up their account.`,
      });
      
      // Reset form and reload employees
      setInviteForm({ email: "" });
      setShowInviteForm(false);
      loadEmployees();
    } catch (err) {
      console.error("Error inviting employee:", err);
      setMessage({
        type: "error",
        text: err.message || "Failed to invite employee",
      });
    } finally {
      setInviting(false);
    }
  }

  async function toggleEmployeeStatus(employee) {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (error) throw error;
      
      setMessage({
        type: "success",
        text: `${employee.first_name} ${employee.last_name} ${!employee.is_active ? "activated" : "deactivated"}`,
      });
      loadEmployees();
    } catch (err) {
      console.error("Error updating employee:", err);
      setMessage({ type: "error", text: "Failed to update employee status" });
    }
  }

  async function updateEmployeeRole(employee, newRole) {
    try {
      if (!employee.user_id) {
        setMessage({
          type: "error",
          text: "Employee must sign in first before role can be updated"
        });
        return;
      }

      // For contractor, skip the auth RPC (contractors use employee-level app access)
      // Only update the employees table record
      if (newRole !== "contractor") {
        const { error: rpcError } = await supabase.rpc("set_user_role", {
          target_uid: employee.user_id,
          new_role: newRole,
        });
        if (rpcError) throw rpcError;
      }

      // Always update employees table
      const { error: empError } = await supabase
        .from("employees")
        .update({ role: newRole })
        .eq("id", employee.id);

      if (empError) throw empError;
      
      setMessage({
        type: "success",
        text: `${employee.first_name} ${employee.last_name} role updated to ${newRole}. Changes will take effect on next sign in.`,
      });
      setShowRolePicker(null);
      loadEmployees();
    } catch (err) {
      console.error("Error updating employee role:", err);
      setMessage({ type: "error", text: "Failed to update employee role: " + err.message });
    }
  }

  async function toggleArchive(employee) {
    try {
      const newArchived = !employee.archived;
      
      const { error } = await supabase
        .from("employees")
        .update({ archived: newArchived })
        .eq("id", employee.id);

      if (error) throw error;
      
      setMessage({
        type: "success",
        text: `${employee.first_name} ${employee.last_name} ${newArchived ? "archived" : "restored"}`,
      });
      loadEmployees();
    } catch (err) {
      console.error("Error archiving employee:", err);
      setMessage({ type: "error", text: "Failed to archive employee" });
    }
  }

  // Calculate vacation hours accrued based on hire date
  function calculateVacationHoursAccrued(hireDate) {
    if (!hireDate) return 0;
    
    const hire = new Date(hireDate);
    const today = new Date();
    const oneYearAfterHire = new Date(hire);
    oneYearAfterHire.setFullYear(hire.getFullYear() + 1);
    
    // If not yet 1 year, no vacation accrued
    if (today < oneYearAfterHire) return 0;
    
    // After 1 year of employment, employee gets 40 hours per year
    // This resets annually, not cumulative
    return 40;
  }

  function startEditing() {
    setEditForm({
      first_name: selectedEmployee.first_name || '',
      last_name: selectedEmployee.last_name || '',
      preferred_name: selectedEmployee.preferred_name || '',
      phone: selectedEmployee.phone || '',
      date_of_birth: selectedEmployee.date_of_birth || '',
      hire_date: selectedEmployee.hire_date || '',
      address1: selectedEmployee.address1 || '',
      address2: selectedEmployee.address2 || '',
      city: selectedEmployee.city || '',
      state: selectedEmployee.state || '',
      zip: selectedEmployee.zip || '',
      emergency_name: selectedEmployee.emergency_name || '',
      emergency_relationship: selectedEmployee.emergency_relationship || '',
      emergency_phone: selectedEmployee.emergency_phone || '',
      hourly_rate: selectedEmployee.hourly_rate || 0,
      employment_type: selectedEmployee.employment_type || 'employee',
      vacation_hours_used: selectedEmployee.vacation_hours_used || 0,
    });
    setIsEditing(true);
  }

  async function saveEmployeeEdits() {
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          first_name: (editForm.first_name || '').trim(),
          last_name: (editForm.last_name || '').trim(),
          preferred_name: (editForm.preferred_name || '').trim(),
          phone: (editForm.phone || '').trim(),
          date_of_birth: editForm.date_of_birth || null,
          hire_date: editForm.hire_date || null,
          address1: (editForm.address1 || '').trim(),
          address2: (editForm.address2 || '').trim(),
          city: (editForm.city || '').trim(),
          state: (editForm.state || '').trim(),
          zip: (editForm.zip || '').trim(),
          emergency_name: (editForm.emergency_name || '').trim(),
          emergency_relationship: (editForm.emergency_relationship || '').trim(),
          emergency_phone: (editForm.emergency_phone || '').trim(),
          hourly_rate: parseFloat(editForm.hourly_rate) || 0,
          employment_type: editForm.employment_type || 'employee',
          vacation_hours_used: parseFloat(editForm.vacation_hours_used) || 0,
        })
        .eq("id", selectedEmployee.id);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      setMessage({
        type: "success",
        text: `${editForm.first_name} ${editForm.last_name} updated successfully!`,
      });
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      
      setIsEditing(false);
      setShowDetailsModal(false);
      loadEmployees();
    } catch (err) {
      console.error("Error updating employee:", err);
      setMessage({ type: "error", text: "Failed to update employee information: " + (err.message || String(err)) });
    }
  }

  async function handleResetPassword(employee) {
    if (!confirm(`Reset password for ${employee.first_name} ${employee.last_name} (${employee.email})?\n\nThis will generate a new temporary password and email it to them.`)) {
      return;
    }

    setResettingPassword(employee.id);
    setMessage({ type: "", text: "" });

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { email: employee.email }
      });

      if (error) throw error;

      if (data.error) {
        setMessage({ type: "error", text: data.error });
        return;
      }

      const emailStatus = data.emailSent 
        ? "Email sent with new credentials!" 
        : "⚠️ Email failed to send - share the password manually.";

      setMessage({
        type: "success",
        text: `Password reset for ${employee.first_name} ${employee.last_name}!\n\nNew Temporary Password: ${data.tempPassword}\n\n${emailStatus}`,
      });
    } catch (err) {
      console.error("Error resetting password:", err);
      setMessage({
        type: "error",
        text: err.message || "Failed to reset password",
      });
    } finally {
      setResettingPassword(null);
    }
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditForm({});
  }

  return (
    <div style={styles.container}>
      
      <div style={styles.content}>
        <div style={styles.headerSection}>
          <h2 style={styles.pageTitle}>Employees</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                ...styles.inviteButton,
                backgroundColor: showArchived ? "#6b7280" : "#3b82f6",
              }}
            >
              {showArchived ? "← Show Active" : "📦 View Archived"}
            </button>
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              style={styles.inviteButton}
            >
              {showInviteForm ? "Cancel" : "+ Invite Employee"}
            </button>
          </div>
        </div>

        {message.text && (
          <div style={{
            ...styles.message,
            backgroundColor: message.type === "success" ? "#10b981" : "#ef4444",
          }}>
            {message.text}
          </div>
        )}

        {showInviteForm && (
          <form onSubmit={handleInvite} style={styles.inviteForm}>
            <h3 style={styles.formTitle}>Invite New Employee</h3>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Employee Email Address *</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ email: e.target.value })}
                style={styles.input}
                placeholder="employee@example.com"
                required
                autoFocus
              />
              <p style={styles.helpText}>
                Enter the employee's email. They will receive login credentials to access the system.
              </p>
            </div>

            <button type="submit" style={styles.submitButton} disabled={inviting}>
              {inviting ? "Sending Invitation..." : "Send Invitation"}
            </button>
          </form>
        )}

        {loading ? (
          <div style={styles.loading}>Loading employees...</div>
        ) : (
          <div style={styles.employeeList}>
            {employees.map((emp) => (
              <div key={emp.id} style={styles.employeeCard}>
                <div style={styles.employeeInfo}>
                  <h3 style={styles.employeeName}>
                    {emp.first_name} {emp.last_name}
                  </h3>
                  <p style={styles.employeeDetail}>{emp.email}</p>
                  {emp.phone && <p style={styles.employeeDetail}>📱 {emp.phone}</p>}
                  {emp.date_of_birth && <p style={styles.employeeDetail}>🎂 {formatDate(emp.date_of_birth)}</p>}
                  {emp.role === "contractor" && (
                    <p style={{fontSize: 13, color: emp.hourly_rate > 0 ? "#d97706" : "#ef4444", margin: "4px 0", fontWeight: 600}}>
                      {emp.hourly_rate > 0
                        ? `🔧 $${parseFloat(emp.hourly_rate).toFixed(2)}/hr contractor`
                        : "⚠️ No hourly rate set — click View Details to add"}
                    </p>
                  )}
                  <div style={styles.badges}>
                    <span 
                      style={{
                        ...styles.badge,
                        backgroundColor: 
                          emp.role === "admin" ? "#ef4444" : 
                          emp.role === "supervisor" ? "#8b5cf6" :
                          emp.role === "contractor" ? "#f97316" :
                          "#6b7280",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        if (!emp.user_id) {
                          setMessage({type: "error", text: "Employee must sign in first before role can be changed"});
                          return;
                        }
                        setShowRolePicker(emp.id);
                        setSelectedRole(emp.role || "employee");
                      }}
                      title="Click to change role"
                    >
                      {emp.role ? emp.role.toUpperCase() : "EMPLOYEE"} ▼
                    </span>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: emp.is_active ? "#10b981" : "#9ca3af",
                    }}>
                      {emp.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>
                <div style={styles.employeeActions}>
                  <button
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setShowDetailsModal(true);
                    }}
                    style={{
                      ...styles.actionButton,
                      backgroundColor: "#3b82f6",
                    }}
                  >
                    👁️ View Details
                  </button>
                  {!showArchived && (
                    <>
                      <button
                        onClick={() => handleResetPassword(emp)}
                        disabled={resettingPassword === emp.id}
                        style={{
                          ...styles.actionButton,
                          backgroundColor: "#f59e0b",
                          opacity: resettingPassword === emp.id ? 0.6 : 1,
                        }}
                      >
                        {resettingPassword === emp.id ? "Resetting..." : "🔑 Reset Password"}
                      </button>
                      <button
                        onClick={() => toggleEmployeeStatus(emp)}
                        style={{
                          ...styles.actionButton,
                          backgroundColor: emp.is_active ? "#ef4444" : "#10b981",
                        }}
                      >
                        {emp.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleArchive(emp)}
                    style={{
                      ...styles.actionButton,
                      backgroundColor: emp.archived ? "#10b981" : "#6b7280",
                    }}
                  >
                    {emp.archived ? "📦 Restore" : "🗄️ Archive"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Employee Details Modal */}
        {showDetailsModal && selectedEmployee && (
          <div style={styles.modalOverlay} onClick={() => setShowDetailsModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  style={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <div style={styles.modalContent}>
                {isEditing ? (
                  /* EDIT MODE - Show input fields */
                  <>
                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Basic Information</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>First Name *</label>
                        <input
                          style={styles.input}
                          value={editForm.first_name}
                          onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Last Name *</label>
                        <input
                          style={styles.input}
                          value={editForm.last_name}
                          onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Preferred Name</label>
                        <input
                          style={styles.input}
                          value={editForm.preferred_name}
                          onChange={(e) => setEditForm({...editForm, preferred_name: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Phone</label>
                        <input
                          style={styles.input}
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Date of Birth</label>
                        <input
                          type="date"
                          style={styles.input}
                          value={editForm.date_of_birth}
                          onChange={(e) => setEditForm({...editForm, date_of_birth: e.target.value})}
                        />
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Address</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Address Line 1</label>
                        <input
                          style={styles.input}
                          value={editForm.address1}
                          onChange={(e) => setEditForm({...editForm, address1: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Address Line 2</label>
                        <input
                          style={styles.input}
                          value={editForm.address2}
                          onChange={(e) => setEditForm({...editForm, address2: e.target.value})}
                        />
                      </div>
                      <div style={{display: 'flex', gap: 12}}>
                        <div style={{...styles.formGroup, flex: 1}}>
                          <label style={styles.label}>City</label>
                          <input
                            style={styles.input}
                            value={editForm.city}
                            onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                          />
                        </div>
                        <div style={{...styles.formGroup, width: 100}}>
                          <label style={styles.label}>State</label>
                          <input
                            style={styles.input}
                            value={editForm.state}
                            onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                          />
                        </div>
                        <div style={{...styles.formGroup, width: 120}}>
                          <label style={styles.label}>ZIP</label>
                          <input
                            style={styles.input}
                            value={editForm.zip}
                            onChange={(e) => setEditForm({...editForm, zip: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Emergency Contact</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={editForm.emergency_name}
                          onChange={(e) => setEditForm({...editForm, emergency_name: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Relationship</label>
                        <input
                          style={styles.input}
                          value={editForm.emergency_relationship}
                          onChange={(e) => setEditForm({...editForm, emergency_relationship: e.target.value})}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Phone</label>
                        <input
                          style={styles.input}
                          value={editForm.emergency_phone}
                          onChange={(e) => setEditForm({...editForm, emergency_phone: e.target.value})}
                        />
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Employment Details</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Hire Date</label>
                        <input
                          type="date"
                          style={styles.input}
                          value={editForm.hire_date}
                          onChange={(e) => setEditForm({...editForm, hire_date: e.target.value})}
                        />
                        <p style={styles.helpText}>
                          Employees receive 40 hours of vacation per year after 1 full year of employment
                        </p>
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Employment Type</label>
                        <select
                          style={styles.input}
                          value={editForm.employment_type || 'employee'}
                          onChange={(e) => setEditForm({...editForm, employment_type: e.target.value})}
                        >
                          <option value="employee">Employee (W-2)</option>
                          <option value="contractor">Contractor (1099) — shows $ on timesheets</option>
                        </select>
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Hourly Rate ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={styles.input}
                          value={editForm.hourly_rate}
                          onChange={(e) => setEditForm({...editForm, hourly_rate: e.target.value})}
                        />
                        {parseFloat(editForm.hourly_rate) > 0 && (
                          <div style={{marginTop: 6, padding: '6px 10px', backgroundColor: '#fef3c7', borderRadius: 6, fontSize: 13, color: '#92400e'}}>
                            💰 Burdened Cost Rate (×1.4): <strong>${(parseFloat(editForm.hourly_rate) * 1.4).toFixed(2)}/hr</strong>
                            <span style={{marginLeft: 6, fontSize: 11, color: '#b45309'}}>(taxes, benefits, overhead)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Vacation / Time Off</h3>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Vacation Hours Accrued:</span>
                        <span style={styles.detailValue}>
                          {calculateVacationHoursAccrued(editForm.hire_date).toFixed(2)} hours (auto-calculated)
                        </span>
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Vacation Hours Used</label>
                        <input
                          type="number"
                          step="0.01"
                          style={styles.input}
                          value={editForm.vacation_hours_used}
                          onChange={(e) => setEditForm({...editForm, vacation_hours_used: e.target.value})}
                        />
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Vacation Hours Remaining:</span>
                        <span style={styles.detailValue}>
                          <strong>{(calculateVacationHoursAccrued(editForm.hire_date) - (editForm.vacation_hours_used || 0)).toFixed(2)} hours</strong>
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* VIEW MODE - Show display values */
                  <>
                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Contact Information</h3>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Email:</span>
                        <span style={styles.detailValue}>{selectedEmployee.email || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Phone:</span>
                        <span style={styles.detailValue}>{selectedEmployee.phone || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Preferred Name:</span>
                        <span style={styles.detailValue}>{selectedEmployee.preferred_name || '—'}</span>
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Personal Information</h3>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Date of Birth:</span>
                        <span style={styles.detailValue}>
                          {selectedEmployee.date_of_birth ? formatDate(selectedEmployee.date_of_birth) : '—'}
                        </span>
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Address</h3>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Address Line 1:</span>
                        <span style={styles.detailValue}>{selectedEmployee.address1 || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Address Line 2:</span>
                        <span style={styles.detailValue}>{selectedEmployee.address2 || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>City:</span>
                        <span style={styles.detailValue}>{selectedEmployee.city || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>State:</span>
                        <span style={styles.detailValue}>{selectedEmployee.state || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>ZIP Code:</span>
                        <span style={styles.detailValue}>{selectedEmployee.zip || '—'}</span>
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <h3 style={styles.sectionTitle}>Emergency Contact</h3>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Name:</span>
                        <span style={styles.detailValue}>{selectedEmployee.emergency_name || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Relationship:</span>
                        <span style={styles.detailValue}>{selectedEmployee.emergency_relationship || '—'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Phone:</span>
                        <span style={styles.detailValue}>{selectedEmployee.emergency_phone || '—'}</span>
                      </div>
                    </div>

                <div style={styles.detailSection}>
                  <h3 style={styles.sectionTitle}>Employment Details</h3>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Role:</span>
                    <span style={styles.detailValue}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: 
                          selectedEmployee.role === "admin" ? "#ef4444" : 
                          selectedEmployee.role === "supervisor" ? "#8b5cf6" : 
                          "#6b7280",
                      }}>
                        {selectedEmployee.role ? selectedEmployee.role.toUpperCase() : "EMPLOYEE"}
                      </span>
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Status:</span>
                    <span style={styles.detailValue}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: selectedEmployee.is_active ? "#10b981" : "#9ca3af",
                      }}>
                        {selectedEmployee.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Hire Date:</span>
                    <span style={styles.detailValue}>
                      {selectedEmployee.hire_date ? formatDate(selectedEmployee.hire_date) : '—'}
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Hourly Rate:</span>
                    <span style={styles.detailValue}>
                      ${selectedEmployee.hourly_rate ? selectedEmployee.hourly_rate.toFixed(2) : '0.00'}/hr
                    </span>
                  </div>
                  {selectedEmployee.hourly_rate > 0 && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Burdened Cost Rate (×1.4):</span>
                    <span style={{...styles.detailValue, color: '#d97706', fontWeight: '700'}}>
                      ${(selectedEmployee.hourly_rate * 1.4).toFixed(2)}/hr
                    </span>
                  </div>
                  )}
                  <div style={{display: 'none'}}>
{/* spacer to close extra detailRow opened above */}
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Created:</span>
                    <span style={styles.detailValue}>
                      {selectedEmployee.created_at ? formatDate(selectedEmployee.created_at) : '—'}
                    </span>
                  </div>
                  {selectedEmployee.policy_acknowledged_at && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Policy Acknowledged:</span>
                      <span style={styles.detailValue}>
                        {formatDate(selectedEmployee.policy_acknowledged_at)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={styles.detailSection}>
                  <h3 style={styles.sectionTitle}>Vacation / Time Off</h3>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Vacation Hours Accrued:</span>
                    <span style={styles.detailValue}>
                      {calculateVacationHoursAccrued(selectedEmployee.hire_date).toFixed(2)} hours
                      {selectedEmployee.hire_date && calculateVacationHoursAccrued(selectedEmployee.hire_date) === 0 && (
                        <span style={{fontSize: 12, color: '#6b7280', marginLeft: 8}}>
                          (after 1 year: {new Date(new Date(selectedEmployee.hire_date).setFullYear(new Date(selectedEmployee.hire_date).getFullYear() + 1)).toLocaleDateString()})
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Vacation Hours Used:</span>
                    <span style={styles.detailValue}>
                      {(selectedEmployee.vacation_hours_used || 0).toFixed(2)} hours
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Vacation Hours Remaining:</span>
                    <span style={styles.detailValue}>
                      <strong>{(calculateVacationHoursAccrued(selectedEmployee.hire_date) - (selectedEmployee.vacation_hours_used || 0)).toFixed(2)} hours</strong>
                    </span>
                  </div>
                </div>
                  </>
                )}
              </div>

              <div style={styles.modalActions}>
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEmployeeEdits}
                      style={{...styles.modalCloseButton, marginRight: 12}}
                    >
                      💾 Save Changes
                    </button>
                    <button
                      onClick={cancelEditing}
                      style={{...styles.modalCloseButton, backgroundColor: "#6b7280"}}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEditing}
                      style={{...styles.modalCloseButton, marginRight: 12, backgroundColor: "#3b82f6"}}
                    >
                      ✏️ Edit Information
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setIsEditing(false);
                      }}
                      style={styles.modalCloseButton}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Role Picker Modal */}
        {showRolePicker && (
          <div style={styles.modalOverlay} onClick={() => setShowRolePicker(null)}>
            <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Change Role</h2>
                <button onClick={() => setShowRolePicker(null)} style={styles.closeButton}>✕</button>
              </div>

              <div style={styles.modalContent}>
                <p style={{marginBottom: 20, color: "#6b7280"}}>
                  Select new role for {employees.find(e => e.id === showRolePicker)?.first_name} {employees.find(e => e.id === showRolePicker)?.last_name}:
                </p>

                {/* Employee Option */}
                <div
                  onClick={() => setSelectedRole("employee")}
                  style={{
                    ...styles.roleOption,
                    borderColor: selectedRole === "employee" ? "#3b82f6" : "#e5e7eb",
                    backgroundColor: selectedRole === "employee" ? "#eff6ff" : "#fff",
                  }}
                >
                  <div style={styles.roleOptionRadio}>
                    {selectedRole === "employee" && <div style={styles.roleOptionRadioInner} />}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={styles.roleOptionTitle}>Employee</div>
                    <div style={styles.roleOptionDesc}>Standard access - own time clock only</div>
                  </div>
                </div>

                {/* Supervisor Option */}
                <div
                  onClick={() => setSelectedRole("supervisor")}
                  style={{
                    ...styles.roleOption,
                    borderColor: selectedRole === "supervisor" ? "#8b5cf6" : "#e5e7eb",
                    backgroundColor: selectedRole === "supervisor" ? "#f3e8ff" : "#fff",
                  }}
                >
                  <div style={styles.roleOptionRadio}>
                    {selectedRole === "supervisor" && <div style={{...styles.roleOptionRadioInner, backgroundColor: "#8b5cf6"}} />}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={styles.roleOptionTitle}>Supervisor</div>
                    <div style={styles.roleOptionDesc}>View team data, crew clock, reports (read-only)</div>
                  </div>
                </div>

                {/* Contractor Option */}
                <div
                  onClick={() => setSelectedRole("contractor")}
                  style={{
                    ...styles.roleOption,
                    borderColor: selectedRole === "contractor" ? "#f97316" : "#e5e7eb",
                    backgroundColor: selectedRole === "contractor" ? "#fff7ed" : "#fff",
                  }}
                >
                  <div style={styles.roleOptionRadio}>
                    {selectedRole === "contractor" && <div style={{...styles.roleOptionRadioInner, backgroundColor: "#f97316"}} />}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={styles.roleOptionTitle}>🔧 Contractor</div>
                    <div style={styles.roleOptionDesc}>Time tracked hourly — paid by dollar amount (no payroll)</div>
                  </div>
                </div>

                {/* Admin Option */}
                <div
                  onClick={() => setSelectedRole("admin")}
                  style={{
                    ...styles.roleOption,
                    borderColor: selectedRole === "admin" ? "#ef4444" : "#e5e7eb",
                    backgroundColor: selectedRole === "admin" ? "#fef2f2" : "#fff",
                  }}
                >
                  <div style={styles.roleOptionRadio}>
                    {selectedRole === "admin" && <div style={{...styles.roleOptionRadioInner, backgroundColor: "#ef4444"}} />}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={styles.roleOptionTitle}>Admin</div>
                    <div style={styles.roleOptionDesc}>Full access - manage employees, settings, all data</div>
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  onClick={() => {
                    const emp = employees.find(e => e.id === showRolePicker);
                    if (emp) updateEmployeeRole(emp, selectedRole);
                  }}
                  style={styles.modalCloseButton}
                >
                  Update Role
                </button>
                <button
                  onClick={() => setShowRolePicker(null)}
                  style={{...styles.modalCloseButton, backgroundColor: "#6b7280", marginLeft: 12}}
                >
                  Cancel
                </button>
              </div>
            </div>
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
    maxWidth: 1200,
    margin: "0 auto",
    padding: 24,
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  pageTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
  },
  inviteButton: {
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
  inviteForm: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
    color: "#111",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
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
  submitButton: {
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
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  employeeList: {
    display: "grid",
    gap: 16,
  },
  employeeCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    display: "flex",
    justifyContent: "space-between",
  helpText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 6,
    fontStyle: "italic",
  },
    alignItems: "center",
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "#111",
  },
  employeeDetail: {
    fontSize: 14,
    color: "#6b7280",
    margin: "4px 0",
  },
  badges: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  badge: {
    padding: "4px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
  },
  employeeActions: {
    display: "flex",
    gap: 8,
  },
  actionButton: {
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 800,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottom: "2px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111",
    margin: 0,
  },
  closeButton: {
    backgroundColor: "transparent",
    border: "none",
    fontSize: 32,
    color: "#6b7280",
    cursor: "pointer",
    padding: 0,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 24,
  },
  detailSection: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "1px solid #e5e7eb",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 16,
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#111",
    fontWeight: 500,
  },
  modalActions: {
    padding: 24,
    borderTop: "2px solid #e5e7eb",
    display: "flex",
    justifyContent: "flex-end",
  },
  modalCloseButton: {
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    padding: "12px 32px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  roleOption: {
    display: "flex",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    border: "2px solid",
    marginBottom: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  roleOptionRadio: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "2px solid #d1d5db",
    marginRight: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  roleOptionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor: "#3b82f6",
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
    marginBottom: 4,
  },
  roleOptionDesc: {
    fontSize: 14,
    color: "#6b7280",
  },
};

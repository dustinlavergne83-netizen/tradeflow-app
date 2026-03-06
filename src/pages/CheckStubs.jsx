import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function CheckStubs() {
  const [employees, setEmployees] = useState([]);
  const [checkStubs, setCheckStubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPdfSplitter, setShowPdfSplitter] = useState(false);
  const [combinedPdf, setCombinedPdf] = useState(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [employeeMappings, setEmployeeMappings] = useState([{ employee_id: "", page_start: 1, page_end: 1 }]);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load active employees
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email")
        .or("archived.is.null,archived.eq.false")
        .order("first_name");

      if (empError) throw empError;
      setEmployees(empData || []);

      // Load check stubs
      const { data: stubsData, error: stubsError } = await supabase
        .from("check_stubs")
        .select(`
          *,
          employee:employees(first_name, last_name)
        `)
        .order("pay_date", { ascending: false });

      if (stubsError) throw stubsError;
      setCheckStubs(stubsData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e) {
    e.preventDefault();

    if (!selectedEmployee) {
      setMessage({ type: "error", text: "Please select an employee" });
      return;
    }
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a PDF file" });
      return;
    }
    if (!payPeriodStart || !payPeriodEnd || !payDate) {
      setMessage({ type: "error", text: "Please fill in all date fields" });
      return;
    }

    setUploading(true);
    setMessage({ type: "", text: "" });

    try {
      // Create file path
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${selectedEmployee}_${payPeriodEnd}.${fileExt}`;
      const filePath = `check-stubs/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("check-stubs")
        .upload(filePath, selectedFile, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert record into database
      const { error: dbError } = await supabase.from("check_stubs").insert({
        employee_id: selectedEmployee,
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
        pay_date: payDate,
        file_path: filePath,
        file_name: selectedFile.name,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      setMessage({
        type: "success",
        text: "Check stub uploaded successfully!",
      });

      // Reset form
      setSelectedEmployee("");
      setPayPeriodStart("");
      setPayPeriodEnd("");
      setPayDate("");
      setSelectedFile(null);
      document.getElementById("fileInput").value = "";

      // Reload data
      loadData();
    } catch (err) {
      console.error("Error uploading check stub:", err);
      setMessage({
        type: "error",
        text: err.message || "Failed to upload check stub",
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteCheckStub(stub) {
    if (
      !window.confirm(
        `Delete check stub for ${stub.employee?.first_name} ${stub.employee?.last_name} (${stub.pay_period_end})?`
      )
    ) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("check-stubs")
        .remove([stub.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("check_stubs")
        .delete()
        .eq("id", stub.id);

      if (dbError) throw dbError;

      setMessage({ type: "success", text: "Check stub deleted" });
      loadData();
    } catch (err) {
      console.error("Error deleting check stub:", err);
      setMessage({ type: "error", text: "Failed to delete check stub" });
    }
  }

  async function downloadCheckStub(stub) {
    try {
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .createSignedUrl(stub.file_path, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Failed to generate download link");

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      console.error("Error downloading check stub:", err);
      setMessage({ type: "error", text: "Failed to download check stub" });
    }
  }

  async function handleBulkUpload() {
    if (bulkFiles.length === 0) {
      setMessage({ type: "error", text: "Please select files to upload" });
      return;
    }

    setBulkUploading(true);
    setMessage({ type: "", text: "" });

    const results = {
      success: [],
      failed: [],
    };

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      for (const file of bulkFiles) {
        try {
          // Parse filename: FirstName_LastName_PayDate.pdf
          const nameWithoutExt = file.name.replace(".pdf", "");
          const parts = nameWithoutExt.split("_");

          if (parts.length !== 3) {
            results.failed.push({
              file: file.name,
              reason: "Invalid filename format. Expected: FirstName_LastName_PayDate.pdf",
            });
            continue;
          }

          const [firstName, lastName, payDateStr] = parts;

          // Find employee
          const employee = employees.find(
            (emp) =>
              emp.first_name.toLowerCase() === firstName.toLowerCase() &&
              emp.last_name.toLowerCase() === lastName.toLowerCase()
          );

          if (!employee) {
            results.failed.push({
              file: file.name,
              reason: `Employee not found: ${firstName} ${lastName}`,
            });
            continue;
          }

          // Parse pay date (end of pay period)
          const payPeriodEnd = new Date(payDateStr);
          if (isNaN(payPeriodEnd.getTime())) {
            results.failed.push({
              file: file.name,
              reason: "Invalid date format. Use YYYY-MM-DD",
            });
            continue;
          }

          // Calculate pay period start (14 days before end)
          const payPeriodStart = new Date(payPeriodEnd);
          payPeriodStart.setDate(payPeriodStart.getDate() - 13);

          // Format dates
          const startStr = payPeriodStart.toISOString().split("T")[0];
          const endStr = payPeriodEnd.toISOString().split("T")[0];

          // Upload to storage
          const filePath = `check-stubs/${employee.id}_${endStr}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from("check-stubs")
            .upload(filePath, file, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Insert record
          const { error: dbError } = await supabase.from("check_stubs").insert({
            employee_id: employee.id,
            pay_period_start: startStr,
            pay_period_end: endStr,
            pay_date: endStr,
            file_path: filePath,
            file_name: file.name,
            uploaded_by: user?.id,
          });

          if (dbError) throw dbError;

          results.success.push(file.name);
        } catch (err) {
          results.failed.push({
            file: file.name,
            reason: err.message || "Unknown error",
          });
        }
      }

      // Show results
      let message = "";
      if (results.success.length > 0) {
        message += `✅ Successfully uploaded ${results.success.length} file(s)\n`;
      }
      if (results.failed.length > 0) {
        message += `\n❌ Failed to upload ${results.failed.length} file(s):\n`;
        results.failed.forEach((f) => {
          message += `- ${f.file}: ${f.reason}\n`;
        });
      }

      setMessage({
        type: results.failed.length === 0 ? "success" : "error",
        text: message,
      });

      // Reset and reload
      setBulkFiles([]);
      loadData();
    } catch (err) {
      console.error("Bulk upload error:", err);
      setMessage({ type: "error", text: err.message || "Bulk upload failed" });
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.pageTitle}>Employee Check Stubs</h2>

        {message.text && (
          <div
            style={{
              ...styles.message,
              backgroundColor:
                message.type === "success" ? "#10b981" : "#ef4444",
            }}
          >
            {message.text}
          </div>
        )}

        {/* Toggle Buttons */}
        <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
          <button
            onClick={() => setShowBulkUpload(false)}
            style={{
              ...styles.toggleButton,
              backgroundColor: !showBulkUpload ? BRAND.primary : "#fff",
              color: !showBulkUpload ? "#fff" : "#111",
            }}
          >
            Single Upload
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            style={{
              ...styles.toggleButton,
              backgroundColor: showBulkUpload ? BRAND.primary : "#fff",
              color: showBulkUpload ? "#fff" : "#111",
            }}
          >
            Bulk Upload
          </button>
        </div>

        {/* Bulk Upload Form */}
        {showBulkUpload ? (
          <div style={styles.uploadSection}>
            <h3 style={styles.sectionTitle}>Bulk Upload Check Stubs</h3>
            <div style={styles.helpBox}>
              <p style={styles.helpTitle}>📝 File Naming Convention:</p>
              <p style={styles.helpText}>
                Name your PDF files: <code>FirstName_LastName_PayDate.pdf</code>
              </p>
              <p style={styles.helpExample}>
                Example: <code>John_Smith_2024-01-15.pdf</code>
              </p>
              <p style={styles.helpText}>
                • The pay date should be the end of the pay period<br />
                • The system will auto-calculate a 2-week period<br />
                • Employee names must match exactly (first and last name)
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Select Multiple PDFs</label>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setBulkFiles(Array.from(e.target.files))}
                style={styles.fileInput}
              />
              {bulkFiles.length > 0 && (
                <p style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
                  {bulkFiles.length} file(s) selected
                </p>
              )}
            </div>

            <button
              onClick={handleBulkUpload}
              style={styles.uploadButton}
              disabled={bulkUploading || bulkFiles.length === 0}
            >
              {bulkUploading ? "Uploading..." : `📤 Upload ${bulkFiles.length} Check Stub(s)`}
            </button>
          </div>
        ) : (
          /* Single Upload Form */
          <div style={styles.uploadSection}>
            <h3 style={styles.sectionTitle}>Upload Check Stub</h3>
            <form onSubmit={handleFileUpload}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Employee *</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  style={styles.select}
                  required
                >
                  <option value="">Select an employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>PDF File *</label>
                <input
                  id="fileInput"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={styles.fileInput}
                  required
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Pay Period Start *</label>
                <input
                  type="date"
                  value={payPeriodStart}
                  onChange={(e) => setPayPeriodStart(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Pay Period End *</label>
                <input
                  type="date"
                  value={payPeriodEnd}
                  onChange={(e) => setPayPeriodEnd(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Pay Date *</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              style={styles.uploadButton}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "📄 Upload Check Stub"}
            </button>
          </form>
          </div>
        )}

        {/* Check Stubs List */}
        <div style={styles.stubsSection}>
          <h3 style={styles.sectionTitle}>
            Uploaded Check Stubs ({checkStubs.length})
          </h3>

          {loading ? (
            <div style={styles.loading}>Loading check stubs...</div>
          ) : checkStubs.length === 0 ? (
            <div style={styles.emptyState}>
              No check stubs uploaded yet. Use the form above to upload the
              first one.
            </div>
          ) : (
            <div style={styles.stubsList}>
              {checkStubs.map((stub) => (
                <div key={stub.id} style={styles.stubCard}>
                  <div style={styles.stubInfo}>
                    <h4 style={styles.stubEmployee}>
                      {stub.employee?.first_name} {stub.employee?.last_name}
                    </h4>
                    <div style={styles.stubDetails}>
                      <span style={styles.stubDetail}>
                        📅 Pay Period: {formatDate(stub.pay_period_start)} -{" "}
                        {formatDate(stub.pay_period_end)}
                      </span>
                      <span style={styles.stubDetail}>
                        💰 Pay Date: {formatDate(stub.pay_date)}
                      </span>
                      <span style={styles.stubDetail}>
                        📎 {stub.file_name}
                      </span>
                      <span style={styles.stubDetail}>
                        ⬆️ Uploaded: {formatDate(stub.uploaded_at)}
                      </span>
                    </div>
                  </div>
                  <div style={styles.stubActions}>
                    <button
                      onClick={() => downloadCheckStub(stub)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "#3b82f6",
                      }}
                    >
                      📥 View/Download
                    </button>
                    <button
                      onClick={() => deleteCheckStub(stub)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "#ef4444",
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
  pageTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 24,
  },
  message: {
    padding: 16,
    borderRadius: 8,
    color: "#fff",
    marginBottom: 24,
    fontWeight: 600,
  },
  uploadSection: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  stubsSection: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
    color: "#111",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
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
  select: {
    width: "100%",
    padding: 12,
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  fileInput: {
    width: "100%",
    padding: 12,
    fontSize: 14,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  uploadButton: {
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
    color: "#6b7280",
    fontSize: 16,
    padding: 40,
  },
  emptyState: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 16,
    padding: 40,
    fontStyle: "italic",
  },
  stubsList: {
    display: "grid",
    gap: 16,
  },
  stubCard: {
    padding: 20,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stubInfo: {
    flex: 1,
  },
  stubEmployee: {
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "#111",
  },
  stubDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  stubDetail: {
    fontSize: 14,
    color: "#6b7280",
  },
  stubActions: {
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
    whiteSpace: "nowrap",
  },
  toggleButton: {
    padding: "12px 24px",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  helpBox: {
    backgroundColor: "#eff6ff",
    border: "2px solid #3b82f6",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
    margin: "0 0 8px 0",
  },
  helpText: {
    fontSize: 14,
    color: "#374151",
    margin: "8px 0",
    lineHeight: 1.6,
  },
  helpExample: {
    fontSize: 14,
    color: "#1f2937",
    margin: "8px 0",
    fontWeight: 600,
  },
};

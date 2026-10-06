import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify, confirmDialog } from "../lib/notify";

/**
 * BankStatementArchive — upload/list/download the ORIGINAL bank statement
 * documents (PDF/image/CSV) for one bank account, kept in the
 * `bank-statements` storage bucket for audits, disputes, or CPA requests.
 *
 * This is separate from BankStatementUpload.jsx, which parses a CSV into
 * bank_transactions rows — this component just archives the source file
 * itself, unparsed, exactly as received from the bank.
 */
export default function BankStatementArchive({ bankAccountId }) {
  const { user, employee } = useAuth();
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (bankAccountId) loadStatements();
  }, [bankAccountId]);

  async function loadStatements() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .order("statement_period_start", { ascending: false });
      if (error) throw error;
      setStatements(data || []);
    } catch (err) {
      console.error("Error loading bank statements:", err);
      notify("Failed to load statement archive: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e) {
    setFile(e.target.files?.[0] || null);
  }

  async function handleUpload() {
    if (!file) {
      notify("Please choose a file first");
      return;
    }
    try {
      setUploading(true);
      const year = periodStart ? periodStart.slice(0, 4) : new Date().getFullYear();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${bankAccountId}/${year}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("bank-statements")
        .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("bank_statements").insert({
        company_id: employee?.company_id,
        bank_account_id: bankAccountId,
        statement_period_start: periodStart || null,
        statement_period_end: periodEnd || null,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        notes: notes || null,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;

      notify("✅ Statement uploaded and archived!");
      setFile(null);
      setPeriodStart("");
      setPeriodEnd("");
      setNotes("");
      const fileInput = document.getElementById("bank-statement-file-input");
      if (fileInput) fileInput.value = "";
      loadStatements();
    } catch (err) {
      console.error("Error uploading statement:", err);
      notify("Failed to upload statement: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(statement) {
    try {
      const { data, error } = await supabase.storage
        .from("bank-statements")
        .createSignedUrl(statement.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      notify("Failed to open statement: " + err.message);
    }
  }

  async function handleDelete(statement) {
    if (!(await confirmDialog(`Delete "${statement.file_name}" from the archive? This cannot be undone.`))) {
      return;
    }
    try {
      await supabase.storage.from("bank-statements").remove([statement.file_path]);
      const { error } = await supabase.from("bank_statements").delete().eq("id", statement.id);
      if (error) throw error;
      notify("Statement deleted.");
      loadStatements();
    } catch (err) {
      notify("Failed to delete statement: " + err.message);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>🗄️ Statement Archive</h3>
      <p style={styles.subtitle}>
        Keep the original bank statement files here (PDF/image/CSV) for audits, disputes, or your CPA — separate from importing transactions above.
      </p>

      <div style={styles.uploadRow}>
        <div style={styles.uploadField}>
          <label style={styles.label}>Period Start</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.uploadField}>
          <label style={styles.label}>Period End</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={styles.input} />
        </div>
      </div>
      <div style={styles.uploadField}>
        <label style={styles.label}>Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={styles.input}
          placeholder="e.g. January 2023 statement"
        />
      </div>
      <div style={styles.uploadField}>
        <label style={styles.label}>File</label>
        <input
          id="bank-statement-file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.csv"
          onChange={handleFileSelect}
          style={styles.fileInput}
        />
      </div>
      <button onClick={handleUpload} disabled={uploading || !file} style={styles.uploadButton}>
        {uploading ? "Uploading..." : "📤 Upload Statement"}
      </button>

      <div style={styles.listWrapper}>
        {loading ? (
          <p style={styles.helpText}>Loading archive...</p>
        ) : statements.length === 0 ? (
          <p style={styles.helpText}>No statements archived for this account yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>File</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id}>
                  <td style={styles.td}>
                    {s.statement_period_start ? `${s.statement_period_start} – ${s.statement_period_end || "?"}` : "—"}
                  </td>
                  <td style={styles.td}>{s.file_name}</td>
                  <td style={styles.td}>{formatFileSize(s.file_size)}</td>
                  <td style={styles.td}>{s.notes || "—"}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleDownload(s)} style={styles.linkButton}>View</button>
                    <button onClick={() => handleDelete(s)} style={styles.deleteButton}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "16px 0" },
  title: { fontSize: 16, fontWeight: 700, margin: "0 0 4px 0", color: "#111" },
  subtitle: { fontSize: 13, color: "#666", margin: "0 0 16px 0" },
  uploadRow: { display: "flex", gap: 16 },
  uploadField: { flex: 1, marginBottom: 10 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" },
  fileInput: { width: "100%", fontSize: 13 },
  uploadButton: {
    padding: "10px 20px", background: "#0b3ea8", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4,
  },
  listWrapper: { marginTop: 20 },
  helpText: { color: "#888", fontSize: 13, fontStyle: "italic" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#666", borderBottom: "2px solid #e5e7eb" },
  td: { padding: "6px 8px", fontSize: 13, borderBottom: "1px solid #f0f0f0" },
  linkButton: {
    padding: "4px 10px", background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe",
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 6,
  },
  deleteButton: {
    padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
};

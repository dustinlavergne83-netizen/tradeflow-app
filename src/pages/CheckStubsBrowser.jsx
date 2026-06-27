import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { confirmDialog } from '../lib/notify';

const BRAND = { bg: "#0b3ea8" };

export default function CheckStubsBrowser() {
  const navigate = useNavigate();
  const [message, setMessage] = useState({ type: "", text: "" });

  // Level 1: employee folders
  const [employeeFolders, setEmployeeFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);

  // Level 2: year folders for selected employee
  const [selectedFolder, setSelectedFolder] = useState(null); // "Ty_Weldon"
  const [yearFolders, setYearFolders] = useState([]);
  const [loadingYears, setLoadingYears] = useState(false);

  // Level 3: files for selected year
  const [selectedYear, setSelectedYear] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // DB metadata overlay (keyed by file_path)
  const [dbMeta, setDbMeta] = useState({});

  // Load root employee folders on mount
  useEffect(() => {
    loadRootFolders();
    loadDbMeta();
  }, []);

  // ── Load employee folders (Level 1) ───────────────────────────────────────
  async function loadRootFolders() {
    setLoadingFolders(true);
    try {
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .list("", { limit: 200, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      // Filter out files at root level, keep only folders
      const folders = (data || []).filter((item) => !item.metadata || item.metadata === null || item.id === null);
      setEmployeeFolders(folders);
    } catch (err) {
      setMessage({ type: "error", text: `Failed to load folders: ${err.message}` });
    } finally {
      setLoadingFolders(false);
    }
  }

  // ── Load year subfolders (Level 2) ────────────────────────────────────────
  async function loadYearFolders(folderName) {
    setSelectedFolder(folderName);
    setSelectedYear(null);
    setFiles([]);
    setLoadingYears(true);
    try {
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .list(folderName, { limit: 100, sortBy: { column: "name", order: "desc" } });
      if (error) throw error;
      const years = (data || []).filter((item) => !item.metadata || item.id === null);
      setYearFolders(years);
    } catch (err) {
      setMessage({ type: "error", text: `Failed to load years: ${err.message}` });
    } finally {
      setLoadingYears(false);
    }
  }

  // ── Load files in a year folder (Level 3) ─────────────────────────────────
  async function loadFiles(year) {
    setSelectedYear(year);
    setLoadingFiles(true);
    try {
      const path = `${selectedFolder}/${year}`;
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .list(path, { limit: 200, sortBy: { column: "name", order: "desc" } });
      if (error) throw error;
      // Only actual files (have metadata / non-null id)
      const fileItems = (data || []).filter(
        (item) => item.name !== ".emptyFolderPlaceholder" && item.id !== null
      );
      setFiles(fileItems);
    } catch (err) {
      setMessage({ type: "error", text: `Failed to load files: ${err.message}` });
    } finally {
      setLoadingFiles(false);
    }
  }

  // ── Load DB metadata overlay ───────────────────────────────────────────────
  async function loadDbMeta() {
    const { data } = await supabase
      .from("check_stubs")
      .select("file_path, pay_date, pay_period_start, pay_period_end, file_name, id");
    if (data) {
      const map = {};
      data.forEach((row) => { map[row.file_path] = row; });
      setDbMeta(map);
    }
  }

  // ── View a file ───────────────────────────────────────────────────────────
  async function viewFile(fileName) {
    const path = `${selectedFolder}/${selectedYear}/${fileName}`;
    try {
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .createSignedUrl(path, 120);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      setMessage({ type: "error", text: `Failed to open file: ${err.message}` });
    }
  }

  // ── Delete a file ─────────────────────────────────────────────────────────
  async function deleteFile(fileName) {
    if (!window.await confirmDialog(`Delete ${fileName}?`)) return;
    const path = `${selectedFolder}/${selectedYear}/${fileName}`;
    try {
      await supabase.storage.from("check-stubs").remove([path]);
      // Also remove DB record if it exists
      const meta = dbMeta[path];
      if (meta?.id) {
        await supabase.from("check_stubs").delete().eq("id", meta.id);
      }
      setMessage({ type: "success", text: `${fileName} deleted.` });
      loadFiles(selectedYear);
      loadDbMeta();
    } catch (err) {
      setMessage({ type: "error", text: `Failed to delete: ${err.message}` });
    }
  }

  // ── Format "Ty_Weldon" → "Ty Weldon" ─────────────────────────────────────
  function formatFolderName(name) {
    return name.replace(/_/g, " ");
  }

  // ── Format date string ────────────────────────────────────────────────────
  function fmtDate(d) {
    if (!d) return null;
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const breadcrumb = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      <button
        onClick={() => { setSelectedFolder(null); setSelectedYear(null); setYearFolders([]); setFiles([]); }}
        style={crumbStyle(true)}
      >
        📁 Employees
      </button>
      {selectedFolder && (
        <>
          <span style={{ color: "#a78bfa", fontSize: 18 }}>›</span>
          <button
            onClick={() => { setSelectedYear(null); setFiles([]); }}
            style={crumbStyle(!!selectedYear)}
          >
            👤 {formatFolderName(selectedFolder)}
          </button>
        </>
      )}
      {selectedYear && (
        <>
          <span style={{ color: "#a78bfa", fontSize: 18 }}>›</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>📅 {selectedYear}</span>
        </>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: BRAND.bg, minHeight: "100vh", paddingTop: 120 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 700, margin: 0 }}>
            📁 Check Stubs Archive
          </h1>
          <button onClick={() => navigate("/check-stubs")} style={styles.backBtn}>
            ⬆️ Upload Stubs
          </button>
        </div>

        {message.text && (
          <div style={{ ...styles.msg, backgroundColor: message.type === "success" ? "#10b981" : "#ef4444" }}>
            {message.text}
            <button onClick={() => setMessage({ type: "", text: "" })} style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, fontWeight: 700 }}>×</button>
          </div>
        )}

        <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28 }}>
          {breadcrumb}

          {/* ── LEVEL 1: Employee folders ──────────────────────────────── */}
          {!selectedFolder && (
            <div>
              <h2 style={styles.heading}>Employee Folders</h2>
              {loadingFolders ? (
                <p style={{ color: "#6b7280" }}>Loading folders from storage…</p>
              ) : employeeFolders.length === 0 ? (
                <p style={{ color: "#6b7280", fontStyle: "italic" }}>No employee folders found in check-stubs storage bucket.</p>
              ) : (
                <div style={styles.grid}>
                  {employeeFolders.map((folder) => (
                    <button
                      key={folder.name}
                      onClick={() => loadYearFolders(folder.name)}
                      style={styles.folderCard}
                    >
                      <div style={{ fontSize: 44, marginBottom: 10 }}>👤</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>
                        {formatFolderName(folder.name)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LEVEL 2: Year folders ──────────────────────────────────── */}
          {selectedFolder && !selectedYear && (
            <div>
              <h2 style={styles.heading}>
                {formatFolderName(selectedFolder)} — Years
              </h2>
              {loadingYears ? (
                <p style={{ color: "#6b7280" }}>Loading years…</p>
              ) : yearFolders.length === 0 ? (
                <p style={{ color: "#6b7280", fontStyle: "italic" }}>No year folders found.</p>
              ) : (
                <div style={styles.grid}>
                  {yearFolders.map((folder) => (
                    <button
                      key={folder.name}
                      onClick={() => loadFiles(folder.name)}
                      style={styles.folderCard}
                    >
                      <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: "#111" }}>
                        {folder.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LEVEL 3: Files ─────────────────────────────────────────── */}
          {selectedFolder && selectedYear && (
            <div>
              <h2 style={styles.heading}>
                {formatFolderName(selectedFolder)} — {selectedYear}
              </h2>
              {loadingFiles ? (
                <p style={{ color: "#6b7280" }}>Loading files…</p>
              ) : files.length === 0 ? (
                <p style={{ color: "#6b7280", fontStyle: "italic" }}>No files found in this folder.</p>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {files.map((file) => {
                    const filePath = `${selectedFolder}/${selectedYear}/${file.name}`;
                    const meta = dbMeta[filePath];
                    return (
                      <div key={file.name} style={styles.fileRow}>
                        <div style={{ fontSize: 30, flexShrink: 0 }}>📄</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4, wordBreak: "break-word" }}>
                            {file.name}
                          </div>
                          {meta ? (
                            <div style={{ fontSize: 13, color: "#6b7280" }}>
                              {meta.pay_date && <>💰 Pay Date: <strong>{fmtDate(meta.pay_date)}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;</>}
                              {meta.pay_period_start && meta.pay_period_end && (
                                <>📅 Period: {fmtDate(meta.pay_period_start)} – {fmtDate(meta.pay_period_end)}</>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                              Stored in archive (no DB record)
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button onClick={() => viewFile(file.name)} style={styles.btnBlue}>
                            📥 View
                          </button>
                          <button onClick={() => deleteFile(file.name)} style={styles.btnRed}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function crumbStyle(clickable) {
  return {
    background: "none",
    border: "none",
    padding: "4px 8px",
    cursor: clickable ? "pointer" : "default",
    fontSize: 15,
    fontWeight: 700,
    color: clickable ? "#7c3aed" : "#374151",
    textDecoration: clickable ? "underline" : "none",
    borderRadius: 6,
  };
}

const styles = {
  heading: { fontSize: 22, fontWeight: 800, color: "#111", marginTop: 0, marginBottom: 20 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 },
  folderCard: {
    padding: "24px 16px",
    border: "2px solid #e5e7eb",
    borderRadius: 14,
    backgroundColor: "#fafafa",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    transition: "all 0.15s",
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 18,
    border: "2px solid #e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    flexWrap: "wrap",
  },
  btnBlue: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnRed: {
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  backBtn: {
    backgroundColor: "#fc6b04ff",
    color: "#fff",
    border: "none",
    padding: "12px 22px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  msg: {
    padding: "12px 16px",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 600,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
};

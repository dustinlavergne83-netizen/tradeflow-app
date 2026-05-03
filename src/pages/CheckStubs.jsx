import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
  ai: "#7c3aed",
};

// ─── Format pay date as MM.DD.YY (matches SmartVault naming) ─────────────────
function formatPayDateFilename(dateStr) {
  if (!dateStr) return "unknown";
  // Handle YYYY-MM-DD safely (add noon to avoid timezone shift)
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr.replace(/-/g, ".");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}.${dd}.${yy}`;
}

// ─── Build storage path inside check-stubs bucket: FirstName_LastName/YYYY/MM.DD.YYpaystub.pdf
function buildFilePath(firstName, lastName, payDate) {
  const folder = `${firstName}_${lastName}`;
  const dateName = formatPayDateFilename(payDate);
  // Extract full year from the original date string for the year subfolder
  const year = payDate ? new Date(payDate + "T12:00:00").getFullYear() : new Date().getFullYear();
  // NOTE: bucket is "check-stubs" — path inside must NOT repeat it
  return `${folder}/${year}/${dateName}paystub.pdf`;
}

// ─── Dynamically load PDF.js from CDN ──────────────────────────────────────
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}

export default function CheckStubs() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Single upload
  const [uploading, setUploading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // Bulk upload
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  // AI Smart Upload
  const [aiFiles, setAiFiles] = useState([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiProgressText, setAiProgressText] = useState("");
  const [aiResults, setAiResults] = useState([]);
  const [aiUploading, setAiUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Shared
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("ai"); // default to AI tab

  useEffect(() => {
    loadData();
  }, []);

  // ── Load employees ────────────────────────────────────────────────────────

  async function loadData() {
    try {
      setLoading(true);
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email")
        .or("archived.is.null,archived.eq.false")
        .order("first_name");
      if (empError) throw empError;
      setEmployees(empData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage({ type: "error", text: "Failed to load employees" });
    } finally {
      setLoading(false);
    }
  }

  // ── Single Upload ─────────────────────────────────────────────────────────

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
      // Find employee name for folder path
      const emp = employees.find((e) => e.id === selectedEmployee);
      if (!emp) throw new Error("Employee not found");

      const filePath = buildFilePath(emp.first_name, emp.last_name, payDate || payPeriodEnd);
      const fileName = `${formatPayDateFilename(payDate || payPeriodEnd)} paystub.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("check-stubs")
        .upload(filePath, selectedFile, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from("check_stubs").insert({
        employee_id: selectedEmployee,
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
        pay_date: payDate,
        file_path: filePath,
        file_name: fileName,
        uploaded_by: user?.id,
      });
      if (dbError && dbError.code !== "23505") throw dbError;

      setMessage({ type: "success", text: "Check stub uploaded successfully!" });
      setSelectedEmployee("");
      setPayPeriodStart("");
      setPayPeriodEnd("");
      setPayDate("");
      setSelectedFile(null);
      document.getElementById("fileInput").value = "";
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to upload check stub" });
    } finally {
      setUploading(false);
    }
  }

  // ── Bulk Upload ───────────────────────────────────────────────────────────

  async function handleBulkUpload() {
    if (bulkFiles.length === 0) {
      setMessage({ type: "error", text: "Please select files to upload" });
      return;
    }
    setBulkUploading(true);
    setMessage({ type: "", text: "" });

    const results = { success: [], failed: [] };
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      for (const file of bulkFiles) {
        try {
          const nameWithoutExt = file.name.replace(".pdf", "").replace(".PDF", "");
          const parts = nameWithoutExt.split("_");
          if (parts.length !== 3) {
            results.failed.push({
              file: file.name,
              reason: "Invalid filename format. Expected: FirstName_LastName_PayDate.pdf",
            });
            continue;
          }

          const [firstName, lastName, payDateStr] = parts;
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

          const pEnd = new Date(payDateStr);
          if (isNaN(pEnd.getTime())) {
            results.failed.push({ file: file.name, reason: "Invalid date format. Use YYYY-MM-DD" });
            continue;
          }
          const pStart = new Date(pEnd);
          pStart.setDate(pStart.getDate() - 13);

          const startStr = pStart.toISOString().split("T")[0];
          const endStr = pEnd.toISOString().split("T")[0];

          // Store in employee folder, named by pay date
          const filePath = buildFilePath(employee.first_name, employee.last_name, endStr);
          const fileName = `${formatPayDateFilename(endStr)} paystub.pdf`;

          const { error: uploadError } = await supabase.storage
            .from("check-stubs")
            .upload(filePath, file, { contentType: "application/pdf", upsert: true });
          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase.from("check_stubs").insert({
            employee_id: employee.id,
            pay_period_start: startStr,
            pay_period_end: endStr,
            pay_date: endStr,
            file_path: filePath,
            file_name: fileName,
            uploaded_by: user?.id,
          });
          if (dbError && dbError.code !== "23505") throw dbError;

          results.success.push(file.name);
        } catch (err) {
          results.failed.push({ file: file.name, reason: err.message || "Unknown error" });
        }
      }

      let msg = "";
      if (results.success.length > 0) msg += `✅ Successfully uploaded ${results.success.length} file(s)\n`;
      if (results.failed.length > 0) {
        msg += `\n❌ Failed to upload ${results.failed.length} file(s):\n`;
        results.failed.forEach((f) => { msg += `- ${f.file}: ${f.reason}\n`; });
      }

      setMessage({ type: results.failed.length === 0 ? "success" : "error", text: msg });
      setBulkFiles([]);
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Bulk upload failed" });
    } finally {
      setBulkUploading(false);
    }
  }

  // ── AI Smart Upload ───────────────────────────────────────────────────────

  function updateAiResult(index, field, value) {
    setAiResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "employee_id") {
        updated[index].status = value ? "ready" : "needs_review";
      }
      return updated;
    });
  }

  function addAiFiles(newFiles) {
    const pdfs = Array.from(newFiles).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    setAiFiles((prev) => [...prev, ...pdfs]);
    setAiResults([]);
    setAiProgress(0);
    setAiProgressText("");
  }

  async function handleAiAnalyze() {
    if (aiFiles.length === 0) {
      setMessage({ type: "error", text: "Please select PDF files to analyze" });
      return;
    }

    setAiAnalyzing(true);
    setAiResults([]);
    setAiProgress(0);
    setAiProgressText("");
    setMessage({ type: "", text: "" });

    const results = [];

    try {
      const pdfjsLib = await loadPdfJs();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      for (let i = 0; i < aiFiles.length; i++) {
        const file = aiFiles[i];
        setAiProgressText(`Reading "${file.name}" (${i + 1} of ${aiFiles.length})...`);
        setAiProgress(Math.round((i / aiFiles.length) * 100));

        try {
          // Load PDF bytes
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const page = await pdfDoc.getPage(1);

          // Render at 1.5× scale for good AI OCR quality
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

          // Render small thumbnail (0.2×) for display
          const thumbVP = page.getViewport({ scale: 0.2 });
          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = thumbVP.width;
          thumbCanvas.height = thumbVP.height;
          await page.render({ canvasContext: thumbCanvas.getContext("2d"), viewport: thumbVP }).promise;
          const thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.6);

          // Call edge function
          const resp = await fetch(`${supabaseUrl}/functions/v1/ai-parse-paystub`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: anonKey,
            },
            body: JSON.stringify({
              pageImageBase64: base64,
              employees: employees.map((e) => ({
                id: e.id,
                first_name: e.first_name,
                last_name: e.last_name,
              })),
            }),
          });

          const aiData = await resp.json();

          results.push({
            file,
            fileName: file.name,
            thumbnail,
            employee_id: aiData.employee_id || "",
            employee_name_detected: aiData.employee_name || "Not detected",
            pay_period_start: aiData.pay_period_start || "",
            pay_period_end: aiData.pay_period_end || "",
            pay_date: aiData.pay_date || "",
            confidence: Math.round((aiData.confidence || 0) * 100),
            status: aiData.employee_id ? "ready" : "needs_review",
            error: null,
          });
        } catch (err) {
          results.push({
            file,
            fileName: file.name,
            thumbnail: null,
            employee_id: "",
            employee_name_detected: "Error reading file",
            pay_period_start: "",
            pay_period_end: "",
            pay_date: "",
            confidence: 0,
            status: "error",
            error: err.message,
          });
        }

        // Show results as they come in
        setAiResults([...results]);
      }

      setAiProgress(100);
      const readyN = results.filter((r) => r.status === "ready").length;
      const reviewN = results.filter((r) => r.status !== "ready").length;
      setAiProgressText(
        `✅ Done! ${readyN} ready${reviewN > 0 ? `, ${reviewN} need review` : ""}`
      );
    } catch (err) {
      setMessage({ type: "error", text: `AI analysis failed: ${err.message}` });
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleAiUpload() {
    const readyResults = aiResults.filter((r) => r.employee_id && r.pay_period_end);
    if (readyResults.length === 0) {
      setMessage({
        type: "error",
        text: "No stubs are ready. Assign an employee and pay period end date to each row first.",
      });
      return;
    }

    setAiUploading(true);
    setMessage({ type: "", text: "" });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uploadResults = { success: [], failed: [] };

    for (const result of readyResults) {
      try {
        // Find employee name for folder
        const emp = employees.find((e) => e.id === result.employee_id);
        if (!emp) throw new Error("Employee not found in local list");

        const payDateForFile = result.pay_date || result.pay_period_end;
        const filePath = buildFilePath(emp.first_name, emp.last_name, payDateForFile);
        const fileName = `${formatPayDateFilename(payDateForFile)} paystub.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("check-stubs")
          .upload(filePath, result.file, { contentType: "application/pdf", upsert: true });
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("check_stubs").insert({
          employee_id: result.employee_id,
          pay_period_start: result.pay_period_start || result.pay_period_end,
          pay_period_end: result.pay_period_end,
          pay_date: result.pay_date || result.pay_period_end,
          file_path: filePath,
          file_name: fileName,
          uploaded_by: user?.id,
        });
        if (dbError && dbError.code !== "23505") throw dbError;

        uploadResults.success.push(result.fileName);
      } catch (err) {
        uploadResults.failed.push({ file: result.fileName, reason: err.message });
      }
    }

    let msg = "";
    if (uploadResults.success.length > 0)
      msg += `✅ Uploaded ${uploadResults.success.length} check stub(s) successfully!`;
    if (uploadResults.failed.length > 0)
      msg += `\n❌ Failed (${uploadResults.failed.length}): ${uploadResults.failed
        .map((f) => f.file)
        .join(", ")}`;

    setMessage({
      type: uploadResults.failed.length === 0 ? "success" : "error",
      text: msg,
    });
    setAiUploading(false);
    if (uploadResults.failed.length === 0) {
      setAiFiles([]);
      setAiResults([]);
      setAiProgress(0);
      setAiProgressText("");
    }
    loadData();
  }

  // ── Delete / Download ─────────────────────────────────────────────────────

  async function deleteCheckStub(stub) {
    if (
      !window.confirm(
        `Delete check stub for ${stub.employee?.first_name} ${stub.employee?.last_name} (${stub.pay_period_end})?`
      )
    )
      return;
    try {
      await supabase.storage.from("check-stubs").remove([stub.file_path]);
      await supabase.from("check_stubs").delete().eq("id", stub.id);
      setMessage({ type: "success", text: "Check stub deleted" });
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete check stub" });
    }
  }

  async function downloadCheckStub(stub) {
    try {
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .createSignedUrl(stub.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      setMessage({ type: "error", text: "Failed to download check stub" });
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const readyCount = aiResults.filter((r) => r.status === "ready" && r.employee_id && r.pay_period_end).length;
  const needsReviewCount = aiResults.filter((r) => r.status !== "ready").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Employee Check Stubs</h2>
          <button
            onClick={() => navigate("/check-stubs/browse")}
            style={{
              backgroundColor: "#fff",
              color: "#4c1d95",
              border: "3px solid #fff",
              padding: "12px 22px",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
          >
            📁 View Archive
          </button>
        </div>

        {message.text && (
          <div
            style={{
              ...styles.message,
              backgroundColor: message.type === "success" ? "#10b981" : "#ef4444",
              whiteSpace: "pre-wrap",
            }}
          >
            {message.text}
          </div>
        )}

        {/* ── Tab Buttons ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { key: "ai", label: "🤖 AI Smart Upload", color: BRAND.ai },
            { key: "bulk", label: "📦 Bulk Upload", color: BRAND.primary },
            { key: "single", label: "📄 Single Upload", color: BRAND.primary },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...styles.toggleButton,
                backgroundColor: activeTab === tab.key ? tab.color : "#fff",
                color: activeTab === tab.key ? "#fff" : "#111",
                borderColor: activeTab === tab.key ? tab.color : "#e5e7eb",
                boxShadow: activeTab === tab.key ? `0 0 0 3px ${tab.color}33` : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            AI SMART UPLOAD TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "ai" && (
          <div>
            {/* Hero card */}
            <div style={styles.aiHeroCard}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 40, lineHeight: 1 }}>🤖</div>
                <div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, color: "#4c1d95" }}>
                    AI Smart Upload
                  </h3>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
                    Drop all your paystub PDFs here — <strong>any filename works</strong>. AI reads each
                    file, identifies the employee name and pay period dates, then lets you review before
                    saving. No renaming required.
                  </p>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: dragOver ? BRAND.ai : "#a78bfa",
                  backgroundColor: dragOver ? "#ede9fe" : "#faf5ff",
                  transform: dragOver ? "scale(1.01)" : "scale(1)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addAiFiles(e.dataTransfer.files);
                }}
                onClick={() => document.getElementById("aiFileInput").click()}
              >
                <div style={{ fontSize: 52, marginBottom: 8 }}>
                  {dragOver ? "📥" : "📂"}
                </div>
                <p style={{ margin: 0, fontWeight: 800, color: "#4c1d95", fontSize: 17 }}>
                  {dragOver ? "Drop files here!" : "Drag & drop paystub PDFs here"}
                </p>
                <p style={{ margin: "6px 0 0 0", color: "#7c3aed", fontSize: 13 }}>
                  or <span style={{ textDecoration: "underline", cursor: "pointer" }}>click to browse</span>
                  {" "}— accepts any filename (e.g. 03.19.26 paystub.pdf)
                </p>
                <input
                  id="aiFileInput"
                  type="file"
                  accept="application/pdf"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => { addAiFiles(e.target.files); e.target.value = ""; }}
                />
              </div>

              {/* File list */}
              {aiFiles.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>
                      {aiFiles.length} PDF{aiFiles.length !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      onClick={() => { setAiFiles([]); setAiResults([]); setAiProgress(0); setAiProgressText(""); }}
                      style={styles.clearBtn}
                    >
                      ✕ Clear all
                    </button>
                  </div>
                  <div style={styles.fileListBox}>
                    {aiFiles.map((f, i) => (
                      <div key={i} style={styles.fileListRow(i)}>
                        <span style={{ fontSize: 13, color: "#374151" }}>📄 {f.name}</span>
                        <button
                          onClick={() => {
                            setAiFiles((prev) => prev.filter((_, j) => j !== i));
                            setAiResults([]);
                          }}
                          style={styles.removeFileBtn}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button
                onClick={handleAiAnalyze}
                disabled={aiAnalyzing || aiFiles.length === 0}
                style={{
                  ...styles.uploadButton,
                  backgroundColor:
                    aiAnalyzing || aiFiles.length === 0 ? "#c4b5fd" : BRAND.ai,
                  cursor: aiAnalyzing || aiFiles.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {aiAnalyzing
                  ? `⏳ ${aiProgressText || "Analyzing..."}`
                  : `🔍 Analyze ${aiFiles.length > 0 ? aiFiles.length + " File" + (aiFiles.length !== 1 ? "s" : "") : "Files"} with AI`}
              </button>

              {/* Progress bar */}
              {(aiAnalyzing || aiProgress > 0) && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    <span>{aiProgressText}</span>
                    <span style={{ fontWeight: 700 }}>{aiProgress}%</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${aiProgress}%`,
                        backgroundColor: aiProgress === 100 ? "#10b981" : BRAND.ai,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── AI Results ────────────────────────────────────────────────── */}
            {aiResults.length > 0 && (
              <div style={styles.uploadSection}>
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ ...styles.sectionTitle, marginBottom: 6 }}>
                      Review AI Results — {aiResults.length} File{aiResults.length !== 1 ? "s" : ""}
                    </h3>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>
                        ✅ {readyCount} ready to upload
                      </span>
                      {needsReviewCount > 0 && (
                        <span style={{ color: "#f59e0b", fontWeight: 700 }}>
                          ⚠️ {needsReviewCount} need review
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleAiUpload}
                    disabled={aiUploading || readyCount === 0}
                    style={{
                      ...styles.uploadButton,
                      width: "auto",
                      padding: "12px 28px",
                      backgroundColor: readyCount === 0 ? "#d1d5db" : "#10b981",
                      cursor: readyCount === 0 ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {aiUploading ? "Uploading..." : `✅ Upload ${readyCount} Stub${readyCount !== 1 ? "s" : ""}`}
                  </button>
                </div>

                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, marginTop: 0 }}>
                  Correct any mistakes using the dropdowns and date fields, then click Upload. Fields
                  highlighted in <span style={{ color: "#f59e0b", fontWeight: 700 }}>yellow</span> need your attention.
                </p>

                {/* Result cards */}
                <div style={{ display: "grid", gap: 16 }}>
                  {aiResults.map((result, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.resultCard,
                        borderColor:
                          result.status === "ready"
                            ? "#10b981"
                            : result.status === "error"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {/* Card header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 14,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Thumbnail */}
                        {result.thumbnail ? (
                          <img
                            src={result.thumbnail}
                            alt="Stub preview"
                            style={{
                              width: 48,
                              height: 62,
                              objectFit: "contain",
                              border: "1px solid #e5e7eb",
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 62,
                              backgroundColor: "#f3f4f6",
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 22,
                              flexShrink: 0,
                            }}
                          >
                            📄
                          </div>
                        )}

                        {/* File info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 700,
                              color: "#111",
                              fontSize: 14,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {result.status === "ready"
                              ? "✅"
                              : result.status === "error"
                              ? "❌"
                              : "⚠️"}{" "}
                            {result.fileName}
                          </p>
                          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6b7280" }}>
                            AI read:{" "}
                            <strong style={{ color: "#111" }}>
                              {result.employee_name_detected}
                            </strong>
                            {result.confidence > 0 && (
                              <span
                                style={{
                                  marginLeft: 10,
                                  fontWeight: 700,
                                  color:
                                    result.confidence >= 80
                                      ? "#10b981"
                                      : result.confidence >= 50
                                      ? "#f59e0b"
                                      : "#ef4444",
                                }}
                              >
                                {result.confidence}% confidence
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Status badge */}
                        <div
                          style={{
                            ...styles.badge,
                            backgroundColor:
                              result.status === "ready"
                                ? "#d1fae5"
                                : result.status === "error"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              result.status === "ready"
                                ? "#065f46"
                                : result.status === "error"
                                ? "#991b1b"
                                : "#92400e",
                          }}
                        >
                          {result.status === "ready"
                            ? "READY"
                            : result.status === "error"
                            ? "ERROR"
                            : "REVIEW"}
                        </div>
                      </div>

                      {/* Editable fields */}
                      <div style={styles.resultGrid}>
                        <div style={styles.resultField}>
                          <label style={styles.resultLabel}>Employee *</label>
                          <select
                            value={result.employee_id}
                            onChange={(e) => updateAiResult(idx, "employee_id", e.target.value)}
                            style={{
                              ...styles.select,
                              borderColor: result.employee_id ? "#10b981" : "#f59e0b",
                              borderWidth: 2,
                            }}
                          >
                            <option value="">⚠️ Select Employee…</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={styles.resultField}>
                          <label style={styles.resultLabel}>Pay Period Start</label>
                          <input
                            type="date"
                            value={result.pay_period_start}
                            onChange={(e) => updateAiResult(idx, "pay_period_start", e.target.value)}
                            style={styles.input}
                          />
                        </div>

                        <div style={styles.resultField}>
                          <label style={styles.resultLabel}>Pay Period End *</label>
                          <input
                            type="date"
                            value={result.pay_period_end}
                            onChange={(e) => updateAiResult(idx, "pay_period_end", e.target.value)}
                            style={{
                              ...styles.input,
                              borderColor: result.pay_period_end ? "#10b981" : "#f59e0b",
                              borderWidth: 2,
                            }}
                          />
                        </div>

                        <div style={styles.resultField}>
                          <label style={styles.resultLabel}>Pay Date</label>
                          <input
                            type="date"
                            value={result.pay_date}
                            onChange={(e) => updateAiResult(idx, "pay_date", e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      </div>

                      {result.error && (
                        <p
                          style={{
                            margin: "10px 0 0 0",
                            fontSize: 13,
                            color: "#991b1b",
                            backgroundColor: "#fef2f2",
                            padding: "8px 12px",
                            borderRadius: 6,
                          }}
                        >
                          ❌ Error: {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom upload button */}
                <button
                  onClick={handleAiUpload}
                  disabled={aiUploading || readyCount === 0}
                  style={{
                    ...styles.uploadButton,
                    marginTop: 24,
                    backgroundColor: readyCount === 0 ? "#d1d5db" : "#10b981",
                    cursor: readyCount === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {aiUploading
                    ? "Uploading…"
                    : `✅ Upload ${readyCount} Ready Stub${readyCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BULK UPLOAD TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "bulk" && (
          <div style={styles.uploadSection}>
            <h3 style={styles.sectionTitle}>Bulk Upload Check Stubs</h3>
            <div style={styles.helpBox}>
              <p style={styles.helpTitle}>📝 File Naming Convention:</p>
              <p style={styles.helpText}>
                Name your PDF files:{" "}
                <code>FirstName_LastName_PayDate.pdf</code>
              </p>
              <p style={styles.helpExample}>
                Example: <code>John_Smith_2024-01-15.pdf</code>
              </p>
              <p style={styles.helpText}>
                • The pay date should be the end of the pay period
                <br />
                • The system will auto-calculate a 2-week period
                <br />
                • Employee names must match exactly (first and last name)
                <br />
                • <strong>Tip: Use 🤖 AI Smart Upload if your files have generic date-based names!</strong>
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
              {bulkUploading
                ? "Uploading..."
                : `📤 Upload ${bulkFiles.length} Check Stub(s)`}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SINGLE UPLOAD TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "single" && (
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

              <button type="submit" style={styles.uploadButton} disabled={uploading}>
                {uploading ? "Uploading..." : "📄 Upload Check Stub"}
              </button>
            </form>
          </div>
        )}

        {/* Archive prompt card */}
        <div
          style={{
            backgroundColor: "#ede9fe",
            border: "2px solid #a78bfa",
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px 0", fontWeight: 800, fontSize: 16, color: "#4c1d95" }}>
              📁 View uploaded stubs by employee &amp; year
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#6d28d9" }}>
              Browse, preview, and delete any uploaded check stub from the archive.
            </p>
          </div>
          <button
            onClick={() => navigate("/check-stubs/browse")}
            style={{
              backgroundColor: "#7c3aed",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Open Archive →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    lineHeight: 1.6,
  },
  toggleButton: {
    padding: "12px 22px",
    border: "2px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  aiHeroCard: {
    backgroundColor: "#fff",
    padding: 28,
    borderRadius: 16,
    marginBottom: 24,
    border: "2px solid #ede9fe",
    boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
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
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 16,
    color: "#111",
  },
  dropZone: {
    border: "2.5px dashed #a78bfa",
    borderRadius: 14,
    padding: "32px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: 16,
    userSelect: "none",
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.4s ease",
  },
  resultCard: {
    padding: 20,
    border: "2px solid",
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  resultField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  badge: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  fileListBox: {
    maxHeight: 160,
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  fileListRow: (i) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 4,
    backgroundColor: i % 2 === 0 ? "#fff" : "transparent",
  }),
  clearBtn: {
    background: "none",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "2px 6px",
  },
  removeFileBtn: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 4px",
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
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: 12,
    fontSize: 15,
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
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
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
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: "#fafafa",
  },
  stubInfo: {
    flex: 1,
    minWidth: 200,
  },
  stubEmployee: {
    fontSize: 17,
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "#111",
  },
  stubDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  stubDetail: {
    fontSize: 13,
    color: "#6b7280",
  },
  stubActions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
  actionButton: {
    border: "none",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
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

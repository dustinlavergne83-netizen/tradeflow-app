import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

import { formatDate } from "../utils/dateUtils";
import { notify } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function InvoiceDetailedReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const { user } = useAuth();
  
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyNotes, setDailyNotes] = useState({}); // { itemIdx-date: "note text" }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoiceId) loadReport();
  }, [invoiceId]);

  async function loadReport() {
    try {
      console.log("Loading invoice with ID:", invoiceId);
      
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) {
        console.error("Invoice query error:", invoiceError);
        setLoading(false);
        return;
      }

      console.log("Loaded invoice:", invoiceData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at");

      if (itemsError) {
        console.error("Items query error:", itemsError);
      }

      console.log("Loaded items:", itemsData);
      
      setInvoice(invoiceData);
      setInvoiceItems(itemsData || []);
      console.log("About to set items:", itemsData);
      console.log("Items count:", itemsData?.length);
    } catch (err) {
      console.error("Error loading report:", err);
    } finally {
      setLoading(false);
    }
  }

  // Initialize daily notes from loaded breakdown data
  useEffect(() => {
    if (!invoiceItems || invoiceItems.length === 0) return;
    const notes = {};
    invoiceItems.forEach((item, idx) => {
      try {
        const parsed = item?.daily_breakdown ? JSON.parse(item.daily_breakdown) : null;
        if (!parsed) return;
        // Check for dayNotes object in breakdown
        const dayNotes = parsed.dayNotes || {};
        Object.entries(dayNotes).forEach(([date, note]) => {
          notes[`${idx}-${date}`] = note;
        });
      } catch(e) { /* ignore */ }
    });
    setDailyNotes(notes);
  }, [invoiceItems]);

  async function handleSaveNotes() {
    setSaving(true);
    try {
      // Group notes by item index
      const notesByItem = {};
      Object.entries(dailyNotes).forEach(([key, note]) => {
        const [idxStr, ...dateParts] = key.split('-');
        const idx = parseInt(idxStr);
        const date = dateParts.join('-'); // rejoin date parts (YYYY-MM-DD)
        if (!notesByItem[idx]) notesByItem[idx] = {};
        notesByItem[idx][date] = note;
      });

      // For each labor item with notes, update the daily_breakdown JSON
      const laborItems = invoiceItems.filter(item => item.description?.toLowerCase().includes("labor"));
      
      for (let idx = 0; idx < laborItems.length; idx++) {
        const item = laborItems[idx];
        if (!notesByItem[idx] && !item.daily_breakdown) continue;
        
        let parsed = {};
        try {
          parsed = item.daily_breakdown ? JSON.parse(item.daily_breakdown) : {};
        } catch(e) { parsed = {}; }
        
        // Merge notes into the breakdown
        parsed.dayNotes = notesByItem[idx] || {};
        
        const { error } = await supabase
          .from("invoice_items")
          .update({ daily_breakdown: JSON.stringify(parsed) })
          .eq("id", item.id);
        
        if (error) {
          console.error("Error saving notes for item:", item.id, error);
        }
      }
      
      notify("✅ Daily notes saved!");
    } catch (err) {
      console.error("Error saving daily notes:", err);
      notify("Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPDF() {
    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setTextColor(11, 62, 168);
      doc.text("INVOICE DETAILED BREAKDOWN", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 15;

      // Invoice info
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice #${invoice?.invoice_number}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Customer: ${invoice?.customer_name}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Date: ${invoice?.invoice_date}`, 20, yPosition);
      yPosition += 10;

      // Separate labor and materials
      const laborItems = invoiceItems.filter(
        (item) =>
          item.description?.toLowerCase().includes("labor") ||
          item.unit_price === 71
      );
      const materialItems = invoiceItems.filter(
        (item) =>
          !item.description?.toLowerCase().includes("labor") &&
          item.unit_price !== 71
      );

      // Labor Section
      if (laborItems.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(11, 62, 168);
        doc.text("LABOR CHARGES", 20, yPosition);
        yPosition += 8;

        autoTable(doc, {
          startY: yPosition,
          head: [
            ["Description", "Hours", "Rate", "Subtotal", "Markup %", "Total"],
          ],
          body: laborItems.map((item) => [
            item.description || "",
            item.quantity?.toFixed(2) || "0",
            `$${(item.unit_price || 0).toFixed(2)}`,
            `$${(item.total || 0).toFixed(2)}`,
            "0%",
            `$${(item.total || 0).toFixed(2)}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [11, 62, 168], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right", fontStyle: "bold" },
          },
        });

        yPosition = doc.lastAutoTable.finalY + 10;
      }

      // Materials Section
      if (materialItems.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(11, 62, 168);
        doc.text("MATERIALS & EXPENSES", 20, yPosition);
        yPosition += 8;

        autoTable(doc, {
          startY: yPosition,
          head: [["Description", "Quantity", "Unit Price", "Total"]],
          body: materialItems.map((item) => [
            item.description || "",
            item.quantity?.toFixed(2) || "0",
            `$${(item.unit_price || 0).toFixed(2)}`,
            `$${(item.total || 0).toFixed(2)}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [11, 62, 168], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right", fontStyle: "bold" },
          },
        });

        yPosition = doc.lastAutoTable.finalY + 10;
      }

      // Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const laborTotal = laborItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const materialsTotal = materialItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const grandTotal = laborTotal + materialsTotal;

      doc.text(`Labor Total: $${laborTotal.toFixed(2)}`, 20, yPosition);
      yPosition += 6;
      doc.text(
        `Materials & Expenses Total: $${materialsTotal.toFixed(2)}`,
        20,
        yPosition
      );
      yPosition += 10;
      doc.setFontSize(14);
      doc.setTextColor(11, 62, 168);
      doc.text(`GRAND TOTAL: $${grandTotal.toFixed(2)}`, 20, yPosition, {
        fontStyle: "bold",
      });

      doc.save(
        `Invoice-${invoice?.invoice_number}-DetailedReport-${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (err) {
      console.error("Error generating PDF:", err);
      notify("Failed to generate PDF. Please ensure jsPDF is installed.");
    }
  }

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (!invoice) return <div style={styles.error}>Invoice not found</div>;

  // Separate labor and materials
  const laborItems = invoiceItems.filter(
    (item) => item.description?.toLowerCase().includes("labor")
  );
  const materialItems = invoiceItems.filter(
    (item) => !item.description?.toLowerCase().includes("labor")
  );
  
  // Calculate totals INCLUDING markups
  const laborTotal = laborItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    const markupAmount = baseTotal * (markupPercent / 100);
    return sum + baseTotal + markupAmount;
  }, 0);
  
  const materialsTotal = materialItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    const markupAmount = baseTotal * (markupPercent / 100);
    return sum + baseTotal + markupAmount;
  }, 0);
  
  const grandTotal = laborTotal + materialsTotal;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Invoice Detailed Report</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSaveNotes} disabled={saving} style={{...styles.exportButton, background: '#3b82f6', opacity: saving ? 0.6 : 1}}>
            {saving ? '💾 Saving...' : '💾 Save Notes'}
          </button>
          <button onClick={handleExportPDF} style={styles.exportButton}>
            📄 Export to PDF
          </button>
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            ← Back
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📋 Invoice Information</h2>
          <div style={styles.infoGrid}>
            <div style={{paddingBottom: 12, borderBottom: '1px solid #e5e7eb'}}>
              <span style={{fontSize: 12, color: '#666', fontWeight: '600'}}>INVOICE #</span>
              <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginTop: 4}}>{invoice.invoice_number}</div>
            </div>
            <div style={{paddingBottom: 12, borderBottom: '1px solid #e5e7eb'}}>
              <span style={{fontSize: 12, color: '#666', fontWeight: '600'}}>CUSTOMER</span>
              <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginTop: 4}}>{invoice.customer_name}</div>
            </div>
            <div style={{paddingBottom: 12, borderBottom: '1px solid #e5e7eb'}}>
              <span style={{fontSize: 12, color: '#666', fontWeight: '600'}}>DATE</span>
              <div style={{fontSize: 15, color: '#111', marginTop: 4}}>{invoice.invoice_date}</div>
            </div>
            <div style={{paddingBottom: 12, borderBottom: '1px solid #e5e7eb'}}>
              <span style={{fontSize: 12, color: '#666', fontWeight: '600'}}>STATUS</span>
              <div style={{fontSize: 15, color: '#111', marginTop: 4, textTransform: 'capitalize'}}>{invoice.status}</div>
            </div>
          </div>
        </div>


        {/* Labor Section */}
        {laborItems.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>💼 Labor Charges ({laborItems.length})</h2>
            {laborItems.map((item, idx) => {
              const baseTotal = item?.total || 0;
              const markupPercent = item?.markup_percentage || 0;
              const markupAmount = baseTotal * (markupPercent / 100);
              const totalWithMarkup = baseTotal + markupAmount;
              const baseRate = item?.unit_price || 0;
              const billedRate = baseRate * (1 + markupPercent / 100);
              const quantity = item?.quantity || 0;
              
              // Parse daily_breakdown - could be {laborDetails: [...]} or {date: {hours, notes}}
              let parsedBreakdown = null;
              try {
                parsedBreakdown = item?.daily_breakdown ? JSON.parse(item.daily_breakdown) : null;
              } catch(e) { parsedBreakdown = null; }
              
              // Extract labor details (employee-level with daily entries)
              const laborDetails = parsedBreakdown?.laborDetails || [];
              
              // Build a flat list of all daily entries sorted by date
              const allDailyEntries = [];
              laborDetails.forEach(emp => {
                (emp.entries || []).forEach(entry => {
                  allDailyEntries.push({
                    date: entry.date,
                    hours: entry.hours || 0,
                    clockIn: entry.clockIn || '',
                    clockOut: entry.clockOut || '',
                    employee: emp.employee || 'Unknown',
                  });
                });
              });
              // Sort by date
              allDailyEntries.sort((a, b) => a.date.localeCompare(b.date));
              
              // Group by date
              const byDate = {};
              allDailyEntries.forEach(e => {
                if (!byDate[e.date]) byDate[e.date] = [];
                byDate[e.date].push(e);
              });
              
              const hasDaily = allDailyEntries.length > 0;
              
              return (
                <div key={`labor-${idx}`} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
                  {/* Labor Item Summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Description</div>
                      <div style={{ fontSize: 15, fontWeight: "600", color: "#111" }}>{item?.description || "Labor"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Rate {markupPercent > 0 ? `(incl. ${markupPercent}% markup)` : ''}</div>
                      <div style={{ fontSize: 15, fontWeight: "600", color: "#111" }}>${billedRate.toFixed(2)}/hr</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Total Hours</div>
                      <div style={{ fontSize: 15, fontWeight: "600", color: "#111" }}>{quantity.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: "#fc6b04" }}>${totalWithMarkup.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {/* Daily Breakdown from time clock data */}
                  {hasDaily && (
                    <div style={{ padding: 16, backgroundColor: "#f0f7ff", borderRadius: 8, borderLeft: "4px solid #3b82f6" }}>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: "#0369a1", marginBottom: 12 }}>📅 Daily Hours Breakdown</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(byDate).map(([date, entries]) => {
                          const dayTotal = entries.reduce((s, e) => s + e.hours, 0);
                          return (
                            <div key={date} style={{ padding: 12, backgroundColor: "#fff", borderRadius: 6, border: "1px solid #d1d5db" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entries.length > 1 ? 8 : 0 }}>
                                <div style={{ fontWeight: "600", color: "#111" }}>
                                  📆 {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: "600", color: "#0369a1" }}>
                                  {dayTotal.toFixed(2)} hrs × ${billedRate.toFixed(2)}/hr = <span style={{ color: "#fc6b04", fontWeight: "bold" }}>${(dayTotal * billedRate).toFixed(2)}</span>
                                </div>
                              </div>
                              {entries.map((entry, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", backgroundColor: "#f9fafb", borderRadius: 4, marginTop: 4, fontSize: 13 }}>
                                  <span style={{ color: "#374151" }}>👷 {entry.employee}</span>
                                  <span style={{ color: "#6b7280" }}>
                                    {entry.clockIn} → {entry.clockOut} ({entry.hours.toFixed(2)} hrs)
                                  </span>
                                </div>
                              ))}
                              {/* Work Description for this day */}
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 12, color: "#666", fontWeight: "600", marginBottom: 4 }}>📝 Work Performed:</div>
                                <textarea
                                  value={dailyNotes[`${idx}-${date}`] || ""}
                                  onChange={(e) => setDailyNotes(prev => ({ ...prev, [`${idx}-${date}`]: e.target.value }))}
                                  placeholder="Describe work performed this day..."
                                  style={{
                                    width: "100%",
                                    minHeight: 50,
                                    padding: "8px 12px",
                                    fontSize: 13,
                                    border: "1px solid #d1d5db",
                                    borderRadius: 6,
                                    backgroundColor: "#fff",
                                    color: "#111",
                                    resize: "vertical",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "2px solid #d1d5db", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "#111" }}>Total Hours</div>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: "#fc6b04" }}>
                          {allDailyEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(2)} hrs = ${(allDailyEntries.reduce((sum, e) => sum + e.hours, 0) * billedRate).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 16, padding: 16, backgroundColor: "#f3f4f6", borderRadius: 8, fontWeight: "bold" }}>
              <div>Labor Subtotal</div>
              <div style={{ textAlign: "right", fontSize: 16, color: "#fc6b04" }}>${laborTotal.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Materials Section */}
        {materialItems.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>🛠️ Materials & Expenses</h2>
            {materialItems.map((item, idx) => {
              const baseTotal = item?.total || 0;
              const markupPercent = item?.markup_percentage || 0;
              const markupAmount = baseTotal * (markupPercent / 100);
              const totalWithMarkup = baseTotal + markupAmount;
              
              // Parse materialDetails from daily_breakdown
              let parsedBreakdown = null;
              try {
                parsedBreakdown = item?.daily_breakdown ? JSON.parse(item.daily_breakdown) : null;
              } catch(e) { parsedBreakdown = null; }
              
              const materialDetails = parsedBreakdown?.materialDetails || [];
              const hasDetails = materialDetails.length > 0;
              
              return (
                <div key={`material-${idx}`} style={{ marginBottom: 16 }}>
                  {hasDetails ? (
                    <div style={styles.table}>
                      <div style={styles.tableHeader}>
                        <div style={{ flex: 3 }}>Description</div>
                        <div style={{ flex: 1.5 }}>Vendor</div>
                        <div style={{ flex: 1, textAlign: "center" }}>Date</div>
                        <div style={{ flex: 1, textAlign: "right" }}>Amount</div>
                      </div>
                      {materialDetails.map((mat, i) => (
                        <div key={`mat-detail-${i}`} style={styles.tableRow}>
                          <div style={{ flex: 3, color: "#000" }}>{mat.description || "Expense"}</div>
                          <div style={{ flex: 1.5, color: "#666" }}>{mat.vendor || "—"}</div>
                          <div style={{ flex: 1, textAlign: "center", color: "#666", fontSize: 13 }}>
                            {mat.date ? new Date(mat.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </div>
                          <div style={{ flex: 1, textAlign: "right", fontWeight: "600", color: "#000" }}>
                            ${(mat.amount || 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.table}>
                      <div style={styles.tableHeader}>
                        <div style={{ flex: 4 }}>Description</div>
                        <div style={{ flex: 1, textAlign: "right" }}>Qty</div>
                        <div style={{ flex: 1, textAlign: "right" }}>Total</div>
                      </div>
                      <div style={styles.tableRow}>
                        <div style={{ flex: 4, color: "#000" }}>{item?.description || "Material"}</div>
                        <div style={{ flex: 1, textAlign: "right", color: "#000" }}>{(item?.quantity || 0).toFixed(2)}</div>
                        <div style={{ flex: 1, textAlign: "right", fontWeight: "bold", color: "#000" }}>${totalWithMarkup.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 16, padding: 16, backgroundColor: "#f3f4f6", borderRadius: 8, fontWeight: "bold", marginTop: 8 }}>
              <div>Materials Subtotal</div>
              <div style={{ textAlign: "right", fontSize: 16, color: "#fc6b04" }}>${materialsTotal.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Summary</h2>
          {invoiceItems.length === 0 ? (
            <div style={{ padding: '20px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d', color: '#92400e' }}>
              ⚠️ No line items found for this invoice. Please add items to the invoice before viewing the detailed report.
            </div>
          ) : (
            <div style={styles.summary}>
              {laborItems.length > 0 && (
                <div style={styles.summaryRow}>
                  <span>Labor Total:</span>
                  <span>${laborTotal.toFixed(2)}</span>
                </div>
              )}
              {materialItems.length > 0 && (
                <div style={styles.summaryRow}>
                  <span>Materials & Expenses Total:</span>
                  <span>${materialsTotal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ ...styles.summaryRow, borderTop: "2px solid #e5e7eb", paddingTop: 12, marginTop: 12, fontSize: 18, fontWeight: "bold", color: BRAND.accent }}>
                <span>GRAND TOTAL:</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1200,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
  },
  exportButton: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 24,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    fontSize: 15,
    lineHeight: 1.8,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    display: "flex",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
    fontWeight: "bold",
    color: "#666",
    flexWrap: "nowrap",
    minHeight: "40px",
  },
  tableRow: {
    display: "flex",
    gap: 12,
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
    minHeight: "40px",
    flexWrap: "nowrap",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#fafafa",
  },
  tableCell: {
    display: "flex",
    alignItems: "center",
  },
  summary: {
    fontSize: 16,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  error: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 18,
    padding: 40,
  },
};

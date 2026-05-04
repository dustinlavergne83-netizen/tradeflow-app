import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const ACCENT = "#fc6b04";
const BLUE = "#0b3ea8";
const GREEN = "#16a34a";

export default function ProjectStatement() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]); // individual invoice_payments records
  const [deposits, setDeposits] = useState([]); // project_deposits records
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("ledger"); // "ledger" | "byInvoice"

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  async function loadData() {
    try {
      // 1. Load project
      const { data: proj, error: projErr } = await supabase
        .from("projects").select("*").eq("id", projectId).single();
      if (projErr) throw projErr;
      setProject(proj);

      // 2. Load all invoices for this project
      const { data: invData } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_name", proj.name)
        .order("invoice_date", { ascending: true });
      const invList = invData || [];
      setInvoices(invList);

      // 3. Load individual payment records for each invoice
      if (invList.length > 0) {
        const invoiceIds = invList.map(i => i.id);
        const { data: payData, error: payErr } = await supabase
          .from("invoice_payments")
          .select("id, invoice_id, payment_date, amount, net_amount, processing_fee, payment_method, notes")
          .in("invoice_id", invoiceIds)
          .order("payment_date", { ascending: true });
        
        if (payErr) {
          console.error("⚠️ invoice_payments query error:", payErr);
        }
        console.log(`💳 invoice_payments records found: ${(payData || []).length}`);
        setPayments(payData || []);
      }

      // 4. Load project deposits
      const { data: depData } = await supabase
        .from("project_deposits")
        .select("*")
        .eq("project_id", projectId)
        .order("deposit_date", { ascending: true });
      setDeposits(depData || []);

    } catch (err) {
      console.error("Error loading statement:", err);
    } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d + "T00:00:00");
    return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const fmtMoney = (n) =>
    "$" + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (loading) return (
    <div style={styles.pg}>
      <p style={{ textAlign: "center", padding: 60, color: "#666" }}>Loading statement...</p>
    </div>
  );
  if (!project) return (
    <div style={styles.pg}>
      <p style={{ textAlign: "center", padding: 60, color: "#ef4444" }}>Project not found</p>
    </div>
  );

  // ── Build transaction rows in chronological order ──────────────────────
  // Each row: { type, date, ref, charge, credit, balance }
  const allRows = [];

  invoices.forEach((inv) => {
    const invoiceAmt = inv.total || inv.subtotal || 0;

    // Invoice row
    allRows.push({
      type: "invoice",
      date: inv.invoice_date,
      ref: `Invoice #${inv.invoice_number}`,
      status: inv.status,
      charge: invoiceAmt,
      credit: 0,
      invoiceId: inv.id,
    });

    // Deposits applied to this invoice
    const invDeposits = deposits.filter(d => d.invoice_id === inv.id);
    invDeposits.forEach(dep => {
      allRows.push({
        type: "deposit",
        date: dep.deposit_date,
        ref: `Deposit — Inv #${inv.invoice_number}${dep.reference_notes ? ` (${dep.reference_notes})` : ""}`,
        charge: 0,
        credit: dep.deposit_amount || 0,
      });
    });

    // Individual payment records for this invoice
    const invPayments = payments.filter(p => p.invoice_id === inv.id);
    if (invPayments.length > 0) {
      invPayments.forEach(pmt => {
        allRows.push({
          type: "payment",
          date: pmt.payment_date,
          ref: `Payment — Inv #${inv.invoice_number}${pmt.payment_method ? ` (${pmt.payment_method})` : ""}${pmt.notes ? ` · ${pmt.notes}` : ""}`,
          charge: 0,
          credit: pmt.amount || 0,
        });
      });
    } else if ((inv.amount_paid || 0) > 0) {
      // Fallback: no records in invoice_payments, use the lump sum from the invoice
      allRows.push({
        type: "payment",
        date: inv.invoice_date,
        ref: `Payment — Inv #${inv.invoice_number}`,
        charge: 0,
        credit: inv.amount_paid,
      });
    }
  });

  // Sort all rows by date, keeping invoice before payment on same date
  const typeOrder = { invoice: 0, deposit: 1, payment: 2 };
  allRows.sort((a, b) => {
    const da = new Date(a.date || "1900-01-01");
    const db = new Date(b.date || "1900-01-01");
    if (da - db !== 0) return da - db;
    return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
  });

  // Add running balance
  let runningBalance = 0;
  const rows = allRows.map(row => {
    runningBalance += row.charge;
    runningBalance -= row.credit;
    return { ...row, balance: runningBalance };
  });

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || i.subtotal || 0), 0);
  const totalDepositsAmt = deposits
    .filter(d => d.status !== "cancelled")
    .reduce((s, d) => s + (d.deposit_amount || 0), 0);
  // Sum payment credits directly from allRows so fallback payments (inv.amount_paid)
  // are included — not just the invoice_payments table records.
  const totalPaymentsAmt = allRows
    .filter(r => r.type === "payment")
    .reduce((s, r) => s + (r.credit || 0), 0);
  const totalBalance = runningBalance; // final running balance

  const statusBadge = (status) => {
    const colors = {
      paid:    { bg: "#dcfce7", text: "#15803d" },
      sent:    { bg: "#dbeafe", text: "#1d4ed8" },
      partial: { bg: "#fef9c3", text: "#a16207" },
      overdue: { bg: "#fee2e2", text: "#b91c1c" },
      draft:   { bg: "#f3f4f6", text: "#6b7280" },
    };
    const c = colors[status] || colors.draft;
    return (
      <span style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 12,
        fontSize: 11, fontWeight: "bold", background: c.bg, color: c.text,
        textTransform: "uppercase", letterSpacing: "0.3px",
      }}>{status}</span>
    );
  };

  return (
    <div style={styles.pg}>
      <style>{`
        @media print {
          /* Hide EVERYTHING on the page */
          body * { visibility: hidden; }
          /* Then show ONLY the statement card and its children */
          .statement-card, .statement-card * { visibility: visible; }
          /* Position the card at the top-left so it fills the page */
          .statement-card {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
          }
          /* Make sure tables don't break awkwardly */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        @media screen { .statement-card { max-width: 900px; } }
      `}</style>

      {/* Buttons */}
      <div className="no-print" style={{ maxWidth: 900, margin: "0 auto 12px", display: "flex", gap: 10, padding: "0 4px", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => navigate(`/project/${projectId}`)} style={styles.btnOutline}>
          ← Back to Project
        </button>
        <button onClick={() => window.print()} style={styles.btnPrint}>
          🖨️ Print / Save as PDF
        </button>
        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", border: "2px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setViewMode("ledger")}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: "600", cursor: "pointer", border: "none",
              background: viewMode === "ledger" ? BLUE : "#fff",
              color: viewMode === "ledger" ? "#fff" : "#374151",
            }}
          >
            📋 Ledger View
          </button>
          <button
            onClick={() => setViewMode("byInvoice")}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: "600", cursor: "pointer", border: "none",
              borderLeft: "2px solid #d1d5db",
              background: viewMode === "byInvoice" ? BLUE : "#fff",
              color: viewMode === "byInvoice" ? "#fff" : "#374151",
            }}
          >
            📄 By Invoice
          </button>
        </div>
      </div>

      <div className="statement-card" style={styles.card}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <img src={logoImage} alt="DML Electrical" style={{ maxWidth: 180, height: "auto" }} />
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 26, fontWeight: "bold", color: BLUE, margin: "0 0 4px" }}>ACCOUNT STATEMENT</h1>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
              Printed: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <div style={{ borderTop: `3px solid ${ACCENT}`, margin: "0 0 18px" }} />

        {/* Project info */}
        <div style={{ display: "flex", gap: 32, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Project</p>
            <p style={{ fontSize: 17, fontWeight: "bold", color: "#111", margin: 0 }}>{project.name}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Customer</p>
            <p style={{ fontSize: 17, fontWeight: "bold", color: "#111", margin: 0 }}>
              {project.contractor || project.customer || "—"}
            </p>
          </div>
          {project.address && (
            <div>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Address</p>
              <p style={{ fontSize: 14, color: "#111", margin: 0 }}>{project.address}</p>
            </div>
          )}
        </div>

        {/* Summary boxes */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Total Invoiced",      value: fmtMoney(totalInvoiced),       color: "#111" },
            { label: "Deposits Applied",    value: fmtMoney(totalDepositsAmt),    color: GREEN  },
            { label: "Payments Received",   value: fmtMoney(totalPaymentsAmt),    color: GREEN  },
            { label: "Balance Owed",        value: fmtMoney(totalBalance),        color: totalBalance > 0.005 ? "#ef4444" : GREEN },
          ].map(box => (
            <div key={box.label} style={{
              flex: 1, minWidth: 130, background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 8, padding: "12px 16px", textAlign: "center",
            }}>
              <p style={{ fontSize: 10, color: "#888", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{box.label}</p>
              <p style={{ fontSize: 19, fontWeight: "bold", color: box.color, margin: 0 }}>{box.value}</p>
            </div>
          ))}
        </div>

        {/* ── LEDGER VIEW ── */}
        {viewMode === "ledger" && (
          rows.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>No invoices found for this project.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={{ background: BLUE }}>
                  <th style={{ ...styles.th, textAlign: "left",  width: 100 }}>Date</th>
                  <th style={{ ...styles.th, textAlign: "left"             }}>Description</th>
                  <th style={{ ...styles.th, textAlign: "right", width: 110 }}>Charges</th>
                  <th style={{ ...styles.th, textAlign: "right", width: 110 }}>Credits</th>
                  <th style={{ ...styles.th, textAlign: "right", width: 120 }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{
                    backgroundColor:
                      row.type === "invoice" ? "#fff" :
                      row.type === "deposit" ? "#f0fdf4" : "#f0f9ff",
                    borderBottom: "1px solid #e5e7eb",
                  }}>
                    <td style={{ ...styles.td, color: "#555", whiteSpace: "nowrap" }}>
                      {fmtDate(row.date)}
                    </td>
                    <td style={{ ...styles.td }}>
                      <span style={{
                        fontWeight: row.type === "invoice" ? "600" : "normal",
                        color:
                          row.type === "invoice" ? "#111" :
                          row.type === "deposit"  ? "#166534" : "#1d4ed8",
                      }}>
                        {row.type === "deposit" ? "💰 " : row.type === "payment" ? "✅ " : "📄 "}
                        {row.ref}
                      </span>
                      {row.status && <span style={{ marginLeft: 8 }}>{statusBadge(row.status)}</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "600", color: "#111" }}>
                      {row.charge > 0 ? fmtMoney(row.charge) : "—"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "600", color: GREEN }}>
                      {row.credit > 0 ? fmtMoney(row.credit) : "—"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold",
                      color: row.balance > 0.005 ? "#ef4444" : GREEN }}>
                      {fmtMoney(row.balance)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: "#f3f4f6", borderTop: "3px solid #e5e7eb" }}>
                  <td colSpan={2} style={{ ...styles.td, fontWeight: "bold", fontSize: 15, color: "#111" }}>TOTALS</td>
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 15, color: "#111" }}>
                    {fmtMoney(totalInvoiced)}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 15, color: GREEN }}>
                    {fmtMoney(totalDepositsAmt + totalPaymentsAmt)}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 18,
                    color: totalBalance > 0.005 ? "#ef4444" : GREEN }}>
                    {fmtMoney(totalBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          )
        )}

        {/* ── BY INVOICE VIEW ── */}
        {viewMode === "byInvoice" && (
          invoices.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>No invoices found for this project.</p>
          ) : (
            <div>
              {invoices.map((inv) => {
                const invoiceAmt = inv.total || inv.subtotal || 0;
                const invDeposits = deposits.filter(d => d.invoice_id === inv.id);
                const invPayments = payments.filter(p => p.invoice_id === inv.id);
                const totalDepositAmt = invDeposits.reduce((s, d) => s + (d.deposit_amount || 0), 0);
                const totalPayAmt = invPayments.length > 0
                  ? invPayments.reduce((s, p) => s + (p.amount || 0), 0)
                  : (inv.amount_paid || 0);
                const balance = inv.balance_due ?? (invoiceAmt - totalDepositAmt - totalPayAmt);

                // Use fallback row if no invoice_payments records
                const payRows = invPayments.length > 0
                  ? invPayments.map(pmt => ({
                      date: pmt.payment_date,
                      label: `Payment${pmt.payment_method ? ` (${pmt.payment_method})` : ""}${pmt.notes ? ` · ${pmt.notes}` : ""}`,
                      amount: pmt.amount || 0,
                      type: "payment",
                    }))
                  : (inv.amount_paid > 0 ? [{
                      date: inv.invoice_date,
                      label: "Payment",
                      amount: inv.amount_paid,
                      type: "payment",
                    }] : []);

                const depRows = invDeposits.map(dep => ({
                  date: dep.deposit_date,
                  label: `Deposit${dep.reference_notes ? ` (${dep.reference_notes})` : ""}`,
                  amount: dep.deposit_amount || 0,
                  type: "deposit",
                }));

                const creditRows = [...depRows, ...payRows].sort(
                  (a, b) => new Date(a.date || "1900-01-01") - new Date(b.date || "1900-01-01")
                );

                return (
                  <div key={inv.id} style={{ marginBottom: 20, border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    {/* Invoice header bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: BLUE }}>
                      <span style={{ fontWeight: "bold", fontSize: 16, color: "#fff" }}>
                        📄 Invoice #{inv.invoice_number}
                      </span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                          {fmtDate(inv.invoice_date)}
                          {inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ""}
                        </span>
                        {statusBadge(inv.status)}
                      </div>
                    </div>

                    {/* Invoice amount row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 13, color: "#555", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.4px" }}>Invoice Total</span>
                      <span style={{ fontSize: 16, fontWeight: "bold", color: "#111" }}>{fmtMoney(invoiceAmt)}</span>
                    </div>

                    {/* Credit rows (deposits + payments) */}
                    {creditRows.length > 0 ? (
                      creditRows.map((cr, ci) => (
                        <div key={ci} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "9px 18px 9px 32px",
                          background: cr.type === "deposit" ? "#f0fdf4" : "#f0f9ff",
                          borderBottom: "1px solid #e5e7eb",
                        }}>
                          <span style={{ fontSize: 13, color: cr.type === "deposit" ? "#166534" : "#1d4ed8" }}>
                            {cr.type === "deposit" ? "💰" : "✅"} {fmtDate(cr.date)} — {cr.label}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: "600", color: GREEN }}>
                            −{fmtMoney(cr.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "9px 18px 9px 32px", background: "#fffbeb", borderBottom: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: 13, color: "#92400e" }}>⏳ No payments recorded yet</span>
                      </div>
                    )}

                    {/* Balance due footer */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 18px",
                      background: balance > 0.005 ? "#fef2f2" : "#f0fdf4",
                      borderTop: "2px solid " + (balance > 0.005 ? "#fecaca" : "#bbf7d0"),
                    }}>
                      <span style={{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.4px", color: balance > 0.005 ? "#b91c1c" : "#15803d" }}>
                        Balance Due
                      </span>
                      <span style={{ fontSize: 18, fontWeight: "bold", color: balance > 0.005 ? "#ef4444" : GREEN }}>
                        {fmtMoney(balance)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Grand totals row for By Invoice view */}
              <div style={{ marginTop: 8, border: "2px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontWeight: "bold", fontSize: 15, color: "#111" }}>TOTALS</span>
                  <span style={{ fontSize: 15, fontWeight: "bold", color: "#111" }}>{fmtMoney(totalInvoiced)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px 10px 32px", background: "#f0f9ff", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 13, color: "#1d4ed8" }}>✅ Total Payments Received</span>
                  <span style={{ fontSize: 14, fontWeight: "600", color: GREEN }}>−{fmtMoney(totalPaymentsAmt)}</span>
                </div>
                {totalDepositsAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px 10px 32px", background: "#f0fdf4", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 13, color: "#166534" }}>💰 Total Deposits Applied</span>
                    <span style={{ fontSize: 14, fontWeight: "600", color: GREEN }}>−{fmtMoney(totalDepositsAmt)}</span>
                  </div>
                )}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 18px",
                  background: totalBalance > 0.005 ? "#fef2f2" : "#f0fdf4",
                }}>
                  <span style={{ fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: totalBalance > 0.005 ? "#b91c1c" : "#15803d" }}>
                    Total Balance Owed
                  </span>
                  <span style={{ fontSize: 20, fontWeight: "bold", color: totalBalance > 0.005 ? "#ef4444" : GREEN }}>
                    {fmtMoney(totalBalance)}
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Footer */}
        <div style={{ borderTop: `3px solid ${ACCENT}`, marginTop: 32, paddingTop: 14, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#888", margin: "2px 0" }}>
            DML Electrical Service, LLC · (337) 288-0395 · info@dmlelectrical.com · Lic# 63147
          </p>
          <p style={{ fontSize: 12, color: "#aaa", margin: "2px 0" }}>P.O. Box 363, Jennings, LA 70546</p>
        </div>

      </div>
    </div>
  );
}

const styles = {
  pg: {
    minHeight: "100vh", background: "#f3f4f6", padding: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    margin: "0 auto", background: "#fff", borderRadius: 10,
    padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  },
  btnOutline: {
    padding: "9px 18px", background: "transparent", border: "2px solid #d1d5db",
    color: "#374151", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "600",
  },
  btnPrint: {
    padding: "9px 22px", background: BLUE, color: "#fff", border: "none",
    borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "bold",
    boxShadow: "0 2px 6px rgba(11,62,168,0.3)",
  },
  table: {
    width: "100%", borderCollapse: "collapse",
    border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden",
  },
  th: {
    padding: "10px 14px", fontSize: 12, fontWeight: "bold", color: "#fff",
    textTransform: "uppercase", letterSpacing: "0.4px",
  },
  td: {
    padding: "10px 14px", fontSize: 14, color: "#374141", verticalAlign: "middle",
  },
  dc: { display: "flex", flexDirection: "column", gap: 2, minWidth: 110 },
  dlabel: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" },
  dval:   { fontSize: 15, fontWeight: "600", color: "#111" },
};

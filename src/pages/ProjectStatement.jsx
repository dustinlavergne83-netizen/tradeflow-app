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
  const [changeOrders, setChangeOrders] = useState([]); // change_orders records (for titles)
  const [proposals, setProposals] = useState([]);
  const [baseContractAmount, setBaseContractAmount] = useState(0);
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

      // 5. Load ALL change orders for this project (by project_name + invoice-linked)
      const { data: coByName } = await supabase
        .from("change_orders")
        .select("id, change_order_number, title, description, total")
        .eq("project_name", proj.name);
      let coData = coByName || [];
      // Also grab any COs linked via invoice change_order_id that might not match project_name
      const coIds = [...new Set((invData || []).map(i => i.change_order_id).filter(Boolean))];
      if (coIds.length > 0) {
        const existingCoIds = new Set(coData.map(c => c.id));
        const missingCoIds = coIds.filter(id => !existingCoIds.has(id));
        if (missingCoIds.length > 0) {
          const { data: extraCOs } = await supabase
            .from("change_orders")
            .select("id, change_order_number, title, description, total")
            .in("id", missingCoIds);
          coData = [...coData, ...(extraCOs || [])];
        }
      }

      // For COs that have no title AND no description, use the first estimate_item description
      // QuickEstimate COs: items stored with change_order_id = co.id
      // Full Proposal COs: items stored with estimate_id = co.id (CO id used as estimate_id)
      const cosNeedingFallback = coData.filter(co => !co.title && !co.description);
      if (cosNeedingFallback.length > 0) {
        const coIdList = cosNeedingFallback.map(co => co.id);
        // Try change_order_id column (QuickEstimate flow)
        const { data: itemsByCoId } = await supabase
          .from("estimate_items")
          .select("change_order_id, estimate_id, description, sequence")
          .in("change_order_id", coIdList)
          .order("sequence", { ascending: true });
        // Also try estimate_id column (full proposal flow stores CO id as estimate_id)
        const { data: itemsByEstId } = await supabase
          .from("estimate_items")
          .select("change_order_id, estimate_id, description, sequence")
          .in("estimate_id", coIdList)
          .order("sequence", { ascending: true });
        const allItems = [...(itemsByCoId || []), ...(itemsByEstId || [])];
        if (allItems.length > 0) {
          const firstItem = {};
          allItems.forEach(item => {
            const coId = item.change_order_id || item.estimate_id;
            if (coId && !firstItem[coId]) firstItem[coId] = item.description;
          });
          coData = coData.map(co => firstItem[co.id] ? { ...co, description: firstItem[co.id] } : co);
        }
      }
      setChangeOrders(coData);

      // 6. Load ALL proposals for this project by project_id (base + change orders)
      const { data: allProposals } = await supabase
        .from("proposals")
        .select("id, total_amount, base_estimate_id, change_order_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      setProposals(allProposals || []);
      // Find the base proposal that the progress invoices are actually tied to
      // Invoices store a [PROPOSAL:proposalId] tag in their notes field
      const baseProps = (allProposals || []).filter(p => !p.change_order_id);
      let linkedBaseProp = null;
      // Check base invoices (non-CO) for a [PROPOSAL:xxx] tag
      const baseInvoices = (invList || []).filter(inv => !String(inv.invoice_number || "").match(/CO\d+/i));
      for (const inv of baseInvoices) {
        const tagMatch = String(inv.notes || "").match(/\[PROPOSAL:([^\]]+)\]/);
        if (tagMatch) {
          linkedBaseProp = (allProposals || []).find(p => p.id === tagMatch[1]);
          if (linkedBaseProp) break;
        }
      }
      // Fallback: use the latest base proposal if no tag found
      if (!linkedBaseProp) {
        linkedBaseProp = baseProps.length > 0 ? baseProps[baseProps.length - 1] : null;
      }
      setBaseContractAmount(linkedBaseProp?.total_amount || 0);

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
          /* Keep invoice cards and group sections together */
          .invoice-card { page-break-inside: avoid; break-inside: avoid; }
          .group-section { page-break-inside: avoid; break-inside: avoid; }
          .group-subtotal { page-break-inside: avoid; break-inside: avoid; }
          .contract-breakdown { page-break-inside: avoid; break-inside: avoid; }
          .summary-boxes { page-break-inside: avoid; break-inside: avoid; }
          .grand-totals { page-break-inside: avoid; break-inside: avoid; }
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
            <h1 style={{ fontSize: 26, fontWeight: "bold", color: BLUE, margin: "0 0 4px" }}>PROJECT STATEMENT</h1>
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
        <div className="summary-boxes" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Contract Total",      value: fmtMoney((() => {
              // Quick inline compute for contract total
              const getGK2 = (num) => { const m = String(num || "").match(/CO(\d+)/i); return m ? `CO${m[1]}` : "base"; };
              const gO = []; const gM = {};
              invoices.forEach(inv => { const k = getGK2(inv.invoice_number); if (!gM[k]) { gM[k] = []; gO.push(k); } gM[k].push(inv); });
              const usd = new Set();
              let ct = baseContractAmount;
              gO.filter(k => k !== "base").forEach(key => {
                let cp = null;
                for (const inv of gM[key]) { const tm = String(inv.notes || "").match(/\[PROPOSAL:([^\]]+)\]/); if (tm) { cp = proposals.find(p => p.id === tm[1]); if (cp) break; } }
                if (!cp) { const ids = [...new Set(gM[key].map(i => i.change_order_id).filter(Boolean))]; if (ids.length > 0) cp = proposals.find(p => ids.includes(p.change_order_id)); }
                if (cp) { usd.add(cp.id); ct += cp.total_amount || 0; }
                else { ct += gM[key].reduce((s, i) => s + (i.total || i.subtotal || 0), 0); }
              });
              const um = proposals.filter(p => p.change_order_id && !usd.has(p.id));
              gO.filter(k => k !== "base").forEach(key => { if (um.length > 0 && !usd.has(key)) { const a = um.shift(); if (a) { ct = ct - gM[key].reduce((s, i) => s + (i.total || i.subtotal || 0), 0) + (a.total_amount || 0); } } });
              return ct;
            })()),       color: BLUE },
            { label: "Total Invoiced",      value: fmtMoney(totalInvoiced),       color: "#111" },
            { label: "Payments Received",   value: fmtMoney(totalPaymentsAmt + totalDepositsAmt),    color: GREEN  },
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

        {/* ── Contract Value Breakdown ── */}
        {invoices.length > 0 && (() => {
          // Group invoices by base / CO pattern from invoice numbers (reliable extraction)
          const getGK = (num) => { const m = String(num || "").match(/CO(\d+)/i); return m ? `CO${m[1]}` : "base"; };
          const grpOrder = []; const grpMap = {};
          invoices.forEach(inv => {
            const k = getGK(inv.invoice_number);
            if (!grpMap[k]) { grpMap[k] = []; grpOrder.push(k); }
            grpMap[k].push(inv);
          });

          // CO proposals (proposals with change_order_id set)
          const coProposals = proposals.filter(p => p.change_order_id);
          const usedProposalIds = new Set();

          const contractRows = grpOrder.map(key => {
            const isBase = key === "base";
            const coNum = key.replace(/^CO/i, "");
            const coRecord = !isBase ? changeOrders.find(co => { const m = String(co.change_order_number || "").match(/CO(\d+)$/i); return m && m[1] === coNum; }) : null;
            const coDisplayTitle = coRecord
              ? ((coRecord.title && !/^Quick Change Order/i.test(coRecord.title)) ? coRecord.title : (coRecord.description || null))
              : null;
            const label = isBase ? "📋 Base Contract" : `🔧 Change Order #${coNum}${coDisplayTitle ? " — " + coDisplayTitle : ""}`;

            let contractAmt;
            if (isBase) {
              contractAmt = baseContractAmount > 0 ? baseContractAmount : grpMap[key].reduce((s, i) => s + (i.total || i.subtotal || 0), 0);
            } else {
              // Try to find matching proposal for this CO group:
              // 1. Via [PROPOSAL:xxx] tag in invoice notes
              // 2. Via coRecord (change_orders table match)
              // 3. Via invoice change_order_id (direct link from invoice)
              let coProposal = null;
              // Check invoice notes for [PROPOSAL:xxx] tag first
              for (const inv of grpMap[key]) {
                const tagMatch = String(inv.notes || "").match(/\[PROPOSAL:([^\]]+)\]/);
                if (tagMatch) {
                  coProposal = proposals.find(p => p.id === tagMatch[1]);
                  if (coProposal) break;
                }
              }
              if (!coProposal && coRecord) {
                coProposal = proposals.find(p => p.change_order_id === coRecord.id);
              }
              if (!coProposal) {
                const grpCoIds = [...new Set(grpMap[key].map(i => i.change_order_id).filter(Boolean))];
                if (grpCoIds.length > 0) {
                  coProposal = proposals.find(p => grpCoIds.includes(p.change_order_id));
                }
              }
              if (coProposal) usedProposalIds.add(coProposal.id);
              contractAmt = coProposal?.total_amount > 0
                ? coProposal.total_amount
                : (coRecord?.total > 0 ? coRecord.total : grpMap[key].reduce((s, i) => s + (i.total || i.subtotal || 0), 0));
            }
            return { key, label, contractAmt, isBase, _proposalMatched: !isBase && usedProposalIds.size > 0 && !!proposals.find(p => usedProposalIds.has(p.id) && p.change_order_id) };
          });

          // Second pass: match remaining unmatched CO proposals to CO groups that had no proposal match
          const unmatchedCoProposals = coProposals.filter(p => !usedProposalIds.has(p.id));
          const coGroupKeys = grpOrder.filter(k => k !== "base");
          coGroupKeys.forEach(key => {
            const row = contractRows.find(r => r.key === key);
            // If this row wasn't matched to a proposal in the first pass
            if (row && !row._proposalMatched && unmatchedCoProposals.length > 0) {
              const availableProposal = unmatchedCoProposals.shift();
              if (availableProposal && availableProposal.total_amount > 0) {
                row.contractAmt = availableProposal.total_amount;
                usedProposalIds.add(availableProposal.id);
              }
            }
          });

          const totalContractValue = contractRows.reduce((s, r) => s + r.contractAmt, 0);
          return (
            <div style={{ marginBottom: 24, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 16px", background: BLUE }}>
                <span style={{ fontSize: 12, fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contract Value Breakdown</span>
              </div>
              {contractRows.map((r, i) => (
                <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: i % 2 === 0 ? "#f9fafb" : "#fff", borderBottom: i < contractRows.length - 1 ? "1px solid #e5e7eb" : "2px solid #d1d5db" }}>
                  <span style={{ fontSize: 13, fontWeight: r.isBase ? "600" : "500", color: r.isBase ? "#111" : "#374151" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: "700", color: "#111" }}>{fmtMoney(r.contractAmt)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#f3f4f6" }}>
                <span style={{ fontSize: 13, fontWeight: "700", color: "#111", textTransform: "uppercase", letterSpacing: "0.3px" }}>Total Contract Value</span>
                <span style={{ fontSize: 16, fontWeight: "800", color: BLUE }}>{fmtMoney(totalContractValue)}</span>
              </div>
            </div>
          );
        })()}

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
          ) : (() => {
            // ── Group invoices by contract section ──
            // Invoice numbers like 1007-1, 1007-2 → "base"
            // Invoice numbers like 1007-CO1-1, 1007-CO1-2 → "CO1"
            // Invoice numbers like 1007-CO2 → "CO2"
            const getGroupKey = (num) => {
              const m = String(num || "").match(/CO(\d+)/i);
              return m ? `CO${m[1]}` : "base";
            };

            const groupOrder = [];
            const groupMap = {};
            invoices.forEach(inv => {
              const key = getGroupKey(inv.invoice_number);
              if (!groupMap[key]) {
                groupMap[key] = [];
                groupOrder.push(key);
              }
              groupMap[key].push(inv);
            });

            // Helper: build credit rows for a single invoice
            const buildCreditRows = (inv) => {
              const invDeposits = deposits.filter(d => d.invoice_id === inv.id);
              const invPayments = payments.filter(p => p.invoice_id === inv.id);
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
              return [...depRows, ...payRows].sort(
                (a, b) => new Date(a.date || "1900-01-01") - new Date(b.date || "1900-01-01")
              );
            };

            // Single invoice card (reused inside each group)
            const InvoiceCard = ({ inv, isLast }) => {
              const invoiceAmt = inv.total || inv.subtotal || 0;
              const invDeposits = deposits.filter(d => d.invoice_id === inv.id);
              const invPayments = payments.filter(p => p.invoice_id === inv.id);
              const totalDepositAmt = invDeposits.reduce((s, d) => s + (d.deposit_amount || 0), 0);
              const totalPayAmt = invPayments.length > 0
                ? invPayments.reduce((s, p) => s + (p.amount || 0), 0)
                : (inv.amount_paid || 0);
              const balance = inv.balance_due ?? (invoiceAmt - totalDepositAmt - totalPayAmt);
              const creditRows = buildCreditRows(inv);

              return (
                <div className="invoice-card" style={{ borderBottom: isLast ? "none" : "2px dashed #d1d5db" }}>
                  {/* Invoice header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", background: "#eef2ff", borderBottom: "1px solid #c7d2fe" }}>
                    <span style={{ fontWeight: "700", fontSize: 14, color: BLUE }}>
                      📄 Invoice #{inv.invoice_number}
                    </span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#555" }}>
                        {fmtDate(inv.invoice_date)}
                        {inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ""}
                      </span>
                      {statusBadge(inv.status)}
                    </div>
                  </div>

                  {/* Invoice total */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 18px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", fontWeight: "600" }}>Invoice Total</span>
                    <span style={{ fontSize: 15, fontWeight: "bold", color: "#111" }}>{fmtMoney(invoiceAmt)}</span>
                  </div>

                  {/* Credit rows */}
                  {creditRows.length > 0 ? (
                    creditRows.map((cr, ci) => (
                      <div key={ci} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 18px 7px 36px",
                        background: cr.type === "deposit" ? "#f0fdf4" : "#f0f9ff",
                        borderBottom: "1px solid #e5e7eb",
                      }}>
                        <span style={{ fontSize: 13, color: cr.type === "deposit" ? "#166534" : "#1d4ed8" }}>
                          {cr.type === "deposit" ? "💰" : "✅"} {fmtDate(cr.date)} — {cr.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: "600", color: GREEN }}>
                          −{fmtMoney(cr.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "7px 18px 7px 36px", background: "#fffbeb", borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 13, color: "#92400e" }}>⏳ No payments recorded yet</span>
                    </div>
                  )}

                  {/* Balance due */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 18px",
                    background: balance > 0.005 ? "#fef2f2" : "#f0fdf4",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.4px", color: balance > 0.005 ? "#b91c1c" : "#15803d" }}>
                      Balance Due
                    </span>
                    <span style={{ fontSize: 16, fontWeight: "bold", color: balance > 0.005 ? "#ef4444" : GREEN }}>
                      {fmtMoney(balance)}
                    </span>
                  </div>
                </div>
              );
            };

            return (
              <div>
                {groupOrder.map((key) => {
                  const grpInvoices = groupMap[key];
                  const grpTotal = grpInvoices.reduce((s, i) => s + (i.total || i.subtotal || 0), 0);
                  const grpPaid = grpInvoices.reduce((s, i) => {
                    const ip = payments.filter(p => p.invoice_id === i.id);
                    return s + (ip.length > 0 ? ip.reduce((a, p) => a + (p.amount || 0), 0) : (i.amount_paid || 0));
                  }, 0);
                  const grpDep = grpInvoices.reduce((s, i) => {
                    return s + deposits.filter(d => d.invoice_id === i.id).reduce((a, d) => a + (d.deposit_amount || 0), 0);
                  }, 0);
                  const grpBalance = grpTotal - grpPaid - grpDep;
                  const isBase = key === "base";
                  const coNum = key.replace(/^CO/i, "");
                  // Look up the change order title from the loaded changeOrders array
                  const coRecord = !isBase
                    ? changeOrders.find(co => {
                        const m = String(co.change_order_number || "").match(/CO(\d+)$/i);
                        return m && m[1] === coNum;
                      })
                    : null;
                  // Use title if set and not a generic placeholder; otherwise fall back to description
                  const coTitle = coRecord
                    ? ((coRecord.title && !/^Quick Change Order/i.test(coRecord.title)) ? coRecord.title : (coRecord.description || null))
                    : null;
                  const groupLabel = isBase
                    ? "📋 Base Contract"
                    : `🔧 Change Order #${coNum}`;

                  return (
                    <div key={key} className="group-section" style={{ marginBottom: 24, border: "2px solid " + (isBase ? BLUE : "#7c3aed"), borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.07)" }}>
                      {/* Group header */}
                      <div style={{ padding: "12px 18px", background: isBase ? BLUE : "#7c3aed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: "bold", fontSize: 16, color: "#fff" }}>{groupLabel}</span>
                          {coTitle && (
                            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>
                              {coTitle}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600" }}>
                          {grpInvoices.length} invoice{grpInvoices.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Invoice cards within group */}
                      {grpInvoices.map((inv, idx) => (
                        <InvoiceCard key={inv.id} inv={inv} isLast={idx === grpInvoices.length - 1} />
                      ))}

                      {/* Group subtotal */}
                      <div style={{ display: "flex", gap: 0, borderTop: "2px solid " + (isBase ? "#bfdbfe" : "#ddd6fe"), background: isBase ? "#eff6ff" : "#f5f3ff" }}>
                        <div style={{ flex: 1, padding: "10px 18px", borderRight: "1px solid #e5e7eb" }}>
                          <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Subtotal</div>
                          <div style={{ fontSize: 15, fontWeight: "bold", color: "#111" }}>{fmtMoney(grpTotal)}</div>
                        </div>
                        <div style={{ flex: 1, padding: "10px 18px", borderRight: "1px solid #e5e7eb" }}>
                          <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Paid</div>
                          <div style={{ fontSize: 15, fontWeight: "bold", color: GREEN }}>{fmtMoney(grpPaid + grpDep)}</div>
                        </div>
                        <div style={{ flex: 1, padding: "10px 18px" }}>
                          <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Balance</div>
                          <div style={{ fontSize: 15, fontWeight: "bold", color: grpBalance > 0.005 ? "#ef4444" : GREEN }}>{fmtMoney(grpBalance)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Grand totals */}
                <div className="grand-totals" style={{ border: "2px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontWeight: "bold", fontSize: 15, color: "#111" }}>PROJECT TOTALS</span>
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
            );
          })()
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

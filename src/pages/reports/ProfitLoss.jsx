import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { notify } from '../../lib/notify';
import { useBrand } from "../../lib/useBrand";
import defaultLogoUrl from "../../assets/LOGOD.jpg";

import AccountDrillDown from "../../Components/AccountDrillDown";

export default function ProfitLoss() {
  const navigate = useNavigate();
  const BRAND = useBrand();

  const { user, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState({
    income: [],
    expenses: [],
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0
  });
  // Letterhead details for the printed/PDF report. AuthContext only loads a
  // small subset of `companies` columns (name/colors/logo), so we fetch the
  // address/phone/email fields locally here rather than widen the shared
  // AuthContext query (that query runs on every page and a past change to it
  // caused a production outage — not worth the risk for a report letterhead).
  const [companyInfo, setCompanyInfo] = useState(null);
  // Drill-down modal state: which account(s)/type/title to show transactions for.
  // null = closed.
  const [drillDown, setDrillDown] = useState(null);

  function openDrillDown(accountIds, accountType, title) {
    setDrillDown({ accountIds, accountType, title });
  }

  useEffect(() => {
    loadProfitLoss();
  }, [user, startDate, endDate]);

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("companies")
      .select("name, address, city, state, zip, contact_phone, contact_email")
      .eq("id", company.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setCompanyInfo(data); });
  }, [company?.id]);

  async function loadProfitLoss() {
    try {
      setLoading(true);

      // Load all accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .in("account_type", ["Income", "Expense"])
        .order("account_number");

      if (accountsError) throw accountsError;

      // Load all posted journal entry lines within date range
      const { data: linesData, error: linesError } = await supabase
        .from("journal_entry_lines")
        .select(`
          *,
          journal_entries!inner(
            entry_date,
            is_posted
          )
        `)
        .eq("journal_entries.is_posted", true)
        .gte("journal_entries.entry_date", startDate)
        .lte("journal_entries.entry_date", endDate);

      if (linesError) throw linesError;

      // Calculate balances for each account
      const accountBalances = {};
      
      linesData.forEach(line => {
        const accountId = line.account_id;
        if (!accountBalances[accountId]) {
          accountBalances[accountId] = { debit: 0, credit: 0 };
        }
        accountBalances[accountId].debit += line.debit || 0;
        accountBalances[accountId].credit += line.credit || 0;
      });

      // Process Income accounts (credit balance is positive)
      const incomeAccounts = accountsData
        .filter(acc => acc.account_type === 'Income')
        .map(account => {
          const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
          const amount = balance.credit - balance.debit; // Credit increases income
          return {
            ...account,
            amount: amount
          };
        })
        .filter(acc => acc.amount !== 0)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      // Process Expense accounts (debit balance is positive)
      const expenseAccounts = accountsData
        .filter(acc => acc.account_type === 'Expense')
        .map(account => {
          const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
          const amount = balance.debit - balance.credit; // Debit increases expenses
          return {
            ...account,
            amount: amount
          };
        })
        .filter(acc => acc.amount !== 0)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      const totalIncome = incomeAccounts.reduce((sum, acc) => sum + acc.amount, 0);
      const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.amount, 0);
      const netIncome = totalIncome - totalExpenses;

      setReportData({
        income: incomeAccounts,
        expenses: expenseAccounts,
        totalIncome,
        totalExpenses,
        netIncome
      });
    } catch (err) {
      console.error("Error loading profit & loss:", err);
      notify("Failed to load profit & loss: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateRange = () => {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  };

  // ── Letterhead helpers ──────────────────────────────────────────────────
  function companyAddressLine() {
    if (!companyInfo) return null;
    const cityStateZip = [companyInfo.city, companyInfo.state].filter(Boolean).join(", ") +
      (companyInfo.zip ? ` ${companyInfo.zip}` : "");
    const parts = [companyInfo.address, cityStateZip.trim()].filter(Boolean);
    return parts.length ? parts.join(" • ") : null;
  }

  function companyContactLine() {
    if (!companyInfo) return null;
    const parts = [companyInfo.contact_phone, companyInfo.contact_email].filter(Boolean);
    return parts.length ? parts.join(" • ") : null;
  }

  // ── Logo loaded + downscaled to a small base64 JPEG for the PDF export
  //    (same technique as EmployeeTimesheets.jsx — keeps the file small) ──
  async function getLogoBase64() {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 320;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } catch {
          resolve(null); // tainted canvas (cross-origin logo) — fall back to no logo
        }
      };
      img.onerror = () => resolve(null);
      img.src = BRAND.logo_url || defaultLogoUrl;
    });
  }

  // ── Build & download a real Profit & Loss PDF (separate from Print) ────
  async function exportToPDF() {
    try {
      const logoBase64 = await getLogoBase64();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.width;
      let y = 40;

      if (logoBase64) {
        const logoW = 140;
        const logoH = 46;
        doc.addImage(logoBase64, "JPEG", (pageW - logoW) / 2, y, logoW, logoH);
        y += logoH + 14;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text((companyInfo?.name || BRAND.name || "").toUpperCase(), pageW / 2, y, { align: "center" });
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const addrLine = companyAddressLine();
      const contactLine = companyContactLine();
      if (addrLine) { doc.text(addrLine, pageW / 2, y, { align: "center" }); y += 12; }
      if (contactLine) { doc.text(contactLine, pageW / 2, y, { align: "center" }); y += 12; }

      y += 10;
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.75);
      doc.line(40, y, pageW - 40, y);
      y += 24;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(17, 24, 39);
      doc.text("PROFIT & LOSS STATEMENT", pageW / 2, y, { align: "center" });
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(75, 85, 99);
      doc.text(`For the Period ${formatDateRange()}`, pageW / 2, y, { align: "center" });
      y += 24;

      // INCOME table
      doc.autoTable({
        startY: y,
        head: [["Acct #", "Account", "Amount"]],
        body: reportData.income.length
          ? reportData.income.map(a => [a.account_number, a.account_name, formatCurrency(a.amount)])
          : [["—", "No income recorded for this period", ""]],
        foot: [["", "Total Income", formatCurrency(reportData.totalIncome)]],
        styles: { fontSize: 10, cellPadding: 6, textColor: [17, 24, 39], lineColor: [229, 231, 235], lineWidth: 0.4 },
        headStyles: { fillColor: [11, 62, 168], textColor: [255, 255, 255], fontStyle: "bold" },
        footStyles: { fillColor: [209, 250, 229], textColor: [6, 95, 70], fontStyle: "bold", fontSize: 11 },
        columnStyles: { 0: { cellWidth: 60 }, 2: { halign: "right", cellWidth: 100 } },
        margin: { left: 40, right: 40 },
      });

      // EXPENSES table
      const afterIncomeY = doc.lastAutoTable.finalY + 24;
      doc.autoTable({
        startY: afterIncomeY,
        head: [["Acct #", "Account", "Amount"]],
        body: reportData.expenses.length
          ? reportData.expenses.map(a => [a.account_number, a.account_name, formatCurrency(a.amount)])
          : [["—", "No expenses recorded for this period", ""]],
        foot: [["", "Total Expenses", formatCurrency(reportData.totalExpenses)]],
        styles: { fontSize: 10, cellPadding: 6, textColor: [17, 24, 39], lineColor: [229, 231, 235], lineWidth: 0.4 },
        headStyles: { fillColor: [11, 62, 168], textColor: [255, 255, 255], fontStyle: "bold" },
        footStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: "bold", fontSize: 11 },
        columnStyles: { 0: { cellWidth: 60 }, 2: { halign: "right", cellWidth: 100 } },
        margin: { left: 40, right: 40 },
      });

      // NET INCOME / NET LOSS summary
      let sumY = doc.lastAutoTable.finalY + 28;
      const pageH = doc.internal.pageSize.height;
      if (sumY > pageH - 80) { doc.addPage(); sumY = 50; }

      doc.setDrawColor(17, 24, 39);
      doc.setLineWidth(1);
      doc.line(40, sumY, pageW - 40, sumY);
      sumY += 20;

      const isProfit = reportData.netIncome >= 0;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(isProfit ? 6 : 153, isProfit ? 95 : 27, isProfit ? 70 : 27);
      doc.text(isProfit ? "NET INCOME" : "NET LOSS", 40, sumY);
      doc.text(formatCurrency(Math.abs(reportData.netIncome)), pageW - 40, sumY, { align: "right" });
      sumY += 16;

      const marginPct = reportData.totalIncome > 0 ? (reportData.netIncome / reportData.totalIncome) * 100 : 0;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Margin: ${marginPct.toFixed(1)}%`, 40, sumY);

      // Footer — generated-on stamp, every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
          `Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
          pageW / 2, pageH - 24, { align: "center" }
        );
        doc.text(`Page ${i} of ${pageCount}`, pageW - 40, pageH - 24, { align: "right" });
      }

      doc.save(`Profit-Loss-${startDate}-to-${endDate}.pdf`);
    } catch (err) {
      console.error("Error exporting P&L PDF:", err);
      notify("Failed to export PDF: " + err.message);
    }
  }

  const profitMargin = reportData.totalIncome > 0 
    ? (reportData.netIncome / reportData.totalIncome) * 100 
    : 0;

  if (loading) {
    return (
      <div style={{ ...styles.container, backgroundColor: BRAND.bg }}>
        <div style={styles.loading}>Loading profit & loss statement...</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, backgroundColor: BRAND.bg }} className="pl-screen">
      <div style={styles.header} className="no-print">
        <div>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Back to Accounting
          </button>
          <h1 style={styles.title}>Profit & Loss Statement</h1>
          <p style={styles.subtitle}>Income Statement</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.dateControl}>
            <label style={styles.dateLabel}>From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.dateControl}>
            <label style={styles.dateLabel}>To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid} className="no-print">
        <div
          style={{...styles.summaryCard, cursor: reportData.income.length ? 'pointer' : 'default'}}
          onClick={() => reportData.income.length && openDrillDown(reportData.income.map(a => a.id), 'Income', 'Total Income')}
          title={reportData.income.length ? 'Click to see all income transactions' : undefined}
        >
          <div style={styles.summaryLabel}>Total Income</div>
          <div style={{...styles.summaryValue, color: '#10b981', textDecoration: reportData.income.length ? 'underline' : 'none'}}>
            {formatCurrency(reportData.totalIncome)}
          </div>
        </div>
        <div
          style={{...styles.summaryCard, cursor: reportData.expenses.length ? 'pointer' : 'default'}}
          onClick={() => reportData.expenses.length && openDrillDown(reportData.expenses.map(a => a.id), 'Expense', 'Total Expenses')}
          title={reportData.expenses.length ? 'Click to see all expense transactions' : undefined}
        >
          <div style={styles.summaryLabel}>Total Expenses</div>
          <div style={{...styles.summaryValue, color: '#ef4444', textDecoration: reportData.expenses.length ? 'underline' : 'none'}}>
            {formatCurrency(reportData.totalExpenses)}
          </div>
        </div>
        <div style={{
          ...styles.summaryCard,
          backgroundColor: reportData.netIncome >= 0 ? '#d1fae5' : '#fee2e2',
          borderLeft: reportData.netIncome >= 0 ? '4px solid #10b981' : '4px solid #ef4444'
        }}>
          <div style={styles.summaryLabel}>Net Income</div>
          <div style={{
            ...styles.summaryValue, 
            color: reportData.netIncome >= 0 ? '#065f46' : '#991b1b'
          }}>
            {formatCurrency(reportData.netIncome)}
          </div>
          <div style={{fontSize: 14, color: '#666', marginTop: 4}}>
            Margin: {profitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* P&L Report (interactive, on-screen only — drill-down links, hidden on print) */}
      <div style={styles.reportCard} className="no-print">
        <div style={styles.reportHeader}>
          <h2 style={styles.reportTitle}>Profit & Loss Statement</h2>
          <p style={styles.reportDate}>{formatDateRange()}</p>
        </div>

        {/* INCOME SECTION */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>INCOME</h3>
          {reportData.income.length === 0 ? (
            <div style={styles.noData}>No income recorded for this period</div>
          ) : (
            <>
              {reportData.income.map((account) => (
                <div
                  key={account.id}
                  style={{...styles.lineItem, cursor: 'pointer'}}
                  onClick={() => openDrillDown([account.id], 'Income', `${account.account_number} - ${account.account_name}`)}
                  title="Click to see transactions for this account"
                >
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={{...styles.amount, textDecoration: 'underline'}}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div
                style={{...styles.totalLine, cursor: 'pointer'}}
                onClick={() => openDrillDown(reportData.income.map(a => a.id), 'Income', 'Total Income')}
                title="Click to see all income transactions"
              >
                <div style={styles.totalLabel}>Total Income</div>
                <div style={{...styles.totalAmount, color: '#10b981', textDecoration: 'underline'}}>
                  {formatCurrency(reportData.totalIncome)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* EXPENSES SECTION */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>EXPENSES</h3>
          {reportData.expenses.length === 0 ? (
            <div style={styles.noData}>No expenses recorded for this period</div>
          ) : (
            <>
              {reportData.expenses.map((account) => (
                <div
                  key={account.id}
                  style={{...styles.lineItem, cursor: 'pointer'}}
                  onClick={() => openDrillDown([account.id], 'Expense', `${account.account_number} - ${account.account_name}`)}
                  title="Click to see transactions for this account"
                >
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={{...styles.amount, textDecoration: 'underline'}}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div
                style={{...styles.totalLine, cursor: 'pointer'}}
                onClick={() => openDrillDown(reportData.expenses.map(a => a.id), 'Expense', 'Total Expenses')}
                title="Click to see all expense transactions"
              >
                <div style={styles.totalLabel}>Total Expenses</div>
                <div style={{...styles.totalAmount, color: '#ef4444', textDecoration: 'underline'}}>
                  {formatCurrency(reportData.totalExpenses)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* NET INCOME */}
        <div style={{
          ...styles.netIncomeSection,
          backgroundColor: reportData.netIncome >= 0 ? '#f0fdf4' : '#fef2f2'
        }}>
          <div style={styles.netIncomeLabel}>
            {reportData.netIncome >= 0 ? 'NET INCOME' : 'NET LOSS'}
          </div>
          <div style={{
            ...styles.netIncomeAmount,
            color: reportData.netIncome >= 0 ? '#065f46' : '#991b1b'
          }}>
            {formatCurrency(Math.abs(reportData.netIncome))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions} className="no-print">
        <button 
          onClick={() => navigate('/accounting/general-ledger')}
          style={styles.actionButton}
        >
          📖 View General Ledger
        </button>
        <button 
          onClick={() => navigate('/accounting/reports/trial-balance')}
          style={styles.actionButton}
        >
          📊 Trial Balance
        </button>
        <button 
          onClick={() => window.print()}
          style={{...styles.actionButton, backgroundColor: '#10b981'}}
        >
          🖨️ Print Report
        </button>
        <button
          onClick={exportToPDF}
          style={{...styles.actionButton, backgroundColor: '#ef4444'}}
        >
          📄 Download PDF
        </button>
      </div>

      {/* ── Print-only static document ───────────────────────────────────
          This is a plain, non-interactive financial statement (no date
          pickers, no dashboard cards, no drill-down underlines) that only
          renders when printing. Everything else on this page is marked
          .no-print and is hidden via the print CSS below. */}
      <div className="pl-report">
        <div className="pl-report-letterhead">
          <img src={BRAND.logo_url || defaultLogoUrl} alt="Company Logo" className="pl-report-logo" />
          <div className="pl-report-company-name">{companyInfo?.name || BRAND.name}</div>
          {companyAddressLine() && <div className="pl-report-company-line">{companyAddressLine()}</div>}
          {companyContactLine() && <div className="pl-report-company-line">{companyContactLine()}</div>}
        </div>

        <div className="pl-report-rule" />

        <h1 className="pl-report-title">Profit &amp; Loss Statement</h1>
        <p className="pl-report-subtitle">For the Period {formatDateRange()}</p>

        <h3 className="pl-report-section-title">Income</h3>
        <table className="pl-report-table">
          <thead>
            <tr><th>Acct #</th><th>Account</th><th className="pl-report-amt">Amount</th></tr>
          </thead>
          <tbody>
            {reportData.income.length === 0 ? (
              <tr><td colSpan={3} className="pl-report-nodata">No income recorded for this period</td></tr>
            ) : reportData.income.map((account) => (
              <tr key={account.id}>
                <td>{account.account_number}</td>
                <td>{account.account_name}</td>
                <td className="pl-report-amt">{formatCurrency(account.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pl-report-total-row">
              <td colSpan={2}>Total Income</td>
              <td className="pl-report-amt">{formatCurrency(reportData.totalIncome)}</td>
            </tr>
          </tfoot>
        </table>

        <h3 className="pl-report-section-title">Expenses</h3>
        <table className="pl-report-table">
          <thead>
            <tr><th>Acct #</th><th>Account</th><th className="pl-report-amt">Amount</th></tr>
          </thead>
          <tbody>
            {reportData.expenses.length === 0 ? (
              <tr><td colSpan={3} className="pl-report-nodata">No expenses recorded for this period</td></tr>
            ) : reportData.expenses.map((account) => (
              <tr key={account.id}>
                <td>{account.account_number}</td>
                <td>{account.account_name}</td>
                <td className="pl-report-amt">{formatCurrency(account.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pl-report-total-row">
              <td colSpan={2}>Total Expenses</td>
              <td className="pl-report-amt">{formatCurrency(reportData.totalExpenses)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="pl-report-net-row">
          <span>{reportData.netIncome >= 0 ? "NET INCOME" : "NET LOSS"}</span>
          <span>{formatCurrency(Math.abs(reportData.netIncome))}</span>
        </div>
        <div className="pl-report-margin">Margin: {profitMargin.toFixed(1)}%</div>

        <p className="pl-report-footer">
          Generated on {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .pl-screen { background: #fff !important; padding: 0 !important; }
          .pl-report { display: block !important; }
        }
        .pl-report { display: none; }
        .pl-report, .pl-report * { text-decoration: none !important; }
        .pl-report-letterhead { text-align: center; margin-bottom: 8px; }
        .pl-report-logo { max-width: 140px; height: auto; margin-bottom: 8px; }
        .pl-report-company-name { font-size: 15px; font-weight: 700; color: #111; }
        .pl-report-company-line { font-size: 11px; color: #666; margin-top: 2px; }
        .pl-report-rule { border-top: 2px solid #d1d5db; margin: 14px 0 20px; }
        .pl-report-title { font-size: 22px; font-weight: 700; color: #111; text-align: center; margin: 0 0 4px; }
        .pl-report-subtitle { font-size: 13px; color: #666; text-align: center; margin: 0 0 24px; }
        .pl-report-section-title { font-size: 14px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
        .pl-report-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #111; }
        .pl-report-table thead { display: table-header-group; }
        .pl-report-table th { text-align: left; padding: 6px 4px; border-bottom: 1px solid #d1d5db; font-weight: 700; color: #374151; }
        .pl-report-table td { padding: 6px 4px; border-bottom: 1px solid #f0f0f0; }
        .pl-report-amt { text-align: right; }
        .pl-report-nodata { text-align: center; color: #999; font-style: italic; padding: 12px; }
        .pl-report-total-row td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; padding-top: 8px; }
        .pl-report-net-row { display: flex; justify-content: space-between; font-size: 17px; font-weight: 700; color: #111; border-top: 3px double #111; margin-top: 20px; padding-top: 10px; }
        .pl-report-margin { text-align: right; font-size: 11px; color: #666; margin-top: 2px; }
        .pl-report-footer { text-align: center; font-size: 9px; color: #9ca3af; margin-top: 30px; }
        .pl-report-table tr { page-break-inside: avoid; }
      `}</style>

      {drillDown && (
        <div className="no-print">
          <AccountDrillDown
            accountIds={drillDown.accountIds}
            accountType={drillDown.accountType}
            title={drillDown.title}
            startDate={startDate}
            endDate={endDate}
            onClose={() => setDrillDown(null)}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8", // static fallback; overridden inline via BRAND.bg above
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    flexWrap: "wrap",
    gap: 20,
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
  },
  controls: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
  },
  dateControl: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  dateInput: {
    padding: "10px 14px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
    fontWeight: "600",
    colorScheme: "light",
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
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
    fontSize: 28,
    fontWeight: "bold",
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    marginBottom: 30,
    overflow: "hidden",
  },
  reportHeader: {
    padding: 28,
    borderBottom: "2px solid #e5e7eb",
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  reportDate: {
    fontSize: 15,
    color: "#666",
    margin: 0,
  },
  section: {
    padding: "24px 28px",
    borderBottom: "1px solid #e5e7eb",
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "2px solid #e5e7eb",
  },
  noData: {
    textAlign: "center",
    padding: 20,
    color: "#999",
    fontStyle: "italic",
  },
  lineItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    marginLeft: 20,
  },
  accountInfo: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  accountNumber: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    minWidth: 60,
  },
  accountName: {
    fontSize: 15,
    color: "#111",
  },
  amount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    minWidth: 120,
    textAlign: "right",
  },
  totalLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    marginTop: 12,
    borderTop: "2px solid #e5e7eb",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "bold",
    minWidth: 120,
    textAlign: "right",
  },
  netIncomeSection: {
    padding: "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netIncomeLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    letterSpacing: "1px",
  },
  netIncomeAmount: {
    fontSize: 32,
    fontWeight: "bold",
    minWidth: 150,
    textAlign: "right",
  },
  actions: {
    display: "flex",
    gap: 16,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionButton: {
    padding: "14px 28px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
};

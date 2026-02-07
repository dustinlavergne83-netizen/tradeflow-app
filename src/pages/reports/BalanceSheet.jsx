import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function BalanceSheet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState({
    assets: [],
    liabilities: [],
    equity: [],
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0
  });

  useEffect(() => {
    loadBalanceSheet();
  }, [user, asOfDate]);

  async function loadBalanceSheet() {
    try {
      setLoading(true);

      // Load all accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .in("account_type", ["Asset", "Liability", "Equity"])
        .order("account_number");

      if (accountsError) throw accountsError;

      // Load all posted journal entry lines up to the specified date
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
        .lte("journal_entries.entry_date", asOfDate);

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

      // Process Assets (debit balance is positive)
      const assetAccounts = accountsData
        .filter(acc => acc.account_type === 'Asset')
        .map(account => {
          const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
          const amount = balance.debit - balance.credit; // Debit increases assets
          return {
            ...account,
            amount: amount
          };
        })
        .filter(acc => acc.amount !== 0)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      // Process Liabilities (credit balance is positive)
      const liabilityAccounts = accountsData
        .filter(acc => acc.account_type === 'Liability')
        .map(account => {
          const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
          const amount = balance.credit - balance.debit; // Credit increases liabilities
          return {
            ...account,
            amount: amount
          };
        })
        .filter(acc => acc.amount !== 0)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      // Process Equity (credit balance is positive)
      const equityAccounts = accountsData
        .filter(acc => acc.account_type === 'Equity')
        .map(account => {
          const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
          const amount = balance.credit - balance.debit; // Credit increases equity
          return {
            ...account,
            amount: amount
          };
        })
        .filter(acc => acc.amount !== 0)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.amount, 0);
      const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + acc.amount, 0);
      const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.amount, 0);

      setReportData({
        assets: assetAccounts,
        liabilities: liabilityAccounts,
        equity: equityAccounts,
        totalAssets,
        totalLiabilities,
        totalEquity
      });
    } catch (err) {
      console.error("Error loading balance sheet:", err);
      alert("Failed to load balance sheet: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const totalLiabilitiesAndEquity = reportData.totalLiabilities + reportData.totalEquity;
  const difference = Math.abs(reportData.totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = difference < 0.01; // Within 1 cent tolerance

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading balance sheet...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Back to Accounting
          </button>
          <h1 style={styles.title}>📊 Balance Sheet</h1>
          <p style={styles.subtitle}>Statement of Financial Position</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.dateControl}>
            <label style={styles.dateLabel}>As of Date:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>
      </div>

      {/* Balance Status */}
      {!isBalanced && (
        <div style={styles.warningCard}>
          <div style={styles.warningIcon}>⚠️</div>
          <div style={styles.warningContent}>
            <h3 style={styles.warningTitle}>Balance Sheet Out of Balance</h3>
            <p style={styles.warningText}>
              Assets (${formatCurrency(reportData.totalAssets)}) do not equal Liabilities + Equity (${formatCurrency(totalLiabilitiesAndEquity)}). 
              Difference: {formatCurrency(difference)}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Assets</div>
          <div style={{...styles.summaryValue, color: '#3b82f6'}}>
            {formatCurrency(reportData.totalAssets)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Liabilities</div>
          <div style={{...styles.summaryValue, color: '#ef4444'}}>
            {formatCurrency(reportData.totalLiabilities)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Equity</div>
          <div style={{...styles.summaryValue, color: '#10b981'}}>
            {formatCurrency(reportData.totalEquity)}
          </div>
        </div>
        <div style={{
          ...styles.summaryCard,
          backgroundColor: isBalanced ? '#d1fae5' : '#fee2e2',
          borderLeft: isBalanced ? '4px solid #10b981' : '4px solid #ef4444'
        }}>
          <div style={styles.summaryLabel}>
            {isBalanced ? 'Balanced ✓' : 'Difference'}
          </div>
          <div style={{
            ...styles.summaryValue,
            color: isBalanced ? '#065f46' : '#991b1b'
          }}>
            {isBalanced ? formatCurrency(reportData.totalAssets) : formatCurrency(difference)}
          </div>
        </div>
      </div>

      {/* Balance Sheet Report */}
      <div style={styles.reportCard}>
        <div style={styles.reportHeader}>
          <h2 style={styles.reportTitle}>Balance Sheet</h2>
          <p style={styles.reportDate}>As of {formatDate(asOfDate)}</p>
        </div>

        {/* ASSETS SECTION */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>ASSETS</h3>
          {reportData.assets.length === 0 ? (
            <div style={styles.noData}>No asset accounts with balances</div>
          ) : (
            <>
              {reportData.assets.map((account, idx) => (
                <div key={account.id} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={styles.amount}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Total Assets</div>
                <div style={{...styles.totalAmount, color: '#3b82f6'}}>
                  {formatCurrency(reportData.totalAssets)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* LIABILITIES SECTION */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>LIABILITIES</h3>
          {reportData.liabilities.length === 0 ? (
            <div style={styles.noData}>No liability accounts with balances</div>
          ) : (
            <>
              {reportData.liabilities.map((account, idx) => (
                <div key={account.id} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={styles.amount}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Total Liabilities</div>
                <div style={{...styles.totalAmount, color: '#ef4444'}}>
                  {formatCurrency(reportData.totalLiabilities)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* EQUITY SECTION */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>EQUITY</h3>
          {reportData.equity.length === 0 ? (
            <div style={styles.noData}>No equity accounts with balances</div>
          ) : (
            <>
              {reportData.equity.map((account, idx) => (
                <div key={account.id} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={styles.amount}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Total Equity</div>
                <div style={{...styles.totalAmount, color: '#10b981'}}>
                  {formatCurrency(reportData.totalEquity)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* TOTAL LIABILITIES & EQUITY */}
        <div style={{
          ...styles.grandTotalSection,
          backgroundColor: isBalanced ? '#f0fdf4' : '#fef2f2'
        }}>
          <div style={styles.grandTotalLabel}>
            TOTAL LIABILITIES & EQUITY
          </div>
          <div style={{
            ...styles.grandTotalAmount,
            color: isBalanced ? '#065f46' : '#991b1b'
          }}>
            {formatCurrency(totalLiabilitiesAndEquity)}
          </div>
        </div>

        {/* Balance Equation Visual */}
        <div style={styles.equationSection}>
          <div style={styles.equation}>
            <div style={styles.equationPart}>
              <span style={styles.equationLabel}>Assets</span>
              <span style={styles.equationValue}>{formatCurrency(reportData.totalAssets)}</span>
            </div>
            <div style={styles.equationEquals}>=</div>
            <div style={styles.equationPart}>
              <span style={styles.equationLabel}>Liabilities</span>
              <span style={styles.equationValue}>{formatCurrency(reportData.totalLiabilities)}</span>
            </div>
            <div style={styles.equationPlus}>+</div>
            <div style={styles.equationPart}>
              <span style={styles.equationLabel}>Equity</span>
              <span style={styles.equationValue}>{formatCurrency(reportData.totalEquity)}</span>
            </div>
          </div>
          {isBalanced && (
            <div style={styles.balancedText}>✅ Accounting equation balanced!</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button 
          onClick={() => navigate('/accounting/general-ledger')}
          style={styles.actionButton}
        >
          📖 View General Ledger
        </button>
        <button 
          onClick={() => navigate('/accounting/reports/profit-loss')}
          style={styles.actionButton}
        >
          💰 Profit & Loss
        </button>
        <button 
          onClick={() => window.print()}
          style={{...styles.actionButton, backgroundColor: '#10b981'}}
        >
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8",
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
  warningCard: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: 20,
    backgroundColor: "#fee2e2",
    border: "3px solid #ef4444",
    borderRadius: 12,
    marginBottom: 30,
  },
  warningIcon: {
    fontSize: 36,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#991b1b",
    margin: "0 0 6px 0",
  },
  warningText: {
    fontSize: 14,
    color: "#7f1d1d",
    margin: 0,
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
  grandTotalSection: {
    padding: "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "3px double #111",
  },
  grandTotalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    letterSpacing: "1px",
  },
  grandTotalAmount: {
    fontSize: 32,
    fontWeight: "bold",
    minWidth: 150,
    textAlign: "right",
  },
  equationSection: {
    padding: "24px 28px",
    backgroundColor: "#f9fafb",
    borderTop: "2px solid #e5e7eb",
  },
  equation: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  equationPart: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "12px 20px",
    backgroundColor: "#fff",
    borderRadius: 8,
    border: "2px solid #e5e7eb",
  },
  equationLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  equationValue: {
    fontSize: 18,
    color: "#111",
    fontWeight: "700",
  },
  equationEquals: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#666",
  },
  equationPlus: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#666",
  },
  balancedText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#10b981",
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

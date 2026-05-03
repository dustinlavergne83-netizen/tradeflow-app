import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function CashFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState({
    operating: [],
    investing: [],
    financing: [],
    netOperating: 0,
    netInvesting: 0,
    netFinancing: 0,
    netCashFlow: 0,
    beginningCash: 0,
    endingCash: 0
  });

  useEffect(() => {
    loadCashFlow();
  }, [user, startDate, endDate]);

  async function loadCashFlow() {
    try {
      setLoading(true);

      // Load all accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("account_number");

      if (accountsError) throw accountsError;

      // Load journal entries within date range
      const { data: linesData, error: linesError } = await supabase
        .from("journal_entry_lines")
        .select(`
          *,
          journal_entries!inner(
            entry_date,
            is_posted,
            description
          ),
          accounts!inner(
            account_name,
            account_number,
            account_type
          )
        `)
        .eq("journal_entries.is_posted", true)
        .gte("journal_entries.entry_date", startDate)
        .lte("journal_entries.entry_date", endDate);

      if (linesError) throw linesError;

      // Get cash account IDs
      const cashAccounts = accountsData.filter(acc => 
        acc.account_name.toLowerCase().includes('cash') ||
        acc.account_name.toLowerCase().includes('checking') ||
        acc.account_name.toLowerCase().includes('savings') ||
        acc.account_type === 'Bank'
      );
      const cashAccountIds = cashAccounts.map(acc => acc.id);

      // Calculate beginning cash balance
      const { data: beginningLines, error: beginningError } = await supabase
        .from("journal_entry_lines")
        .select(`
          *,
          journal_entries!inner(
            entry_date,
            is_posted
          )
        `)
        .eq("journal_entries.is_posted", true)
        .lt("journal_entries.entry_date", startDate)
        .in("account_id", cashAccountIds);

      if (beginningError) throw beginningError;

      const beginningCash = beginningLines.reduce((sum, line) => {
        return sum + (line.debit || 0) - (line.credit || 0);
      }, 0);

      // Group cash flow items by category
      const operating = [];
      const investing = [];
      const financing = [];

      // Process lines involving cash accounts
      const cashFlowLines = linesData.filter(line => 
        cashAccountIds.includes(line.account_id)
      );

      // Group by category (for now, all goes to Operating)
      const categoryTotals = { Operating: {} };
      
      cashFlowLines.forEach(line => {
        const category = 'Operating'; // Default to operating activities
        const amount = (line.debit || 0) - (line.credit || 0);
        
        const accountKey = `${line.accounts.account_number} - ${line.accounts.account_name}`;
        if (!categoryTotals[category][accountKey]) {
          categoryTotals[category][accountKey] = {
            accountNumber: line.accounts.account_number,
            accountName: line.accounts.account_name,
            amount: 0
          };
        }
        categoryTotals[category][accountKey].amount += amount;
      });

      // Convert to arrays
      Object.keys(categoryTotals.Operating || {}).forEach(key => {
        if (categoryTotals.Operating[key].amount !== 0) {
          operating.push(categoryTotals.Operating[key]);
        }
      });

      Object.keys(categoryTotals.Investing || {}).forEach(key => {
        if (categoryTotals.Investing[key].amount !== 0) {
          investing.push(categoryTotals.Investing[key]);
        }
      });

      Object.keys(categoryTotals.Financing || {}).forEach(key => {
        if (categoryTotals.Financing[key].amount !== 0) {
          financing.push(categoryTotals.Financing[key]);
        }
      });

      // Calculate totals
      const netOperating = operating.reduce((sum, item) => sum + item.amount, 0);
      const netInvesting = investing.reduce((sum, item) => sum + item.amount, 0);
      const netFinancing = financing.reduce((sum, item) => sum + item.amount, 0);
      const netCashFlow = netOperating + netInvesting + netFinancing;
      const endingCash = beginningCash + netCashFlow;

      setReportData({
        operating: operating.sort((a, b) => b.amount - a.amount),
        investing: investing.sort((a, b) => b.amount - a.amount),
        financing: financing.sort((a, b) => b.amount - a.amount),
        netOperating,
        netInvesting,
        netFinancing,
        netCashFlow,
        beginningCash,
        endingCash
      });
    } catch (err) {
      console.error("Error loading cash flow:", err);
      alert("Failed to load cash flow: " + err.message);
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

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading cash flow statement...</div>
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
          <h1 style={styles.title}>💵 Cash Flow Statement</h1>
          <p style={styles.subtitle}>Statement of Cash Flows</p>
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
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Beginning Cash</div>
          <div style={{...styles.summaryValue, color: '#3b82f6'}}>
            {formatCurrency(reportData.beginningCash)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Net Cash Flow</div>
          <div style={{
            ...styles.summaryValue, 
            color: reportData.netCashFlow >= 0 ? '#10b981' : '#ef4444'
          }}>
            {formatCurrency(reportData.netCashFlow)}
          </div>
        </div>
        <div style={{
          ...styles.summaryCard,
          backgroundColor: reportData.netCashFlow >= 0 ? '#d1fae5' : '#fee2e2',
          borderLeft: reportData.netCashFlow >= 0 ? '4px solid #10b981' : '4px solid #ef4444'
        }}>
          <div style={styles.summaryLabel}>Ending Cash</div>
          <div style={{
            ...styles.summaryValue,
            color: reportData.netCashFlow >= 0 ? '#065f46' : '#991b1b'
          }}>
            {formatCurrency(reportData.endingCash)}
          </div>
        </div>
      </div>

      {/* Cash Flow Report */}
      <div style={styles.reportCard}>
        <div style={styles.reportHeader}>
          <h2 style={styles.reportTitle}>Statement of Cash Flows</h2>
          <p style={styles.reportDate}>{formatDateRange()}</p>
        </div>

        {/* Beginning Balance */}
        <div style={styles.balanceSection}>
          <div style={styles.balanceLabel}>Beginning Cash Balance</div>
          <div style={styles.balanceAmount}>{formatCurrency(reportData.beginningCash)}</div>
        </div>

        {/* OPERATING ACTIVITIES */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>CASH FLOWS FROM OPERATING ACTIVITIES</h3>
          {reportData.operating.length === 0 ? (
            <div style={styles.noData}>No operating activities for this period</div>
          ) : (
            <>
              {reportData.operating.map((item, idx) => (
                <div key={idx} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{item.accountNumber}</span>
                    <span style={styles.accountName}>{item.accountName}</span>
                  </div>
                  <div style={{
                    ...styles.amount,
                    color: item.amount >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Net Cash from Operating Activities</div>
                <div style={{
                  ...styles.totalAmount,
                  color: reportData.netOperating >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {formatCurrency(reportData.netOperating)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* INVESTING ACTIVITIES */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>CASH FLOWS FROM INVESTING ACTIVITIES</h3>
          {reportData.investing.length === 0 ? (
            <div style={styles.noData}>No investing activities for this period</div>
          ) : (
            <>
              {reportData.investing.map((item, idx) => (
                <div key={idx} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{item.accountNumber}</span>
                    <span style={styles.accountName}>{item.accountName}</span>
                  </div>
                  <div style={{
                    ...styles.amount,
                    color: item.amount >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Net Cash from Investing Activities</div>
                <div style={{
                  ...styles.totalAmount,
                  color: reportData.netInvesting >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {formatCurrency(reportData.netInvesting)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* FINANCING ACTIVITIES */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>CASH FLOWS FROM FINANCING ACTIVITIES</h3>
          {reportData.financing.length === 0 ? (
            <div style={styles.noData}>No financing activities for this period</div>
          ) : (
            <>
              {reportData.financing.map((item, idx) => (
                <div key={idx} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{item.accountNumber}</span>
                    <span style={styles.accountName}>{item.accountName}</span>
                  </div>
                  <div style={{
                    ...styles.amount,
                    color: item.amount >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Net Cash from Financing Activities</div>
                <div style={{
                  ...styles.totalAmount,
                  color: reportData.netFinancing >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {formatCurrency(reportData.netFinancing)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* NET CHANGE IN CASH */}
        <div style={{
          ...styles.netChangeSection,
          backgroundColor: reportData.netCashFlow >= 0 ? '#f0fdf4' : '#fef2f2'
        }}>
          <div style={styles.netChangeLabel}>
            NET CHANGE IN CASH
          </div>
          <div style={{
            ...styles.netChangeAmount,
            color: reportData.netCashFlow >= 0 ? '#065f46' : '#991b1b'
          }}>
            {formatCurrency(reportData.netCashFlow)}
          </div>
        </div>

        {/* Ending Balance */}
        <div style={styles.endingSection}>
          <div style={styles.endingRow}>
            <span style={styles.endingLabel}>Beginning Cash Balance</span>
            <span style={styles.endingValue}>{formatCurrency(reportData.beginningCash)}</span>
          </div>
          <div style={styles.endingRow}>
            <span style={styles.endingLabel}>Net Change in Cash</span>
            <span style={{
              ...styles.endingValue,
              color: reportData.netCashFlow >= 0 ? '#10b981' : '#ef4444'
            }}>
              {reportData.netCashFlow >= 0 ? '+' : ''}{formatCurrency(reportData.netCashFlow)}
            </span>
          </div>
          <div style={{...styles.endingRow, ...styles.endingTotalRow}}>
            <span style={styles.endingTotalLabel}>Ending Cash Balance</span>
            <span style={styles.endingTotalValue}>{formatCurrency(reportData.endingCash)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button 
          onClick={() => navigate('/accounting/reports/balance-sheet')}
          style={styles.actionButton}
        >
          ⚖️ Balance Sheet
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
  balanceSection: {
    padding: "20px 28px",
    backgroundColor: "#f9fafb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2px solid #e5e7eb",
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3b82f6",
  },
  section: {
    padding: "24px 28px",
    borderBottom: "1px solid #e5e7eb",
  },
  sectionHeader: {
    fontSize: 17,
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
  netChangeSection: {
    padding: "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netChangeLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    letterSpacing: "1px",
  },
  netChangeAmount: {
    fontSize: 32,
    fontWeight: "bold",
    minWidth: 150,
    textAlign: "right",
  },
  endingSection: {
    padding: "24px 28px",
    backgroundColor: "#f9fafb",
  },
  endingRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
  },
  endingLabel: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },
  endingValue: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
  },
  endingTotalRow: {
    borderTop: "3px double #111",
    paddingTop: 16,
    marginTop: 12,
  },
  endingTotalLabel: {
    fontSize: 18,
    color: "#111",
    fontWeight: "bold",
  },
  endingTotalValue: {
    fontSize: 24,
    color: "#111",
    fontWeight: "bold",
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

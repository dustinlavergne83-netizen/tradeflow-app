import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function ProfitLoss() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  useEffect(() => {
    loadProfitLoss();
  }, [user, startDate, endDate]);

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
      alert("Failed to load profit & loss: " + err.message);
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

  const formatDateRange = () => {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  };

  const profitMargin = reportData.totalIncome > 0 
    ? (reportData.netIncome / reportData.totalIncome) * 100 
    : 0;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading profit & loss statement...</div>
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
          <h1 style={styles.title}>📊 Profit & Loss Statement</h1>
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
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Income</div>
          <div style={{...styles.summaryValue, color: '#10b981'}}>
            {formatCurrency(reportData.totalIncome)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Expenses</div>
          <div style={{...styles.summaryValue, color: '#ef4444'}}>
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

      {/* P&L Report */}
      <div style={styles.reportCard}>
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
              {reportData.income.map((account, idx) => (
                <div key={account.id} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={styles.amount}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Total Income</div>
                <div style={{...styles.totalAmount, color: '#10b981'}}>
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
              {reportData.expenses.map((account, idx) => (
                <div key={account.id} style={styles.lineItem}>
                  <div style={styles.accountInfo}>
                    <span style={styles.accountNumber}>{account.account_number}</span>
                    <span style={styles.accountName}>{account.account_name}</span>
                  </div>
                  <div style={styles.amount}>{formatCurrency(account.amount)}</div>
                </div>
              ))}
              <div style={styles.totalLine}>
                <div style={styles.totalLabel}>Total Expenses</div>
                <div style={{...styles.totalAmount, color: '#ef4444'}}>
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
      <div style={styles.actions}>
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

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function AccountLedger() {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("current_month");
  const [dateRange, setDateRange] = useState(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    loadAccountAndLedger();
  }, [accountId, user]);

  async function loadAccountAndLedger() {
    try {
      setLoading(true);

      // Load account details
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .eq("company_id", user.id)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Load all journal entry lines for this account with entry details
      const { data: ledgerData, error: ledgerError } = await supabase
        .from("journal_entry_lines")
        .select(`
          id,
          debit,
          credit,
          description,
          created_at,
          journal_entries:entry_id (
            id,
            entry_number,
            entry_date,
            description,
            reference_type,
            is_posted
          )
        `)
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });

      if (ledgerError) throw ledgerError;

      // Map the data and calculate running balance
      let runningBalance = 0;
      const transactionsWithBalance = (ledgerData || []).map((line) => {
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);

        // Calculate change based on normal balance
        let change = 0;
        if (accountData.normal_balance === "credit") {
          change = credit - debit;
        } else {
          change = debit - credit;
        }

        runningBalance += change;

        return {
          ...line,
          debit,
          credit,
          change,
          runningBalance,
          entry_date: line.journal_entries?.entry_date,
          entry_number: line.journal_entries?.entry_number,
          entry_description: line.journal_entries?.description,
          reference_type: line.journal_entries?.reference_type,
          is_posted: line.journal_entries?.is_posted,
        };
      });

      // Update account balance to match calculated balance
      if (accountData && runningBalance !== accountData.balance) {
        supabase
          .from('accounts')
          .update({ balance: runningBalance })
          .eq('id', accountId)
          .then(() => {
            // Update the account data with the recalculated balance
            setAccount({ ...accountData, balance: runningBalance });
          })
          .catch((err) => console.warn('Failed to sync balance:', err));
      }

      setTransactions(transactionsWithBalance);
    } catch (err) {
      console.error("Error loading ledger:", err);
      alert("Failed to load account ledger");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "$0.00";
    return `$${Math.abs(Number(amount)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const getDateRangeFromFilter = (filter) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    let startDate = null;
    let endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    switch (filter) {
      case "current_month":
        startDate = new Date(currentYear, currentMonth, 1);
        break;
      case "last_month":
        startDate = new Date(currentYear, currentMonth - 1, 1);
        endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        break;
      case "last_3_months":
        startDate = new Date(currentYear, currentMonth - 3, 1);
        break;
      case "last_6_months":
        startDate = new Date(currentYear, currentMonth - 6, 1);
        break;
      case "last_year":
        startDate = new Date(currentYear - 1, currentMonth, 1);
        break;
      case "all":
      default:
        startDate = new Date(1970, 0, 1);
        break;
    }

    return { startDate, endDate };
  };

  const getFilteredTransactions = () => {
    let startDate, endDate;

    // If custom dates are provided, use them
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Otherwise use preset filter
      const range = getDateRangeFromFilter(filterType);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    return transactions.filter((transaction) => {
      const transDate = new Date(transaction.entry_date);
      return transDate >= startDate && transDate <= endDate;
    });
  };

  const handleApplyCustomDates = () => {
    if (!customStartDate || !customEndDate) {
      alert("Please select both start and end dates");
      return;
    }
    if (new Date(customStartDate) > new Date(customEndDate)) {
      alert("Start date must be before end date");
      return;
    }
  };

  const handleClearCustomDates = () => {
    setCustomStartDate("");
    setCustomEndDate("");
    setFilterType("current_month");
  };

  const filteredTransactions = getFilteredTransactions();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading ledger...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Account not found</div>
        <button
          onClick={() => navigate("/accounting")}
          style={styles.backButton}
        >
          ← Back to Chart of Accounts
        </button>
      </div>
    );
  }

  const totalDebits = filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredits = filteredTransactions.reduce((sum, t) => sum + t.credit, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 Account Ledger</h1>
          <p style={styles.subtitle}>
            {account.account_number} - {account.account_name}
          </p>
        </div>
        <button
          onClick={() => navigate("/accounting")}
          style={styles.backButton}
        >
          ← Back
        </button>
      </div>

      {/* Account Summary */}
      <div style={styles.summaryContainer}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Account Type</div>
          <div style={styles.summaryValue}>{account.account_type}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Normal Balance</div>
          <div style={styles.summaryValue}>
            {account.normal_balance === "debit" ? "Debit" : "Credit"}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Current Balance</div>
          <div
            style={{
              ...styles.summaryValue,
              color: account.balance >= 0 ? "#10b981" : "#ef4444",
            }}
          >
            {formatCurrency(account.balance)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Debits</div>
          <div style={styles.summaryValue}>{formatCurrency(totalDebits)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Credits</div>
          <div style={styles.summaryValue}>{formatCurrency(totalCredits)}</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={styles.filterContainer}>
        <div style={styles.filterLabel}>Filter by Date Range:</div>
        <div style={styles.filterButtons}>
          <button
            onClick={() => setFilterType("current_month")}
            style={{
              ...styles.filterButton,
              ...(filterType === "current_month"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            Current Month
          </button>
          <button
            onClick={() => setFilterType("last_month")}
            style={{
              ...styles.filterButton,
              ...(filterType === "last_month"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            Last Month
          </button>
          <button
            onClick={() => setFilterType("last_3_months")}
            style={{
              ...styles.filterButton,
              ...(filterType === "last_3_months"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            Last 3 Months
          </button>
          <button
            onClick={() => setFilterType("last_6_months")}
            style={{
              ...styles.filterButton,
              ...(filterType === "last_6_months"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            Last 6 Months
          </button>
          <button
            onClick={() => setFilterType("last_year")}
            style={{
              ...styles.filterButton,
              ...(filterType === "last_year"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            Last Year
          </button>
          <button
            onClick={() => setFilterType("all")}
            style={{
              ...styles.filterButton,
              ...(filterType === "all"
                ? styles.filterButtonActive
                : styles.filterButtonInactive),
            }}
          >
            All Transactions
          </button>
        </div>
      </div>

      {/* Custom Date Range Filter */}
      <div style={styles.customDateContainer}>
        <div style={styles.customDateLabel}>Or select custom date range:</div>
        <div style={styles.customDateInputs}>
          <div style={styles.dateInputGroup}>
            <label style={styles.dateInputLabel}>From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.dateInputGroup}>
            <label style={styles.dateInputLabel}>To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <button
            onClick={handleApplyCustomDates}
            style={{
              ...styles.customDateButton,
              ...(customStartDate && customEndDate
                ? styles.customDateButtonApply
                : styles.customDateButtonDisabled),
            }}
            disabled={!customStartDate || !customEndDate}
          >
            Apply
          </button>
          {(customStartDate || customEndDate) && (
            <button
              onClick={handleClearCustomDates}
              style={styles.customDateButtonClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      {filteredTransactions.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No transactions for this account in the selected date range</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{ ...styles.th, width: "10%" }}>Date</th>
                <th style={{ ...styles.th, width: "10%" }}>Entry #</th>
                <th style={{ ...styles.th, width: "30%" }}>Description</th>
                <th style={{ ...styles.th, width: "12%", textAlign: "right" }}>
                  Debit
                </th>
                <th style={{ ...styles.th, width: "12%", textAlign: "right" }}>
                  Credit
                </th>
                <th style={{ ...styles.th, width: "14%", textAlign: "right" }}>
                  Balance
                </th>
                <th style={{ ...styles.th, width: "12%", textAlign: "center" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  style={{
                    ...styles.tableRow,
                    backgroundColor:
                      index % 2 === 0 ? "#f9fafb" : "#ffffff",
                  }}
                >
                  <td style={styles.td}>
                    <strong>{formatDate(transaction.entry_date)}</strong>
                  </td>
                  <td style={styles.td}>{transaction.entry_number}</td>
                  <td style={styles.td}>
                    <div style={styles.description}>
                      {transaction.entry_description}
                    </div>
                    {transaction.description && (
                      <div style={styles.lineDescription}>
                        {transaction.description}
                      </div>
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    {transaction.debit > 0 ? (
                      <strong style={{ color: "#1f2937" }}>
                        {formatCurrency(transaction.debit)}
                      </strong>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    {transaction.credit > 0 ? (
                      <strong style={{ color: "#1f2937" }}>
                        {formatCurrency(transaction.credit)}
                      </strong>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <strong
                      style={{
                        fontSize: 15,
                        color:
                          transaction.runningBalance >= 0
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {formatCurrency(transaction.runningBalance)}
                    </strong>
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: transaction.is_posted
                          ? "#d1fae5"
                          : "#fef3c7",
                        color: transaction.is_posted ? "#059669" : "#d97706",
                      }}
                    >
                      {transaction.is_posted ? "✓ Posted" : "⏳ Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          Filtered transactions: {filteredTransactions.length} | Total Debits:{" "}
          {formatCurrency(totalDebits)} | Total Credits:{" "}
          {formatCurrency(totalCredits)}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
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
  backButton: {
    padding: "12px 20px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  error: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#ef4444",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  summaryContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    overflow: "hidden",
    marginBottom: 30,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#f3f4f6",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "16px 20px",
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    textAlign: "left",
  },
  tableRow: {
    borderBottom: "1px solid #f0f0f0",
    transition: "background-color 0.2s",
  },
  td: {
    padding: "14px 20px",
    fontSize: 14,
    color: "#333",
  },
  description: {
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  lineDescription: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  statusBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },
  footer: {
    textAlign: "center",
    padding: 20,
  },
  footerText: {
    color: "#fff",
    fontSize: 14,
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 30,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    whiteSpace: "nowrap",
  },
  filterButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  filterButton: {
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "600",
    border: "2px solid",
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  filterButtonActive: {
    backgroundColor: "#0b3ea8",
    color: "#fff",
    borderColor: "#0b3ea8",
  },
  filterButtonInactive: {
    backgroundColor: "#f3f4f6",
    color: "#666",
    borderColor: "#e5e7eb",
  },
  customDateContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 30,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  customDateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  customDateInputs: {
    display: "flex",
    gap: 16,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  dateInputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },
  dateInput: {
    padding: "10px 12px",
    fontSize: 14,
    border: "2px solid #0b3ea8",
    borderRadius: 8,
    fontFamily: "inherit",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  customDateButton: {
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  customDateButtonApply: {
    backgroundColor: "#0b3ea8",
    color: "#fff",
  },
  customDateButtonDisabled: {
    backgroundColor: "#d1d5db",
    color: "#9ca3af",
    cursor: "not-allowed",
  },
  customDateButtonClear: {
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    border: "2px solid #fca5a5",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

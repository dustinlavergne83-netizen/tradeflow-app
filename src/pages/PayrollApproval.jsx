import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#f97316",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#7c3aed",
};

const formatCurrency = (val) => {
  const n = parseFloat(val) || 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function PayrollApproval() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({}); // { [id]: true/false }
  const [message, setMessage] = useState({ type: "", text: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [rejectNote, setRejectNote] = useState({});
  const [activeTab, setActiveTab] = useState("pending");
  const [stubUrl, setStubUrl] = useState({}); // { [id]: signedUrl }
  const [expenseAccounts, setExpenseAccounts] = useState([]); // COA expense accounts
  const [bankAccounts, setBankAccounts] = useState([]); // bank_accounts table
  const [selectedBankAccount, setSelectedBankAccount] = useState({}); // { [recordId]: bankAccountId }
  const DEFAULT_CLEARING_ID = "1a3dee07-21ac-4043-b1eb-ddae8dc52337"; // Clearing Account (3551)
  const [showTaxDeposit, setShowTaxDeposit] = useState(false);
  const [taxDepositPeriods, setTaxDepositPeriods] = useState([]); // IRS grouped pay periods
  const [taxDepositAccount, setTaxDepositAccount] = useState(DEFAULT_CLEARING_ID);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  // State tax deposit
  const [stateTaxTotal, setStateTaxTotal] = useState(0);
  const [stateTaxStubs, setStateTaxStubs] = useState([]); // stub details for state deposit
  const [stateTaxAccount, setStateTaxAccount] = useState(DEFAULT_CLEARING_ID);
  const [stateTaxDate, setStateTaxDate] = useState(new Date().toISOString().split("T")[0]);
  const [creatingStateDeposit, setCreatingStateDeposit] = useState(false);
  const [pastDeposits, setPastDeposits] = useState([]);
  const [showPastDeposits, setShowPastDeposits] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadRecords();
      loadExpenseAccounts();
      loadBankAccounts();
    }
  }, [user?.id, activeTab]);

  async function loadBankAccounts() {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_number, account_name, account_type")
        .order("account_number");
      if (!error) setBankAccounts(data || []);
    } catch (e) {
      console.warn("Could not load bank accounts:", e);
    }
  }

  // ── Load approved stubs grouped by pay period for Tax Deposit feature ──────
  async function loadTaxDepositPeriods() {
    try {
      const { data, error } = await supabase
        .from("payroll_expense_approvals")
        .select("id, employee_name, pay_period_start, pay_period_end, pay_date, federal_tax, state_tax, social_security, medicare, gross_wages, net_pay, irs_deposit_created, state_deposit_created")
        .eq("status", "approved")
        .order("pay_period_end", { ascending: false });
      if (error) throw error;

      const allRows = data || [];

      // Only show IRS periods where deposit has NOT been created yet
      const irsRows = allRows.filter(r => !r.irs_deposit_created);

      // Group by pay_period_end — only pending IRS rows
      const groups = {};
      for (const row of irsRows) {
        const key = row.pay_period_end || row.pay_date || "unknown";
        if (!groups[key]) {
          groups[key] = {
            pay_period_end: row.pay_period_end,
            pay_period_start: row.pay_period_start,
            pay_date: row.pay_date,
            employees: [],
            total_gross: 0,
            total_fed: 0,
            total_state: 0,
            total_ss_employee: 0,
            total_medicare_employee: 0,
          };
        }
        groups[key].employees.push(row.employee_name || "Unknown");
        groups[key].total_gross += parseFloat(row.gross_wages) || 0;
        groups[key].total_fed += parseFloat(row.federal_tax) || 0;
        groups[key].total_state += parseFloat(row.state_tax) || 0;
        groups[key].total_ss_employee += parseFloat(row.social_security) || 0;
        groups[key].total_medicare_employee += parseFloat(row.medicare) || 0;
      }

      // Add employer match totals — IRS deposit does NOT include state tax
      const periods = Object.values(groups).map(g => ({
        ...g,
        employer_ss: g.total_ss_employee,
        employer_medicare: g.total_medicare_employee,
        grand_total: g.total_fed
          + (g.total_ss_employee * 2)     // employee + employer SS
          + (g.total_medicare_employee * 2), // employee + employer Medicare
        // state_tax is tracked separately via State Tax Deposit
        stub_ids: irsRows
          .filter(r => (r.pay_period_end || r.pay_date) === g.pay_period_end)
          .map(r => r.id),
      }));

      // State tax: only include stubs where state_deposit_created is false/null
      const stateRows = allRows.filter(r => !r.state_deposit_created);
      const totalState = stateRows.reduce((sum, r) => sum + (parseFloat(r.state_tax) || 0), 0);
      setStateTaxTotal(totalState);
      setStateTaxStubs(stateRows);

      setTaxDepositPeriods(periods.sort((a, b) => b.pay_period_end?.localeCompare(a.pay_period_end)));

      // Load past tax deposits from expenses for archive section
      const { data: pastData } = await supabase
        .from("expenses")
        .select("id, expense_date, amount, description, vendor")
        .or("description.ilike.%IRS Payroll Tax%,description.ilike.%State Income Tax Deposit%")
        .order("expense_date", { ascending: false })
        .limit(50);
      setPastDeposits(pastData || []);
    } catch (e) {
      console.warn("Could not load tax deposit periods:", e);
    }
  }

  // ── ONE-TIME FIX: Delete old combined IRS deposits + reset stub flags ─────
  async function fixOldDeposits() {
    if (!window.confirm(
      "This will DELETE all old combined IRS Payroll Tax Deposit entries and reset those pay periods so you can recreate them with the correct split format.\n\nContinue?"
    )) return;
    try {
      // 1. Find all old-format combined deposits (description has old pattern)
      const { data: oldExpenses, error: fetchErr } = await supabase
        .from("expenses")
        .select("id")
        .ilike("description", "IRS Payroll Tax Deposit%");
      if (fetchErr) throw fetchErr;

      if (oldExpenses && oldExpenses.length > 0) {
        const oldIds = oldExpenses.map(e => e.id);
        const { error: delErr } = await supabase
          .from("expenses")
          .delete()
          .in("id", oldIds);
        if (delErr) throw delErr;
      }

      // 2. Reset irs_deposit_created on ALL approved stubs so periods reappear
      const { error: resetErr } = await supabase
        .from("payroll_expense_approvals")
        .update({ irs_deposit_created: false })
        .eq("status", "approved")
        .eq("irs_deposit_created", true);
      if (resetErr) throw resetErr;

      setMessage({ type: "success", text: `✅ Fixed! ${oldExpenses?.length || 0} old deposit(s) deleted. All periods are now unlocked — recreate them using the new split format above.` });
      loadTaxDepositPeriods();
    } catch (err) {
      setMessage({ type: "error", text: "Fix failed: " + err.message });
    }
  }

  // ── Create state tax deposit (all periods rolled into one) ───────────────
  async function createStateTaxDeposit() {
    if (stateTaxTotal <= 0) return;
    setCreatingStateDeposit(true);
    try {
      // Summarize periods covered
      const periods = [...new Set(stateTaxStubs.map(r => r.pay_period_end || r.pay_date).filter(Boolean))].sort();
      const employees = [...new Set(stateTaxStubs.map(r => r.employee_name || "Unknown"))];
      const periodRange = periods.length > 1
        ? `${formatDate(periods[0])} – ${formatDate(periods[periods.length - 1])}`
        : formatDate(periods[0]);

      const expenseLine = {
        expense_date: stateTaxDate,
        amount: stateTaxTotal,
        category: "Payroll Taxes",
        vendor: "Louisiana / State Tax Authority",
        description: `State Income Tax Deposit — ${periodRange} (${employees.length} employee${employees.length !== 1 ? "s" : ""}: ${employees.join(", ")})`,
        payment_method: "check",
        tax_deductible: false,
        created_by: user.id,
        receipt_notes: `Employee state tax withholding remitted to state. Not deductible — already captured in gross wages.`,
        ...(stateTaxAccount ? { bank_account_id: stateTaxAccount } : {}),
      };

      const { error: expError } = await supabase.from("expenses").insert([expenseLine]);
      if (expError) throw expError;

      // Mark all state stubs as deposited so they disappear from the pending list
      const stateIds = stateTaxStubs.map(r => r.id).filter(Boolean);
      if (stateIds.length > 0) {
        await supabase
          .from("payroll_expense_approvals")
          .update({ state_deposit_created: true })
          .in("id", stateIds);
      }

      setMessage({ type: "success", text: `✅ State tax deposit created: ${formatCurrency(stateTaxTotal)}` });
      setShowTaxDeposit(false);
      loadTaxDepositPeriods();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create state tax deposit: " + err.message });
    } finally {
      setCreatingStateDeposit(false);
    }
  }

  // ── Create a single IRS tax deposit expense for a pay period ─────────────
  async function createTaxDeposit(period) {
    setCreatingDeposit(true);
    try {
      const payDate = period.pay_date || period.pay_period_end;
      const periodLabel = period.pay_period_start && period.pay_period_end
        ? `${formatDate(period.pay_period_start)} – ${formatDate(period.pay_period_end)}`
        : formatDate(payDate);

      const totalTax = period.grand_total;
      const empMatchAmount = period.employer_ss + period.employer_medicare;
      const empWithholdAmount = period.total_fed + period.total_ss_employee + period.total_medicare_employee;
      const empCount = period.employees.length;
      const empList = period.employees.join(", ");

      // Line 1: Employer match — DEDUCTIBLE (your actual business expense)
      const employerMatchLine = {
        expense_date: payDate,
        amount: empMatchAmount,
        category: "Payroll Taxes",
        vendor: "IRS",
        description: `IRS Payroll Tax — Employer Match — ${periodLabel} (${empCount} employee${empCount !== 1 ? "s" : ""}: ${empList}). Employer SS: ${formatCurrency(period.employer_ss)}, Employer Medicare: ${formatCurrency(period.employer_medicare)}`,
        payment_method: "check",
        tax_deductible: true,
        created_by: user.id,
        receipt_notes: `Employer's matching share of SS and Medicare. This is your deductible payroll tax expense.`,
        ...(taxDepositAccount ? { bank_account_id: taxDepositAccount } : {}),
      };

      // Line 2: Employee withholdings — NON-DEDUCTIBLE (pass-through money you remit on behalf of employees)
      const employeeWithholdLine = {
        expense_date: payDate,
        amount: empWithholdAmount,
        category: "Payroll Taxes",
        vendor: "IRS",
        description: `IRS Payroll Tax — Employee Withholdings — ${periodLabel} (${empCount} employee${empCount !== 1 ? "s" : ""}: ${empList}). Fed: ${formatCurrency(period.total_fed)}, Employee SS: ${formatCurrency(period.total_ss_employee)}, Employee Medicare: ${formatCurrency(period.total_medicare_employee)}`,
        payment_method: "check",
        tax_deductible: false,
        created_by: user.id,
        receipt_notes: `Employee-side withholdings remitted to IRS. Not a deductible employer expense — already captured in gross wages.`,
        ...(taxDepositAccount ? { bank_account_id: taxDepositAccount } : {}),
      };

      const { error: expError } = await supabase.from("expenses").insert([employerMatchLine, employeeWithholdLine]);
      if (expError) throw expError;

      // Mark stubs as IRS deposit created so they disappear from the pending list
      if (period.stub_ids?.length > 0) {
        await supabase
          .from("payroll_expense_approvals")
          .update({ irs_deposit_created: true })
          .in("id", period.stub_ids);
      }

      setMessage({ type: "success", text: `✅ Tax deposit created: ${formatCurrency(totalTax)} for ${periodLabel}` });
      setShowTaxDeposit(false);
      loadTaxDepositPeriods();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create tax deposit: " + err.message });
    } finally {
      setCreatingDeposit(false);
    }
  }

  async function loadExpenseAccounts() {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_number, account_name, account_type")
        .eq("account_type", "Expense")
        .eq("is_active", true)
        .order("account_number");
      if (!error) setExpenseAccounts(data || []);
    } catch (e) {
      console.warn("Could not load expense accounts:", e);
    }
  }

  // Find a Chart of Accounts expense account by number or name keyword
  function findAccount(numberOrKeyword) {
    if (!expenseAccounts.length) return null;
    // Try exact account_number match first
    const byNum = expenseAccounts.find(a => String(a.account_number) === String(numberOrKeyword));
    if (byNum) return byNum;
    // Fallback: name contains keyword
    const kw = numberOrKeyword.toLowerCase();
    return expenseAccounts.find(a => a.account_name?.toLowerCase().includes(kw)) || null;
  }

  async function loadRecords() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payroll_expense_approvals")
        .select(`
          *,
          employees:employee_id (id, first_name, last_name, email),
          check_stubs:check_stub_id (id, file_path, file_name)
        `)
        .eq("status", activeTab)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error("Error loading payroll approvals:", err);
      setMessage({ type: "error", text: "Failed to load payroll records: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function getStubUrl(record) {
    if (stubUrl[record.id]) {
      window.open(stubUrl[record.id], "_blank");
      return;
    }
    try {
      const filePath = record.check_stubs?.file_path;
      if (!filePath) { alert("No stub file linked to this record."); return; }
      const { data, error } = await supabase.storage
        .from("check-stubs")
        .createSignedUrl(filePath, 120);
      if (error) throw error;
      setStubUrl(prev => ({ ...prev, [record.id]: data.signedUrl }));
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      alert("Could not open stub: " + err.message);
    }
  }

  function startEdit(record) {
    setEditingId(record.id);
    setEditForm({
      gross_wages: record.gross_wages || 0,
      federal_tax: record.federal_tax || 0,
      state_tax: record.state_tax || 0,
      social_security: record.social_security || 0,
      medicare: record.medicare || 0,
      garnishments: record.garnishments || 0,
      other_deductions: record.other_deductions || 0,
      net_pay: record.net_pay || 0,
      pay_period_start: record.pay_period_start || "",
      pay_period_end: record.pay_period_end || "",
      pay_date: record.pay_date || "",
    });
  }

  async function saveEdit(id) {
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      const { error } = await supabase
        .from("payroll_expense_approvals")
        .update({
          gross_wages: parseFloat(editForm.gross_wages) || 0,
          federal_tax: parseFloat(editForm.federal_tax) || 0,
          state_tax: parseFloat(editForm.state_tax) || 0,
          social_security: parseFloat(editForm.social_security) || 0,
          medicare: parseFloat(editForm.medicare) || 0,
          garnishments: parseFloat(editForm.garnishments) || 0,
          other_deductions: parseFloat(editForm.other_deductions) || 0,
          net_pay: parseFloat(editForm.net_pay) || 0,
          pay_period_start: editForm.pay_period_start || null,
          pay_period_end: editForm.pay_period_end || null,
          pay_date: editForm.pay_date || null,
        })
        .eq("id", id);
      if (error) throw error;
      setEditingId(null);
      setEditForm({});
      loadRecords();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save changes: " + err.message });
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleApprove(record) {
    setSaving(prev => ({ ...prev, [record.id]: true }));
    setMessage({ type: "", text: "" });
    try {
      const emp = record.employees;
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : (record.employee_name || "Unknown");
      const payDate = record.pay_date || record.pay_period_end;
      const today = new Date().toISOString().split("T")[0];
      const stubNote = `Approved from payroll — stub ID: ${record.check_stub_id || "N/A"}`;
      const period = `${formatDate(record.pay_period_start)} – ${formatDate(record.pay_period_end)}`;

      // Look up Chart of Accounts IDs for payroll accounts
      const wagesAccount   = findAccount("6000") || findAccount("Payroll Wages");
      const taxAccount     = findAccount("6100") || findAccount("Payroll Tax");
      const garnishAccount = findAccount("6150") || findAccount("Wage Garnishment");

      // Selected clearing/bank account for this record
      const clearingAccountId = (selectedBankAccount[record.id] ?? DEFAULT_CLEARING_ID) || undefined;

      // Build the expense line items to insert
      const expenseLines = [];

      if (parseFloat(record.gross_wages) > 0) {
        expenseLines.push({
          expense_date: payDate || today,
          amount: parseFloat(record.gross_wages),
          category: wagesAccount?.account_name || "Payroll Wages",
          vendor: empName,
          description: `Gross Wages — ${empName} (Pay period: ${period})`,
          payment_method: "check",
          tax_deductible: true,
          created_by: user.id,
          receipt_notes: stubNote,
          ...(clearingAccountId ? { bank_account_id: clearingAccountId } : {}),
        });
      }

      // NOTE: Taxes (federal, state, SS, Medicare) are NOT added here.
      // Use "🧾 Create Tax Deposit" button to generate ONE combined IRS deposit
      // expense per pay period that matches your actual bank statement.

      if (parseFloat(record.garnishments) > 0) {
        expenseLines.push({
          expense_date: payDate || today,
          amount: parseFloat(record.garnishments),
          category: garnishAccount?.account_name || "Wage Garnishments",
          vendor: empName,
          description: `Wage Garnishment — ${empName} (${period})`,
          payment_method: "check",
          tax_deductible: false,
          created_by: user.id,
          receipt_notes: stubNote,
          ...(clearingAccountId ? { bank_account_id: clearingAccountId } : {}),
        });
      }

      if (parseFloat(record.other_deductions) > 0) {
        expenseLines.push({
          expense_date: payDate || today,
          amount: parseFloat(record.other_deductions),
          category: "Other",
          vendor: empName,
          description: `Other Deductions — ${empName} (${period})`,
          payment_method: "check",
          tax_deductible: false,
          created_by: user.id,
          receipt_notes: stubNote,
          ...(clearingAccountId ? { bank_account_id: clearingAccountId } : {}),
        });
      }

      // Insert all expense lines
      if (expenseLines.length > 0) {
        const { error: expError } = await supabase.from("expenses").insert(expenseLines);
        if (expError) throw expError;
      }

      // Mark as approved
      const { error: approveError } = await supabase
        .from("payroll_expense_approvals")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", record.id);
      if (approveError) throw approveError;

      setMessage({
        type: "success",
        text: `✅ Approved! ${expenseLines.length} expense line(s) added for ${empName}.`,
      });
      loadRecords();
    } catch (err) {
      console.error("Approval error:", err);
      setMessage({ type: "error", text: "Approval failed: " + err.message });
    } finally {
      setSaving(prev => ({ ...prev, [record.id]: false }));
    }
  }

  async function handleReject(record) {
    const note = rejectNote[record.id] || "";
    setSaving(prev => ({ ...prev, [record.id]: true }));
    try {
      const { error } = await supabase
        .from("payroll_expense_approvals")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_note: note,
        })
        .eq("id", record.id);
      if (error) throw error;

      setMessage({ type: "success", text: "Record rejected and archived." });
      setRejectNote(prev => { const n = { ...prev }; delete n[record.id]; return n; });
      loadRecords();
    } catch (err) {
      setMessage({ type: "error", text: "Reject failed: " + err.message });
    } finally {
      setSaving(prev => ({ ...prev, [record.id]: false }));
    }
  }

  const pendingCount = activeTab === "pending" ? records.length : null;

  // ── Styles ────────────────────────────────────────────────────────────────
  const styles = {
    container: { padding: "24px 20px", minHeight: "100vh" },
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 },
    title: { fontSize: 28, fontWeight: 900, color: "#fff", margin: 0 },
    msg: (type) => ({
      padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600, fontSize: 14,
      backgroundColor: type === "success" ? "#10b981" : "#ef4444", color: "#fff",
    }),
    tabs: { display: "flex", gap: 8, marginBottom: 24 },
    tab: (active) => ({
      padding: "10px 22px", borderRadius: 8, border: "2px solid",
      borderColor: active ? BRAND.primary : "rgba(255,255,255,0.2)",
      backgroundColor: active ? BRAND.primary : "transparent",
      color: active ? "#fff" : "rgba(255,255,255,0.7)",
      cursor: "pointer", fontWeight: 700, fontSize: 14,
    }),
    card: {
      backgroundColor: "#fff", borderRadius: 14, padding: 24, marginBottom: 16,
      boxShadow: "0 2px 16px rgba(0,0,0,0.10)", border: "2px solid #e5e7eb",
    },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 },
    empName: { fontSize: 20, fontWeight: 800, color: "#111", margin: 0 },
    metaRow: { display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#6b7280", marginTop: 4 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 16 },
    lineItem: (highlight) => ({
      backgroundColor: highlight ? "#fef3c7" : "#f9fafb",
      borderRadius: 8, padding: "10px 14px",
      border: `1px solid ${highlight ? "#fbbf24" : "#e5e7eb"}`,
    }),
    lineLabel: { fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 },
    lineValue: (color) => ({ fontSize: 18, fontWeight: 800, color: color || "#111" }),
    input: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "2px solid #7c3aed", fontSize: 14, fontWeight: 600, boxSizing: "border-box" },
    actionsRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16 },
    btnApprove: {
      padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer",
      backgroundColor: BRAND.green, color: "#fff", fontWeight: 800, fontSize: 15,
    },
    btnReject: {
      padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer",
      backgroundColor: BRAND.red, color: "#fff", fontWeight: 700, fontSize: 14,
    },
    btnEdit: {
      padding: "10px 20px", borderRadius: 8, border: "2px solid #7c3aed", cursor: "pointer",
      backgroundColor: "transparent", color: "#7c3aed", fontWeight: 700, fontSize: 13,
    },
    btnSave: {
      padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
      backgroundColor: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 13,
    },
    btnCancel: {
      padding: "10px 20px", borderRadius: 8, border: "2px solid #9ca3af", cursor: "pointer",
      backgroundColor: "transparent", color: "#6b7280", fontWeight: 600, fontSize: 13,
    },
    btnView: {
      padding: "8px 14px", borderRadius: 6, border: "2px solid #3b82f6", cursor: "pointer",
      backgroundColor: "transparent", color: "#3b82f6", fontWeight: 600, fontSize: 12,
    },
    rejectInput: {
      flex: 1, padding: "10px 12px", borderRadius: 6, border: "2px solid #ef4444",
      fontSize: 13, minWidth: 200,
    },
    empty: { textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.5)" },
    statusBadge: (status) => ({
      display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      backgroundColor: status === "approved" ? "#d1fae5" : status === "rejected" ? "#fee2e2" : "#fef3c7",
      color: status === "approved" ? "#065f46" : status === "rejected" ? "#991b1b" : "#92400e",
    }),
    divider: { border: "none", borderTop: "1px solid #e5e7eb", margin: "14px 0" },
    totalsRow: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      backgroundColor: "#f0f7ff", borderRadius: 8, padding: "10px 14px",
      border: "1px solid #bfdbfe", marginBottom: 16,
    },
  };

  function EditField({ label, field }) {
    return (
      <div style={styles.lineItem(false)}>
        <div style={styles.lineLabel}>{label}</div>
        <input
          type="number"
          step="0.01"
          min="0"
          value={editForm[field] ?? ""}
          onChange={e => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
          style={styles.input}
        />
      </div>
    );
  }

  function DisplayField({ label, value, color, highlight }) {
    return (
      <div style={styles.lineItem(highlight)}>
        <div style={styles.lineLabel}>{label}</div>
        <div style={styles.lineValue(color)}>{formatCurrency(value)}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>💰 Payroll Approval Queue</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "4px 0 0 0" }}>
            Review AI-extracted payroll data from your CPA's check stubs — approve to add to Expenses.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/payroll-upload")}
            style={{ ...styles.btnEdit, borderColor: "#f97316", color: "#f97316", fontWeight: 700 }}
          >
            📤 Upload Stubs
          </button>
          <button
            onClick={() => navigate("/email-inbox")}
            style={{ ...styles.btnEdit, borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
          >
            📧 Email Inbox
          </button>
          <button
            onClick={() => navigate("/expenses")}
            style={{ ...styles.btnEdit, borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
          >
            💳 View Expenses
          </button>
          <button
            onClick={() => { setShowTaxDeposit(true); loadTaxDepositPeriods(); }}
            style={{ ...styles.btnEdit, borderColor: "#22c55e", color: "#22c55e", fontWeight: 800 }}
          >
            🧾 Create Tax Deposit
          </button>
        </div>
      </div>

      {/* ── Tax Deposit Modal ── */}
      {showTaxDeposit && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
        }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 720, width: "100%",
            maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111" }}>🧾 Create Tax Deposit</h2>
              <button onClick={() => setShowTaxDeposit(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>

            <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>
              <strong>How this works:</strong> Each pay period now creates 2 expense lines: ✅ deductible employer SS+Medicare match, and ❌ non-deductible employee withholdings (fed + employee SS + employee Medicare).
            </div>

            {/* ONE-TIME FIX BUTTON — delete after use */}
            <div style={{ backgroundColor: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#991b1b" }}>
                <strong>🔧 Fix Old Deposits:</strong> Old combined IRS deposits have wrong tax flags. Click to delete them and unlock those periods so you can recreate with the correct split format.
              </div>
              <button
                onClick={fixOldDeposits}
                style={{ padding: "8px 16px", borderRadius: 6, border: "2px solid #dc2626", backgroundColor: "#fff", color: "#dc2626", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}
              >
                🔧 Fix Old Deposits
              </button>
            </div>

            {/* Account selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>🏦 Paid from Account:</label>
              <select
                value={taxDepositAccount}
                onChange={e => setTaxDepositAccount(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6, border: "2px solid #3b82f6", fontSize: 13, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1d4ed8", cursor: "pointer", minWidth: 220 }}
              >
                <option value="">-- Select account --</option>
                {bankAccounts.map(acct => (
                  <option key={acct.id} value={acct.id}>{acct.account_number} — {acct.account_name}</option>
                ))}
              </select>
            </div>

            {/* ── Section 1: IRS Federal Deposits ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "2px solid #fee2e2", paddingBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#dc2626", margin: 0 }}>
                  🏛️ IRS Federal Deposit (Fed + SS×2 + Medicare×2)
                </h3>
                {taxDepositPeriods.length > 0 && (
                  <button
                    onClick={async () => {
                      const allIds = taxDepositPeriods.flatMap(p => p.stub_ids || []);
                      if (allIds.length === 0) return;
                      await supabase
                        .from("payroll_expense_approvals")
                        .update({ irs_deposit_created: true })
                        .in("id", allIds);
                      loadTaxDepositPeriods();
                    }}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #dc2626", backgroundColor: "#fff", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}
                  >
                    🗂️ Archive All
                  </button>
                )}
              </div>
              {taxDepositPeriods.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "#6b7280", backgroundColor: "#f9fafb", borderRadius: 8 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>All IRS deposits created!</div>
                </div>
              ) : (
              taxDepositPeriods.map((period, i) => {
                const periodLabel = period.pay_period_start && period.pay_period_end
                  ? `${formatDate(period.pay_period_start)} – ${formatDate(period.pay_period_end)}`
                  : formatDate(period.pay_period_end || period.pay_date);
                return (
                  <div key={i} style={{ border: "2px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>📅 {periodLabel}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          {period.employees.length} employee{period.employees.length !== 1 ? "s" : ""}: {period.employees.join(", ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#dc2626" }}>{formatCurrency(period.grand_total)}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Total IRS deposit</div>
                      </div>
                    </div>

                    {/* Breakdown table */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14, fontSize: 13 }}>
                      {[
                        ["Federal Income Tax", period.total_fed],
                        ["State Income Tax", period.total_state],
                        ["Employee SS", period.total_ss_employee],
                        ["Employer SS Match", period.employer_ss],
                        ["Employee Medicare", period.total_medicare_employee],
                        ["Employer Medicare Match", period.employer_medicare],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#f9fafb", padding: "6px 10px", borderRadius: 6 }}>
                          <span style={{ color: "#374151" }}>{label}</span>
                          <span style={{ fontWeight: 700, color: "#dc2626" }}>{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      style={{ ...styles.btnApprove, fontSize: 14, padding: "10px 20px", opacity: creatingDeposit ? 0.6 : 1 }}
                      onClick={() => createTaxDeposit(period)}
                      disabled={creatingDeposit || !taxDepositAccount}
                    >
                      {creatingDeposit ? "⏳ Creating…" : `✅ Create ${formatCurrency(period.grand_total)} Tax Deposit`}
                    </button>
                    {!taxDepositAccount && <span style={{ fontSize: 12, color: "#ef4444", marginLeft: 10 }}>Select an account above first</span>}
                  </div>
                );
              })
              )}
            </div>

            {/* ── Section 2: State Tax Deposit ── */}
            <div style={{ borderTop: "2px dashed #d1d5db", paddingTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed", margin: "0 0 12px 0", borderBottom: "2px solid #ede9fe", paddingBottom: 8 }}>
                🏛️ State Income Tax Deposit
              </h3>
              <div style={{ backgroundColor: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#5b21b6" }}>
                This rolls up <strong>all approved state tax withholdings</strong> across every pay period into one expense. Create it whenever you actually make the state tax payment.
              </div>

              {stateTaxTotal <= 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "#6b7280", backgroundColor: "#f9fafb", borderRadius: 8 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>No approved state tax to deposit yet.</div>
                </div>
              ) : (
                <div style={{ border: "2px solid #c4b5fd", borderRadius: 12, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>Total State Tax (All Periods)</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {[...new Set(stateTaxStubs.map(r => r.employee_name || "Unknown"))].join(", ")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed" }}>{formatCurrency(stateTaxTotal)}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Total state withholding</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>📅 Payment Date</label>
                      <input
                        type="date"
                        value={stateTaxDate}
                        onChange={e => setStateTaxDate(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 6, border: "2px solid #7c3aed", fontSize: 13, fontWeight: 600 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>🏦 Paid from Account</label>
                      <select
                        value={stateTaxAccount}
                        onChange={e => setStateTaxAccount(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 6, border: "2px solid #7c3aed", fontSize: 13, fontWeight: 600, backgroundColor: "#f5f3ff", color: "#5b21b6", cursor: "pointer", minWidth: 200 }}
                      >
                        <option value="">-- Select account --</option>
                        {bankAccounts.map(acct => (
                          <option key={acct.id} value={acct.id}>{acct.account_number} — {acct.account_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    style={{ ...styles.btnApprove, backgroundColor: "#7c3aed", fontSize: 14, padding: "10px 20px", opacity: creatingStateDeposit ? 0.6 : 1 }}
                    onClick={createStateTaxDeposit}
                    disabled={creatingStateDeposit || !stateTaxAccount || !stateTaxDate}
                  >
                    {creatingStateDeposit ? "⏳ Creating…" : `✅ Create ${formatCurrency(stateTaxTotal)} State Tax Deposit`}
                  </button>
                </div>
              )}
            </div>

            {/* ── Section 3: Past Deposits Archive ── */}
            <div style={{ borderTop: "2px dashed #d1d5db", paddingTop: 24, marginTop: 24 }}>
              <button
                onClick={() => setShowPastDeposits(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: "#374151" }}>
                  🗂️ Past Tax Deposits ({pastDeposits.length})
                </span>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{showPastDeposits ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showPastDeposits && (
                pastDeposits.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 16, color: "#9ca3af", fontSize: 13 }}>
                    No past deposits found.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pastDeposits.map(dep => (
                      <div key={dep.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: dep.description?.includes("IRS") ? "#dc2626" : "#7c3aed", marginBottom: 2 }}>
                            {dep.description?.includes("IRS") ? "🏛️ IRS" : "🏛️ State"}
                          </div>
                          <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dep.description}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{formatDate(dep.expense_date)}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#059669", whiteSpace: "nowrap" }}>{formatCurrency(dep.amount)}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Message ── */}
      {message.text && (
        <div style={styles.msg(message.type)}>
          {message.text}
          <button onClick={() => setMessage({ type: "", text: "" })} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", float: "right", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={styles.tabs}>
        {[
          { key: "pending", label: "⏳ Pending Approval" },
          { key: "approved", label: "✅ Approved" },
          { key: "rejected", label: "❌ Rejected" },
        ].map(t => (
          <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.5)" }}>
          ⏳ Loading payroll records...
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && records.length === 0 && (
        <div style={styles.empty}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {activeTab === "pending" ? "📭" : activeTab === "approved" ? "✅" : "❌"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {activeTab === "pending"
              ? "No Pending Payroll Stubs"
              : activeTab === "approved"
              ? "No Approved Records Yet"
              : "No Rejected Records"}
          </div>
          {activeTab === "pending" && (
            <>
              <p style={{ fontSize: 14, marginBottom: 20, color: "rgba(255,255,255,0.55)" }}>
                Upload pay stub PDFs from SmartVault — AI will extract wages, taxes, and garnishments and they'll appear here for your approval.
              </p>
              <button
                onClick={() => navigate("/payroll-upload")}
                style={{ ...styles.btnApprove, backgroundColor: BRAND.primary }}
              >
                📤 Upload Pay Stubs
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Record Cards ── */}
      {!loading && records.map(record => {
        const emp = record.employees;
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : (record.employee_name || "Unknown Employee");
        const isEditing = editingId === record.id;
        const isSaving = saving[record.id];
        const totalTaxes = (parseFloat(record.federal_tax) || 0)
          + (parseFloat(record.state_tax) || 0)
          + (parseFloat(record.social_security) || 0)
          + (parseFloat(record.medicare) || 0);

        return (
          <div key={record.id} style={styles.card}>
            {/* Card Header */}
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.empName}>👤 {empName}</h3>
                <div style={styles.metaRow}>
                  {record.pay_date && <span>📅 Pay Date: <strong>{formatDate(record.pay_date)}</strong></span>}
                  {record.pay_period_start && record.pay_period_end && (
                    <span>📆 Period: <strong>{formatDate(record.pay_period_start)} – {formatDate(record.pay_period_end)}</strong></span>
                  )}
                  {record.source_email && <span>📧 From: <strong>{record.source_email}</strong></span>}
                  <span style={styles.statusBadge(record.status)}>{record.status.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {record.check_stubs?.file_path && (
                  <button style={styles.btnView} onClick={() => getStubUrl(record)}>
                    📄 View Stub
                  </button>
                )}
                {activeTab === "pending" && !isEditing && (
                  <button style={styles.btnEdit} onClick={() => startEdit(record)}>
                    ✏️ Edit Values
                  </button>
                )}
              </div>
            </div>

            {/* Totals Summary Bar */}
            <div style={styles.totalsRow}>
              <div style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 700 }}>
                Gross Wages: <span style={{ fontSize: 18 }}>{formatCurrency(record.gross_wages)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 700 }}>
                Total Taxes: <span style={{ fontSize: 18 }}>−{formatCurrency(totalTaxes)}</span>
              </div>
              {parseFloat(record.garnishments) > 0 && (
                <div style={{ fontSize: 13, color: "#d97706", fontWeight: 700 }}>
                  Garnishments: <span style={{ fontSize: 18 }}>−{formatCurrency(record.garnishments)}</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>
                Net Pay: <span style={{ fontSize: 18 }}>{formatCurrency(record.net_pay)}</span>
              </div>
            </div>

            {/* Data Grid */}
            {isEditing ? (
              <>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                  ✏️ Correct any values the AI may have misread, then save.
                </p>
                <div style={styles.grid}>
                  <EditField label="Gross Wages" field="gross_wages" />
                  <EditField label="Federal Tax" field="federal_tax" />
                  <EditField label="State Tax" field="state_tax" />
                  <EditField label="Social Security" field="social_security" />
                  <EditField label="Medicare" field="medicare" />
                  <EditField label="Garnishments" field="garnishments" />
                  <EditField label="Other Deductions" field="other_deductions" />
                  <EditField label="Net Pay" field="net_pay" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Pay Period Start</label>
                    <input type="date" value={editForm.pay_period_start} onChange={e => setEditForm(p => ({ ...p, pay_period_start: e.target.value }))} style={{ ...styles.input, marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Pay Period End</label>
                    <input type="date" value={editForm.pay_period_end} onChange={e => setEditForm(p => ({ ...p, pay_period_end: e.target.value }))} style={{ ...styles.input, marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Pay Date</label>
                    <input type="date" value={editForm.pay_date} onChange={e => setEditForm(p => ({ ...p, pay_date: e.target.value }))} style={{ ...styles.input, marginTop: 4 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={styles.btnSave} onClick={() => saveEdit(record.id)} disabled={isSaving}>
                    {isSaving ? "Saving…" : "💾 Save Changes"}
                  </button>
                  <button style={styles.btnCancel} onClick={() => { setEditingId(null); setEditForm({}); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.grid}>
                <DisplayField label="Gross Wages" value={record.gross_wages} color="#1d4ed8" highlight />
                <DisplayField label="Federal Tax" value={record.federal_tax} color="#dc2626" />
                <DisplayField label="State Tax" value={record.state_tax} color="#dc2626" />
                <DisplayField label="Social Security" value={record.social_security} color="#dc2626" />
                <DisplayField label="Medicare" value={record.medicare} color="#dc2626" />
                {parseFloat(record.garnishments) > 0 && (
                  <DisplayField label="Garnishments" value={record.garnishments} color="#d97706" />
                )}
                {parseFloat(record.other_deductions) > 0 && (
                  <DisplayField label="Other Deductions" value={record.other_deductions} color="#6b7280" />
                )}
                <DisplayField label="Net Pay" value={record.net_pay} color="#059669" highlight />
              </div>
            )}

            {/* Actions — only for pending records */}
            {activeTab === "pending" && !isEditing && (
              <>
                <hr style={styles.divider} />
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                💡 Approving posts: <strong style={{ color: "#111" }}>Gross Wages ({formatCurrency(record.gross_wages)})</strong>
                  {parseFloat(record.garnishments) > 0 && <span>, Garnishment ({formatCurrency(record.garnishments)})</span>}
                  . <span style={{ color: "#d97706" }}>⚠️ Taxes are NOT posted here — use 🧾 Create Tax Deposit to generate the combined IRS payment expense.</span>
                </div>

                {/* Clearing account selector */}
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                    🏦 Clear from Account:
                  </label>
                  <select
                    value={selectedBankAccount[record.id] ?? DEFAULT_CLEARING_ID}
                    onChange={e => setSelectedBankAccount(prev => ({ ...prev, [record.id]: e.target.value }))}
                    style={{
                      padding: "8px 12px", borderRadius: 6, border: "2px solid #3b82f6",
                      fontSize: 13, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1d4ed8",
                      cursor: "pointer", minWidth: 220,
                    }}
                  >
                    <option value="">-- Select account --</option>
                    {bankAccounts.map(acct => (
                      <option key={acct.id} value={acct.id}>
                        {acct.account_number} — {acct.account_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.actionsRow}>
                  <button
                    style={{ ...styles.btnApprove, opacity: isSaving ? 0.6 : 1 }}
                    onClick={() => handleApprove(record)}
                    disabled={isSaving}
                  >
                    {isSaving ? "⏳ Approving..." : "✅ Approve & Add to Expenses"}
                  </button>

                  <input
                    type="text"
                    placeholder="Rejection reason (optional)..."
                    value={rejectNote[record.id] || ""}
                    onChange={e => setRejectNote(prev => ({ ...prev, [record.id]: e.target.value }))}
                    style={styles.rejectInput}
                  />
                  <button
                    style={{ ...styles.btnReject, opacity: isSaving ? 0.6 : 1 }}
                    onClick={() => handleReject(record)}
                    disabled={isSaving}
                  >
                    ❌ Reject
                  </button>
                </div>
              </>
            )}

            {/* Approved / Rejected info */}
            {activeTab !== "pending" && (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
                {record.status === "approved" && record.approved_at && (
                  <span>✅ Approved on {new Date(record.approved_at).toLocaleString()}</span>
                )}
                {record.status === "rejected" && (
                  <span>❌ Rejected{record.rejection_note ? ` — "${record.rejection_note}"` : ""}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

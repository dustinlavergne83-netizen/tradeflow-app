import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDate, toLocalDateString } from "../utils/dateUtils";
import AIAssistant from "../Components/AIAssistant";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalInvoices: 0,
    outstandingAmount: 0,
    paidAmount: 0,
    totalRevenue: 0,
    estimatedProfit: 0,
    activeEmployees: 0,
  });
  const [clockedInEmployees, setClockedInEmployees] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [accountingBasis, setAccountingBasis] = useState('cash'); // 'cash' | 'accrual'
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [periodInvoices, setPeriodInvoices] = useState([]);
  const [periodDeposits, setPeriodDeposits] = useState([]);
  const [periodExpenses, setPeriodExpenses] = useState([]);
  const [weeklySegs, setWeeklySegs] = useState([]);
  const [weeklyEmpList, setWeeklyEmpList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProjects, setActiveProjects] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadActiveProjectsList();
    loadWeeklyGridData();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFinancialChartData(selectedPeriod, accountingBasis);
    }
  }, [user, selectedPeriod, accountingBasis]);

  function formatTime(isoTime) {
    if (!isoTime) return "";
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function calculateSegmentHours(start, end) {
    if (!start) return 0;
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    return (endTime - startTime) / (1000 * 60 * 60);
  }

  async function loadDashboardData() {
    try {
      // Get user's company_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single();

      const companyId = profile?.company_id;
      console.log("Dashboard loading for company_id:", companyId);

      // If no company_id, try loading without filter
      let projectsQuery = supabase
        .from("projects")
        .select("id, status", { count: "exact" })
        .in("status", ["Active", "active", "In Progress", "in progress", "In-Progress", "in-progress"]);
      
      let invoicesQuery = supabase
        .from("invoices")
        .select("total, status, amount_paid, deposit_received, balance_due");
      
      let employeesQuery = supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .or("archived.is.null,archived.eq.false");

      // Add company_id filter if available
      if (companyId) {
        projectsQuery = projectsQuery.eq("company_id", companyId);
        invoicesQuery = invoicesQuery.eq("company_id", companyId);
        employeesQuery = employeesQuery.eq("company_id", companyId);
      }

      // Load stats
      const [projectsData, invoicesData, employeesData] = await Promise.all([
        projectsQuery,
        invoicesQuery,
        employeesQuery,
      ]);

      console.log("Projects data:", projectsData);
      console.log("Projects count:", projectsData.count);
      console.log("Projects array:", projectsData.data);
      if (projectsData.error) {
        console.error("Projects ERROR:", projectsData.error);
      }
      console.log("Invoices data:", invoicesData);
      console.log("Employees data:", employeesData);

      // Calculate invoice stats — use actual payment fields, not just status
      const totalInvoices = invoicesData.data?.length || 0;

      // Outstanding = true remaining balance on each invoice (total minus all payments & deposits)
      const outstandingAmount = invoicesData.data
        ?.reduce((sum, inv) => {
          const totalDeductions = (inv.amount_paid || 0) + (inv.deposit_received || 0);
          return sum + Math.max(0, (inv.total || 0) - totalDeductions);
        }, 0) || 0;

      // Paid = sum of all money actually received (payments + deposits)
      const paidAmount = invoicesData.data
        ?.reduce((sum, inv) => sum + (inv.amount_paid || 0) + (inv.deposit_received || 0), 0) || 0;

      const totalRevenue = invoicesData.data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;

      // Calculate estimated profit from active projects
      // Profit = total_cost - (labor_cost + material_cost)
      const estimatedProfit = projectsData.data?.reduce((sum, proj) => {
        const totalCost = proj.total_cost || 0;
        const laborCost = proj.labor_cost || 0;
        const materialCost = proj.material_cost || 0;
        return sum + (totalCost - laborCost - materialCost);
      }, 0) || 0;

      setStats({
        activeProjects: projectsData.count || 0,
        totalInvoices,
        outstandingAmount,
        paidAmount,
        totalRevenue,
        estimatedProfit,
        activeEmployees: employeesData.count || 0,
      });

      // Load currently clocked in employees
      await loadClockedInEmployees(companyId);

    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveProjectsList() {
    try {
      // Get user's company_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single();

      const companyId = profile?.company_id;

      // Load active projects with all details
      let projectsQuery = supabase
        .from("projects")
        .select("id, name, customer, contractor, address, status, percent_complete, active_worth, budget")
        .in("status", ["Active", "active", "In Progress", "in progress", "In-Progress", "in-progress"])
        .order("name", { ascending: true });

      // Add company_id filter if available
      if (companyId) {
        projectsQuery = projectsQuery.eq("company_id", companyId);
      }

      const { data: projects, error } = await projectsQuery;

      if (error) {
        console.error("Error loading active projects list:", error);
        setActiveProjects([]);
        return;
      }

      setActiveProjects(projects || []);
    } catch (err) {
      console.error("Error loading active projects list:", err);
      setActiveProjects([]);
    }
  }

  async function loadClockedInEmployees(companyId) {
    try {
      // Find shifts where clock_in is set but clock_out is null (currently clocked in)
      let shiftsQuery = supabase
        .from("shifts")
        .select(`
          id,
          user_id,
          clock_in,
          clock_in_latitude,
          clock_in_longitude,
          clock_in_accuracy,
          employees!shifts_user_id_fkey (
            id,
            first_name,
            last_name,
            user_id
          )
        `)
        .is("clock_out", null)
        .order("clock_in", { ascending: false });

      const { data: shifts, error } = await shiftsQuery;

      if (error) {
        console.error("Error loading clocked in employees:", error);
        setClockedInEmployees([]);
        return;
      }

      console.log("Clocked in shifts:", shifts);

      // Transform the data
      const clockedIn = (shifts || []).map(shift => ({
        id: shift.id,
        employeeName: shift.employees 
          ? `${shift.employees.first_name} ${shift.employees.last_name}`
          : 'Unknown Employee',
        clockInTime: shift.clock_in,
        latitude: shift.clock_in_latitude,
        longitude: shift.clock_in_longitude,
        accuracy: shift.clock_in_accuracy,
      }));

      setClockedInEmployees(clockedIn);
    } catch (err) {
      console.error("Error loading clocked in employees:", err);
      setClockedInEmployees([]);
    }
  }

  function openInMaps(latitude, longitude) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
  }

  function getTimeElapsed(clockInTime) {
    const now = new Date();
    const clockIn = new Date(clockInTime);
    const diff = now - clockIn;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  function getPeriodDates(periodLabel) {
    const now = new Date();
    const periods = {
      'This Month': { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now },
      'Last Month': { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0) },
      'Last 3 Months': { start: new Date(now.getFullYear(), now.getMonth() - 3, 1), end: now },
      'Last 6 Months': { start: new Date(now.getFullYear(), now.getMonth() - 6, 1), end: now },
      'This Year': { start: new Date(now.getFullYear(), 0, 1), end: now },
      'Last Year': { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31) }
    };
    return periods[periodLabel] || periods['This Month'];
  }

  async function loadFinancialChartData(periodLabel, basis = 'cash') {
    try {
      // Get company_id first — used to scope invoice and payment queries
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single();
      const companyId = profile?.company_id;

      const period = getPeriodDates(periodLabel);
      const startDate = toLocalDateString(period.start);
      const endDate = toLocalDateString(period.end);

      let income = 0;
      let expenses = 0;
      const expensesByCategory = {};

      if (basis === 'cash') {
        // ══════════════════════════════════════════════
        // CASH BASIS — count income when cash is received
        // ══════════════════════════════════════════════

        // STEP A: Sum invoice_payments records in the period
        // (covers invoices paid using the payment history feature)
        const { data: invoicePayments, error: ipError } = await supabase
          .from("invoice_payments")
          .select("amount, processing_fee, net_amount, payment_date, invoice_id")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate);

        if (ipError) console.error("invoice_payments query error:", ipError);

        (invoicePayments || []).forEach(pmt => {
          const net = pmt.net_amount != null
            ? parseFloat(pmt.net_amount) || 0
            : (parseFloat(pmt.amount) || 0) - (parseFloat(pmt.processing_fee) || 0);
          income += net;
        });

        console.log(`💵 Cash income for ${startDate}→${endDate}: $${income.toFixed(2)} from ${(invoicePayments || []).length} payment records`);

        // Step 2: Cleared bank deposits NOT from invoice payments
        // (e.g. other cash deposits, owner contributions, etc.)
        const { data: clearedDeposits } = await supabase
          .from("bank_transactions")
          .select("id, amount, transaction_date, description, payee")
          .eq("is_cleared", true)
          .gt("amount", 0)
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate);

        // Only include bank deposits if there are no invoice_payments for the period
        // (to avoid double-counting: bank deposit + invoice_payment for same transaction)
        // We include them only if total invoice_payments income is 0 (no invoice payments system)
        // OR we include all of them — the user can decide.
        // For now: include cleared deposits as supplemental income (separate section in modal).
        // We DON'T add them to the income total to avoid double-counting.
        // The income total = invoice_payments only.

        // Step 3: Expense calculation (same for both bases)
        // JE expense lines
        const { data: linesData } = await supabase
          .from("journal_entry_lines")
          .select(`
            debit, credit,
            accounts!inner(account_type, account_name),
            journal_entries!inner(entry_date, is_posted, reference_type, reference_id)
          `)
          .eq("journal_entries.is_posted", true)
          .gte("journal_entries.entry_date", startDate)
          .lte("journal_entries.entry_date", endDate);

        const bankTxIdsInJE = new Set();
        (linesData || []).forEach(line => {
          if (line.journal_entries?.reference_type === 'bank_transaction' && line.journal_entries?.reference_id) {
            bankTxIdsInJE.add(line.journal_entries.reference_id);
          }
          if (line.accounts?.account_type === 'Expense') {
            const expenseAmount = (line.debit || 0) - (line.credit || 0);
            expenses += expenseAmount;
            const cat = line.accounts?.account_name || 'Uncategorized';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expenseAmount;
          }
        });

        // Direct expenses with no JE
        const { data: directExp } = await supabase
          .from("expenses")
          .select("amount, category, vendor, expense_date")
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .is("journal_entry_id", null);

        (directExp || []).forEach(exp => {
          const amt = parseFloat(exp.amount) || 0;
          if (amt <= 0) return;
          expenses += amt;
          const cat = exp.category || exp.vendor || 'Uncategorized';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
        });

        // Cleared bank withdrawals not in JEs
        const { data: clearedBankTx } = await supabase
          .from("bank_transactions")
          .select("id, amount, description, payee, transaction_date")
          .eq("is_cleared", true)
          .lt("amount", 0)
          .is("linked_expense_id", null)
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate);

        (clearedBankTx || []).forEach(tx => {
          if (bankTxIdsInJE.has(tx.id)) return;
          const expAmt = Math.abs(parseFloat(tx.amount) || 0);
          expenses += expAmt;
          const cat = tx.payee || tx.description || 'Bank Transaction';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expAmt;
        });

      } else {
        // ══════════════════════════════════════════════
        // ACCRUAL BASIS — count income when invoice is created
        // ══════════════════════════════════════════════

        // Income = total of invoices created in the period
        const { data: accrualInvoices } = await supabase
          .from("invoices")
          .select("total, invoice_date")
          .gte("invoice_date", startDate)
          .lte("invoice_date", endDate);

        (accrualInvoices || []).forEach(inv => {
          income += parseFloat(inv.total) || 0;
        });

        // Expenses: JE lines + direct expenses + cleared withdrawals
        const { data: linesData } = await supabase
          .from("journal_entry_lines")
          .select(`
            debit, credit,
            accounts!inner(account_type, account_name),
            journal_entries!inner(entry_date, is_posted, reference_type, reference_id)
          `)
          .eq("journal_entries.is_posted", true)
          .gte("journal_entries.entry_date", startDate)
          .lte("journal_entries.entry_date", endDate);

        const bankTxIdsInJE = new Set();
        (linesData || []).forEach(line => {
          if (line.journal_entries?.reference_type === 'bank_transaction' && line.journal_entries?.reference_id) {
            bankTxIdsInJE.add(line.journal_entries.reference_id);
          }
          if (line.accounts?.account_type === 'Expense') {
            const expenseAmount = (line.debit || 0) - (line.credit || 0);
            expenses += expenseAmount;
            const cat = line.accounts?.account_name || 'Uncategorized';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expenseAmount;
          }
        });

        const { data: directExp } = await supabase
          .from("expenses")
          .select("amount, category, vendor, expense_date")
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .is("journal_entry_id", null);

        (directExp || []).forEach(exp => {
          const amt = parseFloat(exp.amount) || 0;
          if (amt <= 0) return;
          expenses += amt;
          const cat = exp.category || exp.vendor || 'Uncategorized';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
        });

        const { data: clearedBankTx } = await supabase
          .from("bank_transactions")
          .select("id, amount, description, payee, transaction_date")
          .eq("is_cleared", true)
          .lt("amount", 0)
          .is("linked_expense_id", null)
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate);

        (clearedBankTx || []).forEach(tx => {
          if (bankTxIdsInJE.has(tx.id)) return;
          const expAmt = Math.abs(parseFloat(tx.amount) || 0);
          expenses += expAmt;
          const cat = tx.payee || tx.description || 'Bank Transaction';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expAmt;
        });
      }

      const profit = income - expenses;

      setFinancialData({
        Income: Math.round(income),
        Expenses: Math.round(expenses),
        Profit: Math.round(profit),
        expensesByCategory: Object.entries(expensesByCategory).map(([name, amount]) => ({
          name,
          amount: Math.round(amount)
        })).sort((a, b) => b.amount - a.amount)
      });

      await loadPeriodInvoices(startDate, endDate, basis, companyId);
    } catch (err) {
      console.error("Error loading financial chart data:", err);
      setFinancialData(null);
    }
  }

  async function loadPeriodInvoices(startDate, endDate, basis = 'cash', companyId = null) {
    try {
      if (basis === 'cash') {
        // ── CASH BASIS: show invoices that received payments in this period ──
        // First get this company's invoice IDs (same scoping as the income calculation)
        let invIdsQuery = supabase.from("invoices").select("id");
        if (companyId) invIdsQuery = invIdsQuery.eq("company_id", companyId);
        const { data: companyInvoicesForModal } = await invIdsQuery;
        const modalInvoiceIds = (companyInvoicesForModal || []).map(inv => String(inv.id));

        // Query invoice_payments scoped to this company's invoices + date range
        let pmtQuery = supabase
          .from("invoice_payments")
          .select("invoice_id, amount, processing_fee, net_amount, payment_date, payment_method")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date", { ascending: false });

        if (modalInvoiceIds.length > 0) {
          pmtQuery = pmtQuery.in("invoice_id", modalInvoiceIds);
        } else {
          pmtQuery = pmtQuery.eq("invoice_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data: pmts, error: pmtsErr } = await pmtQuery;

        if (pmtsErr) console.error("loadPeriodInvoices payments error:", pmtsErr);

        // Build a map: invoice_id → { totalPaid, lastPaymentDate }
        const invoiceMap = {};
        (pmts || []).forEach(pmt => {
          const id = pmt.invoice_id;
          // Use net_amount if available, otherwise amount - processing_fee
          const net = pmt.net_amount != null
            ? parseFloat(pmt.net_amount) || 0
            : (parseFloat(pmt.amount) || 0) - (parseFloat(pmt.processing_fee) || 0);
          if (!invoiceMap[id]) invoiceMap[id] = { totalPaid: 0, lastPaymentDate: pmt.payment_date, payments: [] };
          invoiceMap[id].totalPaid += net;
          invoiceMap[id].payments.push(pmt);
        });

        const invoiceIds = Object.keys(invoiceMap);
        let invoicesData = [];
        if (invoiceIds.length > 0) {
          const { data } = await supabase
            .from("invoices")
            .select("id, project_name, customer_name, invoice_date, total, status")
            .in("id", invoiceIds);
          invoicesData = (data || []).map(inv => ({
            ...inv,
            // Attach the amount actually paid in this period
            paidInPeriod: invoiceMap[inv.id]?.totalPaid || 0,
            lastPaymentDate: invoiceMap[inv.id]?.lastPaymentDate || inv.invoice_date,
          }));
          // Sort by lastPaymentDate desc
          invoicesData.sort((a, b) => (b.lastPaymentDate || '').localeCompare(a.lastPaymentDate || ''));
        }

        // Also fetch cleared deposits for supplemental display (not counted in income total)
        const { data: clearedDeposits } = await supabase
          .from("bank_transactions")
          .select("id, amount, transaction_date, payee, description")
          .eq("is_cleared", true)
          .gt("amount", 0)
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate)
          .order("transaction_date", { ascending: false });

        setPeriodInvoices(invoicesData);
        setPeriodDeposits(clearedDeposits || []);

      } else {
        // ── ACCRUAL BASIS: show invoices created in this period ──
        const { data: invoicesInPeriod } = await supabase
          .from("invoices")
          .select("id, project_name, customer_name, invoice_date, total, status")
          .gte("invoice_date", startDate)
          .lte("invoice_date", endDate)
          .order("invoice_date", { ascending: false });

        setPeriodInvoices(invoicesInPeriod || []);
        setPeriodDeposits([]);
      }
    } catch (err) {
      console.error("Error loading period invoices:", err);
      setPeriodInvoices([]);
      setPeriodDeposits([]);
    }
  }

  function getMonday(date) {
    const d = new Date(date);
    // Get the day of week (0 = Sunday, 1 = Monday, etc.)
    const day = d.getDay();
    // Calculate how many days to subtract to get to Monday
    const diff = day === 0 ? -6 : 1 - day;
    // Create a new date for Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    // Format as YYYY-MM-DD using local date
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
  }

  function getWeekDays(mondayStr) {
    const days = [];
    const [year, month, day] = mondayStr.split('-').map(Number);
    const monday = new Date(year, month - 1, day);
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(year, month - 1, day + i);
      const y = currentDay.getFullYear();
      const m = String(currentDay.getMonth() + 1).padStart(2, '0');
      const d = String(currentDay.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    
    return days;
  }

  // ── Weekly grid helpers ──────────────────────────────────────────────────

  function calcDayHours(segs) {
    const raw = segs.reduce((sum, s) => {
      if (!s.end_at) return sum;
      return sum + (new Date(s.end_at) - new Date(s.start_at)) / 3600000;
    }, 0);
    const hasLunch = segs.some((s) => s.is_lunch);
    const total = Math.max(0, raw - (hasLunch ? 0.5 : 0));
    return Math.round(total * 4) / 4;
  }

  function fmtH(h) {
    if (!h) return "0";
    const r = Math.round(h * 4) / 4;
    const s = r.toFixed(2);
    return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  async function loadWeeklyGridData() {
    try {
      const mondayStr = getMonday(new Date());
      const weekDaysArr = getWeekDays(mondayStr);
      const weekEnd = weekDaysArr[6];
      const [{ data: segs }, { data: emps }] = await Promise.all([
        supabase.from("shift_segments")
          .select("id, user_id, start_at, end_at, is_lunch, project_task")
          .gte("start_at", mondayStr + "T00:00:00")
          .lte("start_at", weekEnd + "T23:59:59")
          .order("start_at", { ascending: true }),
        supabase.from("employees").select("user_id, first_name, last_name").order("first_name"),
      ]);
      setWeeklySegs(segs || []);
      setWeeklyEmpList(emps || []);
    } catch (err) {
      console.error("Error loading weekly grid data:", err);
    }
  }

  // Computed weekly grid values
  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const gridWeekDays = getWeekDays(getMonday(new Date()));
  const todayLocal = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })();

  function getSegsForDay(uid, dateStr) {
    return weeklySegs.filter((s) => {
      const d = new Date(s.start_at);
      const segStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      return s.user_id === uid && segStr === dateStr;
    });
  }

  function getDayProjects(segs) {
    return [...new Set(segs.map((s) => s.project_task).filter(Boolean))];
  }

  const gridActiveUids = [...new Set(weeklySegs.map((s) => s.user_id).filter(Boolean))];
  const gridActiveEmployees = gridActiveUids
    .map((uid) => {
      const emp = weeklyEmpList.find(e => e.user_id === uid);
      return { uid, name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  function getWeekTotalForEmp(uid) {
    return gridWeekDays.reduce((sum, d) => sum + calcDayHours(getSegsForDay(uid, d)), 0);
  }

  const gridGrandTotal = gridActiveEmployees.reduce((sum, e) => sum + getWeekTotalForEmp(e.uid), 0);

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
        {/* AI Assistant - One button to rule them all */}
        <AIAssistant />

        {/* Revenue & Profit Stats */}
        <div style={styles.statsGrid}>
          <StatCard
            icon="💰"
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            subtitle={`${stats.totalInvoices} total invoices`}
            onClick={() => navigate("/invoices")}
          />
          <StatCard
            icon="💵"
            title="Paid Invoices"
            value={`$${stats.paidAmount.toLocaleString()}`}
            subtitle="Collected revenue"
            onClick={() => navigate("/invoices")}
          />
          <StatCard
            icon="📊"
            title="Outstanding"
            value={`$${stats.outstandingAmount.toLocaleString()}`}
            subtitle="Pending payment"
            onClick={() => navigate("/invoices")}
          />
        </div>

        {/* Financial Overview and Active Projects Section */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, marginBottom: 32}}>
          {/* Financial Chart - Profit vs Expenses */}
          {financialData && (
            <div style={{maxWidth: 700, width: '100%'}}>
              <div style={styles.chartSection}>
              <div style={styles.chartHeader}>
                <h3 style={styles.sectionTitle}>📊 Financial Overview</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Cash / Accrual Toggle */}
                  <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 3, border: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => setAccountingBasis('cash')}
                      style={{
                        padding: '7px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: accountingBasis === 'cash' ? '#0b3ea8' : 'transparent',
                        color: accountingBasis === 'cash' ? '#fff' : '#6b7280',
                      }}
                    >
                      💵 Cash
                    </button>
                    <button
                      onClick={() => setAccountingBasis('accrual')}
                      style={{
                        padding: '7px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: accountingBasis === 'accrual' ? '#0b3ea8' : 'transparent',
                        color: accountingBasis === 'accrual' ? '#fff' : '#6b7280',
                      }}
                    >
                      📄 Accrual
                    </button>
                  </div>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    style={styles.periodDropdown}
                  >
                    <option>This Month</option>
                    <option>Last Month</option>
                    <option>Last 3 Months</option>
                    <option>Last 6 Months</option>
                    <option>This Year</option>
                    <option>Last Year</option>
                  </select>
                  <button
                    style={styles.viewReportButton}
                    onClick={() => navigate("/accounting/reports/profit-loss")}
                  >
                    View Full Report →
                  </button>
                </div>
              </div>
              {/* Basis description */}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, marginTop: -8 }}>
                {accountingBasis === 'cash'
                  ? '💵 Cash Basis: Income counted when payments are received (invoice_payments)'
                  : '📄 Accrual Basis: Income counted when invoices are created (invoice_date)'}
              </div>
              
              {/* Summary Cards for the Period */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                <div 
                  style={{...styles.financialCard, cursor: 'pointer', borderLeft: '3px solid #10b981'}}
                  onClick={() => setShowInvoiceModal(true)}
                >
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Income</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                    ${financialData.Income.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>Click to view →</div>
                </div>
                <div 
                  style={{...styles.financialCard, cursor: 'pointer', borderLeft: '3px solid #ef4444'}}
                  onClick={() => setShowExpenseModal(true)}
                >
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
                    ${financialData.Expenses.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Click to view →</div>
                </div>
                <div style={{...styles.financialCard, borderLeft: `3px solid ${financialData.Profit >= 0 ? '#fc6b04' : '#991b1b'}`}}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                    {financialData.Profit >= 0 ? 'Profit' : 'Loss'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: financialData.Profit >= 0 ? '#fc6b04' : '#991b1b' }}>
                    ${Math.abs(financialData.Profit).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {financialData.Income > 0 ? `${((financialData.Profit / financialData.Income) * 100).toFixed(1)}% margin` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Simple Bar Visualization */}
              <div style={{ marginTop: 12 }}>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={[{name: selectedPeriod, ...financialData}]} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '2px solid #e5e7eb',
                        borderRadius: 6,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontSize: 12
                      }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} iconType="square" />
                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} onClick={() => setShowInvoiceModal(true)} cursor="pointer" />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} onClick={() => setShowExpenseModal(true)} cursor="pointer" />
                    <Bar dataKey="Profit" fill="#fc6b04" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Active Projects Card */}
          <div style={{maxWidth: 700, width: '100%'}}>
            <div style={styles.chartSection}>
              <div style={styles.chartHeader}>
                <h3 style={styles.sectionTitle}>📂 Active Projects</h3>
                <button
                  style={styles.viewReportButton}
                  onClick={() => navigate("/projects")}
                >
                  View All Projects →
                </button>
              </div>

              {activeProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  <p style={{ fontSize: 16, marginBottom: 8 }}>No active projects</p>
                  <p style={{ fontSize: 14 }}>Create a new project to get started</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
                  {activeProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#f9fafb',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.name}
                        </div>
                        {(project.customer || project.contractor) && (
                          <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {project.contractor ? `🔨 ${project.contractor}` : `👤 ${project.customer}`}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.primary }}>
                          {project.percent_complete || 0}%
                        </div>
                        {project.active_worth > 0 && (
                          <div style={{ fontSize: 11, color: '#666' }}>
                            ${project.active_worth.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {project.percent_complete > 0 && (
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <div style={{ 
                            width: '100%', 
                            height: 5, 
                            backgroundColor: '#e5e7eb', 
                            borderRadius: 3, 
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              width: `${project.percent_complete}%`, 
                              height: '100%', 
                              backgroundColor: BRAND.primary,
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice / Income Modal */}
        {showInvoiceModal && (
          <div style={styles.modalOverlay} onClick={() => setShowInvoiceModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>💰 Income for {selectedPeriod}</h3>
                <button onClick={() => setShowInvoiceModal(false)} style={styles.closeButton}>✕</button>
              </div>
              <div style={styles.modalContent}>

                {/* Basis badge */}
                <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    backgroundColor: accountingBasis === 'cash' ? '#dbeafe' : '#fef3c7',
                    color: accountingBasis === 'cash' ? '#1e40af' : '#92400e',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700
                  }}>
                    {accountingBasis === 'cash' ? '💵 Cash Basis' : '📄 Accrual Basis'}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {accountingBasis === 'cash'
                      ? 'Showing payments received this period'
                      : 'Showing invoices created this period'}
                  </span>
                </div>

                {/* ── Invoice list ── */}
                {periodInvoices.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                      {accountingBasis === 'cash' ? '💰 Payments Received' : '📄 Invoices Created'}
                    </div>
                    {periodInvoices.map(invoice => (
                      <div key={invoice.id} style={styles.listItem}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{invoice.project_name || 'Invoice'}</div>
                          {invoice.customer_name && (
                            <div style={{ fontSize: 13, color: '#0369a1', marginTop: 2 }}>
                              👤 {invoice.customer_name}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                            {accountingBasis === 'cash'
                              ? `💵 Paid: ${formatDate(invoice.lastPaymentDate)} • Invoice total: $${(invoice.total || 0).toLocaleString()}`
                              : `📅 ${formatDate(invoice.invoice_date)} • ${invoice.status}`
                            }
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#10b981', textAlign: 'right' }}>
                          ${accountingBasis === 'cash'
                            ? (invoice.paidInPeriod || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : (invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
                        </div>
                      </div>
                    ))}
                    {/* Period subtotal */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: 6, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>Invoice Subtotal</span>
                      <span style={{ fontWeight: 800, color: '#166534' }}>
                        ${periodInvoices.reduce((s, inv) => s + (accountingBasis === 'cash' ? (inv.paidInPeriod || 0) : (inv.total || 0)), 0)
                          .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}

                {/* ── Cleared bank deposits (cash mode only, supplemental) ── */}
                {accountingBasis === 'cash' && periodDeposits.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                      🏦 Other Cleared Deposits (reference only)
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                      These deposits appear in your bank but may overlap with invoice payments above.
                    </div>
                    {periodDeposits.map(dep => (
                      <div key={dep.id} style={{ ...styles.listItem, opacity: 0.75 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{dep.payee || dep.description || 'Deposit'}</div>
                          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                            📅 {formatDate(dep.transaction_date)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, color: '#6b7280' }}>
                          ${Number(dep.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {periodInvoices.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                    {accountingBasis === 'cash'
                      ? 'No payments received in this period'
                      : 'No invoices created in this period'}
                  </p>
                )}

                {/* Income total note */}
                {financialData && (
                  <div style={{ marginTop: 20, padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: 13, color: '#1e40af' }}>
                      <strong>Income Total: ${financialData.Income.toLocaleString()}</strong>
                      {accountingBasis === 'cash'
                        ? ' — Sum of all invoice_payments.net_amount where payment_date is in this period.'
                        : ' — Sum of all invoice totals where invoice_date is in this period.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expense Modal */}
        {showExpenseModal && (
          <div style={styles.modalOverlay} onClick={() => setShowExpenseModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>💳 Expense Breakdown for {selectedPeriod}</h3>
                <button onClick={() => setShowExpenseModal(false)} style={styles.closeButton}>✕</button>
              </div>
              <div style={styles.modalContent}>
                {!financialData?.expensesByCategory || financialData.expensesByCategory.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>No expenses in this period</p>
                ) : (
                  <div>
                    {financialData.expensesByCategory.map((expense, idx) => (
                      <div key={idx} style={styles.listItem}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{expense.name}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#ef4444' }}>
                          ${expense.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <div style={{...styles.listItem, borderTop: '2px solid #e5e7eb', marginTop: 16, paddingTop: 16}}>
                      <div style={{ fontWeight: 700 }}>Total Expenses</div>
                      <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 18 }}>
                        ${financialData.Expenses.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clocked In Employees */}
        {clockedInEmployees.length > 0 && (
          <div style={styles.clockedInSection}>
            <h3 style={styles.sectionTitle}>👷 Currently Clocked In</h3>
            <div style={styles.clockedInGrid}>
              {clockedInEmployees.map((emp) => (
                <div key={emp.id} style={styles.clockedInCard}>
                  <div style={styles.clockedInHeader}>
                    <div>
                      <div style={styles.employeeName}>{emp.employeeName}</div>
                      <div style={styles.clockInTime}>
                        🕐 {new Date(emp.clockInTime).toLocaleTimeString()} 
                        <span style={styles.elapsed}> ({getTimeElapsed(emp.clockInTime)})</span>
                      </div>
                    </div>
                    <div style={styles.statusBadge}>
                      <span style={styles.statusDot}>●</span> Active
                    </div>
                  </div>
                  
                  {emp.latitude && emp.longitude ? (
                    <div style={styles.locationInfo}>
                      <div style={styles.locationLabel}>📍 Location</div>
                      <div 
                        style={styles.coordinates}
                        onClick={() => openInMaps(emp.latitude, emp.longitude)}
                      >
                        {emp.latitude.toFixed(6)}, {emp.longitude.toFixed(6)}
                      </div>
                      {emp.accuracy && (
                        <div style={styles.accuracy}>
                          Accuracy: ±{emp.accuracy.toFixed(0)}m
                        </div>
                      )}
                      <button
                        onClick={() => openInMaps(emp.latitude, emp.longitude)}
                        style={styles.mapsButton}
                      >
                        📍 View on Google Maps
                      </button>
                    </div>
                  ) : (
                    <div style={styles.noLocation}>
                      <span style={styles.noLocationIcon}>📍</span>
                      <span>No location data available</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              style={styles.viewAllButton}
              onClick={() => navigate("/employee-locations")}
            >
              View All Location History →
            </button>
          </div>
        )}

        {/* Weekly Timesheet Grid */}
        <div style={styles.weeklyTimeSection}>
          <div style={styles.chartHeader}>
            <h3 style={styles.sectionTitle}>📋 Weekly Timesheet</h3>
            <button style={styles.viewReportButton} onClick={() => navigate("/timeclock")}>
              View Full Timesheet →
            </button>
          </div>
          {weeklySegs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No shift segments this week yet</p>
              <p style={{ fontSize: 14 }}>Hours will appear here once employees start working</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#0b3ea8" }}>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#fff",
                      fontWeight: 700,
                      minWidth: 160,
                    }}>Employee</th>
                    {gridWeekDays.map((d, i) => {
                      const dt = new Date(d + "T12:00:00");
                      const isToday = todayLocal === d;
                      return (
                        <th key={d} style={{ padding: "12px 10px", textAlign: "center", color: "#fff", fontWeight: 700, minWidth: 90, backgroundColor: isToday ? "#1e50c8" : undefined }}>
                          <div>{DAY_SHORT[i]}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
                            {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </th>
                      );
                    })}
                    <th style={{ padding: "12px 14px", textAlign: "center", color: "#fc6b04", fontWeight: 800, minWidth: 80 }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {gridActiveEmployees.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                        No time entries for this week.
                      </td>
                    </tr>
                  )}
                  {gridActiveEmployees.map((emp, empIdx) => {
                    const weekTotal = getWeekTotalForEmp(emp.uid);
                    return (
                      <tr key={emp.uid} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: empIdx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#111" }}>{emp.name}</td>
                        {gridWeekDays.map((d) => {
                          const daySeg = getSegsForDay(emp.uid, d);
                          const hours = calcDayHours(daySeg);
                          const projects = getDayProjects(daySeg);
                          const hasLunch = daySeg.some((s) => s.is_lunch);
                          const hasOpen = daySeg.some((s) => !s.end_at);
                          const isToday = todayLocal === d;
                          return (
                            <td key={d} style={{ padding: "10px 8px", textAlign: "center", backgroundColor: isToday ? "#eff6ff" : undefined }}>
                              {daySeg.length === 0 ? (
                                <span style={{ color: "#d1d5db", fontSize: 18 }}>+</span>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 700, color: hasOpen ? "#f59e0b" : "#111", fontSize: 14 }}>
                                    {hasOpen ? "In…" : `${fmtH(hours)}h`}
                                    {hasLunch && <span style={{ fontSize: 10, marginLeft: 3 }} title="Lunch taken">🍽</span>}
                                  </div>
                                  {projects.slice(0, 2).map((p, pi) => (
                                    <div key={pi} style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 88 }} title={p}>
                                      {p}
                                    </div>
                                  ))}
                                  {projects.length > 2 && (
                                    <div style={{ fontSize: 10, color: "#9ca3af" }}>+{projects.length - 2} more</div>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, fontSize: 15, color: weekTotal > 0 ? "#0b3ea8" : "#d1d5db" }}>
                          {weekTotal > 0 ? `${fmtH(weekTotal)}h` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {gridActiveEmployees.length > 0 && (
                    <tr style={{ borderTop: "3px solid #0b3ea8", backgroundColor: "#f0f4ff" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "#111", fontSize: 13, textTransform: "uppercase" }}>Week Total</td>
                      {gridWeekDays.map((d) => {
                        const dayTotal = gridActiveEmployees.reduce((sum, emp) => sum + calcDayHours(getSegsForDay(emp.uid, d)), 0);
                        return (
                          <td key={d} style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: dayTotal > 0 ? "#111" : "#d1d5db" }}>
                            {dayTotal > 0 ? `${fmtH(dayTotal)}h` : "—"}
                          </td>
                        );
                      })}
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 900, fontSize: 16, color: "#fc6b04" }}>
                        {fmtH(gridGrandTotal)}h
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function StatCard({ icon, title, value, subtitle, onClick }) {
  return (
    <div
      style={{
        ...styles.statCard,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statContent}>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statTitle}>{title}</div>
        <div style={styles.statSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
}

function Action({ label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.button,
        ...(primary ? styles.primaryButton : {}),
      }}
    >
      {label}
    </button>
  );
}

/* ---------- Styles ---------- */

const styles = {
  pageWrapper: {
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  container: {
    padding: "24px",
    paddingTop: "100px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  statIcon: {
    fontSize: 48,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#111",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
  },
  clockedInSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  clockedInGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  clockedInCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 18,
    border: "2px solid #16a34a",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  clockedInHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  employeeName: {
    fontSize: 17,
    fontWeight: 700,
    color: "#111",
    marginBottom: 4,
  },
  clockInTime: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 500,
  },
  elapsed: {
    color: "#16a34a",
    fontWeight: 600,
  },
  statusBadge: {
    backgroundColor: "#16a34a",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    fontSize: 8,
    animation: "pulse 2s infinite",
  },
  locationInfo: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  },
  coordinates: {
    fontSize: 12,
    color: "#2563eb",
    fontFamily: "monospace",
    marginBottom: 4,
    cursor: "pointer",
    textDecoration: "underline",
    transition: "all 0.2s",
    userSelect: "none",
  },
  accuracy: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 10,
  },
  mapsButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  noLocation: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 13,
    fontStyle: "italic",
  },
  noLocationIcon: {
    marginRight: 6,
    opacity: 0.5,
  },
  viewAllButton: {
    width: "100%",
    padding: 12,
    backgroundColor: "transparent",
    border: `2px solid ${BRAND.primary}`,
    borderRadius: 8,
    color: BRAND.primary,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  button: {
    padding: "14px 20px",
    fontSize: 15,
    borderRadius: 8,
    border: "2px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.2s",
  },
  primaryButton: {
    background: BRAND.primary,
    border: "none",
    color: "#fff",
  },
  adminSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 16,
  },
  chartSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    marginBottom: 32,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
  },
  viewReportButton: {
    padding: "10px 20px",
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  periodDropdown: {
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    outline: "none",
  },
  financialCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    transition: "all 0.2s",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 700,
    width: "100%",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    padding: 24,
    borderBottom: "2px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContent: {
    padding: 24,
    overflowY: "auto",
    flex: 1,
    color: "#111",
  },
  closeButton: {
    padding: "8px 12px",
    fontSize: 20,
    fontWeight: 700,
    color: "#666",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottom: "1px solid #e5e7eb",
    color: "#111",
  },
  weeklyTimeSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    marginBottom: 32,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  weeklyTimeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 20,
  },
  weeklyTimeCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 20,
    border: "2px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  weeklyTimeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "2px solid #e5e7eb",
  },
  totalHours: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND.primary,
  },
  projectsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  projectItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#fff",
    borderRadius: 6,
    fontSize: 13,
  },
  projectName: {
    color: "#374151",
    fontWeight: 500,
  },
  projectHours: {
    color: "#6b7280",
    fontWeight: 600,
  },
  weeklyTable: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
  },
  tableHeader: {
    padding: "16px",
    textAlign: "left",
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 700,
    fontSize: 14,
    color: "#374151",
  },
  tableDayHeader: {
    padding: "16px",
    textAlign: "center",
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 700,
    fontSize: 14,
    color: "#374151",
  },
  tableTotalHeader: {
    padding: "16px",
    textAlign: "center",
    backgroundColor: "#fef3c7",
    borderBottom: "2px solid #fbbf24",
    fontWeight: 700,
    fontSize: 14,
    color: "#92400e",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.2s",
  },
  tableEmployeeCell: {
    padding: "16px",
    fontWeight: 600,
    fontSize: 15,
    color: "#111",
  },
  tableDayCell: {
    padding: "16px",
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
  },
  tableTotalCell: {
    padding: "16px",
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
    color: BRAND.primary,
    backgroundColor: "#fef3c7",
  },
};

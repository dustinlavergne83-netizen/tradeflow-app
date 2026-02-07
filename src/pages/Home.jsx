 
 import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [periodInvoices, setPeriodInvoices] = useState([]);
  const [periodExpenses, setPeriodExpenses] = useState([]);
  const [weeklyTimeData, setWeeklyTimeData] = useState([]);
  const [detailedBreakdown, setDetailedBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProjects, setActiveProjects] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadActiveProjectsList();
    loadWeeklyTimeData();
    loadDetailedBreakdown();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFinancialChartData(selectedPeriod);
    }
  }, [user, selectedPeriod]);

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
        .select("total, status");
      
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

      // Calculate invoice stats
      const totalInvoices = invoicesData.data?.length || 0;
      const outstandingAmount = invoicesData.data
        ?.filter(inv => inv.status !== 'paid')
        ?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const paidAmount = invoicesData.data
        ?.filter(inv => inv.status === 'paid')
        ?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
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

  async function loadFinancialChartData(periodLabel) {
    try {
      const period = getPeriodDates(periodLabel);
      const startDate = period.start.toISOString().split('T')[0];
      const endDate = period.end.toISOString().split('T')[0];

      // Load journal entry lines for income and expense accounts
      const { data: linesData } = await supabase
        .from("journal_entry_lines")
        .select(`
          debit,
          credit,
          account_id,
          accounts!inner(account_type, account_name),
          journal_entries!inner(entry_date, is_posted)
        `)
        .eq("journal_entries.is_posted", true)
        .gte("journal_entries.entry_date", startDate)
        .lte("journal_entries.entry_date", endDate);

      let income = 0;
      let expenses = 0;
      const expensesByCategory = {};

      (linesData || []).forEach(line => {
        const accountType = line.accounts?.account_type;
        if (accountType === 'Income') {
          income += (line.credit || 0) - (line.debit || 0);
        } else if (accountType === 'Expense') {
          const expenseAmount = (line.debit || 0) - (line.credit || 0);
          expenses += expenseAmount;
          const categoryName = line.accounts?.account_name || 'Uncategorized';
          expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + expenseAmount;
        }
      });

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

      // Also load invoices for the period
      await loadPeriodInvoices(startDate, endDate);
    } catch (err) {
      console.error("Error loading financial chart data:", err);
      setFinancialData(null);
    }
  }

  async function loadPeriodInvoices(startDate, endDate) {
    try {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)
        .order("invoice_date", { ascending: false });
      
      setPeriodInvoices(data || []);
    } catch (err) {
      console.error("Error loading period invoices:", err);
      setPeriodInvoices([]);
    }
  }

  async function loadWeeklyTimeData() {
    try {
      // Get start of current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days, otherwise go back to Monday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      console.log("Loading weekly data from Monday:", startOfWeek.toISOString());

      // Load all shifts for the current week - try without the foreign key constraint first
      const { data: shifts, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .gte("clock_in", startOfWeek.toISOString())
        .order("clock_in", { ascending: false });

      if (shiftsError) {
        console.error("Error loading shifts:", shiftsError);
        setWeeklyTimeData([]);
        return;
      }

      console.log("Found shifts:", shifts);

      // Load employee names separately
      const userIds = [...new Set((shifts || []).map(s => s.user_id).filter(Boolean))];
      const { data: employees } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      console.log("Found employees:", employees);

      // Load project names separately
      const projectIds = [...new Set((shifts || []).map(s => s.project_id).filter(Boolean))];
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      // Create lookup maps
      const employeeMap = {};
      (employees || []).forEach(emp => {
        employeeMap[emp.user_id] = `${emp.first_name} ${emp.last_name}`;
      });

      const projectMap = {};
      (projects || []).forEach(proj => {
        projectMap[proj.id] = proj.name;
      });

      // Group by employee and day of week
      const weeklyMap = {};
      (shifts || []).forEach(shift => {
        const employeeName = employeeMap[shift.user_id] || 'Unknown Employee';
        
        if (!weeklyMap[employeeName]) {
          weeklyMap[employeeName] = {
            name: employeeName,
            days: { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 },
            total: 0
          };
        }

        // Only calculate hours for COMPLETED shifts (with both clock_in and clock_out)
        if (shift.clock_in && shift.clock_out) {
          const clockIn = new Date(shift.clock_in);
          const clockOut = new Date(shift.clock_out);
          const hours = (clockOut - clockIn) / (1000 * 60 * 60);
          
          // Get day of week (0 = Sunday, 1 = Monday, etc.)
          const dayOfWeek = clockIn.getDay();
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = dayNames[dayOfWeek];
          
          weeklyMap[employeeName].days[dayName] += hours;
          weeklyMap[employeeName].total += hours;
        }
      });

      // Convert to array and sort by total hours
      const weeklyData = Object.values(weeklyMap)
        .sort((a, b) => b.total - a.total);

      console.log("Weekly data processed:", weeklyData);
      setWeeklyTimeData(weeklyData);
    } catch (err) {
      console.error("Error loading weekly time data:", err);
      setWeeklyTimeData([]);
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

  async function loadDetailedBreakdown() {
    try {
      const weekStart = getMonday(new Date());
      const weekDays = getWeekDays(weekStart);
      const weekEnd = weekDays[6];

      // Get all shift segments for this week
      const { data: segments, error: segError } = await supabase
        .from("shift_segments")
        .select("*")
        .gte("start_at", weekStart + 'T00:00:00')
        .lte("start_at", weekEnd + 'T23:59:59')
        .order("start_at", { ascending: true });

      if (segError) throw segError;

      // Get unique user_ids from segments (only employees who worked)
      const uniqueUserIds = [...new Set((segments || []).map(s => s.user_id).filter(Boolean))];
      
      if (uniqueUserIds.length === 0) {
        setDetailedBreakdown({ rows: [], employees: [] });
        return;
      }

      // Get employee details only for those who have segments
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, preferred_name")
        .in("user_id", uniqueUserIds)
        .order("last_name", { ascending: true});

      if (empError) throw empError;

      // Build rows: each day, then projects under that day
      const breakdownRows = [];

      for (const day of weekDays) {
        const daySegments = segments.filter(seg => {
          const segDate = seg.start_at.split('T')[0];
          return segDate === day && !seg.is_lunch; // Only work segments, not lunch
        });

        if (daySegments.length === 0) continue;

        // Get unique projects for this day
        const projects = [...new Set(daySegments.map(s => s.project_task || 'No Project'))];

        // Add day row
        const dayRow = {
          type: 'day',
          day: day,
          dayLabel: new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' }),
        };
        breakdownRows.push(dayRow);

        // Add project rows for this day
        projects.forEach(project => {
          const projectRow = {
            type: 'project',
            day: day,
            project: project,
            employees: {}
          };

          // For each employee, find their segments for this project
          employees.forEach(emp => {
            const displayName = emp.preferred_name || emp.first_name;
            const empKey = `${displayName} ${emp.last_name}`;

            const empSegments = daySegments.filter(s => 
              s.user_id === emp.user_id && 
              (s.project_task || 'No Project') === project
            );

            if (empSegments.length > 0) {
              // Get first segment for start time
              const firstSeg = empSegments[0];
              const lastSeg = empSegments[empSegments.length - 1];
              
              // Calculate total hours for this project
              const totalHours = empSegments.reduce((sum, seg) => 
                sum + calculateSegmentHours(seg.start_at, seg.end_at), 0
              );

              // Check if they took lunch (look for lunch segment between work segments)
              const allDaySegs = segments.filter(s => 
                s.user_id === emp.user_id && 
                s.start_at.split('T')[0] === day
              );
              const hasLunch = allDaySegs.some(s => s.is_lunch);

              projectRow.employees[empKey] = {
                startTime: formatTime(firstSeg.start_at),
                endTime: lastSeg.end_at ? formatTime(lastSeg.end_at) : 'In Progress',
                hours: totalHours,
                hasLunch: hasLunch
              };
            } else {
              projectRow.employees[empKey] = null;
            }
          });

          // Calculate row total
          projectRow.total = Object.values(projectRow.employees)
            .filter(e => e !== null)
            .reduce((sum, e) => sum + e.hours, 0);

          breakdownRows.push(projectRow);
        });
      }

      setDetailedBreakdown({
        rows: breakdownRows,
        employees: employees.map(emp => {
          const displayName = emp.preferred_name || emp.first_name;
          return `${displayName} ${emp.last_name}`;
        })
      });
    } catch (err) {
      console.error("Error loading detailed breakdown:", err);
      setDetailedBreakdown({ rows: [], employees: [] });
    }
  }

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{
                        padding: 16,
                        backgroundColor: '#f9fafb',
                        borderRadius: 10,
                        border: '2px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                        e.currentTarget.style.border = '2px solid #3b82f6';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.border = '2px solid #e5e7eb';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                            {project.name}
                          </div>
                          {(project.customer || project.contractor) && (
                            <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>
                              {project.contractor ? `🔨 ${project.contractor}` : `👤 ${project.customer}`}
                            </div>
                          )}
                          {project.address && (
                            <div style={{ fontSize: 12, color: '#999' }}>
                              📍 {project.address}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.primary }}>
                            {project.percent_complete || 0}% Complete
                          </div>
                          {project.active_worth > 0 && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                              ${project.active_worth.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {project.percent_complete > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ 
                            width: '100%', 
                            height: 6, 
                            backgroundColor: '#e5e7eb', 
                            borderRadius: 3, 
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              width: `${project.percent_complete}%`, 
                              height: '100%', 
                              backgroundColor: BRAND.primary,
                              transition: 'width 0.3s ease'
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

        {/* Invoice Modal */}
        {showInvoiceModal && (
          <div style={styles.modalOverlay} onClick={() => setShowInvoiceModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>💰 Invoices for {selectedPeriod}</h3>
                <button onClick={() => setShowInvoiceModal(false)} style={styles.closeButton}>✕</button>
              </div>
              <div style={styles.modalContent}>
                {periodInvoices.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>No invoices in this period</p>
                ) : (
                  <div>
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
                            📅 {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()} • {invoice.status}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#10b981' }}>
                          ${invoice.total?.toLocaleString() || '0'}
                        </div>
                      </div>
                    ))}
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

        {/* Weekly Breakdown - Detailed Segment Breakdown */}
        {detailedBreakdown && detailedBreakdown.rows && detailedBreakdown.rows.length > 0 ? (
          <div style={styles.weeklyTimeSection}>
            <div style={styles.chartHeader}>
              <h3 style={styles.sectionTitle}>📋 Weekly Breakdown</h3>
              <button
                style={styles.viewReportButton}
                onClick={() => navigate("/timeclock")}
              >
                View Full Timesheet →
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', margin: "0 0 20px 0" }}>
              All shift segments by day - Projects and lunch breaks
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      borderBottom: "2px solid #e5e7eb",
                      fontWeight: 700,
                      fontSize: 13,
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#f3f4f6",
                      zIndex: 10,
                      color: "#111",
                      width: 200,
                      maxWidth: 400,
                    }}>
                      Project
                    </th>
                    {detailedBreakdown.employees.map((empName, idx) => (
                      <React.Fragment key={idx}>
                        <th colSpan={4} style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          borderLeft: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "#111",
                          backgroundColor: "#f3f4f6",
                        }}>
                          {empName}
                        </th>
                      </React.Fragment>
                    ))}
                    <th style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      borderBottom: "2px solid #e5e7eb",
                      borderLeft: "2px solid #e5e7eb",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#111",
                      backgroundColor: "#fef3c7",
                    }}>
                      Total
                    </th>
                  </tr>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{
                      padding: "6px 12px",
                      borderBottom: "2px solid #e5e7eb",
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#f9fafb",
                      zIndex: 10,
                    }}></th>
                    {detailedBreakdown.employees.map((empName, idx) => (
                      <React.Fragment key={idx}>
                        <th style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          borderLeft: idx === 0 ? "2px solid #e5e7eb" : "1px solid #e5e7eb",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          width: 70,
                        }}>Start</th>
                        <th style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          borderLeft: "1px solid #e5e7eb",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          width: 40,
                        }}>Lunch</th>
                        <th style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          borderLeft: "1px solid #e5e7eb",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          width: 70,
                        }}>End</th>
                        <th style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          borderLeft: "1px solid #e5e7eb",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          width: 50,
                        }}>Hours</th>
                      </React.Fragment>
                    ))}
                    <th style={{
                      padding: "6px 8px",
                      textAlign: "center",
                      borderBottom: "2px solid #e5e7eb",
                      borderLeft: "2px solid #e5e7eb",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#111",
                      backgroundColor: "#fef3c7",
                    }}></th>
                  </tr>
                </thead>
                <tbody>
                  {detailedBreakdown.rows.map((row, rowIdx) => {
                    if (row.type === 'day') {
                      return (
                        <tr key={rowIdx} style={{ backgroundColor: "#e0f2fe" }}>
                          <td colSpan={1 + (detailedBreakdown.employees.length * 4) + 1} style={{
                            padding: "10px 12px",
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#0369a1",
                            borderTop: "3px solid #0284c7",
                            borderBottom: "1px solid #0284c7",
                          }}>
                            {row.dayLabel}
                          </td>
                        </tr>
                      );
                    }

                    // Project row
                    return (
                      <tr key={rowIdx} style={{ backgroundColor: "#fff" }}>
                        <td style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid #e5e7eb",
                          fontWeight: 600,
                          fontSize: 13,
                          color: "#111",
                          position: "sticky",
                          left: 0,
                          backgroundColor: "#fff",
                          zIndex: 5,
                          paddingLeft: 24,
                        }}>
                          {row.project}
                        </td>
                        {detailedBreakdown.employees.map((empName, empIdx) => {
                          const empData = row.employees[empName];
                          
                          return (
                            <React.Fragment key={empIdx}>
                              <td style={{
                                padding: "8px 8px",
                                textAlign: "center",
                                borderBottom: "1px solid #e5e7eb",
                                borderLeft: "2px solid #3b82f6",
                                fontSize: 12,
                                color: "#111",
                              }}>
                                {empData ? empData.startTime : ""}
                              </td>
                              <td style={{
                                padding: "8px 8px",
                                textAlign: "center",
                                borderBottom: "1px solid #e5e7eb",
                                borderLeft: "1px solid #e5e7eb",
                                fontSize: 16,
                                color: empData?.hasLunch ? "#10b981" : "#d1d5db",
                              }}>
                                {empData?.hasLunch ? "✓" : ""}
                              </td>
                              <td style={{
                                padding: "8px 8px",
                                textAlign: "center",
                                borderBottom: "1px solid #e5e7eb",
                                borderLeft: "1px solid #e5e7eb",
                                fontSize: 12,
                                color: "#111",
                              }}>
                                {empData ? empData.endTime : ""}
                              </td>
                              <td style={{
                                padding: "8px 8px",
                                textAlign: "center",
                                borderBottom: "1px solid #e5e7eb",
                                borderLeft: "1px solid #e5e7eb",
                                borderRight: "2px solid #3b82f6",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#111",
                              }}>
                                {empData ? empData.hours.toFixed(1) : ""}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td style={{
                          padding: "8px 8px",
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          borderLeft: "2px solid #e5e7eb",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111",
                          backgroundColor: "#fef3c7",
                        }}>
                          {row.total ? row.total.toFixed(1) : ""}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Weekly Totals Row */}
                  <tr style={{ backgroundColor: "#f0f9ff", borderTop: "3px solid #3b82f6" }}>
                    <td style={{
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111",
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#f0f9ff",
                      zIndex: 5,
                      borderTop: "3px solid #3b82f6",
                    }}>
                      WEEKLY TOTALS
                    </td>
                    {detailedBreakdown.employees.map((empName, empIdx) => {
                      // Calculate total hours for this employee across all projects
                      const totalHours = detailedBreakdown.rows
                        .filter(r => r.type === 'project')
                        .reduce((sum, row) => {
                          const empData = row.employees[empName];
                          return sum + (empData?.hours || 0);
                        }, 0);
                      
                      return (
                        <React.Fragment key={empIdx}>
                          <td colSpan={4} style={{
                            padding: "12px",
                            textAlign: "center",
                            borderLeft: "2px solid #3b82f6",
                            borderRight: "2px solid #3b82f6",
                            borderTop: "3px solid #3b82f6",
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#0369a1",
                            backgroundColor: "#f0f9ff",
                          }}>
                            {totalHours.toFixed(1)} hrs
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{
                      padding: "12px",
                      textAlign: "center",
                      borderLeft: "2px solid #e5e7eb",
                      borderTop: "3px solid #3b82f6",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111",
                      backgroundColor: "#fef3c7",
                    }}>
                      {detailedBreakdown.rows
                        .filter(r => r.type === 'project')
                        .reduce((sum, row) => sum + (row.total || 0), 0)
                        .toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={styles.weeklyTimeSection}>
            <div style={styles.chartHeader}>
              <h3 style={styles.sectionTitle}>📋 Weekly Breakdown</h3>
              <button
                style={styles.viewReportButton}
                onClick={() => navigate("/timeclock")}
              >
                View Full Timesheet →
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No shift segments this week yet</p>
              <p style={{ fontSize: 14 }}>Detailed breakdown will appear here once employees start working</p>
            </div>
          </div>
        )}
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import DesktopHeader from "../../Components/DesktopHeader";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import logo from '../../assets/LOGOD.jpg';

import { formatDate } from "../../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function WeeklyTimesheet() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [timesheetData, setTimesheetData] = useState([]);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [approving, setApproving] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());

  // Round hours to nearest quarter hour (0.25)
  function roundToQuarterHour(hours) {
    return Math.round(hours * 4) / 4;
  }

  // Get Monday of the week for a given date
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

  // Get all 7 days of the week
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

  // Format date for display (Mon 1/6)
  function formatDayHeader(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    return `${dayName}\n${monthDay}`;
  }

  function formatDateRange(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  useEffect(() => {
    loadWeeklyTimesheet();
    loadApprovalStatus();
  }, [selectedWeek]);

  async function loadApprovalStatus() {
    try {
      const weekDays = getWeekDays(selectedWeek);
      const { data, error } = await supabase
        .from('timesheet_approvals')
        .select('*')
        .eq('week_start', weekDays[0])
        .eq('week_end', weekDays[6])
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setApprovalStatus(data);
    } catch (err) {
      console.error('Error loading approval status:', err);
    }
  }

  async function approveTimesheet() {
    try {
      setApproving(true);
      const weekDays = getWeekDays(selectedWeek);
      const { data: { user } } = await supabase.auth.getUser();

      // Upsert approval record
      const { error: upsertError } = await supabase
        .from('timesheet_approvals')
        .upsert({
          week_start: weekDays[0],
          week_end: weekDays[6],
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        }, {
          onConflict: 'week_start,week_end'
        });

      if (upsertError) throw upsertError;

      // Send approved timesheet to all recipients
      await sendApprovedTimesheet();

      alert('✅ Timesheet approved and sent to all recipients!');
      await loadApprovalStatus();
    } catch (err) {
      console.error('Error approving timesheet:', err);
      alert('Failed to approve timesheet: ' + err.message);
    } finally {
      setApproving(false);
    }
  }

  async function sendApprovedTimesheet() {
    try {
      // Get recipients
      const { data: recipients, error: recipientsError } = await supabase
        .from('timesheet_approval_recipients')
        .select('email')
        .eq('is_active', true);

      if (recipientsError) throw recipientsError;

      if (!recipients || recipients.length === 0) {
        console.log('No recipients configured');
        return;
      }

      // Send email to each recipient
      const weekDays = getWeekDays(selectedWeek);
      
      for (const recipient of recipients) {
        await supabase.functions.invoke('send-timesheet', {
          body: {
            to: recipient.email,
            weekStart: weekDays[0],
            weekEnd: weekDays[6],
            timesheetData: timesheetData,
            dayTotals: dayTotals,
            grandTotal: grandTotal,
            companyName: "DML Electrical Service, LLC"
          }
        });
      }
    } catch (err) {
      console.error('Error sending approved timesheet:', err);
      throw err;
    }
  }

  async function loadWeeklyTimesheet() {
    try {
      setLoading(true);
      
      const weekDays = getWeekDays(selectedWeek);
      const weekStart = weekDays[0];
      const weekEnd = weekDays[6];

      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true });

      if (empError) throw empError;

      // Get all shift segments for this week
      const { data: segments, error: segError } = await supabase
        .from("shift_segments")
        .select("*")
        .gte("start_at", weekStart + 'T00:00:00')
        .lte("start_at", weekEnd + 'T23:59:59');

      if (segError) throw segError;

      // Build timesheet data
      const timesheetRows = [];

      for (const emp of employees || []) {
        const row = {
          employeeId: emp.id,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          days: {},
          weekTotal: 0,
        };

        // Initialize all days to 0
        weekDays.forEach(day => {
          row.days[day] = 0;
        });

        // Calculate hours for each day using shift segments
        const empSegments = (segments || []).filter(s => s.user_id === emp.user_id);

        // Collect raw hours per day
        const rawDayHours = {};
        weekDays.forEach(day => { rawDayHours[day] = 0; });

        for (const segment of empSegments) {
          const segmentDate = segment.start_at.split('T')[0];
          
          if (weekDays.includes(segmentDate)) {
            if (segment.end_at) {
              const start = new Date(segment.start_at);
              const end = new Date(segment.end_at);
              const diffMs = end - start;
              rawDayHours[segmentDate] += diffMs / (1000 * 60 * 60);
            }
          }
        }

        // Apply lunch deduction: if any segment for that day has is_lunch=true, deduct 0.5h
        weekDays.forEach(day => {
          const hasLunch = empSegments.some(s => s.is_lunch && s.start_at.split('T')[0] === day);
          row.days[day] = Math.max(0, rawDayHours[day] - (hasLunch ? 0.5 : 0));
        });

        // Round each day's hours to nearest quarter hour and calculate week total
        weekDays.forEach(day => {
          if (row.days[day] > 0) {
            row.days[day] = roundToQuarterHour(row.days[day]);
          }
          row.weekTotal += row.days[day];
        });

        timesheetRows.push(row);
      }

      setTimesheetData(timesheetRows);
    } catch (err) {
      console.error("Error loading weekly timesheet:", err);
      alert("Failed to load timesheet: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function goToPreviousWeek() {
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const monday = new Date(year, month - 1, day);
    monday.setDate(monday.getDate() - 7);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    setSelectedWeek(`${y}-${m}-${d}`);
  }

  function goToNextWeek() {
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const monday = new Date(year, month - 1, day);
    monday.setDate(monday.getDate() + 7);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    setSelectedWeek(`${y}-${m}-${d}`);
  }

  function goToCurrentWeek() {
    setSelectedWeek(getMonday(new Date()));
  }

  function exportToExcel() {
    const weekDays = getWeekDays(selectedWeek);
    
    // Build data array for Excel
    const data = [];
    
    // Header row
    const headers = ["Employee", ...weekDays.map(d => formatDayHeader(d).replace('\n', ' ')), "Week Total"];
    data.push(headers);
    
    // Employee rows
    timesheetData.forEach(row => {
      const rowData = [
        row.employeeName,
        ...weekDays.map(day => row.days[day] > 0 ? row.days[day].toFixed(2) : 0),
        row.weekTotal.toFixed(2)
      ];
      data.push(rowData);
    });
    
    // Totals row
    const dayTotals = weekDays.map(day => {
      const total = timesheetData.reduce((sum, row) => sum + row.days[day], 0);
      return total.toFixed(2);
    });
    const grandTotal = timesheetData.reduce((sum, row) => sum + row.weekTotal, 0);
    data.push(["TOTALS", ...dayTotals, grandTotal.toFixed(2)]);
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Auto-size columns
    const colWidths = [];
    data[0].forEach((header, i) => {
      let maxWidth = header.length;
      data.forEach(row => {
        if (row[i]) {
          const cellWidth = String(row[i]).length;
          if (cellWidth > maxWidth) {
            maxWidth = cellWidth;
          }
        }
      });
      colWidths.push({ wch: maxWidth + 2 }); // Add padding
    });
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Weekly Timesheet");
    
    // Download
    XLSX.writeFile(wb, `Weekly_Timesheet_${selectedWeek}.xlsx`);
  }

  async function sendEmail() {
    if (!emailAddress.trim()) {
      alert('Please enter an email address');
      return;
    }

    if (selectedEmployeeIds.size === 0) {
      alert('Please select at least one employee to include.');
      return;
    }

    try {
      setSending(true);

      const weekDays = getWeekDays(selectedWeek);

      // Filter to only selected employees and recalculate totals
      const filteredData = timesheetData.filter(r => selectedEmployeeIds.has(r.employeeId));
      const filteredDayTotals = weekDays.map(day =>
        filteredData.reduce((sum, row) => sum + (row.days[day] || 0), 0)
      );
      const filteredGrandTotal = filteredData.reduce((sum, row) => sum + row.weekTotal, 0);
      
      const response = await supabase.functions.invoke('send-timesheet', {
        body: {
          to: emailAddress.trim(),
          weekStart: selectedWeek,
          weekEnd: weekEndDate,
          timesheetData: filteredData,
          dayTotals: filteredDayTotals,
          grandTotal: filteredGrandTotal,
          companyName: "DML Electrical Service, LLC"
        }
      });

      if (response.error) {
        throw response.error;
      }

      alert('✓ Timesheet report sent successfully!');
      setEmailModalOpen(false);
      setEmailAddress('');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email: ' + (error.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  }

  function exportToPDF() {
    const weekDays = getWeekDays(selectedWeek);
    
    // Build HTML for PDF
    let html = `
      <div style="padding: 40px; font-family: Arial, sans-serif; color: #000;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${logo}" style="max-width: 200px; height: auto;" />
        </div>
        <h1 style="text-align: center; color: #0b3ea8; margin-bottom: 10px;">Weekly Timesheet Report</h1>
        <p style="text-align: center; color: #000; margin-bottom: 30px;">
          ${formatDateRange(selectedWeek)} to ${formatDateRange(weekEndDate)}
        </p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; color: #000;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb; font-weight: 700; color: #000;">Employee</th>
              ${weekDays.map(day => `
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #000;">
                  ${formatDayHeader(day).replace('\n', '<br/>')}
                </th>
              `).join('')}
              <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; background-color: #fef3c7; color: #000;">Week Total</th>
            </tr>
          </thead>
          <tbody>
            ${timesheetData.map((row, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600; color: #000;">${row.employeeName}</td>
                ${weekDays.map(day => `
                  <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; color: #000;">
                    ${row.days[day] > 0 ? row.days[day].toFixed(2) : '—'}
                  </td>
                `).join('')}
                <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; background-color: #fef3c7; color: #000;">
                  ${row.weekTotal.toFixed(2)}
                </td>
              </tr>
            `).join('')}
            <tr style="background-color: #e5e7eb; font-weight: 700;">
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #000;">TOTALS</td>
              ${dayTotals.map(total => `
                <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; color: #000;">${total.toFixed(2)}</td>
              `).join('')}
              <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; background-color: #fcd34d; color: #000;">
                ${grandTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        
        <p style="margin-top: 30px; text-align: center; color: #000; font-size: 10px;">
          Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    `;
    
    // Create temporary element
    const element = document.createElement('div');
    element.innerHTML = html;
    
    // PDF options
    const opt = {
      margin: 0.5,
      filename: `Weekly_Timesheet_${selectedWeek}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    // Generate PDF
    html2pdf().set(opt).from(element).save();
  }

  const weekDays = getWeekDays(selectedWeek);
  const weekEndDate = weekDays[6];

  // Calculate column totals
  const dayTotals = weekDays.map(day => {
    return timesheetData.reduce((sum, row) => sum + row.days[day], 0);
  });
  const grandTotal = timesheetData.reduce((sum, row) => sum + row.weekTotal, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      
      <div style={{ flex: 1 }}>
        
        <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  backgroundColor: "#fff",
                  color: BRAND.bg,
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                ← Back
              </button>
              <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 }}>
                Weekly Timesheet
              </h1>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => {
                  setSelectedEmployeeIds(new Set(timesheetData.map(r => r.employeeId)));
                  setEmailModalOpen(true);
                }}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✉️ Email Report
              </button>
              
              <button
                onClick={exportToPDF}
                style={{
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📄 Export PDF
              </button>
              
              <button
                onClick={exportToExcel}
                style={{
                  backgroundColor: "#10b981",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📊 Export Excel
              </button>
            </div>
          </div>

          {/* Week Navigation */}
          <div style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 12,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <button
              onClick={goToPreviousWeek}
              style={{
                backgroundColor: BRAND.primary,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Previous Week
            </button>

            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 4 }}>
                Week of {new Date(selectedWeek + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                Monday {formatDateRange(selectedWeek)} - Sunday {formatDateRange(weekEndDate)}
              </p>
              <button
                onClick={goToCurrentWeek}
                style={{
                  backgroundColor: "transparent",
                  color: BRAND.primary,
                  border: "none",
                  padding: "4px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 8,
                  textDecoration: "underline",
                }}
              >
                Go to Current Week
              </button>
            </div>

            <button
              onClick={goToNextWeek}
              style={{
                backgroundColor: BRAND.primary,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Next Week →
            </button>
          </div>

          {/* Approval Status Banner */}
          {approvalStatus?.status === 'approved' ? (
            <div style={{
              backgroundColor: "#d1fae5",
              border: "2px solid #10b981",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#065f46" }}>
                    Timesheet Approved
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#047857" }}>
                    Approved on {formatDate(approvalStatus.approved_at, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: "#fef3c7",
              border: "2px solid #f59e0b",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>⏰</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#92400e" }}>
                      Timesheet Pending Approval
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#78350f" }}>
                      Review the hours below and approve to automatically send to all recipients
                    </p>
                  </div>
                </div>
                <button
                  onClick={approveTimesheet}
                  disabled={approving}
                  style={{
                    backgroundColor: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: approving ? "not-allowed" : "pointer",
                    opacity: approving ? 0.7 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {approving ? "Approving..." : "✓ Approve & Send"}
                </button>
              </div>
            </div>
          )}

          {/* Timesheet Table */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: 18, color: "#6b7280" }}>Loading timesheet...</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6" }}>
                      <th style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 14,
                        position: "sticky",
                        left: 0,
                        backgroundColor: "#f3f4f6",
                        zIndex: 10,
                        color: "#111",
                      }}>
                        Employee
                      </th>
                      {weekDays.map(day => (
                        <th key={day} style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 14,
                          whiteSpace: "pre-line",
                          color: "#111",
                        }}>
                          {formatDayHeader(day)}
                        </th>
                      ))}
                      <th style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 14,
                        backgroundColor: "#fef3c7",
                        color: "#111",
                      }}>
                        Week Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetData.map((row, idx) => (
                      <tr key={row.employeeId} style={{
                        backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                      }}>
                        <td style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #e5e7eb",
                          fontWeight: 600,
                          position: "sticky",
                          left: 0,
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                          zIndex: 5,
                          color: "#111",
                        }}>
                          {row.employeeName}
                        </td>
                        {weekDays.map(day => (
                          <td key={day} style={{
                            padding: "12px 16px",
                            textAlign: "center",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 500,
                            color: "#111",
                          }}>
                            {row.days[day] > 0 ? row.days[day].toFixed(2) : "—"}
                          </td>
                        ))}
                        <td style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontWeight: 700,
                          backgroundColor: "#fef3c7",
                          color: "#111",
                        }}>
                          {row.weekTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Totals Row */}
                    <tr style={{ backgroundColor: "#e5e7eb", fontWeight: 700 }}>
                      <td style={{
                        padding: "12px 16px",
                        position: "sticky",
                        left: 0,
                        backgroundColor: "#e5e7eb",
                        zIndex: 5,
                        color: "#111",
                      }}>
                        TOTALS
                      </td>
                      {dayTotals.map((total, idx) => (
                        <td key={idx} style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          color: "#111",
                        }}>
                          {total.toFixed(2)}
                        </td>
                      ))}
                      <td style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        backgroundColor: "#fcd34d",
                        color: "#111",
                      }}>
                        {grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 32,
            maxWidth: 500,
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 8, color: "#111" }}>
              Email Timesheet Report
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
              Send the weekly timesheet for {formatDateRange(selectedWeek)} to {formatDateRange(weekEndDate)}
            </p>

            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14, color: "#111" }}>
              Recipient Email Address
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="email@example.com"
              disabled={sending}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 16,
                marginBottom: 20,
                boxSizing: "border-box",
              }}
            />

            {/* Employee Selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>
                  Select Employees to Include
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button"
                    onClick={() => setSelectedEmployeeIds(new Set(timesheetData.map(r => r.employeeId)))}
                    style={{ fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Select All
                  </button>
                  <span style={{ color: "#d1d5db" }}>|</span>
                  <button type="button"
                    onClick={() => setSelectedEmployeeIds(new Set())}
                    style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    None
                  </button>
                </div>
              </div>
              <div style={{ border: "2px solid #e5e7eb", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}>
                {timesheetData.map((row, idx) => (
                  <label key={row.employeeId} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", cursor: "pointer",
                    borderBottom: idx < timesheetData.length - 1 ? "1px solid #f3f4f6" : "none",
                    backgroundColor: selectedEmployeeIds.has(row.employeeId) ? "#eff6ff" : "#fff",
                  }}>
                    <input type="checkbox"
                      checked={selectedEmployeeIds.has(row.employeeId)}
                      onChange={(e) => {
                        const next = new Set(selectedEmployeeIds);
                        if (e.target.checked) next.add(row.employeeId);
                        else next.delete(row.employeeId);
                        setSelectedEmployeeIds(next);
                      }}
                      style={{ width: 16, height: 16, accentColor: "#3b82f6", cursor: "pointer" }}
                    />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "#111" }}>{row.employeeName}</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{row.weekTotal.toFixed(2)} hrs</span>
                  </label>
                ))}
              </div>
              <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                {selectedEmployeeIds.size} of {timesheetData.length} employee{timesheetData.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setEmailModalOpen(false);
                  setEmailAddress('');
                }}
                disabled={sending}
                style={{
                  padding: "12px 24px",
                  border: "2px solid #e5e7eb",
                  backgroundColor: "#fff",
                  color: "#6b7280",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={sending}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Sending..." : "✉️ Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

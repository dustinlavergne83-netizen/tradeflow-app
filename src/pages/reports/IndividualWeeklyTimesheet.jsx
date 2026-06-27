import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import DesktopHeader from "../../Components/DesktopHeader";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import logo from '../../assets/LOGOD.jpg';

import { formatDate } from "../../utils/dateUtils";
import { notify, promptDialog } from '../../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function IndividualWeeklyTimesheet() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [timesheetData, setTimesheetData] = useState([]);

  // Round hours to nearest quarter hour (0.25)
  function roundToQuarterHour(hours) {
    return Math.round(hours * 4) / 4;
  }

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
  }

  function getWeekDays(mondayStr) {
    const days = [];
    const [year, month, day] = mondayStr.split('-').map(Number);
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(year, month - 1, day + i);
      const y = currentDay.getFullYear();
      const m = String(currentDay.getMonth() + 1).padStart(2, '0');
      const d = String(currentDay.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    return days;
  }

  function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  }

  function formatTime(isoTime) {
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployees.length > 0) {
      loadTimesheetData();
    } else {
      setTimesheetData([]);
    }
  }, [selectedEmployees, selectedWeek]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, preferred_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Error loading employees:", err);
      notify("Failed to load employees: " + err.message);
    }
  }

  async function loadTimesheetData() {
    try {
      setLoading(true);
      const weekDays = getWeekDays(selectedWeek);
      const weekStart = weekDays[0];
      const weekEnd = weekDays[6];

      const employeeData = [];

      for (const empId of selectedEmployees) {
        const emp = employees.find(e => e.user_id === empId);
        if (!emp) continue;

        const { data: segments, error } = await supabase
          .from("shift_segments")
          .select("*")
          .eq("user_id", empId)
          .gte("start_at", weekStart + 'T00:00:00')
          .lte("start_at", weekEnd + 'T23:59:59')
          .order("start_at", { ascending: true });

        if (error) throw error;

        const dailyHours = weekDays.map(day => {
          const daySegments = (segments || []).filter(seg => seg.start_at.split('T')[0] === day);
          const dayTotal = daySegments.reduce((sum, seg) => {
            if (seg.end_at) {
              const start = new Date(seg.start_at);
              const end = new Date(seg.end_at);
              return sum + (end - start) / (1000 * 60 * 60);
            }
            return sum;
          }, 0);
          // Round each day to nearest quarter hour
          return dayTotal > 0 ? roundToQuarterHour(dayTotal) : 0;
        });

        employeeData.push({
          employeeId: emp.user_id,
          name: `${emp.preferred_name || emp.first_name} ${emp.last_name}`,
          dailyHours,
          weekTotal: dailyHours.reduce((sum, h) => sum + h, 0),
          segments: segments || []
        });
      }

      setTimesheetData(employeeData);
    } catch (err) {
      console.error("Error loading timesheet:", err);
      notify("Failed to load timesheet: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleEmployee(empId) {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
    }
  }

  function selectAllEmployees() {
    setSelectedEmployees(employees.map(e => e.user_id));
  }

  function clearAllEmployees() {
    setSelectedEmployees([]);
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
    const data = [];
    
    data.push(['Weekly Timesheet Report']);
    data.push([`Week of ${weekDays[0]} to ${weekDays[6]}`]);
    data.push([]);
    
    const headers = ['Employee', ...weekDays.map(d => formatDateShort(d)), 'Total'];
    data.push(headers);
    
    timesheetData.forEach(emp => {
      const row = [emp.name, ...emp.dailyHours.map(h => h > 0 ? h.toFixed(2) : '0.00'), emp.weekTotal.toFixed(2)];
      data.push(row);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, ...weekDays.map(() => ({ wch: 10 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
    XLSX.writeFile(wb, `Weekly_Timesheet_${selectedWeek}.xlsx`);
  }

  function exportToPDF() {
    const weekDays = getWeekDays(selectedWeek);
    
    const html = `
      <div style="padding: 30px; font-family: Arial, sans-serif; color: #000;">
        <div style="text-align: center; margin-bottom: 15px;">
          <img src="${logo}" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="text-align: center; margin: 10px 0;">Weekly Timesheet</h2>
        <p style="text-align: center; margin: 5px 0; font-size: 12px;">
          ${weekDays[0]} to ${weekDays[6]}
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ccc;">Employee</th>
              ${weekDays.map(day => `
                <th style="padding: 8px; text-align: center; border: 1px solid #ccc;">${formatDateShort(day)}</th>
              `).join('')}
              <th style="padding: 8px; text-align: center; border: 1px solid #ccc; background-color: #fef3c7;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${timesheetData.map((emp, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">${emp.name}</td>
                ${emp.dailyHours.map(h => `
                  <td style="padding: 8px; text-align: center; border: 1px solid #ccc;">
                    ${h > 0 ? h.toFixed(2) : '—'}
                  </td>
                `).join('')}
                <td style="padding: 8px; text-align: center; border: 1px solid #ccc; font-weight: 700; background-color: #fef3c7;">
                  ${emp.weekTotal.toFixed(2)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p style="margin-top: 20px; text-align: center; font-size: 8px;">
          Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = html;
    
    const opt = {
      margin: 0.5,
      filename: `Weekly_Timesheet_${selectedWeek}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save();
  }

  async function emailReport() {
    const email = await promptDialog('Enter recipient email address:');
    
    if (!email) {
      return;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      notify('Please enter a valid email address');
      return;
    }
    
    try {
      setLoading(true);
      
      const weekDays = getWeekDays(selectedWeek);
      
      // Generate PDF HTML
      const html = `
        <div style="padding: 30px; font-family: Arial, sans-serif; color: #000;">
          <div style="text-align: center; margin-bottom: 15px;">
            <img src="${logo}" style="max-width: 150px; height: auto;" />
          </div>
          <h2 style="text-align: center; margin: 10px 0;">Weekly Timesheet</h2>
          <p style="text-align: center; margin: 5px 0; font-size: 12px;">
            ${weekDays[0]} to ${weekDays[6]}
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ccc;">Employee</th>
                ${weekDays.map(day => `
                  <th style="padding: 8px; text-align: center; border: 1px solid #ccc;">${formatDateShort(day)}</th>
                `).join('')}
                <th style="padding: 8px; text-align: center; border: 1px solid #ccc; background-color: #fef3c7;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${timesheetData.map((emp, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">${emp.name}</td>
                  ${emp.dailyHours.map(h => `
                    <td style="padding: 8px; text-align: center; border: 1px solid #ccc;">
                      ${h > 0 ? h.toFixed(2) : '—'}
                    </td>
                  `).join('')}
                  <td style="padding: 8px; text-align: center; border: 1px solid #ccc; font-weight: 700; background-color: #fef3c7;">
                    ${emp.weekTotal.toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="margin-top: 20px; text-align: center; font-size: 8px;">
            Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      `;
      
      const element = document.createElement('div');
      element.innerHTML = html;
      
      const opt = {
        margin: 0.5,
        filename: `Weekly_Timesheet_${selectedWeek}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      };
      
      // Generate PDF as base64
      const pdf = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const pdfBase64 = pdf.split(',')[1]; // Remove data:application/pdf;base64, prefix
      
      // Call Supabase Edge Function to send email
      const { data, error } = await supabase.functions.invoke('send-individual-timesheet', {
        body: {
          to: email,
          weekStart: weekDays[0],
          weekEnd: weekDays[6],
          timesheetData: timesheetData,
          pdfBase64: pdfBase64
        }
      });
      
      if (error) throw error;
      
      notify(`Timesheet report sent successfully to ${email}!`);
      
    } catch (err) {
      console.error('Error sending email:', err);
      notify('Failed to send email: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const weekDays = getWeekDays(selectedWeek);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }} className="main-container">
      <div className="no-print">
        <DesktopHeader />
      </div>
      
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }} className="content-wrapper">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }} className="no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => navigate(-1)} style={{
                backgroundColor: "#fff", color: BRAND.bg, border: "none", padding: "10px 16px",
                borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer"
              }}>← Back</button>
            <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 }}>
              Individual Weekly Timesheet
            </h1>
          </div>
          
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => window.print()} style={{
                backgroundColor: "#6366f1", color: "#fff", border: "none", padding: "12px 24px",
                borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer"
              }}>🖨️ Print</button>
            
            <button onClick={exportToPDF} disabled={selectedEmployees.length === 0} style={{
                backgroundColor: "#ef4444", color: "#fff", border: "none", padding: "12px 24px",
                borderRadius: 8, fontSize: 16, fontWeight: 600,
                cursor: selectedEmployees.length > 0 ? "pointer" : "not-allowed",
                opacity: selectedEmployees.length > 0 ? 1 : 0.5
              }}>📄 PDF</button>
            
            <button onClick={exportToExcel} disabled={selectedEmployees.length === 0} style={{
                backgroundColor: "#10b981", color: "#fff", border: "none", padding: "12px 24px",
                borderRadius: 8, fontSize: 16, fontWeight: 600,
                cursor: selectedEmployees.length > 0 ? "pointer" : "not-allowed",
                opacity: selectedEmployees.length > 0 ? 1 : 0.5
              }}>📊 Excel</button>
            
            <button onClick={emailReport} disabled={selectedEmployees.length === 0} style={{
                backgroundColor: "#f59e0b", color: "#fff", border: "none", padding: "12px 24px",
                borderRadius: 8, fontSize: 16, fontWeight: 600,
                cursor: selectedEmployees.length > 0 ? "pointer" : "not-allowed",
                opacity: selectedEmployees.length > 0 ? 1 : 0.5
              }}>📧 Email</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 12, marginBottom: 24 }} className="no-print">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>
                Select Employees ({selectedEmployees.length} selected)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={selectAllEmployees} style={{
                    padding: "6px 12px", fontSize: 13, backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb",
                    borderRadius: 6, cursor: "pointer", fontWeight: 600
                  }}>Select All</button>
                <button onClick={clearAllEmployees} style={{
                    padding: "6px 12px", fontSize: 13, backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb",
                    borderRadius: 6, cursor: "pointer", fontWeight: 600
                  }}>Clear All</button>
              </div>
            </div>
            
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8, maxHeight: 200, overflowY: "auto", padding: 12, border: "2px solid #e5e7eb",
              borderRadius: 8, backgroundColor: "#f9fafb"
            }}>
              {employees.map(emp => (
                <label key={emp.user_id} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  backgroundColor: "#fff", borderRadius: 6, cursor: "pointer",
                  border: selectedEmployees.includes(emp.user_id) ? "2px solid " + BRAND.primary : "1px solid #e5e7eb"
                }}>
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.user_id)}
                    onChange={() => toggleEmployee(emp.user_id)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>
                    {emp.preferred_name || emp.first_name} {emp.last_name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Week Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
            <button onClick={goToPreviousWeek} style={{
                backgroundColor: BRAND.primary, color: "#fff", border: "none",
                padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}>← Previous</button>

            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px 0" }}>
                {new Date(selectedWeek + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 4px 0" }}>
                {weekDays[0]} - {weekDays[6]}
              </p>
              <button onClick={goToCurrentWeek} style={{
                  backgroundColor: "transparent", color: BRAND.primary, border: "none",
                  padding: "2px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline"
                }}>Current Week</button>
            </div>

            <button onClick={goToNextWeek} style={{
                backgroundColor: BRAND.primary, color: "#fff", border: "none",
                padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}>Next →</button>
          </div>
        </div>

        {/* Timesheet Table */}
        {selectedEmployees.length === 0 ? (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>Select employees to view their timesheet</p>
          </div>
        ) : loading ? (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>Loading...</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" }} className="print-table-container">
            {/* Print Header - Matches PDF export */}
            <div className="print-only" style={{ display: "none", textAlign: "center", marginBottom: 15 }}>
              <img src={logo} alt="Company Logo" style={{ maxWidth: 150, height: "auto" }} />
              <h2 style={{ textAlign: "center", margin: "10px 0", fontSize: 24, color: "#000" }}>Weekly Timesheet</h2>
              <p style={{ textAlign: "center", margin: "5px 0", fontSize: 12, color: "#000" }}>
                {weekDays[0]} to {weekDays[6]}
              </p>
            </div>
            
            <div style={{ padding: "15px 20px", borderBottom: "2px solid #e5e7eb" }} className="no-print">
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111" }}>
                Week of {weekDays[0]} to {weekDays[6]}
              </h2>
            </div>

            <div style={{ overflowX: "auto" }} className="print-table-wrapper">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={{
                      padding: "10px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb",
                      fontWeight: 700, position: "sticky", left: 0, backgroundColor: "#f3f4f6", zIndex: 10,
                      color: "#111"
                    }}>Employee</th>
                    {weekDays.map(day => (
                      <th key={day} style={{
                        padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontWeight: 700,
                        color: "#111"
                      }}>{formatDateShort(day)}</th>
                    ))}
                    <th style={{
                      padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb",
                      fontWeight: 700, backgroundColor: "#fef3c7", color: "#111"
                    }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetData.map((emp, idx) => (
                    <tr key={emp.employeeId} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{
                        padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 600,
                        position: "sticky", left: 0, backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb", zIndex: 5,
                        color: "#111"
                      }}>{emp.name}</td>
                      {emp.dailyHours.map((hours, dayIdx) => (
                        <td key={dayIdx} style={{
                          padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb",
                          color: "#111"
                        }}>
                          {hours > 0 ? hours.toFixed(2) : "—"}
                        </td>
                      ))}
                      <td style={{
                        padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb",
                        fontWeight: 700, backgroundColor: "#fef3c7", color: "#111"
                      }}>{emp.weekTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          /* CRITICAL: Remove all hidden elements completely */
          .no-print {
            display: none !important;
            position: absolute !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          
          .siteHeader,
          .headerInner { 
            display: none !important;
            position: absolute !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Show print-only elements */
          .print-only { 
            display: block !important; 
          }
          
          /* Force white background everywhere */
          * {
            background-color: white !important;
            background-image: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          html, body { 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          
          .main-container {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .content-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          
          /* Page setup */
          @page {
            margin: 0.5in;
            size: landscape;
          }
          
          /* Simple print container */
          .print-table-container {
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          
          /* Match PDF export styling */
          .print-only {
            margin-bottom: 15px !important;
            padding: 0 !important;
          }
          
          .print-only img {
            max-width: 150px !important;
            height: auto !important;
          }
          
          .print-only h2 {
            text-align: center !important;
            margin: 10px 0 !important;
            font-size: 24px !important;
            color: #000 !important;
          }
          
          .print-only p {
            text-align: center !important;
            margin: 5px 0 !important;
            font-size: 12px !important;
            color: #000 !important;
          }
          
          /* Match PDF table styling */
          table {
            page-break-inside: auto;
            background: white !important;
            font-size: 10px !important;
            margin-top: 20px !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          
          th, td {
            padding: 8px !important;
            border: 1px solid #ccc !important;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          /* Table borders */
          th {
            border: 1px solid #000 !important;
            background-color: #f3f4f6 !important;
          }
          
          td {
            border: 1px solid #000 !important;
          }
          
          /* Specific background overrides for table cells */
          tbody tr td {
            background-color: white !important;
          }
          
          tbody tr:nth-child(even) td {
            background-color: #f9fafb !important;
          }
          
          /* Yellow total column */
          th:last-child,
          td:last-child {
            background-color: #fef3c7 !important;
          }
        }
      `}</style>
    </div>
  );
}

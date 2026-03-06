

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import DesktopHeader from "../Components/DesktopHeader";

import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
  danger: "#f97316",
};

export default function TimeClock() {
  const [loading, setLoading] = useState(true);
  const [employeeStatuses, setEmployeeStatuses] = useState([]);
  const [weeklyTimesheet, setWeeklyTimesheet] = useState([]);
  const [detailedBreakdown, setDetailedBreakdown] = useState([]);
  const [shiftDetails, setShiftDetails] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState(null);
  const [showSectionModal, setShowSectionModal] = useState(null); // {employeeId, projectName, files}
  const nav = useNavigate();

  // Job sections for photo organization (same as in Reports & Photos)
  const JOB_SECTIONS = [
    { id: 'rough-in', name: 'Rough-in', color: '#EF4444', icon: '🔌' },
    { id: 'final', name: 'Final', color: '#10B981', icon: '✅' },
    { id: 'panel', name: 'Panel Installation', color: '#3B82F6', icon: '⚡' },
    { id: 'service', name: 'Service Installation', color: '#8B5CF6', icon: '🏠' },
    { id: 'fixtures', name: 'Fixtures', color: '#F59E0B', icon: '💡' },
    { id: 'troubleshooting', name: 'Troubleshooting', color: '#EF4444', icon: '🔧' },
    { id: 'testing', name: 'Testing & Inspection', color: '#06B6D4', icon: '📋' },
    { id: 'cleanup', name: 'Cleanup', color: '#6B7280', icon: '🧹' },
    { id: 'other', name: 'Other', color: '#9CA3AF', icon: '📷' },
  ];

  useEffect(() => {
    loadAllData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadAllData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refreshKey]);

  async function loadAllData() {
    await Promise.all([
      loadEmployeeStatuses(),
      loadCurrentWeekTimesheet(),
      loadDetailedBreakdown()
    ]);
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
          return segDate === day; // Include all segments (is_lunch just means they took a lunch break)
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

  async function loadDayDetails(employeeId, userId, date, employeeName) {
    try {
      // Get all shifts for this employee on this date
      const { data: shifts, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", userId)
        .gte("clock_in", date + 'T00:00:00')
        .lte("clock_in", date + 'T23:59:59')
        .order("clock_in", { ascending: true });

      if (shiftError) throw shiftError;

      // Get all segments for these shifts
      const shiftIds = (shifts || []).map(s => s.id);
      let segments = [];
      
      if (shiftIds.length > 0) {
        const { data: segData, error: segError } = await supabase
          .from("shift_segments")
          .select("*")
          .in("shift_id", shiftIds)
          .order("start_at", { ascending: true });

        if (!segError) {
          segments = segData || [];
        }
      }

      setShiftDetails({
        employeeName,
        date,
        shifts: shifts || [],
        segments: segments || []
      });
      setSelectedEmployee({employeeId, date});
    } catch (err) {
      console.error("Error loading day details:", err);
    }
  }

  function closeDetailsModal() {
    setSelectedEmployee(null);
    setShiftDetails([]);
  }

  function calculateSegmentHours(start, end) {
    if (!start) return 0;
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    return (endTime - startTime) / (1000 * 60 * 60);
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

  async function loadCurrentWeekTimesheet() {
    try {
      const weekStart = getMonday(new Date());
      const weekDays = getWeekDays(weekStart);
      const weekEnd = weekDays[6];

      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, preferred_name")
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
        const displayName = emp.preferred_name || emp.first_name;
        const row = {
          employeeId: emp.id,
          userId: emp.user_id,
          employeeName: `${displayName} ${emp.last_name}`,
          days: {},
          weekTotal: 0,
        };

        // Initialize all days to 0
        weekDays.forEach(day => {
          row.days[day] = 0;
        });

        // Calculate hours for each day using shift segments
        const empSegments = (segments || []).filter(s => s.user_id === emp.user_id);
        
        for (const segment of empSegments) {
          const segmentDate = segment.start_at.split('T')[0];
          
          if (weekDays.includes(segmentDate)) {
            let hours = 0;
            
            if (segment.end_at) {
              const start = new Date(segment.start_at);
              const end = new Date(segment.end_at);
              const diffMs = end - start;
              hours = diffMs / (1000 * 60 * 60);
            }
            
            row.days[segmentDate] += hours;
            row.weekTotal += hours;
          }
        }

        timesheetRows.push(row);
      }

      setWeeklyTimesheet(timesheetRows);
    } catch (err) {
      console.error("Error loading weekly timesheet:", err);
    }
  }

  async function loadEmployeeStatuses() {
    try {
      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, preferred_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true });

      if (empError) throw empError;

      // Get all open shifts with location data
      const { data: openShifts, error: shiftError } = await supabase
        .from("shifts")
        .select("id, user_id, clock_in, clock_in_latitude, clock_in_longitude")
        .is("clock_out", null);

      if (shiftError) throw shiftError;

      // Get current segments for open shifts
      const shiftIds = (openShifts || []).map(s => s.id);
      let currentSegments = [];
      
      if (shiftIds.length > 0) {
        const { data: segments, error: segError } = await supabase
          .from("shift_segments")
          .select("shift_id, project_task, start_at")
          .in("shift_id", shiftIds)
          .is("end_at", null);

        if (!segError) {
          currentSegments = segments || [];
        }
      }

      // Get latest location history for clocked-in employees
      const clockedInUserIds = (openShifts || []).map(s => s.user_id);
      let locationHistory = [];
      
      if (clockedInUserIds.length > 0) {
        const { data: locData, error: locError } = await supabase
          .from("location_history")
          .select("user_id, latitude, longitude, timestamp")
          .in("user_id", clockedInUserIds)
          .order("timestamp", { ascending: false });

        if (!locError) {
          locationHistory = locData || [];
        }
      }

      // Build status array
      const statuses = (employees || []).map(emp => {
        const shift = (openShifts || []).find(s => s.user_id === emp.user_id);
        const segment = shift ? currentSegments.find(seg => seg.shift_id === shift.id) : null;

        // Get latest location - prefer location_history, fallback to clock-in location
        const latestLoc = locationHistory.find(loc => loc.user_id === emp.user_id);
        let location = null;
        
        if (latestLoc) {
          location = {
            latitude: latestLoc.latitude,
            longitude: latestLoc.longitude,
            timestamp: latestLoc.timestamp
          };
        } else if (shift && shift.clock_in_latitude && shift.clock_in_longitude) {
          location = {
            latitude: shift.clock_in_latitude,
            longitude: shift.clock_in_longitude,
            timestamp: shift.clock_in
          };
        }

        const displayName = emp.preferred_name || emp.first_name;
        
        return {
          employeeId: emp.id,
          name: `${displayName} ${emp.last_name}`,
          isClockedIn: !!shift,
          clockInTime: shift ? shift.clock_in : null,
          currentProject: segment ? segment.project_task : null,
          segmentStartTime: segment ? segment.start_at : null,
          location: location,
        };
      });

      setEmployeeStatuses(statuses);
    } catch (err) {
      console.error("Error loading employee statuses:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(isoTime) {
    if (!isoTime) return "";
    const start = new Date(isoTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  function formatTime(isoTime) {
    if (!isoTime) return "";
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function openInMaps(latitude, longitude) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
  }

  // Handle job photo upload for clocked-in employees
  async function handleJobPhotoUpload(employeeId, projectName, e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (!projectName || projectName === 'No Project') {
      alert('Employee must be assigned to a project to upload photos');
      return;
    }

    setUploadingPhotoFor(employeeId);
    
    try {
      // First, find the project ID by name
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('name', projectName)
        .limit(1);

      if (projectError) throw projectError;

      if (!projects || projects.length === 0) {
        throw new Error('Project not found in database');
      }

      const projectId = projects[0].id;

      // Upload each photo to project-photos storage
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `timeclock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(`${projectId}/${fileName}`, file, { 
            contentType: file.type 
          });

        if (uploadError) throw uploadError;
      }

      alert(`✅ Successfully uploaded ${files.length} photo(s) to project: ${projectName}`);
      
    } catch (err) {
      console.error('Error uploading job photos:', err);
      alert('Failed to upload photos: ' + err.message + '\n\nNote: Make sure the "project-photos" storage bucket exists in Supabase.');
    } finally {
      setUploadingPhotoFor(null);
      e.target.value = ''; // Reset file input
    }
  }

  const clockedInCount = employeeStatuses.filter(e => e.isClockedIn).length;
  const clockedOutCount = employeeStatuses.length - clockedInCount;
  
  const weekStart = getMonday(new Date());
  const weekDays = getWeekDays(weekStart);
  const weekEnd = weekDays[6];

  const dayTotals = weekDays.map(day => {
    return weeklyTimesheet.reduce((sum, row) => sum + row.days[day], 0);
  });
  const grandTotal = weeklyTimesheet.reduce((sum, row) => sum + row.weekTotal, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      
      <div style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 8 }}>
              Employee Status Dashboard
            </h1>
            <div style={{ color: "#e5e7eb", fontSize: 14 }}>
              <span style={{ color: "#10b981", fontWeight: 600 }}>{clockedInCount} Clocked In</span>
              {" • "}
              <span style={{ color: "#6b7280", fontWeight: 600 }}>{clockedOutCount} Clocked Out</span>
              {" • "}
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔄 Refresh
            </button>
            
            <button
              onClick={() => nav("/timeclock/history")}
              style={{
                backgroundColor: BRAND.primary,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📊 View Timesheets
            </button>

            <button
              onClick={() => nav("/reports/weekly-timesheet")}
              style={{
                backgroundColor: "#8b5cf6",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📅 All Employees
            </button>

            <button
              onClick={() => nav("/reports/individual-timesheet")}
              style={{
                backgroundColor: "#ec4899",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              👤 Individual Report
            </button>

            <button
              onClick={() => nav("/time-off")}
              style={{
                backgroundColor: "#10b981",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🏖️ Time Off Requests
            </button>

            <button
              onClick={() => nav("/pending-jobs")}
              style={{
                backgroundColor: "#f59e0b",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📋 Pending Jobs
            </button>
          </div>
        </div>

        {/* Currently Clocked In Table */}
        {loading ? (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center", marginBottom: 24 }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>Loading employee statuses...</p>
          </div>
        ) : (
          <>
            {clockedInCount > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
                <div style={{ padding: 20, borderBottom: "2px solid #e5e7eb", backgroundColor: "#f0fdf4" }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111" }}>
                    🟢 Currently Clocked In ({clockedInCount})
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0 0" }}>
                    Real-time employee activity
                  </p>
                </div>

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
                          color: "#111",
                        }}>
                          Employee
                        </th>
                        <th style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          borderBottom: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#111",
                        }}>
                          Clocked In
                        </th>
                        <th style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          borderBottom: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#111",
                        }}>
                          Current Project
                        </th>
                        <th style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          borderBottom: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#111",
                        }}>
                          GPS Location
                        </th>
                        <th style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          borderBottom: "2px solid #e5e7eb",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#111",
                        }}>
                          Job Photos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeStatuses
                        .filter(emp => emp.isClockedIn)
                        .map((emp, idx) => (
                          <tr key={emp.employeeId} style={{
                            backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                          }}>
                            <td style={{
                              padding: "16px",
                              borderBottom: "1px solid #e5e7eb",
                              fontWeight: 700,
                              fontSize: 16,
                              color: "#111",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  backgroundColor: "#10b981",
                                  display: "inline-block",
                                }}></span>
                                {emp.name}
                              </div>
                            </td>
                            <td style={{
                              padding: "16px",
                              borderBottom: "1px solid #e5e7eb",
                              color: "#111",
                            }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                {formatTime(emp.clockInTime)}
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                {formatDuration(emp.clockInTime)} ago
                              </div>
                            </td>
                            <td style={{
                              padding: "16px",
                              borderBottom: "1px solid #e5e7eb",
                            }}>
                              {emp.currentProject ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111", marginBottom: 2 }}>
                                    {emp.currentProject}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                                    Started {formatTime(emp.segmentStartTime)}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
                                  ⚠️ No project
                                </span>
                              )}
                            </td>
                            <td style={{
                              padding: "16px",
                              borderBottom: "1px solid #e5e7eb",
                              color: "#111",
                              fontSize: 13,
                            }}>
                              {emp.location ? (
                                <div>
                                  <div 
                                    style={{ 
                                      fontSize: 12, 
                                      color: "#2563eb", 
                                      marginBottom: 2,
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      userSelect: "none",
                                    }}
                                    onClick={() => openInMaps(emp.location.latitude, emp.location.longitude)}
                                  >
                                    📍 {emp.location.latitude.toFixed(6)}, {emp.location.longitude.toFixed(6)}
                                  </div>
                                  {emp.location.timestamp && (
                                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                      Updated {formatTime(emp.location.timestamp)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#9ca3af", fontSize: 12 }}>No location data</span>
                              )}
                            </td>
                            <td style={{
                              padding: "16px",
                              borderBottom: "1px solid #e5e7eb",
                              textAlign: "center",
                            }}>
                              {emp.currentProject && emp.currentProject !== 'No Project' ? (
                                <div>
                                  <label style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "8px 16px",
                                    backgroundColor: uploadingPhotoFor === emp.employeeId ? "#f3f4f6" : "#10b981",
                                    color: "#fff",
                                    borderRadius: 8,
                                    cursor: uploadingPhotoFor === emp.employeeId ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    opacity: uploadingPhotoFor === emp.employeeId ? 0.6 : 1,
                                    transition: "all 0.2s",
                                  }}>
                                    {uploadingPhotoFor === emp.employeeId ? (
                                      <>⏳ Uploading...</>
                                    ) : (
                                      <>📷 Upload Photos</>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      style={{ display: "none" }}
                                      disabled={uploadingPhotoFor === emp.employeeId}
                                      onChange={(e) => handleJobPhotoUpload(emp.employeeId, emp.currentProject, e)}
                                    />
                                  </label>
                                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, textAlign: "center" }}>
                                    for {emp.currentProject}
                                  </div>
                                  {emp.currentProject && (
                                    <div 
                                      onClick={() => {
                                        // Find project ID and navigate to reports & photos
                                        supabase
                                          .from('projects')
                                          .select('id')
                                          .eq('name', emp.currentProject)
                                          .limit(1)
                                          .then(({ data }) => {
                                            if (data && data.length > 0) {
                                              nav(`/project/${data[0].id}/reports-photos`);
                                            }
                                          });
                                      }}
                                      style={{
                                        fontSize: 11,
                                        color: "#3b82f6",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        marginTop: 4,
                                      }}
                                    >
                                      📸 View Project Photos
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>
                                  ⚠️ No project assigned
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && employeeStatuses.length === 0 && (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>No active employees found.</p>
          </div>
        )}

        {/* Detailed Segment Breakdown */}
        {!loading && detailedBreakdown && detailedBreakdown.rows && detailedBreakdown.rows.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", marginTop: 32 }}>
            <div style={{ padding: 20, borderBottom: "2px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111" }}>
                📋 Detailed Segment Breakdown
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0 0" }}>
                All shift segments by day - Projects and lunch breaks
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
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
                      <tr key={rowIdx} style={{
                        backgroundColor: "#fff",
                      }}>
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
                                borderLeft: empIdx === 0 ? "2px solid #e5e7eb" : "1px solid #e5e7eb",
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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shift Details Modal */}
        {selectedEmployee && shiftDetails && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 20,
            }}
            onClick={closeDetailsModal}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                maxWidth: 900,
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: 24,
                borderBottom: "2px solid #e5e7eb",
                position: "sticky",
                top: 0,
                backgroundColor: "#fff",
                zIndex: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111" }}>
                      {shiftDetails.employeeName}
                    </h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#6b7280" }}>
                      {formatDateRange(shiftDetails.date)} - Shift Details
                    </p>
                  </div>
                  <button
                    onClick={closeDetailsModal}
                    style={{
                      padding: "8px 16px",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#666",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div style={{ padding: 24 }}>
                {shiftDetails.shifts.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#999", padding: 40 }}>
                    No shifts found for this day
                  </p>
                ) : (
                  shiftDetails.shifts.map((shift, shiftIdx) => {
                    const shiftSegments = shiftDetails.segments.filter(seg => seg.shift_id === shift.id);
                    const shiftTotalHours = shiftSegments.reduce((sum, seg) => 
                      sum + calculateSegmentHours(seg.start_at, seg.end_at), 0
                    );

                    return (
                      <div key={shift.id} style={{
                        marginBottom: 24,
                        border: "2px solid #e5e7eb",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}>
                        {/* Shift Header */}
                        <div style={{
                          backgroundColor: "#f3f4f6",
                          padding: 16,
                          borderBottom: "2px solid #e5e7eb",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>
                                Shift #{shiftIdx + 1}
                              </div>
                              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                                {formatTime(shift.clock_in)} - {shift.clock_out ? formatTime(shift.clock_out) : "In Progress"}
                              </div>
                            </div>
                            <div style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: BRAND.primary,
                            }}>
                              {shiftTotalHours.toFixed(2)} hrs
                            </div>
                          </div>
                        </div>

                        {/* Shift Segments */}
                        <div style={{ padding: 16 }}>
                          {shiftSegments.length === 0 ? (
                            <p style={{ textAlign: "center", color: "#999", padding: 20 }}>
                              No segments recorded
                            </p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {shiftSegments.map((seg, segIdx) => {
                                const segHours = calculateSegmentHours(seg.start_at, seg.end_at);
                                const isLunch = seg.is_lunch;
                                
                                return (
                                  <div
                                    key={seg.id}
                                    style={{
                                      backgroundColor: isLunch ? "#fef3c7" : "#f0fdf4",
                                      border: isLunch ? "2px solid #fbbf24" : "2px solid #10b981",
                                      borderRadius: 8,
                                      padding: 16,
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                          <span style={{
                                            backgroundColor: isLunch ? "#fbbf24" : "#10b981",
                                            color: "#fff",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            textTransform: "uppercase",
                                          }}>
                                            {isLunch ? "🍽️ LUNCH BREAK" : "💼 WORK"}
                                          </span>
                                          <span style={{
                                            fontSize: 11,
                                            color: "#6b7280",
                                            fontWeight: 600,
                                          }}>
                                            Segment #{segIdx + 1}
                                          </span>
                                        </div>

                                        {!isLunch && seg.project_task && (
                                          <div style={{
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: "#111",
                                            marginBottom: 4,
                                          }}>
                                            📁 {seg.project_task}
                                          </div>
                                        )}

                                        <div style={{ fontSize: 13, color: "#6b7280" }}>
                                          {formatTime(seg.start_at)} → {seg.end_at ? formatTime(seg.end_at) : "In Progress"}
                                        </div>

                                        {seg.notes && (
                                          <div style={{
                                            marginTop: 8,
                                            padding: 8,
                                            backgroundColor: "#fff",
                                            borderRadius: 4,
                                            fontSize: 12,
                                            color: "#374151",
                                          }}>
                                            📝 {seg.notes}
                                          </div>
                                        )}
                                      </div>

                                      <div style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: isLunch ? "#92400e" : "#10b981",
                                        marginLeft: 16,
                                      }}>
                                        {segHours.toFixed(2)} hrs
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

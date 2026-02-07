import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import DesktopHeader from "../Components/DesktopHeader";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function GeofenceEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, entry, exit
  const [dateFilter, setDateFilter] = useState('today'); // today, week, month, all
  const nav = useNavigate();

  useEffect(() => {
    loadEvents();
  }, [filter, dateFilter]);

  async function loadEvents() {
    try {
      setLoading(true);

      // Calculate date range
      let startDate = null;
      const now = new Date();
      
      if (dateFilter === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        startDate = weekAgo.toISOString();
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        startDate = monthAgo.toISOString();
      }

      let query = supabase
        .from('geofence_events')
        .select(`
          *,
          employees:employee_id (
            first_name,
            last_name,
            preferred_name
          ),
          projects:project_id (
            name
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (filter !== 'all') {
        query = query.eq('event_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error loading geofence events:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(isoTime) {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function openInMaps(lat, lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }

  function getActionBadge(action) {
    const badges = {
      clocked_in: { text: 'Clocked In', color: '#10b981', bg: '#d1fae5' },
      clocked_out: { text: 'Clocked Out', color: '#ef4444', bg: '#fee2e2' },
      started_lunch: { text: 'Started Lunch', color: '#f59e0b', bg: '#fef3c7' },
      ended_lunch: { text: 'Ended Lunch', color: '#10b981', bg: '#d1fae5' },
      dismissed: { text: 'Dismissed', color: '#6b7280', bg: '#f3f4f6' },
      no_action: { text: 'No Action', color: '#6b7280', bg: '#f3f4f6' },
    };

    const badge = badges[action] || badges.no_action;
    
    return (
      <span style={{
        backgroundColor: badge.bg,
        color: badge.color,
        padding: '4px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
      }}>
        {badge.text}
      </span>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            📍 Geofence Events History
          </h1>
          <p style={{ color: "#e5e7eb", fontSize: 16, margin: 0 }}>
            Employee arrivals and departures at project sites
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          backgroundColor: "#fff", 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 24,
          display: "flex",
          gap: 16,
          flexWrap: "wrap"
        }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
              Event Type
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "2px solid #e5e7eb",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <option value="all">All Events</option>
              <option value="entry">Arrivals Only</option>
              <option value="exit">Departures Only</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
              Time Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "2px solid #e5e7eb",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={loadEvents}
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
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div style={{ backgroundColor: "#fff", padding: 40, borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, color: "#6b7280" }}>No geofence events found for selected filters</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Time
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Employee
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Event
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Project
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Action Taken
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
                    Location
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, idx) => {
                  const employee = event.employees;
                  const employeeName = employee ? `${employee.preferred_name || employee.first_name} ${employee.last_name}` : 'Unknown';
                  const projectName = event.projects?.name || 'Unknown Project';

                  return (
                    <tr key={event.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
                        {formatTime(event.timestamp)}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 14 }}>
                        {employeeName}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
                        <span style={{
                          backgroundColor: event.event_type === 'entry' ? '#d1fae5' : '#fee2e2',
                          color: event.event_type === 'entry' ? '#065f46' : '#991b1b',
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {event.event_type === 'entry' ? '🟢 Arrived' : '🔴 Departed'}
                        </span>
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", fontSize: 14 }}>
                        {projectName}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
                        {getActionBadge(event.employee_action)}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>
                        {event.latitude && event.longitude ? (
                          <button
                            onClick={() => openInMaps(event.latitude, event.longitude)}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#2563eb",
                              textDecoration: "underline",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            📍 View on Map
                          </button>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>No location</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {events.length > 0 && (
          <div style={{ marginTop: 16, textAlign: "center", color: "#e5e7eb", fontSize: 14 }}>
            Showing {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

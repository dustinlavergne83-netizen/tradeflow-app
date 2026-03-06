import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DesktopHeader from '../Components/DesktopHeader';

import { formatDate } from "../utils/dateUtils";

export default function EmployeeLocations() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [shifts, setShifts] = useState([]);
  const [locationHistory, setLocationHistory] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeShifts(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (selectedShiftId) {
      loadShiftLocationHistory(selectedShiftId);
    }
  }, [selectedShiftId]);

  async function loadEmployees() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('id, user_id, first_name, last_name')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      alert('Error loading employees: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployeeShifts(userId) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .order('clock_in', { ascending: false })
        .limit(30);

      if (error) throw error;
      setShifts(data || []);
      setLocationHistory([]);
      setSelectedShiftId('');
    } catch (error) {
      console.error('Error loading shifts:', error);
      alert('Error loading shifts: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadShiftLocationHistory(shiftId) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('location_history')
        .select('*')
        .eq('shift_id', shiftId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      setLocationHistory(data || []);
    } catch (error) {
      console.error('Error loading location history:', error);
      alert('Error loading location history: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function openInMaps(latitude, longitude) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
  }

  const selectedShift = shifts.find((s) => s.id === selectedShiftId);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <DesktopHeader />
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '24px', color: '#111827' }}>
          📍 Employee Location Tracking
        </h1>

        {/* Employee Selection */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
            Select Employee
          </label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Select Employee --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.user_id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Shift Selection */}
        {selectedEmployeeId && shifts.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
              Select Shift
            </label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Select Shift --</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatDate(shift.clock_in)} -{' '}
                  {shift.clock_out
                    ? new Date(shift.clock_out).toLocaleTimeString()
                    : 'In Progress'}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading...</div>
          </div>
        )}

        {/* Clock In/Out Locations */}
        {selectedShift && !loading && (
          <>
            {selectedShift.clock_in_latitude && selectedShift.clock_in_longitude && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #16a34a' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: '#16a34a' }}>
                  🟢 Clock In Location
                </h3>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>Time:</span>{' '}
                  {new Date(selectedShift.clock_in).toLocaleString()}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>Coordinates:</span>{' '}
                  {selectedShift.clock_in_latitude.toFixed(6)}, {selectedShift.clock_in_longitude.toFixed(6)}
                </div>
                {selectedShift.clock_in_accuracy && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600' }}>Accuracy:</span>{' '}
                    {selectedShift.clock_in_accuracy.toFixed(2)}m
                  </div>
                )}
                <button
                  onClick={() => openInMaps(selectedShift.clock_in_latitude, selectedShift.clock_in_longitude)}
                  style={{
                    backgroundColor: '#0b3ea8',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📍 Open in Google Maps
                </button>
              </div>
            )}

            {selectedShift.clock_out_latitude && selectedShift.clock_out_longitude && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #dc2626' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: '#dc2626' }}>
                  🔴 Clock Out Location
                </h3>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>Time:</span>{' '}
                  {selectedShift.clock_out ? new Date(selectedShift.clock_out).toLocaleString() : 'N/A'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>Coordinates:</span>{' '}
                  {selectedShift.clock_out_latitude.toFixed(6)}, {selectedShift.clock_out_longitude.toFixed(6)}
                </div>
                {selectedShift.clock_out_accuracy && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600' }}>Accuracy:</span>{' '}
                    {selectedShift.clock_out_accuracy.toFixed(2)}m
                  </div>
                )}
                <button
                  onClick={() => openInMaps(selectedShift.clock_out_latitude, selectedShift.clock_out_longitude)}
                  style={{
                    backgroundColor: '#0b3ea8',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📍 Open in Google Maps
                </button>
              </div>
            )}

            {/* Location History */}
            {locationHistory.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>
                  📌 Location History ({locationHistory.length} updates)
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {locationHistory.map((loc, index) => (
                    <div
                      key={loc.id}
                      style={{
                        backgroundColor: '#f9fafb',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ fontWeight: '700', marginBottom: '8px', fontSize: '15px' }}>
                        Update #{index + 1}
                      </div>
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600' }}>Time:</span>{' '}
                        {new Date(loc.recorded_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600' }}>Location:</span>{' '}
                        {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                      </div>
                      <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                        <span style={{ fontWeight: '600' }}>Accuracy:</span>{' '}
                        {loc.accuracy ? `${loc.accuracy.toFixed(2)}m` : 'N/A'}
                      </div>
                      <button
                        onClick={() => openInMaps(loc.latitude, loc.longitude)}
                        style={{
                          backgroundColor: '#fc6b04',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        📍 View on Map
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locationHistory.length === 0 && !loading && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  No location history recorded for this shift
                </div>
              </div>
            )}
          </>
        )}

        {selectedEmployeeId && shifts.length === 0 && !loading && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
              No shifts found for this employee
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import DesktopHeader from "../Components/DesktopHeader";
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { notify, confirmDialog } from '../lib/notify';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const BRAND = { bg: "#0b3ea8", primary: "#fc6b04ff" };

// ── Map helper (must be outside parent too) ───────────────────────────────────
function LocationMarker({ position, setPosition, flyTo }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo.lat, flyTo.lng], 16);
  }, [flyTo]);
  return position === null ? null : <Marker position={position} />;
}

// ── FenceCard — defined OUTSIDE parent so it never gets re-created on state change ──
function FenceCard({
  fenceType, fence, employees,
  notif, expandedCard, savingNotif,
  onToggleExpand, onUpdateNotif, onToggleEmployee, onSaveNotif,
  onEditLoc, onDeleteLoc, onNavEdit,
}) {
  const key = `${fenceType}:${fence.id}`;
  const isExpanded = expandedCard === key;
  const hasGeo = fence.geofence_latitude && fence.geofence_longitude;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "2px solid #e5e7eb", overflow: "hidden", marginBottom: 12 }}>
      {/* Header */}
      <div
        style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: isExpanded ? "2px solid #e5e7eb" : "none" }}
        onClick={() => onToggleExpand(key)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>{fenceType === "project" ? "🏗️" : "🏢"}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{fence.name}</div>
            {fence.address && (
              <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fence.address}</div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, backgroundColor: fenceType === "project" ? "#dbeafe" : "#f3e8ff", color: fenceType === "project" ? "#1d4ed8" : "#7c3aed", fontWeight: 600 }}>
                {fenceType === "project" ? "Project" : "Company Location"}
              </span>
              {hasGeo ? (
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, backgroundColor: fence.geofence_enabled ? "#d1fae5" : "#f3f4f6", color: fence.geofence_enabled ? "#059669" : "#6b7280", fontWeight: 600 }}>
                  {fence.geofence_enabled ? "✅ Active" : "⚪ Inactive"}
                </span>
              ) : (
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 600 }}>📍 No pin set</span>
              )}
              {hasGeo && <span style={{ fontSize: 11, color: "#6b7280" }}>{fence.geofence_radius_meters}m radius</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); fenceType === "project" ? onNavEdit() : onEditLoc(fence); }}
            style={{ backgroundColor: BRAND.bg, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            ✏️ Edit Map
          </button>
          {fenceType === "company_location" && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteLoc(fence); }}
              style={{ backgroundColor: "transparent", color: "#ef4444", border: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}
            >🗑️</button>
          )}
          <span style={{ fontSize: 18, color: "#9ca3af" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Notification panel */}
      {isExpanded && (
        <div style={{ padding: 20, backgroundColor: "#f0f4ff", borderTop: "2px solid #e5e7eb" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: "#111827" }}>🔔 Notification Settings</h4>

          {/* Always notified */}
          <div style={{ backgroundColor: "#d1fae5", border: "2px solid #10b981", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>✅ Always Notified (automatic)</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ backgroundColor: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#065f46", border: "1px solid #10b981" }}>
                👷 The employee entering or exiting
              </div>
              <div style={{ backgroundColor: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#065f46", border: "1px solid #10b981" }}>
                🔑 You (Admin)
              </div>
            </div>
          </div>

          {/* Enter / Exit toggles */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", backgroundColor: "#fff", border: "2px solid #d1d5db", borderRadius: 10, padding: "10px 14px", flex: 1 }}>
              <input type="checkbox" checked={notif.notify_on_enter ?? true}
                onChange={(e) => onUpdateNotif(fenceType, fence.id, { notify_on_enter: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "#10b981" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>📍 Enable Enter Alert</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Fire when someone enters</div>
              </div>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", backgroundColor: "#fff", border: "2px solid #d1d5db", borderRadius: 10, padding: "10px 14px", flex: 1 }}>
              <input type="checkbox" checked={notif.notify_on_exit ?? true}
                onChange={(e) => onUpdateNotif(fenceType, fence.id, { notify_on_exit: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "#10b981" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>🚪 Enable Exit Alert</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Fire when someone leaves</div>
              </div>
            </label>
          </div>

          {/* Custom messages */}
          <div style={{ backgroundColor: "#fff", border: "2px solid #d1d5db", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>✏️ Custom Message Text</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
              Use <code style={{ backgroundColor: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{"{{name}}"}</code> for the employee's name and{" "}
              <code style={{ backgroundColor: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{"{{fence}}"}</code> for this location's name.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>📍 ENTER — sent to the employee</label>
                <input
                  value={notif.enter_message_self ?? ""}
                  onChange={(e) => onUpdateNotif(fenceType, fence.id, { enter_message_self: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111827", backgroundColor: "#fff" }}
                  placeholder="You've arrived at {{fence}}"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>📍 ENTER — sent to admin &amp; others</label>
                <input
                  value={notif.enter_message_others ?? ""}
                  onChange={(e) => onUpdateNotif(fenceType, fence.id, { enter_message_others: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111827", backgroundColor: "#fff" }}
                  placeholder="{{name}} arrived at {{fence}}"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>🚪 EXIT — sent to the employee</label>
                <input
                  value={notif.exit_message_self ?? ""}
                  onChange={(e) => onUpdateNotif(fenceType, fence.id, { exit_message_self: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111827", backgroundColor: "#fff" }}
                  placeholder="You've left {{fence}}"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>🚪 EXIT — sent to admin &amp; others</label>
                <input
                  value={notif.exit_message_others ?? ""}
                  onChange={(e) => onUpdateNotif(fenceType, fence.id, { exit_message_others: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", color: "#111827", backgroundColor: "#fff" }}
                  placeholder="{{name}} left {{fence}}"
                />
              </div>
            </div>
          </div>

          {/* Additional employees */}
          <div style={{ backgroundColor: "#fff", border: "2px solid #d1d5db", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>👥 Also Notify These Employees</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>These employees receive the admin/others message in addition to you and the triggering employee.</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={notif.notify_all_employees ?? false}
                onChange={(e) => onUpdateNotif(fenceType, fence.id, { notify_all_employees: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "#0b3ea8" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Notify ALL employees</span>
            </label>
            {!notif.notify_all_employees && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {employees.map((emp) => {
                  const uid = emp.user_id;
                  const selected = (notif.notify_employee_ids || []).includes(uid);
                  return (
                    <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", backgroundColor: selected ? "#dbeafe" : "#f9fafb", border: `2px solid ${selected ? "#3b82f6" : "#d1d5db"}`, borderRadius: 8, padding: "7px 11px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      <input type="checkbox" checked={selected}
                        onChange={() => onToggleEmployee(fenceType, fence.id, uid)}
                        style={{ width: 14, height: 14, accentColor: "#3b82f6" }} />
                      <span style={{ color: "#111827" }}>{emp.first_name} {emp.last_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => onSaveNotif(fenceType, fence.id)}
            disabled={savingNotif[key]}
            style={{ backgroundColor: "#10b981", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: savingNotif[key] ? 0.6 : 1 }}
          >
            {savingNotif[key] ? "Saving..." : "💾 Save Notification Settings"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_LOC_FORM = { name: "", geofence_radius_meters: 200, geofence_enabled: false };

export default function CompanyLocations() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [projectFences, setProjectFences] = useState([]);
  const [companyLocs, setCompanyLocs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [notifSettings, setNotifSettings] = useState({});
  const [savingNotif, setSavingNotif] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);

  // Location editor
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locForm, setLocForm] = useState(EMPTY_LOC_FORM);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([41.8781, -87.6298]);
  const [flyTo, setFlyTo] = useState(null);
  const [addressInput, setAddressInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [savingLoc, setSavingLoc] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => { if (user) loadAll(); }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [projRes, locRes, empRes] = await Promise.all([
        supabase.from("projects").select("id, name, address, geofence_latitude, geofence_longitude, geofence_radius_meters, geofence_enabled").not("geofence_latitude", "is", null).order("name"),
        supabase.from("company_locations").select("*").eq("company_id", user.id).order("name"),
        supabase.from("employees").select("id, user_id, first_name, last_name").order("first_name"),
      ]);
      setProjectFences(projRes.data || []);
      setCompanyLocs(locRes.data || []);
      setEmployees(empRes.data || []);

      const fenceIds = [
        ...(projRes.data || []).map((p) => p.id),
        ...(locRes.data || []).map((l) => l.id),
      ];
      if (fenceIds.length > 0) {
        const { data: ns } = await supabase.from("geofence_notification_settings").select("*").in("fence_id", fenceIds);
        const map = {};
        (ns || []).forEach((s) => { map[`${s.fence_type}:${s.fence_id}`] = s; });
        setNotifSettings(map);
      }
    } catch (err) { console.error("loadAll error:", err); }
    finally { setLoading(false); }
  }

  // ── Notification helpers ──────────────────────────────────────────
  function getNotif(fenceType, fenceId) {
    return notifSettings[`${fenceType}:${fenceId}`] || {
      notify_on_enter: true,
      notify_on_exit: true,
      notify_all_employees: false,
      notify_employee_ids: [],
      enter_message_self: "You've arrived at {{fence}}",
      exit_message_self: "You've left {{fence}}",
      enter_message_others: "{{name}} arrived at {{fence}}",
      exit_message_others: "{{name}} left {{fence}}",
    };
  }

  function updateNotif(fenceType, fenceId, patch) {
    const key = `${fenceType}:${fenceId}`;
    setNotifSettings((prev) => ({
      ...prev,
      [key]: { ...getNotif(fenceType, fenceId), ...patch },
    }));
  }

  function toggleEmployee(fenceType, fenceId, empUserId) {
    const current = getNotif(fenceType, fenceId);
    const ids = current.notify_employee_ids || [];
    const next = ids.includes(empUserId) ? ids.filter((x) => x !== empUserId) : [...ids, empUserId];
    updateNotif(fenceType, fenceId, { notify_employee_ids: next });
  }

  async function saveNotif(fenceType, fenceId) {
    const key = `${fenceType}:${fenceId}`;
    setSavingNotif((s) => ({ ...s, [key]: true }));
    try {
      const current = getNotif(fenceType, fenceId);
      const payload = {
        company_id: user.id,
        fence_type: fenceType,
        fence_id: fenceId,
        notify_on_enter: current.notify_on_enter ?? true,
        notify_on_exit: current.notify_on_exit ?? true,
        notify_all_employees: current.notify_all_employees ?? false,
        notify_employee_ids: current.notify_employee_ids || [],
        enter_message_self: current.enter_message_self || "You've arrived at {{fence}}",
        exit_message_self: current.exit_message_self || "You've left {{fence}}",
        enter_message_others: current.enter_message_others || "{{name}} arrived at {{fence}}",
        exit_message_others: current.exit_message_others || "{{name}} left {{fence}}",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("geofence_notification_settings").upsert(payload, { onConflict: "fence_type,fence_id" });
      if (error) throw error;
      setSuccessMsg("Notification settings saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) { notify("Error saving: " + err.message); }
    finally { setSavingNotif((s) => ({ ...s, [key]: false })); }
  }

  // ── Toggle card expand ────────────────────────────────────────────
  function handleToggleExpand(key) {
    setExpandedCard((prev) => (prev === key ? null : key));
  }

  // ── Company Location editor ───────────────────────────────────────
  function openAddLoc() {
    setShowAddLoc(true); setEditingLoc(null); setLocForm(EMPTY_LOC_FORM);
    setMarkerPosition(null); setAddressInput(""); setSearchError(""); setFlyTo(null);
    setMapCenter([41.8781, -87.6298]);
  }

  function openEditLoc(loc) {
    setShowAddLoc(true); setEditingLoc(loc);
    setLocForm({ name: loc.name, geofence_radius_meters: loc.geofence_radius_meters || 200, geofence_enabled: loc.geofence_enabled || false });
    setAddressInput(loc.address || ""); setSearchError(""); setFlyTo(null);
    if (loc.geofence_latitude && loc.geofence_longitude) {
      const pos = { lat: parseFloat(loc.geofence_latitude), lng: parseFloat(loc.geofence_longitude) };
      setMarkerPosition(pos); setMapCenter([pos.lat, pos.lng]);
    } else { setMarkerPosition(null); setMapCenter([41.8781, -87.6298]); }
  }

  async function handleAddressSearch() {
    if (!addressInput.trim()) return;
    setSearchLoading(true); setSearchError("");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressInput.trim())}&format=json&limit=1`, { headers: { "Accept-Language": "en" } });
      const results = await res.json();
      if (!results || results.length === 0) { setSearchError("Address not found."); return; }
      const newPos = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      setMarkerPosition(newPos); setFlyTo({ ...newPos, ts: Date.now() });
    } catch { setSearchError("Error searching address."); }
    finally { setSearchLoading(false); }
  }

  async function saveLoc() {
    if (!locForm.name.trim()) { notify("Enter a location name."); return; }
    setSavingLoc(true);
    try {
      const payload = {
        company_id: user.id, name: locForm.name.trim(),
        address: addressInput.trim() || null,
        geofence_latitude: markerPosition?.lat ?? null,
        geofence_longitude: markerPosition?.lng ?? null,
        geofence_radius_meters: locForm.geofence_radius_meters,
        geofence_enabled: locForm.geofence_enabled,
        updated_at: new Date().toISOString(),
      };
      if (editingLoc) {
        const { error } = await supabase.from("company_locations").update(payload).eq("id", editingLoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_locations").insert([payload]);
        if (error) throw error;
      }
      setSuccessMsg(editingLoc ? "Location updated!" : "Location created!");
      setTimeout(() => setSuccessMsg(""), 3000);
      setShowAddLoc(false); await loadAll();
    } catch (err) { notify("Error saving: " + err.message); }
    finally { setSavingLoc(false); }
  }

  async function deleteLoc(loc) {
    if (!await confirmDialog(`Delete "${loc.name}"?`)) return;
    await supabase.from("company_locations").delete().eq("id", loc.id);
    await loadAll();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
        <DesktopHeader />
        <div style={{ padding: 40, textAlign: "center", color: "#fff" }}><p>Loading geofences...</p></div>
      </div>
    );
  }

  const totalFences = projectFences.length + companyLocs.length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <button onClick={() => nav(-1)} style={{ backgroundColor: "#374151", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
              ← Back
            </button>
            <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 4 }}>📍 Geofence Manager</h1>
            <p style={{ color: "#e5e7eb", fontSize: 15, margin: 0 }}>
              {totalFences} geofence{totalFences !== 1 ? "s" : ""} — projects &amp; company locations. Click any card to configure notifications.
            </p>
          </div>
          <button onClick={openAddLoc} style={{ backgroundColor: BRAND.primary, color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>
            + Add Company Location
          </button>
        </div>

        {successMsg && (
          <div style={{ backgroundColor: "#10b981", color: "#fff", padding: 16, borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>✓ {successMsg}</div>
        )}

        {/* Add/Edit Location Panel */}
        {showAddLoc && (
          <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, border: "2px solid #0b3ea8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingLoc ? `✏️ Edit: ${editingLoc.name}` : "➕ New Company Location"}</h3>
              <button onClick={() => setShowAddLoc(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Location Name *</label>
                <input value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} placeholder="Shop, Warehouse, Office..." style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "2px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", marginBottom: 12 }} />
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>🔍 Search Address</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={addressInput} onChange={(e) => setAddressInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddressSearch(); }} placeholder="123 Main St, City, ST" style={{ flex: 1, padding: "10px 12px", fontSize: 14, border: "2px solid #d1d5db", borderRadius: 8 }} />
                  <button onClick={handleAddressSearch} disabled={searchLoading || !addressInput.trim()} style={{ backgroundColor: BRAND.bg, color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    {searchLoading ? "..." : "Find"}
                  </button>
                </div>
                {searchError && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 8px 0" }}>{searchError}</p>}
                <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 16px 0" }}>Or click the map to drop a pin.</p>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Radius: {locForm.geofence_radius_meters}m ({(locForm.geofence_radius_meters * 3.28084).toFixed(0)} ft)
                </label>
                <input type="range" min="50" max="2000" step="10" value={locForm.geofence_radius_meters} onChange={(e) => setLocForm((f) => ({ ...f, geofence_radius_meters: parseInt(e.target.value) }))} style={{ width: "100%", marginBottom: 12 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
                  <input type="checkbox" checked={locForm.geofence_enabled} onChange={(e) => setLocForm((f) => ({ ...f, geofence_enabled: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Enable Geofence</span>
                </label>
                {markerPosition && (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, border: "1px solid #10b981", fontSize: 12, color: "#374151", marginBottom: 12 }}>
                    📌 Pin: {markerPosition.lat?.toFixed(5)}, {markerPosition.lng?.toFixed(5)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={saveLoc} disabled={savingLoc || !locForm.name.trim()} style={{ flex: 1, backgroundColor: "#10b981", color: "#fff", border: "none", padding: "12px 0", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: savingLoc ? 0.7 : 1 }}>
                    {savingLoc ? "Saving..." : "💾 Save Location"}
                  </button>
                  <button onClick={() => setShowAddLoc(false)} style={{ backgroundColor: "#fff", color: "#374151", border: "2px solid #d1d5db", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
              <div style={{ borderRadius: 10, overflow: "hidden", height: 380 }}>
                <MapContainer key={editingLoc?.id || "new"} center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationMarker position={markerPosition} setPosition={setMarkerPosition} flyTo={flyTo} />
                  {markerPosition && (
                    <Circle center={markerPosition} radius={locForm.geofence_radius_meters} pathOptions={{ color: locForm.geofence_enabled ? "#10b981" : "#94a3b8", fillColor: locForm.geofence_enabled ? "#10b981" : "#94a3b8", fillOpacity: 0.2 }} />
                  )}
                </MapContainer>
              </div>
            </div>
          </div>
        )}

        {/* Project Geofences */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>🏗️ Project Geofences ({projectFences.length})</h2>
          {projectFences.length === 0 ? (
            <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, textAlign: "center", color: "#e5e7eb", fontSize: 14 }}>
              No projects have a geofence set yet.
            </div>
          ) : (
            projectFences.map((p) => (
              <FenceCard
                key={p.id}
                fenceType="project"
                fence={p}
                employees={employees}
                notif={getNotif("project", p.id)}
                expandedCard={expandedCard}
                savingNotif={savingNotif}
                onToggleExpand={handleToggleExpand}
                onUpdateNotif={updateNotif}
                onToggleEmployee={toggleEmployee}
                onSaveNotif={saveNotif}
                onNavEdit={() => nav(`/project/${p.id}/geofence`)}
                onEditLoc={() => {}}
                onDeleteLoc={() => {}}
              />
            ))
          )}
        </div>

        {/* Company Locations */}
        <div>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>🏢 Company Locations ({companyLocs.length})</h2>
          {companyLocs.length === 0 ? (
            <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, textAlign: "center", color: "#e5e7eb", fontSize: 14 }}>
              No company locations yet. Click "+ Add Company Location" to add your shop, warehouse, etc.
            </div>
          ) : (
            companyLocs.map((l) => (
              <FenceCard
                key={l.id}
                fenceType="company_location"
                fence={l}
                employees={employees}
                notif={getNotif("company_location", l.id)}
                expandedCard={expandedCard}
                savingNotif={savingNotif}
                onToggleExpand={handleToggleExpand}
                onUpdateNotif={updateNotif}
                onToggleEmployee={toggleEmployee}
                onSaveNotif={saveNotif}
                onNavEdit={() => {}}
                onEditLoc={openEditLoc}
                onDeleteLoc={deleteLoc}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
}

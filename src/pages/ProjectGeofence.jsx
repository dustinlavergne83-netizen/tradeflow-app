import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DesktopHeader from "../Components/DesktopHeader";
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function ProjectGeofence() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapCenter, setMapCenter] = useState([41.8781, -87.6298]); // Chicago default
  const [markerPosition, setMarkerPosition] = useState(null);
  const [radius, setRadius] = useState(200);
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      setProject(data);
      
      // If geofence exists, set map to that location
      if (data.geofence_latitude && data.geofence_longitude) {
        const pos = { lat: parseFloat(data.geofence_latitude), lng: parseFloat(data.geofence_longitude) };
        setMapCenter([pos.lat, pos.lng]);
        setMarkerPosition(pos);
        setRadius(data.geofence_radius_meters || 200);
        setGeofenceEnabled(data.geofence_enabled || false);
      }
    } catch (err) {
      console.error("Error loading project:", err);
      alert("Error loading project");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!markerPosition) {
      alert("Please click on the map to set the geofence location");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          geofence_latitude: markerPosition.lat,
          geofence_longitude: markerPosition.lng,
          geofence_radius_meters: radius,
          geofence_enabled: geofenceEnabled,
        })
        .eq("id", projectId);

      if (error) throw error;

      setSuccessMessage("Geofence saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error saving geofence:", err);
      alert("Error saving geofence");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setMarkerPosition(null);
    setRadius(200);
    setGeofenceEnabled(false);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this geofence?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          geofence_latitude: null,
          geofence_longitude: null,
          geofence_radius_meters: null,
          geofence_enabled: false,
        })
        .eq("id", projectId);

      if (error) throw error;

      setMarkerPosition(null);
      setRadius(200);
      setGeofenceEnabled(false);
      setSuccessMessage("Geofence deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting geofence:", err);
      alert("Error deleting geofence");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
        <DesktopHeader />
        <div style={{ padding: 40, textAlign: "center", color: "#fff" }}>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />
      
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => nav(-1)}
            style={{
              backgroundColor: "#374151",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            ← Back
          </button>
          
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            Geofence Setup
          </h1>
          <p style={{ color: "#e5e7eb", fontSize: 16, margin: 0 }}>
            {project?.name || "Unknown Project"}
          </p>
        </div>

        {successMessage && (
          <div style={{
            backgroundColor: "#10b981",
            color: "#fff",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            fontWeight: 600,
          }}>
            ✓ {successMessage}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24 }}>
          {/* Map */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", height: 600 }}>
            <MapContainer
              center={mapCenter}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={markerPosition} setPosition={setMarkerPosition} />
              {markerPosition && (
                <Circle
                  center={markerPosition}
                  radius={radius}
                  pathOptions={{ color: geofenceEnabled ? '#10b981' : '#94a3b8', fillColor: geofenceEnabled ? '#10b981' : '#94a3b8', fillOpacity: 0.2 }}
                />
              )}
            </MapContainer>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Instructions */}
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
                📍 How to Use
              </h3>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: "#374151" }}>
                <li>Click on the map to set the geofence center point</li>
                <li>Adjust the radius using the slider below</li>
                <li>Toggle geofence on/off</li>
                <li>Click "Save Geofence" to apply changes</li>
              </ol>
            </div>

            {/* Radius Control */}
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600, color: "#111" }}>
                Radius: {radius} meters ({(radius * 3.28084).toFixed(0)} feet)
              </label>
              <input
                type="range"
                min="50"
                max="2000"
                step="10"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                <span>50m</span>
                <span>2000m</span>
              </div>
            </div>

            {/* Enable Toggle */}
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={geofenceEnabled}
                  onChange={(e) => setGeofenceEnabled(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Enable Geofence</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Activate location tracking for this project
                  </div>
                </div>
              </label>
            </div>

            {/* Current Settings */}
            {markerPosition && (
              <div style={{ backgroundColor: "#f0fdf4", borderRadius: 12, padding: 20, border: "2px solid #10b981" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#111" }}>
                  Current Location
                </h4>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <div><strong>Lat:</strong> {markerPosition.lat.toFixed(6)}</div>
                  <div><strong>Lng:</strong> {markerPosition.lng.toFixed(6)}</div>
                  <div><strong>Radius:</strong> {radius}m ({(radius * 3.28084).toFixed(0)}ft)</div>
                  <div><strong>Status:</strong> {geofenceEnabled ? "✅ Enabled" : "⚠️ Disabled"}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleSave}
                disabled={saving || !markerPosition}
                style={{
                  backgroundColor: markerPosition ? "#10b981" : "#94a3b8",
                  color: "#fff",
                  border: "none",
                  padding: "14px 24px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: markerPosition ? "pointer" : "not-allowed",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "💾 Save Geofence"}
              </button>

              <button
                onClick={handleClear}
                disabled={saving}
                style={{
                  backgroundColor: "#fff",
                  color: "#374151",
                  border: "2px solid #d1d5db",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear Selection
              </button>

              {project?.geofence_latitude && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🗑️ Delete Geofence
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

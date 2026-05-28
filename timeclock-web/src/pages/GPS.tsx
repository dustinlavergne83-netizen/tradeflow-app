import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface GpsShift {
  id: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  inLat: number | null;
  inLng: number | null;
  outLat: number | null;
  outLng: number | null;
}

interface MapModal {
  title: string;
  lat: number;
  lng: number;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function GPS() {
  const { company } = useAuth();
  const [shifts, setShifts] = useState<GpsShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(startOfWeek());
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState("");
  const [mapModal, setMapModal] = useState<MapModal | null>(null);

  useEffect(() => { if (company?.id) load(); }, [company?.id, dateFrom, dateTo]);

  async function load() {
    if (!company) return;
    setLoading(true);
    try {
      const { data: companyEmps } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name")
        .eq("company_id", company.id);

      const companyUserIds = (companyEmps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
      if (!companyUserIds.length) { setShifts([]); return; }

      const empMap: Record<string, string> = {};
      for (const e of (companyEmps ?? [])) {
        empMap[e.user_id] = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();
      }

      const { data: rows } = await supabase
        .from("shifts")
        .select("id, user_id, clock_in, clock_out, clock_in_latitude, clock_in_longitude, clock_out_latitude, clock_out_longitude")
        .gte("clock_in", dateFrom + "T00:00:00")
        .lte("clock_in", dateTo + "T23:59:59")
        .in("user_id", companyUserIds)
        .order("clock_in", { ascending: false });

      setShifts(
        (rows ?? []).map((r: any) => ({
          id: r.id,
          employeeName: empMap[r.user_id] ?? "Unknown",
          date: fmtDate(r.clock_in),
          clockIn: fmtDateTime(r.clock_in),
          clockOut: r.clock_out ? fmtDateTime(r.clock_out) : null,
          inLat:  r.clock_in_latitude  ?? null,
          inLng:  r.clock_in_longitude ?? null,
          outLat: r.clock_out_latitude  ?? null,
          outLng: r.clock_out_longitude ?? null,
        }))
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const q = search.toLowerCase().trim();
  const filtered = shifts.filter((s) => {
    if (!q) return true;
    return (s.employeeName ?? "").toLowerCase().includes(q);
  });

  const withGps    = filtered.filter((s) => s.inLat || s.outLat);
  const withoutGps = filtered.filter((s) => !s.inLat && !s.outLat);
  const gpsRate    = filtered.length > 0 ? Math.round((withGps.length / filtered.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">📍 GPS Locations</h1>
        <p className="text-gray-500 text-sm mt-0.5">Clock-in and clock-out GPS coordinates per shift</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search Employee</label>
          <input type="text" placeholder="Name…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
          <p className="text-xs text-blue-500 font-semibold">GPS RATE</p>
          <p className="text-xl font-black text-blue-700">{gpsRate}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">📍</p>
            <p className="text-sm font-medium">No shifts found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Clock In</th>
                  <th className="px-5 py-3 text-left">In Location</th>
                  <th className="px-5 py-3 text-left">Clock Out</th>
                  <th className="px-5 py-3 text-left">Out Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900">👷 {s.employeeName}</td>
                    <td className="px-5 py-3 text-gray-600">{s.date}</td>
                    <td className="px-5 py-3 text-gray-700">{s.clockIn}</td>
                    <td className="px-5 py-3">
                      {s.inLat && s.inLng ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">
                            {s.inLat.toFixed(4)}, {s.inLng.toFixed(4)}
                          </span>
                          <button
                            onClick={() => setMapModal({ title: `${s.employeeName} — Clock In`, lat: s.inLat!, lng: s.inLng! })}
                            className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            📍 View
                          </button>
                          <a
                            href={mapsUrl(s.inLat, s.inLng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors whitespace-nowrap"
                          >
                            ↗ Maps
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No GPS</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {s.clockOut ? (
                        <span className="text-gray-700">{s.clockOut}</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">🟢 Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {s.outLat && s.outLng ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">
                            {s.outLat.toFixed(4)}, {s.outLng.toFixed(4)}
                          </span>
                          <button
                            onClick={() => setMapModal({ title: `${s.employeeName} — Clock Out`, lat: s.outLat!, lng: s.outLng! })}
                            className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            📍 View
                          </button>
                          <a
                            href={mapsUrl(s.outLat, s.outLng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors whitespace-nowrap"
                          >
                            ↗ Maps
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{s.clockOut ? "No GPS" : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {withoutGps.length > 0 && withGps.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {withoutGps.length} shift{withoutGps.length !== 1 ? "s" : ""} without GPS data (employee may have denied location permission)
        </p>
      )}

      {/* Map Modal */}
      {mapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-black text-gray-900">{mapModal.title}</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {mapModal.lat.toFixed(6)}, {mapModal.lng.toFixed(6)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={mapsUrl(mapModal.lat, mapModal.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-white px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#0b3ea8" }}
                >
                  Open in Google Maps ↗
                </a>
                <button
                  onClick={() => setMapModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Embedded map via Google Maps iframe (no API key needed for basic embed) */}
            <div className="relative w-full" style={{ height: "420px" }}>
              <iframe
                title="GPS Location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${mapModal.lat},${mapModal.lng}&z=16&output=embed`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

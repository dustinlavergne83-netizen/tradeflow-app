import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface TimeEntry {
  id: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  project: string;
}

function parseHours(clockIn: string, clockOut: string | null): number | null {
  if (!clockOut) return null;
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.round((diff / 3600000) * 100) / 100;
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

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Timesheets() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(startOfWeek());
  const [dateTo,   setDateTo]   = useState(today());
  const [search,   setSearch]   = useState("");

  useEffect(() => { if (company?.id) load(); }, [company?.id, dateFrom, dateTo]);

  async function load() {
    if (!company) return;
    setLoading(true);
    try {
      // Get company employees first for user_id filtering
      const { data: companyEmps } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name")
        .eq("company_id", company.id);

      const companyUserIds = (companyEmps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
      if (!companyUserIds.length) { setEntries([]); return; }

      const empMap: Record<string, string> = {};
      for (const e of (companyEmps ?? [])) empMap[e.user_id] = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();

      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, user_id, clock_in, clock_out")
        .gte("clock_in", dateFrom + "T00:00:00")
        .lte("clock_in", dateTo + "T23:59:59")
        .in("user_id", companyUserIds)
        .order("clock_in", { ascending: false });

      if (!shifts?.length) { setEntries([]); return; }

      const shiftIds = shifts.map((s: any) => s.id);
      const { data: segs } = await supabase.from("shift_segments")
        .select("shift_id, project_task")
        .in("shift_id", shiftIds)
        .order("start_at", { ascending: true });
      const segMap: Record<string, string> = {};
      for (const seg of (segs ?? [])) {
        if (!segMap[seg.shift_id]) segMap[seg.shift_id] = seg.project_task ?? "—";
      }

      setEntries(
        shifts.map((s: any) => ({
          id: s.id,
          employeeName: empMap[s.user_id] ?? "Unknown",
          date: fmtDate(s.clock_in),
          clockIn: fmtDateTime(s.clock_in),
          clockOut: s.clock_out ? fmtDateTime(s.clock_out) : null,
          totalHours: parseHours(s.clock_in, s.clock_out),
          project: segMap[s.id] ?? "—",
        }))
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const rows = [
      ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Job"],
      ...filtered.map((e) => [
        e.employeeName, e.date, e.clockIn, e.clockOut ?? "Still clocked in",
        e.totalHours?.toString() ?? "—", e.project,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `timesheets-${dateFrom}-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }

  const q = search.toLowerCase().trim();
  const filtered = entries.filter((e) => {
    if (!q) return true;
    return (
      (e.employeeName ?? "").toLowerCase().includes(q) ||
      (e.project ?? "").toLowerCase().includes(q)
    );
  });

  const totalHours = filtered.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Timesheets</h1>
          <p className="text-gray-500 text-sm mt-0.5">View and manage employee time entries</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "#0b3ea8" }}
        >
          📤 Export CSV
        </button>
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
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <input type="text" placeholder="Employee or job…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
          <p className="text-xs text-blue-500 font-semibold">TOTAL HOURS</p>
          <p className="text-xl font-black text-blue-700">{totalHours.toFixed(1)}</p>
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
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm font-medium">No time entries found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Clock In</th>
                  <th className="px-5 py-3 text-left">Clock Out</th>
                  <th className="px-5 py-3 text-left">Hours</th>
                  <th className="px-5 py-3 text-left">Job</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900">👷 {e.employeeName}</td>
                    <td className="px-5 py-3 text-gray-600">{e.date}</td>
                    <td className="px-5 py-3 text-gray-700">{e.clockIn}</td>
                    <td className="px-5 py-3">
                      {e.clockOut ? (
                        <span className="text-gray-700">{e.clockOut}</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          🟢 Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {e.totalHours != null ? (
                        <span className="font-bold text-blue-700">{e.totalHours.toFixed(2)}h</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{e.project}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

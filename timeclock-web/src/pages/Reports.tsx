import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";

interface EmployeeSummary {
  name: string;
  hours: number;
  shifts: number;
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

export default function Reports() {
  const { company } = useAuth();
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dateFrom, setDateFrom]   = useState(startOfWeek());
  const [dateTo,   setDateTo]     = useState(today());
  const [totalHours, setTotal]    = useState(0);

  useEffect(() => { if (company?.id) load(); }, [company?.id, dateFrom, dateTo]);

  async function load() {
    if (!company) return;
    setLoading(true);
    try {
      // Get company employee user_ids for filtering
      const { data: companyEmps } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name")
        .eq("company_id", company.id);

      const companyUserIds = (companyEmps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
      if (!companyUserIds.length) { setSummaries([]); setTotal(0); return; }

      const empMap: Record<string, string> = {};
      for (const e of (companyEmps ?? [])) empMap[e.user_id] = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();

      const { data: shifts } = await supabase
        .from("shifts")
        .select("user_id, clock_in, clock_out")
        .gte("clock_in", dateFrom + "T00:00:00")
        .lte("clock_in", dateTo + "T23:59:59")
        .in("user_id", companyUserIds)
        .not("clock_out", "is", null);

      if (!shifts?.length) { setSummaries([]); setTotal(0); return; }

      const byEmp: Record<string, { hours: number; shifts: number }> = {};
      for (const s of shifts as any[]) {
        const hrs = (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000;
        const key = empMap[s.user_id] ?? "Unknown";
        if (!byEmp[key]) byEmp[key] = { hours: 0, shifts: 0 };
        byEmp[key].hours  += hrs;
        byEmp[key].shifts += 1;
      }

      const result = Object.entries(byEmp)
        .map(([name, v]) => ({ name, hours: Math.round(v.hours * 100) / 100, shifts: v.shifts }))
        .sort((a, b) => b.hours - a.hours);

      setSummaries(result);
      setTotal(result.reduce((sum, r) => sum + r.hours, 0));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const rows = [
      ["Employee", "Total Hours", "Shifts"],
      ...summaries.map((s) => [s.name, s.hours.toFixed(2), s.shifts.toString()]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `report-${dateFrom}-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported!");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Hours by employee for any date range</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "#0b3ea8" }}
        >
          📤 Export CSV
        </button>
      </div>

      {/* Date filters */}
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
          <p className="text-xs text-blue-500 font-semibold">TEAM TOTAL</p>
          <p className="text-xl font-black text-blue-700">{totalHours.toFixed(1)}h</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm font-medium">No completed shifts for this period</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-black text-gray-800 mb-4">Hours by Employee</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summaries} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}h`, "Hours"]} />
                <Bar dataKey="hours" fill="#0b3ea8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-right">Shifts</th>
                  <th className="px-5 py-3 text-right">Total Hours</th>
                  <th className="px-5 py-3 text-right">Avg/Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.map((s) => (
                  <tr key={s.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900">👷 {s.name}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{s.shifts}</td>
                    <td className="px-5 py-3 text-right font-bold text-blue-700">{s.hours.toFixed(2)}h</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {(s.hours / s.shifts).toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

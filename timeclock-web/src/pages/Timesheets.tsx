import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface TimeEntry {
  id: string;
  employeeName: string;
  role: string;
  hourlyRate: number | null;
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  earnings: number | null;
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

type FilterTab = "all" | "employees" | "contractors";

export default function Timesheets() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(startOfWeek());
  const [dateTo,   setDateTo]   = useState(today());
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState<FilterTab>("all");

  useEffect(() => { if (company?.id) load(); }, [company?.id, dateFrom, dateTo]);

  async function load() {
    if (!company) return;
    setLoading(true);
    try {
      // Get company employees (including contractors) with role + hourly_rate
      const { data: companyEmps } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name, role, hourly_rate")
        .eq("company_id", company.id);

      const companyUserIds = (companyEmps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
      if (!companyUserIds.length) { setEntries([]); return; }

      const empMap: Record<string, { name: string; role: string; rate: number | null }> = {};
      for (const e of (companyEmps ?? [])) {
        empMap[e.user_id] = {
          name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
          role: e.role ?? "employee",
          rate: e.hourly_rate ?? null,
        };
      }

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
        shifts.map((s: any) => {
          const emp = empMap[s.user_id];
          const hours = parseHours(s.clock_in, s.clock_out);
          const rate = emp?.rate ?? null;
          const earnings = (hours != null && rate != null) ? Math.round(hours * rate * 100) / 100 : null;
          return {
            id: s.id,
            employeeName: emp?.name ?? "Unknown",
            role: emp?.role ?? "employee",
            hourlyRate: rate,
            date: fmtDate(s.clock_in),
            clockIn: fmtDateTime(s.clock_in),
            clockOut: s.clock_out ? fmtDateTime(s.clock_out) : null,
            totalHours: hours,
            earnings,
            project: segMap[s.id] ?? "—",
          };
        })
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    // For contractors: export Name + Amount (CPA format). For employees: standard hours.
    const isContractorTab = tab === "contractors";
    const headers = isContractorTab
      ? ["Contractor", "Date", "Job", "Hours", "Rate", "Amount Paid"]
      : ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Job"];

    const rows = [
      headers,
      ...tabFiltered.map((e) =>
        isContractorTab
          ? [
              e.employeeName,
              e.date,
              e.project,
              e.totalHours?.toFixed(2) ?? "—",
              e.hourlyRate ? `$${e.hourlyRate}/hr` : "—",
              e.earnings ? `$${e.earnings.toFixed(2)}` : "—",
            ]
          : [
              e.employeeName,
              e.date,
              e.clockIn,
              e.clockOut ?? "Still clocked in",
              e.totalHours?.toString() ?? "—",
              e.project,
            ]
      ),
    ];

    // For CPA export (contractors), add a summary row
    if (isContractorTab) {
      rows.push([]);
      // Group by contractor
      const byName: Record<string, number> = {};
      for (const e of tabFiltered) {
        if (!byName[e.employeeName]) byName[e.employeeName] = 0;
        byName[e.employeeName] += e.earnings ?? 0;
      }
      rows.push(["CONTRACTOR PAYMENT SUMMARY", "", "", "", "", ""]);
      for (const [name, total] of Object.entries(byName)) {
        rows.push([name, "", "", "", "TOTAL PAID:", `$${total.toFixed(2)}`]);
      }
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const suffix = isContractorTab ? "contractors-cpa" : "timesheets";
    a.href = url; a.download = `${suffix}-${dateFrom}-${dateTo}.csv`; a.click();
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

  const tabFiltered = filtered.filter((e) => {
    if (tab === "employees")   return e.role !== "contractor";
    if (tab === "contractors") return e.role === "contractor";
    return true;
  });

  const totalHours    = tabFiltered.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
  const totalEarnings = tabFiltered
    .filter((e) => e.role === "contractor")
    .reduce((sum, e) => sum + (e.earnings ?? 0), 0);

  const employeeCount   = filtered.filter((e) => e.role !== "contractor").length;
  const contractorCount = filtered.filter((e) => e.role === "contractor").length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Timesheets</h1>
          <p className="text-gray-500 text-sm mt-0.5">View and manage employee & contractor time entries</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "#0b3ea8" }}
        >
          📤 {tab === "contractors" ? "Export CPA Report" : "Export CSV"}
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
          <input type="text" placeholder="Name or job…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
          <p className="text-xs text-blue-500 font-semibold">TOTAL HOURS</p>
          <p className="text-xl font-black text-blue-700">{totalHours.toFixed(1)}</p>
        </div>
        {tab === "contractors" && totalEarnings > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-orange-500 font-semibold">TOTAL PAID</p>
            <p className="text-xl font-black text-orange-700">${totalEarnings.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["all", "employees", "contractors"] as FilterTab[]).map((t) => {
          const label = t === "all"
            ? `All (${filtered.length})`
            : t === "employees"
            ? `👷 Employees (${employeeCount})`
            : `🔧 Contractors (${contractorCount})`;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                tab === t
                  ? t === "contractors"
                    ? "bg-orange-500 text-white"
                    : "text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              style={tab === t && t !== "contractors" ? { backgroundColor: "#0b3ea8" } : {}}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tabFiltered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm font-medium">No time entries found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Clock In</th>
                  <th className="px-5 py-3 text-left">Clock Out</th>
                  <th className="px-5 py-3 text-left">Hours</th>
                  <th className="px-5 py-3 text-left">Job</th>
                  {tab !== "employees" && (
                    <th className="px-5 py-3 text-left">Earnings</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tabFiltered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {e.role === "contractor" ? (
                        <span className="flex items-center gap-2">
                          🔧 {e.employeeName}
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            Contractor
                          </span>
                        </span>
                      ) : (
                        <span>👷 {e.employeeName}</span>
                      )}
                    </td>
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
                    {tab !== "employees" && (
                      <td className="px-5 py-3">
                        {e.role === "contractor" && e.earnings != null ? (
                          <span className="font-bold text-orange-700">${e.earnings.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contractor Summary Card (visible on contractors tab) */}
      {tab === "contractors" && tabFiltered.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="text-sm font-black text-orange-800 mb-3">🔧 Contractor Payment Summary (CPA Report)</h3>
          <div className="space-y-2">
            {(() => {
              const byName: Record<string, { hours: number; earnings: number; rate: number | null }> = {};
              for (const e of tabFiltered) {
                if (!byName[e.employeeName]) byName[e.employeeName] = { hours: 0, earnings: 0, rate: e.hourlyRate };
                byName[e.employeeName].hours    += e.totalHours ?? 0;
                byName[e.employeeName].earnings += e.earnings ?? 0;
              }
              return Object.entries(byName).map(([name, data]) => (
                <div key={name} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-orange-100">
                  <div>
                    <p className="text-sm font-bold text-gray-900">🔧 {name}</p>
                    <p className="text-xs text-gray-500">{data.hours.toFixed(2)} hrs @ {data.rate ? `$${data.rate}/hr` : "no rate set"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-orange-700">${data.earnings.toFixed(2)}</p>
                    <p className="text-xs text-orange-500">Amount Paid</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

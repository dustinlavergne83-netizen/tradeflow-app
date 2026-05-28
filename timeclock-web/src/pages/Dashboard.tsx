import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface ClockedInEmployee {
  id: string;
  name: string;
  clockIn: string;
  currentProject: string;
  lat: number | null;
  lng: number | null;
}

function elapsed(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt12(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export default function Dashboard() {
  const { company } = useAuth();
  const [clockedIn, setClockedIn] = useState<ClockedInEmployee[]>([]);
  const [stats, setStats] = useState({ employees: 0, jobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  async function load() {
    if (!company) return;
    setLoading(true);
    try {
      // Load all company employees first (for user_id mapping + shift filtering)
      const { data: companyEmps } = await supabase
        .from("employees")
        .select("user_id, first_name, last_name, is_test, is_active")
        .eq("company_id", company.id);

      const companyUserIds = (companyEmps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];

      const [empRes, jobRes, shiftRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true })
          .eq("company_id", company.id).eq("is_active", true),
        supabase.from("timeclock_projects").select("id", { count: "exact", head: true })
          .eq("company_id", company.id).eq("is_active", true),
        companyUserIds.length > 0
          ? supabase.from("shifts")
              .select("id, clock_in, user_id, clock_in_latitude, clock_in_longitude")
              .is("clock_out", null)
              .in("user_id", companyUserIds)
              .order("clock_in")
          : { data: [] as any[] },
      ]);

      setStats({ employees: empRes.count ?? 0, jobs: jobRes.count ?? 0 });

      const openShifts = (shiftRes.data ?? []) as any[];
      if (openShifts.length === 0) { setClockedIn([]); return; }

      const empMap: Record<string, any> = {};
      for (const e of (companyEmps ?? [])) empMap[e.user_id] = e;

      const shiftIds = openShifts.map((s: any) => s.id);
      const { data: segRows } = await supabase.from("shift_segments")
        .select("shift_id, project_task, end_at")
        .in("shift_id", shiftIds)
        .is("end_at", null);
      const segMap: Record<string, string> = {};
      for (const seg of (segRows ?? [])) segMap[seg.shift_id] = seg.project_task ?? "No Project";

      setClockedIn(
        openShifts
          .filter((s: any) => !empMap[s.user_id]?.is_test)
          .map((s: any) => {
            const emp = empMap[s.user_id];
            return {
              id: s.id,
              name: emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || "Unknown" : "Unknown",
              clockIn: s.clock_in,
              currentProject: segMap[s.id] ?? "No Project",
              lat: s.clock_in_latitude ?? null,
              lng: s.clock_in_longitude ?? null,
            };
          })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{company?.name ?? "TradeFlow"}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-3xl font-black text-green-600">{clockedIn.length}</p>
          <p className="text-sm font-semibold text-gray-500 mt-1">🟢 Clocked In Now</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-3xl font-black text-blue-700">{stats.employees}</p>
          <p className="text-sm font-semibold text-gray-500 mt-1">👷 Active Employees</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-3xl font-black text-orange-500">{stats.jobs}</p>
          <p className="text-sm font-semibold text-gray-500 mt-1">📋 Active Jobs</p>
        </div>
      </div>

      {/* Live clocked-in table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-gray-900">🟢 Currently Clocked In</h2>
          <button
            onClick={load}
            className="text-xs text-blue-600 font-semibold hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clockedIn.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">😴</p>
            <p className="text-sm font-medium">No one is clocked in right now</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Employee</th>
                <th className="px-6 py-3 text-left">Current Job</th>
                <th className="px-6 py-3 text-left">Clocked In</th>
                <th className="px-6 py-3 text-left">Elapsed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clockedIn.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">👷 {emp.name}</td>
                  <td className="px-6 py-4 text-blue-700 font-medium">{emp.currentProject}</td>
                  <td className="px-6 py-4 text-gray-600">{fmt12(emp.clockIn)}</td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-700 font-bold text-xs px-2 py-1 rounded-full">
                      {elapsed(emp.clockIn)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

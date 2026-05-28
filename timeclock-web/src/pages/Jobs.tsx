import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface Job {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Jobs() {
  const { company } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  async function load() {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("timeclock_projects")
      .select("id, name, description, is_active, created_at")
      .eq("company_id", company.id)
      .order("name");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setJobs(data ?? []);
  }

  async function addJob() {
    if (!newJobName.trim() || !company) return;
    setAdding(true);
    const { error } = await supabase
      .from("timeclock_projects")
      .insert({ name: newJobName.trim(), is_active: true, company_id: company.id });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Job added!");
    setNewJobName("");
    load();
  }

  async function toggleActive(job: Job) {
    const { error } = await supabase
      .from("timeclock_projects")
      .update({ is_active: !job.is_active })
      .eq("id", job.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${job.name} ${job.is_active ? "archived" : "restored"}`);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, is_active: !j.is_active } : j));
  }

  const filtered = jobs
    .filter((j) => showInactive || j.is_active)
    .filter((j) => j.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Jobs</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your job list — employees pick these when clocking in</p>
      </div>

      {/* Add Job */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <p className="text-sm font-black text-gray-700 mb-3">➕ Add New Job</p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Job name…"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addJob()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={addJob}
            disabled={adding || !newJobName.trim()}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "#0b3ea8" }}
          >
            {adding ? "Adding…" : "Add Job"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search jobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
          Show archived
        </label>
      </div>

      {/* Job list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm font-medium">No jobs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Job Name</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((job) => (
                <tr key={job.id} className={`hover:bg-gray-50 transition-colors ${!job.is_active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 font-semibold text-gray-900">📋 {job.name}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      job.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {job.is_active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(job)}
                      className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                        job.is_active
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {job.is_active ? "Archive" : "Restore"}
                    </button>
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

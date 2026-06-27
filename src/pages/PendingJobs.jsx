import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DesktopHeader from "../Components/DesktopHeader";

import { formatDate } from "../utils/dateUtils";
import { notify, confirmDialog } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
  danger: "#f97316",
};

export default function PendingJobs() {
  const [loading, setLoading] = useState(true);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadPendingJobs(), loadProjects()]);
    } catch (err) {
      console.error("Error loading data:", err);
      notify("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingJobs() {
    const { data, error } = await supabase
      .from("pending_jobs")
      .select("*")
      .order("last_used", { ascending: false });

    if (error) throw error;
    setPendingJobs(data || []);
  }

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status")
      .order("name", { ascending: true });

    if (error) throw error;
    setProjects(data || []);
  }

  async function handleLinkToProject(projectTask, projectId) {
    if (!projectId) {
      return notify("Please select a project");
    }

    const confirmed = await confirmDialog(
      `Link all time entries for "${projectTask}" to this project?\n\nThis will update ${
        pendingJobs.find((j) => j.project_task === projectTask)?.segment_count || 0
      } time segments.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("link_pending_job_to_project", {
        p_project_task: projectTask,
        p_project_id: projectId,
      });

      if (error) throw error;

      notify(`Successfully linked ${data} time segments to the project!`);
      setEditingJob(null);
      setSelectedProjectId("");
      await loadPendingJobs();
    } catch (err) {
      console.error("Error linking job:", err);
      notify("Failed to link job: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRenameJob(oldName, newName) {
    if (!newName || !newName.trim()) {
      return notify("Please enter a new name");
    }

    const trimmedName = newName.trim();
    if (trimmedName === oldName) {
      setEditingJob(null);
      return;
    }

    const confirmed = await confirmDialog(
      `Rename "${oldName}" to "${trimmedName}"?\n\nThis will update ${
        pendingJobs.find((j) => j.project_task === oldName)?.segment_count || 0
      } time segments.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("rename_pending_job", {
        p_old_name: oldName,
        p_new_name: trimmedName,
      });

      if (error) throw error;

      notify(`Successfully renamed ${data} time segments!`);
      setEditingJob(null);
      setNewName("");
      await loadPendingJobs();
    } catch (err) {
      console.error("Error renaming job:", err);
      notify("Failed to rename job: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }


  return (
    <div style={{ minHeight: "100vh", backgroundColor: BRAND.bg }}>
      <DesktopHeader />

      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            Pending Jobs Management
          </h1>
          <p style={{ color: "#e5e7eb", fontSize: 14, margin: 0 }}>
            View and manage temporary job names entered by employees. Link them to actual projects or rename them to fix typos.
          </p>
        </div>

        {/* Refresh Button */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            🔄 {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div
            style={{
              backgroundColor: "#fff",
              padding: 40,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 18, color: "#6b7280" }}>Loading pending jobs...</p>
          </div>
        ) : pendingJobs.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              padding: 40,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 18, color: "#6b7280", margin: 0 }}>
              🎉 No pending jobs! All time entries are linked to projects.
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: 20, borderBottom: "2px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111" }}>
                Pending Jobs ({pendingJobs.length})
              </h2>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Job Name
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Segments
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Total Hours
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Employees
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      First Used
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Last Used
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        borderBottom: "2px solid #e5e7eb",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingJobs.map((job, idx) => {
                    const isEditing = editingJob === job.project_task;

                    return (
                      <tr
                        key={job.project_task}
                        style={{
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                        }}
                      >
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                            fontSize: 14,
                            color: "#111",
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="New job name"
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: 6,
                                border: "2px solid #3b82f6",
                                fontSize: 14,
                              }}
                            />
                          ) : (
                            job.project_task
                          )}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center",
                            color: "#111",
                          }}
                        >
                          {job.segment_count}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#111",
                          }}
                        >
                          {job.total_hours}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            fontSize: 13,
                            color: "#111",
                          }}
                        >
                          {job.employee_names?.join(", ") || "—"}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center",
                            fontSize: 13,
                            color: "#6b7280",
                          }}
                        >
                          {formatDate(job.first_used)}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center",
                            fontSize: 13,
                            color: "#6b7280",
                          }}
                        >
                          {formatDate(job.last_used)}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center",
                          }}
                        >
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                              <button
                                onClick={() => handleRenameJob(job.project_task, newName)}
                                disabled={actionLoading}
                                style={{
                                  backgroundColor: "#10b981",
                                  color: "#fff",
                                  border: "none",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: actionLoading ? "not-allowed" : "pointer",
                                  opacity: actionLoading ? 0.6 : 1,
                                }}
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingJob(null);
                                  setNewName("");
                                }}
                                disabled={actionLoading}
                                style={{
                                  backgroundColor: "#6b7280",
                                  color: "#fff",
                                  border: "none",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: actionLoading ? "not-allowed" : "pointer",
                                  opacity: actionLoading ? 0.6 : 1,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              <button
                                onClick={() => {
                                  setEditingJob(job.project_task);
                                  setNewName(job.project_task);
                                  setSelectedProjectId("");
                                }}
                                disabled={actionLoading}
                                style={{
                                  backgroundColor: BRAND.primary,
                                  color: "#111",
                                  border: "none",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: actionLoading ? "not-allowed" : "pointer",
                                  opacity: actionLoading ? 0.6 : 1,
                                }}
                              >
                                ✏️ Rename
                              </button>
                              <div style={{ position: "relative" }}>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const projectId = e.target.value;
                                    if (projectId) {
                                      handleLinkToProject(job.project_task, projectId);
                                    }
                                  }}
                                  disabled={actionLoading}
                                  style={{
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                    border: "none",
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: actionLoading ? "not-allowed" : "pointer",
                                    opacity: actionLoading ? 0.6 : 1,
                                  }}
                                >
                                  <option value="">🔗 Link to Project</option>
                                  {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 12,
            marginTop: 24,
            border: "2px solid #3b82f6",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0", color: "#111" }}>
            ℹ️ How to Use
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14, lineHeight: 1.6 }}>
            <li>
              <strong>Rename:</strong> Click "Rename" to fix typos or standardize job names before linking to projects
            </li>
            <li>
              <strong>Link to Project:</strong> Select a project from the dropdown to link all time entries for that job name to
              an actual project
            </li>
            <li>
              Once linked, the job will disappear from this list and all time segments will be properly associated with the
              project
            </li>
            <li>
              Employees can continue to enter any job name when clocking in - you'll see new entries here to manage them
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

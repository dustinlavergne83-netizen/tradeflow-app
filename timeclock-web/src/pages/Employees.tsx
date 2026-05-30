import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface Employee {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  hourly_rate: number | null;
}

const emptyForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  role: "employee",
  hourly_rate: "",
};

export default function Employees() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Add / invite modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [inviteSent, setInviteSent] = useState<string | null>(null); // email that was just invited

  // Edit modal
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "", email: "", role: "employee", hourly_rate: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Change password modal
  const [pwdEmp, setPwdEmp] = useState<Employee | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSent, setPwdSent] = useState(false);

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  async function load() {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, user_id, first_name, last_name, phone, email, role, is_active, hourly_rate")
      .eq("company_id", company.id)
      .order("first_name");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setEmployees(data ?? []);
  }

  function openEdit(emp: Employee) {
    setEditEmp(emp);
    setEditForm({
      first_name:  emp.first_name ?? "",
      last_name:   emp.last_name ?? "",
      phone:       emp.phone ?? "",
      email:       emp.email ?? "",
      role:        emp.role ?? "employee",
      hourly_rate: emp.hourly_rate?.toString() ?? "",
    });
  }

  async function saveEdit() {
    if (!editEmp) return;
    setEditSaving(true);
    const { error } = await supabase.from("employees").update({
      first_name:  editForm.first_name.trim(),
      last_name:   editForm.last_name.trim(),
      phone:       editForm.phone.trim() || null,
      email:       editForm.email.trim().toLowerCase() || null,
      role:        editForm.role,
      hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
    }).eq("id", editEmp.id);
    setEditSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee updated!");
    setEditEmp(null);
    load();
  }

  async function sendPasswordReset() {
    if (!pwdEmp?.email) { toast.error("No email on file for this employee"); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(pwdEmp.email, {
      redirectTo: `https://app.tradeflowllc.com`,
    });
    setPwdSaving(false);
    if (error) { toast.error(error.message); return; }
    setPwdSent(true);
    toast.success("Reset email sent!");
  }

  async function inviteEmployee() {
    if (!addForm.first_name.trim() || !addForm.email.trim() || !company) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-employee", {
        body: {
          email:      addForm.email.trim().toLowerCase(),
          firstName:  addForm.first_name.trim(),
          lastName:   addForm.last_name.trim(),
          phone:      addForm.phone.trim() || null,
          role:       addForm.role,
          hourlyRate: addForm.hourly_rate ? parseFloat(addForm.hourly_rate) : null,
          companyId:  company.id,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to send invite");
        return;
      }

      setInviteSent(addForm.email.trim().toLowerCase());
      setAddForm(emptyForm);
      setShowAddModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    const { error } = await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${emp.first_name} ${emp.is_active ? "deactivated" : "activated"}`);
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, is_active: !e.is_active } : e));
  }

  const q = search.toLowerCase().trim();
  const filtered = employees
    .filter((e) => showInactive || e.is_active)
    .filter((e) => {
      if (!q) return true;
      const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.toLowerCase().trim();
      return name.includes(q) || (e.phone ?? "").toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q);
    });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} employees</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setAddForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "#0b3ea8" }}>
          ✉️ Invite Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search by name, phone, or email…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
          Show inactive
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">👷</p>
            <p className="text-sm font-medium">No employees — click "Invite Employee" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email / Phone</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">Rate</th>
                  <th className="px-5 py-3 text-left">App</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${!emp.is_active ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {emp.role === "contractor" ? "🔧" : ""} {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="text-xs">{emp.email ?? "—"}</div>
                      <div className="text-xs text-gray-400">{emp.phone ?? ""}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        emp.role === "admin" ? "bg-blue-100 text-blue-700" :
                        emp.role === "contractor" ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {emp.role === "contractor" ? "🔧 Contractor" : emp.role ?? "employee"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{emp.hourly_rate ? `$${emp.hourly_rate}/hr` : "—"}</td>
                    <td className="px-5 py-3">
                      {emp.user_id
                        ? <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Linked</span>
                        : <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⏳ Invite Sent</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${emp.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(emp)}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                          ✏️ Edit
                        </button>
                        <button onClick={() => { setPwdEmp(emp); setPwdSent(false); }}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                          🔑 Reset
                        </button>
                        <button onClick={() => toggleActive(emp)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${emp.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                          {emp.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── INVITE EMPLOYEE MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">✉️ Invite Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-4 leading-relaxed">
              The employee will receive an email from <strong>noreply@tradeflowllc.com</strong> with a link to set their own password and get started.
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                    placeholder="John" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                    placeholder="Smith" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="john@email.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="555-123-4567" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                  <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                    <option value="employee">Employee</option>
                     <option value="contractor">Contractor</option>
                     <option value="admin">Admin</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Hourly Rate ($)</label>
                   <input type="number" value={addForm.hourly_rate} onChange={(e) => setAddForm({ ...addForm, hourly_rate: e.target.value })}
                    placeholder="25.00" min="0" step="0.25" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={inviteEmployee} disabled={saving || !addForm.first_name.trim() || !addForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#0b3ea8" }}>
                {saving ? "Sending…" : "✉️ Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT EMPLOYEE MODAL ── */}
      {editEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">✏️ Edit Employee</h2>
              <button onClick={() => setEditEmp(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                  <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                     <option value="employee">Employee</option>
                     <option value="contractor">Contractor</option>
                     <option value="admin">Admin</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Hourly Rate ($)</label>
                   <input type="number" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                    min="0" step="0.25" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditEmp(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#0b3ea8" }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {pwdEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">🔑 Reset Password</h2>
              <button onClick={() => { setPwdEmp(null); setPwdSent(false); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{pwdEmp.first_name} {pwdEmp.last_name}</strong><br />
              <span className="text-xs text-gray-400">{pwdEmp.email ?? "No email on file"}</span>
            </p>

            {pwdSent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-bold text-green-700">Reset email sent!</p>
                <p className="text-xs text-green-600 mt-1">They'll receive an email from noreply@tradeflowllc.com to set a new password.</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-4 leading-relaxed">
                  <strong>How it works:</strong> We'll send {pwdEmp.first_name} an email with a secure link to set a new password.
                </div>
                {!pwdEmp.email && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 mb-4">
                    ⚠️ No email on file. Edit their profile to add an email first.
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => { setPwdEmp(null); setPwdSent(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                {pwdSent ? "Done" : "Cancel"}
              </button>
              {!pwdSent && (
                <button onClick={sendPasswordReset} disabled={pwdSaving || !pwdEmp.email}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#0b3ea8" }}>
                  {pwdSaving ? "Sending…" : "✉️ Send Reset Email"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE SENT CONFIRMATION ── */}
      {inviteSent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">✉️</div>
            <h2 className="text-lg font-black text-gray-900 mb-1">Invite sent!</h2>
            <p className="text-gray-500 text-sm mb-5">
              An invite email has been sent to:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-5">
              <p className="text-sm font-mono font-bold text-gray-900">{inviteSent}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-5 text-left leading-relaxed">
              📱 They'll click the link in the email to set their password, then download the <strong>TradeFlow</strong> app and sign in.
            </div>
            <button onClick={() => setInviteSent(null)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "#0b3ea8" }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

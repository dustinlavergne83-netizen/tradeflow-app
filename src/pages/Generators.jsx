import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { notify, confirmDialog } from "../lib/notify";

const FUEL_TYPES = ["Natural Gas", "Propane", "Liquid Propane", "Diesel"];
const DEFAULT_BRANDS = ["Generac", "Kohler", "Cummins", "Briggs & Stratton"];

const EMPTY_FORM = {
  customer_id: "",
  customer_name: "",
  customer_address: "",
  customer_phone: "",
  customer_email: "",
  brand: "",
  model: "",
  serial_number: "",
  kw_size: "",
  fuel_type: "Natural Gas",
  transfer_switch_brand: "",
  transfer_switch_model: "",
  install_date: "",
  last_service_date: "",
  service_interval_months: 12,
  next_service_date: "",
  notes: "",
  status: "active",
};

function calcNextService(lastDate, intervalMonths) {
  if (!lastDate || !intervalMonths) return "";
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + Number(intervalMonths));
  return d.toISOString().slice(0, 10);
}

function serviceStatusBadge(nextDate) {
  if (!nextDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextDate);
  const diffDays = Math.round((next - today) / 86400000);

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
        🔴 Overdue {Math.abs(diffDays)}d
      </span>
    );
  }
  if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
        🟡 Due in {diffDays}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
      🟢 OK
    </span>
  );
}

function statusBadge(status) {
  const map = {
    active: "bg-blue-100 text-blue-700",
    needs_service: "bg-orange-100 text-orange-700",
    decommissioned: "bg-gray-200 text-gray-500",
  };
  const labels = {
    active: "Active",
    needs_service: "Needs Service",
    decommissioned: "Decommissioned",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

export default function Generators() {
  const navigate = useNavigate();
  const [generators, setGenerators] = useState([]);
  const [brands, setBrands] = useState([...DEFAULT_BRANDS]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const customerRef = useRef(null);

  useEffect(() => {
    loadAll();
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (customerRef.current && !customerRef.current.contains(e.target)) {
        setShowCustomerDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [genRes, brandRes, custRes] = await Promise.all([
      supabase.from("generators").select("*").eq("company_id", user.id).order("customer_name"),
      supabase.from("generator_brands").select("name").eq("company_id", user.id).order("name"),
      supabase.from("customers").select("id, customer, address, email, phone").eq("company_id", user.id).order("customer"),
    ]);

    if (!genRes.error) setGenerators(genRes.data ?? []);
    if (!brandRes.error && brandRes.data?.length > 0) {
      const saved = brandRes.data.map((b) => b.name);
      const merged = [...new Set([...DEFAULT_BRANDS, ...saved])].sort();
      setBrands(merged);
    }
    if (!custRes.error && custRes.data?.length > 0) {
      setCustomers(custRes.data);
    } else {
      // fallback: load all customers without company filter
      const { data: allCust } = await supabase
        .from("customers")
        .select("id, customer, address, email, phone")
        .order("customer");
      setCustomers(allCust ?? []);
    }
    setLoading(false);
  }

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = generators.filter((g) => {
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      g.customer_name?.toLowerCase().includes(s) ||
      g.customer_address?.toLowerCase().includes(s) ||
      g.brand?.toLowerCase().includes(s) ||
      g.model?.toLowerCase().includes(s) ||
      g.serial_number?.toLowerCase().includes(s)
    );
  });

  // ── Open Add Modal ─────────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomerSearch("");
    setShowModal(true);
  }

  // ── Open Edit Modal ───────────────────────────────────────────
  function openEdit(gen) {
    setEditingId(gen.id);
    setForm({
      customer_id: gen.customer_id ?? "",
      customer_name: gen.customer_name ?? "",
      customer_address: gen.customer_address ?? "",
      customer_phone: gen.customer_phone ?? "",
      customer_email: gen.customer_email ?? "",
      brand: gen.brand ?? "",
      model: gen.model ?? "",
      serial_number: gen.serial_number ?? "",
      kw_size: gen.kw_size ?? "",
      fuel_type: gen.fuel_type ?? "Natural Gas",
      transfer_switch_brand: gen.transfer_switch_brand ?? "",
      transfer_switch_model: gen.transfer_switch_model ?? "",
      install_date: gen.install_date ?? "",
      last_service_date: gen.last_service_date ?? "",
      service_interval_months: gen.service_interval_months ?? 12,
      next_service_date: gen.next_service_date ?? "",
      notes: gen.notes ?? "",
      status: gen.status ?? "active",
    });
    setCustomerSearch(gen.customer_name ?? "");
    setShowModal(true);
  }

  // ── Form helpers ──────────────────────────────────────────────
  function setField(key, val) {
    setForm((prev) => {
      const updated = { ...prev, [key]: val };
      // Auto-recalc next service date when last service or interval changes
      if (key === "last_service_date" || key === "service_interval_months") {
        updated.next_service_date = calcNextService(
          key === "last_service_date" ? val : prev.last_service_date,
          key === "service_interval_months" ? val : prev.service_interval_months
        );
      }
      return updated;
    });
  }

  function pickCustomer(cust) {
    setForm((prev) => ({
      ...prev,
      customer_id: cust.id,
      customer_name: cust.customer,
      customer_address: cust.address ?? "",
      customer_phone: cust.phone ?? "",
      customer_email: cust.email ?? "",
    }));
    setCustomerSearch(cust.customer);
    setShowCustomerDrop(false);
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.customer_name.trim()) return notify("Customer name is required");
    if (!form.brand.trim()) return notify("Generator brand is required");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      company_id: user.id,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name.trim(),
      customer_address: form.customer_address.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      serial_number: form.serial_number.trim(),
      kw_size: form.kw_size !== "" ? parseFloat(form.kw_size) : null,
      fuel_type: form.fuel_type,
      transfer_switch_brand: form.transfer_switch_brand.trim(),
      transfer_switch_model: form.transfer_switch_model.trim(),
      install_date: form.install_date || null,
      last_service_date: form.last_service_date || null,
      service_interval_months: Number(form.service_interval_months) || 12,
      next_service_date: form.next_service_date || null,
      notes: form.notes.trim(),
      status: form.status,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("generators").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("generators").insert([payload]));
    }

    setSaving(false);
    if (error) { notify("Failed to save: " + error.message); return; }
    notify(editingId ? "Generator updated!" : "Generator added!");
    setShowModal(false);
    loadAll();
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!await confirmDialog("Delete this generator record?")) return;
    const { error } = await supabase.from("generators").delete().eq("id", id);
    if (error) { notify("Delete failed: " + error.message); return; }
    notify("Generator deleted");
    setGenerators((prev) => prev.filter((g) => g.id !== id));
  }

  // ── Add Brand ─────────────────────────────────────────────────
  async function handleAddBrand() {
    const name = newBrand.trim();
    if (!name) return;
    if (brands.includes(name)) { notify("Brand already exists"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("generator_brands")
      .insert([{ company_id: user.id, name }]);

    if (error && !error.message.includes("unique")) {
      notify("Failed to save brand: " + error.message);
      return;
    }
    setBrands((prev) => [...new Set([...prev, name])].sort());
    setForm((f) => ({ ...f, brand: name }));
    setNewBrand("");
    setShowAddBrand(false);
    notify(`"${name}" added to brands`);
  }

  // ── Filtered customer dropdown ────────────────────────────────
  const filteredCustomers = customers.filter((c) =>
    c.customer?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // ── Stats ─────────────────────────────────────────────────────
  const total = generators.length;
  const needsService = generators.filter((g) => {
    if (g.status === "needs_service") return true;
    if (!g.next_service_date) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(g.next_service_date) < today;
  }).length;
  const dueSoon = generators.filter((g) => {
    if (!g.next_service_date) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const next = new Date(g.next_service_date);
    const diff = Math.round((next - today) / 86400000);
    return diff >= 0 && diff <= 30;
  }).length;

  return (
    <div style={{ padding: "20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111", margin: 0 }}>⚡ Generators</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
            Track customer generators, service history, and upcoming maintenance
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/invoice/generator")}
            style={{
              background: "#fc6b04", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 20px", fontWeight: 800,
              fontSize: 14, cursor: "pointer",
            }}
          >
            ⚡ Generator Invoice
          </button>
          <button
            onClick={openAdd}
            style={{
              background: "#fc6b04", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 20px", fontWeight: 800,
              fontSize: 14, cursor: "pointer",
            }}
          >
            + Add Generator
          </button>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Generators", value: total, color: "#0b3ea8", bg: "#eff6ff" },
          { label: "Needs Service / Overdue", value: needsService, color: "#dc2626", bg: "#fef2f2" },
          { label: "Due Within 30 Days", value: dueSoon, color: "#d97706", bg: "#fffbeb" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search customer, brand, model, serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: "9px 14px", borderRadius: 10,
            border: "1.5px solid #d1d5db", fontSize: 14, outline: "none",
          }}
        />
        {["all", "active", "needs_service", "decommissioned"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: "none", cursor: "pointer",
              background: statusFilter === s ? "#0b3ea8" : "#e5e7eb",
              color: statusFilter === s ? "#fff" : "#374151",
            }}
          >
            {s === "all" ? "All" : s === "needs_service" ? "Needs Service" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Generator list ─────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading generators…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1.5px dashed #d1d5db" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
          <p style={{ color: "#6b7280", fontWeight: 700 }}>No generators found</p>
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Click "Add Generator" to get started</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {filtered.map((gen) => (
            <div
              key={gen.id}
              style={{
                background: "#fff", borderRadius: 16, border: "1.5px solid #e5e7eb",
                padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              {/* Customer */}
              <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#111" }}>{gen.customer_name || "—"}</div>
                    {gen.customer_address && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>📍 {gen.customer_address}</div>
                    )}
                    {gen.customer_phone && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>📞 {gen.customer_phone}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {statusBadge(gen.status)}
                  </div>
                </div>
              </div>

              {/* Generator details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 13 }}>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>BRAND</span>
                  <div style={{ fontWeight: 700, color: "#111" }}>{gen.brand || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>MODEL</span>
                  <div style={{ fontWeight: 700, color: "#111" }}>{gen.model || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>SERIAL #</span>
                  <div style={{ fontWeight: 600, color: "#374151" }}>{gen.serial_number || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>KW SIZE</span>
                  <div style={{ fontWeight: 600, color: "#374151" }}>{gen.kw_size ? `${gen.kw_size} kW` : "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>FUEL TYPE</span>
                  <div style={{ fontWeight: 600, color: "#374151" }}>{gen.fuel_type || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>INSTALLED</span>
                  <div style={{ fontWeight: 600, color: "#374151" }}>{fmtDate(gen.install_date)}</div>
                </div>
                {(gen.transfer_switch_brand || gen.transfer_switch_model) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>TRANSFER SWITCH</span>
                    <div style={{ fontWeight: 600, color: "#374151" }}>
                      {[gen.transfer_switch_brand, gen.transfer_switch_model].filter(Boolean).join(" — ")}
                    </div>
                  </div>
                )}
              </div>

              {/* Service section */}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>🔧 Service</span>
                  {serviceStatusBadge(gen.next_service_date)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#9ca3af", fontWeight: 700 }}>Last Service</span>
                    <div style={{ color: "#374151", fontWeight: 600 }}>{fmtDate(gen.last_service_date)}</div>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af", fontWeight: 700 }}>Next Service</span>
                    <div style={{ color: "#374151", fontWeight: 600 }}>{fmtDate(gen.next_service_date)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Interval: every {gen.service_interval_months} month{gen.service_interval_months !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Notes */}
              {gen.notes && (
                <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", background: "#fffbeb", borderRadius: 8, padding: "6px 10px" }}>
                  📝 {gen.notes}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => navigate(`/invoice/generator?generatorId=${gen.id}`)}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: "#fff7ed", color: "#ea580c", border: "1.5px solid #fed7aa", cursor: "pointer",
                  }}
                >
                  📋 Invoice
                </button>
                <button
                  onClick={() => openEdit(gen)}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: "#eff6ff", color: "#1d4ed8", border: "none", cursor: "pointer",
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDelete(gen.id)}
                  style={{
                    padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: "#fef2f2", color: "#dc2626", border: "none", cursor: "pointer",
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 20, padding: 28,
              width: "100%", maxWidth: 640, maxHeight: "90vh",
              overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                {editingId ? "Edit Generator" : "Add Generator"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Section: Customer */}
            <SectionLabel>👤 Customer Info</SectionLabel>

            {/* Customer picker */}
            <div ref={customerRef} style={{ position: "relative", marginBottom: 12 }}>
              <label style={labelStyle}>Customer (search or type manually)</label>
              <input
                type="text"
                placeholder="Search existing customers…"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setField("customer_name", e.target.value);
                  setShowCustomerDrop(true);
                }}
                onFocus={() => setShowCustomerDrop(true)}
                style={inputStyle}
              />
              {showCustomerDrop && customerSearch.length > 0 && filteredCustomers.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
                  maxHeight: 200, overflowY: "auto",
                }}>
                  {filteredCustomers.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 14px", background: "#fff", border: "none",
                        cursor: "pointer", fontSize: 13, color: "#111",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#111"; }}
                    >
                      <div style={{ fontWeight: 700, color: "inherit" }}>{c.customer}</div>
                      {c.address && <div style={{ fontSize: 11, color: "#6b7280" }}>{c.address}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Field label="Address" value={form.customer_address} onChange={(v) => setField("customer_address", v)} placeholder="123 Main St, City, ST" span={2} />
              <Field label="Phone" value={form.customer_phone} onChange={(v) => setField("customer_phone", v)} placeholder="(555) 000-0000" />
              <Field label="Email" value={form.customer_email} onChange={(v) => setField("customer_email", v)} placeholder="email@example.com" />
            </div>

            {/* Section: Generator */}
            <SectionLabel>⚡ Generator Details</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {/* Brand */}
              <div>
                <label style={labelStyle}>Brand *</label>
                {showAddBrand ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="New brand name…"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddBrand(); if (e.key === "Escape") setShowAddBrand(false); }}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={handleAddBrand} style={{ ...btnOrange, padding: "0 12px" }}>✓</button>
                    <button onClick={() => setShowAddBrand(false)} style={{ ...btnGray, padding: "0 10px" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">Select brand…</option>
                      {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <button
                      onClick={() => setShowAddBrand(true)}
                      title="Add new brand"
                      style={{ ...btnGray, padding: "0 10px", fontSize: 18 }}
                    >+</button>
                  </div>
                )}
              </div>

              <Field label="Model" value={form.model} onChange={(v) => setField("model", v)} placeholder="e.g. 22000EWCL" />
              <Field label="Serial Number" value={form.serial_number} onChange={(v) => setField("serial_number", v)} placeholder="SN12345678" />

              {/* KW size */}
              <div>
                <label style={labelStyle}>KW Size</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 22"
                  value={form.kw_size}
                  onChange={(e) => setField("kw_size", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Fuel type */}
              <div>
                <label style={labelStyle}>Fuel Type</label>
                <select value={form.fuel_type} onChange={(e) => setField("fuel_type", e.target.value)} style={inputStyle}>
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={(e) => setField("status", e.target.value)} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="needs_service">Needs Service</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>

              <Field label="Install Date" type="date" value={form.install_date} onChange={(v) => setField("install_date", v)} />
            </div>

            {/* Section: Transfer Switch */}
            <SectionLabel>🔌 Transfer Switch</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Field label="Transfer Switch Brand" value={form.transfer_switch_brand} onChange={(v) => setField("transfer_switch_brand", v)} placeholder="e.g. Generac" />
              <Field label="Transfer Switch Model" value={form.transfer_switch_model} onChange={(v) => setField("transfer_switch_model", v)} placeholder="e.g. RTSY200A3" />
            </div>

            {/* Section: Service */}
            <SectionLabel>🔧 Service Tracking</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Field label="Last Service Date" type="date" value={form.last_service_date} onChange={(v) => setField("last_service_date", v)} />
              <div>
                <label style={labelStyle}>Service Interval (months)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.service_interval_months}
                  onChange={(e) => setField("service_interval_months", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Next Service Date (auto)</label>
                <input
                  type="date"
                  value={form.next_service_date}
                  onChange={(e) => setField("next_service_date", e.target.value)}
                  style={{ ...inputStyle, background: form.last_service_date ? "#f0f7ff" : undefined }}
                />
                {form.last_service_date && (
                  <p style={{ fontSize: 10, color: "#6b7280", margin: "3px 0 0" }}>
                    Auto-calculated from last service + interval
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <SectionLabel>📝 Notes</SectionLabel>
            <textarea
              placeholder="Any additional notes about this generator or customer…"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", marginBottom: 20 }}
            />

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={btnGray}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={btnOrange}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Generator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 800, color: "#0b3ea8",
      textTransform: "uppercase", letterSpacing: 0.8,
      marginBottom: 8, paddingBottom: 4,
      borderBottom: "2px solid #eff6ff",
    }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "", type = "text", span }) {
  return (
    <div style={span ? { gridColumn: `1 / span ${span}` } : {}}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: "#374151", marginBottom: 4,
};

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: "1.5px solid #d1d5db", fontSize: 14,
  outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
};

const btnOrange = {
  background: "#fc6b04", color: "#fff", border: "none",
  borderRadius: 10, padding: "10px 22px", fontWeight: 800,
  fontSize: 14, cursor: "pointer",
};

const btnGray = {
  background: "#f3f4f6", color: "#374151", border: "none",
  borderRadius: 10, padding: "10px 18px", fontWeight: 700,
  fontSize: 14, cursor: "pointer",
};

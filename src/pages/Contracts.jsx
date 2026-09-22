import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useBrand } from "../lib/useBrand";
import { getProjectTypes } from "../lib/projectTypes";
import { notify, confirmDialog } from "../lib/notify";

const STATIC_BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
  primary: "#2563eb",
};

const AGREEMENT_STATUSES = [
  { value: "active", label: "Active", color: "#10b981" },
  { value: "completed", label: "Completed", color: "#6b7280" },
  { value: "cancelled", label: "Cancelled", color: "#ef4444" },
];

const KIND_LABELS = {
  one_off: { label: "One-off", color: "#2563eb", icon: "🔧" },
  recurring: { label: "Recurring", color: "#16a34a", icon: "🔁" },
  subscription: { label: "Subscription", color: "#7c3aed", icon: "📦" },
};

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "seasonal", label: "Seasonal (manual scheduling)" },
  { value: "custom", label: "Custom interval" },
];

export default function Contracts() {
  const BRAND = { ...STATIC_BRAND, ...useBrand() };
  const { employee, company } = useAuth();
  const SERVICE_CATALOG = getProjectTypes(company);

  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [agreementsRes, customersRes] = await Promise.all([
        supabase
          .from("service_agreements")
          .select(
            "id, title, status, notes, created_at, customer_id, customers(id, customer, address, phone, email), project_services(id, service_key, label, kind, status, service_contracts(id, frequency, next_visit_date, status, billing_cadence, rate))"
          )
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("id, customer, address, phone, email").order("customer"),
      ]);

      if (agreementsRes.error) throw agreementsRes.error;
      setAgreements(agreementsRes.data || []);
      setCustomers(customersRes.data || []);
    } catch (err) {
      notify("Failed to load contracts: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAgreement(agreement) {
    if (!(await confirmDialog(`Delete "${agreement.title}"? This removes all its services and any scheduled visits.`))) return;
    try {
      const { error } = await supabase.from("service_agreements").delete().eq("id", agreement.id);
      if (error) throw error;
      notify("Agreement deleted");
      loadData();
    } catch (err) {
      notify("Failed to delete: " + err.message);
    }
  }

  const filtered = agreements.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.customers?.customer?.toLowerCase().includes(q) ||
      a.customers?.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ ...styles.container, backgroundColor: BRAND.bg }}>
      <div style={styles.header}>
        <h1 style={styles.title}>📋 Service Contracts</h1>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <input
            type="text"
            placeholder="🔍 Search by customer, address, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterSelect}>
            <option value="all">All Status</option>
            {AGREEMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{ ...styles.newButton, backgroundColor: BRAND.accent }}>
          ➕ New Agreement
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading contracts...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <p>No service agreements yet</p>
          <button onClick={() => setShowCreateModal(true)} style={styles.emptyButton}>
            Create Your First Agreement
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((a) => (
            <AgreementCard
              key={a.id}
              agreement={a}
              onDelete={() => handleDeleteAgreement(a)}
              serviceCatalog={SERVICE_CATALOG}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateAgreementModal
          customers={customers}
          serviceCatalog={SERVICE_CATALOG}
          companyId={employee?.company_id}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function AgreementCard({ agreement, onDelete, serviceCatalog }) {
  const statusMeta = AGREEMENT_STATUSES.find((s) => s.value === agreement.status) || AGREEMENT_STATUSES[0];
  const services = agreement.project_services || [];

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.cardTitle}>{agreement.title}</div>
          <div style={styles.cardCustomer}>
            👤 {agreement.customers?.customer || "—"}
            {agreement.customers?.address ? ` · ${agreement.customers.address}` : ""}
          </div>
        </div>
        <span style={{ ...styles.statusBadge, backgroundColor: statusMeta.color + "22", color: statusMeta.color }}>
          {statusMeta.label}
        </span>
      </div>

      <div style={styles.servicesList}>
        {services.length === 0 ? (
          <div style={styles.noServices}>No services added yet</div>
        ) : (
          services.map((s) => {
            const kindMeta = KIND_LABELS[s.kind] || KIND_LABELS.one_off;
            const catalogEntry = serviceCatalog.find((c) => c.value === s.service_key);
            const contract = s.service_contracts?.[0];
            return (
              <div key={s.id} style={styles.serviceRow}>
                <span style={{ fontSize: 18 }}>{catalogEntry?.icon || kindMeta.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.serviceLabel}>{s.label}</div>
                  {contract && (
                    <div style={styles.serviceMeta}>
                      {contract.frequency} · next: {contract.next_visit_date || "—"}
                      {contract.rate ? ` · $${contract.rate}` : ""}
                    </div>
                  )}
                  {!contract && s.kind === "subscription" && (
                    <div style={styles.serviceMeta}>monthly subscription (no contract terms set)</div>
                  )}
                </div>
                <span style={{ ...styles.kindBadge, backgroundColor: kindMeta.color + "22", color: kindMeta.color }}>
                  {kindMeta.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={styles.cardFooter}>
        <button onClick={onDelete} style={styles.deleteButton}>🗑️ Delete</button>
      </div>
    </div>
  );
}


function CreateAgreementModal({ customers, serviceCatalog, companyId, saving, setSaving, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); // [{service_key, label, kind, frequency}]

  const filteredCustomers = customers.filter((c) =>
    c.customer?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  function toggleService(entry) {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.service_key === entry.value);
      if (exists) return prev.filter((s) => s.service_key !== entry.value);
      return [...prev, { service_key: entry.value, label: entry.label, kind: entry.kind || "one_off", frequency: "monthly" }];
    });
  }

  function setServiceFrequency(serviceKey, frequency) {
    setSelectedServices((prev) =>
      prev.map((s) => (s.service_key === serviceKey ? { ...s, frequency } : s))
    );
  }


  async function handleCreate() {
    if (!title.trim()) return notify("Agreement title is required");
    if (!customerId) return notify("Select a customer");
    if (selectedServices.length === 0) return notify("Add at least one service");
    if (!companyId) return notify("Missing company — please refresh and try again");

    setSaving(true);
    try {
      const { data: agreement, error: agreementError } = await supabase
        .from("service_agreements")
        .insert([{ company_id: companyId, customer_id: customerId, title: title.trim() }])
        .select()
        .single();
      if (agreementError) throw agreementError;

      for (const svc of selectedServices) {
        const { data: serviceRow, error: serviceError } = await supabase
          .from("project_services")
          .insert([
            {
              company_id: companyId,
              customer_id: customerId,
              agreement_id: agreement.id,
              service_key: svc.service_key,
              label: svc.label,
              kind: svc.kind,
            },
          ])
          .select()
          .single();
        if (serviceError) throw serviceError;

        if (svc.kind === "recurring" || svc.kind === "subscription") {
          const { error: contractError } = await supabase.from("service_contracts").insert([
            {
              company_id: companyId,
              project_service_id: serviceRow.id,
              frequency: svc.frequency,
              start_date: new Date().toISOString().slice(0, 10),
              billing_cadence: svc.kind === "subscription" ? "monthly" : "per_visit",
            },
          ]);
          if (contractError) throw contractError;
        }
      }

      notify("Agreement created!");
      onCreated();
    } catch (err) {
      notify("Failed to create agreement: " + err.message);
    } finally {
      setSaving(false);
    }
  }


  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>New Service Agreement</h2>

        <div style={styles.field}>
          <label style={styles.label}>Agreement Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Christmas Lights - 123 Main St"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Customer *</label>
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDrop(true);
              setCustomerId("");
            }}
            onFocus={() => setShowCustomerDrop(true)}
            placeholder="Search customers..."
            style={styles.input}
          />
          {showCustomerDrop && filteredCustomers.length > 0 && (
            <div style={styles.dropdown}>
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  style={styles.dropdownItem}
                  onClick={() => {
                    setCustomerId(c.id);
                    setCustomerSearch(c.customer);
                    setShowCustomerDrop(false);
                  }}
                >
                  {c.customer} {c.address ? `— ${c.address}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>


        <div style={styles.field}>
          <label style={styles.label}>Services *</label>
          <div style={styles.serviceGrid}>
            {serviceCatalog.map((entry) => {
              const isSelected = selectedServices.some((s) => s.service_key === entry.value);
              return (
                <div
                  key={entry.value}
                  onClick={() => toggleService(entry)}
                  style={{
                    ...styles.serviceOption,
                    borderColor: isSelected ? entry.color : "#e5e7eb",
                    backgroundColor: isSelected ? entry.color + "18" : "#fff",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{entry.icon}</span>
                  <span style={styles.serviceOptionLabel}>{entry.label}</span>
                  {entry.kind && entry.kind !== "one_off" && (
                    <span style={{ ...styles.kindBadge, backgroundColor: KIND_LABELS[entry.kind].color + "22", color: KIND_LABELS[entry.kind].color }}>
                      {KIND_LABELS[entry.kind].label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedServices.some((s) => s.kind === "recurring") && (
          <div style={styles.field}>
            <label style={styles.label}>Recurring Frequency</label>
            {selectedServices
              .filter((s) => s.kind === "recurring")
              .map((s) => (
                <div key={s.service_key} style={styles.freqRow}>
                  <span style={styles.freqLabel}>{s.label}</span>
                  <select
                    value={s.frequency}
                    onChange={(e) => setServiceFrequency(s.service_key, e.target.value)}
                    style={styles.select}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        )}

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={styles.saveButton}>
            {saving ? "Creating..." : "Create Agreement"}
          </button>
        </div>
      </div>
    </div>
  );
}


const styles = {
  container: { padding: "40px 24px", maxWidth: 1400, margin: "0 auto", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 },
  title: { fontSize: 32, color: "#fff", margin: 0 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  toolbarLeft: { display: "flex", gap: 12, flexWrap: "wrap" },
  searchInput: { padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 260, fontSize: 14 },
  filterSelect: { padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 },
  newButton: { padding: "12px 22px", borderRadius: 8, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  loading: { color: "#fff", textAlign: "center", padding: 60, fontSize: 16 },
  empty: { backgroundColor: "#fff", borderRadius: 12, padding: 60, textAlign: "center" },
  emptyButton: { marginTop: 16, padding: "12px 24px", borderRadius: 8, border: "none", backgroundColor: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: 800, color: "#111" },
  cardCustomer: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  statusBadge: { padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  servicesList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  noServices: { fontSize: 13, color: "#9ca3af", fontStyle: "italic", padding: "8px 0" },
  serviceRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", backgroundColor: "#f9fafb", borderRadius: 8 },
  serviceLabel: { fontSize: 13, fontWeight: 700, color: "#111" },
  serviceMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  kindBadge: { padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" },
  cardFooter: { display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 12 },
  deleteButton: { padding: "6px 12px", borderRadius: 6, border: "1px solid #fecaca", backgroundColor: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 14, padding: 28, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: 22, fontWeight: 800, marginTop: 0, marginBottom: 20, color: "#111" },
  field: { marginBottom: 18, position: "relative" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" },
  select: { padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #d1d5db", borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
  dropdownItem: { padding: "10px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f3f4f6" },
  serviceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  serviceOption: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 10, border: "2px solid #e5e7eb", cursor: "pointer", textAlign: "center" },
  serviceOptionLabel: { fontSize: 12, fontWeight: 700, color: "#111" },
  freqRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  freqLabel: { fontSize: 13, fontWeight: 600, color: "#374151" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 },
  cancelButton: { padding: "10px 20px", borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" },
  saveButton: { padding: "10px 24px", borderRadius: 8, border: "none", backgroundColor: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" },
};

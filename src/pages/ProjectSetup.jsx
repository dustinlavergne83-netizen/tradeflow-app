import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

const PROJECT_TYPES = [
  {
    value: "commercial-public",
    icon: "🏢",
    label: "Commercial Public",
    desc: "Government, schools, public works, municipalities",
    color: "#1d4ed8",
  },
  {
    value: "commercial-private",
    icon: "🏗️",
    label: "Commercial Private",
    desc: "Private businesses, retail, industrial, offices",
    color: "#7c3aed",
  },
  {
    value: "residential-contractor",
    icon: "👷",
    label: "Residential Contractor",
    desc: "Working through a general contractor on residential work",
    color: "#d97706",
  },
  {
    value: "residential-owner",
    icon: "🏡",
    label: "Residential Owner",
    desc: "Working directly with the homeowner",
    color: "#059669",
  },
];

function AutocompleteInput({ name, value, onChange, options, placeholder, label, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  function handleInputChange(e) {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    onChange({ target: { name, value: val } });
  }

  function handleSelectOption(option) {
    setInputValue(option);
    setIsOpen(false);
    onChange({ target: { name, value: option } });
  }

  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label} {required && <span style={styles.required}>*</span>}
      </label>
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <input
          type="text"
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          style={styles.input}
          placeholder={placeholder}
          required={required}
        />
        {isOpen && (
          <div style={styles.dropdown}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => (
                <div
                  key={idx}
                  style={styles.dropdownItem}
                  onClick={() => handleSelectOption(option)}
                >
                  {option}
                </div>
              ))
            ) : (
              <div style={{ ...styles.dropdownItem, color: '#999', cursor: 'default' }}>
                No customers found. Click "+ Add New Customer" button above.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get("type") || "commercial-public";
  const selectedType = PROJECT_TYPES.find((t) => t.value === typeFromUrl) || PROJECT_TYPES[0];

  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contact: "",
    address: "",
    email: "",
    phone: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    customer: "",
    contractor: "",
    address: "",
    description: "",
    budget: "",
    labor_rate: "50",
    sq_ft: "",
    status: typeFromUrl === "residential-contractor" ? "bidding" : "active",
    start_date: new Date().toISOString().split("T")[0],
    percent_complete: "0",
    project_type: typeFromUrl,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("customer", { ascending: true });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      setCustomers(data || []);
    } catch (err) {
      console.error("Error loading customers:", err);
      // Fallback to localStorage if database fails
      const saved = localStorage.getItem("customers");
      if (saved) {
        const localCustomers = JSON.parse(saved);
        console.log("Using localStorage customers:", localCustomers);
        setCustomers(localCustomers);
      }
    }
  }

  async function handleAddCustomer() {
    if (!newCustomer.name.trim()) {
      return alert("Customer name is required");
    }

    try {
      // Get current user ID for company_id
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        alert("You must be logged in to add a customer");
        return;
      }

      const customerData = {
        customer: newCustomer.name.trim(),
        contact: newCustomer.contact.trim() || null,
        address: newCustomer.address.trim() || null,
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
        company_id: currentUser.id,
      };

      const { data, error } = await supabase
        .from("customers")
        .insert([customerData])
        .select()
        .single();

      if (error) throw error;

      // Reload customers list
      await loadCustomers();
      setShowModal(false);
      setNewCustomer({ name: "", contact: "", address: "", email: "", phone: "" });
      alert("Customer added successfully!");
    } catch (err) {
      console.error("Error adding customer:", err);
      alert("Failed to add customer: " + err.message);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name.trim()) {
      return alert("Project name is required");
    }

    setSaving(true);
    try {
      const projectData = {
        name: formData.name.trim(),
        created_by: user?.id,
        project_type: formData.project_type || typeFromUrl,
      };

      if (formData.customer?.trim()) {
        projectData.customer = formData.customer.trim();
      }
      if (formData.contractor?.trim()) {
        projectData.contractor = formData.contractor.trim();
      }
      if (formData.status) {
        projectData.status = formData.status;
      }
      if (formData.description?.trim()) {
        projectData.description = formData.description.trim();
      }
      if (formData.budget) {
        projectData.budget = parseFloat(formData.budget);
      }
      if (formData.labor_rate) {
        projectData.labor_rate = parseFloat(formData.labor_rate);
      }
      if (formData.start_date) {
        projectData.start_date = formData.start_date;
      }
      if (formData.percent_complete) {
        projectData.percent_complete = parseFloat(formData.percent_complete);
      }
      if (formData.sq_ft) {
        projectData.sq_ft = parseFloat(formData.sq_ft);
      }

      const { data, error} = await supabase
        .from("projects")
        .insert([projectData])
        .select()
        .single();

      if (error) throw error;

      alert("Project created successfully!");
      navigate(`/project/${data.id}`);
    } catch (err) {
      console.error("Error creating project:", err);
      alert("Failed to create project: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Create New Project</h1>
        <button onClick={() => navigate("/projects")} style={styles.backButton}>
          ← Back to Projects
        </button>
      </div>

      {/* Project Type Banner */}
      <div style={{ ...styles.typeBanner, backgroundColor: selectedType.color }}>
        <div style={styles.typeBannerIcon}>{selectedType.icon}</div>
        <div style={styles.typeBannerInfo}>
          <div style={styles.typeBannerLabel}>Project Type</div>
          <div style={styles.typeBannerValue}>{selectedType.label}</div>
          <div style={styles.typeBannerDesc}>{selectedType.desc}</div>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.changeTypeButton}
          title="Go back to choose a different project type"
        >
          ↩ Change Type
        </button>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={styles.sectionTitle}>Basic Information</h2>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={styles.addButton}
            >
              + Add New Customer
            </button>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Project Name <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={styles.input}
              placeholder="e.g., Residential Rewire - 123 Main St"
              required
            />
          </div>

          {typeFromUrl !== "residential-contractor" && (
            <AutocompleteInput
              name="customer"
              value={formData.customer}
              onChange={handleChange}
              options={customers.map((c) => c.customer)}
              placeholder="Select or type customer name..."
              label="Customer"
            />
          )}

          <AutocompleteInput
            name="contractor"
            value={formData.contractor}
            onChange={handleChange}
            options={customers.map((c) => c.customer)}
            placeholder="Select or type contractor name..."
            label="Contractor"
          />

          <div style={styles.field}>
            <label style={styles.label}>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              style={styles.input}
              placeholder="123 Main Street, City, State ZIP"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description / Scope</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              style={styles.textarea}
              placeholder="Full house rewire, panel upgrade, add outlets..."
              rows={4}
            />
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Financial Details</h2>

          <div style={typeFromUrl === "residential-contractor" ? {} : styles.row}>
            {typeFromUrl !== "residential-contractor" && (
              <div style={styles.field}>
                <label style={styles.label}>Total Budget ($)</label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="10000"
                  step="0.01"
                  min="0"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Labor Rate ($/hr)</label>
              <input
                type="number"
                name="labor_rate"
                value={formData.labor_rate}
                onChange={handleChange}
                style={styles.input}
                placeholder="50"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Project Details</h2>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="bidding">Bidding</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="bid_lost">Bid Lost</option>
                <option value="canceled">Canceled</option>
                <option value="postponed">Postponed</option>
                <option value="on-hold">On Hold</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Initial % Complete</label>
              <input
                type="number"
                name="percent_complete"
                value={formData.percent_complete}
                onChange={handleChange}
                style={styles.input}
                placeholder="0"
                min="0"
                max="100"
                step="1"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>📐 Square Footage (sq ft)</label>
              <input
                type="number"
                name="sq_ft"
                value={formData.sq_ft}
                onChange={handleChange}
                style={styles.input}
                placeholder="e.g., 2500"
                step="1"
                min="0"
              />
            </div>
          </div>
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => navigate("/projects")}
            style={styles.cancelButton}
          >
            Cancel
          </button>
          <button type="submit" style={styles.submitButton} disabled={saving}>
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>

      {/* Add Customer Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Add New Customer</h2>

            <div style={styles.field}>
              <label style={styles.label}>
                Name <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                style={styles.input}
                placeholder="Customer or company name"
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Contact Person</label>
              <input
                type="text"
                value={newCustomer.contact}
                onChange={(e) => setNewCustomer({ ...newCustomer, contact: e.target.value })}
                style={styles.input}
                placeholder="Contact name"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Address</label>
              <input
                type="text"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                style={styles.input}
                placeholder="Street address"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                style={styles.input}
                placeholder="email@example.com"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Phone</label>
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                style={styles.input}
                placeholder="(555) 123-4567"
              />
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomer}
                style={styles.submitButton}
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 900,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
  },
  typeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    borderRadius: 14,
    padding: "20px 28px",
    marginBottom: 28,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  typeBannerIcon: {
    fontSize: 48,
    lineHeight: 1,
    flexShrink: 0,
  },
  typeBannerInfo: {
    flex: 1,
  },
  typeBannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  typeBannerValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 2,
  },
  typeBannerDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  changeTypeButton: {
    padding: "10px 20px",
    backgroundColor: "rgba(255,255,255,0.2)",
    border: "2px solid rgba(255,255,255,0.5)",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 0,
    transition: "background-color 0.2s",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "2px solid #e5e7eb",
  },
  field: {
    marginBottom: 20,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  label: {
    display: "block",
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 0.2s",
    backgroundColor: "#fff",
    color: "#111",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    backgroundColor: "#fff",
    color: "#111",
  },
  select: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    gap: 16,
    justifyContent: "flex-end",
    marginTop: 32,
  },
  cancelButton: {
    padding: "14px 28px",
    backgroundColor: "transparent",
    border: "2px solid #d1d5db",
    color: "#374151",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButton: {
    padding: "14px 28px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    border: "2px solid #d1d5db",
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    maxHeight: 200,
    overflowY: "auto",
    zIndex: 1000,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "12px",
    cursor: "pointer",
    color: "#111",
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.2s",
  },
  addButton: {
    padding: "8px 16px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    maxWidth: 500,
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 24,
  },
  modalActions: {
    display: "flex",
    gap: 16,
    justifyContent: "flex-end",
    marginTop: 24,
  },
};

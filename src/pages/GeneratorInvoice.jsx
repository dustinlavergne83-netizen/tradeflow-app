import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify } from "../lib/notify";

const DEFAULT_SERVICES = [
  "Annual Generator Maintenance",
  "Oil & Filter Change",
  "Air Filter Replacement",
  "Spark Plug Replacement",
  "Battery Replacement",
  "Load Bank Testing",
  "Transfer Switch Inspection",
  "Fuel System Service",
  "Coolant Service",
  "Diagnostic / Repair",
];

const EMPTY_LINE = () => ({ id: Date.now() + Math.random(), description: "", quantity: 1, unitPrice: 0 });

function calcNextService(lastDate, intervalMonths) {
  if (!lastDate || !intervalMonths) return "";
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + Number(intervalMonths));
  return d.toISOString().slice(0, 10);
}

export default function GeneratorInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ── Generator / Customer state ─────────────────────────────
  const [generatorId, setGeneratorId] = useState(null);
  const [generator, setGenerator] = useState(null);   // full generator record from DB

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [genBrand, setGenBrand] = useState("");
  const [genModel, setGenModel] = useState("");
  const [genSerial, setGenSerial] = useState("");
  const [genKw, setGenKw] = useState("");
  const [genFuel, setGenFuel] = useState("");

  // ── Service tracking ───────────────────────────────────────
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [intervalMonths, setIntervalMonths] = useState(12);
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [techName, setTechName] = useState("");
  const [updateGeneratorRecord, setUpdateGeneratorRecord] = useState(true);

  // ── Invoice state ──────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [lineItems, setLineItems] = useState([EMPTY_LINE()]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // ── Customers for search (when no generatorId given) ───────
  const [customers, setCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custRef = useRef(null);

  // ── Load from URL params ───────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gId = params.get("generatorId");
    if (gId) {
      setGeneratorId(gId);
      loadGenerator(gId);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) loadCustomers();
  }, [user]);

  // close dropdown on outside click
  useEffect(() => {
    function h(e) {
      if (custRef.current && !custRef.current.contains(e.target)) setShowCustDrop(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // auto-calc next service
  useEffect(() => {
    setNextServiceDate(calcNextService(serviceDate, intervalMonths));
  }, [serviceDate, intervalMonths]);

  async function loadGenerator(id) {
    const { data, error } = await supabase.from("generators").select("*").eq("id", id).single();
    if (error || !data) { notify("Could not load generator record"); return; }
    setGenerator(data);
    setCustomerName(data.customer_name ?? "");
    setCustomerAddress(data.customer_address ?? "");
    setCustomerPhone(data.customer_phone ?? "");
    setCustomerEmail(data.customer_email ?? "");
    setGenBrand(data.brand ?? "");
    setGenModel(data.model ?? "");
    setGenSerial(data.serial_number ?? "");
    setGenKw(data.kw_size ?? "");
    setGenFuel(data.fuel_type ?? "");
    setIntervalMonths(data.service_interval_months ?? 12);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("id, customer, address, phone, email")
      .eq("company_id", user.id)
      .order("customer");
    setCustomers(data ?? []);
  }

  function pickCustomer(c) {
    setCustomerName(c.customer ?? "");
    setCustomerAddress(c.address ?? "");
    setCustomerPhone(c.phone ?? "");
    setCustomerEmail(c.email ?? "");
    setCustSearch(c.customer ?? "");
    setShowCustDrop(false);
  }

  // ── Line items ────────────────────────────────────────────
  function addLine(desc = "") {
    setLineItems((prev) => [...prev, { ...EMPTY_LINE(), description: desc }]);
  }

  function removeLine(id) {
    setLineItems((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  function updateLine(id, field, val) {
    setLineItems((prev) => prev.map((l) => l.id === id ? { ...l, [field]: val } : l));
  }

  const subtotal = lineItems.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    if (!customerName.trim()) return notify("Customer name is required");
    if (lineItems.some((l) => !l.description.trim())) return notify("Fill in all line item descriptions");
    if (!user) return;

    setIsSaving(true);
    try {
      // 1. Auto-generate invoice number
      let finalNum = invoiceNumber.trim();
      if (!finalNum) {
        const { data: last } = await supabase
          .from("invoices")
          .select("invoice_number")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const baseNum = last?.[0] ? parseInt(last[0].invoice_number.split("-")[0]) || 1000 : 1000;
        finalNum = String(baseNum + 1);
      }

      // 2. Build project name / notes
      const genDesc = [genBrand, genModel, genSerial ? `SN: ${genSerial}` : ""].filter(Boolean).join(" | ");
      const projectLabel = `Generator Service – ${customerName}`;
      const notesText = [
        genDesc ? `Generator: ${genDesc}` : "",
        genKw ? `${genKw} kW` : "",
        genFuel || "",
        techName ? `Tech: ${techName}` : "",
        invoiceNotes,
      ].filter(Boolean).join("\n");

      // 3. Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert([{
          invoice_number: finalNum,
          project_name: projectLabel,
          customer_name: customerName,
          customer_email: customerEmail || null,
          invoice_date: invoiceDate,
          subtotal,
          total: subtotal,
          balance_due: subtotal,
          amount_paid: 0,
          status: "draft",
          notes: notesText || null,
          created_by: user.id,
        }])
        .select()
        .single();

      if (invErr) throw invErr;

      // 4. Create invoice line items
      const { error: itemErr } = await supabase.from("invoice_items").insert(
        lineItems.map((l) => ({
          invoice_id: invoice.id,
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unitPrice),
          total: Number(l.quantity) * Number(l.unitPrice),
        }))
      );
      if (itemErr) throw itemErr;

      // 5. Update generator record (last service date + next service date)
      if (updateGeneratorRecord) {
        const updates = {
          last_service_date: serviceDate,
          next_service_date: nextServiceDate || null,
          service_interval_months: Number(intervalMonths),
          status: "active",
          // also keep generator details in sync if edited
          customer_name: customerName,
          customer_address: customerAddress,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          brand: genBrand,
          model: genModel,
          serial_number: genSerial,
          kw_size: genKw !== "" ? parseFloat(genKw) : null,
          fuel_type: genFuel,
        };

        if (generatorId) {
          // Update existing generator
          await supabase.from("generators").update(updates).eq("id", generatorId);
        } else {
          // Create a new generator record
          await supabase.from("generators").insert([{
            ...updates,
            company_id: user.id,
            customer_id: null,
            notes: "",
          }]);
        }
      }

      notify(`⚡ Generator Invoice #${finalNum} saved!`);
      navigate("/invoices");
    } catch (err) {
      console.error(err);
      notify("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const filteredCustomers = customers.filter((c) =>
    c.customer?.toLowerCase().includes(custSearch.toLowerCase())
  );

  // ── UI ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#111" }}>
            ⚡ Generator Invoice
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
            Creates an invoice & updates the generator service record automatically
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/generators")} style={btnGray}>← Back</button>
          <button onClick={handleSave} disabled={isSaving} style={btnOrange}>
            {isSaving ? "Saving…" : "💾 Save Invoice"}
          </button>
        </div>
      </div>

      {/* ── Section: Invoice Info ── */}
      <Card title="📄 Invoice Details">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Invoice Number" placeholder="Leave blank to auto-generate"
            value={invoiceNumber} onChange={setInvoiceNumber} />
          <Field label="Invoice Date" type="date" value={invoiceDate} onChange={setInvoiceDate} />
        </div>
      </Card>

      {/* ── Section: Customer ── */}
      <Card title="👤 Customer Information">
        {!generatorId ? (
          <div ref={custRef} style={{ position: "relative", marginBottom: 12 }}>
            <label style={labelStyle}>Search Customer</label>
            <input
              type="text"
              placeholder="Start typing customer name…"
              value={custSearch}
              onChange={(e) => { setCustSearch(e.target.value); setCustomerName(e.target.value); setShowCustDrop(true); }}
              onFocus={() => setShowCustDrop(true)}
              style={inputStyle}
            />
            {showCustDrop && custSearch.length > 0 && filteredCustomers.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {filteredCustomers.slice(0, 8).map((c) => (
                  <button key={c.id} onClick={() => pickCustomer(c)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f0f7ff"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <div style={{ fontWeight: 700 }}>{c.customer}</div>
                    {c.address && <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.address}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0f7ff", borderRadius: 8, fontSize: 13, color: "#1d4ed8", fontWeight: 700 }}>
            ✅ Pre-filled from generator record — edit below if needed
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Customer Name *" value={customerName} onChange={setCustomerName} placeholder="Full name" span={2} />
          <Field label="Address" value={customerAddress} onChange={setCustomerAddress} placeholder="123 Main St, City, ST" span={2} />
          <Field label="Phone" value={customerPhone} onChange={setCustomerPhone} placeholder="(555) 000-0000" />
          <Field label="Email" value={customerEmail} onChange={setCustomerEmail} placeholder="email@example.com" />
        </div>
      </Card>

      {/* ── Section: Generator Info ── */}
      <Card title="⚡ Generator Information">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Brand" value={genBrand} onChange={setGenBrand} placeholder="e.g. Generac" />
          <Field label="Model" value={genModel} onChange={setGenModel} placeholder="e.g. 22000EWCL" />
          <Field label="Serial Number" value={genSerial} onChange={setGenSerial} placeholder="SN12345678" />
          <Field label="KW Size" value={genKw} onChange={setGenKw} placeholder="e.g. 22" type="number" />
          <div>
            <label style={labelStyle}>Fuel Type</label>
            <select value={genFuel} onChange={(e) => setGenFuel(e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {["Natural Gas", "Propane", "Liquid Propane", "Diesel"].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <Field label="Technician Name" value={techName} onChange={setTechName} placeholder="Tech's name" />
        </div>
      </Card>

      {/* ── Section: Service Tracking ── */}
      <Card title="🔧 Service Tracking">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Service Date" type="date" value={serviceDate} onChange={setServiceDate} />
          <div>
            <label style={labelStyle}>Service Interval (months)</label>
            <input type="number" min="1" max="120" value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Next Service Date (auto)</label>
            <input type="date" value={nextServiceDate}
              onChange={(e) => setNextServiceDate(e.target.value)}
              style={{ ...inputStyle, background: "#f0f7ff" }} />
            <p style={{ fontSize: 10, color: "#6b7280", margin: "3px 0 0" }}>Auto from service date + interval</p>
          </div>
        </div>

        {/* Toggle to update generator record */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={updateGeneratorRecord}
            onChange={(e) => setUpdateGeneratorRecord(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: updateGeneratorRecord ? "#0b3ea8" : "#6b7280" }}>
            {generatorId
              ? "✅ Update generator record with this service date when saved"
              : "✅ Create a new generator record when saved"}
          </span>
        </label>
      </Card>

      {/* ── Section: Line Items ── */}
      <Card title="🛠️ Services & Parts">
        {/* Quick-add buttons */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Quick add:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEFAULT_SERVICES.map((s) => (
              <button
                key={s}
                onClick={() => addLine(s)}
                style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 700,
                  background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                  borderRadius: 6, cursor: "pointer",
                }}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Line items table */}
        <div style={{ borderTop: "1.5px solid #e5e7eb", paddingTop: 12 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 110px 36px", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f3f4f6" }}>
            {["Description", "Qty", "Unit Price", "Total", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {lineItems.map((item) => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 110px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Description of work or part…"
                value={item.description}
                onChange={(e) => updateLine(item.id, "description", e.target.value)}
                style={{ ...inputStyle, fontSize: 13 }}
              />
              <input
                type="number"
                min="0"
                step="0.5"
                value={item.quantity}
                onChange={(e) => updateLine(item.id, "quantity", e.target.value)}
                style={{ ...inputStyle, fontSize: 13, textAlign: "center" }}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateLine(item.id, "unitPrice", e.target.value)}
                style={{ ...inputStyle, fontSize: 13, textAlign: "right" }}
                placeholder="0.00"
              />
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111", textAlign: "right", padding: "0 4px" }}>
                ${(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
              </div>
              <button
                onClick={() => removeLine(item.id)}
                style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 14, fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add line button */}
          <button
            onClick={() => addLine()}
            style={{ marginTop: 8, padding: "8px 16px", background: "#f9fafb", border: "1.5px dashed #d1d5db", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer", width: "100%" }}
          >
            + Add Line Item
          </button>
        </div>

        {/* Subtotal */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "2px solid #e5e7eb" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>${subtotal.toFixed(2)}</div>
          </div>
        </div>
      </Card>

      {/* ── Section: Notes ── */}
      <Card title="📝 Notes">
        <textarea
          placeholder="Any additional notes for the invoice…"
          value={invoiceNotes}
          onChange={(e) => setInvoiceNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Card>

      {/* Save footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8, marginBottom: 40 }}>
        <button onClick={() => navigate("/generators")} style={btnGray}>Cancel</button>
        <button onClick={handleSave} disabled={isSaving} style={btnOrange}>
          {isSaving ? "Saving…" : "💾 Save Invoice"}
        </button>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e5e7eb", padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0b3ea8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #eff6ff" }}>
        {title}
      </div>
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

const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 };
const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const btnOrange = { background: "#fc6b04", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const btnGray = { background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" };

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify } from '../lib/notify';

export default function QuickInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [pendingDepositIds, setPendingDepositIds] = useState([]);
  const [pendingDepositTotal, setPendingDepositTotal] = useState(0);
  const [description, setDescription] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [autoGenerateNumber, setAutoGenerateNumber] = useState(true);
  const [lineItems, setLineItems] = useState([
    { id: 1, description: "", quantity: 1, unitPrice: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-populate fields from URL params (when launched from a project)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramCustomerName = params.get('customerName');
    const paramCustomerEmail = params.get('customerEmail');
    const paramProjectName = params.get('projectName');
    const paramProjectId = params.get('projectId');

    if (paramCustomerName) setCustomerName(paramCustomerName);
    if (paramCustomerEmail) setCustomerEmail(paramCustomerEmail);
    if (paramProjectName) setProjectName(paramProjectName);
    if (paramProjectId) setProjectId(paramProjectId);

    const depositIdsParam = params.get('depositIds');
    const depositTotalParam = params.get('depositTotal');
    if (depositIdsParam) setPendingDepositIds(depositIdsParam.split(',').filter(Boolean));
    if (depositTotalParam) setPendingDepositTotal(parseFloat(depositTotalParam) || 0);
  }, [location.search]);

  useEffect(() => {
    loadCustomers();
  }, [user]);

  async function loadCustomers() {
    if (!user) {
      console.log("No user yet, skipping customer load");
      return;
    }
    
    try {
      console.log("Loading customers for user:", user.id);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", user.id)
        .order("customer");

      if (error) {
        console.error("ERROR loading customers:", error.message, error);
      }
      
      // If error OR no customers with company_id, load all customers as fallback
      if (error || !data || data.length === 0) {
        console.log("Attempting fallback: loading all customers");
        const { data: allData, error: allError } = await supabase
          .from("customers")
          .select("*")
          .order("customer");
        
        if (!allError && allData) {
          console.log("Loaded customers without company filter:", allData.length);
          setCustomers(allData);
        } else {
          setCustomers([]);
        }
        return;
      }
      
      setCustomers(data || []);
      console.log("Successfully loaded customers:", data?.length || 0);
    } catch (err) {
      console.error("Exception loading customers:", err);
      setCustomers([]);
    }
  }

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems([...lineItems, { id: newId, description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.unitPrice));
    }, 0);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      notify("Please enter a customer name");
      return;
    }
    
    if (lineItems.some(item => !item.description.trim())) {
      notify("Please fill in all line item descriptions");
      return;
    }

    setIsSaving(true);
    try {
      const total = calculateTotal();
      
      // Determine invoice number: use custom if provided, otherwise auto-generate
      let finalInvoiceNumber = invoiceNumber && invoiceNumber.trim() ? invoiceNumber.trim() : null;
      
      // If no custom number provided, auto-generate next sequential number
      if (!finalInvoiceNumber) {
        const { data: allInvoices } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        let nextNumber = 1001;
        
        if (allInvoices && allInvoices.length > 0) {
          const lastInvoiceNum = allInvoices[0].invoice_number;
          // Extract the base number (handles both "1001" and "1001-1" formats)
          const baseNum = parseInt(lastInvoiceNum.split('-')[0]) || 1000;
          nextNumber = baseNum + 1;
        }
        
        finalInvoiceNumber = String(nextNumber);
      }
      
      // Create the invoice
      const invoiceData = {
        invoice_number: finalInvoiceNumber,
        project_name: projectName || "Quick Invoice",
        customer_name: customerName,
        customer_email: customerEmail || null,
        invoice_date: invoiceDate,
        subtotal: total,
        total: total,
        balance_due: total,
        amount_paid: 0,
        status: 'draft',
        notes: description || null,
        created_by: user.id
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const items = lineItems.map(item => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        
        return {
          invoice_id: invoice.id,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
          total: lineTotal
        };
      });

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Apply any pending deposits from the project
      if (pendingDepositIds.length > 0) {
        await supabase.from('invoices').update({ deposit_received: pendingDepositTotal }).eq('id', invoice.id);
        for (const depId of pendingDepositIds) {
          await supabase.from('project_deposits').update({
            status: 'applied',
            invoice_id: invoice.id,
            applied_date: new Date().toISOString(),
          }).eq('id', depId);
        }
      }

      // Don't create journal entry here - it will be created when the invoice is SENT
      const depositMsg = pendingDepositIds.length > 0 ? `\n💰 $${pendingDepositTotal.toFixed(2)} deposit applied!` : '';
      notify(`Quick Invoice #${finalInvoiceNumber} saved successfully!${depositMsg}`);

      if (projectId) {
        navigate(`/project/${projectId}`);
      } else {
        navigate("/invoices");
      }
    } catch (err) {
      console.error("Error saving quick invoice:", err);
      notify(`Failed to save invoice: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Quick Invoice</h1>
        <div style={styles.headerButtons}>
          <button
            onClick={() => projectId ? navigate(`/project/${projectId}`) : navigate("/invoices")}
            style={styles.cancelButton}
          >
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "💾 Save Invoice"}
          </button>
        </div>
      </div>

      {/* Deposit Banner */}
      {pendingDepositIds.length > 0 && (
        <div style={{marginBottom: 20, padding: '14px 20px', backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontSize: 24}}>💰</span>
          <div>
            <div style={{fontWeight: '700', fontSize: 15, color: '#065f46'}}>
              ${pendingDepositTotal.toFixed(2)} deposit will be applied to this invoice
            </div>
            <div style={{fontSize: 13, color: '#047857', marginTop: 2}}>
              {pendingDepositIds.length} deposit(s) from this project will automatically be applied when you save.
            </div>
          </div>
        </div>
      )}

      <div style={styles.form}>
        {/* Basic Info */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Basic Information</h2>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={styles.input}
                placeholder="Leave blank to auto-generate"
              />
              <div style={{fontSize: 12, color: '#666', marginTop: 6}}>
                {invoiceNumber ? `Custom: ${invoiceNumber}` : 'Will auto-generate next sequential number'}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={{...styles.input, colorScheme: 'light'}}
              />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Customer Name *</label>
              <div style={{position: 'relative'}}>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerName(value);
                    if (value.trim()) {
                      const filtered = customers.filter(c => 
                        c.customer.toLowerCase().includes(value.toLowerCase())
                      );
                      setFilteredCustomers(filtered);
                      setShowCustomerDropdown(filtered.length > 0);
                    } else {
                      setShowCustomerDropdown(false);
                    }
                  }}
                  onFocus={() => {
                    if (customerName.trim() && filteredCustomers.length > 0) {
                      setShowCustomerDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  style={styles.input}
                  placeholder="Type to search customers..."
                  autoComplete="off"
                />
                {showCustomerDropdown && (
                  <div style={styles.dropdown}>
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        style={styles.dropdownItem}
                        onClick={() => {
                          setCustomerName(customer.customer);
                          // Auto-fill email when customer is selected
                          if (customer.email) setCustomerEmail(customer.email);
                          setShowCustomerDropdown(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        <div style={{fontWeight: '600'}}>{customer.customer}</div>
                        {customer.email && <div style={{fontSize: 12, color: '#888'}}>{customer.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project/Job Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={styles.input}
                placeholder="Enter project name"
              />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={{
                  ...styles.input,
                  borderColor: customerEmail ? '#10b981' : '#e5e7eb',
                  backgroundColor: customerEmail ? '#f0fdf4' : '#fff',
                }}
                placeholder="customer@email.com"
              />
              {customerEmail && (
                <div style={{fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: '600'}}>
                  ✓ Email linked — invoice can be emailed to customer
                </div>
              )}
            </div>
            <div style={styles.field}>
              {/* spacer */}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Description/Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{...styles.input, minHeight: 80, resize: "vertical"}}
              placeholder="Enter any additional details"
            />
          </div>
        </div>

        {/* Line Items */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Line Items</h2>
            <button onClick={addLineItem} style={styles.addButton}>
              + Add Line
            </button>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={{...styles.th, width: "8%", textAlign: "center"}}>Item #</th>
                  <th style={{...styles.th, width: "40%"}}>Description</th>
                  <th style={{...styles.th, width: "12%", textAlign: "center"}}>Qty</th>
                  <th style={{...styles.th, width: "15%", textAlign: "right"}}>Cost</th>
                  <th style={{...styles.th, width: "15%", textAlign: "right"}}>Total Cost</th>
                  <th style={{...styles.th, width: "10%"}}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const lineTotal = Number(item.quantity) * Number(item.unitPrice);
                  
                  return (
                    <tr key={item.id} style={styles.tableRow}>
                      <td style={{...styles.td, textAlign: "center"}}>
                        <span style={styles.itemNumber}>{index + 1}</span>
                      </td>
                      <td style={styles.td}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          style={styles.tableInput}
                          placeholder="Item description"
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                          style={{...styles.tableInput, textAlign: "center"}}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                          style={{...styles.tableInput, textAlign: "right"}}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td style={{...styles.td, textAlign: "right"}}>
                        <span style={styles.itemTotal}>
                          ${lineTotal.toFixed(2)}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(item.id)}
                            style={styles.deleteButton}
                            title="Remove line"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total */}
        <div style={styles.totalSection}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>TOTAL:</span>
            <span style={styles.totalAmount}>${calculateTotal().toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  saveButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    color: "#333",
  },
  addButton: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#fff",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "12px",
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    textTransform: "uppercase",
    textAlign: "left",
  },
  tableRow: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "12px",
  },
  tableInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    color: "#333",
  },
  itemNumber: {
    fontWeight: "700",
    color: "#666",
    fontSize: 15,
  },
  itemTotal: {
    fontWeight: "700",
    color: "#333",
    fontSize: 15,
  },
  deleteButton: {
    width: 28,
    height: 28,
    padding: 0,
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  totalSection: {
    borderTop: "2px solid #e5e7eb",
    paddingTop: 20,
    display: "flex",
    justifyContent: "flex-end",
  },
  totalRow: {
    display: "flex",
    alignItems: "center",
    gap: 30,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fc6b04",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderTop: "none",
    borderRadius: "0 0 6px 6px",
    maxHeight: "200px",
    overflowY: "auto",
    zIndex: 1000,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "12px",
    cursor: "pointer",
    fontSize: 15,
    color: "#333",
    borderBottom: "1px solid #f3f4f6",
  },
};

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function ProgressInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const estimateId = searchParams.get("estimateId");
  const projectId = searchParams.get("projectId");

  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState(null);
  const [project, setProject] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [itemBillingAmounts, setItemBillingAmounts] = useState({});

  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [progressNumber, setProgressNumber] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [estimateId, projectId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load estimate
      if (estimateId) {
        const { data: estData } = await supabase
          .from("estimates")
          .select("*")
          .eq("id", estimateId)
          .single();

        if (estData) {
          setEstimate(estData);
          setInvoiceNumber(`${estData.estimate_number}-Progress-${progressNumber}`);

          // Load estimate items
          const { data: itemsData } = await supabase
            .from("estimate_items")
            .select("*")
            .eq("estimate_id", estimateId)
            .order("sequence");

          if (itemsData) {
            setEstimateItems(itemsData);
            // Initialize billing amounts with full item totals
            const initialAmounts = {};
            itemsData.forEach(item => {
              initialAmounts[item.id] = item.line_total || 0;
            });
            setItemBillingAmounts(initialAmounts);
          }

          // Load project
          if (projectId) {
            const { data: projData } = await supabase
              .from("projects")
              .select("*")
              .eq("id", projectId)
              .single();
            if (projData) {
              setProject(projData);
              setCustomerName(projData.customer_name || "");
              setCustomerEmail(projData.customer_email || "");
            }
          } else if (estData.project_name) {
            const { data: projData } = await supabase
              .from("projects")
              .select("*")
              .eq("name", estData.project_name)
              .single();
            if (projData) {
              setProject(projData);
              setCustomerName(projData.customer_name || "");
              setCustomerEmail(projData.customer_email || "");
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
      notify("Error loading estimate data");
    } finally {
      setLoading(false);
    }
  }

  const toggleItemSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBillingAmountChange = (itemId, amount) => {
    setItemBillingAmounts({
      ...itemBillingAmounts,
      [itemId]: parseFloat(amount) || 0
    });
  };

  const selectedTotal = Array.from(selectedItems).reduce(
    (sum, itemId) => sum + (itemBillingAmounts[itemId] || 0),
    0
  );

  async function handleCreateProgressInvoice() {
    if (selectedItems.size === 0) {
      notify("Please select at least one item to bill for");
      return;
    }

    if (!invoiceNumber || !invoiceDate) {
      notify("Please enter invoice number and date");
      return;
    }

    try {
      // Create invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([{
          company_id: user.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          customer_name: customerName,
          customer_email: customerEmail,
          status: "draft",
          notes: notes,
          subtotal: selectedTotal,
          total: selectedTotal,
          balance_due: selectedTotal,
          project_id: project?.id,
          is_progress_invoice: true,
          progress_number: progressNumber,
          estimate_id: estimateId
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Add selected items to invoice
      const invoiceItems = Array.from(selectedItems).map(itemId => {
        const item = estimateItems.find(e => e.id === itemId);
        const billedAmount = itemBillingAmounts[itemId] || 0;
        const percentage = item.line_total > 0 ? (billedAmount / item.line_total * 100).toFixed(1) : 0;

        return {
          invoice_id: newInvoice.id,
          description: `${item.description}\nOriginal: $${(item.line_total || 0).toFixed(2)}, This Invoice: $${billedAmount.toFixed(2)} (${percentage}%), Previously Billed: $0.00, Remaining: $${((item.line_total || 0) - billedAmount).toFixed(2)}`,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: billedAmount,
          estimate_item_id: itemId
        };
      });

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      notify(`✅ Progress Invoice #${invoiceNumber} created successfully!`);
      navigate(`/invoice?invoiceId=${newInvoice.id}`);
    } catch (err) {
      console.error("Error creating progress invoice:", err);
      notify(`Error creating progress invoice: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading estimate...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Estimate not found</div>
        <button onClick={() => navigate(-1)} style={styles.button}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Create Progress Invoice</h1>
          <p style={styles.subtitle}>
            From: {estimate.description || `Estimate #${estimate.estimate_number}`}
          </p>
        </div>
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          ← Back
        </button>
      </div>

      <div style={styles.content}>
        {/* Invoice Details Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Invoice Details</h2>

          <div style={styles.grid2}>
            <div style={styles.field}>
              <label style={styles.label}>Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Progress Invoice #</label>
              <input
                type="number"
                value={progressNumber}
                onChange={(e) => setProgressNumber(parseInt(e.target.value) || 1)}
                style={styles.input}
                min="1"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{...styles.input, minHeight: 80}}
              placeholder="Progress billing details, payment terms, etc."
            />
          </div>
        </div>

        {/* Line Items Selection Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Select Items to Bill</h2>
          <p style={styles.description}>
            Choose which items you want to include in this progress invoice and specify the amount to bill for each.
          </p>

          <div style={styles.itemsTable}>
            <div style={styles.tableHeader}>
              <div style={{width: 40, textAlign: 'center'}}>Select</div>
              <div style={{flex: 1}}>Item Description</div>
              <div style={{width: 120, textAlign: 'right'}}>Est. Amount</div>
              <div style={{width: 150, textAlign: 'right'}}>Bill This Time</div>
              <div style={{width: 100, textAlign: 'right'}}>% of Total</div>
            </div>

            {estimateItems.map((item) => {
              const billingAmount = itemBillingAmounts[item.id] || 0;
              const percentage = item.line_total > 0 ? (billingAmount / item.line_total * 100).toFixed(1) : 0;
              const isSelected = selectedItems.has(item.id);

              return (
                <div key={item.id} style={{...styles.tableRow, backgroundColor: isSelected ? '#f0f9ff' : '#fff'}}>
                  <div style={{width: 40, textAlign: 'center'}}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItemSelection(item.id)}
                      style={{width: 20, height: 20, cursor: 'pointer'}}
                    />
                  </div>
                  <div style={{flex: 1, fontWeight: isSelected ? '600' : '400'}}>
                    {item.description}
                  </div>
                  <div style={{width: 120, textAlign: 'right', fontWeight: '600'}}>
                    ${(item.line_total || 0).toFixed(2)}
                  </div>
                  <div style={{width: 150}}>
                    <input
                      type="number"
                      step="0.01"
                      value={billingAmount}
                      onChange={(e) => handleBillingAmountChange(item.id, e.target.value)}
                      disabled={!isSelected}
                      style={{
                        ...styles.amountInput,
                        backgroundColor: isSelected ? '#fff' : '#f3f4f6',
                        cursor: isSelected ? 'text' : 'not-allowed',
                        opacity: isSelected ? 1 : 0.5
                      }}
                    />
                  </div>
                  <div style={{width: 100, textAlign: 'right', fontWeight: '600', color: isSelected ? BRAND.accent : '#999'}}>
                    {percentage}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={styles.summary}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Items Selected:</span>
              <span style={styles.summaryValue}>{selectedItems.size} of {estimateItems.length}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Total to Bill:</span>
              <span style={{...styles.summaryValue, fontSize: 24, color: BRAND.accent, fontWeight: 'bold'}}>
                ${selectedTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionButtons}>
          <button
            onClick={handleCreateProgressInvoice}
            style={{...styles.button, background: '#10b981'}}
          >
            ✓ Create Progress Invoice
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{...styles.button, background: '#6b7280'}}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1200,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    margin: 0,
    color: "#111",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    margin: "8px 0 0 0",
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "#e5e7eb",
    border: "none",
    color: "#111",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
  },
  itemsTable: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 24,
  },
  tableHeader: {
    display: "flex",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: "bold",
    fontSize: 13,
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "flex",
    gap: 12,
    padding: "16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  amountInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "2px solid #d1d5db",
    borderRadius: 6,
    textAlign: "right",
    fontWeight: "600",
  },
  summary: {
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "2px solid #e5e7eb",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  actionButtons: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-start",
  },
  button: {
    padding: "12px 32px",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "600",
  },
  loading: {
    textAlign: "center",
    padding: 40,
    fontSize: 18,
    color: "#666",
  },
  error: {
    textAlign: "center",
    padding: 40,
    fontSize: 18,
    color: "#ef4444",
  },
};

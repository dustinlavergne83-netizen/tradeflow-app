import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";
import { notify } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function InvoiceCommercialPublic() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get("invoiceId");
  
  const [isEditing, setIsEditing] = useState(!invoiceId);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: "",
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: "",
    customer_name: "",
    project_name: "",
    notes: "",
  });
  
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: "", unit_price: "", total: 0 },
    { description: "", quantity: "", unit_price: "", total: 0 },
    { description: "", quantity: "", unit_price: "", total: 0 },
    { description: "", quantity: "", unit_price: "", total: 0 },
    { description: "", quantity: "", unit_price: "", total: 0 },
    { description: "", quantity: "", unit_price: "", total: 0 },
  ]);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  async function loadInvoice() {
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      
      setInvoiceData({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        due_date: invoice.due_date || "",
        customer_name: invoice.customer_name || "",
        project_name: invoice.project_name || "",
        notes: invoice.notes || "",
      });

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at");

      if (itemsError) throw itemsError;
      
      if (items && items.length > 0) {
        const loadedItems = items.map(item => ({
          description: item.description || "",
          quantity: item.quantity || "",
          unit_price: item.unit_price || "",
          total: item.total || 0,
        }));
        // Pad with empty rows to always have 6 rows
        while (loadedItems.length < 6) {
          loadedItems.push({ description: "", quantity: "", unit_price: "", total: 0 });
        }
        setLineItems(loadedItems);
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error("Error loading invoice:", err);
      notify("Error loading invoice");
    }
  }

  function updateLineItem(index, field, value) {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].unit_price) || 0;
      newItems[index].total = qty * price;
    }
    
    setLineItems(newItems);
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const tax = subtotal * 0.0; // Set tax rate as needed
  const totalDue = subtotal + tax;

  async function handleSave() {
    if (!invoiceData.invoice_number || !invoiceData.customer_name) {
      notify("Please fill in Invoice Number and Customer Name");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const invoiceToSave = {
        user_id: user.id,
        invoice_number: invoiceData.invoice_number,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date || null,
        customer_name: invoiceData.customer_name,
        project_name: invoiceData.project_name || null,
        notes: invoiceData.notes || null,
        amount_paid: 0,
        created_at: new Date().toISOString(),
      };

      let savedInvoiceId;
      
      if (invoiceId) {
        // Update existing
        const { error: updateError } = await supabase
          .from("invoices")
          .update(invoiceToSave)
          .eq("id", invoiceId);
        
        if (updateError) throw updateError;
        
        // Delete old items
        await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoiceId);
        
        savedInvoiceId = invoiceId;
      } else {
        // Create new
        const { data: newInvoice, error: insertError } = await supabase
          .from("invoices")
          .insert([invoiceToSave])
          .select()
          .single();
        
        if (insertError) throw insertError;
        savedInvoiceId = newInvoice.id;
      }

      // Save line items
      const itemsToSave = lineItems
        .filter(item => item.description || item.quantity || item.unit_price)
        .map(item => ({
          invoice_id: savedInvoiceId,
          description: item.description || "",
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          total: item.total || 0,
        }));

      if (itemsToSave.length > 0) {
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsToSave);
        
        if (itemsError) throw itemsError;
      }

      notify("Invoice saved successfully!");
      setIsEditing(false);
      
      // Update URL with invoice ID
      if (!invoiceId) {
        navigate(`/invoice/commercial-public?invoiceId=${savedInvoiceId}`, { replace: true });
      }
    } catch (err) {
      console.error("Error saving invoice:", err);
      notify("Error saving invoice: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  }

  return (
    <div style={styles.container}>
      {/* Action Buttons - Hidden when printing */}
      <div style={styles.actionButtons} className="no-print">
        {isEditing ? (
          <>
            <button onClick={handleSave} style={{...styles.button, ...styles.saveButton}} disabled={isSaving}>
              {isSaving ? "Saving..." : "💾 Save Invoice"}
            </button>
            {invoiceId && (
              <button onClick={() => setIsEditing(false)} style={{...styles.button, ...styles.cancelButton}}>
                ❌ Cancel
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} style={{...styles.button, ...styles.editButton}}>
              ✏️ Edit
            </button>
            <button onClick={() => window.print()} style={{...styles.button, ...styles.printButton}}>
              🖨️ Print / PDF
            </button>
            <button onClick={() => notify("Email feature coming soon!")} style={{...styles.button, ...styles.emailButton}}>
              📧 Email
            </button>
          </>
        )}
      </div>

      {/* Invoice Document */}
      <div style={styles.invoice}>
        {/* Header - Date, Logo, Invoice# all in one line */}
        <div style={styles.topHeader}>
          <div style={styles.dateSection}>
            {isEditing ? (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Date:</label>
                  <input
                    type="date"
                    value={invoiceData.invoice_date}
                    onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                    style={styles.dateInput}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Due:</label>
                  <input
                    type="date"
                    value={invoiceData.due_date}
                    onChange={(e) => setInvoiceData({...invoiceData, due_date: e.target.value})}
                    style={styles.dateInput}
                  />
                </div>
              </>
            ) : (
              <>
                <p style={styles.dateText}>Date: {formatDate(invoiceData.invoice_date)}</p>
                {invoiceData.due_date && <p style={styles.dateText}>Due: {formatDate(invoiceData.due_date)}</p>}
              </>
            )}
          </div>
          <div style={styles.logoSection}>
            <img src={logoImage} alt="DML Electrical Service LLC" style={styles.logo} />
            <p style={styles.contactInfo}>
              Phone: (555) 123-4567 | Email: info@dmlelectrical.com | License #: 12345
            </p>
          </div>
          <div style={styles.invoiceTitle}>
            {isEditing ? (
              <input
                type="text"
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
                placeholder="Invoice #"
                style={styles.invoiceNumberInput}
              />
            ) : (
              <h2 style={styles.invoiceNumber}>INVOICE #{invoiceData.invoice_number}</h2>
            )}
          </div>
        </div>

        <hr style={styles.divider} />

        {/* Bill To & Project - Side by Side */}
        <div style={styles.infoSection}>
          <div style={styles.billTo}>
            <h3 style={styles.sectionTitle}>Bill To:</h3>
            {isEditing ? (
              <input
                type="text"
                value={invoiceData.customer_name}
                onChange={(e) => setInvoiceData({...invoiceData, customer_name: e.target.value})}
                placeholder="Customer Name"
                style={styles.textInput}
              />
            ) : (
              <p style={styles.customerName}>{invoiceData.customer_name}</p>
            )}
          </div>
          <div style={styles.projectInfo}>
            <h3 style={styles.sectionTitle}>Project:</h3>
            {isEditing ? (
              <input
                type="text"
                value={invoiceData.project_name}
                onChange={(e) => setInvoiceData({...invoiceData, project_name: e.target.value})}
                placeholder="Project Name (Optional)"
                style={styles.textInput}
              />
            ) : (
              <p style={styles.projectName}>{invoiceData.project_name || "—"}</p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div style={styles.itemsSection}>
          <h3 style={styles.sectionTitle}>Invoice Items</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left'}}>Description</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Unit Price</th>
                <th style={styles.th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={{...styles.td, textAlign: 'left'}}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        style={styles.tableInput}
                      />
                    ) : (
                      item.description || " "
                    )}
                  </td>
                  <td style={styles.td}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        style={{...styles.tableInput, textAlign: 'right'}}
                      />
                    ) : (
                      item.quantity || " "
                    )}
                  </td>
                  <td style={styles.td}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                        style={{...styles.tableInput, textAlign: 'right'}}
                        step="0.01"
                      />
                    ) : (
                      item.unit_price ? `$${parseFloat(item.unit_price).toFixed(2)}` : " "
                    )}
                  </td>
                  <td style={styles.td}>
                    {item.total > 0 ? `$${item.total.toFixed(2)}` : " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={styles.totalsSection}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Subtotal:</span>
            <span style={styles.totalValue}>${subtotal.toFixed(2)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Tax:</span>
            <span style={styles.totalValue}>${tax.toFixed(2)}</span>
          </div>
          <div style={styles.balanceDueRow}>
            <span style={styles.balanceDueLabel}>Total Due:</span>
            <span style={styles.balanceDueValue}>${totalDue.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div style={styles.notesSection}>
          <h3 style={styles.sectionTitle}>Notes:</h3>
          {isEditing ? (
            <textarea
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
              placeholder="Additional notes..."
              style={styles.notesTextarea}
              rows={3}
            />
          ) : (
            <p style={styles.notes}>{invoiceData.notes || " "}</p>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>Thank you for your business!</p>
          <p style={styles.footerText}>Please make payment within 30 days.</p>
          <p style={styles.remitText}>Remit To: P.O. Box 363, Jennings, LA 70546</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
    padding: "20px",
  },
  actionButtons: {
    maxWidth: 900,
    margin: "0 auto 20px auto",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  button: {
    padding: "12px 24px",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#10b981",
  },
  cancelButton: {
    backgroundColor: "#6b7280",
  },
  editButton: {
    backgroundColor: BRAND.bg,
  },
  printButton: {
    backgroundColor: BRAND.accent,
  },
  emailButton: {
    backgroundColor: "#8b5cf6",
  },
  invoice: {
    maxWidth: 900,
    margin: "0 auto",
    backgroundColor: "#fff",
    padding: "60px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    position: "relative",
  },
  dateSection: {
    flex: "0 0 140px",
  },
  inputGroup: {
    marginBottom: "8px",
  },
  inputLabel: {
    fontSize: 13,
    color: "#666",
    marginRight: "4px",
  },
  dateInput: {
    fontSize: 12,
    padding: "4px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    width: "120px",
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    margin: "0",
    lineHeight: "1.4",
  },
  logoSection: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
  },
  logo: {
    maxWidth: 300,
    height: "auto",
    marginBottom: 4,
  },
  contactInfo: {
    fontSize: 11,
    color: "#666",
    margin: 0,
  },
  invoiceTitle: {
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  invoiceNumberInput: {
    fontSize: 20,
    fontWeight: "bold",
    padding: "8px",
    border: "2px solid " + BRAND.accent,
    borderRadius: 4,
    textAlign: "right",
    width: "200px",
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "40px 0 30px 0",
  },
  infoSection: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  billTo: {
    flex: 1,
    marginRight: 40,
  },
  projectInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    color: "#111",
    margin: 0,
  },
  projectName: {
    fontSize: 18,
    color: "#111",
    margin: 0,
    fontWeight: "600",
  },
  textInput: {
    fontSize: 18,
    padding: "8px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    width: "100%",
  },
  itemsSection: {
    marginBottom: 40,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 20,
  },
  tableHeaderRow: {
    backgroundColor: "#f3f4f6",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "12px",
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    textAlign: "right",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    height: "40px",
  },
  td: {
    padding: "12px",
    fontSize: 14,
    color: "#111",
    textAlign: "right",
  },
  tableInput: {
    width: "100%",
    padding: "6px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    fontSize: 14,
  },
  totalsSection: {
    marginLeft: "auto",
    width: 300,
    marginBottom: 40,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  balanceDueRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "16px 0",
    borderTop: "2px solid #e5e7eb",
    marginTop: 8,
  },
  balanceDueLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  balanceDueValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: BRAND.accent,
  },
  notesSection: {
    marginBottom: 40,
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  notes: {
    fontSize: 14,
    color: "#666",
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  notesTextarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical",
  },
  footer: {
    textAlign: "center",
    paddingTop: 40,
    borderTop: "1px solid #e5e7eb",
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    margin: "4px 0",
  },
  remitText: {
    fontSize: 13,
    color: "#111",
    margin: "12px 0 4px 0",
    fontWeight: "600",
  },
};

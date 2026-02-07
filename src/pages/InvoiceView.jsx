import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function InvoiceView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get("invoiceId");
  
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  async function loadInvoice() {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at");

      if (itemsError) throw itemsError;
      setInvoiceItems(itemsData || []);
    } catch (err) {
      console.error("Error loading invoice:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Invoice not found</div>
      </div>
    );
  }

  // Separate labor and materials for T&M invoices
  const laborItems = invoiceItems.filter(item => 
    item.description?.toLowerCase().includes("labor")
  );
  const materialItems = invoiceItems.filter(item => 
    !item.description?.toLowerCase().includes("labor")
  );
  
  const isProgressBilling = invoice.notes && invoice.notes.includes('Progress billing');
  const isTMInvoice = laborItems.length > 0 && materialItems.length > 0;
  
  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const depositReceived = invoice.deposit_received || 0;
  const amountPaid = invoice.amount_paid || 0;
  const totalDeductions = depositReceived + amountPaid;
  const balanceDue = subtotal - totalDeductions;

  // Calculate labor and material totals
  const laborTotal = laborItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const materialsTotal = materialItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // Format date as MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  return (
    <div style={styles.container}>
      {/* Print Button - Hidden when printing */}
      <div style={styles.printButton} className="no-print">
        <button onClick={() => window.print()} style={styles.button}>
          🖨️ Print Invoice
        </button>
      </div>

      {/* Invoice Document */}
      <div style={styles.invoice}>
        {/* Header - Date, Logo, Invoice# all in one line */}
        <div style={styles.topHeader}>
          <div style={styles.dateSection}>
            <p style={styles.dateText}>Date: {formatDate(invoice.invoice_date)}</p>
            {invoice.due_date && <p style={styles.dateText}>Due: {formatDate(invoice.due_date)}</p>}
          </div>
          <div style={styles.logoSection}>
            <img src={logoImage} alt="DML Electrical Service LLC" style={styles.logo} />
            <p style={styles.contactInfo}>
              Phone: (337)288-0395 | Email: info@dmlelectrical.com | License #: 63147
            </p>
          </div>
          <div style={styles.invoiceTitle}>
            <h2 style={styles.invoiceNumber}>INVOICE #{invoice.invoice_number}</h2>
          </div>
        </div>

        <hr style={styles.divider} />

        {/* Bill To & Project - Side by Side */}
        <div style={styles.infoSection}>
          <div style={styles.billTo}>
            <h3 style={styles.sectionTitle}>Bill To:</h3>
            <p style={styles.customerName}>{invoice.customer_name}</p>
          </div>
          {invoice.project_name && (
            <div style={styles.projectInfo}>
              <h3 style={styles.sectionTitle}>Project:</h3>
              <p style={styles.projectName}>{invoice.project_name}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div style={styles.itemsSection}>
          {!isProgressBilling ? (
            // Regular/T&M Invoice - Separated if needed
            <>
              {isTMInvoice ? (
                <>
                  {/* Labor Section */}
                  {laborItems.length > 0 && (
                    <div style={{marginBottom: 24}}>
                      <h3 style={{...styles.sectionTitle, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid ' + BRAND.accent}}>💼 Labor Charges</h3>
                      <table style={styles.table}>
                        <thead>
                          <tr style={styles.tableHeaderRow}>
                            <th style={{...styles.th, textAlign: 'left'}}>Description</th>
                            <th style={styles.th}>Hours</th>
                            <th style={styles.th}>Rate</th>
                            <th style={styles.th}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {laborItems.map((item) => (
                            <tr key={item.id} style={styles.tableRow}>
                              <td style={{...styles.td, textAlign: 'left'}}>{item.description}</td>
                              <td style={styles.td}>{(item.quantity || 0).toFixed(2)}</td>
                              <td style={styles.td}>${(item.unit_price || 0).toFixed(2)}</td>
                              <td style={styles.td}>${(item.total || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr style={{...styles.tableRow, backgroundColor: '#f3f4f6', fontWeight: 'bold'}}>
                            <td style={{...styles.td, textAlign: 'left', gridColumn: '1 / 3'}}>Labor Subtotal</td>
                            <td style={{...styles.td, gridColumn: '4'}}>${laborTotal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Materials Section */}
                  {materialItems.length > 0 && (
                    <div>
                      <h3 style={{...styles.sectionTitle, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid ' + BRAND.accent}}>🛠️ Materials & Expenses</h3>
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
                          {materialItems.map((item) => (
                            <tr key={item.id} style={styles.tableRow}>
                              <td style={{...styles.td, textAlign: 'left'}}>{item.description}</td>
                              <td style={styles.td}>{(item.quantity || 0).toFixed(2)}</td>
                              <td style={styles.td}>${(item.unit_price || 0).toFixed(2)}</td>
                              <td style={styles.td}>${(item.total || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr style={{...styles.tableRow, backgroundColor: '#f3f4f6', fontWeight: 'bold'}}>
                            <td style={{...styles.td, textAlign: 'left', gridColumn: '1 / 3'}}>Materials Subtotal</td>
                            <td style={{...styles.td, gridColumn: '4'}}>${materialsTotal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                // Standard invoice table
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
                    {invoiceItems.map((item) => (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={{...styles.td, textAlign: 'left'}}>{item.description}</td>
                        <td style={styles.td}>{item.quantity}</td>
                        <td style={styles.td}>${(item.unit_price || 0).toFixed(2)}</td>
                        <td style={styles.td}>${(item.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            // Progress Billing Summary Table
            <>
              <h3 style={styles.sectionTitle}>Progress Billing Summary</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={{...styles.th, textAlign: 'left'}}>Item Description</th>
                    <th style={styles.th}>Original Amount</th>
                    <th style={styles.th}>This Invoice</th>
                    <th style={styles.th}>% Billed</th>
                    <th style={styles.th}>Previously Billed</th>
                    <th style={styles.th}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item) => {
                    const desc = item.description || "";
                    const lines = desc.split('\n');
                    const itemName = lines[0];
                    
                    let original = 0, thisInvoice = 0, percent = 0, previouslyBilled = 0, remaining = 0;
                    
                    if (lines.length > 1) {
                      const detailLine = lines[1];
                      const originalMatch = detailLine.match(/Original: \$([0-9,.]+)/);
                      const thisMatch = detailLine.match(/This Invoice: \$([0-9,.]+)/);
                      const percentMatch = detailLine.match(/\(([0-9.]+)%\)/);
                      const prevMatch = detailLine.match(/Previously Billed: \$([0-9,.]+)/);
                      const remainMatch = detailLine.match(/Remaining: \$([0-9,.]+)/);
                      
                      if (originalMatch) original = parseFloat(originalMatch[1].replace(/,/g, ''));
                      if (thisMatch) thisInvoice = parseFloat(thisMatch[1].replace(/,/g, ''));
                      if (percentMatch) percent = parseFloat(percentMatch[1]);
                      if (prevMatch) previouslyBilled = parseFloat(prevMatch[1].replace(/,/g, ''));
                      if (remainMatch) remaining = parseFloat(remainMatch[1].replace(/,/g, ''));
                    }
                    
                    return (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={{...styles.td, textAlign: 'left', fontWeight: '600'}}>{itemName}</td>
                        <td style={styles.td}>${original.toFixed(2)}</td>
                        <td style={{...styles.td, fontWeight: '600', color: BRAND.accent}}>${thisInvoice.toFixed(2)}</td>
                        <td style={styles.td}>{percent.toFixed(1)}%</td>
                        <td style={styles.td}>${previouslyBilled.toFixed(2)}</td>
                        <td style={styles.td}>${remaining.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Totals */}
        <div style={styles.totalsSection}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Subtotal:</span>
            <span style={styles.totalValue}>${subtotal.toFixed(2)}</span>
          </div>
          {depositReceived > 0 && (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Deposit Received:</span>
              <span style={{...styles.totalValue, color: '#10b981'}}>-${depositReceived.toFixed(2)}</span>
            </div>
          )}
          {amountPaid > 0 && (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Amount Paid:</span>
              <span style={{...styles.totalValue, color: '#10b981'}}>-${amountPaid.toFixed(2)}</span>
            </div>
          )}
          <div style={styles.balanceDueRow}>
            <span style={styles.balanceDueLabel}>Balance Due:</span>
            <span style={styles.balanceDueValue}>${balanceDue.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={styles.notesSection}>
            <h3 style={styles.sectionTitle}>Notes:</h3>
            <p style={styles.notes}>{invoice.notes}</p>
          </div>
        )}

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
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          * {
            box-shadow: none !important;
            max-width: none !important;
          }
          
          @page {
            margin: 0.35in 0.25in;
            size: letter portrait;
          }
          
          /* Container adjustments */
          body > div:first-child {
            padding: 0 !important;
            background: white !important;
          }
          
          /* Invoice box - remove side padding completely */
          div[style*="padding: 60px"],
          div[style*="padding:60px"] {
            padding: 40px 30px !important;
          }
          
          /* Divider spacing - more room above */
          hr {
            margin: 50px 0 15px 0 !important;
          }
          
          div[style*="marginBottom: 100px"],
          div[style*="marginBottom: 70px"] {
            margin-bottom: 15px !important;
          }
          
          /* Keep logo reasonable size */
          img {
            max-width: 280px !important;
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
  printButton: {
    maxWidth: 900,
    margin: "0 auto 20px auto",
    textAlign: "right",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "600",
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
  logoContainer: {
    textAlign: "center",
    marginBottom: 10,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  companyInfo: {
    flex: 2,
  },
  companyName: {
    fontSize: 28,
    fontWeight: "bold",
    color: BRAND.bg,
    margin: 0,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: BRAND.accent,
    fontStyle: "italic",
    margin: 0,
  },
  invoiceTitle: {
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
    whiteSpace: "nowrap",
  },
  date: {
    fontSize: 14,
    color: "#666",
    margin: "4px 0",
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "50px 0 20px 0",
  },
  infoSection: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 70,
  },
  leftColumn: {
    maxWidth: "60%",
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
    margin: 10,
  },
  projectName: {
    fontSize: 18,
    color: "#111",
    margin: 0,
    fontWeight: "600",
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
  },
  td: {
    padding: "12px",
    fontSize: 14,
    color: "#111",
    textAlign: "right",
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
    padding: 0,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  notes: {
    fontSize: 14,
    color: "#666",
    margin: 20,
    whiteSpace: "pre-wrap",
  },
  footer: {
    textAlign: "center",
    paddingTop: 0,
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
  loading: {
    textAlign: "center",
    color: "#666",
    fontSize: 18,
    padding: 60,
  },
  error: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 18,
    padding: 60,
  },
};

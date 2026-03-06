import React, { useState, useEffect } from "react";
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
  
  // Calculate totals INCLUDING markups
  const laborTotal = laborItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    return sum + baseTotal + (baseTotal * markupPercent / 100);
  }, 0);
  const materialsTotal = materialItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    return sum + baseTotal + (baseTotal * markupPercent / 100);
  }, 0);
  const subtotal = laborTotal + materialsTotal;
  const depositReceived = invoice.deposit_received || 0;
  const amountPaid = invoice.amount_paid || 0;
  const totalDeductions = depositReceived + amountPaid;
  const balanceDue = subtotal - totalDeductions;

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
                          {laborItems.map((item) => {
                            const markupPct = item.markup_percentage || 0;
                            const billedRate = (item.unit_price || 0) * (1 + markupPct / 100);
                            const billedTotal = (item.quantity || 0) * billedRate;
                            return (
                              <tr key={item.id} style={styles.tableRow}>
                                <td style={{...styles.td, textAlign: 'left'}}>{item.description}</td>
                                <td style={styles.td}>{(item.quantity || 0).toFixed(2)}</td>
                                <td style={styles.td}>${billedRate.toFixed(2)}</td>
                                <td style={styles.td}>${billedTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                          <tr style={{...styles.tableRow, backgroundColor: '#f3f4f6', fontWeight: 'bold'}}>
                            <td style={{...styles.td, textAlign: 'left'}} colSpan={3}>Labor Subtotal</td>
                            <td style={styles.td}>${laborTotal.toFixed(2)}</td>
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
                    {invoiceItems.map((item) => {
                      const markupPct = item.markup_percentage || 0;
                      const billedRate = (item.unit_price || 0) * (1 + markupPct / 100);
                      const billedTotal = (item.quantity || 0) * billedRate;
                      return (
                        <tr key={item.id} style={styles.tableRow}>
                          <td style={{...styles.td, textAlign: 'left'}}>{item.description}</td>
                          <td style={styles.td}>{item.quantity}</td>
                          <td style={styles.td}>${billedRate.toFixed(2)}</td>
                          <td style={styles.td}>${billedTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            // Progress Billing Summary Table
            (() => {
              // Parse billing details from notes
              const notes = invoice.notes || "";
              const drawMatch = notes.match(/This draw: \$([0-9,.]+)/);
              const percentMatch = notes.match(/\(([0-9.]+)% of \$([0-9,.]+)\)/);
              const prevMatch = notes.match(/Previously billed: \$([0-9,.]+)/);
              const remainMatch = notes.match(/Remaining after this: \$([0-9,.]+)/);
              
              const thisDraw = drawMatch ? parseFloat(drawMatch[1].replace(/,/g, '')) : (invoice.total || 0);
              const contractTotal = percentMatch ? parseFloat(percentMatch[2].replace(/,/g, '')) : 0;
              const drawPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;
              const prevBilled = prevMatch ? parseFloat(prevMatch[1].replace(/,/g, '')) : 0;
              const remainAfter = remainMatch ? parseFloat(remainMatch[1].replace(/,/g, '')) : 0;
              
              // Check if we have the new format (notes-based) or old format (multi-line description)
              const hasNewFormat = drawMatch !== null;
              const hasOldFormat = invoiceItems.some(item => (item.description || "").includes('\n') && (item.description || "").includes('Original:'));
              
              if (hasOldFormat) {
                // Old format: parse from multi-line descriptions
                return (
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
                          let original = 0, thisInv = 0, pct = 0, prevB = 0, rem = 0;
                          if (lines.length > 1) {
                            const detailLine = lines[1];
                            const oM = detailLine.match(/Original: \$([0-9,.]+)/);
                            const tM = detailLine.match(/This Invoice: \$([0-9,.]+)/);
                            const pM = detailLine.match(/\(([0-9.]+)%\)/);
                            const pvM = detailLine.match(/Previously Billed: \$([0-9,.]+)/);
                            const rM = detailLine.match(/Remaining: \$([0-9,.]+)/);
                            if (oM) original = parseFloat(oM[1].replace(/,/g, ''));
                            if (tM) thisInv = parseFloat(tM[1].replace(/,/g, ''));
                            if (pM) pct = parseFloat(pM[1]);
                            if (pvM) prevB = parseFloat(pvM[1].replace(/,/g, ''));
                            if (rM) rem = parseFloat(rM[1].replace(/,/g, ''));
                          }
                          return (
                            <tr key={item.id} style={styles.tableRow}>
                              <td style={{...styles.td, textAlign: 'left', fontWeight: '600'}}>{itemName}</td>
                              <td style={styles.td}>${original.toFixed(2)}</td>
                              <td style={{...styles.td, fontWeight: '600', color: BRAND.accent}}>${thisInv.toFixed(2)}</td>
                              <td style={styles.td}>{pct.toFixed(1)}%</td>
                              <td style={styles.td}>${prevB.toFixed(2)}</td>
                              <td style={styles.td}>${rem.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                );
              }
              
              // New format: single draw amount with details from notes
              return (
                <>
                  <h3 style={styles.sectionTitle}>Progress Billing Summary</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={{...styles.th, textAlign: 'left'}}>Description</th>
                        <th style={styles.th}>Contract Value</th>
                        <th style={styles.th}>Previously Billed</th>
                        <th style={styles.th}>This Draw</th>
                        <th style={styles.th}>% of Contract</th>
                        <th style={styles.th}>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.id} style={styles.tableRow}>
                          <td style={{...styles.td, textAlign: 'left', fontWeight: '600'}}>{item.description}</td>
                          <td style={styles.td}>${contractTotal > 0 ? contractTotal.toFixed(2) : (item.total || 0).toFixed(2)}</td>
                          <td style={styles.td}>${prevBilled.toFixed(2)}</td>
                          <td style={{...styles.td, fontWeight: '600', color: BRAND.accent}}>${(item.total || 0).toFixed(2)}</td>
                          <td style={styles.td}>{drawPercent > 0 ? drawPercent.toFixed(1) : ((item.total || 0) > 0 && contractTotal > 0 ? ((item.total / contractTotal) * 100).toFixed(1) : '0.0')}%</td>
                          <td style={styles.td}>${remainAfter.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()
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

      {/* T&M Detail Attachment Page - prints on separate page */}
      {(() => {
        const hasDetails = invoiceItems.some(item => item.daily_breakdown);
        if (!hasDetails) return null;

        // Parse all detail data and get markup info
        let laborDetails = [];
        let materialDetails = [];
        let laborMarkupPct = 0;
        let laborBilledRate = 0;
        let dayNotes = {};
        invoiceItems.forEach(item => {
          if (!item.daily_breakdown) return;
          try {
            const parsed = typeof item.daily_breakdown === 'string' 
              ? JSON.parse(item.daily_breakdown) : item.daily_breakdown;
            if (parsed.laborDetails) {
              laborDetails = parsed.laborDetails;
              laborMarkupPct = item.markup_percentage || 0;
              laborBilledRate = (item.unit_price || 0) * (1 + laborMarkupPct / 100);
            }
            if (parsed.materialDetails) materialDetails = parsed.materialDetails;
            if (parsed.dayNotes) dayNotes = parsed.dayNotes;
          } catch(e) { console.error("Parse error:", e); }
        });

        if (laborDetails.length === 0 && materialDetails.length === 0) return null;

        return (
          <div style={{
            maxWidth: 900, margin: '0 auto', backgroundColor: '#fff', color: '#111',
            padding: '60px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            pageBreakBefore: 'always', marginTop: 40,
          }}>
            <h2 style={{fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 8, textAlign: 'center'}}>
              Detailed Breakdown — Invoice #{invoice.invoice_number}
            </h2>
            <p style={{textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 30}}>
              {invoice.project_name} | {formatDate(invoice.invoice_date)}
            </p>

            {/* Labor Detail */}
            {laborDetails.length > 0 && (
              <div style={{marginBottom: 40}}>
                <h3 style={{fontSize: 18, fontWeight: 'bold', color: BRAND.bg, borderBottom: '2px solid ' + BRAND.accent, paddingBottom: 8, marginBottom: 16}}>
                  Labor Detail
                </h3>
                {laborDetails.map((emp, idx) => {
                  const useRate = laborBilledRate > 0 ? laborBilledRate : emp.rate;
                  const empTotal = emp.totalHours * useRate;
                  return (
                    <div key={idx} style={{marginBottom: 20}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: '#f3f4f6', padding: '8px 12px', borderRadius: 6}}>
                        <span style={{fontWeight: 'bold', fontSize: 15}}>{emp.employee}</span>
                        <span style={{fontSize: 14, color: '#666'}}>
                          {emp.totalHours} hrs × ${useRate.toFixed(2)}/hr = <strong style={{color: BRAND.accent}}>${empTotal.toFixed(2)}</strong>
                        </span>
                      </div>
                      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                        <thead>
                          <tr style={{borderBottom: '1px solid #e5e7eb'}}>
                            <th style={{padding: '6px 8px', textAlign: 'left', color: '#666', fontWeight: '600'}}>Date</th>
                            <th style={{padding: '6px 8px', textAlign: 'center', color: '#666', fontWeight: '600'}}>Clock In</th>
                            <th style={{padding: '6px 8px', textAlign: 'center', color: '#666', fontWeight: '600'}}>Clock Out</th>
                            <th style={{padding: '6px 8px', textAlign: 'right', color: '#666', fontWeight: '600'}}>Hours</th>
                            <th style={{padding: '6px 8px', textAlign: 'right', color: '#666', fontWeight: '600'}}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(emp.entries || []).map((entry, eIdx) => (
                            <React.Fragment key={eIdx}>
                              <tr style={{borderBottom: dayNotes[entry.date] ? 'none' : '1px solid #f3f4f6'}}>
                                <td style={{padding: '6px 8px', color: '#111'}}>{formatDate(entry.date)}</td>
                                <td style={{padding: '6px 8px', textAlign: 'center', color: '#111'}}>{entry.clockIn}</td>
                                <td style={{padding: '6px 8px', textAlign: 'center', color: '#111'}}>{entry.clockOut}</td>
                                <td style={{padding: '6px 8px', textAlign: 'right', color: '#111'}}>{entry.hours}</td>
                                <td style={{padding: '6px 8px', textAlign: 'right', color: '#111'}}>${(entry.hours * useRate).toFixed(2)}</td>
                              </tr>
                              {dayNotes[entry.date] && (
                                <tr style={{borderBottom: '1px solid #f3f4f6'}}>
                                  <td colSpan={5} style={{padding: '4px 8px 8px 24px', fontSize: 12, color: '#555', fontStyle: 'italic'}}>
                                    📝 {dayNotes[entry.date]}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Materials Detail */}
            {materialDetails.length > 0 && (
              <div>
                <h3 style={{fontSize: 18, fontWeight: 'bold', color: BRAND.bg, borderBottom: '2px solid ' + BRAND.accent, paddingBottom: 8, marginBottom: 16}}>
                  Materials & Expenses Detail
                </h3>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                  <thead>
                    <tr style={{borderBottom: '2px solid #e5e7eb'}}>
                      <th style={{padding: '8px', textAlign: 'left', color: '#666', fontWeight: '600'}}>Date</th>
                      <th style={{padding: '8px', textAlign: 'left', color: '#666', fontWeight: '600'}}>Description</th>
                      <th style={{padding: '8px', textAlign: 'left', color: '#666', fontWeight: '600'}}>Vendor</th>
                      <th style={{padding: '8px', textAlign: 'right', color: '#666', fontWeight: '600'}}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialDetails.map((mat, idx) => (
                      <tr key={idx} style={{borderBottom: '1px solid #f3f4f6'}}>
                        <td style={{padding: '8px', color: '#111'}}>{formatDate(mat.date)}</td>
                        <td style={{padding: '8px', color: '#111'}}>{mat.description}</td>
                        <td style={{padding: '8px', color: '#111'}}>{mat.vendor}</td>
                        <td style={{padding: '8px', textAlign: 'right', fontWeight: '600', color: '#111'}}>${(mat.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{borderTop: '2px solid #e5e7eb', fontWeight: 'bold'}}>
                      <td colSpan={3} style={{padding: '10px 8px', textAlign: 'right', color: '#111'}}>Materials Total:</td>
                      <td style={{padding: '10px 8px', textAlign: 'right', color: BRAND.accent}}>
                        ${materialDetails.reduce((s, m) => s + (m.amount || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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

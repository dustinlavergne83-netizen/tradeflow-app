import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function InvoiceReceipt() {
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

  // Format date as MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading receipt...</div>
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

  // Build summary categories from line items
  const laborItems = invoiceItems.filter(
    (item) => item.description?.toLowerCase().includes("labor")
  );
  const materialItems = invoiceItems.filter(
    (item) => !item.description?.toLowerCase().includes("labor")
  );

  const laborTotal = laborItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    return sum + baseTotal + (baseTotal * markupPercent) / 100;
  }, 0);

  const materialsTotal = materialItems.reduce((sum, item) => {
    const baseTotal = item.total || 0;
    const markupPercent = item.markup_percentage || 0;
    return sum + baseTotal + (baseTotal * markupPercent) / 100;
  }, 0);

  const invoiceTotal = laborTotal + materialsTotal;
  const depositReceived = invoice.deposit_received || 0;
  const amountPaid = invoice.amount_paid || 0;
  const totalPayments = depositReceived + amountPaid;

  // Determine if this is T&M or fixed price for summary display
  const isTM = laborItems.length > 0 && materialItems.length > 0;
  const isProgressBilling =
    invoice.notes && invoice.notes.includes("Progress billing");

  // Build simple summary lines
  const summaryLines = [];
  if (isTM) {
    if (laborTotal > 0)
      summaryLines.push({ label: "Labor", amount: laborTotal });
    if (materialsTotal > 0)
      summaryLines.push({
        label: "Materials & Expenses",
        amount: materialsTotal,
      });
  } else if (isProgressBilling) {
    summaryLines.push({
      label: "Progress Billing — Electrical Services",
      amount: invoiceTotal,
    });
  } else if (invoiceItems.length === 1) {
    // Single line item — just show a generic description
    summaryLines.push({
      label: invoiceItems[0].description || "Electrical Services",
      amount: invoiceTotal,
    });
  } else {
    // Multiple items — summarize as "Electrical Services"
    summaryLines.push({
      label: "Electrical Services",
      amount: invoiceTotal,
    });
  }

  return (
    <div style={styles.container}>
      {/* Print/Action Buttons - Hidden when printing */}
      <div style={styles.buttonBar} className="no-print">
        <button onClick={() => window.print()} style={styles.printBtn}>
          🖨️ Print / Save PDF
        </button>
        <button
          onClick={() => {
            if (!invoice.customer_email) {
              alert("No customer email on file. Please add one to the invoice first.");
              return;
            }
            if (!confirm(`Send paid receipt to ${invoice.customer_email}?`)) return;
            
            // Use the send-invoice edge function with receipt flag
            supabase.functions.invoke('send-invoice', {
              body: {
                invoiceId: invoiceId,
                siteUrl: window.location.origin,
                to: invoice.customer_email,
                customerName: invoice.customer_name,
                invoiceNumber: invoice.invoice_number,
                invoiceDate: invoice.invoice_date,
                dueDate: invoice.due_date,
                isReceipt: true,
                receiptSummary: summaryLines,
                subtotal: invoiceTotal,
                totalMarkup: 0,
                totalWithMarkup: invoiceTotal,
                depositReceived: depositReceived,
                amountPaid: amountPaid,
                balanceDue: 0,
                notes: "Payment received — thank you!",
                lineItems: []
              }
            }).then(({ data, error }) => {
              if (error) {
                alert("Failed to send receipt: " + (error.message || "Unknown error"));
              } else {
                alert(`✅ Paid receipt sent to ${invoice.customer_email}!`);
              }
            });
          }}
          style={styles.emailBtn}
        >
          📧 Email Receipt
        </button>
        <button onClick={() => window.close()} style={styles.closeBtn}>
          Close
        </button>
      </div>

      {/* Receipt Document */}
      <div style={styles.receipt}>
        {/* PAID STAMP */}
        <div style={styles.paidStamp}>
          <div style={styles.paidStampInner}>PAID</div>
        </div>

        {/* Header */}
        <div style={styles.headerSection}>
          <div style={styles.logoWrap}>
            <img
              src={logoImage}
              alt="DML Electrical Service LLC"
              style={styles.logo}
            />
            <p style={styles.contactInfo}>
              Phone: (337)288-0395 | Email: info@dmlelectrical.com | License #:
              63147
            </p>
          </div>
        </div>

        {/* Receipt Title */}
        <div style={styles.receiptTitle}>
          <h1 style={styles.receiptHeading}>PAYMENT RECEIPT</h1>
          <div style={styles.receiptMeta}>
            Invoice #{invoice.invoice_number} • {formatDate(invoice.invoice_date)}
          </div>
        </div>

        <hr style={styles.divider} />

        {/* Bill To & Project - Side by Side */}
        <div style={styles.infoRow}>
          <div style={styles.infoCol}>
            <div style={styles.infoLabel}>Received From:</div>
            <div style={styles.infoValue}>{invoice.customer_name}</div>
          </div>
          {invoice.project_name && (
            <div style={styles.infoCol}>
              <div style={styles.infoLabel}>Project:</div>
              <div style={styles.infoValue}>{invoice.project_name}</div>
            </div>
          )}
          <div style={styles.infoCol}>
            <div style={styles.infoLabel}>Date Paid:</div>
            <div style={styles.infoValue}>
              {formatDate(invoice.updated_at || invoice.invoice_date)}
            </div>
          </div>
        </div>

        <hr style={styles.dividerLight} />

        {/* Summary Table */}
        <div style={styles.summarySection}>
          <h3 style={styles.summaryTitle}>Summary</h3>
          <table style={styles.summaryTable}>
            <thead>
              <tr>
                <th style={{ ...styles.summaryTh, textAlign: "left" }}>
                  Description
                </th>
                <th style={{ ...styles.summaryTh, textAlign: "right" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {summaryLines.map((line, idx) => (
                <tr key={idx} style={styles.summaryRow}>
                  <td style={{ ...styles.summaryTd, textAlign: "left" }}>
                    {line.label}
                  </td>
                  <td
                    style={{
                      ...styles.summaryTd,
                      textAlign: "right",
                      fontWeight: "600",
                    }}
                  >
                    ${line.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={styles.totalsBox}>
          <div style={styles.totalLine}>
            <span style={styles.totalLabel}>Invoice Total:</span>
            <span style={styles.totalAmount}>${invoiceTotal.toFixed(2)}</span>
          </div>
          {depositReceived > 0 && (
            <div style={styles.totalLine}>
              <span style={styles.totalLabel}>Deposit Applied:</span>
              <span style={{ ...styles.totalAmount, color: "#10b981" }}>
                -${depositReceived.toFixed(2)}
              </span>
            </div>
          )}
          {amountPaid > 0 && (
            <div style={styles.totalLine}>
              <span style={styles.totalLabel}>Payment Received:</span>
              <span style={{ ...styles.totalAmount, color: "#10b981" }}>
                -${amountPaid.toFixed(2)}
              </span>
            </div>
          )}
          <div style={styles.balanceLine}>
            <span style={styles.balanceLabel}>Balance Due:</span>
            <span style={styles.balanceAmount}>$0.00</span>
          </div>
        </div>

        {/* Payment Confirmation */}
        <div style={styles.confirmationBox}>
          <div style={styles.confirmIcon}>✅</div>
          <div style={styles.confirmText}>
            <strong>Payment of ${totalPayments.toFixed(2)} received.</strong>
            <br />
            This invoice has been paid in full. Thank you for your business!
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>DML Electrical Service LLC</p>
          <p style={styles.footerAddress}>
            P.O. Box 363, Jennings, LA 70546
          </p>
          <p style={styles.footerSmall}>
            This receipt confirms payment for the services described above.
          </p>
        </div>
      </div>

      {/* Print Styles - Same approach as InvoiceView */}
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
            margin: 0.2in 0.25in;
            size: letter portrait;
          }
          
          /* Container adjustments */
          body > div:first-child {
            padding: 0 !important;
            background: white !important;
          }
          
          /* Receipt box padding - reduce top */
          div[style*="padding: 40px 60px"],
          div[style*="padding:40px 60px"] {
            padding: 15px 30px !important;
          }
          
          /* Keep logo reasonable size */
          img[alt="DML Electrical Service LLC"] {
            max-width: 280px !important;
            width: 280px !important;
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
  buttonBar: {
    maxWidth: 900,
    margin: "0 auto 20px auto",
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },
  printBtn: {
    padding: "10px 24px",
    backgroundColor: BRAND.bg,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  emailBtn: {
    padding: "10px 24px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  closeBtn: {
    padding: "10px 24px",
    backgroundColor: "#666",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
  },
  receipt: {
    maxWidth: 900,
    margin: "0 auto",
    backgroundColor: "#fff",
    padding: "40px 60px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
  },
  // PAID stamp
  paidStamp: {
    position: "absolute",
    top: 30,
    right: -10,
    transform: "rotate(15deg)",
    zIndex: 10,
  },
  paidStampInner: {
    border: "4px solid #10b981",
    borderRadius: 12,
    color: "#10b981",
    fontSize: 42,
    fontWeight: "900",
    padding: "6px 28px",
    letterSpacing: 6,
    opacity: 0.7,
  },
  // Header
  headerSection: {
    textAlign: "center",
    marginBottom: 6,
  },
  logoWrap: {
    textAlign: "center",
  },
  logo: {
    maxWidth: 280,
    height: "auto",
    marginBottom: 4,
  },
  contactInfo: {
    fontSize: 11,
    color: "#666",
    margin: 0,
  },
  // Receipt Title
  receiptTitle: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  receiptHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
    margin: 0,
    letterSpacing: 2,
  },
  receiptMeta: {
    fontSize: 14,
    color: "#666",
    marginTop: 6,
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "16px 0",
  },
  dividerLight: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    margin: "16px 0",
  },
  // Info Row
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 8,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111",
  },
  // Summary
  summarySection: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },
  summaryTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  summaryTh: {
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    borderBottom: "2px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  summaryRow: {
    borderBottom: "1px solid #e5e7eb",
  },
  summaryTd: {
    padding: "14px 12px",
    fontSize: 16,
    color: "#111",
  },
  // Totals
  totalsBox: {
    marginLeft: "auto",
    width: 400,
    marginBottom: 24,
  },
  totalLine: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  totalLabel: {
    fontSize: 15,
    color: "#666",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  balanceLine: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 0 8px 0",
    borderTop: "2px solid #e5e7eb",
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#10b981",
  },
  // Confirmation Box
  confirmationBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "20px 24px",
    backgroundColor: "#ecfdf5",
    border: "2px solid #10b981",
    borderRadius: 10,
    marginBottom: 30,
  },
  confirmIcon: {
    fontSize: 36,
  },
  confirmText: {
    fontSize: 15,
    color: "#065f46",
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    textAlign: "center",
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    margin: "4px 0",
  },
  footerAddress: {
    fontSize: 13,
    color: "#666",
    margin: "4px 0",
  },
  footerSmall: {
    fontSize: 11,
    color: "#999",
    margin: "8px 0 0 0",
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

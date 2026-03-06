import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function QuickEstimateView() {
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const autoPrint = searchParams.get("print") === "true";

  const [estimate, setEstimate] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (estimateId) {
      loadEstimate();
    }
  }, [estimateId]);

  useEffect(() => {
    if (autoPrint && estimate && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [autoPrint, estimate, loading]);

  async function loadEstimate() {
    try {
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) throw estimateError;
      setEstimate(estimateData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sequence");

      if (itemsError) throw itemsError;
      setEstimateItems(itemsData || []);

      // Try to get customer email for the email modal
      if (estimateData.customer_name) {
        const { data: custData } = await supabase
          .from("customers")
          .select("email")
          .eq("customer", estimateData.customer_name)
          .maybeSingle();
        if (custData?.email) {
          setEmailTo(custData.email);
        }
      }
    } catch (err) {
      console.error("Error loading estimate:", err);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const formatCurrency = (amount) => {
    return "$" + Number(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  async function handleSendEmail() {
    if (!emailTo.trim()) {
      alert("Please enter an email address.");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-estimate", {
        body: {
          estimateId: estimateId,
          siteUrl: window.location.origin,
          to: emailTo,
          message: emailMessage,
          estimateNumber: estimate.estimate_number,
          estimateDate: estimate.estimate_date,
          customerName: estimate.customer_name,
          projectName: estimate.project_name,
          total: estimate.total,
          notes: estimate.notes,
          lineItems: estimateItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            material_total: item.material_total,
            labor_total: item.labor_total,
            line_total: item.line_total,
          })),
        },
      });

      if (error) throw error;

      alert("Estimate sent successfully!");
      setShowEmailModal(false);

      // Update estimate status to 'sent'
      await supabase
        .from("estimates")
        .update({ status: "sent" })
        .eq("id", estimateId);

    } catch (err) {
      console.error("Error sending estimate:", err);
      alert(`Failed to send estimate: ${err.message || "Unknown error"}`);
    } finally {
      setSending(false);
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
      </div>
    );
  }

  // Check if items have labor (detailed mode) or just material costs (simple mode)
  const hasLabor = estimateItems.some((item) => item.labor_hours > 0);
  const subtotal = estimateItems.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div style={styles.container}>
      {/* Action Buttons - Hidden when printing */}
      <div style={styles.actionBar} className="no-print">
        <button onClick={() => window.print()} style={styles.button}>
          🖨️ Print Estimate
        </button>
        <button
          onClick={() => {
            setShowEmailModal(true);
          }}
          style={{ ...styles.button, backgroundColor: "#3b82f6" }}
        >
          📧 Email Estimate
        </button>
        <button
          onClick={() => {
            // Generate PDF-like download via print dialog
            window.print();
          }}
          style={{ ...styles.button, backgroundColor: "#10b981" }}
        >
          📄 Save as PDF
        </button>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div style={styles.modalOverlay} className="no-print">
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📧 Email Estimate</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>To:</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  style={styles.modalInput}
                  placeholder="customer@email.com"
                  autoFocus
                />
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Message (optional):</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  style={{ ...styles.modalInput, minHeight: 80, resize: "vertical" }}
                  placeholder="Add a personal message..."
                />
              </div>
              <div style={styles.modalPreview}>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                  <strong>Estimate #:</strong> {estimate.estimate_number}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
                  <strong>Total:</strong> {formatCurrency(estimate.total)}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
                  <strong>Customer:</strong> {estimate.customer_name}
                </p>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowEmailModal(false)}
                style={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                style={{
                  ...styles.modalSendBtn,
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "Sending..." : "📧 Send Estimate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Document */}
      <div style={styles.estimate}>
        {/* Header - Date, Logo, Estimate# all in one line */}
        <div style={styles.topHeader}>
          <div style={styles.dateSection}>
            <p style={styles.dateText}>
              Date: {formatDate(estimate.estimate_date)}
            </p>
          </div>
          <div style={styles.logoSection}>
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
          <div style={styles.estimateTitle}>
            <h2 style={styles.estimateNumber}>
              ESTIMATE #{estimate.estimate_number}
            </h2>
            <div style={styles.statusBadge}>
              {(estimate.status || "draft").toUpperCase()}
            </div>
          </div>
        </div>

        <hr style={styles.divider} />

        {/* Prepared For & Project - Side by Side */}
        <div style={styles.infoSection}>
          <div style={styles.billTo}>
            <h3 style={styles.sectionTitle}>Prepared For:</h3>
            <p style={styles.customerName}>{estimate.customer_name}</p>
          </div>
          {estimate.project_name &&
            estimate.project_name !== "Quick Estimate" && (
              <div style={styles.projectInfo}>
                <h3 style={styles.sectionTitle}>Project:</h3>
                <p style={styles.projectName}>{estimate.project_name}</p>
              </div>
            )}
        </div>

        {/* Line Items */}
        <div style={styles.itemsSection}>
          {hasLabor ? (
            // Detailed mode - show material + labor breakdown
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={{ ...styles.th, textAlign: "left" }}>
                    Description
                  </th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Material</th>
                  <th style={styles.th}>Labor</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {estimateItems.map((item) => (
                  <tr key={item.id} style={styles.tableRow}>
                    <td style={{ ...styles.td, textAlign: "left" }}>
                      {item.description}
                    </td>
                    <td style={styles.td}>{item.quantity}</td>
                    <td style={styles.td}>
                      {formatCurrency(item.material_total)}
                    </td>
                    <td style={styles.td}>
                      {formatCurrency(item.labor_total)}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: "600",
                        color: "#111",
                      }}
                    >
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Simple mode - just description and total
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={{ ...styles.th, textAlign: "left" }}>
                    Description
                  </th>
                  <th style={{ ...styles.th, width: 150 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {estimateItems.map((item) => (
                  <tr key={item.id} style={styles.tableRow}>
                    <td style={{ ...styles.td, textAlign: "left" }}>
                      {item.description}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: "600",
                        color: "#111",
                      }}
                    >
                      {formatCurrency(item.line_total || item.material_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        <div style={styles.totalsSection}>
          {hasLabor && (
            <>
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>Materials:</span>
                <span style={styles.totalValue}>
                  {formatCurrency(
                    estimateItems.reduce(
                      (s, i) => s + (i.material_total || 0),
                      0
                    )
                  )}
                </span>
              </div>
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>Labor:</span>
                <span style={styles.totalValue}>
                  {formatCurrency(
                    estimateItems.reduce(
                      (s, i) => s + (i.labor_total || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </>
          )}
          <div style={styles.grandTotalRow}>
            <span style={styles.grandTotalLabel}>Total Estimate:</span>
            <span style={styles.grandTotalValue}>
              {formatCurrency(estimate.total || subtotal)}
            </span>
          </div>
        </div>

        {/* Notes */}
        {estimate.notes && (
          <div style={styles.notesSection}>
            <h3 style={styles.notesSectionTitle}>Notes:</h3>
            <p style={styles.notes}>{estimate.notes}</p>
          </div>
        )}

        {/* Scope / Terms */}
        <div style={styles.termsSection}>
          <p style={styles.termsText}>
            This estimate is valid for 30 days from the date shown above.
            Pricing is subject to change after that period. Any changes to the
            scope of work described above may result in additional charges. This
            estimate does not include permits or inspections unless specifically
            noted.
          </p>
        </div>

        {/* Signature Lines */}
        <div style={styles.signatureSection}>
          <div style={styles.signatureLine}>
            <div style={styles.signatureBar}></div>
            <div style={styles.signatureLabel}>Customer Signature / Approval</div>
          </div>
          <div style={styles.signatureLine}>
            <div style={styles.signatureBar}></div>
            <div style={styles.signatureLabel}>Date</div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>Thank you for the opportunity!</p>
          <p style={styles.footerText}>
            DML Electrical Service, LLC. — P.O. Box 363, Jennings, LA 70546
          </p>
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

          body > div:first-child {
            padding: 0 !important;
            background: white !important;
          }

          /* Estimate box - adjust padding for print */
          div[style*="padding: 60px"],
          div[style*="padding:60px"] {
            padding: 40px 30px !important;
          }

          hr {
            margin: 50px 0 15px 0 !important;
          }

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
  actionBar: {
    maxWidth: 900,
    margin: "0 auto 20px auto",
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
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
    transition: "opacity 0.2s",
  },
  estimate: {
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
    fontWeight: "600",
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
  estimateTitle: {
    textAlign: "right",
  },
  estimateNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
    whiteSpace: "nowrap",
  },
  statusBadge: {
    display: "inline-block",
    marginTop: 6,
    padding: "3px 12px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "50px 0 20px 0",
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
    marginBottom: 8,
  },
  customerName: {
    fontSize: 20,
    color: "#111",
    margin: "0 0 0 10px",
    fontWeight: "600",
  },
  projectName: {
    fontSize: 20,
    color: "#111",
    margin: 0,
    fontWeight: "600",
  },
  itemsSection: {
    marginBottom: 30,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
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
    padding: "14px 12px",
    fontSize: 14,
    color: "#333",
    textAlign: "right",
  },
  totalsSection: {
    marginLeft: "auto",
    width: 320,
    marginBottom: 30,
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
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "16px 0",
    borderTop: "2px solid #e5e7eb",
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  grandTotalValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: BRAND.accent,
  },
  notesSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  notesSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  notes: {
    fontSize: 14,
    color: "#666",
    margin: 0,
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  termsSection: {
    marginBottom: 30,
  },
  termsText: {
    fontSize: 11,
    color: "#888",
    lineHeight: 1.5,
    textAlign: "justify",
  },
  signatureSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 40,
    marginBottom: 30,
  },
  signatureLine: {},
  signatureBar: {
    borderBottom: "2px solid #111",
    marginBottom: 8,
    height: 40,
  },
  signatureLabel: {
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase",
  },
  footer: {
    textAlign: "center",
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    margin: "4px 0",
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
  // Email Modal Styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  modalClose: {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "#999",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  modalBody: {
    padding: "24px",
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  modalInput: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    color: "#333",
  },
  modalPreview: {
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginTop: 8,
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  modalCancelBtn: {
    padding: "10px 20px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
  },
  modalSendBtn: {
    padding: "10px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
  },
};

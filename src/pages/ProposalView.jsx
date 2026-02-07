import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function ProposalView() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get("proposalId");
  
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [baseEstimate, setBaseEstimate] = useState(null);
  const [proposalAlternates, setProposalAlternates] = useState([]);
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (proposalId) {
      loadProposal();
    }
  }, [proposalId]);

  async function loadProposal() {
    try {
      // Load proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (proposalError) throw proposalError;
      setProposal(proposalData);

      // Load base estimate
      const { data: baseEst, error: baseError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", proposalData.base_estimate_id)
        .single();

      if (baseError) throw baseError;
      setBaseEstimate(baseEst);

      // Load project data
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", proposalData.project_id)
        .single();

      if (!projectError) {
        setProject(projectData);
      }

      // Load proposal alternates
      const { data: altsData, error: altsError } = await supabase
        .from("proposal_alternates")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("alternate_number");

      if (!altsError) {
        setProposalAlternates(altsData || []);
      }

    } catch (err) {
      console.error("Error loading proposal:", err);
    } finally {
      setLoading(false);
    }
  }

  // Format date as MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading proposal...</div>
      </div>
    );
  }

  if (!proposal || !baseEstimate) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Proposal not found</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Print Button - Hidden when printing */}
      <div style={styles.printButton} className="no-print">
        <button onClick={() => window.print()} style={styles.button}>
          🖨️ Print Proposal
        </button>
      </div>

      {/* Proposal Document */}
      <div className="proposal-container" style={styles.proposal}>
        {/* Header - Date, Logo, Estimate# all in one line */}
        <div style={styles.topHeader}>
          <div style={styles.dateSection}>
            <p style={styles.dateText}>
              Date: {formatDate(baseEstimate.estimate_date)}
            </p>
            {proposal.valid_until && (
              <p style={styles.dateText}>
                Valid Until: {formatDate(proposal.valid_until)}
              </p>
            )}
          </div>
          <div style={styles.logoSection}>
            <img src={logoImage} alt="Company Logo" style={styles.logo} />
            <p style={styles.contactInfo}>
              Phone: (337)288-0395 | Email: info@dmlelectrical.com | License #: 63147
            </p>
          </div>
          <div style={styles.estimateTitle}>
            <h2 style={styles.estimateNumber}>
              ESTIMATE #{baseEstimate.estimate_number?.replace('EST-', '')}
            </h2>
          </div>
        </div>

        <hr style={styles.divider} />

        <div style={styles.titleSection}>
          <h1 style={styles.proposalTitle}>PROJECT PROPOSAL</h1>
          {proposal.contractor_name && (
            <>
              <div style={styles.proposalSmallLabel}>To:</div>
              <div style={styles.proposalBigValue}>{proposal.contractor_name}</div>
            </>
          )}
          {project?.name && (
            <>
              <div style={styles.proposalSmallLabel}>For:</div>
              <div style={styles.proposalBigValue}>{project.name}</div>
            </>
          )}
        </div>

        {/* Proposal Summary Table */}
        <div style={styles.proposalTable}>
          <div style={styles.tableTitle}>PROPOSAL SUMMARY</div>
          
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: "left", width: 150}}>ITEM</th>
                <th style={{...styles.th, textAlign: "left"}}>DESCRIPTION</th>
                <th style={{...styles.th, textAlign: "right", width: 150}}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {/* Base Bid */}
              <tr style={styles.tableRow}>
                <td style={styles.td}>
                  <span style={{...styles.badge, backgroundColor: BRAND.accent}}>BASE BID</span>
                </td>
                <td style={{...styles.td, fontSize: 13, color: "#666"}}>
                  {baseEstimate.description || baseEstimate.project_description || "Base scope of work"}
                </td>
                <td style={{...styles.td, textAlign: "right", fontWeight: "600", fontSize: 16}}>
                  ${(proposal.base_bid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* Selected Alternates */}
              {proposalAlternates.map(alt => (
                <tr key={alt.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: "#8b5cf6"}}>
                      ALT {alt.alternate_number}
                    </span>
                  </td>
                  <td style={{...styles.td, fontSize: 13, color: "#666"}}>
                    {alt.alternate_title || ""}
                  </td>
                  <td style={{...styles.td, textAlign: "right", fontWeight: "600", fontSize: 16}}>
                    ${(alt.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Total Row */}
              <tr style={styles.totalRow}>
                <td colSpan="2" style={{...styles.td, fontWeight: "bold", fontSize: 18}}>
                  TOTAL INVESTMENT
                </td>
                <td style={{...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 24, color: BRAND.accent}}>
                  ${(proposal.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Scope Statement */}
        <div style={styles.scopeStatement}>
          <p style={styles.scopeText}>
            <strong>DML Electrical Service, LLC.</strong> proposes to furnish all material and labor necessary 
            to fully complete the above project in accordance with the National Electrical Code (NEC), all 
            applicable local codes, and industry best practices. All work will be performed by licensed, 
            qualified electricians using quality materials from reputable manufacturers. This proposal includes 
            all items specified above and assumes normal working conditions with adequate access to work areas.
          </p>
          <p style={styles.scopeText}>
            Price is valid for 30 days from proposal date. Any changes or additions to the scope of work 
            outlined above will require written approval and may result in additional charges.
          </p>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.signatureSection}>
            <div style={styles.signatureLine}>
              <div style={styles.signatureBar}></div>
              <div style={styles.signatureLabel}>Authorized Signature</div>
            </div>
            <div style={styles.signatureLine}>
              <div style={styles.signatureBar}></div>
              <div style={styles.signatureLabel}>Date</div>
            </div>
          </div>
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
          
          /* Proposal box - adjust padding for print */
          .proposal-container {
            padding: 20px 30px 20px 30px !important;
          }
          
          /* Divider spacing */
          hr {
            margin: 50px 0 15px 0 !important;
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
  proposal: {
    maxWidth: 900,
    margin: "0 auto",
    backgroundColor: "#fff",
    padding: "70px 60px 20px 60px",
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
    fontSize: 9,
    color: "#666",
    margin: 0,
    whiteSpace: "nowrap",
  },
  estimateTitle: {
    textAlign: "right",
  },
  estimateNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "50px 0 20px 0",
  },
  titleSection: {
    textAlign: "center",
    margin: "0 0 25px 0",
  },
  proposalTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: BRAND.bg,
    margin: 0,
    letterSpacing: "2px",
  },
  proposalSmallLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 12,
    marginBottom: 2,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  proposalBigValue: {
    fontSize: 24,
    color: BRAND.accent,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 0,
  },
  proposalTable: {
    marginBottom: 20,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: BRAND.bg,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "2px solid #e5e7eb",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#f9fafb",
  },
  th: {
    padding: "12px",
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    borderBottom: "2px solid #e5e7eb",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: "16px 12px",
    fontSize: 14,
    color: "#111",
  },
  totalRow: {
    backgroundColor: "#f9fafb",
    borderTop: "2px solid " + BRAND.accent,
  },
  badge: {
    padding: "3px 10px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  scopeStatement: {
    marginBottom: 16,
  },
  scopeText: {
    fontSize: 11,
    color: "#444",
    lineHeight: 1.4,
    marginBottom: 6,
    textAlign: "justify",
  },
  footer: {
    marginTop: 20,
  },
  signatureSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 40,
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

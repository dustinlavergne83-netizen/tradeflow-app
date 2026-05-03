import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";
import { useAuth } from "../contexts/AuthContext";

import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function ProposalResidentialContractor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const proposalId = searchParams.get("proposalId");
  const estimateId = searchParams.get("estimateId");
  const coId = searchParams.get("coId");
  let projectId = searchParams.get("projectId");

  // Try to get projectId from the path as well
  const pathMatch = window.location.pathname.match(/\/project\/([a-f0-9\-]+)/);
  if (!projectId && pathMatch) {
    projectId = pathMatch[1];
  }
  
  console.log("projectId:", projectId, "estimateId:", estimateId, "pathname:", window.location.pathname);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(!proposalId);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [proposal, setProposal] = useState(null);
  const [baseEstimate, setBaseEstimate] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [proposalAlternates, setProposalAlternates] = useState([]);
  const [project, setProject] = useState(null);
  const [contractors, setContractors] = useState([]);

  // Form state
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [selectedAlternates, setSelectedAlternates] = useState([]);
  const [includeBaseBid, setIncludeBaseBid] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [validUntilDays, setValidUntilDays] = useState(30);
  const [proposalDate, setProposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeline, setTimeline] = useState("To be scheduled");
  const [warranty, setWarranty] = useState("1 year warranty on labor & material provided by DML Electrical Service, LLC");
  const [paymentTerms, setPaymentTerms] = useState("Upon Receipt of Invoice");
  const [termsText, setTermsText] = useState("WARRANTY PROVISIONS: This 1-year warranty covers all labor and materials provided and installed by DML Electrical Service, LLC. Warranty does NOT apply to materials supplied by the customer; customer-supplied materials carry no warranty from DML. Labor warranty covers defects in installation performed by DML. Labor is NOT warranted for customer-supplied materials unless the failure was directly caused by improper installation by DML. All warranty claims must be reported within 30 days of discovery. DML's liability under this warranty is limited to repair or replacement of defective work or materials.");

  const [alternates, setAlternates] = useState([]);

  // Open a dedicated print window containing ONLY the proposal HTML
  // This avoids the blank-page issue caused by the app layout's min-height:100vh
  const handlePrint = () => {
    const el = document.querySelector(".proposal-container");
    if (!el) { window.print(); return; }

    const printStyles = `
      @page { margin: 10mm 12mm; size: letter portrait; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; overflow: hidden; }
      /* Remove card shadow/border that bleeds at page edge */
      .proposal-container { box-shadow: none !important; border-radius: 0 !important; padding: 0 12px !important; }
      .proposal-container > div { box-shadow: none !important; border-radius: 0 !important; }

      /* Fix absolute-centered logo to flex-center in the print window */
      .proposal-top-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 4px !important;
      }
      .logo-section {
        position: static !important;
        transform: none !important;
        flex: 1 !important;
        text-align: center !important;
      }
      .logo-section img { max-width: 260px !important; height: auto !important; }

      /* Compress spacing */
      hr { margin: 8px 0 !important; }
      .proposal-title-section { margin-bottom: 10px !important; }
      .proposal-title-section h1 { font-size: 22px !important; margin-bottom: 8px !important; }
      .proposal-title-section .small-label { margin: 4px 0 2px 0 !important; font-size: 10px !important; }
      .proposal-title-section .big-value { font-size: 16px !important; margin-bottom: 4px !important; }
      .proposal-table-section { margin-bottom: 10px !important; }
      .proposal-table-section .table-header { padding: 6px 10px !important; font-size: 11px !important; }
      .proposal-table-row { padding: 8px 10px !important; }
      .proposal-table-row td { font-size: 12px !important; }
      .proposal-info-boxes { gap: 10px !important; margin-bottom: 10px !important; }
      .proposal-info-box { padding: 8px 12px !important; }
      .proposal-info-box span { font-size: 11px !important; }
      .proposal-scope-box { padding: 10px 14px !important; margin-bottom: 10px !important; }
      .proposal-scope-box p { font-size: 10px !important; line-height: 1.4 !important; margin-bottom: 4px !important; }
      .proposal-signature-section { margin-top: 12px !important; }
      .proposal-signature-line { height: 30px !important; margin-top: 6px !important; }
      .proposal-signature-label { font-size: 10px !important; margin-bottom: 4px !important; }
      .print-no-break { page-break-inside: avoid; break-inside: avoid; }
    `;

    const pw = window.open("", "_blank", "width=900,height=700");
    pw.document.write(`<!DOCTYPE html><html><head><title>Proposal</title><style>${printStyles}</style></head><body>${el.outerHTML}</body></html>`);
    pw.document.close();
    pw.onload = () => { pw.focus(); pw.print(); };
  };

  useEffect(() => {
    loadData();
  }, [proposalId, estimateId, coId, projectId]);

  async function loadData() {
    try {
      setLoading(true);

      if (proposalId) {
        await loadExistingProposal();
      } else if (estimateId) {
        await loadEstimate(estimateId);
      } else if (coId) {
        await loadChangeOrder(coId);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadExistingProposal() {
    try {
      const { data: proposalData } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (proposalData) {
        setProposal(proposalData);
        setSelectedContractor(proposalData);

        const { data: estimateData } = await supabase
          .from("estimates")
          .select("*")
          .eq("id", proposalData.base_estimate_id)
          .single();
        
        if (estimateData) {
          setBaseEstimate(estimateData);
          
          // Load estimate items
          const { data: itemsData } = await supabase
            .from("estimate_items")
            .select("*")
            .eq("estimate_id", proposalData.base_estimate_id)
            .order("sequence");
          if (itemsData) setEstimateItems(itemsData);

          // Load project
          const { data: projectData } = await supabase
            .from("projects")
            .select("*")
            .eq("name", estimateData.project_name)
            .single();
          
          if (projectData) {
            setProject(projectData);
            // Load project contractors and auto-select
            const { data: contractorsData } = await supabase
              .from("project_contractors")
              .select("*")
              .eq("project_id", projectData.id);
            
            if (contractorsData) {
              setContractors(contractorsData);
              // Auto-populate contractor if available
              if (contractorsData.length > 0 && !proposalData.contractor_name) {
                setSelectedContractor(contractorsData[0]);
              }
            }
          }
        }

        // Load alternates
        const { data: altsData } = await supabase
          .from("proposal_alternates")
          .select("*")
          .eq("proposal_id", proposalId)
          .order("alternate_number");

        if (altsData) {
          setProposalAlternates(altsData);
          setSelectedAlternates(altsData.map(a => a.alternate_estimate_id));
        }

        setIncludeBaseBid(proposalData.base_bid_amount > 0);
      }
    } catch (err) {
      console.error("Error loading proposal:", err);
    }
  }

  async function loadEstimate(id) {
    try {
      const { data: estimateData } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", id)
        .single();

      if (estimateData) {
        console.log("Estimate loaded with description:", estimateData.description);
        setBaseEstimate(estimateData);
        
        // Load estimate items
        const { data: itemsData } = await supabase
          .from("estimate_items")
          .select("*")
          .eq("estimate_id", id)
          .order("sequence");
        if (itemsData) setEstimateItems(itemsData);

        // Load project by ID (not by name) if projectId is available
        let projectData = null;
        if (projectId) {
          const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single();
          projectData = data;
        } else if (estimateData.project_name) {
          // Fallback to project name search
          const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("name", estimateData.project_name)
            .single();
          projectData = data;
        }

        if (projectData) {
          setProject(projectData);
          
          // Load project contractors
          const { data: contractorsData } = await supabase
            .from("project_contractors")
            .select("*")
            .eq("project_id", projectData.id);
          
          console.log("Contractors loaded:", contractorsData);
          
          if (contractorsData && contractorsData.length > 0) {
            setContractors(contractorsData);
            // Auto-select first contractor if available
            console.log("Auto-selecting contractor:", contractorsData[0]);
            setSelectedContractor(contractorsData[0]);
          } else if (projectData.contractor) {
            // Fallback: use the contractor text field from the project
            const syntheticContractor = {
              id: "project-contractor",
              contractor_name: projectData.contractor,
              company_name: projectData.contractor,
              email: null,
              phone: null,
            };
            setContractors([syntheticContractor]);
            setSelectedContractor(syntheticContractor);
            console.log("Auto-selecting from project.contractor:", projectData.contractor);
          }
        }

        // Load alternates
        const { data: altsData } = await supabase
          .from("estimates")
          .select("*")
          .eq("parent_estimate_id", id);

        if (altsData) setAlternates(altsData);
      }
    } catch (err) {
      console.error("Error loading estimate:", err);
    }
  }

  async function loadChangeOrder(id) {
    try {
      const { data: coData } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (coData) {
        // Transform change order to look like an estimate so the proposal renders correctly
        const estimateFromCO = {
          id: coData.id,
          estimate_number: coData.change_order_number || `CO-${coData.id.slice(0, 8)}`,
          estimate_date: coData.change_order_date || new Date().toISOString(),
          total: coData.total || 0,
          description: coData.description || coData.title || 'Change Order',
          project_description: coData.description || coData.title,
        };
        setBaseEstimate(estimateFromCO);

        // Load project by ID from the URL path first, then fall back to name
        let projectData = null;
        if (projectId) {
          const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single();
          projectData = data;
        } else if (coData.project_name) {
          const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("name", coData.project_name)
            .single();
          projectData = data;
        }

        if (projectData) {
          setProject(projectData);

          // Load contractors for the project
          const { data: contractorsData } = await supabase
            .from("project_contractors")
            .select("*")
            .eq("project_id", projectData.id);

          if (contractorsData && contractorsData.length > 0) {
            setContractors(contractorsData);
            setSelectedContractor(contractorsData[0]);
          } else if (projectData.contractor) {
            // Fallback: use the contractor text field from the project
            const syntheticContractor = {
              id: "project-contractor",
              contractor_name: projectData.contractor,
              company_name: projectData.contractor,
              email: null,
              phone: null,
            };
            setContractors([syntheticContractor]);
            setSelectedContractor(syntheticContractor);
            console.log("Auto-selecting from project.contractor (CO):", projectData.contractor);
          }
        } else {
          // Fallback: use minimal project object so the page still renders
          setProject({ name: coData.project_name || 'Change Order' });
        }
      }
    } catch (err) {
      console.error("Error loading change order:", err);
    }
  }

  const totalAmount = (includeBaseBid ? (baseEstimate?.total || 0) : 0) +
    alternates
      .filter(alt => selectedAlternates.includes(alt.id))
      .reduce((sum, alt) => sum + (alt.total || 0), 0);

  const handleSave = async (sendEmailAfter = false) => {
    if (!selectedContractor) {
      alert("Please select a contractor");
      return;
    }

    if (!includeBaseBid && selectedAlternates.length === 0) {
      alert("Please select at least one item");
      return;
    }

    setIsSaving(true);
    try {
      const proposalData = {
        company_id: user.id,
        // For change orders, use change_order_id instead of base_estimate_id
        // (base_estimate_id has a foreign key to the estimates table)
        ...(coId 
          ? { change_order_id: coId, base_estimate_id: null }
          : { base_estimate_id: baseEstimate.id }
        ),
        project_id: project?.id,
        contractor_name: selectedContractor?.contractor_name || selectedContractor?.name,
        contractor_email: selectedContractor?.email,
        base_bid_amount: includeBaseBid ? baseEstimate.total : 0,
        total_amount: totalAmount,
        valid_until: new Date(Date.now() + validUntilDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        status: sendEmailAfter ? "sent" : "draft"
      };

      let savedProposalId;

      if (proposalId) {
        await supabase.from("proposals").update(proposalData).eq("id", proposalId);
        savedProposalId = proposalId;
      } else {
        const { data: newProposal, error } = await supabase
          .from("proposals")
          .insert([proposalData])
          .select()
          .single();

        if (error) throw error;
        savedProposalId = newProposal.id;

        // Save alternates
        if (selectedAlternates.length > 0) {
          const alternatesData = selectedAlternates.map(altId => ({
            proposal_id: savedProposalId,
            alternate_estimate_id: altId,
            amount: alternates.find(a => a.id === altId)?.total || 0
          }));

          await supabase.from("proposal_alternates").insert(alternatesData);
        }
      }

      if (!sendEmailAfter) {
        alert("Proposal saved successfully!");
        // Navigate back to the project page
        if (projectId) {
          navigate(`/project/${projectId}`, { replace: true });
        } else {
          navigate("/projects", { replace: true });
        }
      }

      return savedProposalId;
    } catch (err) {
      console.error("Error saving proposal:", err);
      alert("Error saving proposal: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading...</div></div>;
  }

  if (!baseEstimate || !project) {
    return <div style={styles.container}><div style={styles.error}>Data not found</div></div>;
  }

  return (
    <div className="proposal-page-wrapper" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{baseEstimate.description || project?.name || `Estimate #${baseEstimate.estimate_number}`}</h1>
        <div style={styles.buttons}>
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={() => handleSave()} style={styles.saveButton} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Proposal"}
              </button>
            </>
          ) : (
            <>
              <button onClick={handlePrint} style={styles.button}>
                🖨️ Print
              </button>
              <button onClick={() => setIsEditing(true)} style={styles.button}>
                ✏️ Edit
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div style={styles.editForm}>
          <div style={styles.formSection}>
            <h2 style={styles.formTitle}>Proposal Information</h2>

            <div style={styles.formRow}>
              <div style={styles.formField}>
                <label style={styles.label}>Select Homeowner/Customer</label>
                <select
                  value={selectedContractor?.id || ""}
                  onChange={(e) => {
                    const contractor = contractors.find(c => c.id === e.target.value);
                    setSelectedContractor(contractor);
                  }}
                  style={styles.select}
                >
                  <option value="">-- Select Customer --</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contractor_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formField}>
                <label style={styles.label}>Valid Until (days)</label>
                <input
                  type="number"
                  value={validUntilDays}
                  onChange={(e) => setValidUntilDays(parseInt(e.target.value))}
                  style={styles.input}
                  min="1"
                  max="365"
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formField}>
                <label style={styles.label}>Proposal Date</label>
                <input
                  type="date"
                  value={proposalDate}
                  onChange={(e) => setProposalDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formField}>
                <label style={styles.label}>Warranty</label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  style={styles.input}
                  placeholder="e.g., 1 year on labor"
                />
              </div>
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                style={styles.input}
                placeholder="e.g., 50% deposit, 50% upon completion"
              />
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Additional Terms & Conditions</label>
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                style={{...styles.input, minHeight: 80, resize: "vertical"}}
                placeholder="Any additional terms, conditions, or notes..."
              />
            </div>
          </div>

          <div style={styles.formSection}>
            <h2 style={styles.formTitle}>Services Included</h2>

            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeBaseBid}
                  onChange={(e) => setIncludeBaseBid(e.target.checked)}
                />
                <span style={styles.checkboxText}>
                  Include Base Proposal (${(baseEstimate.total || 0).toFixed(2)})
                </span>
              </label>
            </div>

            {alternates.map(alt => (
              <div key={alt.id} style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedAlternates.includes(alt.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAlternates([...selectedAlternates, alt.id]);
                      } else {
                        setSelectedAlternates(selectedAlternates.filter(id => id !== alt.id));
                      }
                    }}
                  />
                  <span style={styles.checkboxText}>
                    {alt.alternate_title || `Alternate ${alt.alternate_number}`}: $
                    {(alt.total || 0).toFixed(2)}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <button onClick={() => setShowPreview(!showPreview)} style={styles.previewButton}>
            {showPreview ? "Hide Preview" : "Preview Proposal"}
          </button>
        </div>
      ) : null}

      {!isEditing || showPreview ? (
        <div className="proposal-container" style={styles.proposalDocument}>
          <div style={styles.proposal}>
            {/* Header - Logo and Date - Same as Commercial Proposal */}
            <div className="proposal-top-header print-no-break" style={styles.topHeader}>
              <div style={styles.dateSection}>
                <p style={styles.dateText}>
                  Date: {formatDate(proposalDate)}
                </p>
                {proposal?.valid_until && (
                  <p style={styles.dateText}>
                    Valid Until: {formatDate(proposal.valid_until)}
                  </p>
                )}
              </div>
              <div className="logo-section" style={styles.logoSection}>
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

            {/* Title Section with Customer & Project */}
            <div className="proposal-title-section" style={styles.titleSection}>
              <h1 style={styles.proposalTitle}>{"PROJECT PROPOSAL"}</h1>

              {selectedContractor && (
                <>
                  <div className="small-label" style={styles.proposalSmallLabel}>For:</div>
                  <div className="big-value" style={styles.proposalBigValue}>{selectedContractor.contractor_name}</div>
                </>
              )}

              {project?.name && (
                <>
                  <div className="small-label" style={styles.proposalSmallLabel}>Project:</div>
                  <div className="big-value" style={styles.proposalBigValue}>{project.name}</div>
                </>
              )}
            </div>

            {/* Proposal Summary Table */}
            <div className="proposal-table-section" style={styles.proposalTable}>
              <div className="table-header" style={styles.tableTitle}>PROPOSAL SUMMARY</div>
              <table style={styles.table}>
                <tbody>
                  {includeBaseBid && estimateItems.length > 0 && (
                    <>
                      {estimateItems.map((item, idx) => (
                        <tr key={item.id} className="proposal-table-row" style={styles.tableRow}>
                          <td style={styles.td}>{item.description}</td>
                          <td style={{...styles.td, textAlign: "right", fontWeight: "600"}}>
                            ${(item.line_total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* For change orders (no estimate items), show the description as a line item */}
                  {includeBaseBid && estimateItems.length === 0 && baseEstimate.description && (
                    <tr style={styles.tableRow}>
                      <td style={styles.td}>{baseEstimate.description}</td>
                      <td style={{...styles.td, textAlign: "right", fontWeight: "600"}}>
                        ${(baseEstimate.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  )}

                  {alternates
                    .filter(alt => selectedAlternates.includes(alt.id))
                    .map(alt => (
                      <tr key={alt.id} style={styles.tableRow}>
                        <td style={styles.td}>
                          {alt.alternate_title || `Alternate ${alt.alternate_number}`}
                        </td>
                        <td style={{...styles.td, textAlign: "right", fontWeight: "600"}}>
                          ${(alt.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}

                  <tr style={{...styles.tableRow, borderTop: "2px solid #333"}}>
                    <td style={{...styles.td, fontWeight: "bold"}}>TOTAL PROPOSAL</td>
                    <td style={{...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 24, color: BRAND.accent}}>
                      ${totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warranty and Payment Terms */}
            <div className="print-no-break proposal-info-boxes" style={styles.infoBoxes}>
              <div className="proposal-info-box" style={styles.infoBox}>
                <span style={styles.infoLabel}>Warranty:</span>
                <span style={styles.infoValue}>{warranty}</span>
              </div>
              <div className="proposal-info-box" style={styles.infoBox}>
                <span style={styles.infoLabel}>Payment Terms:</span>
                <span style={styles.infoValue}>{paymentTerms}</span>
              </div>
            </div>

            {/* Standard Scope Text */}
            <div className="proposal-scope-box" style={styles.scopeBox}>
              <p style={styles.scopeText}>
                This proposal includes all work specified above using quality materials and professional installation. 
                All work will be performed by licensed, experienced technicians in compliance with applicable local codes, 
                and industry best practices. This proposal assumes normal working conditions with adequate access to work areas.
              </p>
              <p style={styles.scopeText}>
                <strong>Changes & Additions:</strong> Any changes or additions to the original plans/specifications will require written approval from the customer and may incur additional cost. Work performed outside the scope of this proposal will be billed separately.
              </p>
              <p style={styles.scopeText}>
                <strong>Acceptance:</strong> This proposal is valid for {validUntilDays} days from the proposal date. 
                To accept this proposal, please sign below and return it along with any required deposit.
              </p>
              {termsText && (
                <p style={styles.scopeText}><strong>Additional Terms:</strong> {termsText}</p>
              )}
            </div>

            {/* Signature Lines */}
            <div className="proposal-signature-section" style={styles.signatureSection}>
              <div style={styles.signatureRow}>
                <div>
                  <p className="proposal-signature-label" style={styles.signatureLabel}>Contractor Signature</p>
                  <div className="proposal-signature-line" style={styles.signatureLine}></div>
                </div>
                <div>
                  <p className="proposal-signature-label" style={styles.signatureLabel}>Date</p>
                  <div className="proposal-signature-line" style={styles.signatureLine}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1400,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
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
    margin: 0,
    color: "#111",
  },
  buttons: {
    display: "flex",
    gap: 12,
  },
  button: {
    padding: "12px 24px",
    backgroundColor: BRAND.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
  },
  saveButton: {
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
  },
  editForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    marginBottom: 30,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  formSection: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#111",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  formField: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    padding: "10px 12px",
    fontSize: 14,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    padding: "10px 12px",
    fontSize: 14,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
  },
  checkboxGroup: {
    marginBottom: 12,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    fontSize: 15,
  },
  checkboxText: {
    color: "#333",
    fontWeight: "500",
  },
  previewButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  },
  proposalDocument: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "30px 40px 40px 40px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  proposal: {
    maxWidth: 900,
    margin: "0 auto",
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
    fontSize: 12,
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
    margin: "50px 0 50px 0",
  },
  titleSection: {
    marginBottom: 40,
    textAlign: "center",
  },
  proposalTitle: {
    fontSize: 32,
    fontWeight: "bold",
    margin: "0 0 24px 0",
    color: "#111",
    textAlign: "center",
  },
  proposalSmallLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    margin: "12px 0 4px 0",
    textAlign: "center",
  },
  proposalBigValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
    textAlign: "center",
  },
  proposalTable: {
    marginBottom: 40,
    display: "grid",
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: "8px 8px 0 0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 20,
    padding: "16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  td: {
    fontSize: 14,
    color: "#111",
  },
  infoBoxes: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 32,
  },
  infoBox: {
    display: "flex",
    flexDirection: "column",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#111",
    fontWeight: "500",
  },
  scopeBox: {
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: 32,
  },
  scopeText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  signatureSection: {
    marginTop: 40,
  },
  signatureRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 40,
  },
  signatureLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    margin: "0 0 8px 0",
  },
  signatureLine: {
    borderBottom: "2px solid #333",
    height: 60,
    marginTop: 12,
    marginBottom: 4,
  },
  printOnly: {
    marginTop: 12,
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

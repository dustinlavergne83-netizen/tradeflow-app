import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";
import { useAuth } from "../contexts/AuthContext";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function ProposalCommercialPublic() {
  const [searchParams] = useSearchParams();
  const { id: projectIdFromPath } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const proposalId = searchParams.get("proposalId");
  const estimateId = searchParams.get("estimateId");
  const coId = searchParams.get("coId"); // Change Order ID
  const projectId = projectIdFromPath;
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(!proposalId);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Data
  const [proposal, setProposal] = useState(null);
  const [baseEstimate, setBaseEstimate] = useState(null);
  const [proposalAlternates, setProposalAlternates] = useState([]);
  const [project, setProject] = useState(null);
  const [alternates, setAlternates] = useState([]);
  const [contractors, setContractors] = useState([]);
  
  // Form state
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [includeBaseBid, setIncludeBaseBid] = useState(true);
  const [selectedAlternates, setSelectedAlternates] = useState([]);
  const [validUntil, setValidUntil] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [priceAdjustment, setPriceAdjustment] = useState(""); // +/- dollar override

  useEffect(() => {
    if (proposalId) {
      loadExistingProposal();
    } else if (coId && projectId) {
      loadChangeOrderForCreation();
    } else if (estimateId && projectId) {
      loadEstimateForCreation();
    } else {
      setLoading(false);
    }
  }, [proposalId, estimateId, coId, projectId]);

  async function loadExistingProposal() {
    try {
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (proposalError) throw proposalError;
      setProposal(proposalData);

      const { data: baseEst, error: baseError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", proposalData.base_estimate_id)
        .single();

      if (baseError) throw baseError;
      setBaseEstimate(baseEst);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", proposalData.project_id)
        .single();

      if (!projectError) {
        setProject(projectData);
      }

      const { data: altsData, error: altsError } = await supabase
        .from("proposal_alternates")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("alternate_number");

      if (!altsError) {
        setProposalAlternates(altsData || []);
      }

      // Load price adjustment if saved
      if (proposalData.price_adjustment && proposalData.price_adjustment !== 0) {
        setPriceAdjustment(proposalData.price_adjustment.toString());
      }

      // Load contractor email from project_contractors table using contractor_name
      if (proposalData.project_id && proposalData.contractor_name) {
        const { data: contractorData } = await supabase
          .from("project_contractors")
          .select("*")
          .eq("project_id", proposalData.project_id)
          .eq("contractor_name", proposalData.contractor_name)
          .maybeSingle();

        if (contractorData?.email) {
          setContractorEmail(contractorData.email);
          setSelectedContractor(contractorData);
        }
        
        // Also load all contractors for this project so the email form works
        const { data: allContractors } = await supabase
          .from("project_contractors")
          .select("*")
          .eq("project_id", proposalData.project_id)
          .order("contractor_name");
        setContractors(allContractors || []);
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error("Error loading proposal:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEstimateForCreation() {
    try {
      const { data: estData, error: estError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estError) throw estError;
      setBaseEstimate(estData);

      const { data: projData, error: projError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (!projError) {
        setProject(projData);
      }

      // Load alternates - they are estimates with parent_estimate_id = base estimate
      const { data: altsData, error: altsError} = await supabase
        .from("estimates")
        .select("*")
        .eq("parent_estimate_id", estimateId)
        .order("alternate_number");

      if (!altsError) {
        // Map alternates to the format we need
        const mappedAlts = (altsData || []).map(alt => ({
          id: alt.id,
          alternate_number: alt.alternate_number,
          title: alt.alternate_title || `Alternate ${alt.alternate_number}`,
          description: alt.description || alt.project_description || '',
          price: alt.total || 0
        }));
        setAlternates(mappedAlts);
      }

      // Load contractors for this project
      const { data: contractorsData, error: contractorsError } = await supabase
        .from("project_contractors")
        .select("*")
        .eq("project_id", projectId)
        .order("contractor_name");

      if (!contractorsError) {
        setContractors(contractorsData || []);
        
        // Auto-select contractor if project has one
        if (projData?.contractor && contractorsData) {
          const matchingContractor = contractorsData.find(c => 
            c.contractor_name === projData.contractor
          );
          if (matchingContractor) {
            setSelectedContractorId(matchingContractor.id);
            setSelectedContractor(matchingContractor);
            if (matchingContractor.email) {
              setContractorEmail(matchingContractor.email);
            }
          }
        }
      }

      // Set default valid until date (30 days from now)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setValidUntil(defaultDate.toISOString().split('T')[0]);
    } catch (err) {
      console.error("Error loading estimate:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChangeOrderForCreation() {
    try {
      // Load change order from change_orders table
      const { data: coData, error: coError } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", coId)
        .single();

      if (coError) throw coError;

      // Transform change order to look like an estimate
      const estimateFromCO = {
        id: coData.id,
        estimate_number: coData.change_order_number,
        estimate_date: coData.change_order_date,
        total: coData.total || 0,
        description: coData.description || coData.title,
        project_description: coData.description || coData.title,
      };
      
      setBaseEstimate(estimateFromCO);

      // Load project
      const { data: projData, error: projError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (!projError) {
        setProject(projData);
      }

      // Change orders don't have alternates
      setAlternates([]);

      // Load contractors for this project
      const { data: contractorsData, error: contractorsError } = await supabase
        .from("project_contractors")
        .select("*")
        .eq("project_id", projectId)
        .order("contractor_name");

      if (!contractorsError) {
        setContractors(contractorsData || []);
        
        // Auto-select contractor if project has one
        if (projData?.contractor && contractorsData) {
          const matchingContractor = contractorsData.find(c => 
            c.contractor_name === projData.contractor
          );
          if (matchingContractor) {
            setSelectedContractorId(matchingContractor.id);
            setSelectedContractor(matchingContractor);
            if (matchingContractor.email) {
              setContractorEmail(matchingContractor.email);
            }
          }
        }
      }

      // Set default valid until date (30 days from now)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setValidUntil(defaultDate.toISOString().split('T')[0]);
    } catch (err) {
      console.error("Error loading change order:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleAlternate(altId) {
    if (selectedAlternates.includes(altId)) {
      setSelectedAlternates(selectedAlternates.filter(id => id !== altId));
    } else {
      setSelectedAlternates([...selectedAlternates, altId]);
    }
  }

  function handleContractorChange(e) {
    const contractorId = e.target.value;
    setSelectedContractorId(contractorId);
    const contractor = contractors.find(c => c.id === contractorId);
    setSelectedContractor(contractor);
    // Auto-fill email if contractor has one
    if (contractor?.email) {
      setContractorEmail(contractor.email);
    }
  }

  async function handleSendEmail() {
    if (!contractorEmail) {
      alert("Please enter a contractor email address");
      return;
    }

    if (!selectedContractor && isEditing) {
      alert("Please select a contractor first");
      return;
    }

    if (isEditing && !includeBaseBid && selectedAlternates.length === 0) {
      alert("Please select at least one item to include in the proposal");
      return;
    }

    // For unsaved proposals, save first
    let savedProposalId = proposalId;
    if (isEditing && !proposalId) {
      savedProposalId = await handleSave(true); // Pass true to indicate we're sending email after
      if (!savedProposalId) return; // If save failed, don't continue
    }

    setIsSendingEmail(true);
    try {
      const selectedAlts = alternates.filter(alt => selectedAlternates.includes(alt.id));
      const baseBidAmt = includeBaseBid ? (baseEstimate.total || 0) : 0;
      
      // Split comma-separated emails
      const emails = contractorEmail.split(',').map(e => e.trim()).filter(e => e);
      
      // Send to each email
      for (const email of emails) {
        const { data, error } = await supabase.functions.invoke('send-proposal', {
          body: {
            to: email,
            contractorName: selectedContractor?.contractor_name || proposal?.contractor_name,
            projectName: project?.name,
            estimateNumber: baseEstimate.estimate_number?.replace('EST-', ''),
            baseBidAmount: baseBidAmt,
            alternates: selectedAlts.map(alt => ({
              number: alt.alternate_number,
              title: alt.title,
              amount: alt.price || 0
            })),
            totalAmount: totalAmount,
            proposalId: savedProposalId,
          },
        });

        if (error) {
          console.error('Supabase invoke error:', error);
          throw new Error(error.message || JSON.stringify(error));
        }
        if (data?.error) {
          console.error('Edge function error:', data);
          throw new Error(data.error + (data.details ? '\n\nDetails: ' + data.details : ''));
        }
      }

      alert(`Proposal sent successfully to ${emails.length} recipient${emails.length > 1 ? 's' : ''}!`);
      
      // Update proposal status
      if (savedProposalId) {
        await supabase
          .from('proposals')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', savedProposalId);
      }
      
      // Update estimate status to "sent"
      if (baseEstimate?.id) {
        await supabase
          .from('estimates')
          .update({ status: 'sent' })
          .eq('id', baseEstimate.id);
      }
    } catch (err) {
      console.error("Error sending email:", err);
      alert("Error sending proposal: " + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleSave(returnAfterSave = false) {
    if (!selectedContractor && isEditing) {
      alert("Please select a contractor");
      return;
    }

    if (isEditing && !includeBaseBid && selectedAlternates.length === 0) {
      alert("Please select at least one item (base bid or alternates)");
      return;
    }

    setIsSaving(true);
    try {
      const baseBidAmount = includeBaseBid ? (baseEstimate.total || 0) : 0;
      const selectedAlts = alternates.filter(alt => selectedAlternates.includes(alt.id));
      const alternatesTotal = selectedAlts.reduce((sum, alt) => sum + (alt.price || 0), 0);
      const adj = parseFloat(priceAdjustment) || 0;
      const totalAmount = baseBidAmount + alternatesTotal + adj;

      const proposalData = {
        company_id: user.id,
        project_id: projectId,
        // For change orders, use change_order_id instead of base_estimate_id
        // (base_estimate_id has a foreign key to the estimates table)
        ...(coId 
          ? { change_order_id: coId, base_estimate_id: null }
          : { base_estimate_id: estimateId || baseEstimate.id }
        ),
        contractor_name: selectedContractor?.contractor_name || proposal?.contractor_name,
        base_bid_amount: includeBaseBid ? baseBidAmount : 0,
        total_amount: totalAmount,
        price_adjustment: adj !== 0 ? adj : null,
        valid_until: validUntil || null,
        created_at: new Date().toISOString(),
      };

      let savedProposalId;
      
      if (proposalId) {
        // Update existing (if we add editing later)
        savedProposalId = proposalId;
      } else {
        // Create new
        const { data: newProposal, error: proposalError } = await supabase
          .from("proposals")
          .insert([proposalData])
          .select()
          .single();

        if (proposalError) throw proposalError;
        savedProposalId = newProposal.id;

        if (selectedAlts.length > 0) {
          const alternatesData = selectedAlts.map(alt => ({
            proposal_id: savedProposalId,
            alternate_estimate_id: alt.id,
            alternate_number: alt.alternate_number,
            alternate_title: alt.title,
            amount: alt.price,
          }));

          const { error: altsError } = await supabase
            .from("proposal_alternates")
            .insert(alternatesData);

          if (altsError) throw altsError;
        }
      }

      if (!returnAfterSave) {
        alert("Proposal saved successfully!");
        setIsEditing(false);
        
        if (!proposalId) {
          navigate(`/proposal/commercial-public?proposalId=${savedProposalId}`, { replace: true });
          window.location.reload();
        }
      }
      
      return savedProposalId; // Return the ID for email function
    } catch (err) {
      console.error("Error saving proposal:", err);
      alert("Error saving proposal: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  // Renders a description string as left-aligned bullet points if it contains newlines
  const renderDescription = (text) => {
    if (!text) return null;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return <span>{text}</span>;
    return (
      <ul style={{ margin: 0, paddingLeft: 18, textAlign: 'left', listStyleType: 'disc' }}>
        {lines.map((line, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            {line.replace(/^[-•*]\s*/, '')}
          </li>
        ))}
      </ul>
    );
  };

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
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!baseEstimate) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Unable to load estimate data</div>
      </div>
    );
  }

  // Calculate totals for display
  const baseBidAmount = (isEditing && includeBaseBid) || (!isEditing && proposal?.base_bid_amount > 0) 
    ? (baseEstimate.total || 0) 
    : 0;
  
  const displayAlternates = isEditing 
    ? alternates.filter(alt => selectedAlternates.includes(alt.id))
    : proposalAlternates;
  
  const alternatesTotal = displayAlternates.reduce((sum, alt) => sum + (alt.price || alt.amount || 0), 0);
  const adjustmentValue = parseFloat(priceAdjustment) || 0;
  const calculatedTotal = baseBidAmount + alternatesTotal;
  const totalAmount = calculatedTotal + adjustmentValue;

  return (
    <div style={styles.container}>
      {/* Action Buttons - Hidden when printing */}
      <div style={styles.actionButtons} className="no-print">
        {isEditing ? (
          <>
            <button 
              onClick={() => setShowPreview(!showPreview)}
              style={{...styles.button, background: showPreview ? "#666" : "#3b82f6"}}
            >
              {showPreview ? "✏️ Edit" : "👁️ View"}
            </button>
            <button 
              onClick={handleSendEmail}
              style={{...styles.button, background: "#10b981"}}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? "Sending..." : "📧 Email"}
            </button>
            {showPreview && (
              <button onClick={() => window.print()} style={{...styles.button, ...styles.printButton}}>
                🖨️ Print
              </button>
            )}
            <button onClick={handleSave} style={{...styles.button, ...styles.saveButton}} disabled={isSaving}>
              {isSaving ? "Saving..." : "💾 Save"}
            </button>
            {proposalId && (
              <button onClick={() => setIsEditing(false)} style={{...styles.button, ...styles.cancelButton}}>
                ❌ Cancel
              </button>
            )}
            {!proposalId && (
              <button onClick={() => navigate(-1)} style={{...styles.button, ...styles.cancelButton}}>
                ❌ Cancel
              </button>
            )}
          </>
        ) : (
          <>
            {user && (
          <>
            <button onClick={() => navigate(-1)} style={{...styles.button, background: "#666"}}>
              ← Back
            </button>
            <input
              type="text"
              value={contractorEmail}
              onChange={(e) => setContractorEmail(e.target.value)}
              placeholder="Contractor email"
              style={{padding: "10px 14px", fontSize: 14, border: "2px solid #e5e7eb", borderRadius: 8, minWidth: 220}}
            />
            <button 
              onClick={handleSendEmail}
              style={{...styles.button, background: "#10b981"}}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? "Sending..." : "📧 Email"}
            </button>
          </>
            )}
            <button
              onClick={async () => {
                window.print();
                if (proposalId) {
                  await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', proposalId);
                  setProposal(prev => prev ? { ...prev, status: 'sent' } : prev);
                }
              }}
              style={{...styles.button, ...styles.printButton}}
            >
              🖨️ Print
            </button>
          </>
        )}
      </div>

      {/* Configuration Card - Only visible when editing and not previewing */}
      {isEditing && !showPreview && (
        <div style={styles.configCard} className="no-print">
          <div style={styles.cardContent}>
            <div style={styles.cardRow}>
              <label style={styles.cardLabel}>Select Contractor:</label>
              <select
                value={selectedContractorId}
                onChange={handleContractorChange}
                style={styles.cardSelect}
              >
                <option value="">-- Select Contractor --</option>
                {contractors.map(contractor => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.contractor_name}
                    {contractor.company_name ? ` (${contractor.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{display: 'flex', gap: '20px', marginBottom: 25}}>
              <div style={{flex: 1}}>
                <label style={styles.cardLabel}>Valid Until:</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  style={{...styles.cardDateInput, width: '100%'}}
                />
              </div>
              <div style={{flex: 1}}>
                <label style={styles.cardLabel}>Contractor Email(s):</label>
                <input
                  type="text"
                  value={contractorEmail}
                  onChange={(e) => setContractorEmail(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  style={{...styles.cardDateInput, width: '100%'}}
                />
                <div style={{fontSize: 11, color: '#666', marginTop: 4}}>
                  Separate multiple emails with commas
                </div>
              </div>
            </div>

            <div style={styles.cardSection}>
              <h3 style={styles.cardSectionTitle}>Select Line Items</h3>
              <div style={styles.lineItemsGrid}>
                <div style={styles.lineItem}>
                  <input
                    type="checkbox"
                    id="baseBid"
                    checked={includeBaseBid}
                    onChange={(e) => setIncludeBaseBid(e.target.checked)}
                    style={styles.cardCheckbox}
                  />
                  <label htmlFor="baseBid" style={styles.lineItemLabel}>
                    <span style={{...styles.badge, backgroundColor: BRAND.accent, marginRight: 10}}>BASE BID</span>
                    <span style={styles.lineItemDesc}>
                      {baseEstimate.description || baseEstimate.project_description || "Base scope of work"}
                    </span>
                    <span style={styles.lineItemPrice}>
                      ${(baseEstimate.total || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </span>
                  </label>
                </div>

                {alternates.map(alt => (
                  <div key={alt.id} style={styles.lineItem}>
                    <input
                      type="checkbox"
                      id={`alt-${alt.id}`}
                      checked={selectedAlternates.includes(alt.id)}
                      onChange={() => toggleAlternate(alt.id)}
                      style={styles.cardCheckbox}
                    />
                    <label htmlFor={`alt-${alt.id}`} style={styles.lineItemLabel}>
                      <span style={{...styles.badge, backgroundColor: '#8b5cf6', marginRight: 10}}>
                        ALT {alt.alternate_number}
                      </span>
                      <span style={styles.lineItemDesc}>{alt.description || alt.title}</span>
                      <span style={styles.lineItemPrice}>
                        ${(alt.price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              {/* ── Price Adjustment ── */}
              <div style={{marginTop: 28, paddingTop: 24, borderTop: '2px dashed #e5e7eb'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
                  <div>
                    <h3 style={{...styles.cardSectionTitle, marginBottom: 4}}>💲 Price Adjustment</h3>
                    <div style={{fontSize: 12, color: '#666'}}>
                      Add or subtract an amount from the calculated total for this contractor. Use negative numbers to reduce the price (e.g. <strong>-500</strong> to lower by $500).
                    </div>
                  </div>
                  <div style={{textAlign: 'right', marginLeft: 24, flexShrink: 0}}>
                    <div style={{fontSize: 12, color: '#888', marginBottom: 2}}>Calculated</div>
                    <div style={{fontSize: 18, fontWeight: '600', color: '#555'}}>
                      ${calculatedTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </div>
                  </div>
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                  <div style={{flex: 1}}>
                    <input
                      type="number"
                      value={priceAdjustment}
                      onChange={(e) => setPriceAdjustment(e.target.value)}
                      placeholder="0.00  (e.g. -500 or 250)"
                      style={{
                        ...styles.cardDateInput,
                        width: '100%',
                        border: adjustmentValue !== 0 ? '2px solid #f59e0b' : '2px solid #e5e7eb',
                        backgroundColor: adjustmentValue !== 0 ? '#fffbeb' : '#fff',
                      }}
                      step="0.01"
                    />
                  </div>
                  {priceAdjustment !== '' && (
                    <button
                      onClick={() => setPriceAdjustment('')}
                      style={{padding: '10px 14px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666'}}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                {adjustmentValue !== 0 && (
                  <div style={{marginTop: 14, padding: '12px 16px', backgroundColor: adjustmentValue < 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 8, border: `1px solid ${adjustmentValue < 0 ? '#fca5a5' : '#86efac'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{fontSize: 14, color: '#555'}}>
                      Adjustment: <strong style={{color: adjustmentValue < 0 ? '#ef4444' : '#10b981'}}>
                        {adjustmentValue > 0 ? '+' : ''}{adjustmentValue.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
                      </strong>
                    </div>
                    <div style={{fontSize: 18, fontWeight: 'bold', color: BRAND.accent}}>
                      Adjusted Total: ${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Card - Only visible when editing and not previewing */}
      {isEditing && !showPreview && (
        <div style={styles.summaryCard} className="no-print">
          <div style={styles.cardContent}>
            <h1 style={styles.summaryProposalTitle}>PROJECT PROPOSAL</h1>
            
            {selectedContractor ? (
              <>
                <div style={styles.summaryLabelSmall}>TO:</div>
                <div style={styles.summaryContractorName}>{selectedContractor.contractor_name}</div>
              </>
            ) : (
              <div style={{color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 20}}>
                Please select a contractor above
              </div>
            )}
            
            <div style={styles.summaryLabelSmall}>FOR:</div>
            <div style={styles.summaryProjectName}>{project?.name || 'N/A'}</div>

            <h2 style={styles.summarySubtitle}>PROPOSAL SUMMARY</h2>
            <div style={styles.summaryDivider}></div>

            <div style={{marginTop: 20}}>
              {!includeBaseBid && selectedAlternates.length === 0 ? (
                <div style={{color: '#999', fontStyle: 'italic', padding: '20px 0'}}>
                  No items selected
                </div>
              ) : (
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <th style={{...styles.summaryTableTh, textAlign: 'left'}}>Item</th>
                      <th style={{...styles.summaryTableTh, textAlign: 'left'}}>Description</th>
                      <th style={{...styles.summaryTableTh, textAlign: 'right'}}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {includeBaseBid && (
                      <tr style={{borderBottom: '1px solid #e5e7eb'}}>
                        <td style={styles.summaryTableTd}>
                          <span style={{...styles.badge, backgroundColor: BRAND.accent}}>BASE BID</span>
                        </td>
                        <td style={styles.summaryTableTd}>
                          {baseEstimate.description || baseEstimate.project_description || "Base scope of work"}
                        </td>
                        <td style={{...styles.summaryTableTd, textAlign: 'right', fontWeight: '600'}}>
                          ${baseBidAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    )}
                    {alternates.filter(alt => selectedAlternates.includes(alt.id)).map(alt => (
                      <tr key={alt.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                        <td style={styles.summaryTableTd}>
                          <span style={{...styles.badge, backgroundColor: '#8b5cf6'}}>ALT {alt.alternate_number}</span>
                        </td>
                        <td style={styles.summaryTableTd}>{alt.description || alt.title}</td>
                        <td style={{...styles.summaryTableTd, textAlign: 'right', fontWeight: '600'}}>
                          ${(alt.price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    ))}
                    <tr style={{backgroundColor: '#f9fafb', borderTop: '2px solid ' + BRAND.accent}}>
                      <td colSpan="2" style={{...styles.summaryTableTd, fontWeight: 'bold', fontSize: 18}}>
                        TOTAL INVESTMENT
                      </td>
                      <td style={{...styles.summaryTableTd, textAlign: 'right', fontWeight: 'bold', fontSize: 22, color: BRAND.accent}}>
                        ${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proposal Document - Visible when viewing saved proposal OR when previewing during editing */}
      {(!isEditing || showPreview) && (
        <div className="proposal-container" style={styles.proposal}>
        <div style={styles.topHeader}>
          <div style={styles.dateSection}>
            <p style={styles.dateText}>
              Date: {formatDate(baseEstimate.estimate_date)}
            </p>
            {validUntil && (
              <p style={styles.dateText}>
                Valid Until: {formatDate(validUntil)}
              </p>
            )}
          </div>
          <div style={styles.logoSection}>
            <img src={logoImage} alt="Company Logo" style={styles.logo} />
          </div>
          <div style={styles.estimateTitle}>
            <h2 style={styles.estimateNumber}>
              ESTIMATE #{baseEstimate.estimate_number?.replace('EST-', '')}
            </h2>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 2, marginBottom: 0 }}>
          <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
            Phone: (337)288-0395 | Email: info@dmlelectrical.com | License #: 63147
          </p>
        </div>

        <hr style={styles.divider} />

        <div style={styles.titleSection}>
          <h1 style={styles.proposalTitle}>PROJECT PROPOSAL</h1>
          
          {selectedContractor && (
            <>
              <div style={styles.proposalSmallLabel}>To:</div>
              <div style={styles.proposalBigValue}>{selectedContractor.contractor_name}</div>
            </>
          )}
          
          {project?.name && (
            <>
              <div style={styles.proposalSmallLabel}>For:</div>
              <div style={styles.proposalBigValue}>{project.name}</div>
            </>
          )}
        </div>

        <div style={styles.proposalTable}>
          <div style={styles.tableTitle}>PROPOSAL SUMMARY</div>
          
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: "left", width: 100}}>ITEM</th>
                <th style={{...styles.th, textAlign: "left"}}>DESCRIPTION</th>
                <th style={{...styles.th, textAlign: "right", width: 120}}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {baseBidAmount > 0 && (
                <tr style={styles.tableRow}>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: BRAND.accent}}>BASE BID</span>
                  </td>
                  <td style={{...styles.td, fontSize: 13, color: "#666"}}>
                    {renderDescription(baseEstimate.description || baseEstimate.project_description || "Base scope of work")}
                  </td>
                  <td style={{...styles.td, textAlign: "right", fontWeight: "600", fontSize: 16}}>
                    ${(baseBidAmount + adjustmentValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}

              {displayAlternates.map(alt => (
                <tr key={alt.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: "#8b5cf6"}}>
                      ALT {alt.alternate_number}
                    </span>
                  </td>
                  <td style={{...styles.td, fontSize: 13, color: "#666"}}>
                    {alt.description || alt.title || alt.alternate_title || ""}
                  </td>
                  <td style={{...styles.td, textAlign: "right", fontWeight: "600", fontSize: 16}}>
                    ${(alt.price || alt.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td colSpan="2" style={{...styles.td, fontWeight: "bold", fontSize: 18}}>
                  TOTAL INVESTMENT
                </td>
                <td style={{...styles.td, textAlign: "right", fontWeight: "bold", fontSize: 24, color: BRAND.accent}}>
                  ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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
      )}

      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: brightness(0) saturate(100%) !important;
          opacity: 1 !important;
          cursor: pointer !important;
        }
        
        @media print {
          header,
          nav,
          .no-print,
          [class*="Header"],
          [class*="Navbar"],
          [class*="Sidebar"],
          [class*="Navigation"] {
            display: none !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          body * {
            visibility: hidden;
          }
          
          .proposal-container,
          .proposal-container * {
            visibility: visible;
          }
          
          * {
            box-shadow: none !important;
          }
          
          @page {
            margin: 0.25in 0.25in;
            size: letter portrait;
          }
          
          body > div:first-child {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          
          .proposal-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 40px 50px !important;
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
          }
          
          hr {
            margin: 20px 0 20px 0 !important;
          }
          
          img {
            max-width: 220px !important;
          }
          
          h1 {
            font-size: 26px !important;
            margin-bottom: 10px !important;
          }
          
          h2 {
            font-size: 20px !important;
          }
          
          table {
            margin: 6px 0 !important;
          }
          
          td, th {
            padding: 16px 12px !important;
            font-size: 12px !important;
          }
          
          .proposalTitle {
            font-size: 52px !important;
          }
          
          .proposalBigValue {
            font-size: 20px !important;
          }
          
          .tableTitle {
            font-size: 16px !important;
          }
          
          .scopeText, p {
            font-size: 10px !important;
            line-height: 1.6 !important;
          }
          
          .badge {
            font-size: 20px !important;
            padding: 6px 16px !important;
          }
          
          .dateText {
            font-size: 20px !important;
          }
          
          .estimateNumber {
            font-size: 32px !important;
          }
          
          .signatureLabel {
            font-size: 16px !important;
          }
          
          .proposal-container {
            font-size: 2px !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "transparent",
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
  printButton: {
    backgroundColor: BRAND.accent,
  },
  configCard: {
    maxWidth: 900,
    margin: "0 auto 30px auto",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: BRAND.bg,
    padding: "20px 30px",
    margin: 0,
  },
  cardContent: {
    padding: "30px",
  },
  cardRow: {
    marginBottom: 25,
  },
  cardLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  cardSelect: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  cardDateInput: {
    padding: "12px 16px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
  },
  emailBox: {
    padding: "12px 16px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    color: "#111",
  },
  cardSection: {
    marginTop: 30,
    paddingTop: 30,
    borderTop: "2px solid #e5e7eb",
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: BRAND.bg,
    marginBottom: 20,
  },
  lineItemsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  lineItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  cardCheckbox: {
    width: 24,
    height: 24,
    cursor: "pointer",
    marginRight: 12,
  },
  lineItemLabel: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    cursor: "pointer",
    fontSize: 14,
  },
  lineItemDesc: {
    flex: 1,
    color: "#666",
  },
  lineItemPrice: {
    fontWeight: "600",
    color: "#111",
    fontSize: 16,
  },
  cardTotal: {
    marginTop: 30,
    paddingTop: 25,
    borderTop: "3px solid " + BRAND.accent,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTotalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  cardTotalValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: BRAND.accent,
  },
  summaryCard: {
    maxWidth: 900,
    margin: "0 auto 30px auto",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    overflow: "hidden",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    fontSize: 16,
  },
  summaryLabel: {
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    fontSize: 13,
    letterSpacing: "0.5px",
  },
  summaryValue: {
    fontWeight: "600",
    color: "#111",
    fontSize: 16,
  },
  summaryTableTh: {
    padding: "12px 16px",
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    borderBottom: "2px solid #e5e7eb",
  },
  summaryTableTd: {
    padding: "16px 16px",
    fontSize: 14,
    color: "#111",
  },
  summaryProposalTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: BRAND.bg,
    textAlign: "center",
    margin: "0 0 20px 0",
    letterSpacing: "2px",
  },
  summaryLabelSmall: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 5,
    fontWeight: "600",
  },
  summaryContractorName: {
    fontSize: 26,
    fontWeight: "bold",
    color: BRAND.accent,
    textAlign: "center",
    marginBottom: 10,
  },
  summaryProjectName: {
    fontSize: 26,
    fontWeight: "bold",
    color: BRAND.accent,
    textAlign: "center",
    marginBottom: 20,
  },
  summarySubtitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: BRAND.bg,
    textAlign: "center",
    marginTop: 30,
    marginBottom: 5,
  },
  summaryDivider: {
    height: "2px",
    backgroundColor: "#e5e7eb",
    margin: "0 0 20px 0",
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
    marginBottom: 4,
  },
  dateSection: {
    flex: "0 0 160px",
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    margin: "0",
    lineHeight: "1.4",
    fontWeight: "600",
  },
  dateInput: {
    fontSize: 12,
    padding: "4px",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    width: "120px",
    marginTop: 4,
    backgroundColor: "#fff",
    color: "#111",
  },
  logoSection: {
    flex: 1,
    textAlign: "center",
  },
  logo: {
    maxWidth: 240,
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
    flex: "0 0 160px",
    textAlign: "right",
  },
  estimateNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
    whiteSpace: "nowrap",
  },
  divider: {
    border: "none",
    borderTop: "3px solid " + BRAND.accent,
    margin: "30px 0 30px 0",
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
  contractorSelect: {
    fontSize: 20,
    padding: "8px 12px",
    border: "2px solid " + BRAND.accent,
    borderRadius: 4,
    backgroundColor: "#fff",
    color: BRAND.accent,
    fontWeight: "700",
    width: "100%",
    maxWidth: 500,
    margin: "0 auto",
    display: "block",
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
  checkbox: {
    width: 20,
    height: 20,
    cursor: "pointer",
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

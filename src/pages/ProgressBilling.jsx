import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/dateUtils";
import { notify } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function ProgressBilling() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const proposalId = searchParams.get("proposalId");
  const coId = searchParams.get("coId");
  const { user } = useAuth();

  const [estimate, setEstimate] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [changeOrder, setChangeOrder] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Invoice details
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerm, setPaymentTerm] = useState("upon_receipt");
  const [invoiceDescription, setInvoiceDescription] = useState("");

  // Billing amounts
  const [totalContractValue, setTotalContractValue] = useState(0);
  const [previouslyBilled, setPreviouslyBilled] = useState(0);
  const [billingMode, setBillingMode] = useState("dollar"); // "dollar" or "percentage"
  const [billingAmount, setBillingAmount] = useState("");
  const [billingPercentage, setBillingPercentage] = useState("");

  // Deposits
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposits, setSelectedDeposits] = useState(new Set());

  // Extra line items (don't affect contract %)
  const [extraLineItems, setExtraLineItems] = useState([]);

  function addExtraLineItem() {
    setExtraLineItems(prev => [...prev, { id: Date.now(), description: '', amount: '' }]);
  }
  function updateExtraLineItem(id, field, value) {
    setExtraLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }
  function removeExtraLineItem(id) {
    setExtraLineItems(prev => prev.filter(item => item.id !== id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: sum ONLY the draw amount from each previous progress invoice.
  // We read the "This draw: $X" value written into the invoice notes — this is
  // far more reliable than trying to identify the "first" invoice_item by
  // insertion order (UUIDs make .order('id') non-deterministic).
  // Falls back to the invoice total for any invoice that has no draw tag.
  // ─────────────────────────────────────────────────────────────────────────
  async function sumDrawAmounts(invoiceObjs) {
    if (!invoiceObjs || invoiceObjs.length === 0) return 0;

    // invoiceObjs may be lightweight {id} objects — fetch full notes + total
    const ids = invoiceObjs.map(inv => inv.id);
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total, notes')
      .in('id', ids);

    if (!invoices || invoices.length === 0) return 0;

    return invoices.reduce((sum, inv) => {
      // Parse "This draw: $9438.00" from the structured notes text
      if (inv.notes) {
        const m = inv.notes.match(/This draw: \$([0-9,]+(?:\.[0-9]+)?)/);
        if (m) return sum + parseFloat(m[1].replace(/,/g, ''));
      }
      // Fallback: use total (for very old invoices without the draw tag)
      return sum + (inv.total || 0);
    }, 0);
  }

  useEffect(() => {
    if (proposalId) {
      loadProposalData();
    } else if (coId) {
      loadChangeOrderData();
    } else if (estimateId) {
      loadEstimateData();
    }
  }, [proposalId, coId, estimateId]);

  async function loadChangeOrderData() {
    try {
      const { data: coData, error: coError } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", coId)
        .single();

      if (coError) throw new Error("Could not find change order.");
      setChangeOrder(coData);

      // Load project
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("name", coData.project_name)
        .single();

      if (projectData) {
        setProject(projectData);
        setCustomerName(projectData.contractor || projectData.customer || coData.project_name);

        // Load deposits
        const { data: depositsData } = await supabase
          .from("project_deposits")
          .select("*")
          .eq("project_id", projectData.id)
          .eq("status", "received")
          .order("deposit_date", { ascending: false });
        setDeposits(depositsData || []);
      } else {
        setCustomerName(coData.project_name || "");
      }

      setEstimate({
        project_name: coData.project_name,
        estimate_number: coData.change_order_number,
        customer_name: coData.project_name
      });

      const contractValue = coData.total || 0;
      setTotalContractValue(contractValue);

      // Load previous progress billing invoices for this change order.
      // Primary: query by source_change_order_id (bulletproof — set at invoice creation).
      // Fallback: legacy [CO:xxx] notes tag for invoices created before the column existed.
      let { data: coInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("source_change_order_id", coId);

      if (!coInvoices || coInvoices.length === 0) {
        const { data: legacyCoInvoices } = await supabase
          .from("invoices")
          .select("id")
          .eq("project_name", coData.project_name)
          .like("notes", `%[CO:${coId}]%`);
        coInvoices = legacyCoInvoices;
      }

      // Sum ONLY the draw amount per invoice (parsed from notes — excludes extra line items)
      const prevBilled = await sumDrawAmounts(coInvoices || []);
      setPreviouslyBilled(prevBilled);

      setInvoiceDescription(`Change Order ${coData.change_order_number} - ${coData.title}`);
    } catch (err) {
      console.error("Error loading change order:", err);
      notify("Failed to load change order data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProposalData() {
    try {
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (proposalError) throw new Error("Could not find proposal.");
      setProposal(proposalData);
      setCustomerName(proposalData.contractor_name || "");

      // Load base estimate
      const { data: baseEstimate } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", proposalData.base_estimate_id)
        .single();

      if (baseEstimate) setEstimate(baseEstimate);

      // Load project
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("name", baseEstimate?.project_name || proposalData.project_name)
        .single();

      if (projectData) {
        setProject(projectData);
        if (!proposalData.contractor_name) {
          setCustomerName(projectData.contractor || projectData.customer || "");
        }

        // Load deposits
        const { data: depositsData } = await supabase
          .from("project_deposits")
          .select("*")
          .eq("project_id", projectData.id)
          .eq("status", "received")
          .order("deposit_date", { ascending: false });
        setDeposits(depositsData || []);
      }

      // Total contract value = THIS proposal's own amount only.
      // Change orders are separate and each get their own billing scope.
      const contractValue = proposalData.total_amount || 0;
      setTotalContractValue(contractValue);

      // Load previous progress billing for THIS proposal only.
      // We tag each invoice note with [PROPOSAL:<id>] so we can query back precisely.
      // Also parse "This draw: $X" from notes to avoid counting extra line items.
      const projectName = baseEstimate?.project_name || "";
      if (projectName) {
        // Primary: query by source_proposal_id column (bulletproof — set at invoice creation).
        let { data: proposalInvoices } = await supabase
          .from("invoices")
          .select("id")
          .eq("source_proposal_id", proposalId);

        // Fallback 1: legacy [PROPOSAL:xxx] notes tag
        if (!proposalInvoices || proposalInvoices.length === 0) {
          const { data: taggedInvoices } = await supabase
            .from("invoices")
            .select("id")
            .eq("project_name", projectName)
            .like("notes", `%[PROPOSAL:${proposalId}]%`);
          proposalInvoices = taggedInvoices;
        }

        // Fallback 2: legacy estimate number pattern (oldest invoices before tagging)
        if ((!proposalInvoices || proposalInvoices.length === 0) && baseEstimate?.estimate_number) {
          const { data: legacyInvoices } = await supabase
            .from("invoices")
            .select("id")
            .eq("project_name", projectName)
            .like("notes", `%Progress billing from estimate ${baseEstimate.estimate_number} |%`)
            .not("notes", "like", "%[PROPOSAL:%");
          proposalInvoices = legacyInvoices;
        }

        // Sum ONLY the draw amount per invoice (parsed from notes — excludes extra line items)
        const prevBilled = await sumDrawAmounts(proposalInvoices || []);
        setPreviouslyBilled(prevBilled);
      }

      // Use proposal number (what the customer sees) instead of the internal estimate number
      const propNum = proposalData.proposal_number
        ? proposalData.proposal_number.replace(/^PROP-/i, '').replace(/^\d{2,4}-/, '')
        : null;
      setInvoiceDescription(
        propNum
          ? `Base Bid - Proposal #${propNum}`
          : `Base Bid - Estimate #${baseEstimate?.estimate_number || ''}`
      );
    } catch (err) {
      console.error("Error loading proposal:", err);
      notify("Failed to load proposal data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEstimateData() {
    try {
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) throw new Error("Could not find estimate.");
      setEstimate(estimateData);
      setCustomerName(estimateData.customer_name || "");

      // Load project
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("name", estimateData.project_name)
        .single();

      if (projectData) {
        setProject(projectData);

        // Load deposits
        const { data: depositsData } = await supabase
          .from("project_deposits")
          .select("*")
          .eq("project_id", projectData.id)
          .eq("status", "received")
          .order("deposit_date", { ascending: false });
        setDeposits(depositsData || []);
      }

      const contractValue = estimateData.total || 0;
      setTotalContractValue(contractValue);

      // Load previous progress billing invoices.
      // Primary: query by source_estimate_id column (bulletproof — set at invoice creation).
      // Fallback: legacy notes search for invoices created before the column was added.
      if (estimateData.project_name) {
        let { data: estInvoices } = await supabase
          .from("invoices")
          .select("id")
          .eq("source_estimate_id", estimateId);

        if (!estInvoices || estInvoices.length === 0) {
          const { data: legacyInvoices } = await supabase
            .from("invoices")
            .select("id")
            .eq("project_name", estimateData.project_name)
            .like("notes", "%Progress billing%")
            .not("notes", "like", "%[PROPOSAL:%")
            .not("notes", "like", "%[CO:%");
          estInvoices = legacyInvoices;
        }

        // Sum ONLY the draw amount per invoice (parsed from notes — excludes extra line items)
        const prevBilled = await sumDrawAmounts(estInvoices || []);
        setPreviouslyBilled(prevBilled);
      }

      setInvoiceDescription(`Progress billing from estimate ${estimateData.estimate_number || ''}`);
    } catch (err) {
      console.error("Error loading estimate:", err);
      notify("Failed to load estimate data");
    } finally {
      setLoading(false);
    }
  }

  // Calculate derived values
  const remainingToBill = totalContractValue - previouslyBilled;
  const currentBillingAmount = billingMode === "dollar"
    ? Math.min(parseFloat(billingAmount) || 0, remainingToBill)
    : Math.min((remainingToBill * (parseFloat(billingPercentage) || 0)) / 100, remainingToBill);

  const extraItemsTotal = extraLineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const totalDepositsSelected = Array.from(selectedDeposits).reduce((sum, depId) => {
    const dep = deposits.find(d => d.id === depId);
    return sum + (dep?.deposit_amount || 0);
  }, 0);

  const balanceDue = Math.max(0, currentBillingAmount + extraItemsTotal - totalDepositsSelected);

  function calculateDueDate(term) {
    const dateObj = new Date(invoiceDate);
    let daysToAdd = 0;
    switch(term) {
      case 'upon_receipt': return dateObj.toISOString().split('T')[0];
      case 'net_10': daysToAdd = 10; break;
      case 'net_15': daysToAdd = 15; break;
      case 'net_30': daysToAdd = 30; break;
      case 'net_45': daysToAdd = 45; break;
      case 'net_60': daysToAdd = 60; break;
      case 'net_90': daysToAdd = 90; break;
      default: return dateObj.toISOString().split('T')[0];
    }
    const dueDate = new Date(dateObj);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate.toISOString().split('T')[0];
  }

  // Quick percentage buttons
  function setQuickPercentage(pct) {
    setBillingMode("percentage");
    setBillingPercentage(pct.toString());
    setBillingAmount(((remainingToBill * pct) / 100).toFixed(2));
  }

  // Update amount when percentage changes
  function handlePercentageChange(val) {
    setBillingPercentage(val);
    const pct = parseFloat(val) || 0;
    setBillingAmount(((remainingToBill * pct) / 100).toFixed(2));
  }

  // Update percentage when dollar changes
  function handleDollarChange(val) {
    setBillingAmount(val);
    const amt = parseFloat(val) || 0;
    if (remainingToBill > 0) {
      setBillingPercentage(((amt / remainingToBill) * 100).toFixed(1));
    }
  }

  async function handleCreateInvoice() {
    if (currentBillingAmount <= 0) {
      notify("Please enter an amount to bill");
      return;
    }

    if (!customerName.trim()) {
      notify("Please enter a customer name");
      return;
    }

    try {
      // Generate invoice number
      const projectName = estimate.project_name;
      const { data: projectInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('project_name', projectName)
        .order('created_at', { ascending: true });

      let invoiceNumber;

      // Get the project's base invoice number
      let baseNumber = 1001;
      if (projectInvoices && projectInvoices.length > 0) {
        const firstInvoice = projectInvoices[0].invoice_number;
        const match = firstInvoice.match(/^(\d+)/);
        if (match) baseNumber = parseInt(match[1]);
      } else {
        const { data: allInvoices } = await supabase
          .from('invoices')
          .select('invoice_number')
          .order('created_at', { ascending: false })
          .limit(1);

        if (allInvoices && allInvoices.length > 0) {
          const lastInvoiceNum = allInvoices[0].invoice_number;
          const baseNum = parseInt(lastInvoiceNum.split('-')[0]) || 1000;
          baseNumber = baseNum + 1;
        }
      }

      if (coId && changeOrder) {
        // CHANGE ORDER PROGRESS INVOICE: Format 1007-CO1-1, 1007-CO1-2
        // Extract CO suffix from the change order number (e.g., "1010-CO1" → "CO1")
        const coMatch = changeOrder.change_order_number.match(/(CO\d+)$/);
        const coSuffix = coMatch ? coMatch[1] : 'CO1';

        // Count existing progress invoices for this specific change order
        const coInvoicePrefix = `${baseNumber}-${coSuffix}`;
        const { data: existingCOInvoices } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('project_name', projectName)
          .like('invoice_number', `${coInvoicePrefix}-%`);

        const nextProgressNum = (existingCOInvoices?.length || 0) + 1;
        invoiceNumber = `${coInvoicePrefix}-${nextProgressNum}`;
      } else {
        // REGULAR PROGRESS INVOICE: Format 1007-1, 1007-2
        // Only count plain progress invoices — exclude CO invoices like 1007-CO1, 1007-CO1-1
        const progressOnlyInvoices = (projectInvoices || []).filter(inv => {
          const m = inv.invoice_number.match(/^(\d+)-(\d+)$/);
          return m && parseInt(m[1]) === baseNumber;
        });
        const suffix = progressOnlyInvoices.length + 1;
        invoiceNumber = `${baseNumber}-${suffix}`;
      }

      const calculatedDueDate = calculateDueDate(paymentTerm);
      const percentOfTotal = totalContractValue > 0 
        ? ((currentBillingAmount / totalContractValue) * 100).toFixed(1) 
        : 0;

      // Build description for the invoice line item
      const lineDescription = invoiceDescription.trim() || 
        `Progress billing - ${percentOfTotal}% of contract value $${totalContractValue.toFixed(2)}`;

      // Include a structured source tag so "previously billed" queries can identify
      // exactly which invoices belong to this proposal/CO (avoids cross-contamination).
      const sourceTag = proposalId ? `[PROPOSAL:${proposalId}]`
        : coId ? `[CO:${coId}]`
        : `[ESTIMATE:${estimateId || ''}]`;

      const notesText = `Progress billing from estimate ${estimate.estimate_number}` +
        ` | This draw: $${currentBillingAmount.toFixed(2)} (${percentOfTotal}% of $${totalContractValue.toFixed(2)})` +
        ` | Previously billed: $${previouslyBilled.toFixed(2)}` +
        ` | Remaining after this: $${(remainingToBill - currentBillingAmount).toFixed(2)}` +
        (totalDepositsSelected > 0 ? ` | Applied Deposits: $${totalDepositsSelected.toFixed(2)}` : '') +
        ` | Payment Terms: ${paymentTerm.replace('_', ' ')}` +
        ` | ${sourceTag}`;

      const invoiceTotal = currentBillingAmount + extraItemsTotal;

      // Create invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNumber,
          project_name: estimate.project_name,
          customer_name: customerName,
          invoice_date: invoiceDate,
          due_date: calculatedDueDate,
          subtotal: invoiceTotal,
          total: invoiceTotal,
          balance_due: balanceDue,
          deposit_received: totalDepositsSelected || 0,
          status: 'draft',
          notes: notesText,
          created_by: user.id,
          // Permanently tie this invoice to its source proposal / estimate / change order.
          // This makes future "Previously Billed" lookups bulletproof — no text parsing needed.
          ...(proposalId    ? { source_proposal_id: proposalId }                       : {}),
          ...(coId          ? { source_change_order_id: coId }                          : {}),
          ...(!proposalId && !coId && estimateId ? { source_estimate_id: estimateId } : {}),
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create the main progress draw line item
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert([{
          invoice_id: newInvoice.id,
          description: lineDescription,
          quantity: 1,
          unit_price: currentBillingAmount,
          total: currentBillingAmount
        }]);

      if (itemError) throw itemError;

      // Save extra line items one-by-one
      // NOTE: We do NOT use .select().single() here — it can fail in Supabase when
      // the INSERT RLS policy uses a complex EXISTS subquery and the RETURNING clause
      // evaluates the SELECT policy separately, causing a false "no rows" error even
      // though the INSERT succeeded. Match the same pattern as the main draw item.
      const validExtras = extraLineItems.filter(
        item => (item.description || '').trim() !== '' && item.amount !== '' && parseFloat(item.amount) !== 0
      );
      console.log('💡 Extra line items to save:', validExtras.length, validExtras);

      for (const item of validExtras) {
        const amt = parseFloat(item.amount);
        console.log('➕ Inserting extra item:', item.description, '$' + amt);
        const { error: extraErr } = await supabase
          .from('invoice_items')
          .insert([{
            invoice_id: newInvoice.id,
            description: item.description.trim(),
            quantity: 1,
            unit_price: amt,
            total: amt
          }]);
        if (extraErr) {
          console.error('❌ Failed to insert extra item:', extraErr);
          throw new Error(`Failed to save line item "${item.description}": ${extraErr.message}`);
        } else {
          console.log('✅ Extra item saved:', item.description, '$' + amt);
        }
      }

      // Apply selected deposits
      if (selectedDeposits.size > 0) {
        for (const depositId of selectedDeposits) {
          await supabase
            .from('project_deposits')
            .update({
              status: 'applied',
              invoice_id: newInvoice.id
            })
            .eq('id', depositId);
        }
      }

      // Update project's billed_amount and percent_complete
      try {
        const projectName = estimate.project_name;
        const { data: projectData } = await supabase
          .from("projects")
          .select("id, billed_amount, active_worth")
          .eq("name", projectName)
          .single();

        if (projectData) {
          const newBilledAmount = (projectData.billed_amount || 0) + currentBillingAmount;
          const activeWorth = projectData.active_worth || totalContractValue;
          const newPercentComplete = activeWorth > 0 
            ? Math.round((newBilledAmount / activeWorth) * 100) 
            : 0;

          await supabase
            .from("projects")
            .update({
              billed_amount: newBilledAmount,
              percent_complete: Math.min(newPercentComplete, 100),
            })
            .eq("id", projectData.id);

          console.log(`✅ Updated project: billed=$${newBilledAmount.toFixed(2)}, complete=${newPercentComplete}%`);
        }
      } catch (projErr) {
        console.warn("⚠️ Could not update project billing totals:", projErr);
      }

      notify(`Invoice #${invoiceNumber} created successfully!`);
      navigate(`/invoice?invoiceId=${newInvoice.id}`);
    } catch (err) {
      console.error("Error creating invoice:", err);
      notify("Failed to create invoice: " + err.message);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Estimate not found</div>
        <button onClick={() => navigate(-1)} style={styles.button}>Go Back</button>
      </div>
    );
  }

  const percentBilledSoFar = totalContractValue > 0 ? (previouslyBilled / totalContractValue) * 100 : 0;
  const percentThisDraw = totalContractValue > 0 ? (currentBillingAmount / totalContractValue) * 100 : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 Progress Invoice</h1>
          <p style={styles.subtitle}>
            {estimate.project_name} • {estimate.estimate_number}
          </p>
        </div>
        <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
      </div>

      <div style={styles.content}>
        {/* Contract Summary */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            {proposalId ? 'Proposal Billing Scope' : coId ? 'Change Order Billing Scope' : 'Contract Summary'}
          </h2>
          {proposalId && (
            <div style={{marginBottom: 16, padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e40af'}}>
              ℹ️ <strong>Billing against this proposal only.</strong> Change orders are separate — bill them individually from their own Progress Invoice.
            </div>
          )}

          <div style={styles.summaryGrid}>
            <div style={styles.summaryBox}>
              <div style={styles.summaryBoxLabel}>{proposalId ? 'This Proposal Value' : coId ? 'Change Order Value' : 'Total Contract Value'}</div>
              <div style={styles.summaryBoxValue}>${totalContractValue.toFixed(2)}</div>
            </div>
            <div style={styles.summaryBox}>
              <div style={styles.summaryBoxLabel}>Previously Billed</div>
              <div style={{...styles.summaryBoxValue, color: '#666'}}>
                ${previouslyBilled.toFixed(2)}
                {percentBilledSoFar > 0 && (
                  <span style={{fontSize: 14, color: '#999', marginLeft: 8}}>
                    ({percentBilledSoFar.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
            <div style={{...styles.summaryBox, borderColor: '#10b981'}}>
              <div style={styles.summaryBoxLabel}>Remaining to Bill</div>
              <div style={{...styles.summaryBoxValue, color: '#10b981'}}>${remainingToBill.toFixed(2)}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{marginTop: 20}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
              <span style={{fontSize: 13, color: '#666'}}>Billing Progress</span>
              <span style={{fontSize: 13, color: '#666'}}>
                {percentBilledSoFar.toFixed(1)}% billed
                {currentBillingAmount > 0 && ` → ${(percentBilledSoFar + percentThisDraw).toFixed(1)}%`}
              </span>
            </div>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${Math.min(percentBilledSoFar, 100)}%`,
                backgroundColor: '#94a3b8',
              }} />
              <div style={{
                ...styles.progressFill,
                width: `${Math.min(percentThisDraw, 100 - percentBilledSoFar)}%`,
                backgroundColor: BRAND.accent,
                marginLeft: 0,
              }} />
            </div>
            <div style={{display: 'flex', gap: 16, marginTop: 8}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 12, height: 12, backgroundColor: '#94a3b8', borderRadius: 2}} />
                <span style={{fontSize: 12, color: '#666'}}>Previously Billed</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 12, height: 12, backgroundColor: BRAND.accent, borderRadius: 2}} />
                <span style={{fontSize: 12, color: '#666'}}>This Invoice</span>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Amount */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>How Much to Invoice?</h2>
          <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
            Enter the amount you want to bill on this progress invoice.
          </p>

          {/* Quick percentage buttons */}
          <div style={{marginBottom: 20}}>
            <div style={{fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10}}>Quick Select:</div>
            <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
              {[10, 25, 33, 50, 75, 100].map(pct => {
                const amt = (remainingToBill * pct) / 100;
                return (
                  <button
                    key={pct}
                    onClick={() => setQuickPercentage(pct)}
                    style={{
                      padding: '10px 16px',
                      border: billingPercentage === pct.toString() ? '2px solid ' + BRAND.accent : '2px solid #d1d5db',
                      borderRadius: 8,
                      backgroundColor: billingPercentage === pct.toString() ? '#fff7ed' : '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: '600',
                      color: billingPercentage === pct.toString() ? BRAND.accent : '#374151',
                      transition: 'all 0.2s',
                    }}
                  >
                    {pct}%
                    <div style={{fontSize: 11, fontWeight: 'normal', color: '#999', marginTop: 2}}>
                      ${amt.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom amount input */}
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
            <div>
              <label style={styles.label}>Dollar Amount</label>
              <div style={{position: 'relative'}}>
                <span style={{position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#666', fontWeight: 'bold'}}>$</span>
                <input
                  type="number"
                  value={billingAmount}
                  onChange={(e) => {
                    setBillingMode("dollar");
                    handleDollarChange(e.target.value);
                  }}
                  onFocus={() => setBillingMode("dollar")}
                  style={{...styles.input, paddingLeft: 32, fontSize: 20, fontWeight: 'bold', textAlign: 'right'}}
                  placeholder="0.00"
                  min="0"
                  max={remainingToBill}
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label style={styles.label}>Percentage of Remaining</label>
              <div style={{position: 'relative'}}>
                <input
                  type="number"
                  value={billingPercentage}
                  onChange={(e) => {
                    setBillingMode("percentage");
                    handlePercentageChange(e.target.value);
                  }}
                  onFocus={() => setBillingMode("percentage")}
                  style={{...styles.input, paddingRight: 36, fontSize: 20, fontWeight: 'bold', textAlign: 'right'}}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <span style={{position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#666', fontWeight: 'bold'}}>%</span>
              </div>
            </div>
          </div>

          {currentBillingAmount > remainingToBill && (
            <div style={{marginTop: 12, padding: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13}}>
              ⚠️ Amount exceeds remaining balance. It will be capped at ${remainingToBill.toFixed(2)}.
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Invoice Details</h2>
          <div style={styles.grid2}>
            <div style={styles.field}>
              <label style={styles.label}>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={styles.input}
                placeholder="Enter customer name..."
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
              <label style={styles.label}>Payment Terms</label>
              <select
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                style={styles.input}
              >
                <option value="upon_receipt">Upon Receipt</option>
                <option value="net_10">Net 10</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Invoice Line Description</label>
            <input
              type="text"
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              style={styles.input}
              placeholder="e.g., Progress billing - rough-in phase complete"
            />
          </div>
        </div>

        {/* Deposits */}
        {deposits.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>💰 Apply Deposits</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 16}}>
              Select deposits to apply to this invoice.
            </p>

            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {deposits.map((deposit) => {
                const isSelected = selectedDeposits.has(deposit.id);
                return (
                  <label
                    key={deposit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      border: isSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newSelected = new Set(selectedDeposits);
                        if (newSelected.has(deposit.id)) {
                          newSelected.delete(deposit.id);
                        } else {
                          newSelected.add(deposit.id);
                        }
                        setSelectedDeposits(newSelected);
                      }}
                      style={{width: 20, height: 20, cursor: 'pointer'}}
                    />
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 15, fontWeight: '600', color: '#111'}}>
                        ${deposit.deposit_amount.toFixed(2)}
                      </div>
                      <div style={{fontSize: 12, color: '#666', marginTop: 2}}>
                        {formatDate(deposit.deposit_date)}
                        {deposit.reference_notes && ` • ${deposit.reference_notes}`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Extra Line Items */}
        <div style={styles.card}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <div>
              <h2 style={{...styles.cardTitle, marginBottom: 4}}>➕ Extra Line Items</h2>
              <p style={{fontSize: 13, color: '#666', margin: 0}}>
                Add items that bill separately — they won't affect contract progress %.
              </p>
            </div>
            <button
              onClick={addExtraLineItem}
              style={{
                padding: '8px 16px',
                backgroundColor: '#8b5cf6',
                border: 'none',
                color: '#fff',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              + Add Item
            </button>
          </div>

          {extraLineItems.length === 0 ? (
            <div style={{padding: 20, border: '2px dashed #e5e7eb', borderRadius: 8, textAlign: 'center', color: '#999', fontSize: 14}}>
              No extra items. Click "+ Add Item" to add charges like per diem, equipment rental, storage fees, etc.
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {extraLineItems.map((item, idx) => (
                <div key={item.id} style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                  <span style={{fontSize: 13, color: '#999', minWidth: 20}}>{idx + 1}.</span>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateExtraLineItem(item.id, 'description', e.target.value)}
                    style={{...styles.input, flex: 2}}
                    placeholder="Description (e.g., Per diem, Equipment rental)"
                  />
                  <div style={{position: 'relative', flex: 1}}>
                    <span style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 'bold'}}>$</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateExtraLineItem(item.id, 'amount', e.target.value)}
                      style={{...styles.input, paddingLeft: 28, textAlign: 'right'}}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <button
                    onClick={() => removeExtraLineItem(item.id)}
                    style={{padding: '8px 12px', backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, fontWeight: 'bold'}}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {extraItemsTotal > 0 && (
                <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingTop: 10, borderTop: '1px solid #e5e7eb'}}>
                  <span style={{fontSize: 14, color: '#666', marginRight: 12}}>Extra Items Total:</span>
                  <span style={{fontSize: 16, fontWeight: 'bold', color: '#8b5cf6'}}>${extraItemsTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Final Summary & Create Button */}
        <div style={{...styles.card, border: '3px solid ' + BRAND.accent}}>
          <h2 style={{...styles.cardTitle, color: BRAND.accent}}>Invoice Summary</h2>

          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Progress Draw:</span>
            <span style={{...styles.summaryValue, color: BRAND.accent}}>
              ${currentBillingAmount.toFixed(2)}
            </span>
          </div>

          {extraItemsTotal > 0 && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Extra Line Items ({extraLineItems.filter(i => parseFloat(i.amount) > 0).length}):</span>
              <span style={{...styles.summaryValue, color: '#8b5cf6'}}>
                +${extraItemsTotal.toFixed(2)}
              </span>
            </div>
          )}

          {(extraItemsTotal > 0 || currentBillingAmount > 0) && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Invoice Subtotal:</span>
              <span style={{...styles.summaryValue, fontSize: 20, color: BRAND.accent}}>
                ${(currentBillingAmount + extraItemsTotal).toFixed(2)}
              </span>
            </div>
          )}

          {totalDepositsSelected > 0 && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Deposits Applied:</span>
              <span style={{...styles.summaryValue, color: '#10b981'}}>
                -${totalDepositsSelected.toFixed(2)}
              </span>
            </div>
          )}

          <div style={{...styles.summaryRow, borderTop: '2px solid #e5e7eb', paddingTop: 16, marginTop: 8}}>
            <span style={{...styles.summaryLabel, fontSize: 18, fontWeight: 'bold'}}>Balance Due:</span>
            <span style={{
              ...styles.summaryValue,
              fontSize: 24,
              fontWeight: 'bold',
              color: balanceDue > 0 ? '#ef4444' : '#10b981'
            }}>
              ${balanceDue.toFixed(2)}
            </span>
          </div>

          <div style={{marginTop: 8, fontSize: 13, color: '#666'}}>
            Contract progress: ${(remainingToBill - currentBillingAmount).toFixed(2)} remaining of ${totalContractValue.toFixed(2)}
            {extraItemsTotal > 0 && <span style={{color: '#8b5cf6'}}> (extra items don't count toward contract %)</span>}
          </div>

          <button
            onClick={handleCreateInvoice}
            disabled={currentBillingAmount <= 0}
            style={{
              ...styles.createButton,
              marginTop: 24,
              width: '100%',
              opacity: currentBillingAmount <= 0 ? 0.5 : 1,
              cursor: currentBillingAmount <= 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ✅ Create Invoice — ${(currentBillingAmount + extraItemsTotal).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 900,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  summaryBox: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    textAlign: "center",
  },
  summaryBoxLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBoxValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
  },
  progressBar: {
    width: "100%",
    height: 16,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
  },
  progressFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    display: "block",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  createButton: {
    padding: "16px 32px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 18,
    fontWeight: "bold",
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  error: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 18,
    padding: 40,
  },
  button: {
    padding: "14px 28px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    margin: "0 auto",
    display: "block",
  },
};

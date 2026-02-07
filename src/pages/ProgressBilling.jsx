import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

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
  const coId = searchParams.get("coId"); // Change Order ID
  const { user } = useAuth();
  
  const [estimate, setEstimate] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [changeOrder, setChangeOrder] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [billingConfig, setBillingConfig] = useState({});
  const [billingHistory, setBillingHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerm, setPaymentTerm] = useState("upon_receipt");
  const [project, setProject] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposits, setSelectedDeposits] = useState(new Set());

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
      // Load the change order
      const { data: coData, error: coError } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", coId)
        .single();

      if (coError) {
        console.error("Error loading change order:", coError);
        throw new Error("Could not find change order.");
      }
      
      setChangeOrder(coData);

      console.log("🔄 Change Order Data:", coData);

      // Load the project to get the actual customer name
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("contractor, customer")
        .eq("name", coData.project_name)
        .single();

      if (!projectError && projectData) {
        // Use contractor for commercial projects, otherwise customer
        setCustomerName(projectData.contractor || projectData.customer || coData.project_name);
      } else {
        setCustomerName(coData.project_name || "");
      }

      // Set a mock estimate object for compatibility with existing code
      setEstimate({
        project_name: coData.project_name,
        estimate_number: coData.change_order_number,
        customer_name: coData.project_name
      });

      // Create a single line item for the change order total
      const coItems = [{
        id: `co-${coId}`,
        description: `${coData.change_order_number}: ${coData.title}`,
        total: coData.total || 0,
        isChangeOrderItem: true
      }];

      console.log("📦 CO Items:", coItems);
      setEstimateItems(coItems);
      
      // Initialize billing config
      const defaultConfig = {};
      coItems.forEach(item => {
        defaultConfig[item.id] = {
          type: 'percentage',
          value: 100
        };
      });
      setBillingConfig(defaultConfig);

      // No billing history for change orders (yet)
      setBillingHistory({});

    } catch (err) {
      console.error("Error loading change order:", err);
      alert("Failed to load change order data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProposalData() {
    try {
      // Load the proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (proposalError) {
        console.error("Error loading proposal:", proposalError);
        throw new Error("Could not find proposal. Please try again.");
      }
      
      setProposal(proposalData);
      setCustomerName(proposalData.contractor_name || "");

      console.log("📋 Proposal Data:", proposalData);

      // Load base estimate
      const { data: baseEstimate, error: baseError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", proposalData.base_estimate_id)
        .single();

      if (baseError) throw baseError;
      setEstimate(baseEstimate);
      
      console.log("📊 Base Estimate:", baseEstimate);

      // Load estimate items for the base estimate
      const { data: baseEstimateItems, error: baseItemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", proposalData.base_estimate_id)
        .order("sequence");

      console.log("📦 Base Estimate Items:", baseEstimateItems);

      // Build proposal line items: Base Estimate Items + Selected Alternates
      const proposalItems = [];
      
      // Add individual line items from base estimate
      if (baseEstimateItems && baseEstimateItems.length > 0) {
        baseEstimateItems.forEach(item => {
          proposalItems.push({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.line_total || 0,
            isProposalItem: false  // These are actual estimate items
          });
        });
      } else {
        // Fallback: if no items, show Base Bid as single line
        proposalItems.push({
          id: `base-${proposalData.base_estimate_id}`,
          description: "Base Bid",
          total: proposalData.base_bid_amount || 0,
          isProposalItem: true
        });
      }

      // Load selected alternates from proposal_alternates table
      const { data: proposalAlternates } = await supabase
        .from("proposal_alternates")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("alternate_number");

      console.log("🎯 Proposal Alternates from DB:", proposalAlternates);

      if (proposalAlternates && proposalAlternates.length > 0) {
        proposalAlternates.forEach(alt => {
          proposalItems.push({
            id: `alt-${alt.alternate_estimate_id}`,
            description: alt.alternate_title || `Alternate ${alt.alternate_number}`,
            total: alt.amount || 0,
            isProposalItem: true
          });
        });
      }

      console.log("📦 Proposal Items:", proposalItems);
      setEstimateItems(proposalItems);
      
      if (proposalItems.length === 0) {
        console.warn("No proposal items found");
        setLoading(false);
        return;
      }

      // Load billing history for proposal items
      const itemIds = proposalItems.map(item => item.id);
      const { data: historyData } = await supabase
        .from("estimate_item_billing_history")
        .select("estimate_item_id, billed_amount")
        .in("estimate_item_id", itemIds);

      const historyMap = {};
      if (historyData) {
        historyData.forEach(h => {
          historyMap[h.estimate_item_id] = (historyMap[h.estimate_item_id] || 0) + h.billed_amount;
        });
      }
      setBillingHistory(historyMap);

      // Initialize billing config
      const defaultConfig = {};
      proposalItems.forEach(item => {
        const previouslyBilled = historyMap[item.id] || 0;
        const remaining = item.total - previouslyBilled;
        if (remaining > 0) {
          defaultConfig[item.id] = {
            type: 'percentage',
            value: 100
          };
        }
      });
      setBillingConfig(defaultConfig);

    } catch (err) {
      console.error("Error loading proposal:", err);
      alert("Failed to load proposal data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEstimateData() {
    try {
      // Load estimate
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) {
        console.error("Error loading estimate:", estimateError);
        throw new Error("Could not find estimate. Please try again.");
      }
      
      setEstimate(estimateData);
      setCustomerName(estimateData.customer_name || "");

      // Load project to get available deposits
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("name", estimateData.project_name)
        .single();

      if (!projectError && projectData) {
        setProject(projectData);

        // Load available deposits for this project (status = 'received' only)
        const { data: depositsData, error: depositsError } = await supabase
          .from("project_deposits")
          .select("*")
          .eq("project_id", projectData.id)
          .eq("status", "received")
          .order("deposit_date", { ascending: false });

        if (!depositsError) {
          setDeposits(depositsData || []);
        }
      }

      // Load estimate items
      const { data: itemsData, error: itemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("created_at");

      if (itemsError) {
        console.error("Error loading estimate items:", itemsError);
      }
      
      const items = itemsData || [];
      setEstimateItems(items);
      
      // If no items, still continue (show message later)
      if (items.length === 0) {
        console.warn("No estimate items found for this estimate");
        setLoading(false);
        return;
      }

      // Load billing history for each item
      const itemIds = itemsData.map(item => item.id);
      const { data: historyData } = await supabase
        .from("estimate_item_billing_history")
        .select("estimate_item_id, billed_amount")
        .in("estimate_item_id", itemIds);

      // Sum up billing history per item
      const historyMap = {};
      if (historyData) {
        historyData.forEach(h => {
          historyMap[h.estimate_item_id] = (historyMap[h.estimate_item_id] || 0) + h.billed_amount;
        });
      }
      setBillingHistory(historyMap);

      // Initialize billing config with defaults (100% of remaining)
      const defaultConfig = {};
      itemsData.forEach(item => {
        const previouslyBilled = historyMap[item.id] || 0;
        const remaining = item.total - previouslyBilled;
        if (remaining > 0) {
          defaultConfig[item.id] = {
            type: 'percentage',
            value: 100
          };
        }
      });
      setBillingConfig(defaultConfig);

    } catch (err) {
      console.error("Error loading estimate:", err);
      alert("Failed to load estimate data");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleItem(itemId) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  }

  function handleConfigChange(itemId, field, value) {
    setBillingConfig({
      ...billingConfig,
      [itemId]: {
        ...billingConfig[itemId],
        [field]: value
      }
    });
  }

  function calculateBillingAmount(item) {
    const config = billingConfig[item.id];
    if (!config) return 0;

    const originalAmount = item.total || 0;
    const previouslyBilled = billingHistory[item.id] || 0;
    const remaining = originalAmount - previouslyBilled;

    if (config.type === 'percentage') {
      return (remaining * (config.value || 0)) / 100;
    } else {
      return Math.min(config.value || 0, remaining);
    }
  }

  function calculateDueDate(term) {
    const dateObj = new Date(invoiceDate);
    let daysToAdd = 0;

    switch(term) {
      case 'upon_receipt':
        return dateObj.toISOString().split('T')[0]; // Same day
      case 'net_10':
        daysToAdd = 10;
        break;
      case 'net_15':
        daysToAdd = 15;
        break;
      case 'net_30':
        daysToAdd = 30;
        break;
      case 'net_45':
        daysToAdd = 45;
        break;
      case 'net_60':
        daysToAdd = 60;
        break;
      case 'net_90':
        daysToAdd = 90;
        break;
      default:
        return dateObj.toISOString().split('T')[0];
    }

    const dueDate = new Date(dateObj);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate.toISOString().split('T')[0];
  }

  async function handleCreateInvoice() {
    if (selectedItems.size === 0) {
      alert("Please select at least one item to bill");
      return;
    }

    if (!customerName.trim()) {
      alert("Please enter a customer name");
      return;
    }

    try {
      // Check if this is a change order by looking at the estimate's change_order_number or notes
      const isChangeOrder = estimate.estimate_number && estimate.estimate_number.startsWith('CO-');
      let changeOrderNumber = null;
      
      if (isChangeOrder) {
        // Extract CO number (e.g., "01" from "CO-01")
        const match = estimate.estimate_number.match(/CO-(\d+)/);
        changeOrderNumber = match ? match[1] : null;
      }

      // Get existing invoices for this project to determine suffix
      const projectName = estimate.project_name;
      const { data: projectInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('project_name', projectName)
        .eq('created_by', user.id)
        .order('created_at', { ascending: true });

      let invoiceNumber;
      
      if (isChangeOrder && changeOrderNumber) {
        // CHANGE ORDER PROGRESS BILLING: Format 1001-CO1-1, 1001-CO1-2
        let baseNumber = 1001;
        
        if (projectInvoices && projectInvoices.length > 0) {
          // Extract base number from first invoice
          const firstInvoice = projectInvoices[0].invoice_number;
          baseNumber = parseInt(firstInvoice.split('-')[0]) || 1001;
        } else {
          // No invoices yet - get next base number from all invoices
          const { data: allInvoices } = await supabase
            .from('invoices')
            .select('invoice_number')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (allInvoices && allInvoices.length > 0) {
            const lastInvoiceNum = allInvoices[0].invoice_number;
            const baseNum = parseInt(lastInvoiceNum.split('-')[0]) || 1000;
            baseNumber = baseNum + 1;
          }
        }
        
        // Count existing CO progress invoices with this CO number
        const coPattern = `${baseNumber}-CO${changeOrderNumber}-%`;
        const { data: coProgressInvoices } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('project_name', projectName)
          .like('invoice_number', coPattern);
        
        const nextSuffix = (coProgressInvoices?.length || 0) + 1;
        invoiceNumber = `${baseNumber}-CO${changeOrderNumber}-${nextSuffix}`;
        
      } else {
        // REGULAR PROGRESS BILLING: Format 1001-1, 1001-2
        if (projectInvoices && projectInvoices.length > 0) {
          // Extract base number from first invoice (e.g., "1001" from "1001-1")
          const firstInvoice = projectInvoices[0].invoice_number;
          const baseNumber = firstInvoice.split('-')[0];
          
          // Determine next suffix
          const suffix = projectInvoices.length + 1;
          invoiceNumber = `${baseNumber}-${suffix}`;
        } else {
          // First invoice for this project - get next base number
          const { data: allInvoices } = await supabase
            .from('invoices')
            .select('invoice_number')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          let nextBaseNumber = 1001;
          if (allInvoices && allInvoices.length > 0) {
            // Extract base number from last invoice (handles both "1001" and "1001-1" formats)
            const lastInvoiceNum = allInvoices[0].invoice_number;
            const baseNum = parseInt(lastInvoiceNum.split('-')[0]) || 1000;
            nextBaseNumber = baseNum + 1;
          }
          
          // First progress billing invoice gets suffix -1
          invoiceNumber = `${nextBaseNumber}-1`;
        }
      }

      // Calculate total
      let totalAmount = 0;
      selectedItems.forEach(itemId => {
        const item = estimateItems.find(i => i.id === itemId);
        if (item) {
          totalAmount += calculateBillingAmount(item);
        }
      });

      // Calculate total deposits selected
      let totalDepositsApplied = 0;
      Array.from(selectedDeposits).forEach(depId => {
        const deposit = deposits.find(d => d.id === depId);
        if (deposit) {
          totalDepositsApplied += deposit.deposit_amount;
        }
      });

      // Create invoice
      const balanceDue = Math.max(0, totalAmount - totalDepositsApplied);
      const calculatedDueDate = calculateDueDate(paymentTerm);
      const { data: newInvoice, error: invoiceError} = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNumber,
          project_name: estimate.project_name,
          customer_name: customerName,
          invoice_date: invoiceDate,
          due_date: calculatedDueDate,
          subtotal: totalAmount,
          total: totalAmount,
          balance_due: balanceDue,
          deposit_received: totalDepositsApplied || 0,
          deposit_date: invoiceDate || null,
          status: 'draft',
          notes: `Progress billing from estimate ${estimate.estimate_number}${totalDepositsApplied > 0 ? ` | Applied Deposits: $${totalDepositsApplied.toFixed(2)}` : ''} | Payment Terms: ${paymentTerm.replace('_', ' ')}`,
          created_by: user.id
        }])
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;

      // Link deposits to invoice and mark them as 'applied'
      if (selectedDeposits.size > 0) {
        for (const depositId of selectedDeposits) {
          // Update deposit status to 'applied'
          const { error: depositUpdateError } = await supabase
            .from('project_deposits')
            .update({ 
              status: 'applied',
              invoice_id: newInvoice.id
            })
            .eq('id', depositId);
          
          if (depositUpdateError) {
            console.error("Error updating deposit status:", depositUpdateError);
            // Don't throw - continue processing
          }
        }
      }

      // Create invoice items and billing history
      for (const itemId of selectedItems) {
        const item = estimateItems.find(i => i.id === itemId);
        if (!item) {
          console.log("❌ Item not found for ID:", itemId);
          continue;
        }

        const billingAmount = calculateBillingAmount(item);
        const config = billingConfig[itemId];

        const originalAmount = item.total || 0;
        const previouslyBilled = billingHistory[itemId] || 0;
        const remaining = originalAmount - previouslyBilled - billingAmount;
        const percentBilling = originalAmount > 0 ? (billingAmount / originalAmount * 100).toFixed(1) : 0;

        // Enhanced description with billing details
        const detailedDescription = `${item.description}\n` +
          `Original: $${originalAmount.toFixed(2)} | ` +
          `This Invoice: $${billingAmount.toFixed(2)} (${percentBilling}%) | ` +
          `Previously Billed: $${previouslyBilled.toFixed(2)} | ` +
          `Remaining: $${remaining.toFixed(2)}`;

        const invoiceItemData = {
          invoice_id: newInvoice.id,
          description: detailedDescription,
          quantity: 1,
          unit_price: billingAmount,
          total: billingAmount
        };

        console.log("📝 Creating invoice item:", invoiceItemData);

        // Create invoice line item
        const { error: itemError } = await supabase
          .from('invoice_items')
          .insert([invoiceItemData]);
        
        if (itemError) {
          console.error("Error creating invoice item:", itemError);
          throw itemError;
        }

        // Create billing history record (skip for proposal items)
        // Proposal-level billing uses synthetic IDs (base-xxx, alt-xxx)
        // Only create history for actual estimate items
        if (!item.isProposalItem) {
          const { error: historyError } = await supabase
            .from('estimate_item_billing_history')
            .insert([{
              estimate_item_id: itemId,
              invoice_id: newInvoice.id,
              original_amount: item.total,
              billed_amount: billingAmount,
              billing_type: config.type,
              billing_value: config.value,
              notes: `${config.type === 'percentage' ? config.value + '%' : '$' + config.value} of item`
            }]);
          
          if (historyError) {
            console.error("Error creating billing history:", historyError);
            // Don't throw - history is optional for proposal billing
          }
        }
      }

      alert(`Invoice #${invoiceNumber} created successfully!`);
      navigate(`/invoice?invoiceId=${newInvoice.id}`);

    } catch (err) {
      console.error("Error creating invoice:", err);
      alert("Failed to create invoice: " + err.message);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading estimate data...</div>
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

  // Calculate totals
  const totalOriginal = estimateItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalBilled = Object.values(billingHistory).reduce((sum, amount) => sum + amount, 0);
  const totalRemaining = totalOriginal - totalBilled;
  const currentBillingTotal = Array.from(selectedItems).reduce((sum, itemId) => {
    const item = estimateItems.find(i => i.id === itemId);
    return sum + (item ? calculateBillingAmount(item) : 0);
  }, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Progress Billing</h1>
          <p style={styles.subtitle}>Create invoice from estimate: {estimate.estimate_number}</p>
        </div>
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          ← Back
        </button>
      </div>

      <div style={styles.content}>
        {/* Customer Name Input */}
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
        </div>

        {/* Deposits Available */}
        {deposits.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>💰 Available Deposits</h2>
            <p style={styles.hint}>Select which deposits to apply to this invoice.</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              {deposits.map((deposit) => {
                const isSelected = selectedDeposits.has(deposit.id);
                return (
                  <div 
                    key={deposit.id} 
                    style={{
                      ...styles.depositRow,
                      backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                      borderColor: isSelected ? '#3b82f6' : '#e5e7eb'
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
                      <div style={{fontSize: 14, fontWeight: '600', color: '#111'}}>
                        Deposit of ${deposit.deposit_amount.toFixed(2)}
                      </div>
                      <div style={{fontSize: 12, color: '#666', marginTop: 4}}>
                        Received: {new Date(deposit.deposit_date).toLocaleDateString()} 
                        {deposit.reference_notes && ` • ${deposit.reference_notes}`}
                      </div>
                    </div>
                    
                    <div style={{fontSize: 16, fontWeight: '600', color: BRAND.accent}}>
                      ${deposit.deposit_amount.toFixed(2)}
                    </div>
                  </div>
                );
              })}
              
              {selectedDeposits.size > 0 && (
                <div style={{marginTop: 12, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8, border: '2px solid #3b82f6'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontSize: 14, fontWeight: '600', color: '#666'}}>Total Deposits Selected:</span>
                    <span style={{fontSize: 16, fontWeight: 'bold', color: BRAND.accent}}>
                      ${Array.from(selectedDeposits).reduce((sum, depId) => {
                        const dep = deposits.find(d => d.id === depId);
                        return sum + (dep?.deposit_amount || 0);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div style={styles.summaryCard}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Total Contract Value:</span>
            <span style={styles.summaryValue}>${totalOriginal.toFixed(2)}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Previously Billed:</span>
            <span style={{...styles.summaryValue, color: '#666'}}>${totalBilled.toFixed(2)}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Remaining to Bill:</span>
            <span style={{...styles.summaryValue, color: '#10b981'}}>${totalRemaining.toFixed(2)}</span>
          </div>
          <div style={{...styles.summaryRow, borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 12}}>
            <span style={{...styles.summaryLabel, fontSize: 18, fontWeight: 'bold'}}>Subtotal (Current Billing):</span>
            <span style={{...styles.summaryValue, fontSize: 18, fontWeight: 'bold', color: BRAND.accent}}>
              ${currentBillingTotal.toFixed(2)}
            </span>
          </div>
          {Array.from(selectedDeposits).reduce((sum, depId) => {
            const dep = deposits.find(d => d.id === depId);
            return sum + (dep?.deposit_amount || 0);
          }, 0) > 0 && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>
                Deposits Applied:
              </span>
              <span style={{...styles.summaryValue, color: '#10b981', fontWeight: 'bold'}}>
                -${Array.from(selectedDeposits).reduce((sum, depId) => {
                  const dep = deposits.find(d => d.id === depId);
                  return sum + (dep?.deposit_amount || 0);
                }, 0).toFixed(2)}
              </span>
            </div>
          )}
          <div style={{...styles.summaryRow, borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 12}}>
            <span style={{...styles.summaryLabel, fontSize: 16, fontWeight: 'bold'}}>Balance Due:</span>
            <span style={{...styles.summaryValue, fontSize: 20, fontWeight: 'bold', color: currentBillingTotal - Array.from(selectedDeposits).reduce((sum, depId) => {
              const dep = deposits.find(d => d.id === depId);
              return sum + (dep?.deposit_amount || 0);
            }, 0) > 0 ? '#ef4444' : '#10b981'}}>
              ${Math.max(0, currentBillingTotal - Array.from(selectedDeposits).reduce((sum, depId) => {
                const dep = deposits.find(d => d.id === depId);
                return sum + (dep?.deposit_amount || 0);
              }, 0)).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Line Items */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Select Items to Bill</h2>
          <p style={styles.hint}>Check items to include in this invoice. Specify billing amount as percentage or fixed value.</p>
          
          {estimateItems.length === 0 ? (
            <div style={{padding: 40, textAlign: 'center', color: '#999'}}>
              <p style={{fontSize: 18, marginBottom: 12}}>No line items found</p>
              <p style={{fontSize: 14}}>
                This estimate doesn't have any line items yet. Please go back and add items to the estimate first.
              </p>
              <button onClick={() => navigate(-1)} style={{...styles.button, marginTop: 20}}>
                Go Back
              </button>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {estimateItems.map((item) => {
              const previouslyBilled = billingHistory[item.id] || 0;
              const itemTotal = item.total || 0;
              const remaining = itemTotal - previouslyBilled;
              const percentBilled = itemTotal > 0 ? (previouslyBilled / itemTotal) * 100 : 0;
              const isFullyBilled = remaining <= 0.01;
              const isSelected = selectedItems.has(item.id);
              const config = billingConfig[item.id] || { type: 'percentage', value: 100 };
              const billingAmount = calculateBillingAmount(item);

              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.itemRow,
                    backgroundColor: isFullyBilled ? '#f3f4f6' : isSelected ? '#eff6ff' : '#fff',
                    opacity: isFullyBilled ? 0.6 : 1
                  }}
                >
                  <div style={styles.itemCheckbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleItem(item.id)}
                      disabled={isFullyBilled}
                      style={{width: 20, height: 20, cursor: isFullyBilled ? 'not-allowed' : 'pointer'}}
                    />
                  </div>

                  <div style={styles.itemInfo}>
                    <div style={styles.itemDescription}>
                      {item.description}
                      {isFullyBilled && <span style={styles.fullTagged}> ✅ Fully Billed</span>}
                    </div>
                    <div style={styles.itemMeta}>
                      Original: ${itemTotal.toFixed(2)} • 
                      Billed: ${previouslyBilled.toFixed(2)} • 
                      Remaining: ${remaining.toFixed(2)}
                    </div>
                    {percentBilled > 0 && (
                      <div style={styles.progressBar}>
                        <div style={{...styles.progressFill, width: `${Math.min(percentBilled, 100)}%`}} />
                      </div>
                    )}
                  </div>

                  {!isFullyBilled && isSelected && (
                    <div style={styles.itemBillingConfig}>
                      <select
                        value={config.type}
                        onChange={(e) => handleConfigChange(item.id, 'type', e.target.value)}
                        style={styles.configSelect}
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        max={config.type === 'percentage' ? 100 : remaining}
                        step={config.type === 'percentage' ? 1 : 0.01}
                        value={config.value}
                        onChange={(e) => handleConfigChange(item.id, 'value', parseFloat(e.target.value) || 0)}
                        style={styles.configInput}
                      />
                      <span style={styles.configResult}>= ${billingAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}

          {estimateItems.length > 0 && (
            <div style={styles.actions}>
              <button
                onClick={handleCreateInvoice}
                disabled={selectedItems.size === 0}
                style={{
                  ...styles.createButton,
                  opacity: selectedItems.size === 0 ? 0.5 : 1,
                  cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Create Invoice (${currentBillingTotal.toFixed(2)})
              </button>
            </div>
          )}
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
    padding: 32,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
  },
  field: {
    marginBottom: 20,
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
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
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
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  itemRow: {
    display: "flex",
    gap: 16,
    padding: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    alignItems: "flex-start",
  },
  itemCheckbox: {
    paddingTop: 4,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  fullBilled: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "bold",
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    transition: "width 0.3s ease",
  },
  itemBillingConfig: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  configSelect: {
    padding: "8px 12px",
    fontSize: 14,
    border: "2px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  configInput: {
    width: 80,
    padding: "8px 12px",
    fontSize: 14,
    border: "2px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
  },
  configResult: {
    fontSize: 14,
    fontWeight: "600",
    color: BRAND.accent,
  },
  actions: {
    marginTop: 24,
    display: "flex",
    justifyContent: "flex-end",
  },
  createButton: {
    padding: "14px 32px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
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

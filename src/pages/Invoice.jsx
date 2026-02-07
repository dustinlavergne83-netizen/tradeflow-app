




import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { createInvoiceJournalEntry } from "../utils/accountingJournals";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function Invoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const coId = searchParams.get("coId"); // Change Order ID parameter
  const { user } = useAuth();
  
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Editable fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [depositReceived, setDepositReceived] = useState(0);
  const [depositDate, setDepositDate] = useState("");
  const [sending, setSending] = useState(false);
  
  // Markup state
  const [itemMarkups, setItemMarkups] = useState({});
  
  // Daily breakdown state - format: {itemId: {date: {hours, notes}}}
  const [dailyBreakdowns, setDailyBreakdowns] = useState({});
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // Progress billing state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [itemBillingAmounts, setItemBillingAmounts] = useState({});
  
  // Change Order state
  const [changeOrder, setChangeOrder] = useState(null);
  const [changeOrderSelected, setChangeOrderSelected] = useState(false);
  
  // Deposits state
  const [availableDeposits, setAvailableDeposits] = useState([]);
  const [selectedDeposits, setSelectedDeposits] = useState(new Set());
  const [showDepositSelection, setShowDepositSelection] = useState(true);
  const [depositFee, setDepositFee] = useState(0);
  
  // Detail view state
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      console.log("🔵 Loading invoice:", invoiceId);
      loadInvoice();
    }
    if (coId) {
      loadChangeOrder();
    }
  }, [invoiceId, coId]);
  
  async function loadDeposits(projectName) {
    if (!projectName) return;
    
    try {
      const { data, error } = await supabase
        .from("project_deposits")
        .select("*")
        .eq("project_id", (
          await supabase
            .from("projects")
            .select("id")
            .ilike("name", projectName)
            .single()
        ).data?.id)
        .eq("status", "received")
        .order("deposit_date", { ascending: false });
      
      if (error && error.code !== "PGRST116") {
        console.error("Error loading deposits:", error);
        return;
      }
      
      setAvailableDeposits(data || []);
    } catch (err) {
      console.error("Error loading deposits:", err);
    }
  }
  
  async function loadDepositsForProject(projectName) {
    if (!projectName) return;
    
    try {
      // First, find the project ID
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .ilike("name", projectName)
        .single();
      
      if (projectError) {
        console.log("Project not found, skipping deposits load");
        return;
      }
      
      if (!projectData) return;
      
      // Then load available deposits for this project
      const { data: depositsData, error: depositsError } = await supabase
        .from("project_deposits")
        .select("*")
        .eq("project_id", projectData.id)
        .eq("status", "received")
        .order("deposit_date", { ascending: false });
      
      if (depositsError) {
        console.log("Error loading deposits:", depositsError);
        return;
      }
      
      setAvailableDeposits(depositsData || []);
    } catch (err) {
      console.error("Error loading deposits:", err);
    }
  }
  
  async function loadChangeOrder() {
    try {
      const { data, error } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", coId)
        .single();
      
      if (error) throw error;
      setChangeOrder(data);
    } catch (err) {
      console.error("Error loading change order:", err);
    }
  }
  
  async function handleAddChangeOrder() {
    if (!changeOrder) return;
    
    try {
      const { error } = await supabase
        .from("invoice_items")
        .insert([{
          invoice_id: invoiceId,
          description: `Change Order: ${changeOrder.title}`,
          quantity: 1,
          unit_price: changeOrder.total,
          total: changeOrder.total
        }]);
      
      if (error) throw error;
      
      setChangeOrderSelected(true);
      loadInvoice();
    } catch (err) {
      console.error("Error adding change order:", err);
      alert("Failed to add change order to invoice");
    }
  }

  async function loadInvoice() {
    try {
      // Load invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      
      setInvoice(invoiceData);
      setInvoiceNumber(invoiceData.invoice_number || "");
      setCustomerName(invoiceData.customer_name || "");
      setCustomerEmail(invoiceData.customer_email || "");
      setInvoiceDate(invoiceData.invoice_date || "");
      setDueDate(invoiceData.due_date || "");
      setStatus(invoiceData.status || "draft");
      setNotes(invoiceData.notes || "");
      setAmountPaid(invoiceData.amount_paid || 0);
      setDepositReceived(invoiceData.deposit_received || 0);
      setDepositDate(invoiceData.deposit_date || "");

      // Load invoice items
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at");

      console.log("📦 Invoice Items Loaded:", itemsData);
      console.log("❌ Invoice Items Error:", itemsError);

      if (itemsError) throw itemsError;
      setInvoiceItems(itemsData || []);
      
      // Load markup percentages for all items
      if (itemsData && itemsData.length > 0) {
        const markups = {};
        itemsData.forEach(item => {
          if (item.markup_percentage) {
            markups[item.id] = item.markup_percentage;
          }
        });
        setItemMarkups(markups);
      }
      
      // Check if there are any deposits linked to this invoice
      const { data: linkedDeposits, error: depositsError } = await supabase
        .from("project_deposits")
        .select("*")
        .eq("invoice_id", invoiceId);
      
      if (!depositsError && linkedDeposits && linkedDeposits.length > 0) {
        const totalDeposit = linkedDeposits.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);
        const depositDate = linkedDeposits[0].deposit_date;
        
        console.log("💰 Found linked deposits for this invoice:", totalDeposit);
        setDepositReceived(totalDeposit);
        setDepositDate(depositDate);
        
        // Update the invoice in the database if the deposit wasn't synced
        if ((invoiceData.deposit_received || 0) !== totalDeposit) {
          console.log("🔄 Syncing deposit amount to invoice...");
          await supabase
            .from("invoices")
            .update({
              deposit_received: totalDeposit,
              deposit_date: depositDate
            })
            .eq("id", invoiceId);
        }
      }
      
      // Load available deposits for this project
      if (invoiceData.project_name) {
        await loadDepositsForProject(invoiceData.project_name);
      }
    } catch (err) {
      console.error("Error loading invoice:", err);
      alert("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }
  
  async function handleApplyDeposits() {
    if (selectedDeposits.size === 0) {
      alert("Please select at least one deposit to apply");
      return;
    }
    
    try {
      const selectedDepositIds = Array.from(selectedDeposits);
      const depositsToApply = availableDeposits.filter(d => selectedDepositIds.includes(d.id));
      const totalDeposits = depositsToApply.reduce((sum, d) => sum + d.deposit_amount, 0);
      const depositDate = depositsToApply[0].deposit_date;
      const netDepositAmount = totalDeposits - depositFee;
      
      // Update invoice with deposit information
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          deposit_received: totalDeposits,
          deposit_date: depositDate,
          processing_fee: depositFee || 0,
          net_deposit_amount: netDepositAmount
        })
        .eq("id", invoiceId);
      
      if (updateError) throw updateError;
      
      // Mark deposits as applied
      const { error: markError } = await supabase
        .from("project_deposits")
        .update({ status: "applied" })
        .in("id", selectedDepositIds);
      
      if (markError) throw markError;
      
      // If there's a processing fee, create journal entry for it
      if (depositFee > 0) {
        try {
          // Get the Bank/App Transfer Fees account (7610)
          const { data: feeAccount, error: feeError } = await supabase
            .from("accounts")
            .select("id")
            .eq("account_number", "7610")
            .maybeSingle();
          
          if (feeError) {
            console.error("Error fetching bank/app transfer fees account:", feeError);
            alert("⚠️ Deposit applied but could not find Bank/App Transfer Fees account (7610). Fee not recorded in journal entry.");
          } else if (!feeAccount) {
            alert("⚠️ Deposit applied but Bank/App Transfer Fees account (7610) not found in Chart of Accounts. Please create it to record the fee.");
          } else {
            // Get AR account
            const { data: arAccount } = await supabase
              .from("accounts")
              .select("id")
              .eq("account_number", "1100")
              .maybeSingle();
            
            // Get the Undeposited Funds account or first liability account
            let depositHoldingAccount = null;
            const { data: ufdAccount } = await supabase
              .from("accounts")
              .select("id")
              .or(`account_name.ilike.%Undeposited%,account_name.ilike.%Previous%,account_name.ilike.%Holding%`)
              .limit(1)
              .maybeSingle();
            
            if (ufdAccount) {
              depositHoldingAccount = ufdAccount;
            } else {
              // Fallback: use Accounts Receivable if no holding account found
              const { data: fallbackAccount } = await supabase
                .from("accounts")
                .select("id")
                .eq("account_type", "Asset")
                .limit(1)
                .maybeSingle();
              
              if (fallbackAccount) {
                depositHoldingAccount = fallbackAccount;
              }
            }
            
            if (depositHoldingAccount && arAccount) {
              // Create journal entry for the processing fee
              const { data: lastEntry } = await supabase
                .from("journal_entries")
                .select("entry_number")
                .eq("company_id", user.id)
                .order("entry_number", { ascending: false })
                .limit(1)
                .maybeSingle();
              
              const nextEntryNumber = (lastEntry?.entry_number || 0) + 1;
              
              const feeEntry = {
                entry_number: nextEntryNumber,
                entry_date: depositDate,
                description: `Deposit processing fee for Invoice #${invoiceNumber} - $${depositFee.toFixed(2)}`,
                reference_type: "deposit",
                reference_id: invoiceId,
                created_by: user.id,
                company_id: user.id
              };
              
              const { data: newEntry, error: entryError } = await supabase
                .from("journal_entries")
                .insert([feeEntry])
                .select()
                .single();
              
              if (newEntry && !entryError) {
                // Create journal entry lines
                const feeLines = [
                  {
                    entry_id: newEntry.id,
                    line_number: 1,
                    account_id: feeAccount.id,
                    debit: depositFee,
                    credit: 0,
                    description: "Deposit processing fee"
                  },
                  {
                    entry_id: newEntry.id,
                    line_number: 2,
                    account_id: depositHoldingAccount.id,
                    debit: 0,
                    credit: depositFee,
                    description: "Fee offset"
                  }
                ];
                
                const { error: linesError } = await supabase
                  .from("journal_entry_lines")
                  .insert(feeLines);
                
                if (!linesError) {
                  // Post the journal entry
                  try {
                    await supabase.rpc("post_journal_entry", {
                      p_entry_id: newEntry.id,
                      p_user_id: user.id
                    });
                    console.log("✅ Deposit fee journal entry posted");
                  } catch (postErr) {
                    console.error("Error posting fee journal entry:", postErr);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("⚠️ Warning: Error creating fee journal entry:", err);
          // Don't fail the deposit application, just warn
        }
      }
      
      setDepositReceived(totalDeposits);
      setSelectedDeposits(new Set());
      setShowDepositSelection(false);
      setDepositFee(0);
      
      const feeText = depositFee > 0 ? `\n💰 Processing Fee: $${depositFee.toFixed(2)}\n💵 Net Deposit: $${netDepositAmount.toFixed(2)}` : '';
      alert(`✅ Applied ${selectedDepositIds.length} deposit(s) for $${totalDeposits.toFixed(2)}${feeText}\n\nDeposit is now applied to this invoice. Balance updated!`);
      loadInvoice();
    } catch (err) {
      console.error("Error applying deposits:", err);
      alert("Failed to apply deposits: " + err.message);
    }
  }

  async function handleSave() {
    try {
      const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const balanceDue = subtotal - amountPaid;

      // Extract percentage and original amount from progress billing items (if any)
      let progressPercentage = 0;
      let originalAmount = 0;
      if (notes && notes.includes('Progress billing')) {
        // Parse the percentage and original amount from the description of the first item
        // Format: "Labor & Material\nOriginal: $19500.00, This Invoice: $11700.00 (60%), Previously Billed: $0.00, Remaining: $7800.00"
        if (invoiceItems.length > 0) {
          const desc = invoiceItems[0].description || "";
          const percentMatch = desc.match(/\(([0-9.]+)%\)/);
          const originalMatch = desc.match(/Original: \$([0-9,.]+)/);
          
          if (percentMatch) {
            progressPercentage = parseFloat(percentMatch[1]);
          }
          if (originalMatch) {
            originalAmount = parseFloat(originalMatch[1].replace(/,/g, ''));
          }
        }
      }

      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          status: status,
          notes: notes,
          subtotal: subtotal,
          total: subtotal,
          amount_paid: amountPaid,
          balance_due: balanceDue,
        })
        .eq("id", invoiceId);

      if (error) throw error;
      
      // Save markup percentages for each item
      console.log("Saving markups:", itemMarkups);
      const markupSavePromises = Object.entries(itemMarkups).map(([itemId, markupPercent]) => {
        console.log(`🔄 Attempting to save markup ${markupPercent}% for item ${itemId}`);
        return supabase
          .from("invoice_items")
          .update({ markup_percentage: markupPercent })
          .eq("id", itemId);
      });
      
      const markupResults = await Promise.all(markupSavePromises);
      let markupErrors = [];
      
      markupResults.forEach((result, index) => {
        const [itemId, markupPercent] = Object.entries(itemMarkups)[index];
        if (result.error) {
          console.error(`❌ Error saving markup for item ${itemId}:`, result.error);
          markupErrors.push(`Item ${itemId}: ${result.error.message}`);
        } else {
          console.log(`✅ Saved markup ${markupPercent}% for item ${itemId}`);
        }
      });
      
      if (markupErrors.length > 0) {
        console.error("Markup save errors:", markupErrors);
        alert(`⚠️ Invoice saved but some markups failed:\n${markupErrors.join('\n')}\n\nMake sure the invoice_items table has a markup_percentage column.`);
      } else {
        console.log("✅ All markups saved successfully");
      }
      
      // Save daily breakdowns for labor items
      console.log("Saving daily breakdowns:", dailyBreakdowns);
      const dailySavePromises = Object.entries(dailyBreakdowns).map(([itemId, breakdown]) => {
        if (Object.keys(breakdown).length === 0) {
          // If no daily entries, set to null
          return supabase
            .from("invoice_items")
            .update({ daily_breakdown: null })
            .eq("id", itemId);
        }
        console.log(`🔄 Attempting to save daily breakdown for item ${itemId}`);
        return supabase
          .from("invoice_items")
          .update({ daily_breakdown: JSON.stringify(breakdown) })
          .eq("id", itemId);
      });
      
      const dailyResults = await Promise.all(dailySavePromises);
      let dailyErrors = [];
      
      dailyResults.forEach((result, index) => {
        const [itemId] = Object.entries(dailyBreakdowns)[index];
        if (result.error) {
          console.error(`❌ Error saving daily breakdown for item ${itemId}:`, result.error);
          dailyErrors.push(`Item ${itemId}: ${result.error.message}`);
        } else {
          console.log(`✅ Saved daily breakdown for item ${itemId}`);
        }
      });
      
      if (dailyErrors.length > 0) {
        console.error("Daily breakdown save errors:", dailyErrors);
        alert(`⚠️ Invoice saved but some daily breakdowns failed:\n${dailyErrors.join('\n')}\n\nMake sure the invoice_items table has a daily_breakdown column.`);
      } else if (Object.keys(dailyBreakdowns).length > 0) {
        console.log("✅ All daily breakdowns saved successfully");
      }

      // Update project's percent_complete and active_worth if this is a progress billing invoice
      if (progressPercentage > 0 && invoice?.project_name) {
        try {
          // Find the project
          const { data: projectData } = await supabase
            .from("projects")
            .select("id, active_worth")
            .ilike("name", invoice.project_name)
            .single();

          if (projectData) {
            const updateData = { percent_complete: progressPercentage };
            
            // Set active_worth to the original proposal amount if not already set
            if (!projectData.active_worth && originalAmount > 0) {
              updateData.active_worth = originalAmount;
            }
            
            await supabase
              .from("projects")
              .update(updateData)
              .eq("id", projectData.id);
          }
        } catch (err) {
          console.log("Note: Could not auto-update project completion percentage or active worth");
        }
      }
      
      // NOTE: Journal entry is NOT created on save - it will be created ONLY when the invoice is SENT
      // This prevents duplicate journal entries
      alert("Invoice saved successfully!");
      loadInvoice();
    } catch (err) {
      console.error("Error saving invoice:", err);
      alert("Failed to save invoice");
    }
  }

  async function deleteExistingInvoiceJournalEntries() {
    try {
      // Find ALL journal entries for this invoice (by reference_id AND invoice number in description)
      const { data: entries, error: entriesError } = await supabase
        .from("journal_entries")
        .select("id")
        .or(`and(reference_type.eq.invoice,reference_id.eq.${invoiceId}),description.ilike.%Invoice #${invoiceNumber}%`);

      if (entriesError) {
        console.error("Error finding journal entries:", entriesError);
        // Continue anyway - still try to create new one
      }

      if (entries && entries.length > 0) {
        console.log(`🗑️ Found ${entries.length} existing invoice journal entries to delete`);
        
        // Delete all journal entry lines for these entries
        const entryIds = entries.map(e => e.id);
        
        // Delete in correct order to avoid FK constraints
        const { error: linesError } = await supabase
          .from("journal_entry_lines")
          .delete()
          .in("entry_id", entryIds);

        if (linesError) {
          console.error("Error deleting journal entry lines:", linesError);
        }

        // Delete all journal entries
        const { error: deleteError } = await supabase
          .from("journal_entries")
          .delete()
          .in("id", entryIds);

        if (deleteError) {
          console.error("Error deleting journal entries:", deleteError);
        } else {
          console.log(`✅ Deleted ${entries.length} old invoice journal entries`);
        }
      }
    } catch (err) {
      console.error("Error in deleteExistingInvoiceJournalEntries:", err);
    }
  }

  async function handleSendEmail() {
    if (!customerEmail) {
      alert("Please add a customer email address before sending.");
      return;
    }

    if (!invoiceItems || invoiceItems.length === 0) {
      alert("Please add line items to the invoice before sending.");
      return;
    }

    if (!confirm(`Send invoice #${invoiceNumber} to ${customerEmail}?`)) {
      return;
    }

    setSending(true);
    try {
      // First, save the invoice
      await handleSave();

      const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const balanceDue = subtotal - amountPaid;

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: {
          invoiceId: invoiceId,
          siteUrl: window.location.origin,
          to: customerEmail,
          customerName: customerName,
          invoiceNumber: invoiceNumber,
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          lineItems: invoiceItems,
          subtotal: subtotal,
          amountPaid: amountPaid,
          balanceDue: balanceDue,
          notes: notes
        }
      });

      console.log("Edge Function Response:", { data, error });

      if (error) {
        console.error("Edge Function Error Details:", error);
        throw new Error(error.message || JSON.stringify(error));
      }

      if (data && data.error) {
        console.error("Edge Function returned error:", data);
        throw new Error(data.error || "Unknown error from Edge Function");
      }

      // Update invoice status to 'sent'
      const { data: updatedInvoice, error: updateError } = await supabase
        .from("invoices")
        .update({ status: 'sent' })
        .eq("id", invoiceId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Delete any existing journal entries for this invoice BEFORE creating new ones
      // This prevents duplicate entries if the invoice is edited and sent again
      await deleteExistingInvoiceJournalEntries();

      // Create journal entry: Debit A/R, Credit Revenue
      const journalResult = await createInvoiceJournalEntry(
        updatedInvoice,
        user.id,
        user.id
      );

      if (!journalResult.success) {
        console.error("Journal entry creation failed:", journalResult.error);
        alert(`⚠️ Invoice sent but journal entry failed: ${journalResult.error}\nPlease create the entry manually.`);
      }

      setStatus('sent');
      alert(`✅ Invoice sent successfully to ${customerEmail}!`);
    } catch (err) {
      console.error("Error sending invoice:", err);
      alert(`Failed to send invoice: ${err.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateItem(itemId, field, value) {
    try {
      const updates = { [field]: value };
      
      // If quantity or unit_price changed, recalculate total
      const item = invoiceItems.find(i => i.id === itemId);
      if (field === "quantity" || field === "unit_price") {
        const qty = field === "quantity" ? parseFloat(value) : item.quantity;
        const price = field === "unit_price" ? parseFloat(value) : item.unit_price;
        updates.total = qty * price;
      }

      const { error } = await supabase
        .from("invoice_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;
      
      loadInvoice();
    } catch (err) {
      console.error("Error updating item:", err);
      alert("Failed to update item");
    }
  }

  async function handleAddItem() {
    const description = prompt("Item description:");
    if (!description) return;
    
    const qtyStr = prompt("Quantity:", "1");
    const priceStr = prompt("Unit price:");
    
    const quantity = parseFloat(qtyStr) || 1;
    const unitPrice = parseFloat(priceStr) || 0;
    const total = quantity * unitPrice;

    try {
      const { error } = await supabase
        .from("invoice_items")
        .insert([{
          invoice_id: invoiceId,
          description: description,
          quantity: quantity,
          unit_price: unitPrice,
          total: total
        }]);

      if (error) throw error;
      loadInvoice();
    } catch (err) {
      console.error("Error adding item:", err);
      alert("Failed to add item");
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm("Delete this line item?")) return;
    
    try {
      const { error } = await supabase
        .from("invoice_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      loadInvoice();
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Failed to delete item");
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
        <button onClick={() => navigate(-1)} style={styles.button}>
          Go Back
        </button>
      </div>
    );
  }

  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalDeductions = depositReceived + amountPaid;
  const balanceDue = subtotal - totalDeductions;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Invoice #{invoiceNumber}</h1>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          <button 
            onClick={() => window.open(`/invoice/view?invoiceId=${invoiceId}`, '_blank')}
            style={{...styles.button, background: '#10b981'}}
          >
            👁️ Preview/Print
          </button>
          <button 
            onClick={() => navigate(`/invoice/detailed-report?invoiceId=${invoiceId}`)}
            style={{...styles.button, background: '#8b5cf6'}}
          >
            📊 Detailed Report
          </button>
          <button 
            onClick={handleSendEmail} 
            disabled={sending}
            style={{...styles.button, background: '#3b82f6', opacity: sending ? 0.6 : 1}}
          >
            {sending ? '📧 Sending...' : '📧 Email Invoice'}
          </button>
          <button onClick={handleSave} style={{...styles.button, background: BRAND.accent}}>
            💾 Save Changes
          </button>
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            ← Back
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Invoice Details Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Invoice Details</h2>
          
          <div style={styles.grid2}>
            <div style={styles.field}>
              <label style={styles.label}>Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={styles.input}
                placeholder="customer@example.com"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial Payment</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Amount Paid</label>
              <input
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{...styles.input, minHeight: 80}}
              placeholder="Additional notes or payment terms..."
            />
          </div>
        </div>

        {/* Deposit Selection Card - Only show if deposits available and not yet applied */}
        {availableDeposits.length > 0 && depositReceived === 0 && showDepositSelection && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>💰 Apply Deposits to Invoice</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Select deposits received for this project to apply to this invoice:
            </p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20}}>
              {availableDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  onClick={() => {
                    const newSelected = new Set(selectedDeposits);
                    if (newSelected.has(deposit.id)) {
                      newSelected.delete(deposit.id);
                    } else {
                      newSelected.add(deposit.id);
                    }
                    setSelectedDeposits(newSelected);
                  }}
                  style={{
                    ...styles.depositOption,
                    backgroundColor: selectedDeposits.has(deposit.id) ? '#e0f2fe' : '#f9fafb',
                    border: selectedDeposits.has(deposit.id) ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <input
                      type="checkbox"
                      checked={selectedDeposits.has(deposit.id)}
                      readOnly
                      style={{width: 20, height: 20, cursor: 'pointer'}}
                    />
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4}}>
                        Deposit - {new Date(deposit.deposit_date).toLocaleDateString()}
                      </div>
                      {deposit.reference_notes && (
                        <div style={{fontSize: 13, color: '#666'}}>
                          {deposit.reference_notes}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize: 20, fontWeight: 'bold', color: BRAND.accent}}>
                      ${deposit.deposit_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedDeposits.size > 0 && (
              <div style={{marginBottom: 16, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
                  <span style={{fontSize: 14, color: '#666'}}>Selected Deposits:</span>
                  <span style={{fontSize: 18, fontWeight: 'bold', color: BRAND.accent}}>
                    ${Array.from(selectedDeposits).reduce((sum, id) => {
                      const dep = availableDeposits.find(d => d.id === id);
                      return sum + (dep?.deposit_amount || 0);
                    }, 0).toFixed(2)}
                  </span>
                </div>
                
                <div style={{marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 6, borderLeft: '3px solid #3b82f6'}}>
                  <label style={{fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, display: 'block'}}>
                    Processing Fee (Optional)
                    <span style={{fontSize: 12, fontWeight: 'normal', color: '#666', marginLeft: 8}}>
                      Fee charged by payment processor
                    </span>
                  </label>
                  <input
                    type="number"
                    value={depositFee}
                    onChange={(e) => setDepositFee(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: 15,
                      border: '2px solid #d1d5db',
                      borderRadius: 6,
                      boxSizing: 'border-box'
                    }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  {depositFee > 0 && (
                    <div style={{marginTop: 8, fontSize: 13, color: '#0369a1', fontWeight: '600'}}>
                      💰 Net Deposit: ${(Array.from(selectedDeposits).reduce((sum, id) => {
                        const dep = availableDeposits.find(d => d.id === id);
                        return sum + (dep?.deposit_amount || 0);
                      }, 0) - depositFee).toFixed(2)}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleApplyDeposits}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: '600'
                  }}
                >
                  ✅ Apply Selected Deposits
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowDepositSelection(false)}
              style={{
                width: '100%',
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: '2px solid #d1d5db',
                color: '#666',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: '600'
              }}
            >
              Skip for Now
            </button>
          </div>
        )}

        {/* Change Order Selection Card - Only show if coId parameter exists */}
        {coId && changeOrder && invoiceItems.length === 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Add Change Order to Invoice</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Select the change order to add to this invoice:
            </p>
            
            <div 
              onClick={handleAddChangeOrder}
              style={{
                ...styles.changeOrderOption,
                backgroundColor: changeOrderSelected ? '#e0f2fe' : '#f9fafb',
                border: changeOrderSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                cursor: changeOrderSelected ? 'not-allowed' : 'pointer',
                opacity: changeOrderSelected ? 0.6 : 1,
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <input
                  type="checkbox"
                  checked={changeOrderSelected}
                  disabled={changeOrderSelected}
                  readOnly
                  style={{width: 20, height: 20, cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4}}>
                    {changeOrder.change_order_number}: {changeOrder.title}
                  </div>
                  {changeOrder.description && (
                    <div style={{fontSize: 13, color: '#666'}}>
                      {changeOrder.description}
                    </div>
                  )}
                </div>
                <div style={{fontSize: 20, fontWeight: 'bold', color: BRAND.accent}}>
                  ${(changeOrder.total || 0).toFixed(2)}
                </div>
              </div>
            </div>
            
            {changeOrderSelected && (
              <div style={{marginTop: 16, padding: 12, backgroundColor: '#d1fae5', borderRadius: 6, color: '#065f46', fontSize: 14}}>
                ✅ Change order added to invoice!
              </div>
            )}
          </div>
        )}

        {/* Line Items Card */}
        <div style={styles.card}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <h2 style={styles.cardTitle}>Line Items</h2>
            {!(notes && notes.includes('Progress billing')) && (
              <button onClick={handleAddItem} style={styles.addButton}>
                + Add Item
              </button>
            )}
          </div>

          {/* Editable Line Items Table - Only for regular invoices */}
          {!(notes && notes.includes('Progress billing')) && (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <div style={{...styles.th, flex: 3}}>Description</div>
                <div style={{...styles.th, flex: 0.8}}>Quantity</div>
                <div style={{...styles.th, flex: 0.8}}>Unit Price</div>
                <div style={{...styles.th, flex: 0.8}}>Total</div>
                <div style={{...styles.th, flex: 0.7}}>Markup %</div>
                <div style={{...styles.th, flex: 0.8}}>W/ Markup</div>
                <div style={{...styles.th, width: 60}}>Actions</div>
              </div>

              {invoiceItems.map((item) => {
                const baseUnitPrice = item.unit_price || 0;
                const quantity = item.quantity || 0;
                const baseTotal = item.total || 0;
                const markupPercent = itemMarkups[item.id] || 0;
                
                // Calculate unit price WITH markup applied
                const markedUpUnitPrice = baseUnitPrice * (1 + markupPercent / 100);
                
                // Calculate extended cost with markup
                const totalWithMarkup = quantity * markedUpUnitPrice;
                
                return (
                  <div key={item.id} style={styles.tableRow}>
                    <div style={{flex: 3}}>
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                        style={styles.cellInput}
                      />
                    </div>
                    <div style={{flex: 0.8}}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity || 0}
                        onChange={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                        style={styles.cellInput}
                      />
                    </div>
                    <div style={{flex: 0.8}}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price || 0}
                        onChange={(e) => handleUpdateItem(item.id, "unit_price", e.target.value)}
                        style={styles.cellInput}
                      />
                    </div>
                    <div style={{flex: 0.8, padding: '8px', fontWeight: '600', textAlign: 'right'}}>
                      ${baseTotal.toFixed(2)}
                    </div>
                    <div style={{flex: 0.7}}>
                      <input
                        type="number"
                        step="1"
                        value={markupPercent}
                        onChange={(e) => setItemMarkups({
                          ...itemMarkups,
                          [item.id]: parseFloat(e.target.value) || 0
                        })}
                        style={{...styles.cellInput, textAlign: 'center'}}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div style={{flex: 0.8, padding: '8px', fontWeight: '600', color: BRAND.accent, textAlign: 'right'}}>
                      {markupPercent > 0 ? (
                        <>
                          <div style={{fontSize: 12, color: '#666', marginBottom: 4}}>
                            @ ${markedUpUnitPrice.toFixed(2)}
                          </div>
                          <div>${totalWithMarkup.toFixed(2)}</div>
                        </>
                      ) : (
                        `$${baseTotal.toFixed(2)}`
                      )}
                    </div>
                    <div style={{width: 60}}>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={styles.deleteButton}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {/* Daily Breakdown Section - Only for labor items */}
                    {item.description?.toLowerCase().includes("labor") && (
                      <div style={{gridColumn: '1 / -1', marginTop: 16, paddingTop: 16, borderTop: '2px solid #e5e7eb'}}>
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedItems);
                            if (newExpanded.has(item.id)) {
                              newExpanded.delete(item.id);
                            } else {
                              newExpanded.add(item.id);
                            }
                            setExpandedItems(newExpanded);
                          }}
                          style={{
                            ...styles.expandButton,
                            backgroundColor: expandedItems.has(item.id) ? '#3b82f6' : '#e5e7eb',
                            color: expandedItems.has(item.id) ? '#fff' : '#111'
                          }}
                        >
                          {expandedItems.has(item.id) ? '▼' : '▶'} Daily Breakdown ({Object.keys(dailyBreakdowns[item.id] || {}).length} days)
                        </button>
                        
                        {/* Daily Breakdown Editor */}
                        {expandedItems.has(item.id) && (
                          <div style={{marginTop: 16, padding: 16, backgroundColor: '#f0f7ff', borderRadius: 8, border: '2px solid #3b82f6'}}>
                            {/* Existing daily entries - More compact layout */}
                            {dailyBreakdowns[item.id] && Object.entries(dailyBreakdowns[item.id]).map(([date, data]) => (
                              <div key={date} style={{marginBottom: 12, padding: 12, backgroundColor: '#fff', borderRadius: 6, border: '1px solid #d1d5db', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr', gap: 12, alignItems: 'center'}}>
                                <div style={{gridColumn: '1 / -1', marginBottom: 8}}>
                                  <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr', gap: 12, alignItems: 'flex-end'}}>
                                    <div>
                                      <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 4}}>Date</label>
                                      <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                          const newBreakdown = {...(dailyBreakdowns[item.id] || {})};
                                          const oldData = newBreakdown[date];
                                          delete newBreakdown[date];
                                          newBreakdown[e.target.value] = oldData;
                                          setDailyBreakdowns({...dailyBreakdowns, [item.id]: newBreakdown});
                                        }}
                                        style={{...styles.cellInput, width: '100%'}}
                                      />
                                    </div>
                                    <div>
                                      <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 4}}>Hours</label>
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={data.hours || 0}
                                        onChange={(e) => {
                                          const newBreakdown = {...(dailyBreakdowns[item.id] || {})};
                                          newBreakdown[date].hours = parseFloat(e.target.value) || 0;
                                          setDailyBreakdowns({...dailyBreakdowns, [item.id]: newBreakdown});
                                        }}
                                        style={{...styles.cellInput, width: '100%'}}
                                      />
                                    </div>
                                    <div style={{textAlign: 'center', fontSize: 12, color: '#666', fontWeight: '600'}}>
                                      ${((data.hours || 0) * (item.unit_price || 0)).toFixed(2)}
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newBreakdown = {...(dailyBreakdowns[item.id] || {})};
                                        delete newBreakdown[date];
                                        setDailyBreakdowns({...dailyBreakdowns, [item.id]: newBreakdown});
                                      }}
                                      style={{...styles.deleteButton, width: '100%', padding: '6px'}}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                                {data.notes && (
                                  <div style={{gridColumn: '1 / -1', fontSize: 12, color: '#666', fontStyle: 'italic', padding: 8, backgroundColor: '#fffbeb', borderRadius: 4, borderLeft: '3px solid #f59e0b'}}>
                                    💬 {data.notes}
                                  </div>
                                )}
                                <textarea
                                  value={data.notes || ''}
                                  onChange={(e) => {
                                    const newBreakdown = {...(dailyBreakdowns[item.id] || {})};
                                    newBreakdown[date].notes = e.target.value;
                                    setDailyBreakdowns({...dailyBreakdowns, [item.id]: newBreakdown});
                                  }}
                                  style={{
                                    ...styles.cellInput,
                                    gridColumn: '1 / -1',
                                    width: '100%',
                                    minHeight: 40,
                                    resize: 'vertical'
                                  }}
                                  placeholder="Notes (optional)..."
                                />
                              </div>
                            ))}
                            
                            {/* Add new daily entry button */}
                            <button
                              onClick={() => {
                                const newDate = new Date().toISOString().split('T')[0];
                                const newBreakdown = dailyBreakdowns[item.id] || {};
                                newBreakdown[newDate] = { hours: 0, notes: '' };
                                setDailyBreakdowns({...dailyBreakdowns, [item.id]: newBreakdown});
                              }}
                              style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                color: '#fff',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: '600'
                              }}
                            >
                              + Add Daily Entry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Billing Summary Table - Only for progress billing invoices */}
          {notes && notes.includes('Progress billing') && (
            <div style={{marginTop: 32, marginBottom: 24}}>
              <h3 style={{fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#111'}}>
                Progress Billing Summary
              </h3>
              <div style={{overflowX: 'auto'}}>
                <table style={styles.summaryTable}>
                  <thead>
                    <tr style={styles.summaryHeaderRow}>
                      <th style={{...styles.summaryTh, textAlign: 'left'}}>Item Description</th>
                      <th style={styles.summaryTh}>Original Amount</th>
                      <th style={styles.summaryTh}>This Invoice</th>
                      <th style={styles.summaryTh}>% Billed</th>
                      <th style={styles.summaryTh}>Previously Billed</th>
                      <th style={styles.summaryTh}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item) => {
                      // Parse the detailed description to extract values
                      const desc = item.description || "";
                      const lines = desc.split('\n');
                      const itemName = lines[0];
                      
                      // Extract values from description
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
                        <tr key={item.id} style={styles.summaryRow}>
                          <td style={{...styles.summaryTd, textAlign: 'left', fontWeight: '600'}}>{itemName}</td>
                          <td style={styles.summaryTd}>${original.toFixed(2)}</td>
                          <td style={{...styles.summaryTd, color: BRAND.accent, fontWeight: '600'}}>${thisInvoice.toFixed(2)}</td>
                          <td style={styles.summaryTd}>{percent.toFixed(1)}%</td>
                          <td style={styles.summaryTd}>${previouslyBilled.toFixed(2)}</td>
                          <td style={styles.summaryTd}>${remaining.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div style={styles.totals}>
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Subtotal (Base):</span>
              <span style={styles.totalValue}>${subtotal.toFixed(2)}</span>
            </div>
            
            {/* Show markups if any exist */}
            {Object.values(itemMarkups).some(m => m > 0) && (
              <>
                {/* Individual markup breakdown */}
                {invoiceItems.map((item) => {
                  const baseTotal = item.total || 0;
                  const markupPercent = itemMarkups[item.id] || 0;
                  const markupAmount = baseTotal * (markupPercent / 100);
                  
                  if (markupAmount > 0) {
                    return (
                      <div key={`markup-${item.id}`} style={{...styles.totalRow, paddingLeft: 20, fontSize: 14}}>
                        <span style={styles.totalLabel}>
                          Markup ({markupPercent}%) - {item.description}:
                        </span>
                        <span style={{...styles.totalValue, color: BRAND.accent}}>
                          +${markupAmount.toFixed(2)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
                
                {/* Total markup */}
                <div style={{...styles.totalRow, paddingLeft: 0, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8}}>
                  <span style={{...styles.totalLabel, fontWeight: 'bold'}}>Total Markup:</span>
                  <span style={{...styles.totalValue, color: BRAND.accent, fontWeight: 'bold'}}>
                    +${Object.keys(itemMarkups).reduce((sum, itemId) => {
                      const item = invoiceItems.find(i => i.id === itemId);
                      if (!item) return sum;
                      const baseTotal = item.total || 0;
                      const markupPercent = itemMarkups[itemId] || 0;
                      const markupAmount = baseTotal * (markupPercent / 100);
                      return sum + markupAmount;
                    }, 0).toFixed(2)}
                  </span>
                </div>
                
                {/* Subtotal with markup */}
                <div style={{...styles.totalRow, borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 12}}>
                  <span style={{...styles.totalLabel, fontWeight: 'bold', fontSize: 16}}>Total with Markup:</span>
                  <span style={{...styles.totalValue, fontWeight: 'bold', fontSize: 18, color: BRAND.accent}}>
                    ${(subtotal + Object.keys(itemMarkups).reduce((sum, itemId) => {
                      const item = invoiceItems.find(i => i.id === itemId);
                      if (!item) return sum;
                      const baseTotal = item.total || 0;
                      const markupPercent = itemMarkups[itemId] || 0;
                      const markupAmount = baseTotal * (markupPercent / 100);
                      return sum + markupAmount;
                    }, 0)).toFixed(2)}
                  </span>
                </div>
              </>
            )}
            
            {depositReceived > 0 && (
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>
                  Deposit Received {depositDate && `(${depositDate})`}:
                </span>
                <span style={{...styles.totalValue, color: '#10b981', fontWeight: 'bold'}}>
                  -${depositReceived.toFixed(2)}
                </span>
              </div>
            )}
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Amount Paid:</span>
              <span style={{...styles.totalValue, color: '#10b981'}}>
                ${amountPaid.toFixed(2)}
              </span>
            </div>
            <div style={{...styles.totalRow, borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 12}}>
              <span style={{...styles.totalLabel, fontSize: 20, fontWeight: 'bold'}}>Balance Due:</span>
              <span style={{...styles.totalValue, fontSize: 24, fontWeight: 'bold', color: balanceDue > 0 ? '#ef4444' : '#10b981'}}>
                ${(Object.values(itemMarkups).some(m => m > 0) 
                  ? (subtotal + Object.keys(itemMarkups).reduce((sum, itemId) => {
                      const item = invoiceItems.find(i => i.id === itemId);
                      if (!item) return sum;
                      const baseTotal = item.total || 0;
                      const markupPercent = itemMarkups[itemId] || 0;
                      const markupAmount = baseTotal * (markupPercent / 100);
                      return sum + markupAmount;
                    }, 0)) - totalDeductions
                  : balanceDue
                ).toFixed(2)}
              </span>
            </div>
          </div>
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
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
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
  button: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
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
    marginBottom: 24,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
  },
  dateInput: {
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    width: "100%",
    boxSizing: "border-box",
    colorScheme: "light",
  },
  addButton: {
    padding: "10px 20px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    display: "flex",
    gap: 12,
    padding: "12px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  th: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "flex",
    gap: 12,
    padding: "8px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  cellInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
  },
  deleteButton: {
    padding: "6px 10px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    borderRadius: 4,
  },
  totals: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: "#666",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
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
  summaryTable: {
    width: "100%",
    borderCollapse: "collapse",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  summaryHeaderRow: {
    backgroundColor: "#f3f4f6",
  },
  summaryTh: {
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    textAlign: "right",
    borderBottom: "2px solid #e5e7eb",
  },
  summaryRow: {
    borderBottom: "1px solid #e5e7eb",
  },
  summaryTd: {
    padding: "12px 16px",
    fontSize: 14,
    color: "#111",
    textAlign: "right",
  },
  changeOrderOption: {
    padding: 16,
    borderRadius: 8,
    transition: "all 0.2s",
  },
  depositOption: {
    padding: 16,
    borderRadius: 8,
    transition: "all 0.2s",
  },
  expandButton: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: '600',
    transition: 'all 0.2s',
  },
};

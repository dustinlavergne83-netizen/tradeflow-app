





import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSiteUrl, isLocalhost } from "../lib/siteUrl";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { createInvoiceJournalEntry } from "../utils/accountingJournals";

import { formatDate } from "../utils/dateUtils";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

export default function Invoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const projectId = searchParams.get("projectId");
  const invoiceType = searchParams.get("type"); // "tm" for Time & Materials
  const depositAppliedParam = parseFloat(searchParams.get("depositApplied")) || 0;
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
  
  // Local editing state for line items (prevents DB call on every keystroke)
  const [localItems, setLocalItems] = useState([]);
  
  // Progress billing state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [itemBillingAmounts, setItemBillingAmounts] = useState({});
  const [editingDraw, setEditingDraw] = useState(false);
  const [editDrawAmount, setEditDrawAmount] = useState("");
  const [editDrawPercent, setEditDrawPercent] = useState("");
  const [savingDraw, setSavingDraw] = useState(false);
  
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
  
  // Guard against React StrictMode double-mount creating duplicate invoices
  const creatingRef = useRef(false);

  useEffect(() => {
    if (invoiceId) {
      console.log("🔵 Loading invoice:", invoiceId);
      loadInvoice();
    } else if (projectId && !creatingRef.current) {
      // Auto-create a new draft invoice for this project
      creatingRef.current = true;
      createInvoiceForProject();
    } else {
      // No invoiceId and no projectId - nothing to load
      setLoading(false);
    }
    if (coId) {
      loadChangeOrder();
    }
  }, [invoiceId, coId, projectId]);

  async function createInvoiceForProject() {
    try {
      // Load project data
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projErr || !proj) {
        alert("Project not found");
        setLoading(false);
        return;
      }

      // Get next invoice number
      const { data: lastInv } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("invoice_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1001;
      if (lastInv?.invoice_number) {
        const parsed = parseInt(lastInv.invoice_number);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }

      const today = new Date().toISOString().split("T")[0];

      // Create the invoice with minimal columns
      let newInvoice = null;
      let createErr = null;

      // Look up customer email
      let custEmail = "";
      const customerName = proj.contractor || proj.customer || "";
      if (customerName) {
        const { data: custData } = await supabase
          .from("customers")
          .select("email")
          .eq("customer", customerName)
          .maybeSingle();
        if (custData?.email) custEmail = custData.email;
      }

      const isTM = invoiceType === "tm";

      // Create the invoice
      const result = await supabase
        .from("invoices")
        .insert([{
          invoice_number: String(nextNum),
          customer_name: customerName,
          customer_email: custEmail,
          invoice_date: today,
          status: "draft",
          project_name: proj.name,
          notes: isTM ? "Time & Materials Invoice" : "",
          subtotal: 0,
          total: 0,
          amount_paid: 0,
          balance_due: 0,
          created_by: user.id,
        }])
        .select()
        .single();
      
      newInvoice = result.data;
      createErr = result.error;

      if (createErr) {
        console.error("Error creating invoice:", createErr);
        alert("Failed to create invoice: " + createErr.message);
        setLoading(false);
        return;
      }

      // If T&M invoice, load unbilled labor and materials and create invoice items
      if (isTM && newInvoice) {
        console.log("⏱️ Creating T&M invoice - loading unbilled items...");
        
        // Load unbilled time entries (shift_segments for this project)
        // Query by BOTH project_id AND project_task name to catch all entries
        const { data: timeByIdData } = await supabase
          .from("shift_segments")
          .select("id, user_id, start_at, end_at, project_task")
          .eq("project_id", projectId)
          .not("end_at", "is", null)
          .order("start_at", { ascending: true });

        const { data: timeByNameData } = await supabase
          .from("shift_segments")
          .select("id, user_id, start_at, end_at, project_task")
          .ilike("project_task", `%${proj.name}%`)
          .not("end_at", "is", null)
          .order("start_at", { ascending: true });

        // Merge and deduplicate
        const seenIds = new Set();
        const timeData = [];
        [...(timeByIdData || []), ...(timeByNameData || [])].forEach(seg => {
          if (!seenIds.has(seg.id)) {
            seenIds.add(seg.id);
            timeData.push(seg);
          }
        });
        console.log(`⏱️ Found ${timeData.length} time entries (${(timeByIdData||[]).length} by ID, ${(timeByNameData||[]).length} by name)`);

        // Load unbilled expenses
        const { data: expenseData1 } = await supabase
          .from("project_expenses")
          .select("*")
          .eq("project_id", projectId)
          .order("expense_date");

        const { data: expenseData2 } = await supabase
          .from("expenses")
          .select("*")
          .eq("project_id", projectId)
          .order("expense_date");

        const allExpenses = [...(expenseData1 || []), ...(expenseData2 || [])];

        const invoiceItemsToCreate = [];
        const laborRate = proj.labor_rate || 50;

        // Fetch employee names for time entries
        const uniqueUserIds = [...new Set((timeData || []).map(e => e.user_id).filter(Boolean))];
        let employeeMap = {};
        if (uniqueUserIds.length > 0) {
          const { data: empData } = await supabase
            .from("employees")
            .select("user_id, first_name, last_name")
            .in("user_id", uniqueUserIds);
          if (empData) {
            empData.forEach(emp => { employeeMap[emp.user_id] = emp; });
          }
        }

        // Calculate TOTAL labor hours and build detail breakdown
        let totalLaborHours = 0;
        const laborDetails = [];
        const employeeHours = {};
        (timeData || []).forEach(seg => {
          const emp = employeeMap[seg.user_id];
          const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
          if (!employeeHours[empName]) employeeHours[empName] = { hours: 0, entries: [] };
          const start = new Date(seg.start_at);
          const end = new Date(seg.end_at);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          employeeHours[empName].hours += hours;
          employeeHours[empName].entries.push({
            date: start.toISOString().split('T')[0],
            hours: parseFloat(hours.toFixed(2)),
            clockIn: start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            clockOut: end.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
          });
          totalLaborHours += hours;
        });

        // Build labor detail JSON for attachment page
        for (const [empName, data] of Object.entries(employeeHours)) {
          laborDetails.push({
            employee: empName,
            totalHours: parseFloat(data.hours.toFixed(2)),
            rate: laborRate,
            total: parseFloat((data.hours * laborRate).toFixed(2)),
            entries: data.entries,
          });
        }

        const totalLaborCost = parseFloat((totalLaborHours * laborRate).toFixed(2));

        // Calculate TOTAL materials cost and build detail breakdown
        const totalMaterialsCost = allExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const materialDetails = allExpenses.map(exp => ({
          description: exp.description || "Expense",
          vendor: exp.vendor || "No vendor",
          date: exp.expense_date,
          amount: exp.amount || 0,
        }));

        // Create just 2 summary line items: Labor & Materials
        if (totalLaborCost > 0) {
          invoiceItemsToCreate.push({
            invoice_id: newInvoice.id,
            description: "Labor",
            quantity: parseFloat(totalLaborHours.toFixed(2)),
            unit_price: laborRate,
            total: totalLaborCost,
            daily_breakdown: JSON.stringify({ laborDetails }),
          });
        }

        if (totalMaterialsCost > 0) {
          invoiceItemsToCreate.push({
            invoice_id: newInvoice.id,
            description: "Materials & Expenses",
            quantity: 1,
            unit_price: totalMaterialsCost,
            total: totalMaterialsCost,
            daily_breakdown: JSON.stringify({ materialDetails }),
          });
        }

        // Insert all invoice items
        if (invoiceItemsToCreate.length > 0) {
          let { error: itemsErr } = await supabase
            .from("invoice_items")
            .insert(invoiceItemsToCreate);

          // If insert fails (likely missing daily_breakdown column), retry without it
          if (itemsErr) {
            console.warn("⚠️ First insert failed, retrying without daily_breakdown:", itemsErr.message);
            const itemsWithoutBreakdown = invoiceItemsToCreate.map(({ daily_breakdown, ...rest }) => rest);
            const retryResult = await supabase
              .from("invoice_items")
              .insert(itemsWithoutBreakdown);
            itemsErr = retryResult.error;
            if (itemsErr) {
              console.error("❌ Retry also failed:", itemsErr);
            }
          }

          if (!itemsErr) {
            // Update invoice totals
            const totalAmount = invoiceItemsToCreate.reduce((sum, i) => sum + i.total, 0);
            await supabase
              .from("invoices")
              .update({ subtotal: totalAmount, total: totalAmount, balance_due: totalAmount })
              .eq("id", newInvoice.id);
            console.log(`✅ Created ${invoiceItemsToCreate.length} T&M invoice items, total: $${totalAmount.toFixed(2)}`);
          }
        }
      }

      // If deposits were applied from ProjectDetail, link them to this invoice
      if (depositAppliedParam > 0 && newInvoice) {
        console.log("💰 Linking deposits from ProjectDetail, amount:", depositAppliedParam);
        
        // Update invoice with deposit amount
        await supabase
          .from("invoices")
          .update({ deposit_received: depositAppliedParam })
          .eq("id", newInvoice.id);
        
        // Find deposits that were marked as applied with null invoice_id (from ProjectDetail)
        const { data: appliedDeposits } = await supabase
          .from("project_deposits")
          .select("id")
          .eq("project_id", projectId)
          .eq("status", "applied")
          .is("invoice_id", null);
        
        if (appliedDeposits && appliedDeposits.length > 0) {
          const depositIds = appliedDeposits.map(d => d.id);
          await supabase
            .from("project_deposits")
            .update({ invoice_id: newInvoice.id, status: "applied", applied_date: new Date().toISOString() })
            .in("id", depositIds);
          console.log(`✅ Linked ${depositIds.length} deposits to invoice ${newInvoice.id}`);
        }
      }

      // Redirect to the newly created invoice
      navigate(`/invoice?invoiceId=${newInvoice.id}`, { replace: true });
    } catch (err) {
      console.error("Error creating invoice for project:", err);
      alert("Failed to create invoice");
      setLoading(false);
    }
  }
  
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

      // Auto-correct status if payment covers the balance
      const loadedTotal = invoiceData.total || invoiceData.subtotal || 0;
      const loadedPaid = (invoiceData.amount_paid || 0) + (invoiceData.deposit_received || 0);
      if (loadedPaid > 0 && loadedTotal > 0 && (loadedTotal - loadedPaid) <= 0.01 && invoiceData.status !== 'paid') {
        setStatus('paid');
        // Also update DB silently
        supabase.from("invoices").update({ status: 'paid' }).eq("id", invoiceId).then(() => {
          console.log("✅ Auto-corrected invoice status to paid");
        });
      } else if (loadedPaid > 0 && loadedTotal > 0 && (loadedTotal - loadedPaid) > 0.01 && invoiceData.status === 'sent') {
        setStatus('partial');
      }

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
      setLocalItems(itemsData || []);
      
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

  async function handleSaveDrawAmount(contractTotal, prevBilled, drawItem, extraItems) {
    if (savingDraw) return;
    setSavingDraw(true);
    try {
      const newAmount = parseFloat(editDrawAmount) || 0;
      const newPercent = contractTotal > 0 ? ((newAmount + prevBilled) / contractTotal * 100) : 0;
      const newRemaining = contractTotal - prevBilled - newAmount;
      const drawPercent = contractTotal > 0 ? (newAmount / contractTotal * 100) : 0;

      // Update the invoice_item total
      await supabase
        .from("invoice_items")
        .update({ total: newAmount, unit_price: newAmount, quantity: 1 })
        .eq("id", drawItem.id);

      // Update the notes with new values
      const extraTotal = extraItems.reduce((s, i) => s + (i.total || 0), 0);
      const newSubtotal = newAmount + extraTotal;
      const proposalTag = notes.match(/\[PROPOSAL:[^\]]+\]/)?.[0] || "";
      const paymentTerms = notes.match(/Payment Terms: [^|[\]]+/)?.[0] || "";
      const estNum = notes.match(/estimate (\d+)/)?.[1] || "";
      let newNotes = `Progress billing from estimate ${estNum} | This draw: $${newAmount.toFixed(2)} (${drawPercent.toFixed(1)}% of $${contractTotal.toFixed(2)}) | Previously billed: $${prevBilled.toFixed(2)} | Remaining after this: $${newRemaining.toFixed(2)}`;
      if (paymentTerms) newNotes += ` | ${paymentTerms}`;
      if (proposalTag) newNotes += ` | ${proposalTag}`;
      setNotes(newNotes);

      // Update invoice totals
      const totalDeductions = depositReceived + amountPaid;
      const balanceDue = newSubtotal - totalDeductions;
      await supabase
        .from("invoices")
        .update({
          notes: newNotes,
          subtotal: newSubtotal,
          total: newSubtotal,
          balance_due: balanceDue,
        })
        .eq("id", invoiceId);

      setEditingDraw(false);
      alert("✅ Draw amount updated successfully!");
      loadInvoice();
    } catch (err) {
      console.error("Error saving draw amount:", err);
      alert("Failed to save: " + (err.message || err));
    } finally {
      setSavingDraw(false);
    }
  }

  async function handleSave(options = {}) {
    const { silent = false } = options;
    try {
      const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
      
      // Calculate total markup
      const totalMarkup = Object.keys(itemMarkups).reduce((sum, itemId) => {
        const item = invoiceItems.find(i => i.id === itemId);
        if (!item) return sum;
        const baseTotal = item.total || 0;
        const markupPercent = itemMarkups[itemId] || 0;
        return sum + (baseTotal * (markupPercent / 100));
      }, 0);
      
      // Total includes markup
      const totalWithMarkup = subtotal + totalMarkup;
      
      // Balance due accounts for markup, deposits, AND amount paid
      const totalDeductions = depositReceived + amountPaid;
      const balanceDue = totalWithMarkup - totalDeductions;

      // Auto-update status based on payment
      let saveStatus = status;
      if (amountPaid > 0 && balanceDue <= 0.01 && status !== 'paid') {
        saveStatus = 'paid';
        setStatus('paid');
      } else if (amountPaid > 0 && balanceDue > 0.01 && (status === 'sent' || status === 'draft')) {
        saveStatus = 'partial';
        setStatus('partial');
      }

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

      // Delete any existing journal entries for this invoice BEFORE saving
      // This prevents the DB trigger from failing on duplicate journal entry keys
      try {
        await deleteExistingInvoiceJournalEntries();
      } catch (delErr) {
        console.warn("⚠️ Could not clean up journal entries before save:", delErr);
      }

      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          status: saveStatus,
          notes: notes,
          subtotal: subtotal,
          total: totalWithMarkup,
          amount_paid: amountPaid,
          deposit_received: depositReceived,
          balance_due: balanceDue,
        })
        .eq("id", invoiceId);

      if (error) {
        // If the error is from a DB trigger (journal entry duplicate), the invoice was still saved
        if (error.message && error.message.includes('journal_entries')) {
          console.warn("⚠️ Invoice saved but journal entry trigger had a conflict:", error.message);
        } else {
          throw error;
        }
      }
      
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
      if (!silent) {
        alert("Invoice saved successfully!");
      }
      if (!silent) {
        loadInvoice();
      }
    } catch (err) {
      console.error("Error saving invoice:", err);
      if (!silent) {
        alert("Failed to save invoice: " + (err.message || JSON.stringify(err)));
      }
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
      // First, save the invoice (silent to avoid loadInvoice race condition)
      await handleSave({ silent: true });

      const subtotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
      
      // Calculate markup for email
      const totalMarkupForEmail = Object.keys(itemMarkups).reduce((sum, itemId) => {
        const item = invoiceItems.find(i => i.id === itemId);
        if (!item) return sum;
        return sum + ((item.total || 0) * ((itemMarkups[itemId] || 0) / 100));
      }, 0);
      const totalWithMarkupForEmail = subtotal + totalMarkupForEmail;
      const totalDeductionsForEmail = depositReceived + amountPaid;
      const balanceDueForEmail = totalWithMarkupForEmail - totalDeductionsForEmail;

      // Build markup details for each item
      const markupDetails = invoiceItems.map(item => ({
        description: item.description,
        baseTotal: item.total || 0,
        markupPercent: itemMarkups[item.id] || 0,
        markupAmount: (item.total || 0) * ((itemMarkups[item.id] || 0) / 100),
      })).filter(m => m.markupPercent > 0);

      // Parse daily breakdowns for detailed email
      const detailedItems = invoiceItems.map(item => {
        let laborDetails = [];
        let materialDetails = [];
        try {
          const parsed = item.daily_breakdown ? JSON.parse(item.daily_breakdown) : null;
          if (parsed?.laborDetails) laborDetails = parsed.laborDetails;
          if (parsed?.materialDetails) materialDetails = parsed.materialDetails;
        } catch(e) {}
        return {
          ...item,
          laborDetails,
          materialDetails,
          markupPercent: itemMarkups[item.id] || 0,
        };
      });

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: {
          invoiceId: invoiceId,
          siteUrl: getSiteUrl(),
          to: customerEmail,
          customerName: customerName,
          invoiceNumber: invoiceNumber,
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          lineItems: detailedItems,
          subtotal: subtotal,
          totalMarkup: totalMarkupForEmail,
          totalWithMarkup: totalWithMarkupForEmail,
          depositReceived: depositReceived,
          amountPaid: amountPaid,
          balanceDue: balanceDueForEmail,
          markupDetails: markupDetails,
          notes: notes
        }
      });

      console.log("Edge Function Response:", { data, error });

      if (error) {
        console.error("Edge Function Error Details:", error);
        // Try to read the actual error body from the response context
        let errorMessage = error.message || JSON.stringify(error);
        try {
          if (error.context) {
            const errBody = await error.context.json();
            console.error("Edge Function Error Body:", errBody);
            if (errBody?.error) errorMessage = errBody.error;
            if (errBody?.details) errorMessage += '\nDetails: ' + errBody.details;
          }
        } catch (parseErr) {
          console.log("Could not parse error body:", parseErr);
        }
        throw new Error(errorMessage);
      }

      if (data && data.error) {
        console.error("Edge Function returned error:", data);
        throw new Error(data.error || "Unknown error from Edge Function");
      }

      // Email sent successfully! Now handle status update and journal entry separately
      let emailSent = true;

      // Update invoice status to 'sent'
      try {
        await supabase
          .from("invoices")
          .update({ status: 'sent' })
          .eq("id", invoiceId);
        setStatus('sent');
      } catch (statusErr) {
        console.error("Error updating status:", statusErr);
      }

      // Try to create journal entry (don't let failures affect the success message)
      try {
        await deleteExistingInvoiceJournalEntries();

        const { data: updatedInvoice } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (updatedInvoice) {
          const journalResult = await createInvoiceJournalEntry(
            updatedInvoice,
            user.id,
            user.id
          );

          if (!journalResult.success) {
            console.warn("⚠️ Journal entry creation failed:", journalResult.error);
          } else {
            console.log("✅ Journal entry created successfully");
          }
        }
      } catch (journalErr) {
        console.warn("⚠️ Journal entry error (invoice still sent):", journalErr.message);
      }

      alert(`✅ Invoice #${invoiceNumber} sent successfully to ${customerEmail}!`);
      
      // Reload invoice to reflect the updated status
      loadInvoice();
    } catch (err) {
      console.error("Error sending invoice:", err);
      alert(`Failed to send invoice: ${err.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  }

  // Update local display state only (no DB call) — called on every keystroke
  function handleLocalItemChange(itemId, field, value) {
    setLocalItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      // Recalculate total live as user types
      if (field === "quantity" || field === "unit_price") {
        const qty = field === "quantity" ? parseFloat(value) : parseFloat(item.quantity);
        const price = field === "unit_price" ? parseFloat(value) : parseFloat(item.unit_price);
        updated.total = (!isNaN(qty) && !isNaN(price)) ? qty * price : item.total;
      }
      return updated;
    }));
  }

  // Save to DB only when the user leaves the field (onBlur)
  async function handleUpdateItem(itemId, field, value) {
    try {
      // Ignore empty / incomplete values — don't save
      if (value === "" || value === null || value === undefined) return;
      
      const numericFields = ["quantity", "unit_price"];
      if (numericFields.includes(field)) {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) return; // Don't save NaN
      }

      const updates = { [field]: value };
      
      // If quantity or unit_price changed, recalculate total
      const item = localItems.find(i => i.id === itemId) || invoiceItems.find(i => i.id === itemId);
      if (field === "quantity" || field === "unit_price") {
        const qty = field === "quantity" ? parseFloat(value) : parseFloat(item.quantity);
        const price = field === "unit_price" ? parseFloat(value) : parseFloat(item.unit_price);
        if (!isNaN(qty) && !isNaN(price)) {
          updates.total = qty * price;
        }
      }

      const { error } = await supabase
        .from("invoice_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;
      
      loadInvoice();
    } catch (err) {
      console.error("Error updating item:", err);
      alert("Failed to update item: " + (err.message || err));
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
          {(status === 'paid') && (
            <button 
              onClick={async () => {
                await handleSave({ silent: true });
                window.open(`/invoice/receipt?invoiceId=${invoiceId}`, '_blank');
              }}
              style={{...styles.button, background: '#10b981'}}
            >
              🧾 Send Receipt
            </button>
          )}
          <button 
            onClick={async () => {
              await handleSave({ silent: true });
              window.open(`/invoice/view?invoiceId=${invoiceId}`, '_blank');
            }}
            style={{...styles.button, background: '#10b981'}}
          >
            👁️ Preview/Print (with Details)
          </button>
          <button 
            onClick={async () => {
              await handleSave({ silent: true });
              window.open(`/invoice/view?invoiceId=${invoiceId}&print=1`, '_blank');
            }}
            style={{...styles.button, background: '#fff', color: '#0b3ea8', border: '2px solid #fff'}}
          >
            🖨️ Print to PDF
          </button>
          <button 
            onClick={async () => {
              await handleSave({ silent: true });
              navigate(`/invoice/detailed-report?invoiceId=${invoiceId}`);
            }}
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
                        Deposit - {formatDate(deposit.deposit_date)}
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
                <div style={{...styles.th, flex: 0.8}}>Qty</div>
                <div style={{...styles.th, flex: 0.8}}>Cost</div>
                <div style={{...styles.th, flex: 0.7}}>Markup %</div>
                <div style={{...styles.th, flex: 1}}>Total Cost</div>
                <div style={{...styles.th, width: 60}}></div>
              </div>

              {(localItems.length > 0 ? localItems : invoiceItems).map((item) => {
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
                        onChange={(e) => handleLocalItemChange(item.id, "description", e.target.value)}
                        onBlur={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                        style={styles.cellInput}
                      />
                    </div>
                    <div style={{flex: 0.8}}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity ?? ""}
                        onChange={(e) => handleLocalItemChange(item.id, "quantity", e.target.value)}
                        onBlur={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                        style={styles.cellInput}
                      />
                    </div>
                    <div style={{flex: 0.8}}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price ?? ""}
                        onChange={(e) => handleLocalItemChange(item.id, "unit_price", e.target.value)}
                        onBlur={(e) => handleUpdateItem(item.id, "unit_price", e.target.value)}
                        style={styles.cellInput}
                      />
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
                    <div style={{flex: 1, padding: '8px', fontWeight: '600', color: markupPercent > 0 ? BRAND.accent : '#111', textAlign: 'right'}}>
                      ${(markupPercent > 0 ? totalWithMarkup : baseTotal).toFixed(2)}
                    </div>
                    <div style={{width: 60}}>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={styles.deleteButton}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Billing Summary Table - Only for progress billing invoices */}
          {notes && notes.includes('Progress billing') && (() => {
            const drawMatch = notes.match(/This draw: \$([0-9,.]+)/);
            const pctOfMatch = notes.match(/\(([0-9.]+)% of \$([0-9,.]+)\)/);
            const prevNoteMatch = notes.match(/Previously billed: \$([0-9,.]+)/);
            const remainNoteMatch = notes.match(/Remaining after this: \$([0-9,.]+)/);
            const contractTotal = pctOfMatch ? parseFloat(pctOfMatch[2].replace(/,/g, '')) : 0;
            const drawPercent = pctOfMatch ? parseFloat(pctOfMatch[1]) : 0;
            const prevBilled = prevNoteMatch ? parseFloat(prevNoteMatch[1].replace(/,/g, '')) : 0;
            const remainAfter = remainNoteMatch ? parseFloat(remainNoteMatch[1].replace(/,/g, '')) : 0;
            const hasOldFormat = invoiceItems.some(it => (it.description || "").includes('\n') && (it.description || "").includes('Original:'));

            // First item = progress draw. Remaining items = extra line items.
            const drawItems = invoiceItems.slice(0, 1);
            const extraItems = invoiceItems.slice(1);

            return (
            <div style={{marginTop: 32, marginBottom: 24}}>
              <h3 style={{fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#111'}}>
                Progress Billing Summary
              </h3>
              <div style={{overflowX: 'auto'}}>
                <table style={styles.summaryTable}>
                  <thead>
                    <tr style={styles.summaryHeaderRow}>
                      <th style={{...styles.summaryTh, textAlign: 'left'}}>Description</th>
                      <th style={styles.summaryTh}>{hasOldFormat ? 'Original Amount' : 'Contract Value'}</th>
                      <th style={styles.summaryTh}>{hasOldFormat ? 'This Invoice' : 'This Draw'}</th>
                      <th style={styles.summaryTh}>% of Contract</th>
                      <th style={styles.summaryTh}>Previously Billed</th>
                      <th style={styles.summaryTh}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawItems.map((item) => {
                      const desc = item.description || "";
                      const lines = desc.split('\n');
                      const itemName = lines[0];

                      if (hasOldFormat && lines.length > 1) {
                        const detailLine = lines[1];
                        let original = 0, thisInv = 0, pct = 0, prevB = 0, rem = 0;
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
                        return (
                          <tr key={item.id} style={styles.summaryRow}>
                            <td style={{...styles.summaryTd, textAlign: 'left', fontWeight: '600'}}>{itemName}</td>
                            <td style={styles.summaryTd}>${original.toFixed(2)}</td>
                            <td style={{...styles.summaryTd, color: BRAND.accent, fontWeight: '600'}}>${thisInv.toFixed(2)}</td>
                            <td style={styles.summaryTd}>{pct.toFixed(1)}%</td>
                            <td style={styles.summaryTd}>${prevB.toFixed(2)}</td>
                            <td style={styles.summaryTd}>${rem.toFixed(2)}</td>
                          </tr>
                        );
                      }
                      const isNotPaid = status !== 'paid';
                      const currentDrawAmt = editingDraw ? parseFloat(editDrawAmount) || 0 : (item.total || 0);
                      const currentDrawPct = contractTotal > 0 ? (currentDrawAmt / contractTotal * 100) : 0;
                      const currentRemaining = contractTotal - prevBilled - currentDrawAmt;
                      return (
                        <tr key={item.id} style={styles.summaryRow}>
                          <td style={{...styles.summaryTd, textAlign: 'left', fontWeight: '600'}}>{itemName}</td>
                          <td style={styles.summaryTd}>${contractTotal > 0 ? contractTotal.toFixed(2) : (item.total || 0).toFixed(2)}</td>
                          <td style={{...styles.summaryTd, color: BRAND.accent, fontWeight: '600'}}>
                            {editingDraw ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editDrawAmount}
                                onChange={(e) => {
                                  setEditDrawAmount(e.target.value);
                                  if (contractTotal > 0) {
                                    setEditDrawPercent(((parseFloat(e.target.value) || 0) / contractTotal * 100).toFixed(1));
                                  }
                                }}
                                style={{width: 110, padding: '6px 8px', fontSize: 14, border: '2px solid #3b82f6', borderRadius: 6, textAlign: 'right', fontWeight: '600', color: BRAND.accent}}
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => {
                                  if (isNotPaid) {
                                    setEditingDraw(true);
                                    setEditDrawAmount((item.total || 0).toFixed(2));
                                    setEditDrawPercent(drawPercent > 0 ? drawPercent.toFixed(1) : '0.0');
                                  }
                                }}
                                style={{cursor: isNotPaid ? 'pointer' : 'default', borderBottom: isNotPaid ? '2px dashed #3b82f6' : 'none', paddingBottom: 2}}
                                title={isNotPaid ? 'Click to edit draw amount' : ''}
                              >
                                ${(item.total || 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td style={styles.summaryTd}>
                            {editingDraw ? (
                              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2}}>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editDrawPercent}
                                  onChange={(e) => {
                                    setEditDrawPercent(e.target.value);
                                    if (contractTotal > 0) {
                                      setEditDrawAmount(((parseFloat(e.target.value) || 0) / 100 * contractTotal).toFixed(2));
                                    }
                                  }}
                                  style={{width: 70, padding: '6px 8px', fontSize: 14, border: '2px solid #3b82f6', borderRadius: 6, textAlign: 'right'}}
                                />
                                <span>%</span>
                              </div>
                            ) : (
                              <span
                                onClick={() => {
                                  if (isNotPaid) {
                                    setEditingDraw(true);
                                    setEditDrawAmount((item.total || 0).toFixed(2));
                                    setEditDrawPercent(drawPercent > 0 ? drawPercent.toFixed(1) : '0.0');
                                  }
                                }}
                                style={{cursor: isNotPaid ? 'pointer' : 'default', borderBottom: isNotPaid ? '2px dashed #3b82f6' : 'none', paddingBottom: 2}}
                                title={isNotPaid ? 'Click to edit percentage' : ''}
                              >
                                {drawPercent > 0 ? drawPercent.toFixed(1) : '0.0'}%
                              </span>
                            )}
                          </td>
                          <td style={styles.summaryTd}>${prevBilled.toFixed(2)}</td>
                          <td style={styles.summaryTd}>${editingDraw ? currentRemaining.toFixed(2) : remainAfter.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save/Cancel buttons when editing draw */}
              {editingDraw && (
                <div style={{display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end'}}>
                  <button
                    onClick={() => setEditingDraw(false)}
                    style={{padding: '8px 20px', border: '2px solid #d1d5db', background: '#fff', color: '#666', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: '600'}}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveDrawAmount(contractTotal, prevBilled, drawItems[0], extraItems)}
                    disabled={savingDraw}
                    style={{padding: '8px 20px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: '600', opacity: savingDraw ? 0.6 : 1}}
                  >
                    {savingDraw ? '💾 Saving...' : '💾 Save Draw Amount'}
                  </button>
                </div>
              )}

              {/* Hint text for non-paid invoices */}
              {status !== 'paid' && !editingDraw && (
                <p style={{fontSize: 12, color: '#3b82f6', marginTop: 8, fontStyle: 'italic'}}>
                  💡 Click the <strong>This Draw</strong> amount or <strong>% of Contract</strong> to edit the billing amount.
                </p>
              )}

              {/* Extra line items — always shown for progress billing so items can be added/managed */}
              <div style={{marginTop: 20}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                  <h3 style={{fontSize: 16, fontWeight: 'bold', color: '#8b5cf6', margin: 0}}>
                    ➕ Additional Line Items
                  </h3>
                  <button
                    onClick={handleAddItem}
                    style={{
                      padding: '7px 16px',
                      backgroundColor: '#8b5cf6',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 7,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    + Add Extra Item
                  </button>
                </div>

                {extraItems.length === 0 ? (
                  <div style={{padding: '18px 16px', border: '2px dashed #e5e7eb', borderRadius: 8, textAlign: 'center', color: '#999', fontSize: 13}}>
                    No extra items yet. Click <strong>"+ Add Extra Item"</strong> to add per diem, equipment rental, or any charge that bills separately from the contract draw.
                  </div>
                ) : (
                  <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr auto 40px', gap: 0, backgroundColor: '#f3f4f6', padding: '10px 16px', fontSize: 12, fontWeight: 'bold', color: '#666', textTransform: 'uppercase'}}>
                      <span>Description</span>
                      <span style={{textAlign: 'right', paddingRight: 12}}>Amount</span>
                      <span></span>
                    </div>
                    {extraItems.map((item, idx) => (
                      <div key={item.id} style={{display: 'grid', gridTemplateColumns: '1fr auto 40px', gap: 0, padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb', alignItems: 'center'}}>
                        <span style={{fontSize: 14, color: '#111'}}>{item.description}</span>
                        <span style={{fontSize: 14, fontWeight: '600', color: '#8b5cf6', textAlign: 'right', paddingRight: 12}}>${(item.total || 0).toFixed(2)}</span>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          title="Delete this line item"
                          style={{background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '2px 4px'}}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <div style={{display: 'grid', gridTemplateColumns: '1fr auto 40px', gap: 0, padding: '10px 16px', borderTop: '2px solid #e5e7eb', backgroundColor: '#f5f3ff'}}>
                      <span style={{fontSize: 13, fontWeight: 'bold', color: '#8b5cf6'}}>Additional Items Total</span>
                      <span style={{fontSize: 14, fontWeight: 'bold', color: '#8b5cf6', textAlign: 'right', paddingRight: 12}}>${extraItems.reduce((s, i) => s + (i.total || 0), 0).toFixed(2)}</span>
                      <span></span>
                    </div>
                  </div>
                )}
                <p style={{fontSize: 12, color: '#999', marginTop: 8}}>* These items do not affect the contract progress percentage.</p>
              </div>
            </div>
            );
          })()}

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

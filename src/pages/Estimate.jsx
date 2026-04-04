
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { loadMaterials } from "../data/materials";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import PriceAdjustment from "../Components/PriceAdjustment";

// ===== SUMMARY COMPONENT =====
function EstimateSummary({ projectId, currentEstimateId, navigate, projectName, isChangeOrder, coNumber, coId }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  // Project info state
  const [customerName, setCustomerName] = useState("");
  
  // Fees/Equipment state
  const [mobilization, setMobilization] = useState(0);
  const [roomBoard, setRoomBoard] = useState(0);
  const [equipmentRental, setEquipmentRental] = useState(0);
  const [materialStorage, setMaterialStorage] = useState(0);
  const [miscExpenses, setMiscExpenses] = useState(0);
  const [permitFees, setPermitFees] = useState(0);
  
  // Price adjustment state
  const [showPriceAdjustment, setShowPriceAdjustment] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState(0);
  const [hasAdjustment, setHasAdjustment] = useState(false);
  
  // Markup settings
  const [hourlyRate, setHourlyRate] = useState(85);
  const [materialMarkup, setMaterialMarkup] = useState(0);
  const [feesMarkup, setFeesMarkup] = useState(0);
  const [packagesMarkup, setPackagesMarkup] = useState(0);
  
  // Labor cost settings
  const [laborCostRate, setLaborCostRate] = useState(25); // What you PAY per hour
  const [laborMarkupPercent, setLaborMarkupPercent] = useState(50); // Markup %
  
  // Subs/Packages state
  const [lightingPackageCost, setLightingPackageCost] = useState(0);
  const [lightingPackageSupplier, setLightingPackageSupplier] = useState("");
  const [switchgearPackageCost, setSwitchgearPackageCost] = useState(0);
  const [switchgearPackageSupplier, setSwitchgearPackageSupplier] = useState("");
  const [specialSystemsCost, setSpecialSystemsCost] = useState(0);
  const [specialSystemsSupplier, setSpecialSystemsSupplier] = useState("");
  const [subcontractorsCost, setSubcontractorsCost] = useState(0);
  const [subcontractorsSupplier, setSubcontractorsSupplier] = useState("");
  
  // Description/Scope of Work
  const [description, setDescription] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");


  useEffect(() => {
    if (currentEstimateId || (isChangeOrder && coId)) {
      // Small delay to ensure any concurrent save operations from the parent
      // (autoSaveEstimate DELETE→INSERT) complete before we query all items.
      // Without this, loadAllSections could read items mid-save (after DELETE but before INSERT).
      const timer = setTimeout(() => {
        loadAllSections();
        loadProjectInfo(); // Load project info to get customer name
        if (currentEstimateId) {
          loadSummaryData(); // Only load summary data for regular estimates (not change orders)
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentEstimateId, isChangeOrder, coId]);

  async function loadProjectInfo() {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("contractor, customer")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      if (data) {
        // For commercial projects, use contractor; for residential, use customer
        setCustomerName(data.contractor || data.customer || "");
      }
    } catch (err) {
      console.error("Error loading project info:", err);
    }
  }

  async function updateChangeOrderTotalFromSections(calculatedTotal) {
    if (!coId) {
      console.log("❌ No coId provided");
      return;
    }
    
    // Use the passed-in total if provided, otherwise calculate from sections
    let total = calculatedTotal;
    
    if (total === undefined) {
      console.log("🔍 Calculating total from sections:", sections);
      console.log("📊 Number of sections:", Object.keys(sections).length);
      
      // Calculate total from all loaded sections
      total = Object.values(sections).reduce((sum, items) => {
        const sectionTotal = items.reduce((itemSum, item) => {
          const itemTotal = (item.material_total || 0) + (item.labor_total || 0);
          console.log(`  Item: "${item.description}" = $${itemTotal.toFixed(2)}`);
          return itemSum + itemTotal;
        }, 0);
        console.log(`Section total: $${sectionTotal.toFixed(2)}`);
        return sum + sectionTotal;
      }, 0);
    }
    
    console.log(`💰 SAVING TOTAL: $${total.toFixed(2)} for coId: ${coId}`);
    
    try {
      // Update change_orders table
      const { data, error } = await supabase
        .from("change_orders")
        .update({ total })
        .eq("id", coId)
        .select();
      
      if (error) {
        console.error("❌ Database error:", error);
        throw error;
      }
      
      console.log(`✅ Updated change order in database:`, data);
      console.log(`✅ Change order ${coId} total updated: $${total.toFixed(2)}`);
      setLastSaved(new Date());
    } catch (err) {
      console.error("❌ Error updating change order total:", err);
      alert("Error updating total: " + err.message);
    }
  }

  // Auto-save effect for summary fields
  useEffect(() => {
    // Skip auto-save if no estimate/change order ID, or if still loading, or if this is a change order
    if (loading) return;
    if (!currentEstimateId && !coId) return;
    if (isChangeOrder && coId) return; // Change orders don't have fees/markup fields to save
    if (!currentEstimateId) return; // Regular estimates need an estimate ID
    
    const timeoutId = setTimeout(() => {
      autoSaveSummary();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    mobilization, roomBoard, equipmentRental, materialStorage, miscExpenses, permitFees,
    hourlyRate, materialMarkup, feesMarkup, packagesMarkup,
    laborCostRate, laborMarkupPercent, // Added these!
    lightingPackageCost, lightingPackageSupplier, switchgearPackageCost, switchgearPackageSupplier,
    specialSystemsCost, specialSystemsSupplier, subcontractorsCost, subcontractorsSupplier,
    description, loading, currentEstimateId, coId, isChangeOrder
  ]);

  async function loadSummaryData() {
    if (!currentEstimateId) return;
    
    try {
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", currentEstimateId)
        .single();

      if (error) throw error;

      if (data) {
        // Load fees
        setMobilization(data.mobilization || 0);
        setRoomBoard(data.room_board || 0);
        setEquipmentRental(data.equipment_rental || 0);
        setMaterialStorage(data.material_storage || 0);
        setMiscExpenses(data.misc_expenses || 0);
        setPermitFees(data.permit_fees || 0);
        
        // Load markup settings
        setHourlyRate(data.default_labor_rate || 85);
        setMaterialMarkup(data.material_markup_percent || 0);
        setFeesMarkup(data.fees_markup_percent || 0);
        setPackagesMarkup(data.packages_markup_percent || 0);
        
        // Load labor cost settings
        setLaborCostRate(data.labor_cost_rate || 25);
        setLaborMarkupPercent(data.labor_markup_percent || 50);
        
        // Load packages/subs
        setLightingPackageCost(data.lighting_package_cost || 0);
        setLightingPackageSupplier(data.lighting_package_supplier || "");
        setSwitchgearPackageCost(data.switchgear_package_cost || 0);
        setSwitchgearPackageSupplier(data.switchgear_package_supplier || "");
        setSpecialSystemsCost(data.special_systems_cost || 0);
        setSpecialSystemsSupplier(data.special_systems_supplier || "");
        setSubcontractorsCost(data.subcontractors_cost || 0);
        setSubcontractorsSupplier(data.subcontractors_supplier || "");
        
        // Load description
        setDescription(data.description || "");
        
        // Load price adjustment data
        if (data.price_adjustment_applied) {
          setHasAdjustment(true);
          setAdjustedTotal(data.total || 0);
          console.log(`✅ Loaded price adjustment - Total: $${data.total}, Details:`, data.price_adjustment_details);
        } else {
          setHasAdjustment(false);
          setAdjustedTotal(0);
        }
      }
    } catch (err) {
      console.error("Error loading summary data:", err);
    }
  }

  async function autoSaveSummary() {
    if (!currentEstimateId) return;
    
    setAutoSaving(true);
    try {
      const { error } = await supabase
        .from("estimates")
        .update({
          // Fees
          mobilization,
          room_board: roomBoard,
          equipment_rental: equipmentRental,
          material_storage: materialStorage,
          misc_expenses: miscExpenses,
          permit_fees: permitFees,
          
          // Markup settings
          default_labor_rate: hourlyRate,
          material_markup_percent: materialMarkup,
          fees_markup_percent: feesMarkup,
          packages_markup_percent: packagesMarkup,
          
          // Labor cost settings
          labor_cost_rate: laborCostRate,
          labor_markup_percent: laborMarkupPercent,
          
          // Packages/Subs
          lighting_package_cost: lightingPackageCost,
          lighting_package_supplier: lightingPackageSupplier,
          switchgear_package_cost: switchgearPackageCost,
          switchgear_package_supplier: switchgearPackageSupplier,
          special_systems_cost: specialSystemsCost,
          special_systems_supplier: specialSystemsSupplier,
          subcontractors_cost: subcontractorsCost,
          subcontractors_supplier: subcontractorsSupplier,
          
          // Description
          description: description,
        })
        .eq("id", currentEstimateId);

      if (error) throw error;
      
      setLastSaved(new Date());
    } catch (err) {
      console.error("Error auto-saving summary:", err);
    } finally {
      setAutoSaving(false);
    }
  }

  async function loadAllSections() {
    try {
      let data, error;
      
      // Load from change_order_items if this is a change order
      if (isChangeOrder && coId) {
        const result = await supabase
          .from("change_order_items")
          .select("*")
          .eq("change_order_id", coId)
          .order("section")
          .order("sequence");
        
        data = result.data;
        error = result.error;
      } else {
        // Load from estimate_items for regular estimates
        const result = await supabase
          .from("estimate_items")
          .select("*")
          .eq("estimate_id", currentEstimateId)
          .order("section")
          .order("sequence");
        
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      // DEDUPLICATE FIRST - Remove duplicate parent items
      const parents = (data || []).filter(item => !item.parent_id);
      const children = (data || []).filter(item => item.parent_id);
      
      // Track seen items by description+quantity+section
      const seenMap = new Map();
      const deduplicatedParents = [];
      
      parents.forEach(item => {
        const key = `${item.description}-${item.quantity}-${item.section}`;
        if (!seenMap.has(key)) {
          seenMap.set(key, item.id);
          deduplicatedParents.push(item);
        } else {
          console.log(`⚠️  Skipping duplicate in loadAllSections: "${item.description}"`);
        }
      });
      
      // Combine deduplicated parents with all children
      const deduplicatedData = [...deduplicatedParents, ...children];

      // Group by section
      const grouped = {};
      deduplicatedData.forEach(item => {
        const section = item.section || 'general';
        if (!grouped[section]) {
          grouped[section] = [];
        }
        grouped[section].push(item);
      });

      // Debug: Log the grouped sections
      console.log("📊 Loaded sections:", Object.keys(grouped));
      console.log("📊 Section data:", grouped);
      console.log("📊 Total items loaded:", data?.length || 0);
      
      // Debug each item's section
      (data || []).forEach((item, idx) => {
        console.log(`Item ${idx}: "${item.description}" - section: "${item.section}"`);
      });

      setSections(grouped);
    } catch (err) {
      console.error("Error loading summary:", err);
    } finally {
      setLoading(false);
    }
  }

  const sectionNames = {
    lighting: '💡 Lighting',
    power: '🔌 Power',
    branch: '🔀 Branch',
    switchgear: '⚙️ SwitchGear',
    feeders: '⚡ Feeders',
    equipment: '🔧 Equipment',
    special: '🏢 Special Systems',
    general: '📋 General'
  };

  const calculateSectionTotals = (items) => {
    // Only sum parent items (items without parent_id)
    // Child item totals are already included in their parent's totals
    const parentItems = items.filter(item => !item.parent_id);
    
    const materials = parentItems.reduce((sum, item) => sum + (item.material_total || 0), 0);
    const labor = parentItems.reduce((sum, item) => sum + (item.labor_total || 0), 0);
    return { materials, labor, total: materials + labor };
  };

  // Use useMemo to prevent recalculation on every render
  // Only sum sections that are displayed in the table (exclude 'general')
  const grandTotals = useMemo(() => {
    const displayedSections = Object.keys(sectionNames).filter(s => s !== 'general');
    
    return displayedSections.reduce((acc, sectionKey) => {
      const items = sections[sectionKey] || [];
      const totals = calculateSectionTotals(items);
      // Only count hours from parent items (child hours are included in parent calculations)
      const parentItems = items.filter(item => !item.parent_id);
      
      // Calculate hours WITH assembly awareness (same as section rows)
      const hours = parentItems.reduce((sum, item) => {
        // Check if this item has children (is an assembly)
        const itemChildren = items.filter(i => i.parent_id === item.id);
        
        if (itemChildren.length > 0) {
          // Assembly: Calculate from children
          const perUnitHours = itemChildren.reduce((childSum, child) => {
            return childSum + (Number(child.quantity || 0) * Number(child.labor_hours || 0) * Number(child.labor_multiplier || 1));
          }, 0);
          return sum + (Number(item.quantity || 0) * perUnitHours * Number(item.labor_multiplier || 1));
        } else {
          // Regular item: Use parent's hours
          const qty = Number(item.quantity || 0);
          const hrs = Number(item.labor_hours || 0);
          const mult = Number(item.labor_multiplier || 1);
          return sum + (qty * hrs * mult);
        }
      }, 0);
      
      return {
        materials: acc.materials + totals.materials,
        labor: acc.labor + totals.labor,
        laborHours: acc.laborHours + hours,
        total: acc.total + totals.total
      };
    }, { materials: 0, labor: 0, laborHours: 0, total: 0 });
  }, [sections]);

  // Calculate fees total
  const feesTotal = mobilization + roomBoard + equipmentRental + materialStorage + miscExpenses + permitFees;
  
  // Calculate packages total
  const packagesTotal = lightingPackageCost + switchgearPackageCost + specialSystemsCost + subcontractorsCost;
  
  // Calculate markup amounts
  const materialMarkupAmount = grandTotals.materials * (materialMarkup / 100);
  const feesMarkupAmount = feesTotal * (feesMarkup / 100);
  const packagesMarkupAmount = packagesTotal * (packagesMarkup / 100);
  const totalMarkup = materialMarkupAmount + feesMarkupAmount + packagesMarkupAmount;
  
  // Calculate labor budget (internal cost) and sell price
  // IMPORTANT: Use the SAME logic as grandTotals.laborHours (assembly-aware)
  const totalLaborHours = grandTotals.laborHours;

  const laborBudgetTotal = totalLaborHours * laborCostRate;
  const laborSellPrice = laborBudgetTotal * (1 + laborMarkupPercent / 100);
  const laborProfit = laborSellPrice - laborBudgetTotal;
  
  // Calculate project total
  const projectTotal = grandTotals.materials + grandTotals.labor + feesTotal + packagesTotal + totalMarkup;

  // Auto-update total when sections change (for BOTH change orders AND regular estimates)
  useEffect(() => {
    if (loading || Object.keys(sections).length === 0) return;
    
    // CRITICAL: Don't auto-update if there's a price adjustment applied
    // This prevents overwriting manually adjusted totals
    if (hasAdjustment) {
      console.log(`⏸️ Auto-update skipped - price adjustment is active (adjusted total: $${adjustedTotal.toFixed(2)})`);
      return;
    }
    
    // Calculate the FULL total that the orange box shows
    const calculatedTotal = grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice;
    
    if (isChangeOrder && coId) {
      // Update change order total
      console.log(`🚀 Auto-updating CO total: $${calculatedTotal.toFixed(2)}`);
      updateChangeOrderTotalFromSections(calculatedTotal);
    } else if (currentEstimateId) {
      // Update regular estimate total
      console.log(`🚀 Auto-updating Estimate total: $${calculatedTotal.toFixed(2)}`);
      updateEstimateTotal(calculatedTotal);
    }
  }, [sections, grandTotals.materials, materialMarkupAmount, feesTotal, feesMarkupAmount, packagesTotal, packagesMarkupAmount, laborSellPrice, isChangeOrder, coId, currentEstimateId, loading, hasAdjustment, adjustedTotal]);
  
  // Function to update regular estimate total
  async function updateEstimateTotal(calculatedTotal) {
    if (!currentEstimateId) return;
    
    try {
      const { error } = await supabase
        .from("estimates")
        .update({ total: calculatedTotal })
        .eq("id", currentEstimateId);
      
      if (error) throw error;
      console.log(`✅ Updated estimate ${currentEstimateId} total: $${calculatedTotal.toFixed(2)}`);
      setLastSaved(new Date());
    } catch (err) {
      console.error("❌ Error updating estimate total:", err);
    }
  }

  // Price adjustment functions
  const handlePriceAdjustment = async (newTotal, adjustmentDetails) => {
    setAdjustedTotal(newTotal);
    setHasAdjustment(true);
    console.log("Price adjustment applied:", adjustmentDetails);
    
    // Save the adjusted total to the database
    if (currentEstimateId) {
      try {
        const { error } = await supabase
          .from("estimates")
          .update({ 
            total: newTotal,
            price_adjustment_applied: true,
            price_adjustment_details: adjustmentDetails
          })
          .eq("id", currentEstimateId);
        
        if (error) throw error;
        console.log(`✅ Saved adjusted total to database: $${newTotal.toFixed(2)}`);
      } catch (err) {
        console.error("❌ Error saving adjusted total:", err);
      }
    } else if (isChangeOrder && coId) {
      try {
        const { error } = await supabase
          .from("change_orders")
          .update({ 
            total: newTotal,
            price_adjustment_applied: true,
            price_adjustment_details: adjustmentDetails
          })
          .eq("id", coId);
        
        if (error) throw error;
        console.log(`✅ Saved adjusted CO total to database: $${newTotal.toFixed(2)}`);
      } catch (err) {
        console.error("❌ Error saving adjusted CO total:", err);
      }
    }
  };

  const resetPriceAdjustment = () => {
    setAdjustedTotal(0);
    setHasAdjustment(false);
  };

  const getFinalTotal = () => {
    const baseTotal = grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice;
    return hasAdjustment ? adjustedTotal : baseTotal;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* TOP BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: "#f97316", fontSize: 24 }}>
            📊 Estimate Summary - {projectName}
            {isChangeOrder && coNumber && (
              <span style={{ color: "#ef4444", marginLeft: 10, fontSize: 20, fontWeight: "bold" }}>
                - {coNumber} Change Order
              </span>
            )}
          </h2>
          {/* Auto-save indicator */}
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            {autoSaving ? (
              <span style={{ color: "#f59e0b" }}>⏳ Auto-saving...</span>
            ) : lastSaved ? (
              <span style={{ color: "#10b981" }}>✓ Saved {new Date(lastSaved).toLocaleTimeString()}</span>
            ) : (
              <span>Summary will auto-save as you make changes</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              border: "2px solid #fff",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            ← Back to Project
          </button>
          {isChangeOrder && coId && (
            <button
              onClick={() => navigate(`/project/${projectId}/proposal?coId=${coId}&type=commercial-public`)}
              style={{
                padding: "10px 20px",
                backgroundColor: "#10b981",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 15,
                fontWeight: "bold",
              }}
            >
              📄 Create Proposal
            </button>
          )}
          <button
            onClick={() => navigate(`/project/${projectId}/plans`)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            📐 Digital Takeoff
          </button>
          <button
            onClick={() => {
              // Gather all items from all sections
              const allItems = [];
              const sNames = {
                lighting: '💡 Lighting',
                switchgear: '⚙️ SwitchGear'
              };
              Object.keys(sNames).forEach(sKey => {
                const items = sections[sKey] || [];
                const parentItems = items.filter(item => !item.parent_id && item.description);
                if (parentItems.length > 0) {
                  allItems.push({ section: sNames[sKey], items: parentItems });
                }
              });

              // Open print window
              const w = window.open('', '_blank', 'width=800,height=900');
              w.document.write(`<!DOCTYPE html><html><head><title>Count Sheet - ${projectName}</title>
              <style>
                @page { margin: 0.5in; }
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                .header { background: #0b3ea8; color: #fff; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; }
                .header h1 { margin: 0 0 4px 0; font-size: 22px; color: #f97316; }
                .header p { margin: 2px 0; font-size: 13px; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; color: #666; }
                h2 { font-size: 16px; color: #0b3ea8; border-bottom: 2px solid #0b3ea8; padding-bottom: 4px; margin: 20px 0 8px 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 700; color: #555; border-bottom: 2px solid #d1d5db; }
                td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
                .qty { text-align: center; font-weight: 700; font-size: 16px; }
                .unit { text-align: center; color: #666; }
                .supplier-col { width: 140px; }
                .price-col { width: 90px; }
                .total-row { font-weight: 700; background: #f0f9ff; }
                .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #999; }
                .notes { margin-top: 24px; border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; min-height: 80px; }
                .notes-label { font-size: 13px; font-weight: 700; color: #555; margin-bottom: 4px; }
                @media print { .no-print { display: none; } }
              </style></head><body>
              <div class="no-print" style="margin-bottom:16px">
                <button onclick="window.print()" style="padding:10px 24px;background:#0b3ea8;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;margin-right:12px">🖨️ Print / Save PDF</button>
                <button onclick="window.close()" style="padding:10px 24px;background:#666;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer">Close</button>
              </div>
              <div class="header">
                <h1>DML ELECTRICAL SERVICE LLC</h1>
                <p>MATERIAL COUNT SHEET</p>
              </div>
              <div class="meta">
                <div><strong>Project:</strong> ${projectName || 'N/A'}</div>
                <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
              </div>
              ${allItems.map(s => `
                <h2>${s.section}</h2>
                <table>
                  <tr><th style="width:50%">Item</th><th style="width:70px;text-align:center">Qty</th><th style="width:60px;text-align:center">Unit</th><th class="supplier-col">Supplier Price</th><th class="price-col">Ext. Total</th></tr>
                  ${s.items.map(item => `
                    <tr>
                      <td>${item.description}</td>
                      <td class="qty">${item.quantity || 0}</td>
                      <td class="unit">${item.unit || 'ea'}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  `).join('')}
                  <tr class="total-row"><td>Section Total: ${s.items.length} items</td><td class="qty">${s.items.reduce((s2,i)=>s2+(Number(i.quantity)||0),0)}</td><td></td><td></td><td></td></tr>
                </table>
              `).join('')}
              <div class="total-row" style="font-size:16px;padding:12px;background:#f0f9ff;border-radius:6px;margin-top:16px">
                <strong>Grand Total: ${allItems.reduce((s2,sec)=>s2+sec.items.length,0)} items / ${allItems.reduce((s2,sec)=>s2+sec.items.reduce((s3,i)=>s3+(Number(i.quantity)||0),0),0)} units</strong>
              </div>
              <div class="notes"><div class="notes-label">Supplier Notes / Quote #:</div></div>
              <div class="footer">Generated from TradeFlow Estimator • ${new Date().toLocaleString()}</div>
              </body></html>`);
              w.document.close();
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#10b981",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            📋 Count Sheet
          </button>
          <button
            onClick={() => {
              // ===== SUPPLIER PRICING LIST =====
              // Pull ALL materials from ALL sections, break out assemblies, consolidate duplicates
              const allSectionKeys = ['lighting', 'power', 'branch', 'switchgear', 'feeders', 'equipment', 'special'];
              const sNames = {
                lighting: '💡 Lighting',
                power: '🔌 Power',
                branch: '🔀 Branch',
                switchgear: '⚙️ SwitchGear',
                feeders: '⚡ Feeders',
                equipment: '🔧 Equipment',
                special: '🏢 Special Systems'
              };

              // Step 1: Gather all individual materials (break out assemblies)
              const allMaterials = []; // { description, qty, unit, section }
              const sectionBreakdown = []; // For section-by-section view

              allSectionKeys.forEach(sKey => {
                const items = sections[sKey] || [];
                const parentItems = items.filter(item => !item.parent_id && item.description);
                const children = items.filter(item => item.parent_id);
                const sectionMaterials = [];

                parentItems.forEach(parent => {
                  const parentChildren = children.filter(c => c.parent_id === parent.id);
                  
                  if (parentChildren.length > 0) {
                    // Assembly: break out each child component, multiply by parent qty
                    const parentQty = Number(parent.quantity || 1);
                    parentChildren.forEach(child => {
                      const childQty = Number(child.quantity || 0) * parentQty;
                      if (childQty > 0 && child.description) {
                        sectionMaterials.push({
                          description: child.description,
                          qty: childQty,
                          unit: child.unit || 'ea',
                          section: sKey,
                          fromAssembly: parent.description
                        });
                      }
                    });
                  } else {
                    // Regular item
                    const qty = Number(parent.quantity || 0);
                    if (qty > 0) {
                      sectionMaterials.push({
                        description: parent.description,
                        qty: qty,
                        unit: parent.unit || 'ea',
                        section: sKey,
                        fromAssembly: null
                      });
                    }
                  }
                });

                if (sectionMaterials.length > 0) {
                  sectionBreakdown.push({ key: sKey, name: sNames[sKey], items: sectionMaterials });
                }
                allMaterials.push(...sectionMaterials);
              });

              // Step 2: Consolidate duplicates
              const consolidated = new Map();
              allMaterials.forEach(mat => {
                const key = `${mat.description}|||${mat.unit}`;
                if (consolidated.has(key)) {
                  const existing = consolidated.get(key);
                  existing.qty += mat.qty;
                  if (!existing.sections.includes(mat.section)) {
                    existing.sections.push(mat.section);
                  }
                } else {
                  consolidated.set(key, {
                    description: mat.description,
                    qty: mat.qty,
                    unit: mat.unit,
                    sections: [mat.section]
                  });
                }
              });

              const consolidatedList = Array.from(consolidated.values())
                .sort((a, b) => a.description.localeCompare(b.description));

              const totalItems = consolidatedList.length;
              const totalUnits = consolidatedList.reduce((s, i) => s + i.qty, 0);

              // Step 3: Build clipboard text
              const clipboardLines = [
                `SUPPLIER PRICING REQUEST - ${projectName || 'Project'}`,
                `Date: ${new Date().toLocaleDateString()}`,
                `From: DML Electrical Service LLC`,
                ``,
                `${'Item'.padEnd(60)} ${'Qty'.padStart(8)} ${'Unit'.padStart(6)}`,
                `${'─'.repeat(76)}`,
                ...consolidatedList.map(item => 
                  `${item.description.substring(0, 58).padEnd(60)} ${String(item.qty).padStart(8)} ${item.unit.padStart(6)}`
                ),
                `${'─'.repeat(76)}`,
                `Total: ${totalItems} items / ${totalUnits} units`,
                ``,
                `Please provide unit pricing and extended totals.`,
                `Quote #: _______________  Valid Until: _______________`
              ];
              const clipboardText = clipboardLines.join('\n');

              // Step 4: Open print window
              const w = window.open('', '_blank', 'width=900,height=1000');
              w.document.write(`<!DOCTYPE html><html><head><title>Supplier Pricing List - ${projectName}</title>
              <style>
                @page { margin: 0.4in; size: letter; }
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; font-size: 12px; }
                .header { background: #0b3ea8; color: #fff; padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; }
                .header h1 { margin: 0 0 2px 0; font-size: 20px; color: #f97316; }
                .header p { margin: 2px 0; font-size: 12px; }
                .header .subtitle { font-size: 15px; font-weight: bold; color: #fff; margin-top: 4px; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; color: #666; padding: 8px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
                .meta div { line-height: 1.6; }
                .instructions { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e; }
                .instructions strong { color: #78350f; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                th { background: #1e3a5f; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                th.right { text-align: right; }
                th.center { text-align: center; }
                td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
                tr:nth-child(even) { background: #f9fafb; }
                .qty { text-align: center; font-weight: 700; font-size: 13px; }
                .unit { text-align: center; color: #666; }
                .price-col { text-align: right; min-width: 80px; border-left: 1px solid #d1d5db; }
                .price-input { border-bottom: 1px dotted #999; min-width: 60px; display: inline-block; height: 16px; }
                .section-header { background: #f0f4ff; font-weight: 700; color: #1e3a5f; font-size: 13px; border-top: 2px solid #1e3a5f; }
                .section-header td { padding: 8px 10px; }
                .total-row { font-weight: 700; background: #e0f2fe; border-top: 2px solid #1e3a5f; }
                .grand-total { font-size: 14px; font-weight: 700; background: #1e3a5f; color: #fff; }
                .grand-total td { padding: 10px; }
                .footer-section { margin-top: 20px; }
                .sign-block { display: flex; gap: 40px; margin-top: 16px; }
                .sign-line { flex: 1; border-bottom: 1px solid #333; padding-bottom: 4px; font-size: 12px; color: #666; }
                .notes-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; min-height: 60px; margin-top: 8px; }
                .notes-label { font-size: 12px; font-weight: 700; color: #555; margin-bottom: 4px; }
                .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #999; text-align: center; }
                .btn-bar { margin-bottom: 16px; display: flex; gap: 10px; }
                .btn { padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; }
                .btn-print { background: #0b3ea8; color: #fff; }
                .btn-copy { background: #10b981; color: #fff; }
                .btn-close { background: #666; color: #fff; }
                .btn:hover { opacity: 0.9; }
                @media print { .no-print { display: none !important; } }
              </style></head><body>
              <div class="no-print btn-bar">
                <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
                <button class="btn btn-copy" onclick="copyToClipboard()">📋 Copy to Clipboard</button>
                <button class="btn btn-close" onclick="window.close()">Close</button>
              </div>
              <div class="header">
                <h1>DML ELECTRICAL SERVICE LLC</h1>
                <div class="subtitle">SUPPLIER PRICING REQUEST</div>
                <p>Please provide unit pricing for the materials listed below</p>
              </div>
              <div class="meta">
                <div>
                  <strong>Project:</strong> ${projectName || 'N/A'}<br/>
                  <strong>Date:</strong> ${new Date().toLocaleDateString()}<br/>
                  <strong>Requested By:</strong> DML Electrical Service LLC
                </div>
                <div style="text-align:right">
                  <strong>Total Line Items:</strong> ${totalItems}<br/>
                  <strong>Pricing Due By:</strong> _______________<br/>
                  <strong>Quote #:</strong> _______________
                </div>
              </div>
              <div class="instructions">
                <strong>Instructions:</strong> Please provide your best unit pricing for each item below. 
                Return completed pricing sheet via email or fax. Include lead times for any items not in stock.
              </div>

              <!-- CONSOLIDATED TABLE -->
              <table>
                <thead>
                  <tr>
                    <th style="width:4%">#</th>
                    <th style="width:46%">Material Description</th>
                    <th class="center" style="width:8%">Qty</th>
                    <th class="center" style="width:6%">Unit</th>
                    <th class="right" style="width:12%">Unit Price</th>
                    <th class="right" style="width:12%">Ext. Total</th>
                    <th class="center" style="width:12%">Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${consolidatedList.map((item, idx) => `
                    <tr>
                      <td style="color:#999;text-align:center">${idx + 1}</td>
                      <td>${item.description}</td>
                      <td class="qty">${item.qty}</td>
                      <td class="unit">${item.unit}</td>
                      <td class="price-col"><span class="price-input"></span></td>
                      <td class="price-col"><span class="price-input"></span></td>
                      <td class="price-col"><span class="price-input"></span></td>
                    </tr>
                  `).join('')}
                  <tr class="grand-total">
                    <td></td>
                    <td>TOTAL: ${totalItems} line items</td>
                    <td style="text-align:center">${totalUnits}</td>
                    <td></td>
                    <td></td>
                    <td class="price-col" style="color:#f97316">$___________</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <!-- SECTION BREAKDOWN (reference) -->
              <details class="no-print" style="margin-top:16px">
                <summary style="cursor:pointer;color:#0b3ea8;font-weight:bold;font-size:14px;margin-bottom:8px">
                  📊 View Section-by-Section Breakdown
                </summary>
                ${sectionBreakdown.map(sec => `
                  <h4 style="color:#1e3a5f;margin:12px 0 4px 0;border-bottom:1px solid #ddd;padding-bottom:4px">${sec.name}</h4>
                  <table style="margin-bottom:8px">
                    <tr style="background:#f3f4f6"><th style="padding:4px 8px;font-size:11px">Item</th><th style="padding:4px 8px;font-size:11px;width:60px;text-align:center">Qty</th><th style="padding:4px 8px;font-size:11px;width:50px;text-align:center">Unit</th></tr>
                    ${sec.items.map(item => `
                      <tr>
                        <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee">${item.fromAssembly ? '<span style="color:#f97316;font-size:10px">⚡ from ' + item.fromAssembly + '</span> ' : ''}${item.description}</td>
                        <td style="padding:3px 8px;font-size:11px;text-align:center;border-bottom:1px solid #eee;font-weight:bold">${item.qty}</td>
                        <td style="padding:3px 8px;font-size:11px;text-align:center;border-bottom:1px solid #eee;color:#666">${item.unit}</td>
                      </tr>
                    `).join('')}
                  </table>
                `).join('')}
              </details>

              <!-- NOTES & SIGNATURE -->
              <div class="footer-section">
                <div class="notes-box">
                  <div class="notes-label">Supplier Notes / Terms / Conditions:</div>
                </div>
                <div class="sign-block">
                  <div class="sign-line">Supplier Company: ___________________________</div>
                  <div class="sign-line">Contact Name: ___________________________</div>
                </div>
                <div class="sign-block" style="margin-top:12px">
                  <div class="sign-line">Phone / Email: ___________________________</div>
                  <div class="sign-line">Date: ___________________________</div>
                </div>
              </div>
              <div class="footer">Generated from TradeFlow Estimator &bull; ${new Date().toLocaleString()}</div>

              <textarea id="clipData" style="position:absolute;left:-9999px">${clipboardText.replace(/"/g, '&quot;')}</textarea>
              <script>
                function copyToClipboard() {
                  const text = document.getElementById('clipData').value;
                  navigator.clipboard.writeText(text).then(() => {
                    alert('✅ Material list copied to clipboard!\\nPaste into an email to send to your supplier.');
                  }).catch(() => {
                    // Fallback
                    const ta = document.getElementById('clipData');
                    ta.style.position = 'static';
                    ta.select();
                    document.execCommand('copy');
                    ta.style.position = 'absolute';
                    ta.style.left = '-9999px';
                    alert('✅ Material list copied to clipboard!');
                  });
                }
              </script>
              </body></html>`);
              w.document.close();
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            📦 Supplier Pricing List
          </button>
          <button
            onClick={() => navigate('/assemblies')}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fc6b04ff",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            🔧 Assemblies
          </button>
        </div>
      </div>

      {/* SECTION BUTTONS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, justifyContent: "center" }}>
        {Object.keys(sectionNames).filter(s => s !== 'general').map(section => (
          <button 
            key={section}
            onClick={() => navigate(`/project/${projectId}/estimate?section=${section}${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              border: "2px solid #fff",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {sectionNames[section]}
          </button>
        ))}
        <button 
          style={{
            padding: "10px 20px",
            backgroundColor: "#fc6b04ff",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: "bold"
          }}
        >
          📊 Summary
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#999", padding: 40 }}>Loading summary...</div>
      ) : (
        <>
          {/* ROW 1: SECTION SUMMARY + FEES/EQUIPMENT */}
          <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
            {/* SECTION SUMMARY TABLE */}
            <div style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              flex: 1
            }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
              Section Summary
            </h3>
            
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #444", background: "#1a1a1a" }}>
                  <th style={{ textAlign: "left", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold" }}>Section</th>
                  <th style={{ textAlign: "right", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 120 }}>Materials</th>
                  <th style={{ textAlign: "right", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 100 }}>Lab Hrs</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(sectionNames).filter(s => s !== 'general').map((sectionKey) => {
                  const items = sections[sectionKey] || [];
                  const sectionTotal = items.length > 0 ? calculateSectionTotals(items) : { materials: 0, labor: 0, total: 0 };
                  // Only count hours from parent items
                  const parentItems = items.filter(item => !item.parent_id);
                  
                  // DEBUG: Log what we're calculating
                  if (sectionKey === 'lighting') {
                    console.log(`🔍 LIGHTING SECTION DEBUG:`);
                    console.log(`  Total items in section: ${items.length}`);
                    console.log(`  Parent items: ${parentItems.length}`);
                    console.log(`  Items:`, items.map(i => ({
                      desc: i.description,
                      qty: i.quantity,
                      hrs: i.labor_hours,
                      mult: i.labor_multiplier,
                      parent_id: i.parent_id,
                      calc: i.quantity * i.labor_hours * (i.labor_multiplier || 1)
                    })));
                  }
                  
                  const totalLaborHours = parentItems.reduce((sum, item) => {
                    // Check if this item has children (is an assembly)
                    const itemChildren = items.filter(i => i.parent_id === item.id);
                    
                    if (itemChildren.length > 0) {
                      // Assembly: Calculate from children
                      const perUnitHours = itemChildren.reduce((childSum, child) => {
                        return childSum + (Number(child.quantity || 0) * Number(child.labor_hours || 0) * Number(child.labor_multiplier || 1));
                      }, 0);
                      return sum + (Number(item.quantity || 0) * perUnitHours * Number(item.labor_multiplier || 1));
                    } else {
                      // Regular item: Use parent's hours
                      const qty = Number(item.quantity || 0);
                      const hours = Number(item.labor_hours || 0);
                      const multiplier = Number(item.labor_multiplier || 1);
                      return sum + (qty * hours * multiplier);
                    }
                  }, 0);
                  
                  return (
                    <tr 
                      key={sectionKey} 
                      style={{ 
                        borderBottom: "1px solid #444",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      onClick={() => navigate(`/project/${projectId}/estimate?section=${sectionKey}`)}
                    >
                      <td style={{ padding: "8px", color: "#fff", fontSize: 13, fontWeight: "600" }}>
                        {sectionNames[sectionKey]}
                      </td>
                      <td style={{ padding: "8px", color: "#10b981", textAlign: "right", fontSize: 13, fontWeight: "bold" }}>
                        ${sectionTotal.materials.toFixed(2)}
                      </td>
                      <td style={{ padding: "8px", color: "#8b5cf6", textAlign: "right", fontSize: 13, fontWeight: "bold" }}>
                        {totalLaborHours.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
                {/* SUBTOTAL ROW */}
                <tr style={{ borderTop: "2px solid #555", background: "#1a1a1a" }}>
                  <td style={{ padding: "10px 8px", color: "#f97316", fontSize: 14, fontWeight: "bold" }}>
                    Subtotal
                  </td>
                  <td style={{ padding: "10px 8px", color: "#10b981", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${grandTotals.materials.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 8px", color: "#8b5cf6", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    {grandTotals.laborHours.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>

            {/* FEES/EQUIPMENT TABLE */}
            <div style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              flex: 1
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
                Fees/Equipment
              </h3>
              
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #444", background: "#1a1a1a" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold" }}>Item</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 120 }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Mobilization</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={mobilization}
                        onChange={(e) => setMobilization(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Room & Board</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={roomBoard}
                        onChange={(e) => setRoomBoard(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Equipment Rental</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={equipmentRental}
                        onChange={(e) => setEquipmentRental(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Material Storage</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={materialStorage}
                        onChange={(e) => setMaterialStorage(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Misc Expenses</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={miscExpenses}
                        onChange={(e) => setMiscExpenses(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "2px solid #555" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Permit & Fees</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={permitFees}
                        onChange={(e) => setPermitFees(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ background: "#1a1a1a" }}>
                    <td style={{ padding: "10px 8px", color: "#f97316", fontSize: 14, fontWeight: "bold" }}>Total Fees</td>
                    <td style={{ padding: "10px 8px", color: "#fff", fontSize: 14, fontWeight: "bold", textAlign: "right" }}>
                      ${(mobilization + roomBoard + equipmentRental + materialStorage + miscExpenses + permitFees).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ROW 2: SUBS/PACKAGES AND MARKUP SETTINGS */}
          <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
            {/* SUBS/PACKAGES TABLE */}
            <div style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              flex: 1
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
                Subs/Packages
              </h3>
              
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #444", background: "#1a1a1a" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold" }}>Item</th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 200 }}>Supplier/Sub</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 120 }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Lighting</td>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="text"
                        value={lightingPackageSupplier}
                        onChange={(e) => setLightingPackageSupplier(e.target.value)}
                        placeholder="Supplier name"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 13
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={lightingPackageCost}
                        onChange={(e) => setLightingPackageCost(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>SwitchGear</td>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="text"
                        value={switchgearPackageSupplier}
                        onChange={(e) => setSwitchgearPackageSupplier(e.target.value)}
                        placeholder="Supplier name"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 13
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={switchgearPackageCost}
                        onChange={(e) => setSwitchgearPackageCost(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Special Systems</td>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="text"
                        value={specialSystemsSupplier}
                        onChange={(e) => setSpecialSystemsSupplier(e.target.value)}
                        placeholder="Supplier name"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 13
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={specialSystemsCost}
                        onChange={(e) => setSpecialSystemsCost(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "2px solid #555" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Subcontractors</td>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="text"
                        value={subcontractorsSupplier}
                        onChange={(e) => setSubcontractorsSupplier(e.target.value)}
                        placeholder="Sub name"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 13
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={subcontractorsCost}
                        onChange={(e) => setSubcontractorsCost(Number(e.target.value))}
                        style={{
                          width: 100,
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #555",
                          borderRadius: 4,
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "right"
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                  <tr style={{ background: "#1a1a1a" }}>
                    <td colSpan="2" style={{ padding: "10px 8px", color: "#f97316", fontSize: 14, fontWeight: "bold" }}>Total Subs/Packages</td>
                    <td style={{ padding: "10px 8px", color: "#fff", fontSize: 14, fontWeight: "bold", textAlign: "right" }}>
                      ${(lightingPackageCost + switchgearPackageCost + specialSystemsCost + subcontractorsCost).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* MARKUP SETTINGS TABLE */}
            <div style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              flex: 1
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
                Markup Settings
              </h3>
              
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #444", background: "#1a1a1a" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold" }}>Setting</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold", width: 120 }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Material Markup</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <input
                          type="number"
                          value={materialMarkup}
                          onChange={(e) => setMaterialMarkup(Number(e.target.value))}
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            background: "#1a1a1a",
                            border: "1px solid #555",
                            borderRadius: 4,
                            color: "#10b981",
                            fontSize: 13,
                            textAlign: "right"
                          }}
                          step="0.1"
                        />
                        <span style={{ color: "#999", fontSize: 13 }}>%</span>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Fees Markup</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <input
                          type="number"
                          value={feesMarkup}
                          onChange={(e) => setFeesMarkup(Number(e.target.value))}
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            background: "#1a1a1a",
                            border: "1px solid #555",
                            borderRadius: 4,
                            color: "#f59e0b",
                            fontSize: 13,
                            textAlign: "right"
                          }}
                          step="0.1"
                        />
                        <span style={{ color: "#999", fontSize: 13 }}>%</span>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Packages Markup</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <input
                          type="number"
                          value={packagesMarkup}
                          onChange={(e) => setPackagesMarkup(Number(e.target.value))}
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            background: "#1a1a1a",
                            border: "1px solid #555",
                            borderRadius: 4,
                            color: "#8b5cf6",
                            fontSize: 13,
                            textAlign: "right"
                          }}
                          step="0.1"
                        />
                        <span style={{ color: "#999", fontSize: 13 }}>%</span>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Labor Cost Rate ($/hr)</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <span style={{ color: "#999", fontSize: 13 }}>$</span>
                        <input
                          type="number"
                          value={laborCostRate}
                          onChange={(e) => setLaborCostRate(Number(e.target.value))}
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            background: "#1a1a1a",
                            border: "1px solid #555",
                            borderRadius: 4,
                            color: "#ef4444",
                            fontSize: 13,
                            textAlign: "right"
                          }}
                          step="0.50"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "2px solid #555" }}>
                    <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>Labor Markup %</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <input
                          type="number"
                          value={laborMarkupPercent}
                          onChange={(e) => setLaborMarkupPercent(Number(e.target.value))}
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            background: "#1a1a1a",
                            border: "1px solid #555",
                            borderRadius: 4,
                            color: "#10b981",
                            fontSize: 13,
                            textAlign: "right"
                          }}
                          step="0.1"
                        />
                        <span style={{ color: "#999", fontSize: 13 }}>%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MARKUP SUMMARY TABLE */}
          <div style={{
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20
          }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
              Cost & Markup Summary
            </h3>
            
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #444", background: "#1a1a1a" }}>
                  <th style={{ textAlign: "left", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold" }}>Category</th>
                  <th style={{ textAlign: "right", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 100 }}>Hours</th>
                  <th style={{ textAlign: "right", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 140 }}>Cost</th>
                  <th style={{ textAlign: "right", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 100 }}>Markup %</th>
                  <th style={{ textAlign: "right", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 140 }}>Markup $</th>
                  <th style={{ textAlign: "right", padding: "10px", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 140 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {/* MATERIAL ROW */}
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <td style={{ padding: "10px", color: "#fff", fontSize: 14 }}>Materials</td>
                  <td style={{ padding: "10px", textAlign: "right" }}></td>
                  <td style={{ padding: "10px", color: "#10b981", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${grandTotals.materials.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#999", textAlign: "right", fontSize: 14 }}>
                    {materialMarkup.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px", color: "#f59e0b", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${materialMarkupAmount.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#fff", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${(grandTotals.materials + materialMarkupAmount).toFixed(2)}
                  </td>
                </tr>
                
                {/* FEES ROW */}
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <td style={{ padding: "10px", color: "#fff", fontSize: 14 }}>Fees/Equipment</td>
                  <td style={{ padding: "10px", textAlign: "right" }}></td>
                  <td style={{ padding: "10px", color: "#10b981", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${feesTotal.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#999", textAlign: "right", fontSize: 14 }}>
                    {feesMarkup.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px", color: "#f59e0b", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${feesMarkupAmount.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#fff", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${(feesTotal + feesMarkupAmount).toFixed(2)}
                  </td>
                </tr>
                
                {/* PACKAGES ROW */}
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <td style={{ padding: "10px", color: "#fff", fontSize: 14 }}>Subs/Packages</td>
                  <td style={{ padding: "10px", textAlign: "right" }}></td>
                  <td style={{ padding: "10px", color: "#10b981", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${packagesTotal.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#999", textAlign: "right", fontSize: 14 }}>
                    {packagesMarkup.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px", color: "#f59e0b", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${packagesMarkupAmount.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#fff", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${(packagesTotal + packagesMarkupAmount).toFixed(2)}
                  </td>
                </tr>
                
                {/* LABOR ROW */}
                <tr style={{ borderBottom: "2px solid #555" }}>
                  <td style={{ padding: "10px", color: "#fff", fontSize: 14 }}>Labor</td>
                  <td style={{ padding: "10px", color: "#8b5cf6", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    {totalLaborHours.toFixed(1)} hrs
                  </td>
                  <td style={{ padding: "10px", color: "#ef4444", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${laborBudgetTotal.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#999", textAlign: "right", fontSize: 14 }}>
                    {laborMarkupPercent.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px", color: "#f59e0b", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                    ${laborProfit.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px", color: "#fff", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${laborSellPrice.toFixed(2)}
                  </td>
                </tr>
                
                {/* GRAND TOTAL ROW */}
                <tr style={{ background: "#1a1a1a" }}>
                  <td style={{ padding: "12px 10px", color: "#f97316", fontSize: 16, fontWeight: "bold" }}>GRAND TOTAL</td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}></td>
                  <td style={{ padding: "12px 10px", color: "#10b981", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${(grandTotals.materials + feesTotal + packagesTotal + laborBudgetTotal).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#999", textAlign: "right", fontSize: 13 }}>
                    {/* Average markup or blank */}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#f59e0b", textAlign: "right", fontSize: 15, fontWeight: "bold" }}>
                    ${(materialMarkupAmount + feesMarkupAmount + packagesMarkupAmount + laborProfit).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#fff", textAlign: "right", fontSize: 18, fontWeight: "bold" }}>
                    ${(grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PRICE ADJUSTMENT */}
          <div style={{
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#f97316", fontSize: 16 }}>
                Price Adjustment
              </h3>
              <button
                onClick={() => {
                  console.log("Adjust Price clicked, current state:", showPriceAdjustment);
                  setShowPriceAdjustment(!showPriceAdjustment);
                  console.log("Should show modal:", !showPriceAdjustment);
                }}
                style={{
                  padding: "8px 16px",
                  background: showPriceAdjustment ? "#ef4444" : "#10b981",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                {showPriceAdjustment ? "Cancel" : "Adjust Price"}
              </button>
            </div>


            {hasAdjustment && (
              <div style={{
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                padding: 12,
                marginTop: 12
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#f59e0b", fontSize: 14, fontWeight: "bold" }}>
                    Price Adjustment Applied
                  </span>
                  <button
                    onClick={resetPriceAdjustment}
                    style={{
                      padding: "4px 12px",
                      background: "#ef4444",
                      border: "none",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  Adjusted Total: ${adjustedTotal.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* DESCRIPTION/SCOPE OF WORK */}
          <div style={{
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20
          }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
              Scope of Work Description
            </h3>
            
            {/* AI Instructions Input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#999" }}>
                💬 Optional: Give AI instructions (e.g., "Keep it brief", "Emphasize quality", "Mention 2-year warranty")
              </label>
              <input
                type="text"
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder="Tell the AI what to include or what tone to use..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "#1a1a1a",
                  border: "1px solid #555",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13
                }}
              />
            </div>
            
            {/* AI Generate Button */}
            <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={async () => {
                  // Get all sections' items for complete context
                  const allItems = Object.values(sections).flat();
                  
                  if (!allItems || allItems.length === 0) {
                    alert("Add some line items to your estimate first!");
                    return;
                  }
                  
                  setAutoSaving(true);
                  
                  try {
                    const { data, error } = await supabase.functions.invoke('generate-proposal', {
                      body: {
                        projectName: projectName || 'Electrical Project',
                        customerName: customerName || 'Customer',
                        projectType: 'commercial',
                        additionalInstructions: aiInstructions || undefined, // Pass user instructions
                        lineItems: allItems
                          .filter(item => !item.parent_id) // Only include parent items
                          .map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            unit: item.unit || 'ea'
                          }))
                      }
                    });

                    if (error) {
                      console.error('Supabase function error:', error);
                      throw error;
                    }
                    
                    if (data && data.success) {
                      setDescription(data.scopeOfWork);
                      
                      // Show cost info
                      const costInfo = data.cost ? ` (Cost: $${data.cost.toFixed(4)})` : '';
                      alert(`✨ AI proposal generated!${costInfo}\n\nYou can edit the text below before saving.`);
                    } else {
                      throw new Error(data?.error || 'Failed to generate proposal');
                    }
                  } catch (err) {
                    console.error('AI generation error:', err);
                    alert('Error generating proposal: ' + (err.message || 'Unknown error'));
                  } finally {
                    setAutoSaving(false);
                  }
                }}
                disabled={autoSaving}
                style={{
                  padding: "10px 20px",
                  background: autoSaving 
                    ? "#666" 
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "bold",
                  cursor: autoSaving ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.3s",
                  opacity: autoSaving ? 0.6 : 1
                }}
              >
                {autoSaving ? "✨ Generating..." : "✨ Generate Scope with AI"}
              </button>
              
              {!isChangeOrder && (
                <span style={{ fontSize: 12, color: "#999" }}>
                  💡 AI will analyze your line items and create a professional description
                </span>
              )}
            </div>
            
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description of the scope of work for this estimate. This will appear on the proposal..."
              style={{
                width: "100%",
                minHeight: 100,
                padding: "12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontFamily: "Arial",
                resize: "vertical"
              }}
            />
          </div>

          {/* GRAND TOTAL - Bottom of Page */}
          <div style={{
            background: "linear-gradient(135deg, #fc6b04ff 0%, #f97316 100%)",
            border: "3px solid #fff",
            borderRadius: 12,
            padding: "30px 40px",
            marginTop: 30,
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(252, 107, 4, 0.4)"
          }}>
            <div style={{ fontSize: 18, color: "#fff", opacity: 0.95, marginBottom: 8, letterSpacing: 2, fontWeight: "600" }}>
              ESTIMATE TOTAL
              {hasAdjustment && (
                <span style={{ fontSize: 12, opacity: 0.8, marginLeft: 8 }}>
                  (ADJUSTED)
                </span>
              )}
            </div>
            <div style={{ fontSize: 56, color: "#fff", fontWeight: "bold", letterSpacing: 1 }}>
              ${getFinalTotal().toFixed(2)}
            </div>
            {hasAdjustment && (
              <div style={{ fontSize: 14, color: "#fff", opacity: 0.7, marginTop: 8 }}>
                Original: ${(grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice).toFixed(2)}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* PRICE ADJUSTMENT MODAL */}
      <PriceAdjustment
        originalTotal={grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice}
        onAdjustmentApplied={handlePriceAdjustment}
        onClose={() => setShowPriceAdjustment(false)}
        show={showPriceAdjustment}
      />
    </div>
  );
}

export default function Estimate({ mode = "full" }) {
  const isQuick = mode === "quick";
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get section and estimateId from URL query params
  const [searchParams] = useSearchParams();
  const currentSection = searchParams.get('section') || 'lighting';
  const urlEstimateId = searchParams.get('estimateId'); // For loading existing estimates
  const isChangeOrder = searchParams.get('type') === 'changeorder'; // Check if this is a change order
  const coNumber = searchParams.get('coNumber'); // Get CO number for display
  const coId = searchParams.get('coId'); // Get CO ID for saving to change_order_items
  
  // ===== REFS =====
  const itemRefs = useRef([]);
  const dropdownRef = useRef(null);
  const qtyRefs = useRef([]);

  // ===== CONSTANTS =====
  const LABOR_RATE = 85;

  // ===== STATE =====
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [currentEstimateId, setCurrentEstimateId] = useState(null);
  const [materialsDB, setMaterialsDB] = useState([]);
  const [assembliesDB, setAssembliesDB] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [rows, setRows] = useState([
    { item: "", qty: 1, unit: "ea", materialPrice: 0, laborHours: 0, laborMultiplier: 1.0, laborRate: LABOR_RATE, wasteFactor: 0 },
  ]);
  const [rowsSection, setRowsSection] = useState(currentSection); // Track which section these rows belong to
  const [openIndex, setOpenIndex] = useState(null);
  
  // Assembly expansion state
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [assemblyComponents, setAssemblyComponents] = useState({}); // Store components by row index
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [editingAssemblyIndex, setEditingAssemblyIndex] = useState(null);
  const [expandedAssemblyItems, setExpandedAssemblyItems] = useState(new Set());
  
  // Convert to Assembly modal state
  const [showConvertToAssemblyModal, setShowConvertToAssemblyModal] = useState(false);
  const [convertingRowIndex, setConvertingRowIndex] = useState(null);
  const [assemblyBuildComponents, setAssemblyBuildComponents] = useState([]);
  const [assemblyBuildSearch, setAssemblyBuildSearch] = useState("");
  const [saveToAssemblyManager, setSaveToAssemblyManager] = useState(false);
  const [existingAssemblyPick, setExistingAssemblyPick] = useState(null);
  
  // Save Assembly Modal state
  const [showSaveAssemblyModal, setShowSaveAssemblyModal] = useState(false);
  const [saveAssemblyName, setSaveAssemblyName] = useState("");
  const [saveAssemblyCategory, setSaveAssemblyCategory] = useState("ASSEMBLIES");
  const [saveAssemblyRowIndex, setSaveAssemblyRowIndex] = useState(null);
  const [saveAssemblySource, setSaveAssemblySource] = useState("inline"); // "inline" or "modal"
  
  // Alternates state
  const [availableAlternates, setAvailableAlternates] = useState([]);
  const [currentAlternate, setCurrentAlternate] = useState(0); // 0 = Base Bid
  const [showCreateAlternate, setShowCreateAlternate] = useState(false);
  const [newAlternateTitle, setNewAlternateTitle] = useState("");
  
  // Project Header State
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimateNumber, setEstimateNumber] = useState("");
  
  // Markup State
  const [overheadPercent, setOverheadPercent] = useState(10);
  const [profitPercent, setProfitPercent] = useState(15);
  const [laborCostRate, setLaborCostRate] = useState(25); // What you PAY per hour
  const [laborMarkupPercent, setLaborMarkupPercent] = useState(50); // Markup %

  // Organization State
  const [phase, setPhase] = useState("");
  const [subPhase, setSubPhase] = useState("");
  const [level, setLevel] = useState("");
  const [subLevel, setSubLevel] = useState("");
  
  // Catalog Search
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL ITEMS");
  
  // Selected material from catalog
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  
  // Editing state for double-click cells
  const [editingCell, setEditingCell] = useState(null); // format: "rowIndex-fieldName"
  
  // Assembly clipboard state (copy/paste components between rows)
  const [copiedAssemblyChildren, setCopiedAssemblyChildren] = useState(null); // Array of children objects
  const [copiedAssemblyName, setCopiedAssemblyName] = useState(""); // Name of source assembly

  // Add custom item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: '',
    category: 'Custom',
    price: 0,
    laborHours: 0
  });

  // ===== SMART SEARCH FUNCTION =====
  // Handles shorthand like "emt12" → "1/2" EMT, "122mc" → "12/2 MC Cable", etc.
  const smartSearch = (itemName, searchTerm) => {
    if (!searchTerm || !itemName) return true;
    const name = itemName.toLowerCase();
    const term = searchTerm.toLowerCase().trim();
    
    // Direct substring match first
    if (name.includes(term)) return true;
    
    // Stripped match: remove all special chars and compare
    const stripChars = (s) => s.replace(/[^a-z0-9]/g, '');
    const nameStripped = stripChars(name);
    const termStripped = stripChars(term);
    if (nameStripped.includes(termStripped)) return true;
    
    // Conduit size shorthand map (e.g., "12" → "1/2")
    const conduitSizeMap = {
      '12': '1/2', '34': '3/4', '14': '1/4', '38': '3/8',
      '18': '1/8', '112': '1-1/2', '114': '1-1/4', '212': '2-1/2',
      '312': '3-1/2'
    };
    
    // Wire gauge map (e.g., "122" → "12/2", "143" → "14/3")
    const wireGaugeMap = {
      '122': '12/2', '123': '12/3', '124': '12/4',
      '142': '14/2', '143': '14/3', '144': '14/4',
      '102': '10/2', '103': '10/3', '104': '10/4',
      '82': '8/2', '83': '8/3', '84': '8/4',
      '62': '6/2', '63': '6/3', '64': '6/4',
      '42': '4/2', '43': '4/3',
      '832': '8/3/2', '1032': '10/3/2',
    };
    
    // Combined map for expanding shorthand
    const allMaps = { ...conduitSizeMap, ...wireGaugeMap };
    
    // Try to expand the search term using wire gauge first (longer patterns)
    // e.g., "122mc" → check if starts with "122" → expand to "12/2" + "mc"
    const expandTerm = (t) => {
      // Try wire gauge patterns first (3-digit before 2-digit)
      const sorted = Object.keys(allMaps).sort((a, b) => b.length - a.length);
      for (const key of sorted) {
        if (t.startsWith(key)) {
          return [allMaps[key], ...expandTerm(t.slice(key.length))];
        }
      }
      // If no map match, return the term itself if non-empty
      return t ? [t] : [];
    };
    
    // Split search into letter/number groups
    const parts = term.match(/[a-z\/\-]+|[0-9\/]+/g);
    if (parts && parts.length >= 1) {
      // For each part, try to expand it
      const expandedParts = [];
      for (const p of parts) {
        // Check if it's a pure number that maps to a size/gauge
        if (/^[0-9]+$/.test(p) && allMaps[p]) {
          expandedParts.push(allMaps[p]);
        } else {
          expandedParts.push(p);
        }
      }
      
      // Also try expanding the entire stripped term as one unit
      const fullExpanded = expandTerm(termStripped);
      
      // Check if ALL expanded parts match
      const allPartsMatch = expandedParts.every(p => name.includes(p));
      if (allPartsMatch && expandedParts.length > 0) return true;
      
      // Check full expansion
      if (fullExpanded.length > 0) {
        const fullMatch = fullExpanded.every(p => name.includes(p));
        if (fullMatch) return true;
      }
    }
    
    // Split search by spaces and match all words (with expansion)
    const words = term.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const expandedWords = words.map(w => {
        const stripped = stripChars(w);
        return allMaps[stripped] || w;
      });
      if (expandedWords.every(w => name.includes(w))) return true;
      
      // Also try: each word individually stripped-matched
      if (expandedWords.every(w => nameStripped.includes(stripChars(w)))) return true;
    }
    
    return false;
  };

  const materials = materialsDB;

  const categories = [
    "All",
    ...Array.from(
      new Set(
        (materialsDB ?? []).map(m => m?.category || "Uncategorized")
      )
    ),
  ];

  const filteredMaterials =
    categoryFilter === "All"
      ? materials
      : materials.filter(
          (m) => m.category === categoryFilter
        );

  // ===== LOAD MATERIALS =====
  useEffect(() => {
    loadAllMaterials();
    loadAssemblies();
  }, [user]);

  async function loadAllMaterials() {
    try {
      // Load base materials from database (PRIMARY SOURCE)
      const { data: baseMaterials, error: baseError } = await supabase
        .from('base_materials')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .range(0, 99999); // Load all materials
      
      if (baseError) {
        console.error('Error loading base materials:', baseError);
      }
      
      // Load custom materials from database
      const { data: customMaterials, error: customError } = await supabase
        .from('custom_materials')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      // Format materials to match existing structure
      const formattedBaseMaterials = (baseMaterials || []).map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        unit: m.unit,
        price: m.basecost,
        laborHours: m.laborhours
      }));
      
      const formattedCustomMaterials = (customMaterials || []).map(cm => ({
        id: cm.id,
        name: cm.name,
        category: cm.category,
        description: cm.description,
        unit: cm.unit,
        price: cm.price,
        laborHours: cm.labor_hours
      }));
      
      // Combine all materials (base materials + custom)
      const allMaterials = [
        ...formattedBaseMaterials,
        ...formattedCustomMaterials
      ];
      
      setMaterialsDB(allMaterials);
      console.log(`✅ Loaded ${allMaterials.length} total materials (${formattedBaseMaterials.length} base + ${formattedCustomMaterials.length} custom)`);
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  }

  async function loadAssemblies() {
    try {
      const { data, error } = await supabase
        .from("assemblies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAssembliesDB(data || []);
    } catch (err) {
      console.error("Error loading assemblies:", err);
    }
  }

  // ===== LOAD PROJECT AND ESTIMATE DATA =====
  useEffect(() => {
    if (projectId && user) {
      loadProjectAndEstimateData();
    }
  }, [projectId, user]);

  // ===== REMOVED: rowsSection sync effect =====
  // rowsSection is now ONLY updated when actual row data is set (in loadSectionData and autoSaveEstimate)
  // This prevents the race condition where rowsSection updates to the new section
  // but rows still contains the old section's data.

  // ===== LOAD SECTION DATA WHEN SECTION CHANGES OR PAGE FIRST LOADS =====
  // Track if we've loaded initial data to prevent overwriting user's first item
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  // Track if we're in the middle of loading section data (prevents auto-save race condition)
  const [isLoadingSection, setIsLoadingSection] = useState(false);
  // Ref to track the previous section for saving before switch
  const prevSectionRef = useRef(currentSection);
  
  useEffect(() => {
    const prevSection = prevSectionRef.current;
    prevSectionRef.current = currentSection;
    
    // When switching TO summary, we DON'T need to load section data or do immediate saves
    // The EstimateSummary component handles its own data loading via loadAllSections()
    // Previously, calling autoSaveEstimate here (DELETE then INSERT) caused a race condition
    // where the Summary's loadAllSections() would query items while they were deleted.
    if (currentSection === 'summary') {
      // Just do a quick save of the previous section data if needed (no delete-reinsert)
      if (prevSection !== currentSection && hasLoadedInitialData && (currentEstimateId || (isChangeOrder && coId))) {
        const validRows = rows.filter(r => r.item.trim() !== "");
        if (validRows.length > 0) {
          console.log(`💾 IMMEDIATE SAVE: Saving "${prevSection}" before switching to Summary`);
          autoSaveEstimate(prevSection); // Save old section data NOW
        }
      }
      return; // Don't call loadSectionData for summary - EstimateSummary handles it
    }
    
    if (currentEstimateId || (isChangeOrder && coId)) {
      // CRITICAL FIX: Save the PREVIOUS section's data immediately before loading new section
      // This prevents data loss when switching sections within the 2-second auto-save window
      if (prevSection !== currentSection && hasLoadedInitialData) {
        const validRows = rows.filter(r => r.item.trim() !== "");
        if (validRows.length > 0) {
          console.log(`💾 IMMEDIATE SAVE: Saving "${prevSection}" before switching to "${currentSection}"`);
          autoSaveEstimate(prevSection); // Save old section data NOW (not on a timer)
        }
      }
      
      // Clear expansion state BEFORE loading data
      setExpandedAssemblyItems(new Set());
      console.log('🔄 Clearing expanded items state before load');
      loadSectionData();
    }
  }, [currentSection]); // Only reload when section changes, NOT when estimateId changes
  
  // Separate effect for initial load
  useEffect(() => {
    if ((currentEstimateId || (isChangeOrder && coId)) && !hasLoadedInitialData) {
      loadSectionData();
      setHasLoadedInitialData(true);
    }
  }, [currentEstimateId, coId]); // Only run once when IDs first become available

  // ===== LOAD SECTION DATA =====
  async function loadSectionData() {
    // Change orders load from different table
    if (isChangeOrder && coId) {
      try {
        console.log(`🔍 Loading CO section: "${currentSection}" for coId: ${coId}`);
        
        const { data, error } = await supabase
          .from("change_order_items")
          .select("*")
          .eq("change_order_id", coId)
          .eq("section", currentSection)
          .order("sequence");

        if (error) throw error;

        console.log(`📦 CO items found for "${currentSection}":`, data?.length || 0);

      if (data && data.length > 0) {
        console.log('📦 Raw items from DB:', data.length);
        
        // Separate parents from children
        const parents = data.filter(item => !item.parent_id);
        const children = data.filter(item => item.parent_id);
        
        console.log('Parents:', parents.length, 'Children:', children.length);
        
        // DEBUG: Log all parent items to see what we're dealing with
        console.log('🔍 ALL PARENT ITEMS:');
        parents.forEach((parent, idx) => {
          console.log(`  ${idx + 1}. "${parent.description}" | Qty: ${parent.quantity} | Section: "${parent.section}" | ID: ${parent.id}`);
        });
        
        // DEDUPLICATE PARENTS - keep only first occurrence of each description
        const uniqueParents = [];
        const seenDescriptions = new Map(); // Track by description+qty+section
        const duplicatesToDelete = []; // Track IDs to delete from DB
        
        parents.forEach(parent => {
          const key = `${parent.description}-${parent.quantity}-${parent.section}`;
          console.log(`  Checking key: "${key}"`);
          
          if (!seenDescriptions.has(key)) {
            seenDescriptions.set(key, parent.id);
            uniqueParents.push(parent);
            console.log(`    ✅ KEEPING (first occurrence)`);
          } else {
            duplicatesToDelete.push(parent.id);
            console.warn(`    ⚠️  DUPLICATE FOUND - will skip (keeping id: ${seenDescriptions.get(key)})`);
          }
        });
        
        console.log(`✅ Deduplicated: ${parents.length} → ${uniqueParents.length} parents`);
        if (duplicatesToDelete.length > 0) {
          console.log(`🗑️  Found ${duplicatesToDelete.length} duplicates with IDs: [${duplicatesToDelete.join(', ')}]`);
        }
        
        // Build rows array with nested structure
        const loadedRows = [];
        uniqueParents.forEach((parent) => {
          const parentChildren = children.filter(child => child.parent_id === parent.id);
          const hasChildren = parentChildren.length > 0;
          
          // Convert children's numeric fields to proper Numbers
          const convertedChildren = parentChildren.map(child => ({
            ...child,
            quantity: Number(child.quantity || 0),
            material_unit_cost: Number(child.material_unit_cost || 0),
            material_total: Number(child.material_total || 0),
            labor_hours: Number(child.labor_hours || 0),
            labor_multiplier: Number(child.labor_multiplier || 1),
            labor_rate: Number(child.labor_rate || LABOR_RATE),
            labor_total: Number(child.labor_total || 0),
            line_total: Number(child.line_total || 0)
          }));
          
          loadedRows.push({
            id: parent.id,
            item: parent.description,
            qty: Number(parent.quantity || 0),
            unit: parent.unit,
            materialPrice: Number(parent.material_unit_cost || 0),
            laborHours: Number(parent.labor_hours || 0),
            laborMultiplier: Number(parent.labor_multiplier || 1.0),
            laborRate: Number(parent.labor_rate || LABOR_RATE),
            wasteFactor: Number(parent.waste_factor || 0),
            lineType: parent.line_type,
            parentId: null,
            isAssembly: hasChildren, // Mark as assembly if has children
            children: convertedChildren // Use converted children with proper Numbers
          });
        });
        
        console.log('✅ Loaded rows:', loadedRows.length);
        setRows(loadedRows);
        setRowsSection(currentSection);
} else {
  // No data found - clear rows
  console.log('📭 No items found for this section, clearing rows');
  setRows([{ item: "", qty: 1, unit: "ea", materialPrice: 0, laborHours: 0, laborMultiplier: 1.0, laborRate: LABOR_RATE, wasteFactor: 0 }]);
  setRowsSection(currentSection);
}
      } catch (err) {
        console.error("Error loading CO section data:", err);
      }
      return;
    }
    
    // Regular estimates load from estimate_items
    if (!currentEstimateId) return;
    
    try {
      console.log(`🔍 Loading section: "${currentSection}"`);
      
      const { data, error } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", currentEstimateId)
        .eq("section", currentSection)
        .order("sequence");

      if (error) throw error;

      console.log(`📦 Items found for "${currentSection}":`, data?.length || 0);
      data?.forEach((item, idx) => {
        console.log(`  Item ${idx}: "${item.description}" - section: "${item.section}"`);
      });

      if (data && data.length > 0) {
        console.log('📦 Raw items from DB:', data.length);
        
        // Separate parents from children
        const parents = data.filter(item => !item.parent_id);
        const children = data.filter(item => item.parent_id);
        
        console.log('Parents:', parents.length, 'Children:', children.length);
        
        // DEDUPLICATE PARENTS - keep only first occurrence of each description
        const uniqueParents = [];
        const seenDescriptions = new Map(); // Track by description+qty+section
        parents.forEach(parent => {
          const key = `${parent.description}-${parent.quantity}-${parent.section}`;
          if (!seenDescriptions.has(key)) {
            seenDescriptions.set(key, parent.id);
            uniqueParents.push(parent);
          } else {
            console.warn(`⚠️  Skipping duplicate: "${parent.description}" (id: ${parent.id}, keeping id: ${seenDescriptions.get(key)})`);
          }
        });
        
        console.log(`✅ Deduplicated: ${parents.length} → ${uniqueParents.length} parents`);
        
        // Build rows array with nested structure
        const loadedRows = [];
        uniqueParents.forEach((parent) => {
          const parentChildren = children.filter(child => child.parent_id === parent.id);
          const hasChildren = parentChildren.length > 0;
          
          // Convert children's numeric fields to proper Numbers (SAME AS CHANGE ORDERS)
          const convertedChildren = parentChildren.map(child => ({
            ...child,
            quantity: Number(child.quantity || 0),
            material_unit_cost: Number(child.material_unit_cost || 0),
            material_total: Number(child.material_total || 0),
            labor_hours: Number(child.labor_hours || 0),
            labor_multiplier: Number(child.labor_multiplier || 1),
            labor_rate: Number(child.labor_rate || LABOR_RATE),
            labor_total: Number(child.labor_total || 0),
            line_total: Number(child.line_total || 0)
          }));
          
          loadedRows.push({
            id: parent.id,
            item: parent.description,
            qty: Number(parent.quantity || 0),
            unit: parent.unit,
            materialPrice: Number(parent.material_unit_cost || 0),
            laborHours: Number(parent.labor_hours || 0),
            laborMultiplier: Number(parent.labor_multiplier || 1.0),
            laborRate: Number(parent.labor_rate || LABOR_RATE),
            wasteFactor: Number(parent.waste_factor || 0),
            lineType: parent.line_type,
            parentId: null,
            isAssembly: hasChildren, // Mark as assembly if has children
            children: convertedChildren // Use converted children with proper Numbers
          });
        });
        
        console.log('✅ Loaded rows:', loadedRows.length);
        setRows(loadedRows);
        setRowsSection(currentSection);
      } else {
        // Always clear rows when switching sections and no data found
        setRows([{ item: "", qty: 1, unit: "ea", materialPrice: 0, laborHours: 0, laborMultiplier: 1.0, laborRate: LABOR_RATE, wasteFactor: 0 }]);
        setRowsSection(currentSection);
      }
    } catch (err) {
      console.error("Error loading section data:", err);
    }
  }

  async function loadProjectAndEstimateData() {
    try {
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      
      if (projectData) {
        setProjectName(projectData.name || "");
        // For commercial projects, use contractor as customer
        setCustomerName(projectData.contractor || projectData.customer || "");
        setProjectLocation(projectData.address || "");
      }

      // Check if there's an estimateId in URL - if so, load it
      if (urlEstimateId) {
        await loadExistingEstimate(urlEstimateId);
      } else if (isChangeOrder && coId) {
        // Change orders use coId, mark as ready for auto-save
        setHasLoadedInitialData(true);
        setRowsSection(currentSection);
      } else {
        // FIX: For new estimates (no estimateId in URL), mark as ready immediately.
        // Previously this was never set, creating a deadlock where:
        // - auto-save required hasLoadedInitialData=true
        // - hasLoadedInitialData required currentEstimateId
        // - currentEstimateId required auto-save to create the estimate
        const newEstimateNumber = await generateEstimateNumber();
        setEstimateNumber(newEstimateNumber);
        setHasLoadedInitialData(true); // No existing data to load, ready for auto-save
        setRowsSection(currentSection);
      }
    } catch (err) {
      console.error("Error loading project:", err);
      alert("Failed to load project data");
    }
  }

  async function generateEstimateNumber() {
    try {
      // Get ALL estimates for this company to find the highest number
      const { data, error } = await supabase
        .from("estimates")
        .select("estimate_number")
        .eq("company_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Look for estimates that are pure numbers (1001, 1002) or have EST-#### format
      let highestNumber = 1000;
      
      if (data && data.length > 0) {
        data.forEach(est => {
          if (est.estimate_number) {
            let num = 0;
            
            // Check if it's a pure number (like "1001" or "1002")
            if (/^\d+$/.test(est.estimate_number)) {
              num = parseInt(est.estimate_number);
            } 
            // Check if it's EST-#### format (like "EST-1001")
            else if (est.estimate_number.startsWith('EST-')) {
              const match = est.estimate_number.match(/EST-(\d+)/);
              if (match) {
                num = parseInt(match[1]);
              }
            }
            
            // Only consider numbers >= 1000 (our format)
            if (num >= 1000 && num > highestNumber) {
              highestNumber = num;
            }
          }
        });
      }

      return String(highestNumber + 1);
    } catch (err) {
      console.error("Error generating estimate number:", err);
      return "1001";
    }
  }

  async function loadExistingEstimate(estimateId) {
    try {
      // Load estimate header
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) throw estimateError;

      if (estimateData) {
        setCurrentEstimateId(estimateData.id);
        setEstimateNumber(estimateData.estimate_number);
        setEstimateDate(estimateData.estimate_date);
        setOverheadPercent(estimateData.overhead_percent || 10);
        setProfitPercent(estimateData.profit_percent || 15);
        
        // Load alternate info
        setCurrentAlternate(estimateData.alternate_number || 0);
        setNewAlternateTitle(estimateData.alternate_title || "Base Bid");
        
        // Section data will be loaded by the useEffect that watches currentEstimateId
      }
    } catch (err) {
      console.error("Error loading existing estimate:", err);
    }
  }

  // ===== UPDATE CHANGE ORDER TOTAL =====
  async function updateChangeOrderTotal(changeOrderId) {
    try {
      // Get all items for this change order
      const { data: items } = await supabase
        .from("change_order_items")
        .select("material_total, labor_total")
        .eq("change_order_id", changeOrderId);
      
      if (items) {
        const total = items.reduce((sum, item) => 
          sum + (item.material_total || 0) + (item.labor_total || 0), 0);
        
        // Update change_orders table with the calculated total
        await supabase
          .from("change_orders")
          .update({ total })
          .eq("id", changeOrderId);
        
        console.log(`✅ Updated change order ${changeOrderId} total: $${total.toFixed(2)}`);
      }
    } catch (err) {
      console.error("Error updating change order total:", err);
    }
  }

  // ===== AUTO-SAVE EFFECT =====
  useEffect(() => {
    if (!projectId || !user) return;
    if (!hasLoadedInitialData) return; // Don't auto-save until initial data is loaded!
    
    // CRITICAL: Don't auto-save if rowsSection doesn't match currentSection
    // This prevents saving stale data from the old section to the new section
    // during the brief window between section switch and data load completion
    if (rowsSection !== currentSection) {
      console.log(`⏸️ Auto-save skipped: rowsSection="${rowsSection}" !== currentSection="${currentSection}"`);
      return;
    }
    
    // Use the tracked rowsSection, not currentSection
    const sectionToSave = rowsSection;
    
    const timeoutId = setTimeout(() => {
      autoSaveEstimate(sectionToSave);
    }, 2000); // Auto-save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [rows, overheadPercent, profitPercent, phase, subPhase, level, subLevel, projectId, user, rowsSection, currentSection, hasLoadedInitialData]);

  // ===== AUTO-SAVE FUNCTION =====
  async function autoSaveEstimate(sectionToSave) {
    if (!projectId || !user) return;
    
    const validRows = rows.filter(r => r.item.trim() !== "");
    
    // ===== CHANGE ORDER SAVE LOGIC =====
    if (isChangeOrder && coId) {
      console.log(`💾 Attempting CO save: ${validRows.length} items for section "${sectionToSave}", coId: ${coId}`);
      setAutoSaving(true);
      try {
        // Delete old items for this section
        console.log(`🗑️ Deleting old items for section "${sectionToSave}"...`);
        const { error: deleteError } = await supabase
          .from("change_order_items")
          .delete()
          .eq("change_order_id", coId)
          .eq("section", sectionToSave);
        
        if (deleteError) {
          console.error("Delete error:", deleteError);
          throw deleteError;
        }
        
        // If no valid rows, just clear and exit
        if (validRows.length === 0) {
          console.log("✅ No items to save, section cleared");
          setLastSaved(new Date());
          setAutoSaving(false);
          return;
        }
        
 // Step 1: Insert parents FIRST
const parentItems = [];
let sequence = 0;

for (const row of validRows) {
  parentItems.push({
    change_order_id: coId,
    section: sectionToSave,
    sequence: sequence++,
    description: row.item,
    quantity: Number(row.qty || 0),
    unit: row.unit || 'ea',
    material_unit_cost: Number(row.materialPrice || 0),
    material_total: materialTotal(row),
    waste_factor: Number(row.wasteFactor || 0),
    labor_hours: Number(row.laborHours || 0),
    labor_multiplier: Number(row.laborMultiplier || 1),
    labor_rate: Number(row.laborRate || LABOR_RATE),
    labor_total: laborTotal(row),
    equipment_total: 0,
    subcontractor_cost: 0,
    line_total: lineTotal(row),
    parent_id: null
  });
}

        console.log(`📝 Inserting ${parentItems.length} parent items`);
        const { data: insertedParents, error: parentError } = await supabase
          .from("change_order_items")
          .insert(parentItems)
          .select('id');
        
        if (parentError) {
          console.error("❌ Parent insert error:", parentError);
          throw parentError;
        }
        
        console.log(`✅ Parents inserted:`, insertedParents?.length);
        
        // Step 2: NOW insert children with correct parent_id
        const childItems = [];
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const parentId = insertedParents[i].id;
          
          if (row.children && row.children.length > 0) {
            for (const child of row.children) {
              childItems.push({
                change_order_id: coId,
                section: sectionToSave,
                sequence: sequence++,
                description: child.description,
                quantity: Number(child.quantity || 0),
                unit: child.unit || 'ea',
                material_unit_cost: Number(child.material_unit_cost || 0),
                material_total: Number(child.material_total || 0),
                waste_factor: 0,
                labor_hours: Number(child.labor_hours || 0),
                labor_multiplier: Number(child.labor_multiplier || 1),
                labor_rate: Number(child.labor_rate || LABOR_RATE),
                labor_total: Number(child.labor_total || 0),
                equipment_total: 0,
                subcontractor_cost: 0,
                line_total: Number(child.line_total || 0),
                parent_id: parentId
              });
            }
          }
        }
        
        // Insert children if any
        if (childItems.length > 0) {
          console.log(`📝 Inserting ${childItems.length} child items`);
          const { error: childError } = await supabase
            .from("change_order_items")
            .insert(childItems);
          
          if (childError) {
            console.error("❌ Child insert error:", childError);
            throw childError;
          }
          console.log(`✅ Children inserted successfully`);
        }
        
        console.log("✅ Items inserted successfully!");
        
        // Update change_orders total
        console.log(`💰 Updating total for coId: ${coId}...`);
        await updateChangeOrderTotal(coId);
        
        setLastSaved(new Date());
        console.log("✅ CO auto-save complete!");
      } catch (err) {
        console.error("❌ CO auto-save error:", err);
      } finally {
        setAutoSaving(false);
      }
      return; // Exit early for change orders
    }
    
    // ===== REGULAR ESTIMATE SAVE LOGIC =====
    
    // If no valid rows but we have an estimate ID, we should clear this section
    if (validRows.length === 0 && currentEstimateId) {
      setAutoSaving(true);
      try {
        // Delete all items for this section
        await supabase
          .from("estimate_items")
          .delete()
          .eq("estimate_id", currentEstimateId)
          .eq("section", sectionToSave);
        
        setLastSaved(new Date());
      } catch (err) {
        console.error("Auto-save delete error:", err);
      } finally {
        setAutoSaving(false);
      }
      return;
    }
    
    // If no valid rows and no estimate ID, nothing to save
    if (validRows.length === 0) return;

    setAutoSaving(true);
    try {
      // DON'T update estimate header during line item edits
      // Total will be calculated in Summary page (like change orders)
      
      if (currentEstimateId) {
        // Just update line items, not the estimate header

        // Delete old items for THIS SECTION ONLY
        await supabase
          .from("estimate_items")
          .delete()
          .eq("estimate_id", currentEstimateId)
          .eq("section", sectionToSave);

        // Step 1: Insert parents FIRST
        const parentItems = [];
        let sequence = 0;

        for (const row of validRows) {
          parentItems.push({
            estimate_id: currentEstimateId,
            line_type: 'material',
            section: sectionToSave,
            sequence: sequence++,
            description: row.item,
            quantity: Number(row.qty || 0),
            unit: row.unit || 'ea',
            material_unit_cost: Number(row.materialPrice || 0),
            material_total: materialTotal(row),
            waste_factor: Number(row.wasteFactor || 0),
            labor_hours: Number(row.laborHours || 0),
            labor_multiplier: Number(row.laborMultiplier || 1),
            labor_rate: Number(row.laborRate || LABOR_RATE),
            labor_total: laborTotal(row),
            equipment_total: 0,
            subcontractor_cost: 0,
            line_total: lineTotal(row),
            parent_id: null
          });
        }

        console.log(`📝 Inserting ${parentItems.length} parent items`);
        const { data: insertedParents, error: parentError } = await supabase
          .from("estimate_items")
          .insert(parentItems)
          .select('id');
        
        if (parentError) {
          console.error("❌ Parent insert error:", parentError);
          throw parentError;
        }
        
        console.log(`✅ Parents inserted:`, insertedParents?.length);
        
        // Step 2: NOW insert children with correct parent_id
        const childItems = [];
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const parentId = insertedParents[i].id;
          
          if (row.children && row.children.length > 0) {
            for (const child of row.children) {
              childItems.push({
                estimate_id: currentEstimateId,
                line_type: 'material',
                section: sectionToSave,
                sequence: sequence++,
                description: child.description,
                quantity: Number(child.quantity || 0),
                unit: child.unit || 'ea',
                material_unit_cost: Number(child.material_unit_cost || 0),
                material_total: Number(child.material_total || 0),
                waste_factor: 0,
                labor_hours: Number(child.labor_hours || 0),
                labor_multiplier: Number(child.labor_multiplier || 1),
                labor_rate: Number(child.labor_rate || LABOR_RATE),
                labor_total: Number(child.labor_total || 0),
                equipment_total: 0,
                subcontractor_cost: 0,
                line_total: Number(child.line_total || 0),
                parent_id: parentId
              });
            }
          }
        }
        
        // Insert children if any
        if (childItems.length > 0) {
          console.log(`📝 Inserting ${childItems.length} child items`);
          const { error: childError } = await supabase
            .from("estimate_items")
            .insert(childItems);
          
          if (childError) {
            console.error("❌ Child insert error:", childError);
            throw childError;
          }
          console.log(`✅ Children inserted successfully`);
        }
      } else {
        // Create new estimate header (minimal - total calculated in Summary)
        const { data: estimate, error: estimateError } = await supabase
          .from("estimates")
          .insert([{
            company_id: user.id,
            project_id: projectId,
            project_name: projectName,
            estimate_number: estimateNumber,
            estimate_date: estimateDate,
            status: 'draft',
          }])
          .select()
          .single();

        if (estimateError) throw estimateError;

        setCurrentEstimateId(estimate.id);

        const lineItems = validRows.map((row, index) => ({
          estimate_id: estimate.id,
          line_type: 'material',
          section: sectionToSave,
          sequence: index,
          description: row.item,
          quantity: Number(row.qty || 0),
          unit: row.unit || 'ea',
          material_unit_cost: Number(row.materialPrice || 0),
          material_total: materialTotal(row),
          waste_factor: Number(row.wasteFactor || 0),
          labor_hours: Number(row.laborHours || 0),
          labor_multiplier: Number(row.laborMultiplier || 1),
          labor_rate: Number(row.laborRate || LABOR_RATE),
          labor_total: laborTotal(row),
          equipment_total: 0,
          subcontractor_cost: 0,
          line_total: lineTotal(row),
        }));

        await supabase.from("estimate_items").insert(lineItems);
      }

      setLastSaved(new Date());
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  }

  // ===== CLICK OUTSIDE DROPDOWN =====
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ===== UPDATE ROW =====
  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    
    // If item name changed, try to find the material and update prices
    if (field === "item") {
      const material = materials.find(m => m.name === value);
      if (material) {
        updated[index].materialPrice = material.price || 0;
        updated[index].laborHours = material.laborHours || 0;
      }
    }
    
    setRows(updated);
  };

  // ===== DELETE ROW =====
  const deleteRow = (index) => {
    const updated = rows.filter((_, i) => i !== index);
    // If all rows deleted, add one empty row
    if (updated.length === 0) {
      setRows([{ item: "", qty: 1, materialPrice: 0, laborHours: 0, laborRate: LABOR_RATE, wasteFactor: 0 }]);
    } else {
      setRows(updated);
    }
  };

  const materialTotal = (row) => {
    // If row has children (assembly), sum up all children's material totals
    if (row.children && row.children.length > 0) {
      return row.children.reduce((sum, child) => {
        const childQty = Number(child.quantity || 0);
        const childPrice = Number(child.material_unit_cost || 0);
        return sum + (childQty * childPrice);
      }, 0) * Number(row.qty || 1); // Multiply by parent quantity
    }
    
    // Regular item calculation
    const qty = Number(row.qty || 0);
    const price = Number(row.materialPrice || 0);
    const waste = Number(row.wasteFactor || 0);
    const qtyWithWaste = qty * (1 + waste / 100);
    return qtyWithWaste * price;
  };

  const laborTotal = (row) => {
    // If row has children (assembly), sum up all children's labor totals
    if (row.children && row.children.length > 0) {
      return row.children.reduce((sum, child) => {
        const childQty = Number(child.quantity || 0);
        const childHours = Number(child.labor_hours || 0);
        const childMult = Number(child.labor_multiplier || 1);
        const childRate = Number(child.labor_rate || LABOR_RATE);
        return sum + (childQty * childHours * childMult * childRate);
      }, 0) * Number(row.qty || 1); // Multiply by parent quantity
    }
    
    // Regular item calculation
    const qty = Number(row.qty || 0);
    const hours = Number(row.laborHours || 0);
    const multiplier = Number(row.laborMultiplier || 1);
    const rate = Number(row.laborRate || LABOR_RATE);
    return qty * hours * multiplier * rate;
  };

  const lineTotal = (row) => {
    return materialTotal(row) + laborTotal(row);
  };

  const subtotal = rows.reduce((sum, r) => sum + lineTotal(r), 0);
  const overheadAmount = subtotal * (overheadPercent / 100);
  const profitAmount = subtotal * (profitPercent / 100);
  // Note: Total is now calculated and auto-saved by the Summary component
  const total = subtotal + overheadAmount + profitAmount;

  // ===== SAVE ESTIMATE =====
  async function handleSaveEstimate() {
    if (!projectId) {
      alert("Cannot save estimate - no project selected");
      return;
    }

    // Filter out empty rows
    const validRows = rows.filter(r => r.item.trim() !== "");
    
    if (validRows.length === 0) {
      alert("Please add at least one line item to the estimate");
      return;
    }

    setSaving(true);
    try {
      // Calculate subtotals for the estimate
      const materialSubtotal = validRows.reduce((sum, r) => sum + materialTotal(r), 0);
      const laborSubtotal = validRows.reduce((sum, r) => sum + laborTotal(r), 0);

      // Create the estimate header
      const estimateData = {
        company_id: user?.id,
        project_id: projectId,
        project_name: projectName,
        customer_name: customerName,
        project_location: projectLocation,
        estimate_date: estimateDate,
        estimate_number: estimateNumber,
        default_labor_rate: LABOR_RATE,
        overhead_percent: overheadPercent,
        profit_percent: profitPercent,
        material_subtotal: materialSubtotal,
        labor_subtotal: laborSubtotal,
        equipment_subtotal: 0,
        subcontractor_subtotal: 0,
        subtotal: subtotal,
        overhead_amount: overheadAmount,
        profit_amount: profitAmount,
        total: total,
        status: 'draft',
      };

      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert([estimateData])
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Create estimate line items
      const lineItems = validRows.map((row, index) => ({
        estimate_id: estimate.id,
        line_type: 'material',
        section: currentSection,
        sequence: index,
        description: row.item,
        quantity: Number(row.qty || 0),
        unit: 'ea',
        material_unit_cost: Number(row.materialPrice || 0),
        material_total: materialTotal(row),
        waste_factor: Number(row.wasteFactor || 0),
        labor_hours: Number(row.laborHours || 0),
        labor_rate: Number(row.laborRate || LABOR_RATE),
        labor_total: laborTotal(row),
        equipment_total: 0,
        subcontractor_cost: 0,
        line_total: lineTotal(row),
      }));

      const { error: itemsError } = await supabase
        .from("estimate_items")
        .insert(lineItems);

      if (itemsError) throw itemsError;

      alert(`Estimate saved successfully! Estimate #${estimateNumber}`);
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error("Error saving estimate:", err);
      alert("Failed to save estimate: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (materialsDB.length === 0) {
    return <div>Loading...</div>;
  }

  // ===== SUMMARY VIEW =====
  if (currentSection === 'summary') {
    return <EstimateSummary projectId={projectId} currentEstimateId={currentEstimateId} navigate={navigate} projectName={projectName} isChangeOrder={isChangeOrder} coNumber={coNumber} coId={coId} />;
  }

  return (
    <>
      {/* PAGE CONTAINER */}
      <div
        style={{
          padding: 0,
          fontFamily: "Arial",
          display: "flex",
          gap: 0,
          height: "100vh",
          overflow: "hidden",
          maxHeight: "100vh"
        }}
      >
        {/* MAIN CONTENT AREA */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          maxHeight: "100vh",
          padding: 0,
          marginLeft: 0,
          marginRight: 80, // Minimal margin - let content expand
          overflow: "hidden",
          boxSizing: "border-box"
        }}>
        {/* TOP BAR - Only show when linked to a project */}
        {projectId && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 20, flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, color: "#f97316", fontSize: 24 }}>
                {projectName || "Loading..."}
                {isChangeOrder && coNumber && (
                  <span style={{ color: "#ef4444", marginLeft: 10, fontSize: 20, fontWeight: "bold" }}>
                    - {coNumber} Change Order
                  </span>
                )}
                {!isChangeOrder && currentEstimateId && newAlternateTitle && newAlternateTitle !== "Base Bid" && (
                  <span style={{ color: "#8b5cf6", marginLeft: 10, fontSize: 20 }}>
                    - {newAlternateTitle}
                  </span>
                )}
              </h2>
              {/* Auto-save indicator */}
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                {autoSaving ? (
                  <span style={{ color: "#f59e0b" }}>⏳ Auto-saving...</span>
                ) : lastSaved ? (
                  <span style={{ color: "#10b981" }}>✓ Saved {new Date(lastSaved).toLocaleTimeString()}</span>
                ) : (
                  <span>Start adding items to auto-save</span>
                )}
              </div>
            </div>
            <div>
            </div>
          </div>
        )}
        {/* SECTION BUTTONS */}
        <div style={{ 
          display: "flex", 
          gap: 20, 
          marginBottom: 6,
          justifyContent: "center",
          flexShrink: 0
        }}>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=lighting${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'lighting' ? styles.activeSection : {})
            }}
          >
             Lighting
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=power${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'power' ? styles.activeSection : {})
            }}
          >
             Power
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=branch${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'branch' ? styles.activeSection : {})
            }}
          >
             Branch
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=switchgear${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'switchgear' ? styles.activeSection : {})
            }}
          >
             SwitchGear
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=feeders${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'feeders' ? styles.activeSection : {})
            }}
          >
             Feeders
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=equipment${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'equipment' ? styles.activeSection : {})
            }}
          >
             Equipment
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=special${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton,
              ...(currentSection === 'special' ? styles.activeSection : {})
            }}
          >
            Special Sys.
          </button>
          <button 
            onClick={() => navigate(`/project/${projectId}/estimate?section=summary${isChangeOrder ? '&type=changeorder' : ''}${coNumber ? `&coNumber=${coNumber}` : ''}${coId ? `&coId=${coId}` : ''}`)}
            style={{ 
              ...styles.sectionButton, 
              ...(currentSection === 'summary' ? styles.activeSection : {}),
              backgroundColor: currentSection === 'summary' ? "#fc6b04ff" : "transparent",
              color: currentSection === 'summary' ? "#fff" : "#fff",
              border: currentSection === 'summary' ? "none" : "2px solid #fff"
            }}
          >
            Summary
          </button>
        </div>

        {/* ORGANIZATION TOOLBAR */}
        <div style={{
          background: "#2a2a2a",
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid #444",
          marginBottom: 0,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          flexShrink: 0
        }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
              
            </label>
            <input
              type="text"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              placeholder="Phase (e.g., Rough-In)"
              style={{
                width: "100%",
                padding: "4px 12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
              
            </label>
            <input
              type="text"
              value={subPhase}
              onChange={(e) => setSubPhase(e.target.value)}
              placeholder="Level (e.g., First Floor)"
              style={{
                width: "100%",
                padding: "4px 12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
              
            </label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Area (e.g., Lobby)"
              style={{
                width: "100%",
                padding: "4px 12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
             
            </label>
            <input
              type="text"
              value={subLevel}
              onChange={(e) => setSubLevel(e.target.value)}
              placeholder="Sub Area (e.g., Office)"
              style={{
                width: "100%",
                padding: "4px 12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14
              }}
            />
          </div>
        </div>

        {/* QUICK ADD LINE BUTTON */}
        <div style={{ 
          marginBottom: 12, 
          display: "flex", 
          gap: 12,
          alignItems: "center"
        }}>
          <button
            onClick={() => {
              const newRow = {
                item: "",
                qty: 1,
                unit: "ea",
                materialPrice: 0,
                laborHours: 0,
                laborMultiplier: 1.0,
                laborRate: LABOR_RATE,
                wasteFactor: 0
              };
              setRows([...rows, newRow]);
              
              // Scroll to bottom to show the new row
              setTimeout(() => {
                const tableContainer = document.querySelector('[style*="overflowY: auto"]');
                if (tableContainer) {
                  tableContainer.scrollTop = tableContainer.scrollHeight;
                }
              }, 100);
            }}
            style={{
              padding: "10px 20px",
              background: "#10b981",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            ➕ Quick Line Item
          </button>
          <span style={{ color: "#999", fontSize: 12 }}>
            Add a blank line to enter custom items manually
          </span>
        </div>

        {/* CLIPBOARD INDICATOR BAR */}
        {copiedAssemblyChildren && copiedAssemblyChildren.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 14px",
            marginBottom: 6,
            background: "#1a3a2a",
            border: "1px solid #10b981",
            borderRadius: 6,
            flexShrink: 0
          }}>
            <span style={{ color: "#10b981", fontSize: 12, fontWeight: "bold" }}>
              📋 Copied: <span style={{ color: "#fff" }}>{copiedAssemblyName}</span> ({copiedAssemblyChildren.length} components)
              <span style={{ color: "#999", marginLeft: 8, fontWeight: "normal" }}>— click "📋 Paste" on any line item to apply</span>
            </span>
            <button
              onClick={() => {
                setCopiedAssemblyChildren(null);
                setCopiedAssemblyName("");
              }}
              style={{
                background: "none",
                border: "1px solid #555",
                borderRadius: 4,
                color: "#999",
                fontSize: 11,
                cursor: "pointer",
                padding: "2px 8px"
              }}
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* TABLE */}
        <div style={{ 
          flex: 1,
          overflowY: "auto", 
          marginBottom: 20,
          border: "1px solid #444",
          borderRadius: 8,
          minHeight: 0
        }}>
        <table style={{
          width: "100%", 
          borderCollapse: "collapse"
        }}>
          <thead style={{ 
            position: "sticky",
            top: 0,
            background: "#2a2a2a",
            zIndex: 10
          }}>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={{ 
                width: 30,
                padding: "10px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "center"
              }}>▼</th>
              <th style={{ 
                width: 40,
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "center"
              }}>🗑️</th>
              <th style={{ 
                textAlign: "center", 
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold"
              }}>Item</th>
              <th style={{ 
                width: 100, 
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "center"
              }}>Qty</th>
              <th style={{ 
                width: 60, 
                padding: "6px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 11,
                fontWeight: "bold",
                textAlign: "center"
              }}>Unit</th>
              <th style={{ 
                width: 80, 
                padding: "6px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 11,
                fontWeight: "bold",
                textAlign: "center"
              }}>Material $</th>
              <th style={{ 
                width: 80, 
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "center"
              }}>Lab Hrs</th>
              <th style={{ 
                width: 70, 
                padding: "6px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 11,
                fontWeight: "bold",
                textAlign: "center"
              }}>Lab Mult</th>
              <th style={{ 
                width: 80, 
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "center"
              }}>Adj Hrs</th>
              <th style={{ 
                width: 110, 
                padding: "12px", 
                borderBottom: "2px solid #444",
                color: "#f97316",
                fontSize: 13,
                fontWeight: "bold",
                textAlign: "right"
              }}>Line $</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <>
              <tr key={i} style={{
                borderBottom: "1px solid #333",
                background: i % 2 === 0 ? "#1a1a1a" : "transparent"
              }}>
                {/* Expand/Collapse OR Convert to Assembly button */}
                <td style={{ width: 40, textAlign: 'center', padding: '8px 4px' }}>
                {r.children && r.children.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedAssemblyItems);
                          if (newExpanded.has(i)) {
                            newExpanded.delete(i);
                          } else {
                            newExpanded.add(i);
                          }
                          setExpandedAssemblyItems(newExpanded);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 16,
                          color: '#3b82f6',
                          padding: 2
                        }}
                      >
                        {expandedAssemblyItems.has(i) ? '▼' : '▶'}
                      </button>
                      <button
                        onClick={() => {
                          setConvertingRowIndex(i);
                          // Pre-populate the modal with existing children
                          const existingComponents = (r.children || []).map(child => ({
                            material_id: child.material_id || null,
                            name: child.description || child.material_name || 'Unknown',
                            quantity: Number(child.quantity || 1),
                            unit: child.unit || 'ea',
                            price: Number(child.material_unit_cost || 0),
                            laborHours: Number(child.labor_hours || 0)
                          }));
                          setAssemblyBuildComponents(existingComponents);
                          setAssemblyBuildSearch("");
                          setExistingAssemblyPick(null);
                          setSaveToAssemblyManager(false);
                          setShowConvertToAssemblyModal(true);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontSize: 10,
                          color: '#f97316',
                          padding: '1px 3px',
                          borderRadius: 3
                        }}
                        title="Edit Assembly - modify component items"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          // Copy assembly children to clipboard (deep copy)
                          const childrenCopy = (r.children || []).map(child => ({
                            description: child.description,
                            quantity: Number(child.quantity || 0),
                            unit: child.unit || 'ea',
                            material_unit_cost: Number(child.material_unit_cost || 0),
                            material_total: Number(child.material_total || 0),
                            labor_hours: Number(child.labor_hours || 0),
                            labor_multiplier: Number(child.labor_multiplier || 1),
                            labor_rate: Number(child.labor_rate || LABOR_RATE),
                            labor_total: Number(child.labor_total || 0),
                            line_total: Number(child.line_total || 0)
                          }));
                          setCopiedAssemblyChildren(childrenCopy);
                          setCopiedAssemblyName(r.item || "Assembly");
                          console.log(`📋 Copied ${childrenCopy.length} components from "${r.item}"`);
                        }}
                        style={{
                          background: copiedAssemblyName === r.item && copiedAssemblyChildren ? '#10b981' : 'none',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontSize: 10,
                          color: copiedAssemblyName === r.item && copiedAssemblyChildren ? '#fff' : '#3b82f6',
                          padding: '1px 3px',
                          borderRadius: 3
                        }}
                        title="Copy assembly components to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  ) : r.item && r.item.trim() !== "" && !r.isAssembly ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => {
                          setConvertingRowIndex(i);
                          setAssemblyBuildComponents([]);
                          setAssemblyBuildSearch("");
                          setExistingAssemblyPick(null);
                          setSaveToAssemblyManager(false);
                          setShowConvertToAssemblyModal(true);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: '#f97316',
                          padding: '2px 4px',
                          borderRadius: 3
                        }}
                        title="Convert to Assembly - add component items"
                      >
                        🔧
                      </button>
                      {copiedAssemblyChildren && copiedAssemblyChildren.length > 0 && (
                        <button
                          onClick={() => {
                            // Paste copied children onto this row, converting it to an assembly
                            const pastedChildren = copiedAssemblyChildren.map(child => ({
                              ...child,
                              id: undefined,
                              parent_id: undefined
                            }));
                            const updatedRows = [...rows];
                            updatedRows[i] = {
                              ...updatedRows[i],
                              isAssembly: true,
                              children: pastedChildren,
                              components: pastedChildren.map(c => ({
                                material_name: c.description,
                                quantity: c.quantity,
                                unit: c.unit,
                                material_unit_cost: c.material_unit_cost,
                                labor_hours: c.labor_hours
                              }))
                            };
                            setRows(updatedRows);
                            // Auto-expand to show children
                            const newExpanded = new Set(expandedAssemblyItems);
                            newExpanded.add(i);
                            setExpandedAssemblyItems(newExpanded);
                            console.log(`📋 Pasted ${pastedChildren.length} components onto "${r.item}"`);
                          }}
                          style={{
                            background: '#10b981',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 9,
                            color: '#fff',
                            padding: '2px 4px',
                            borderRadius: 3,
                            fontWeight: 'bold'
                          }}
                          title={`Paste ${copiedAssemblyChildren.length} components from "${copiedAssemblyName}"`}
                        >
                          📋 Paste
                        </button>
                      )}
                    </div>
                  ) : null}
                </td>
                
                {/* EXISTING: Assembly components expand/collapse column */}
                <td align="center" style={{ padding: "10px 12px" }}>
                  {(() => {
                    // Check if this item is an assembly
                    const isAssembly = r.isAssembly || assembliesDB.some(asm => asm.name === r.item);
                    
                    if (isAssembly) {
                      return (
                        <button
                          onClick={async () => {
                            // If components not loaded yet, load them
                            if (!r.components || r.components.length === 0) {
                              const assembly = assembliesDB.find(asm => asm.name === r.item);
                              if (assembly) {
                                const { data: components } = await supabase
                                  .from("assembly_components")
                                  .select("*")
                                  .eq("assembly_id", assembly.id)
                                  .order("sequence");
                                
                                  // Update the row with components converted to children format
                                  const updatedRows = [...rows];
                                  updatedRows[i] = {
                                    ...updatedRows[i],
                                    isAssembly: true,
                                    assemblyId: assembly.id,
                                    components: components || [],
                                    children: (components || []).map(comp => ({
                                      description: comp.material_name,
                                      quantity: comp.quantity,
                                      unit: comp.unit || 'ea',
                                      material_unit_cost: comp.material_unit_cost || 0,
                                      material_total: (comp.quantity || 0) * (comp.material_unit_cost || 0),
                                      labor_hours: comp.labor_hours || 0,
                                      labor_multiplier: 1,
                                      labor_rate: LABOR_RATE,
                                      labor_total: (comp.quantity || 0) * (comp.labor_hours || 0) * LABOR_RATE,
                                      line_total: ((comp.quantity || 0) * (comp.material_unit_cost || 0)) + ((comp.quantity || 0) * (comp.labor_hours || 0) * LABOR_RATE)
                                    }))
                                  };
                                  setRows(updatedRows);
                              }
                            }
                            
                            // Toggle expansion
                            const newExpanded = new Set(expandedRows);
                            if (newExpanded.has(i)) {
                              newExpanded.delete(i);
                            } else {
                              newExpanded.add(i);
                            }
                            setExpandedRows(newExpanded);
                          }}
                          style={{
                            background: "#fc6b04ff",
                            border: "none",
                            color: "#fc6b04ff",
                
                
                
                            cursor: "pointer",
                            fontSize: 14,
                            padding: 0,
                            fontWeight: "bold"
                          }}
                          title={expandedRows.has(i) ? "Collapse components" : "Expand components"}
                        >
                          {expandedRows.has(i) ? "▼" : "▶"}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </td>
                
                {/* DELETE COLUMN */}
                <td align="center" style={{ padding: "10px 12px" }}>
                  {r.item && (
                    <button
                      onClick={() => deleteRow(i)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 18,
                        padding: 0
                      }}
                      title="Delete item"
                    >
                      🗑️
                    </button>
                  )}
                </td>
                
                <td align="center" style={{ padding: "10px 12px" }}>
                  <input
                    type="text"
                    value={r.item}
                    onChange={(e) => updateRow(i, "item", e.target.value)}
                    placeholder="Enter item name..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "#1a1a1a",
                      border: "1px solid #555",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 14
                    }}
                  />
                </td>

                <td align="center" style={{ padding: "10px 12px" }}>
                  <input
                    ref={(el) => (qtyRefs.current[i] = el)}
                    type="number"
                    value={r.qty}
                    onChange={(e) =>
                      updateRow(i, "qty", e.target.value)
                    }
                    style={{ width: 70 }}
                  />
                </td>

                <td align="center" style={{ padding: "6px 8px" }}>
                  <select
                    value={r.unit || "ea"}
                    onChange={(e) => updateRow(i, "unit", e.target.value)}
                    style={{ width: 50, fontSize: 11, padding: "2px" }}
                  >
                    <option value="ea">ea</option>
                    <option value="ft">ft</option>
                    <option value="lf">lf</option>
                    <option value="sf">sf</option>
                    <option value="cf">cf</option>
                    <option value="box">box</option>
                    <option value="roll">roll</option>
                  </select>
                </td>

                <td align="center" style={{ padding: "10px 12px" }}>
                  {r.children && r.children.length > 0 ? (
                    // Assembly: Show calculated per-unit material cost (read-only)
                    <div style={{ 
                      padding: "8px 12px", 
                      color: "#10b981", 
                      fontWeight: "bold",
                      fontSize: 14,
                      textAlign: "center"
                    }}>
                      ${(materialTotal(r) / Number(r.qty || 1)).toFixed(2)}
                    </div>
                  ) : (
                    // Regular item: Editable input
                    <input
                      type="number"
                      value={r.materialPrice}
                      onChange={(e) =>
                        updateRow(i, "materialPrice", e.target.value)
                      }
                      style={{ width: 80, color: "#10b981" }}
                      step="0.01"
                    />
                  )}
                </td>

                <td align="center" style={{ padding: "10px 12px" }}>
                  {r.children && r.children.length > 0 ? (
                    // Assembly: Show calculated per-unit labor hours (read-only)
                    <div style={{ 
                      padding: "8px 12px", 
                      color: "#3b82f6", 
                      fontWeight: "bold",
                      fontSize: 14,
                      textAlign: "center"
                    }}>
                      {(r.children.reduce((sum, child) => {
                        return sum + (Number(child.quantity || 0) * Number(child.labor_hours || 0) * Number(child.labor_multiplier || 1));
                      }, 0)).toFixed(2)}
                    </div>
                  ) : (
                    // Regular item: Editable input
                    <input
                      type="number"
                      value={r.laborHours}
                      onChange={(e) =>
                        updateRow(i, "laborHours", e.target.value)
                      }
                      style={{ width: 70, color: "#3b82f6" }}
                      step="0.1"
                    />
                  )}
                </td>

                <td align="center" style={{ padding: "4px 6px", position: "relative" }}>
                  <input
                    type="number"
                    value={r.laborMultiplier || 1}
                    onChange={(e) =>
                      updateRow(i, "laborMultiplier", e.target.value)
                    }
                    style={{ width: 50, color: "#f59e0b", fontSize: 11 }}
                    step="0.1"
                    title="Labor multiplier (e.g., 1.5 = 150%)"
                  />
                  {r.item && (
                    <button
                      onClick={() => {
                        if (confirm(`Apply multiplier ${r.laborMultiplier || 1}x to all items?`)) {
                          const updated = rows.map(row => ({
                            ...row,
                            laborMultiplier: row.item ? (r.laborMultiplier || 1) : row.laborMultiplier
                          }));
                          setRows(updated);
                        }
                      }}
                      style={{
                        position: "absolute",
                        right: 2,
                        top: 2,
                        padding: "1px 3px",
                        background: "#f59e0b",
                        border: "none",
                        borderRadius: 2,
                        color: "#000",
                        fontSize: 8,
                        cursor: "pointer",
                        fontWeight: "bold"
                      }}
                      title="Apply to all"
                    >
                      ALL
                    </button>
                  )}
                </td>

                <td align="center" style={{ padding: "10px 12px", color: "#8b5cf6", fontWeight: "bold", fontSize: 14 }}>
                  {(() => {
                    // For assemblies, calculate total hours from children
                    if (r.children && r.children.length > 0) {
                      // Calculate per-unit hours from children (same as Lab Hrs column shows)
                      const perUnitHours = r.children.reduce((sum, child) => {
                        return sum + (Number(child.quantity || 0) * Number(child.labor_hours || 0) * Number(child.labor_multiplier || 1));
                      }, 0);
                      // Multiply by parent quantity and multiplier
                      return (Number(r.qty || 1) * perUnitHours * Number(r.laborMultiplier || 1)).toFixed(2);
                    }
                    // For regular items, use the row's labor hours
                    return (Number(r.qty || 0) * Number(r.laborHours || 0) * Number(r.laborMultiplier || 1)).toFixed(2);
                  })()}
                </td>

                <td
                  align="right"
                  style={{ fontWeight: "bold", padding: "10px 12px", color: "#fff" }}
                >
                  {materialTotal(r).toFixed(2)}
                </td>
              </tr>
              
              {/* NEW: Child Rows (if expanded) */}
              {expandedAssemblyItems.has(i) && r.children && r.children.length > 0 && (
                <>
                  {/* Child Table Header Row */}
                  <tr style={{
                    backgroundColor: '#1a1a1a',
                    borderTop: '2px solid #fc6b04ff',
                    borderBottom: '2px solid #fc6b04ff'
                  }}>
                    <td colSpan="3"></td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'left'
                    }}>
                      Item
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      width: 70
                    }}>
                      Qty
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      width: 60
                    }}>
                      Unit
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'right',
                      width: 80
                    }}>
                      Mat Cost
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'right',
                      width: 80
                    }}>
                      Mat Ext
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      width: 70
                    }}>
                      Lbr Hrs
                    </td>
                    <td style={{ 
                      padding: '8px 12px',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'right',
                      width: 80
                    }}>
                      Lbr Ext
                    </td>
                    <td></td>
                  </tr>
                  
                  {/* Child Item Rows */}
                  {r.children.map((child, childIdx) => {
                    const matExt = child.quantity * child.material_unit_cost;
                    const lbrExt = child.quantity * child.labor_hours;
                    
                    return (
                      <tr key={`${i}-child-${childIdx}`} style={{
                        backgroundColor: '#000d19',
                        borderBottom: '1px solid #333'
                      }}>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td style={{ 
                          paddingLeft: 32,
                          padding: '6px 12px',
                          color: '#ccc',
                          fontSize: 12
                        }}>
                          <span style={{ color: '#f16d07', marginRight: 8 }}>↳</span>
                          {child.description}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 12px' }}>
                          <input
                            type="number"
                            value={child.quantity}
                            onChange={(e) => {
                              const newQty = Number(e.target.value) || 0;
                              const updatedRows = [...rows];
                              updatedRows[i].children[childIdx].quantity = newQty;
                              updatedRows[i].children[childIdx].material_total = newQty * child.material_unit_cost;
                              updatedRows[i].children[childIdx].labor_total = newQty * child.labor_hours * (child.labor_multiplier || 1) * (child.labor_rate || 85);
                              updatedRows[i].children[childIdx].line_total = updatedRows[i].children[childIdx].material_total + updatedRows[i].children[childIdx].labor_total;
                              setRows(updatedRows);
                            }}
                            style={{
                              width: 60,
                              padding: '4px 6px',
                              background: '#1a1a1a',
                              border: '1px solid #555',
                              borderRadius: 3,
                              color: '#fff',
                              fontSize: 11,
                              textAlign: 'center'
                            }}
                            step="0.01"
                          />
                        </td>
                        <td style={{ 
                          textAlign: 'center',
                          padding: '6px 12px',
                          color: '#999',
                          fontSize: 11
                        }}>
                          {child.unit}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                          <input
                            type="number"
                            value={child.material_unit_cost}
                            onChange={(e) => {
                              const newCost = Number(e.target.value) || 0;
                              const updatedRows = [...rows];
                              updatedRows[i].children[childIdx].material_unit_cost = newCost;
                              updatedRows[i].children[childIdx].material_total = child.quantity * newCost;
                              updatedRows[i].children[childIdx].line_total = updatedRows[i].children[childIdx].material_total + updatedRows[i].children[childIdx].labor_total;
                              setRows(updatedRows);
                            }}
                            style={{
                              width: 70,
                              padding: '4px 6px',
                              background: '#1a1a1a',
                              border: '1px solid #555',
                              borderRadius: 3,
                              color: '#10b981',
                              fontSize: 11,
                              textAlign: 'right'
                            }}
                            step="0.01"
                          />
                        </td>
                        <td style={{ 
                          textAlign: 'right',
                          padding: '6px 12px',
                          color: '#10b981',
                          fontSize: 12,
                          fontWeight: '600'
                        }}>
                          ${matExt.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 12px' }}>
                          <input
                            type="number"
                            value={child.labor_hours}
                            onChange={(e) => {
                              const newHours = Number(e.target.value) || 0;
                              const updatedRows = [...rows];
                              updatedRows[i].children[childIdx].labor_hours = newHours;
                              updatedRows[i].children[childIdx].labor_total = child.quantity * newHours * (child.labor_multiplier || 1) * (child.labor_rate || 85);
                              updatedRows[i].children[childIdx].line_total = updatedRows[i].children[childIdx].material_total + updatedRows[i].children[childIdx].labor_total;
                              setRows(updatedRows);
                            }}
                            style={{
                              width: 60,
                              padding: '4px 6px',
                              background: '#1a1a1a',
                              border: '1px solid #555',
                              borderRadius: 3,
                              color: '#3b82f6',
                              fontSize: 11,
                              textAlign: 'center'
                            }}
                            step="0.01"
                          />
                        </td>
                        <td style={{ 
                          textAlign: 'right',
                          padding: '6px 12px',
                          color: '#8b5cf6',
                          fontSize: 12,
                          fontWeight: '600'
                        }}>
                          {lbrExt.toFixed(2)} hrs
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#1a1a1a", borderLeft: "4px solid #fc6b04ff" }}>
                    <td colSpan="10" style={{ padding: "8px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => {
                          setSaveAssemblyRowIndex(i);
                          setSaveAssemblyName(r.item || "");
                          setSaveAssemblyCategory(r.assemblyId ? "UPDATE_EXISTING" : "ASSEMBLIES");
                          setSaveAssemblySource("inline");
                          setShowSaveAssemblyModal(true);
                        }}
                        style={{
                          padding: "6px 10px",
                          background: "#8b5cf6",
                          border: "none",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        💾 Save to Assembly
                      </button>
                    </td>
                  </tr>
                </>
              )}
              </>
            ))}
          </tbody>
        </table>
        </div>

        {/* SELECTED MATERIAL BAR */}
        {selectedMaterial && (
          <div style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: 900,
            width: "calc(100% - 48px)",
            background: "#2a2a2a",
            padding: "12px 20px",
            borderRadius: 8,
            border: "2px solid #fc6b04ff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 101,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <span style={{ color: "#f97316", fontWeight: "bold", fontSize: 14 }}>
                Selected:
              </span>
              <span style={{ color: "#fff", fontSize: 14 }}>{selectedMaterial.name}</span>
              <span style={{ color: "#10b981", fontSize: 13 }}>
                ${Number(selectedMaterial.price || 0).toFixed(2)}
              </span>
              <span style={{ color: "#3b82f6", fontSize: 13 }}>
                {Number(selectedMaterial.laborHours || 0).toFixed(1)}h
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  const newRow = {
                    item: selectedMaterial.name,
                    qty: 1,
                    unit: "ea",
                    materialPrice: selectedMaterial.price || 0,
                    laborHours: selectedMaterial.laborHours || 0,
                    laborMultiplier: 1.0,
                    laborRate: LABOR_RATE,
                    wasteFactor: 0
                  };
                  
                  let rowIndex = rows.length;
                  const isFirstRowEmpty = rows.length === 1 && rows[0].item === "";
                  
                  if (isFirstRowEmpty) {
                    setRows([newRow]);
                    rowIndex = 0;
                  } else {
                    setRows([...rows, newRow]);
                  }
                  
                  setSelectedMaterial(null);
                  
                  setTimeout(() => {
                    const targetRef = qtyRefs.current[rowIndex];
                    if (targetRef) {
                      targetRef.focus();
                      targetRef.select();
                    }
                  }, 0);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#fc6b04ff",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                ➕ Add to Estimate
              </button>
              <button
                onClick={() => setSelectedMaterial(null)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid #666",
                  borderRadius: 6,
                  color: "#999",
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                ✕ Clear
              </button>
            </div>
          </div>
        )}

        {/* ADD CUSTOM ITEM MODAL */}
        {showAddItemModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              background: "#2a2a2a",
              border: "2px solid #fc6b04ff",
              borderRadius: 12,
              padding: 30,
              width: 500,
              maxWidth: "90%"
            }}>
              <h3 style={{ margin: "0 0 20px 0", color: "#f97316", fontSize: 20 }}>
                ➕ Add Custom Item
              </h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                  Item Name *
                </label>
                <input
                  type="text"
                  value={customItem.name}
                  onChange={(e) => setCustomItem({...customItem, name: e.target.value})}
                  placeholder="e.g., Special Custom Outlet"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#1a1a1a",
                    border: "1px solid #555",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14
                  }}
                  autoFocus
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                  Category
                </label>
                <select
                  value={customItem.category}
                  onChange={(e) => setCustomItem({...customItem, category: e.target.value})}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#1a1a1a",
                    border: "1px solid #555",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14
                  }}
                >
                  <option value="Custom">Custom</option>
                  {categories.filter(c => c !== "All").map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    value={customItem.price}
                    onChange={(e) => setCustomItem({...customItem, price: Number(e.target.value)})}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "#1a1a1a",
                      border: "1px solid #555",
                      borderRadius: 6,
                      color: "#10b981",
                      fontSize: 14
                    }}
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                    Labor Hours *
                  </label>
                  <input
                    type="number"
                    value={customItem.laborHours}
                    onChange={(e) => setCustomItem({...customItem, laborHours: Number(e.target.value)})}
                    placeholder="0.0"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "#1a1a1a",
                      border: "1px solid #555",
                      borderRadius: 6,
                      color: "#3b82f6",
                      fontSize: 14
                    }}
                    step="0.1"
                  />
                </div>
              </div>
              
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowAddItemModal(false);
                    setCustomItem({ name: '', category: 'Custom', price: 0, laborHours: 0 });
                  }}
                  style={{
                    padding: "10px 20px",
                    background: "transparent",
                    border: "1px solid #666",
                    borderRadius: 6,
                    color: "#999",
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!customItem.name.trim()) {
                      alert("Please enter an item name");
                      return;
                    }
                    
                    try {
                      // Save to database
                      const { data, error } = await supabase
                        .from("custom_materials")
                        .insert([{
                          company_id: user.id,
                          name: customItem.name,
                          category: customItem.category,
                          description: 'Custom item',
                          unit: 'ea',
                          price: customItem.price,
                          labor_hours: customItem.laborHours,
                          is_active: true
                        }])
                        .select()
                        .single();

                      if (error) throw error;

                      // Add to local materials list with consistent property names
                      const newMaterial = {
                        id: data.id,
                        name: data.name,
                        category: data.category,
                        description: data.description,
                        unit: data.unit,
                        price: data.price,
                        laborHours: data.labor_hours
                      };
                      
                      setMaterialsDB([...materialsDB, newMaterial]);
                      setSelectedMaterial(newMaterial);
                      setShowAddItemModal(false);
                      setCustomItem({ name: '', category: 'Custom', price: 0, laborHours: 0 });
                      
                      alert(`✓ "${newMaterial.name}" saved to database!`);
                    } catch (err) {
                      console.error("Error saving custom material:", err);
                      alert("Failed to save custom material: " + err.message);
                    }
                  }}
                  style={{
                    padding: "10px 24px",
                    background: "#fc6b04ff",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                  disabled={!customItem.name.trim()}
                >
                  ➕ Add Item
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* RIGHT SIDEBAR - MATERIALS CATALOG */}
        <div style={{
          width: 'clamp(250px, 20vw, 320px)', // Responsive: narrower for laptop screens
          background: "#2a2a2a",
          borderLeft: "1px solid #444",
          display: "flex",
          flexDirection: "column",
          overflow: "auto", // Make entire sidebar scrollable
          padding:0,
          position: "fixed",
          top: "80px",
          right: 6,
          bottom: 0,
          zIndex: 900
        }}>
          
          {/* Top Buttons - Aligned */}
          <div style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            borderBottom: "1px solid #444"
          }}>
            <button
              onClick={() => navigate(`/project/${projectId}`)}
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "#f97316",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => navigate(`/project/${projectId}/plans`)}
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "#10b981",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              📐 Takeoff
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8, paddingLeft: 20 }}>
            {/* Categories Table */}
            <div>
              <div style={{ color: "#f97316", fontSize: 11, fontWeight: "bold", marginBottom: 10 }}>
                CATEGORIES
              </div>
              <div style={{
                maxHeight: 150,
                overflowY: "auto",
                border: "1px solid #444",
                borderRadius: 10
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <tbody>
                    <tr 
                      style={{
                        borderBottom: "1px solid #333",
                        cursor: "pointer",
                        background: selectedCategory === "ALL ITEMS" ? "#444" : "transparent"
                      }}
                      onMouseEnter={(e) => { if (selectedCategory !== "ALL ITEMS") e.currentTarget.style.background = "#333" }}
                      onMouseLeave={(e) => { if (selectedCategory !== "ALL ITEMS") e.currentTarget.style.background = "transparent" }}
                      onClick={() => setSelectedCategory("ALL ITEMS")}
                    >
                      <td style={{ padding: "4px 8px", color: "#fff", fontSize: 11 }}>
                        📋 ALL ITEMS
                      </td>
                    </tr>
                    <tr 
                      style={{
                        borderBottom: "1px solid #333",
                        cursor: "pointer",
                        background: selectedCategory === "ASSEMBLIES" ? "#444" : "transparent"
                      }}
                      onMouseEnter={(e) => { if (selectedCategory !== "ASSEMBLIES") e.currentTarget.style.background = "#333" }}
                      onMouseLeave={(e) => { if (selectedCategory !== "ASSEMBLIES") e.currentTarget.style.background = "transparent" }}
                      onClick={() => setSelectedCategory("ASSEMBLIES")}
                    >
                      <td style={{ padding: "4px 8px", color: "#fff", fontSize: 11 }}>
                        🔧 ASSEMBLIES
                      </td>
                    </tr>
                    {categories
                      .filter(c => c !== "All" && c !== "ASSEMBLIES")
                      .map((category) => (
                        <tr 
                          key={category}
                          style={{
                            borderBottom: "1px solid #333",
                            cursor: "pointer",
                            background: selectedCategory === category ? "#444" : "transparent"
                          }}
                          onMouseEnter={(e) => { if (selectedCategory !== category) e.currentTarget.style.background = "#333" }}
                          onMouseLeave={(e) => { if (selectedCategory !== category) e.currentTarget.style.background = "transparent" }}
                          onClick={() => setSelectedCategory(category)}
                        >
                          <td style={{ padding: "4px 8px", color: "#fff", fontSize: 11 }}>
                            {category}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
           

            {/* Items Table */}
            <div>
              <input
                type="text"
                placeholder="🔍 Search items..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                style={{
                  width: "95%",
                  padding: "10px 10px",
                  marginBottom: 0,
                  background: "#1a1a1a",
                  border: "1px solid #555",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 11
                }}
              />
              <div style={{
                maxHeight: 250,
                overflowY: "auto",
                border: "1px solid #444",
                borderRadius: 10
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#1a1a1a", zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #444", color: "#f97316", fontSize: 11 }}>
                        Item
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #444", color: "#f97316", fontSize: 11, width: 60 }}>
                        Price
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #444", color: "#f97316", fontSize: 11, width: 50 }}>
                        Hrs
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #444", color: "#f97316", fontSize: 11, width: 50 }}>
                        +
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Show Assemblies if ASSEMBLIES category selected */}
                    {selectedCategory === "ASSEMBLIES" ? (
                      assembliesDB
                        .filter(assembly => 
                          assembly.name.toLowerCase().includes(catalogSearch.toLowerCase())
                        )
                        .map((assembly) => (
                          <tr 
                            key={assembly.id}
                            style={{
                              borderBottom: "1px solid #333",
                              cursor: "pointer",
                              transition: "background 0.1s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            onClick={() => {
                              setSelectedMaterial({
                                name: assembly.name,
                                price: assembly.total_material_cost || 0,
                                laborHours: assembly.total_labor_hours || 0
                              });
                            }}
                          >
                            <td style={{ padding: "4px 8px", color: "#fff", fontSize: 11 }}>
                              🔧 {assembly.name}
                            </td>
                            <td style={{ padding: "4px 8px", color: "#10b981", fontSize: 11, textAlign: "right" }}>
                              ${Number(assembly.total_material_cost || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: "4px 8px", color: "#3b82f6", fontSize: 11, textAlign: "right" }}>
                              {Number(assembly.total_labor_hours || 0).toFixed(1)}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "center" }}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  
                                    // Load assembly components from database
                                    const { data: components, error } = await supabase
                                      .from("assembly_components")
                                      .select("*")
                                      .eq("assembly_id", assembly.id)
                                      .order("sequence");
                                    
                                    // Calculate per-unit costs from components
                                    const perUnitMaterialCost = (components || []).reduce((sum, comp) => {
                                      return sum + (Number(comp.quantity || 0) * Number(comp.material_unit_cost || 0));
                                    }, 0);
                                    
                                    const perUnitLaborHours = (components || []).reduce((sum, comp) => {
                                      return sum + (Number(comp.quantity || 0) * Number(comp.labor_hours || 0));
                                    }, 0);
                                    
                                    const newRow = {
                                      item: assembly.name,
                                      qty: 1,
                                      unit: "ea",
                                      materialPrice: perUnitMaterialCost, // Use calculated per-unit cost
                                      laborHours: perUnitLaborHours, // Use calculated per-unit hours
                                      laborMultiplier: 1.0,
                                      laborRate: LABOR_RATE,
                                      wasteFactor: 0,
                                      isAssembly: true,
                                      assemblyId: assembly.id,
                                      components: components || [],
                                      children: (components || []).map(comp => ({
                                        description: comp.material_name,
                                        quantity: Number(comp.quantity || 0),
                                        unit: comp.unit || 'ea',
                                        material_unit_cost: Number(comp.material_unit_cost || 0),
                                        material_total: Number(comp.quantity || 0) * Number(comp.material_unit_cost || 0),
                                        labor_hours: Number(comp.labor_hours || 0),
                                        labor_multiplier: 1,
                                        labor_rate: LABOR_RATE,
                                        labor_total: Number(comp.quantity || 0) * Number(comp.labor_hours || 0) * LABOR_RATE,
                                        line_total: (Number(comp.quantity || 0) * Number(comp.material_unit_cost || 0)) + (Number(comp.quantity || 0) * Number(comp.labor_hours || 0) * LABOR_RATE)
                                      }))
                                    };
                                  
                                  const newRows = [...rows];
                                  const isFirstRowEmpty = rows.length === 1 && rows[0].item === "";
                                  
                                  if (isFirstRowEmpty) {
                                    newRows[0] = newRow;
                                  } else {
                                    newRows.push(newRow);
                                  }
                                  
                                  setRows(newRows);
                                  
                                  // Store components in state by row index
                                  const rowIndex = isFirstRowEmpty ? 0 : newRows.length - 1;
                                  setAssemblyComponents(prev => ({
                                    ...prev,
                                    [rowIndex]: components || []
                                  }));
                                  
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                style={{
                                  padding: "2px 8px",
                                  background: "#fc6b04ff",
                                  border: "none",
                                  borderRadius: 3,
                                  color: "#fff",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  fontWeight: "bold"
                                }}
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      /* Show Materials */
                      materials
                        .filter(material => {
                          // Filter by selected category
                          const categoryMatch = selectedCategory === "ALL ITEMS" || material.category === selectedCategory;
                          // Filter by search
                          const searchMatch = smartSearch(material.name, catalogSearch);
                          return categoryMatch && searchMatch;
                        })
                        .map((material) => (
                        <tr 
                          key={material.name}
                          style={{
                            borderBottom: "1px solid #333",
                            cursor: "pointer",
                            transition: "background 0.1s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          onClick={() => {
                            setSelectedMaterial(material);
                          }}
                        >
                          <td style={{ padding: "4px 8px", color: "#fff", fontSize: 11 }}>
                            {material.name}
                          </td>
                          <td style={{ padding: "4px 8px", color: "#10b981", fontSize: 11, textAlign: "right" }}>
                            ${Number(material.price || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "4px 8px", color: "#3b82f6", fontSize: 11, textAlign: "right" }}>
                            {Number(material.laborHours || 0).toFixed(1)}
                          </td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newRow = {
                                  item: material.name,
                                  qty: 1,
                                  materialPrice: material.price || 0,
                                  laborHours: material.laborHours || 0,
                                  laborRate: LABOR_RATE,
                                  wasteFactor: 0
                                };
                                setRows([...rows, newRow]);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              style={{
                                padding: "2px 8px",
                                background: "#fc6b04ff",
                                border: "none",
                                borderRadius: 3,
                                color: "#fff",
                                fontSize: 11,
                                cursor: "pointer",
                                fontWeight: "bold"
                              }}
                            >
                              +
                            </button>
                          </td>
                        </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Panel */}
            <div style={{ flex: 1, paddingLeft: 10, paddingRight: 20, borderLeft: "1px solid #444" }}>
              <div style={{ color: "#f97316", fontSize: 14, fontWeight: "bold", marginBottom: 2}}>
                PAGE SUMMARY
              </div>
              <div style={{
                background: "#1a1a1a",
                border: "1px solid #444",
                borderRadius: 10,
                padding: 25
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "#999" }}>Materials:</span>
                  <span style={{ color: "#10b981", fontWeight: "bold" }}>
                    ${rows.reduce((sum, r) => sum + materialTotal(r), 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: "#999" }}>Labor Hours:</span>
                  <span style={{ color: "#8b5cf6", fontWeight: "bold" }}>
                    {rows.reduce((sum, r) => {
                      // For assemblies, calculate from children
                      if (r.children && r.children.length > 0) {
                        const perUnitHours = r.children.reduce((childSum, child) => {
                          return childSum + (Number(child.quantity || 0) * Number(child.labor_hours || 0) * Number(child.labor_multiplier || 1));
                        }, 0);
                        return sum + (Number(r.qty || 1) * perUnitHours * Number(r.laborMultiplier || 1));
                      }
                      // For regular items
                      return sum + (Number(r.qty || 0) * Number(r.laborHours || 0) * Number(r.laborMultiplier || 1));
                    }, 0).toFixed(2)}h
                  </span>
                </div>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  paddingTop: 6,
                  borderTop: "1px solid #444",
                  fontSize: 16
                }}>
                  <span style={{ color: "#f97316", fontWeight: "bold" }}>Materials Total:</span>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>${rows.reduce((sum, r) => sum + materialTotal(r), 0).toFixed(2)}</span>
                </div>
                
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #444" }}>
                  <div style={{ fontSize: 10, color: "#666" }}>
                    Items: {rows.filter(r => r.item.trim() !== "").length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ===== SAVE ASSEMBLY MODAL ===== */}
    {showSaveAssemblyModal && saveAssemblyRowIndex !== null && (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200
      }}>
        <div style={{
          background: "#2a2a2a", border: "2px solid #8b5cf6", borderRadius: 12, padding: 24, width: 450, maxWidth: "90%"
        }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#8b5cf6", fontSize: 20 }}>💾 Save Assembly</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>Assembly Name *</label>
            <input type="text" value={saveAssemblyName} onChange={(e) => setSaveAssemblyName(e.target.value)} placeholder="Enter assembly name..."
              style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #555", borderRadius: 6, color: "#fff", fontSize: 14 }} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 13, fontWeight: "bold" }}>Category</label>
            <select value={saveAssemblyCategory} onChange={(e) => setSaveAssemblyCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #555", borderRadius: 6, color: "#fff", fontSize: 14 }}>
              {rows[saveAssemblyRowIndex]?.assemblyId && <option value="UPDATE_EXISTING">🔄 Update Existing Assembly</option>}
              <option value="ASSEMBLIES">ASSEMBLIES</option>
              {categories.filter(c => c !== "All").map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={() => setShowSaveAssemblyModal(false)}
              style={{ padding: "10px 20px", background: "transparent", border: "1px solid #666", borderRadius: 6, color: "#999", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={async () => {
              if (!saveAssemblyName.trim()) { alert("Please enter an assembly name"); return; }
              const r = rows[saveAssemblyRowIndex];
              const sourceComponents = r.children || r.components || [];
              if (sourceComponents.length === 0) { alert("No components to save!"); return; }
              try {
                const componentsToInsert = sourceComponents.map((comp, idx) => {
                  const compName = comp.material_name || comp.description || comp.name || 'Unknown';
                  const matId = comp.material_id || comp.component_material_id;
                  const safeMatId = (matId && matId !== 'undefined' && matId !== 'null' && String(matId).length > 5) ? String(matId) : `custom_${compName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
                  const qty = Number(comp.quantity || comp.component_quantity || 0);
                  return { 
                    material_name: compName, 
                    material_id: safeMatId, 
                    component_material_id: safeMatId,
                    quantity: qty, 
                    component_quantity: qty,
                    component_quantity_type: comp.component_quantity_type || comp.quantity_type || 'fixed',
                    component_description: comp.component_description || compName,
                    unit: comp.unit || 'ea', 
                    material_unit_cost: Number(comp.material_unit_cost || comp.price || 0), 
                    labor_hours: Number(comp.labor_hours || comp.laborHours || 0), 
                    sequence: idx 
                  };
                });
                const totalMat = componentsToInsert.reduce((s, c) => s + (c.quantity * c.material_unit_cost), 0);
                const totalHrs = componentsToInsert.reduce((s, c) => s + (c.quantity * c.labor_hours), 0);
                if (saveAssemblyCategory === "UPDATE_EXISTING" && r.assemblyId) {
                  await supabase.from("assembly_components").delete().eq("assembly_id", r.assemblyId);
                  const withId = componentsToInsert.map(c => ({ ...c, assembly_id: r.assemblyId }));
                  const { error: compError } = await supabase.from("assembly_components").insert(withId);
                  if (compError) { alert("Failed: " + compError.message); return; }
                  await supabase.from("assemblies").update({ name: saveAssemblyName, total_material_cost: totalMat, total_labor_hours: totalHrs }).eq("id", r.assemblyId);
                  alert(`Assembly "${saveAssemblyName}" updated! (${componentsToInsert.length} components)`);
                } else {
                  const { data: newAsm, error: asmError } = await supabase.from('assemblies').insert([{ name: saveAssemblyName, description: `Created from estimate on ${new Date().toLocaleDateString()}`, category: saveAssemblyCategory, unit: 'ea', is_custom: true, is_active: true, company_id: user?.id, total_material_cost: totalMat, total_labor_hours: totalHrs }]).select().single();
                  if (asmError) throw asmError;
                  const withId = componentsToInsert.map(c => ({ ...c, assembly_id: newAsm.id }));
                  const { error: compError } = await supabase.from('assembly_components').insert(withId);
                  if (compError) { alert("Assembly created but components failed: " + compError.message); return; }
                  const updatedRows2 = [...rows]; updatedRows2[saveAssemblyRowIndex].assemblyId = newAsm.id; setRows(updatedRows2);
                  alert(`Assembly "${saveAssemblyName}" saved! (${componentsToInsert.length} components)`);
                }
                await loadAssemblies();
                setShowSaveAssemblyModal(false);
              } catch (error) { console.error("Error:", error); alert("Failed: " + error.message); }
            }} style={{ padding: "10px 24px", background: "#8b5cf6", border: "none", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>
              💾 Save Assembly
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ===== CONVERT TO ASSEMBLY MODAL ===== */}
    {showConvertToAssemblyModal && convertingRowIndex !== null && rows[convertingRowIndex] && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100
      }}>
        <div style={{
          background: "#2a2a2a",
          border: "2px solid #f97316",
          borderRadius: 12,
          padding: 24,
          width: 750,
          maxWidth: "95%",
          maxHeight: "85vh",
          overflowY: "auto"
        }}>
          {/* Header */}
          <h3 style={{ margin: "0 0 4px 0", color: "#f97316", fontSize: 20 }}>
            🔧 Convert to Assembly
          </h3>
          <div style={{ color: "#ccc", fontSize: 13, marginBottom: 16 }}>
            Convert "<strong style={{ color: "#fff" }}>{rows[convertingRowIndex]?.item}</strong>" (Qty: {rows[convertingRowIndex]?.qty}) into an assembly with component items
          </div>

          {/* OPTION 1: Pick from Existing Assemblies */}
          <div style={{ marginBottom: 16, padding: 12, background: "#1a1a1a", borderRadius: 8, border: "1px solid #444" }}>
            <div style={{ color: "#8b5cf6", fontSize: 13, fontWeight: "bold", marginBottom: 8 }}>
              📦 Quick: Use Existing Assembly
            </div>
            <select
              value={existingAssemblyPick || ""}
              onChange={async (e) => {
                const asmId = e.target.value;
                if (!asmId) { setAssemblyBuildComponents([]); setExistingAssemblyPick(null); return; }
                setExistingAssemblyPick(asmId);
                const { data: components } = await supabase
                  .from("assembly_components")
                  .select("*")
                  .eq("assembly_id", asmId)
                  .order("sequence");
                const buildComps = (components || []).map(comp => ({
                  material_id: comp.material_id || comp.component_material_id,
                  name: comp.material_name || 'Unknown',
                  quantity: Number(comp.quantity || 1),
                  unit: comp.unit || 'ea',
                  price: Number(comp.material_unit_cost || 0),
                  laborHours: Number(comp.labor_hours || 0)
                }));
                setAssemblyBuildComponents(buildComps);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#2a2a2a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13
              }}
            >
              <option value="">-- Select an existing assembly --</option>
              {assembliesDB.map(asm => (
                <option key={asm.id} value={asm.id}>{asm.name} {asm.total_material_cost ? `($${Number(asm.total_material_cost).toFixed(2)})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div style={{ textAlign: "center", color: "#555", marginBottom: 16, fontSize: 12, borderBottom: "1px solid #333", paddingBottom: 12 }}>
            — OR search & add materials manually —
          </div>

          {/* OPTION 2: Search and Add Materials */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#10b981", fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
              🔍 Search Materials to Add
            </div>
            <input
              type="text"
              value={assemblyBuildSearch}
              onChange={(e) => setAssemblyBuildSearch(e.target.value)}
              placeholder="Type to search materials (min 2 chars)..."
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#1a1a1a",
                border: "1px solid #555",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13
              }}
            />
            {/* Search Results */}
            {assemblyBuildSearch.length >= 2 && (
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #444", borderRadius: 4, marginTop: 4, background: "#1a1a1a" }}>
                {materialsDB
                  .filter(m => smartSearch(m.name, assemblyBuildSearch))
                  .slice(0, 25)
                  .map(m => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderBottom: "1px solid #333",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ color: "#fff", fontSize: 12, flex: 1 }}>{m.name}</span>
                      <span style={{ color: "#10b981", fontSize: 11, marginRight: 10 }}>${Number(m.price || 0).toFixed(2)}</span>
                      <span style={{ color: "#3b82f6", fontSize: 11, marginRight: 10 }}>{Number(m.laborHours || 0).toFixed(2)}h</span>
                      <button
                        onClick={() => {
                          setAssemblyBuildComponents([...assemblyBuildComponents, {
                            material_id: m.id,
                            name: m.name,
                            quantity: 1,
                            unit: m.unit || 'ea',
                            price: Number(m.price || 0),
                            laborHours: Number(m.laborHours || 0)
                          }]);
                          setAssemblyBuildSearch("");
                        }}
                        style={{
                          padding: "3px 10px",
                          background: "#10b981",
                          border: "none",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                {materialsDB.filter(m => m.name.toLowerCase().includes(assemblyBuildSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: 12, color: "#666", textAlign: "center", fontSize: 12 }}>No materials found</div>
                )}
              </div>
            )}
          </div>

          {/* Components List */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#f97316", fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
              📋 Assembly Components ({assemblyBuildComponents.length})
            </div>
            {assemblyBuildComponents.length === 0 ? (
              <div style={{ color: "#555", padding: 20, textAlign: "center", fontSize: 13, background: "#1a1a1a", borderRadius: 8, border: "1px dashed #444" }}>
                No components added yet. Search above or pick an existing assembly.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#1a1a1a", borderRadius: 8 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: "#f97316", fontSize: 11 }}>Item</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", color: "#f97316", fontSize: 11, width: 70 }}>Qty</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#f97316", fontSize: 11, width: 80 }}>Price</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#f97316", fontSize: 11, width: 70 }}>Hrs</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#f97316", fontSize: 11, width: 90 }}>Ext $</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", color: "#f97316", fontSize: 11, width: 40 }}>🗑️</th>
                  </tr>
                </thead>
                <tbody>
                  {assemblyBuildComponents.map((comp, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #333" }}>
                      <td style={{ padding: "6px 8px", color: "#fff", fontSize: 12 }}>{comp.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          type="number"
                          value={comp.quantity}
                          onChange={(e) => {
                            const updated = [...assemblyBuildComponents];
                            updated[idx].quantity = Number(e.target.value) || 0;
                            setAssemblyBuildComponents(updated);
                          }}
                          style={{ width: 50, padding: "3px 4px", background: "#2a2a2a", border: "1px solid #555", borderRadius: 3, color: "#fff", fontSize: 11, textAlign: "center" }}
                          step="0.01"
                        />
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={comp.price}
                          onChange={(e) => {
                            const updated = [...assemblyBuildComponents];
                            updated[idx].price = Number(e.target.value) || 0;
                            setAssemblyBuildComponents(updated);
                          }}
                          style={{ width: 65, padding: "3px 4px", background: "#2a2a2a", border: "1px solid #555", borderRadius: 3, color: "#10b981", fontSize: 11, textAlign: "right" }}
                          step="0.01"
                        />
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={comp.laborHours}
                          onChange={(e) => {
                            const updated = [...assemblyBuildComponents];
                            updated[idx].laborHours = Number(e.target.value) || 0;
                            setAssemblyBuildComponents(updated);
                          }}
                          style={{ width: 55, padding: "3px 4px", background: "#2a2a2a", border: "1px solid #555", borderRadius: 3, color: "#3b82f6", fontSize: 11, textAlign: "right" }}
                          step="0.01"
                        />
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#10b981", fontSize: 12, fontWeight: "bold" }}>
                        ${(comp.quantity * comp.price).toFixed(2)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => {
                            setAssemblyBuildComponents(assemblyBuildComponents.filter((_, i) => i !== idx));
                          }}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ borderTop: "2px solid #444", background: "#2a2a2a" }}>
                    <td style={{ padding: "8px", color: "#f97316", fontSize: 12, fontWeight: "bold" }}>TOTAL (per unit)</td>
                    <td></td>
                    <td style={{ padding: "8px", textAlign: "right", color: "#10b981", fontSize: 12, fontWeight: "bold" }}>
                      ${assemblyBuildComponents.reduce((s, c) => s + c.quantity * c.price, 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: "#3b82f6", fontSize: 12, fontWeight: "bold" }}>
                      {assemblyBuildComponents.reduce((s, c) => s + c.quantity * c.laborHours, 0).toFixed(2)}h
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                      ${assemblyBuildComponents.reduce((s, c) => s + c.quantity * c.price, 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Save to Assembly Manager checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={saveToAssemblyManager}
              onChange={(e) => setSaveToAssemblyManager(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ color: "#999", fontSize: 13 }}>Also save to Assembly Manager for future use</span>
          </label>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setShowConvertToAssemblyModal(false);
                setConvertingRowIndex(null);
              }}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid #666",
                borderRadius: 6,
                color: "#999",
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (assemblyBuildComponents.length === 0) {
                  alert("Please add at least one component to the assembly");
                  return;
                }

                // Convert the row to an assembly with children
                const updatedRows = [...rows];
                const row = updatedRows[convertingRowIndex];
                row.isAssembly = true;
                row.children = assemblyBuildComponents.map(comp => ({
                  description: comp.name,
                  quantity: Number(comp.quantity),
                  unit: comp.unit || 'ea',
                  material_unit_cost: Number(comp.price),
                  material_total: Number(comp.quantity) * Number(comp.price),
                  labor_hours: Number(comp.laborHours),
                  labor_multiplier: 1,
                  labor_rate: LABOR_RATE,
                  labor_total: Number(comp.quantity) * Number(comp.laborHours) * LABOR_RATE,
                  line_total: (Number(comp.quantity) * Number(comp.price)) + (Number(comp.quantity) * Number(comp.laborHours) * LABOR_RATE)
                }));
                row.components = assemblyBuildComponents.map(comp => ({
                  material_id: comp.material_id,
                  material_name: comp.name,
                  quantity: Number(comp.quantity),
                  unit: comp.unit || 'ea',
                  material_unit_cost: Number(comp.price),
                  labor_hours: Number(comp.laborHours)
                }));

                setRows(updatedRows);

                // Auto-expand to show the children
                const newExpanded = new Set(expandedAssemblyItems);
                newExpanded.add(convertingRowIndex);
                setExpandedAssemblyItems(newExpanded);

                // Optionally save to Assembly Manager
                if (saveToAssemblyManager) {
                  try {
                    const { data: assemblyData, error: assemblyError } = await supabase
                      .from('assemblies')
                      .insert([{
                        name: row.item,
                        description: `Created from estimate on ${new Date().toLocaleDateString()}`,
                        category: 'ASSEMBLIES',
                        unit: 'ea',
                        is_custom: true,
                        is_active: true,
                        company_id: user?.id,
                        total_material_cost: assemblyBuildComponents.reduce((s, c) => s + c.quantity * c.price, 0),
                        total_labor_hours: assemblyBuildComponents.reduce((s, c) => s + c.quantity * c.laborHours, 0)
                      }])
                      .select()
                      .single();

                    if (assemblyError) throw assemblyError;

                    // Insert components - provide ALL NOT NULL columns
                    const componentsToInsert = assemblyBuildComponents.map((comp, idx) => {
                      const safeMatId = (comp.material_id && comp.material_id !== 'undefined' && comp.material_id !== 'null' && String(comp.material_id).length > 5)
                        ? String(comp.material_id)
                        : `custom_${comp.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
                      const qty = Number(comp.quantity || 0);
                      
                      return {
                        assembly_id: assemblyData.id,
                        material_id: safeMatId,
                        component_material_id: safeMatId,
                        material_name: comp.name,
                        quantity: qty,
                        component_quantity: qty,
                        component_quantity_type: 'fixed',
                        component_description: comp.name,
                        unit: comp.unit || 'ea',
                        material_unit_cost: Number(comp.price || 0),
                        labor_hours: Number(comp.laborHours || 0),
                        sequence: idx
                      };
                    });

                    console.log('📝 Inserting assembly components:', JSON.stringify(componentsToInsert, null, 2));
                    const { error: compError } = await supabase.from('assembly_components').insert(componentsToInsert);
                    if (compError) {
                      console.error('❌ Component insert error:', compError);
                      alert('Assembly created but components failed to save: ' + compError.message);
                    } else {
                      console.log(`✅ ${componentsToInsert.length} components saved`);
                    }
                    
                    // Update row with assembly ID
                    updatedRows[convertingRowIndex].assemblyId = assemblyData.id;
                    setRows([...updatedRows]);
                    
                    await loadAssemblies();
                    console.log(`✅ Assembly "${row.item}" saved to Assembly Manager`);
                  } catch (err) {
                    console.error("Error saving to Assembly Manager:", err);
                    alert("Assembly applied to estimate but failed to save to Assembly Manager: " + err.message);
                  }
                }

                setShowConvertToAssemblyModal(false);
                setConvertingRowIndex(null);
              }}
              disabled={assemblyBuildComponents.length === 0}
              style={{
                padding: "10px 24px",
                background: assemblyBuildComponents.length === 0 ? "#555" : "#f97316",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: "bold",
                cursor: assemblyBuildComponents.length === 0 ? "not-allowed" : "pointer",
                opacity: assemblyBuildComponents.length === 0 ? 0.5 : 1
              }}
            >
              ✅ Apply Assembly ({assemblyBuildComponents.length} items)
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


const styles = {
  sectionButton: {
    padding: "12px 24px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
    transition: "all 0.2s",
  },
  activeSection: {
    backgroundColor: "#fc6b04ff",
    color: "#fff",
    border: "2px solid #fc6b04ff",
    transform: "scale(1.05)",
  }
};

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { loadMaterials } from "../data/materials";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

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
      loadAllSections();
      loadProjectInfo(); // Load project info to get customer name
      if (currentEstimateId) {
        loadSummaryData(); // Only load summary data for regular estimates (not change orders)
      }
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
  }, [sections, grandTotals.materials, materialMarkupAmount, feesTotal, feesMarkupAmount, packagesTotal, packagesMarkupAmount, laborSellPrice, isChangeOrder, coId, currentEstimateId, loading]);
  
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
            </div>
            <div style={{ fontSize: 56, color: "#fff", fontWeight: "bold", letterSpacing: 1 }}>
              ${(grandTotals.materials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice).toFixed(2)}
            </div>
          </div>
        </>
      )}
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
  
  // Add custom item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: '',
    category: 'Custom',
    price: 0,
    laborHours: 0
  });

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

  // ===== SYNC rowsSection WITH currentSection =====
  useEffect(() => {
    setRowsSection(currentSection);
  }, [currentSection]);

  // ===== LOAD SECTION DATA WHEN SECTION CHANGES OR PAGE FIRST LOADS =====
  // Track if we've loaded initial data to prevent overwriting user's first item
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  
  useEffect(() => {
    if (currentEstimateId || (isChangeOrder && coId)) {
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
      } else {
        // Always create fresh estimate (don't auto-load)
        const newEstimateNumber = await generateEstimateNumber();
        setEstimateNumber(newEstimateNumber);
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
    
    // Use the tracked rowsSection, not currentSection
    const sectionToSave = rowsSection; // Always use current section
    
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
                {/* NEW: Expand/Collapse Column for child items */}
                <td style={{ width: 40, textAlign: 'center', padding: '8px 4px' }}>
                  {r.children && r.children.length > 0 && (
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
                        padding: 4
                      }}
                    >
                      {expandedAssemblyItems.has(i) ? '▼' : '▶'}
                    </button>
                  )}
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
                        onClick={async () => {
                          if (confirm("Do you want to save these changes to the Assembly Manager? This will update the assembly for all future uses.")) {
                            try {
                              const assembly = assembliesDB.find(asm => asm.name === r.item);
                              if (assembly && r.assemblyId) {
                                // Delete existing components
                                await supabase
                                  .from("assembly_components")
                                  .delete()
                                  .eq("assembly_id", r.assemblyId);
                                
                                // Insert updated components
                                const componentsToInsert = r.components.map((comp, idx) => ({
                                  assembly_id: r.assemblyId,
                                  material_id: comp.material_id,
                                  material_name: comp.material_name,
                                  quantity: comp.quantity,
                                  unit: comp.unit,
                                  material_unit_cost: comp.material_unit_cost,
                                  labor_hours: comp.labor_hours,
                                  sequence: idx
                                }));
                                
                                await supabase
                                  .from("assembly_components")
                                  .insert(componentsToInsert);
                                
                                alert("Assembly saved successfully!");
                                await loadAssemblies(); // Reload assemblies
                              }
                            } catch (error) {
                              console.error("Error saving assembly:", error);
                              alert("Failed to save assembly: " + error.message);
                            }
                          }
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
                          const searchMatch = material.name.toLowerCase().includes(catalogSearch.toLowerCase());
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

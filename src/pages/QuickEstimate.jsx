import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PriceAdjustment from "../Components/PriceAdjustment";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function QuickEstimate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [estimateId, setEstimateId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [lineItems, setLineItems] = useState([
    { id: 1, description: "", quantity: 1, material: 0, lbrHrs: 0, showInScope: true }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [itemMode, setItemMode] = useState('detailed'); // 'detailed' or 'simple'
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);

  const [projectId, setProjectId] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [showViewChoiceModal, setShowViewChoiceModal] = useState(false);
  const [sending, setSending] = useState(false);
  // The chosen view format — saved permanently with the estimate
  const [viewFormat, setViewFormat] = useState("summary");
  
  // Change Order specific state
  const [isChangeOrder, setIsChangeOrder] = useState(false);
  const [coId, setCoId] = useState(null);
  
  // Price adjustment state
  const [showPriceAdjustment, setShowPriceAdjustment] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState(0);
  const [hasAdjustment, setHasAdjustment] = useState(false);

  // Markup state
  const [materialMarkup, setMaterialMarkup] = useState(0);
  const [laborMarkup, setLaborMarkup] = useState(0);

  // Material autocomplete state
  const [materialsDB, setMaterialsDB] = useState([]);
  const [activeDescDropdown, setActiveDescDropdown] = useState(null); // line item id with open dropdown

  useEffect(() => {
    loadCustomers();
    loadMaterials();
    
    // Check if we're coming from a project
    const projectIdParam = searchParams.get('projectId');
    const projectNameParam = searchParams.get('projectName');
    const customerParam = searchParams.get('customer');
    
    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
    if (projectNameParam) {
      setProjectName(decodeURIComponent(projectNameParam));
    }
    if (customerParam) {
      setCustomerName(decodeURIComponent(customerParam));
    }
    
    // Check if this is a change order
    const coIdParam = searchParams.get('coId');
    const typeParam = searchParams.get('type');
    
    if (coIdParam === 'new' && typeParam === 'changeorder') {
      setIsChangeOrder(true);
    } else if (coIdParam && coIdParam !== 'new') {
      setIsChangeOrder(true);
      setCoId(coIdParam);
      loadExistingChangeOrder(coIdParam);
    }
    
    // If projectId provided, load project details to get customer (only if not already set)
    if (projectIdParam && !customerParam) {
      loadProjectCustomer(projectIdParam);
    }
    
    // Check if we're editing an existing estimate
    const estimateIdParam = searchParams.get('estimateId');
    if (estimateIdParam) {
      setEstimateId(estimateIdParam);
      loadExistingEstimate(estimateIdParam);
    }
  }, [user, searchParams]);

  // Pre-populate email for the email modal whenever customerName is known and customers list is loaded
  useEffect(() => {
    if (customers.length > 0 && customerName.trim() && !emailTo) {
      const cust = customers.find(c =>
        c.customer.toLowerCase().trim() === customerName.toLowerCase().trim()
      );
      if (cust?.email) setEmailTo(cust.email);
    }
  }, [customers, customerName]);

  async function loadProjectCustomer(projectId) {
    try {
      const { data: project, error } = await supabase
        .from("projects")
        .select("customer, contractor")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      if (project) {
        // Use contractor for commercial projects, customer for residential
        const custName = project.contractor || project.customer || "";
        setCustomerName(custName);

        // Also pre-populate customer email for the email modal
        if (custName) {
          const { data: custData } = await supabase
            .from("customers")
            .select("email")
            .ilike("customer", custName)
            .maybeSingle();
          if (custData?.email) setEmailTo(custData.email);
        }
      }
    } catch (err) {
      console.error("Error loading project customer:", err);
    }
  }

  async function loadExistingEstimate(id) {
    setIsLoading(true);
    try {
      // Load estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", id)
        .single();

      if (estimateError) throw estimateError;

      // Load estimate items
      const { data: items, error: itemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", id)
        .order("sequence");

      if (itemsError) throw itemsError;

      // Populate form
      setCustomerName(estimate.customer_name || "");
      setProjectName(estimate.project_name || "");
      // Support both 'notes' and 'description' column names
      setDescription(estimate.notes || estimate.description || "");
      if (estimate.estimate_date) setEstimateDate(estimate.estimate_date);

      // Get hourly rate from first item with labor
      const firstItemWithLabor = items.find(item => item.labor_rate > 0);
      setHourlyRate(firstItemWithLabor?.labor_rate || 0);

      // Restore markup values
      setMaterialMarkup(estimate.material_markup ?? 0);
      setLaborMarkup(estimate.labor_markup ?? 0);
      setViewFormat(estimate.view_format || 'summary');

      console.log("[QuickEstimate] Loaded estimate:", {
        id, notes: estimate.notes, description: estimate.description,
        material_markup: estimate.material_markup, labor_markup: estimate.labor_markup,
        items: items?.length
      });

      // Map items to line items
      if (items && items.length > 0) {
        const mappedItems = items.map((item, index) => ({
          id: index + 1,
          description: item.description || "",
          quantity: item.quantity || 1,
          material: item.material_unit_cost || 0,
          lbrHrs: item.labor_hours || 0,
          showInScope: item.show_in_scope !== false,
        }));
        setLineItems(mappedItems);
      }
    } catch (err) {
      console.error("Error loading estimate:", err);
      alert("Failed to load estimate");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadExistingChangeOrder(id) {
    setIsLoading(true);
    try {
      // Load change order
      const { data: changeOrder, error: coError } = await supabase
        .from("change_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (coError) throw coError;

      // Load change order items (stored in estimate_items with change_order_id)
      const { data: items, error: itemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("change_order_id", id)
        .order("sequence");

      if (itemsError) throw itemsError;

      // Populate form
      setProjectName(changeOrder.project_name || "");
      setDescription(changeOrder.description || "");

      // Get hourly rate from first item with labor
      const firstItemWithLabor = items.find(item => item.labor_rate > 0);
      setHourlyRate(firstItemWithLabor?.labor_rate || 0);

      // Restore markup values
      setMaterialMarkup(changeOrder.material_markup || 0);
      setLaborMarkup(changeOrder.labor_markup || 0);

      // Map items to line items
      if (items && items.length > 0) {
        const mappedItems = items.map((item, index) => ({
          id: index + 1,
          description: item.description || "",
          quantity: item.quantity || 1,
          material: item.material_unit_cost || 0,
          lbrHrs: item.labor_hours || 0,
          showInScope: item.show_in_scope !== false,
        }));
        setLineItems(mappedItems);
      }
    } catch (err) {
      console.error("Error loading change order:", err);
      alert("Failed to load change order");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCustomers() {
    if (!user) {
      console.log("No user yet, skipping customer load");
      return;
    }
    
    try {
      console.log("Loading customers for user:", user.id);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", user.id)
        .order("customer");

      if (error) {
        console.error("ERROR loading customers:", error.message, error);
      }
      
      // If error OR no customers with company_id, load all customers as fallback
      if (error || !data || data.length === 0) {
        console.log("Attempting fallback: loading all customers");
        const { data: allData, error: allError } = await supabase
          .from("customers")
          .select("*")
          .order("customer");
        
        if (!allError && allData) {
          console.log("Loaded customers without company filter:", allData.length);
          setCustomers(allData);
        } else {
          setCustomers([]);
        }
        return;
      }
      
      setCustomers(data || []);
      console.log("Successfully loaded customers:", data?.length || 0);
    } catch (err) {
      console.error("Exception loading customers:", err);
      setCustomers([]);
    }
  }

  async function loadMaterials() {
    try {
      // Try loading with laborhrs first; fall back without it if column doesn't exist
      let baseMats = null;
      let hasLaborHrs = true;

      const { data: withLabor, error: withLaborErr } = await supabase
        .from('base_materials')
        .select('id, name, basecost, laborhours, category')
        .order('name')
        .range(0, 49999);

      if (withLaborErr) {
        console.warn('laborhours column unavailable, retrying without it:', withLaborErr.message);
        hasLaborHrs = false;
        const { data: withoutLabor, error: withoutLaborErr } = await supabase
          .from('base_materials')
          .select('id, name, basecost, category')
          .order('name')
          .range(0, 49999);
        if (withoutLaborErr) console.error('Error loading base_materials:', withoutLaborErr);
        baseMats = withoutLabor;
      } else {
        baseMats = withLabor;
      }

      // Load custom materials — column is 'price'
      const { data: customMats, error: customErr } = await supabase
        .from('custom_materials')
        .select('id, name, price, category');

      if (customErr) console.error('Error loading custom_materials:', customErr);

      const all = [
        ...(baseMats || []).map(m => ({
          id: m.id,
          name: m.name,
          price: Number(m.basecost || 0),
          laborHrs: hasLaborHrs ? Number(m.laborhours || 0) : 0,
          category: m.category || '',
        })),
        ...(customMats || []).map(m => ({
          id: m.id,
          name: m.name,
          price: Number(m.price || 0),
          laborHrs: 0,
          category: m.category || '',
        })),
      ];
      setMaterialsDB(all);
      console.log(`[QuickEstimate] Loaded ${all.length} materials (laborHrs=${hasLaborHrs})`);
    } catch (err) {
      console.error('Error loading materials for autocomplete:', err);
    }
  }

  // Size-code expansion table for trade shorthand (e.g. "150" → "1-1/2")
  const SIZE_EXPANSIONS = {
    '50':  ['1/2', '½'],
    '75':  ['3/4', '¾'],
    '100': ['1"', '1-', ' 1 ', '1 in'],
    '125': ['1-1/4', '1 1/4', '1.25'],
    '150': ['1-1/2', '1 1/2', '1.5'],
    '200': ['2"', '2-', ' 2 ', '2 in'],
    '250': ['2-1/2', '2 1/2', '2.5'],
    '300': ['3"', '3-', ' 3 ', '3 in'],
    '350': ['3-1/2', '3 1/2', '3.5'],
    '400': ['4"', '4-', ' 4 ', '4 in'],
    '500': ['5"', '5-', ' 5 '],
    '600': ['6"', '6-', ' 6 '],
  };

  // Returns up to 10 materials matching the typed text (min 2 chars)
  // Priority: 1) part number (id) match, 2) name/category token match with size expansion
  function getMaterialSuggestions(text) {
    if (!text || text.trim().length < 2) return [];
    const q = text.trim().toLowerCase();

    // 1. Part number (ID) match — sort by ID length so base items (pvc112_) appear before variants (pvc112_45)
    const idMatches = materialsDB
      .filter(m => String(m.id).toLowerCase().includes(q))
      .sort((a, b) => String(a.id).length - String(b.id).length);
    if (idMatches.length > 0) return idMatches.slice(0, 10);

    // 2. Split at letter↔digit boundaries and spaces into tokens
    const tokens = q
      .split(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])|\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // 3. Single token → simple name search
    if (tokens.length <= 1) {
      return materialsDB
        .filter(m => m.name.toLowerCase().includes(q))
        .slice(0, 10);
    }

    // 4. Multi-token: ALL tokens must match name or category (with size expansion)
    return materialsDB.filter(m => {
      const name = m.name.toLowerCase();
      const cat = (m.category || '').toLowerCase();
      return tokens.every(token => {
        if (name.includes(token) || cat.includes(token)) return true;
        const expansions = SIZE_EXPANSIONS[token];
        if (expansions) return expansions.some(exp => name.includes(exp) || cat.includes(exp));
        return false;
      });
    }).slice(0, 10);
  }

  // Select a material suggestion for a line item
  function selectMaterial(itemId, mat, isDetailedMode) {
    setLineItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        description: mat.name,
        // Only fill in cost and labor hours in detailed mode
        ...(isDetailedMode ? {
          ...(mat.price > 0 ? { material: mat.price } : {}),
          ...(mat.laborHrs > 0 ? { lbrHrs: mat.laborHrs } : {}),
        } : {}),
      };
    }));
    setActiveDescDropdown(null);
  }

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems([...lineItems, { id: newId, description: "", quantity: 1, material: 0, lbrHrs: 0, showInScope: true }]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Calculate subtotals for summary
  const getTotalMaterialCost = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.material));
    }, 0);
  };

  const getTotalLaborHours = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.lbrHrs));
    }, 0);
  };

  const getTotalLaborCost = () => {
    return getTotalLaborHours() * Number(hourlyRate);
  };

  const calculateTotal = () => {
    const matCost = getTotalMaterialCost();
    const lbrCost = getTotalLaborCost();
    const matWithMarkup = matCost * (1 + Number(materialMarkup) / 100);
    const lbrWithMarkup = lbrCost * (1 + Number(laborMarkup) / 100);
    return matWithMarkup + lbrWithMarkup;
  };

  const handlePriceAdjustment = (newTotal, adjustmentDetails) => {
    setAdjustedTotal(newTotal);
    setHasAdjustment(true);
    console.log("Price adjustment applied:", adjustmentDetails);
  };

  const resetPriceAdjustment = () => {
    setAdjustedTotal(0);
    setHasAdjustment(false);
  };

  const getFinalTotal = () => {
    return hasAdjustment ? adjustedTotal : calculateTotal();
  };

  const handleSave = async () => {
    if (!isChangeOrder && !customerName.trim()) {
      alert("Please enter a customer name");
      return;
    }
    
    if (lineItems.some(item => !item.description.trim())) {
      alert("Please fill in all line item descriptions");
      return;
    }

    setIsSaving(true);
    try {
      const total = getFinalTotal();
      
      if (isChangeOrder) {
        // CHANGE ORDER LOGIC
        if (coId) {
          // UPDATE existing change order
          const { error: updateError } = await supabase
            .from("change_orders")
            .update({
              project_name: projectName || "Quick Change Order",
              description: description || null,
              total: total,
              change_order_date: estimateDate,
              material_markup: Number(materialMarkup) || 0,
              labor_markup: Number(laborMarkup) || 0
            })
            .eq("id", coId);

          if (updateError) throw updateError;

          // Fetch old item IDs BEFORE deleting (safe insert-first pattern)
          const { data: oldCoItems } = await supabase
            .from("estimate_items")
            .select("id")
            .eq("change_order_id", coId);
          const oldCoItemIds = (oldCoItems || []).map(r => r.id);

          // Insert new items FIRST — if this fails, old items are still intact
          const coItems = lineItems.map((item, index) => {
            const extMat = Number(item.quantity) * Number(item.material);
            const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
            const lbrCost = lbrExt * Number(hourlyRate);
            return {
              change_order_id: coId,
              line_type: 'material',
              description: item.description,
              quantity: item.quantity,
              unit: 'ea',
              material_unit_cost: item.material,
              material_total: extMat,
              labor_hours: item.lbrHrs,
              labor_rate: hourlyRate,
              labor_total: lbrCost,
              line_total: extMat + lbrCost,
              show_in_scope: item.showInScope !== false,
              sequence: index
            };
          });

          const { error: itemsError } = await supabase
            .from("estimate_items")
            .insert(coItems);

          if (itemsError) throw itemsError;

          // Only delete old items AFTER new ones are safely inserted
          if (oldCoItemIds.length > 0) {
            const { error: deleteError } = await supabase
              .from("estimate_items")
              .delete()
              .in("id", oldCoItemIds);
            if (deleteError) throw deleteError;
          }

          alert(`Quick Change Order updated successfully!`);
        } else {
          // CREATE new change order
          // Generate CO number with proper format using project's original estimate number
          
          // First, get the original estimate number for this project
          let baseNumber = "1010"; // fallback
          if (projectName) {
            const { data: originalEstimate, error: estError } = await supabase
              .from("estimates")
              .select("estimate_number")
              .eq("project_name", projectName)
              .is("parent_estimate_id", null) // Only get base estimates, not alternates
              .order("created_at", { ascending: true }) // Get the first/original estimate
              .limit(1);

            if (!estError && originalEstimate && originalEstimate.length > 0 && originalEstimate[0].estimate_number) {
              // Extract the base number (e.g., "1010" from "1010" or "1010-ALT1")
              const match = originalEstimate[0].estimate_number.match(/^(\d+)/);
              if (match) {
                baseNumber = match[1];
              }
            }
          }

          // Get existing change orders for this project to determine next CO number
          const { data: existingCOs } = await supabase
            .from("change_orders")
            .select("change_order_number")
            .eq("project_name", projectName)
            .like("change_order_number", `${baseNumber}-CO%`);

          // Find the highest CO number
          let nextCONum = 1;
          if (existingCOs && existingCOs.length > 0) {
            const coNumbers = existingCOs
              .map(co => {
                const match = co.change_order_number.match(/-CO(\d+)$/);
                return match ? parseInt(match[1]) : 0;
              })
              .filter(num => num > 0);
            
            if (coNumbers.length > 0) {
              nextCONum = Math.max(...coNumbers) + 1;
            }
          }

          const coNumber = `${baseNumber}-CO${nextCONum}`;
          
          // Create change order
          const changeOrderData = {
            project_name: projectName || "Quick Change Order",
            change_order_number: coNumber,
            title: `Quick Change Order ${nextCONum}`,
            description: description || null,
            change_order_date: estimateDate,
            total: total,
            status: 'draft',
            created_by: user.id,
            material_markup: Number(materialMarkup) || 0,
            labor_markup: Number(laborMarkup) || 0
          };

          const { data: changeOrder, error: coError } = await supabase
            .from("change_orders")
            .insert([changeOrderData])
            .select()
            .single();

          if (coError) throw coError;

          // Create change order items
          const items = lineItems.map((item, index) => {
            const extMat = Number(item.quantity) * Number(item.material);
            const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
            const lbrCost = lbrExt * Number(hourlyRate);
            return {
              change_order_id: changeOrder.id,
              line_type: 'material',
              description: item.description,
              quantity: item.quantity,
              unit: 'ea',
              material_unit_cost: item.material,
              material_total: extMat,
              labor_hours: item.lbrHrs,
              labor_rate: hourlyRate,
              labor_total: lbrCost,
              line_total: extMat + lbrCost,
              show_in_scope: item.showInScope !== false,
              sequence: index
            };
          });

          const { error: itemsError } = await supabase
            .from("estimate_items")
            .insert(items);

          if (itemsError) throw itemsError;

          alert(`Quick Change Order ${coNumber} saved successfully!`);
        }
      } else {
        // REGULAR ESTIMATE LOGIC
        if (estimateId) {
          // UPDATE existing estimate
          const estimateData = {
            project_name: projectName || "Quick Estimate",
            customer_name: customerName,
            estimate_date: estimateDate,
            subtotal: total,
            total: total,
            notes: description || null,
            material_markup: Number(materialMarkup) || 0,
            labor_markup: Number(laborMarkup) || 0,
            estimate_type: 'quick',
            view_format: viewFormat,
            ...(projectId ? { project_id: projectId } : {}),
          };

          const { error: updateError } = await supabase
            .from("estimates")
            .update(estimateData)
            .eq("id", estimateId);

          if (updateError) throw updateError;

          // Fetch old item IDs BEFORE deleting (safe insert-first pattern)
          const { data: oldEstItems } = await supabase
            .from("estimate_items")
            .select("id")
            .eq("estimate_id", estimateId);
          const oldEstItemIds = (oldEstItems || []).map(r => r.id);

          // Insert new items FIRST — if this fails, old items are still intact
          const items = lineItems.map((item, index) => {
            const extMat = Number(item.quantity) * Number(item.material);
            const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
            const lbrCost = lbrExt * Number(hourlyRate);
            return {
              estimate_id: estimateId,
              line_type: 'material',
              description: item.description,
              quantity: item.quantity,
              unit: 'ea',
              material_unit_cost: item.material,
              material_total: extMat,
              labor_hours: item.lbrHrs,
              labor_rate: hourlyRate,
              labor_total: lbrCost,
              line_total: extMat + lbrCost,
              show_in_scope: item.showInScope !== false,
              sequence: index
            };
          });

          const { error: itemsError } = await supabase
            .from("estimate_items")
            .insert(items);

          if (itemsError) throw itemsError;

          // Only delete old items AFTER new ones are safely inserted
          if (oldEstItemIds.length > 0) {
            const { error: deleteError } = await supabase
              .from("estimate_items")
              .delete()
              .in("id", oldEstItemIds);
            if (deleteError) throw deleteError;
          }

          alert(`Quick Estimate updated successfully!`);
        } else {
          // CREATE new estimate
          const { data: estimates } = await supabase
            .from("estimates")
            .select("estimate_number")
            .eq("company_id", user.id)
            .not("estimate_number", "is", null);
          
          const { data: proposals } = await supabase
            .from("proposals")
            .select("proposal_number")
            .eq("company_id", user.id);
          
          let maxBase = 1000;
          
          if (estimates) {
            estimates.forEach(est => {
              if (est.estimate_number) {
                const match = est.estimate_number.match(/^(\d+)/);
                if (match) {
                  const num = parseInt(match[1]);
                  if (num > maxBase) maxBase = num;
                }
              }
            });
          }
          
          if (proposals) {
            proposals.forEach(prop => {
              if (prop.proposal_number) {
                const match = prop.proposal_number.match(/(\d+)/);
                if (match) {
                  const num = parseInt(match[1]);
                  if (num > maxBase) maxBase = num;
                }
              }
            });
          }
          
          const estimateNumber = String(maxBase + 1);
          
          const estimateData = {
            company_id: user.id,
            estimate_number: estimateNumber,
            project_name: projectName || "Quick Estimate",
            customer_name: customerName,
            estimate_date: estimateDate,
            subtotal: total,
            total: total,
            status: 'draft',
            notes: description || null,
            material_markup: Number(materialMarkup) || 0,
            labor_markup: Number(laborMarkup) || 0,
            estimate_type: 'quick',
            view_format: viewFormat,
            ...(projectId ? { project_id: projectId } : {}),
          };

          const { data: estimate, error: estimateError } = await supabase
            .from("estimates")
            .insert([estimateData])
            .select()
            .single();

          if (estimateError) throw estimateError;

          const items = lineItems.map((item, index) => {
            const extMat = Number(item.quantity) * Number(item.material);
            const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
            const lbrCost = lbrExt * Number(hourlyRate);
            return {
              estimate_id: estimate.id,
              line_type: 'material',
              description: item.description,
              quantity: item.quantity,
              unit: 'ea',
              material_unit_cost: item.material,
              material_total: extMat,
              labor_hours: item.lbrHrs,
              labor_rate: hourlyRate,
              labor_total: lbrCost,
              line_total: extMat + lbrCost,
              show_in_scope: item.showInScope !== false,
              sequence: index
            };
          });

          const { error: itemsError } = await supabase
            .from("estimate_items")
            .insert(items);

          if (itemsError) throw itemsError;

          // Store new estimateId so modal URL is correct, then show modal
          setEstimateId(estimate.id);
          setShowViewChoiceModal(true);
          return; // Don't navigate yet — user will choose from modal
        }
      }
      
      // Navigate back to project if we came from one, otherwise go to estimates
      if (projectId) {
        navigate(`/project/${projectId}`);
      } else {
        navigate("/estimates");
      }
    } catch (err) {
      console.error("Error saving:", err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{isChangeOrder ? "🔄 Quick Change Order" : "Quick Estimate"}</h1>
        <div style={styles.headerButtons}>
          {estimateId && (
            <>
              <button
                onClick={() => window.open(`/estimate/quick/view?estimateId=${estimateId}&view=${viewFormat}`, '_blank')}
                style={styles.previewButton}
                title="Preview estimate"
              >
                👁️ Preview
              </button>
              <button
                onClick={() => window.open(`/estimate/quick/view?estimateId=${estimateId}&view=${viewFormat}&print=true`, '_blank')}
                style={styles.printButton}
                title="Print estimate"
              >
                🖨️ Print
              </button>
              <button
                onClick={() => {
                  const cust = customers.find(c => c.customer === customerName);
                  if (cust?.email) setEmailTo(cust.email);
                  setShowEmailModal(true);
                }}
                style={styles.emailButton}
                title="Email estimate"
              >
                📧 Email
              </button>
            </>
          )}
          <button onClick={() => navigate(projectId ? `/project/${projectId}` : "/estimates")} style={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveButton} disabled={isSaving}>
            {isSaving ? "Saving..." : isChangeOrder ? "🔄 Save Change Order" : "💾 Save Estimate"}
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📧 Email Estimate</h3>
              <button onClick={() => setShowEmailModal(false)} style={styles.modalClose}>×</button>
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
                  style={{...styles.modalInput, minHeight: 80, resize: "vertical"}}
                  placeholder="Add a personal message..."
                />
              </div>
              <div style={styles.modalPreview}>
                <p style={{margin: 0, fontSize: 13, color: '#666'}}>
                  <strong>Customer:</strong> {customerName}
                </p>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#666'}}>
                  <strong>Project:</strong> {projectName || 'Quick Estimate'}
                </p>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#666'}}>
                  <strong>Total:</strong> ${calculateTotal().toFixed(2)}
                </p>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEmailModal(false)} style={styles.modalCancelBtn}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!emailTo.trim()) {
                    alert("Please enter an email address.");
                    return;
                  }
                  setSending(true);
                  try {
                    // Load the saved estimate items from database
                    const { data: savedItems, error: itemsError } = await supabase
                      .from("estimate_items")
                      .select("*")
                      .eq("estimate_id", estimateId)
                      .order("sequence");

                    if (itemsError) throw itemsError;

                    // Load the estimate record for estimate_number
                    const { data: estRecord, error: estError } = await supabase
                      .from("estimates")
                      .select("estimate_number, estimate_date, notes")
                      .eq("id", estimateId)
                      .single();

                    if (estError) throw estError;

                    const { data, error } = await supabase.functions.invoke('send-estimate', {
                      body: {
                        estimateId,
                        siteUrl: window.location.origin,
                        to: emailTo,
                        message: emailMessage,
                        estimateNumber: estRecord.estimate_number,
                        estimateDate: estRecord.estimate_date,
                        customerName,
                        projectName: projectName || 'Quick Estimate',
                        total: calculateTotal(),
                        notes: estRecord.notes,
                        viewFormat: viewFormat,
                        lineItems: (savedItems || []).map(item => ({
                          description: item.description,
                          quantity: item.quantity,
                          material_total: item.material_total,
                          labor_total: item.labor_total,
                          line_total: item.line_total,
                          show_in_scope: item.show_in_scope !== false,
                        })),
                      }
                    });
                    if (error) throw error;
                    alert("Estimate sent successfully!");
                    setShowEmailModal(false);
                    // Update status to sent
                    await supabase.from("estimates").update({ status: "sent" }).eq("id", estimateId);
                  } catch (err) {
                    console.error("Error sending estimate:", err);
                    alert(`Failed to send: ${err.message || 'Unknown error'}`);
                  } finally {
                    setSending(false);
                  }
                }}
                disabled={sending}
                style={{...styles.modalSendBtn, opacity: sending ? 0.6 : 1}}
              >
                {sending ? 'Sending...' : '📧 Send Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Format Choice Modal ── */}
      {showViewChoiceModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:10001, padding:16
        }}>
          <div style={{
            background:"#fff", borderRadius:14, padding:"32px 28px",
            maxWidth:480, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.25)"
          }}>
            <h2 style={{margin:"0 0 4px", fontSize:20, color:"#111", textAlign:"center"}}>
              ✅ Estimate Saved!
            </h2>
            <p style={{margin:"0 0 20px", fontSize:13, color:"#888", textAlign:"center"}}>
              How would you like to view this estimate?
            </p>

            {[
              { key:"summary",           icon:"📄", title:"Summary Only",                    desc:"Description/notes + Total Investment — no line items listed" },
              { key:"itemized-no-price", icon:"📋", title:"Items — No Line Pricing",          desc:"Checked items listed as scope, no per-item prices — only Total shown" },
              { key:"itemized",          icon:"💰", title:"Items — With Pricing",             desc:"Checked items listed with individual prices + Total" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={async () => {
                  setViewFormat(opt.key);
                  // Save chosen format to DB permanently
                  await supabase.from("estimates").update({ view_format: opt.key }).eq("id", estimateId);
                  window.open(`/estimate/quick/view?estimateId=${estimateId}&view=${opt.key}`, "_blank");
                  setShowViewChoiceModal(false);
                  navigate(projectId ? `/project/${projectId}` : "/estimates");
                }}
                style={{
                  display:"flex", alignItems:"center", gap:14,
                  width:"100%", background:"#f9fafb",
                  border:"2px solid #e5e7eb", borderRadius:10,
                  padding:"14px 16px", marginBottom:10,
                  cursor:"pointer", textAlign:"left",
                }}
              >
                <span style={{fontSize:26, flexShrink:0}}>{opt.icon}</span>
                <div>
                  <div style={{fontSize:15, fontWeight:700, color:"#111", marginBottom:2}}>{opt.title}</div>
                  <div style={{fontSize:12, color:"#888", lineHeight:1.4}}>{opt.desc}</div>
                </div>
              </button>
            ))}

            <button
              onClick={() => { setShowViewChoiceModal(false); navigate(projectId ? `/project/${projectId}` : "/estimates"); }}
              style={{
                width:"100%", padding:"10px", marginTop:4,
                background:"transparent", border:"1px solid #ddd",
                borderRadius:8, cursor:"pointer", color:"#888", fontSize:14
              }}
            >
              {projectId ? "← Back to Project" : "Just go to estimates list"}
            </button>
          </div>
        </div>
      )}

      <div style={styles.form}>
        {/* Basic Info */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Basic Information</h2>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Customer Name</label>
              <div style={{position: 'relative'}}>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerName(value);
                    if (value.trim()) {
                      const filtered = customers.filter(c => 
                        c.customer.toLowerCase().includes(value.toLowerCase())
                      );
                      setFilteredCustomers(filtered);
                      setShowCustomerDropdown(filtered.length > 0);
                    } else {
                      setShowCustomerDropdown(false);
                    }
                  }}
                  onFocus={() => {
                    if (customerName.trim() && filteredCustomers.length > 0) {
                      setShowCustomerDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  style={styles.input}
                  placeholder="Type to search customers..."
                  autoComplete="off"
                />
                {showCustomerDropdown && (
                  <div style={styles.dropdown}>
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        style={styles.dropdownItem}
                        onClick={() => {
                          setCustomerName(customer.customer);
                          setShowCustomerDropdown(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        {customer.customer}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project/Job Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={styles.input}
                placeholder="Enter project name"
              />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Estimate Date</label>
              <input
                type="date"
                value={estimateDate}
                onChange={(e) => setEstimateDate(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Description/Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{...styles.input, minHeight: 80, resize: "vertical"}}
              placeholder="Enter any additional details"
            />
          </div>

          {/* View Format selector — shown when editing an existing estimate */}
          {estimateId && (
            <div style={{
              padding: '14px 16px', backgroundColor: '#f0f9ff',
              border: '2px solid #bae6fd', borderRadius: 8, marginBottom: 8
            }}>
              <label style={{fontSize: 13, fontWeight: '700', color: '#0369a1', display: 'block', marginBottom: 10}}>
                📄 Customer View Format
                <span style={{fontSize: 12, fontWeight: '400', color: '#666', marginLeft: 8}}>
                  (changes how the estimate looks when viewed / printed / emailed)
                </span>
              </label>
              <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                {[
                  { key: 'summary',           label: '📄 Summary Only',       desc: 'Notes + Total, no items' },
                  { key: 'itemized-no-price', label: '📋 Items — No Pricing', desc: 'Checked items, total only' },
                  { key: 'itemized',          label: '💰 Items + Pricing',    desc: 'Checked items with prices' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setViewFormat(opt.key)}
                    style={{
                      padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                      border: viewFormat === opt.key ? '2px solid #0369a1' : '2px solid #e5e7eb',
                      backgroundColor: viewFormat === opt.key ? '#0369a1' : '#fff',
                      color: viewFormat === opt.key ? '#fff' : '#333',
                      fontWeight: '600', fontSize: 13, textAlign: 'left',
                    }}
                  >
                    <div>{opt.label}</div>
                    <div style={{fontSize: 11, fontWeight: '400', opacity: 0.8, marginTop: 2}}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Line Items</h2>
            <div style={{display: 'flex', alignItems: 'center', gap: 15}}>
              {/* Mode Toggle */}
              <div style={{display: 'flex', gap: 8, alignItems: 'center', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: 6}}>
                <button
                  onClick={() => setItemMode('detailed')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: itemMode === 'detailed' ? '#fff' : 'transparent',
                    border: itemMode === 'detailed' ? '1px solid #e5e7eb' : 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: '600',
                    color: itemMode === 'detailed' ? '#111' : '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📊 Detailed
                </button>
                <button
                  onClick={() => setItemMode('simple')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: itemMode === 'simple' ? '#fff' : 'transparent',
                    border: itemMode === 'simple' ? '1px solid #e5e7eb' : 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: '600',
                    color: itemMode === 'simple' ? '#111' : '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚡ Simple
                </button>
              </div>

              {itemMode === 'detailed' && (
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <label style={{fontSize: 14, fontWeight: '600', color: '#333', whiteSpace: 'nowrap'}}>
                    Hourly Rate: $
                  </label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    style={{
                      width: 100,
                      padding: '8px 10px',
                      fontSize: 14,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none',
                      backgroundColor: '#fff',
                      color: '#333',
                    }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
              <button onClick={addLineItem} style={styles.addButton}>
                + Add Line
              </button>
            </div>
          </div>

          <div style={{...styles.tableContainer, overflowX: activeDescDropdown ? 'visible' : 'auto'}}>
            {itemMode === 'detailed' ? (
              // DETAILED MODE TABLE
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={{...styles.th, width: "6%", textAlign: "center"}}>Qty</th>
                    <th style={{...styles.th, width: "24%"}}>Description</th>
                    <th style={{...styles.th, width: "9%", textAlign: "right"}}>Material</th>
                    <th style={{...styles.th, width: "9%", textAlign: "right"}}>Ext Mat</th>
                    <th style={{...styles.th, width: "8%", textAlign: "center"}}>Lbr Hrs</th>
                    <th style={{...styles.th, width: "8%", textAlign: "center"}}>Lbr Ext</th>
                    <th style={{...styles.th, width: "9%", textAlign: "right"}}>Lbr Cost</th>
                    <th style={{...styles.th, width: "9%", textAlign: "right"}}>Total</th>
                    <th style={{...styles.th, width: "5%", textAlign: "center", fontSize: 11}}>Scope</th>
                    <th style={{...styles.th, width: "4%"}}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => {
                    const extMat = Number(item.quantity) * Number(item.material);
                    const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
                    const lbrCost = lbrExt * Number(hourlyRate);
                    const lineTotal = extMat + lbrCost;
                    
                    return (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={styles.td}>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                            style={{...styles.tableInput, textAlign: "center"}}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={styles.td}>
                          <div style={{position: 'relative'}}>
                            <textarea
                              value={item.description}
                              onChange={(e) => {
                                updateLineItem(item.id, "description", e.target.value);
                                setActiveDescDropdown(item.id);
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              onFocus={() => {
                                if (item.description.trim().length >= 2) setActiveDescDropdown(item.id);
                              }}
                              onBlur={() => setTimeout(() => setActiveDescDropdown(null), 200)}
                              onKeyDown={(e) => { if (e.key === 'Escape') setActiveDescDropdown(null); }}
                              onInput={(e) => {
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              ref={(el) => {
                                if (el) {
                                  el.style.height = "auto";
                                  el.style.height = el.scrollHeight + "px";
                                }
                              }}
                              style={{...styles.tableInput, resize: "none", overflow: "hidden", minHeight: 36, lineHeight: "1.4"}}
                              placeholder="Type to search materials..."
                              rows={1}
                            />
                            {activeDescDropdown === item.id && getMaterialSuggestions(item.description).length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                backgroundColor: '#fff', border: '2px solid #fc6b04',
                                borderTop: 'none', borderRadius: '0 0 6px 6px',
                                maxHeight: 220, overflowY: 'auto', zIndex: 9999,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}>
                                {getMaterialSuggestions(item.description).map(mat => (
                                  <div
                                    key={mat.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectMaterial(item.id, mat, true)}
                                    style={{
                                      padding: '8px 10px', cursor: 'pointer',
                                      borderBottom: '1px solid #f3f4f6',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff7ed'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                  >
                                    <span style={{fontSize: 13, color: '#333'}}>{mat.name}</span>
                                    {mat.price > 0 && (
                                      <span style={{fontSize: 12, color: '#10b981', fontWeight: '600', marginLeft: 8}}>
                                        ${mat.price.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            value={item.material}
                            onChange={(e) => updateLineItem(item.id, "material", e.target.value)}
                            style={{...styles.tableInput, textAlign: "right"}}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={{...styles.td, textAlign: "right"}}>
                          <span style={styles.itemTotal}>
                            ${extMat.toFixed(2)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            value={item.lbrHrs}
                            onChange={(e) => updateLineItem(item.id, "lbrHrs", e.target.value)}
                            style={{...styles.tableInput, textAlign: "center"}}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={{...styles.td, textAlign: "center"}}>
                          <span style={styles.itemTotal}>
                            {lbrExt.toFixed(2)}
                          </span>
                        </td>
                        <td style={{...styles.td, textAlign: "right"}}>
                          <span style={styles.itemTotal}>
                            ${lbrCost.toFixed(2)}
                          </span>
                        </td>
                        <td style={{...styles.td, textAlign: "right"}}>
                          <span style={styles.itemTotal}>
                            ${lineTotal.toFixed(2)}
                          </span>
                        </td>
                        <td style={{...styles.td, textAlign: "center", verticalAlign: "middle"}}>
                          <input
                            type="checkbox"
                            checked={item.showInScope !== false}
                            onChange={(e) => updateLineItem(item.id, "showInScope", e.target.checked)}
                            style={{width: 18, height: 18, cursor: "pointer", accentColor: "#fc6b04"}}
                            title="Show in Scope of Work"
                          />
                        </td>
                        <td style={styles.td}>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(item.id)}
                              style={styles.deleteButton}
                              title="Remove line"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              // SIMPLE MODE TABLE
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={{...styles.th, width: "60%"}}>Description</th>
                    <th style={{...styles.th, width: "18%", textAlign: "right"}}>Total Cost</th>
                    <th style={{...styles.th, width: "8%", textAlign: "center", fontSize: 11}}>Scope</th>
                    <th style={{...styles.th, width: "8%"}}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => {
                    // In simple mode, use material field as total cost
                    return (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={styles.td}>
                          <div style={{position: 'relative'}}>
                            <textarea
                              value={item.description}
                              onChange={(e) => {
                                updateLineItem(item.id, "description", e.target.value);
                                setActiveDescDropdown(item.id);
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              onFocus={() => {
                                if (item.description.trim().length >= 2) setActiveDescDropdown(item.id);
                              }}
                              onBlur={() => setTimeout(() => setActiveDescDropdown(null), 200)}
                              onKeyDown={(e) => { if (e.key === 'Escape') setActiveDescDropdown(null); }}
                              onInput={(e) => {
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              ref={(el) => {
                                if (el) {
                                  el.style.height = "auto";
                                  el.style.height = el.scrollHeight + "px";
                                }
                              }}
                              style={{...styles.tableInput, resize: "none", overflow: "hidden", minHeight: 36, lineHeight: "1.4"}}
                              placeholder="Type to search materials..."
                              rows={1}
                            />
                            {activeDescDropdown === item.id && getMaterialSuggestions(item.description).length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                backgroundColor: '#fff', border: '2px solid #fc6b04',
                                borderTop: 'none', borderRadius: '0 0 6px 6px',
                                maxHeight: 220, overflowY: 'auto', zIndex: 9999,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}>
                                {getMaterialSuggestions(item.description).map(mat => (
                                  <div
                                    key={mat.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectMaterial(item.id, mat, false)}
                                    style={{
                                      padding: '8px 10px', cursor: 'pointer',
                                      borderBottom: '1px solid #f3f4f6',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff7ed'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                  >
                                    <span style={{fontSize: 13, color: '#333'}}>{mat.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            <span style={{fontSize: 13, color: '#666'}}>$</span>
                            <input
                              type="number"
                              value={item.material}
                              onChange={(e) => updateLineItem(item.id, "material", e.target.value)}
                              style={{...styles.tableInput, textAlign: "right"}}
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                        <td style={{...styles.td, textAlign: "center", verticalAlign: "middle"}}>
                          <input
                            type="checkbox"
                            checked={item.showInScope !== false}
                            onChange={(e) => updateLineItem(item.id, "showInScope", e.target.checked)}
                            style={{width: 18, height: 18, cursor: "pointer", accentColor: "#fc6b04"}}
                            title="Show in Scope of Work"
                          />
                        </td>
                        <td style={styles.td}>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(item.id)}
                              style={styles.deleteButton}
                              title="Remove line"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Summary / Totals */}
        <div style={{borderTop: '2px solid #e5e7eb', paddingTop: 24, marginTop: 8}}>
          {/* Summary Grid */}
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20}}>
            {/* Material Cost */}
            <div style={{backgroundColor: '#f0fdf4', borderRadius: 10, padding: 16, border: '1px solid #bbf7d0'}}>
              <div style={{fontSize: 12, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', marginBottom: 8}}>Material Cost</div>
              <div style={{fontSize: 24, fontWeight: '700', color: '#111'}}>${getTotalMaterialCost().toFixed(2)}</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 10}}>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', whiteSpace: 'nowrap'}}>Markup %</label>
                <input
                  type="number"
                  value={materialMarkup}
                  onChange={(e) => setMaterialMarkup(e.target.value)}
                  style={{width: 70, padding: '4px 8px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center'}}
                  min="0"
                  step="1"
                />
                {Number(materialMarkup) > 0 && (
                  <span style={{fontSize: 12, color: '#16a34a', fontWeight: '600'}}>
                    = ${(getTotalMaterialCost() * (1 + Number(materialMarkup) / 100)).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Labor */}
            <div style={{backgroundColor: '#eff6ff', borderRadius: 10, padding: 16, border: '1px solid #bfdbfe'}}>
              <div style={{fontSize: 12, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', marginBottom: 8}}>Labor</div>
              <div style={{fontSize: 24, fontWeight: '700', color: '#111'}}>{getTotalLaborHours().toFixed(1)} hrs</div>
              <div style={{fontSize: 13, color: '#666', marginTop: 4}}>Cost: ${getTotalLaborCost().toFixed(2)}</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6}}>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', whiteSpace: 'nowrap'}}>Markup %</label>
                <input
                  type="number"
                  value={laborMarkup}
                  onChange={(e) => setLaborMarkup(e.target.value)}
                  style={{width: 70, padding: '4px 8px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center'}}
                  min="0"
                  step="1"
                />
                {Number(laborMarkup) > 0 && (
                  <span style={{fontSize: 12, color: '#2563eb', fontWeight: '600'}}>
                    = ${(getTotalLaborCost() * (1 + Number(laborMarkup) / 100)).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Grand Total */}
            <div style={{backgroundColor: '#fff7ed', borderRadius: 10, padding: 16, border: '2px solid #fdba74'}}>
              <div style={{fontSize: 12, fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', marginBottom: 8}}>Total</div>
              <div style={{display: 'flex', flexDirection: 'column'}}>
                {hasAdjustment && (
                  <div style={{fontSize: 16, color: '#999', textDecoration: 'line-through'}}>${calculateTotal().toFixed(2)}</div>
                )}
                <div style={{fontSize: 32, fontWeight: '800', color: '#fc6b04'}}>${getFinalTotal().toFixed(2)}</div>
                {hasAdjustment && (
                  <div style={{fontSize: 11, color: '#10b981', fontWeight: '600'}}>Adjusted Total</div>
                )}
                {(Number(materialMarkup) > 0 || Number(laborMarkup) > 0) && !hasAdjustment && (
                  <div style={{fontSize: 11, color: '#666', marginTop: 2}}>
                    (includes markup)
                  </div>
                )}
              </div>
              <div style={{display: 'flex', gap: 6, marginTop: 10}}>
                <button
                  onClick={() => setShowPriceAdjustment(true)}
                  style={{padding: '6px 12px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: '600', cursor: 'pointer'}}
                >
                  💰 Adjust Price
                </button>
                {hasAdjustment && (
                  <button
                    onClick={resetPriceAdjustment}
                    style={{padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: '600', cursor: 'pointer'}}
                  >
                    🔄 Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price Adjustment Modal */}
      <PriceAdjustment
        show={showPriceAdjustment}
        originalTotal={calculateTotal()}
        onAdjustmentApplied={handlePriceAdjustment}
        onClose={() => setShowPriceAdjustment(false)}
      />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 20px",
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
    color: "#111",
    margin: 0,
  },
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  saveButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    color: "#333",
  },
  addButton: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#fff",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "12px",
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    textTransform: "uppercase",
    textAlign: "left",
  },
  tableRow: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "12px",
    verticalAlign: "top",
  },
  tableInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    color: "#333",
  },
  itemTotal: {
    fontWeight: "600",
    color: "#333",
  },
  deleteButton: {
    width: 28,
    height: 28,
    padding: 0,
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  totalSection: {
    borderTop: "2px solid #e5e7eb",
    paddingTop: 20,
    display: "flex",
    justifyContent: "flex-end",
  },
  totalRow: {
    display: "flex",
    alignItems: "center",
    gap: 30,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fc6b04",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderTop: "none",
    borderRadius: "0 0 6px 6px",
    maxHeight: "200px",
    overflowY: "auto",
    zIndex: 9999,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "12px",
    cursor: "pointer",
    fontSize: 15,
    color: "#333",
    borderBottom: "1px solid #f3f4f6",
  },
  previewButton: {
    padding: "12px 20px",
    backgroundColor: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  printButton: {
    padding: "12px 20px",
    backgroundColor: "#8b5cf6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  emailButton: {
    padding: "12px 20px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
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

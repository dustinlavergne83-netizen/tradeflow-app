import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

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
    { id: 1, description: "", quantity: 1, material: 0, lbrHrs: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [itemMode, setItemMode] = useState('detailed'); // 'detailed' or 'simple'
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);

  const [projectId, setProjectId] = useState(null);

  useEffect(() => {
    loadCustomers();
    
    // Check if we're coming from a project
    const projectIdParam = searchParams.get('projectId');
    const projectNameParam = searchParams.get('projectName');
    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
    if (projectNameParam) {
      setProjectName(decodeURIComponent(projectNameParam));
    }
    
    // If projectId provided, load project details to get customer
    if (projectIdParam) {
      loadProjectCustomer(projectIdParam);
    }
    
    // Check if we're editing an existing estimate
    const estimateIdParam = searchParams.get('estimateId');
    if (estimateIdParam) {
      setEstimateId(estimateIdParam);
      loadExistingEstimate(estimateIdParam);
    }
  }, [user, searchParams]);

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
        setCustomerName(project.contractor || project.customer || "");
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
      setDescription(estimate.notes || "");

      // Get hourly rate from first item with labor
      const firstItemWithLabor = items.find(item => item.labor_rate > 0);
      setHourlyRate(firstItemWithLabor?.labor_rate || 0);

      // Map items to line items
      if (items && items.length > 0) {
        const mappedItems = items.map((item, index) => ({
          id: index + 1,
          description: item.description || "",
          quantity: item.quantity || 1,
          material: item.material_unit_cost || 0,
          lbrHrs: item.labor_hours || 0
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

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems([...lineItems, { id: newId, description: "", quantity: 1, material: 0, lbrHrs: 0 }]);
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

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      const extMat = Number(item.quantity) * Number(item.material);
      const lbrExt = Number(item.quantity) * Number(item.lbrHrs);
      const lbrCost = lbrExt * Number(hourlyRate);
      return sum + extMat + lbrCost;
    }, 0);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      alert("Please enter a customer name");
      return;
    }
    
    if (lineItems.some(item => !item.description.trim())) {
      alert("Please fill in all line item descriptions");
      return;
    }

    setIsSaving(true);
    try {
      const total = calculateTotal();
      
      // Check if we're updating an existing estimate
      if (estimateId) {
        // UPDATE existing estimate
        const estimateData = {
          project_name: projectName || "Quick Estimate",
          customer_name: customerName,
          estimate_date: estimateDate,
          subtotal: total,
          total: total,
          notes: description || null
        };

        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateData)
          .eq("id", estimateId);

        if (updateError) throw updateError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from("estimate_items")
          .delete()
          .eq("estimate_id", estimateId);

        if (deleteError) throw deleteError;

        // Create new estimate items
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
            sequence: index
          };
        });

        const { error: itemsError } = await supabase
          .from("estimate_items")
          .insert(items);

        if (itemsError) throw itemsError;

        alert(`Quick Estimate updated successfully!`);
      } else {
        // CREATE new estimate
        // Get next estimate number - check both estimates and proposals
        const { data: estimates } = await supabase
          .from("estimates")
          .select("estimate_number")
          .eq("company_id", user.id)
          .not("estimate_number", "is", null);
        
        const { data: proposals } = await supabase
          .from("proposals")
          .select("proposal_number")
          .eq("company_id", user.id);
        
        // Extract all base numbers from both estimates and proposals
        let maxBase = 1000;
        
        // Check estimates
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
        
        // Check proposals (format like "EST-1001-1" or just numbers)
        if (proposals) {
          proposals.forEach(prop => {
            if (prop.proposal_number) {
              // Extract number from formats like "EST-1001-1" or "1001"
              const match = prop.proposal_number.match(/(\d+)/);
              if (match) {
                const num = parseInt(match[1]);
                if (num > maxBase) maxBase = num;
              }
            }
          });
        }
        
        const estimateNumber = String(maxBase + 1);
        
        // Create the estimate
        const estimateData = {
          company_id: user.id,
          estimate_number: estimateNumber,
          project_name: projectName || "Quick Estimate",
          customer_name: customerName,
          estimate_date: estimateDate,
          subtotal: total,
          total: total,
          status: 'draft',
          notes: description || null
        };

        const { data: estimate, error: estimateError } = await supabase
          .from("estimates")
          .insert([estimateData])
          .select()
          .single();

        if (estimateError) throw estimateError;

        // Create estimate items
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
            sequence: index
          };
        });

        const { error: itemsError } = await supabase
          .from("estimate_items")
          .insert(items);

        if (itemsError) throw itemsError;

        alert(`Quick Estimate saved successfully!`);
      }
      
      // Navigate back to project if we came from one, otherwise go to estimates
      if (projectId) {
        navigate(`/project/${projectId}`);
      } else {
        navigate("/estimates");
      }
    } catch (err) {
      console.error("Error saving quick estimate:", err);
      alert(`Failed to save estimate: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Quick Estimate</h1>
        <div style={styles.headerButtons}>
          <button onClick={() => navigate("/estimates")} style={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "💾 Save Estimate"}
          </button>
        </div>
      </div>

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

          <div style={styles.tableContainer}>
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
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            style={styles.tableInput}
                            placeholder="Item description"
                          />
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
                    <th style={{...styles.th, width: "70%"}}>Description</th>
                    <th style={{...styles.th, width: "20%", textAlign: "right"}}>Total Cost</th>
                    <th style={{...styles.th, width: "10%"}}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => {
                    // In simple mode, use material field as total cost
                    return (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={styles.td}>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            style={styles.tableInput}
                            placeholder="Item description"
                          />
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

        {/* Total */}
        <div style={styles.totalSection}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>TOTAL:</span>
            <span style={styles.totalAmount}>${calculateTotal().toFixed(2)}</span>
          </div>
        </div>
      </div>
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
    zIndex: 1000,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "12px",
    cursor: "pointer",
    fontSize: 15,
    color: "#333",
    borderBottom: "1px solid #f3f4f6",
  },
};

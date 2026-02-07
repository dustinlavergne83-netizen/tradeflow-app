# Add Full Assembly Builder Modal to Assembly Manager

This guide adds the complete "Quick Assembly" builder from Takeoff to Assembly Manager, so you can build assemblies with multiple components before creating them.

## Step 1: Add State Variables

In `src/pages/AssemblyManager.jsx`, find the state declarations (around line 26) and add these NEW variables:

```javascript
// Quick assembly creation (like in Takeoff)
const [showQuickAssemblyModal, setShowQuickAssemblyModal] = useState(false);
const [quickAssemblyName, setQuickAssemblyName] = useState('');
const [quickAssemblyComponents, setQuickAssemblyComponents] = useState([]);
const [quickAssemblyCategory, setQuickAssemblyCategory] = useState('');
const [quickAssemblyMaterialId, setQuickAssemblyMaterialId] = useState(null);
const [quickAssemblyQuantity, setQuickAssemblyQuantity] = useState('');
const [quickAssemblyQuantityType, setQuickAssemblyQuantityType] = useState('per_foot');
const [quickAssemblyDescription, setQuickAssemblyDescription] = useState('');
```

## Step 2: Add Helper Functions

Add these functions BEFORE the `return` statement (around line 300):

```javascript
// Add component to quick assembly
function addComponentToQuickAssembly() {
  if (!quickAssemblyMaterialId || !quickAssemblyQuantity || parseFloat(quickAssemblyQuantity) <= 0) {
    alert('Please select a material and enter a valid quantity');
    return;
  }
  
  const material = materials.find(m => m.id === quickAssemblyMaterialId);
  if (!material) return;
  
  setQuickAssemblyComponents([...quickAssemblyComponents, {
    material_id: quickAssemblyMaterialId,
    material_name: material.name,
    quantity: parseFloat(quickAssemblyQuantity),
    unit: material.unit || 'ea',
    material_unit_cost: material.price || 0,
    labor_hours: material.laborHours || 0,
    quantity_type: quickAssemblyQuantityType,
    description: quickAssemblyDescription.trim() || null
  }]);
  
  // Reset temp fields
  setQuickAssemblyMaterialId(null);
  setQuickAssemblyCategory('');
  setQuickAssemblyQuantity('');
  setQuickAssemblyQuantityType('per_foot');
  setQuickAssemblyDescription('');
}

// Remove component from quick assembly
function removeComponentFromQuickAssembly(index) {
  setQuickAssemblyComponents(quickAssemblyComponents.filter((_, i) => i !== index));
}

// Save quick assembly
async function saveQuickAssembly() {
  if (!quickAssemblyName.trim()) {
    alert('Please enter an assembly name');
    return;
  }
  
  if (quickAssemblyComponents.length === 0) {
    alert('Please add at least one component to the assembly');
    return;
  }
  
  setSaving(true);
  try {
    // Create the assembly
    const { data: assemblyData, error: assemblyError } = await supabase
      .from('assemblies')
      .insert([{
        company_id: user.id,
        name: quickAssemblyName.trim(),
        description: `Created with ${quickAssemblyComponents.length} components`,
        category: 'ASSEMBLIES',
        unit: 'ea',
        is_custom: true,
        is_active: true
      }])
      .select()
      .single();
    
    if (assemblyError) throw assemblyError;
    
    // Add components to the assembly
    const componentsToInsert = quickAssemblyComponents.map((comp, idx) => ({
      assembly_id: assemblyData.id,
      material_id: comp.material_id,
      material_name: comp.material_name,
      quantity: comp.quantity,
      unit: comp.unit,
      material_unit_cost: comp.material_unit_cost,
      labor_hours: comp.labor_hours,
      quantity_type: comp.quantity_type || 'fixed',
      description: comp.description,
      sequence: idx + 1
    }));
    
    const { error: componentsError } = await supabase
      .from('assembly_components')
      .insert(componentsToInsert);
    
    if (componentsError) throw componentsError;
    
    // Reload assemblies
    await loadAssemblies();
    
    // Close modal and reset
    setShowQuickAssemblyModal(false);
    setQuickAssemblyName('');
    setQuickAssemblyComponents([]);
    
    alert('✅ Assembly created successfully!');
  } catch (err) {
    console.error('Error creating quick assembly:', err);
    alert('Failed to create assembly: ' + err.message);
  } finally {
    setSaving(false);
  }
}
```

## Step 3: Update the Create Button

Find the "Create New Assembly" button in the header (around line 393) and change it to:

```javascript
<button
  onClick={() => setShowQuickAssemblyModal(true)}  // Changed from setShowCreateModal
  style={{
    padding: "12px 24px",
    background: "#fc6b04ff",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer"
  }}
>
  ➕ Create New Assembly
</button>
```

## Step 4: Add the Full Assembly Builder Modal

Add this modal BEFORE the closing `</div>` at the very end of the file (after all other modals):

```javascript
      {/* QUICK ASSEMBLY BUILDER MODAL */}
      {showQuickAssemblyModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: "#2a2a2a",
            border: "2px solid #fc6b04ff",
            borderRadius: 12,
            padding: 30,
            maxWidth: 700,
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto"
          }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#f97316", fontSize: 20 }}>
              🔧 Create Assembly
            </h3>

            <p style={{ margin: "0 0 20px 0", color: "#999", fontSize: 14 }}>
              Create an assembly of conduit, wire, and fittings. Add multiple components with parametric quantities.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 14 }}>
                Assembly Name *
              </label>
              <input
                type="text"
                value={quickAssemblyName}
                onChange={(e) => setQuickAssemblyName(e.target.value)}
                placeholder="e.g., 3/4″ EMT with 3-#12 THHN"
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#1a1a1a",
                  border: "1px solid #555",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14
                }}
                autoFocus
              />
            </div>

            {/* Components Section */}
            <div style={{ marginTop: 24, padding: 16, background: "#1a1a1a", borderRadius: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: '600', color: "#f97316" }}>Components</h4>

              {/* Add Component Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 12 }}>
                {/* Row 1: Material Selection */}
                <select
                  value={quickAssemblyCategory}
                  onChange={(e) => {
                    setQuickAssemblyCategory(e.target.value);
                    setQuickAssemblyMaterialId(null);
                  }}
                  style={{
                    padding: "8px 10px",
                    background: "#2a2a2a",
                    border: "1px solid #555",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 13
                  }}
                >
                  <option value="">Category...</option>
                  {[...new Set(materials.filter(m => m.category !== 'Assemblies').map(m => m.category))].sort().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                {quickAssemblyCategory && (
                  <select
                    value={quickAssemblyMaterialId || ''}
                    onChange={(e) => setQuickAssemblyMaterialId(e.target.value || null)}
                    style={{
                      padding: "8px 10px",
                      background: "#2a2a2a",
                      border: "1px solid #555",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 13
                    }}
                  >
                    <option value="">Material...</option>
                    {materials
                      .filter(m => m.category === quickAssemblyCategory)
                      .map(material => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                  </select>
                )}

                {/* Row 2: Quantity Type and Base Quantity */}
                <select
                  value={quickAssemblyQuantityType}
                  onChange={(e) => setQuickAssemblyQuantityType(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    background: "#2a2a2a",
                    border: "1px solid #555",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 13
                  }}
                  title="How quantity is calculated"
                >
                  <option value="fixed">Fixed Qty</option>
                  <option value="per_foot">Per Foot</option>
                  <option value="per_10_feet">Per 10 Feet</option>
                  <option value="per_100_feet">Per 100 Feet</option>
                </select>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    value={quickAssemblyQuantity}
                    onChange={(e) => setQuickAssemblyQuantity(e.target.value)}
                    placeholder="Base Qty"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      background: "#2a2a2a",
                      border: "1px solid #555",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 13
                    }}
                    step="0.1"
                    title="Base quantity (will be multiplied based on measurement length)"
                  />
                  <button
                    onClick={addComponentToQuickAssembly}
                    style={{
                      padding: '8px 16px',
                      background: "#fc6b04ff",
                      border: "none",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: "bold",
                      cursor: "pointer",
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Add
                  </button>
                </div>

                {/* Row 3: Optional Description (spans both columns) */}
                <input
                  type="text"
                  value={quickAssemblyDescription}
                  onChange={(e) => setQuickAssemblyDescription(e.target.value)}
                  placeholder="Optional: e.g., '1 coupling per 10-foot stick'"
                  style={{
                    gridColumn: '1 / -1',
                    padding: "8px 10px",
                    background: "#2a2a2a",
                    border: "1px solid #555",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 12
                  }}
                />
              </div>

              {/* Components List */}
              {quickAssemblyComponents.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  {quickAssemblyComponents.map((comp, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#333', borderRadius: 6, marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: '500', color: '#fff', marginBottom: 2 }}>{comp.material_name}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {comp.quantity} {comp.unit} × {comp.quantity_type === 'fixed' ? 'Fixed' :
                             comp.quantity_type === 'per_foot' ? 'Per Foot' :
                             comp.quantity_type === 'per_10_feet' ? 'Per 10 Feet' :
                             comp.quantity_type === 'per_100_feet' ? 'Per 100 Feet' : comp.quantity_type}
                          </div>
                          {comp.description && (
                            <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 2 }}>
                              💡 {comp.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeComponentFromQuickAssembly(idx)}
                          style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginLeft: 8 }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 13 }}>
                  No components yet. Add materials above to build your assembly.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowQuickAssemblyModal(false);
                  setQuickAssemblyName('');
                  setQuickAssemblyComponents([]);
                }}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid #666",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveQuickAssembly}
                disabled={!quickAssemblyName.trim() || quickAssemblyComponents.length === 0 || saving}
                style={{
                  padding: "10px 20px",
                  background: quickAssemblyName.trim() && quickAssemblyComponents.length > 0 && !saving ? "#fc6b04ff" : "#666",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "bold",
                  cursor: quickAssemblyName.trim() && quickAssemblyComponents.length > 0 && !saving ? "pointer" : "not-allowed"
                }}
              >
                {saving ? "Creating..." : "Create Assembly"}
              </button>
            </div>
          </div>
        </div>
      )}
```

## Done!

Now when you click "Create New Assembly" in Assembly Manager, you'll get the full assembly builder modal where you can:
1. Name the assembly
2. Add multiple components
3. Set quantity type for each (Fixed, Per Foot, Per 10 Feet, Per 100 Feet)
4. Add descriptions for each component
5. Create the complete assembly with all components

This is the same powerful interface from the Takeoff page!

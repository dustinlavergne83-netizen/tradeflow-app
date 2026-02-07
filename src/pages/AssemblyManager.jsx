import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AssemblyManager() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [assemblies, setAssemblies] = useState([]);
  const [expandedAssembly, setExpandedAssembly] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Quick assembly creation (like in Takeoff)
  const [showQuickAssemblyModal, setShowQuickAssemblyModal] = useState(false);
  const [editingAssemblyId, setEditingAssemblyId] = useState(null);
  const [quickAssemblyName, setQuickAssemblyName] = useState('');
  const [quickAssemblyComponents, setQuickAssemblyComponents] = useState([]);
  const [quickAssemblyAssemblyCategory, setQuickAssemblyAssemblyCategory] = useState('Conduit/Wire Assemblies');
  const [quickAssemblyCategory, setQuickAssemblyCategory] = useState('');
  const [quickAssemblyMaterialId, setQuickAssemblyMaterialId] = useState(null);
  const [quickAssemblyMaterialSearch, setQuickAssemblyMaterialSearch] = useState('');
  const [quickAssemblyQuantity, setQuickAssemblyQuantity] = useState('');
  const [quickAssemblyQuantityType, setQuickAssemblyQuantityType] = useState('per_foot');
  const [quickAssemblyDescription, setQuickAssemblyDescription] = useState('');
  
  // Add component modal
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [componentQuantity, setComponentQuantity] = useState(1);
  const [componentQuantityType, setComponentQuantityType] = useState('per_foot');
  const [componentDescription, setComponentDescription] = useState('');

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadAssemblies();
      loadMaterialsCatalog();
    }
  }, [isAdmin]);

  async function loadMaterialsCatalog() {
    try {
      // Load base materials from database (PRIMARY SOURCE)
      const { data: baseMaterials, error: baseError } = await supabase
        .from('base_materials')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
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
        laborHours: m.laborhours,
        sourceType: 'base'
      }));
      
      const formattedCustomMaterials = (customMaterials || []).map(cm => ({
        id: cm.id,
        name: cm.name,
        category: cm.category,
        description: cm.description,
        unit: cm.unit,
        price: cm.price,
        laborHours: cm.labor_hours,
        sourceType: 'custom'
      }));
      
      // Combine all materials (base materials + custom)
      const allMaterials = [
        ...formattedBaseMaterials,
        ...formattedCustomMaterials
      ];
      
      setMaterials(allMaterials);
      console.log(`✅ Loaded ${allMaterials.length} total materials (${formattedBaseMaterials.length} base + ${formattedCustomMaterials.length} custom)`);
    } catch (err) {
      console.error("Error loading materials:", err);
      alert("Failed to load materials. Please refresh the page.");
    }
  }

  async function loadAssemblies() {
    try {
      console.log("🔍 Loading assemblies...");
      const { data, error } = await supabase
        .from("assemblies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      console.log("📊 Assemblies query result:", { data, error, count: data?.length });
      
      if (error) {
        console.error("❌ Error from Supabase:", error);
        throw error;
      }
      
      console.log("✅ Setting assemblies:", data?.length || 0, "items");
      setAssemblies(data || []);
    } catch (err) {
      console.error("❌ Error loading assemblies:", err);
      alert("Failed to load assemblies: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadComponents(assemblyId) {
    try {
      const { data, error } = await supabase
        .from("assembly_components")
        .select("*")
        .eq("assembly_id", assemblyId);

      if (error) throw error;
      setComponents(data || []);
    } catch (err) {
      console.error("Error loading components:", err);
    }
  }

  async function handleExpandAssembly(assemblyId) {
    if (expandedAssembly === assemblyId) {
      setExpandedAssembly(null);
      setComponents([]);
    } else {
      setExpandedAssembly(assemblyId);
      await loadComponents(assemblyId);
    }
  }

  async function handleDuplicateAssembly(assembly) {
    const newName = prompt(`Enter name for duplicated assembly:`, `${assembly.name} (Copy)`);
    if (!newName) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("duplicate_assembly", {
        source_assembly_id: assembly.id,
        new_name: newName,
        user_company_id: user.id
      });

      if (error) throw error;

      await loadAssemblies();
      alert("Assembly duplicated successfully!");
    } catch (err) {
      console.error("Error duplicating assembly:", err);
      alert("Failed to duplicate assembly: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateComponentQuantity(componentId, newQuantity) {
    try {
      const { error } = await supabase
        .from("assembly_components")
        .update({ quantity: Number(newQuantity) })
        .eq("id", componentId);

      if (error) throw error;

      // Reload components and assemblies to get updated totals
      await loadComponents(expandedAssembly);
      await loadAssemblies();
    } catch (err) {
      console.error("Error updating component:", err);
      alert("Failed to update component");
    }
  }

  async function handleDeleteComponent(componentId) {
    if (!confirm("Are you sure you want to delete this component?")) return;

    try {
      const { error } = await supabase
        .from("assembly_components")
        .delete()
        .eq("id", componentId);

      if (error) throw error;

      // Reload components and assemblies
      await loadComponents(expandedAssembly);
      await loadAssemblies();
    } catch (err) {
      console.error("Error deleting component:", err);
      alert("Failed to delete component");
    }
  }

  async function handleAddComponent() {
    if (!selectedMaterial) {
      alert("Please select a material");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("assembly_components")
        .insert([{
          assembly_id: expandedAssembly,
          component_material_id: String(selectedMaterial.id),
          material_id: String(selectedMaterial.id),
          material_name: selectedMaterial.name,
          component_quantity: componentQuantity,
          quantity: componentQuantity,
          component_quantity_type: componentQuantityType || 'fixed',
          quantity_type: componentQuantityType || 'fixed',
          component_description: componentDescription.trim() || null,
          description: componentDescription.trim() || null,
          unit: selectedMaterial.unit || 'ea',
          material_unit_cost: selectedMaterial.price || 0,
          labor_hours: selectedMaterial.laborHours || 0,
          sequence: 999 // Will be reordered on next load
        }]);

      if (error) throw error;

      // Reload components and assemblies
      await loadComponents(expandedAssembly);
      await loadAssemblies();
      
      setShowAddComponentModal(false);
      setSelectedMaterial(null);
      setComponentQuantity(1);
      setMaterialSearch("");
    } catch (err) {
      console.error("Error adding component:", err);
      alert("Failed to add component: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAssembly(assemblyId, isCustom) {
    if (!isCustom) {
      alert("Cannot delete predefined assemblies. You can duplicate and modify them instead.");
      return;
    }

    if (!confirm("Are you sure you want to delete this assembly? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("assemblies")
        .delete()
        .eq("id", assemblyId);

      if (error) throw error;

      await loadAssemblies();
      if (expandedAssembly === assemblyId) {
        setExpandedAssembly(null);
        setComponents([]);
      }
    } catch (err) {
      console.error("Error deleting assembly:", err);
      alert("Failed to delete assembly");
    }
  }

  // Quick Assembly Builder Functions
  function addComponentToQuickAssembly() {
    if (!quickAssemblyMaterialId || quickAssemblyQuantity === '' || parseFloat(quickAssemblyQuantity) < 0) {
      alert('Please select a material and enter a quantity (0 or greater)');
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
    setQuickAssemblyMaterialSearch('');
    setQuickAssemblyQuantity('');
    setQuickAssemblyQuantityType('per_foot');
    setQuickAssemblyDescription('');
  }

  function removeComponentFromQuickAssembly(index) {
    setQuickAssemblyComponents(quickAssemblyComponents.filter((_, i) => i !== index));
  }

  async function handleEditAssembly(assemblyId) {
    // Load assembly details
    const assembly = assemblies.find(a => a.id === assemblyId);
    if (!assembly) return;
    
    // Load components
    const { data: comps, error } = await supabase
      .from('assembly_components')
      .select('*')
      .eq('assembly_id', assemblyId)
      .order('sequence');
    
    if (error) {
      console.error('Error loading components:', error);
      alert('Failed to load assembly components');
      return;
    }
    
    // Set state for editing
    setEditingAssemblyId(assemblyId);
    setQuickAssemblyName(assembly.name);
    setQuickAssemblyAssemblyCategory(assembly.category || 'Conduit/Wire');
    setQuickAssemblyComponents(comps || []);
    setShowQuickAssemblyModal(true);
  }

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
      if (editingAssemblyId) {
        // UPDATE existing assembly
        const { error: assemblyError } = await supabase
          .from('assemblies')
          .update({
            name: quickAssemblyName.trim(),
            description: `Updated with ${quickAssemblyComponents.length} components`,
            category: quickAssemblyAssemblyCategory
          })
          .eq('id', editingAssemblyId);
        
        if (assemblyError) throw assemblyError;
        
        // Delete old components
        await supabase
          .from('assembly_components')
          .delete()
          .eq('assembly_id', editingAssemblyId);
        
        // Add new components - populate BOTH old and new columns
        const componentsToInsert = quickAssemblyComponents.map((comp, idx) => ({
          assembly_id: editingAssemblyId,
          component_material_id: String(comp.material_id),
          material_id: String(comp.material_id),
          material_name: comp.material_name,
          component_quantity: comp.quantity,
          quantity: comp.quantity,
          component_quantity_type: comp.quantity_type || 'fixed',
          quantity_type: comp.quantity_type || 'fixed',
          component_description: comp.description,
          description: comp.description,
          unit: comp.unit,
          material_unit_cost: comp.material_unit_cost || 0,
          labor_hours: comp.labor_hours || 0,
          sequence: idx + 1
        }));
        
        const { error: componentsError } = await supabase
          .from('assembly_components')
          .insert(componentsToInsert);
        
        if (componentsError) throw componentsError;
        
        alert('✅ Assembly updated successfully!');
      } else {
        // CREATE new assembly
        const { data: assemblyData, error: assemblyError } = await supabase
          .from('assemblies')
          .insert([{
            company_id: user.id,
            name: quickAssemblyName.trim(),
            description: `Created with ${quickAssemblyComponents.length} components`,
            category: quickAssemblyAssemblyCategory,
            unit: 'ea',
            is_custom: true,
            is_active: true
          }])
          .select()
          .single();
        
        if (assemblyError) throw assemblyError;
        
        // Add components to the assembly - populate BOTH old and new columns
        const componentsToInsert = quickAssemblyComponents.map((comp, idx) => ({
          assembly_id: assemblyData.id,
          component_material_id: String(comp.material_id),
          material_id: String(comp.material_id),
          material_name: comp.material_name,
          component_quantity: comp.quantity,
          quantity: comp.quantity,
          component_quantity_type: comp.quantity_type || 'fixed',
          quantity_type: comp.quantity_type || 'fixed',
          component_description: comp.description,
          description: comp.description,
          unit: comp.unit,
          material_unit_cost: comp.material_unit_cost || 0,
          labor_hours: comp.labor_hours || 0,
          sequence: idx + 1
        }));
        
        const { error: componentsError } = await supabase
          .from('assembly_components')
          .insert(componentsToInsert);
        
        if (componentsError) throw componentsError;
        
        alert('✅ Assembly created successfully!');
      }
      
      // Reload assemblies
      await loadAssemblies();
      
      // Close modal and reset
      setShowQuickAssemblyModal(false);
      setEditingAssemblyId(null);
      setQuickAssemblyName('');
      setQuickAssemblyComponents([]);
      setQuickAssemblyAssemblyCategory('Conduit/Wire');
    } catch (err) {
      console.error('Error saving quick assembly:', err);
      alert('Failed to save assembly: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredMaterials = materials.filter(m =>
    m.category !== "ASSEMBLIES" && (
      m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(materialSearch.toLowerCase())
    )
  );

  // Filter assemblies based on search term
  const filteredAssemblies = assemblies.filter(assembly =>
    assembly.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (assembly.description && assembly.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div style={{ padding: 24 }}>Loading assemblies...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: "#f97316", fontSize: 24 }}>
          🔧 Assembly Manager
        </h2>
        <button
          onClick={() => setShowQuickAssemblyModal(true)}
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
      </div>

      {/* SEARCH BAR */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search assemblies by name or description..."
          style={{
            width: "100%",
            padding: "14px 18px",
            background: "#2a2a2a",
            border: "2px solid #444",
            borderRadius: 8,
            color: "#fff",
            fontSize: 15,
            outline: "none"
          }}
          onFocus={(e) => e.target.style.borderColor = "#fc6b04ff"}
          onBlur={(e) => e.target.style.borderColor = "#444"}
        />
        {searchTerm && (
          <div style={{ marginTop: 8, color: "#999", fontSize: 13 }}>
            Showing {filteredAssemblies.length} of {assemblies.length} assemblies
          </div>
        )}
      </div>

      {/* ASSEMBLIES LIST */}
      <div style={{ background: "#2a2a2a", border: "1px solid #444", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#1a1a1a" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 40 }}>
                Expand
              </th>
              <th style={{ padding: "12px", textAlign: "left", color: "#f97316", fontSize: 13, fontWeight: "bold" }}>
                Assembly Name
              </th>
              <th style={{ padding: "12px", textAlign: "left", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 120 }}>
                Category
              </th>
              <th style={{ padding: "12px", textAlign: "left", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 100 }}>
                Type
              </th>
              <th style={{ padding: "12px", textAlign: "right", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 120 }}>
                Material Cost
              </th>
              <th style={{ padding: "12px", textAlign: "right", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 100 }}>
                Labor Hrs
              </th>
              <th style={{ padding: "12px", textAlign: "center", color: "#f97316", fontSize: 13, fontWeight: "bold", width: 150 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAssemblies.map((assembly) => (
              <>
                {/* ASSEMBLY ROW */}
                <tr 
                  key={assembly.id}
                  style={{ 
                    borderBottom: "1px solid #333",
                    background: expandedAssembly === assembly.id ? "#333" : "transparent"
                  }}
                >
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <button
                      onClick={() => handleExpandAssembly(assembly.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#f97316",
                        cursor: "pointer",
                        fontSize: 18
                      }}
                    >
                      {expandedAssembly === assembly.id ? "▼" : "▶"}
                    </button>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>
                      {assembly.name}
                    </div>
                    {assembly.description && (
                      <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>
                        {assembly.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      padding: "4px 8px",
                      background: "#3b82f6",
                      color: "#fff",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: "bold"
                    }}>
                      {assembly.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      padding: "4px 8px",
                      background: assembly.is_custom ? "#8b5cf6" : "#10b981",
                      color: "#fff",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: "bold"
                    }}>
                      {assembly.is_custom ? "Custom" : "Predefined"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", color: "#10b981", fontSize: 14, fontWeight: "bold" }}>
                    ${(assembly.total_material_cost || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", color: "#8b5cf6", fontSize: 14, fontWeight: "bold" }}>
                    {(assembly.total_labor_hours || 0).toFixed(2)}h
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    {assembly.is_custom && (
                      <button
                        onClick={() => handleEditAssembly(assembly.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#f59e0b",
                          border: "none",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 12,
                          cursor: "pointer",
                          marginRight: 8
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicateAssembly(assembly)}
                      style={{
                        padding: "6px 12px",
                        background: "#3b82f6",
                        border: "none",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                        marginRight: 8
                      }}
                    >
                      📋 Duplicate
                    </button>
                    {assembly.is_custom && (
                      <button
                        onClick={() => handleDeleteAssembly(assembly.id, assembly.is_custom)}
                        style={{
                          padding: "6px 12px",
                          background: "#ef4444",
                          border: "none",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>

                {/* EXPANDED COMPONENTS */}
                {expandedAssembly === assembly.id && (
                  <tr>
                    <td colSpan="7" style={{ padding: 0 }}>
                      <div style={{ background: "#1a1a1a", padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ margin: 0, color: "#f97316", fontSize: 16 }}>
                            Components
                          </h3>
                          <button
                            onClick={() => setShowAddComponentModal(true)}
                            style={{
                              padding: "8px 16px",
                              background: "#fc6b04ff",
                              border: "none",
                              borderRadius: 6,
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            ➕ Add Component
                          </button>
                        </div>

                        {components.length === 0 ? (
                          <div style={{ color: "#999", fontSize: 14, textAlign: "center", padding: 20 }}>
                            No components yet. Click "Add Component" to get started.
                          </div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #333" }}>
                                <th style={{ padding: "8px", textAlign: "left", color: "#999", fontSize: 12 }}>Material</th>
                                <th style={{ padding: "8px", textAlign: "right", color: "#999", fontSize: 12, width: 100 }}>Qty</th>
                                <th style={{ padding: "8px", textAlign: "right", color: "#999", fontSize: 12, width: 100 }}>Unit Cost</th>
                                <th style={{ padding: "8px", textAlign: "right", color: "#999", fontSize: 12, width: 100 }}>Labor Hrs</th>
                                <th style={{ padding: "8px", textAlign: "right", color: "#999", fontSize: 12, width: 100 }}>Total</th>
                                {assembly.is_custom && (
                                  <th style={{ padding: "8px", textAlign: "center", color: "#999", fontSize: 12, width: 60 }}>Delete</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {components.map((component) => (
                                <tr key={component.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                                  <td style={{ padding: "8px", color: "#fff", fontSize: 13 }}>
                                    {component.material_name}
                                  </td>
                                  <td style={{ padding: "8px", textAlign: "right" }}>
                                    <input
                                      type="number"
                                      value={component.quantity}
                                      onChange={(e) => handleUpdateComponentQuantity(component.id, e.target.value)}
                                      style={{
                                        width: 70,
                                        padding: "4px 8px",
                                        background: "#2a2a2a",
                                        border: "1px solid #555",
                                        borderRadius: 4,
                                        color: "#fff",
                                        fontSize: 13,
                                        textAlign: "right"
                                      }}
                                      step="0.1"
                                    />
                                  </td>
                                  <td style={{ padding: "8px", textAlign: "right", color: "#10b981", fontSize: 13 }}>
                                    ${component.material_unit_cost.toFixed(2)}
                                  </td>
                                  <td style={{ padding: "8px", textAlign: "right", color: "#8b5cf6", fontSize: 13 }}>
                                    {component.labor_hours.toFixed(2)}h
                                  </td>
                                  <td style={{ padding: "8px", textAlign: "right", color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                                    ${(component.quantity * component.material_unit_cost).toFixed(2)}
                                  </td>
                                  {assembly.is_custom && (
                                    <td style={{ padding: "8px", textAlign: "center" }}>
                                      <button
                                        onClick={() => handleDeleteComponent(component.id)}
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: "#ef4444",
                                          cursor: "pointer",
                                          fontSize: 16
                                        }}
                                      >
                                        🗑️
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD COMPONENT MODAL */}
      {showAddComponentModal && (
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
            maxWidth: 600,
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#f97316", fontSize: 20 }}>
              Add Component
            </h3>

            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="🔍 Search materials..."
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#1a1a1a",
                  border: "1px solid #555",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14
                }}
              />
            </div>

            <div style={{
              maxHeight: 300,
              overflowY: "auto",
              border: "1px solid #444",
              borderRadius: 6,
              marginBottom: 16
            }}>
              {filteredMaterials.slice(0, 50).map((material) => (
                <div
                  key={material.id}
                  onClick={() => setSelectedMaterial(material)}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #333",
                    cursor: "pointer",
                    background: selectedMaterial?.id === material.id ? "#fc6b04ff" : "transparent"
                  }}
                  onMouseEnter={(e) => { if (selectedMaterial?.id !== material.id) e.currentTarget.style.background = "#333" }}
                  onMouseLeave={(e) => { if (selectedMaterial?.id !== material.id) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>
                    {material.name}
                  </div>
                  <div style={{ color: "#999", fontSize: 11, marginTop: 2 }}>
                    ${Number(material.price || 0).toFixed(2)} | {Number(material.laborHours || material.labourHours || 0).toFixed(2)}h | {material.category}
                  </div>
                </div>
              ))}
            </div>

            {selectedMaterial && (
              <div style={{ marginBottom: 20, padding: 12, background: "#1a1a1a", borderRadius: 6 }}>
                <div style={{ color: "#f97316", fontSize: 14, fontWeight: "bold", marginBottom: 12 }}>
                  Selected: {selectedMaterial.name}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
                      Quantity Type
                    </label>
                    <select
                      value={componentQuantityType}
                      onChange={(e) => setComponentQuantityType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: "6px 10px",
                        background: "#2a2a2a",
                        border: "1px solid #555",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 13
                      }}
                    >
                      <option value="fixed">Fixed Qty</option>
                      <option value="per_foot">Per Foot</option>
                      <option value="per_10_feet">Per 10 Feet</option>
                      <option value="per_100_feet">Per 100 Feet</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
                      Base Quantity
                    </label>
                    <input
                      type="number"
                      value={componentQuantity}
                      onChange={(e) => setComponentQuantity(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: "6px 10px",
                        background: "#2a2a2a",
                        border: "1px solid #555",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 13
                      }}
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={componentDescription}
                    onChange={(e) => setComponentDescription(e.target.value)}
                    placeholder="e.g., '1 coupling per 10-foot stick'"
                    style={{
                      width: '100%',
                      padding: "6px 10px",
                      background: "#2a2a2a",
                      border: "1px solid #555",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
      setShowAddComponentModal(false);
      setSelectedMaterial(null);
      setComponentQuantity(1);
      setComponentQuantityType('per_foot');
      setComponentDescription('');
      setMaterialSearch("");
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
                onClick={handleAddComponent}
                disabled={!selectedMaterial || saving}
                style={{
                  padding: "10px 20px",
                  background: selectedMaterial && !saving ? "#fc6b04ff" : "#666",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "bold",
                  cursor: selectedMaterial && !saving ? "pointer" : "not-allowed"
                }}
              >
                {saving ? "Adding..." : "Add Component"}
              </button>

            </div>
          </div>
        </div>
      )}

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
        }} onClick={(e) => { if (e.target === e.currentTarget) { setShowQuickAssemblyModal(false); setQuickAssemblyName(''); setQuickAssemblyComponents([]); } }}>
          <div style={{
            background: "#2a2a2a",
            border: "2px solid #fc6b04ff",
            borderRadius: 12,
            padding: 30,
            maxWidth: 700,
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px 0", color: "#f97316", fontSize: 20 }}>
              {editingAssemblyId ? '✏️ Edit Assembly' : '🔧 Create Assembly'}
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#fff", fontSize: 14 }}>
                Category *
              </label>
              <select
                value={quickAssemblyAssemblyCategory}
                onChange={(e) => setQuickAssemblyAssemblyCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#1a1a1a",
                  border: "1px solid #555",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14
                }}
              >
                <option value="Conduit/Wire Assemblies">Conduit/Wire Assemblies</option>
                <option value="Receptacle Assemblies">Receptacle Assemblies</option>
                <option value="Switch Assemblies">Switch Assemblies</option>
                <option value="Power Assemblies">Power Assemblies</option>
                <option value="Equipment Assemblies">Equipment Assemblies</option>
                <option value="Appliance Assemblies">Appliance Assemblies</option>
                <option value="Lighting Assemblies">Lighting Assemblies</option>
                <option value="Panel/Gear Assemblies">Panel/Gear Assemblies</option>
              </select>
            </div>

            {/* Components Section */}
            <div style={{ marginTop: 24, padding: 16, background: "#1a1a1a", borderRadius: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: '600', color: "#f97316" }}>Components</h4>

              {/* Add Component Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {/* Row 1: Searchable Material Selection */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={quickAssemblyMaterialSearch}
                    onChange={(e) => setQuickAssemblyMaterialSearch(e.target.value)}
                    placeholder="🔍 Search materials (type to search)..."
                    style={{
                      width: '100%',
                      padding: "8px 10px",
                      background: "#2a2a2a",
                      border: "1px solid #555",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 13
                    }}
                  />
                  {quickAssemblyMaterialSearch && (
                    <div style={{ 
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: 200, 
                      overflowY: 'auto', 
                      border: '1px solid #555', 
                      borderRadius: 4, 
                      marginTop: 4,
                      backgroundColor: '#2a2a2a',
                      zIndex: 10
                    }}>
                      {materials
                        .filter(m => {
                          if (m.category === 'ASSEMBLIES') return false;
                          const searchLower = quickAssemblyMaterialSearch.toLowerCase().replace(/['"°*]/g, '').trim();
                          const nameLower = m.name.toLowerCase().replace(/['"″°*]/g, '').trim();
                          const categoryLower = m.category.toLowerCase();
                          const idLower = String(m.id || '').toLowerCase();
                          return nameLower.includes(searchLower) || categoryLower.includes(searchLower) || idLower.includes(searchLower);
                        })
                        .sort((a, b) => {
                          const searchLower = quickAssemblyMaterialSearch.toLowerCase().replace(/['"°*]/g, '').trim();
                          const aNameLower = a.name.toLowerCase().replace(/['"″°*]/g, '').trim();
                          const bNameLower = b.name.toLowerCase().replace(/['"″°*]/g, '').trim();
                          
                          // Exact match first
                          const aExact = aNameLower === searchLower;
                          const bExact = bNameLower === searchLower;
                          if (aExact && !bExact) return -1;
                          if (!aExact && bExact) return 1;
                          
                          // Starts with search term
                          const aStarts = aNameLower.startsWith(searchLower);
                          const bStarts = bNameLower.startsWith(searchLower);
                          if (aStarts && !bStarts) return -1;
                          if (!aStarts && bStarts) return 1;
                          
                          // Alphabetical
                          return a.name.localeCompare(b.name);
                        })
                        .slice(0, 50)
                        .map(material => (
                          <div
                            key={material.id}
                            onClick={() => {
                              setQuickAssemblyMaterialId(material.id);
                              setQuickAssemblyMaterialSearch('');
                            }}
                            style={{
                              padding: '8px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #333'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>{material.name}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>{material.category} • ${material.price?.toFixed(2) || '0.00'}</div>
                          </div>
                        ))}
                    </div>
                  )}
                  {quickAssemblyMaterialId && !quickAssemblyMaterialSearch && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#10b981', fontWeight: '500' }}>
                      ✓ Selected: {materials.find(m => m.id === quickAssemblyMaterialId)?.name}
                    </div>
                  )}
                </div>

                {/* Row 2: Quantity Type and Base Quantity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
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

                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
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
                </div>

                {/* Row 3: Optional Description */}
                <input
                  type="text"
                  value={quickAssemblyDescription}
                  onChange={(e) => setQuickAssemblyDescription(e.target.value)}
                  placeholder="Optional: e.g., '1 coupling per 10-foot stick'"
                  style={{
                    width: '100%',
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
                  setEditingAssemblyId(null);
                  setQuickAssemblyName('');
                  setQuickAssemblyComponents([]);
                  setQuickAssemblyAssemblyCategory('Conduit/Wire');
                  setQuickAssemblyMaterialId(null);
                  setQuickAssemblyMaterialSearch('');
                  setQuickAssemblyQuantity('');
                  setQuickAssemblyQuantityType('per_foot');
                  setQuickAssemblyDescription('');
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
                {saving ? (editingAssemblyId ? "Updating..." : "Creating...") : (editingAssemblyId ? "Update Assembly" : "Create Assembly")}
              </button>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}

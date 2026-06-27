import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import DesktopHeader from "../Components/DesktopHeader";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { notify, confirmDialog } from '../lib/notify';

export default function BaseMaterialsManager() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "",
    description: "",
    unit: "ea",
    basecost: "",
    laborhours: ""
  });

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadMaterials();
    }
  }, [isAdmin]);

  async function loadMaterials() {
    try {
      // Load all materials using range to bypass the 1000 row limit
      const { data, error, count } = await supabase
        .from("base_materials")
        .select("*", { count: 'exact' })
        .order("category")
        .order("name")
        .range(0, 99999); // Load up to 100,000 materials
      
      if (error) throw error;
      console.log("Loaded materials:", data?.length, "items", count ? `(Total: ${count})` : "");
      // Force new array reference to trigger React re-render
      setMaterials([...(data || [])]);
    } catch (error) {
      console.error("Error loading materials:", error);
      notify("Error loading materials");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      if (editingMaterial) {
        // Update existing - DON'T include id in update data (it's primary key)
        const updateData = {
          name: formData.name.trim(),
          category: formData.category.trim(),
          description: formData.description.trim(),
          unit: formData.unit,
          basecost: parseFloat(formData.basecost),
          laborhours: parseFloat(formData.laborhours)
        };
        
        const { error } = await supabase
          .from("base_materials")
          .update(updateData)
          .eq("id", editingMaterial.id);
        
        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        
        console.log("Update successful!");
        notify("Material updated successfully!");
      } else {
        // Insert new - include id for new materials
        const insertData = {
          id: formData.id.trim(),
          name: formData.name.trim(),
          category: formData.category.trim(),
          description: formData.description.trim(),
          unit: formData.unit,
          basecost: parseFloat(formData.basecost),
          laborhours: parseFloat(formData.laborhours)
        };
        
        const { data, error } = await supabase
          .from("base_materials")
          .insert([insertData])
          .select();
        
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        
        console.log("Insert successful, data:", data);
        notify("Material added successfully!");
      }

      setShowAddModal(false);
      setEditingMaterial(null);
      resetForm();
      
      // Force reload
      console.log("Reloading materials...");
      await loadMaterials();
      console.log("Materials reloaded");
    } catch (error) {
      console.error("Error saving material:", error);
      notify("Error saving material: " + (error.message || JSON.stringify(error)));
    }
  }

  async function handleDelete(id) {
    if (!await confirmDialog("Are you sure you want to delete this material?")) return;
    
    try {
      const { error } = await supabase
        .from("base_materials")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      notify("Material deleted successfully!");
      loadMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
      notify("Error deleting material: " + error.message);
    }
  }

  // Batch delete function
  async function handleBatchDelete() {
    if (selectedMaterials.length === 0) {
      notify("Please select materials to delete");
      return;
    }

    if (!await confirmDialog(`Are you sure you want to delete ${selectedMaterials.length} material(s)?`)) return;
    
    try {
      const { error } = await supabase
        .from("base_materials")
        .delete()
        .in("id", selectedMaterials);
      
      if (error) throw error;
      notify(`${selectedMaterials.length} material(s) deleted successfully!`);
      setSelectedMaterials([]);
      loadMaterials();
    } catch (error) {
      console.error("Error deleting materials:", error);
      notify("Error deleting materials: " + error.message);
    }
  }

  // Toggle individual checkbox
  function toggleMaterialSelection(materialId) {
    setSelectedMaterials(prev => {
      if (prev.includes(materialId)) {
        return prev.filter(id => id !== materialId);
      } else {
        return [...prev, materialId];
      }
    });
  }

  // Toggle select all
  function toggleSelectAll() {
    if (selectedMaterials.length === filteredMaterials.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(filteredMaterials.map(m => m.id));
    }
  }

  function resetForm() {
    setFormData({
      id: "",
      name: "",
      category: "",
      description: "",
      unit: "ea",
      basecost: "",
      laborhours: ""
    });
  }

  function openAddModal() {
    resetForm();
    setEditingMaterial(null);
    setShowAddModal(true);
  }

  function openEditModal(material) {
    setFormData({
      id: material.id,
      name: material.name,
      category: material.category,
      description: material.description || "",
      unit: material.unit,
      basecost: material.basecost.toString(),
      laborhours: material.laborhours.toString()
    });
    setEditingMaterial(material);
    setShowAddModal(true);
  }

  // CSV file handler
  function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  // Parse CSV text
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Validate headers
    const required = ['id', 'category', 'name', 'unit', 'basecost', 'laborhours'];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      notify(`Missing required columns: ${missing.join(', ')}`);
      return;
    }
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
    
    setCsvData(data);
    setShowImportModal(true);
  }

  // Export to CSV function
  function exportToCSV() {
    const csvHeaders = 'id,category,name,description,unit,basecost,laborhours\n';
    const csvRows = filteredMaterials.map(m => {
      return `${m.id},${m.category},"${m.name}","${m.description || ''}",${m.unit},${m.basecost},${m.laborhours}`;
    }).join('\n');
    
    const csvContent = csvHeaders + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `base_materials_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Bulk import function
  async function bulkImport() {
    setImporting(true);
    setImportProgress(0);
    
    let imported = 0;
    let skipped = 0;
    let errors = [];
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('base_materials')
          .select('id')
          .eq('id', row.id)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Insert new material
        const { error } = await supabase
          .from('base_materials')
          .insert([{
            id: row.id,
            category: row.category,
            name: row.name,
            description: row.description || '',
            unit: row.unit,
            basecost: parseFloat(row.basecost),
            laborhours: parseFloat(row.laborhours)
          }]);
        
        if (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        } else {
          imported++;
        }
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
      
      setImportProgress(Math.round(((i + 1) / csvData.length) * 100));
    }
    
    setImporting(false);
    setShowImportModal(false);
    setCsvData([]);
    
    loadMaterials();
    
    let message = `Import complete!\n`;
    message += `✅ Imported: ${imported}\n`;
    if (skipped > 0) message += `⏭️ Skipped (duplicates): ${skipped}\n`;
    if (errors.length > 0) message += `❌ Errors: ${errors.length}\n\n${errors.slice(0, 5).join('\n')}`;
    
    notify(message);
  }

  const categories = ["All", ...new Set(materials.map(m => m.category))];
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <DesktopHeader title="Base Materials Manager (Admin Only)" />
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button onClick={openAddModal} style={styles.addButton}>
            + Add Material
          </button>

          {selectedMaterials.length > 0 && (
            <button onClick={handleBatchDelete} style={styles.batchDeleteButton}>
              🗑️ Delete Selected ({selectedMaterials.length})
            </button>
          )}
          
          <button onClick={() => setShowImportModal(true)} style={styles.importButton}>
            📤 Import from CSV
          </button>
          
          <button onClick={exportToCSV} style={styles.exportButton}>
            📥 Export to CSV
          </button>
          
          <a href="/bulk_materials_template.csv" download style={styles.downloadLink}>
            📄 Download Template
          </a>
          
          <input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.categorySelect}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading materials...</p>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, width: 50}}>
                    <input
                      type="checkbox"
                      checked={filteredMaterials.length > 0 && selectedMaterials.length === filteredMaterials.length}
                      onChange={toggleSelectAll}
                      style={styles.checkbox}
                    />
                  </th>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Unit</th>
                  <th style={styles.th}>Cost</th>
                  <th style={styles.th}>Labor Hrs</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(material => (
                  <tr key={material.id} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(material.id)}
                        onChange={() => toggleMaterialSelection(material.id)}
                        style={styles.checkbox}
                      />
                    </td>
                    <td style={styles.td}>{material.id}</td>
                    <td style={styles.td}>{material.name}</td>
                    <td style={styles.td}>{material.category}</td>
                    <td style={styles.td}>{material.unit}</td>
                    <td style={styles.td}>${material.basecost.toFixed(2)}</td>
                    <td style={styles.td}>{material.laborhours}</td>
                    <td style={styles.td}>
                      <button onClick={() => openEditModal(material)} style={styles.editButton}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(material.id)} style={styles.deleteButton}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={styles.count}>Showing {filteredMaterials.length} of {materials.length} materials</p>
          </div>
        )}

        {showImportModal && (
          <div style={styles.modal} onClick={() => {if (!importing) setShowImportModal(false)}}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>Import Materials from CSV</h2>
              
              {csvData.length === 0 ? (
                <>
                  <p>Select a CSV file to import materials in bulk.</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFile}
                    style={styles.input}
                  />
                </>
              ) : (
                <>
                  <p>Found {csvData.length} materials to import.</p>
                  <div style={{maxHeight: 200, overflowY: 'auto', marginBottom: 20}}>
                    {csvData.slice(0, 5).map((row, i) => (
                      <div key={i} style={{padding: 8, borderBottom: '1px solid #eee'}}>
                        <strong>{row.name}</strong> - {row.category} (${row.basecost}, {row.laborhours}hrs)
                      </div>
                    ))}
                    {csvData.length > 5 && <p>...and {csvData.length - 5} more</p>}
                  </div>
                  
                  {importing && (
                    <div style={{marginBottom: 20}}>
                      <div style={{backgroundColor: '#eee', height: 20, borderRadius: 10, overflow: 'hidden'}}>
                        <div style={{backgroundColor: '#0070f3', height: '100%', width: `${importProgress}%`, transition: 'width 0.3s'}} />
                      </div>
                      <p style={{textAlign: 'center', marginTop: 8}}>{importProgress}%</p>
                    </div>
                  )}
                  
                  <div style={styles.modalButtons}>
                    <button onClick={() => {setShowImportModal(false); setCsvData([]);}} style={styles.cancelButton} disabled={importing}>
                      Cancel
                    </button>
                    <button onClick={bulkImport} style={styles.saveButton} disabled={importing}>
                      {importing ? 'Importing...' : `Import ${csvData.length} Materials`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showAddModal && (
          <div style={styles.modal} onClick={() => setShowAddModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>{editingMaterial ? "Edit Material" : "Add New Material"}</h2>
              <form onSubmit={handleSubmit}>
                <div style={styles.formGroup}>
                  <label>ID (unique):</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMaterial}
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Name:</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Category:</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Description:</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    style={{...styles.input, minHeight: 60}}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Unit:</label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    style={styles.input}
                    placeholder="ea, ft, lb, etc."
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Base Cost ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.basecost}
                    onChange={(e) => setFormData({...formData, basecost: e.target.value})}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Labor Hours:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.laborhours}
                    onChange={(e) => setFormData({...formData, laborhours: e.target.value})}
                    style={styles.input}
                  />
                </div>

                <div style={styles.modalButtons}>
                  <button type="submit" style={styles.saveButton}>
                    {editingMaterial ? "Update" : "Add"} Material
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} style={styles.cancelButton}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: 20,
    maxWidth: 1400,
    margin: "0 auto"
  },
  toolbar: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap"
  },
  addButton: {
    padding: "10px 20px",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  importButton: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  exportButton: {
    padding: "10px 20px",
    backgroundColor: "#f59e0b",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  downloadLink: {
    padding: "10px 20px",
    backgroundColor: "#6366f1",
    color: "white",
    border: "none",
    borderRadius: 6,
    textDecoration: "none",
    fontWeight: 600,
    display: "inline-block"
  },
  searchInput: {
    padding: "10px 15px",
    border: "1px solid #ddd",
    borderRadius: 6,
    flex: 1,
    minWidth: 200
  },
  categorySelect: {
    padding: "10px 15px",
    border: "1px solid #ddd",
    borderRadius: 6,
    minWidth: 150
  },
  tableContainer: {
    overflowX: "auto",
    backgroundColor: "white",
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    padding: 12,
    textAlign: "left",
    borderBottom: "2px solid #eee",
    fontWeight: 600,
    backgroundColor: "#f8f9fa",
    color: "#333"
  },
  tr: {
    borderBottom: "1px solid #eee"
  },
  td: {
    padding: 12,
    color: "#333"
  },
  editButton: {
    padding: "6px 12px",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    marginRight: 8
  },
  deleteButton: {
    padding: "6px 12px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer"
  },
  count: {
    padding: 12,
    textAlign: "center",
    color: "#666",
    fontSize: 14
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 8,
    maxWidth: 500,
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
    color: "#333"
  },
  formGroup: {
    marginBottom: 15
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 4,
    fontSize: 14,
    color: "#333",
    backgroundColor: "white"
  },
  modalButtons: {
    display: "flex",
    gap: 10,
    marginTop: 20
  },
  saveButton: {
    flex: 1,
    padding: "10px 20px",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  cancelButton: {
    flex: 1,
    padding: "10px 20px",
    backgroundColor: "#666",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer"
  },
  batchDeleteButton: {
    padding: "10px 20px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer"
  }
};

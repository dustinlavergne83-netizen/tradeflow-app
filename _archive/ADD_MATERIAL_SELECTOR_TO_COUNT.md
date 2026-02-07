# Add Material Selector to Count Tool

## Overview
Add a material selector dropdown to the Count Tool modal so users can link counted items to materials from their database.

## Database Changes

### Migration File: `056_add_material_to_measurements.sql`
- Adds `material_id` field to `plan_measurements` table
- Adds `notes` field for additional details
- Creates index for faster lookups

**Run this migration first:**
```bash
# In Supabase Dashboard → SQL Editor
# Run the migration file 056_add_material_to_measurements.sql
```

## Frontend Changes

### 1. Load Materials List
Add state and effect to load materials:
```javascript
const [materials, setMaterials] = useState([]);
const [selectedMaterialId, setSelectedMaterialId] = useState(null);

// Load materials
useEffect(() => {
  loadMaterials();
}, []);

async function loadMaterials() {
  try {
    const { data, error } = await supabase
      .from('custom_materials')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) throw error;
    setMaterials(data || []);
  } catch (err) {
    console.error('Error loading materials:', err);
  }
}
```

### 2. Update Count Modal UI
Add material selector dropdown in the count modal (before the label input):

```jsx
{showCountModal && (
  <div style={styles.modalOverlay} onClick={() => setShowCountModal(false)}>
    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
      <h2 style={styles.modalTitle}>Save Count</h2>
      
      <p style={styles.modalDescription}>
        Count: <strong>{countMarkers.length} items</strong>
      </p>
      
      {/* NEW: Material Selector */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Material:</label>
        <select
          value={selectedMaterialId || ''}
          onChange={(e) => setSelectedMaterialId(e.target.value || null)}
          style={styles.select}
        >
          <option value="">-- Select Material (Optional) --</option>
          {materials.map(material => (
            <option key={material.id} value={material.id}>
              {material.category} - {material.name} ({material.unit})
            </option>
          ))}
        </select>
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Label (optional):</label>
        <input 
          type="text"
          value={measurementLabel} 
          onChange={(e) => setMeasurementLabel(e.target.value)}
          placeholder="e.g., Receptacles, Light fixtures, Panels"
          style={styles.select}
          autoFocus
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              saveCount();
            }
          }}
        />
      </div>
      
      <div style={styles.modalButtons}>
        <button 
          onClick={() => {
            /* Cancel code */
          }} 
          style={styles.cancelButton}
        >
          Cancel
        </button>
        <button 
          onClick={saveCount} 
          style={styles.saveButton}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}
```

### 3. Update saveCount Function
Add material_id and notes to the insert:

```javascript
async function saveCount() {
  const isEditing = editingMeasurementIdRef.current !== null;
  
  if (isEditing) {
    // UPDATE mode
    try {
      const allMarkersForMeasurement = countMarkersRef.current.filter(
        m => m.measurementId === editingMeasurementIdRef.current || !m.measurementId
      );
      
      const pdfRelativeMarkers = allMarkersForMeasurement.map(m => ({
        x: m.baseX,
        y: m.baseY
      }));
      
      const { error } = await supabase
        .from('plan_measurements')
        .update({
          geometry: { markers: pdfRelativeMarkers },
          raw_value: pdfRelativeMarkers.length,
          calculated_value: pdfRelativeMarkers.length,
          material_id: selectedMaterialId, // NEW
          label: measurementLabel.trim() || null,
        })
        .eq('id', editingMeasurementIdRef.current);
      
      if (error) throw error;
      
      /* ... rest of update code */
    } catch (err) {
      console.error('Error updating count:', err);
      alert('Failed to update count: ' + err.message);
    }
  } else {
    // CREATE mode
    const unsavedMarkers = countMarkersRef.current.filter(m => !m.measurementId);
    
    if (unsavedMarkers.length === 0) {
      alert('No new markers to save!');
      return;
    }

    const label = measurementLabel.trim();
    const count = unsavedMarkers.length;
    const markerColor = selectedColorRef.current;

    try {
      const pdfRelativeMarkers = unsavedMarkers.map(m => ({
        x: m.baseX,
        y: m.baseY
      }));
      
      const { data, error } = await supabase
        .from('plan_measurements')
        .insert([{
          plan_id: planId,
          page_number: currentPageRef.current,
          measurement_type: 'count',
          geometry: { markers: pdfRelativeMarkers },
          raw_value: count,
          calculated_value: count,
          unit: 'items',
          label: label || null,
          layer_id: activeLayerRef.current,
          color: markerColor,
          material_id: selectedMaterialId, // NEW
          company_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      /* ... rest of create code */
      
      // Reset modal state
      setShowCountModal(false);
      setMeasurementLabel('');
      setSelectedMaterialId(null); // NEW: Reset material selection
      
    } catch (err) {
      console.error('Error saving count:', err);
      alert('Failed to save count: ' + err.message);
    }
  }
}
```

### 4. Display Material in Measurements List
Update the measurements list to show the linked material:

```javascript
{measurements.map(measurement => {
  // Find the linked material if exists
  const linkedMaterial = measurement.material_id 
    ? materials.find(m => m.id === measurement.material_id)
    : null;
    
  return (
    <div 
      key={measurement.id} 
      style={{
        ...styles.measurementItem,
        ...(measurement.measurement_type === 'count' ? { cursor: 'pointer' } : {})
      }}
      onClick={() => {
        if (measurement.measurement_type === 'count') {
          editCountMeasurement(measurement.id);
        }
      }}
      title={measurement.measurement_type === 'count' ? 'Click to edit count' : ''}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteMeasurement(measurement.id);
        }}
        style={styles.deleteButton}
        title="Delete measurement"
      >
        ✕
      </button>
      <div style={styles.measurementType}>
        {measurement.measurement_type === 'length' ? '📏' : 
         measurement.measurement_type === 'area' ? '⬜' : '🎯'}
        {measurement.measurement_type}
      </div>
      <div style={styles.measurementValue}>
        {measurement.calculated_value?.toFixed(2)} {measurement.unit}
      </div>
      {measurement.label && (
        <div style={styles.measurementLabel}>{measurement.label}</div>
      )}
      {linkedMaterial && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          📦 {linkedMaterial.name}
        </div>
      )}
    </div>
  );
})}
```

## Testing Steps

1. **Run the migration** in Supabase Dashboard
2. **Add some materials** to your custom_materials table if you haven't already
3. **Use the Count tool** to place markers
4. **Click "Finish Count"** - modal should now show material dropdown
5. **Select a material** from the dropdown
6. **Enter a label** (optional)
7. **Save** - the count should be saved with the material link
8. **Check the measurements list** - should show the linked material

## Benefits

- ✅ Links takeoff counts directly to materials database
- ✅ Makes it easy to know what was counted
- ✅ Sets up for future features (auto-pricing, material lists, etc.)
- ✅ Optional - doesn't require selecting a material if you don't want to

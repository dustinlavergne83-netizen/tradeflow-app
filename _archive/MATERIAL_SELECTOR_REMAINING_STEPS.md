# Material Selector - Remaining Implementation Steps

## ✅ What's Already Done:
1. Migration `056_add_material_to_measurements.sql` - RUN ✅
2. Added state variables for materials and selectedMaterialId
3. Added `loadMaterials()` function

## 🔧 What You Need to Do:

### Step 1: Add useEffect to Load Materials
Find this line in Takeoff.jsx (around line 236):
```javascript
// Load plan data
useEffect(() => {
  if (planId) loadPlan();
}, [planId]);
```

Add AFTER it:
```javascript
// Load materials
useEffect(() => {
  loadMaterials();
}, []);
```

### Step 2: Update Count Modal - Add Material Dropdown
Find the Count Tool Modal (search for `{showCountModal &&`). 

Add this code BEFORE the existing label input:
```jsx
{/* Material Selector */}
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
```

### Step 3: Update saveCount Function - Save Material ID
Find the `saveCount` function. There are TWO places to add `material_id`:

**A. In the UPDATE section (around line 1045):**
```javascript
const { error } = await supabase
  .from('plan_measurements')
  .update({
    geometry: { markers: pdfRelativeMarkers },
    raw_value: pdfRelativeMarkers.length,
    calculated_value: pdfRelativeMarkers.length,
    material_id: selectedMaterialId, // ADD THIS LINE
    label: measurementLabel.trim() || null,
  })
  .eq('id', editingMeasurementIdRef.current);
```

**B. In the INSERT section (around line 1090):**
```javascript
const { data, error } = await supabase
  .from('plan_measurements')
  .insert([{
    plan_id: planId,
    page_number: currentPageRef.current,
    measurement_type: 'count',
    geometry: {
      markers: pdfRelativeMarkers
    },
    raw_value: count,
    calculated_value: count,
    unit: 'items',
    label: label || null,
    layer_id: activeLayerRef.current,
    color: markerColor,
    material_id: selectedMaterialId, // ADD THIS LINE
    company_id: user.id,
  }])
```

**C. Reset selectedMaterialId after save (around line 1125):**
```javascript
// Reset modal state
setShowCountModal(false);
setMeasurementLabel('');
setSelectedMaterialId(null); // ADD THIS LINE
```

### Step 4: Display Material in Measurements List
Find the measurements list rendering (search for `{measurements.map(measurement =>`).

Add this BEFORE the closing `</div>` of each measurement item:
```jsx
{measurement.material_id && (() => {
  const linkedMaterial = materials.find(m => m.id === measurement.material_id);
  return linkedMaterial ? (
    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
      📦 {linkedMaterial.name}
    </div>
  ) : null;
})()}
```

## 🎯 Testing:
1. Use Count tool to place markers
2. Click "Finish Count"
3. Modal should show material dropdown
4. Select a material and save
5. Check measurements list - should show material name

## ✅ That's It!
Once you make these 4 changes, the material selector will be fully functional!

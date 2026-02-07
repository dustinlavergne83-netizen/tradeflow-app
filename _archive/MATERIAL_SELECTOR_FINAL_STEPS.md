# Material Selector - Final 3 Steps

## ✅ Already Complete:
1. ✅ Migration run
2. ✅ State variables added
3. ✅ loadMaterials() function added
4. ✅ useEffect to load materials added
5. ✅ Material dropdown added to modal UI

## 🔧 Remaining Steps (Very Quick!):

### Step 1: Add `material_id` to INSERT (Line ~1575)
Find this in `saveCount()`:
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
    company_id: user.id,  // <- Add the next line after this
  }])
```

Add this line right after `company_id`:
```javascript
    material_id: selectedMaterialId,
```

### Step 2: Add `material_id` to UPDATE (Line ~1512)
Find this in the UPDATE section of `saveCount()`:
```javascript
const { error } = await supabase
  .from('plan_measurements')
  .update({
    geometry: { markers: pdfRelativeMarkers },
    raw_value: pdfRelativeMarkers.length,
    calculated_value: pdfRelativeMarkers.length,
  })  // <- Add the next line BEFORE this closing parenthesis
  .eq('id', editingMeasurementIdRef.current);
```

Change to:
```javascript
const { error } = await supabase
  .from('plan_measurements')
  .update({
    geometry: { markers: pdfRelativeMarkers },
    raw_value: pdfRelativeMarkers.length,
    calculated_value: pdfRelativeMarkers.length,
    material_id: selectedMaterialId,  // <- ADD THIS LINE
  })
  .eq('id', editingMeasurementIdRef.current);
```

### Step 3: Reset `selectedMaterialId` after save (Line ~1620)
Find this in `saveCount()`:
```javascript
// Reset modal state
setShowCountModal(false);
setMeasurementLabel('');
```

Add this line after:
```javascript
setSelectedMaterialId(null);
```

### Step 4: Display material in measurements list (Line ~2220)
Find this in the measurements list rendering:
```javascript
{measurement.label && (
  <div style={styles.measurementLabel}>{measurement.label}</div>
)}
```

Add this RIGHT AFTER the label div (before the closing `</div>` of measurementItem):
```javascript
{measurement.material_id && (() => {
  const linkedMaterial = materials.find(m => m.id === measurement.material_id);
  return linkedMaterial ? (
    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
      📦 {linkedMaterial.name}
    </div>
  ) : null;
})()}
```

## 🎯 That's It!
Once these 4 small changes are made, your material selector will be fully functional! The dropdown will appear in the count modal, save the material reference, and display it in the measurements list.

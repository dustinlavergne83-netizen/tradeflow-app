# FINAL FIX: Auto-Save Not Triggering

## THE REAL PROBLEM
When Takeoff exports items to Estimate, the `rows` state changes but auto-save doesn't trigger because:
1. The useEffect dependencies don't include everything needed
2. Child items aren't being saved to database
3. The `rowsSection` check prevents saves

## THE COMPLETE FIX

### STEP 1: Make auto-save trigger on ANY change
In `src/pages/Estimate.jsx`, find the auto-save useEffect (around line 1035):

**FIND THIS:**
```javascript
useEffect(() => {
  if (!projectId || !user) return;
  
  // Use the tracked rowsSection, not currentSection
  const sectionToSave = rowsSection;
  
  const timeoutId = setTimeout(() => {
    autoSaveEstimate(sectionToSave);
  }, 2000);

  return () => clearTimeout(timeoutId);
}, [rows, overheadPercent, profitPercent, phase, subPhase, level, subLevel]);
```

**CHANGE THE LAST LINE TO:**
```javascript
}, [rows, overheadPercent, profitPercent, phase, subPhase, level, subLevel, projectId, user, rowsSection]);
```

**Why:** This ensures auto-save runs whenever rows change, including when Takeoff imports data.

### STEP 2: Fix the section check
In the same useEffect, find the `autoSaveEstimate` function (around line 1050).

**FIND THIS LINE (near the top of autoSaveEstimate):**
```javascript
const sectionToSave = rowsSection;
```

**CHANGE IT TO:**
```javascript
const sectionToSave = currentSection; // Always use current section
```

**Why:** `rowsSection` might be outdated. Use `currentSection` which is always correct.

### STEP 3: Save children too
Around line 1100, find where lineItems are created for change orders.

**FIND:**
```javascript
const lineItems = validRows.map((row, index) => ({
  change_order_id: coId,
  section: sectionToSave,
  sequence: index,
  // ... lots of fields
}));
```

**REPLACE WITH:**
```javascript
const lineItems = [];
let sequence = 0;

for (const row of validRows) {
  lineItems.push({
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
  
  // CRITICAL: Save children too!
  if (row.children && row.children.length > 0) {
    for (const child of row.children) {
      lineItems.push({
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
        parent_id: null
      });
    }
  }
}
```

### STEP 4: Do the same for regular estimates
Around line 1150-1200, find the SECOND place where lineItems are created (for regular estimates).

Do the EXACT SAME replacement but use `estimate_id: currentEstimateId,` instead of `change_order_id: coId,`

## RESULT
✅ Auto-save triggers immediately when Takeoff exports
✅ Auto-save keeps running on ALL changes
✅ Child items are saved to database
✅ Arrows persist across section switches

## TEST
1. Export from Takeoff
2. Wait 2 seconds
3. Check console - should see "✅ CO auto-save complete!" or similar
4. Switch sections and come back - arrows should be there

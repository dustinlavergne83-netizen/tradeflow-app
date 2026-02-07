# SIMPLE FIX - Step by Step

## THE ISSUE
Child items disappear after switching sections because they're not being saved to the database.

## FIX STEPS

### STEP 1: Open the file
1. In VS Code, open `src/pages/Estimate.jsx`
2. Press `Ctrl+F` to open Find
3. Search for: `// ===== CHANGE ORDER SAVE LOGIC =====`
4. You should see this around line 1050

### STEP 2: Find the code to replace
Scroll down a bit and find this line (around line 1100):
```javascript
const lineItems = validRows.map((row, index) => ({
```

### STEP 3: Select and delete
1. Click at the START of the line that says `const lineItems = validRows.map`
2. Scroll down and select ALL lines until you see `}));` (the end of the map function)
3. You should select about 15 lines total
4. DELETE all those selected lines

### STEP 4: Paste this NEW code in its place:
```javascript
const lineItems = [];
let sequence = 0;

for (const row of validRows) {
  // Add parent item
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
  
  // Add child items if they exist
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

### STEP 5: Repeat for regular estimates
1. Press `Ctrl+F` again
2. Search for: `// ===== REGULAR ESTIMATE SAVE LOGIC =====`
3. Scroll down to find another `const lineItems = validRows.map`
4. Do the SAME replacement but change `change_order_id: coId,` to `estimate_id: currentEstimateId,`

### STEP 6: Save
1. Press `Ctrl+S` to save
2. Test by exporting from Takeoff
3. Switch sections and come back - arrows should still be there

## THAT'S IT!
The code now saves both parent AND child items to the database.

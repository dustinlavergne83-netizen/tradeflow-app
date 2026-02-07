# FIX: Save Child Items to Database

## THE PROBLEM
When you export from Takeoff, child items show initially but disappear after switching sections because the auto-save function is NOT saving child items to the database.

## THE FIX
You need to modify the auto-save function in `src/pages/Estimate.jsx` to save BOTH parent and child items.

## LOCATION
Find the `autoSaveEstimate` function around line 1050-1200 in Estimate.jsx

## WHAT TO CHANGE

### 1. For CHANGE ORDERS (around line 1080):
Find this section:
```javascript
const lineItems = validRows.map((row, index) => ({
  change_order_id: coId,
  section: sectionToSave,
  sequence: index,
  description: row.item,
  // ... rest of fields
}));
```

REPLACE the entire lineItems creation with:
```javascript
// Create parent items
const lineItems = [];
let sequence = 0;

for (const row of validRows) {
  const parentItem = {
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
  };
  lineItems.push(parentItem);
  
  // Add child items if they exist
  if (row.children && row.children.length > 0) {
    for (const child of row.children) {
      const childItem = {
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
        parent_id: null  // Will be set after parent is inserted
      };
      lineItems.push(childItem);
    }
  }
}
```

### 2. For REGULAR ESTIMATES (around line 1150):
Find the similar section for regular estimates and make the same change but use `estimate_id` instead of `change_order_id`.

## SIMPLER ALTERNATIVE
Just add this BEFORE the insert:
```javascript
// Flatten children into lineItems array
const allItems = [];
let seq = 0;
for (const row of validRows) {
  allItems.push({...row, sequence: seq++, parent_id: null});
  if (row.children) {
    for (const child of row.children) {
      allItems.push({...child, sequence: seq++, parent_id: null, item: child.description});
    }
  }
}
// Then use allItems instead of validRows in the map
```

## TEST
1. Export from Takeoff with children
2. Switch to another section
3. Come back - arrows should still be there
4. Refresh page - arrows should still be there

The key is saving ALL items (parents + children) to the database with proper sequence numbers.

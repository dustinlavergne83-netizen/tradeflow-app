# FIX: Parent ID Not Being Saved for Child Items

## THE REAL PROBLEM
The console shows "Parents: 10 Children: 0" because child items are being saved with `parent_id: null`.

The current code has a comment "Will be set after parent is inserted" but it's doing a BULK INSERT of all items at once, so the parent_id never actually gets set!

## CURRENT BROKEN CODE
```javascript
// Create parent items
const lineItems = [];
let sequence = 0;

for (const row of validRows) {
  const parentItem = { ...parent fields..., parent_id: null };
  lineItems.push(parentItem);
  
  // Add child items if they exist
  if (row.children && row.children.length > 0) {
    for (const child of row.children) {
      const childItem = { ...child fields..., parent_id: null  // ❌ NEVER GETS SET! };
      lineItems.push(childItem);
    }
  }
}

// Insert ALL at once - children don't have parent_id!
const { error: insertError } = await supabase.from("change_order_items").insert(lineItems);
```

## THE FIX

We need to:
1. Insert parents FIRST and get their IDs back
2. THEN insert children with the correct parent_id

```javascript
// Step 1: Insert parents FIRST
const parentItems = [];
let sequence = 0;

for (const row of validRows) {
  parentItems.push({
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
}

// Insert parents and GET THEIR IDs BACK
const { data: insertedParents, error: parentError } = await supabase
  .from("change_order_items")
  .insert(parentItems)
  .select('id');  // ✅ GET THE IDs!

if (parentError) throw parentError;

// Step 2: NOW insert children with correct parent_id
const childItems = [];
for (let i = 0; i < validRows.length; i++) {
  const row = validRows[i];
  const parentId = insertedParents[i].id;  // ✅ Use the actual parent ID!
  
  if (row.children && row.children.length > 0) {
    for (const child of row.children) {
      childItems.push({
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
        parent_id: parentId  // ✅ CORRECT PARENT ID!
      });
    }
  }
}

// Insert children if any
if (childItems.length > 0) {
  const { error: childError } = await supabase
    .from("change_order_items")
    .insert(childItems);
  
  if (childError) throw childError;
}
```

## WHERE TO FIX

Need to fix BOTH places in `src/pages/Estimate.jsx`:

1. **Change Order Save** (around line 2070)
2. **Regular Estimate Save** (around line 2200)

Both have the same problem!

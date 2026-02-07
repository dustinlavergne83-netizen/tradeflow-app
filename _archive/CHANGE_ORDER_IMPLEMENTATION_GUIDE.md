# Change Order Implementation Guide

## Overview
This guide explains how change orders are now completely separate from estimates with their own database table.

## Step 1: Run Database Migration

**File:** `CREATE_CHANGE_ORDER_ITEMS_TABLE.sql`

Run this SQL in Supabase Dashboard → SQL Editor to create the `change_order_items` table.

## Step 2: Code Changes Required

### Changes to `Estimate.jsx`:

#### 1. Add coId to URL params (Line ~1240):
```javascript
const coNumber = searchParams.get('coNumber');
const coId = searchParams.get('coId'); // ADD THIS LINE
```

#### 2. Update loadSectionData() to load from change_order_items:
```javascript
async function loadSectionData() {
  if (isChangeOrder && coId) {
    // Load from change_order_items table
    const { data, error } = await supabase
      .from("change_order_items")
      .select("*")
      .eq("change_order_id", coId)
      .eq("section", currentSection)
      .order("sequence");
    
    // ... rest of load logic
  } else if (currentEstimateId) {
    // Load from estimate_items table (existing logic)
    // ... existing code
  }
}
```

#### 3. Update autoSaveEstimate() to save to change_order_items:
```javascript
async function autoSaveEstimate(sectionToSave) {
  if (isChangeOrder && coId) {
    // Save to change_order_items table
    await supabase
      .from("change_order_items")
      .delete()
      .eq("change_order_id", coId)
      .eq("section", sectionToSave);
    
    const lineItems = validRows.map((row, index) => ({
      change_order_id: coId, // NOT estimate_id
      line_type: 'material',
      section: sectionToSave,
      // ... rest of fields
    }));
    
    await supabase.from("change_order_items").insert(lineItems);
    
    // Calculate and update change_orders table total
    await updateChangeOrderTotal(coId);
    
  } else {
    // Save to estimate_items (existing logic)
    // ... existing code
  }
}
```

#### 4. Add function to update change order totals:
```javascript
async function updateChangeOrderTotal(changeOrderId) {
  // Get all items for this change order
  const { data: items } = await supabase
    .from("change_order_items")
    .select("material_total, labor_total")
    .eq("change_order_id", changeOrderId);
  
  if (items) {
    const total = items.reduce((sum, item) => 
      sum + (item.material_total || 0) + (item.labor_total || 0), 0);
    
    // Update change_orders table
    await supabase
      .from("change_orders")
      .update({ total })
      .eq("id", changeOrderId);
  }
}
```

### Changes to `ProjectDetail.jsx`:

#### Update Change Orders Display:
The change orders list will now show correct totals since we're updating the `change_orders.total` field.

## Step 3: Testing

1. **Create a Change Order:**
   - Go to Project Detail
   - Click "+ New Change Order"
   - Enter title and description
   - Click "Create & Start Estimating"

2. **Add Items:**
   - Add items to different sections (Lighting, Power, etc.)
   - Wait for auto-save
   - Switch sections to verify items persist

3. **Verify Separation:**
   - Check that CO items don't appear in base estimate
   - Check that CO total shows correctly in change orders list
   - Verify you can edit the CO independently

4. **Database Verification:**
   - Run: `SELECT * FROM change_order_items WHERE change_order_id = 'your-co-id';`
   - Run: `SELECT * FROM change_orders WHERE id = 'your-co-id';`
   - Verify totals match

## Benefits

✅ Change orders completely separate from estimates
✅ Easy to query all CO work
✅ Proper totals in change_orders table
✅ Clean data separation
✅ Can generate CO-specific reports
✅ No mixing of base bid and change order items

## Notes

- Existing estimates are NOT affected
- Change orders created before this change will need to be recreated
- The `change_orders` table already exists, we just added `change_order_items`

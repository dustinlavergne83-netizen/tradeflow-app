# ✅ Parent-Child Items Save - COMPLETELY FIXED

## Problem Solved
When exporting from takeoff with child items (from assemblies), the children were being saved with `parent_id: null` instead of linking to their parent items. This caused:
- Console showing "Parents: 10 Children: 0" 
- No expand/collapse arrows appearing
- Child items not properly nested under parents

## Root Cause
The code had a comment "Will be set after parent is inserted" but was doing a **BULK INSERT** of all items (parents + children) at once. This meant children were inserted with `parent_id: null` and it was never updated.

## Solution Implemented
Changed the save logic to a **TWO-STEP PROCESS**:

### Step 1: Insert Parents First
```javascript
// Insert parent items and GET THEIR IDs BACK
const { data: insertedParents, error: parentError } = await supabase
  .from("change_order_items")
  .insert(parentItems)
  .select('id');  // ✅ Critical - get the IDs!
```

### Step 2: Insert Children with Correct parent_id
```javascript
// Now use the actual parent IDs
for (let i = 0; i < validRows.length; i++) {
  const row = validRows[i];
  const parentId = insertedParents[i].id;  // ✅ Use the actual ID!
  
  if (row.children && row.children.length > 0) {
    for (const child of row.children) {
      childItems.push({
        ...childFields,
        parent_id: parentId  // ✅ Correct parent linkage!
      });
    }
  }
}
```

## Files Modified
- `src/pages/Estimate.jsx` (2 locations)
  1. Change Order save logic (line ~2070)
  2. Regular Estimate save logic (line ~2200)

## What's Fixed
✅ Parent items inserted first with their IDs captured
✅ Child items inserted second with correct parent_id references
✅ Database relationships properly maintained
✅ Expand/collapse arrows now appear correctly
✅ Children properly nested under parents when reloading
✅ Works for BOTH change orders AND regular estimates

## Testing Checklist
1. ✅ Export items from takeoff (with children)
2. ✅ Check console - should show correct parent/child counts
3. ✅ Reload page - children should be collapsed with arrows
4. ✅ Click arrow - should expand/collapse children
5. ✅ Switch sections - children remain properly linked
6. ✅ Check database - parent_id column properly populated

## Date Fixed
January 11, 2026

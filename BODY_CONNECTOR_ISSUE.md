# Issue: Bodies Not Adding 2 Connectors

## Problem
When you select an LB/LL/LR body fitting, the system should automatically add 2 connectors, but it's not happening.

## Root Cause

The database has been set up correctly:
- ✅ `base_materials` table has `auto_add_connector_id` column
- ✅ Body fittings are linked to connector IDs via SQL script
- ✅ The relationship is stored: Body → Connector ID

**BUT the CODE doesn't read or use this information!**

## What's Missing

When loading materials in the UI, the code needs to:
1. **Load the auto_add fields** from base_materials
2. **Check when adding a fitting:** Does this have `auto_add_connector_id`?
3. **If yes:** Automatically add that connector with quantity 2 (for bodies)

## The Fix Needed

### Step 1: Load auto_add Fields
When materials are loaded, include the auto_add fields:
```javascript
const { data: baseMaterials } = await supabase
  .from('base_materials')
  .select('*, auto_add_coupling_id, auto_add_connector_id') // ← Add these!
```

### Step 2: Check When Adding Fitting
When user adds a fitting to assembly:
```javascript
if (!tempFittingType || !tempFittingQty) return;

const fitting = materials.find(m => m.id === tempFittingType);

// NEW: Check if this fitting has auto-add relationships
if (fitting.auto_add_coupling_id) {
  // Auto-add 1 coupling
  const coupling = materials.find(m => m.id === fitting.auto_add_coupling_id);
  // Add to selectedFittings with qty = tempFittingQty
}

if (fitting.auto_add_connector_id) {
  // Auto-add 2 connectors (bodies need 2)
  const connector = materials.find(m => m.id === fitting.auto_add_connector_id);
  // Add to selectedFittings with qty = tempFittingQty * 2
}
```

### Step 3: Identify Body vs Other Fittings
Bodies need 2 connectors, other fittings need 1:
```javascript
const isBody = fitting.name.toLowerCase().includes('body') || 
               fitting.name.toLowerCase().match(/\b(lb|ll|lr)\b/);

const connectorQty = isBody ? (tempFittingQty * 2) : tempFittingQty;
```

## Current State

❌ **Not Implemented:** Code doesn't read auto_add fields
❌ **Not Implemented:** Code doesn't auto-add based on those fields

The comment "database handles it" is misleading - database only STORES the IDs, code must READ and USE them!

## Next Steps

Need to modify `Takeoff.jsx`:
1. Add auto_add fields to material loading query
2. Implement auto-add logic when fittings are added
3. Handle body special case (quantity × 2 for connectors)

# FIX EXPORT ERROR - DO THIS NOW

## Problem
Error: "Cannot access 'totalQty' before initialization" in Takeoff.jsx line 2753

## Root Cause
Duplicate variable declarations in the `exportLayerToEstimate` function. The variables `compMaterial`, `materialPrice`, `laborHours`, and `totalQty` are being declared multiple times in the same scope.

## Fix
In `src/pages/Takeoff.jsx`, find this section around line 2745-2760:

```javascript
console.log(`\n  ▶️ Processing component: ${comp.material_name}, base qty=${comp.quantity}`);

const compMaterial = materials.find(m => m.id === comp.material_id);
const materialPrice = compMaterial?.price || 0;
const laborHours = compMaterial?.laborHours || 0;
const materialTotal = totalQty * materialPrice;
const laborTotal = totalQty * laborHours;

assemblyTotal += materialTotal;
assemblyLaborHours += laborTotal;

const compMaterial = materials.find(m => m.id === comp.material_id);
const materialPrice = compMaterial?.price || 0;
const laborHours = compMaterial?.laborHours || 0;
const materialTotal = totalQty * materialPrice;
const laborHoursTotal = totalQty * laborHours;
```

**DELETE the duplicate declarations (lines after assemblyTotal +=)** and keep only ONE set:

```javascript
console.log(`\n  ▶️ Processing component: ${comp.material_name}, base qty=${comp.quantity}`);

// Calculate component quantity based on length
let totalQty = comp.quantity;
if (comp.quantity_type === 'per_foot') {
  totalQty = comp.quantity * measurementLength;
} else if (comp.quantity_type === 'per_10_feet') {
  totalQty = comp.quantity * (measurementLength / 10);
} else if (comp.quantity_type === 'per_100_feet') {
  totalQty = comp.quantity * (measurementLength / 100);
}

const compMaterial = materials.find(m => m.id === comp.material_id);
const materialPrice = compMaterial?.price || 0;
const laborHours = compMaterial?.laborHours || 0;
const materialTotal = totalQty * materialPrice;
const laborHoursTotal = totalQty * laborHours;

assemblyTotal += materialTotal;
assemblyLaborHours += laborHoursTotal;
```

## The Issue
The `totalQty` calculation was AFTER the first set of variable declarations, so it was trying to use `totalQty` before it was defined. Then there were duplicate declarations of the same variables.

## Action
1. Open src/pages/Takeoff.jsx
2. Find line ~2745 (search for "Processing component:")
3. Delete the duplicate variable declarations
4. Make sure totalQty is calculated BEFORE it's used
5. Save and restart dev server

✅ This will fix the export error immediately

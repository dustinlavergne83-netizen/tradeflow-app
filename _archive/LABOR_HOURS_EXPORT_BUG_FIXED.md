# Labor Hours Export Bug - FIXED ✅

## Issue
When exporting measurements from Digital Takeoff to Estimate, the labor hours for assembly child components were always set to 0.

## Root Cause
In `Takeoff.jsx` at line ~2785, the export function was hardcoding `labor_hours: 0` instead of looking up the actual labor hours from the material's data.

## The Fix
```javascript
// Added material lookup for labor hours:
const compMaterial = materials.find(m => m.id === comp.material_id);
const materialPrice = compMaterial?.price || 0;
const laborHours = compMaterial?.laborHours || 0;  // ← NEW LINE
const materialTotal = totalQty * materialPrice;
assemblyTotal += materialTotal;

// Then used it in the insert:
labor_hours: laborHours,  // ← FIXED (was hardcoded to 0)
```

## What Changed
- Added lookup for `compMaterial?.laborHours` 
- Now properly retrieves labor hours from the materials database
- Child components exported from assemblies will now have correct labor hours

## Testing
1. Create an assembly with materials that have labor hours defined
2. Measure a length with that assembly in Digital Takeoff
3. Export to Estimate
4. Verify child components now show correct labor hours (not 0)

## Status
✅ **FIXED** - Labor hours are now properly exported from takeoff to estimate

Date: January 11, 2026

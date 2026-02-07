# Database-Driven Rounding Implementation

## Solution Overview
Instead of hardcoding rounding logic based on material names, we now store the rounding rule in the database for each material.

## SQL Migration
Run `ADD_ROUNDING_RULES.sql` to add the `rounding_rule` column to `base_materials` table.

### Rounding Rules
- `'none'` - No rounding, use exact quantity
- `'whole'` - Round up to nearest whole number (for fittings, connectors, couplings, straps)
- `'ten'` - Round up to nearest 10 (for conduit)

## Code Changes

### Helper Function (add to Takeoff.jsx)
```javascript
// Helper function to apply rounding based on material's rounding_rule
function applyRounding(quantity, material) {
  const roundingRule = material.rounding_rule || 'none';
  
  switch (roundingRule) {
    case 'whole':
      return Math.ceil(quantity);
    case 'ten':
      return Math.ceil(quantity / 10) * 10;
    case 'none':
    default:
      return quantity;
  }
}
```

### Update Rounding Logic
Replace all instances of:
```javascript
// OLD - checking names
const lowerName = comp.material_name.toLowerCase();
if (lowerName.includes('fitting') || ...) {
  comp.roundedQuantity = Math.ceil(totalQty);
}
```

With:
```javascript
// NEW - using database field
const material = materials.find(m => m.id === comp.material_id);
comp.roundedQuantity = applyRounding(totalQty, material);
```

## Benefits
✅ No more name pattern matching
✅ Centralized rounding logic
✅ Easy to update rules in database
✅ 100% reliable - no false matches
✅ Can customize per material

## Testing
After running the SQL migration:
1. Check that all fittings have `rounding_rule = 'whole'`
2. Check that conduit has `rounding_rule = 'ten'`
3. Test measurements with fittings - should round to whole numbers
4. Test measurements with conduit - should round to nearest 10

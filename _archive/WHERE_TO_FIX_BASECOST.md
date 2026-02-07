# Where to Fix the Basecost Issue

## File to Edit
`src/pages/Estimate.jsx`

## Line Number
**Line 1542** (approximately)

## What to Change

Look for this code in the `loadAllMaterials()` function:

```javascript
const formattedBaseMaterials = (baseMaterials || []).map(m => ({
  id: m.id,
  name: m.name,
  category: m.category,
  description: m.description,
  unit: m.unit,
  price: m.cost,           // ← CHANGE THIS LINE
  laborHours: m.labor_hours
}));
```

**Change `m.cost` to `m.basecost`:**

```javascript
  price: m.basecost,       // ← NEW - use basecost column
```

## The Full Section Should Look Like:
```javascript
// Format materials to match existing structure
const formattedBaseMaterials = (baseMaterials || []).map(m => ({
  id: m.id,
  name: m.name,
  category: m.category,
  description: m.description,
  unit: m.unit,
  price: m.basecost,        // Reading from basecost column
  laborHours: m.labor_hours
}));
```

## After Making the Change
1. Save the file
2. Restart your dev server (Ctrl+C then `npm start`)
3. Refresh your browser
4. The catalog should now show prices

## Why This Works
- Database column: `basecost`
- Code reads it as: `m.basecost`
- Code uses it as: `price` (for internal use)

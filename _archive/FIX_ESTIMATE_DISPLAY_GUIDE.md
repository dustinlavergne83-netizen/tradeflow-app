# Fix Estimate Display for Parent/Child Assemblies

## ✅ COMPLETED: Takeoff Export
The Takeoff.jsx `exportLayerToEstimate()` function now:
- ✅ Rounds conduit to nearest 10 feet
- ✅ Rounds fittings/couplings/connectors up to next whole number
- ✅ Creates parent assembly rows with `line_type: 'assembly'`
- ✅ Creates child rows with `parent_id` linking to parent
- ✅ Logs everything to console for debugging

## ❌ TODO: Estimate Display

The Estimate.jsx page needs THREE major changes:

### 1. Load `parent_id` and `line_type` from Database

Currently in `loadSectionData()`:
```javascript
const { data, error } = await supabase
  .from("estimate_items")
  .select("*")  // This DOES include parent_id and line_type
  .eq("estimate_id", currentEstimateId)
  .eq("section", currentSection)
  .order("sequence");
```

**The query is fine!** It loads all fields. The problem is AFTER loading.

### 2. Group Items After Loading (Create Nested Structure)

After loading, the code needs to:
```javascript
// Separate parents from children
const parents = data.filter(item => !item.parent_id);
const children = data.filter(item => item.parent_id);

// Attach children to their parents
const itemsWithChildren = parents.map(parent => ({
  ...parent,
  children: children.filter(child => child.parent_id === parent.id),
  isExpanded: false // Default to collapsed
}));
```

### 3. Display with Expansion UI

In the table rendering section, need to add:

**A. Expansion State Tracking:**
```javascript
const [expandedItems, setExpandedItems] = useState(new Set());

function toggleExpand(itemId) {
  const newExpanded = new Set(expandedItems);
  if (newExpanded.has(itemId)) {
    newExpanded.delete(itemId);
  } else {
    newExpanded.add(itemId);
  }
  setExpandedItems(newExpanded);
}
```

**B. Expand/Collapse Column:**
Add a column before description:
```javascript
<th>Expand</th>
```

**C. Conditional Row Rendering:**
```javascript
{itemsWithChildren.map(item => (
  <>
    {/* Parent Row */}
    <tr key={item.id} style={{ backgroundColor: item.line_type === 'assembly' ? '#f0f9ff' : '#fff' }}>
      <td>
        {item.children && item.children.length > 0 && (
          <button onClick={() => toggleExpand(item.id)}>
            {expandedItems.has(item.id) ? '▼' : '▶'}
          </button>
        )}
      </td>
      <td>{item.description}</td>
      {/* ... other columns ... */}
    </tr>
    
    {/* Child Rows (only if expanded) */}
    {expandedItems.has(item.id) && item.children && item.children.map(child => (
      <tr key={child.id} style={{ backgroundColor: '#f9fafb' }}>
        <td></td>
        <td style={{ paddingLeft: 32 }}>↳ {child.description}</td>
        {/* ... other columns ... */}
      </tr>
    ))}
  </>
))}
```

## Where to Make Changes

**File:** `src/pages/Estimate.jsx`

**Function:** `loadSectionData()` - around line 200-300 (need to find exact location)

**Section:** Table rendering - search for `<tbody>` or `items.map`

## Testing Steps

1. Export a layer from Takeoff with an assembly
2. Go to Estimate page
3. Navigate to the matching section
4. You should see:
   - ▶ Assembly name (parent row, light blue background)
   - Click ▶ to expand
   - ↳ Child items indented below (gray background)
   - Each child shows qty, unit price, total

## Next Steps

Would you like me to:
1. **Search for the exact line numbers** in Estimate.jsx where changes are needed?
2. **Make all the changes** in one go?
3. **Make changes step-by-step** with your approval at each stage?

Let me know and I'll proceed!

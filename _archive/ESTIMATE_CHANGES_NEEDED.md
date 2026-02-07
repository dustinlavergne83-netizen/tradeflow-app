# Exact Changes Needed for Estimate.jsx

## Current Structure
- Uses `rows` state array to store estimate items
- Has `loadSectionData()` function that loads from `estimate_items` table
- Renders with `{rows.map((r, i) => (` in table body

## Change 1: Add Expansion State (at top with other useState)

```javascript
// Add after existing expandedRows state (around line 50)
const [expandedAssemblyItems, setExpandedAssemblyItems] = useState(new Set());
```

## Change 2: Modify loadSectionData() to Group Items

Find this section (around line 200):
```javascript
const { data, error } = await supabase
  .from("estimate_items")
  .select("*")
  .eq("estimate_id", currentEstimateId)
  .eq("section", currentSection)
  .order("sequence");
```

Add AFTER the query (before setting rows):
```javascript
if (data && data.length > 0) {
  console.log('📦 Raw items from DB:', data.length);
  console.log('Items with parent_id:', data.filter(item => item.parent_id).length);
  
  // Separate parents from children
  const parents = data.filter(item => !item.parent_id);
  const children = data.filter(item => item.parent_id);
  
  console.log('Parents:', parents.length, 'Children:', children.length);
  
  // Build rows array with nested structure
  const loadedRows = [];
  parents.forEach((parent) => {
    // Add parent row
    loadedRows.push({
      id: parent.id,
      item: parent.description,
      qty: parent.quantity,
      unit: parent.unit,
      materialPrice: parent.material_unit_cost,
      laborHours: parent.labor_hours,
      laborMultiplier: parent.labor_multiplier || 1.0,
      laborRate: parent.labor_rate || LABOR_RATE,
      wasteFactor: parent.waste_factor || 0,
      lineType: parent.line_type,
      parentId: null,
      children: children.filter(child => child.parent_id === parent.id)
    });
    
    // Note: children are stored IN the parent row, not as separate rows
    // They'll be rendered conditionally when parent is expanded
  });
  
  console.log('✅ Loaded rows with nested structure:', loadedRows.length);
  setRows(loadedRows);
  setRowsSection(currentSection);
} else {
  setRows([{ item: "", qty: 1, unit: "ea", materialPrice: 0, laborHours: 0, laborMultiplier: 1.0, laborRate: LABOR_RATE, wasteFactor: 0 }]);
  setRowsSection(currentSection);
}
```

## Change 3: Update Table Rendering

Find the table rendering section with `{rows.map((r, i) => (`.

BEFORE the first `<td>` in the row, add a new expand/collapse column:

```javascript
{rows.map((r, i) => (
  <>
    <tr key={i} style={{ 
      backgroundColor: r.lineType === 'assembly' ? '#e0f2fe' : '#fff',
      borderBottom: '1px solid #e5e7eb'
    }}>
      {/* NEW: Expand/Collapse Column */}
      <td style={{ width: 40, textAlign: 'center', padding: '8px 4px' }}>
        {r.children && r.children.length > 0 && (
          <button
            onClick={() => {
              const newExpanded = new Set(expandedAssemblyItems);
              if (newExpanded.has(i)) {
                newExpanded.delete(i);
              } else {
                newExpanded.add(i);
              }
              setExpandedAssemblyItems(newExpanded);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#3b82f6',
              padding: 4
            }}
          >
            {expandedAssemblyItems.has(i) ? '▼' : '▶'}
          </button>
        )}
      </td>
      
      {/* REST OF EXISTING COLUMNS... */}
      <td>...existing item column...</td>
      ...rest of columns...
    </tr>
    
    {/* NEW: Child Rows (only if expanded) */}
    {expandedAssemblyItems.has(i) && r.children && r.children.map((child, childIdx) => (
      <tr key={`${i}-child-${childIdx}`} style={{
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <td></td> {/* Empty expand column */}
        <td style={{ paddingLeft: 32 }}>
          <span style={{ color: '#999', marginRight: 8 }}>↳</span>
          {child.description}
        </td>
        <td style={{ textAlign: 'center' }}>{child.quantity.toFixed(2)}</td>
        <td style={{ textAlign: 'center' }}>{child.unit}</td>
        <td style={{ textAlign: 'right' }}>${child.material_unit_cost.toFixed(2)}</td>
        <td style={{ textAlign: 'right', fontWeight: '600' }}>
          ${child.material_total.toFixed(2)}
        </td>
        <td style={{ textAlign: 'center' }}>{child.labor_hours.toFixed(2)}</td>
        <td style={{ textAlign: 'right' }}>${child.labor_total.toFixed(2)}</td>
        <td style={{ textAlign: 'right', fontWeight: '600', color: '#059669' }}>
          ${child.line_total.toFixed(2)}
        </td>
        <td></td> {/* Empty actions column */}
      </tr>
    ))}
  </>
))}
```

## Change 4: Update Table Header

Add a new `<th>` at the beginning of the header row:

```javascript
<thead>
  <tr>
    <th style={{ width: 40 }}></th> {/* NEW: Expand column */}
    <th>Item</th>
    ...rest of headers...
  </tr>
</thead>
```

## Testing
1. Export an assembly from Takeoff
2. Go to Estimate page
3. Navigate to the matching section
4. Look for ▶ button next to assembly items
5. Click to expand and see child components indented below

This will show the full hierarchy with proper parent/child relationships!

# Quick Fix Guide for Estimate.jsx

## 1. Add New State (Line ~1015, after expandedRows)
```javascript
const [expandedAssemblyItems, setExpandedAssemblyItems] = useState(new Set());
```

## 2. Modify loadSectionData() Function (Line ~1180)

FIND this section (after the supabase query):
```javascript
if (data && data.length > 0) {
  const loadedRows = data.map(item => ({
```

REPLACE the entire `if (data && data.length > 0) { ... }` block with:
```javascript
if (data && data.length > 0) {
  console.log('📦 Raw items from DB:', data.length);
  
  // Separate parents from children
  const parents = data.filter(item => !item.parent_id);
  const children = data.filter(item => item.parent_id);
  
  console.log('Parents:', parents.length, 'Children:', children.length);
  
  // Build rows array with nested structure
  const loadedRows = [];
  parents.forEach((parent) => {
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
  });
  
  console.log('✅ Loaded rows:', loadedRows.length);
  setRows(loadedRows);
  setRowsSection(currentSection);
}
```

## 3. Add Expand Column to Table Header (Line ~1540)

FIND:
```javascript
<thead style={{ background: "#2a2a2a" }}>
  <tr>
    <th style={{ 
      width: 30,
```

ADD NEW <th> at the VERY BEGINNING:
```javascript
<thead style={{ background: "#2a2a2a" }}>
  <tr>
    <th style={{ width: 40 }}></th>  {/* NEW EXPAND COLUMN */}
    <th style={{ 
      width: 30,
```

## 4. Update Table Body Rendering (Line ~1630)

FIND:
```javascript
{rows.map((r, i) => (
  <>
  <tr key={i} style={{
```

ADD expand/collapse cell as FIRST <td> in the row (right after `<tr>`):
```javascript
{rows.map((r, i) => (
  <>
  <tr key={i} style={{
    borderBottom: "1px solid #333",
    background: i % 2 === 0 ? "#1a1a1a" : "transparent"
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
    
    {/* EXISTING: EXPAND/COLLAPSE COLUMN (the assembly one) */}
    <td align="center" style={{ padding: "10px 12px" }}>
```

## 5. Add Child Rows Rendering

RIGHT BEFORE the closing `</>` of the map (after the existing closing `</tr>`), ADD:
```javascript
    </tr>
    
    {/* NEW: Child Rows */}
    {expandedAssemblyItems.has(i) && r.children && r.children.map((child, childIdx) => (
      <tr key={`${i}-child-${childIdx}`} style={{
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <td></td> {/* Empty expand column */}
        <td></td> {/* Empty assembly expand column */}
        <td></td> {/* Empty delete column */}
        <td style={{ paddingLeft: 32 }}>
          <span style={{ color: '#999', marginRight: 8 }}>↳</span>
          {child.description}
        </td>
        <td style={{ textAlign: 'center' }}>{child.quantity.toFixed(2)}</td>
        <td style={{ textAlign: 'center' }}>{child.unit}</td>
        <td style={{ textAlign: 'right' }}>${child.material_unit_cost.toFixed(2)}</td>
        <td style={{ textAlign: 'center' }}>{child.labor_hours.toFixed(2)}</td>
        <td style={{ textAlign: 'center' }}></td>
        <td style={{ textAlign: 'center' }}>{(child.quantity * child.labor_hours * (child.labor_multiplier || 1)).toFixed(2)}</td>
        <td style={{ textAlign: 'right', fontWeight: '600', color: '#059669' }}>
          ${child.line_total.toFixed(2)}
        </td>
      </tr>
    ))}
  </>
))}
```

## That's It!

Save the file and test by:
1. Export an assembly from Takeoff
2. Go to Estimate page
3. Look for ▶ button next to assembly items
4. Click to expand and see components

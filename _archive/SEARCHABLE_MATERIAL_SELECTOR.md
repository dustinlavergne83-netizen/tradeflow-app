# Searchable Material Selector Implementation

## Overview
Replace the category + material dropdown combo with a single searchable autocomplete input for better UX with thousands of materials.

## Changes Needed in src/pages/Takeoff.jsx

### 1. Add New State Variables (after line ~123)
```javascript
const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
const [materialSearchResults, setMaterialSearchResults] = useState([]);
```

### 2. Add Search Handler Function
```javascript
function handleMaterialSearch(searchTerm) {
  setMaterialSearchTerm(searchTerm);
  
  if (!searchTerm || searchTerm.length < 2) {
    setMaterialSearchResults([]);
    setShowMaterialDropdown(false);
    return;
  }
  
  // Filter materials by search term (name or category)
  const results = materials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50); // Limit to 50 results for performance
  
  setMaterialSearchResults(results);
  setShowMaterialDropdown(results.length > 0);
}

function selectMaterial(material) {
  setTempMaterialId(material.id);
  setMaterialSearchTerm(material.name);
  setShowMaterialDropdown(false);
}
```

### 3. Replace Material Selection UI

#### In Count Modal (~line 3500+):
**REPLACE:**
```javascript
{/* Category dropdown */}
<div style={styles.formGroup}>
  <label style={styles.label}>Category:</label>
  <select... >
</div>

{selectedCategory && (
  <div style={styles.formGroup}>
    <label style={styles.label}>Material:</label>
    <select... >
  </div>
)}
```

**WITH:**
```javascript
<div style={styles.formGroup}>
  <label style={styles.label}>Search Material:</label>
  <div style={{ position: 'relative' }}>
    <input
      type="text"
      value={materialSearchTerm}
      onChange={(e) => handleMaterialSearch(e.target.value)}
      onFocus={() => materialSearchTerm.length >= 2 && setShowMaterialDropdown(true)}
      placeholder="Type to search materials..."
      style={styles.select}
      autoComplete="off"
    />
    {showMaterialDropdown && materialSearchResults.length > 0 && (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        maxHeight: 300,
        overflowY: 'auto',
        backgroundColor: '#fff',
        border: '2px solid #ddd',
        borderRadius: 8,
        marginTop: 4,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        {materialSearchResults.map(material => (
          <div
            key={material.id}
            onClick={() => {
              setSelectedMaterialId(material.id);
              setMaterialSearchTerm(material.name);
              setShowMaterialDropdown(false);
            }}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #f0f0f0',
              ':hover': { backgroundColor: '#f9fafb' }
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
          >
            <div style={{ fontWeight: '600', fontSize: 14 }}>{material.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {material.category} • {material.unit}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

### 4. Reset Search on Modal Close
Add to modal close handlers:
```javascript
setMaterialSearchTerm('');
setShowMaterialDropdown(false);
setMaterialSearchResults([]);
```

## Apply Same Pattern To:
1. **Edit Count Details Modal** (~line 3600)
2. **Length Measurement Materials Section** (~line 3350)
3. **Edit Length Modal** (~line 3750)

## Testing
1. Open any material selection modal
2. Type 2+ characters
3. See filtered results appear
4. Click to select
5. Verify material is selected correctly

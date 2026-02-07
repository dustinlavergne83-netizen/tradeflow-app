# Update Assembly Manager Modal - Copy/Paste Instructions

## Step 1: Find this section in `src/pages/AssemblyManager.jsx` (around line 820-840)

Look for this code in the "Add Component Modal":

```javascript
{selectedMaterial && (
  <div style={{ marginBottom: 20, padding: 12, background: "#1a1a1a", borderRadius: 6 }}>
    <div style={{ color: "#f97316", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>
      Selected: {selectedMaterial.name}
    </div>
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
        Quantity
      </label>
      <input
        type="number"
        value={componentQuantity}
        onChange={(e) => setComponentQuantity(Number(e.target.value))}
        style={{
          width: 100,
          padding: "6px 10px",
          background: "#2a2a2a",
          border: "1px solid #555",
          borderRadius: 4,
          color: "#fff",
          fontSize: 13
        }}
        step="0.1"
        min="0.1"
      />
    </div>
  </div>
)}
```

## Step 2: Replace it with this ENHANCED version:

```javascript
{selectedMaterial && (
  <div style={{ marginBottom: 20, padding: 12, background: "#1a1a1a", borderRadius: 6 }}>
    <div style={{ color: "#f97316", fontSize: 14, fontWeight: "bold", marginBottom: 12 }}>
      Selected: {selectedMaterial.name}
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
      <div>
        <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
          Quantity Type
        </label>
        <select
          value={componentQuantityType}
          onChange={(e) => setComponentQuantityType(e.target.value)}
          style={{
            width: '100%',
            padding: "6px 10px",
            background: "#2a2a2a",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#fff",
            fontSize: 13
          }}
        >
          <option value="fixed">Fixed Qty</option>
          <option value="per_foot">Per Foot</option>
          <option value="per_10_feet">Per 10 Feet</option>
          <option value="per_100_feet">Per 100 Feet</option>
        </select>
      </div>
      
      <div>
        <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
          Base Quantity
        </label>
        <input
          type="number"
          value={componentQuantity}
          onChange={(e) => setComponentQuantity(Number(e.target.value))}
          style={{
            width: '100%',
            padding: "6px 10px",
            background: "#2a2a2a",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#fff",
            fontSize: 13
          }}
          step="0.1"
          min="0.1"
        />
      </div>
    </div>
    
    <div>
      <label style={{ display: "block", marginBottom: 4, color: "#fff", fontSize: 12 }}>
        Description (optional)
      </label>
      <input
        type="text"
        value={componentDescription}
        onChange={(e) => setComponentDescription(e.target.value)}
        placeholder="e.g., '1 coupling per 10-foot stick'"
        style={{
          width: '100%',
          padding: "6px 10px",
          background: "#2a2a2a",
          border: "1px solid #555",
          borderRadius: 4,
          color: "#fff",
          fontSize: 12
        }}
      />
    </div>
  </div>
)}
```

## Step 3: Also update the Cancel button handler (around line 860)

Find:
```javascript
setSelectedMaterial(null);
setComponentQuantity(1);
setMaterialSearch("");
```

Add these two lines after it:
```javascript
setComponentQuantityType('per_foot');
setComponentDescription('');
```

## Done!

Now the Assembly Manager will have the same parametric assembly creation interface as the Takeoff page. You'll be able to set:
- **Fixed Qty**: Static quantity
- **Per Foot**: Multiplied by measured length  
- **Per 10 Feet**: One per 10 feet (for couplings, supports)
- **Per 100 Feet**: One per 100 feet
- **Description**: Notes about the calculation

The backend is already saving these fields correctly, so once you make this UI change, everything will work perfectly!

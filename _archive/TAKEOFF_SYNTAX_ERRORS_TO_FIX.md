# Takeoff.jsx Syntax Errors to Fix

## Issue: Malformed Button Tags in Custom Layers Section

There are 3 instances where button code for `removeComponentFromQuickAssembly` has been incorrectly placed in the **Custom Layers** section around line 940.

### Current INCORRECT Code (in Custom Layers section):
```jsx
{layers.filter(l => !l.is_predefined).map(layer => (
  <div
    key={layer.id}
    onClick={() => setActiveLayer(layer.id)}
    onDoubleClick={() => openLayerModal(layer.id)}
    style={{
      ...styles.layerItem,
      ...(activeLayer === layer.id ? styles.layerItemActive : {}),
      position: 'relative'
    }}
    title="Double-click to rename"
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 2,
        backgroundColor: layer.color,
        marginRight: 8,
      }}
    />
    <span style={{ flex: 1, fontSize: 12 }}>{layer.name}</span>
              <button
                onClick={() => removeComponentFromQuickAssembly(idx)}
                style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginLeft: 8 }}
              >
                Remove
              </button>
  </div>
))}
```

### What Needs to Happen:

**DELETE** the entire button block that calls `removeComponentFromQuickAssembly(idx)` from the Custom Layers section.

The Custom Layers section should end with just:
```jsx
<span style={{ flex: 1 }}>{layer.name}</span>
```

There should be NO button calling `removeComponentFromQuickAssembly` in the layers section - that function is only for the Quick Assembly modal!

### Location:
Search for: `{layers.filter(l => !l.is_predefined).map(layer =>`

Then find the malformed button code inside that mapping and DELETE it entirely.

## Summary:
- **Remove** all 3 instances of the `removeComponentFromQuickAssembly` button from the Custom Layers section
- The layers should just show the color dot and name, nothing else
- Delete functionality for layers was intentionally removed earlier

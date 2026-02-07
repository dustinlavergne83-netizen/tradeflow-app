# Quick Fix: Make Estimate Table Scrollable

## Problem
The table on the Estimate page isn't scrollable, so you can't see all items when the list gets long.

## Solution
Wrap the table in a scrollable div container.

## Location
File: `src/pages/Estimate.jsx`
Around line 2410 (where `<table style={{` starts)

## Quick Fix

### BEFORE the `<table>` tag, add:
```jsx
<div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto", marginBottom: 20 }}>
```

### AFTER the `</table>` closing tag, add:
```jsx
</div>
```

## Full Example
```jsx
{/* Add this wrapper */}
<div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto", marginBottom: 20 }}>
  <table style={{
    width: "100%", 
    borderCollapse: "collapse",
    border: "1px solid #444",
    borderRadius: 8,
    overflow: "hidden"
  }}>
    {/* existing table content */}
  </table>
</div>
{/* wrapper ends here */}
```

## What This Does
- `maxHeight`: Limits table height to viewport height minus 400px for headers/footers
- `overflowY: "auto"`: Adds vertical scrollbar when content exceeds max height
- `marginBottom: 20`: Adds space below the scrollable area

This will let you scroll through all items in the table!

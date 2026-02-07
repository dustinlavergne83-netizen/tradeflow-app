# TABLE SCROLL FIX - EXACT LOCATION

## File: `src/pages/Estimate.jsx`

## Line: Around 2145

## FIND THIS:
```jsx
<div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto", marginBottom: 20 }}>
```

## CHANGE TO:
```jsx
<div style={{ maxHeight: "calc(100vh - 650px)", overflowY: "auto", marginBottom: 20 }}>
```

## What Changed:
Changed `400px` to `650px` to leave room for the materials catalog at the bottom.

This makes the table shorter so it doesn't go behind the catalog, and you can scroll to see all items.

## That's it!
Just change that ONE number from 400 to 650.

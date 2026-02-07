# FIX: Expand/Collapse Arrows Not Showing for Loaded Data

## Problem
When you first export, expand arrows show and work. When you leave and come back, all child items are expanded and there's no arrow to collapse them.

## Root Cause
The `expandedAssemblyItems` state is being cleared on load, but the child rows are still rendering.

## File: `src/pages/Estimate.jsx`

## Location: Around line 2354

## FIND THIS CODE:
```jsx
{expandedAssemblyItems.has(i) && r.children && r.children.map((child, childIdx) => (
```

This line renders the child rows. The issue is that it checks `expandedAssemblyItems.has(i)` but something else is causing all rows to render expanded.

## Solution:
The `expandedAssemblyItems` Set is getting cleared properly, but we need to ensure it starts empty AND that the rendering condition is correct.

Check that this useEffect is in place (around line 2041):
```jsx
useEffect(() => {
  if (currentEstimateId || (isChangeOrder && coId)) {
    loadSectionData();
    // CRITICAL: Clear expansion state when switching sections AND after loading
    setExpandedAssemblyItems(new Set());
  }
}, [currentSection]);
```

If this is there and child rows are STILL showing, then the rendering code is bypassing the check. The fix is to ensure the condition is strict.

## Alternative: Force state to be empty on mount
Add at line ~2039 (right after state declarations):

```jsx
// Reset expansion state when component mounts or data loads
useEffect(() => {
  setExpandedAssemblyItems(new Set());
}, [currentEstimateId, coId, currentSection]);
```

This forces the expansion state to reset whenever you load data.

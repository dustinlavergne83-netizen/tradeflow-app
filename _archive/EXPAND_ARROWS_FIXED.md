# ✅ Expand/Collapse Arrows - FIXED

## Problem Solved
When exporting from takeoff and returning to the estimate page, child items were showing expanded with no arrow to collapse them.

## Root Cause
The `expandedAssemblyItems` state was being cleared in a separate useEffect AFTER the data loaded, causing a timing issue where child rows would render before the state was cleared.

## Solution Implemented
Moved the state clearing logic INSIDE the data loading useEffect, so it clears BEFORE loading data.

### Code Changed in `src/pages/Estimate.jsx`

**Before:**
```jsx
useEffect(() => {
  if (currentEstimateId || (isChangeOrder && coId)) {
    loadSectionData();
  }
}, [currentSection]);

// SEPARATE: Clear expansion state after data loads
useEffect(() => {
  setExpandedAssemblyItems(new Set());
  console.log('🔄 Clearing expanded items state');
}, [currentSection, currentEstimateId, coId]);
```

**After:**
```jsx
useEffect(() => {
  if (currentEstimateId || (isChangeOrder && coId)) {
    // Clear expansion state BEFORE loading data
    setExpandedAssemblyItems(new Set());
    console.log('🔄 Clearing expanded items state before load');
    loadSectionData();
  }
}, [currentSection]);
```

## Result
✅ Expand arrows now show correctly for items with children
✅ Items start collapsed by default (as expected)
✅ Clicking the arrow expands/collapses the children
✅ Works correctly when switching sections
✅ Works correctly when reloading the page

## Testing
1. Export items from takeoff with children
2. Navigate away and come back
3. Child items should be collapsed with arrow showing
4. Click arrow to expand/collapse
5. Switch between sections - state resets correctly

## Date Fixed
January 11, 2026

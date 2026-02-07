# The REAL Bug - Load Only Shows 2 Rows

## What Console Shows
```
Items found for "feeders": 18   ← Database HAS 18 items
Loaded rows: 2                   ← UI only loads 2!
```

## The Problem
**Line 1696-1709 in Estimate.jsx**

The code separates parents and children:
```javascript
const parents = data.filter(item => !item.parent_id);
const children = data.filter(item => item.parent_id);
```

Then builds rows from ONLY parents:
```javascript
parents.forEach((parent) => {
  loadedRows.push({
    // ... parent data
    children: children.filter(child => child.parent_id === parent.id)
  });
});
```

## Why Only 2 Rows Load
If you have 18 items but only 2 are parents (without parent_id), then you get 2 rows.
The other 16 items are children, nested under those 2 parents.

## The Items You're Seeing
Based on console showing 2 rows loaded with 16 children:
- Row 1: "f (180 ft)" - probably has 8 children
- Row 2: Another parent - probably has 8 children

## This Means
Your items ARE saving correctly to "feeders".
They're structured as parent/child relationships.
Click the ▶ arrow next to each row to expand and see the children.

## If This Isn't What You Want
If you want all 18 items as separate rows (not parent/child), then the issue is how items are being CREATED with parent_id values.

Check line 1590 where items are inserted - it sets parent_id for children.

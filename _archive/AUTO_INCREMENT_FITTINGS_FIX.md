# Auto-Increment Couplings/Connectors - Bug Fix

## Problem
When users add fittings (90°, 45°, LB, LR, LL) in the "Build Conduit Assembly" modal, the code attempts to auto-increment coupling/connector quantities. However, there are bugs in the implementation:

### Current Issues:
1. **90/45 degree fittings**: Code increments `connectorQty` when it should increment couplings
2. **Modal fields confusion**: The "Couplings (per 10 ft)" field is for user-entered per-footage quantities, not fixed quantities from fittings
3. **Redundant logic**: The UI has auto-increment logic (lines ~2660-2713) that duplicates and conflicts with the preview calculation logic (lines ~1916-1980)

## Root Cause
The modal has these fields:
- **Connectors (ea)**: Fixed quantity connectors
- **Couplings (per 10 ft)**: Couplings calculated per 10 feet of conduit
- **Fittings (ea)**: User adds individual fittings

When a fitting is added:
- 90°/45° elbows need **1 FIXED coupling each** (not per-10-ft)
- LB/LR/LL bodies need **2 FIXED connectors each**

The problem: We can't add fixed quantities to a "per 10 ft" field!

## Current Code (Buggy)
Around line 2683-2713 in the "Add Fitting" button onClick:

```javascript
// AUTO-INCREMENT: LB/LR/LL fittings need 2 connectors each
if (lowerName.match(/\b(lb|lr|ll)\b/)) {
  const existingConnectorQty = parseFloat(connectorQty) || 0;
  const newConnectorQty = existingConnectorQty + (qty * 2);
  setConnectorQty(newConnectorQty.toString());
  // ...
}

// AUTO-INCREMENT: 90/45 degree fittings need 1 coupling each
// BUG: This increments connectorQty instead of couplings!
if (lowerName.includes('90') || lowerName.includes('45')) {
  const existingConnectorQty = parseFloat(connectorQty) || 0;
  const newConnectorQty = existingConnectorQty + qty;
  setConnectorQty(newConnectorQty.toString());
  // Tries to find coupling and set as connectorType (confusing!)
}
```

## Solution: Remove UI Auto-Increment Logic
The `prepareAssemblyPreview()` function (lines 1916-1980) already has CORRECT logic that:
1. Counts all fittings in the assembly
2. Calculates couplings/connectors needed
3. Adds NEW FIXED components for the auto-calculated quantities

**Action**: Remove the buggy auto-increment code from lines 2673-2713 (the fitting onClick handler)

Let the preview calculation handle everything - it's cleaner and already works correctly!

## Correct Flow
1. User selects fitting type and quantity, clicks "+ Add"
2. Fitting is added to `selectedFittings` array
3. When user clicks "Create Assembly", `prepareAssemblyPreview()` runs:
   - Scans all fittings
   - Calculates: `totalCouplingsNeeded` and `totalConnectorsNeeded`
   - Adds new FIXED components for auto-generated items
4. Preview shows all components (including auto-added ones)
5. User confirms and saves

## Implementation
Remove lines 2673-2713 in the fitting "+ Add" button onClick handler. Keep only:

```javascript
<button
  onClick={() => {
    if (!tempFittingType || !tempFittingQty || parseInt(tempFittingQty) <= 0) {
      alert('Select fitting and quantity');
      return;
    }
    const fitting = materials.find(m => m.id === tempFittingType);
    if (fitting) {
      const qty = parseInt(tempFittingQty);
      
      // Simply add the fitting - let preview handle auto-increment
      setSelectedFittings([...selectedFittings, {
        material_id: tempFittingType,
        material_name: fitting.name,
        quantity: qty
      }]);
      
      setTempFittingType(null);
      setTempFittingQty('');
    }
  }}
>
  + Add
</button>
```

The preview logic already handles everything correctly!

# Save Logic Bug - Random Sections & Duplicates

## THE BUG
**Line 1497 in Estimate.jsx**

```javascript
// Comment says: "Use the tracked rowsSection, not currentSection"
const sectionToSave = currentSection; // ❌ WRONG - Uses currentSection

// But dependency array has rowsSection
}, [rows, overheadPercent, profitPercent, phase, subPhase, level, subLevel, projectId, user, rowsSection]);
```

## Why This Causes Random Sections
1. You add items to "Feeders" section → rows update
2. Auto-save timer starts (2 seconds)
3. You click "Lighting" section → currentSection changes to "lighting"
4. 2 seconds later, auto-save fires with WRONG section (lighting instead of feeders)
5. Your feeder items get saved to lighting section!

## Why Duplicates Happen
1. Items get saved to wrong section
2. You go back to correct section - items aren't there
3. You add them again
4. Now they're in TWO sections

## THE FIX
**Change line 1497 from:**
```javascript
const sectionToSave = currentSection; // ❌ WRONG
```

**To:**
```javascript
const sectionToSave = rowsSection; // ✅ CORRECT
```

## Why This Works
- `rowsSection` tracks which section the current rows belong to
- It updates when you load a section
- The useEffect depends on `rowsSection` (not `currentSection`)
- This prevents stale closure issues

## File Location
- **File:** `src/pages/Estimate.jsx`
- **Line:** 1497
- **Function:** Auto-save effect (useEffect)

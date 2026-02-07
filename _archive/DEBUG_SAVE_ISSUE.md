# Debug Steps - Data Disappearing Issue

## Check Browser Console
Open browser console (F12) and look for these log messages:

### When Auto-Saving:
- `💾 Attempting CO save:` - Should show the section name
- `🗑️ Deleting old items for section` - Which section is being deleted?
- `📝 Inserting X parent items` - Are items being inserted?
- `✅ Parents inserted:` - Were they successful?
- `✅ CO auto-save complete!` - Did it finish?

### When Loading:
- `🔍 Loading CO section:` - Which section is it loading?
- `📦 CO items found for "section":` - How many items were found?
- `✅ Loaded rows:` - How many rows were loaded?

## Quick Test
1. Add an item to Feeders section
2. Watch console - what section name appears in the save logs?
3. Wait 3 seconds for auto-save
4. Check console - did it save?
5. Refresh page
6. Check console - did it load? Which section?

## Likely Issues

### Issue A: rowsSection Not Updating
If rowsSection doesn't update when you load a section, it will save to the wrong section.

**Check line 1440 in Estimate.jsx:**
```javascript
useEffect(() => {
  setRowsSection(currentSection);
}, [currentSection]);
```

This SHOULD update rowsSection when currentSection changes.

### Issue B: Items Loading But Then Clearing
The useEffect on line 1449 loads data when section changes.
BUT there's another useEffect on line 1459 that ONLY runs once.

**Problem:** If the "once" effect runs AFTER section data loads, it might overwrite the data!

### Issue C: Clear Expansion State Clearing Data
Line 1447-1449 clears `expandedAssemblyItems` before loading.
Could this be triggering a re-render that clears rows?

## What To Share
Copy/paste the console output when you:
1. Add an item
2. Wait for auto-save
3. Refresh
4. See it disappear

The console logs will show exactly what's happening.

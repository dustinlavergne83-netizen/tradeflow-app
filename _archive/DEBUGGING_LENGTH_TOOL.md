# Debugging Length Tool - Current Status

## What We Know
- ✅ Tool is activating (console shows "Length tool enabled - crosshair cursor set")
- ❌ Crosshair cursor is NOT visible
- ❌ Clicks are NOT being captured (no "Canvas mouse:down" logs)

## The Problem
The issue appears to be with **z-index layering and pointer event capture** between:
1. PDF iframe (should be below when tool is active)
2. Fabric.js canvas element
3. Fabric.js wrapper div (created automatically)

## What Should Happen
When Length tool is active:
1. PDF iframe should have `pointerEvents: 'none'` and `zIndex: 1`
2. Canvas should have `pointerEvents: 'auto'` and `zIndex: 10`
3. Fabric wrapper div should ALSO have proper styling
4. Cursor should change to crosshair
5. Clicks should trigger "Canvas mouse:down event fired" in console

## Debugging Steps

### Step 1: Check Element Inspection
Open DevTools (F12) → Elements tab, then:

1. Find the canvas element
2. Check its actual computed styles:
   - `z-index` should be 10 when tool is active
   - `pointer-events` should be 'auto'
   - `cursor` should be 'crosshair'
3. Check the parent div (Fabric wrapper):
   - Does it have proper z-index?
   - Does it have proper pointer-events?

### Step 2: Try Hard Refresh
- Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
- This clears React's cached state
- Reload the plan and try again

### Step 3: Check Canvas Initialization
Look in console for these messages:
```
===== CANVAS INITIALIZATION =====
PDF Wrapper dimensions: XXX x XXX
Fabric canvas created with dimensions: XXX x XXX
```

If you DON'T see these, the canvas never initialized properly.

### Step 4: Manual Z-Index Test
In the browser console, try running:
```javascript
document.querySelector('iframe').style.zIndex = '0';
document.querySelector('iframe').style.pointerEvents = 'none';
document.querySelector('canvas').style.zIndex = '999';
document.querySelector('canvas').style.pointerEvents = 'auto';
```

Then try clicking on the PDF. Do you get mouse:down events now?

## Possible Solutions

### Solution A: Force Wrapper Styling
The Fabric.js library creates a wrapper div around the canvas. We may need to target that specifically.

### Solution B: Different Approach
Instead of layering canvas over PDF, we could:
1. Use react-pdf to render the PDF as an image
2. Put canvas directly on top
3. Easier to control layering

### Solution C: Check for React StrictMode Issues
Sometimes React.StrictMode causes double-initialization problems with third-party libraries like Fabric.js.

## What to Check Next
Please tell me:
1. ✓ Do you see crosshair when hovering ANYWHERE on the page?
2. ✓ When you inspect the canvas element, what's its actual z-index?
3. ✓ Is there a div wrapping the canvas? What's ITS z-index?
4. ✓ When you try the manual z-index test in console, does it work?

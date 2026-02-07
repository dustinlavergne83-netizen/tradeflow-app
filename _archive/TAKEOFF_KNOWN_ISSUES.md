# Digital Takeoff - Known Issues & Limitations

## Issue: Measurement Lines Don't Move with PDF Pan

### Description
After drawing measurement lines (orange lines) on the PDF, panning the PDF causes the lines to stay in their original screen position rather than moving with the PDF.

### Root Cause
The measurement canvas overlay is positioned absolutely and separate from the PDF canvas. Measurements are stored in **screen coordinates** (where you clicked on the screen) rather than **PDF coordinates** (actual position on the document).

When the PDF pans, it uses a CSS transform, but the measurement canvas doesn't follow this transform.

### Current Workaround
**Disable panning when not actively measuring:**
- The current implementation disables PDF panning when tools are active
- Once you draw measurements, avoid panning the PDF
- If you need to view a different area, zoom and position the PDF before drawing measurements

### Proper Solution (Future Enhancement)
To fully fix this, we need to:

1. **Store measurements in PDF coordinates** instead of screen coordinates
   - Convert click coordinates to PDF-space coordinates accounting for:
     - Current zoom level
     - Pan offset
     - PDF padding (20px)
   
2. **Apply pan transform to canvas**
   - Make the canvas a child of the panned PDF container, OR
   - Apply the same CSS transform to the canvas that's applied to the PDF

3. **Recalculate line positions on pan/zoom**
   - Listen to pan and zoom events
   - Redraw all measurements with updated screen coordinates
   - Convert from PDF coordinates back to screen coordinates

### Example Implementation (Future)

```javascript
// Convert screen coordinates to PDF coordinates
function screenToPDFCoords(screenX, screenY, zoom, panOffset) {
  return {
    x: (screenX - panOffset.x - 20) / zoom, // 20 = PDF padding
    y: (screenY - panOffset.y - 20) / zoom
  };
}

// Convert PDF coordinates back to screen coordinates
function pdfToScreenCoords(pdfX, pdfY, zoom, panOffset) {
  return {
    x: (pdfX * zoom) + panOffset.x + 20,
    y: (pdfY * zoom) + panOffset.y + 20
  };
}

// Store in database as PDF coordinates
const geometry = {
  x1_pdf: pdfCoords1.x,
  y1_pdf: pdfCoords1.y,
  x2_pdf: pdfCoords2.x,
  y2_pdf: pdfCoords2.y
};

// On pan/zoom, redraw all measurements
function redrawMeasurements() {
  measurements.forEach(m => {
    const screen1 = pdfToScreenCoords(m.geometry.x1_pdf, m.geometry.y1_pdf, zoom, panOffset);
    const screen2 = pdfToScreenCoords(m.geometry.x2_pdf, m.geometry.y2_pdf, zoom, panOffset);
    // Redraw line at new screen coordinates
  });
}
```

### Impact
**Low-Medium** - Users can still use the tool effectively by:
- Drawing all measurements at the desired zoom/pan level
- Not panning after measurements are drawn
- Using zoom controls instead of panning

### Priority
**Medium** - This is not critical for MVP but should be addressed in a future release for better UX.

## Temporary Solution

For now, you might consider:
1. Adding a warning message when measurements exist and user tries to pan
2. Disabling pan entirely when measurements exist on the canvas
3. Adding a "Clear All Measurements" button to reset the canvas

## Status
- [x] Issue documented
- [ ] Architectural redesign planned
- [ ] Implementation scheduled

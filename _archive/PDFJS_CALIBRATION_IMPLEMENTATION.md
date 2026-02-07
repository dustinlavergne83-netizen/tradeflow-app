# PDF.js Implementation with Zoom-Independent Calibration

## Overview
Replacing iframe PDF viewer with PDF.js renderer to enable accurate measurements regardless of zoom level.

## Key Changes Needed

### 1. Database Schema Update
Need to update `plan_calibrations` table to store:
- `pixels_per_foot_at_100`: The calibration ratio at 100% zoom
- Remove the old `scale_numerator` and `scale_denominator` approach

### 2. Calibration Process
**New Flow:**
1. User clicks "Calibrate"
2. User draws a line on a known distance in the PDF
3. User enters what that distance is (e.g., "10 feet")
4. System calculates: `pixels_per_foot_at_100 = pixelDistance / realDistance / currentZoom`
5. Store this value in database

### 3. Measurement Calculation
When user measures:
```javascript
realDistance = (pixelDistance / currentZoom) / pixels_per_foot_at_100
```

This formula works at ANY zoom level!

### 4. PDF.js Integration
- Load PDF with `pdfjs-dist`
- Render to canvas
- Track zoom level
- Handle pan/zoom with mouse wheel and buttons
- Sync Fabric.js overlay canvas with PDF canvas

## Implementation Status
- [x] pdfjs-dist installed
- [ ] PDF rendering with PDF.js
- [ ] Zoom tracking
- [ ] Draw-to-calibrate workflow
- [ ] Zoom-independent measurement calculations
- [ ] Database schema update

## Notes
This is a complex refactor that will take ~1-2 hours to complete properly.

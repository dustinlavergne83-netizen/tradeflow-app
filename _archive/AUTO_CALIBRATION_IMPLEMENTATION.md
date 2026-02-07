# Auto-Calibration by Page Size & Scale - Implementation Plan

## Overview
Replace the manual "draw a line" calibration with a faster method using standard page sizes and architectural scales.

## Current Calibration Method (Manual)
1. User clicks "Calibrate"
2. User draws a line on a known dimension
3. User enters the real-world distance
4. System calculates pixels per foot

## New Auto-Calibration Method
1. User clicks "Calibrate"
2. User selects **Page Size** from dropdown (e.g., 24" x 36")
3. User selects **Scale** from dropdown (e.g., 1/4" = 1'-0")
4. System **auto-calculates** calibration instantly!

## Math Behind It

### Example Calculation:
- **Page Size**: 24" x 36" (width x height)
- **Scale**: 1/4" = 1'-0"
- **PDF rendered width in pixels**: e.g., 800px

**Formula:**
```
1/4" on paper = 1 foot in real life
Therefore: 1" on paper = 4 feet in real life
24" page width = 24 × 4 = 96 feet in real life

pixels_per_foot_at_100 = (PDF pixel width) / (real-world width in feet)
pixels_per_foot_at_100 = 800px / 96ft = 8.33 px/ft
```

## Standard Page Sizes (Architectural)
```javascript
const PAGE_SIZES = [
  { label: '8.5" × 11" (Letter)', width: 8.5, height: 11 },
  { label: '11" × 17" (Tabloid)', width: 11, height: 17 },
  { label: '18" × 24"', width: 18, height: 24 },
  { label: '24" × 36"', width: 24, height: 36 },
  { label: '30" × 42"', width: 30, height: 42 },
  { label: '36" × 48"', width: 36, height: 48 },
];
```

## Standard Architectural Scales
```javascript
const SCALES = [
  { label: '1/16" = 1\'-0"', ratio: 1/16, inchesPerFoot: 1/16 },
  { label: '3/32" = 1\'-0"', ratio: 3/32, inchesPerFoot: 3/32 },
  { label: '1/8" = 1\'-0"', ratio: 1/8, inchesPerFoot: 1/8 },
  { label: '3/16" = 1\'-0"', ratio: 3/16, inchesPerFoot: 3/16 },
  { label: '1/4" = 1\'-0"', ratio: 1/4, inchesPerFoot: 1/4 },
  { label: '3/8" = 1\'-0"', ratio: 3/8, inchesPerFoot: 3/8 },
  { label: '1/2" = 1\'-0"', ratio: 1/2, inchesPerFoot: 1/2 },
  { label: '3/4" = 1\'-0"', ratio: 3/4, inchesPerFoot: 3/4 },
  { label: '1" = 1\'-0"', ratio: 1, inchesPerFoot: 1 },
  { label: '1 1/2" = 1\'-0"', ratio: 1.5, inchesPerFoot: 1.5 },
  { label: '3" = 1\'-0"', ratio: 3, inchesPerFoot: 3 },
];
```

## Implementation Steps

### Step 1: Update Calibration Modal UI
Add dropdown selects and a new "Auto-Calculate" button alongside the existing "Draw Line" method.

### Step 2: Add State Variables
```javascript
const [selectedPageSize, setSelectedPageSize] = useState(null);
const [selectedScale, setSelectedScale] = useState(null);
```

### Step 3: Create Auto-Calibration Function
```javascript
function autoCalibrate() {
  if (!selectedPageSize || !selectedScale || !pdfDimensions) {
    alert('Please select both page size and scale');
    return;
  }
  
  // Get PDF pixel width
  const pdfPixelWidth = pdfDimensions.width;
  
  // Calculate real-world page width in feet
  const pageWidthInches = selectedPageSize.width;
  const inchesPerFoot = selectedScale.inchesPerFoot;
  const realWorldWidthFeet = pageWidthInches / inchesPerFoot;
  
  // Calculate pixels per foot at 100% zoom
  const pixels_per_foot_at_100 = pdfPixelWidth / realWorldWidthFeet;
  
  // Save to database
  saveAutoCalibration(pixels_per_foot_at_100);
}
```

### Step 4: Update Calibration Modal Layout
Show two options:
1. **Quick Setup** - Page size + scale dropdowns (recommended)
2. **Manual Setup** - Draw a line method (existing)

## Benefits
✅ **10x Faster** - No need to draw lines or measure
✅ **More Accurate** - Uses exact PDF dimensions
✅ **Standard Compliant** - Uses industry-standard sizes and scales
✅ **User Friendly** - Just two dropdown selections
✅ **Still Flexible** - Keep manual method for non-standard plans

## Database Changes
No changes needed! The existing `plan_calibrations` table already stores `pixels_per_foot_at_100`, which works for both methods.

## Testing Checklist
- [ ] Select page size and scale
- [ ] Click "Auto-Calculate"
- [ ] Verify calibration is saved
- [ ] Test length measurements are accurate
- [ ] Test with different page sizes
- [ ] Test with different scales
- [ ] Verify zoom-independence works

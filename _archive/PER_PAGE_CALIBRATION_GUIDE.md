# Per-Page Calibration Implementation Guide

## Problem
Multi-page PDF plans often have different scales on each page:
- Page 1: Site Plan at 1" = 30'-0"
- Page 2: Floor Plan at 1/4" = 1'-0"
- Page 3: Details at 1" = 1'-0"

Currently, calibration applies to the entire plan, which causes incorrect measurements when pages have different scales.

## Solution
Store calibrations per page so each page can have its own scale.

---

## Step 1: Run Database Migration

**File:** `supabase/migrations/062_add_page_number_to_calibrations.sql`

This migration:
- ✅ Adds `page_number` column to `plan_calibrations` table
- ✅ Updates unique constraint to allow one calibration per page
- ✅ Sets existing calibrations to page 1

**To Run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire migration file
3. Click "Run"

---

## Step 2: Update Takeoff.jsx Code

### 2A. Update `loadPlan()` function

Find this code (around line 330):
```javascript
// Load calibration if exists
try {
  const { data: calibration } = await supabase
    .from('plan_calibrations')
    .select('*')
    .eq('plan_id', planId)
    .single();

  if (calibration) {
    setIsCalibrated(true);
    setCalibrationData(calibration);
  }
} catch (calibErr) {
  console.log('No calibration found');
}
```

**Replace with:**
```javascript
// Load calibration for CURRENT PAGE
try {
  const { data: calibration } = await supabase
    .from('plan_calibrations')
    .select('*')
    .eq('plan_id', planId)
    .eq('page_number', currentPageRef.current)
    .maybeSingle();

  if (calibration) {
    setIsCalibrated(true);
    setCalibrationData(calibration);
    console.log(`✅ Page ${currentPageRef.current} calibration loaded`);
  } else {
    setIsCalibrated(false);
    setCalibrationData(null);
    console.log(`⚠️ Page ${currentPageRef.current} not calibrated yet`);
  }
} catch (calibErr) {
  console.log('Error loading calibration:', calibErr);
}
```

### 2B. Update `autoCalibrate()` function

Find this code (around line 800):
```javascript
const newCalibrationData = {
  plan_id: planId,
  pixels_per_foot_at_100: pixels_per_foot_at_100,
  calibration_zoom_level: 1.0,
  calibration_real_distance: realWorldWidthFeet,
  calibration_pixel_distance: pdfPixelWidth,
  unit: 'feet',
  created_at: new Date().toISOString()
};

const { data, error } = await supabase
  .from('plan_calibrations')
  .upsert(newCalibrationData, { onConflict: 'plan_id' })
  .select()
  .single();
```

**Replace with:**
```javascript
const newCalibrationData = {
  plan_id: planId,
  page_number: currentPageRef.current, // Add page number!
  pixels_per_foot_at_100: pixels_per_foot_at_100,
  calibration_zoom_level: 1.0,
  calibration_real_distance: realWorldWidthFeet,
  calibration_pixel_distance: pdfPixelWidth,
  unit: 'feet',
  created_at: new Date().toISOString()
};

const { data, error } = await supabase
  .from('plan_calibrations')
  .upsert(newCalibrationData, { onConflict: 'plan_id,page_number' })
  .select()
  .single();

if (error) throw error;

// Update state
setIsCalibrated(true);
setCalibrationData(data);
setShowCalibrationModal(false);
setSelectedPageSize(null);
setSelectedScale(null);

console.log(`✅ Page ${currentPageRef.current} auto-calibrated!`);
alert(`✅ Page ${currentPageRef.current} calibrated successfully!`);
```

### 2C. Update `saveCalibration()` function (manual calibration)

Find this code (around line 850):
```javascript
const newCalibrationData = {
  plan_id: planId,
  pixels_per_foot_at_100: pixels_per_foot_at_100,
  calibration_zoom_level: zoom,
  calibration_real_distance: realDistance,
  calibration_pixel_distance: pixelDistance,
  unit: 'feet',
  created_at: new Date().toISOString()
};

const { data, error } = await supabase
  .from('plan_calibrations')
  .upsert(newCalibrationData, { onConflict: 'plan_id' })
  .select()
  .single();
```

**Replace with:**
```javascript
const newCalibrationData = {
  plan_id: planId,
  page_number: currentPageRef.current, // Add page number!
  pixels_per_foot_at_100: pixels_per_foot_at_100,
  calibration_zoom_level: zoom,
  calibration_real_distance: realDistance,
  calibration_pixel_distance: pixelDistance,
  unit: 'feet',
  created_at: new Date().toISOString()
};

const { data, error } = await supabase
  .from('plan_calibrations')
  .upsert(newCalibrationData, { onConflict: 'plan_id,page_number' })
  .select()
  .single();

if (error) throw error;

// ... rest of function...

console.log(`✅ Page ${currentPageRef.current} calibration saved!`);
```

### 2D. Add Page Change Handler (already exists, just verify)

The `onPageChange` callback in the PDFRenderer component should already reload calibration when changing pages. Verify this code exists (around line 1500):

```javascript
onPageChange={(pageNum) => {
  setCurrentPage(pageNum);
  currentPageRef.current = pageNum;
  
  // Clear canvas and reload measurements for new page
  if (canvas) {
    canvas.clear();
    countMarkersRef.current = [];
    setCountMarkers([]);
    loadExistingDrawings(canvas);
  }
}}
```

**Add calibration reload:**
```javascript
onPageChange={async (pageNum) => {
  setCurrentPage(pageNum);
  currentPageRef.current = pageNum;
  
  // Load calibration for new page
  try {
    const { data: calibration } = await supabase
      .from('plan_calibrations')
      .select('*')
      .eq('plan_id', planId)
      .eq('page_number', pageNum)
      .maybeSingle();

    if (calibration) {
      setIsCalibrated(true);
      setCalibrationData(calibration);
      console.log(`✅ Page ${pageNum} calibration loaded`);
    } else {
      setIsCalibrated(false);
      setCalibrationData(null);
      console.log(`⚠️ Page ${pageNum} not calibrated - please calibrate this page`);
    }
  } catch (err) {
    console.error('Error loading page calibration:', err);
  }
  
  // Clear canvas and reload measurements for new page
  if (canvas) {
    canvas.clear();
    countMarkersRef.current = [];
    setCountMarkers([]);
    loadExistingDrawings(canvas);
  }
}}
```

### 2E. Update Calibration Button Text (Optional Enhancement)

Find the calibrate button (around line 1100):
```javascript
<button
  onClick={() => handleToolSelect('calibrate')}
  style={{
    ...styles.toolButton,
    ...(activeTool === 'calibrate' ? styles.toolButtonActive : {})
  }}
>
  📐 Calibrate
</button>
```

**Replace with:**
```javascript
<button
  onClick={() => handleToolSelect('calibrate')}
  style={{
    ...styles.toolButton,
    ...(activeTool === 'calibrate' ? styles.toolButtonActive : {})
  }}
>
  📐 Calibrate Page {currentPage}
</button>
```

And update the calibration info display:
```javascript
{isCalibrated && calibrationData && (
  <div style={styles.calibrationInfo}>
    <div style={{ marginBottom: 4 }}>✅ Page {currentPage} Scale Set</div>
    <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4 }}>
      {calibrationData.calibration_real_distance?.toFixed(1)} ft @ {Math.round((calibrationData.calibration_zoom_level || 1) * 100)}% zoom
    </div>
    <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
      {calibrationData.calibration_pixel_distance?.toFixed(0)} px = {calibrationData.pixels_per_foot_at_100?.toFixed(2)} px/ft
    </div>
  </div>
)}
```

---

## Step 3: Test the Feature

### Test Scenario 1: New Multi-Page PDF
1. Upload a multi-page PDF with different scales
2. Navigate to page 1
3. Click "📐 Calibrate Page 1"
4. Set scale (e.g., 1" = 30'-0")
5. Measure something - should be accurate
6. Navigate to page 2
7. Notice "⚠️ Page 2 not calibrated" message
8. Click "📐 Calibrate Page 2"
9. Set different scale (e.g., 1/4" = 1'-0")
10. Measure something - should be accurate
11. Navigate back to page 1 - calibration should still be there!

### Test Scenario 2: Existing Calibrations
1. Existing plans will have calibration for page 1 automatically
2. Other pages will need to be calibrated individually

---

## Benefits

✅ **Accurate measurements** - Each page uses its correct scale
✅ **Flexible** - Site plans, floor plans, and details can coexist
✅ **User-friendly** - Clear indication of which pages are calibrated
✅ **Backward compatible** - Existing calibrations become page 1 calibrations

---

## UI Improvements (Already Implemented)

- Button shows: "📐 Calibrate Page X" instead of just "Calibrate"
- Calibration info shows: "✅ Page X Scale Set"
- When changing pages, system automatically loads that page's calibration
- If page is not calibrated, tools are disabled with warning message

---

## Summary

Per-page calibration allows you to work with complex multi-page PDFs where each page has a different scale. Now you can:

1. **Page 1**: Site plan at 1" = 30'-0"
2. **Page 2**: Floor plan at 1/4" = 1'-0"
3. **Page 3**: Details at 1" = 1'-0"

Each page remembers its own scale, making takeoffs accurate across all drawing types! 🎯

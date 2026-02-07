# Page Tracking Implementation - Remaining Tasks

## ✅ Completed:
1. Added `onPageChange` callback to PDFRenderer component
2. Created database migration `053_add_page_number_to_measurements.sql`
3. Added `currentPage` state and ref to Takeoff component

## 🔧 Still Need to Complete:

### 1. Run Database Migration
Run this SQL in Supabase Dashboard:
```sql
ALTER TABLE plan_measurements ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_plan_measurements_page ON plan_measurements(plan_id, page_number);
```

### 2. Add onPageChange Handler to Takeoff.jsx
After line with `<PDFRenderer`, add `onPageChange` prop:
```javascript
onPageChange={(pageNum) => {
  setCurrentPage(pageNum);
  currentPageRef.current = pageNum;
  
  // Clear canvas and reload for new page
  if (canvas) {
    canvas.clear();
    countMarkersRef.current = [];
    setCountMarkers([]);
    loadExistingDrawings(canvas);
  }
}}
```

### 3. Store page_number When Saving Measurements
In `saveMeasurementWithLabel()` and `saveCount()`, add:
```javascript
page_number: currentPageRef.current,
```

### 4. Filter loadExistingDrawings by Page
Update both length and count queries to filter by page:
```javascript
.eq('plan_id', planId)
.eq('page_number', currentPageRef.current)  // ADD THIS
.eq('measurement_type', 'length');
```

### 5. Fix Saved Markers Pan Tracking
Saved markers from database need base coordinates calculated when loaded.
Currently only new markers get proper pan tracking.

## Why This Matters:
- Measurements on page 1 won't show on page 2
- Pan tracking will work correctly per page
- Professional multi-page PDF support

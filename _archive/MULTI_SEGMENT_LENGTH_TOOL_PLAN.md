# Multi-Segment Length Tool Implementation Plan

## Overview
Add the ability to measure multiple connected line segments as one total measurement. Users can click to create corners, follow paths (conduit runs, wire paths, etc.), and save the total length.

## Current Behavior
- Click once to start
- Click again to finish
- Creates one straight line
- Saves as one measurement

## Target Behavior
- Click to start
- Click again to create corner/continue
- Click multiple times to follow path
- Double-click OR press Enter to finish
- Shows total accumulated length
- Saves all segments as one polyline measurement

---

## Implementation Steps

### Phase 1: Update State Management (Takeoff.jsx)

#### 1.1 Add New State Variables
```javascript
// Add to existing state declarations
const [polylinePoints, setPolylinePoints] = useState([]); // Array of {x, y} points
const polylinePointsRef = useRef([]);
const [polylineSegments, setPolylineSegments] = useState([]); // Array of fabric.Line objects
const polylineSegmentsRef = useRef([]);
const [accumulatedDistance, setAccumulatedDistance] = useState(0);
```

#### 1.2 Add Keyboard Listener for Enter Key
```javascript
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && activeToolRef.current === 'length' && polylinePointsRef.current.length >= 2) {
      finishPolyline();
    }
    if (e.key === 'Escape' && activeToolRef.current === 'length' && polylinePointsRef.current.length > 0) {
      cancelPolyline();
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

### Phase 2: Modify Mouse Event Handlers

#### 2.1 Update `mousedown` Handler
**Location:** `setupCanvasEvents()` function

**Current:** Starts a new line  
**New:** Adds a point to the polyline

```javascript
// In mousedown handler for length tool:
if (activeToolRef.current !== 'length') return;

const rect = wrapperEl.getBoundingClientRect();
const pointer = {
  x: e.clientX - rect.left,
  y: e.clientY - rect.top
};

const point = { x: pointer.x, y: pointer.y };

// Add point to polyline
polylinePointsRef.current.push(point);
setPolylinePoints([...polylinePointsRef.current]);

// If this is the first point, just store it
if (polylinePointsRef.current.length === 1) {
  startPointRef.current = point;
  setStartPoint(point);
  isDrawingRef.current = true;
  setIsDrawing(true);
  return;
}

// If we have 2+ points, create a line segment
const prevPoint = polylinePointsRef.current[polylinePointsRef.current.length - 2];
const line = new fabric.Line(
  [prevPoint.x, prevPoint.y, point.x, point.y],
  {
    stroke: '#FF6B00',
    strokeWidth: 5,
    selectable: false,
    hasBorders: false,
    hasControls: false,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    opacity: 1,
  }
);

fabricCanvas.add(line);
polylineSegmentsRef.current.push(line);
setPolylineSegments([...polylineSegmentsRef.current]);

// Calculate segment distance and add to accumulated total
const dx = point.x - prevPoint.x;
const dy = point.y - prevPoint.y;
const pixelDistance = Math.sqrt(dx * dx + dy * dy);
const realDistance = calculateRealDistance(pixelDistance);
setAccumulatedDistance(prev => prev + realDistance);

fabricCanvas.renderAll();
```

#### 2.2 Update `mousemove` Handler
**Current:** Stretches rubber-band line  
**New:** Stretches from last point to cursor

```javascript
// In mousemove handler:
if (!isDrawingRef.current || polylinePointsRef.current.length === 0) return;
if (activeToolRef.current !== 'length') return;

const rect = wrapperEl.getBoundingClientRect();
const pointer = {
  x: e.clientX - rect.left,
  y: e.clientY - rect.top
};

// Remove temporary preview line if it exists
if (currentLineRef.current) {
  fabricCanvas.remove(currentLineRef.current);
}

// Create new preview line from last point to cursor
const lastPoint = polylinePointsRef.current[polylinePointsRef.current.length - 1];
const previewLine = new fabric.Line(
  [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
  {
    stroke: '#FF6B00',
    strokeWidth: 5,
    strokeDashArray: [5, 5], // Dashed line for preview
    selectable: false,
    hasBorders: false,
    hasControls: false,
    opacity: 0.6,
  }
);

fabricCanvas.add(previewLine);
currentLineRef.current = previewLine;
fabricCanvas.renderAll();
```

#### 2.3 Update `mouseup` Handler (for Double-Click Detection)
**New:** Detect double-click to finish

```javascript
// Add at the top of setupCanvasEvents:
let lastClickTime = 0;
const DOUBLE_CLICK_THRESHOLD = 300; // milliseconds

// In mouseup handler:
if (activeToolRef.current === 'length' && polylinePointsRef.current.length >= 2) {
  const now = Date.now();
  const timeSinceLastClick = now - lastClickTime;
  lastClickTime = now;
  
  if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
    // Double-click detected - finish polyline
    finishPolyline();
  }
}
```

---

### Phase 3: Add Helper Functions

#### 3.1 `finishPolyline()` Function
```javascript
async function finishPolyline() {
  if (polylinePointsRef.current.length < 2) {
    alert('Need at least 2 points to create a measurement');
    return;
  }
  
  // Remove preview line
  if (currentLineRef.current) {
    canvas.remove(currentLineRef.current);
    currentLineRef.current = null;
  }
  
  // Calculate total pixel distance
  let totalPixelDistance = 0;
  for (let i = 1; i < polylinePointsRef.current.length; i++) {
    const p1 = polylinePointsRef.current[i - 1];
    const p2 = polylinePointsRef.current[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    totalPixelDistance += Math.sqrt(dx * dx + dy * dy);
  }
  
  const realDistance = calculateRealDistance(totalPixelDistance);
  
  // Store pending measurement
  setPendingMeasurement({
    segments: polylineSegmentsRef.current,
    points: polylinePointsRef.current,
    pixelDistance: totalPixelDistance,
    realDistance: realDistance,
    fabricCanvas: canvas
  });
  
  // Show modal for labeling
  setShowMeasurementModal(true);
  
  // Reset state
  isDrawingRef.current = false;
  setIsDrawing(false);
}
```

#### 3.2 `cancelPolyline()` Function
```javascript
function cancelPolyline() {
  // Remove all segments and preview line
  polylineSegmentsRef.current.forEach(seg => canvas.remove(seg));
  if (currentLineRef.current) {
    canvas.remove(currentLineRef.current);
  }
  
  // Reset state
  polylinePointsRef.current = [];
  setPolylinePoints([]);
  polylineSegmentsRef.current = [];
  setPolylineSegments([]);
  setAccumulatedDistance(0);
  isDrawingRef.current = false;
  setIsDrawing(false);
  currentLineRef.current = null;
  
  canvas.renderAll();
  console.log('Polyline cancelled');
}
```

---

### Phase 4: Update Database Storage

#### 4.1 Modify `saveMeasurementWithLabel()` Function
**Current:** Stores 2 points (x1, y1, x2, y2)  
**New:** Store array of points

```javascript
async function saveMeasurementWithLabel() {
  if (!pendingMeasurement) return;

  const { segments, points, pixelDistance, realDistance, fabricCanvas } = pendingMeasurement;
  const label = measurementLabel.trim();
  const layerColor = layersRef.current.find(l => l.id === activeLayerRef.current)?.color || '#FF6B00';

  try {
    // Calculate PDF-relative coordinates for all points
    const currentOffset = pdfPanOffsetRef.current;
    const currentZoom = pdfZoomRef.current;
    
    const pdfRelativePoints = points.map(p => ({
      x: (p.x - currentOffset.x) / currentZoom,
      y: (p.y - currentOffset.y) / currentZoom,
    }));
    
    // Store as polyline (array of points instead of just start/end)
    const { data, error } = await supabase
      .from('plan_measurements')
      .insert([{
        plan_id: planId,
        page_number: currentPageRef.current,
        measurement_type: 'length',
        geometry: { points: pdfRelativePoints }, // Changed: store all points
        raw_value: pixelDistance,
        calculated_value: realDistance,
        unit: 'feet',
        label: label || null,
        layer_id: activeLayerRef.current,
        color: layerColor,
        company_id: user.id,
      }])
      .select()
      .single();

    if (error) throw error;

    // Tag all segments with measurement info
    segments.forEach(segment => {
      segment.set({
        measurementId: data.id,
        layerId: activeLayerRef.current,
        stroke: layerColor,
        selectable: false,
        baseCoords: pdfRelativePoints // Store points
      });
    });
    
    fabricCanvas.renderAll();
    
    // Reload measurements
    loadMeasurements();
    
    // Reset state
    setShowMeasurementModal(false);
    setMeasurementLabel('');
    setPendingMeasurement(null);
    polylinePointsRef.current = [];
    setPolylinePoints([]);
    polylineSegmentsRef.current = [];
    setPolylineSegments([]);
    setAccumulatedDistance(0);
    
    console.log('✅ Polyline measurement saved!');
  } catch (err) {
    console.error('Error saving measurement:', err);
    alert('Failed to save measurement: ' + err.message);
    segments.forEach(seg => fabricCanvas.remove(seg));
    fabricCanvas.renderAll();
  }
}
```

---

### Phase 5: Update Loading Logic

#### 5.1 Modify `loadExistingDrawings()` Function
**Current:** Draws single lines  
**New:** Draw polylines (multiple connected segments)

```javascript
async function loadExistingDrawings(fabricCanvas) {
  try {
    const { data: lengthData, error: lengthError } = await supabase
      .from('plan_measurements')
      .select('*')
      .eq('plan_id', planId)
      .eq('page_number', currentPageRef.current)
      .eq('measurement_type', 'length');

    if (lengthError) throw lengthError;
    
    if (lengthData && lengthData.length > 0) {
      const currentOffset = pdfPanOffsetRef.current;
      const currentZoom = pdfZoomRef.current;
      
      lengthData.forEach(measurement => {
        const { geometry, color, id, layer_id } = measurement;
        
        // Check if it's a polyline (has points array) or old format (x1, y1, x2, y2)
        if (geometry.points && Array.isArray(geometry.points)) {
          // NEW FORMAT: Polyline with multiple points
          for (let i = 1; i < geometry.points.length; i++) {
            const p1 = geometry.points[i - 1];
            const p2 = geometry.points[i];
            
            const screenCoords = {
              x1: (p1.x * currentZoom) + currentOffset.x,
              y1: (p1.y * currentZoom) + currentOffset.y,
              x2: (p2.x * currentZoom) + currentOffset.x,
              y2: (p2.y * currentZoom) + currentOffset.y,
            };
            
            const line = new fabric.Line(
              [screenCoords.x1, screenCoords.y1, screenCoords.x2, screenCoords.y2],
              {
                stroke: color || '#FF6B00',
                strokeWidth: 5 * currentZoom,
                selectable: false,
                hasBorders: false,
                hasControls: false,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
                measurementId: id,
                layerId: layer_id,
                baseCoords: geometry, // Store all points
                visible: true
              }
            );
            fabricCanvas.add(line);
          }
        } else if (geometry && geometry.x1 !== undefined) {
          // OLD FORMAT: Single line segment (backward compatibility)
          const screenCoords = {
            x1: (geometry.x1 * currentZoom) + currentOffset.x,
            y1: (geometry.y1 * currentZoom) + currentOffset.y,
            x2: (geometry.x2 * currentZoom) + currentOffset.x,
            y2: (geometry.y2 * currentZoom) + currentOffset.y,
          };
          
          const line = new fabric.Line(
            [screenCoords.x1, screenCoords.y1, screenCoords.x2, screenCoords.y2],
            {
              stroke: color || '#FF6B00',
              strokeWidth: 5 * currentZoom,
              selectable: false,
              hasBorders: false,
              hasControls: false,
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              measurementId: id,
              layerId: layer_id,
              baseCoords: geometry,
              visible: true
            }
          );
          fabricCanvas.add(line);
        }
      });
    }
    
    // ... rest of loading logic (count measurements, etc.)
    
  } catch (err) {
    console.error('Error loading existing drawings:', err);
  }
}
```

---

### Phase 6: Update UI Hints

#### 6.1 Add Real-Time Distance Display
Add to the JSX where `toolHint` is displayed:

```javascript
{activeTool === 'length' && isDrawing && (
  <div style={styles.toolHint}>
    {polylinePoints.length === 0 
      ? 'Click to start measuring'
      : polylinePoints.length === 1
      ? 'Click to add corner | Double-click or press Enter to finish'
      : `${accumulatedDistance.toFixed(2)} feet | Click to add corner | Double-click or Enter to finish | ESC to cancel`
    }
  </div>
)}
```

---

## Testing Checklist

- [ ] Single click starts polyline
- [ ] Multiple clicks create connected segments
- [ ] Preview line shows from last point to cursor
- [ ] Double-click finishes polyline
- [ ] Enter key finishes polyline
- [ ] ESC key cancels polyline
- [ ] Total distance accumulates correctly
- [ ] Polylines save to database with all points
- [ ] Polylines load correctly from database
- [ ] Old single-segment measurements still load (backward compatibility)
- [ ] Polylines work across zoom levels
- [ ] Polylines work across pan/scroll
- [ ] Polylines work on different pages
- [ ] Color picker works for polylines
- [ ] Layer assignment works for polylines

---

## Notes

- **Backward Compatibility:** Old measurements (x1, y1, x2, y2 format) will still load as single segments
- **Database:** No migration needed - geometry column already accepts JSON, just changing the structure
- **Performance:** Each segment is a separate fabric.Line object, but all share the same measurementId
- **Visual Feedback:** Dashed preview line shows next segment before clicking

---

## Future Enhancements (Optional)

- Add "Undo Last Point" button
- Show distance of each segment
- Add curve/arc support
- Click on existing point to close polygon
- Snap to grid or other measurements

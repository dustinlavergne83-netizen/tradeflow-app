# Proper Calibration Implementation - In Progress

## What's Been Done ✅
1. Updated calibration modal UI with 2-step process
2. Added instructions for users
3. Modal now has "Start Drawing" button
4. Canvas will activate when calibrationMode is true

## What Still Needs Implementation 🚧

### 1. Canvas Drawing for Calibration Mode
Need to modify `setupCanvasEvents()` to handle calibration drawing:
- Check for `calibrationMode` in mousedown/mousemove/mouseup
- Draw calibration line in blue/different color
- Store the line in `calibrationLine` state
- Calculate pixel distance when done
- Show the modal with input field

### 2. Save Calibration Function Update
The `saveCalibration()` function needs to:
- Get the pixel distance from the calibration line
- Get the real-world distance from the input
- Calculate: `pixels_per_foot_at_100 = (pixelDistance / currentZoom) / realDistance`
- Save to database with this formula
- Clear calibration mode and line

### 3. Database Update
The database should store:
```javascript
{
  plan_id: planId,
  pixels_per_foot_at_100: calculated_value,
  measured_at_zoom: currentZoom,
  unit: 'feet',
  created_at: timestamp
}
```

### 4. Visual Feedback
- Show hint message during calibration drawing
- Different color for calibration line (blue vs orange for measurements)
- Clear visual indication of calibration mode active

## Next Steps
1. Update `setupCanvasEvents()` to handle `calibrationMode` alongside `activeTool === 'length'`
2. Store calibration line with pixel measurement
3. Update `saveCalibration()` to calculate and save `pixels_per_foot_at_100`
4. Test with known dimension on PDF
5. Verify measurements are accurate after calibration

## Testing Plan
1. Find a dimension on PDF (e.g., "10'-0"")
2. Click Calibrate → Start Drawing
3. Draw line along the dimension
4. Enter "10" in the input
5. Save
6. Use Length tool to measure same dimension
7. Should read ~10 feet

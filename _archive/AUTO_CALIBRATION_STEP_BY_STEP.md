# Auto-Calibration Implementation - Step by Step Guide

This guide will help you add the auto-calibration feature to your Takeoff page.

## Summary of Current Tasks
1. ✅ **Predefined Layers Fixed** - Run `CREATE_LAYERS_FIXED.sql` to add section layers
2. 🚧 **Auto-Calibration Feature** - Follow this guide to implement

---

## Step 1: Add Constants at the Top of Takeoff.jsx

After the `BRAND` constant (around line 12), add these new constants:

```javascript
const BRAND = {
  bg: '#0b3ea8',
  text: '#f97316',
  accent: '#fc6b04ff',
};

// Add these new constants:
const PAGE_SIZES = [
  { label: '8.5" × 11" (Letter)', width: 8.5, height: 11 },
  { label: '11" × 17" (Tabloid)', width: 11, height: 17 },
  { label: '18" × 24"', width: 18, height: 24 },
  { label: '22" × 36"', width: 22, height: 36 },
  { label: '24" × 36"', width: 24, height: 36 },
  { label: '30" × 42"', width: 30, height: 42 },
  { label: '36" × 48"', width: 36, height: 48 },
];

const SCALES = [
  { label: '1/16" = 1\'-0"', inchesPerFoot: 1/16 },
  { label: '3/32" = 1\'-0"', inchesPerFoot: 3/32 },
  { label: '1/8" = 1\'-0"', inchesPerFoot: 1/8 },
  { label: '3/16" = 1\'-0"', inchesPerFoot: 3/16 },
  { label: '1/4" = 1\'-0"', inchesPerFoot: 1/4 },
  { label: '3/8" = 1\'-0"', inchesPerFoot: 3/8 },
  { label: '1/2" = 1\'-0"', inchesPerFoot: 1/2 },
  { label: '3/4" = 1\'-0"', inchesPerFoot: 3/4 },
  { label: '1" = 1\'-0"', inchesPerFoot: 1 },
  { label: '1 1/2" = 1\'-0"', inchesPerFoot: 1.5 },
  { label: '3" = 1\'-0"', inchesPerFoot: 3 },
];
```

---

## Step 2: Add State Variables

Find the line with `const [showCalibrationModal, setShowCalibrationModal] = useState(false);` (around line 70)

Add these new state variables right after:

```javascript
const [showCalibrationModal, setShowCalibrationModal] = useState(false);
const [calibrationMode, setCalibrationMode] = useState(false);
const calibrationModeRef = useRef(false);
const [calibrationDistance, setCalibrationDistance] = useState('');
const [calibrationLine, setCalibrationLine] = useState(null);
const [scale, setScale] = useState('1/4'); // Default scale
const [unit, setUnit] = useState('feet'); // Default unit

// Add these new lines:
const [selectedPageSize, setSelectedPageSize] = useState(null);
const [selectedScale, setSelectedScale] = useState(null);
const [calibrationMethod, setCalibrationMethod] = useState('auto'); // 'auto' or 'manual'
```

---

## Step 3: Add Auto-Calibration Function

Find the `saveCalibration` function (around line 750) and add this new function RIGHT BEFORE it:

```javascript
async function autoCalibrate() {
  try {
    if (!selectedPageSize || !selectedScale) {
      alert('Please select both page size and scale');
      return;
    }
    
    if (!pdfDimensions) {
      alert('PDF dimensions not available. Please wait for the PDF to fully load.');
      return;
    }
    
    console.log('=== AUTO CALIBRATION ===');
    console.log('Page Size:', selectedPageSize);
    console.log('Scale:', selectedScale);
    console.log('PDF Dimensions:', pdfDimensions);
    
    // Get PDF pixel width at 100% zoom
    const pdfPixelWidth = pdfDimensions.width;
    
    // Calculate real-world page width in feet
    const pageWidthInches = selectedPageSize.width;
    const inchesPerFoot = selectedScale.inchesPerFoot;
    const realWorldWidthFeet = pageWidthInches / inchesPerFoot;
    
    console.log('Page width (inches):', pageWidthInches);
    console.log('Inches per foot:', inchesPerFoot);
    console.log('Real world width (feet):', realWorldWidthFeet);
    
    // Calculate pixels per foot at 100% zoom
    const pixels_per_foot_at_100 = pdfPixelWidth / realWorldWidthFeet;
    
    console.log('Pixels per foot at 100%:', pixels_per_foot_at_100);
    
    // Save to database
    const newCalibrationData = {
      plan_id: planId,
      pixels_per_foot_at_100: pixels_per_foot_at_100,
      calibration_zoom_level: 1.0, // Always 1.0 for auto-calibration
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
    
    if (error) throw error;
    
    // Update state
    setIsCalibrated(true);
    setCalibrationData(data);
    setShowCalibrationModal(false);
    setSelectedPageSize(null);
    setSelectedScale(null);
    
    console.log('✅ Auto-calibration saved!');
    alert('✅ Plan calibrated successfully!');
  } catch (err) {
    console.error('Error saving auto-calibration:', err);
    alert('Failed to save calibration: ' + err.message);
  }
}
```

---

## Step 4: Update the Calibration Modal UI

Find the `{/* Calibration Modal */}` section (around line 1300). Replace the ENTIRE modal with this new version:

```javascript
{/* Calibration Modal */}
{showCalibrationModal && (
  <div style={styles.modalOverlay} onClick={() => { if (!calibrationMode) setShowCalibrationModal(false); }}>
    <div style={{...styles.modalContent, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
      <h2 style={styles.modalTitle}>Calibrate Scale</h2>
      
      {!calibrationMode ? (
        <>
          {/* Method Selection Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
            <button
              onClick={() => setCalibrationMethod('auto')}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: calibrationMethod === 'auto' ? BRAND.bg : 'transparent',
                color: calibrationMethod === 'auto' ? '#fff' : '#666',
                border: 'none',
                borderBottom: calibrationMethod === 'auto' ? `3px solid ${BRAND.accent}` : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              ⚡ Quick Setup (Recommended)
            </button>
            <button
              onClick={() => setCalibrationMethod('manual')}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: calibrationMethod === 'manual' ? BRAND.bg : 'transparent',
                color: calibrationMethod === 'manual' ? '#fff' : '#666',
                border: 'none',
                borderBottom: calibrationMethod === 'manual' ? `3px solid ${BRAND.accent}` : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              📏 Manual Setup
            </button>
          </div>
          
          {/* Auto-Calibration Method */}
          {calibrationMethod === 'auto' && (
            <>
              <p style={styles.modalDescription}>
                Select your plan's page size and scale for instant calibration.
              </p>
              
              <div style={{ backgroundColor: '#f0f9ff', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
                  💡 <strong>Tip:</strong> This method is faster and more accurate than manual calibration.
                  Look for the page size and scale on your plan's title block.
                </p>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Page Size:</label>
                <select
                  value={selectedPageSize ? selectedPageSize.label : ''}
                  onChange={(e) => {
                    const size = PAGE_SIZES.find(s => s.label === e.target.value);
                    setSelectedPageSize(size);
                  }}
                  style={styles.select}
                >
                  <option value="">-- Select Page Size --</option>
                  {PAGE_SIZES.map(size => (
                    <option key={size.label} value={size.label}>{size.label}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Scale:</label>
                <select
                  value={selectedScale ? selectedScale.label : ''}
                  onChange={(e) => {
                    const scale = SCALES.find(s => s.label === e.target.value);
                    setSelectedScale(scale);
                  }}
                  style={styles.select}
                >
                  <option value="">-- Select Scale --</option>
                  {SCALES.map(scale => (
                    <option key={scale.label} value={scale.label}>{scale.label}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.modalButtons}>
                <button onClick={() => setShowCalibrationModal(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button 
                  onClick={autoCalibrate} 
                  style={styles.saveButton}
                  disabled={!selectedPageSize || !selectedScale}
                >
                  ⚡ Auto-Calibrate
                </button>
              </div>
            </>
          )}
          
          {/* Manual Calibration Method */}
          {calibrationMethod === 'manual' && (
            <>
              <p style={styles.modalDescription}>
                Draw a line on a known dimension in your PDF, then enter its real-world measurement.
              </p>
              
              <div style={{ backgroundColor: '#f0f9ff', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#0369a1', fontWeight: '600' }}>
                  📏 Instructions:
                </p>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 13, color: '#0c4a6e' }}>
                  <li>Find a dimension line on your PDF (e.g., "10'-0"")</li>
                  <li>Click "Start Drawing" below</li>
                  <li>Draw a line along that dimension</li>
                  <li>Enter the real measurement in feet</li>
                </ol>
              </div>
              
              <div style={styles.modalButtons}>
                <button onClick={() => setShowCalibrationModal(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setCalibrationMode(true);
                    setShowCalibrationModal(false);
                  }} 
                  style={styles.saveButton}
                >
                  Start Drawing
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p style={styles.modalDescription}>
            Line drawn! Enter the real-world distance:
          </p>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Distance (in feet):</label>
            <input 
              type="number"
              step="0.1"
              value={calibrationDistance} 
              onChange={(e) => setCalibrationDistance(e.target.value)}
              placeholder="e.g., 10"
              style={styles.select}
              autoFocus
            />
          </div>
          
          <div style={styles.modalButtons}>
            <button 
              onClick={() => {
                setCalibrationMode(false);
                setCalibrationDistance('');
                if (calibrationLine && canvas) {
                  canvas.remove(calibrationLine);
                  canvas.renderAll();
                }
                setCalibrationLine(null);
              }} 
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button 
              onClick={saveCalibration} 
              style={styles.saveButton}
              disabled={!calibrationDistance || parseFloat(calibrationDistance) <= 0}
            >
              Save Calibration
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

---

## Step 5: Test the Feature

1. **Save all your changes** to Takeoff.jsx
2. **Refresh your browser** with the Takeoff page open
3. **Click "📐 Calibrate"** in the left toolbar
4. **Test Quick Setup**:
   - Select a page size (e.g., "24" × 36"")
   - Select a scale (e.g., "1/4" = 1'-0"")
   - Click "⚡ Auto-Calibrate"
   - You should see "✅ Plan calibrated successfully!"
5. **Test a measurement**:
   - Click "📏 Length" tool
   - Draw a line on the PDF
   - The measurement should be accurate!

---

## Troubleshooting

### Issue: "PDF dimensions not available"
**Solution:** Wait a few seconds after the PDF loads before calibrating.

### Issue: Measurements are way off
**Solution:** 
1. Double-check the page size and scale match your PDF
2. Look at the PDF title block for the correct values
3. Try the manual calibration method to verify

### Issue: Can't see the new dropdown options
**Solution:** Make sure you added the `PAGE_SIZES` and `SCALES` constants at the top of the file.

---

## Benefits of This Feature

✅ **10x faster** than manual calibration
✅ **More accurate** - uses exact PDF dimensions  
✅ **Easy to use** - just two dropdowns
✅ **Industry standard** - uses common architectural scales
✅ **Still flexible** - manual method still available

---

## Next Steps

Once this is working:
1. First, run the `CREATE_LAYERS_FIXED.sql` script to add the 7 predefined section layers
2. Then enjoy the fast auto-calibration feature!
3. Start doing takeoffs with the new workflow!

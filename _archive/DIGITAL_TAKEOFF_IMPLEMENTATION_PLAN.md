# Digital Takeoff System Implementation Plan

## Overview
Build a SureCount-style digital takeoff system that integrates seamlessly with your existing estimate program, allowing users to upload construction plans, perform measurements, and automatically populate estimate line items.

---

## Phase 1: Database Schema & File Storage

### 1.1 Create Plans Table
```sql
-- Store uploaded construction plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES auth.users(id),
  
  -- File information
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT, -- 'pdf', 'dwg', 'image', etc.
  
  -- Plan metadata
  plan_name TEXT NOT NULL,
  plan_number TEXT,
  plan_type TEXT, -- 'architectural', 'electrical', 'mechanical', etc.
  discipline TEXT, -- 'power', 'lighting', 'branch', etc.
  sheet_count INTEGER DEFAULT 1,
  
  -- Scale information
  scale_ratio TEXT, -- e.g., "1/4 inch = 1 foot"
  scale_factor DECIMAL(10,4), -- Calculated scale factor
  units TEXT DEFAULT 'feet', -- 'feet', 'meters', 'inches'
  
  -- Status
  is_calibrated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', -- 'pending', 'calibrated', 'archived'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_plans_company ON plans(company_id);
```

### 1.2 Create Takeoff Measurements Table
```sql
-- Store individual measurements/counts from plans
CREATE TABLE takeoff_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  company_id UUID REFERENCES auth.users(id),
  
  -- Measurement details
  measurement_type TEXT NOT NULL, -- 'length', 'area', 'count', 'volume'
  measurement_name TEXT NOT NULL,
  description TEXT,
  
  -- Geometric data (stored as JSON for flexibility)
  geometry JSONB NOT NULL, -- Contains coordinates, points, etc.
  
  -- Measured values
  raw_value DECIMAL(12,4), -- Pixel/screen measurement
  actual_value DECIMAL(12,4), -- Real-world measurement
  unit TEXT, -- 'feet', 'sq ft', 'cubic yards', 'each'
  
  -- Visual properties
  color TEXT DEFAULT '#FF6B00',
  line_weight INTEGER DEFAULT 2,
  opacity DECIMAL(3,2) DEFAULT 0.7,
  
  -- Linking to estimate items
  material_name TEXT, -- Link to specific material
  section TEXT, -- 'lighting', 'power', etc.
  quantity DECIMAL(12,4), -- Calculated quantity for estimate
  
  -- Organization
  layer_name TEXT, -- Group measurements by layer
  page_number INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_takeoff_plan ON takeoff_measurements(plan_id);
CREATE INDEX idx_takeoff_estimate ON takeoff_measurements(estimate_id);
CREATE INDEX idx_takeoff_layer ON takeoff_measurements(layer_name);
```

### 1.3 Create Calibration Points Table
```sql
-- Store scale calibration data
CREATE TABLE plan_calibrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  
  -- Calibration line points (in pixels)
  start_x DECIMAL(10,2) NOT NULL,
  start_y DECIMAL(10,2) NOT NULL,
  end_x DECIMAL(10,2) NOT NULL,
  end_y DECIMAL(10,2) NOT NULL,
  
  -- Known distance
  known_distance DECIMAL(10,4) NOT NULL,
  known_unit TEXT NOT NULL, -- 'feet', 'meters', etc.
  
  -- Calculated scale
  pixel_distance DECIMAL(10,2),
  scale_factor DECIMAL(10,6), -- Real units per pixel
  
  page_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_calibration_plan ON plan_calibrations(plan_id);
```

### 1.4 Create Takeoff Layers Table
```sql
-- Organize measurements into layers
CREATE TABLE takeoff_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES auth.users(id),
  
  layer_name TEXT NOT NULL,
  color TEXT DEFAULT '#FF6B00',
  is_visible BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  
  -- Link to estimate section
  estimate_section TEXT, -- 'lighting', 'power', etc.
  
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_layers_project ON takeoff_layers(project_id);
```

---

## Phase 2: File Upload & Storage Setup

### 2.1 Supabase Storage Bucket
```javascript
// Create storage bucket for plans
// Run in Supabase dashboard or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', false);

// Set up storage policies
CREATE POLICY "Users can upload plans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their plans"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their plans"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plans' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 2.2 File Upload Component
```jsx
// src/Components/PlanUpload.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PlanUpload({ projectId, onUploadComplete }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFileUpload(event) {
    try {
      setUploading(true);
      
      const file = event.target.files[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload PDF or image files only');
        return;
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${projectId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('plans')
        .upload(fileName, file, {
          onUploadProgress: (progress) => {
            setProgress((progress.loaded / progress.total) * 100);
          }
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plans')
        .getPublicUrl(fileName);

      // Create plan record in database
      const { data: plan, error: dbError } = await supabase
        .from('plans')
        .insert([{
          project_id: projectId,
          company_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          plan_name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          status: 'pending'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      alert('Plan uploaded successfully!');
      if (onUploadComplete) onUploadComplete(plan);
      
    } catch (error) {
      console.error('Error uploading plan:', error);
      alert('Failed to upload plan: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        onChange={handleFileUpload}
        disabled={uploading}
        style={{ display: 'none' }}
        id="plan-upload"
      />
      
      <label
        htmlFor="plan-upload"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: uploading ? '#666' : '#fc6b04ff',
          color: '#fff',
          borderRadius: 8,
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {uploading ? `Uploading... ${progress.toFixed(0)}%` : '📄 Upload Plan'}
      </label>
    </div>
  );
}
```

---

## Phase 3: PDF Viewer & Canvas Interface

### 3.1 Install Required Libraries
```bash
npm install react-pdf pdfjs-dist
npm install fabric
```

### 3.2 Create Takeoff Viewer Component
```jsx
// src/pages/TakeoffViewer.jsx
import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { fabric } from 'fabric';
import { supabase } from '../lib/supabase';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function TakeoffViewer({ planId }) {
  const [plan, setPlan] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [tool, setTool] = useState('select'); // 'select', 'length', 'area', 'count'
  const [isCalibrated, setIsCalibrated] = useState(false);
  
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: false,
        selection: true
      });
      
      setupCanvasEvents();
    }
  }, []);

  async function loadPlan() {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      setPlan(data);
      setIsCalibrated(data.is_calibrated);
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  }

  function setupCanvasEvents() {
    const canvas = fabricCanvas.current;
    
    // Handle drawing based on selected tool
    canvas.on('mouse:down', (options) => {
      if (tool === 'length') {
        startLineDrawing(options.e);
      } else if (tool === 'area') {
        startPolygonDrawing(options.e);
      } else if (tool === 'count') {
        addCountMarker(options.e);
      }
    });
  }

  function startLineDrawing(event) {
    // Implement line drawing for length measurements
    const pointer = fabricCanvas.current.getPointer(event);
    const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: '#FF6B00',
      strokeWidth: 2,
      selectable: true
    });
    
    fabricCanvas.current.add(line);
    
    // Store as measurement
    saveMeasurement({
      type: 'length',
      geometry: { points: [pointer.x, pointer.y] }
    });
  }

  async function saveMeasurement(measurement) {
    try {
      const { error } = await supabase
        .from('takeoff_measurements')
        .insert([{
          plan_id: planId,
          measurement_type: measurement.type,
          geometry: measurement.geometry,
          raw_value: measurement.value,
          page_number: pageNumber
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left Toolbar */}
      <div style={{ width: 80, background: '#2a2a2a', padding: 10 }}>
        <ToolButton 
          icon="🔍" 
          label="Select" 
          active={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolButton 
          icon="📏" 
          label="Length" 
          active={tool === 'length'}
          onClick={() => setTool('length')}
        />
        <ToolButton 
          icon="⬜" 
          label="Area" 
          active={tool === 'area'}
          onClick={() => setTool('area')}
        />
        <ToolButton 
          icon="🎯" 
          label="Count" 
          active={tool === 'count'}
          onClick={() => setTool('count')}
        />
        <ToolButton 
          icon="📐" 
          label="Calibrate" 
          active={tool === 'calibrate'}
          onClick={() => setTool('calibrate')}
        />
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {plan && (
          <Document
            file={plan.file_url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}
        
        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto'
          }}
        />

        {/* Zoom Controls */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: '#2a2a2a',
          padding: 10,
          borderRadius: 8
        }}>
          <button onClick={() => setScale(s => Math.min(s + 0.1, 3))}>+</button>
          <span style={{ margin: '0 10px' }}>{(scale * 100).toFixed(0)}%</span>
          <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))}>-</button>
        </div>
      </div>

      {/* Right Panel - Measurements List */}
      <div style={{ width: 300, background: '#2a2a2a', padding: 20 }}>
        <h3>Measurements</h3>
        {/* List measurements here */}
      </div>
    </div>
  );
}

function ToolButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: 10,
        marginBottom: 10,
        background: active ? '#fc6b04ff' : 'transparent',
        border: '1px solid #444',
        borderRadius: 6,
        color: '#fff',
        cursor: 'pointer',
        fontSize: 20
      }}
      title={label}
    >
      {icon}
    </button>
  );
}
```

---

## Phase 4: Measurement Tools Implementation

### 4.1 Length Measurement
- Click to place start point
- Click to place end point
- Calculate pixel distance
- Convert to real-world units using calibration
- Display measurement with label

### 4.2 Area Measurement
- Click to place polygon vertices
- Double-click to close polygon
- Calculate area in pixels
- Convert to real-world area
- Display area with label

### 4.3 Count Tool
- Click to place count markers
- Automatically increment count
- Group by layer/material type
- Display total count

### 4.4 Calibration Tool
- Draw line on known distance (e.g., dimension line)
- Enter known distance
- Calculate scale factor
- Save calibration to database

---

## Phase 5: Integration with Estimates

### 5.1 Link Measurements to Estimate Items
```javascript
async function linkMeasurementToEstimate(measurementId, estimateId, section, materialName) {
  try {
    // Get measurement
    const { data: measurement } = await supabase
      .from('takeoff_measurements')
      .select('*')
      .eq('id', measurementId)
      .single();

    // Calculate quantity based on measurement type
    let quantity = 0;
    if (measurement.measurement_type === 'length') {
      quantity = measurement.actual_value;
    } else if (measurement.measurement_type === 'area') {
      quantity = measurement.actual_value;
    } else if (measurement.measurement_type === 'count') {
      quantity = measurement.actual_value;
    }

    // Update or create estimate item
    const { error } = await supabase
      .from('estimate_items')
      .upsert({
        estimate_id: estimateId,
        section: section,
        description: materialName,
        quantity: quantity,
        takeoff_measurement_id: measurementId
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error linking measurement:', error);
  }
}
```

### 5.2 Auto-sync Changes
- When measurement is updated, update linked estimate item quantity
- Show takeoff icon/badge on estimate items that have linked measurements
- Allow viewing/editing measurement from estimate page

---

## Phase 6: Advanced Features

### 6.1 Layers & Organization
- Create multiple layers per project
- Assign colors to layers
- Toggle layer visibility
- Lock/unlock layers

### 6.2 Measurement Formulas
- Custom formulas for complex calculations
- e.g., "length * 2 + 10" for waste factor
- Support for multiple measurements feeding one estimate item

### 6.3 Reporting
- Export takeoff report
- Show summary by layer/material
- Include plan thumbnails with measurements

### 6.4 Collaboration
- Share plans with team members
- Comment on specific measurements
- Track who made which measurements

---

## Technology Stack

**Frontend:**
- React-PDF for PDF rendering
- Fabric.js for canvas drawing
- Konva (alternative to Fabric)
- PDF.js for PDF parsing

**Backend:**
- Supabase Storage for file hosting
- PostgreSQL for data storage
- Supabase Realtime for collaboration

**File Processing:**
- PDF.js for PDF manipulation
- Sharp for image processing
- DWG parser (if supporting AutoCAD files)

---

## Implementation Order

1. ✅ **Week 1-2:** Database schema + file upload
2. ✅ **Week 3-4:** PDF viewer + basic canvas
3. ✅ **Week 5-6:** Calibration tool
4. ✅ **Week 7-8:** Length & area measurements
5. ✅ **Week 9-10:** Count tool + layers
6. ✅ **Week 11-12:** Integration with estimates
7. ✅ **Week 13-14:** Testing & refinement

---

## Security Considerations

1. File size limits (max 50MB per plan)
2. Virus scanning on upload
3. Row-level security on all tables
4. Signed URLs for file access
5. Rate limiting on uploads

---

## Performance Optimization

1. Lazy load PDF pages
2. Cache rendered pages
3. Optimize canvas rendering
4. Use web workers for calculations
5. Compress stored geometry data

---

## Next Steps

1. Review this plan and confirm approach
2. Create database migration files
3. Set up Supabase storage bucket
4. Build file upload component
5. Create basic PDF viewer
6. Implement calibration tool
7. Add measurement tools one by one

Would you like me to start implementing any specific phase?

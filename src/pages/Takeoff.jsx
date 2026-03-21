 
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as fabric from 'fabric';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PDFRenderer from '../Components/PDFRenderer';
import { loadMaterials as loadMaterialsFromCSV } from '../data/materials';

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
  { label: '1" = 30\'-0" (Site Plan)', inchesPerFoot: 1/30 },
];
export default function Takeoff() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');
  const navigate = useNavigate();
  const { user } = useAuth();

  // PDF State
  const [plan, setPlan] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfDimensions, setPdfDimensions] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(1.0);

  // Canvas State
  const canvasRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const fabricCanvasRef = useRef(null); // Store fabric canvas instance in ref
  const pdfWrapperRef = useRef(null);
  const canvasWrapperRef = useRef(null); // Separate ref for canvas wrapper
  
  // Tool State
  const [activeTool, setActiveTool] = useState(null); // 'calibrate', 'length', 'area', 'count'
  const activeToolRef = useRef(null); // Ref to track current tool for event handlers
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationData, setCalibrationData] = useState(null);
  const calibrationDataRef = useRef(null);
  
  // Measurement State
  const [measurements, setMeasurements] = useState([]);
  const [layers, setLayers] = useState([]);
  const layersRef = useRef([]);
  const [activeLayer, setActiveLayer] = useState(null);
  const activeLayerRef = useRef(null);
  
  // Materials State
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Drawing State (for length tool)
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const [currentLine, setCurrentLine] = useState(null);
  const currentLineRef = useRef(null);
  const [startPoint, setStartPoint] = useState(null);
  const startPointRef = useRef(null);
  
  // Multi-segment polyline state
  const [polylinePoints, setPolylinePoints] = useState([]);
  const polylinePointsRef = useRef([]);
  const [polylineSegments, setPolylineSegments] = useState([]);
  const polylineSegmentsRef = useRef([]);
  const [accumulatedDistance, setAccumulatedDistance] = useState(0);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Calibration modal state
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false); // 'draw' mode for calibration
  const calibrationModeRef = useRef(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [scale, setScale] = useState('1/4'); // Default scale
  const [unit, setUnit] = useState('feet'); // Default unit
// Add these new lines:
const [selectedPageSize, setSelectedPageSize] = useState(null);
const [selectedScale, setSelectedScale] = useState(null);
const [calibrationMethod, setCalibrationMethod] = useState('auto'); // 'auto' or 'manual'
  // Layer naming modal state
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [layerName, setLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState(null);

  // Measurement modal state
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [measurementLabel, setMeasurementLabel] = useState('');
  const [pendingMeasurement, setPendingMeasurement] = useState(null);
  const [showNewMeasurementPreview, setShowNewMeasurementPreview] = useState(false);
  
  // Material selection for length measurements
  const [measurementMaterials, setMeasurementMaterials] = useState([]); // [{material_id, material_name, quantity}]
  const [tempMaterialCategory, setTempMaterialCategory] = useState('');
  const [tempMaterialId, setTempMaterialId] = useState(null);
  const [tempMaterialQuantity, setTempMaterialQuantity] = useState('');
  
  // Drop footage for conduit runs
  const [startDropFootage, setStartDropFootage] = useState('');
  const [endDropFootage, setEndDropFootage] = useState('');
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [materialSearchResults, setMaterialSearchResults] = useState([]);
  
  // Quick assembly creation
  const [showQuickAssemblyModal, setShowQuickAssemblyModal] = useState(false);
  const [quickAssemblyName, setQuickAssemblyName] = useState('');
  const [quickAssemblyComponents, setQuickAssemblyComponents] = useState([]);
  const [quickAssemblyCategory, setQuickAssemblyCategory] = useState('');
  const [quickAssemblyMaterialId, setQuickAssemblyMaterialId] = useState(null);
  const [quickAssemblyQuantity, setQuickAssemblyQuantity] = useState('');
  const [quickAssemblyQuantityType, setQuickAssemblyQuantityType] = useState('per_foot');
  const [quickAssemblyDescription, setQuickAssemblyDescription] = useState('');
  const [saveQuickAssemblyPermanently, setSaveQuickAssemblyPermanently] = useState(false);
  
  // New: Step-by-step assembly builder state
  const [selectedConduitType, setSelectedConduitType] = useState(''); // EMT, Rigid, IMC, PVC, etc.
  const [selectedConduitSize, setSelectedConduitSize] = useState(''); // 1/2, 3/4, 1, etc.
  const [selectedConduitId, setSelectedConduitId] = useState(null); // Actual conduit material ID
  const [selectedWires, setSelectedWires] = useState([]); // Array of {material_id, quantity, material_name}
  const [tempWireId, setTempWireId] = useState(null);
  const [tempWireQty, setTempWireQty] = useState('');
  
  // Assembly customization state (for conduit assemblies)
  const [selectedBaseAssembly, setSelectedBaseAssembly] = useState(null);
  const [selectedConnectorType, setSelectedConnectorType] = useState(null);
  const [connectorQty, setConnectorQty] = useState('');
  const [selectedCouplingType, setSelectedCouplingType] = useState(null);
  const [couplingQtyPer10ft, setCouplingQtyPer10ft] = useState('');
  const [selectedStrapType, setSelectedStrapType] = useState(null);
  const [strapQtyPer10ft, setStrapQtyPer10ft] = useState('');
  const [selectedFittings, setSelectedFittings] = useState([]); // Array of {material_id, material_name, quantity}
  const [tempFittingType, setTempFittingType] = useState(null);
  const [tempFittingQty, setTempFittingQty] = useState('');
  
  // Edit measurement details modal
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [editingDetailsId, setEditingDetailsId] = useState(null);
  
  // Edit length measurement materials modal
  const [showEditLengthModal, setShowEditLengthModal] = useState(false);
  const [editingLengthId, setEditingLengthId] = useState(null);
  const [editLengthMaterials, setEditLengthMaterials] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Count item type selection modal
  const [showCountTypeModal, setShowCountTypeModal] = useState(false);
  const [selectedCountType, setSelectedCountType] = useState(null); // 'single', 'assembly', 'create'
  const [selectedAssemblyId, setSelectedAssemblyId] = useState(null);
  
  // Length item type selection modal
  const [showLengthTypeModal, setShowLengthTypeModal] = useState(false);
  const [selectedLengthType, setSelectedLengthType] = useState(null); // 'single', 'assembly', 'create'
  
  // Assembly selection modal
  const [showAssemblySelectionModal, setShowAssemblySelectionModal] = useState(false);
  const [assemblySearchTerm, setAssemblySearchTerm] = useState('');
  const [selectedAssemblyCategory, setSelectedAssemblyCategory] = useState('');
  
  // Conduit fittings modal (for Conduit/Wire assemblies)
  const [showFittingsModal, setShowFittingsModal] = useState(false);
  const [fittings90Count, setFittings90Count] = useState('');
  const [fittings45Count, setFittings45Count] = useState('');
  const [conduitSize, setConduitSize] = useState(''); // Extract from assembly name
  
  // Parametric assembly quantities modal (for assemblies with qty=0 components)
  const [showParametricModal, setShowParametricModal] = useState(false);
  const [parametricComponents, setParametricComponents] = useState([]); // Components with qty=0
  const [parametricQuantities, setParametricQuantities] = useState({}); // {component_id: quantity}
  const [parametricAssemblyId, setParametricAssemblyId] = useState(null);

  // Estimate selection modal (for choosing which estimate to export to)
  const [showEstimateSelectionModal, setShowEstimateSelectionModal] = useState(false);
  const [existingEstimates, setExistingEstimates] = useState([]);
  const [pendingExportLayer, setPendingExportLayer] = useState(null);

  // Assembly preview/confirmation modal
  const [showAssemblyPreviewModal, setShowAssemblyPreviewModal] = useState(false);
  const [previewAssemblyData, setPreviewAssemblyData] = useState(null); // {name, components, finalComponents, savePermanently}

  // Count tool state
  const [countMarkers, setCountMarkers] = useState([]);
  const countMarkersRef = useRef([]);
  const [showCountModal, setShowCountModal] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState(null); // Track which measurement is being edited
  const editingMeasurementIdRef = useRef(null);
  
  // Snapshot tool state
  const [snapshots, setSnapshots] = useState([]);
  const [showSnapshotLabelModal, setShowSnapshotLabelModal] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [pendingSnapshotImage, setPendingSnapshotImage] = useState(null);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [showSnapshotsList, setShowSnapshotsList] = useState(false);
  const snapshotStartRef = useRef(null);
  const snapshotRectFabricRef = useRef(null);

  // Auto-count tool state
  const [autoCountTemplate, setAutoCountTemplate] = useState(null); // { dataUrl, width, height, compositeCanvas, tmplCanvas }
  const [showAutoCountModal, setShowAutoCountModal] = useState(false);
  const [autoCountThreshold, setAutoCountThreshold] = useState(0.75);
  const [autoCountMatches, setAutoCountMatches] = useState([]);
  const [isRunningAutoCount, setIsRunningAutoCount] = useState(false);
  const autoCountStartRef = useRef(null);
  const autoCountRectFabricRef = useRef(null);
  const autoCountMatchRectsRef = useRef([]);

  // Drag detection for count tool (to allow panning)
  const dragStartRef = useRef(null);
  const isDraggingRef = useRef(false);
  
  // Track PDF pan offset and zoom to move/scale markers with PDF
  const [pdfPanOffset, setPdfPanOffset] = useState({ x: 0, y: 0 });
  const pdfPanOffsetRef = useRef({ x: 0, y: 0 });
  const [pdfZoom, setPdfZoom] = useState(1.0);
  const pdfZoomRef = useRef(1.0);
  const pdfInitializedRef = useRef(false); // Track if PDF has set its initial state
  
  // Track current page number
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  
  // Track PDF rotation
  const [pdfRotation, setPdfRotation] = useState(0);
  const pdfRotationRef = useRef(0);
  
  // Track fullscreen changes - reposition on pan changes for 2 seconds after fullscreen
  const fullscreenTimestampRef = useRef(null);
  
  // Color picker for measurements
  const [selectedColor, setSelectedColor] = useState('#FF6B00');
  const selectedColorRef = useRef('#FF6B00');
  
  // Spacebar pan mode
  const [isSpacebarHeld, setIsSpacebarHeld] = useState(false);
  const isSpacebarHeldRef = useRef(false);
  
  // Middle-click pan mode
  const isMiddleClickHeldRef = useRef(false);
  
  // Sync color ref
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);
  
  // Sync spacebar ref
  useEffect(() => {
    isSpacebarHeldRef.current = isSpacebarHeld;
  }, [isSpacebarHeld]);

  // Filter lines and markers by active layer
  useEffect(() => {
    if (!canvas || !activeLayer) return;
    
    console.log('Filtering by active layer:', activeLayer);
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.measurementId && obj.layerId) {
        // Show only measurements that match the active layer
        const shouldShow = obj.layerId === activeLayer;
        obj.set({ visible: shouldShow });
      }
    });
    
    // Filter markers by layer
    countMarkersRef.current.forEach(m => {
      if (m.marker && m.marker.layerId) {
        const shouldShow = m.marker.layerId === activeLayer;
        m.marker.set({ visible: shouldShow });
      }
    });
    
    canvas.renderAll();
  }, [activeLayer, canvas]);

  // Sync refs with state for event handlers
  useEffect(() => {
    activeToolRef.current = activeTool;
    
    // Forcefully update ALL canvas-related elements
    if (canvas && canvasRef.current) {
      const canvasEl = canvasRef.current;
      const canvasParent = canvasEl.parentElement;
      const upperCanvas = canvasParent?.querySelector('.upper-canvas');
      
      if (activeTool === 'length' || activeTool === 'count' || activeTool === 'snapshot' || calibrationMode) {
        // Set Fabric.js cursors
        const cursor = activeTool === 'count' ? 'pointer' : 'crosshair';
        canvas.defaultCursor = cursor;
        canvas.hoverCursor = cursor;
        canvas.selection = false;
        
        // Force DOM styles on ALL elements
        canvasEl.style.zIndex = '10';
        canvasEl.style.pointerEvents = 'auto';
        canvasEl.style.cursor = cursor;
        
        if (canvasParent) {
          canvasParent.style.zIndex = '10';
          canvasParent.style.pointerEvents = 'auto';
          canvasParent.style.cursor = cursor;
        }
        
        if (upperCanvas) {
          upperCanvas.style.zIndex = '10';
          upperCanvas.style.pointerEvents = 'auto';
          upperCanvas.style.cursor = cursor;
        }
        
        console.log(`${activeTool || 'calibration'} tool enabled - ALL canvas elements forced to z-index 10`);
      } else {
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        canvas.selection = true;
        
        canvasEl.style.zIndex = '0';
        canvasEl.style.pointerEvents = 'none';
        canvasEl.style.cursor = 'default';
        
        if (canvasParent) {
          canvasParent.style.zIndex = '0';
          canvasParent.style.pointerEvents = 'none';
          canvasParent.style.cursor = 'default';
        }
        
        if (upperCanvas) {
          upperCanvas.style.zIndex = '0';
          upperCanvas.style.pointerEvents = 'none';
        }
        
        console.log('Tool disabled - canvas reset');
      }
    }
  }, [activeTool, canvas, calibrationMode]);

  useEffect(() => {
    calibrationDataRef.current = calibrationData;
  }, [calibrationData]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    calibrationModeRef.current = calibrationMode;
  }, [calibrationMode]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    pdfRotationRef.current = pdfRotation;
  }, [pdfRotation]);

  // Step 2: Sync editing measurement ID with ref
  useEffect(() => {
    editingMeasurementIdRef.current = editingMeasurementId;
  }, [editingMeasurementId]);

  // SAFETY FEATURE: Warn before leaving page with unsaved markers
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const unsavedMarkers = countMarkersRef.current.filter(m => !m.measurementId);
      if (unsavedMarkers.length > 0) {
        e.preventDefault();
        e.returnValue = `You have ${unsavedMarkers.length} unsaved marker(s). If you leave, they will be lost!`;
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load plan data (or initialize empty with predefined layers)
  useEffect(() => {
    if (!user) {
      console.log('⏳ Waiting for user auth before loading plan/layers...');
      return;
    }
    if (planId) {
      loadPlan();
    } else {
      // No plan - but still create predefined layers so user can work without a plan
      console.log('⚠️ No planId - initializing predefined layers for estimate-only mode');
      createPredefinedLayers().then(() => loadLayers());
    }
  }, [planId, user]);

  // Load materials
  useEffect(() => {
    loadMaterials();
  }, []);

  // Listen for fullscreen changes - resize canvas and wait for PDF to report new offset
  useEffect(() => {
    function handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Resize canvas when fullscreen changes
      if (canvas && pdfWrapperRef.current) {
        console.log('===== FULLSCREEN CHANGE =====');
        console.log('Entering fullscreen:', isCurrentlyFullscreen);
        
        // Use different delays for entering vs exiting fullscreen
        // Exiting fullscreen needs more time for layout to settle
        const delay = isCurrentlyFullscreen ? 800 : 1500;
        
        // Wait for layout to settle, then resize canvas and reload
        setTimeout(() => {
          const rect = pdfWrapperRef.current.getBoundingClientRect();
          console.log('New canvas dimensions after fullscreen:', rect.width, 'x', rect.height);
          canvas.setDimensions({ width: rect.width, height: rect.height });
          
          // CLEAR canvas and marker tracking
          console.log('🧹 Clearing canvas and reloading all measurements...');
          canvas.clear();
          countMarkersRef.current = [];
          setCountMarkers([]);
          
          // Reload all drawings with current PDF state
          loadExistingDrawings(canvas);
          
          console.log('✅ Canvas cleared and measurements reloaded for fullscreen');
        }, delay);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [canvas]);

  // Canvas cleanup on unmount
  useEffect(() => {
    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, [canvas]);
  
  // Spacebar pan mode - global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // CRITICAL: Don't intercept ANY keys when user is typing in an input/textarea/select
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || activeEl?.isContentEditable) {
        return; // Let the input handle the keypress normally
      }
      
      // Spacebar pan mode - only when count tool is active
      if (e.code === 'Space' && activeToolRef.current === 'count' && !isSpacebarHeldRef.current) {
        e.preventDefault(); // Prevent page scroll
        isSpacebarHeldRef.current = true;
        setIsSpacebarHeld(true);
        
        // DIRECT DOM MANIPULATION for instant pan enable (like middle-click does)
        const wrapperEl = canvasWrapperRef.current;
        if (wrapperEl) {
          wrapperEl.style.pointerEvents = 'none';
          wrapperEl.style.cursor = 'grab';
          // CRITICAL: Also disable Fabric's inner canvas elements which have their own pointerEvents
          // Disable ALL child elements (Fabric creates multiple canvases with their own pointerEvents)
          wrapperEl.querySelectorAll('*').forEach(el => { el.style.pointerEvents = 'none'; });
          console.log('🔑 Spacebar held - PAN MODE (all elements disabled)');
        }
      }
      
      // Enter key to finish polyline (length tool)
      if (e.key === 'Enter' && activeToolRef.current === 'length') {
        console.log('🔑 Enter key pressed! Points:', polylinePointsRef.current.length);
        if (polylinePointsRef.current.length >= 2) {
          e.preventDefault();
          console.log('🔑 Calling finishPolyline()');
          finishPolyline();
        } else {
          console.log('🔑 Not enough points to finish (need at least 2)');
        }
      }
      
      // Escape key to cancel polyline (length tool)
      if (e.key === 'Escape' && activeToolRef.current === 'length' && polylinePointsRef.current.length > 0) {
        e.preventDefault();
        console.log('🔑 ESC pressed - cancelling polyline');
        cancelPolyline();
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isSpacebarHeldRef.current) {
        e.preventDefault();
        isSpacebarHeldRef.current = false;
        setIsSpacebarHeld(false);
        
        // DIRECT DOM MANIPULATION to re-enable canvas (like middle-click release)
        const wrapperEl = canvasWrapperRef.current;
        if (wrapperEl) {
          wrapperEl.style.pointerEvents = 'auto';
          wrapperEl.style.cursor = 'pointer';
          // Re-enable ALL child elements
          wrapperEl.querySelectorAll('*').forEach(el => { el.style.pointerEvents = 'auto'; });
          console.log('🔑 Spacebar released - COUNT MODE (all elements re-enabled)');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Setup canvas event handlers using NATIVE DOM events instead of Fabric
  function setupCanvasEvents(fabricCanvas) {
    // Attach events to the CANVAS wrapper div (where user actually clicks)
    const wrapperEl = canvasWrapperRef.current;
    
    if (!wrapperEl) {
      console.error('Canvas wrapper element not found for event attachment');
      return;
    }
    
    // Global mouseup listener to re-enable canvas after middle-click drag
    const handleGlobalMouseUp = (e) => {
      if (isMiddleClickHeldRef.current && e.button === 1) {
        console.log('🖱️ Middle button released - re-enabling canvas');
        isMiddleClickHeldRef.current = false;
        wrapperEl.style.pointerEvents = 'auto';
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Remove any existing Fabric event listeners to prevent conflicts
    fabricCanvas.off('mouse:down');
    fabricCanvas.off('mouse:move');
    fabricCanvas.off('mouse:up');
    
    console.log('🔧 ATTACHING EVENTS TO WRAPPER ELEMENT:', wrapperEl);
    console.log('🔧 Wrapper element tag:', wrapperEl.tagName);
    console.log('🔧 Wrapper element id:', wrapperEl.id);
    
    // REMOVE ALL EXISTING RIGHT-CLICK HANDLERS FIRST
    const oldHandler = wrapperEl.oncontextmenu;
    if (oldHandler) {
      console.log('⚠️ Found existing oncontextmenu handler - removing it');
      wrapperEl.oncontextmenu = null;
    }
    
    // Remove any addEventListener handlers by cloning the element (nuclear option)
    // Actually, let's just make sure we add ours with capture = true to catch it first
    
    // CRITICAL FIX: Add right-click handler for deleting markers
    // This must check if count tool is active!
    const handleRightClick = (e) => {
      console.log('🖱️ RIGHT-CLICK EVENT FIRED!');
      console.log('Active tool:', activeToolRef.current);
      console.log('Markers:', countMarkersRef.current.length);
      console.log('Event:', e);
      
      // ALWAYS prevent context menu first
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Only handle right-click when count tool is active
      if (activeToolRef.current !== 'count') {
        console.log('❌ Not in count mode, ignoring');
        return false;
      }
      if (countMarkersRef.current.length === 0) {
        console.log('❌ No markers to delete');
        return false;
      }
      
      const rect = wrapperEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      console.log('📍 Click position:', clickX, clickY);
      console.log('📍 Wrapper rect:', rect);
      
      // Find if we clicked on a marker (within 30px radius for easier clicking)
      let closestMarker = -1;
      let closestDistance = 30;
      
      countMarkersRef.current.forEach((m, idx) => {
        // Marker position is stored as left/top, but the circle center is at left+8, top+8
        const markerCenterX = m.marker.left + 8;
        const markerCenterY = m.marker.top + 8;
        
        const distance = Math.sqrt(
          Math.pow(markerCenterX - clickX, 2) + 
          Math.pow(markerCenterY - clickY, 2)
        );
        
        console.log(`📌 Marker ${idx}: center=(${markerCenterX}, ${markerCenterY}), distance=${distance.toFixed(1)}px`);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMarker = idx;
        }
      });
      
      console.log('🎯 Closest marker:', closestMarker, 'at distance:', closestDistance);
      
      if (closestMarker !== -1) {
        // Remove the marker from canvas
        const marker = countMarkersRef.current[closestMarker];
        fabricCanvas.remove(marker.marker);
        fabricCanvas.renderAll();
        
        // Remove from array
        const newMarkers = countMarkersRef.current.filter((_, i) => i !== closestMarker);
        countMarkersRef.current = newMarkers;
        setCountMarkers(newMarkers);
        
        console.log(`✅ MARKER DELETED! Remaining: ${newMarkers.length}`);
      } else {
        console.log('❌ No marker close enough to delete');
      }
      
      return false;
    };
    
    // Add with capture phase to catch event first
    wrapperEl.addEventListener('contextmenu', handleRightClick, true);
    
    // ALSO attach to the actual canvas element to ensure we catch it
    const canvasElement = fabricCanvas.getElement();
    if (canvasElement) {
      console.log('🔧 Also attaching right-click to canvas element:', canvasElement);
      canvasElement.addEventListener('contextmenu', handleRightClick, true);
    }
    
    wrapperEl.addEventListener('mousedown', (e) => {
      console.log('Canvas mouse:down event fired, activeTool:', activeToolRef.current, 'calibrationMode:', calibrationModeRef.current);
      console.log('Event target:', e.target);
      console.log('Event coordinates - clientX:', e.clientX, 'clientY:', e.clientY);
      console.log('Mouse button:', e.button, '(0=left, 1=middle, 2=right)');
      
      // CRITICAL FIX: For middle-click, disable canvas for the ENTIRE drag operation
      if (e.button === 1 && activeToolRef.current === 'count') {
        console.log('🖱️ Middle-click detected - disabling canvas for drag');
        isMiddleClickHeldRef.current = true;
        wrapperEl.style.pointerEvents = 'none';
        return; // Let the event pass through to PDF
      }
      
      // Handle calibration mode
      if (calibrationModeRef.current) {
        console.log('Calibration mode! Starting calibration line...');
        const rect = wrapperEl.getBoundingClientRect();
        const pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        const point = { x: pointer.x, y: pointer.y };
        startPointRef.current = point;
        setStartPoint(point);
        isDrawingRef.current = true;
        setIsDrawing(true);
        
        // Create calibration line in BLUE
        const line = new fabric.Line(
          [pointer.x, pointer.y, pointer.x, pointer.y],
          {
            stroke: '#3B82F6',
            strokeWidth: 4,
            selectable: false,
            hasBorders: false,
            hasControls: false,
          }
        );
        
        fabricCanvas.add(line);
        currentLineRef.current = line;
        setCurrentLine(line);
        return;
      }
      
      // Handle count tool - only on left click (button 0)
      // Middle click (button 1) is ignored so it can pass through for panning
      if (activeToolRef.current === 'count') {
        // CRITICAL: If spacebar is held, don't intercept clicks - let PDF handle panning
        if (isSpacebarHeldRef.current) {
          console.log('Spacebar held - allowing PDF pan, not placing marker');
          return; // Let the event pass through to PDF for panning
        }
        
        if (e.button === 1) {
          // Middle mouse button - ignore so PDF can handle pan
          console.log('Middle button - allowing PDF pan');
          return;
        }
        
        if (e.button === 0) {
          // Left click - place marker (with drag detection)
          console.log('Count tool mousedown - starting drag detection...');
          const rect = wrapperEl.getBoundingClientRect();
          dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            time: Date.now()
          };
          isDraggingRef.current = false;
          // Don't place marker yet - wait for mouseup to determine if it was a click or drag
          return;
        }
      }
      
      // Handle snapshot tool - start rectangle selection
      if (activeToolRef.current === 'snapshot') {
        const rect = wrapperEl.getBoundingClientRect();
        snapshotStartRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        // Remove any existing snapshot rect
        if (snapshotRectFabricRef.current) {
          fabricCanvas.remove(snapshotRectFabricRef.current);
          snapshotRectFabricRef.current = null;
          fabricCanvas.renderAll();
        }
        return;
      }

      // Handle auto-count template capture - start rectangle
      if (activeToolRef.current === 'autocount') {
        const rect = wrapperEl.getBoundingClientRect();
        autoCountStartRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        if (autoCountRectFabricRef.current) {
          fabricCanvas.remove(autoCountRectFabricRef.current);
          autoCountRectFabricRef.current = null;
          fabricCanvas.renderAll();
        }
        return;
      }
      
      // Use ref to get current value
      if (activeToolRef.current !== 'length') {
        console.log('Tool is not length, ignoring click');
        return;
      }
      console.log('Length tool active! Adding point to polyline...');
      
      // Get coordinates from native event
      const rect = wrapperEl.getBoundingClientRect();
      const pointer = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      console.log('Pointer coordinates:', pointer);
      
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
        console.log('First point set');
        return;
      }
      
      // If we have 2+ points, create a line segment
      const prevPoint = polylinePointsRef.current[polylinePointsRef.current.length - 2];
      
      // Calculate base coordinates (PDF-relative) for pan tracking
      const currentZoom = zoomRef.current;
      const currentOffset = pdfPanOffsetRef.current;
      const baseCoords = {
        x1: (prevPoint.x - currentOffset.x) / currentZoom,
        y1: (prevPoint.y - currentOffset.y) / currentZoom,
        x2: (point.x - currentOffset.x) / currentZoom,
        y2: (point.y - currentOffset.y) / currentZoom,
      };
      
      const line = new fabric.Line(
        [prevPoint.x, prevPoint.y, point.x, point.y],
        {
          stroke: selectedColorRef.current,
          strokeWidth: 5,
          selectable: false,
          hasBorders: false,
          hasControls: false,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          opacity: 1,
          baseCoords: baseCoords, // Store base coords for pan tracking
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
      console.log(`Segment added. Total points: ${polylinePointsRef.current.length}, Distance: ${realDistance.toFixed(2)} ft`);
    });

    wrapperEl.addEventListener('mousemove', (e) => {
      // Check for drag in count tool mode
      if (activeToolRef.current === 'count' && dragStartRef.current) {
        const dragDistance = Math.sqrt(
          Math.pow(e.clientX - dragStartRef.current.x, 2) +
          Math.pow(e.clientY - dragStartRef.current.y, 2)
        );
        
        // If moved more than 5 pixels, consider it a drag (not a click)
        if (dragDistance > 5) {
          isDraggingRef.current = true;
          console.log('Drag detected, distance:', dragDistance);
        }
        return;
      }
      
      // Handle snapshot rectangle preview
      if (activeToolRef.current === 'snapshot' && snapshotStartRef.current) {
        const rect = wrapperEl.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const start = snapshotStartRef.current;
        if (snapshotRectFabricRef.current) {
          fabricCanvas.remove(snapshotRectFabricRef.current);
        }
        const selRect = new fabric.Rect({
          left: Math.min(start.x, currentX),
          top: Math.min(start.y, currentY),
          width: Math.abs(currentX - start.x),
          height: Math.abs(currentY - start.y),
          fill: 'rgba(59, 130, 246, 0.1)',
          stroke: '#3B82F6',
          strokeWidth: 2,
          strokeDashArray: [5, 3],
          selectable: false,
          hasBorders: false,
          hasControls: false,
        });
        fabricCanvas.add(selRect);
        snapshotRectFabricRef.current = selRect;
        fabricCanvas.renderAll();
        return;
      }

      // Handle auto-count template rectangle preview
      if (activeToolRef.current === 'autocount' && autoCountStartRef.current) {
        const rect = wrapperEl.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const start = autoCountStartRef.current;
        if (autoCountRectFabricRef.current) {
          fabricCanvas.remove(autoCountRectFabricRef.current);
        }
        const selRect = new fabric.Rect({
          left: Math.min(start.x, currentX),
          top: Math.min(start.y, currentY),
          width: Math.abs(currentX - start.x),
          height: Math.abs(currentY - start.y),
          fill: 'rgba(16, 185, 129, 0.1)',
          stroke: '#10b981',
          strokeWidth: 2,
          strokeDashArray: [5, 3],
          selectable: false,
          hasBorders: false,
          hasControls: false,
        });
        fabricCanvas.add(selRect);
        autoCountRectFabricRef.current = selRect;
        fabricCanvas.renderAll();
        return;
      }

      // For calibration mode, use old behavior
      if (calibrationModeRef.current && isDrawingRef.current && currentLineRef.current) {
        const rect = wrapperEl.getBoundingClientRect();
        const pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        const line = currentLineRef.current;
        line.set({ x2: pointer.x, y2: pointer.y });
        fabricCanvas.renderAll();
        return;
      }
      
      // For length tool polyline: show preview from last point to cursor
      if (activeToolRef.current === 'length' && isDrawingRef.current && polylinePointsRef.current.length > 0) {
        const rect = wrapperEl.getBoundingClientRect();
        const pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        // Remove old preview line if it exists
        if (currentLineRef.current) {
          fabricCanvas.remove(currentLineRef.current);
        }
        
        // Create new preview line from last point to cursor
        const lastPoint = polylinePointsRef.current[polylinePointsRef.current.length - 1];
        const previewLine = new fabric.Line(
          [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
          {
            stroke: selectedColorRef.current,
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
      }
    });

    wrapperEl.addEventListener('mouseup', async (e) => {
      // Handle count tool - place marker only if it was a click (not a drag)
      if (activeToolRef.current === 'count' && dragStartRef.current) {
        const wasDragging = isDraggingRef.current;
        dragStartRef.current = null;
        isDraggingRef.current = false;
        
        if (wasDragging) {
          console.log('Was dragging - no marker placed');
          return; // User was panning, don't place marker
        }
        
        // It was a click - place marker
        console.log('Click detected - placing marker...');
        const rect = wrapperEl.getBoundingClientRect();
        const pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        // Get current pan offset to calculate PDF-relative coordinates
        const currentZoom = zoomRef.current;
        const currentOffset = pdfPanOffsetRef.current;
        
        console.log('Placing marker - Current zoom:', currentZoom, 'Pan offset:', currentOffset);
        
        // Formula: base = (screen - panOffset) / zoom
        // This gives us TRUE PDF-relative coordinates
        const baseX = (pointer.x - currentOffset.x) / currentZoom;
        const baseY = (pointer.y - currentOffset.y) / currentZoom;
        
        console.log('Base coordinates calculated:', baseX, baseY, 'from screen:', pointer.x, pointer.y, 'offset:', currentOffset);
        
        // Add a visual marker (small circle) with selected color and transparency
        const marker = new fabric.Circle({
          left: pointer.x - 8,
          top: pointer.y - 8,
          radius: 8,
          fill: selectedColorRef.current,
          opacity: 0.6, // Transparent like a highlighter
          stroke: '#fff',
          strokeWidth: 2,
          selectable: false,
          hasBorders: false,
          hasControls: false,
        });
        
        fabricCanvas.add(marker);
        fabricCanvas.renderAll();
        
        // Add to markers list with base position for pan tracking
        const newMarkers = [...countMarkersRef.current, { 
          x: pointer.x, 
          y: pointer.y, 
          baseX: baseX, 
          baseY: baseY,
          marker,
          zoom: currentZoom,
          measurementId: null // Explicitly set to null for new markers
        }];
        countMarkersRef.current = newMarkers;
        setCountMarkers(newMarkers);
        
        console.log(`Count markers: ${newMarkers.length}, screen: (${pointer.x}, ${pointer.y}), base: (${baseX}, ${baseY}), zoom: ${currentZoom}`);
        return;
      }
      
      // Handle auto-count template capture on mouseup
      if (activeToolRef.current === 'autocount' && autoCountStartRef.current) {
        const wRect = wrapperEl.getBoundingClientRect();
        const endX = e.clientX - wRect.left;
        const endY = e.clientY - wRect.top;
        const start = autoCountStartRef.current;
        autoCountStartRef.current = null;

        // Remove the selection rect
        if (autoCountRectFabricRef.current) {
          fabricCanvas.remove(autoCountRectFabricRef.current);
          autoCountRectFabricRef.current = null;
          fabricCanvas.renderAll();
        }

        const captureRect = {
          x: Math.min(start.x, endX),
          y: Math.min(start.y, endY),
          width: Math.abs(endX - start.x),
          height: Math.abs(endY - start.y),
        };

        if (captureRect.width < 10 || captureRect.height < 10) return; // too small

        captureAutoCountTemplate(captureRect, fabricCanvas);
        return;
      }

      // Handle snapshot capture on mouseup
      if (activeToolRef.current === 'snapshot' && snapshotStartRef.current) {
        const wRect = wrapperEl.getBoundingClientRect();
        const endX = e.clientX - wRect.left;
        const endY = e.clientY - wRect.top;
        const start = snapshotStartRef.current;
        snapshotStartRef.current = null;

        // Remove the selection rect
        if (snapshotRectFabricRef.current) {
          fabricCanvas.remove(snapshotRectFabricRef.current);
          snapshotRectFabricRef.current = null;
          fabricCanvas.renderAll();
        }

        const captureRect = {
          x: Math.min(start.x, endX),
          y: Math.min(start.y, endY),
          width: Math.abs(endX - start.x),
          height: Math.abs(endY - start.y),
        };

        if (captureRect.width < 20 || captureRect.height < 20) return; // too small

        captureSnapshotFromCanvas(captureRect, fabricCanvas);
        return;
      }

      // Check if we're in calibration mode
      if (calibrationModeRef.current && isDrawingRef.current && currentLineRef.current) {
        const rect = wrapperEl.getBoundingClientRect();
        const pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        const start = startPointRef.current;
        
        isDrawingRef.current = false;
        setIsDrawing(false);
        
        // Calculate pixel distance
        const dx = pointer.x - start.x;
        const dy = pointer.y - start.y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Store the line and pixel distance
        setCalibrationLine({
          line: currentLineRef.current,
          pixelDistance: pixelDistance,
          zoom: zoomRef.current
        });
        
        currentLineRef.current = null;
        setCurrentLine(null);
        
        // Show modal for distance input
        setShowCalibrationModal(true);
        return;
      }
      
      // Length tool now uses polyline - no mouseup handling needed
      // User must press Enter to finish the measurement
    });
  }

  // Resize canvas when window resizes - markers stay correct because they're PDF-relative
  useEffect(() => {
    function handleResize() {
      if (canvas && pdfWrapperRef.current) {
        console.log('===== WINDOW RESIZE =====');
        const rect = pdfWrapperRef.current.getBoundingClientRect();
        console.log('New canvas dimensions:', rect.width, 'x', rect.height);
        canvas.setDimensions({ width: rect.width, height: rect.height });
        canvas.renderAll();
        console.log('✅ Canvas resized - markers remain in correct PDF-relative positions');
      }
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas]);

  async function loadExistingDrawings(fabricCanvas) {
    try {
      // Load length measurements FOR CURRENT PAGE ONLY
      const { data: lengthData, error: lengthError } = await supabase
        .from('plan_measurements')
        .select('*')
        .eq('plan_id', planId)
        .eq('page_number', currentPageRef.current)
        .eq('measurement_type', 'length');

      if (lengthError) throw lengthError;
      
      if (lengthData && lengthData.length > 0) {
        console.log(`Loading ${lengthData.length} existing length measurements...`);
        const currentOffset = pdfPanOffsetRef.current;
        const currentZoom = pdfZoomRef.current;
        
        lengthData.forEach(measurement => {
          const { geometry, color, id, layer_id } = measurement;
          
          // Check if it's a polyline (NEW FORMAT: has points array) or old single-segment format
          if (geometry && geometry.points && Array.isArray(geometry.points)) {
            // NEW FORMAT: Polyline with multiple points
            console.log(`Loading polyline with ${geometry.points.length} points`);
            for (let i = 1; i < geometry.points.length; i++) {
              const p1 = geometry.points[i - 1];
              const p2 = geometry.points[i];
              
              // Store individual segment base coordinates
              const segmentBaseCoords = {
                x1: p1.x,
                y1: p1.y,
                x2: p2.x,
                y2: p2.y,
              };
              
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
                  baseCoords: segmentBaseCoords, // Store THIS segment's base coords
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
                baseCoords: geometry, // Store PDF-relative coords as base
                visible: true
              }
            );
            fabricCanvas.add(line);
          }
        });
      }
      
      // Load count measurements FOR CURRENT PAGE ONLY
      const { data: countData, error: countError } = await supabase
        .from('plan_measurements')
        .select('*')
        .eq('plan_id', planId)
        .eq('page_number', currentPageRef.current)
        .eq('measurement_type', 'count');

      if (countError) throw countError;
      
      if (countData && countData.length > 0) {
        console.log(`\n===== LOADING ${countData.length} COUNT MEASUREMENTS =====`);
        const currentZoom = pdfZoomRef.current;
        const currentOffset = pdfPanOffsetRef.current;
        
        console.log('Initial load state:');
        console.log('- Zoom:', currentZoom);
        console.log('- Pan offset:', currentOffset);
        console.log('- Active layer:', activeLayerRef.current);
        
        let totalMarkersLoaded = 0;
        
        countData.forEach((measurement, measurementIndex) => {
          const { geometry, color, id, label, layer_id } = measurement;
          console.log(`\nMeasurement ${measurementIndex + 1}: "${label || 'Unlabeled'}" (ID: ${id})`);
          console.log('- Layer ID:', layer_id);
          console.log('- Color:', color);
          console.log('- Marker count in DB:', geometry?.markers?.length || 0);
          console.log('- Markers array:', geometry?.markers);
          
          if (geometry && geometry.markers && Array.isArray(geometry.markers)) {
            console.log(`  Starting to load ${geometry.markers.length} markers...`);
            
            geometry.markers.forEach((markerData, markerIndex) => {
              console.log(`  Loading marker ${markerIndex}:`, markerData);
              
              // markerData contains PDF-relative base coords
              // Apply BOTH zoom AND pan offset to match placing formula
              const screenX = (markerData.x * currentZoom) + currentOffset.x;
              const screenY = (markerData.y * currentZoom) + currentOffset.y;
              
              console.log(`    Marker ${markerIndex} positioning:`);
              console.log(`      Base (PDF): x=${markerData.x}, y=${markerData.y}`);
              console.log(`      Screen (with zoom + pan): x=${screenX.toFixed(2)}, y=${screenY.toFixed(2)}`);
              console.log(`      Zoom: ${currentZoom}, Offset: ${currentOffset.x}, ${currentOffset.y}`);
              console.log(`      Color: ${color}`);
              
              const marker = new fabric.Circle({
                left: screenX - 8,
                top: screenY - 8,
                radius: 8 * currentZoom,
                fill: color || '#10b981',
                opacity: 0.6,
                stroke: '#fff',
                strokeWidth: 2 * currentZoom,
                selectable: false,
                hasBorders: false,
                hasControls: false,
                measurementId: id,
                layerId: layer_id,
                visible: true // Always visible on load
              });
              
              console.log(`      Created marker object at left=${marker.left}, top=${marker.top}`);
              
              // Check if marker is in current viewport (it's OK if it's not - will appear when panning)
              const canvasWidth = fabricCanvas.width;
              const canvasHeight = fabricCanvas.height;
              const markerInBounds = (
                marker.left >= -20 && marker.left <= canvasWidth + 20 &&
                marker.top >= -20 && marker.top <= canvasHeight + 20
              );
              console.log(`      Marker ${markerIndex} in current viewport: ${markerInBounds ? '✓ YES' : '✗ NO (will appear when panning)'}`);
              if (!markerInBounds) {
                console.log(`      📍 Marker is at (${marker.left.toFixed(0)}, ${marker.top.toFixed(0)}) - outside current view (${canvasWidth}x${canvasHeight})`);
                console.log(`      💡 This is NORMAL - marker will appear when you pan the PDF to that area`);
              }
              
              fabricCanvas.add(marker);
              marker.setCoords(); // Force coordinate update
              marker.visible = true; // Explicitly set visible
              marker.evented = false; // Disable events to improve performance
              console.log(`      Added to canvas, total canvas objects: ${fabricCanvas.getObjects().length}`);
              
              // Store with PDF-relative coords as base
              const markerTracking = {
                x: screenX,
                y: screenY,
                baseX: markerData.x, // PDF-relative (no zoom/pan)
                baseY: markerData.y, // PDF-relative (no zoom/pan)
                marker: marker,
                saved: true,
                measurementId: id
              };
              countMarkersRef.current.push(markerTracking);
              
              totalMarkersLoaded++;
              console.log(`      ✅ Marker ${markerIndex} loaded successfully. Total loaded: ${totalMarkersLoaded}`);
              console.log(`      Stored in tracking array at index ${countMarkersRef.current.length - 1}`);
            });
            console.log(`  ✅ Completed loading ${geometry.markers.length} markers for measurement "${label}"`);
          } else {
            console.error(`  ❌ geometry.markers is not a valid array:`, geometry?.markers);
          }
        });
        
        console.log(`\n✅ TOTAL MARKERS LOADED: ${totalMarkersLoaded}`);
        console.log(`Markers in countMarkersRef: ${countMarkersRef.current.length}\n`);
      }
      
      // Force render with viewport disabled temporarily to ensure all objects render
      fabricCanvas.renderOnAddRemove = true;
      fabricCanvas.skipOffscreen = false; // CRITICAL: Don't skip offscreen objects
      fabricCanvas.renderAll();
      console.log('✅ Existing measurements loaded on canvas (including offscreen markers)');
    } catch (err) {
      console.error('Error loading existing drawings:', err);
    }
  }

  function calculateRealDistance(pixelDistance) {
    // Use ref to ensure we have the latest calibration data
    const calibData = calibrationDataRef.current;
    const currentZoom = zoomRef.current;
    
    console.log('Calculating distance for pixels:', pixelDistance);
    console.log('Current zoom:', currentZoom);
    console.log('Calibration data:', calibData);
    
    if (!calibData || !calibData.pixels_per_foot_at_100) {
      console.warn('No calibration data available or old calibration format');
      return 0;
    }
    
    // NEW ZOOM-INDEPENDENT FORMULA:
    // realDistance = (pixelDistance / currentZoom) / pixels_per_foot_at_100
    const realDistance = (pixelDistance / currentZoom) / calibData.pixels_per_foot_at_100;
    
    console.log('Calculated feet:', realDistance);
    
    return realDistance;
  }

  async function loadPlan() {
    try {
      const { data: planData, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      setPlan(planData);
      
      console.log('Plan data:', planData);
      console.log('File URL:', planData.file_url);
      
      // Extract the file path from the URL
      // The file_url might be a full URL or just a path
      let filePath = planData.file_url;
      
      // If it's a full URL, extract just the path after the bucket name
      if (filePath.includes('/storage/v1/object/public/plans/')) {
        filePath = filePath.split('/storage/v1/object/public/plans/')[1];
      } else if (filePath.includes('/plans/')) {
        filePath = filePath.split('/plans/')[1];
      } else if (filePath.startsWith('plans/')) {
        filePath = filePath.substring(6); // Remove 'plans/' prefix
      }
      
      console.log('Extracted file path:', filePath);
      
      // Get signed URL for the file
      const { data: urlData, error: urlError } = await supabase.storage
        .from('plans')
        .createSignedUrl(filePath, 3600);
      
      if (urlError) {
        console.error('Error creating signed URL:', urlError);
        throw urlError;
      }
      
      if (urlData && urlData.signedUrl) {
        console.log('Signed URL created successfully');
        setPdfUrl(urlData.signedUrl);
      } else {
        throw new Error('No signed URL returned');
      }

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

      // Load measurements (don't throw error if table doesn't exist)
      loadMeasurements();
      loadSnapshots();
    } catch (err) {
      console.error('Error loading plan:', err);
      console.error('Failed to load plan:', err.message);
    }
    
    // ALWAYS create and load layers, even if plan loading had errors above
    try {
      await createPredefinedLayers();
      await loadLayers();
    } catch (layerErr) {
      console.error('Error loading layers:', layerErr);
    }
  }

  async function loadMeasurements() {
    try {
      const { data, error } = await supabase
        .from('plan_measurements')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (err) {
      console.error('Error loading measurements:', err);
    }
  }

  async function loadMaterials() {
    try {
      // Load base materials from database (PRIMARY SOURCE)
      // CRITICAL: Include auto_add fields for automatic connector/coupling addition
      const { data: baseMaterials, error: baseError } = await supabase
        .from('base_materials')
        .select('*, auto_add_connector_id, auto_add_coupling_id')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .range(0, 99999); // Load all materials
      
      if (baseError) {
        console.error('Error loading base materials:', baseError);
      }
      
      // Map base materials fields to match expected format
      const mappedBaseMaterials = (baseMaterials || []).map(m => ({
        ...m,
        price: m.basecost,
        laborHours: m.laborhours
      }));
      
      // Load custom materials from database
      const { data: customMaterials, error: customError } = await supabase
        .from('custom_materials')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      // Map custom materials fields to match expected format
      const mappedCustomMaterials = (customMaterials || []).map(m => ({
        ...m,
        price: m.basecost,
        laborHours: m.laborhours
      }));
      
      // Load assemblies from database
      const { data: assemblies, error: assembliesError } = await supabase
        .from('assemblies')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      // Format assemblies to match materials structure
      const formattedAssemblies = (assemblies || []).map(assembly => ({
        ...assembly,
        category: assembly.category || 'Assemblies',
        unit: 'assembly'
      }));
      
      // Combine all materials (base materials + custom + assemblies)
      const allMaterials = [
        ...mappedBaseMaterials,
        ...mappedCustomMaterials,
        ...formattedAssemblies
      ];
      
      setMaterials(allMaterials);
      console.log(`✅ Loaded ${allMaterials.length} total materials (${baseMaterials?.length || 0} base + ${customMaterials?.length || 0} custom + ${formattedAssemblies.length} assemblies)`);
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  }

  async function deleteMeasurement(measurementId) {
    try {
      // Delete from database
      const { error } = await supabase
        .from('plan_measurements')
        .delete()
        .eq('id', measurementId);

      if (error) throw error;

      // Remove from canvas
      if (canvas) {
        const objects = canvas.getObjects();
        const toRemove = objects.filter(obj => obj.measurementId === measurementId);
        toRemove.forEach(obj => canvas.remove(obj));
        canvas.renderAll();
      }

      // CRITICAL: Remove markers from countMarkersRef if this is a count measurement
      const markersToKeep = countMarkersRef.current.filter(m => m.measurementId !== measurementId);
      countMarkersRef.current = markersToKeep;
      setCountMarkers(markersToKeep);
      
      console.log(`Removed markers for measurement ${measurementId}. Remaining markers:`, markersToKeep.length);

      // Reload measurements list
      loadMeasurements();
      console.log('✅ Measurement deleted');
    } catch (err) {
      console.error('Error deleting measurement:', err);
    }
  }

  async function loadLayers() {
    try {
      const { data, error } = await supabase
        .from('measurement_layers')
        .select('*')
        .eq('plan_id', planId)
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      
      console.log('===== LOADED LAYERS =====');
      console.log('Total layers:', data?.length || 0);
      console.log('Layers data:', data);
      if (data) {
        const predefined = data.filter(l => l.is_predefined);
        const custom = data.filter(l => !l.is_predefined);
        console.log('Predefined layers:', predefined.length, predefined);
        console.log('Custom layers:', custom.length, custom);
      }
      
      setLayers(data || []);
      if (data && data.length > 0) {
        setActiveLayer(data[0].id);
      }
    } catch (err) {
      console.error('Error loading layers:', err);
    }
  }

  async function createPredefinedLayers() {
    const predefinedLayers = [
      { name: 'Fixtures', section_name: 'Fixtures', color: '#EF4444', display_order: 1 },
      { name: 'Power', section_name: 'Power', color: '#F59E0B', display_order: 2 },
      { name: 'Branch', section_name: 'Branch', color: '#10B981', display_order: 3 },
      { name: 'Feeders', section_name: 'Feeders', color: '#3B82F6', display_order: 4 },
      { name: 'Switchgear', section_name: 'Switchgear', color: '#8B5CF6', display_order: 5 },
      { name: 'Equipment', section_name: 'Equipment', color: '#EC4899', display_order: 6 },
      { name: 'Special Systems', section_name: 'Special Systems', color: '#06B6D4', display_order: 7 },
    ];
    
    console.log('🔧 Creating predefined layers for planId:', planId, 'user:', user?.id);
    
    for (const layer of predefinedLayers) {
      try {
        // Check if layer already exists
        const { data: existing, error: checkError } = await supabase
          .from('measurement_layers')
          .select('id')
          .eq('plan_id', planId)
          .eq('section_name', layer.section_name)
          .eq('is_predefined', true)
          .maybeSingle();
        
        if (checkError) {
          console.error(`❌ Error checking layer ${layer.name}:`, checkError);
          continue;
        }
        
        if (!existing) {
          const { data: inserted, error: insertError } = await supabase
            .from('measurement_layers')
            .insert([{
              plan_id: planId,
              name: layer.name,
              section_name: layer.section_name,
              color: layer.color,
              visible: true,
              is_predefined: true,
              display_order: layer.display_order,
              company_id: user.id,
            }])
            .select();
          
          if (insertError) {
            console.error(`❌ Error INSERTING layer ${layer.name}:`, insertError);
          } else {
            console.log(`✅ Created predefined layer: ${layer.name}`, inserted);
          }
        } else {
          console.log(`⏭️ Layer ${layer.name} already exists (id: ${existing.id})`);
        }
      } catch (err) {
        console.error(`❌ Exception creating layer ${layer.name}:`, err);
      }
    }
  }

  function openLayerModal(layerId = null) {
    if (layerId) {
      // Editing existing layer
      const layer = layers.find(l => l.id === layerId);
      setLayerName(layer?.name || '');
      setEditingLayerId(layerId);
    } else {
      // Creating new layer
      const layerNumber = layers.length + 1;
      setLayerName(`Layer ${layerNumber}`);
      setEditingLayerId(null);
    }
    setShowLayerModal(true);
  }

  async function saveLayerName() {
    if (!layerName.trim()) {
      alert('Please enter a layer name');
      return;
    }

    try {
      if (editingLayerId) {
        // Update existing layer
        const { error } = await supabase
          .from('measurement_layers')
          .update({ name: layerName.trim() })
          .eq('id', editingLayerId);

        if (error) throw error;

        // Update local state
        setLayers(layers.map(l => 
          l.id === editingLayerId ? { ...l, name: layerName.trim() } : l
        ));
        console.log('✅ Layer renamed');
      } else {
        // Create new layer
        const { data, error } = await supabase
          .from('measurement_layers')
          .insert([{
            plan_id: planId,
            name: layerName.trim(),
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            visible: true
          }])
          .select()
          .single();

        if (error) throw error;
        setLayers([...layers, data]);
        setActiveLayer(data.id);
        console.log(`✅ Created ${layerName.trim()}`);
      }

      setShowLayerModal(false);
      setLayerName('');
      setEditingLayerId(null);
    } catch (err) {
      console.error('Error saving layer:', err);
      alert('Failed to save layer: ' + err.message);
    }
  }

  async function deleteLayer(layerId, e) {
    e.stopPropagation(); // Prevent selecting the layer when clicking delete
    
    // Check if it's a predefined layer
    const layer = layers.find(l => l.id === layerId);
    if (layer?.is_predefined) {
      alert('Cannot delete predefined section layers');
      return;
    }
    
    try {
      // Delete the layer from database
      const { error } = await supabase
        .from('measurement_layers')
        .delete()
        .eq('id', layerId);

      if (error) throw error;

      // Update local state
      const updatedLayers = layers.filter(l => l.id !== layerId);
      setLayers(updatedLayers);

      // If we deleted the active layer, select the first remaining layer
      if (activeLayer === layerId && updatedLayers.length > 0) {
        setActiveLayer(updatedLayers[0].id);
      } else if (updatedLayers.length === 0) {
        setActiveLayer(null);
      }

      console.log('✅ Layer deleted');
    } catch (err) {
      console.error('Error deleting layer:', err);
      alert('Failed to delete layer: ' + err.message);
    }
  }

  // Function to add material to the measurement
  function addMaterialToMeasurement() {
    if (!tempMaterialId || !tempMaterialQuantity || parseFloat(tempMaterialQuantity) <= 0) {
      alert('Please select a material and enter a valid quantity');
      return;
    }
    
    const material = materials.find(m => m.id === tempMaterialId);
    if (!material) return;
    
    setMeasurementMaterials([...measurementMaterials, {
      material_id: tempMaterialId,
      material_name: material.name,
      quantity: parseFloat(tempMaterialQuantity),
      unit: material.unit || 'ea'
    }]);
    
    // Reset temp fields
    setTempMaterialId(null);
    setTempMaterialCategory('');
    setTempMaterialQuantity('');
  }
  
  // Function to remove material from the list
  function removeMaterialFromMeasurement(index) {
    setMeasurementMaterials(measurementMaterials.filter((_, i) => i !== index));
  }
  
  // Open quick assembly creation modal
  function openQuickAssemblyModal() {
    setShowQuickAssemblyModal(true);
    setQuickAssemblyName('');
    setQuickAssemblyComponents([]);
  }
  
  // Add component to quick assembly
  function addComponentToQuickAssembly() {
    if (!quickAssemblyMaterialId || !quickAssemblyQuantity || parseFloat(quickAssemblyQuantity) <= 0) {
      alert('Please select a material and enter a valid quantity');
      return;
    }
    
    const material = materials.find(m => m.id === quickAssemblyMaterialId);
    if (!material) return;
    
    setQuickAssemblyComponents([...quickAssemblyComponents, {
      material_id: quickAssemblyMaterialId,
      material_name: material.name,
      quantity: parseFloat(quickAssemblyQuantity),
      unit: material.unit || 'ea',
      material_unit_cost: material.price || 0,
      labor_hours: material.labor_hours || 0,
      quantity_type: quickAssemblyQuantityType,
      description: quickAssemblyDescription.trim() || null
    }]);
    
    // Reset temp fields
    setQuickAssemblyMaterialId(null);
    setQuickAssemblyCategory('');
    setQuickAssemblyQuantity('');
    setQuickAssemblyQuantityType('per_foot');
    setQuickAssemblyDescription('');
  }
  
  // Remove component from quick assembly
  function removeComponentFromQuickAssembly(index) {
    setQuickAssemblyComponents(quickAssemblyComponents.filter((_, i) => i !== index));
  }
  
  // Prepare assembly preview (called when user clicks "Create Assembly")
  async function prepareAssemblyPreview() {
    if (!quickAssemblyName.trim()) {
      alert('Please enter an assembly name');
      return;
    }
    
    // Build the final components list
    let finalComponents = [];
    
    // STEP 1: Add conduit if selected
    if (selectedConduitId) {
      const conduitMaterial = materials.find(m => m.id === selectedConduitId);
      if (conduitMaterial) {
        console.log('✅ Adding conduit to preview:', conduitMaterial.name);
        finalComponents.push({
          material_id: conduitMaterial.id,
          material_name: conduitMaterial.name,
          quantity: 1, // 1 foot per foot
          unit: conduitMaterial.unit || 'ft',
          material_unit_cost: conduitMaterial.price || 0,
          labor_hours: conduitMaterial.laborHours || 0,
          quantity_type: 'per_foot',
          description: 'Conduit',
          sequence: finalComponents.length + 1
        });
      }
    }
    
    // STEP 2: Add wires if selected
    if (selectedWires && selectedWires.length > 0) {
      selectedWires.forEach(wire => {
        console.log('✅ Adding wire to preview:', wire.material_name);
        const wireMaterial = materials.find(m => m.id === wire.material_id);
        finalComponents.push({
          material_id: wire.material_id,
          material_name: wire.material_name,
          quantity: wire.quantity, // quantity per foot
          unit: 'ft',
          material_unit_cost: wireMaterial?.price || 0,
          labor_hours: wireMaterial?.laborHours || 0,
          quantity_type: 'per_foot',
          description: `${wire.quantity} wires`,
          sequence: finalComponents.length + 1
        });
      });
    }
    
    // STEP 3: Add BASE connectors if selected (user-entered, fixed quantity)
    if (selectedConnectorType && connectorQty) {
      const connectorMat = materials.find(m => m.id === selectedConnectorType);
      if (connectorMat) {
        console.log('✅ Adding BASE connector to preview:', connectorMat.name, 'qty:', connectorQty);
        finalComponents.push({
          material_id: connectorMat.id,
          material_name: connectorMat.name,
          quantity: parseFloat(connectorQty),
          unit: connectorMat.unit || 'ea',
          material_unit_cost: connectorMat.price || 0,
          labor_hours: connectorMat.laborHours || 0,
          quantity_type: 'fixed',
          description: 'Base Connector',
          sequence: finalComponents.length + 1,
          isBaseConnector: true // Flag to identify as base (not from fitting)
        });
      }
    }
    
    // STEP 4: Add BASE couplings if selected (user-entered, per 10 feet)
    if (selectedCouplingType && couplingQtyPer10ft) {
      const couplingMat = materials.find(m => m.id === selectedCouplingType);
      if (couplingMat) {
        console.log('✅ Adding BASE coupling to preview:', couplingMat.name, 'qty per 10ft:', couplingQtyPer10ft);
        finalComponents.push({
          material_id: couplingMat.id,
          material_name: couplingMat.name,
          quantity: parseFloat(couplingQtyPer10ft),
          unit: couplingMat.unit || 'ea',
          material_unit_cost: couplingMat.price || 0,
          labor_hours: couplingMat.laborHours || 0,
          quantity_type: 'per_10_feet',
          description: 'Base Coupling',
          sequence: finalComponents.length + 1,
          isBaseCoupling: true // Flag to identify as base (not from fitting)
        });
      }
    }
    
    // STEP 5: Add straps if selected
    if (selectedStrapType && strapQtyPer10ft) {
      const strapMat = materials.find(m => m.id === selectedStrapType);
      if (strapMat) {
        console.log('✅ Adding strap to preview:', strapMat.name);
        finalComponents.push({
          material_id: strapMat.id,
          material_name: strapMat.name,
          quantity: parseFloat(strapQtyPer10ft),
          unit: strapMat.unit || 'ea',
          material_unit_cost: strapMat.price || 0,
          labor_hours: strapMat.laborHours || 0,
          quantity_type: 'per_10_feet',
          description: 'Strap',
          sequence: finalComponents.length + 1
        });
      }
    }
    
    // STEP 6: Add fittings if selected
    if (selectedFittings && selectedFittings.length > 0) {
      selectedFittings.forEach(fitting => {
        console.log('✅ Adding fitting to preview:', fitting.material_name);
        const fittingMat = materials.find(m => m.id === fitting.material_id);
        finalComponents.push({
          material_id: fitting.material_id,
          material_name: fitting.material_name,
          quantity: fitting.quantity,
          unit: 'ea',
          material_unit_cost: fittingMat?.price || 0,
          labor_hours: fittingMat?.laborHours || 0,
          quantity_type: 'fixed',
          description: 'Fitting',
          sequence: finalComponents.length + 1
        });
      });
    }
    
    // STEP 7: Add any additional manual components
    if (quickAssemblyComponents && quickAssemblyComponents.length > 0) {
      quickAssemblyComponents.forEach(comp => {
        console.log('✅ Adding manual component to preview:', comp.material_name);
        finalComponents.push({
          ...comp,
          sequence: finalComponents.length + 1
        });
      });
    }
    
    // If a base assembly was selected, load its components and merge with customizations
    if (selectedBaseAssembly) {
      console.log('🔧 Loading base assembly components for:', selectedBaseAssembly);
      
      try {
        // Load the base assembly's components from database
        const { data: baseComponents, error: baseError } = await supabase
          .from('assembly_components')
          .select('*')
          .eq('assembly_id', selectedBaseAssembly)
          .order('sequence');
        
        if (baseError) throw baseError;
        
        console.log('✅ Loaded', baseComponents?.length || 0, 'base components');
        
        // Add base components to the list (conduit, wire, etc.)
        if (baseComponents && baseComponents.length > 0) {
          baseComponents.forEach((comp, idx) => {
            finalComponents.push({
              material_id: comp.material_id,
              material_name: comp.material_name,
              quantity: comp.quantity,
              unit: comp.unit,
              material_unit_cost: comp.material_unit_cost || 0,
              labor_hours: comp.labor_hours || 0,
              quantity_type: comp.quantity_type || 'fixed',
              description: comp.description,
              sequence: finalComponents.length + idx + 1
            });
          });
        }
        
        // Now add the user's customized components (connectors, couplings, straps, fittings)
        if (selectedConnectorType && connectorQty) {
          const connectorMat = materials.find(m => m.id === selectedConnectorType);
          if (connectorMat) {
            finalComponents.push({
              material_id: connectorMat.id,
              material_name: connectorMat.name,
              quantity: parseFloat(connectorQty),
              unit: connectorMat.unit || 'ea',
              material_unit_cost: connectorMat.price || 0,
              labor_hours: connectorMat.laborHours || 0,
              quantity_type: 'fixed',
              description: 'Custom connector',
              sequence: finalComponents.length + 1
            });
          }
        }
        
        if (selectedCouplingType && couplingQtyPer10ft) {
          const couplingMat = materials.find(m => m.id === selectedCouplingType);
          if (couplingMat) {
            finalComponents.push({
              material_id: couplingMat.id,
              material_name: couplingMat.name,
              quantity: parseFloat(couplingQtyPer10ft),
              unit: couplingMat.unit || 'ea',
              material_unit_cost: couplingMat.price || 0,
              labor_hours: couplingMat.laborHours || 0,
              quantity_type: 'per_10_feet',
              description: 'Custom coupling',
              sequence: finalComponents.length + 1
            });
          }
        }
        
        if (selectedStrapType && strapQtyPer10ft) {
          const strapMat = materials.find(m => m.id === selectedStrapType);
          if (strapMat) {
            finalComponents.push({
              material_id: strapMat.id,
              material_name: strapMat.name,
              quantity: parseFloat(strapQtyPer10ft),
              unit: strapMat.unit || 'ea',
              material_unit_cost: strapMat.price || 0,
              labor_hours: strapMat.laborHours || 0,
              quantity_type: 'per_10_feet',
              description: 'Custom strap',
              sequence: finalComponents.length + 1
            });
          }
        }
        
        // Add fittings using the SELECTED MATERIAL IDs (no name searching!)
        const fittingsToAdd = [
          { qty: fitting90Qty, materialId: selected90Type, name: '90°', displayName: '90° Elbow' },
          { qty: fitting45Qty, materialId: selected45Type, name: '45°', displayName: '45° Elbow' },
          { qty: fittingLBQty, materialId: selectedLBType, name: 'LB', displayName: 'LB Fitting' },
          { qty: fittingLLQty, materialId: selectedLLType, name: 'LL', displayName: 'LL Fitting' },
          { qty: fittingLRQty, materialId: selectedLRType, name: 'LR', displayName: 'LR Fitting' }
        ];
        
        console.log('🔧 Adding fittings to preview using material IDs');
        console.log('Fittings input:', { fitting90Qty, fitting45Qty, fittingLBQty, fittingLLQty, fittingLRQty });
        console.log('Material IDs:', { selected90Type, selected45Type, selectedLBType, selectedLLType, selectedLRType });
        
        fittingsToAdd.forEach(fitting => {
          const qty = parseFloat(fitting.qty);
          console.log(`  Checking ${fitting.name}: qty="${fitting.qty}", parsed=${qty}, materialId="${fitting.materialId}"`);
          
          if (fitting.qty && qty > 0 && fitting.materialId) {
            console.log(`  ✓ Adding ${fitting.name} (${qty}) using material ID: ${fitting.materialId}`);
            
            // Get the material directly by ID - no searching needed!
            const fittingMat = materials.find(m => m.id === fitting.materialId);
            
            console.log(`  Found material: ${fittingMat ? fittingMat.name : 'NOT FOUND'}`);
            
            if (fittingMat) {
              finalComponents.push({
                material_id: fittingMat.id,
                material_name: fittingMat.name,
                quantity: qty,
                unit: fittingMat.unit || 'ea',
                material_unit_cost: fittingMat.price || 0,
                labor_hours: fittingMat.laborHours || 0,
                quantity_type: 'fixed',
                description: `${fitting.displayName}`,
                sequence: finalComponents.length + 1
              });
              console.log(`  ✅ Added ${fitting.name} to finalComponents (now ${finalComponents.length} total)`);
            } else {
              console.warn(`  ⚠️ Could not find material with ID: ${fitting.materialId}`);
            }
          } else if (fitting.qty && qty > 0 && !fitting.materialId) {
            console.warn(`  ⚠️ Quantity specified for ${fitting.name} but no material selected`);
          }
        });
        
        console.log('📦 Final components after adding fittings:', finalComponents.length);
        
        console.log('✅ Final components list:', finalComponents.length, 'components');
      } catch (err) {
        console.error('Error loading base assembly:', err);
        alert('Failed to load base assembly: ' + err.message);
        return;
      }
    }
    
    console.log('📦 Total components in preview:', finalComponents.length);
    
    // Validate that we have components
    if (finalComponents.length === 0) {
      alert('Please add at least one component to the assembly (conduit, wire, or accessories)');
      return;
    }
    
    // No auto-increment here - database handles it via auto_add_connector_id and auto_add_coupling_id
    console.log('📦 Skipping auto-increment - relying on database auto_add fields');
    
    // 🎯 APPLY ROUNDING to all components BEFORE showing preview
    if (pendingMeasurement) {
      const baseMeasurement = pendingMeasurement.realDistance || 0;
      const startDrop = parseFloat(startDropFootage) || 0;
      const endDrop = parseFloat(endDropFootage) || 0;
      const measurementLength = baseMeasurement + startDrop + endDrop;
      
      console.log('🔢 Applying rounding to preview components...');
      console.log('Measurement length:', measurementLength, 'ft');
      
      for (const comp of finalComponents) {
        // Calculate total quantity
        let totalQty = comp.quantity;
        
        if (comp.quantity_type === 'per_foot') {
          totalQty = comp.quantity * measurementLength;
        } else if (comp.quantity_type === 'per_10_feet') {
          totalQty = comp.quantity * (measurementLength / 10);
        } else if (comp.quantity_type === 'per_100_feet') {
          totalQty = comp.quantity * (measurementLength / 100);
        }
        
              // Apply rounding rules - CHECK FITTINGS FIRST!
              // CRITICAL: Check for null material_name first
              if (!comp.material_name) {
                comp.roundedQuantity = totalQty;
                console.log(`  📏 Component has no name: ${totalQty.toFixed(2)} (no rounding)`);
                continue;
              }
              
              const lowerName = comp.material_name.toLowerCase();
              
              // Fittings (90s, 45s, LBs, etc.): NO ROUNDING - use exact quantity
              if (lowerName.includes('90') || lowerName.includes('45') ||
                  lowerName.includes('elbow') || lowerName.includes('ell') ||
                  lowerName.match(/\b(lb|ll|lr)\b/i) || lowerName.includes('body') ||
                  lowerName.includes('fitting') || lowerName.includes('box') || 
                  lowerName.includes('bushing')) {
                comp.roundedQuantity = totalQty;
                console.log(`  📏 ${comp.material_name}: ${totalQty.toFixed(2)} (no rounding - fitting)`);
              }
              // Connectors, couplings, straps: round up to whole number
              else if (lowerName.includes('coupling') || lowerName.includes('connector') ||
                       lowerName.includes('strap') || lowerName.includes('clamp')) {
                comp.roundedQuantity = Math.ceil(totalQty);
                console.log(`  📏 ${comp.material_name}: ${totalQty.toFixed(2)} → ${comp.roundedQuantity} ea (rounded up to whole)`);
              }
              // Conduit: round up to nearest 10 feet (checked LAST to avoid matching fittings)
              else if ((lowerName.includes('emt') || lowerName.includes('conduit') || 
                       lowerName.includes('pvc') || lowerName.includes('rigid')) &&
                       !lowerName.includes('90') && !lowerName.includes('45') && 
                       !lowerName.includes('ell') && !lowerName.match(/\b(lb|ll|lr)\b/i)) {
                comp.roundedQuantity = Math.ceil(totalQty / 10) * 10;
                console.log(`  📏 ${comp.material_name}: ${totalQty.toFixed(2)} → ${comp.roundedQuantity} ft (rounded to nearest 10)`);
              } else {
                // Wire and other materials: no rounding, use exact quantity
                comp.roundedQuantity = totalQty;
                console.log(`  📏 ${comp.material_name}: ${totalQty.toFixed(2)} (no rounding)`);
              }
      }
    }
    
    // Store preview data and show preview modal
    // CRITICAL: Also store the user-selected connector/coupling IDs
    // so the system uses THOSE instead of the fitting's default auto_add IDs
    setPreviewAssemblyData({
      name: quickAssemblyName.trim(),
      components: quickAssemblyComponents,
      finalComponents: finalComponents,
      savePermanently: saveQuickAssemblyPermanently,
      baseAssemblyId: selectedBaseAssembly,
      userSelectedConnectorId: selectedConnectorType, // User's chosen connector ID
      userSelectedCouplingId: selectedCouplingType    // User's chosen coupling ID
    });
    setShowAssemblyPreviewModal(true);
  }
  
  // Actually save the assembly after user confirms preview
  async function confirmAndSaveAssembly() {
    if (!previewAssemblyData) return;
    
    const { name, components, finalComponents, savePermanently } = previewAssemblyData;
    
    try {
      let createdAssemblyId = null;
      
      if (savePermanently) {
        // PERMANENT: Save to assemblies table
        console.log('💾 Saving assembly permanently to database...');
        
        // Create the assembly
        const { data: assemblyData, error: assemblyError } = await supabase
          .from('assemblies')
          .insert([{
            company_id: user.id,
            name: name,
            description: `Created from takeoff measurement on ${new Date().toLocaleDateString()}`,
            category: 'ASSEMBLIES',
            unit: 'ea',
            is_custom: true,
            is_active: true
          }])
          .select()
          .single();
        
        if (assemblyError) throw assemblyError;
        
        createdAssemblyId = assemblyData.id;
        
        // Add components to the assembly
        const componentsToInsert = components.map((comp, idx) => ({
          assembly_id: assemblyData.id,
          material_id: comp.material_id,
          material_name: comp.material_name,
          quantity: comp.quantity,
          unit: comp.unit,
          material_unit_cost: comp.material_unit_cost,
          labor_hours: comp.labor_hours,
          quantity_type: comp.quantity_type || 'fixed',
          description: comp.description,
          sequence: idx + 1
        }));
        
        const { error: componentsError } = await supabase
          .from('assembly_components')
          .insert(componentsToInsert);
        
        if (componentsError) throw componentsError;
        
        // Add the assembly to the current measurement materials
        // CRITICAL: Use finalComponents, not components, to include user-added fittings!
        setMeasurementMaterials([...measurementMaterials, {
          material_id: assemblyData.id,
          material_name: assemblyData.name,
          quantity: 1,
          unit: 'ea',
          isAssembly: true,
          components: finalComponents
        }]);
        
        // Reload materials to include the new assembly
        await loadMaterials();
        
        alert('✅ Assembly created and saved permanently! It will be available for future projects.');
      } else {
        // TEMPORARY: Just use for this measurement, don't save to database
        console.log('📋 Creating temporary assembly (project-only)...');
        
        // Create a temporary ID for tracking (use timestamp + random)
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        createdAssemblyId = tempId;
        
        // Add the assembly directly to measurement materials with components embedded
        // CRITICAL: Use finalComponents, not components, to include user-added fittings!
        setMeasurementMaterials([...measurementMaterials, {
          material_id: tempId,
          material_name: name,
          quantity: 1,
          unit: 'ea',
          isAssembly: true,
          isTemporary: true, // Flag to indicate this is temporary
          components: finalComponents
        }]);
        
        console.log('✅ Temporary assembly created with components:', components);
        alert('✅ Assembly created for this measurement only!');
      }
      
      // Close modals and reset
      setShowAssemblyPreviewModal(false);
      setPreviewAssemblyData(null);
      setShowQuickAssemblyModal(false);
      setQuickAssemblyName('');
      setQuickAssemblyComponents([]);
      setSaveQuickAssemblyPermanently(false);
      setSelectedBaseAssembly(null);
      setSelectedConnectorType(null);
      setConnectorQty('');
      setSelectedCouplingType(null);
      setCouplingQtyPer10ft('');
                  setSelectedStrapType(null);
                  setStrapQtyPer10ft('');
                  setSelectedFittings([]);
      
      // CRITICAL: After creating assembly, show the appropriate modal to finalize save
      if (pendingMeasurement) {
        // LENGTH measurement mode
        console.log('🔔 Opening measurement modal after assembly creation (length)');
        setShowMeasurementModal(true);
      } else if (countMarkersRef.current.filter(m => !m.measurementId).length > 0) {
        // COUNT measurement mode - there are unsaved markers
        console.log('🔔 Opening count modal after assembly creation (count)');
        // Set the selected material to the assembly we just created
        setSelectedMaterialId(createdAssemblyId);
        setShowCountModal(true);
      }
    } catch (err) {
      console.error('Error creating quick assembly:', err);
      alert('Failed to create assembly: ' + err.message);
    }
  }

  async function saveMeasurementWithLabel(additionalMaterials = [], overrideMaterials = null) {
    console.log('🔵 saveMeasurementWithLabel called');
    console.log('pendingMeasurement:', pendingMeasurement);
    console.log('measurementMaterials:', measurementMaterials);
    console.log('additionalMaterials:', additionalMaterials);
    console.log('overrideMaterials:', overrideMaterials);
    console.log('showNewMeasurementPreview:', showNewMeasurementPreview);
    
    if (!pendingMeasurement) {
      console.error('❌ No pending measurement!');
      return;
    }

    // Use override materials if provided, otherwise combine state materials with additional
    let allMaterials = overrideMaterials || [...measurementMaterials, ...additionalMaterials];
    console.log('allMaterials combined:', allMaterials);
    
    // Check if any materials are assemblies with qty=0 components
    // We need to load assembly components to check for parametric quantities
    // BUT skip this if we're coming FROM the parametric modal (overrideMaterials is set)
    // OR if we're already in preview mode (showNewMeasurementPreview is true)
    if (!showParametricModal && additionalMaterials.length === 0 && !overrideMaterials && !showNewMeasurementPreview) {
      for (let i = 0; i < allMaterials.length; i++) {
        const mat = allMaterials[i];
        const material = materials.find(m => m.id === mat.material_id);
        
        // Check if this is an assembly (unit === 'assembly')
        if (material && material.unit === 'assembly') {
          console.log('🔍 Found assembly:', material.name, 'ID:', material.id);
          
          // Load assembly components
          try {
        const { data: components, error } = await supabase
          .from('assembly_components')
          .select('*')
          .eq('assembly_id', material.id)
          .order('sequence');
            
            if (error) {
              console.error('Error loading assembly components:', error);
              continue;
            }
            
            console.log('Assembly components:', components);
            
            // CRITICAL: Attach components to the material in allMaterials
            allMaterials[i].components = components || [];
            allMaterials[i].isAssembly = true;
            
            // Also update in measurementMaterials state
            const updatedMaterials = [...measurementMaterials];
            const matIndex = updatedMaterials.findIndex(m => m.material_id === mat.material_id);
            if (matIndex >= 0) {
              updatedMaterials[matIndex].components = components || [];
              updatedMaterials[matIndex].isAssembly = true;
              setMeasurementMaterials(updatedMaterials);
            }
            
            // Check if any components have qty=0 AND need user input
            // CRITICAL: Components with qty=0 but quantity_type='per_foot', 'per_10_feet', etc. 
            // should be calculated automatically, NOT treated as parametric
            
            console.log('🔍 CHECKING FOR PARAMETRIC COMPONENTS:');
            console.log('Total components:', (components || []).length);
            
            const zeroQtyComponents = (components || []).filter(c => c.quantity === 0);
            console.log('Components with qty=0:', zeroQtyComponents.length);
            zeroQtyComponents.forEach((c, idx) => {
              console.log(`  Component ${idx + 1}:`, {
                name: c.material_name,
                quantity: c.quantity,
                quantity_type: c.quantity_type,
                description: c.description
              });
            });
            
            // CRITICAL FIX: Filter out broken/empty components FIRST
            const validComponents = (components || []).filter(c => {
              // Skip components with no material_id or material_name (broken data)
              if (!c.material_id || !c.material_name) {
                console.log(`  ⚠️ Skipping broken component: material_id=${c.material_id}, material_name=${c.material_name}`);
                return false;
              }
              return true;
            });
            
            console.log(`Valid components after filtering: ${validComponents.length}`);
            
            // CRITICAL CHECK: If ALL components were filtered out (broken data), offer to remove this material
            if (validComponents.length === 0 && (components || []).length > 0) {
              const shouldRemove = confirm(
                `⚠️ ERROR: The assembly "${material.name}" contains broken/invalid data.\n\n` +
                `All ${(components || []).length} component(s) are missing material IDs or names.\n\n` +
                `This assembly cannot be exported.\n\n` +
                `Would you like to REMOVE this assembly from your measurement materials and continue?\n\n` +
                `(Click OK to remove and continue, Cancel to stop)`
              );
              
              if (shouldRemove) {
                // Remove this broken assembly from allMaterials and continue
                console.log(`🗑️ Removing broken assembly "${material.name}" from materials list`);
                allMaterials = allMaterials.filter((_, idx) => idx !== i);
                console.log(`✅ Continuing with ${allMaterials.length} remaining materials`);
                i--; // Adjust index since we removed an item
                continue; // Skip this assembly and continue with the rest
              } else {
                // User chose to stop
                console.log('❌ User cancelled due to broken assembly data');
                return; // Stop processing
              }
            }
            
            // Then check for parametric components (qty=0 with no calculation type)
            const trulyParametricComponents = validComponents.filter(c => {
              // If qty > 0, not parametric
              if (c.quantity > 0) {
                return false;
              }
              
              // If qty = 0 BUT has a calculation type, it will auto-calculate
              if (c.quantity_type && c.quantity_type !== 'fixed') {
                console.log(`  ✓ ${c.material_name}: qty=0 with type "${c.quantity_type}" - will auto-calculate`);
                return false;
              }
              
              // If qty = 0 AND (no type OR type is 'fixed'), needs user input
              console.log(`  ⚠️ ${c.material_name}: qty=0 with type "${c.quantity_type || 'none'}" - NEEDS USER INPUT`);
              return true;
            });
            
            console.log('Truly parametric components (need user input):', trulyParametricComponents.length);
            
            if (trulyParametricComponents.length > 0) {
              console.log('🎯 Found', trulyParametricComponents.length, 'truly parametric components - showing modal');
              
              // Set up parametric modal state
              setParametricComponents(trulyParametricComponents);
              setParametricAssemblyId(material.id);
              setParametricQuantities({}); // Reset quantities
              setShowParametricModal(true);
              return; // Stop and show modal
            }
          } catch (err) {
            console.error('Error checking assembly components:', err);
          }
        }
      }
    }

    // 🎯 ROUNDING ONLY (NO auto-increment - database handles it)
    if (!showNewMeasurementPreview && additionalMaterials.length === 0) {
      console.log('📏 Applying rounding to components (database handles auto-increment)...');
      
      for (const mat of allMaterials) {
        if (mat.isAssembly && mat.components && mat.components.length > 0) {
          const baseMeasurement = pendingMeasurement?.realDistance || 0;
          const startDrop = parseFloat(startDropFootage) || 0;
          const endDrop = parseFloat(endDropFootage) || 0;
          const measurementLength = baseMeasurement + startDrop + endDrop;
          
          for (const comp of mat.components) {
            let totalQty = comp.quantity;
            
            if (comp.quantity_type === 'per_foot') {
              totalQty = comp.quantity * measurementLength;
            } else if (comp.quantity_type === 'per_10_feet') {
              totalQty = comp.quantity * (measurementLength / 10);
            } else if (comp.quantity_type === 'per_100_feet') {
              totalQty = comp.quantity * (measurementLength / 100);
            }
            
            // Apply rounding rules - check for null first
            if (!comp.material_name) {
              comp.roundedQuantity = totalQty;
              continue;
            }
            
            const lowerName = comp.material_name.toLowerCase();
            
            if (lowerName.includes('coupling') || lowerName.includes('connector') ||
                lowerName.includes('strap') || lowerName.includes('clamp')) {
              comp.roundedQuantity = Math.ceil(totalQty);
            } else if (lowerName.includes('emt') || lowerName.includes('conduit') || 
                       lowerName.includes('pvc') || lowerName.includes('rigid')) {
              comp.roundedQuantity = Math.ceil(totalQty / 10) * 10;
            } else {
              comp.roundedQuantity = totalQty;
            }
          }
        }
      }
      
      setMeasurementMaterials(allMaterials);
      setShowNewMeasurementPreview(true);
      return;
    }

    // If we reach here, user has confirmed - proceed with save
    console.log('💾 User confirmed - proceeding with save...');
    const { segments, points, pixelDistance, realDistance } = pendingMeasurement;
    const label = measurementLabel.trim();
    // Use the selected color instead of layer color
    const measurementColor = selectedColorRef.current;
    
    // Calculate total distance including drops
    const startDrop = parseFloat(startDropFootage) || 0;
    const endDrop = parseFloat(endDropFootage) || 0;
    const totalDistance = realDistance + startDrop + endDrop;
    
    console.log(`Total distance: ${realDistance}ft + ${startDrop}ft (start) + ${endDrop}ft (end) = ${totalDistance}ft`);

    // Use current canvas state instead of stored reference
    const currentCanvas = canvas;
    console.log('currentCanvas:', currentCanvas);
    if (!currentCanvas) {
      console.error('❌ Canvas is null, cannot save measurement');
      alert('Failed to save measurement: Canvas not available');
      return;
    }

    try {
      // Calculate PDF-relative coordinates for all points
      const currentOffset = pdfPanOffsetRef.current;
      const currentZoom = pdfZoomRef.current;
      
      const pdfRelativePoints = points.map(p => ({
        x: (p.x - currentOffset.x) / currentZoom,
        y: (p.y - currentOffset.y) / currentZoom,
      }));
      
      // Prepare materials array for storage (use allMaterials which includes fittings)
      // CRITICAL: For assemblies, also store the components AND NAME so they're preserved
      const materialsToStore = allMaterials.map(m => {
        const materialData = {
          material_id: m.material_id,
          material_name: m.material_name, // CRITICAL: Store name for project-specific assemblies
          quantity: m.quantity,
          unit: m.unit,
          isAssembly: m.isAssembly || false
        };
        
        // If this is an assembly with components, store them too
        if (m.isAssembly && m.components && m.components.length > 0) {
          materialData.components = m.components;
        }
        
        return materialData;
      });
      
      // Store as polyline (array of points)
      const { data, error } = await supabase
        .from('plan_measurements')
        .insert([{
          plan_id: planId,
          page_number: currentPageRef.current,
          measurement_type: 'length',
          geometry: { points: pdfRelativePoints }, // Store all points
          raw_value: pixelDistance,
          calculated_value: totalDistance, // Use total distance including drops
          unit: 'feet',
          label: label || null,
          layer_id: activeLayerRef.current,
          color: measurementColor,
          materials: materialsToStore, // Store materials array
          company_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // KEEP all segments on canvas and tag them with measurement info
      // Keep the user's selected color - don't overwrite it!
      segments.forEach(segment => {
        segment.set({
          measurementId: data.id,
          layerId: activeLayerRef.current,
          stroke: measurementColor,
          selectable: false,
          // baseCoords already set during drawing - don't overwrite!
        });
      });
      currentCanvas.renderAll();
      
      // Reload measurements list
      loadMeasurements();
      
      // Reset modal and polyline state AND MATERIALS LIST
      setShowMeasurementModal(false);
      setMeasurementLabel('');
      setPendingMeasurement(null);
      setShowNewMeasurementPreview(false); // Reset preview state
      polylinePointsRef.current = [];
      setPolylinePoints([]);
      polylineSegmentsRef.current = [];
      setPolylineSegments([]);
      setAccumulatedDistance(0);
      setMeasurementMaterials([]); // RESET MATERIALS LIST
      setStartDropFootage(''); // RESET DROP FOOTAGE
      setEndDropFootage(''); // RESET DROP FOOTAGE
      
      console.log('✅ Polyline measurement saved with', points.length, 'points!');
    } catch (err) {
      console.error('Error saving measurement:', err);
      alert('Failed to save measurement: ' + err.message);
      // Clean up segments on error
      if (currentCanvas) {
        segments.forEach(seg => currentCanvas.remove(seg));
        currentCanvas.renderAll();
      }
    }
  }

  // Step 3: Edit handler function for count measurements
  async function editCountMeasurement(measurementId) {
    console.log('Editing count measurement:', measurementId);
    
    // Find the measurement
    const measurement = measurements.find(m => m.id === measurementId);
    if (!measurement || measurement.measurement_type !== 'count') {
      console.error('Not a count measurement');
      return;
    }
    
    // Set editing mode
    setEditingMeasurementId(measurementId);
    setActiveTool('count');
    setSelectedColor(measurement.color || '#FF6B00');
    
    console.log(`✏️ Editing mode activated for measurement ${measurementId}`);
    console.log(`Current markers for this measurement:`, 
      countMarkersRef.current.filter(m => m.measurementId === measurementId).length);
  }

  // Open Edit Details Modal for count measurements
  async function openEditDetailsModal(measurementId) {
    const measurement = measurements.find(m => m.id === measurementId);
    if (!measurement || measurement.measurement_type !== 'count') {
      console.error('Not a count measurement');
      return;
    }
    
    console.log('🔍 Opening edit details modal for count measurement:', measurementId);
    console.log('📦 Material ID:', measurement.material_id);
    console.log('📦 Materials array length:', materials.length);
    
    // CRITICAL: Check if material is an assembly FIRST
    if (measurement.material_id) {
      const material = materials.find(m => m.id === measurement.material_id);
      console.log('📦 Found material:', material ? 'YES' : 'NO');
      if (material) {
        console.log('📦 Material name:', material.name);
        console.log('📦 Material unit:', material.unit);
        console.log('📦 Material category:', material.category);
      }
      
      // Check if this is an assembly
      if (material && material.unit === 'assembly') {
        console.log('✅✅✅ ASSEMBLY DETECTED! Loading components...');
        
        // Load components
        const { data: components, error } = await supabase
          .from('assembly_components')
          .select('*')
          .eq('assembly_id', material.id)
          .order('sequence');
        
        console.log('📦 Components query - error:', error, 'data:', components);
        
        if (error) {
          console.error('❌ Database error:', error);
          alert('Error loading assembly: ' + error.message);
          return;
        }
        
        console.log('✅ Loaded', components?.length || 0, 'components');
        
        // Show assembly modal
        setEditLengthMaterials([{
          material_id: material.id,
          material_name: material.name,
          quantity: measurement.calculated_value,
          unit: material.unit,
          isAssembly: true,
          components: components || []
        }]);
        setEditingLengthId(measurementId);
        setShowEditLengthModal(true);
        
        console.log('✅✅✅ ASSEMBLY MODAL OPENED - EXITING FUNCTION');
        return; // STOP HERE
      }
      
      // Not an assembly - continue with simple modal
      console.log('📝 Not an assembly - showing simple modal');
      setSelectedCategory(material.category || '');
    }
    
    // Show simple modal
    setMeasurementLabel(measurement.label || '');
    setSelectedMaterialId(measurement.material_id || null);
    setEditingDetailsId(measurementId);
    setShowEditDetailsModal(true);
  }
  
  // Open Edit Length Modal for length measurements
  async function openEditLengthModal(measurementId) {
    const measurement = measurements.find(m => m.id === measurementId);
    if (!measurement || measurement.measurement_type !== 'length') {
      console.error('Not a length measurement');
      return;
    }
    
    console.log('🔍 Opening edit length modal for measurement:', measurementId);
    console.log('📦 Measurement materials from database:', measurement.materials);
    console.log('📦 Number of materials:', measurement.materials?.length || 0);
    
    // Load current materials from the measurement
    const currentMaterials = measurement.materials || [];
    
    // Check if ALL materials are broken (no material_id or material_name)
    const allBroken = currentMaterials.length > 0 && currentMaterials.every(mat => 
      !mat.material_id || !mat.material_name
    );
    
    if (allBroken) {
      const shouldDelete = confirm(
        '⚠️ ERROR: This measurement contains broken/invalid data.\n\n' +
        'All components are missing material IDs or names.\n\n' +
        'This was likely caused by an error during creation.\n\n' +
        'Would you like to DELETE this measurement?\n\n' +
        '(Click OK to delete, Cancel to keep it)'
      );
      
      if (shouldDelete) {
        await deleteMeasurement(measurementId);
        alert('✅ Broken measurement deleted. Please create a new one.');
      }
      return;
    }
    
    const materialsWithDetails = [];
    
    console.log('🔄 Starting to process materials...');
    for (let i = 0; i < currentMaterials.length; i++) {
      const mat = currentMaterials[i];
      console.log(`\n📋 Processing material ${i + 1}/${currentMaterials.length}:`);
      console.log('  Material ID:', mat.material_id);
      console.log('  Quantity:', mat.quantity);
      
      const material = materials.find(m => m.id === mat.material_id);
      console.log('  Found in materials list:', !!material);
      console.log('  Material name from DB:', material?.name);
      console.log('  Material name STORED with measurement:', mat.material_name);
      console.log('  Material unit:', material?.unit || mat.unit);
      console.log('  Material category:', material?.category);
      
      const materialData = {
        material_id: mat.material_id,
        material_name: mat.material_name || material?.name || 'Unknown Material', // CRITICAL: Use stored name first!
        quantity: mat.quantity,
        unit: mat.unit || material?.unit || 'ea', // CRITICAL: Use stored unit first!
        // CRITICAL: Check if components exist to detect assemblies (for backwards compatibility with old data)
        isAssembly: mat.isAssembly || material?.unit === 'assembly' || (mat.components && mat.components.length > 0),
        components: []
      };
      
      console.log('  Is assembly?', materialData.isAssembly);
      
      // If this is an assembly, check if components were saved with the measurement
      if (materialData.isAssembly) {
        console.log('  🔧 Loading components for assembly:', mat.material_id);
        console.log('  📦 mat.components from database:', mat.components);
        console.log('  📦 Is array?', Array.isArray(mat.components));
        console.log('  📦 Length:', mat.components?.length);
        
        // CRITICAL FIX: Use STORED components from measurement if available
        // These contain the user's parametric quantities!
        if (mat.components && Array.isArray(mat.components) && mat.components.length > 0) {
          console.log('  ✅ Using STORED components from measurement (includes parametric quantities)');
          materialData.components = mat.components;
          
          // Log each component for debugging
          mat.components.forEach((comp, idx) => {
            console.log(`    Component ${idx + 1}: ${comp.material_name}`);
            console.log(`      - quantity: ${comp.quantity}`);
            console.log(`      - material_id: ${comp.material_id}`);
            console.log(`      - auto_add_coupling_id: ${comp.auto_add_coupling_id || 'NOT SET'}`);
            console.log(`      - auto_add_connector_id: ${comp.auto_add_connector_id || 'NOT SET'}`);
          });
        } else {
          // Fallback: Load from assembly_components table if not stored
          console.log('  🔄 No stored components - loading from assembly_components table...');
          try {
            const { data: components, error } = await supabase
              .from('assembly_components')
              .select('*')
              .eq('assembly_id', mat.material_id)
              .order('sequence');
            
            if (error) {
              console.error('  ❌ Error loading components:', error);
              materialData.components = [];
            } else {
              console.log('  ✅ Loaded', components?.length || 0, 'components from table');
              materialData.components = components || [];
            }
          } catch (err) {
            console.error('  ❌ Exception loading assembly components:', err);
            materialData.components = [];
          }
        }
      }
      
      materialsWithDetails.push(materialData);
    }
    
    console.log('📦 Final materials with details:', materialsWithDetails);
    setEditLengthMaterials(materialsWithDetails);
    setEditingLengthId(measurementId);
    setShowEditLengthModal(true);
  }
  
  // Save edited length measurement materials  
  async function saveEditedLengthMaterials(additionalMaterials = []) {
    if (!editingLengthId) return;
    
    // Combine existing materials with any additional materials (fittings)
    let allMaterials = [...editLengthMaterials, ...additionalMaterials];
    
    // 🎯 SMART AUTO-INCREMENT: Find couplings/connectors in assembly by name and increment
    console.log('\n🔍 Starting smart auto-increment of couplings/connectors...');
    
    // Calculate how many couplings and connectors we need to add based on fittings
    let totalCouplingsNeeded = 0;
    let totalConnectorsNeeded = 0;
    
    for (const mat of allMaterials) {
      // Check if this is an assembly - look at components
      if (mat.isAssembly && mat.components && mat.components.length > 0) {
        console.log(`🔍 Checking ${mat.components.length} components in "${mat.material_name}"`);
        
        for (const comp of mat.components) {
          if (comp.quantity > 0) {
            const lowerName = comp.material_name.toLowerCase();
            
            // Elbows and 45s need couplings (1 per fitting)
            if (lowerName.includes('90') || lowerName.includes('45') || lowerName.includes('ell')) {
              totalCouplingsNeeded += comp.quantity;
              console.log(`  ✅ ${comp.material_name} (qty=${comp.quantity}) → needs ${comp.quantity} coupling(s)`);
            }
            
            // Bodies need connectors (2 per body)
            if (lowerName.includes('body')) {
              totalConnectorsNeeded += comp.quantity * 2;
              console.log(`  ✅ ${comp.material_name} (qty=${comp.quantity}) → needs ${comp.quantity * 2} connector(s)`);
            }
          }
        }
        
        // Add NEW FIXED components for auto-calculated couplings (don't modify base components)
        if (totalCouplingsNeeded > 0) {
          const couplingComp = mat.components.find(c => 
            c.material_name.toLowerCase().includes('coupling') && 
            !c.material_name.toLowerCase().includes('connector')
          );
          
          if (couplingComp) {
            console.log(`  ➕ Adding ${totalCouplingsNeeded} FIXED coupling(s) based on fittings (EDIT MODE)`);
            // Add a NEW fixed component for the auto-calculated quantity
            mat.components.push({
              ...couplingComp,
              quantity: totalCouplingsNeeded,
              quantity_type: 'fixed',
              description: `Auto-added (${totalCouplingsNeeded} from fittings)`,
              sequence: mat.components.length + 1
            });
          } else {
            console.warn(`  ⚠️ No coupling component found in assembly - cannot auto-add`);
          }
        }
        
        if (totalConnectorsNeeded > 0) {
          const connectorComp = mat.components.find(c => 
            c.material_name.toLowerCase().includes('connector')
          );
          
          if (connectorComp) {
            console.log(`  ➕ Adding ${totalConnectorsNeeded} FIXED connector(s) based on bodies (EDIT MODE)`);
            // Add a NEW fixed component for the auto-calculated quantity
            mat.components.push({
              ...connectorComp,
              quantity: totalConnectorsNeeded,
              quantity_type: 'fixed',
              description: `Auto-added (${totalConnectorsNeeded} from bodies)`,
              sequence: mat.components.length + 1
            });
          } else {
            console.warn(`  ⚠️ No connector component found in assembly - cannot auto-add`);
          }
        }
      }
    }
    
    console.log('📦 Final materials list with auto-incremented items:', allMaterials);
    
    // 🎯 UPDATE THE MODAL STATE FIRST - Show user the preview before saving
    console.log('📊 Updating modal to show preview of changes...');
    setEditLengthMaterials(allMaterials);
    setShowPreview(true);
    console.log('✅ Preview mode activated - button will change to green "Confirm & Save"');
  }
  
  // New function to actually save after preview
  async function confirmSaveEditedLengthMaterials() {
    if (!editingLengthId) return;
    
    try {
      // Prepare materials array for storage
      // CRITICAL: Also store components for assemblies!
      const materialsToStore = editLengthMaterials.map(m => {
        const materialData = {
          material_id: m.material_id,
          quantity: m.quantity
        };
        
        // If this is an assembly with components, store them too
        if (m.isAssembly && m.components && m.components.length > 0) {
          materialData.components = m.components;
          console.log(`💾 Saving assembly ${m.material_name} with ${m.components.length} components:`, m.components);
        }
        
        return materialData;
      });
      
      console.log('💾 Final materialsToStore array:', materialsToStore);
      
      const { error } = await supabase
        .from('plan_measurements')
        .update({
          materials: materialsToStore
        })
        .eq('id', editingLengthId);
      
      if (error) throw error;
      
      // Mark layer as needing export since we modified measurements
      const measurement = measurements.find(m => m.id === editingLengthId);
      if (measurement?.layer_id) {
        await supabase
          .from('measurement_layers')
          .update({ needs_export: true })
          .eq('id', measurement.layer_id);
      }
      
      // Reload measurements list and layers
      await loadMeasurements();
      await loadLayers();
      
      // Close modal and reset state
      setShowEditLengthModal(false);
      setEditingLengthId(null);
      setEditLengthMaterials([]);
      setTempMaterialId(null);
      setTempMaterialCategory('');
      setTempMaterialQuantity('');
      
      console.log('✅ Length measurement materials saved to database!');
      alert('✅ Changes saved successfully!');
    } catch (err) {
      console.error('Error updating length measurement materials:', err);
      alert('Failed to update materials: ' + err.message);
    }
  }

  // Save edited details (label and material only - no markers)
  async function saveEditedDetails() {
    if (!editingDetailsId) return;
    
    try {
      const { error } = await supabase
        .from('plan_measurements')
        .update({
          label: measurementLabel.trim() || null,
          material_id: selectedMaterialId || null,
        })
        .eq('id', editingDetailsId);
      
      if (error) throw error;
      
      // Mark layer as needing export since we modified measurements
      const measurement = measurements.find(m => m.id === editingDetailsId);
      if (measurement?.layer_id) {
        await supabase
          .from('measurement_layers')
          .update({ needs_export: true })
          .eq('id', measurement.layer_id);
      }
      
      // Reload measurements list and layers
      await loadMeasurements();
      await loadLayers();
      
      // Close modal and reset state
      setShowEditDetailsModal(false);
      setEditingDetailsId(null);
      setMeasurementLabel('');
      setSelectedMaterialId(null);
      setSelectedCategory('');
      
      console.log('✅ Measurement details updated!');
    } catch (err) {
      console.error('Error updating measurement details:', err);
      alert('Failed to update measurement details: ' + err.message);
    }
  }

  async function saveCount(materialIdOverride = null) {
    const effectiveMaterialId = materialIdOverride || selectedMaterialId;
    const isEditing = editingMeasurementIdRef.current !== null;
    
    if (isEditing) {
      // Step 5: UPDATE mode - update existing measurement
      try {
        const allMarkersForMeasurement = countMarkersRef.current.filter(
          m => m.measurementId === editingMeasurementIdRef.current || !m.measurementId
        );
        
        console.log('=== UPDATING COUNT ===');
        console.log('Measurement ID:', editingMeasurementIdRef.current);
        console.log('Total markers to save:', allMarkersForMeasurement.length);
        console.log('Effective material ID:', effectiveMaterialId);
        
        const pdfRelativeMarkers = allMarkersForMeasurement.map(m => ({
          x: m.baseX,
          y: m.baseY
        }));
        
        const { error } = await supabase
          .from('plan_measurements')
          .update({
            geometry: { markers: pdfRelativeMarkers },
            raw_value: pdfRelativeMarkers.length,
            calculated_value: pdfRelativeMarkers.length,
            material_id: effectiveMaterialId,
          })
          .eq('id', editingMeasurementIdRef.current);
        
        if (error) throw error;
        
        // Update marker tracking - tag all new markers with the measurement ID
        allMarkersForMeasurement.forEach(m => {
          if (!m.measurementId) {
            m.measurementId = editingMeasurementIdRef.current;
            m.saved = true;
          }
        });
        
        // Mark layer as needing export since we modified measurements
        await supabase
          .from('measurement_layers')
          .update({ needs_export: true })
          .eq('id', activeLayerRef.current);
        
        // Clear editing mode
        setEditingMeasurementId(null);
        setActiveTool(null);
        
        // Reload measurements list and layers
        await loadMeasurements();
        await loadLayers();
        
        console.log('✅ Count measurement updated!');
      } catch (err) {
        console.error('Error updating count:', err);
        alert('Failed to update count: ' + err.message);
      }
    } else {
      // CREATE mode - existing code
      const unsavedMarkers = countMarkersRef.current.filter(m => !m.measurementId);
      
      console.log('=== SAVING COUNT ===');
      console.log('Total markers in array:', countMarkersRef.current.length);
      console.log('Unsaved markers to save:', unsavedMarkers.length);
      console.log('Already saved markers:', countMarkersRef.current.filter(m => m.measurementId).length);
      
      if (unsavedMarkers.length === 0) {
        alert('No new markers to save!');
        return;
      }

      const label = measurementLabel.trim();
      const count = unsavedMarkers.length;
      // Use the selected color from the color picker
      const markerColor = selectedColorRef.current;

      try {
        // Use the base coordinates directly - they're already correct
        const pdfRelativeMarkers = unsavedMarkers.map((m, idx) => {
          console.log(`Marker ${idx}: screen=(${m.x.toFixed(2)}, ${m.y.toFixed(2)}), base=(${m.baseX.toFixed(2)}, ${m.baseY.toFixed(2)})`);
          return {
            x: m.baseX,
            y: m.baseY
          };
        });
        
        console.log('Saving', unsavedMarkers.length, 'markers to database:', pdfRelativeMarkers);
        
        const { data, error} = await supabase
          .from('plan_measurements')
          .insert([{
            plan_id: planId,
            page_number: currentPageRef.current,
            measurement_type: 'count',
            geometry: {
              markers: pdfRelativeMarkers
            },
            raw_value: count,
            calculated_value: count,
            unit: 'items',
            label: label || null,
            layer_id: activeLayerRef.current,
            color: markerColor,
            material_id: effectiveMaterialId,
            company_id: user.id,
          }])
          .select()
          .single();

        if (error) throw error;

        // KEEP markers on canvas and tag them with measurement info
        // Only update the UNSAVED markers
        unsavedMarkers.forEach((m, index) => {
          m.marker.set({
            measurementId: data.id,
            layerId: activeLayerRef.current,
            fill: markerColor,
            opacity: 0.6,
            selectable: false
          });
          m.saved = true;
          m.measurementId = data.id;
          // Update to PDF-relative base coordinates
          m.baseX = pdfRelativeMarkers[index].x;
          m.baseY = pdfRelativeMarkers[index].y;
        });
        
        if (canvas) {
          canvas.renderAll();
        }
        
        // Mark layer as needing export since we added new measurements
        await supabase
          .from('measurement_layers')
          .update({ needs_export: true })
          .eq('id', activeLayerRef.current);
        
        // Reload measurements list and layers
        loadMeasurements();
        loadLayers();
        
        // Reset modal state
        setShowCountModal(false);
        setMeasurementLabel('');
        setSelectedMaterialId(null);
        setSelectedCategory('');
        
        // Update the count markers state to reflect all markers (now all saved)
        setCountMarkers(countMarkersRef.current);
        
        console.log('✅ Count saved - markers kept on canvas and tracking array!');
      } catch (err) {
        console.error('Error saving count:', err);
        alert('Failed to save count: ' + err.message);
      }
    }
  }

  function handleToolSelect(tool) {
    console.log('🔧 Tool selected:', tool);
    console.log('Current active layer:', activeLayer);
    console.log('Layers available:', layers);
    
    if (tool === 'calibrate') {
      setShowCalibrationModal(true);
      return;
    }
    
    if (!isCalibrated) {
      alert('⚠️ Please calibrate the plan first by setting the scale.');
      return;
    }
    
    if (!activeLayer) {
      alert('⚠️ Please select or create a layer first.');
      return;
    }
    
    // Don't toggle off - just set the tool (or set to null if clicking the same tool again)
    const newTool = activeTool === tool ? null : tool;
    setActiveTool(newTool);
    console.log('Active tool set to:', newTool);
  }
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
      page_number: currentPageRef.current,
      pixels_per_foot_at_100: pixels_per_foot_at_100,
      calibration_zoom_level: 1.0, // Always 1.0 for auto-calibration
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
    
    console.log('✅ Auto-calibration saved!');
    alert('✅ Plan calibrated successfully!');
  } catch (err) {
    console.error('Error saving auto-calibration:', err);
    alert('Failed to save calibration: ' + err.message);
  }
}
  async function saveCalibration() {
    try {
      if (!calibrationLine || !calibrationDistance) {
        alert('Please draw a calibration line and enter a distance');
        return;
      }
      
      const realDistance = parseFloat(calibrationDistance);
      if (realDistance <= 0) {
        alert('Distance must be greater than 0');
        return;
      }
      
      // Calculate pixels_per_foot_at_100 zoom
      // Formula: pixels_per_foot_at_100 = (pixelDistance / zoom) / realDistance
      const { pixelDistance, zoom } = calibrationLine;
      const pixels_per_foot_at_100 = (pixelDistance / zoom) / realDistance;
      
      console.log('Calibration calculation:');
      console.log('- Pixel distance:', pixelDistance);
      console.log('- Zoom when measured:', zoom);
      console.log('- Real distance (feet):', realDistance);
      console.log('- Calculated pixels_per_foot_at_100:', pixels_per_foot_at_100);
      
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
      
      // Remove calibration line from canvas
      if (calibrationLine && calibrationLine.line && canvas) {
        canvas.remove(calibrationLine.line);
        canvas.renderAll();
      }
      
      // Update state
      setIsCalibrated(true);
      setCalibrationData(data);
      setCalibrationMode(false);
      setShowCalibrationModal(false);
      setCalibrationLine(null);
      setCalibrationDistance('');
      
      console.log('✅ Calibration saved! You can now use measurement tools.');
    } catch (err) {
      console.error('Error saving calibration:', err);
      alert('Failed to save calibration: ' + err.message);
    }
  }

  async function exportLayerToEstimate(layer, selectedEstimateId = null) {
    try {
      console.log('Exporting layer to estimate:', layer);
      
      // Get all measurements for this layer (count OR length with materials)
      const layerMeasurements = measurements.filter(m => {
        if (m.layer_id !== layer.id) return false;
        
        // Include count measurements with linked materials OR labels
        if (m.measurement_type === 'count' && (m.material_id || m.label)) return true;
        
        // Include length measurements with materials array
        if (m.measurement_type === 'length' && m.materials && m.materials.length > 0) return true;
        
        return false;
      });
      
      if (layerMeasurements.length === 0) {
        alert('No measurements with materials found on this layer to export.');
        return;
      }
      
      console.log(`Found ${layerMeasurements.length} measurements to export`);
      
      // Get the project name
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
      
      if (projectError) {
        console.error('Project error:', projectError);
        throw new Error('Project error: ' + projectError.message);
      }
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Find ALL estimates for this project
      let estimate;
      const { data: allEstimates, error: estimateError } = await supabase
        .from('estimates')
        .select('id, project_name, status, created_at')
        .eq('project_name', project.name)
        .order('created_at', { ascending: false });
      
      if (estimateError) {
        console.error('Estimate error:', estimateError);
        throw new Error('Estimate error: ' + estimateError.message);
      }
      
      if (!allEstimates || allEstimates.length === 0) {
        // Create a new estimate automatically
        console.log('No estimate found - creating one automatically');
        const { data: newEstimate, error: createError } = await supabase
          .from('estimates')
          .insert([{
            project_name: project.name,
            company_id: user.id,
            status: 'draft',
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating estimate:', createError);
          throw new Error('Failed to create estimate: ' + createError.message);
        }
        
        estimate = newEstimate;
        console.log('✅ Created new estimate:', estimate.id);
      } else if (allEstimates.length === 1) {
        // Only one estimate - use it directly
        estimate = allEstimates[0];
        console.log('✅ Found single estimate:', estimate.id);
      } else if (selectedEstimateId) {
        // User already chose an estimate from the selection modal
        estimate = allEstimates.find(e => e.id === selectedEstimateId);
        if (!estimate) {
          throw new Error('Selected estimate not found');
        }
        console.log('✅ Using user-selected estimate:', estimate.id);
      } else {
        // MULTIPLE estimates found - let user choose!
        console.log(`📋 Found ${allEstimates.length} estimates for project "${project.name}" - showing selection modal`);
        setExistingEstimates(allEstimates);
        setPendingExportLayer(layer);
        setShowEstimateSelectionModal(true);
        return; // Stop here - user will select which estimate, then we'll be called again with selectedEstimateId
      }
      
      const estimateId = estimate.id;
      
      // Determine the section name (lowercase, matching estimate page structure)
      // Map layer section_name to estimate section names
      const sectionMap = {
        'Fixtures': 'lighting',
        'Power': 'power',
        'Branch': 'branch',
        'Feeders': 'feeders',
        'Switchgear': 'switchgear',
        'Equipment': 'equipment',
        'Special Systems': 'special'
      };
      
      const sectionName = sectionMap[layer.section_name] || sectionMap[layer.name] || 'general';
      console.log(`Exporting to section: ${sectionName}`);
      
      // Get the next sequence number for this section
      const { data: existingItems } = await supabase
        .from('estimate_items')
        .select('sequence')
        .eq('estimate_id', estimateId)
        .eq('section', sectionName)
        .order('sequence', { ascending: false })
        .limit(1);
      
      let nextSequence = existingItems && existingItems.length > 0 ? existingItems[0].sequence + 1 : 0;
      
      // Add items to the estimate
      let itemsAdded = 0;
      for (const measurement of layerMeasurements) {
        // Handle COUNT measurements (single material, assembly, or label-only)
        if (measurement.measurement_type === 'count' && (measurement.material_id || measurement.label)) {
          const material = measurement.material_id ? materials.find(m => m.id === measurement.material_id) : null;
          
          const quantity = measurement.calculated_value; // Number of items counted
          
          // Check if this is an ASSEMBLY (expandable with components)
          const isAssembly = material && material.unit === 'assembly';
          
          if (isAssembly) {
            console.log(`📦 Exporting count assembly: ${material.name} with ${quantity} items`);
            
            // Load assembly components
            const { data: components, error: compError } = await supabase
              .from('assembly_components')
              .select('*')
              .eq('assembly_id', material.id)
              .order('sequence');
            
            if (compError) {
              console.error('Error loading assembly components:', compError);
              continue;
            }
            
            // First, add the parent assembly row
            const { data: parentItem, error: parentError } = await supabase
              .from('estimate_items')
              .insert([{
                estimate_id: estimateId,
                section: sectionName,
                sequence: nextSequence++,
                line_type: 'assembly',
                description: `${measurement.label || material.name} (${quantity} ea)`,
                quantity: quantity,
                unit: 'ea',
                material_unit_cost: 0,
                material_total: 0,
                labor_hours: 0,
                labor_rate: 85,
                labor_multiplier: 1,
                labor_total: 0,
                line_total: 0,
              }])
              .select()
              .single();
            
            if (parentError) {
              console.error('❌ Error adding parent assembly:', parentError);
              continue;
            }
            
            console.log(`✅ Parent assembly added with ID: ${parentItem.id}`);
            itemsAdded++;
            let assemblyMaterialTotal = 0;
            let assemblyLaborHours = 0;
            
            // Now add child components under the parent
            if (components && components.length > 0) {
              for (const comp of components) {
                // CRITICAL: For count assemblies, SKIP components with per_foot/per_10_feet quantity_types
                // Only include fixed quantities (quantity_type is null, undefined, or 'fixed')
                if (comp.quantity_type && comp.quantity_type !== 'fixed') {
                  console.log(`⏭️ Skipping ${comp.material_name} - has quantity_type '${comp.quantity_type}' (not valid for count items)`);
                  continue;
                }
                
                const compMaterial = materials.find(m => m.id === comp.material_id);
                // CRITICAL FIX: Use stored component costs as fallback when material not found in array
                const materialPrice = compMaterial?.price || comp.material_unit_cost || 0;
                const laborHours = compMaterial?.laborHours || comp.labor_hours || 0;
                
                // For count assemblies: store PER-UNIT quantities (Estimate page multiplies by parent qty)
                const totalQty = comp.quantity;
                const materialTotal = totalQty * materialPrice;
                const laborHoursTotal = totalQty * laborHours;
                const laborTotal = laborHoursTotal * 85;
                const lineTotal = materialTotal + laborTotal;
                
                assemblyMaterialTotal += materialTotal;
                assemblyLaborHours += laborHoursTotal;
                
                const { error: itemError } = await supabase
                  .from('estimate_items')
                  .insert([{
                    estimate_id: estimateId,
                    section: sectionName,
                    sequence: nextSequence++,
                    line_type: 'material',
                    description: comp.material_name,
                    quantity: totalQty,
                    unit: comp.unit || 'ea',
                    material_unit_cost: materialPrice,
                    material_total: materialTotal,
                    labor_hours: laborHours,
                    labor_rate: 85,
                    labor_multiplier: 1,
                    labor_total: laborTotal,
                    line_total: lineTotal,
                    parent_id: parentItem.id, // Link to parent assembly
                  }]);
                
                if (itemError) {
                  console.error('❌ Error adding child component:', itemError);
                  continue;
                }
                
                itemsAdded++;
              }
              
              // Update parent assembly with per-unit values AND totals
              // Children store PER-UNIT quantities, so assemblyMaterialTotal/assemblyLaborHours are already per-unit
              const materialCostPerUnit = assemblyMaterialTotal;
              const laborHoursPerUnit = assemblyLaborHours;
              const totalMaterialCost = assemblyMaterialTotal * quantity;
              const laborDollarTotal = assemblyLaborHours * quantity * 85;
              const totalLineTotal = totalMaterialCost + laborDollarTotal;
              
              const { error: updateError } = await supabase
                .from('estimate_items')
                .update({
                  material_unit_cost: materialCostPerUnit,
                  material_total: totalMaterialCost,
                  labor_hours: laborHoursPerUnit,
                  labor_total: laborDollarTotal,
                  line_total: totalLineTotal,
                })
                .eq('id', parentItem.id);
              
              if (updateError) {
                console.error('❌ Error updating parent assembly:', updateError);
              } else {
                console.log(`✅ Parent assembly updated with totals`);
                console.log(`   Per-unit material: $${materialCostPerUnit.toFixed(2)}, Total material: $${totalMaterialCost.toFixed(2)}`);
                console.log(`   Per-unit labor hrs: ${laborHoursPerUnit.toFixed(4)}, Total labor $: $${laborDollarTotal.toFixed(2)}`);
              }
            }
          } else {
            // NOT an assembly - simple single-line item (may have no material for label-only counts)
            const materialPrice = material?.price || 0;
            const materialTotal = quantity * materialPrice;
            const laborTotal = 0;
            
            const { error: itemError } = await supabase
              .from('estimate_items')
              .insert([{
                estimate_id: estimateId,
                section: sectionName,
                sequence: nextSequence++,
                line_type: 'material',
                description: measurement.label || (material ? material.name : 'Unnamed Item'),
                quantity: quantity,
                unit: material?.unit || 'ea',
                material_unit_cost: materialPrice,
                material_total: materialTotal,
                labor_hours: 0,
                labor_rate: 85,
                labor_multiplier: 1,
                labor_total: laborTotal,
                line_total: materialTotal + laborTotal,
              }]);
            
            if (itemError) {
              console.error('Error adding count item:', itemError);
              continue;
            }
            
            itemsAdded++;
          }
        }
        
        // Handle LENGTH measurements (multiple materials from assembly)
        if (measurement.measurement_type === 'length' && measurement.materials && measurement.materials.length > 0) {
          const measurementLength = measurement.calculated_value; // Total length in feet
          
          for (const mat of measurement.materials) {
            const material = materials.find(m => m.id === mat.material_id);
            
            // CRITICAL FIX: Don't skip if material not found - it might be a temporary assembly
            // Temporary assemblies have the data stored WITH the measurement
            if (!material && !mat.isAssembly) {
              console.warn('Skipping material - not found in database and not an assembly:', mat.material_id);
              continue; // Only skip if it's not an assembly
            }

            // 🔧 FIX: Handle temporary assemblies (created on-the-fly) that don't exist in materials table
            // Check if this is an assembly first by looking at stored data
            const isAssembly = mat.isAssembly || (material && material.unit === 'assembly');
            
            // For assemblies, load components if not already stored with measurement
            if (isAssembly) {
              // Check if components are already stored with the measurement (preferred for temp assemblies)
              if (mat.components && mat.components.length > 0) {
                console.log('✅ Using stored components from measurement:', mat.components.length, 'components');
              } else if (material && material.id) {
                // Fallback: Load from assembly_components table if this is a database assembly
                console.log('🔄 Loading components from database for assembly:', material.name, 'ID:', material.id);
                const { data: components, error: compError } = await supabase
                  .from('assembly_components')
                  .select('*')
                  .eq('assembly_id', material.id)
                  .order('sequence');
                
                if (compError) {
                  console.error('❌ Error loading components:', compError);
                } else if (components && components.length > 0) {
                  mat.components = components;
                  console.log('✅ Loaded', components.length, 'components from database');
                } else {
                  console.warn('⚠️ No components found for assembly:', material ? material.name : mat.material_name);
                }
              }
            }

            // If it's an assembly, add as parent with child components (for expansion in Estimate)
            // USE mat.material_name (stored with measurement) for temporary assemblies
            if (isAssembly && mat.components && mat.components.length > 0) {
              // CRITICAL: Use stored material_name for temporary assemblies that don't exist in DB
              const assemblyName = material ? material.name : mat.material_name;
              console.log(`📦 Exporting assembly: ${assemblyName} with ${mat.components.length} components`);
              
              // First, add the parent assembly row
              const { data: parentItem, error: parentError } = await supabase
                .from('estimate_items')
                .insert([{
                  estimate_id: estimateId,
                  section: sectionName,
                  sequence: nextSequence++,
                  line_type: 'assembly',
                  description: `${measurement.label || assemblyName} (${measurementLength.toFixed(0)} ft)`,
                  quantity: measurementLength,
                  unit: 'ft',
                  material_unit_cost: 0,
                  material_total: 0,
                  labor_hours: 0,
                  labor_rate: 85,
                  labor_multiplier: 1,
                  labor_total: 0,
                  line_total: 0,
                }])
                .select()
                .single();
              
              if (parentError) {
                console.error('❌ Error adding parent assembly:', parentError);
                continue;
              }
              
              console.log(`✅ Parent assembly added with ID: ${parentItem.id}`);
              itemsAdded++;
              let assemblyTotal = 0;
              let assemblyLaborHours = 0;
              
              console.log(`\n🔢 STARTING ASSEMBLY TOTALS CALCULATION:`);
              console.log(`   Initial - Material: $${assemblyTotal}, Labor Hours: ${assemblyLaborHours}`);
              
              // Now add child components under the parent WITH ROUNDING
              console.log(`📝 Starting to insert ${mat.components.length} child components...`);
              for (const comp of mat.components) {
                console.log(`\n  ▶️ Processing component: ${comp.material_name}, base qty=${comp.quantity}`);
                
                if (comp.quantity <= 0) {
                  console.log(`  ⏭️ Skipping ${comp.material_name} - quantity is 0`);
                  continue;
                }
                
                // Calculate component quantity based on length
                let totalQty = comp.quantity;
                if (comp.quantity_type === 'per_foot') {
                  totalQty = comp.quantity * measurementLength;
                } else if (comp.quantity_type === 'per_10_feet') {
                  totalQty = comp.quantity * (measurementLength / 10);
                } else if (comp.quantity_type === 'per_100_feet') {
                  totalQty = comp.quantity * (measurementLength / 100);
                }
                
                console.log(`  Component ${comp.material_name}: calculated qty = ${totalQty.toFixed(2)}`);
                
              // Apply rounding rules based on material type
              const lowerName = comp.material_name.toLowerCase();

              // CRITICAL: Check fittings FIRST before conduit (to avoid "EMT 90" matching as conduit)
              // Fittings (90s, 45s, LBs, etc.): NO ROUNDING - use exact quantity
              if (lowerName.includes('90') || lowerName.includes('45') ||
                  lowerName.includes('elbow') || lowerName.includes('ell') ||
                  lowerName.match(/\b(lb|ll|lr)\b/i) || lowerName.includes('body') ||
                  lowerName.includes('fitting') || lowerName.includes('box') || 
                  lowerName.includes('bushing')) {
                // Fittings use exact quantity - no rounding
                console.log(`    📏 ${comp.material_name}: ${totalQty.toFixed(2)} (no rounding - fitting)`);
              }
              // Connectors, couplings, straps: round up to whole number
              else if (lowerName.includes('coupling') || lowerName.includes('connector') ||
                       lowerName.includes('strap') || lowerName.includes('clamp')) {
                const beforeRound = totalQty;
                totalQty = Math.ceil(totalQty);
                console.log(`    📏 ${comp.material_name}: ${beforeRound.toFixed(2)} → ${totalQty} ea (rounded up to whole)`);
              }
              // Conduit: round up to nearest 10 feet (checked LAST to avoid matching fittings)
              else if ((lowerName.includes('emt') || lowerName.includes('conduit') || 
                       lowerName.includes('pvc') || lowerName.includes('rigid')) &&
                       !lowerName.includes('90') && !lowerName.includes('45') && 
                       !lowerName.includes('ell') && !lowerName.match(/\b(lb|ll|lr)\b/i)) {
                const beforeRound = totalQty;
                totalQty = Math.ceil(totalQty / 10) * 10;
                console.log(`    📏 ${comp.material_name}: ${beforeRound.toFixed(2)} → ${totalQty} ft (rounded to nearest 10)`);
              }
                
                // Get material price and labor hours
                // CRITICAL FIX: Use stored component costs as fallback when material not found in array
                const compMaterial = materials.find(m => m.id === comp.material_id);
                const materialPrice = compMaterial?.price || comp.material_unit_cost || 0;
                const laborHours = compMaterial?.laborHours || comp.labor_hours || 0;
                const materialTotal = totalQty * materialPrice;
                const laborHoursTotal = totalQty * laborHours;
                const laborTotal = laborHoursTotal * 85; // Calculate labor $ (hours * rate)
                const lineTotal = materialTotal + laborTotal; // Total = material + labor
                
                assemblyTotal += materialTotal;
                assemblyLaborHours += laborHoursTotal;

                console.log(`  💾 Inserting child component to database:`);
                console.log(`     - Parent ID: ${parentItem.id}`);
                console.log(`     - Description: ${comp.material_name}`);
                console.log(`     - Quantity: ${totalQty}`);
                console.log(`     - Price: $${materialPrice}`);
                console.log(`     - Labor Hours: ${laborHours}`);
                console.log(`     - Material Total: $${materialTotal.toFixed(2)}`);
                console.log(`     - Labor Total: $${laborTotal.toFixed(2)}`);
                console.log(`     - Line Total: $${lineTotal.toFixed(2)}`);

                const { data: insertedChild, error: itemError} = await supabase
                  .from('estimate_items')
                  .insert([{
                    estimate_id: estimateId,
                    section: sectionName,
                    sequence: nextSequence++,
                    line_type: 'material',
                    description: comp.material_name,
                    quantity: totalQty,
                    unit: comp.unit || 'ea',
                    material_unit_cost: materialPrice,
                    material_total: materialTotal,
                    labor_hours: laborHours,
                    labor_rate: 85,
                    labor_multiplier: 1,
                    labor_total: laborTotal,
                    line_total: lineTotal,
                    parent_id: parentItem.id, // Link to parent assembly
                  }])
                  .select();
                
                if (itemError) {
                  console.error('❌ ERROR INSERTING CHILD COMPONENT:', itemError);
                  console.error('❌ Error code:', itemError.code);
                  console.error('❌ Error message:', itemError.message);
                  console.error('❌ Error details:', itemError.details);
                  alert(`Failed to insert component "${comp.material_name}": ${itemError.message}`);
                  continue;
                }
                
                console.log(`  ✅ Child component inserted successfully:`, insertedChild);
                itemsAdded++;
              }
              
              console.log(`✅ Finished inserting all child components. Total items added: ${itemsAdded}`);
              
              console.log(`  Assembly totals - Material: $${assemblyTotal.toFixed(2)}, Labor Hours: ${assemblyLaborHours.toFixed(2)}`);
              
              // Calculate per-foot values for the parent assembly
              // This allows the user to adjust quantity and have it calculate correctly
              const materialCostPerFoot = assemblyTotal / measurementLength;
              const laborHoursPerFoot = assemblyLaborHours / measurementLength;
              const laborDollarTotal = assemblyLaborHours * 85; // Labor rate is $85/hr
              const totalLineTotal = assemblyTotal + laborDollarTotal;
              
              console.log(`  Per-foot values - Material: $${materialCostPerFoot.toFixed(2)}/ft, Labor: ${laborHoursPerFoot.toFixed(4)} hrs/ft`);
              console.log(`  Totals - Material: $${assemblyTotal.toFixed(2)}, Labor: $${laborDollarTotal.toFixed(2)}, Line Total: $${totalLineTotal.toFixed(2)}`);
              
              // Update parent assembly with per-foot values AND totals
              const { data: updatedParent, error: updateError } = await supabase
                .from('estimate_items')
                .update({
                  material_unit_cost: materialCostPerFoot,
                  material_total: assemblyTotal,
                  labor_hours: laborHoursPerFoot,
                  labor_total: laborDollarTotal,
                  line_total: totalLineTotal,
                })
                .eq('id', parentItem.id)
                .select();
              
              if (updateError) {
                console.error('❌ Error updating parent assembly:', updateError);
                alert(`Failed to update parent totals: ${updateError.message}`);
              } else {
                console.log(`✅ Parent assembly updated successfully!`);
                console.log(`   Parent ID: ${parentItem.id}`);
                console.log(`   Material Total: $${assemblyTotal.toFixed(2)}`);
                console.log(`   Labor Hours: ${assemblyLaborHours.toFixed(2)}`);
                console.log(`   Updated row:`, updatedParent);
              }
            } else {
              // Regular material (not an assembly)
              const materialPrice = material.price || 0;
              const quantity = mat.quantity;
              const materialTotal = quantity * materialPrice;
              
              const { error: itemError } = await supabase
                .from('estimate_items')
                .insert([{
                  estimate_id: estimateId,
                  section: sectionName,
                  sequence: nextSequence++,
                  line_type: 'material',
                  description: measurement.label || material.name,
                  quantity: quantity,
                  unit: material.unit || 'ea',
                  material_unit_cost: materialPrice,
                  material_total: materialTotal,
                  labor_hours: 0,
                  labor_rate: 85,
                  labor_multiplier: 1,
                  labor_total: 0,
                  line_total: materialTotal,
                }]);
              
              if (itemError) {
                console.error('Error adding material:', itemError);
                continue;
              }
              
              itemsAdded++;
            }
          }
        }
      }
      
      if (itemsAdded > 0) {
        // Mark layer as exported
        await supabase
          .from('measurement_layers')
          .update({ 
            needs_export: false,
            last_exported_at: new Date().toISOString()
          })
          .eq('id', layer.id);
        
        // Reload layers to update button color
        loadLayers();
        
        alert(`✅ Successfully exported ${itemsAdded} item(s) to the "${sectionName}" section in the estimate!`);
      } else {
        alert('No items were exported. Please check that materials are linked to your measurements.');
      }
      
    } catch (err) {
      console.error('Error exporting to estimate:', err);
      alert('Failed to export to estimate: ' + err.message);
    }
  }

  const containerRef = useRef(null);

  async function toggleFullscreen() {
    if (!isFullscreen) {
      // Enter fullscreen - target just this component's container
      const elem = containerRef.current;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }

  // Helper function to finish polyline (called by Enter key or double-click)
  async function finishPolyline() {
    console.log('🎯 finishPolyline() called');
    console.log('Points in polyline:', polylinePointsRef.current.length);
    console.log('Segments in polyline:', polylineSegmentsRef.current.length);
    
    if (polylinePointsRef.current.length < 2) {
      console.error('Not enough points:', polylinePointsRef.current.length);
      alert('Need at least 2 points to create a measurement');
      return;
    }
    
    // Get canvas from REF instead of state
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) {
      console.error('❌ Canvas ref is null, cannot finish polyline');
      return;
    }
    console.log('✅ Canvas ref is available');
    
    // Remove preview line if it exists
    if (currentLineRef.current) {
      fabricCanvas.remove(currentLineRef.current);
      currentLineRef.current = null;
      console.log('Removed preview line');
    }
    
    // Calculate total pixel distance from all segments
    let totalPixelDistance = 0;
    for (let i = 1; i < polylinePointsRef.current.length; i++) {
      const p1 = polylinePointsRef.current[i - 1];
      const p2 = polylinePointsRef.current[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      totalPixelDistance += Math.sqrt(dx * dx + dy * dy);
    }
    console.log('Total pixel distance:', totalPixelDistance);
    
    const realDistance = calculateRealDistance(totalPixelDistance);
    console.log('Real distance:', realDistance, 'feet');
    
    // Reload materials to get any newly created assemblies - WAIT for it to finish!
    console.log('🔄 Reloading materials before showing modal...');
    await loadMaterials();
    console.log('✅ Materials reloaded!');
    
    // Store pending measurement with all segments and points
    const pendingData = {
      segments: [...polylineSegmentsRef.current],
      points: [...polylinePointsRef.current],
      pixelDistance: totalPixelDistance,
      realDistance: realDistance,
      fabricCanvas: fabricCanvas
    };
    console.log('📦 Setting pending measurement:', pendingData);
    setPendingMeasurement(pendingData);
    
    // Show type selection modal first
    console.log('🔔 Setting showLengthTypeModal to true');
    setShowLengthTypeModal(true);
    
    // Reset drawing state but keep segments on canvas until saved or cancelled
    isDrawingRef.current = false;
    setIsDrawing(false);
    
    console.log(`✅ Polyline finished: ${polylinePointsRef.current.length} points, ${realDistance.toFixed(2)} feet`);
    console.log('✅ Type selection modal should now be visible!');
  }

  // Helper function to cancel polyline (called by Escape key)
  function cancelPolyline() {
    if (!canvas) return;
    
    // Remove all segments from canvas
    polylineSegmentsRef.current.forEach(seg => canvas.remove(seg));
    
    // Remove preview line if it exists
    if (currentLineRef.current) {
      canvas.remove(currentLineRef.current);
    }
    
    canvas.renderAll();
    
    // Reset all polyline state
    polylinePointsRef.current = [];
    setPolylinePoints([]);
    polylineSegmentsRef.current = [];
    setPolylineSegments([]);
    setAccumulatedDistance(0);
    isDrawingRef.current = false;
    setIsDrawing(false);
    currentLineRef.current = null;
    startPointRef.current = null;
    
    // Reset materials list too
    setMeasurementMaterials([]);
    
    console.log('🚫 Polyline cancelled');
  }

  // ===== SNAPSHOT FUNCTIONS =====
  async function captureSnapshotFromCanvas(captureRect, fabricCanvas) {
    setIsCapturingSnapshot(true);
    try {
      const pdfWrapper = pdfWrapperRef.current;
      if (!pdfWrapper) throw new Error('PDF wrapper not found');
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = pdfWrapper.offsetWidth;
      compositeCanvas.height = pdfWrapper.offsetHeight;
      const ctx = compositeCanvas.getContext('2d');
      const fabricEl = fabricCanvas.getElement();
      const pdfCanvases = pdfWrapper.querySelectorAll('canvas');
      for (const c of pdfCanvases) {
        if (c === fabricEl) continue;
        const upperCanvas = fabricEl?.parentElement?.querySelector('.upper-canvas');
        if (upperCanvas && c === upperCanvas) continue;
        try {
          const cRect = c.getBoundingClientRect();
          const wRect = pdfWrapper.getBoundingClientRect();
          ctx.drawImage(c, cRect.left - wRect.left, cRect.top - wRect.top, cRect.width, cRect.height);
        } catch (e) { /* skip tainted canvases */ }
      }
      try { ctx.drawImage(fabricEl, 0, 0); } catch (e) { /* skip */ }
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.max(1, captureRect.width);
      croppedCanvas.height = Math.max(1, captureRect.height);
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(compositeCanvas, captureRect.x, captureRect.y, captureRect.width, captureRect.height, 0, 0, captureRect.width, captureRect.height);
      croppedCanvas.toBlob((blob) => {
        if (blob) {
          setPendingSnapshotImage({ blob, imageUrl: URL.createObjectURL(blob) });
          setSnapshotLabel('');
          setShowSnapshotLabelModal(true);
        }
      }, 'image/png', 0.92);
    } catch (err) {
      alert('Failed to capture snapshot: ' + err.message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  }

  async function saveSnapshot() {
    if (!pendingSnapshotImage) return;
    const { blob } = pendingSnapshotImage;
    const label = snapshotLabel.trim() || `Snapshot ${snapshots.length + 1}`;
    try {
      const fileName = `${projectId}/takeoff-snapshots/${planId}-${Date.now()}.png`;
      let imageUrl = '';
      const { error: uploadError } = await supabase.storage.from('project-photos').upload(fileName, blob, { contentType: 'image/png', upsert: false });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      } else {
        // Fallback: store as base64
        imageUrl = await new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
      }
      const { data, error } = await supabase.from('plan_snapshots').insert([{ project_id: projectId, plan_id: planId, page_number: currentPageRef.current, label, image_url: imageUrl, image_path: !uploadError ? fileName : null, company_id: user.id, sort_order: snapshots.length }]).select().single();
      if (error) throw error;
      setSnapshots([...snapshots, data]);
      URL.revokeObjectURL(pendingSnapshotImage.imageUrl);
      setPendingSnapshotImage(null);
      setSnapshotLabel('');
      setShowSnapshotLabelModal(false);
      alert(`✅ Snapshot "${label}" saved to this project!`);
    } catch (err) {
      alert('Failed to save snapshot: ' + err.message);
    }
  }

  async function deleteSnapshot(snapshotId) {
    if (!confirm('Delete this snapshot?')) return;
    try {
      const snap = snapshots.find(s => s.id === snapshotId);
      if (snap?.image_path) {
        await supabase.storage.from('project-photos').remove([snap.image_path]);
      }
      await supabase.from('plan_snapshots').delete().eq('id', snapshotId);
      setSnapshots(snapshots.filter(s => s.id !== snapshotId));
    } catch (err) {
      alert('Failed to delete snapshot: ' + err.message);
    }
  }

  async function loadSnapshots() {
    if (!planId) return;
    try {
      const { data, error } = await supabase.from('plan_snapshots').select('*').eq('plan_id', planId).order('created_at', { ascending: true });
      if (error) throw error;
      setSnapshots(data || []);
    } catch (err) {
      console.log('Snapshots table not available yet (run CREATE_PLAN_SNAPSHOTS.sql):', err.message);
      setSnapshots([]);
    }
  }

  // ===== AUTO COUNT FUNCTIONS =====
  async function captureAutoCountTemplate(captureRect, fabricCanvas) {
    setIsRunningAutoCount(true);
    try {
      const pdfWrapper = pdfWrapperRef.current;
      if (!pdfWrapper) throw new Error('PDF wrapper not found');

      // Build composite canvas of the PDF (same technique as snapshot)
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = pdfWrapper.offsetWidth;
      compositeCanvas.height = pdfWrapper.offsetHeight;
      const ctx = compositeCanvas.getContext('2d');
      const fabricEl = fabricCanvas.getElement();
      const pdfCanvases = pdfWrapper.querySelectorAll('canvas');
      for (const c of pdfCanvases) {
        if (c === fabricEl) continue;
        try {
          const cRect = c.getBoundingClientRect();
          const wRect = pdfWrapper.getBoundingClientRect();
          ctx.drawImage(c, cRect.left - wRect.left, cRect.top - wRect.top, cRect.width, cRect.height);
        } catch (e) { /* skip tainted canvases */ }
      }

      // Crop template region
      const tmplCanvas = document.createElement('canvas');
      tmplCanvas.width = Math.max(1, captureRect.width);
      tmplCanvas.height = Math.max(1, captureRect.height);
      const tCtx = tmplCanvas.getContext('2d');
      tCtx.drawImage(
        compositeCanvas,
        captureRect.x, captureRect.y, captureRect.width, captureRect.height,
        0, 0, captureRect.width, captureRect.height
      );

      const templateDataUrl = tmplCanvas.toDataURL('image/png');

      setAutoCountTemplate({ dataUrl: templateDataUrl, width: captureRect.width, height: captureRect.height, compositeCanvas, tmplCanvas });
      setAutoCountMatches([]);
      setShowAutoCountModal(true);

      // Auto-run matching at default threshold
      await runAutoCountMatching(compositeCanvas, tmplCanvas, autoCountThreshold, fabricCanvas);
    } catch (err) {
      alert('Failed to capture symbol: ' + err.message);
    } finally {
      setIsRunningAutoCount(false);
    }
  }

  async function runAutoCountMatching(compositeCanvas, tmplCanvas, threshold, fabricCanvas) {
    setIsRunningAutoCount(true);

    // Clear previous match rects from canvas
    const fc = fabricCanvas || fabricCanvasRef.current;
    if (fc && autoCountMatchRectsRef.current.length > 0) {
      autoCountMatchRectsRef.current.forEach(r => { try { fc.remove(r); } catch (e) {} });
      autoCountMatchRectsRef.current = [];
      fc.renderAll();
    }

    // Allow UI to update before heavy computation
    await new Promise(resolve => setTimeout(resolve, 60));

    try {
      const imgCtx = compositeCanvas.getContext('2d');
      const imgData = imgCtx.getImageData(0, 0, compositeCanvas.width, compositeCanvas.height);
      const tCtx = tmplCanvas.getContext('2d');
      const tmplData = tCtx.getImageData(0, 0, tmplCanvas.width, tmplCanvas.height);

      const matches = templateMatchGrayscale(imgData, tmplData, threshold);
      setAutoCountMatches(matches);

      // Draw green highlight rectangles on canvas for each match
      if (fc) {
        const rects = matches.map(m => {
          const rect = new fabric.Rect({
            left: m.x,
            top: m.y,
            width: tmplCanvas.width,
            height: tmplCanvas.height,
            fill: 'rgba(16, 185, 129, 0.2)',
            stroke: '#10b981',
            strokeWidth: 2,
            selectable: false,
            hasBorders: false,
            hasControls: false,
            evented: false,
            isAutoCountMatch: true,
          });
          fc.add(rect);
          return rect;
        });
        autoCountMatchRectsRef.current = rects;
        fc.renderAll();
      }
    } catch (err) {
      console.error('Template matching failed:', err);
    } finally {
      setIsRunningAutoCount(false);
    }
  }

  function templateMatchGrayscale(imgData, tmplData, threshold) {
    const imgW = imgData.width;
    const imgH = imgData.height;
    const tw = tmplData.width;
    const th = tmplData.height;

    if (tw < 4 || th < 4 || tw >= imgW || th >= imgH) return [];

    // Convert to grayscale float arrays
    const imgGray = new Float32Array(imgW * imgH);
    const tmplGray = new Float32Array(tw * th);
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgGray[i >> 2] = imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114;
    }
    for (let i = 0; i < tmplData.data.length; i += 4) {
      tmplGray[i >> 2] = tmplData.data[i] * 0.299 + tmplData.data[i + 1] * 0.587 + tmplData.data[i + 2] * 0.114;
    }

    // Template mean & std
    let tmplSum = 0;
    for (let i = 0; i < tmplGray.length; i++) tmplSum += tmplGray[i];
    const tmplMean = tmplSum / tmplGray.length;
    let tmplVar = 0;
    for (let i = 0; i < tmplGray.length; i++) { const d = tmplGray[i] - tmplMean; tmplVar += d * d; }
    const tmplStd = Math.sqrt(tmplVar);
    if (tmplStd < 1) return []; // Uniform template – can't match

    // Scan with step for performance
    const step = Math.max(1, Math.floor(Math.min(tw, th) / 6));
    const candidates = [];

    for (let y = 0; y <= imgH - th; y += step) {
      for (let x = 0; x <= imgW - tw; x += step) {
        // Compute patch mean (sampled every 3px for speed)
        let patchSum = 0, count = 0;
        for (let ty = 0; ty < th; ty += 3) {
          const row = (y + ty) * imgW;
          for (let tx = 0; tx < tw; tx += 3) { patchSum += imgGray[row + x + tx]; count++; }
        }
        const patchMean = patchSum / count;

        // NCC
        let numer = 0, denom1 = 0;
        for (let ty = 0; ty < th; ty++) {
          const row = (y + ty) * imgW;
          for (let tx = 0; tx < tw; tx++) {
            const iv = imgGray[row + x + tx] - patchMean;
            const tv = tmplGray[ty * tw + tx] - tmplMean;
            numer += iv * tv;
            denom1 += iv * iv;
          }
        }
        const denom = Math.sqrt(denom1) * tmplStd;
        const ncc = denom > 0 ? numer / denom : 0;
        if (ncc >= threshold) candidates.push({ x, y, score: ncc });
      }
    }

    // Non-maximum suppression
    candidates.sort((a, b) => b.score - a.score);
    const final = [];
    const minDist2 = Math.pow(Math.max(tw, th) * 0.6, 2);
    for (const c of candidates) {
      let tooClose = false;
      for (const f of final) {
        if ((c.x - f.x) ** 2 + (c.y - f.y) ** 2 < minDist2) { tooClose = true; break; }
      }
      if (!tooClose) final.push(c);
    }
    return final;
  }

  function placeAutoCountMarkers() {
    const fc = fabricCanvasRef.current;
    if (!fc || autoCountMatches.length === 0 || !autoCountTemplate) return;

    const tw = autoCountTemplate.width;
    const th = autoCountTemplate.height;
    const currentZoom = pdfZoomRef.current;
    const currentOffset = pdfPanOffsetRef.current;

    // Remove match highlight rectangles
    autoCountMatchRectsRef.current.forEach(r => { try { fc.remove(r); } catch (e) {} });
    autoCountMatchRectsRef.current = [];

    // Place a count marker at the center of each match
    autoCountMatches.forEach(m => {
      const cx = m.x + tw / 2;
      const cy = m.y + th / 2;
      const baseX = (cx - currentOffset.x) / currentZoom;
      const baseY = (cy - currentOffset.y) / currentZoom;

      const marker = new fabric.Circle({
        left: cx - 8,
        top: cy - 8,
        radius: 8,
        fill: selectedColorRef.current,
        opacity: 0.6,
        stroke: '#fff',
        strokeWidth: 2,
        selectable: false,
        hasBorders: false,
        hasControls: false,
      });

      fc.add(marker);
      countMarkersRef.current.push({ x: cx, y: cy, baseX, baseY, marker, measurementId: null });
    });

    setCountMarkers([...countMarkersRef.current]);
    fc.renderAll();

    // Close modal and switch to count tool so user can finish/save
    setShowAutoCountModal(false);
    setAutoCountTemplate(null);
    setAutoCountMatches([]);
    setActiveTool('count');
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Digital Takeoff</h1>
            <p style={styles.subtitle}>{plan?.plan_name || 'Loading...'}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={async () => {
              // Get the estimate ID first
              const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
              if (project) {
                const { data: estimate } = await supabase.from('estimates').select('id').eq('project_name', project.name).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (estimate) {
                  navigate(`/project/${projectId}/estimate?estimateId=${estimate.id}`);
                } else {
                  navigate(`/project/${projectId}/estimate`);
                }
              }
            }} style={styles.estimateButton}>
              📊 View Estimate
            </button>
            <button onClick={() => navigate(`/project/${projectId}/plans`)} style={styles.backButton}>
              ← Back to Plans
            </button>
          </div>
        </div>
      )}

      <div style={isFullscreen ? styles.mainContentFullscreen : styles.mainContent}>
        {/* Left Toolbar */}
        <div style={styles.toolbar}>
          <h3 style={styles.toolbarTitle}>Tools</h3>
          
          <div style={styles.toolSection}>
            <button
              onClick={() => handleToolSelect('calibrate')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'calibrate' ? styles.toolButtonActive : {})
              }}
            >
              📐 Calibrate
            </button>
            {isCalibrated && calibrationData && (
              <div style={styles.calibrationInfo}>
                <div style={{ marginBottom: 4 }}>✅ Scale Set</div>
                <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4 }}>
                  {calibrationData.calibration_real_distance?.toFixed(1)} ft @ {Math.round((calibrationData.calibration_zoom_level || 1) * 100)}% zoom
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  {calibrationData.calibration_pixel_distance?.toFixed(0)} px = {calibrationData.pixels_per_foot_at_100?.toFixed(2)} px/ft
                </div>
              </div>
            )}
          </div>

          <div style={styles.divider} />

          <div style={styles.toolSection}>
            <h4 style={styles.sectionTitle}>Measurements</h4>
            <button
              onClick={() => handleToolSelect('length')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'length' ? styles.toolButtonActive : {})
              }}
              disabled={!isCalibrated}
            >
              📏 Length
            </button>
            <button
              onClick={() => handleToolSelect('area')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'area' ? styles.toolButtonActive : {})
              }}
              disabled={!isCalibrated}
            >
              ⬜ Area
            </button>
            <button
              onClick={() => handleToolSelect('count')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'count' ? styles.toolButtonActive : {})
              }}
              disabled={!isCalibrated}
            >
              🎯 Count
            </button>
            <button
              onClick={() => handleToolSelect('snapshot')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'snapshot' ? styles.toolButtonActive : {}),
                backgroundColor: activeTool === 'snapshot' ? '#e0f2fe' : '#1a237e',
                color: activeTool === 'snapshot' ? '#1e40af' : '#90caf9',
                border: activeTool === 'snapshot' ? '2px solid #3b82f6' : '2px solid #3949ab',
              }}
              disabled={!isCalibrated}
              title="Drag a rectangle to capture a snapshot of the plan"
            >
              📸 Snapshot
              {snapshots.length > 0 && (
                <span style={{ marginLeft: 6, backgroundColor: '#f97316', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                  {snapshots.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleToolSelect('autocount')}
              style={{
                ...styles.toolButton,
                ...(activeTool === 'autocount' ? styles.toolButtonActive : {}),
                backgroundColor: activeTool === 'autocount' ? '#dcfce7' : '#1a237e',
                color: activeTool === 'autocount' ? '#065f46' : '#90caf9',
                border: activeTool === 'autocount' ? '2px solid #10b981' : '2px solid #3949ab',
              }}
              disabled={!isCalibrated}
              title="Drag a rectangle around one symbol to auto-count all matching symbols"
            >
              🔍 Auto Count
            </button>
            {snapshots.length > 0 && (
              <button
                onClick={() => setShowSnapshotsList(!showSnapshotsList)}
                style={{ ...styles.toolButton, backgroundColor: '#1a237e', color: '#90caf9', border: '2px solid #3949ab', fontSize: 12 }}
              >
                🗂 View Saved ({snapshots.length})
              </button>
            )}
            
            {/* Color Picker for Count and Length Tools */}
            {(activeTool === 'count' || activeTool === 'length') && (
              <div style={styles.colorPickerSection}>
                <label style={styles.colorLabel}>
                  {activeTool === 'count' ? 'Marker' : 'Line'} Color:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {[
                    { name: 'Orange', value: '#FF6B00' },
                    { name: 'Red', value: '#EF4444' },
                    { name: 'Yellow', value: '#EAB308' },
                    { name: 'Green', value: '#10B981' },
                    { name: 'Blue', value: '#3B82F6' },
                    { name: 'Purple', value: '#A855F7' },
                    { name: 'Pink', value: '#EC4899' },
                    { name: 'Cyan', value: '#06B6D4' },
                  ].map(color => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: color.value,
                        opacity: 0.6,
                        border: selectedColor === color.value ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: selectedColor === color.value ? '0 0 0 2px ' + color.value : 'none'
                      }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={styles.divider} />

          {/* Section Layers (Predefined) */}
          <div style={styles.toolSection}>
            <h4 style={styles.sectionTitle}>Section Layers</h4>
            {layers.filter(l => l.is_predefined).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(layer => (
              <div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                style={{
                  ...styles.layerItem,
                  ...(activeLayer === layer.id ? styles.layerItemActive : {}),
                  marginBottom: 8
                }}
                title={`${layer.name} - Maps to ${layer.section_name || layer.name} section`}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: layer.color,
                    marginRight: 8,
                  }}
                />
                <span style={{ flex: 1, fontSize: 12 }}>{layer.name}</span>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          {/* Custom Layers */}
          <div style={styles.toolSection}>
            <h4 style={styles.sectionTitle}>Custom Layers</h4>
            <button onClick={() => openLayerModal()} style={styles.toolButton}>
              + New Layer
            </button>
            {layers.filter(l => !l.is_predefined).map(layer => (
              <div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                onDoubleClick={() => openLayerModal(layer.id)}
                style={{
                  ...styles.layerItem,
                  ...(activeLayer === layer.id ? styles.layerItemActive : {}),
                  position: 'relative'
                }}
                title="Double-click to rename"
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: layer.color,
                    marginRight: 8,
                  }}
                />
                <span style={{ flex: 1, fontSize: 12 }}>{layer.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PDF Viewer */}
        <div style={styles.viewerContainer}>
          <div style={styles.controls}>
            <span style={styles.viewerNote}>
              Use browser PDF controls to zoom and navigate
            </span>
            <button 
              onClick={() => {
                if (canvas) {
                  console.log('🔄 MANUAL RELOAD TRIGGERED');
                  console.log('Current state - Canvas:', !!canvas, 'PDF Zoom:', pdfZoomRef.current, 'Pan Offset:', pdfPanOffsetRef.current);
                  canvas.clear();
                  countMarkersRef.current = [];
                  setCountMarkers([]);
                  loadExistingDrawings(canvas);
                }
              }}
              style={styles.reloadButton}
              title="Reload all measurements from database"
            >
              🔄 Reload Markers
            </button>
            <button onClick={async () => {
              // Get the estimate ID first
              const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
              if (project) {
                const { data: estimate } = await supabase.from('estimates').select('id').eq('project_name', project.name).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (estimate) {
                  navigate(`/project/${projectId}/estimate?estimateId=${estimate.id}`);
                } else {
                  navigate(`/project/${projectId}/estimate`);
                }
              }
            }} style={styles.estimateButtonControl}>
              📊 View Estimate
            </button>
            <button onClick={toggleFullscreen} style={styles.fullscreenButton}>
              {isFullscreen ? '⤵️ Exit Fullscreen' : '⤢ Fullscreen'}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {pdfUrl ? (
              <>
                <div 
                  ref={pdfWrapperRef}
                  style={{ 
                    flex: 1, 
                    minHeight: 0, 
                    position: 'relative', 
                    pointerEvents: (activeTool === 'length' || calibrationMode) ? 'none' : 'auto'
                  }}
                >
                  <PDFRenderer 
                    pdfUrl={pdfUrl}
                    zoom={zoom}
                    setZoom={setZoom}
                    onLoad={(dims) => {
                      setPdfDimensions(dims);
                      // Initialize canvas after PDF loads with correct dimensions
                      // Use a longer timeout and add retry logic
                      let retryCount = 0;
                      const maxRetries = 5;
                      
                      const tryInitCanvas = () => {
                        if (!canvas && canvasRef.current) {
                          const pdfTransformWrapper = document.getElementById('pdf-transform-wrapper');
                          if (pdfTransformWrapper) {
                            const rect = pdfTransformWrapper.getBoundingClientRect();
                            console.log(`===== CANVAS INITIALIZATION ATTEMPT ${retryCount + 1} =====`);
                            console.log('PDF Transform Wrapper dimensions:', rect.width, 'x', rect.height);
                            
                            if (rect.width > 100 && rect.height > 100) {
                              const fabricCanvas = new fabric.Canvas(canvasRef.current, {
                                selection: true,
                                width: rect.width,
                                height: rect.height,
                                backgroundColor: null,
                                renderOnAddRemove: true,
                              });
                              
                              console.log('✅ Fabric canvas created successfully with dimensions:', fabricCanvas.width, 'x', fabricCanvas.height);
                              setupCanvasEvents(fabricCanvas);
                              setCanvas(fabricCanvas);
                              fabricCanvasRef.current = fabricCanvas; // Store in ref too
                              
                              // DON'T load drawings here - wait for PDF to report its initial pan offset via onPanChange
                              console.log('⏳ Canvas ready. Waiting for PDF to initialize its pan/zoom state...');
                            } else if (retryCount < maxRetries) {
                              retryCount++;
                              console.log(`⏳ Dimensions too small, retrying (${retryCount}/${maxRetries})...`);
                              setTimeout(tryInitCanvas, 200);
                            } else {
                              console.error('❌ Failed to initialize canvas after', maxRetries, 'attempts');
                            }
                          } else if (retryCount < maxRetries) {
                            retryCount++;
                            console.log(`⏳ PDF wrapper not found, retrying (${retryCount}/${maxRetries})...`);
                            setTimeout(tryInitCanvas, 200);
                          }
                        }
                      };
                      
                      setTimeout(tryInitCanvas, 300);
                    }}
    onZoomChange={(z) => {
                      console.log('===== ZOOM CHANGE =====');
                      console.log('Old zoom:', zoomRef.current, 'New zoom:', z);
                      
                      const oldZoom = zoomRef.current;
                      zoomRef.current = z;
                      setPdfZoom(z);
                      pdfZoomRef.current = z;
                      setZoom(z); // Update zoom state too
                      
                      // Update all canvas objects when zoom changes
                      if (canvas && oldZoom !== z) {
                        const currentOffset = pdfPanOffsetRef.current;
                        
                        // Update markers - apply zoom and pan offset (PDF-relative, like length tool)
                        if (countMarkersRef.current.length > 0) {
                          console.log(`Updating ${countMarkersRef.current.length} markers for zoom change`);
                          countMarkersRef.current.forEach((m, idx) => {
                            if (m.marker && m.baseX !== undefined && m.baseY !== undefined) {
                              const newX = (m.baseX * z) + currentOffset.x;
                              const newY = (m.baseY * z) + currentOffset.y;
                              
                              if (idx === 0) { // Log first marker for debugging
                                console.log(`Marker 0: baseX=${m.baseX.toFixed(2)}, baseY=${m.baseY.toFixed(2)}, zoom=${z}, offset=(${currentOffset.x.toFixed(2)}, ${currentOffset.y.toFixed(2)})`);
                                console.log(`  -> newX=${newX.toFixed(2)}, newY=${newY.toFixed(2)}`);
                              }
                              
                              m.marker.set({
                                left: newX - 8,
                                top: newY - 8,
                                radius: 8 * z,
                                strokeWidth: 2 * z
                              });
                              // Update screen coordinates in tracking array
                              m.x = newX;
                              m.y = newY;
                            }
                          });
                        }
                        
                        // Update lines
                        const objects = canvas.getObjects();
                        objects.forEach(obj => {
                          if (obj.measurementId && obj.baseCoords) {
                            obj.set({
                              x1: (obj.baseCoords.x1 * z) + currentOffset.x,
                              y1: (obj.baseCoords.y1 * z) + currentOffset.y,
                              x2: (obj.baseCoords.x2 * z) + currentOffset.x,
                              y2: (obj.baseCoords.y2 * z) + currentOffset.y,
                              strokeWidth: 5 * z
                            });
                          }
                        });
                        
                        canvas.renderAll();
                      }
                    }}
                    onPanChange={(offset) => {
                      console.log('===== PAN CHANGE =====');
                      console.log('New pan offset:', offset);
                      console.log('PDF initialized?', pdfInitializedRef.current);
                      console.log('Canvas ready?', !!canvas);
                      
                      setPdfPanOffset(offset);
                      pdfPanOffsetRef.current = offset;
                      
                      // Check if we're within 2 seconds of a fullscreen change
                      const timeSinceFullscreen = fullscreenTimestampRef.current ? Date.now() - fullscreenTimestampRef.current : Infinity;
                      if (timeSinceFullscreen < 2000 && canvas) {
                        console.log(`🎯 FULLSCREEN PAN UPDATE! (${timeSinceFullscreen}ms after fullscreen)`);
                        console.log('New offset after fullscreen:', offset);
                        
                        const currentZoom = pdfZoomRef.current;
                        
                        // Reposition ALL markers with new offset
                        if (countMarkersRef.current.length > 0) {
                          console.log(`Repositioning ${countMarkersRef.current.length} markers with new fullscreen offset`);
                          countMarkersRef.current.forEach(m => {
                            if (m.marker && m.baseX !== undefined && m.baseY !== undefined) {
                              const newX = (m.baseX * currentZoom) + offset.x;
                              const newY = (m.baseY * currentZoom) + offset.y;
                              m.marker.set({
                                left: newX - 8,
                                top: newY - 8
                              });
                              m.x = newX;
                              m.y = newY;
                            }
                          });
                        }
                        
                        // Reposition lines
                        const objects = canvas.getObjects();
                        objects.forEach(obj => {
                          if (obj.measurementId && obj.baseCoords) {
                            obj.set({
                              x1: (obj.baseCoords.x1 * currentZoom) + offset.x,
                              y1: (obj.baseCoords.y1 * currentZoom) + offset.y,
                              x2: (obj.baseCoords.x2 * currentZoom) + offset.x,
                              y2: (obj.baseCoords.y2 * currentZoom) + offset.y
                            });
                          }
                        });
                        
                        canvas.renderAll();
                        console.log('✅ All markers repositioned for fullscreen!');
                        
                        // Clear timestamp if we're past 1.9 seconds (almost at the limit)
                        if (timeSinceFullscreen > 1900) {
                          fullscreenTimestampRef.current = null;
                          console.log('✅ Fullscreen adjustment period ended');
                        }
                        return;
                      }
                      
                      // On FIRST pan change (PDF initialization), load existing drawings
                      // BUT ONLY if canvas is ready!
                      if (!pdfInitializedRef.current && canvas) {
                        console.log('🎯 PDF INITIALIZED! Canvas is ready. Loading existing drawings now...');
                        pdfInitializedRef.current = true;
                        // Use VERY LONG delay to ensure PDF has fully settled for ALL layers and count markers
                        setTimeout(() => {
                          console.log('⏰ Delayed load executing now...');
                          loadExistingDrawings(canvas);
                        }, 4000); // Increased to 4000ms (4 seconds) to ensure PDF fully settles before loading counts
                        return; // Don't update markers yet, they haven't been loaded
                      } else if (!pdfInitializedRef.current && !canvas) {
                        console.log('⏳ PDF initialized but canvas not ready yet - waiting...');
                        return;
                      }
                      
                      if (!canvas) return;
                      
                      const currentZoom = pdfZoomRef.current;
                      
                      // Update all marker positions when PDF pans
                      if (countMarkersRef.current.length > 0) {
                        countMarkersRef.current.forEach(m => {
                          if (m.marker && m.baseX !== undefined && m.baseY !== undefined) {
                            const newX = (m.baseX * currentZoom) + offset.x;
                            const newY = (m.baseY * currentZoom) + offset.y;
                            m.marker.set({
                              left: newX - 8,
                              top: newY - 8
                            });
                            // Update screen coordinates in tracking array
                            m.x = newX;
                            m.y = newY;
                          }
                        });
                      }
                      
                      // Update all line positions when PDF pans (saved measurements AND temp polyline segments)
                      const objects = canvas.getObjects();
                      objects.forEach(obj => {
                        // Update if it's a saved measurement OR a temporary polyline segment
                        if (obj.baseCoords) {
                          // Update line endpoints based on base coordinates * zoom + pan offset
                          obj.set({
                            x1: (obj.baseCoords.x1 * currentZoom) + offset.x,
                            y1: (obj.baseCoords.y1 * currentZoom) + offset.y,
                            x2: (obj.baseCoords.x2 * currentZoom) + offset.x,
                            y2: (obj.baseCoords.y2 * currentZoom) + offset.y
                          });
                        }
                      });
                      
                      canvas.renderAll();
                    }}
                    onPageChange={async (pageNum) => {
                      setCurrentPage(pageNum);
                      currentPageRef.current = pageNum;
                      
                      // RELOAD CALIBRATION FOR NEW PAGE
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
                          console.log(`⚠️ Page ${pageNum} not calibrated yet`);
                        }
                      } catch (calibErr) {
                        console.log('Error loading calibration for new page:', calibErr);
                        setIsCalibrated(false);
                        setCalibrationData(null);
                      }
                      
                      // Clear canvas and reload measurements for new page
                      if (canvas) {
                        canvas.clear();
                        countMarkersRef.current = [];
                        setCountMarkers([]);
                        loadExistingDrawings(canvas);
                      }
                    }}
                    onRotationChange={(rotation) => {
                      setPdfRotation(rotation);
                      pdfRotationRef.current = rotation;
                      
                      // Clear canvas and reload with new rotation
                      if (canvas) {
                        canvas.clear();
                        countMarkersRef.current = [];
                        setCountMarkers([]);
                        loadExistingDrawings(canvas);
                      }
                    }}
                    disablePanning={calibrationMode || (activeTool === 'length')}
                  />
                </div>
                {/* Canvas overlay for drawing measurements - separate from PDF */}
                <div 
                  ref={canvasWrapperRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    // CRITICAL: When spacebar is held in count mode, disable pointer events to let PDF handle panning
                    pointerEvents: (activeTool === 'length' || activeTool === 'count' || activeTool === 'snapshot' || activeTool === 'autocount' || calibrationMode) && !(activeTool === 'count' && isSpacebarHeld) ? 'auto' : 'none',
                    zIndex: (activeTool === 'length' || activeTool === 'count' || activeTool === 'snapshot' || activeTool === 'autocount' || calibrationMode) ? 9999 : 5,
                    cursor: (activeTool === 'length' || activeTool === 'snapshot' || activeTool === 'autocount' || calibrationMode) ? 'crosshair' : (activeTool === 'count' ? (isSpacebarHeld ? 'grab' : 'pointer') : 'default'),
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: (activeTool === 'length' || activeTool === 'count' || calibrationMode) ? 10 : 0,
                      // CRITICAL: Disable pointer events when spacebar is held to allow PDF panning
                      pointerEvents: (activeTool === 'length' || activeTool === 'count' || calibrationMode) && !(activeTool === 'count' && isSpacebarHeld) ? 'auto' : 'none',
                      cursor: (activeTool === 'length' || calibrationMode) ? 'crosshair' : (activeTool === 'count' ? (isSpacebarHeld ? 'grab' : 'pointer') : 'default'),
                    }}
                  />
                </div>
                {(activeTool === 'length' || activeTool === 'count' || activeTool === 'snapshot' || activeTool === 'autocount' || calibrationMode) && (
                  <div style={{ ...styles.toolHint, backgroundColor: activeTool === 'snapshot' ? 'rgba(59, 130, 246, 0.95)' : activeTool === 'autocount' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(249, 115, 22, 0.95)' }}>
                    {calibrationMode
                      ? 'Draw a line along a known dimension on the plan'
                      : activeTool === 'snapshot'
                      ? `📸 Drag to select an area to snapshot${isCapturingSnapshot ? ' (Capturing...)' : ''}`
                      : activeTool === 'autocount'
                      ? '🔍 Drag a rectangle around ONE symbol to auto-count all matching symbols on this page'
                      : activeTool === 'count'
                      ? `Left-click: place marker | Use PDF toolbar to pan/zoom | Right-click: delete marker (${countMarkers.length} placed)`
                      : polylinePoints.length === 0
                      ? 'Click to start measuring'
                      : polylinePoints.length === 1
                      ? 'Click to add corner | Press Enter to finish'
                      : `${accumulatedDistance.toFixed(2)} ft | Click: add corner | Enter: finish | ESC: cancel`}
                  </div>
                )}
                {activeTool === 'count' && countMarkers.filter(m => !m.measurementId || m.measurementId === editingMeasurementId).length > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Finish Count button clicked!');
                      // If editing, skip modal and directly save
                      if (editingMeasurementId) {
                        saveCount();
                      } else {
                        // Show item type selection modal first
                        setShowCountTypeModal(true);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 70,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '12px 24px',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: '600',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      zIndex: 10001,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                    }}
                  >
                    {editingMeasurementId 
                      ? `✓ Update Count (${countMarkers.filter(m => m.measurementId === editingMeasurementId || !m.measurementId).length})`
                      : `✓ Finish Count (${countMarkers.filter(m => !m.measurementId).length})`
                    }
                  </button>
                )}
              </>
            ) : (
              <div style={styles.loading}>Loading PDF...</div>
            )}
          </div>
        </div>

        {/* Right Panel - Measurements List */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Measurements</h3>
          
          {/* Export Button for Active Layer */}
          {activeLayer && (() => {
            const layer = layers.find(l => l.id === activeLayer && l.is_predefined);
            if (!layer) return null;
            
            const needsExport = layer.needs_export !== false; // Default to true if undefined
            const buttonColor = needsExport ? '#ef4444' : '#10b981'; // Red if needs export, green if exported
            const buttonText = needsExport ? '📤 Export to Estimate' : '✓ Exported';
            
            return (
              <button
                onClick={() => exportLayerToEstimate(layer)}
                style={{
                  ...styles.exportButton,
                  backgroundColor: buttonColor
                }}
                title={needsExport 
                  ? "Export all count measurements with materials from this layer to estimate" 
                  : "Already exported. Click to re-export if changes were made."}
              >
                {buttonText}
              </button>
            );
          })()}
          
          {measurements.length === 0 ? (
            <p style={styles.emptyText}>No measurements yet. Use the tools on the left to start measuring!</p>
          ) : (
            <div style={styles.measurementsList}>
              {measurements.filter(m => m.layer_id === activeLayer).map(measurement => (
                <div 
                  key={measurement.id} 
                  style={{
                    ...styles.measurementItem,
                    ...(measurement.measurement_type === 'count' || measurement.measurement_type === 'length' ? { cursor: 'pointer' } : {})
                  }}
                  onClick={() => {
                    if (measurement.measurement_type === 'count') {
                      openEditDetailsModal(measurement.id);
                    } else if (measurement.measurement_type === 'length') {
                      openEditLengthModal(measurement.id);
                    }
                  }}
                  title={measurement.measurement_type === 'count' ? 'Click to view/edit' : measurement.measurement_type === 'length' ? 'Click to edit materials' : ''}
                >
                  {/* Show color indicator for count and length measurements - top left */}
                  {(measurement.measurement_type === 'count' || measurement.measurement_type === 'length') && measurement.color && (
                    <div style={{ 
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      width: 14, 
                      height: 14, 
                      borderRadius: 3,
                      backgroundColor: measurement.color,
                      opacity: 0.6,
                      border: '2px solid #fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} 
                    title={`${measurement.measurement_type === 'count' ? 'Marker' : 'Line'} color: ${measurement.color}`}
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMeasurement(measurement.id);
                    }}
                    style={styles.deleteButton}
                    title="Delete measurement"
                  >
                    ✕
                  </button>
                  {/* Edit Details button for count measurements only */}
                  {measurement.measurement_type === 'count' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDetailsModal(measurement.id);
                        }}
                        style={styles.editDetailsButton}
                        title="Edit label and material"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editCountMeasurement(measurement.id);
                        }}
                        style={styles.addMarkersButton}
                        title="Add more markers to this count"
                      >
                        ➕
                      </button>
                    </>
                  )}
                  <div style={styles.measurementType}>
                    {measurement.measurement_type === 'length' ? '📏' : 
                     measurement.measurement_type === 'area' ? '⬜' : '🎯'}
                    {measurement.measurement_type}
                  </div>
                  <div style={styles.measurementValue}>
                    {measurement.calculated_value?.toFixed(2)} {measurement.unit}
                  </div>
                  {measurement.label && (
                    <div style={styles.measurementLabel}>{measurement.label}</div>
                  )}
                  {measurement.material_id && (() => {
                    const linkedMaterial = materials.find(m => m.id === measurement.material_id);
                    return linkedMaterial ? (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                        📦 {linkedMaterial.name}
                      </div>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
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
                <button onClick={autoCalibrate} style={styles.saveButton} disabled={!selectedPageSize || !selectedScale}>
                  ✅ Auto Calibrate
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
                onClick={prepareAssemblyPreview} 
                style={styles.saveButton}
                disabled={!quickAssemblyName.trim() || (quickAssemblyComponents.length === 0 && !selectedBaseAssembly && !selectedConduitId)}
              >
                Create Assembly
              </button>
          </div>
        </>
      )}
    </div>
  </div>
)}

      {/* Layer Naming Modal */}
      {showLayerModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLayerModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>{editingLayerId ? 'Rename Layer' : 'New Layer'}</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Layer Name:</label>
              <input 
                type="text"
                value={layerName} 
                onChange={(e) => setLayerName(e.target.value)}
                placeholder="e.g., Conduit, Wire, Devices"
                style={styles.select}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveLayerName();
                  }
                }}
              />
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowLayerModal(false);
                  setLayerName('');
                  setEditingLayerId(null);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={saveLayerName} 
                style={styles.saveButton}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement Labeling Modal */}
      {showMeasurementModal && pendingMeasurement && (
        <div style={styles.modalOverlay} onClick={() => {
          // Cancel and remove the line
          if (pendingMeasurement?.line && pendingMeasurement?.fabricCanvas) {
            pendingMeasurement.fabricCanvas.remove(pendingMeasurement.line);
            pendingMeasurement.fabricCanvas.renderAll();
          }
          setShowMeasurementModal(false);
          setMeasurementLabel('');
          setPendingMeasurement(null);
          setMeasurementMaterials([]);
        }}>
          <div style={{...styles.modalContent, maxWidth: 700}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Save Length Measurement</h2>
            
            <p style={styles.modalDescription}>
              Total Measurement: <strong>
                {(
                  (pendingMeasurement?.realDistance || 0) + 
                  (parseFloat(startDropFootage) || 0) + 
                  (parseFloat(endDropFootage) || 0)
                ).toFixed(2)} feet
              </strong>
              {(startDropFootage || endDropFootage) && (
                <span style={{ fontSize: 12, color: '#666', display: 'block', marginTop: 4 }}>
                  ({pendingMeasurement?.realDistance?.toFixed(2)} ft measured + {((parseFloat(startDropFootage) || 0) + (parseFloat(endDropFootage) || 0)).toFixed(1)} ft drops)
                </span>
              )}
            </p>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Label (optional):</label>
              <input 
                type="text"
                value={measurementLabel} 
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder="e.g., Home run to panel, Branch circuit"
                style={styles.select}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && measurementMaterials.length > 0) {
                    saveMeasurementWithLabel();
                  }
                }}
              />
            </div>
            
            {/* Materials Section */}
            <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: '600' }}>Materials</h3>
                <button
                  onClick={openQuickAssemblyModal}
                  style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: '600', cursor: 'pointer' }}
                  title="Create an assembly on the fly"
                >
                  🔧 Create Assembly
                </button>
              </div>
              
              {/* Add Material Form */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select
                  value={tempMaterialCategory}
                  onChange={(e) => {
                    setTempMaterialCategory(e.target.value);
                    setTempMaterialId(null);
                  }}
                  style={{...styles.select, flex: 1, marginBottom: 0}}
                >
                  <option value="">Category...</option>
                  {[...new Set(materials.map(m => m.category))].sort().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                
                {tempMaterialCategory && (
                  <select
                    value={tempMaterialId || ''}
                    onChange={(e) => setTempMaterialId(e.target.value || null)}
                    style={{...styles.select, flex: 2, marginBottom: 0}}
                  >
                    <option value="">Material...</option>
                    {materials
                      .filter(m => m.category === tempMaterialCategory)
                      .map(material => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                  </select>
                )}
                
                <input
                  type="number"
                  step="0.1"
                  value={tempMaterialQuantity}
                  onChange={(e) => setTempMaterialQuantity(e.target.value)}
                  placeholder="Qty"
                  style={{...styles.select, width: 80, marginBottom: 0}}
                />
                
                <button
                  onClick={addMaterialToMeasurement}
                  style={{...styles.saveButton, flex: 0, padding: '8px 16px', marginTop: 0}}
                >
                  + Add
                </button>
              </div>
              
              {/* Materials List */}
              {measurementMaterials.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {measurementMaterials.map((mat, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: mat.isAssembly ? '#f0f9ff' : '#fff', borderRadius: 6, border: mat.isAssembly ? '2px solid #3b82f6' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: '500', color: '#1a1a1a' }}>
                            {mat.isAssembly ? '🔧 ' : ''}{mat.material_name}
                          </span>
                          <span style={{ fontSize: 13, color: '#666', marginLeft: 8 }}>{mat.quantity} {mat.unit}</span>
                        </div>
                        {!showNewMeasurementPreview && (
                          <button
                            onClick={() => removeMaterialFromMeasurement(idx)}
                            style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      {/* Show assembly components if this is an assembly */}
                          {mat.isAssembly && mat.components && mat.components.length > 0 && (
                        <div style={{ marginTop: 8, marginLeft: 8, padding: 12, backgroundColor: '#fff', borderRadius: 6, border: '1px solid #e0e7ff' }}>
                          <div style={{ fontSize: 12, fontWeight: '600', color: '#3b82f6', marginBottom: 8 }}>Components:</div>
                          {mat.components.filter(comp => comp.quantity > 0 || (comp.roundedQuantity && comp.roundedQuantity > 0)).map((comp, compIdx) => {
                            // USE ROUNDED QUANTITY if it exists (from preview calculation), otherwise calculate
                            let displayQty = comp.roundedQuantity;
                            
                            if (!displayQty) {
                              // Fallback: Calculate if not already rounded
                              const baseMeasurement = pendingMeasurement?.realDistance || 0;
                              const startDrop = parseFloat(startDropFootage) || 0;
                              const endDrop = parseFloat(endDropFootage) || 0;
                              const measurementLength = baseMeasurement + startDrop + endDrop;
                              let totalQty = comp.quantity;
                              
                              if (comp.quantity_type === 'per_foot') {
                                totalQty = comp.quantity * measurementLength;
                              } else if (comp.quantity_type === 'per_10_feet') {
                                totalQty = comp.quantity * (measurementLength / 10);
                              } else if (comp.quantity_type === 'per_100_feet') {
                                totalQty = comp.quantity * (measurementLength / 100);
                              }
                              
                              // Apply rounding rules
                              const lowerName = comp.material_name.toLowerCase();
                              if (lowerName.includes('emt') || lowerName.includes('conduit') || lowerName.includes('pvc') || lowerName.includes('rigid')) {
                                displayQty = Math.ceil(totalQty / 10) * 10;
                              } else if (lowerName.includes('coupling') || lowerName.includes('connector') ||
                                         lowerName.includes('strap') || lowerName.includes('clamp') ||
                                         lowerName.includes('elbow') || lowerName.includes('90') ||
                                         lowerName.includes('45') || lowerName.includes('fitting') ||
                                         lowerName.includes('box') || lowerName.includes('bushing') ||
                                         lowerName.includes('body')) {
                                displayQty = Math.ceil(totalQty);
                              } else {
                                displayQty = totalQty;
                              }
                            }
                            
                            return (
                              <div key={compIdx} style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ flex: 1, paddingLeft: 0 }}>{comp.material_name}</span>
                                <span style={{ color: '#999', fontSize: 11, minWidth: 100, textAlign: 'right' }}>
                                  {comp.quantity} {comp.unit}
                                  {comp.quantity_type === 'per_foot' ? ' /ft' : 
                                   comp.quantity_type === 'per_10_feet' ? ' /10ft' : 
                                   comp.quantity_type === 'per_100_feet' ? ' /100ft' : ''}
                                </span>
                                <span style={{ color: '#1a1a1a', fontWeight: '600', minWidth: 80, textAlign: 'right' }}>
                                  {displayQty.toFixed(displayQty % 1 === 0 ? 0 : 1)} {comp.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  // Cancel and remove the line
                  if (pendingMeasurement?.line && pendingMeasurement?.fabricCanvas) {
                    pendingMeasurement.fabricCanvas.remove(pendingMeasurement.line);
                    pendingMeasurement.fabricCanvas.renderAll();
                  }
                  setShowMeasurementModal(false);
                  setMeasurementLabel('');
                  setPendingMeasurement(null);
                  setShowNewMeasurementPreview(false);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={() => saveMeasurementWithLabel()} 
                style={{
                  ...styles.saveButton,
                  backgroundColor: showNewMeasurementPreview ? '#10b981' : '#f97316'
                }}
              >
                {showNewMeasurementPreview ? '✅ Confirm & Save' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Count Details Modal */}
      {showEditDetailsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEditDetailsModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Edit Count Details</h2>
            
            <p style={styles.modalDescription}>
              Edit the label and material for this count measurement. The markers will not be changed.
            </p>
            
            {/* Category dropdown */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedMaterialId(null); // Reset material when category changes
                }}
                style={styles.select}
              >
                <option value="">-- Select Category --</option>
                {[...new Set(materials.map(m => m.category))].sort().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            {/* Material dropdown */}
            {selectedCategory && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Material:</label>
                <select
                  value={selectedMaterialId || ''}
                  onChange={(e) => setSelectedMaterialId(e.target.value || null)}
                  style={styles.select}
                >
                  <option value="">-- Select Material --</option>
                  {materials
                    .filter(m => m.category === selectedCategory)
                    .map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name} ({material.unit})
                      </option>
                    ))}
                </select>
              </div>
            )}
            
            {/* Label input */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Label (optional):</label>
              <input 
                type="text"
                value={measurementLabel} 
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder="e.g., Receptacles, Light fixtures, Panels"
                style={styles.select}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveEditedDetails();
                  }
                }}
              />
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowEditDetailsModal(false);
                  setEditingDetailsId(null);
                  setMeasurementLabel('');
                  setSelectedMaterialId(null);
                  setSelectedCategory('');
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={saveEditedDetails} 
                style={styles.saveButton}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Length Materials Modal */}
      {showEditLengthModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEditLengthModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 800, maxHeight: '90vh', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Edit Length Measurement Materials</h2>
            
            <p style={styles.modalDescription}>
              Edit assembly name, add/remove/modify components for this measurement.
            </p>
            
            {/* Show measurement length */}
            {(() => {
              const measurement = measurements.find(m => m.id === editingLengthId);
              const measurementLength = measurement?.calculated_value || 0;
              return (
                <div style={{ padding: 12, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 16, border: '2px solid #fbbf24' }}>
                  <div style={{ fontSize: 14, fontWeight: '600', color: '#92400e' }}>
                    📏 Measurement Length: {measurementLength.toFixed(2)} feet
                  </div>
                </div>
              );
            })()}
            
            {/* Materials List with Editable Components */}
            {editLengthMaterials.length > 0 && (
              <div style={{ marginTop: 12, marginBottom: 24 }}>
                {editLengthMaterials.map((mat, matIdx) => (
                  <div key={matIdx} style={{ marginBottom: 20, padding: 16, backgroundColor: mat.isAssembly ? '#f0f9ff' : '#f9fafb', borderRadius: 8, border: mat.isAssembly ? '2px solid #3b82f6' : '1px solid #e5e7eb' }}>
                    {/* Assembly/Material Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mat.isAssembly ? 16 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 }}>
                          {mat.isAssembly ? '🔧 ' : ''}{mat.material_name}
                        </div>
                        {!mat.isAssembly && (
                          <div style={{ fontSize: 13, color: '#666' }}>
                            Quantity: {mat.quantity} {mat.unit}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${mat.material_name}?`)) {
                            setEditLengthMaterials(editLengthMaterials.filter((_, i) => i !== matIdx));
                          }
                        }}
                        style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: '600' }}
                      >
                        Remove Material
                      </button>
                    </div>
                    
                    {/* Show assembly components if this is an assembly */}
                    {mat.isAssembly && mat.components && mat.components.length > 0 && (
                      <div style={{ marginTop: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: '600', color: '#3b82f6', marginBottom: 12 }}>
                          Components (click to edit quantity):
                        </div>
                        {mat.components.map((comp, compIdx) => {
                          // Calculate total quantity based on measurement length
                          const measurement = measurements.find(m => m.id === editingLengthId);
                          const measurementLength = measurement?.calculated_value || 0;
                          let totalQty = comp.quantity;
                          
                          if (comp.quantity_type === 'per_foot') {
                            totalQty = comp.quantity * measurementLength;
                          } else if (comp.quantity_type === 'per_10_feet') {
                            totalQty = comp.quantity * (measurementLength / 10);
                          } else if (comp.quantity_type === 'per_100_feet') {
                            totalQty = comp.quantity * (measurementLength / 100);
                          }
                          
                          // 🎯 APPLY ROUNDING RULES (same as other modals)
                          const lowerName = comp.material_name.toLowerCase();
                          let roundedQty = totalQty;
                          
                          // CRITICAL: Check fittings FIRST before conduit to avoid false matches
                          // Fittings (90s, 45s, bodies, boxes, bushings): round up to nearest whole number
                          if (lowerName.includes('90') || lowerName.includes('45') ||
                              lowerName.includes('elbow') || lowerName.includes('ell') ||
                              lowerName.match(/\b(lb|ll|lr|t|c)\b/i) || lowerName.includes('body') ||
                              lowerName.includes('fitting') || lowerName.includes('box') || 
                              lowerName.includes('bushing')) {
                            roundedQty = Math.ceil(totalQty);
                          }
                          // Connectors, couplings, straps: round up to nearest whole number
                          else if (lowerName.includes('coupling') || lowerName.includes('connector') ||
                                   lowerName.includes('strap') || lowerName.includes('clamp')) {
                            roundedQty = Math.ceil(totalQty);
                          }
                          // Conduit: round up to nearest 10 feet (checked LAST to avoid matching fittings)
                          else if ((lowerName.includes('emt') || lowerName.includes('conduit') || 
                                   lowerName.includes('pvc') || lowerName.includes('rigid')) &&
                                   !lowerName.includes('90') && !lowerName.includes('45') && 
                                   !lowerName.includes('ell') && !lowerName.match(/\b(lb|ll|lr)\b/i)) {
                            roundedQty = Math.ceil(totalQty / 10) * 10;
                          }
                          // Else: Wire and other materials use exact quantity (no rounding)
                          
                          return (
                            <div key={compIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', backgroundColor: '#fff', borderRadius: 6, border: '1px solid #e0e7ff' }}>
                              <span style={{ flex: 1, fontSize: 13, color: '#1a1a1a' }}>{comp.material_name}</span>
                              
                              {/* Editable Quantity Input */}
                              <input
                                type="number"
                                step="0.1"
                                value={comp.quantity}
                                onChange={(e) => {
                                  const newQty = parseFloat(e.target.value) || 0;
                                  const updatedMaterials = [...editLengthMaterials];
                                  updatedMaterials[matIdx].components[compIdx].quantity = newQty;
                                  setEditLengthMaterials(updatedMaterials);
                                }}
                                style={{ width: 70, padding: '4px 8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4 }}
                              />
                              
                              <select
                                value={comp.quantity_type || 'fixed'}
                                onChange={(e) => {
                                  const updatedMaterials = [...editLengthMaterials];
                                  updatedMaterials[matIdx].components[compIdx].quantity_type = e.target.value;
                                  setEditLengthMaterials(updatedMaterials);
                                }}
                                style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, color: '#666' }}
                              >
                                <option value="fixed">ea</option>
                                <option value="per_foot">/ft</option>
                                <option value="per_10_feet">/10ft</option>
                                <option value="per_100_feet">/100ft</option>
                              </select>
                              
                              <span style={{ fontSize: 12, color: '#059669', fontWeight: '600', minWidth: 70, textAlign: 'right' }}>
                                = {roundedQty.toFixed(roundedQty % 1 === 0 ? 0 : 1)} {comp.unit}
                              </span>
                              
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${comp.material_name}?`)) {
                                    const updatedMaterials = [...editLengthMaterials];
                                    updatedMaterials[matIdx].components = updatedMaterials[matIdx].components.filter((_, i) => i !== compIdx);
                                    setEditLengthMaterials(updatedMaterials);
                                  }
                                }}
                                style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Add Component to Assembly Button */}
                        <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, border: '1px dashed #3b82f6' }}>
                          <div style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>
                            Add Component to Assembly:
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select
                              value={tempMaterialCategory}
                              onChange={(e) => {
                                setTempMaterialCategory(e.target.value);
                                setTempMaterialId(null);
                              }}
                              style={{...styles.select, flex: 1, marginBottom: 0, fontSize: 12, padding: '6px'}}
                            >
                              <option value="">Category...</option>
                              {[...new Set(materials.map(m => m.category))].sort().map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                            
                            {tempMaterialCategory && (
                              <select
                                value={tempMaterialId || ''}
                                onChange={(e) => setTempMaterialId(e.target.value || null)}
                                style={{...styles.select, flex: 2, marginBottom: 0, fontSize: 12, padding: '6px'}}
                              >
                                <option value="">Material...</option>
                                {materials
                                  .filter(m => m.category === tempMaterialCategory)
                                  .map(material => (
                                    <option key={material.id} value={material.id}>
                                      {material.name}
                                    </option>
                                  ))}
                              </select>
                            )}
                            
                            <input
                              type="number"
                              step="0.1"
                              value={tempMaterialQuantity}
                              onChange={(e) => setTempMaterialQuantity(e.target.value)}
                              placeholder="Qty"
                              style={{...styles.select, width: 60, marginBottom: 0, fontSize: 12, padding: '6px'}}
                            />
                            
                            <button
                              onClick={() => {
                                if (!tempMaterialId || !tempMaterialQuantity || parseFloat(tempMaterialQuantity) <= 0) {
                                  alert('Please select a material and enter a valid quantity');
                                  return;
                                }
                                const material = materials.find(m => m.id === tempMaterialId);
                                if (!material) return;
                                
                                // Add component to the assembly
                                const updatedMaterials = [...editLengthMaterials];
                                if (!updatedMaterials[matIdx].components) {
                                  updatedMaterials[matIdx].components = [];
                                }
                                updatedMaterials[matIdx].components.push({
                                  material_id: tempMaterialId,
                                  material_name: material.name,
                                  quantity: parseFloat(tempMaterialQuantity),
                                  unit: material.unit || 'ea',
                                  material_unit_cost: material.price || 0,
                                  labor_hours: material.laborHours || 0,
                                  quantity_type: 'fixed',
                                  sequence: updatedMaterials[matIdx].components.length + 1
                                });
                                setEditLengthMaterials(updatedMaterials);
                                
                                // Reset temp fields
                                setTempMaterialId(null);
                                setTempMaterialCategory('');
                                setTempMaterialQuantity('');
                              }}
                              style={{...styles.saveButton, flex: 0, padding: '6px 12px', marginTop: 0, fontSize: 12}}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Add New Material/Assembly */}
            <div style={{ padding: 16, backgroundColor: '#f0fdf4', borderRadius: 8, marginBottom: 16, border: '2px dashed #10b981' }}>
              <div style={{ fontSize: 14, fontWeight: '600', color: '#065f46', marginBottom: 12 }}>
                Add New Material or Assembly:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={tempMaterialCategory}
                  onChange={(e) => {
                    setTempMaterialCategory(e.target.value);
                    setTempMaterialId(null);
                  }}
                  style={{...styles.select, flex: 1, marginBottom: 0}}
                >
                  <option value="">Category...</option>
                  {[...new Set(materials.map(m => m.category))].sort().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                
                {tempMaterialCategory && (
                  <select
                    value={tempMaterialId || ''}
                    onChange={(e) => setTempMaterialId(e.target.value || null)}
                    style={{...styles.select, flex: 2, marginBottom: 0}}
                  >
                    <option value="">Material...</option>
                    {materials
                      .filter(m => m.category === tempMaterialCategory)
                      .map(material => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                  </select>
                )}
                
                <input
                  type="number"
                  step="0.1"
                  value={tempMaterialQuantity}
                  onChange={(e) => setTempMaterialQuantity(e.target.value)}
                  placeholder="Qty"
                  style={{...styles.select, width: 80, marginBottom: 0}}
                />
                
                <button
                  onClick={async () => {
                    if (!tempMaterialId || !tempMaterialQuantity || parseFloat(tempMaterialQuantity) <= 0) {
                      alert('Please select a material and enter a valid quantity');
                      return;
                    }
                    const material = materials.find(m => m.id === tempMaterialId);
                    if (!material) return;
                    
                    const newMaterial = {
                      material_id: tempMaterialId,
                      material_name: material.name,
                      quantity: parseFloat(tempMaterialQuantity),
                      unit: material.unit || 'ea',
                      isAssembly: material.unit === 'assembly',
                      components: []
                    };
                    
                    // If assembly, load components
                    if (material.unit === 'assembly') {
                      const { data: components } = await supabase
                        .from('assembly_components')
                        .select('*')
                        .eq('assembly_id', material.id)
                        .order('sequence');
                      newMaterial.components = components || [];
                    }
                    
                    setEditLengthMaterials([...editLengthMaterials, newMaterial]);
                    
                    // Reset temp fields
                    setTempMaterialId(null);
                    setTempMaterialCategory('');
                    setTempMaterialQuantity('');
                  }}
                  style={{...styles.saveButton, flex: 0, padding: '8px 16px', marginTop: 0}}
                >
                  + Add
                </button>
              </div>
            </div>
            
            {/* Show hint if no materials yet */}
            {editLengthMaterials.length === 0 && (
              <div style={{ padding: 16, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 16, border: '2px solid #fbbf24' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: '600' }}>
                  💡 No materials added yet!
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#92400e' }}>
                  Select a category and material above, enter a quantity, then click "Add" to attach materials to this measurement.
                </p>
              </div>
            )}
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowEditLengthModal(false);
                  setEditingLengthId(null);
                  setEditLengthMaterials([]);
                  setTempMaterialId(null);
                  setTempMaterialCategory('');
                  setTempMaterialQuantity('');
                  setShowPreview(false);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!showPreview) {
                    // First click: Calculate and show preview
                    saveEditedLengthMaterials();
                  } else {
                    // Second click: Actually save to database
                    confirmSaveEditedLengthMaterials();
                  }
                }}
                style={{
                  ...styles.saveButton,
                  backgroundColor: showPreview ? '#10b981' : '#f97316'
                }}
              >
                {showPreview ? '✅ Confirm & Save' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assembly Creation Modal */}
      {showQuickAssemblyModal && (
        <div style={styles.modalOverlay} onClick={() => setShowQuickAssemblyModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 700, maxHeight: '90vh', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🔧 Build Conduit Assembly</h2>
            
            <p style={styles.modalDescription}>
              Build your conduit assembly step-by-step: select conduit type/size, add wires, then choose connectors, couplings, straps, and fittings.
            </p>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Assembly Name *</label>
              <input 
                type="text"
                value={quickAssemblyName} 
                onChange={(e) => setQuickAssemblyName(e.target.value)}
                placeholder="e.g., 3/4″ EMT with 3-#12 THHN"
                style={styles.select}
                autoFocus
              />
            </div>
            
            {/* Step 1: Conduit Selection */}
            <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 8, border: '2px solid #3b82f6' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: '600', color: '#1e40af' }}>
                Step 1: Select Conduit Type & Size
              </h3>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select
                  value={selectedConduitType}
                  onChange={(e) => {
                    setSelectedConduitType(e.target.value);
                    setSelectedConduitSize('');
                    setSelectedConduitId(null);
                  }}
                  style={{...styles.select, flex: 1, marginBottom: 0}}
                >
                  <option value="">-- Conduit Type --</option>
                  <option value="EMT">EMT</option>
                  <option value="Rigid">Rigid</option>
                  <option value="IMC">IMC</option>
                  <option value="PVC">PVC</option>
                  <option value="Flex">Flex/MC</option>
                </select>
                
                {selectedConduitType && (
                  <select
                    value={selectedConduitSize}
                    onChange={(e) => {
                      setSelectedConduitSize(e.target.value);
                      // Find the conduit material with PRECISE size matching
                      const size = e.target.value;
                      const conduitMaterial = materials.find(m => {
                        if (m.category !== 'Conduit') return false;
                        if (!m.name.includes(selectedConduitType)) return false;
                        
                        // SUPER PRECISE matching to avoid "1/2" matching "1-1/2"
                        // Strategy: Check what comes BEFORE and AFTER the size+inch mark
                        
                        // For fractions like "1/2", ensure NO digit-dash before it
                        // This prevents matching "1-1/2" when looking for "1/2"
                        if (size.includes('/')) {
                          // Look for the size pattern in the name
                          const sizePattern = `${size}"`;
                          const sizePattern2 = `${size}″`;
                          
                          const idx1 = m.name.indexOf(sizePattern);
                          const idx2 = m.name.indexOf(sizePattern2);
                          const foundAt = idx1 >= 0 ? idx1 : idx2;
                          
                          if (foundAt < 0) return false; // Size not found
                          
                          // Check what's BEFORE the size
                          if (foundAt >= 2) {
                            const twoCharsBefore = m.name.substring(foundAt - 2, foundAt);
                            // If it's like "1-" before "1/2", reject it (that's "1-1/2")
                            if (/\d-$/.test(twoCharsBefore)) {
                              return false;
                            }
                          }
                          return true;
                        }
                        
                        // For whole numbers like "4", ensure it's not part of a fraction like "1-1/4"
                        const sizePattern = `${size}"`;
                        const sizePattern2 = `${size}″`;
                        
                        const idx1 = m.name.indexOf(sizePattern);
                        const idx2 = m.name.indexOf(sizePattern2);
                        const foundAt = idx1 >= 0 ? idx1 : idx2;
                        
                        if (foundAt < 0) return false; // Size not found
                        
                        // Check what's BEFORE the size number
                        if (foundAt > 0) {
                          const charBefore = m.name[foundAt - 1];
                          // If preceded by a slash, dash, or digit, it's part of a fraction (e.g., "1/4", "1-1/4")
                          if (/[\d\/\-]/.test(charBefore)) {
                            return false;
                          }
                        }
                        return true;
                      });
                      setSelectedConduitId(conduitMaterial?.id || null);
                    }}
                    style={{...styles.select, flex: 1, marginBottom: 0}}
                  >
                    <option value="">-- Size --</option>
                    <option value="1/2">1/2"</option>
                    <option value="3/4">3/4"</option>
                    <option value="1">1"</option>
                    <option value="1-1/4">1-1/4"</option>
                    <option value="1-1/2">1-1/2"</option>
                    <option value="2">2"</option>
                    <option value="2-1/2">2-1/2"</option>
                    <option value="3">3"</option>
                    <option value="4">4"</option>
                  </select>
                )}
              </div>
              
              {selectedConduitId && (
                <div style={{ fontSize: 13, color: '#059669', fontWeight: '600', marginTop: 8 }}>
                  ✓ {materials.find(m => m.id === selectedConduitId)?.name}
                </div>
              )}
              
              {/* Add Fittings & Accessories after conduit is selected */}
              {selectedConduitId && selectedConduitSize && (() => {
                const size = selectedConduitSize;
                const type = selectedConduitType;
                
                // Helper function to match size and type
                const matchesSizeAndType = (materialName) => {
                  if (!materialName || !size) return false;
                  const escapedSize = size.replace('/', '\\/');
                  const pattern = new RegExp(`(^|[^0-9-])${escapedSize}[″"](?![0-9-])`, 'i');
                  const sizeMatches = pattern.test(materialName);
                  const typeMatches = !type || materialName.toUpperCase().includes(type);
                  return sizeMatches && typeMatches;
                };
                
                return (
                  <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff', borderRadius: 6 }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: '600', color: '#1e40af' }}>
                      Add Fittings & Accessories
                    </h4>
                    
                    {/* Connectors */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: '600', color: '#333', display: 'block', marginBottom: 4 }}>
                        Connectors (ea):
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={selectedConnectorType || ''}
                          onChange={(e) => setSelectedConnectorType(e.target.value || null)}
                          style={{...styles.select, flex: 2, marginBottom: 0}}
                        >
                          <option value="">-- Select Connector --</option>
                          {materials.filter(m => 
                            m.name && 
                            m.name.toLowerCase().includes('connector') &&
                            matchesSizeAndType(m.name)
                          ).map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={connectorQty}
                          onChange={(e) => setConnectorQty(e.target.value)}
                          placeholder="Qty"
                          style={{...styles.select, width: 80, marginBottom: 0}}
                        />
                      </div>
                    </div>
                    
                    {/* Couplings */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: '600', color: '#333', display: 'block', marginBottom: 4 }}>
                        Couplings (per 10 ft):
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={selectedCouplingType || ''}
                          onChange={(e) => setSelectedCouplingType(e.target.value || null)}
                          style={{...styles.select, flex: 2, marginBottom: 0}}
                        >
                          <option value="">-- Select Coupling --</option>
                          {materials.filter(m => 
                            m.name && 
                            m.name.toLowerCase().includes('coupling') &&
                            !m.name.toLowerCase().includes('connector') &&
                            matchesSizeAndType(m.name)
                          ).map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={couplingQtyPer10ft}
                          onChange={(e) => setCouplingQtyPer10ft(e.target.value)}
                          placeholder="Qty/10ft"
                          style={{...styles.select, width: 80, marginBottom: 0}}
                        />
                      </div>
                    </div>
                    
                    {/* Straps */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: '600', color: '#333', display: 'block', marginBottom: 4 }}>
                        Straps (per 10 ft):
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={selectedStrapType || ''}
                          onChange={(e) => setSelectedStrapType(e.target.value || null)}
                          style={{...styles.select, flex: 2, marginBottom: 0}}
                        >
                          <option value="">-- Select Strap --</option>
                          {materials.filter(m => 
                            m.name && 
                            (m.name.toLowerCase().includes('strap') || m.name.toLowerCase().includes('clamp')) &&
                            matchesSizeAndType(m.name)
                          ).map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={strapQtyPer10ft}
                          onChange={(e) => setStrapQtyPer10ft(e.target.value)}
                          placeholder="Qty/10ft"
                          style={{...styles.select, width: 80, marginBottom: 0}}
                        />
                      </div>
                    </div>
                    
                    {/* Fittings - Single dropdown with Add button */}
                    <div style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 13, fontWeight: '600', color: '#333', display: 'block', marginBottom: 4 }}>
                        Fittings (ea):
                      </label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <select
                          value={tempFittingType || ''}
                          onChange={(e) => {
                            const newFittingType = e.target.value || null;
                            
                            // CRITICAL FIX: When changing fitting type selection,
                            // we need to clear any auto-added connectors/couplings from the PREVIOUS selection
                            // (before the user clicks Add button)
                            
                            // Only clear if there was a previous selection
                            if (tempFittingType && tempFittingType !== newFittingType) {
                              console.log('🔄 Fitting type changed - clearing old auto-added items');
                              console.log('  Old type:', tempFittingType);
                              console.log('  New type:', newFittingType);
                              
                              // Remove auto-added items that were added for the OLD fitting type
                              // (These are items with autoAdded: true flag)
                              const cleanedFittings = selectedFittings.filter(f => !f.autoAdded);
                              console.log(`  Removed ${selectedFittings.length - cleanedFittings.length} auto-added items`);
                              setSelectedFittings(cleanedFittings);
                            }
                            
                            setTempFittingType(newFittingType);
                          }}
                          style={{...styles.select, flex: 2, marginBottom: 0}}
                        >
                          <option value="">-- Select Fitting --</option>
                          {materials.filter(m => 
                            m.name && 
                            (m.name.toLowerCase().includes('90') || 
                             m.name.toLowerCase().includes('45') ||
                             m.name.toLowerCase().includes('ell') ||
                             m.name.toLowerCase().match(/\b(lb|ll|lr|t|c)\b/)) &&
                            matchesSizeAndType(m.name)
                          ).map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={tempFittingQty}
                          onChange={(e) => setTempFittingQty(e.target.value)}
                          placeholder="Qty"
                          style={{...styles.select, width: 70, marginBottom: 0}}
                        />
                        <button
                          onClick={() => {
                            if (!tempFittingType || !tempFittingQty || parseInt(tempFittingQty) <= 0) {
                              alert('Select fitting and quantity');
                              return;
                            }
                            const fitting = materials.find(m => m.id === tempFittingType);
                            if (fitting) {
                              const qty = parseInt(tempFittingQty);
                              const lowerName = fitting.name.toLowerCase();
                              
                              console.log('🔍 Adding fitting:', fitting.name);
                              console.log('   auto_add_connector_id:', fitting.auto_add_connector_id);
                              console.log('   auto_add_coupling_id:', fitting.auto_add_coupling_id);
                              console.log('   USER selectedConnectorType:', selectedConnectorType);
                              console.log('   USER selectedCouplingType:', selectedCouplingType);
                              
                              // Build new fittings array with the fitting we're adding
                              let newFittings = [...selectedFittings, {
                                material_id: tempFittingType,
                                material_name: fitting.name,
                                quantity: qty
                              }];
                              
                              // 🎯 CRITICAL FIX: ONLY add connectors for BODIES (LB, LL, LR)
                              // Elbows (90°, 45°) should add COUPLINGS, not connectors
                              const isBody = lowerName.includes('body') || lowerName.match(/\b(lb|ll|lr)\b/i);
                              const isElbow = lowerName.includes('90') || lowerName.includes('45') || lowerName.includes('ell');
                              
                              // Only add connectors if this is a BODY fitting
                              if (isBody) {
                                const connectorIdToUse = selectedConnectorType || fitting.auto_add_connector_id;
                                
                                if (connectorIdToUse) {
                                  console.log('✅ Body fitting - Using connector ID:', connectorIdToUse, selectedConnectorType ? '(USER SELECTED)' : '(from database)');
                                  const connector = materials.find(m => m.id === connectorIdToUse);
                                  
                                  if (connector) {
                                    const connectorQty = qty * 2; // Bodies need 2 connectors
                                    console.log(`   → Auto-adding ${connectorQty} ${connector.name} for body`);
                                    
                                    // ALWAYS add as NEW entry - don't merge with base connectors
                                    newFittings.push({
                                      material_id: connector.id,
                                      material_name: connector.name,
                                      quantity: connectorQty,
                                      autoAdded: true,
                                      fromFitting: true
                                    });
                                    console.log(`   → Added ${connectorQty} connector(s) as separate fitting entry`);
                                  } else {
                                    console.warn('   ⚠️ Could not find connector with ID:', connectorIdToUse);
                                  }
                                }
                                // CRITICAL: Don't add couplings for bodies - skip the coupling logic
                                console.log('✅ Body fitting - skipping coupling logic (bodies only need connectors)');
                              } else if (isElbow) {
                                // ONLY add couplings for elbows (90°, 45°)
                                console.log('✅ Elbow fitting - adding coupling...');
                                
                                // 🎯 Use USER-SELECTED coupling type if they chose one,
                                // otherwise fall back to database auto_add_coupling_id
                                const couplingIdToUse = selectedCouplingType || fitting.auto_add_coupling_id;
                                
                                if (couplingIdToUse) {
                                  console.log('✅ Using coupling ID:', couplingIdToUse, selectedCouplingType ? '(USER SELECTED)' : '(from database)');
                                  const coupling = materials.find(m => m.id === couplingIdToUse);
                                  
                                  if (coupling) {
                                    console.log(`   → Auto-adding ${qty} ${coupling.name}`);
                                    
                                    // ALWAYS add as NEW entry - don't merge with other fittings' couplings
                                    // Each fitting's couplings should be a separate line item
                                    newFittings.push({
                                      material_id: coupling.id,
                                      material_name: coupling.name,
                                      quantity: qty,
                                      autoAdded: true,
                                      fromFitting: true // Flag to indicate this is from a fitting, not base
                                    });
                                    console.log(`   → Added ${qty} coupling(s) as separate fitting entry`);
                                  } else {
                                    console.warn('   ⚠️ Could not find coupling with ID:', fitting.auto_add_coupling_id);
                                  }
                                }
                              }
                              
                              // FALLBACK: If no auto_add_coupling_id in database, use old logic
                              // (This is for backwards compatibility with old data)
                              if (!fitting.auto_add_coupling_id && (lowerName.includes('90') || lowerName.includes('45') || lowerName.includes('ell') || lowerName.includes('elbow'))) {
                                console.log('90/45 degree fitting detected - adding couplings as FIXED items');
                                
                                // Use the coupling type the user selected, OR search for a matching one
                                let coupling = null;
                                if (selectedCouplingType) {
                                  // User already selected a coupling type - use that!
                                  coupling = materials.find(m => m.id === selectedCouplingType);
                                  console.log('Using user-selected coupling type:', coupling?.name);
                                } else {
                                  // No coupling selected yet - search for one (any type that matches size)
                                  coupling = materials.find(m => 
                                    m.name && 
                                    m.name.toLowerCase().includes('coupling') &&
                                    !m.name.toLowerCase().includes('connector') &&
                                    matchesSizeAndType(m.name)
                                  );
                                  console.log('Auto-found coupling:', coupling?.name);
                                }
                                
                                if (coupling) {
                                  // Check if coupling already exists in newFittings (not selectedFittings!)
                                  const existingCouplingIndex = newFittings.findIndex(f => f.material_id === coupling.id);
                                  
                                  if (existingCouplingIndex >= 0) {
                                    // Update existing coupling quantity
                                    newFittings[existingCouplingIndex] = {
                                      ...newFittings[existingCouplingIndex],
                                      quantity: newFittings[existingCouplingIndex].quantity + qty
                                    };
                                    console.log(`Updated coupling quantity to ${newFittings[existingCouplingIndex].quantity}`);
                                  } else {
                                    // Add new coupling entry
                                    console.log(`Adding ${qty} coupling(s) as fixed items`);
                                    newFittings.push({
                                      material_id: coupling.id,
                                      material_name: coupling.name,
                                      quantity: qty,
                                      autoAdded: true // Mark as auto-added so it shows inline
                                    });
                                  }
                                } else {
                                  console.warn('Could not find coupling for size', size);
                                }
                              }
                              
                              // Update state once with all fittings (including auto-added ones)
                              setSelectedFittings(newFittings);
                              
                              setTempFittingType(null);
                              setTempFittingQty('');
                            }
                          }}
                          style={{...styles.saveButton, flex: 0, padding: '8px 12px', marginTop: 0, whiteSpace: 'nowrap'}}
                        >
                          + Add
                        </button>
                      </div>
                      
                      {/* Show added fittings */}
                      {selectedFittings.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {selectedFittings.map((fitting, idx) => {
                            const lowerName = fitting.material_name.toLowerCase();
                            
                            // CRITICAL FIX: Skip ALL auto-added items (connectors AND couplings)
                            // They're shown inline with their parent fitting, not as separate lines
                            const isConnector = lowerName.includes('connector');
                            const isCoupling = lowerName.includes('coupling') && !lowerName.includes('connector');
                            
                            if (fitting.autoAdded && (isConnector || isCoupling)) {
                              return null; // Don't show as separate line
                            }
                            
                            // Determine what was auto-added based on fitting type
                            let autoAddedText = '';
                            
                            if (lowerName.match(/\b(lb|lr|ll)\b/) || lowerName.includes('body')) {
                              autoAddedText = ` + ${fitting.quantity * 2} Connectors`;
                            } else if (lowerName.includes('90') || lowerName.includes('45') || lowerName.includes('ell') || lowerName.includes('elbow')) {
                              autoAddedText = ` + ${fitting.quantity} Coupling`;
                            }
                            
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#f9fafb', borderRadius: 4, marginBottom: 4, fontSize: 13, border: '1px solid #e5e7eb' }}>
                                <span style={{ color: '#1a1a1a' }}>
                                  {fitting.quantity}× {fitting.material_name}
                                  {autoAddedText && <span style={{ color: '#059669', fontWeight: '600' }}>{autoAddedText}</span>}
                                </span>
                                <button
                                  onClick={() => {
                                    const lowerName = fitting.material_name.toLowerCase();
                                    
                                    // Calculate how many connectors/couplings to remove
                                    let connectorsToRemove = 0;
                                    let couplingsToRemove = 0;
                                    
                                    if (lowerName.match(/\b(lb|lr|ll)\b/) || lowerName.includes('body')) {
                                      connectorsToRemove = fitting.quantity * 2;
                                    } else if (lowerName.includes('90') || lowerName.includes('45') || lowerName.includes('ell') || lowerName.includes('elbow')) {
                                      couplingsToRemove = fitting.quantity;
                                    }
                                    
                                    // Remove the fitting and adjust connectors/couplings
                                    let updatedFittings = selectedFittings.filter((_, i) => i !== idx);
                                    
                                    // Decrement connectors if needed
                                    if (connectorsToRemove > 0 && selectedConnectorType) {
                                      const currentQty = parseFloat(connectorQty) || 0;
                                      const newQty = Math.max(0, currentQty - connectorsToRemove);
                                      setConnectorQty(newQty > 0 ? newQty.toString() : '');
                                      console.log(`Removed ${connectorsToRemove} connectors, new qty: ${newQty}`);
                                    }
                                    
                                    // Remove auto-added couplings if needed
                                    if (couplingsToRemove > 0) {
                                      updatedFittings = updatedFittings.map(f => {
                                        // Find auto-added couplings
                                        if (f.autoAdded && f.material_name.toLowerCase().includes('coupling')) {
                                          const newQty = f.quantity - couplingsToRemove;
                                          if (newQty <= 0) {
                                            return null; // Mark for removal
                                          }
                                          return { ...f, quantity: newQty };
                                        }
                                        return f;
                                      }).filter(f => f !== null); // Remove marked items
                                      console.log(`Removed ${couplingsToRemove} auto-added couplings`);
                                    }
                                    
                                    setSelectedFittings(updatedFittings);
                                  }}
                                  style={{ padding: '2px 6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Step 2: Wire Selection */}
            {selectedConduitId && (
              <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#fef3c7', borderRadius: 8, border: '2px solid #f59e0b' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: '600', color: '#92400e' }}>
                  Step 2: Add Wires
                </h3>
                
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select
                    value={tempWireId || ''}
                    onChange={(e) => setTempWireId(e.target.value || null)}
                    style={{
                      padding: '12px',
                      fontSize: 16,
                      border: '2px solid #ddd',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                      color: '#000',
                      flex: 2,
                      marginBottom: 0,
                      width: 'auto'
                    }}
                  >
                    <option value="" style={{ color: '#000', backgroundColor: '#fff' }}>-- Select Wire --</option>
                    {materials
                      .filter(m => m.category === 'Wire' && m.name.includes('THHN'))
                      .map(wire => (
                        <option key={wire.id} value={wire.id} style={{ color: '#000', backgroundColor: '#fff' }}>{wire.name}</option>
                      ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={tempWireQty}
                    onChange={(e) => setTempWireQty(e.target.value)}
                    placeholder="Qty"
                    style={{...styles.select, width: 70, marginBottom: 0}}
                  />
                  <button
                    onClick={() => {
                      if (!tempWireId || !tempWireQty) {
                        alert('Select wire and quantity');
                        return;
                      }
                      const wire = materials.find(m => m.id === tempWireId);
                      if (wire) {
                        setSelectedWires([...selectedWires, {
                          material_id: tempWireId,
                          material_name: wire.name,
                          quantity: parseInt(tempWireQty)
                        }]);
                        setTempWireId(null);
                        setTempWireQty('');
                      }
                    }}
                    style={{...styles.saveButton, flex: 0, padding: '8px 12px', marginTop: 0}}
                  >
                    + Add
                  </button>
                </div>
                
                {selectedWires.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {selectedWires.map((wire, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#fff', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                        <span style={{ color: '#000' }}>{wire.quantity}× {wire.material_name}</span>
                        <button
                          onClick={() => setSelectedWires(selectedWires.filter((_, i) => i !== idx))}
                          style={{ padding: '2px 6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            

            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowQuickAssemblyModal(false);
                  setQuickAssemblyName('');
                  setQuickAssemblyComponents([]);
                  setSelectedBaseAssembly(null);
                  setSelectedConnectorType(null);
                  setConnectorQty('');
                  setSelectedCouplingType(null);
                  setCouplingQtyPer10ft('');
                  setSelectedStrapType(null);
                  setStrapQtyPer10ft('');
                  setSelectedFittings([]);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={prepareAssemblyPreview} 
                style={styles.saveButton}
                disabled={!quickAssemblyName.trim() || (quickAssemblyComponents.length === 0 && !selectedBaseAssembly && !selectedConduitId)}
              >
                Save Assembly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conduit Fittings Modal */}
      {showFittingsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowFittingsModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 700}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>⚡ Add Conduit Fittings & Materials</h2>
            
            <p style={styles.modalDescription}>
              <strong>{conduitSize}</strong> - Add any additional materials for this conduit run (fittings, couplings, straps, etc.)
            </p>
            
            {/* Manual Material Add Section */}
            <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
              <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: '600' }}>Add Materials</h3>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select
                  value={tempMaterialCategory}
                  onChange={(e) => {
                    setTempMaterialCategory(e.target.value);
                    setTempMaterialId(null);
                  }}
                  style={{...styles.select, flex: 1, marginBottom: 0}}
                >
                  <option value="">Category...</option>
                  {[...new Set(materials.map(m => m.category))].sort().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                
                {tempMaterialCategory && (
                  <select
                    value={tempMaterialId || ''}
                    onChange={(e) => setTempMaterialId(e.target.value || null)}
                    style={{...styles.select, flex: 2, marginBottom: 0}}
                  >
                    <option value="">Material...</option>
                    {materials
                      .filter(m => m.category === tempMaterialCategory)
                      .map(material => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                  </select>
                )}
                
                <input
                  type="number"
                  step="0.1"
                  value={tempMaterialQuantity}
                  onChange={(e) => setTempMaterialQuantity(e.target.value)}
                  placeholder="Qty"
                  style={{...styles.select, width: 80, marginBottom: 0}}
                />
                
                <button
                  onClick={() => {
                    if (!tempMaterialId || !tempMaterialQuantity || parseFloat(tempMaterialQuantity) <= 0) {
                      alert('Please select a material and enter a valid quantity');
                      return;
                    }
                    const material = materials.find(m => m.id === tempMaterialId);
                    if (!material) return;
                    
                    // Add to either editLengthMaterials or measurementMaterials depending on mode
                    const newMaterial = {
                      material_id: tempMaterialId,
                      material_name: material.name,
                      quantity: parseFloat(tempMaterialQuantity),
                      unit: material.unit || 'ea'
                    };
                    
                    if (editingLengthId) {
                      setEditLengthMaterials([...editLengthMaterials, newMaterial]);
                    } else {
                      setMeasurementMaterials([...measurementMaterials, newMaterial]);
                    }
                    
                    // Reset temp fields
                    setTempMaterialId(null);
                    setTempMaterialCategory('');
                    setTempMaterialQuantity('');
                  }}
                  style={{...styles.saveButton, flex: 0, padding: '8px 16px', marginTop: 0}}
                >
                  + Add
                </button>
              </div>
              
              {/* Show current materials list */}
              {((editingLengthId && editLengthMaterials.length > 0) || 
                (!editingLengthId && measurementMaterials.length > 0)) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                    Materials to add with this measurement:
                  </div>
                  {(editingLengthId ? editLengthMaterials : measurementMaterials).map((mat, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', borderRadius: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: '500', color: '#1a1a1a' }}>{mat.material_name}</span>
                      <span style={{ fontSize: 13, color: '#666' }}>{mat.quantity} {mat.unit}</span>
                      <button
                        onClick={() => {
                          if (editingLengthId) {
                            setEditLengthMaterials(editLengthMaterials.filter((_, i) => i !== idx));
                          } else {
                            setMeasurementMaterials(measurementMaterials.filter((_, i) => i !== idx));
                          }
                        }}
                        style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, marginTop: 16, fontSize: 13, color: '#0369a1' }}>
              💡 <strong>Tip:</strong> Add 90's, 45's, couplings, straps, or any other materials for this conduit run
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowFittingsModal(false);
                  setFittings90Count('');
                  setFittings45Count('');
                  setConduitSize('');
                }} 
                style={styles.cancelButton}
              >
                Skip
              </button>
              <button 
                onClick={async () => {
                  // Add fittings to materials list
                  const count90 = parseInt(fittings90Count) || 0;
                  const count45 = parseInt(fittings45Count) || 0;
                  const totalFittings = count90 + count45;
                  
                  const newFittings = [];
                  
                  if (totalFittings > 0) {
                    // Extract conduit size from assembly name (e.g., "3/4" from "3/4″ EMT...")
                    const sizeMatch = conduitSize.match(/(\d+\/\d+|\d+)/);
                    const size = sizeMatch ? sizeMatch[0] : '';
                    
                    console.log('🔍 FITTINGS SEARCH DEBUG:');
                    console.log('Conduit size string:', conduitSize);
                    console.log('Extracted size:', size);
                    console.log('Looking for 90° fitting with: size=' + size + ', contains "90", contains "ell"');
                    console.log('Looking for 45° fitting with: size=' + size + ', contains "45"');
                    console.log('Looking for coupling with: size=' + size + ', contains "coupling"');
                    console.log('Total materials in database:', materials.length);
                    
                    // Show sample materials that contain "EMT"
                    const emtMaterials = materials.filter(m => m.name && m.name.includes('EMT'));
                    console.log('Sample EMT materials:', emtMaterials.slice(0, 10).map(m => m.name));
                    
                    // Helper function to match size precisely (not as substring)
                    // Matches: '2" EMT' but NOT '1-1/2" EMT'
                    const sizeMatches = (name, targetSize) => {
                      if (!name || !targetSize) return false;
                      
                      // For fractions like "3/4", search for exact match
                      if (targetSize.includes('/')) {
                        // Must be preceded by start of string or space, and followed by inch mark
                        return (name.startsWith(`${targetSize}"`) || 
                                name.startsWith(`${targetSize}″`) ||
                                name.includes(` ${targetSize}"`) || 
                                name.includes(` ${targetSize}″`));
                      }
                      
                      // For whole numbers like "2"
                      // CRITICAL: Exclude if preceded by "/" (like "1/2") or "-" (like "1-2")
                      // Must be at start OR preceded by space
                      // Must be followed by " or ″ (inch marks)
                      
                      // Check if starts with the size
                      if (name.startsWith(`${targetSize}"`) || name.startsWith(`${targetSize}″`)) {
                        return true;
                      }
                      
                      // Check if has space before size
                      const spacePattern = ` ${targetSize}"`;
                      const spacePattern2 = ` ${targetSize}″`;
                      if (name.includes(spacePattern) || name.includes(spacePattern2)) {
                        // Make sure it's not preceded by a slash or dash
                        const index1 = name.indexOf(spacePattern);
                        const index2 = name.indexOf(spacePattern2);
                        const index = index1 >= 0 ? index1 : index2;
                        
                        if (index > 0) {
                          const charBefore = name[index - 1];
                          // If char before space is / or -, reject it
                          if (charBefore === '/' || charBefore === '-') {
                            return false;
                          }
                        }
                        return true;
                      }
                      
                      return false;
                    };
                    
                    // Search for matching fittings in materials
                    if (count90 > 0) {
                      const fitting90 = materials.find(m => 
                        m.name && 
                        m.name.toLowerCase().includes('90') && 
                        m.name.toLowerCase().includes('ell') &&
                        sizeMatches(m.name, size)
                      );
                      console.log('Found 90° fitting:', fitting90?.name);
                      if (fitting90) {
                        newFittings.push({
                          material_id: fitting90.id,
                          material_name: fitting90.name,
                          quantity: count90,
                          unit: fitting90.unit || 'ea'
                        });
                      } else {
                        console.warn('Could not find 90° fitting for size:', size);
                      }
                    }
                    
                    if (count45 > 0) {
                      const fitting45 = materials.find(m => 
                        m.name && 
                        m.name.toLowerCase().includes('45') && 
                        sizeMatches(m.name, size)
                      );
                      console.log('Found 45° fitting:', fitting45?.name);
                      if (fitting45) {
                        newFittings.push({
                          material_id: fitting45.id,
                          material_name: fitting45.name,
                          quantity: count45,
                          unit: fitting45.unit || 'ea'
                        });
                      } else {
                        console.warn('Could not find 45° fitting for size:', size);
                      }
                    }
                    
                    // Add couplings (1 per fitting) - look for "set screw coupling" or just "coupling"
                    const coupling = materials.find(m => 
                      m.name && 
                      m.name.toLowerCase().includes('coupling') &&
                      sizeMatches(m.name, size)
                    );
                    console.log('Found coupling:', coupling?.name);
                    if (coupling && totalFittings > 0) {
                      newFittings.push({
                        material_id: coupling.id,
                        material_name: coupling.name,
                        quantity: totalFittings,
                        unit: coupling.unit || 'ea'
                      });
                    } else if (!coupling) {
                      console.warn('Could not find coupling for size:', size);
                    }
                  }
                  
                  console.log('Adding fittings to materials:', newFittings);
                  
                  // Close modal
                  setShowFittingsModal(false);
                  setFittings90Count('');
                  setFittings45Count('');
                  setConduitSize('');
                  
                  // Check if we're editing or creating new
                  if (editingLengthId) {
                    // EDIT mode - call the edit function
                    saveEditedLengthMaterials(newFittings);
                  } else {
                    // CREATE mode - call the create function
                    saveMeasurementWithLabel(newFittings);
                  }
                }}
                style={styles.saveButton}
              >
                Add Fittings & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parametric Assembly Quantities Modal */}
      {showParametricModal && (
        <div style={styles.modalOverlay} onClick={() => setShowParametricModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📝 Specify Quantities</h2>
            
            <p style={styles.modalDescription}>
              Enter the quantities for these components (leave at 0 to remove):
            </p>
            
            {/* List of qty=0 components with input fields */}
            <div style={{ marginTop: 20, marginBottom: 24 }}>
              {parametricComponents.map((comp, idx) => (
                <div key={comp.id} style={{ marginBottom: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 }}>
                    {comp.material_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 13, color: '#666', minWidth: 80 }}>Quantity:</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={parametricQuantities[comp.id] || 0}
                      onChange={(e) => {
                        setParametricQuantities({
                          ...parametricQuantities,
                          [comp.id]: parseFloat(e.target.value) || 0
                        });
                      }}
                      style={{...styles.select, marginBottom: 0, width: 100}}
                      autoFocus={idx === 0}
                    />
                    <span style={{ fontSize: 13, color: '#666' }}>{comp.unit}</span>
                  </div>
                  {comp.description && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                      💡 {comp.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#0369a1' }}>
              💡 <strong>Tip:</strong> Components with 0 quantity will be removed from the assembly
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowParametricModal(false);
                  setParametricComponents([]);
                  setParametricQuantities({});
                  setParametricAssemblyId(null);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  console.log('📝 Updating assembly components with user-entered quantities');
                  console.log('Assembly ID:', parametricAssemblyId);
                  console.log('User quantities:', parametricQuantities);
                  
                  // Find the assembly in the materials list
                  const materialsList = editingLengthId ? editLengthMaterials : measurementMaterials;
                  const assemblyIndex = materialsList.findIndex(m => m.material_id === parametricAssemblyId);
                  
                  if (assemblyIndex === -1) {
                    console.error('Assembly not found in materials list!');
                    alert('Error: Assembly not found');
                    return;
                  }
                  
                  // Get the assembly
                  const assembly = materialsList[assemblyIndex];
                  console.log('Found assembly:', assembly.material_name);
                  console.log('Current components:', assembly.components);
                  
                  // Update components: replace 0-qty components with user values, keep non-zero as-is
                  const updatedComponents = assembly.components.map(comp => {
                    // If this component had qty=0 (was in parametric list)
                    const wasParametric = parametricComponents.find(pc => 
                      pc.material_id === comp.material_id && 
                      pc.material_name === comp.material_name
                    );
                    
                    if (wasParametric) {
                      // Use user-entered quantity (or 0 if not entered)
                      const newQty = parametricQuantities[wasParametric.id] || 0;
                      console.log(`  Updating ${comp.material_name}: 0 → ${newQty}`);
                      return { ...comp, quantity: newQty };
                    } else {
                      // Keep existing component as-is
                      return comp;
                    }
                  }).filter(comp => comp.quantity > 0); // Remove components with 0 qty
                  
                  console.log('Updated components:', updatedComponents);
                  console.log('📦 Components after parametric update (NO auto-increment here - will happen in preview):', updatedComponents);
                  
                  // Update the assembly in the materials list
                  const updatedMaterialsList = [...materialsList];
                  updatedMaterialsList[assemblyIndex] = {
                    ...assembly,
                    components: updatedComponents
                  };
                  
                  console.log('✅ Assembly updated with new component quantities');
                  console.log('📤 Updated materials list:', updatedMaterialsList);
                  
                  // Close modal first
                  setShowParametricModal(false);
                  setParametricComponents([]);
                  setParametricQuantities({});
                  setParametricAssemblyId(null);
                  
                  // CRITICAL FIX: Don't use state - save directly with updated materials
                  if (editingLengthId) {
                    // For editing, save immediately with updated materials list
                    console.log('💾 Saving directly with updated materials (no state delay)');
                    console.log('Updated materials list:', updatedMaterialsList);
                    
                    try {
                      const materialsToStore = updatedMaterialsList.map(m => {
                        const materialData = {
                          material_id: m.material_id,
                          quantity: m.quantity
                        };
                        // CRITICAL: Store components if this is an assembly
                        if (m.isAssembly && m.components && m.components.length > 0) {
                          materialData.components = m.components;
                          console.log(`💾 Saving assembly ${m.material_name} with ${m.components.length} components:`, m.components);
                        }
                        return materialData;
                      });
                      
                      console.log('💾 Final materialsToStore array:', materialsToStore);
                      
                      const { error } = await supabase
                        .from('plan_measurements')
                        .update({ materials: materialsToStore })
                        .eq('id', editingLengthId);
                      
                      if (error) throw error;
                      
                      await loadMeasurements();
                      await loadLayers();
                      
                      setShowEditLengthModal(false);
                      setEditingLengthId(null);
                      setEditLengthMaterials([]);
                      
                      console.log('✅ Materials updated successfully!');
                    } catch (err) {
                      console.error('Error updating materials:', err);
                      alert('Failed to update materials: ' + err.message);
                    }
                  } else {
                    // For new measurements, pass the updated materials DIRECTLY (don't use state)
                    console.log('💾 Saving NEW measurement with updated assembly components (bypassing state)');
                    console.log('Updated materials list:', updatedMaterialsList);
                    
                    // Close parametric modal first
                    setShowParametricModal(false);
                    setParametricComponents([]);
                    setParametricQuantities({});
                    setParametricAssemblyId(null);
                    
                    // CRITICAL: Pass updated materials directly as override (3rd parameter)
                    // This bypasses the state completely and uses the updated list immediately
                    saveMeasurementWithLabel([], updatedMaterialsList);
                  }
                }}
                style={styles.saveButton}
              >
                Save with Quantities
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Count Type Selection Modal */}
      {showCountTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCountTypeModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>How would you like to save this count?</h2>
            
            <p style={styles.modalDescription}>
              Count: <strong>{countMarkers.filter(m => !m.measurementId).length} items</strong>
            </p>
            
            {/* Three Option Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, marginBottom: 24 }}>
              {/* Option 1: Single Line Item */}
              <button
                onClick={() => {
                  setSelectedCountType('single');
                  setShowCountTypeModal(false);
                  setShowCountModal(true);
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#f0f9ff',
                  border: '2px solid #3b82f6',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>
                  📝 Single Line Item
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Save as a simple count with a label and optional material link
                </div>
              </button>
              
              {/* Option 2: Select Predefined Assembly */}
              <button
                onClick={() => {
                  setSelectedCountType('assembly');
                  setShowCountTypeModal(false);
                  setShowAssemblySelectionModal(true);
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#92400e', marginBottom: 8 }}>
                  🔧 Select Assembly
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Choose from existing assemblies with multiple components
                </div>
              </button>
              
              {/* Option 3: Create New Assembly */}
              <button
                onClick={() => {
                  setSelectedCountType('create');
                  setShowCountTypeModal(false);
                  openQuickAssemblyModal();
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #10b981',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#065f46', marginBottom: 8 }}>
                  ✨ Create New Assembly
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Build a custom assembly from scratch for this count
                </div>
              </button>
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowCountTypeModal(false);
                  setSelectedCountType(null);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assembly Selection Modal */}
      {showAssemblySelectionModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAssemblySelectionModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Select Assembly</h2>
            
            <p style={styles.modalDescription}>
              Choose an assembly to attach to this count. Each marker will represent one assembly instance.
            </p>
            
            {/* Label Input */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Label (optional):</label>
              <input 
                type="text"
                value={measurementLabel} 
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder="e.g., Receptacles, Panel Boards, Junction Boxes"
                style={styles.select}
                autoFocus
              />
            </div>
            
            {/* Search/Filter */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Search Assembly:</label>
              <input 
                type="text"
                value={assemblySearchTerm} 
                onChange={(e) => setAssemblySearchTerm(e.target.value)}
                placeholder="Search assemblies..."
                style={styles.select}
              />
            </div>
            
            {/* Category Filter */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Category:</label>
              <select
                value={selectedAssemblyCategory}
                onChange={(e) => setSelectedAssemblyCategory(e.target.value)}
                style={styles.select}
              >
                <option value="">-- All Categories --</option>
                {[...new Set(materials.filter(m => m.unit === 'assembly').map(m => m.category))].sort().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            {/* Assembly List */}
            <div style={{ marginTop: 20, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
              {materials
                .filter(m => {
                  if (m.unit !== 'assembly') return false;
                  if (selectedAssemblyCategory && m.category !== selectedAssemblyCategory) return false;
                  if (assemblySearchTerm && !m.name.toLowerCase().includes(assemblySearchTerm.toLowerCase())) return false;
                  return true;
                })
                .map(assembly => (
                  <div
                    key={assembly.id}
                    onClick={() => {
                      console.log('🔍 Assembly clicked:', assembly.name);
                      console.log('  editingLengthId:', editingLengthId);
                      console.log('  pendingMeasurement:', pendingMeasurement);
                      console.log('  unsaved markers:', countMarkersRef.current.filter(m => !m.measurementId).length);
                      
                      setSelectedAssemblyId(assembly.id);
                      setSelectedMaterialId(assembly.id);
                      
                      // CRITICAL: Check if this is for LENGTH or COUNT
                      // LENGTH indicators: editingLengthId OR pendingMeasurement
                      // COUNT indicators: unsaved markers exist
                      
                      const isLengthMeasurement = !!(editingLengthId || pendingMeasurement);
                      const unsavedMarkers = countMarkersRef.current.filter(m => !m.measurementId);
                      
                      console.log('  isLengthMeasurement:', isLengthMeasurement);
                      console.log('  Decision: Will ' + (isLengthMeasurement ? 'show measurement modal' : 'save count'));
                      
                      if (isLengthMeasurement) {
                        // LENGTH MEASUREMENT MODE
                        console.log('✅ Length measurement detected - showing measurement modal');
                        setShowAssemblySelectionModal(false);
                        setShowCountTypeModal(false);
                        setSelectedCountType(null);
                        
                        // Add assembly to materials list
                        setMeasurementMaterials([...measurementMaterials, {
                          material_id: assembly.id,
                          material_name: assembly.name,
                          quantity: 1,
                          unit: 'ea',
                          isAssembly: true
                        }]);
                        
                        // Show measurement modal to finalize
                        setShowMeasurementModal(true);
                      } else {
                        // COUNT MEASUREMENT MODE
                        console.log('✅ Count measurement detected');
                        if (unsavedMarkers.length === 0) {
                          alert('⚠️ Please place count markers on the plan first!');
                          return;
                        }
                        
                        setShowAssemblySelectionModal(false);
                        setShowCountTypeModal(false);
                        setSelectedCountType(null);
                        // CRITICAL FIX: Pass assembly.id directly to saveCount()
                        // because setSelectedMaterialId() is async and hasn't updated yet!
                        saveCount(assembly.id);
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      marginBottom: 8,
                      backgroundColor: selectedAssemblyId === assembly.id ? '#e0f2fe' : '#f9fafb',
                      border: selectedAssemblyId === assembly.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 }}>
                      🔧 {assembly.name}
                    </div>
                    {assembly.description && (
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {assembly.description}
                      </div>
                    )}
                  </div>
                ))}
              {materials.filter(m => {
                if (m.unit !== 'assembly') return false;
                if (selectedAssemblyCategory && m.category !== selectedAssemblyCategory) return false;
                if (assemblySearchTerm && !m.name.toLowerCase().includes(assemblySearchTerm.toLowerCase())) return false;
                return true;
              }).length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  No assemblies found. Try adjusting your filters.
                </div>
              )}
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowAssemblySelectionModal(false);
                  setAssemblySearchTerm('');
                  setSelectedAssemblyCategory('');
                  setSelectedAssemblyId(null);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Length Type Selection Modal */}
      {showLengthTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLengthTypeModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>How would you like to save this length measurement?</h2>
            
            <p style={styles.modalDescription}>
              Measurement: <strong>{pendingMeasurement?.realDistance?.toFixed(2)} feet</strong>
            </p>
            
            {/* Drop Footage Inputs - MOVED HERE */}
            <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#fef3c7', borderRadius: 8, border: '2px solid #fbbf24' }}>
              <div style={{ fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 12 }}>
                📏 Add Drop Footage (optional):
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#92400e', marginBottom: 4, display: 'block' }}>Start Drop (ft):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={startDropFootage}
                    onChange={(e) => setStartDropFootage(e.target.value)}
                    placeholder="0"
                    style={{...styles.select, marginBottom: 0}}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#92400e', marginBottom: 4, display: 'block' }}>End Drop (ft):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={endDropFootage}
                    onChange={(e) => setEndDropFootage(e.target.value)}
                    placeholder="0"
                    style={{...styles.select, marginBottom: 0}}
                  />
                </div>
              </div>
              {(startDropFootage || endDropFootage) && (
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: '600', color: '#059669', textAlign: 'center' }}>
                  Total with Drops: {(
                    (pendingMeasurement?.realDistance || 0) + 
                    (parseFloat(startDropFootage) || 0) + 
                    (parseFloat(endDropFootage) || 0)
                  ).toFixed(2)} feet
                </div>
              )}
            </div>
            
            {/* Three Option Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, marginBottom: 24 }}>
              {/* Option 1: Single Line Item or Multiple Materials */}
              <button
                onClick={() => {
                  setSelectedLengthType('single');
                  setShowLengthTypeModal(false);
                  setShowMeasurementModal(true);
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#f0f9ff',
                  border: '2px solid #3b82f6',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>
                  📝 Add Materials Manually
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Choose individual materials or create a custom assembly for this run
                </div>
              </button>
              
              {/* Option 2: Select Predefined Assembly */}
              <button
                onClick={() => {
                  setSelectedLengthType('assembly');
                  setShowLengthTypeModal(false);
                  setShowAssemblySelectionModal(true);
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#92400e', marginBottom: 8 }}>
                  🔧 Select Assembly
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Use a predefined conduit/wire assembly with all components included
                </div>
              </button>
              
              {/* Option 3: Create New Assembly */}
              <button
                onClick={() => {
                  setSelectedLengthType('create');
                  setShowLengthTypeModal(false);
                  openQuickAssemblyModal();
                }}
                style={{
                  padding: '20px 24px',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #10b981',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: '600', color: '#065f46', marginBottom: 8 }}>
                  ✨ Create New Assembly
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Build a reusable assembly from scratch for this measurement
                </div>
              </button>
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  // Cancel and remove the line segments
                  if (pendingMeasurement?.segments && canvas) {
                    pendingMeasurement.segments.forEach(seg => canvas.remove(seg));
                    canvas.renderAll();
                  }
                  setShowLengthTypeModal(false);
                  setSelectedLengthType(null);
                  setPendingMeasurement(null);
                  // Reset polyline state
                  polylinePointsRef.current = [];
                  setPolylinePoints([]);
                  polylineSegmentsRef.current = [];
                  setPolylineSegments([]);
                  setAccumulatedDistance(0);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assembly Preview/Confirmation Modal */}
      {showAssemblyPreviewModal && previewAssemblyData && (
        <div style={styles.modalOverlay} onClick={() => setShowAssemblyPreviewModal(false)}>
          <div style={{...styles.modalContent, maxWidth: 700, maxHeight: '90vh', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>✅ Preview Assembly</h2>
            
            <p style={styles.modalDescription}>
              Review your assembly before saving. This will be {previewAssemblyData.savePermanently ? 'saved permanently to your library' : 'used for this measurement only'}.
            </p>
            
            {/* Show measurement length if we have it */}
            {pendingMeasurement && (
              <div style={{ padding: 12, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 16, border: '2px solid #fbbf24' }}>
                <div style={{ fontSize: 14, fontWeight: '600', color: '#92400e' }}>
                  📏 Measurement Length: {pendingMeasurement.realDistance?.toFixed(2)} feet
                  {(startDropFootage || endDropFootage) && (
                    <span style={{ marginLeft: 8 }}>
                      (+ {((parseFloat(startDropFootage) || 0) + (parseFloat(endDropFootage) || 0)).toFixed(1)} ft drops)
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Assembly Name */}
            <div style={{ padding: 16, backgroundColor: '#f0f9ff', borderRadius: 8, marginBottom: 20, border: '2px solid #3b82f6' }}>
              <div style={{ fontSize: 18, fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>
                🔧 {previewAssemblyData.name}
              </div>
              <div style={{ fontSize: 13, color: '#0369a1' }}>
                {previewAssemblyData.finalComponents.length} component{previewAssemblyData.finalComponents.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Save to Library Checkbox */}
            <div style={{ padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, marginBottom: 20, border: '2px solid #3b82f6' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={saveQuickAssemblyPermanently}
                  onChange={(e) => setSaveQuickAssemblyPermanently(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: '600', color: '#1e40af' }}>
                  💾 Save to Assemblies Library
                </span>
              </label>
              <p style={{ margin: '8px 0 0 26px', fontSize: 12, color: '#0369a1', lineHeight: 1.5 }}>
                {saveQuickAssemblyPermanently 
                  ? 'This assembly will be saved permanently and available for all future projects.'
                  : 'This assembly will only be used for this measurement and will not be saved permanently.'}
              </p>
            </div>
            
            {/* Components List */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: '600', color: '#333' }}>Components:</h3>
              
              {previewAssemblyData.finalComponents.map((comp, idx) => {
                // USE roundedQuantity if it exists (already calculated in prepareAssemblyPreview)
                // Otherwise calculate it here (fallback for old data)
                let totalQty = comp.roundedQuantity;
                let showCalculation = false;
                
                if (!totalQty && pendingMeasurement) {
                  const baseMeasurement = pendingMeasurement.realDistance || 0;
                  const startDrop = parseFloat(startDropFootage) || 0;
                  const endDrop = parseFloat(endDropFootage) || 0;
                  const measurementLength = baseMeasurement + startDrop + endDrop;
                  
                  if (comp.quantity_type === 'per_foot') {
                    totalQty = comp.quantity * measurementLength;
                    showCalculation = true;
                  } else if (comp.quantity_type === 'per_10_feet') {
                    totalQty = comp.quantity * (measurementLength / 10);
                    showCalculation = true;
                  } else if (comp.quantity_type === 'per_100_feet') {
                    totalQty = comp.quantity * (measurementLength / 100);
                    showCalculation = true;
                  }
                } else {
                  // We have a pre-rounded quantity
                  showCalculation = true;
                }
                
                return (
                  <div key={idx} style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 6, marginBottom: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 }}>
                          {comp.material_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          Base: {comp.quantity} {comp.unit}
                          {comp.quantity_type && comp.quantity_type !== 'fixed' && (
                            <span style={{ marginLeft: 4, color: '#999' }}>
                              × {comp.quantity_type === 'per_foot' ? 'Per Foot' :
                                 comp.quantity_type === 'per_10_feet' ? 'Per 10 Feet' :
                                 comp.quantity_type === 'per_100_feet' ? 'Per 100 Feet' : comp.quantity_type}
                            </span>
                          )}
                        </div>
                        {showCalculation && (
                          <div style={{ fontSize: 13, fontWeight: '600', color: '#059669' }}>
                            → Total: {totalQty.toFixed(2)} {comp.unit}
                          </div>
                        )}
                        {comp.description && (
                          <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 4 }}>
                            💡 {comp.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: '#0369a1', fontWeight: '600', marginLeft: 12 }}>
                        ${(comp.material_unit_cost || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ padding: 12, backgroundColor: '#f0fdf4', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#065f46' }}>
              💡 <strong>Tip:</strong> Click "Confirm & Save" to add this assembly to your {pendingMeasurement ? 'length measurement' : 'count'}. You can edit materials later if needed.
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowAssemblyPreviewModal(false);
                  setPreviewAssemblyData(null);
                }} 
                style={styles.cancelButton}
              >
                Go Back
              </button>
              <button 
                onClick={confirmAndSaveAssembly} 
                style={{...styles.saveButton, backgroundColor: '#10b981'}}
              >
                ✅ Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Label Modal */}
      {showSnapshotLabelModal && pendingSnapshotImage && (
        <div style={styles.modalOverlay} onClick={() => { URL.revokeObjectURL(pendingSnapshotImage.imageUrl); setPendingSnapshotImage(null); setShowSnapshotLabelModal(false); setSnapshotLabel(''); }}>
          <div style={{ ...styles.modalContent, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📸 Save Snapshot</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Preview of your snapshot:</p>
            <img src={pendingSnapshotImage.imageUrl} alt="Snapshot Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, marginBottom: 16, border: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }} />
            <div style={styles.formGroup}>
              <label style={styles.label}>Label for this snapshot:</label>
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder={`Snapshot ${snapshots.length + 1}`}
                style={styles.select}
                autoFocus
                onKeyPress={(e) => { if (e.key === 'Enter') saveSnapshot(); }}
              />
              <p style={{ fontSize: 12, color: '#999', marginTop: 6 }}>e.g. "Panel Room", "Fixtures - NW Corner", "Switchgear Schedule"</p>
            </div>
            <div style={styles.modalButtons}>
              <button onClick={() => { URL.revokeObjectURL(pendingSnapshotImage.imageUrl); setPendingSnapshotImage(null); setShowSnapshotLabelModal(false); setSnapshotLabel(''); }} style={styles.cancelButton}>Cancel</button>
              <button onClick={saveSnapshot} style={{ ...styles.saveButton, backgroundColor: '#3b82f6' }}>💾 Save to Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot List Side Panel */}
      {showSnapshotsList && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, backgroundColor: '#1a1a1a', borderLeft: '3px solid #3b82f6', zIndex: 9998, overflowY: 'auto', padding: 20, boxShadow: '-4px 0 20px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: '#f97316', margin: 0, fontSize: 18 }}>📸 Saved Snapshots ({snapshots.length})</h3>
            <button onClick={() => setShowSnapshotsList(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16, lineHeight: 1.5 }}>
            These snapshots are saved to your project. Go to <strong style={{ color: '#f97316' }}>Reports & Photos</strong> to combine them into a takeoff report with fixture/switchgear counts.
          </div>
          {snapshots.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 30, fontSize: 13 }}>No snapshots yet.<br /><br />Select the 📸 Snapshot tool and drag to capture an area of the plan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {snapshots.map((snap) => (
                <div key={snap.id} style={{ backgroundColor: '#2a2a2a', borderRadius: 8, overflow: 'hidden', border: '1px solid #444' }}>
                  <img src={snap.image_url} alt={snap.label} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', backgroundColor: '#000', display: 'block' }} />
                  <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{snap.label}</div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Page {snap.page_number} • {new Date(snap.created_at).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => deleteSnapshot(snap.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', padding: 4 }} title="Delete snapshot">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => navigate(`/project/${projectId}/reports-photos`)}
              style={{ width: '100%', padding: '14px', backgroundColor: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              📋 Go to Reports & Photos →
            </button>
            <p style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 8 }}>Generate a combined takeoff report with counts</p>
          </div>
        </div>
      )}

      {/* Auto Count Modal */}
      {showAutoCountModal && autoCountTemplate && (
        <div style={styles.modalOverlay} onClick={() => {
          // Clear match rects when closing
          const fc = fabricCanvasRef.current;
          if (fc) {
            autoCountMatchRectsRef.current.forEach(r => { try { fc.remove(r); } catch (e) {} });
            autoCountMatchRectsRef.current = [];
            fc.renderAll();
          }
          setShowAutoCountModal(false);
          setAutoCountTemplate(null);
          setAutoCountMatches([]);
        }}>
          <div style={{ ...styles.modalContent, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🔍 Auto Count Results</h2>

            {/* Template preview */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>Symbol template:</p>
                <img
                  src={autoCountTemplate.dataUrl}
                  alt="Template"
                  style={{ border: '2px solid #10b981', borderRadius: 6, maxWidth: 100, maxHeight: 100, objectFit: 'contain', backgroundColor: '#f9fafb', display: 'block' }}
                />
                <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0', textAlign: 'center' }}>
                  {autoCountTemplate.width}×{autoCountTemplate.height} px
                </p>
              </div>
              <div style={{ flex: 1 }}>
                {isRunningAutoCount ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 14, fontWeight: '600' }}>Scanning for matches…</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Running template matching</div>
                  </div>
                ) : (
                  <div style={{ padding: 16, backgroundColor: autoCountMatches.length > 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `2px solid ${autoCountMatches.length > 0 ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ fontSize: 32, fontWeight: '800', color: autoCountMatches.length > 0 ? '#059669' : '#dc2626', textAlign: 'center', marginBottom: 4 }}>
                      {autoCountMatches.length}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' }}>
                      {autoCountMatches.length === 1 ? 'match found' : 'matches found'}
                    </div>
                    {autoCountMatches.length > 0 && (
                      <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 6 }}>
                        Green boxes shown on plan
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Threshold slider */}
            <div style={{ marginBottom: 20, padding: 14, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Match Sensitivity: {Math.round(autoCountThreshold * 100)}%
                </label>
                <span style={{ fontSize: 11, color: '#999' }}>
                  {autoCountThreshold < 0.65 ? 'More matches (lower precision)' : autoCountThreshold > 0.85 ? 'Fewer matches (higher precision)' : 'Balanced'}
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={autoCountThreshold}
                onChange={(e) => setAutoCountThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginTop: 2 }}>
                <span>50% (more)</span>
                <span>95% (fewer)</span>
              </div>
            </div>

            {autoCountMatches.length === 0 && !isRunningAutoCount && (
              <div style={{ padding: 12, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#92400e', border: '1px solid #fbbf24' }}>
                💡 No matches found. Try lowering the sensitivity slider, or capture a larger/cleaner symbol template.
              </div>
            )}

            <div style={styles.modalButtons}>
              <button
                onClick={() => {
                  // Re-run with current threshold
                  if (autoCountTemplate) {
                    runAutoCountMatching(autoCountTemplate.compositeCanvas, autoCountTemplate.tmplCanvas, autoCountThreshold, fabricCanvasRef.current);
                  }
                }}
                style={{ ...styles.cancelButton, backgroundColor: '#e0f2fe', color: '#1e40af' }}
                disabled={isRunningAutoCount}
              >
                🔄 Re-scan
              </button>
              <button
                onClick={placeAutoCountMarkers}
                style={{ ...styles.saveButton, backgroundColor: autoCountMatches.length > 0 ? '#10b981' : '#9ca3af' }}
                disabled={autoCountMatches.length === 0 || isRunningAutoCount}
              >
                ✅ Place {autoCountMatches.length} Marker{autoCountMatches.length !== 1 ? 's' : ''}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
              After placing markers you can add/remove them manually, then press "Finish Count" to save.
            </p>
          </div>
        </div>
      )}

      {/* Count Tool Modal */}
      {showCountModal && (
        <div style={styles.modalOverlay} onClick={() => {
          setShowCountModal(false);
        }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Save Count</h2>
            
            <p style={styles.modalDescription}>
              Count: <strong>{countMarkers.length} items</strong>
            </p>
            
            {/* Material Selector - Cascading Dropdowns */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedMaterialId(null); // Reset material when category changes
                }}
                style={styles.select}
              >
                <option value="">-- Select Category --</option>
                {[...new Set(materials.map(m => m.category))].sort().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            {selectedCategory && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Material:</label>
                <select
                  value={selectedMaterialId || ''}
                  onChange={(e) => setSelectedMaterialId(e.target.value || null)}
                  style={styles.select}
                >
                  <option value="">-- Select Material --</option>
                  {materials
                    .filter(m => m.category === selectedCategory)
                    .map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name} ({material.unit})
                      </option>
                    ))}
                </select>
              </div>
            )}
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Label (optional):</label>
              <input 
                type="text"
                value={measurementLabel} 
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder="e.g., Receptacles, Light fixtures, Panels"
                style={styles.select}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveCount();
                  }
                }}
              />
            </div>
            
            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  // Cancel and remove all markers
                  if (canvas && countMarkersRef.current.length > 0) {
                    countMarkersRef.current.forEach(m => canvas.remove(m.marker));
                    canvas.renderAll();
                  }
                  setShowCountModal(false);
                  setMeasurementLabel('');
                  setCountMarkers([]);
                  countMarkersRef.current = [];
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={() => saveCount()}
                style={styles.saveButton}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    backgroundColor: BRAND.bg,
    color: '#fff',
  },
  title: {
    fontSize: 28,
    color: BRAND.text,
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    margin: 0,
  },
  estimateButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: '2px solid #fff',
    color: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  },
  mainContent: {
    display: 'flex',
    height: 'calc(100vh - 100px)',
    width: '100%',
    overflow: 'hidden',
  },
  mainContentFullscreen: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    overflow: 'hidden',
  },
  toolbar: {
    width: 180,
    minWidth: 180,
    flexShrink: 0,
    backgroundColor: '#1a1a1a',
    borderRight: '1px solid #444',
    padding: 16,
    overflowY: 'auto',
  },
  toolbarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#f97316',
  },
  toolSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },
  toolButton: {
    width: '100%',
    padding: '12px 16px',
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    border: '2px solid #444',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    transition: 'all 0.2s',
    color: '#fff',
  },
  toolButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#3b82f6',
    color: '#1e40af',
  },
  calibrationInfo: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    margin: '20px 0',
  },
  layerItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    marginBottom: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    border: '2px solid transparent',
    color: '#fff',
  },
  layerItemActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#3b82f6',
    color: '#1e40af',
  },
  layerDeleteButton: {
    padding: '2px 6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: 3,
    transition: 'all 0.2s',
    ':hover': {
      backgroundColor: '#ef4444',
      color: '#fff',
    },
  },
  viewerContainer: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#e5e7eb',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 20px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #444',
  },
  controlButton: {
    padding: '8px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #555',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  viewerNote: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  estimateButtonControl: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  fullscreenButton: {
    marginLeft: 'auto',
    padding: '8px 16px',
    backgroundColor: '#f97316',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  pdfWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  toolHint: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    backgroundColor: 'rgba(249, 115, 22, 0.95)',
    color: '#fff',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  sidebar: {
    width: 200,
    minWidth: 200,
    flexShrink: 0,
    backgroundColor: '#1a1a1a',
    borderLeft: '1px solid #444',
    padding: 16,
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#f97316',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    padding: 20,
    lineHeight: 1.6,
  },
  measurementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  measurementItem: {
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#dc2626',
    },
  },
  editDetailsButton: {
    position: 'absolute',
    top: 3,
    right: 24,
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#fff',
    fontSize: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#2563eb',
    },
  },
  addMarkersButton: {
    position: 'absolute',
    top: 3,
    right: 45,
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    backgroundColor: '#10b981',
    color: '#fff',
    fontSize: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    transition: 'background-color 0.2s',
  },
  measurementType: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND.accent,
    marginBottom: 2,
  },
  measurementLabel: {
    fontSize: 11,
    color: '#444',
    marginBottom: 2,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    maxWidth: 500,
    width: '90%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  select: {
    width: '100%',
    padding: '12px',
    fontSize: 16,
    border: '2px solid #ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#333',
  },
  modalButtons: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#f97316',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  colorPickerSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    border: '1px solid #444',
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  exportButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    transition: 'all 0.2s',
    marginBottom: 16,
  },
  reloadButton: {
    padding: '8px 16px',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
};

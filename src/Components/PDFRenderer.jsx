import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export default function PDFRenderer({ pdfUrl, onLoad, onZoomChange, onPanChange, onPageChange, onRotationChange, zoom, setZoom, disablePanning = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return;
    
    setLoading(true);
    pdfjsLib.getDocument(pdfUrl).promise
      .then(pdfDoc => {
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        return pdfDoc.getPage(1);
      })
      .then(firstPage => {
        setPage(firstPage);
        setLoading(false);
        
        // Calculate and set auto-fit zoom immediately before rendering
        if (containerRef.current && zoom === 1.0) {
          const viewport = firstPage.getViewport({ scale: 1.0 });
          const containerWidth = containerRef.current.clientWidth - 40;
          const autoZoom = containerWidth / viewport.width;
          if (autoZoom > 0 && autoZoom < 10) {
            setZoom(autoZoom);
          }
        }
        
        if (onLoad) {
          onLoad({ width: firstPage.getViewport({ scale: 1.0 }).width, height: firstPage.getViewport({ scale: 1.0 }).height });
        }
      })
      .catch(err => {
        console.error('Error loading PDF:', err);
        setLoading(false);
      });
  }, [pdfUrl]);


  // Render page
  useEffect(() => {
    if (!page || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    const viewport = page.getViewport({ scale: zoom, rotation: rotation });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    page.render(renderContext);
    
    // Notify parent of zoom change for calibration calculations
    if (onZoomChange) {
      onZoomChange(zoom);
    }
  }, [page, zoom, rotation]);

  function handleZoomIn() {
    setZoom(prev => Math.min(prev + 0.25, 5.0));
  }

  function handleZoomOut() {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  }

  function handleFitToWidth() {
    if (!page || !containerRef.current) return;
    const viewport = page.getViewport({ scale: 1.0, rotation: rotation });
    const containerWidth = containerRef.current.clientWidth - 40; // padding
    const newZoom = containerWidth / viewport.width;
    setZoom(newZoom);
  }

  function handleRotateLeft() {
    const newRotation = (rotation - 90 + 360) % 360;
    setRotation(newRotation);
    if (onRotationChange) {
      onRotationChange(newRotation);
    }
  }

  function handleRotateRight() {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    if (onRotationChange) {
      onRotationChange(newRotation);
    }
  }

  function handlePageChange(newPageNum) {
    if (!pdf || newPageNum < 1 || newPageNum > numPages) return;
    
    setPageNum(newPageNum);
    pdf.getPage(newPageNum).then(newPage => {
      setPage(newPage);
      // Notify parent of page change
      if (onPageChange) {
        onPageChange(newPageNum);
      }
    });
  }

  function handleMouseDown(e) {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }

  function handleMouseMove(e) {
    if (!isPanning) return;
    const newOffset = {
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    };
    setPanOffset(newOffset);
    if (onPanChange) {
      onPanChange(newOffset);
    }
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Loading PDF...</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls */}
      <div style={{ padding: 10, backgroundColor: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleZoomOut} style={styles.controlBtn}>−</button>
        <span style={{ color: '#fff', minWidth: 60, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} style={styles.controlBtn}>+</button>
        <button onClick={() => setZoom(1.0)} style={styles.controlBtn}>100%</button>
        <button onClick={handleFitToWidth} style={styles.controlBtn}>Fit Width</button>
        
        <div style={{ marginLeft: 10, display: 'flex', gap: 8, alignItems: 'center', borderLeft: '1px solid #555', paddingLeft: 10 }}>
          <button onClick={handleRotateLeft} style={styles.controlBtn} title="Rotate Left">↺</button>
          <button onClick={handleRotateRight} style={styles.controlBtn} title="Rotate Right">↻</button>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            onClick={() => handlePageChange(pageNum - 1)} 
            disabled={pageNum <= 1}
            style={{...styles.controlBtn, opacity: pageNum <= 1 ? 0.5 : 1, cursor: pageNum <= 1 ? 'not-allowed' : 'pointer'}}
          >
            ← Prev
          </button>
          <span style={{ color: '#fff', minWidth: 80, textAlign: 'center' }}>
            Page {pageNum} of {numPages}
          </span>
          <button 
            onClick={() => handlePageChange(pageNum + 1)} 
            disabled={pageNum >= numPages}
            style={{...styles.controlBtn, opacity: pageNum >= numPages ? 0.5 : 1, cursor: pageNum >= numPages ? 'not-allowed' : 'pointer'}}
          >
            Next →
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          overflow: 'hidden', // Changed from 'auto' to prevent scrollbars
          backgroundColor: '#525252',
          cursor: disablePanning ? 'crosshair' : (isPanning ? 'grabbing' : 'grab'),
          pointerEvents: disablePanning ? 'none' : 'auto',
          position: 'relative'
        }}
        onMouseDown={disablePanning ? undefined : handleMouseDown}
        onMouseMove={disablePanning ? undefined : handleMouseMove}
        onMouseUp={disablePanning ? undefined : handleMouseUp}
        onMouseLeave={disablePanning ? undefined : handleMouseUp}
      >
        <div 
          id="pdf-transform-wrapper"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            display: 'inline-block',
            padding: 20,
            position: 'relative'
          }}
        >
          <canvas 
            ref={canvasRef}
            style={{ 
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              display: 'block'
            }}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  controlBtn: {
    padding: '6px 12px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  }
};

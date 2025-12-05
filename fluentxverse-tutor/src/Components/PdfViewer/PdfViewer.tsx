import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import * as pdfjsLib from 'pdfjs-dist';
import { renderTextLayer } from 'pdfjs-dist';
import type { Socket } from 'socket.io-client';
import './PdfViewer.css';

// Use worker from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfViewerProps {
  materialId?: string;
  socket?: Socket | null;
  sessionId?: string;
  userType?: 'tutor' | 'student';
}

interface PageData {
  canvas: HTMLCanvasElement;
  textContent: any;
  viewport: any;
  displayWidth: number;
  displayHeight: number;
}

interface HighlightStroke {
  id: string;
  pageIndex: number;
  points: { x: number; y: number }[];
  color: string;
}

// Fixed colors per user type
const USER_COLORS = {
  tutor: 'rgba(0, 150, 255, 0.4)',   // Blue for tutor
  student: 'rgba(0, 200, 100, 0.4)', // Green for student
};

// Generate unique ID for strokes
const generateStrokeId = () => `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const PdfViewer = ({ materialId = 'default', socket, sessionId, userType = 'student' }: PdfViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [pageDataList, setPageDataList] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<any>(null);
  
  // Page navigation state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpToPageInput, setJumpToPageInput] = useState('');
  
  // Highlighter state - color is determined by userType
  const [highlighterEnabled, setHighlighterEnabled] = useState(false);
  const highlighterEnabledRef = useRef(false);
  const highlightColor = USER_COLORS[userType];
  const highlightColorRef = useRef(highlightColor);
  const [highlights, setHighlights] = useState<HighlightStroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<HighlightStroke | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    highlighterEnabledRef.current = highlighterEnabled;
  }, [highlighterEnabled]);

  useEffect(() => {
    highlightColorRef.current = highlightColor;
  }, [highlightColor]);

  // Draw all highlights on a page's canvas (full redraw)
  const drawHighlights = useCallback((pageIndex: number) => {
    const canvas = highlightCanvasRefs.current.get(pageIndex);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all highlights for this page
    const pageHighlights = highlights.filter(h => h.pageIndex === pageIndex);
    
    pageHighlights.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      
      ctx.stroke();
    });
  }, [highlights]);

  // Draw current stroke incrementally (without clearing existing highlights)
  const drawCurrentStroke = useCallback((pageIndex: number) => {
    if (!currentStrokeRef.current || currentStrokeRef.current.pageIndex !== pageIndex) return;
    
    const canvas = highlightCanvasRefs.current.get(pageIndex);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const stroke = currentStrokeRef.current;
    if (stroke.points.length < 2) return;
    
    // Only draw the last segment (incremental drawing)
    const lastIndex = stroke.points.length - 1;
    if (lastIndex < 1) return;
    
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(stroke.points[lastIndex - 1].x, stroke.points[lastIndex - 1].y);
    ctx.lineTo(stroke.points[lastIndex].x, stroke.points[lastIndex].y);
    ctx.stroke();
  }, []);

  // Redraw highlights when they change
  useEffect(() => {
    pageDataList.forEach((_, index) => {
      drawHighlights(index);
    });
  }, [highlights, pageDataList, drawHighlights]);

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageDataList.length === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 3;
      
      let closestPage = 1;
      let closestDistance = Infinity;
      
      pageRefs.current.forEach((pageWrapper, index) => {
        const rect = pageWrapper.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = index + 1;
        }
      });
      
      setCurrentPage(closestPage);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [pageDataList]);

  // Page navigation functions
  const goToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    const pageWrapper = pageRefs.current.get(pageNum - 1);
    if (pageWrapper && containerRef.current) {
      pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  }, [totalPages]);

  const goToPrevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const handleJumpToPage = useCallback((e: Event) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPageInput, 10);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
      setJumpToPageInput('');
    }
  }, [jumpToPageInput, goToPage]);

  const getCanvasCoordinates = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: MouseEvent | TouchEvent, pageIndex: number) => {
    if (!highlighterEnabledRef.current) return;
    
    const canvas = highlightCanvasRefs.current.get(pageIndex);
    if (!canvas) return;
    
    e.preventDefault();
    isDrawingRef.current = true;
    
    const point = getCanvasCoordinates(e, canvas);
    currentStrokeRef.current = {
      id: generateStrokeId(),
      pageIndex,
      points: [point],
      color: highlightColorRef.current,
    };
  };

  const handlePointerMove = (e: MouseEvent | TouchEvent, pageIndex: number) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    if (currentStrokeRef.current.pageIndex !== pageIndex) return;
    
    const canvas = highlightCanvasRefs.current.get(pageIndex);
    if (!canvas) return;
    
    e.preventDefault();
    
    const point = getCanvasCoordinates(e, canvas);
    currentStrokeRef.current.points.push(point);
    
    // Draw incrementally without clearing existing highlights
    drawCurrentStroke(pageIndex);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    
    if (currentStrokeRef.current.points.length >= 2) {
      const newStroke = currentStrokeRef.current;
      setHighlights(prev => [...prev, newStroke]);
      
      // Emit to socket for sharing
      if (socket && sessionId) {
        socket.emit('highlight:stroke', {
          sessionId,
          stroke: newStroke,
        });
      }
    }
    
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const clearHighlights = () => {
    setHighlights([]);
    
    // Emit clear to socket
    if (socket && sessionId) {
      socket.emit('highlight:clear', { sessionId });
    }
  };

  // Listen for remote highlights
  useEffect(() => {
    if (!socket) return;

    const handleRemoteStroke = (data: { stroke: HighlightStroke }) => {
      setHighlights(prev => {
        // Avoid duplicates by checking ID
        if (prev.some(h => h.id === data.stroke.id)) return prev;
        return [...prev, data.stroke];
      });
    };

    const handleRemoteClear = () => {
      setHighlights([]);
    };

    const handleHighlightSync = (data: { highlights: HighlightStroke[] }) => {
      setHighlights(data.highlights);
    };

    socket.on('highlight:stroke', handleRemoteStroke);
    socket.on('highlight:clear', handleRemoteClear);
    socket.on('highlight:sync', handleHighlightSync);

    // Request current highlights when joining
    if (sessionId) {
      socket.emit('highlight:request-sync', { sessionId });
    }

    return () => {
      socket.off('highlight:stroke', handleRemoteStroke);
      socket.off('highlight:clear', handleRemoteClear);
      socket.off('highlight:sync', handleHighlightSync);
    };
  }, [socket, sessionId]);

  useEffect(() => {
    let cancelled = false;
    
    const loadPdf = async () => {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setError(null);

        // Obfuscated path
        const pdfPath = atob('L2Fzc2V0cy9tYXRlcmlhbHMvdHV0b3JfYWdyZWVtZW50LnBkZg==');
        
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        const pdf = await loadingTask.promise;
        
        if (cancelled) return;
        
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        
        const container = containerRef.current;
        if (!container) return;
        
        const containerWidth = container.clientWidth || 600;
        
        // Use higher scale for crisp rendering - render at 6x minimum
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        const qualityMultiplier = 3; // Maximum quality
        const renderScale = pixelRatio * qualityMultiplier;
        
        const renderedPages: PageData[] = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          
          if (cancelled) return;
          
          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          
          // High-res viewport for canvas
          const canvasViewport = page.getViewport({ scale: scale * renderScale });
          // Display viewport for text layer
          const displayViewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) continue;
          
          canvas.height = canvasViewport.height;
          canvas.width = canvasViewport.width;
          canvas.style.width = `${displayViewport.width}px`;
          canvas.style.height = `${displayViewport.height}px`;
          canvas.className = 'pdf-page-canvas';
          
          await page.render({
            canvasContext: context,
            viewport: canvasViewport,
          }).promise;
          
          if (cancelled) return;
          
          // Get text content for text layer
          const textContent = await page.getTextContent();
          
          if (cancelled) return;
          
          renderedPages.push({
            canvas,
            textContent,
            viewport: displayViewport,
            displayWidth: displayViewport.width,
            displayHeight: displayViewport.height,
          });
        }
        
        setPageDataList(renderedPages);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (!cancelled) {
          setError('Failed to load document');
          setLoading(false);
        }
      }
    };

    loadPdf();

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        loadPdf();
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [materialId]);

  useEffect(() => {
    if (!containerRef.current || pageDataList.length === 0) return;
    
    const container = containerRef.current;
    container.innerHTML = '';
    highlightCanvasRefs.current.clear();
    pageRefs.current.clear();
    
    pageDataList.forEach((pageData, index) => {
      // Create wrapper for each page - use padding-bottom for aspect ratio
      const aspectRatio = (pageData.displayHeight / pageData.displayWidth) * 100;
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.style.paddingBottom = `${aspectRatio}%`;
      pageWrapper.setAttribute('data-page', String(index + 1));
      pageRefs.current.set(index, pageWrapper);
      
      // Add PDF canvas
      pageData.canvas.style.position = 'absolute';
      pageData.canvas.style.top = '0';
      pageData.canvas.style.left = '0';
      pageWrapper.appendChild(pageData.canvas);
      
      // Create highlight canvas overlay
      const highlightCanvas = document.createElement('canvas');
      highlightCanvas.className = 'highlight-canvas';
      highlightCanvas.width = pageData.canvas.width;
      highlightCanvas.height = pageData.canvas.height;
      highlightCanvas.style.width = `${pageData.displayWidth}px`;
      highlightCanvas.style.height = `${pageData.displayHeight}px`;
      highlightCanvasRefs.current.set(index, highlightCanvas);
      
      // Add event listeners for drawing
      highlightCanvas.addEventListener('mousedown', (e) => handlePointerDown(e, index));
      highlightCanvas.addEventListener('mousemove', (e) => handlePointerMove(e, index));
      highlightCanvas.addEventListener('mouseup', handlePointerUp);
      highlightCanvas.addEventListener('mouseleave', handlePointerUp);
      highlightCanvas.addEventListener('touchstart', (e) => handlePointerDown(e, index));
      highlightCanvas.addEventListener('touchmove', (e) => handlePointerMove(e, index));
      highlightCanvas.addEventListener('touchend', handlePointerUp);
      
      pageWrapper.appendChild(highlightCanvas);
      
      // Create text layer div
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      pageWrapper.appendChild(textLayerDiv);
      
      // Render text layer using the function API
      renderTextLayer({
        textContentSource: pageData.textContent,
        container: textLayerDiv,
        viewport: pageData.viewport,
        textDivs: [],
      });
      
      container.appendChild(pageWrapper);
    });
  }, [pageDataList, highlightColor]);

  // Update cursor and pointer-events based on highlighter state
  useEffect(() => {
    highlightCanvasRefs.current.forEach(canvas => {
      canvas.style.pointerEvents = highlighterEnabled ? 'auto' : 'none';
      canvas.style.cursor = highlighterEnabled ? 'crosshair' : 'default';
      canvas.style.zIndex = highlighterEnabled ? '20' : '5';
    });
    
    // Also toggle text layer pointer events
    const textLayers = containerRef.current?.querySelectorAll('.textLayer');
    textLayers?.forEach(layer => {
      (layer as HTMLElement).style.pointerEvents = highlighterEnabled ? 'none' : 'auto';
    });
  }, [highlighterEnabled]);

  return (
    <div className="pdf-viewer-wrapper">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        {/* Page navigation */}
        <div className="page-navigation">
          <button
            className="nav-btn"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          
          <span className="page-indicator">
            {currentPage} / {totalPages}
          </span>
          
          <button
            className="nav-btn"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            title="Next page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          
          <form className="jump-to-page" onSubmit={handleJumpToPage}>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpToPageInput}
              onChange={(e) => setJumpToPageInput((e.target as HTMLInputElement).value)}
              placeholder="Go"
              title="Jump to page"
            />
            <button type="submit" title="Go">Go</button>
          </form>
        </div>
        
        {/* Highlighter toolbar */}
        <div className="highlighter-toolbar">
          <button
            className={`highlighter-toggle ${highlighterEnabled ? 'active' : ''}`}
            onClick={() => setHighlighterEnabled(!highlighterEnabled)}
            title={highlighterEnabled ? 'Disable highlighter' : 'Enable highlighter'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <span>Highlight</span>
          </button>
          
          {highlighterEnabled && (
            <button className="clear-btn" onClick={clearHighlights} title="Clear all highlights">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="pdf-loading">
          <div className="pdf-spinner"></div>
          <span>Loading document...</span>
        </div>
      )}
      {error && (
        <div className="pdf-error">
          <span>{error}</span>
        </div>
      )}
      <div 
        ref={containerRef} 
        className="pdf-pages-container"
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  );
};

export default PdfViewer;

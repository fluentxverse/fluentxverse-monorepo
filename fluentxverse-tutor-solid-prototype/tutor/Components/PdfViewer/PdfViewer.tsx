import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Socket } from 'socket.io-client';
import './PdfViewer.css';
// Use worker from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
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
    points: {
        x: number;
        y: number;
    }[];
    color: string;
}
// Fixed colors per user type
const USER_COLORS = {
    tutor: 'rgba(0, 150, 255, 0.4)', // Blue for tutor
    student: 'rgba(0, 200, 100, 0.4)'
};
// Generate unique ID for strokes
const generateStrokeId = () => `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const renderPdfTextLayer = async (params: {
    textContentSource: any;
    container: HTMLElement;
    viewport: any;
}) => {
    const pdfjs = pdfjsLib as any;
    if (pdfjs.TextLayer) {
        const textLayer = new pdfjs.TextLayer(params);
        await textLayer.render();
        return;
    }
    const task = pdfjs.renderTextLayer?.({
        ...params,
        textDivs: []
    });
    await task?.promise;
};
const PdfViewer = (_props0: PdfViewerProps) => {
    const containerRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const highlightCanvasRefs = { current: new Map() } as {
        current: Map<number, HTMLCanvasElement> | null;
    };
    const pageRefs = { current: new Map() } as {
        current: Map<number, HTMLDivElement> | null;
    };
    const [pageDataList, setPageDataList] = createSignal<PageData[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const pdfDocRef = { current: null } as {
        current: any | null;
    };
    // Page navigation state
    const [currentPage, setCurrentPage] = createSignal(1);
    const [totalPages, setTotalPages] = createSignal(0);
    const [jumpToPageInput, setJumpToPageInput] = createSignal('');
    // Highlighter state - color is determined by userType
    const [highlighterEnabled, setHighlighterEnabled] = createSignal(false);
    const highlighterEnabledRef = { current: false } as {
        current: any;
    };
    const highlightColor = createMemo(() => USER_COLORS[_props0["userType"] === undefined ? 'student' : _props0["userType"]]);
    const highlightColorRef = { current: highlightColor() } as {
        current: any;
    };
    const [highlights, setHighlights] = createSignal<HighlightStroke[]>([]);
    const isDrawingRef = { current: false } as {
        current: any;
    };
    const currentStrokeRef = { current: null } as {
        current: (HighlightStroke | null) | null;
    };
    // Keep refs in sync with state
    createEffect(on(() => [highlighterEnabled()], () => {
        const _cleanup1 = untrack(() => {
            highlighterEnabledRef.current = highlighterEnabled();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [highlightColor()], () => {
        const _cleanup2 = untrack(() => {
            highlightColorRef.current = highlightColor();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Draw all highlights on a page's canvas (full redraw)
    const drawHighlights = createMemo(on(() => [highlights()], () => (pageIndex: number) => {
        const canvas = highlightCanvasRefs.current.get(pageIndex);
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw all highlights for this page
        const pageHighlights = highlights().filter(h => h.pageIndex === pageIndex);
        pageHighlights.forEach(stroke => {
            if (stroke.points.length < 2)
                return;
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
    }));
    // Draw current stroke incrementally (without clearing existing highlights)
    const drawCurrentStroke = createMemo(on(() => [], () => (pageIndex: number) => {
        if (!currentStrokeRef.current || currentStrokeRef.current.pageIndex !== pageIndex)
            return;
        const canvas = highlightCanvasRefs.current.get(pageIndex);
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const stroke = currentStrokeRef.current;
        if (stroke.points.length < 2)
            return;
        // Only draw the last segment (incremental drawing)
        const lastIndex = stroke.points.length - 1;
        if (lastIndex < 1)
            return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[lastIndex - 1].x, stroke.points[lastIndex - 1].y);
        ctx.lineTo(stroke.points[lastIndex].x, stroke.points[lastIndex].y);
        ctx.stroke();
    }));
    // Redraw highlights when they change
    createEffect(on(() => [highlights(), pageDataList(), drawHighlights()], () => {
        const _cleanup3 = untrack(() => {
            pageDataList().forEach((_, index) => {
                drawHighlights()(index);
            });
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    // Track current page based on scroll position
    createEffect(on(() => [pageDataList()], () => {
        const _cleanup4 = untrack(() => {
            const container = containerRef.current;
            if (!container || pageDataList().length === 0)
                return;
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
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    // Page navigation functions
    const goToPage = createMemo(on(() => [totalPages()], () => (pageNum: number) => {
        if (pageNum < 1 || pageNum > totalPages())
            return;
        const pageWrapper = pageRefs.current.get(pageNum - 1);
        if (pageWrapper && containerRef.current) {
            pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentPage(pageNum);
        }
    }));
    const goToPrevPage = createMemo(on(() => [currentPage(), goToPage()], () => () => {
        goToPage()(currentPage() - 1);
    }));
    const goToNextPage = createMemo(on(() => [currentPage(), goToPage()], () => () => {
        goToPage()(currentPage() + 1);
    }));
    const handleJumpToPage = createMemo(on(() => [jumpToPageInput(), goToPage()], () => (e: Event) => {
        e.preventDefault();
        const pageNum = parseInt(jumpToPageInput(), 10);
        if (!isNaN(pageNum)) {
            goToPage()(pageNum);
            setJumpToPageInput('');
        }
    }));
    const getCanvasCoordinates = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX: number, clientY: number;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };
    const handlePointerDown = (e: MouseEvent | TouchEvent, pageIndex: number) => {
        if (!highlighterEnabledRef.current)
            return;
        const canvas = highlightCanvasRefs.current.get(pageIndex);
        if (!canvas)
            return;
        e.preventDefault();
        isDrawingRef.current = true;
        const point = getCanvasCoordinates(e, canvas);
        currentStrokeRef.current = {
            id: generateStrokeId(),
            pageIndex,
            points: [point],
            color: highlightColorRef.current
        };
    };
    const handlePointerMove = (e: MouseEvent | TouchEvent, pageIndex: number) => {
        if (!isDrawingRef.current || !currentStrokeRef.current)
            return;
        if (currentStrokeRef.current.pageIndex !== pageIndex)
            return;
        const canvas = highlightCanvasRefs.current.get(pageIndex);
        if (!canvas)
            return;
        e.preventDefault();
        const point = getCanvasCoordinates(e, canvas);
        currentStrokeRef.current.points.push(point);
        // Draw incrementally without clearing existing highlights
        drawCurrentStroke()(pageIndex);
    };
    const handlePointerUp = () => {
        if (!isDrawingRef.current || !currentStrokeRef.current)
            return;
        if (currentStrokeRef.current.points.length >= 2) {
            const newStroke = currentStrokeRef.current;
            setHighlights(prev => [...prev, newStroke]);
            // Emit to socket for sharing
            if (_props0["socket"] && _props0["sessionId"]) {
                _props0["socket"].emit('highlight:stroke', {
                    get sessionId() {
                        return _props0["sessionId"];
                    },
                    stroke: newStroke
                });
            }
        }
        isDrawingRef.current = false;
        currentStrokeRef.current = null;
    };
    const clearHighlights = () => {
        setHighlights([]);
        // Emit clear to socket
        if (_props0["socket"] && _props0["sessionId"]) {
            _props0["socket"].emit('highlight:clear', { get sessionId() {
                    return _props0["sessionId"];
                } });
        }
    };
    // Listen for remote highlights
    createEffect(on(() => [_props0["socket"], _props0["sessionId"]], () => {
        const _cleanup5 = untrack(() => {
            if (!_props0["socket"])
                return;
            const handleRemoteStroke = (data: {
                stroke: HighlightStroke;
            }) => {
                setHighlights(prev => {
                    // Avoid duplicates by checking ID
                    if (prev.some(h => h.id === data.stroke.id))
                        return prev;
                    return [...prev, data.stroke];
                });
            };
            const handleRemoteClear = () => {
                setHighlights([]);
            };
            const handleHighlightSync = (data: {
                highlights: HighlightStroke[];
            }) => {
                setHighlights(data.highlights);
            };
            _props0["socket"].on('highlight:stroke', handleRemoteStroke);
            _props0["socket"].on('highlight:clear', handleRemoteClear);
            _props0["socket"].on('highlight:sync', handleHighlightSync);
            // Request current highlights when joining
            if (_props0["sessionId"]) {
                _props0["socket"].emit('highlight:request-sync', { get sessionId() {
                        return _props0["sessionId"];
                    } });
            }
            return () => {
                _props0["socket"].off('highlight:stroke', handleRemoteStroke);
                _props0["socket"].off('highlight:clear', handleRemoteClear);
                _props0["socket"].off('highlight:sync', handleHighlightSync);
            };
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [_props0["materialId"] === undefined ? 'default' : _props0["materialId"]], () => {
        const _cleanup6 = untrack(() => {
            let cancelled = false;
            const loadPdf = async () => {
                if (!containerRef.current)
                    return;
                try {
                    setLoading(true);
                    setError(null);
                    // Obfuscated path
                    const pdfPath = atob('L2Fzc2V0cy9tYXRlcmlhbHMvdHV0b3JfYWdyZWVtZW50LnBkZg==');
                    const loadingTask = pdfjsLib.getDocument({ url: pdfPath });
                    const pdf = await loadingTask.promise;
                    if (cancelled)
                        return;
                    pdfDocRef.current = pdf;
                    setTotalPages(pdf.numPages);
                    const container = containerRef.current;
                    if (!container)
                        return;
                    const containerWidth = container.clientWidth || 600;
                    // Use higher scale for crisp rendering - render at 6x minimum
                    const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
                    const qualityMultiplier = 3; // Maximum quality
                    const renderScale = pixelRatio * qualityMultiplier;
                    const renderedPages: PageData[] = [];
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        if (cancelled)
                            return;
                        const viewport = page.getViewport({ scale: 1 });
                        const scale = containerWidth / viewport.width;
                        // High-res viewport for canvas
                        const canvasViewport = page.getViewport({ scale: scale * renderScale });
                        // Display viewport for text layer
                        const displayViewport = page.getViewport({ scale });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        if (!context)
                            continue;
                        canvas.height = canvasViewport.height;
                        canvas.width = canvasViewport.width;
                        canvas.style.width = `${displayViewport.width}px`;
                        canvas.style.height = `${displayViewport.height}px`;
                        canvas.className = 'pdf-page-canvas';
                        await page.render({
                            canvasContext: context,
                            canvas,
                            viewport: canvasViewport
                        }).promise;
                        if (cancelled)
                            return;
                        // Get text content for text layer
                        const textContent = await page.getTextContent();
                        if (cancelled)
                            return;
                        renderedPages.push({
                            canvas,
                            textContent,
                            viewport: displayViewport,
                            displayWidth: displayViewport.width,
                            displayHeight: displayViewport.height
                        });
                    }
                    setPageDataList(renderedPages);
                    setLoading(false);
                }
                catch (err) {
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
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    createEffect(on(() => [pageDataList(), highlightColor()], () => {
        const _cleanup7 = untrack(() => {
            if (!containerRef.current || pageDataList().length === 0)
                return;
            const container = containerRef.current;
            container.innerHTML = '';
            highlightCanvasRefs.current.clear();
            pageRefs.current.clear();
            pageDataList().forEach((pageData, index) => {
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
                void renderPdfTextLayer({
                    textContentSource: pageData.textContent,
                    container: textLayerDiv,
                    viewport: pageData.viewport
                }).catch((err) => {
                    console.error('Failed to render PDF text layer:', err);
                });
                container.appendChild(pageWrapper);
            });
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    // Update cursor and pointer-events based on highlighter state
    createEffect(on(() => [highlighterEnabled()], () => {
        const _cleanup8 = untrack(() => {
            highlightCanvasRefs.current.forEach(canvas => {
                canvas.style.pointerEvents = highlighterEnabled() ? 'auto' : 'none';
                canvas.style.cursor = highlighterEnabled() ? 'crosshair' : 'default';
                canvas.style.zIndex = highlighterEnabled() ? '20' : '5';
            });
            // Also toggle text layer pointer events
            const textLayers = containerRef.current?.querySelectorAll('.textLayer');
            textLayers?.forEach(layer => {
                (layer as HTMLElement).style.pointerEvents = highlighterEnabled() ? 'none' : 'auto';
            });
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    return (<div class="pdf-viewer-wrapper">
      {/* Toolbar */}
      <div class="pdf-toolbar">
        {/* Page navigation */}
        <div class="page-navigation">
          <button class="nav-btn" onClick={goToPrevPage()} disabled={currentPage() <= 1} title="Previous page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          
          <span class="page-indicator">
            {currentPage()} / {totalPages()}
          </span>
          
          <button class="nav-btn" onClick={goToNextPage()} disabled={currentPage() >= totalPages()} title="Next page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          
          <form class="jump-to-page" onSubmit={handleJumpToPage()}>
            <input type="number" min="1" max={totalPages()} value={jumpToPageInput()} onInput={(e) => setJumpToPageInput((e.target as HTMLInputElement).value)} placeholder="Go" title="Jump to page"/>
            <button type="submit" title="Go">Go</button>
          </form>
        </div>
        
        {/* Highlighter toolbar */}
        <div class="highlighter-toolbar">
          <button class={`highlighter-toggle ${highlighterEnabled() ? 'active' : ''}`} onClick={() => setHighlighterEnabled(!highlighterEnabled())} title={highlighterEnabled() ? 'Disable highlighter' : 'Enable highlighter'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <span>Highlight</span>
          </button>
          
          {highlighterEnabled() && (<button class="clear-btn" onClick={clearHighlights} title="Clear all highlights">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              <span>Clear</span>
            </button>)}
        </div>
      </div>

      {loading() && (<div class="pdf-loading">
          <div class="pdf-spinner"></div>
          <span>Loading document...</span>
        </div>)}
      {error() && (<div class="pdf-error">
          <span>{error()}</span>
        </div>)}
      <div ref={_element => containerRef.current = _element} class="pdf-pages-container" style={cssStyle({ get display() {
                return loading() ? 'none' : 'block';
            } })}/>
    </div>);
};
export default PdfViewer;

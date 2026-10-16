import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from "./TutorDialog";
import TutorIcon from ".//TutorIcon";
import './ImageCropper.css';
interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
}
export const ImageCropper = (_props0: ImageCropperProps) => {
    const canvasRef = { current: null } as {
        current: HTMLCanvasElement | null;
    };
    const imageRef = { current: null } as {
        current: (HTMLImageElement | null) | null;
    };
    const containerRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const [zoom, setZoom] = createSignal(1);
    const [position, setPosition] = createSignal({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = createSignal(false);
    const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = createSignal(false);
    const [processing, setProcessing] = createSignal(false);
    const [CROP_SIZE, setCropSize] = createSignal(Math.min(280, window.innerWidth - 80));
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const resize = () => setCropSize(Math.min(280, window.innerWidth - 80));
            window.addEventListener("resize", resize);
            return () => window.removeEventListener("resize", resize);
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [_props0["imageSrc"]], () => {
        const _cleanup2 = untrack(() => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                imageRef.current = img;
                setImageLoaded(true);
                // Center the image initially
                setPosition({ x: 0, y: 0 });
            };
            img.src = _props0["imageSrc"];
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position().x, y: e.clientY - position().y });
    };
    const handleMouseMove = createMemo(on(() => [isDragging(), dragStart()], () => (e: MouseEvent) => {
        if (!isDragging())
            return;
        setPosition({
            x: e.clientX - dragStart().x,
            y: e.clientY - dragStart().y
        });
    }));
    const handleMouseUp = () => {
        setIsDragging(false);
    };
    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            setIsDragging(true);
            setDragStart({ x: touch.clientX - position().x, y: touch.clientY - position().y });
        }
    };
    const handleTouchMove = createMemo(on(() => [isDragging(), dragStart()], () => (e: TouchEvent) => {
        if (!isDragging() || e.touches.length !== 1)
            return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart().x,
            y: touch.clientY - dragStart().y
        });
    }));
    const handleTouchEnd = () => {
        setIsDragging(false);
    };
    createEffect(on(() => [handleMouseMove(), handleTouchMove()], () => {
        const _cleanup3 = untrack(() => {
            document.addEventListener('mousemove', handleMouseMove());
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove());
            document.addEventListener('touchend', handleTouchEnd);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove());
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleTouchMove());
                document.removeEventListener('touchend', handleTouchEnd);
            };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const handleZoomChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setZoom(parseFloat(target.value));
    };
    const cropImage = async () => {
        if (!imageRef.current || !canvasRef.current)
            return;
        setProcessing(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const img = imageRef.current;
        const outputSize = 400; // Output image size
        canvas.width = outputSize;
        canvas.height = outputSize;
        // Calculate the visible area
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect)
            return;
        const cropAreaLeft = (containerRect.width - CROP_SIZE()) / 2;
        const cropAreaTop = (containerRect.height - CROP_SIZE()) / 2;
        // Calculate the base display size (image is scaled to fit container height via CSS)
        const containerHeight = containerRect.height;
        const baseScale = containerHeight / img.naturalHeight;
        const baseDisplayWidth = img.naturalWidth * baseScale;
        const baseDisplayHeight = containerHeight;
        // Apply zoom to get the actual displayed dimensions
        const imgDisplayWidth = baseDisplayWidth * zoom();
        const imgDisplayHeight = baseDisplayHeight * zoom();
        const imgLeft = (containerRect.width - imgDisplayWidth) / 2 + position().x;
        const imgTop = (containerRect.height - imgDisplayHeight) / 2 + position().y;
        // Calculate source coordinates on original image
        const sourceX = ((cropAreaLeft - imgLeft) / imgDisplayWidth) * img.naturalWidth;
        const sourceY = ((cropAreaTop - imgTop) / imgDisplayHeight) * img.naturalHeight;
        const sourceWidth = (CROP_SIZE() / imgDisplayWidth) * img.naturalWidth;
        const sourceHeight = (CROP_SIZE() / imgDisplayHeight) * img.naturalHeight;
        // Draw circular clip
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // Draw the cropped image
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputSize, outputSize);
        // Convert to blob
        canvas.toBlob((blob) => {
            setProcessing(false);
            if (blob) {
                _props0["onCropComplete"](blob);
            }
        }, 'image/jpeg', 0.9);
    };
    return (<TutorDialog label="Crop profile photo" className="tutor-crop-dialog" onClose={_props0["onCancel"]} busy={processing()}>
      <div class="image-cropper-modal">
        <div class="cropper-header">
          <h3>Adjust Profile Picture</h3>
          <button class="cropper-close" onClick={_props0["onCancel"]} disabled={processing()} aria-label="Close photo cropper">
            <TutorIcon name="fas fa-times"/>
          </button>
        </div>

        <div class="cropper-body">
          <div ref={_element => containerRef.current = _element} class="cropper-container" onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}>
            {imageLoaded() && imageRef.current && (<img src={_props0["imageSrc"]} alt="Crop preview" class="cropper-image" style={cssStyle({
                get transform() {
                    return `translate(${position().x}px, ${position().y}px) scale(${zoom()})`;
                },
                get cursor() {
                    return isDragging() ? 'grabbing' : 'grab';
                }
            })} draggable={false}/>)}
            <div class="crop-overlay">
              <div class="crop-area" style={cssStyle({ get width() {
                return CROP_SIZE();
            }, get height() {
                return CROP_SIZE();
            } })}></div>
            </div>
          </div>

          <div class="zoom-controls">
            <TutorIcon name="fi-sr-search-minus"/>
            <input type="range" min="0.5" max="3" step="0.01" value={zoom()} onInput={handleZoomChange} class="zoom-slider" aria-label="Photo zoom"/>
            <TutorIcon name="fi-sr-search-plus"/>
          </div>

          <p class="cropper-hint">Drag to reposition • Use slider to zoom</p>
        </div>

        <div class="cropper-footer">
          <button class="btn-cropper-cancel" onClick={_props0["onCancel"]} disabled={processing()}>
            Cancel
          </button>
          <button class="btn-cropper-save" onClick={cropImage} disabled={processing()}>
            {processing() ? (<>
                <span class="btn-spinner"></span>
                Processing...
              </>) : (<>
                <TutorIcon name="fi-sr-check"/>
                Save Photo
              </>)}
          </button>
        </div>

        <canvas ref={_element => canvasRef.current = _element} style={cssStyle({ display: 'none' })}/>
      </div>
    </TutorDialog>);
};
export default ImageCropper;

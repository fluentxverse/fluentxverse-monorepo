import { h } from 'preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import './ImageCropper.css';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

export const ImageCropper = ({ 
  imageSrc, 
  onCropComplete, 
  onCancel,
  aspectRatio = 1 
}: ImageCropperProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const CROP_SIZE = 280;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      // Center the image initially
      setPosition({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleTouchMove]);

  const handleZoomChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setZoom(parseFloat(target.value));
  };

  const cropImage = async () => {
    if (!imageRef.current || !canvasRef.current) return;
    
    setProcessing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const outputSize = 400; // Output image size
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Calculate the visible area
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const cropAreaLeft = (containerRect.width - CROP_SIZE) / 2;
    const cropAreaTop = (containerRect.height - CROP_SIZE) / 2;

    // Calculate what part of the image is in the crop area
    const imgDisplayWidth = img.naturalWidth * zoom;
    const imgDisplayHeight = img.naturalHeight * zoom;
    
    const imgLeft = (containerRect.width - imgDisplayWidth) / 2 + position.x;
    const imgTop = (containerRect.height - imgDisplayHeight) / 2 + position.y;

    // Calculate source coordinates on original image
    const sourceX = ((cropAreaLeft - imgLeft) / imgDisplayWidth) * img.naturalWidth;
    const sourceY = ((cropAreaTop - imgTop) / imgDisplayHeight) * img.naturalHeight;
    const sourceWidth = (CROP_SIZE / imgDisplayWidth) * img.naturalWidth;
    const sourceHeight = (CROP_SIZE / imgDisplayHeight) * img.naturalHeight;

    // Draw circular clip
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Draw the cropped image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputSize, outputSize
    );

    // Convert to blob
    canvas.toBlob((blob) => {
      setProcessing(false);
      if (blob) {
        onCropComplete(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <div className="cropper-header">
          <h3>Adjust Profile Picture</h3>
          <button className="cropper-close" onClick={onCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="cropper-body">
          <div 
            ref={containerRef}
            className="cropper-container"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {imageLoaded && imageRef.current && (
              <img
                src={imageSrc}
                alt="Crop preview"
                className="cropper-image"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                draggable={false}
              />
            )}
            <div className="crop-overlay">
              <div className="crop-area" style={{ width: CROP_SIZE, height: CROP_SIZE }}></div>
            </div>
          </div>

          <div className="zoom-controls">
            <i className="fi-sr-search-minus"></i>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.01"
              value={zoom}
              onChange={handleZoomChange}
              className="zoom-slider"
            />
            <i className="fi-sr-search-plus"></i>
          </div>

          <p className="cropper-hint">Drag to reposition • Use slider to zoom</p>
        </div>

        <div className="cropper-footer">
          <button className="btn-cropper-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn-cropper-save" 
            onClick={cropImage}
            disabled={processing}
          >
            {processing ? (
              <>
                <span className="btn-spinner"></span>
                Processing...
              </>
            ) : (
              <>
                <i className="fi-sr-check"></i>
                Save Photo
              </>
            )}
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default ImageCropper;

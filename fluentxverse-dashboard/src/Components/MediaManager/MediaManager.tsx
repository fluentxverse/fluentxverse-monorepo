import { useState, useEffect, useRef } from 'preact/hooks';
import { lessonApi, type LessonMedia } from '../../api/lesson.api';
import { toastConfirm } from '../Toast/Toast';
import './MediaManager.css';

interface MediaManagerProps {
  lessonId: string;
  onMediaSelect?: (media: LessonMedia) => void;
  mode?: 'inline' | 'modal';
  onClose?: () => void;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  audio: 'ri-volume-up-line',
  video: 'ri-movie-line',
  image: 'ri-image-line',
  document: 'ri-file-text-line',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  audio: '#8b5cf6',
  video: '#ec4899',
  image: '#10b981',
  document: '#f59e0b',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaManager({
  lessonId,
  onMediaSelect,
  mode = 'inline',
  onClose
}: MediaManagerProps) {
  const [media, setMedia] = useState<LessonMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<LessonMedia | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video' | 'image' | 'document'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load media on mount
  useEffect(() => {
    loadMedia();
  }, [lessonId]);

  const loadMedia = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await lessonApi.getLessonMedia(lessonId);
      if (result.success && result.media) {
        setMedia(result.media);
      } else {
        setError(result.error || 'Failed to load media');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Detect file type from MIME
      let fileType: 'audio' | 'video' | 'image' | 'document' = 'document';
      if (file.type.startsWith('audio/')) fileType = 'audio';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.startsWith('image/')) fileType = 'image';

      const result = await lessonApi.uploadMedia(lessonId, file, { type: fileType });
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.media) {
        setMedia(prev => [result.media!, ...prev]);
        setTimeout(() => setUploadProgress(0), 500);
      } else {
        setError(result.error || 'Upload failed');
        setUploadProgress(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      input.value = '';
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (!await toastConfirm('Delete this file? This action cannot be undone.', 'Delete File')) return;

    try {
      const result = await lessonApi.deleteMedia(mediaId);
      if (result.success) {
        setMedia(prev => prev.filter(m => m.id !== mediaId));
        if (selectedMedia?.id === mediaId) {
          setSelectedMedia(null);
        }
      } else {
        setError(result.error || 'Failed to delete file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const filteredMedia = filterType === 'all' 
    ? media 
    : media.filter(m => m.type === filterType);

  const content = (
    <div className={`mm-container ${mode}`}>
      {error && (
        <div className="mm-error">
          <i className="ri-error-warning-line" />
          {error}
          <button type="button" onClick={() => setError(null)}>
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div className="mm-upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,image/*,.pdf,.doc,.docx,.ppt,.pptx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="mm-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <i className="ri-loader-4-line spinning" />
              Uploading... {uploadProgress}%
            </>
          ) : (
            <>
              <i className="ri-upload-cloud-2-line" />
              Upload Media
            </>
          )}
        </button>
        <p className="mm-upload-hint">
          Supports audio, video, images, and documents (max 50MB)
        </p>
        {isUploading && (
          <div className="mm-progress-bar">
            <div className="mm-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mm-filter-tabs">
        {(['all', 'audio', 'video', 'image', 'document'] as const).map(type => (
          <button
            key={type}
            type="button"
            className={`mm-filter-tab ${filterType === type ? 'active' : ''}`}
            onClick={() => setFilterType(type)}
          >
            {type === 'all' ? (
              <i className="ri-apps-line" />
            ) : (
              <i className={FILE_TYPE_ICONS[type]} style={{ color: FILE_TYPE_COLORS[type] }} />
            )}
            {type.charAt(0).toUpperCase() + type.slice(1)}
            <span className="mm-count">
              {type === 'all' ? media.length : media.filter(m => m.type === type).length}
            </span>
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="mm-loading">
          <i className="ri-loader-4-line spinning" />
          Loading media...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="mm-empty">
          <i className="ri-folder-open-line" />
          <p>No media files {filterType !== 'all' ? `of type "${filterType}"` : ''}</p>
        </div>
      ) : (
        <div className="mm-grid">
          {filteredMedia.map(item => (
            <div
              key={item.id}
              className={`mm-item ${selectedMedia?.id === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedMedia(item)}
              onDblClick={() => onMediaSelect?.(item)}
            >
              <div className="mm-item-preview" style={{ background: FILE_TYPE_COLORS[item.type] + '15' }}>
                {item.type === 'image' ? (
                  <img src={item.storagePath} alt={item.filename} />
                ) : (
                  <i className={FILE_TYPE_ICONS[item.type]} style={{ color: FILE_TYPE_COLORS[item.type] }} />
                )}
              </div>
              <div className="mm-item-info">
                <span className="mm-item-name" title={item.filename}>
                  {item.title || item.filename}
                </span>
                <span className="mm-item-meta">
                  {formatFileSize(item.fileSize)}
                </span>
              </div>
              <div className="mm-item-actions">
                <a
                  href={item.storagePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mm-action-btn"
                  title="Open"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="ri-external-link-line" />
                </a>
                <button
                  type="button"
                  className="mm-action-btn delete"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Media Details */}
      {selectedMedia && (
        <div className="mm-details">
          <h5>Selected: {selectedMedia.title || selectedMedia.filename}</h5>
          <div className="mm-details-info">
            <span><strong>Type:</strong> {selectedMedia.type}</span>
            <span><strong>Size:</strong> {formatFileSize(selectedMedia.fileSize)}</span>
            {selectedMedia.mimeType && <span><strong>MIME:</strong> {selectedMedia.mimeType}</span>}
            {selectedMedia.duration && <span><strong>Duration:</strong> {selectedMedia.duration}s</span>}
          </div>
          {onMediaSelect && (
            <button
              type="button"
              className="mm-select-btn"
              onClick={() => onMediaSelect(selectedMedia)}
            >
              <i className="ri-check-line" />
              Use This File
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="mm-modal-overlay" onClick={onClose}>
        <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mm-modal-header">
            <h3>
              <i className="ri-folder-music-line" />
              Media Library
            </h3>
            <button type="button" className="mm-close" onClick={onClose}>
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="mm-modal-body">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}

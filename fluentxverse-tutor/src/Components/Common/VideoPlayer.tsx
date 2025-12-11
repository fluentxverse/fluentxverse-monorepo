import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import './VideoPlayer.css';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onClose?: () => void;
  isModal?: boolean;
  hideBigPlayButton?: boolean;
}

export const VideoPlayer = ({ src, poster, onClose, isModal = false, hideBigPlayButton = false }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleProgressClick = (e: MouseEvent) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: Event) => {
    const video = videoRef.current;
    const target = e.target as HTMLInputElement;
    if (!video) return;

    const newVolume = parseFloat(target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const playerContent = (
    <div 
      className={`fxv-video-player ${isModal ? 'fxv-video-modal' : ''} ${showControls ? 'show-controls' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="fxv-video"
        onClick={togglePlay}
        preload="metadata"
      />

      {/* Loading Spinner - only show when playing and buffering */}
      {isLoading && isPlaying && (
        <div className="fxv-loading">
          <div className="fxv-spinner"></div>
        </div>
      )}

      {/* Big Play Button (when paused) */}
      {!isPlaying && !isLoading && !hideBigPlayButton && (
        <button className="fxv-big-play" onClick={togglePlay}>
          <i className="fi-sr-play"></i>
        </button>
      )}

      {/* Controls Overlay */}
      <div className={`fxv-controls ${showControls || !isPlaying ? 'visible' : ''}`}>
        {/* Progress Bar */}
        <div 
          className="fxv-progress-container"
          ref={progressRef}
          onClick={handleProgressClick}
        >
          <div className="fxv-progress-bar">
            <div className="fxv-progress-filled" style={{ width: `${progress}%` }}></div>
            <div className="fxv-progress-handle" style={{ left: `${progress}%` }}></div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="fxv-controls-row">
          {/* Left Controls */}
          <div className="fxv-controls-left">
            <button className="fxv-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              <i className={isPlaying ? 'fi-sr-pause' : 'fi-sr-play'}></i>
            </button>

            <button className="fxv-btn" onClick={() => skip(-10)} title="Rewind 10s">
              <i className="fi-sr-rewind"></i>
            </button>

            <button className="fxv-btn" onClick={() => skip(10)} title="Forward 10s">
              <i className="fi-sr-forward"></i>
            </button>

            <div className="fxv-volume-group">
              <button className="fxv-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                <i className={isMuted || volume === 0 ? 'fi-sr-volume-mute' : volume < 0.5 ? 'fi-sr-volume' : 'fi-sr-volume'}></i>
              </button>
              <input
                type="range"
                className="fxv-volume-slider"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
              />
            </div>

            <span className="fxv-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="fxv-controls-right">
            {/* Branding */}
            <span className="fxv-branding">FluentXVerse</span>

            <button className="fxv-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              <i className={isFullscreen ? 'fi-sr-compress' : 'fi-sr-expand'}></i>
            </button>

            {isModal && onClose && (
              <button className="fxv-btn fxv-close-btn" onClick={onClose} title="Close">
                <i className="fi-sr-cross"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fxv-modal-overlay" onClick={onClose}>
        <div className="fxv-modal-content" onClick={(e) => e.stopPropagation()}>
          {playerContent}
        </div>
      </div>
    );
  }

  return playerContent;
};

export default VideoPlayer;

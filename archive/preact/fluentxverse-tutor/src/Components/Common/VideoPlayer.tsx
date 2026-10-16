import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import TutorDialog from './TutorDialog';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Minimize, Maximize, X } from 'lucide-preact';
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
  const [playError, setPlayError] = useState('');
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

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      try { await video.play(); setPlayError(''); } catch { setPlayError('Video unavailable. Please try again later.'); return; }
    }
    setIsPlaying(!isPlaying);
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
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => setIsFullscreen(false));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
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
      tabIndex={0}
      onFocusIn={() => setShowControls(true)}
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
        onError={() => { setPlayError('Video unavailable. Please try again later.'); setIsLoading(false); setIsPlaying(false); }}
      />

      {playError && <p className="fxv-video-error" role="alert">{playError}</p>}
      {/* Loading Spinner - only show when playing and buffering */}
      {isLoading && isPlaying && (
        <div className="fxv-loading">
          <div className="fxv-spinner"></div>
        </div>
      )}

      {/* Big Play Button (when paused) */}
      {!playError && !isPlaying && !isLoading && !hideBigPlayButton && (
        <button aria-label="Play introduction video" title="Play introduction video" className="fxv-big-play" onClick={togglePlay}>
          <Play size={24} />
        </button>
      )}

      {/* Controls Overlay */}
      <div className={`fxv-controls ${showControls || !isPlaying ? 'visible' : ''}`}>
        {/* Progress Bar */}
        <input className="fxv-progress-slider" type="range" min={0} max={Number.isFinite(duration) ? duration : 0} step={0.1} value={currentTime} aria-label="Video position" disabled={!duration} onInput={event => { if (videoRef.current) videoRef.current.currentTime = Number(event.currentTarget.value); }} />

        {/* Bottom Controls */}
        <div className="fxv-controls-row">
          {/* Left Controls */}
          <div className="fxv-controls-left">
            <button className="fxv-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button className="fxv-btn" onClick={() => skip(-10)} title="Rewind 10s">
              <RotateCcw size={18} />
            </button>

            <button className="fxv-btn" onClick={() => skip(10)} title="Forward 10s">
              <RotateCw size={18} />
            </button>

            <div className="fxv-volume-group">
              <button className="fxv-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                aria-label="Video volume"
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
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            {isModal && onClose && (
              <button className="fxv-btn fxv-close-btn" onClick={onClose} title="Close">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <TutorDialog className="tutor-video-dialog" label="Tutor introduction video" onClose={() => onClose?.()}>
        <div className="student-video-content">
          {playerContent}
        </div>
      </TutorDialog>
    );
  }

  return playerContent;
};

export default VideoPlayer;

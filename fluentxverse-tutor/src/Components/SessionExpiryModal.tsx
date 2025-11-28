import { useEffect, useState } from 'preact/hooks';
import { refreshSession } from '../api/auth.api';
import './SessionExpiryModal.css';

interface Props {
  isAuthenticated: boolean;
  onRefreshed?: () => void;
  // Optional override; defaults to 30 minutes
  sessionMinutes?: number;
  // Warn when this many minutes remain (default 3)
  warnMinutes?: number;
}

export default function SessionExpiryModal({
  isAuthenticated,
  onRefreshed,
  sessionMinutes = 30,
  warnMinutes = 3
}: Props) {
  const [show, setShow] = useState(false);
  const [remaining, setRemaining] = useState(sessionMinutes * 60); // seconds

  useEffect(() => {
    if (!isAuthenticated) {
      setShow(false);
      return;
    }
    // Track session time in memory; reset on mount
    let start = Date.now();
    setShow(false);
    setRemaining(sessionMinutes * 60);

    const interval = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - start) / 1000);
      const left = sessionMinutes * 60 - elapsedSec;
      setRemaining(left);
      if (left <= warnMinutes * 60) setShow(true);
      if (left <= 0) {
        window.clearInterval(interval);
        setShow(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthenticated, sessionMinutes, warnMinutes]);

  const onRefresh = async () => {
    try {
      const res = await refreshSession();
      if (res?.success) {
        // Reset timer
        setShow(false);
        setRemaining(sessionMinutes * 60);
        if (onRefreshed) onRefreshed();
      }
    } catch (e) {
      // keep modal open to let user retry
    }
  };

  if (!show) return null;
  const minutes = Math.max(0, Math.floor(remaining / 60));
  const seconds = Math.max(0, remaining % 60);

  return (
    <div className="session-modal-overlay">
      <div className="session-modal">
        <div className="session-title">Session Expiring Soon</div>
        <div className="session-body">
          Your session will expire in <strong>{minutes}:{seconds.toString().padStart(2,'0')}</strong>.
        </div>
        <div className="session-actions">
          <button className="session-refresh" onClick={onRefresh}>
            Refresh Session
          </button>
          <button className="session-dismiss" onClick={() => setShow(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
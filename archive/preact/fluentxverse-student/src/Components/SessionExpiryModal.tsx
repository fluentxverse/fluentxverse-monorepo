import { useEffect, useState, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { useClassroomSessionRefresh } from '../hooks/useClassroomSessionRefresh';
import { useToastContext } from '../context/ToastContext';
import StudentDialog from './Common/StudentDialog';
import { RotateCw } from 'lucide-preact';

interface Props {
  isAuthenticated: boolean;
  autoRefresh?: boolean;
  onRefreshed?: () => void;
  // Optional override; defaults to 30 minutes
  sessionMinutes?: number;
  // Warn when this many minutes remain (default 3)
  warnMinutes?: number;
}

export default function SessionExpiryModal({
  isAuthenticated,
  autoRefresh = false,
  onRefreshed,
  sessionMinutes = 30,
  warnMinutes = 3
}: Props) {
  const [show, setShow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [remaining, setRemaining] = useState(sessionMinutes * 60); // seconds
  const startTimeRef = useRef<number>(Date.now());
  const { showSuccess, showError } = useToastContext();
  const { ensureSession } = useAuthContext();
  useClassroomSessionRefresh(isAuthenticated && autoRefresh, ensureSession, () => {
    startTimeRef.current = Date.now();
    setRemaining(sessionMinutes * 60);
    setShow(false);
    onRefreshed?.();
  });

  useEffect(() => {
    if (!isAuthenticated || autoRefresh) {
      setShow(false);
      return;
    }
    // Track session time in memory; reset on mount
    startTimeRef.current = Date.now();
    setShow(false);
    setRemaining(sessionMinutes * 60);

    const interval = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
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
  }, [isAuthenticated, autoRefresh, sessionMinutes, warnMinutes]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await ensureSession();
      startTimeRef.current = Date.now();
      setShow(false);
      setRemaining(sessionMinutes * 60);
      onRefreshed?.();
      showSuccess('Session refreshed. You can continue where you left off.');
    } catch (e) {
      showError('Could not refresh your session. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (autoRefresh || !show) return null;
  const minutes = Math.max(0, Math.floor(remaining / 60));
  const seconds = Math.max(0, remaining % 60);

  return (
    <StudentDialog label="Session expiring soon" onClose={() => setShow(false)} busy={refreshing}>
      <div className="session-modal">
        <img className="student-dialog-art" src="/assets/img/home-icons/schedule-v1.webp" alt="" /><h2>Session expiring soon</h2>
        <div className="session-body">
          Your session will expire in <strong>{minutes}:{seconds.toString().padStart(2,'0')}</strong>.
        </div>
        <div className="student-dialog-actions">
          <button className="primary" onClick={onRefresh} disabled={refreshing}>
            <RotateCw size={16} />{refreshing ? 'Refreshing...' : 'Refresh session'}
          </button>
          <button disabled={refreshing} onClick={() => setShow(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </StudentDialog>
  );
}

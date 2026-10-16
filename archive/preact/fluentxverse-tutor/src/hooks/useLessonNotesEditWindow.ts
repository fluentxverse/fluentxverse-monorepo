import { useEffect, useState } from 'preact/hooks';
import { tutorApi, type LessonNotesEditWindow } from '../api/tutor.api';

export function useLessonNotesEditWindow(sessionId: string) {
  const [windowInfo, setWindowInfo] = useState<LessonNotesEditWindow | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [clock, setClock] = useState({ offset: 0, now: Date.now() });
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    tutorApi
      .getLessonNotesEditWindow(sessionId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setClock({ offset: Date.parse(data.serverNow) - Date.now(), now: Date.now() });
        setWindowInfo(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [sessionId, revision]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const timer = window.setInterval(() => setClock((value) => ({ ...value, now: Date.now() })), 1000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const now = clock.now + clock.offset;
  const canEdit = Boolean(
    !error &&
      windowInfo &&
      windowInfo.reason !== 'cancelled' &&
      now >= Date.parse(windowInfo.startsAt) &&
      now < Date.parse(windowInfo.editableUntil),
  );
  return { windowInfo, canEdit, error, retry: () => setRevision((value) => value + 1) };
}

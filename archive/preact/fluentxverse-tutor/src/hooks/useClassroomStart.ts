import { useEffect, useState } from 'preact/hooks';
import type { Socket } from 'socket.io-client';
import { CLASSROOM_WRAP_UP_MS } from '../utils/classroomWindow';

export function useClassroomStart(socket: Socket | null, sessionId?: string) {
  const [schedule, setSchedule] = useState<{ startsAt: number; endsAt: number; offset: number } | null>(null);
  const [serverClosed, setServerClosed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setSchedule(null);
    setServerClosed(false);
    if (!socket || !sessionId) return;
    const state = (data: { sessionId: string; startsAt?: string; endsAt?: string; serverNow?: string }) => {
      if (data.sessionId !== sessionId || !data.startsAt || !data.endsAt || !data.serverNow) return;
      const startsAt = Date.parse(data.startsAt), endsAt = Date.parse(data.endsAt), serverNow = Date.parse(data.serverNow);
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || !Number.isFinite(serverNow)) return;
      setSchedule({ startsAt, endsAt, offset: serverNow - Date.now() });
      setNow(Date.now());
    };
    const disconnect = () => setSchedule(current => current && Date.now() + current.offset >= current.endsAt + CLASSROOM_WRAP_UP_MS ? current : null);
    const close = (data: { sessionId: string }) => { if (data.sessionId === sessionId) setServerClosed(true); };
    socket.on('session:state', state);
    socket.on('disconnect', disconnect);
    socket.on('session:classroom-closed', close);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => { socket.off('session:state', state); socket.off('disconnect', disconnect); socket.off('session:classroom-closed', close); window.clearInterval(timer); };
  }, [socket, sessionId]);
  const remaining = schedule ? Math.max(0, Math.ceil((schedule.startsAt - now - schedule.offset) / 1000)) : null;
  const closed = serverClosed || Boolean(schedule && now + schedule.offset >= schedule.endsAt + CLASSROOM_WRAP_UP_MS);
  const wrapUp = Boolean(schedule && now + schedule.offset >= schedule.endsAt && !closed);
  const wrapSeconds = schedule ? Math.max(0, Math.ceil((schedule.endsAt + CLASSROOM_WRAP_UP_MS - now - schedule.offset) / 1000)) : 0;
  return {
    live: remaining === 0 && !closed,
    closed,
    wrapUp,
    wrapUpMessage: `Wrap-up · Classroom closes in ${Math.floor(wrapSeconds / 60)}:${String(wrapSeconds % 60).padStart(2, '0')}`,
    elapsed: schedule ? Math.max(0, Math.floor((now + schedule.offset - schedule.startsAt) / 1000)) : 0,
    message: closed ? 'Classroom closed. The three-minute wrap-up has ended.' : remaining === null ? 'Checking scheduled lesson time...'
      : `Lesson starts in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · Chat and call unavailable`,
  };
}

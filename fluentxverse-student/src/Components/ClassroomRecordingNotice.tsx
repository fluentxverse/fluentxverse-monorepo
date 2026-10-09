import { useEffect, useState } from 'preact/hooks';
import type { Socket } from 'socket.io-client';
import './ClassroomRecordingNotice.css';

type RecordingState = { enabled: boolean; version: string; retentionDays: number; accepted: boolean | null; status: string; error?: string };
export function ClassroomRecordingNotice({ socket, provider }: { socket?: Socket | null; provider?: string }) {
  const [state, setState] = useState<RecordingState | null>(null);
  const [authority, setAuthority] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (provider !== 'realtimekit' || !socket) return;
    let cancelled = false;
    const refresh = () => {
      if (!socket.connected) return;
      socket.timeout(8000).emit('classroom:recording-state', (timeout: Error | null, result: RecordingState) => {
        if (cancelled) return;
        if (timeout || result?.error) { setError('Recording status unavailable'); return; }
        setState(result); setError('');
      });
    };
    refresh();
    socket.on('connect', refresh);
    const timer = setInterval(refresh, 10000);
    return () => { cancelled = true; clearInterval(timer); socket.off('connect', refresh); };
  }, [socket, provider]);
  if (provider !== 'realtimekit' || (state && !state.enabled)) return null;
  const decide = (accepted: boolean) => {
    if (!state || !socket || pending) return;
    setPending(true);
    socket.timeout(8000).emit('classroom:recording-consent', { accepted, authority: accepted && authority, version: state.version },
      (timeout: Error | null, result: RecordingState) => {
        setPending(false);
        if (timeout || result?.error) { setError('Unable to save your choice. Please retry.'); return; }
        setState(result); setError('');
      });
  };
  const labels: Record<string,string> = {
    recording: 'Recording for quality assurance', invoked: 'Recording is starting',
    uploading: 'Recording is processing', uploaded: 'Recording finished',
    waiting: 'Recording awaits both participants', declined: 'Recording not authorized',
    errored: 'Recording failed', paused: 'Recording paused',
  };
  return <section className="classroom-recording-notice" aria-label="Lesson recording">
    <div className="qa-notice-status" role="status">
      <i className={state?.status === 'recording' ? 'fas fa-circle qa-recording-active' : 'fas fa-shield-alt'} aria-hidden="true" />
      <span>{error || (state ? labels[state.status] || 'Recording status unavailable' : 'Checking recording status')}</span>
    </div>
    {state?.accepted === null && <>
      <p>This lesson may be recorded for quality assurance after both participants agree. Cloudflare processes the recording; an encrypted copy is stored on FluentXVerse servers for {state.retentionDays} days. Only authorized administrators can review it. You may continue without recording.</p>
      <label><input type="checkbox" checked={authority} onChange={event => setAuthority(event.currentTarget.checked)} />I am an adult agreeing for myself, or the parent/legal guardian authorizing this learner's recording.</label>
      <div className="qa-notice-actions">
        <button type="button" disabled={!authority || pending} onClick={() => decide(true)}>Agree to recording</button>
        <button type="button" disabled={pending} onClick={() => decide(false)}>Continue without recording</button>
      </div>
    </>}
    {state?.accepted === true && <button type="button" className="qa-withdraw" disabled={pending} onClick={() => decide(false)}>Withdraw recording permission</button>}
    {state?.accepted === false && <span className="qa-notice-declined">This lesson can continue without recording.</span>}
  </section>;
}

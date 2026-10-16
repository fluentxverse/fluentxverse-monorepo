import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { AlertCircle, LoaderCircle, ShieldCheck, X } from 'lucide-preact';
import type { Socket } from 'socket.io-client';
import './ClassroomRecordingNotice.css';

type RecordingState = { enabled: boolean; version: string; retentionDays: number; accepted: boolean | null; status: string; error?: string };
export function ClassroomRecordingNotice({ socket, provider, openRevision = 0, onAvailabilityChange }: {
  socket?: Socket | null; provider?: string; openRevision?: number; onAvailabilityChange?: (available: boolean) => void;
}) {
  const [state, setState] = useState<RecordingState | null>(null);
  const [open, setOpen] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const stateRef = useRef<RecordingState | null>(null);
  const busy = useRef(false);
  const prompted = useRef(false);
  const epoch = useRef(0);
  const requestRevision = useRef(0);
  const lastRequest = useRef(0);
  const delay = useRef<ReturnType<typeof setTimeout>>();
  const visible = open && provider === 'realtimekit' && Boolean(state?.enabled);
  useEffect(() => {
    const generation = ++epoch.current;
    busy.current = false; setPending(false);
    if (provider !== 'realtimekit' || !socket) return;
    let checking = false;
    const refresh = () => {
      if (!socket.connected || checking || busy.current || stateRef.current) return;
      checking = true; lastRequest.current = Date.now();
      const revision = requestRevision.current;
      socket.timeout(8000).emit('classroom:recording-state', (timeout: Error | null, result: RecordingState) => {
        checking = false;
        if (generation !== epoch.current || revision !== requestRevision.current || busy.current) return;
        if (timeout || result?.error || typeof result?.enabled !== 'boolean') return;
        stateRef.current = result; setState(result); setError('');
        if (result.enabled && result.accepted === null && !prompted.current) {
          prompted.current = true; setOpen(true);
        }
      });
    };
    refresh();
    socket.on('connect', refresh);
    const timer = setInterval(refresh, 10000);
    return () => { epoch.current++; clearInterval(timer); clearTimeout(delay.current); socket.off('connect', refresh); };
  }, [socket, provider]);
  useEffect(() => { onAvailabilityChange?.(provider === 'realtimekit' && Boolean(state?.enabled)); }, [state?.enabled, provider, onAvailabilityChange]);
  useEffect(() => {
    if (openRevision && stateRef.current?.enabled) {
      setAuthority(stateRef.current.accepted === true); setError(''); setOpen(true);
    }
  }, [openRevision]);
  useLayoutEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    element?.querySelector<HTMLElement>('h2')?.focus();
    return () => { element?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [visible]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const decide = (accepted: boolean) => {
    if (!state || !socket || busy.current || (accepted && !authority)) return;
    if (!socket.connected) { setError('You are offline. Reconnect, then try again.'); return; }
    busy.current = true; setPending(true); setError('');
    requestRevision.current++;
    const generation = epoch.current;
    // The server rate-limits notice requests, including the initial status read.
    delay.current = setTimeout(() => {
      if (generation !== epoch.current) return;
      lastRequest.current = Date.now();
      socket.timeout(8000).emit('classroom:recording-consent', { accepted, authority: accepted && authority, version: state.version },
        (timeout: Error | null, result: RecordingState) => {
          if (generation !== epoch.current) return;
          busy.current = false; setPending(false);
          if (timeout || result?.error || result?.accepted !== accepted) { setError('Could not save your recording choice. Please try again.'); return; }
          stateRef.current = result; setState(result); setError(''); setOpen(false);
        });
    }, Math.max(0, 550 - (Date.now() - lastRequest.current)));
  };

  if (!visible || !state) return null;
  return createPortal(<dialog className="student-recording-dialog" ref={dialog} aria-labelledby="student-recording-title" aria-describedby="student-recording-description"
    onCancel={event => { event.preventDefault(); if (!busy.current) setOpen(false); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <header><img src="/assets/img/home-icons/community-v1.webp" alt="" /><h2 id="student-recording-title" tabIndex={-1}>Lesson recording</h2>
      <button className="recording-close" type="button" disabled={pending} title="Close recording permission" aria-label="Close recording permission" onClick={() => { if (!busy.current) setOpen(false); }}><X size={20} /></button></header>
    <div className="recording-dialog-body">
      {error && <p className="recording-error" role="alert" tabIndex={-1} ref={errorRef}><AlertCircle size={18} />{error}</p>}
      <p id="student-recording-description">May we record this lesson for quality assurance? Recording starts only when both you and your tutor agree.</p>
      <p className="recording-details">Cloudflare processes the recording. An encrypted copy is kept on FluentXVerse servers for {state.retentionDays} days and can be reviewed only by authorized administrators.</p>
      <p className="recording-details">Your lesson continues normally if you decline. Your choice is optional and can be changed later.</p>
      {state.accepted !== null && <p className="recording-current-choice">Current choice: {state.accepted ? 'Recording allowed' : 'No recording'}</p>}
      <label className="recording-authority"><input type="checkbox" checked={authority} disabled={pending} onClick={event => setAuthority(event.currentTarget.checked)} /><span>I am an adult agreeing for myself, or the parent/legal guardian authorizing this learner's recording.</span></label>
    </div>
    <footer><button type="button" className="recording-decline" disabled={pending} onClick={() => decide(false)}>Don't record</button>
      <button type="button" className="recording-agree" disabled={!authority || pending} onClick={() => decide(true)}>{pending ? <LoaderCircle size={18} className="recording-spinner" /> : <ShieldCheck size={18} />}Agree</button>
      {pending && <span className="recording-saving" role="status">Saving your choice...</span>}</footer>
  </dialog>, document.body);
}

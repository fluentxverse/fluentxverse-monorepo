import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { ArrowRight, CircleCheck, Star, X } from 'lucide-preact';
import type { Socket } from 'socket.io-client';
import { lessonSurveyApi, type LessonSurveyState } from '../api/lessonSurvey.api';
import StudentLessonSurvey from './StudentLessonSurvey';
import './ClassroomLessonSurvey.css';

function alreadyPrompted(bookingId: string) {
  try { return sessionStorage.getItem(`lesson-survey-prompt:${bookingId}`) === 'dismissed'; } catch { return false; }
}

export default function ClassroomLessonSurvey({ bookingId, socket, placement = 'classroom' }: {
  bookingId: string; socket?: Socket | null; placement?: 'classroom' | 'lesson';
}) {
  const [data, setData] = useState<LessonSurveyState | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const prompted = useRef(alreadyPrompted(bookingId));
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<(manual?: boolean) => void>(() => {});

  useEffect(() => {
    if (!socket && placement === 'classroom') return;
    let disposed = false, checking = false, generation = 0;
    let queued: { manual: boolean; initial: boolean } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const check = async (manual = false, initial = false) => {
      if (checking) {
        queued = { manual: manual || Boolean(queued?.manual), initial: initial && (queued?.initial ?? true) };
        return;
      }
      checking = true;
      const currentGeneration = generation;
      try {
        const result = await lessonSurveyApi.get(bookingId, controller.signal);
        if (disposed) return;
        setData(result); setLoadError('');
        if (currentGeneration === generation && (manual || (placement === 'classroom' && result.eligible && !result.survey &&
          !prompted.current && (!initial || Boolean(result.readyAt))))) {
          prompted.current = true; setOpen(true);
        }
      } catch {
        if (!disposed && (!initial || manual) && currentGeneration === generation && (manual || !prompted.current)) {
          prompted.current = true;
          setLoadError('Could not load your lesson survey. Please try again.'); setOpen(true);
        }
      } finally {
        checking = false;
        if (!disposed) setLoading(false);
        if (queued && !disposed) { const next = queued; queued = null; void check(next.manual, next.initial); }
      }
    };
    request.current = manual => { void check(manual); };
    const departed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void check(); }, 1500);
    };
    const ready = (event: { sessionId: string; reason: string }) => {
      if (event.sessionId !== bookingId) return;
      if (event.reason === 'left') departed(); else { void check(); }
    };
    const joined = (event: { userType: string }) => {
      if (event.userType !== 'tutor') return;
      generation++;
      if (timer) clearTimeout(timer);
      queued = null;
    };
    const left = (event: { userType: string }) => { if (event.userType === 'tutor') departed(); };
    const ended = () => { void check(); };
    const closed = (event: { sessionId: string }) => { if (event.sessionId === bookingId) void check(); };
    socket?.on('session:survey-ready', ready);
    socket?.on('session:user-joined', joined);
    socket?.on('session:user-left', left);
    socket?.on('session:lesson-ended', ended);
    socket?.on('session:classroom-closed', closed);
    void check(false, true);
    return () => {
      disposed = true; controller.abort(); if (timer) clearTimeout(timer);
      socket?.off('session:survey-ready', ready);
      socket?.off('session:user-joined', joined);
      socket?.off('session:user-left', left);
      socket?.off('session:lesson-ended', ended);
      socket?.off('session:classroom-closed', closed);
      request.current = () => {};
    };
  }, [bookingId, socket, placement]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const close = () => {
    if (saving) return;
    prompted.current = true;
    try { sessionStorage.setItem(`lesson-survey-prompt:${bookingId}`, 'dismissed'); } catch {}
    setOpen(false);
  };
  return <>
    {placement === 'lesson' ? (!data || data.eligible || data.survey) && <div className="lesson-classroom-feedback">
      <button type="button" disabled={loading || saving} aria-haspopup="dialog" onClick={() => request.current(true)}>
        {data?.survey ? <CircleCheck size={19} /> : <Star size={19} />}<span>{data?.survey ? 'View lesson feedback' : 'Lesson feedback'}</span><ArrowRight size={18} />
      </button>
    </div> : data?.eligible && !data.survey && <button className="classroom-survey-open" type="button" aria-haspopup="dialog" onClick={() => request.current(true)}><Star size={16} />Lesson feedback</button>}
    {createPortal(<dialog ref={dialog} className="classroom-survey-dialog" aria-labelledby="classroom-survey-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header><div><span>Optional lesson survey</span><h2 id="classroom-survey-title">Lesson feedback</h2></div>
        <button type="button" className="classroom-survey-close" title="Close survey" aria-label="Close survey" disabled={saving} onClick={close}><X size={18} /></button></header>
      <div className="classroom-survey-content">
        {loadError ? <p role="alert">{loadError}<button type="button" onClick={() => request.current(true)}>Try again</button></p>
          : data && <StudentLessonSurvey bookingId={bookingId} mode="flow" initialData={data} onBusyChange={setSaving}
            onSubmitted={survey => setData(previous => previous && (previous.survey === survey ? previous : { ...previous, eligible: false, survey }))} />}
      </div>
      <div className="classroom-survey-dismiss"><button type="button" disabled={saving} onClick={close}>{data?.survey ? 'Done' : 'Maybe later'}</button>
        {data?.survey && placement === 'classroom' && <a href={`/lesson/${encodeURIComponent(bookingId)}`}>View lesson recap</a>}</div>
    </dialog>, document.body)}
  </>;
}

import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowRight, CircleCheck, Star, X } from "lucide-solid";
import type { Socket } from 'socket.io-client';
import { lessonSurveyApi, type LessonSurveyState } from '../api/lessonSurvey.api';
import StudentLessonSurvey from './StudentLessonSurvey';
import './ClassroomLessonSurvey.css';
function alreadyPrompted(bookingId: string) {
    try {
        return sessionStorage.getItem(`lesson-survey-prompt:${bookingId}`) === 'dismissed';
    }
    catch {
        return false;
    }
}
export default function ClassroomLessonSurvey(_props0: {
    bookingId: string;
    socket?: Socket | null;
    placement?: 'classroom' | 'lesson';
}) {
    const [data, setData] = createSignal<LessonSurveyState | null>(null);
    const [open, setOpen] = createSignal(false);
    const [loadError, setLoadError] = createSignal('');
    const [saving, setSaving] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const prompted = { current: alreadyPrompted(_props0["bookingId"]) } as {
        current: any;
    };
    const dialog = { current: null } as {
        current: HTMLDialogElement | null;
    };
    const request = { current: () => { } } as {
        current: ((manual?: boolean) => void) | null;
    };
    createEffect(on(() => [_props0["bookingId"], _props0["socket"], _props0["placement"] === undefined ? 'classroom' : _props0["placement"]], () => {
        const _cleanup1 = untrack(() => {
            if (!_props0["socket"] && (_props0["placement"] === undefined ? 'classroom' : _props0["placement"]) === 'classroom')
                return;
            let disposed = false, checking = false, generation = 0;
            let queued: {
                manual: boolean;
                initial: boolean;
            } | null = null;
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
                    const result = await lessonSurveyApi.get(_props0["bookingId"], controller.signal);
                    if (disposed)
                        return;
                    setData(result);
                    setLoadError('');
                    if (currentGeneration === generation && (manual || ((_props0["placement"] === undefined ? 'classroom' : _props0["placement"]) === 'classroom' && result.eligible && !result.survey &&
                        !prompted.current && (!initial || Boolean(result.readyAt))))) {
                        prompted.current = true;
                        setOpen(true);
                    }
                }
                catch {
                    if (!disposed && (!initial || manual) && currentGeneration === generation && (manual || !prompted.current)) {
                        prompted.current = true;
                        setLoadError('Could not load your lesson survey. Please try again.');
                        setOpen(true);
                    }
                }
                finally {
                    checking = false;
                    if (!disposed)
                        setLoading(false);
                    if (queued && !disposed) {
                        const next = queued;
                        queued = null;
                        void check(next.manual, next.initial);
                    }
                }
            };
            request.current = manual => { void check(manual); };
            const departed = () => {
                if (timer)
                    clearTimeout(timer);
                timer = setTimeout(() => { void check(); }, 1500);
            };
            const ready = (event: {
                sessionId: string;
                reason: string;
            }) => {
                if (event.sessionId !== _props0["bookingId"])
                    return;
                if (event.reason === 'left')
                    departed();
                else {
                    void check();
                }
            };
            const joined = (event: {
                userType: string;
            }) => {
                if (event.userType !== 'tutor')
                    return;
                generation++;
                if (timer)
                    clearTimeout(timer);
                queued = null;
            };
            const left = (event: {
                userType: string;
            }) => { if (event.userType === 'tutor')
                departed(); };
            const ended = () => { void check(); };
            const closed = (event: {
                sessionId: string;
            }) => { if (event.sessionId === _props0["bookingId"])
                void check(); };
            _props0["socket"]?.on('session:survey-ready', ready);
            _props0["socket"]?.on('session:user-joined', joined);
            _props0["socket"]?.on('session:user-left', left);
            _props0["socket"]?.on('session:lesson-ended', ended);
            _props0["socket"]?.on('session:classroom-closed', closed);
            void check(false, true);
            return () => {
                disposed = true;
                controller.abort();
                if (timer)
                    clearTimeout(timer);
                _props0["socket"]?.off('session:survey-ready', ready);
                _props0["socket"]?.off('session:user-joined', joined);
                _props0["socket"]?.off('session:user-left', left);
                _props0["socket"]?.off('session:lesson-ended', ended);
                _props0["socket"]?.off('session:classroom-closed', closed);
                request.current = () => { };
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [open()], () => {
        const _cleanup2 = untrack(() => {
            if (open() && !dialog.current?.open)
                dialog.current?.showModal();
            if (!open() && dialog.current?.open)
                dialog.current.close();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const close = () => {
        if (saving())
            return;
        prompted.current = true;
        try {
            sessionStorage.setItem(`lesson-survey-prompt:${_props0["bookingId"]}`, 'dismissed');
        }
        catch { }
        setOpen(false);
    };
    return <>
    {(_props0["placement"] === undefined ? 'classroom' : _props0["placement"]) === 'lesson' ? (!data() || data().eligible || data().survey) && <div class="lesson-classroom-feedback">
      <button type="button" disabled={loading() || saving()} aria-haspopup="dialog" onClick={() => request.current(true)}>
        {data()?.survey ? <CircleCheck size={19}/> : <Star size={19}/>}<span>{data()?.survey ? 'View lesson feedback' : 'Lesson feedback'}</span><ArrowRight size={18}/>
      </button>
    </div> : data()?.eligible && !data().survey && <button class="classroom-survey-open" type="button" aria-haspopup="dialog" onClick={() => request.current(true)}><Star size={16}/>Lesson feedback</button>}
    {<Portal mount={document.body}>{<dialog ref={_element => dialog.current = _element} class="classroom-survey-dialog" aria-labelledby="classroom-survey-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header><div><span>Optional lesson survey</span><h2 id="classroom-survey-title">Lesson feedback</h2></div>
        <button type="button" class="classroom-survey-close" title="Close survey" aria-label="Close survey" disabled={saving()} onClick={close}><X size={18}/></button></header>
      <div class="classroom-survey-content">
        {loadError() ? <p role="alert">{loadError()}<button type="button" onClick={() => request.current(true)}>Try again</button></p>
                : data() && <StudentLessonSurvey bookingId={_props0["bookingId"]} mode="flow" initialData={data()} onBusyChange={setSaving} onSubmitted={survey => setData(previous => previous && (previous.survey === survey ? previous : { ...previous, eligible: false, survey }))}/>}
      </div>
      <div class="classroom-survey-dismiss"><button type="button" disabled={saving()} onClick={close}>{data()?.survey ? 'Done' : 'Maybe later'}</button>
        {data()?.survey && (_props0["placement"] === undefined ? 'classroom' : _props0["placement"]) === 'classroom' && <a href={`/lesson/${encodeURIComponent(_props0["bookingId"])}`}>View lesson recap</a>}</div>
    </dialog>}</Portal>}
  </>;
}

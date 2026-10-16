import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import TutorArt from "./Common/TutorArt";
import { tutorApi } from '../api/tutor.api';
import './LessonMaterialRequest.css';
type Request = Awaited<ReturnType<typeof tutorApi.getStudentLessonRequest>>;
export default function LessonMaterialRequest(_props0: {
    studentId: string;
    sessionId: string;
}) {
    const [request, setRequest] = createSignal<Request>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => [_props0["studentId"], _props0["sessionId"], revision()], () => {
        const _cleanup1 = untrack(() => {
            let cancelled = false;
            setLoading(true);
            setError('');
            tutorApi.getStudentLessonRequest(_props0["studentId"], _props0["sessionId"]).then(result => {
                if (!cancelled)
                    setRequest(result);
            })
                .catch(() => {
                if (!cancelled)
                    setError('Could not load the material request.');
            })
                .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const refresh = () => setRevision(value => value + 1);
            window.addEventListener('focus', refresh);
            return () => window.removeEventListener('focus', refresh);
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const course = createMemo(() => request()?.courseId === 'daily-dispatch' ? 'Daily Dispatch' : request()?.courseId === 'business-english' ? 'Business English' : 'Conversational Skills');
    const url = createMemo(() => request()?.courseId === 'daily-dispatch' ? `/materials/daily-dispatch/${encodeURIComponent(request().lessonId)}`
        : request()?.courseId === 'conversational-skills' ? `/materials/conversational-skills/${encodeURIComponent(request().lessonId)}` : `/lesson/view?id=${encodeURIComponent(request()?.lessonId || '')}`);
    return <section class="lesson-advance-material-request" aria-labelledby="lesson-material-request-title" aria-busy={loading()}>
    <header><h2 id="lesson-material-request-title"><span class="lesson-section-icon"><TutorArt name="training" size={32}/></span>This lesson's material request</h2>
      <button type="button" disabled={loading()} title="Refresh material request" aria-label="Refresh material request" onClick={() => setRevision(value => value + 1)}><TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/></button></header>
    {error() ? <p role="alert">{error()}</p> : request() ? <div class="lesson-advance-material-content"><div><p>{course()}{request().level ? ` / Level ${request().level}` : ''}{request().chapter ? ` / Chapter ${request().chapter}` : ''}</p><strong>{request().title}</strong>{request().goal && <p>{request().goal}</p>}</div><a href={url()} target="_blank" rel="noopener noreferrer"><TutorIcon name="fas fa-book-open" aria-hidden="true"/>View material</a></div>
            : <p role="status">{loading() ? 'Loading material request...' : 'No material requested for this lesson.'}</p>}
  </section>;
}

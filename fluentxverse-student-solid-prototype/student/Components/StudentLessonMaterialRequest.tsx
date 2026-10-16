import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { lessonRecapApi, type StudentLessonRecap } from '../api/lessonRecap.api';
import LessonMaterialRequest from './LessonMaterialRequest';
import LessonContinuations from './LessonContinuations';
import './StudentLessonRecap.css';
export default function StudentLessonMaterialRequest(_props0: {
    bookingId: string;
}) {
    const [data, setData] = createSignal<Pick<StudentLessonRecap, 'materialRequest' | 'canRequestMaterial'> | null>(null);
    const [error, setError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => [_props0["bookingId"], revision()], () => {
        const _cleanup1 = untrack(() => {
            const controller = new AbortController();
            setError('');
            lessonRecapApi.materialRequest(_props0["bookingId"], controller.signal).then(result => { if (!controller.signal.aborted)
                setData(result); })
                .catch(() => { if (!controller.signal.aborted)
                setError('Could not load your material request.'); });
            return () => controller.abort();
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
    return <div class="student-lesson-recap student-lesson-advance-request">
    {data() ? <LessonMaterialRequest bookingId={_props0["bookingId"]} value={data().materialRequest} canRequest={data().canRequestMaterial} onChanged={materialRequest => setData(current => current && ({ ...current, materialRequest }))}/>
            : <section class="student-lesson-request" aria-label="Material request"><header class="student-lesson-section-heading"><h2><img class="lesson-art" src="/assets/img/home-icons/training-v1.webp" alt=""/>Material request</h2></header>
        {!error() && <p role="status">Loading material request...</p>}</section>}
    {error() && <p class="student-lesson-error" role="alert">{error()}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    {data()?.canRequestMaterial && <LessonContinuations bookingId={_props0["bookingId"]} onRequested={materialRequest => setData(current => current && ({ ...current, materialRequest }))}/>}
  </div>;
}

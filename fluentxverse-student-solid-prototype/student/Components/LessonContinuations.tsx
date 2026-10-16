import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { BookOpen } from "lucide-solid";
import { client } from '../api/utils';
import { lessonRecapApi, type LessonMaterialRequest } from '../api/lessonRecap.api';
interface Continuation {
    materialId: string;
    materialType: string;
    materialTitle: string;
    stoppedAtLabel: string;
}
export default function LessonContinuations(_props0: {
    bookingId: string;
    onRequested: (value: LessonMaterialRequest | null) => void;
}) {
    const [items, setItems] = createSignal<Continuation[]>([]);
    const [error, setError] = createSignal('');
    const [saving, setSaving] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => [_props0["bookingId"], revision()], () => {
        const _cleanup2 = untrack(() => {
            let cancelled = false;
            client.get(`/lesson-workflow/student/${encodeURIComponent(_props0["bookingId"])}/continuations`).then((_props1) => { if (!cancelled) {
                setItems(_props1["data"].data || []);
                setError('');
            } })
                .catch(() => { if (!cancelled)
                setError('Could not load unfinished materials.'); });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    return <div class="student-lesson-continuations">
    {error() && <p role="alert">{error()}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {items().map(item => <div><strong>{item.materialTitle}</strong><p>Previously stopped at: {item.stoppedAtLabel}</p><button type="button" disabled={saving()} onClick={async () => {
                setSaving(true);
                setError('');
                try {
                    _props0["onRequested"](await lessonRecapApi.request(_props0["bookingId"], item.materialType, item.materialId));
                }
                catch (err: any) {
                    setError(err.response?.data?.error || 'Could not request this material.');
                }
                finally {
                    setSaving(false);
                }
            }}><BookOpen size={16}/>Continue previous material</button></div>)}
  </div>;
}

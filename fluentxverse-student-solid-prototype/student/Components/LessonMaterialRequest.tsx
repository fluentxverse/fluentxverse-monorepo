import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { BookOpen, Trash2, X } from "lucide-solid";
import { lessonApi } from '../api/lesson.api';
import { lessonRecapApi, lessonCourseName, studentMaterialUrl, type LessonMaterialRequest as MaterialRequest } from '../api/lessonRecap.api';
import DispatchMaterialPicker from './DispatchMaterialPicker';
import CurriculumMaterialPicker, { type CurriculumMaterial } from './CurriculumMaterialPicker';
export default function LessonMaterialRequest(_props0: {
    bookingId: string;
    value: MaterialRequest | null;
    canRequest: boolean;
    onChanged: (request: MaterialRequest | null) => void;
}) {
    const [course, setCourse] = createSignal(_props0["value"]?.courseId || 'conversational-skills');
    const [choosing, setChoosing] = createSignal(false);
    const [materials, setMaterials] = createSignal<CurriculumMaterial[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [error, setError] = createSignal('');
    const [libraryError, setLibraryError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [saved, setSaved] = createSignal(false);
    const dialog = { current: null } as {
        current: HTMLDialogElement | null;
    };
    createEffect(on(() => [choosing(), _props0["canRequest"]], () => {
        const _cleanup1 = untrack(() => {
            if (choosing() && _props0["canRequest"])
                dialog.current?.showModal();
            if (!_props0["canRequest"])
                setChoosing(false);
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [course(), choosing(), revision()], () => {
        const _cleanup2 = untrack(() => {
            if (!choosing() || course() === 'daily-dispatch')
                return;
            let cancelled = false;
            setLoading(true);
            setLibraryError('');
            setMaterials([]);
            lessonApi.getPublishedLessonMaterials(course()).then(result => {
                if (!result.success)
                    throw new Error('Could not load the material library.');
                if (!cancelled)
                    setMaterials(result.lessons.map(item => ({ id: item.id,
                        title: `Lesson ${item.lessonNumber || 1}: ${item.lessonName || 'Lesson'}`,
                        level: Number(item.level) || 1, chapter: Number(item.chapter) || 1,
                        lesson: Number(item.lessonNumber) || 1, goal: item.goalTextEn || '' })));
            }).catch(() => { if (!cancelled)
                setLibraryError('Could not load materials. Please try again.'); })
                .finally(() => { if (!cancelled)
                setLoading(false); });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const select = async (selectedCourse: string | null, materialId?: string) => {
        if (saving() || !_props0["canRequest"])
            return;
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            const result = await lessonRecapApi.request(_props0["bookingId"], selectedCourse, materialId);
            _props0["onChanged"](result);
            setChoosing(false);
            setSaved(true);
        }
        catch (err: any) {
            setError(err?.response?.data?.error || err.message || 'Could not save your request.');
        }
        finally {
            setSaving(false);
        }
    };
    return <><section class="student-lesson-request" aria-labelledby="student-material-request-title">
    <header class="student-lesson-section-heading"><h2 id="student-material-request-title"><img class="lesson-art" src="/assets/img/home-icons/training-v1.webp" alt=""/>Material request</h2>
      {_props0["canRequest"] && <button type="button" disabled={saving()} onClick={() => { setChoosing(true); setSaved(false); setError(''); }}><BookOpen size={16}/>{_props0["value"] ? 'Change material' : 'Choose material'}</button>}
    </header>
    {_props0["value"] ? <div class="student-request-selected">
      <div><p>{lessonCourseName(_props0["value"].courseId)}{_props0["value"].level ? ` / Level ${_props0["value"].level}` : ''}{_props0["value"].chapter ? ` / Chapter ${_props0["value"].chapter}` : ''}</p>
        <strong>{_props0["value"].title}</strong>
      </div>
      <div class="student-request-actions"><a href={studentMaterialUrl(_props0["value"].courseId, _props0["value"].lessonId)} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>Preview material</a>
        {_props0["canRequest"] && <button type="button" title="Clear material request" aria-label="Clear material request" disabled={saving()} onClick={() => void select(null)}><Trash2 size={16}/></button>}</div>
    </div> : <p class="student-lesson-muted">{_props0["canRequest"] ? 'No material requested yet.' : 'No advance material request.'}</p>}
    {saved() && <p class="student-request-saved" role="status">{_props0["value"] ? 'Material request saved for your tutor.' : 'Material request cleared.'}</p>}
    {error() && !choosing() && <p class="student-lesson-error" role="alert">{error()}</p>}
  </section>
    {choosing() && _props0["canRequest"] && <dialog ref={_element => dialog.current = _element} class="student-lesson-recap student-material-request-dialog" aria-labelledby="student-material-library-title" onCancel={event => { event.preventDefault(); if (!saving())
            setChoosing(false); }}>
      <header class="student-material-library-heading"><h2 id="student-material-library-title"><BookOpen size={19}/>Select lesson material</h2><button type="button" aria-label="Close material library" title="Close material library" disabled={saving()} onClick={() => setChoosing(false)} autofocus><X size={20}/></button></header>
      <div class="student-material-library-body">
      {error() && <p class="student-lesson-error" role="alert">{error()}</p>}
      <fieldset disabled={saving()} class="student-request-library">
      <label class="student-request-course">Course<select aria-label="Course" value={course()} onChange={event => setCourse(event.currentTarget.value)}>
        <option value="conversational-skills">Conversational Skills</option><option value="business-english">Business English</option><option value="daily-dispatch">Daily Dispatch</option>
      </select></label>
      {course() === 'daily-dispatch' ? <DispatchMaterialPicker actionLabel="Request article" onOpen={article => void select(course(), article.id)}/>
                : libraryError() ? <div role="alert" class="student-lesson-error">{libraryError()}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>
                    : <CurriculumMaterialPicker actionLabel="Request lesson" materials={materials()} loading={loading()} currentId={_props0["value"]?.courseId === course() ? _props0["value"].lessonId : undefined} onOpen={material => void select(course(), material.id)}/>}
      {saving() && <p role="status">Saving material request...</p>}
      </fieldset>
      </div>
    </dialog>}
  </>;
}

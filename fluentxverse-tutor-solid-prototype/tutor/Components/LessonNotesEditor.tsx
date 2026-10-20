import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { Show, Index, batch } from 'solid-js';
import { useBeforeLeave } from '@solidjs/router';
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import TutorDialog from './Common/TutorDialog';
import TutorArt from './Common/TutorArt';
import { toastConfirm } from './Common/Toast';
import { tutorApi, type ClassroomLessonNotes, type ClassroomNotesRecord, type ClassroomMaterialProgress, type SaveClassroomNotesInput, } from '../api/tutor.api';
import { client } from '../api/utils';
import { lessonApi } from '../api/lesson.api';
import LessonEditorLearningFields from './LessonEditorLearningFields';
import LessonFeedbackFields from './LessonFeedbackFields';
import MaterialProgressEditor from './MaterialProgressEditor';
import LessonLevelAssessment from './LessonLevelAssessment';
import LessonStudentAttendance from './LessonStudentAttendance';
import LessonWorkflowStatus from './LessonWorkflowStatus';
import { lessonWorkflowApi, type Continuation, type LessonSubmissionIssue } from '../api/lessonWorkflow.api';
import { validateLessonNotesEditor } from '../utils/lessonNotesValidation';
import './LessonNotesEditor.css';
const courses = {
    'daily-dispatch': 'Daily Dispatch',
    'conversational-skills': 'Conversational Skills',
    'business-english': 'Business English'
};
const key = (note: ClassroomNotesRecord) => `${note.materialType}:${note.materialId}`;
const version = (notes: ClassroomLessonNotes) => JSON.stringify({
    summary: notes.updatedAt,
    materials: notes.materials.map((note) => [key(note), note.updatedAt]).sort()
});
const errorMessage = (error: any) => error?.response?.data?.error || error?.message || 'Could not save changes. Your draft is kept on this device.';
const payload = (note: ClassroomNotesRecord): SaveClassroomNotesInput => ({
    materialType: note.materialType,
    materialId: note.materialId,
    materialTitle: note.materialTitle || undefined,
    isUsed: true,
    courseId: note.courseId,
    lessonId: note.lessonId,
    articleId: note.articleId,
    completionStatus: note.completionStatus,
    stoppedAt: note.stoppedAt,
    progressDetails: note.progressDetails || '',
    vocabularyItems: note.vocabularyItems.map((item) => ({ ...item, isLoading: false })),
    grammarItems: note.grammarItems.map((item) => ({ ...item, isLoading: false })),
    pronunciationItems: note.pronunciationItems.map((item) => ({ ...item, isLoading: false }))
});
const cleanProgress = (note: ClassroomNotesRecord): ClassroomNotesRecord => {
    const excluded = note.materialType === 'conversational-skills'
        ? /^(missionData\d*|feedbackData)(\.|$)/.test(note.stoppedAt || '') ||
            /^Part [56]\b/.test(note.stoppedAtLabel || '')
        : note.materialType === 'business-english' && /^(discussion|feedback)(\.|$)/.test(note.stoppedAt || '');
    const completed = note.materialType === 'daily-dispatch' || note.completionStatus === 'completed';
    return {
        ...note,
        vocabularyItems: (note.vocabularyItems || []).map((item) => ({ ...item, isLoading: false })),
        grammarItems: (note.grammarItems || []).map((item) => ({ ...item, isLoading: false })),
        pronunciationItems: (note.pronunciationItems || []).map((item) => ({ ...item, isLoading: false })),
        completionStatus: completed ? 'completed' : note.completionStatus || 'in_progress',
        ...(completed || excluded ? { stoppedAt: null, stoppedAtLabel: null, progressDetails: '' } : {})
    };
};
// Background note updates must not reset the native select's uncommitted option preview.
const MaterialNotesSelect = function MaterialNotesSelect(_props0: {
    materials: ClassroomNotesRecord[];
    value: string;
    onSelect: (value: string) => void;
}) {
    return <select aria-label="Material used" value={_props0["value"]} onChange={event => _props0["onSelect"](event.currentTarget.value)}>
    <option value="" selected={_props0.value === ''}>Lesson feedback only</option>
    <Index each={_props0.materials}>{note => <option value={key(note())} selected={_props0.value === key(note())}>
      {courses[note().materialType as keyof typeof courses]} - {note().materialTitle || 'Untitled material'}
    </option>}</Index>
  </select>;
};
function LessonNotesEditor(_props1: {
    sessionId: string;
    canEdit: boolean;
    onClose: () => void;
    onSaved: () => void;
    onAttendanceChanged: (status: 'present' | 'absent') => void;
    submissionIssue?: LessonSubmissionIssue | null;
}) {
    const dialog = { current: null } as {
        current: (HTMLDialogElement | null) | null;
    };
    const [base, setBase] = createSignal<ClassroomLessonNotes | null>(null);
    const [draft, setDraft] = createSignal<ClassroomLessonNotes | null>(null);
    const [activeKey, setActiveKey] = createSignal('');
    const [contexts, setContexts] = createSignal<Record<string, ClassroomMaterialProgress>>({});
    const [sectionsError, setSectionsError] = createSignal(false);
    const [sectionsRevision, setSectionsRevision] = createSignal(0);
    const [error, setError] = createSignal('');
    const [validationAttempted, setValidationAttempted] = createSignal(false);
    const [validationFocus, setValidationFocus] = createSignal(0);
    const [validationTarget, setValidationTarget] = createSignal<LessonSubmissionIssue['field']>();
    const initialIssueHandled = { current: false } as {
        current: any;
    };
    const [notice, setNotice] = createSignal('');
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const [adding, setAdding] = createSignal(false);
    const [course, setCourse] = createSignal('daily-dispatch');
    const [catalog, setCatalog] = createSignal<{
        id: string;
        title: string;
    }[]>([]);
    const [catalogLoading, setCatalogLoading] = createSignal(false);
    const [catalogError, setCatalogError] = createSignal(false);
    const [catalogRevision, setCatalogRevision] = createSignal(0);
    const [catalogId, setCatalogId] = createSignal('');
    const [search, setSearch] = createSignal('');
    const [continuations, setContinuations] = createSignal<Continuation[]>([]);
    createEffect(on(() => [_props1["sessionId"]], () => {
        const _cleanup2 = untrack(() => {
            let cancelled = false;
            lessonWorkflowApi.continuations(_props1["sessionId"]).then(items => {
                if (!cancelled)
                    setContinuations(items);
            }).catch(() => { });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const storageKey = createMemo(() => `fxv-tutor-lesson-notes-editor:${_props1["sessionId"]}`);
    const active = createMemo(() => draft()?.materials.find((note) => key(note) === activeKey()));
    const absent = createMemo(() => draft()?.studentAttendance === 'absent');
    const dirty = createMemo(() => Boolean(base() && draft() && JSON.stringify(draft()) !== JSON.stringify(base())));
    let navigationPending = false;
    useBeforeLeave(event => {
        if (!dirty() || absent() || event.defaultPrevented) return;
        event.preventDefault();
        if (navigationPending) return;
        navigationPending = true;
        void toastConfirm('Your unsaved lesson notes are kept on this device. They have not been submitted.', 'Leave with unsaved notes?', {
            confirmLabel: 'Leave page', cancelLabel: 'Keep editing',
        }).then(leave => { if (leave) event.retry(true); }).finally(() => { navigationPending = false; });
    });
    const validation = createMemo(() => draft() ? validateLessonNotesEditor(draft()) : null);
    const missingPoints = createMemo(() => validation()?.stoppingPoints || []);
    const feedbackError = createMemo(() => validationAttempted() && validation()?.studentFeedback ? 'Student feedback must contain at least 100 characters.' : '');
    const handoffError = createMemo(() => validationAttempted() && validation()?.tutorHandoff ? 'Tutor handoff must not exceed 150 characters.' : '');
    const stoppingError = createMemo(() => validationAttempted() && active() && missingPoints().some(note => key(note) === activeKey())
        ? 'Choose a stopping point for this in-progress material.' : '');
    const generating = createMemo(() => Boolean(draft()?.materials.some((note) => [...note.vocabularyItems, ...note.grammarItems, ...note.pronunciationItems].some((item) => item.isLoading))));
    createEffect(on(() => [_props1["sessionId"], revision()], () => {
        const _cleanup3 = untrack(() => {
            let cancelled = false;
            setLoading(true);
            setError('');
            tutorApi
                .getClassroomLessonNotes(_props1["sessionId"])
                .then((saved) => {
                if (cancelled)
                    return;
                setBase({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null });
                let next = { ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null, materials: saved.materials.map(cleanProgress) };
                try {
                    const raw = localStorage.getItem(storageKey());
                    if (saved.studentAttendance === 'absent') {
                        localStorage.removeItem(storageKey());
                    } else if (raw) {
                        const local = JSON.parse(raw);
                        if (local.version === version(saved) && Array.isArray(local.draft?.materials)) {
                            next = { ...local.draft, englishLevelAssessment: local.draft.englishLevelAssessment ?? null, materials: local.draft.materials.map(cleanProgress) };
                            setNotice('Unsaved draft restored.');
                        }
                        else
                            setNotice('Newer saved notes were loaded instead of the older draft.');
                    }
                }
                catch {
                    setNotice('The local draft could not be restored. Saved notes are shown.');
                }
                setDraft(next);
                setActiveKey(next.materials[0] ? key(next.materials[0]) : '');
            })
                .catch(() => {
                if (!cancelled)
                    setError('Could not load saved notes.');
            })
                .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
            return () => {
                cancelled = true;
            };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [base(), draft(), dirty(), saving(), absent(), loading()], () => {
        const _cleanup4 = untrack(() => {
            if (!base() || !draft() || saving() || absent() || loading())
                return;
            try {
                if (dirty())
                    localStorage.setItem(storageKey(), JSON.stringify({ get version() {
                            return version(base());
                        }, get draft() {
                            return draft();
                        } }));
                else
                    localStorage.removeItem(storageKey());
            }
            catch {
                setNotice('Local draft storage unavailable. Changes have not been saved.');
            }
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [dirty()], () => {
        const _cleanup5 = untrack(() => {
            if (!dirty())
                return;
            const warn = (event: BeforeUnloadEvent) => {
                event.preventDefault();
                event.returnValue = '';
            };
            window.addEventListener('beforeunload', warn);
            return () => window.removeEventListener('beforeunload', warn);
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [_props1["sessionId"], activeKey(), sectionsRevision()], () => {
        const _cleanup6 = untrack(() => {
            setSectionsError(false);
            if (!active() || active().materialType === 'daily-dispatch' || contexts()[activeKey()])
                return;
            let cancelled = false;
            tutorApi
                .getClassroomMaterialProgress(_props1["sessionId"], active().materialType, active().materialId)
                .then((data) => {
                if (!cancelled)
                    setContexts((previous) => ({ ...previous, [activeKey()]: data }));
            })
                .catch(() => {
                if (!cancelled)
                    setSectionsError(true);
            });
            return () => {
                cancelled = true;
            };
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    createEffect(on(() => [adding(), course(), catalogRevision()], () => {
        const _cleanup7 = untrack(() => {
            if (!adding())
                return;
            let cancelled = false;
            setCatalogLoading(true);
            setCatalogError(false);
            setCatalogId('');
            setSearch('');
            const load = course() === 'daily-dispatch'
                ? client.get('/dispatch/classroom-library').then((response) => {
                    if (!response.data.success)
                        throw new Error('Library unavailable');
                    return response.data.articles
                        .filter((item: any) => item.status === 'published')
                        .map((item: any) => ({ id: item.id, title: item.title }));
                })
                : lessonApi.getPublishedLessonMaterials(course()).then((response) => {
                    if (!response.success)
                        throw new Error('Library unavailable');
                    return response.lessons.map((item) => ({
                        id: item.id,
                        title: `L${item.level} / Ch${item.chapter} / Lesson ${item.lessonNumber}: ${item.lessonName || item.title || 'Untitled'}`
                    }));
                });
            load
                .then((items) => {
                if (!cancelled)
                    setCatalog(items);
            })
                .catch(() => {
                if (!cancelled)
                    setCatalogError(true);
            })
                .finally(() => {
                if (!cancelled)
                    setCatalogLoading(false);
            });
            return () => {
                cancelled = true;
            };
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    const update = (patch: Partial<ClassroomNotesRecord>) => setDraft((previous) => previous
        ? {
            ...previous,
            materials: previous.materials.map((note) => (key(note) === activeKey() ? { ...note, ...patch } : note))
        }
        : previous);
    const closing = { current: false } as {
        current: any;
    };
    const close = async () => {
        if (saving() || closing.current)
            return;
        if (dirty()) {
            closing.current = true;
            const discard = await toastConfirm('Your unsaved lesson notes will be discarded.', 'Discard unsaved changes?', { confirmLabel: 'Discard changes', cancelLabel: 'Keep editing' });
            closing.current = false;
            if (!discard)
                return;
        }
        try {
            localStorage.removeItem(storageKey());
        }
        catch { }
        _props1["onClose"]();
    };
    const revealIssue = (issue: LessonSubmissionIssue) => {
        setValidationAttempted(true);
        setError('');
        const target = issue.field || (missingPoints().length ? 'stoppingPoint' : validation()?.studentFeedback ? 'studentFeedback' : validation()?.tutorHandoff ? 'tutorHandoff' : undefined);
        if (!target) {
            setError(issue.message);
            return;
        }
        if (target === 'stoppingPoint') {
            const material = draft()?.materials.find(note => note.materialType === issue.materialType && note.materialId === issue.materialId) || missingPoints()[0];
            if (material)
                setActiveKey(key(material));
        }
        setValidationTarget(target);
        setValidationFocus(value => value + 1);
    };
    createEffect(on(() => [draft(), loading(), _props1["submissionIssue"] === undefined ? null : _props1["submissionIssue"]], () => {
        const _cleanup8 = untrack(() => {
            if (!draft() || loading() || !(_props1["submissionIssue"] === undefined ? null : _props1["submissionIssue"]) || initialIssueHandled.current)
                return;
            initialIssueHandled.current = true;
            revealIssue(_props1["submissionIssue"] === undefined ? null : _props1["submissionIssue"]);
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    createEffect(on(() => [validationFocus(), validationTarget(), activeKey(), contexts(), loading()], () => {
        const _cleanup9 = untrack(() => {
            if (!validationFocus() || loading())
                return;
            const selector = validationTarget() === 'stoppingPoint' ? '#material-stopped-at' : validationTarget() === 'studentFeedback' ? '[aria-label="Student feedback"]' : '[aria-label="Tutor handoff"]';
            const field = dialog.current?.querySelector<HTMLSelectElement | HTMLTextAreaElement>(selector);
            if (field) {
                if (!field.disabled)
                    field.focus({ preventScroll: true });
                field.scrollIntoView({ block: 'center', behavior: 'instant' });
                if (!field.disabled)
                    setValidationFocus(0);
            }
        });
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    const save = async (event: Event) => {
        event.preventDefault();
        if (!draft() || !base() || saving() || generating() || !_props1["canEdit"] || absent())
            return;
        setValidationAttempted(true);
        if (missingPoints().length || validation()?.studentFeedback || validation()?.tutorHandoff) {
            revealIssue({ message: 'Review the required changes before saving.' });
            return;
        }
        setSaving(true);
        setError('');
        let nextBase = base();
        try {
            const freshWindow = await tutorApi.getLessonNotesEditWindow(_props1["sessionId"]);
            if (!freshWindow.canEdit)
                throw new Error('The lesson notes editing window is closed. Your draft is kept on this device.');
            const fresh = await tutorApi.getClassroomLessonNotes(_props1["sessionId"]);
            if (version(fresh) !== version(base()))
                throw new Error('Notes changed in another tab. Close and reopen the editor to load the latest notes.');
            for (const note of draft().materials) {
                const original = nextBase.materials.find((item) => key(item) === key(note));
                if (original && JSON.stringify(payload(original)) === JSON.stringify(payload(note)))
                    continue;
                const saved = await tutorApi.saveClassroomNotes(_props1["sessionId"], { ...payload(note), clientUpdatedAt: Date.now() });
                nextBase = { ...nextBase, materials: [...nextBase.materials.filter((item) => key(item) !== key(note)), saved] };
                setBase(nextBase);
            }
            if (draft().studentComment !== nextBase.studentComment || draft().tutorMemo !== nextBase.tutorMemo ||
                (draft().englishLevelAssessment ?? null) !== (nextBase.englishLevelAssessment ?? null)) {
                await tutorApi.saveClassroomLessonNotes(_props1["sessionId"], {
                    get studentComment() {
                        return draft().studentComment;
                    },
                    get tutorMemo() {
                        return draft().tutorMemo;
                    },
                    get englishLevelAssessment() {
                        return draft().englishLevelAssessment ?? null;
                    },
                    clientUpdatedAt: Date.now()
                });
            }
            const saved = await tutorApi.getClassroomLessonNotes(_props1["sessionId"]);
            setBase({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null });
            setDraft({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null, materials: saved.materials.map(cleanProgress) });
            setValidationAttempted(false);
            try {
                localStorage.removeItem(storageKey());
            }
            catch { }
            _props1["onSaved"]();
        }
        catch (error) {
            setError(errorMessage(error));
            _props1["onSaved"]();
        }
        finally {
            setSaving(false);
        }
    };
    const addMaterial = (continuation?: Continuation) => {
        const material = continuation ? { id: continuation.materialId, title: continuation.materialTitle } : catalog().find((item) => item.id === catalogId());
        if (!material || !draft())
            return;
        const selectedCourse = continuation?.materialType || course();
        const id = `${selectedCourse}:${material.id}`;
        if (!draft().materials.some((note) => key(note) === id)) {
            const note: ClassroomNotesRecord = {
                id,
                get sessionId() {
                    return _props1["sessionId"];
                },
                tutorId: '',
                studentId: null,
                materialType: selectedCourse,
                materialId: material.id,
                materialTitle: material.title,
                isUsed: true,
                courseId: selectedCourse,
                articleId: selectedCourse === 'daily-dispatch' ? material.id : null,
                lessonId: selectedCourse === 'daily-dispatch' ? null : material.id,
                vocabularyItems: [],
                grammarItems: [],
                pronunciationItems: [],
                studentComment: '',
                tutorMemo: '',
                createdAt: '',
                updatedAt: '',
                completionStatus: selectedCourse === 'daily-dispatch' ? 'completed' : 'in_progress',
                stoppedAt: continuation?.stoppedAt || null,
                stoppedAtLabel: continuation?.stoppedAtLabel || null,
                progressDetails: continuation?.progressDetails || ''
            };
            setDraft({ ...draft(), materials: [...draft().materials, note] });
        }
        setActiveKey(id);
        setAdding(false);
    };
    return (<TutorDialog dialogRef={dialog} className="lesson-notes-editor dispatch-notes-widget" label="Edit lesson notes" onClose={close} busy={saving()}>
      <form onSubmit={save}>
        <header class="dispatch-notes-header">
          <h2 id="lesson-editor-title">
            <TutorArt name={active()?.materialType === 'daily-dispatch' ? 'dispatch' : 'training'} size={36}/>
            Edit lesson notes
          </h2>
          <button type="button" class="lne-icon" title="Close editor" aria-label="Close editor" disabled={saving()} onClick={close}>
            <TutorIcon name="fi fi-sr-cross" aria-hidden="true"/>
          </button>
        </header>
        {!absent() && validationAttempted() && (missingPoints().length > 0 || feedbackError() || handoffError()) && <div class="lne-validation-summary" role="alert">
          <strong>Review required changes</strong>
          {missingPoints().map(note => <button type="button" onClick={() => revealIssue({ message: '', field: 'stoppingPoint', materialType: note.materialType, materialId: note.materialId })}>Choose a stopping point for {note.materialTitle || 'Untitled material'}.</button>)}
          {feedbackError() && <button type="button" onClick={() => revealIssue({ message: '', field: 'studentFeedback' })}>{feedbackError()}</button>}
          {handoffError() && <button type="button" onClick={() => revealIssue({ message: '', field: 'tutorHandoff' })}>{handoffError()}</button>}
        </div>}
        {error() && <div class="lne-validation-summary" role="alert"><p>{error()}</p>{!draft() && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}</div>}
        <div class="lne-body dispatch-notes-content">
          <LessonWorkflowStatus sessionId={_props1["sessionId"]} revision={revision() + (Date.parse(base()?.updatedAt || '') || 0)} unsaved={dirty()} onValidationError={revealIssue} onSubmitted={() => { setRevision(value => value + 1); _props1["onSaved"](); }}/>
          {notice() && (<p class="lne-notice" role="status">
              {notice()}
            </p>)}
          {!_props1["canEdit"] && (<p class="lne-error" role="status">
              Editing is unavailable. These notes are read-only; unsaved changes remain on this device.
            </p>)}
          {loading() ? (<p role="status">Loading saved notes...</p>) : (draft() && (<fieldset disabled={saving() || !_props1["canEdit"]}>
                <LessonStudentAttendance sessionId={_props1["sessionId"]} value={draft().studentAttendance} disabled={saving() || generating() || !_props1["canEdit"]} onChanged={async (status) => {
                const empty = { ...draft(), studentAttendance: status,
                    materials: status === 'absent' ? [] : draft().materials,
                    ...(status === 'absent' ? { studentComment: '', tutorMemo: '', englishLevelAssessment: null, updatedAt: null } : {}) };
                batch(() => {
                    setBase(empty);
                    setDraft(empty);
                });
                setActiveKey(status === 'absent' ? '' : activeKey());
                setValidationAttempted(false);
                setError('');
                setNotice('');
                _props1["onAttendanceChanged"](status);
                setRevision(value => value + 1);
            }}/>
                {absent() ? <p class="lne-absence-message" role="status">Student marked absent. No lesson notes are required.</p> : <>
                <div class="lne-material-picker">
                  <label>
                    Material used
                    <MaterialNotesSelect materials={draft().materials} value={activeKey()} onSelect={setActiveKey}/>
                  </label>
                  <button type="button" onClick={() => setAdding((value) => !value)}>
                    <TutorIcon name="fi fi-sr-plus" aria-hidden="true"/>
                    Add material
                  </button>
                </div>
                {adding() && (<section class="lne-library" aria-label="Add a material">
                    <label>
                      Course
                      <select aria-label="Course" value={course()} onChange={(event) => {
                        setCourse(event.currentTarget.value);
                        setCatalogId('');
                        setCatalog([]);
                        setCatalogLoading(true);
                    }}>
                        {Object.entries(courses).map(([id, name]) => (<option value={id}>
                            {name}
                          </option>))}
                      </select>
                    </label>
                    <label>
                      Search material
                      <input value={search()} onInput={(event) => {
                        setSearch(event.currentTarget.value);
                        setCatalogId('');
                    }}/>
                    </label>
                    <label>
                      Material
                      <select aria-label="Add material selection" value={catalogId()} disabled={catalogLoading() || catalogError()} onChange={(event) => setCatalogId(event.currentTarget.value)}>
                        <option value="">{catalogLoading() ? 'Loading materials...' : 'Select material'}</option>
                        {catalog().filter((item) => item.title.toLowerCase().includes(search().toLowerCase()))
                        .map((item) => (<option value={item.id}>
                              {item.title}
                            </option>))}
                      </select>
                    </label>
                    {catalogError() && (<p role="alert">
                        Material library unavailable.{' '}
                        <button type="button" onClick={() => setCatalogRevision((value) => value + 1)}>
                          Retry
                        </button>
                      </p>)}
                    <button type="button" disabled={!catalogId()} onClick={() => addMaterial()}>
                      <TutorIcon name="fi fi-sr-check" aria-hidden="true"/>
                      Use material
                    </button>
                  </section>)}
                {continuations().filter(item => !draft().materials.some(note => key(note) === `${item.materialType}:${item.materialId}`)).map(item => <div class="lne-continuation"><strong>{item.materialTitle}</strong><p>Previously stopped at: {item.stoppedAtLabel}</p><button type="button" onClick={() => addMaterial(item)}><TutorIcon name="fi fi-sr-book-alt" aria-hidden="true"/>Continue previous material</button></div>)}
                {active() && (<Show when={activeKey()} keyed>{(_materialKey) => <>
                    <MaterialProgressEditor required error={stoppingError()} materialType={active().materialType} progress={active()} context={contexts()[activeKey()] || null} loading={!sectionsError() && !contexts()[activeKey()]} onChange={update} onRetry={() => setSectionsRevision((value) => value + 1)}/>
                    <LessonEditorLearningFields note={active()} disabled={saving() || !_props1["canEdit"]} onChange={(change) => setDraft((previous) => previous
                        ? {
                            ...previous,
                            materials: previous.materials.map((note) => key(note) === activeKey() ? change(note) : note)
                        }
                        : previous)}/>
                  </>}</Show>)}
                <LessonLevelAssessment value={draft().englishLevelAssessment ?? null} onChange={englishLevelAssessment => setDraft(previous => previous ? { ...previous, englishLevelAssessment } : previous)}/>
                <LessonFeedbackFields privacyReminder required feedbackError={feedbackError()} handoffError={handoffError()} studentComment={draft().studentComment} tutorMemo={draft().tutorMemo} disabled={saving() || !_props1["canEdit"]} setStudentComment={(studentComment) => setDraft((previous) => (previous ? { ...previous, studentComment } : previous))} setTutorMemo={(tutorMemo) => setDraft((previous) => (previous ? { ...previous, tutorMemo } : previous))}/>
                </>}
              </fieldset>))}
        </div>
        <footer class="dispatch-notes-footer">
          <span role="status">{saving() ? 'Saving changes...' : dirty() ? 'Unsaved changes' : 'No unsaved changes'}</span>
          <button type="button" disabled={saving()} onClick={close}>
            Cancel
          </button>
          <button type="submit" class="lne-save" disabled={absent() || !_props1["canEdit"] || loading() || saving() || generating() || !dirty()}>
            <TutorIcon name="fi fi-sr-disk" aria-hidden="true"/>
            Save changes
          </button>
        </footer>
      </form>
    </TutorDialog>);
}
export default LessonNotesEditor;

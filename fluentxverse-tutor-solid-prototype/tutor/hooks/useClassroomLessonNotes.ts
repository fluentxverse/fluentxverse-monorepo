import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { tutorApi, type ClassroomLessonNotes, type ClassroomNotesRecord } from '../api/tutor.api';
import { API_BASE_URL } from '../config/api';
import { validateLessonFeedback } from '../utils/lessonNotesValidation';
type Summary = Pick<ClassroomLessonNotes, 'studentComment' | 'tutorMemo'>;
type Draft = Summary & {
    updatedAt: number;
};
type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'draft' | 'error';
const draftKey = (sessionId: string) => `fxv-tutor-classroom-summary:${sessionId}`;
const empty: Summary = { studentComment: '', tutorMemo: '' };
function readDraft(sessionId: string): Draft | null {
    try {
        const draft = JSON.parse(localStorage.getItem(draftKey(sessionId)) || 'null');
        return draft && typeof draft.studentComment === 'string' && typeof draft.tutorMemo === 'string' && Number.isFinite(draft.updatedAt) ? draft : null;
    }
    catch {
        return null;
    }
}
function persistDraft(sessionId: string, draft: Draft) {
    try {
        localStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
    }
    catch { /* Saving to the server remains available. */ }
}
function restoreLegacyDrafts(sessionId: string, materials: ClassroomNotesRecord[]): Summary {
    const records = new Map(materials.map(note => [`${note.materialType}:${note.materialId}`, { ...note, updatedAt: Date.parse(note.updatedAt) || 0 }]));
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith(`fxv-tutor-classroom-notes:${sessionId}:`))
                continue;
            try {
                const draft = JSON.parse(localStorage.getItem(key) || 'null');
                if (draft?.sessionId !== sessionId || !draft.materialId || !draft.materialType)
                    continue;
                const id = `${draft.materialType}:${draft.materialId}`;
                if (!records.has(id) || draft.updatedAt > records.get(id)!.updatedAt)
                    records.set(id, draft);
            }
            catch { /* Ignore malformed legacy drafts. */ }
        }
    }
    catch { /* Legacy server notes remain available when storage is blocked. */ }
    const join = (field: keyof Summary) => [...new Set([...records.values()].map(note => typeof note[field] === 'string' ? note[field].trim() : '').filter(Boolean))].join('\n\n');
    return { studentComment: join('studentComment'), tutorMemo: join('tutorMemo') };
}
export function useClassroomLessonNotes(sessionId: Accessor<string>) {
    const [summary, setSummary] = createSignal<Summary>(empty);
    const [materials, setMaterials] = createSignal<ClassroomNotesRecord[]>([]);
    const [saveState, setSaveState] = createSignal<SaveState>('loading');
    const [ready, setReady] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const latest = { current: null } as {
        current: ({
            sessionId: string;
            draft: Draft;
        } | null) | null;
    };
    const queue = { current: Promise.resolve() } as {
        current: Promise<void> | null;
    };
    const activeSession = { current: sessionId() } as {
        current: any;
    };
    createEffect(() => activeSession.current = sessionId());
    const save = (id: string, draft: Draft) => {
        const validation = validateLessonFeedback(draft);
        if (validation.studentFeedback || validation.tutorHandoff) {
            if (activeSession.current === id)
                setSaveState('draft');
            return;
        }
        queue.current = queue.current.catch(() => { }).then(async () => {
            if (activeSession.current === id)
                setSaveState('saving');
            await tutorApi.saveClassroomLessonNotes(id, { ...draft, clientUpdatedAt: draft.updatedAt });
            if (activeSession.current === id && latest.current?.draft.updatedAt === draft.updatedAt)
                setSaveState('saved');
        }).catch(() => {
            if (activeSession.current === id)
                setSaveState('draft');
        });
    };
    createEffect(on(() => [sessionId(), revision()], () => {
        const _cleanup0 = untrack(() => {
            const controller = new AbortController();
            const local = readDraft(sessionId());
            setReady(false);
            setMaterials([]);
            setSaveState('loading');
            setSummary(local || empty);
            latest.current = local ? { get sessionId() {
                    return sessionId();
                }, draft: local } : null;
            void tutorApi.getClassroomLessonNotes(sessionId(), controller.signal).then(data => {
                if (controller.signal.aborted)
                    return;
                setMaterials(data.materials);
                const legacy = data.updatedAt ? null : restoreLegacyDrafts(sessionId(), data.materials);
                const restored = local && local.updatedAt >= (Date.parse(data.updatedAt || '') || 0) ? local : legacy || data;
                latest.current = null;
                setSummary({ studentComment: restored.studentComment, tutorMemo: restored.tutorMemo });
                setReady(true);
                setSaveState(data.updatedAt ? 'saved' : 'idle');
                if (restored === local || (legacy && (legacy.studentComment !== data.studentComment || legacy.tutorMemo !== data.tutorMemo))) {
                    const draft = restored === local ? local : { ...restored, updatedAt: Date.now() };
                    latest.current = { get sessionId() {
                            return sessionId();
                        }, draft };
                    persistDraft(sessionId(), draft);
                    save(sessionId(), draft);
                }
            }).catch(() => {
                if (controller.signal.aborted)
                    return;
                setReady(Boolean(local));
                setSaveState(local ? 'draft' : 'error');
            });
            return () => controller.abort();
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    const update = (field: keyof Summary, value: string) => {
        if (!ready())
            return;
        setSummary(previous => {
            if (previous[field] === value)
                return previous;
            const next = { ...previous, [field]: value };
            const draft = { ...next, updatedAt: Math.max(Date.now(), (latest.current?.draft.updatedAt || 0) + 1) };
            latest.current = { sessionId: sessionId(), draft };
            persistDraft(sessionId(), draft);
            setSaveState('draft');
            return next;
        });
    };
    createEffect(on(() => [summary(), ready(), sessionId()], () => {
        const _cleanup1 = untrack(() => {
            const pending = latest.current;
            if (!ready() || pending?.sessionId !== sessionId())
                return;
            const timer = window.setTimeout(() => save(sessionId(), pending.draft), 700);
            return () => window.clearTimeout(timer);
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [sessionId()], () => {
        const _cleanup2 = untrack(() => {
            const flush = () => {
                const pending = latest.current;
                if (pending?.sessionId !== sessionId())
                    return;
                persistDraft(sessionId(), pending.draft);
                const validation = validateLessonFeedback(pending.draft);
                if (validation.studentFeedback || validation.tutorHandoff)
                    return;
                void fetch(`${API_BASE_URL}/tutor/classroom-lesson-notes/${encodeURIComponent(sessionId())}`, {
                    method: 'PUT', credentials: 'include', keepalive: true,
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending.draft, clientUpdatedAt: pending.draft.updatedAt })
                }).catch(() => { });
            };
            window.addEventListener('pagehide', flush);
            return () => { window.removeEventListener('pagehide', flush); flush(); };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const rememberMaterial = (note: ClassroomNotesRecord) => {
        if (note.sessionId !== activeSession.current || !note.isUsed)
            return;
        setMaterials(previous => {
            const index = previous.findIndex(item => item.materialType === note.materialType && item.materialId === note.materialId);
            return index < 0 ? [...previous, note] : previous.map((item, position) => position === index ? note : item);
        });
    };
    return mergeProps(() => summary(), { get materials() {
            return materials();
        } }, { rememberMaterial }, { get saveState() {
            return saveState();
        } }, { get ready() {
            return ready();
        } }, { retry: () => setRevision(value => value + 1) }, { setStudentComment: (value: string) => update('studentComment', value) }, { setTutorMemo: (value: string) => update('tutorMemo', value) });
}

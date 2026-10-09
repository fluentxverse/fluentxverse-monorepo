import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal, memo } from 'preact/compat';
import {
  tutorApi,
  type ClassroomLessonNotes,
  type ClassroomNotesRecord,
  type ClassroomMaterialProgress,
  type SaveClassroomNotesInput,
} from '../api/tutor.api';
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
import { lessonMaterialNotesIcon } from '../data/lessonNotesIcons';
import './LessonNotesEditor.css';

const courses = {
  'daily-dispatch': 'Daily Dispatch',
  'conversational-skills': 'Conversational Skills',
  'business-english': 'Business English',
};
const key = (note: ClassroomNotesRecord) => `${note.materialType}:${note.materialId}`;
const version = (notes: ClassroomLessonNotes) =>
  JSON.stringify({
    summary: notes.updatedAt,
    materials: notes.materials.map((note) => [key(note), note.updatedAt]).sort(),
  });
const errorMessage = (error: any) =>
  error?.response?.data?.error || error?.message || 'Could not save changes. Your draft is kept on this device.';
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
  pronunciationItems: note.pronunciationItems.map((item) => ({ ...item, isLoading: false })),
});
const cleanProgress = (note: ClassroomNotesRecord): ClassroomNotesRecord => {
  const excluded =
    note.materialType === 'conversational-skills'
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
    ...(completed || excluded ? { stoppedAt: null, stoppedAtLabel: null, progressDetails: '' } : {}),
  };
};

// Background note updates must not reset the native select's uncommitted option preview.
const MaterialNotesSelect = memo(function MaterialNotesSelect({ materials, value, onSelect }: {
  materials: ClassroomNotesRecord[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return <select aria-label="Material used" value={value} onChange={event => onSelect(event.currentTarget.value)}>
    <option value="">Lesson feedback only</option>
    {materials.map(note => <option key={key(note)} value={key(note)}>
      {courses[note.materialType as keyof typeof courses]} - {note.materialTitle || 'Untitled material'}
    </option>)}
  </select>;
}, (previous, next) => previous.value === next.value && previous.onSelect === next.onSelect &&
  previous.materials.length === next.materials.length && previous.materials.every((note, index) => {
    const other = next.materials[index];
    return key(note) === key(other) && note.materialTitle === other.materialTitle;
  }));

function LessonNotesEditor({
  sessionId,
  canEdit,
  onClose,
  onSaved,
  onAttendanceChanged,
  submissionIssue = null,
}: {
  sessionId: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  onAttendanceChanged: (status: 'present' | 'absent') => void;
  submissionIssue?: LessonSubmissionIssue | null;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [base, setBase] = useState<ClassroomLessonNotes | null>(null);
  const [draft, setDraft] = useState<ClassroomLessonNotes | null>(null);
  const [activeKey, setActiveKey] = useState('');
  const [contexts, setContexts] = useState<Record<string, ClassroomMaterialProgress>>({});
  const [sectionsError, setSectionsError] = useState(false);
  const [sectionsRevision, setSectionsRevision] = useState(0);
  const [error, setError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [validationFocus, setValidationFocus] = useState(0);
  const [validationTarget, setValidationTarget] = useState<LessonSubmissionIssue['field']>();
  const initialIssueHandled = useRef(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState(false);
  const [course, setCourse] = useState('daily-dispatch');
  const [catalog, setCatalog] = useState<{ id: string; title: string }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [catalogId, setCatalogId] = useState('');
  const [search, setSearch] = useState('');
  const [continuations, setContinuations] = useState<Continuation[]>([]);
  useEffect(() => { let cancelled = false; lessonWorkflowApi.continuations(sessionId).then(items => { if (!cancelled) setContinuations(items); }).catch(() => {}); return () => { cancelled = true; }; }, [sessionId]);
  const storageKey = `fxv-tutor-lesson-notes-editor:${sessionId}`;
  const active = draft?.materials.find((note) => key(note) === activeKey);
  const absent = draft?.studentAttendance === 'absent';
  const dirty = Boolean(base && draft && JSON.stringify(draft) !== JSON.stringify(base));
  const validation = draft ? validateLessonNotesEditor(draft) : null;
  const missingPoints = validation?.stoppingPoints || [];
  const feedbackError = validationAttempted && validation?.studentFeedback ? 'Student feedback must contain at least 100 characters.' : '';
  const handoffError = validationAttempted && validation?.tutorHandoff ? 'Tutor handoff must not exceed 150 characters.' : '';
  const stoppingError = validationAttempted && active && missingPoints.some(note => key(note) === activeKey)
    ? 'Choose a stopping point for this in-progress material.' : '';
  const generating = Boolean(
    draft?.materials.some((note) =>
      [...note.vocabularyItems, ...note.grammarItems, ...note.pronunciationItems].some((item) => item.isLoading),
    ),
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    tutorApi
      .getClassroomLessonNotes(sessionId)
      .then((saved) => {
        if (cancelled) return;
        setBase({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null });
        let next = { ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null, materials: saved.materials.map(cleanProgress) };
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const local = JSON.parse(raw);
            if (local.version === version(saved) && Array.isArray(local.draft?.materials)) {
              next = { ...local.draft, englishLevelAssessment: local.draft.englishLevelAssessment ?? null, materials: local.draft.materials.map(cleanProgress) };
              setNotice('Unsaved draft restored.');
            } else setNotice('Newer saved notes were loaded instead of the older draft.');
          }
        } catch {
          setNotice('The local draft could not be restored. Saved notes are shown.');
        }
        setDraft(next);
        setActiveKey(next.materials[0] ? key(next.materials[0]) : '');
      })
      .catch(() => {
        if (!cancelled) setError('Could not load saved notes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, revision]);
  useLayoutEffect(() => {
    if (!base || !draft || saving || absent) return;
    try {
      if (dirty) localStorage.setItem(storageKey, JSON.stringify({ version: version(base), draft }));
      else localStorage.removeItem(storageKey);
    } catch {
      setNotice('Local draft storage unavailable. Changes have not been saved.');
    }
  }, [base, draft, dirty, saving, absent]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    setSectionsError(false);
    if (!active || active.materialType === 'daily-dispatch' || contexts[activeKey]) return;
    let cancelled = false;
    tutorApi
      .getClassroomMaterialProgress(sessionId, active.materialType, active.materialId)
      .then((data) => {
        if (!cancelled) setContexts((previous) => ({ ...previous, [activeKey]: data }));
      })
      .catch(() => {
        if (!cancelled) setSectionsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, activeKey, sectionsRevision]);
  useEffect(() => {
    if (!adding) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);
    setCatalogId('');
    setSearch('');
    const load =
      course === 'daily-dispatch'
        ? client.get('/dispatch/classroom-library').then((response) => {
            if (!response.data.success) throw new Error('Library unavailable');
            return response.data.articles
              .filter((item: any) => item.status === 'published')
              .map((item: any) => ({ id: item.id, title: item.title }));
          })
        : lessonApi.getPublishedLessonMaterials(course).then((response) => {
            if (!response.success) throw new Error('Library unavailable');
            return response.lessons.map((item) => ({
              id: item.id,
              title: `L${item.level} / Ch${item.chapter} / Lesson ${item.lessonNumber}: ${item.lessonName || item.title || 'Untitled'}`,
            }));
          });
    load
      .then((items) => {
        if (!cancelled) setCatalog(items);
      })
      .catch(() => {
        if (!cancelled) setCatalogError(true);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adding, course, catalogRevision]);

  const update = (patch: Partial<ClassroomNotesRecord>) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            materials: previous.materials.map((note) => (key(note) === activeKey ? { ...note, ...patch } : note)),
          }
        : previous,
    );
  const close = () => {
    if (saving || (dirty && !window.confirm('Discard unsaved changes?'))) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    onClose();
  };
  const revealIssue = (issue: LessonSubmissionIssue) => {
    setValidationAttempted(true);
    setError('');
    const target = issue.field || (missingPoints.length ? 'stoppingPoint' : validation?.studentFeedback ? 'studentFeedback' : validation?.tutorHandoff ? 'tutorHandoff' : undefined);
    if (!target) { setError(issue.message); return; }
    if (target === 'stoppingPoint') {
      const material = draft?.materials.find(note => note.materialType === issue.materialType && note.materialId === issue.materialId) || missingPoints[0];
      if (material) setActiveKey(key(material));
    }
    setValidationTarget(target);
    setValidationFocus(value => value + 1);
  };
  useEffect(() => {
    if (!draft || loading || !submissionIssue || initialIssueHandled.current) return;
    initialIssueHandled.current = true;
    revealIssue(submissionIssue);
  }, [draft, loading, submissionIssue]);
  useEffect(() => {
    if (!validationFocus || loading) return;
    const selector = validationTarget === 'stoppingPoint' ? '#material-stopped-at' : validationTarget === 'studentFeedback' ? '[aria-label="Student feedback"]' : '[aria-label="Tutor handoff"]';
    const field = dialog.current?.querySelector<HTMLSelectElement | HTMLTextAreaElement>(selector);
    if (field) {
      if (!field.disabled) field.focus({ preventScroll: true });
      field.scrollIntoView({ block: 'center', behavior: 'instant' });
      if (!field.disabled) setValidationFocus(0);
    }
  }, [validationFocus, validationTarget, activeKey, contexts, loading]);
  const save = async (event: Event) => {
    event.preventDefault();
    if (!draft || !base || saving || generating || !canEdit || absent) return;
    setValidationAttempted(true);
    if (missingPoints.length || validation?.studentFeedback || validation?.tutorHandoff) {
      revealIssue({ message: 'Review the required changes before saving.' });
      return;
    }
    setSaving(true);
    setError('');
    let nextBase = base;
    try {
      const freshWindow = await tutorApi.getLessonNotesEditWindow(sessionId);
      if (!freshWindow.canEdit)
        throw new Error('The lesson notes editing window is closed. Your draft is kept on this device.');
      const fresh = await tutorApi.getClassroomLessonNotes(sessionId);
      if (version(fresh) !== version(base))
        throw new Error('Notes changed in another tab. Close and reopen the editor to load the latest notes.');
      for (const note of draft.materials) {
        const original = nextBase.materials.find((item) => key(item) === key(note));
        if (original && JSON.stringify(payload(original)) === JSON.stringify(payload(note))) continue;
        const saved = await tutorApi.saveClassroomNotes(sessionId, { ...payload(note), clientUpdatedAt: Date.now() });
        nextBase = { ...nextBase, materials: [...nextBase.materials.filter((item) => key(item) !== key(note)), saved] };
        setBase(nextBase);
      }
      if (draft.studentComment !== nextBase.studentComment || draft.tutorMemo !== nextBase.tutorMemo ||
          (draft.englishLevelAssessment ?? null) !== (nextBase.englishLevelAssessment ?? null)) {
        await tutorApi.saveClassroomLessonNotes(sessionId, {
          studentComment: draft.studentComment,
          tutorMemo: draft.tutorMemo,
          englishLevelAssessment: draft.englishLevelAssessment ?? null,
          clientUpdatedAt: Date.now(),
        });
      }
      const saved = await tutorApi.getClassroomLessonNotes(sessionId);
      setBase({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null });
      setDraft({ ...saved, englishLevelAssessment: saved.englishLevelAssessment ?? null, materials: saved.materials.map(cleanProgress) });
      setValidationAttempted(false);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  const addMaterial = (continuation?: Continuation) => {
    const material = continuation ? { id: continuation.materialId, title: continuation.materialTitle } : catalog.find((item) => item.id === catalogId);
    if (!material || !draft) return;
    const selectedCourse = continuation?.materialType || course;
    const id = `${selectedCourse}:${material.id}`;
    if (!draft.materials.some((note) => key(note) === id)) {
      const note: ClassroomNotesRecord = {
        id,
        sessionId,
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
        progressDetails: continuation?.progressDetails || '',
      };
      setDraft({ ...draft, materials: [...draft.materials, note] });
    }
    setActiveKey(id);
    setAdding(false);
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="lesson-notes-editor dispatch-notes-widget"
      aria-labelledby="lesson-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form onSubmit={save}>
        <header className="dispatch-notes-header">
          <h2 id="lesson-editor-title">
            <i className={lessonMaterialNotesIcon(active?.materialType)} aria-hidden="true" />
            Edit lesson notes
          </h2>
          <button
            type="button"
            className="lne-icon"
            title="Close editor"
            aria-label="Close editor"
            disabled={saving}
            onClick={close}
          >
            <i className="fi fi-sr-cross" aria-hidden="true" />
          </button>
        </header>
        {!absent && validationAttempted && (missingPoints.length > 0 || feedbackError || handoffError) && <div className="lne-validation-summary" role="alert">
          <strong>Review required changes</strong>
          {missingPoints.map(note => <button type="button" key={key(note)} onClick={() => revealIssue({ message: '', field: 'stoppingPoint', materialType: note.materialType, materialId: note.materialId })}>Choose a stopping point for {note.materialTitle || 'Untitled material'}.</button>)}
          {feedbackError && <button type="button" onClick={() => revealIssue({ message: '', field: 'studentFeedback' })}>{feedbackError}</button>}
          {handoffError && <button type="button" onClick={() => revealIssue({ message: '', field: 'tutorHandoff' })}>{handoffError}</button>}
        </div>}
        {error && <div className="lne-validation-summary" role="alert"><p>{error}</p>{!draft && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}</div>}
        <div className="lne-body dispatch-notes-content">
          <LessonWorkflowStatus sessionId={sessionId} revision={revision + (Date.parse(base?.updatedAt || '') || 0)} unsaved={dirty} onValidationError={revealIssue} onSubmitted={() => { setRevision(value => value + 1); onSaved(); }} />
          {notice && (
            <p className="lne-notice" role="status">
              {notice}
            </p>
          )}
          {!canEdit && (
            <p className="lne-error" role="status">
              Editing is unavailable. These notes are read-only; unsaved changes remain on this device.
            </p>
          )}
          {loading ? (
            <p role="status">Loading saved notes...</p>
          ) : (
            draft && (
              <fieldset disabled={saving || !canEdit}>
                <LessonStudentAttendance sessionId={sessionId} value={draft.studentAttendance} disabled={saving || generating || !canEdit} onChanged={async status => {
                  const empty = { ...draft, studentAttendance: status, materials: status === 'absent' ? [] : draft.materials,
                    ...(status === 'absent' ? { studentComment: '', tutorMemo: '', englishLevelAssessment: null, updatedAt: null } : {}) };
                  setBase(empty);
                  setDraft(empty);
                  setActiveKey(status === 'absent' ? '' : activeKey);
                  setValidationAttempted(false);
                  setError('');
                  setNotice('');
                  onAttendanceChanged(status);
                  setRevision(value => value + 1);
                }} />
                {absent ? <p className="lne-absence-message" role="status">Student marked absent. No lesson notes are required.</p> : <>
                <div className="lne-material-picker">
                  <label>
                    Material used
                    <MaterialNotesSelect materials={draft.materials} value={activeKey} onSelect={setActiveKey} />
                  </label>
                  <button type="button" onClick={() => setAdding((value) => !value)}>
                    <i className="fi fi-sr-plus" aria-hidden="true" />
                    Add material
                  </button>
                </div>
                {adding && (
                  <section className="lne-library" aria-label="Add a material">
                    <label>
                      Course
                      <select
                        aria-label="Course"
                        value={course}
                        onChange={(event) => {
                          setCourse(event.currentTarget.value);
                          setCatalogId('');
                          setCatalog([]);
                          setCatalogLoading(true);
                        }}
                      >
                        {Object.entries(courses).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Search material
                      <input
                        value={search}
                        onInput={(event) => {
                          setSearch(event.currentTarget.value);
                          setCatalogId('');
                        }}
                      />
                    </label>
                    <label>
                      Material
                      <select
                        aria-label="Add material selection"
                        value={catalogId}
                        disabled={catalogLoading || catalogError}
                        onChange={(event) => setCatalogId(event.currentTarget.value)}
                      >
                        <option value="">{catalogLoading ? 'Loading materials...' : 'Select material'}</option>
                        {catalog
                          .filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    {catalogError && (
                      <p role="alert">
                        Material library unavailable.{' '}
                        <button type="button" onClick={() => setCatalogRevision((value) => value + 1)}>
                          Retry
                        </button>
                      </p>
                    )}
                    <button type="button" disabled={!catalogId} onClick={() => addMaterial()}>
                      <i className="fi fi-sr-check" aria-hidden="true" />
                      Use material
                    </button>
                  </section>
                )}
                {continuations.filter(item => !draft.materials.some(note => key(note) === `${item.materialType}:${item.materialId}`)).map(item => <div className="lne-continuation" key={item.materialId}><strong>{item.materialTitle}</strong><p>Previously stopped at: {item.stoppedAtLabel}</p><button type="button" onClick={() => addMaterial(item)}><i className="fi fi-sr-book-alt" aria-hidden="true" />Continue previous material</button></div>)}
                {active && (
                  <>
                    <MaterialProgressEditor
                      required
                      error={stoppingError}
                      materialType={active.materialType}
                      progress={active}
                      context={contexts[activeKey] || null}
                      loading={!sectionsError && !contexts[activeKey]}
                      onChange={update}
                      onRetry={() => setSectionsRevision((value) => value + 1)}
                    />
                    <LessonEditorLearningFields
                      key={activeKey}
                      note={active}
                      disabled={saving || !canEdit}
                      onChange={(change) =>
                        setDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                materials: previous.materials.map((note) =>
                                  key(note) === activeKey ? change(note) : note,
                                ),
                              }
                            : previous,
                        )
                      }
                    />
                  </>
                )}
                <LessonLevelAssessment
                  value={draft.englishLevelAssessment ?? null}
                  onChange={englishLevelAssessment => setDraft(previous => previous ? { ...previous, englishLevelAssessment } : previous)}
                />
                <LessonFeedbackFields
                  privacyReminder
                  required
                  feedbackError={feedbackError}
                  handoffError={handoffError}
                  studentComment={draft.studentComment}
                  tutorMemo={draft.tutorMemo}
                  disabled={saving || !canEdit}
                  setStudentComment={(studentComment) =>
                    setDraft((previous) => (previous ? { ...previous, studentComment } : previous))
                  }
                  setTutorMemo={(tutorMemo) =>
                    setDraft((previous) => (previous ? { ...previous, tutorMemo } : previous))
                  }
                />
                </>}
              </fieldset>
            )
          )}
        </div>
        <footer className="dispatch-notes-footer">
          <span role="status">{saving ? 'Saving changes...' : dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
          <button type="button" disabled={saving} onClick={close}>
            Cancel
          </button>
          <button type="submit" className="lne-save" disabled={absent || !canEdit || loading || saving || generating || !dirty}>
            <i className="fi fi-sr-disk" aria-hidden="true" />
            Save changes
          </button>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}

export default memo(LessonNotesEditor);

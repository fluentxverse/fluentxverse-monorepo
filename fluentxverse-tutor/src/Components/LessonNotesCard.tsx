import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { tutorApi, type ClassroomNotesRecord, type LessonNotesEntry, type LessonNotesTab } from '../api/tutor.api';
import { lessonNotesLabels } from '../data/lessonNotesLabels';
import { lessonNotesIcons, lessonMaterialNotesIcon } from '../data/lessonNotesIcons';
import { ENGLISH_LEVELS } from '../data/englishLevels';
import { getLessonVocabularyMeaning } from '../utils/lessonVocabulary';
import { lessonMaterialPosition } from '../utils/lessonMaterialPosition';
import { useLessonNotesEditWindow } from '../hooks/useLessonNotesEditWindow';
import LessonNotesEditor from './LessonNotesEditor';
import LessonStudentAttendance from './LessonStudentAttendance';
import LessonWorkflowStatus from './LessonWorkflowStatus';
import type { LessonSubmissionIssue } from '../api/lessonWorkflow.api';
import './LessonNotesCard.css';

const tabs: { id: LessonNotesTab; label: string; empty: string }[] = [
  { id: 'current', label: 'This Lesson', empty: 'No notes recorded for this lesson yet.' },
  { id: 'recent', label: 'Recent Lessons', empty: 'No recent lessons available yet.' },
  { id: 'mine', label: 'My Notes', empty: 'You have no lessons with this student yet.' },
  { id: 'first', label: 'First Two Entries', empty: 'No lessons available yet.' },
];

const lessonDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

const materialNames: Record<string, string> = {
  'daily-dispatch': 'Daily Dispatch',
  'conversational-skills': 'Conversational Skills',
  'business-english': 'Business English',
};

const materialDescription = (note: ClassroomNotesRecord) =>
  [materialNames[note.materialType] || 'Learning material', lessonMaterialPosition(note)].filter(Boolean).join(' \u00b7 ');

const recentLessonDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
});
const recentLessonTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
});

function LessonDetails({ entry, current }: { entry: LessonNotesEntry; current: boolean }) {
  const start = new Date(entry.startsAt);
  const end = new Date(start.getTime() + (entry.durationMinutes || 25) * 60_000);
  const attendance = entry.studentAttendance === 'absent' ? 'Absent' : 'Present';
  return <header className="recent-lesson-details">
    <div className="lesson-history-heading">
      <h3><i className="fi fi-sr-calendar" aria-hidden="true" />{recentLessonDate.format(start)}</h3>
      {current && <span className="recent-lesson-current">This lesson</span>}
    </div>
    <dl>
      <div><dt><i className="fi fi-sr-user" aria-hidden="true" />Tutor</dt><dd>{entry.tutorName}</dd></div>
      <div><dt><i className="fi fi-sr-graduation-cap" aria-hidden="true" />Lesson type</dt><dd>Booked</dd></div>
      <div><dt><i className="fi fi-sr-clock" aria-hidden="true" />Lesson time</dt><dd>{recentLessonTime.format(start)} - {recentLessonTime.format(end)} <span className="recent-lesson-timezone">PHT (UTC+08)</span></dd></div>
      <div><dt><i className="fi fi-sr-user" aria-hidden="true" />Student attendance</dt><dd className="lesson-attendance" data-attendance={entry.studentAttendance || 'unknown'}>{attendance}</dd></div>
      <div><dt><i className="fi fi-sr-calendar" aria-hidden="true" />Lesson date</dt><dd>{recentLessonDate.format(start)}</dd></div>
      {entry.workflow && <div><dt><i className="fi fi-sr-check" aria-hidden="true" />Notes status</dt><dd>{entry.workflow.notesStatus === 'submitted' ? 'Submitted' : entry.workflow.notesStatus === 'changes_pending' ? 'Updates pending submission' : entry.workflow.notesStatus === 'not_required' ? 'Not required' : entry.workflow.closed ? 'Overdue' : 'Draft'}</dd></div>}
    </dl>
  </header>;
}

function PendingLessonNotes({ entry }: { entry: LessonNotesEntry }) {
  const deadline = new Date(new Date(entry.startsAt).getTime() + ((entry.durationMinutes || 25) * 60_000) + 48 * 60 * 60_000);
  const overdue = Date.now() > deadline.getTime();
  return <div className="lesson-notes-columns recent-lesson-pending">
    {[{label: 'Lesson notes for the student', icon: lessonNotesIcons.studentFeedback, type: 'feedback'}, {label: lessonNotesLabels.tutorHandoff, icon: lessonNotesIcons.tutorHandoff, type: 'handoff'}].map(({label, icon, type}) =>
      <div className={`lesson-notes-column lesson-pending-${type}`} key={label}>
        <h3><i className={icon} aria-hidden="true" />{label}</h3>
        {type === 'feedback' && <LevelAssessmentSummary />}
        <div className="lesson-notes-pending-message">
          <i className={lessonNotesIcons.inProgress} aria-hidden="true" />
          <div><strong>{overdue ? 'Notes not yet added' : 'Pending tutor notes'}</strong>
            <p>{overdue ? 'The 48-hour update window has passed.' : 'Expected within 48 hours after the lesson.'}</p>
          </div>
        </div>
      </div>)}
  </div>;
}

function MaterialNotes({ note }: { note: ClassroomNotesRecord }) {
  const words = (note.vocabularyItems || []).filter(item => item?.word?.trim());
  const grammar = (note.grammarItems || []).filter(item => item?.youSaid?.trim() || item?.correct?.trim());
  const pronunciation = (note.pronunciationItems || []).filter(item => item?.word?.trim() || item?.phonetic?.trim());
  return (
    <section className="lesson-material-notes" aria-label={note.materialTitle || 'Material notes'}>
      <header className="lesson-notes-material">
        <span><i className={lessonMaterialNotesIcon(note.materialType)} aria-hidden="true" />Material used &middot; {materialDescription(note)}</span>
        <h3>{note.materialTitle || 'Material details unavailable'}</h3>
        <MaterialProgress note={note} />
      </header>
        <div className="lesson-notes-column lesson-learning-notes">
          {words.length > 0 && <section className="lesson-note-section lesson-words-section">
            <h4><i className={lessonNotesIcons.words} aria-hidden="true" />{lessonNotesLabels.words}</h4>
            <ol>{words.map((item, index) => <li key={index}>{item.word}</li>)}</ol>
          </section>}
          {words.length > 0 && <section className="lesson-note-section lesson-vocabulary-section">
            <h4><i className={lessonNotesIcons.vocabulary} aria-hidden="true" />{lessonNotesLabels.vocabulary}</h4>
            <ul>{words.map((item, index) => <li key={index}><strong>{item.word}</strong> - {getLessonVocabularyMeaning(item)}</li>)}</ul>
          </section>}
          {grammar.length > 0 && <section className="lesson-note-section lesson-grammar-section">
            <h4><i className={lessonNotesIcons.grammar} aria-hidden="true" />{lessonNotesLabels.grammar}</h4>
            {grammar.map((item, index) => <div className="lesson-grammar-note" key={index}>
              {item.youSaid?.trim() && <p className="lesson-grammar-original"><strong>You said:</strong> {item.youSaid}</p>}
              {item.correct?.trim() && <p className="lesson-grammar-correct"><strong>Correct:</strong> {item.correct}</p>}
            </div>)}
          </section>}
          {pronunciation.length > 0 && <section className="lesson-note-section lesson-pronunciation-section">
            <h4><i className={lessonNotesIcons.pronunciation} aria-hidden="true" />{lessonNotesLabels.pronunciation}</h4>
            <ul>{pronunciation.map((item, index) => <li key={index}>
              {item.word}{item.phonetic?.trim() && <> <span className="lesson-note-phonetic">[{item.phonetic.trim().replace(/^\[(.*)\]$/, '$1')}]</span></>}
            </li>)}</ul>
          </section>}
          {!words.length && !grammar.length && !pronunciation.length && <p className="lesson-note-empty">No learning notes recorded for this material yet.</p>}
        </div>
    </section>
  );
}

function MaterialProgress({ note, compact = false }: { note: ClassroomNotesRecord; compact?: boolean }) {
  const status = note.materialType === 'daily-dispatch' ? 'completed' : note.completionStatus;
  return <div className={`lesson-material-progress${compact ? ' is-compact' : ''}`} data-status={status || 'unknown'}>
    <span className="lesson-material-status"><i className={status === 'completed' ? lessonNotesIcons.completed : status === 'in_progress' ? lessonNotesIcons.inProgress : 'fi fi-sr-info'} aria-hidden="true" />
      {status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Status not recorded'}
    </span>
    {status === 'in_progress' && !compact && <>
      <p><strong>Stopped at:</strong> {note.stoppedAtLabel || 'Not recorded'}</p>
      {note.progressDetails?.trim() && <p className="lesson-material-progress-details">{note.progressDetails.trim()}</p>}
    </>}
  </div>;
}

function LevelAssessmentSummary({ value }: { value?: number | null }) {
  const level = ENGLISH_LEVELS[(value || 0) - 1];
  return <section className="lesson-note-section lesson-assessment-section">
    <h4><i className={lessonNotesIcons.assessment} aria-hidden="true" />English level assessment</h4>
    {level ? <><p><strong>{level.value} - {level.label}</strong></p><p>{level.description}</p></>
      : <p className="lesson-note-empty">Not assessed</p>}
  </section>;
}

function LessonSummary({ entry }: { entry: LessonNotesEntry }) {
  const legacy = (field: 'studentComment' | 'tutorMemo') => [...new Set(entry.notes.map(note => note[field]?.trim()).filter(Boolean))].join('\n\n');
  const feedback = entry.studentComment ?? legacy('studentComment');
  const handoff = entry.tutorMemo ?? legacy('tutorMemo');
  return <div className="lesson-notes-columns lesson-summary-notes">
    <div className="lesson-notes-column">
      <LevelAssessmentSummary value={entry.englishLevelAssessment} />
      <section className="lesson-note-section lesson-feedback-section">
        <h4><i className={lessonNotesIcons.studentFeedback} aria-hidden="true" />{lessonNotesLabels.studentFeedback}</h4>
        <p className={!feedback.trim() ? 'lesson-note-empty' : ''}>{feedback.trim() || 'No student feedback recorded.'}</p>
      </section>
    </div>
    <div className="lesson-notes-column lesson-tutor-notes">
      <section className="lesson-note-section lesson-handoff-section">
        <h4><i className={lessonNotesIcons.tutorHandoff} aria-hidden="true" />{lessonNotesLabels.tutorHandoff}</h4>
        <p className={!handoff.trim() ? 'lesson-note-empty' : ''}>{handoff.trim() || 'No handoff details recorded.'}</p>
      </section>
    </div>
  </div>;
}

type NotesResult = { entries: LessonNotesEntry[]; error: boolean; revision: number };

export default function LessonNotesCard({ sessionId }: { sessionId: string }) {
  const [tab, setTab] = useState<LessonNotesTab>('current');
  const [revision, setRevision] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [submissionIssue, setSubmissionIssue] = useState<LessonSubmissionIssue | null>(null);
  const closeEditor = useCallback(() => setShowEditor(false), []);
  const refreshSavedNotes = useCallback(() => setRevision(value => value + 1), []);
  const { windowInfo, canEdit, error: windowError, retry: retryWindow } = useLessonNotesEditWindow(sessionId);
  const [visibleCount, setVisibleCount] = useState(5);
  const cache = useRef<Record<string, NotesResult>>({});
  const [results, setResults] = useState<Record<string, NotesResult>>({});
  const [attendanceOverride, setAttendanceOverride] = useState<'present' | 'absent' | undefined>();
  const attendanceChanged = useCallback((status: 'present' | 'absent') => {
    setAttendanceOverride(status);
    for (const request of Object.keys(cache.current)) {
      cache.current[request] = { ...cache.current[request], entries: cache.current[request].entries.map(entry => entry.sessionId !== sessionId ? entry : {
        ...entry, studentAttendance: status, ...(status === 'absent' ? { notes: [], studentComment: '', tutorMemo: '', englishLevelAssessment: null, summaryUpdatedAt: null } : {}),
      }) };
    }
    setResults({ ...cache.current });
    setRevision(value => value + 1);
  }, [sessionId]);
  useEffect(() => setAttendanceOverride(undefined), [sessionId, windowInfo?.studentAttendance]);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement | null>(null);
  const requestKey = `${sessionId}:${tab}`;
  const result = results[requestKey];
  const loading = !result;
  const refreshing = loading || result.revision !== revision;
  const selectedTab = tabs.find(item => item.id === tab)!;
  const paginated = tab === 'recent' || tab === 'mine';
  const visibleEntries = paginated ? result?.entries.slice(0, visibleCount) : tab === 'first' ? result?.entries.slice(0, 2) : result?.entries;

  useLayoutEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
    setVisibleCount(5);
  }, [sessionId, tab]);

  useEffect(() => {
    if (cache.current[requestKey]?.revision === revision) return;
    const controller = new AbortController();
    const saveResult = (entries: LessonNotesEntry[], error: boolean) => {
      if (controller.signal.aborted) return;
      cache.current = { ...cache.current, [requestKey]: { entries, error, revision } };
      setResults(cache.current);
    };
    tutorApi.getLessonNotes(sessionId, tab, controller.signal).then(entries => {
      saveResult(entries, false);
    }).catch(() => {
      saveResult(cache.current[requestKey]?.entries || [], true);
    });
    return () => controller.abort();
  }, [sessionId, tab, revision]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return (
    <section className="lesson-notes-card" aria-labelledby="lesson-notes-title">
      <header className="lesson-notes-heading">
        <h2 id="lesson-notes-title"><span className="lesson-section-icon"><i className={lessonNotesIcons.notes} aria-hidden="true" /></span>Lesson notes</h2>
        <div className="lesson-notes-actions">
        <button type="button" className="lesson-notes-edit" disabled={!canEdit} title={canEdit ? 'Edit notes for this lesson' : 'Lesson notes are read-only outside the editing window'} onClick={() => { setSubmissionIssue(null); setShowEditor(true); }}><i className="fi fi-sr-pencil" aria-hidden="true" />Edit notes</button>
        <button type="button" className="lesson-notes-refresh" title="Refresh lesson notes" aria-label="Refresh lesson notes" disabled={refreshing} onClick={() => { setRevision(value => value + 1); retryWindow(); }}>
          <i className="fi fi-sr-refresh" aria-hidden="true" />
        </button>
        </div>
      </header>
      <div className="lesson-notes-edit-window" role="status">
        {windowError ? <>Editing availability could not be checked. <button type="button" title="Check editing availability" aria-label="Check editing availability" onClick={retryWindow}><i className="fi fi-sr-refresh" aria-hidden="true" /></button></> : !windowInfo ? 'Checking editing availability...' :
          canEdit ? <>Editable until <time dateTime={windowInfo.editableUntil}>{lessonDate.format(new Date(windowInfo.editableUntil))} PHT</time></> : windowInfo.reason === 'not_started' ? 'Editing opens when the lesson starts.' : windowInfo.reason === 'cancelled' ? 'Cancelled lesson · Read-only' : '48-hour editing window closed · Read-only'}
      </div>
      <div className="lesson-notes-tabs" role="tablist" aria-label="Lesson notes">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            ref={element => { tabButtons.current[index] = element; }}
            id={`lesson-notes-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="lesson-notes-panel"
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={event => {
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              setTab(tabs[next].id);
              tabButtons.current[next]?.focus();
            }}
          >{item.label}</button>
        ))}
      </div>
      <div ref={panel} id="lesson-notes-panel" role="tabpanel" aria-labelledby={`lesson-notes-tab-${tab}`} tabIndex={0} aria-busy={refreshing}>
        {tab === 'current' && <LessonStudentAttendance sessionId={sessionId} value={attendanceOverride ?? windowInfo?.studentAttendance} disabled={!canEdit} onChanged={attendanceChanged} />}
        {tab === 'current' && <LessonWorkflowStatus sessionId={sessionId} revision={revision} onSubmitted={() => setRevision(value => value + 1)} onValidationError={canEdit ? issue => { setSubmissionIssue(issue); setShowEditor(true); } : undefined} />}
        {result?.error && (
          <div className="lesson-notes-state lesson-notes-error" role="alert">
            <span>{result.entries.length ? 'We could not refresh the notes. Previously loaded notes are shown.' : 'We could not load the lesson notes.'}</span>
            <button type="button" disabled={refreshing} onClick={() => setRevision(value => value + 1)}>Try again</button>
          </div>
        )}
        {loading ? <p className="lesson-notes-state" role="status">Loading notes...</p> : visibleEntries?.length ? <>
          {visibleEntries.map(entry => (
          <article className="lesson-notes-entry" key={entry.sessionId}>
            {tab !== 'current' ? <LessonDetails entry={entry} current={entry.sessionId === sessionId} /> : <header className="lesson-notes-meta">
              <span><i className="fi fi-sr-calendar" aria-hidden="true" /><time dateTime={entry.startsAt}>{lessonDate.format(new Date(entry.startsAt))} PHT</time></span>
              <span><i className="fi fi-sr-user" aria-hidden="true" />{entry.tutorName}</span>
            </header>}
            {entry.notes.length > 0 && <section className="lesson-materials-used" aria-label="Materials used">
              <h3>Materials used <span>{entry.notes.length}</span></h3>
              <ol>{entry.notes.map(note => <li key={note.id}>
                <span>{materialDescription(note)}</span>
                <strong>{note.materialTitle || 'Material details unavailable'}</strong>
                <MaterialProgress note={note} compact />
              </li>)}</ol>
            </section>}
            {entry.notes.map(note => <MaterialNotes key={note.id} note={note} />)}
            {entry.studentAttendance === 'absent' ? <p className="lesson-notes-state">Student marked absent. No lesson notes are required.</p> : entry.notes.length || entry.studentComment?.trim() || entry.tutorMemo?.trim() || entry.summaryUpdatedAt
              ? <LessonSummary entry={entry} /> : <PendingLessonNotes entry={entry} />}
          </article>
          ))}
          {paginated && <footer className="recent-lessons-footer">
            <span>{visibleEntries.length} {tab === 'recent' ? 'recent ' : ''}{visibleEntries.length === 1 ? 'lesson' : 'lessons'}</span>
            {visibleCount < 10 && (result?.entries.length || 0) > visibleCount && <button type="button" onClick={() => setVisibleCount(10)}>
              <i className="fi fi-sr-angle-small-down" aria-hidden="true" />Load more lessons
            </button>}
          </footer>}
        </> : !result?.error && (
          <div className="lesson-notes-empty">
            <div className="lesson-notes-columns">
              <div className="lesson-notes-column"><LevelAssessmentSummary /><h3><i className={lessonNotesIcons.studentFeedback} aria-hidden="true" />Student feedback</h3><p className="lesson-note-empty">No feedback recorded</p></div>
              <div className="lesson-notes-column"><h3><i className={lessonNotesIcons.tutorHandoff} aria-hidden="true" />Tutor handoff</h3><p className="lesson-note-empty">No handoff details recorded</p></div>
            </div>
            <p className="lesson-notes-state">{selectedTab.empty}</p>
          </div>
        )}
      </div>
      {showEditor && <LessonNotesEditor key={sessionId} sessionId={sessionId} canEdit={canEdit} submissionIssue={submissionIssue} onClose={closeEditor} onSaved={refreshSavedNotes} onAttendanceChanged={attendanceChanged} />}
    </section>
  );
}

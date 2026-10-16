import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
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
const tabs: {
    id: LessonNotesTab;
    label: string;
    empty: string;
}[] = [
    { id: 'current', label: 'This Lesson', empty: 'No notes recorded for this lesson yet.' },
    { id: 'recent', label: 'Recent Lessons', empty: 'No recent lessons available yet.' },
    { id: 'mine', label: 'My Notes', empty: 'You have no lessons with this student yet.' },
    { id: 'first', label: 'First Two Entries', empty: 'No lessons available yet.' },
];
const lessonDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
});
const materialNames: Record<string, string> = {
    'daily-dispatch': 'Daily Dispatch',
    'conversational-skills': 'Conversational Skills',
    'business-english': 'Business English'
};
const materialDescription = (note: ClassroomNotesRecord) => [materialNames[note.materialType] || 'Learning material', lessonMaterialPosition(note)].filter(Boolean).join(' \u00b7 ');
const recentLessonDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
});
const recentLessonTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit'
});
function LessonDetails(_props0: {
    entry: LessonNotesEntry;
    current: boolean;
}) {
    const start = createMemo(() => new Date(_props0["entry"].startsAt));
    const end = createMemo(() => new Date(start().getTime() + (_props0["entry"].durationMinutes || 25) * 60000));
    const attendance = createMemo(() => _props0["entry"].studentAttendance === 'absent' ? 'Absent' : 'Present');
    return <header class="recent-lesson-details">
    <div class="lesson-history-heading">
      <h3><TutorIcon name="fi fi-sr-calendar" aria-hidden="true"/>{recentLessonDate.format(start())}</h3>
      {_props0["current"] && <span class="recent-lesson-current">This lesson</span>}
    </div>
    <dl>
      <div><dt><TutorIcon name="fi fi-sr-user" aria-hidden="true"/>Tutor</dt><dd>{_props0["entry"].tutorName}</dd></div>
      <div><dt><TutorIcon name="fi fi-sr-graduation-cap" aria-hidden="true"/>Lesson type</dt><dd>Booked</dd></div>
      <div><dt><TutorIcon name="fi fi-sr-clock" aria-hidden="true"/>Lesson time</dt><dd>{recentLessonTime.format(start())} - {recentLessonTime.format(end())} <span class="recent-lesson-timezone">PHT (UTC+08)</span></dd></div>
      <div><dt><TutorIcon name="fi fi-sr-user" aria-hidden="true"/>Student attendance</dt><dd class="lesson-attendance" data-attendance={_props0["entry"].studentAttendance || 'unknown'}>{attendance()}</dd></div>
      <div><dt><TutorIcon name="fi fi-sr-calendar" aria-hidden="true"/>Lesson date</dt><dd>{recentLessonDate.format(start())}</dd></div>
      {_props0["entry"].workflow && <div><dt><TutorIcon name="fi fi-sr-check" aria-hidden="true"/>Notes status</dt><dd>{_props0["entry"].workflow.notesStatus === 'submitted' ? 'Submitted' : _props0["entry"].workflow.notesStatus === 'changes_pending' ? 'Updates pending submission' : _props0["entry"].workflow.notesStatus === 'not_required' ? 'Not required' : _props0["entry"].workflow.closed ? 'Overdue' : 'Draft'}</dd></div>}
    </dl>
  </header>;
}
function PendingLessonNotes(_props1: {
    entry: LessonNotesEntry;
}) {
    const deadline = createMemo(() => new Date(new Date(_props1["entry"].startsAt).getTime() + ((_props1["entry"].durationMinutes || 25) * 60000) + 48 * 60 * 60000));
    const overdue = createMemo(() => Date.now() > deadline().getTime());
    return <div class="lesson-notes-columns recent-lesson-pending">
    {[{ label: 'Lesson notes for the student', icon: lessonNotesIcons.studentFeedback, type: 'feedback' }, { label: lessonNotesLabels.tutorHandoff, icon: lessonNotesIcons.tutorHandoff, type: 'handoff' }].map((_props2) => <div class={`lesson-notes-column lesson-pending-${_props2["type"]}`}>
        <h3><TutorIcon name={_props2["icon"]} aria-hidden="true"/>{_props2["label"]}</h3>
        {_props2["type"] === 'feedback' && <LevelAssessmentSummary />}
        <div class="lesson-notes-pending-message">
          <TutorIcon name={lessonNotesIcons.inProgress} aria-hidden="true"/>
          <div><strong>{overdue() ? 'Notes not yet added' : 'Pending tutor notes'}</strong>
            <p>{overdue() ? 'The 48-hour update window has passed.' : 'Expected within 48 hours after the lesson.'}</p>
          </div>
        </div>
      </div>)}
  </div>;
}
function MaterialNotes(_props3: {
    note: ClassroomNotesRecord;
}) {
    const words = createMemo(() => (_props3["note"].vocabularyItems || []).filter(item => item?.word?.trim()));
    const grammar = createMemo(() => (_props3["note"].grammarItems || []).filter(item => item?.youSaid?.trim() || item?.correct?.trim()));
    const pronunciation = createMemo(() => (_props3["note"].pronunciationItems || []).filter(item => item?.word?.trim() || item?.phonetic?.trim()));
    return (<section class="lesson-material-notes" aria-label={_props3["note"].materialTitle || 'Material notes'}>
      <header class="lesson-notes-material">
        <span><TutorIcon name={lessonMaterialNotesIcon(_props3["note"].materialType)} aria-hidden="true"/>Material used &middot; {materialDescription(_props3["note"])}</span>
        <h3>{_props3["note"].materialTitle || 'Material details unavailable'}</h3>
        <MaterialProgress note={_props3["note"]}/>
      </header>
        <div class="lesson-notes-column lesson-learning-notes">
          {words().length > 0 && <section class="lesson-note-section lesson-words-section">
            <h4><TutorIcon name={lessonNotesIcons.words} aria-hidden="true"/>{lessonNotesLabels.words}</h4>
            <ol>{words().map((item, index) => <li>{item.word}</li>)}</ol>
          </section>}
          {words().length > 0 && <section class="lesson-note-section lesson-vocabulary-section">
            <h4><TutorIcon name={lessonNotesIcons.vocabulary} aria-hidden="true"/>{lessonNotesLabels.vocabulary}</h4>
            <ul>{words().map((item, index) => <li><strong>{item.word}</strong> - {getLessonVocabularyMeaning(item)}</li>)}</ul>
          </section>}
          {grammar().length > 0 && <section class="lesson-note-section lesson-grammar-section">
            <h4><TutorIcon name={lessonNotesIcons.grammar} aria-hidden="true"/>{lessonNotesLabels.grammar}</h4>
            {grammar().map((item, index) => <div class="lesson-grammar-note">
              {item.youSaid?.trim() && <p class="lesson-grammar-original"><strong>You said:</strong> {item.youSaid}</p>}
              {item.correct?.trim() && <p class="lesson-grammar-correct"><strong>Correct:</strong> {item.correct}</p>}
            </div>)}
          </section>}
          {pronunciation().length > 0 && <section class="lesson-note-section lesson-pronunciation-section">
            <h4><TutorIcon name={lessonNotesIcons.pronunciation} aria-hidden="true"/>{lessonNotesLabels.pronunciation}</h4>
            <ul>{pronunciation().map((item, index) => <li>
              {item.word}{item.phonetic?.trim() && <> <span class="lesson-note-phonetic">[{item.phonetic.trim().replace(/^\[(.*)\]$/, '$1')}]</span></>}
            </li>)}</ul>
          </section>}
          {!words().length && !grammar().length && !pronunciation().length && <p class="lesson-note-empty">No learning notes recorded for this material yet.</p>}
        </div>
    </section>);
}
function MaterialProgress(_props4: {
    note: ClassroomNotesRecord;
    compact?: boolean;
}) {
    const status = createMemo(() => _props4["note"].materialType === 'daily-dispatch' ? 'completed' : _props4["note"].completionStatus);
    return <div class={`lesson-material-progress${(_props4["compact"] === undefined ? false : _props4["compact"]) ? ' is-compact' : ''}`} data-status={status() || 'unknown'}>
    <span class="lesson-material-status"><TutorIcon name={status() === 'completed' ? lessonNotesIcons.completed : status() === 'in_progress' ? lessonNotesIcons.inProgress : 'fi fi-sr-info'} aria-hidden="true"/>
      {status() === 'completed' ? 'Completed' : status() === 'in_progress' ? 'In progress' : 'Status not recorded'}
    </span>
    {status() === 'in_progress' && !(_props4["compact"] === undefined ? false : _props4["compact"]) && <>
      <p><strong>Stopped at:</strong> {_props4["note"].stoppedAtLabel || 'Not recorded'}</p>
      {_props4["note"].progressDetails?.trim() && <p class="lesson-material-progress-details">{_props4["note"].progressDetails.trim()}</p>}
    </>}
  </div>;
}
function LevelAssessmentSummary(_props5: {
    value?: number | null;
}) {
    const level = createMemo(() => ENGLISH_LEVELS[(_props5["value"] || 0) - 1]);
    return <section class="lesson-note-section lesson-assessment-section">
    <h4><TutorIcon name={lessonNotesIcons.assessment} aria-hidden="true"/>English level assessment</h4>
    {level() ? <><p><strong>{level().value} - {level().label}</strong></p><p>{level().description}</p></>
            : <p class="lesson-note-empty">Not assessed</p>}
  </section>;
}
function LessonSummary(_props6: {
    entry: LessonNotesEntry;
}) {
    const legacy = (field: 'studentComment' | 'tutorMemo') => [...new Set(_props6["entry"].notes.map(note => note[field]?.trim()).filter(Boolean))].join('\n\n');
    const feedback = createMemo(() => _props6["entry"].studentComment ?? legacy('studentComment'));
    const handoff = createMemo(() => _props6["entry"].tutorMemo ?? legacy('tutorMemo'));
    return <div class="lesson-notes-columns lesson-summary-notes">
    <div class="lesson-notes-column">
      <LevelAssessmentSummary value={_props6["entry"].englishLevelAssessment}/>
      <section class="lesson-note-section lesson-feedback-section">
        <h4><TutorIcon name={lessonNotesIcons.studentFeedback} aria-hidden="true"/>{lessonNotesLabels.studentFeedback}</h4>
        <p class={!feedback().trim() ? 'lesson-note-empty' : ''}>{feedback().trim() || 'No student feedback recorded.'}</p>
      </section>
    </div>
    <div class="lesson-notes-column lesson-tutor-notes">
      <section class="lesson-note-section lesson-handoff-section">
        <h4><TutorIcon name={lessonNotesIcons.tutorHandoff} aria-hidden="true"/>{lessonNotesLabels.tutorHandoff}</h4>
        <p class={!handoff().trim() ? 'lesson-note-empty' : ''}>{handoff().trim() || 'No handoff details recorded.'}</p>
      </section>
    </div>
  </div>;
}
type NotesResult = {
    entries: LessonNotesEntry[];
    error: boolean;
    revision: number;
};
export default function LessonNotesCard(_props7: {
    sessionId: string;
}) {
    const [tab, setTab] = createSignal<LessonNotesTab>('current');
    const [revision, setRevision] = createSignal(0);
    const [showEditor, setShowEditor] = createSignal(false);
    const [submissionIssue, setSubmissionIssue] = createSignal<LessonSubmissionIssue | null>(null);
    const closeEditor = createMemo(on(() => [], () => () => setShowEditor(false)));
    const refreshSavedNotes = createMemo(on(() => [], () => () => setRevision(value => value + 1)));
    const _state8 = useLessonNotesEditWindow(() => _props7["sessionId"]);
    const [visibleCount, setVisibleCount] = createSignal(5);
    const cache = { current: {} } as {
        current: Record<string, NotesResult> | null;
    };
    const [results, setResults] = createSignal<Record<string, NotesResult>>({});
    const [attendanceOverride, setAttendanceOverride] = createSignal<'present' | 'absent' | undefined>();
    const attendanceChanged = createMemo(on(() => [_props7["sessionId"]], () => (status: 'present' | 'absent') => {
        setAttendanceOverride(status);
        for (const request of Object.keys(cache.current)) {
            cache.current[request] = { ...cache.current[request], entries: cache.current[request].entries.map(entry => entry.sessionId !== _props7["sessionId"] ? entry : {
                    ...entry, studentAttendance: status, ...(status === 'absent' ? { notes: [], studentComment: '', tutorMemo: '', englishLevelAssessment: null, summaryUpdatedAt: null } : {})
                }) };
        }
        setResults({ ...cache.current });
        setRevision(value => value + 1);
    }));
    createEffect(on(() => [_props7["sessionId"], _state8.windowInfo?.studentAttendance], () => {
        const _cleanup9 = untrack(() => setAttendanceOverride(undefined));
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    const tabButtons = { current: [] } as {
        current: (HTMLButtonElement | null)[] | null;
    };
    const panel = { current: null } as {
        current: (HTMLDivElement | null) | null;
    };
    const requestKey = createMemo(() => `${_props7["sessionId"]}:${tab()}`);
    const result = createMemo(() => results()[requestKey()]);
    const loading = createMemo(() => !result());
    const refreshing = createMemo(() => loading() || result().revision !== revision());
    const selectedTab = createMemo(() => tabs.find(item => item.id === tab())!);
    const paginated = createMemo(() => tab() === 'recent' || tab() === 'mine');
    const visibleEntries = createMemo(() => paginated() ? result()?.entries.slice(0, visibleCount()) : tab() === 'first' ? result()?.entries.slice(0, 2) : result()?.entries);
    createEffect(on(() => [_props7["sessionId"], tab()], () => {
        const _cleanup10 = untrack(() => {
            if (panel.current)
                panel.current.scrollTop = 0;
            setVisibleCount(5);
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    createEffect(on(() => [_props7["sessionId"], tab(), revision()], () => {
        const _cleanup11 = untrack(() => {
            if (cache.current[requestKey()]?.revision === revision())
                return;
            const controller = new AbortController();
            const key = requestKey();
            const requestedRevision = revision();
            const saveResult = (entries: LessonNotesEntry[], error: boolean) => {
                if (controller.signal.aborted)
                    return;
                cache.current = { ...cache.current, [key]: { entries, error, revision: requestedRevision } };
                setResults(cache.current);
            };
            tutorApi.getLessonNotes(_props7["sessionId"], tab(), controller.signal).then(entries => {
                saveResult(entries, false);
            }).catch(() => {
                saveResult(cache.current[key]?.entries || [], true);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    createEffect(on(() => [], () => {
        const _cleanup12 = untrack(() => {
            const refresh = () => setRevision(value => value + 1);
            window.addEventListener('focus', refresh);
            return () => window.removeEventListener('focus', refresh);
        });
        if (typeof _cleanup12 === "function")
            onCleanup(_cleanup12);
    }));
    return (<section class="lesson-notes-card" aria-labelledby="lesson-notes-title">
      <header class="lesson-notes-heading">
        <h2 id="lesson-notes-title"><span class="lesson-section-icon"><TutorIcon name={lessonNotesIcons.notes} aria-hidden="true"/></span>Lesson notes</h2>
        <div class="lesson-notes-actions">
        <button type="button" class="lesson-notes-edit" disabled={!_state8.canEdit} title={_state8.canEdit ? 'Edit notes for this lesson' : 'Lesson notes are read-only outside the editing window'} onClick={() => { setSubmissionIssue(null); setShowEditor(true); }}><TutorIcon name="fi fi-sr-pencil" aria-hidden="true"/>Edit notes</button>
        <button type="button" class="lesson-notes-refresh" title="Refresh lesson notes" aria-label="Refresh lesson notes" disabled={refreshing()} onClick={() => { setRevision(value => value + 1); _state8.retry(); }}>
          <TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/>
        </button>
        </div>
      </header>
      <div class="lesson-notes-edit-window" role="status">
        {_state8.error ? <>Editing availability could not be checked. <button type="button" title="Check editing availability" aria-label="Check editing availability" onClick={_state8.retry}><TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/></button></> : !_state8.windowInfo ? 'Checking editing availability...' :
            _state8.canEdit ? <>Editable until <time dateTime={_state8.windowInfo.editableUntil}>{lessonDate.format(new Date(_state8.windowInfo.editableUntil))} PHT</time></> : _state8.windowInfo.reason === 'not_started' ? 'Editing opens when the lesson starts.' : _state8.windowInfo.reason === 'cancelled' ? 'Cancelled lesson · Read-only' : '48-hour editing window closed · Read-only'}
      </div>
      <div class="lesson-notes-tabs" role="tablist" aria-label="Lesson notes">
        {tabs.map((item, index) => (<button ref={element => { tabButtons.current[index] = element; }} id={`lesson-notes-tab-${item.id}`} type="button" role="tab" aria-selected={tab() === item.id} aria-controls="lesson-notes-panel" tabIndex={tab() === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
                let next = index;
                if (event.key === 'ArrowRight')
                    next = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft')
                    next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home')
                    next = 0;
                else if (event.key === 'End')
                    next = tabs.length - 1;
                else
                    return;
                event.preventDefault();
                setTab(tabs[next].id);
                tabButtons.current[next]?.focus();
            }}>{item.label}</button>))}
      </div>
      <div ref={_element => panel.current = _element} id="lesson-notes-panel" role="tabpanel" aria-labelledby={`lesson-notes-tab-${tab()}`} tabIndex={0} aria-busy={refreshing()}>
        {tab() === 'current' && <LessonStudentAttendance sessionId={_props7["sessionId"]} value={attendanceOverride() ?? _state8.windowInfo?.studentAttendance} disabled={!_state8.canEdit} onChanged={attendanceChanged()}/>}
        {tab() === 'current' && <LessonWorkflowStatus sessionId={_props7["sessionId"]} revision={revision()} onSubmitted={() => setRevision(value => value + 1)} onValidationError={_state8.canEdit ? issue => { setSubmissionIssue(issue); setShowEditor(true); } : undefined}/>}
        {result()?.error && (<div class="lesson-notes-state lesson-notes-error" role="alert">
            <span>{result().entries.length ? 'We could not refresh the notes. Previously loaded notes are shown.' : 'We could not load the lesson notes.'}</span>
            <button type="button" disabled={refreshing()} onClick={() => setRevision(value => value + 1)}>Try again</button>
          </div>)}
        {loading() ? <p class="lesson-notes-state" role="status">Loading notes...</p> : visibleEntries()?.length ? <>
          {visibleEntries().map(entry => (<article class="lesson-notes-entry">
            {tab() !== 'current' ? <LessonDetails entry={entry} current={entry.sessionId === _props7["sessionId"]}/> : <header class="lesson-notes-meta">
              <span><TutorIcon name="fi fi-sr-calendar" aria-hidden="true"/><time dateTime={entry.startsAt}>{lessonDate.format(new Date(entry.startsAt))} PHT</time></span>
              <span><TutorIcon name="fi fi-sr-user" aria-hidden="true"/>{entry.tutorName}</span>
            </header>}
            {entry.notes.length > 0 && <section class="lesson-materials-used" aria-label="Materials used">
              <h3>Materials used <span>{entry.notes.length}</span></h3>
              <ol>{entry.notes.map(note => <li>
                <span>{materialDescription(note)}</span>
                <strong>{note.materialTitle || 'Material details unavailable'}</strong>
                <MaterialProgress note={note} compact/>
              </li>)}</ol>
            </section>}
            {entry.notes.map(note => <MaterialNotes note={note}/>)}
            {entry.studentAttendance === 'absent' ? <p class="lesson-notes-state">Student marked absent. No lesson notes are required.</p> : entry.notes.length || entry.studentComment?.trim() || entry.tutorMemo?.trim() || entry.summaryUpdatedAt
                    ? <LessonSummary entry={entry}/> : <PendingLessonNotes entry={entry}/>}
          </article>))}
          {paginated() && <footer class="recent-lessons-footer">
            <span>{visibleEntries().length} {tab() === 'recent' ? 'recent ' : ''}{visibleEntries().length === 1 ? 'lesson' : 'lessons'}</span>
            {visibleCount() < 10 && (result()?.entries.length || 0) > visibleCount() && <button type="button" onClick={() => setVisibleCount(10)}>
              <TutorIcon name="fi fi-sr-angle-small-down" aria-hidden="true"/>Load more lessons
            </button>}
          </footer>}
        </> : !result()?.error && (<div class="lesson-notes-empty">
            <div class="lesson-notes-columns">
              <div class="lesson-notes-column"><LevelAssessmentSummary /><h3><TutorIcon name={lessonNotesIcons.studentFeedback} aria-hidden="true"/>Student feedback</h3><p class="lesson-note-empty">No feedback recorded</p></div>
              <div class="lesson-notes-column"><h3><TutorIcon name={lessonNotesIcons.tutorHandoff} aria-hidden="true"/>Tutor handoff</h3><p class="lesson-note-empty">No handoff details recorded</p></div>
            </div>
            <p class="lesson-notes-state">{selectedTab().empty}</p>
          </div>)}
      </div>
      {showEditor() && <LessonNotesEditor sessionId={_props7["sessionId"]} canEdit={_state8.canEdit} submissionIssue={submissionIssue()} onClose={closeEditor()} onSaved={refreshSavedNotes()} onAttendanceChanged={attendanceChanged()}/>}
    </section>);
}

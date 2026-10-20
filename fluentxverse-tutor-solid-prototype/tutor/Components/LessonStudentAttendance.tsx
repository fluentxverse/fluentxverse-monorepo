import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import TutorArt from "./Common/TutorArt";
import TutorDialog from './Common/TutorDialog';
import { tutorApi } from '../api/tutor.api';
import { clearLessonNotesDrafts } from '../utils/clearLessonNotesDrafts';
import './LessonStudentAttendance.css';
function LessonStudentAttendance(_props0: {
    sessionId: string;
    value?: string | null;
    disabled: boolean;
    onChanged: (status: 'present' | 'absent') => void | Promise<void>;
}) {
    const [status, setStatus] = createSignal(_props0["value"]);
    const [confirming, setConfirming] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [error, setError] = createSignal('');
    const [reason, setReason] = createSignal('');
    createEffect(on(() => [_props0["value"]], () => {
        const _cleanup1 = untrack(() => setStatus(_props0["value"]));
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const update = async (next: 'present' | 'absent') => {
        if (saving() || _props0["disabled"])
            return;
        setSaving(true);
        setError('');
        try {
            await tutorApi.setLessonStudentAttendance(_props0["sessionId"], next, reason().trim() || (next === 'present' ? 'Tutor corrected student to present' : 'Student did not attend'));
            if (next === 'absent')
                clearLessonNotesDrafts(_props0["sessionId"]);
            setStatus(next);
            setConfirming(false);
            await _props0["onChanged"](next);
        }
        catch (error: any) {
            setError(error?.response?.data?.error || error?.message || 'Attendance could not be saved. Please try again.');
        }
        finally {
            setSaving(false);
        }
    };
    return <>
    <section class="lesson-student-attendance" aria-label="Student attendance">
      <strong>Student attendance</strong>
      <span class="lesson-attendance-status" data-status={status() === 'absent' ? 'absent' : 'present'}>{status() === 'absent' ? 'Absent' : 'Present'}</span>
      <label><input type="checkbox" checked={status() === 'absent'} disabled={_props0["disabled"] || saving()} onChange={event => {
            const absent = event.currentTarget.checked;
            event.currentTarget.checked = status() === 'absent';
            setError('');
            if (absent) {
                setReason('');
                setConfirming(true);
            }
            else
                void update('present');
        }}/>Mark student absent</label>
      {saving() && <span role="status">Updating attendance...</span>}
      {error() && !confirming() && <p class="lesson-attendance-error" role="alert">{error()}</p>}
    </section>
    {confirming() && <TutorDialog label="Mark student absent?" className="lesson-absence-confirmation" onClose={() => { setConfirming(false); setError(''); }} busy={saving()}>
      <h2 id="lesson-absence-title"><TutorArt name="issue" size={32}/>Mark student absent?</h2>
      <p>This will remove all lesson notes from student and tutor views, including material progress, vocabulary, grammar, pronunciation, the level assessment, student feedback, and tutor handoff. Unsaved drafts will also be discarded. An admin-only recovery archive will be retained.</p>
      <p>No lesson notes are required while the student is marked absent. Marking the student present again will not restore deleted notes.</p>
      <label>Reason (optional)<textarea value={reason()} maxLength={1000} onInput={event => setReason(event.currentTarget.value)}/></label>
      {error() && <p class="lesson-attendance-error" role="alert">{error()}</p>}
      <footer>
        <button type="button" disabled={saving()} onClick={() => { setConfirming(false); setError(''); }} autofocus>Cancel</button>
        <button type="button" class="lesson-absence-confirm" disabled={saving() || _props0["disabled"]} onClick={() => void update('absent')}>
          <TutorIcon name="fi fi-sr-trash" aria-hidden="true"/>{saving() ? 'Updating...' : 'Mark absent and delete notes'}
        </button>
      </footer>
    </TutorDialog>}
  </>;
}
export default LessonStudentAttendance;

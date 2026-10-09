import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal, memo } from 'preact/compat';
import { tutorApi } from '../api/tutor.api';
import { clearLessonNotesDrafts } from '../utils/clearLessonNotesDrafts';
import './LessonStudentAttendance.css';

function LessonStudentAttendance({ sessionId, value, disabled, onChanged }: {
  sessionId: string;
  value?: string | null;
  disabled: boolean;
  onChanged: (status: 'present' | 'absent') => void | Promise<void>;
}) {
  const [status, setStatus] = useState(value);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => setStatus(value), [value]);
  useEffect(() => { if (confirming) dialog.current?.showModal(); }, [confirming]);

  const update = async (next: 'present' | 'absent') => {
    if (saving || disabled) return;
    setSaving(true);
    setError('');
    try {
      await tutorApi.setLessonStudentAttendance(sessionId, next, reason.trim() || (next === 'present' ? 'Tutor corrected student to present' : 'Student did not attend'));
      if (next === 'absent') clearLessonNotesDrafts(sessionId);
      setStatus(next);
      setConfirming(false);
      await onChanged(next);
    } catch (error: any) {
      setError(error?.response?.data?.error || error?.message || 'Attendance could not be saved. Please try again.');
    } finally { setSaving(false); }
  };

  return <>
    <section className="lesson-student-attendance" aria-label="Student attendance">
      <strong>Student attendance</strong>
      <span className="lesson-attendance-status" data-status={status === 'absent' ? 'absent' : 'present'}>{status === 'absent' ? 'Absent' : 'Present'}</span>
      <label><input type="checkbox" checked={status === 'absent'} disabled={disabled || saving} onChange={event => {
        const absent = event.currentTarget.checked;
        event.currentTarget.checked = status === 'absent';
        setError('');
        if (absent) { setReason(''); setConfirming(true); }
        else void update('present');
      }} />Mark student absent</label>
      {saving && <span role="status">Updating attendance...</span>}
      {error && !confirming && <p className="lesson-attendance-error" role="alert">{error}</p>}
    </section>
    {confirming && createPortal(<dialog ref={dialog} className="lesson-absence-confirmation" aria-labelledby="lesson-absence-title" onCancel={event => {
      event.preventDefault();
      if (!saving) { setConfirming(false); setError(''); }
    }}>
      <h2 id="lesson-absence-title"><i className="fi fi-sr-exclamation" aria-hidden="true" />Mark student absent?</h2>
      <p>This will remove all lesson notes from student and tutor views, including material progress, vocabulary, grammar, pronunciation, the level assessment, student feedback, and tutor handoff. Unsaved drafts will also be discarded. An admin-only recovery archive will be retained.</p>
      <p>No lesson notes are required while the student is marked absent. Marking the student present again will not restore deleted notes.</p>
      <label>Reason (optional)<textarea value={reason} maxLength={1000} onInput={event => setReason(event.currentTarget.value)} /></label>
      {error && <p className="lesson-attendance-error" role="alert">{error}</p>}
      <footer>
        <button type="button" disabled={saving} onClick={() => { setConfirming(false); setError(''); }} autoFocus>Cancel</button>
        <button type="button" className="lesson-absence-confirm" disabled={saving || disabled} onClick={() => void update('absent')}>
          <i className="fi fi-sr-trash" aria-hidden="true" />{saving ? 'Updating...' : 'Mark absent and delete notes'}
        </button>
      </footer>
    </dialog>, document.body)}
  </>;
}

export default memo(LessonStudentAttendance);

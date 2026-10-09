import { useEffect, useState } from 'preact/hooks';
import { lessonWorkflowApi, type LessonWorkflow, type LessonSubmissionIssue } from '../api/lessonWorkflow.api';
import './LessonWorkflowStatus.css';

export default function LessonWorkflowStatus({ sessionId, revision = 0, onSubmitted, onValidationError, unsaved = false }: { sessionId: string; revision?: number; onSubmitted?: () => void; onValidationError?: (issue: LessonSubmissionIssue) => void; unsaved?: boolean }) {
  const [data, setData] = useState<LessonWorkflow | null>(null);
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState<'load' | 'submit' | null>(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let cancelled = false;
    lessonWorkflowApi.get(sessionId).then(value => { if (!cancelled) { setData(value); setError(''); } })
      .catch(() => { if (!cancelled) { setError('Could not load lesson submission status.'); setErrorAction('load'); } });
    return () => { cancelled = true; };
  }, [sessionId, revision, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const focus = () => setRefresh(value => value + 1);
    window.addEventListener('focus', focus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, []);
  const canSubmit = !unsaved && data && data.notesStatus !== 'not_required' && data.notesStatus !== 'submitted'
    && now >= Date.parse(data.endsAt) && now < Date.parse(data.editableUntil);
  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true); setError('');
    try { setData(await lessonWorkflowApi.submit(sessionId)); onSubmitted?.(); }
    catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Could not submit notes.';
      if (err.response?.status === 400 && onValidationError) {
        onValidationError({ ...err.response?.data?.validation, message });
      } else {
        setError(message);
        setErrorAction(err.response?.status === 400 || err.response?.status === 403 ? null : 'submit');
      }
    }
    finally { setSaving(false); }
  };
  return <div className="lesson-workflow-status">
    {data && <><div><strong>{data.notesStatus === 'not_required' ? 'Notes not required' : data.notesStatus === 'submitted' ? 'Notes submitted' : data.notesStatus === 'changes_pending' ? 'Unsubmitted updates' : 'Draft notes'}</strong>
      <span>{data.studentAttendance === 'absent' ? 'Student absent' : data.attendanceVerified ? 'Student attendance verified' : 'Student present · Verification pending'}</span>
      {data.notesStatus !== 'not_required' && <span>{now >= Date.parse(data.editableUntil) ? 'Update window closed' : `Submit by ${new Date(data.editableUntil).toLocaleString('en-US', { timeZone: 'Asia/Manila' })} PHT`}</span>}</div>
      {unsaved && <span>Save changes before submitting.</span>}
      {data.notesStatus !== 'not_required' && data.notesStatus !== 'submitted' && <button type="button" disabled={!canSubmit || saving} onClick={submit}><i className="fi fi-sr-check" aria-hidden="true" />{saving ? 'Submitting...' : 'Submit notes & confirm attendance'}</button>}</>}
    {error && <div className="lesson-workflow-error" role="alert"><p>{error}</p>
      {(errorAction === 'load' || errorAction === 'submit') && <button type="button" disabled={saving} onClick={() => errorAction === 'submit' ? submit() : setRefresh(value => value + 1)}>Retry</button>}
    </div>}
  </div>;
}

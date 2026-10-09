import { useEffect, useRef, useState } from 'preact/hooks';
import { API_BASE_URL } from '../config/api';
import { TutorLessonIssueReportDialog, type TroubleDuration, type TroubleReason, type TutorStudentIssue } from './TutorLessonIssueReportDialog';

interface ReportStatus {
  startsAt: string;
  endsAt: string;
  serverNow: string;
  eligible: boolean;
  report: { id: string } | null;
}

export default function TutorClassroomIssueReport({ bookingId }: { bookingId: string }) {
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<TroubleDuration | null>(null);
  const [reason, setReason] = useState<TroubleReason | null>(null);
  const [studentIssue, setStudentIssue] = useState<TutorStudentIssue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(bookingId)}/trouble-report`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { credentials: 'include', cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not check reporting availability.');
      if (controller.signal.aborted) return;
      offset.current = Date.parse(result.data.serverNow) - Date.now();
      setStatus(result.data); setLoadError(''); setNow(Date.now());
    }).catch(err => { if (!controller.signal.aborted) setLoadError(err.message); });
    return () => controller.abort();
  }, [url, revision]);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => { if (!document.hidden) setRevision(value => value + 1); };
    const poll = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(clock); window.clearInterval(poll); window.removeEventListener('focus', refresh); };
  }, []);
  const available = Boolean(status && !status.report && !loadError && status.eligible
    && now + offset.current >= Date.parse(status.startsAt) && now + offset.current < Date.parse(status.endsAt));
  const hint = status?.report ? 'One report per lesson. Your report has been submitted.'
    : loadError || 'Issue reports are available only during the scheduled lesson.';
  const submit = async () => {
    if (!available || !duration || !reason || (reason === 'student' && !studentIssue) || saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration, reason, studentIssue: reason === 'student' ? studentIssue : undefined }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not submit the report.');
      setStatus(current => current && ({ ...current, report: result.data, eligible: false })); setOpen(false);
    } catch (err: any) { setError(err.message || 'Could not submit the report.'); setRevision(value => value + 1); }
    finally { setSaving(false); }
  };
  return <>
    <div className="classroom-tutor-report-control">
      <button type="button" title={hint} disabled={!available} onClick={() => { setDuration(null); setReason(null); setStudentIssue(null); setError(null); setOpen(true); }}>
        <i className={status?.report ? 'fi fi-sr-check' : 'fi fi-sr-exclamation'} aria-hidden="true" />{status?.report ? 'Issue reported' : 'Report issue'}
      </button>
      <span role="status">{loadError ? 'Availability unavailable' : status?.report ? 'Report submitted' : !status ? 'Checking availability...' : available ? 'One report per lesson' : 'Outside lesson time'}</span>
      {loadError && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}
    </div>
    {open && <TutorLessonIssueReportDialog reportDuration={duration} reportReason={reason} reportSubmitting={saving} reportWindowOpen={available} reportSubmitError={error}
      reportStudentIssue={studentIssue} setReportStudentIssue={setStudentIssue}
      setReportDuration={setDuration} setReportReason={setReason} setReportSubmitError={setError} closeReportModal={() => { if (!saving) setOpen(false); }} submitTroubleReport={submit} />}
  </>;
}

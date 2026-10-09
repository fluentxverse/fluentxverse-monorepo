import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Send, X } from 'lucide-preact';
import { lessonIssueReportApi, type LessonIssueDuration, type LessonIssueReason, type StudentIssueReportStatus } from '../api/lessonIssueReport.api';
import { studentTutorIssues, type StudentTutorIssue } from '../data/studentTutorIssues';
import './StudentLessonIssueReport.css';

const reasons: { value: LessonIssueReason; label: string }[] = [
  { value: 'connection', label: 'Internet connection problem' }, { value: 'audio', label: 'Audio or microphone problem' },
  { value: 'hardware', label: 'Device problem' }, { value: 'power', label: 'Power interruption' },
  { value: 'emergency', label: 'Health or personal emergency' }, { value: 'tutor', label: 'Tutor-related issue' },
  { value: 'material', label: 'Lesson material problem' }, { value: 'other', label: 'Other lesson issue' },
];
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export default function StudentLessonIssueReport({ bookingId, compact = false, presenceRevision }: { bookingId: string; compact?: boolean; presenceRevision?: string }) {
  const [status, setStatus] = useState<StudentIssueReportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<LessonIssueDuration | null>(null);
  const [reason, setReason] = useState<LessonIssueReason | null>(null);
  const [tutorIssue, setTutorIssue] = useState<StudentTutorIssue | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const loadedBooking = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = loadedBooking.current !== bookingId;
    setLoading(initialLoad);
    if (initialLoad) { setStatus(null); setLoadError(''); }
    lessonIssueReportApi.get(bookingId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      offset.current = Date.parse(result.serverNow) - Date.now();
      loadedBooking.current = bookingId;
      setStatus(result); setNow(Date.now()); setLoadError('');
    }).catch(() => { if (!controller.signal.aborted) setLoadError('Could not check reporting availability.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, revision, presenceRevision]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  useEffect(() => {
    if (!open) return;
    body.current?.scrollTo({ top: 0 });
    body.current?.querySelector<HTMLElement>('legend, h3')?.focus();
  }, [open, step]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const ongoing = Date.now() + offset.current < Date.parse(status?.lessonEndsAt || '');
      const awaitingChange = ['not_started', 'waiting_for_tutor', 'tutor_joined', 'tutor_disconnected_wait'].includes(status?.reason || '');
      if (document.visibilityState === 'visible' && !status?.report && (ongoing || awaitingChange)
        && Date.now() + offset.current < Date.parse(status?.closesAt || '')) setRevision(value => value + 1);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [bookingId, status?.report, status?.reason, status?.lessonEndsAt, status?.closesAt]);
  useEffect(() => {
    if (status?.report || !status?.availableAt || !['waiting_for_tutor', 'tutor_disconnected_wait'].includes(status.reason || '')) return;
    const delay = Date.parse(status.availableAt) - (Date.now() + offset.current);
    if (!Number.isFinite(delay) || delay < 0) return;
    const timer = window.setTimeout(() => setRevision(value => value + 1), delay + 100);
    return () => window.clearTimeout(timer);
  }, [bookingId, status?.availableAt, status?.reason, status?.report]);
  const available = Boolean(status?.eligible && !status.report && !loadError
    && now + offset.current >= Date.parse(status.startsAt) && now + offset.current < Date.parse(status.closesAt));
  const duringLesson = Boolean(status && now + offset.current < Date.parse(status.lessonEndsAt));
  const tutorChoices = duringLesson ? studentTutorIssues.filter(issue => issue.value === (status?.duringLessonTutorIssue || 'no_show')) : studentTutorIssues;
  const detailsRequired = reason === 'other' || (reason === 'tutor' && tutorIssue === 'other');
  const canSubmit = available && Boolean(duration && reason) && (reason !== 'tutor' || (step === 3 && tutorChoices.some(issue => issue.value === tutorIssue)))
    && (!detailsRequired || Boolean(details.trim()));
  const availabilityMessage = status?.reason === 'cancelled' ? 'Cancelled lessons cannot be reported.'
    : status?.reason === 'not_started' || status?.reason === 'waiting_for_tutor'
      ? 'Reporting opens if the tutor has not joined after three minutes, or has been disconnected for 60 seconds during the lesson.'
      : status?.reason === 'tutor_disconnected_wait'
        ? 'Please wait until the tutor has been disconnected for 60 seconds. Reporting closes if the tutor returns.'
      : status?.reason === 'tutor_joined'
        ? 'The tutor is in the classroom. Reporting opens if they disconnect for 60 seconds, or after the lesson ends for up to 48 hours.'
        : available && status ? `Report by ${date.format(new Date(status.closesAt))} JST` : 'The 48-hour reporting window has closed.';
  const close = () => { if (!saving) setOpen(false); };
  const submit = async () => {
    if (step === 1 || !canSubmit || !duration || !reason || saving) return;
    setSaving(true); setError('');
    try {
      const report = await lessonIssueReportApi.submit(bookingId, duration, reason, details, reason === 'tutor' ? tutorIssue! : undefined);
      setStatus(current => current && ({ ...current, report, eligible: false })); setOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Could not submit your report. Please try again.');
      if ([403, 409].includes(err?.response?.status)) setRevision(value => value + 1);
    } finally { setSaving(false); }
  };
  return <>
    <div className={`student-issue-report-control${compact ? ' classroom-report-control' : ''}`}>
      <button type="button" className="student-report-issue-button" title={status?.report ? 'One report per lesson. Your report has been submitted.' : loadError || availabilityMessage} disabled={loading || !available} onClick={() => { setStep(1); setDuration(null); setReason(null); setTutorIssue(null); setDetails(''); setError(''); setOpen(true); }}>
        {status?.report ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{status?.report ? 'Issue reported' : 'Report issue'}
      </button>
      {compact && <span role="status">{loading ? 'Checking availability...' : status?.report ? 'Report submitted' : loadError ? 'Availability unavailable' : available ? 'One report per lesson' : 'Not available yet'}</span>}
      {compact && loadError && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}
      {!compact && (loadError ? <p role="alert">{loadError}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>
        : status?.report ? <div role="status"><p>{status.report.status === 'resolved' ? 'Issue resolved' : status.report.status === 'under_review' ? 'Issue under review' : 'Your issue report has been submitted.'}</p>{status.report.tutorIssueLabel && <p>{status.report.tutorIssueLabel}</p>}{status.report.resolution && <p>{status.report.resolution}</p>}{status.report.attendanceCorrection && <p>Attendance corrected: {status.report.attendanceCorrection}</p>}{status.report.ticketTransactionId && <p>Ticket refund recorded: {status.report.ticketTransactionId}</p>}</div> : status && <p>{status.reason === 'cancelled' ? 'Cancelled lessons cannot be reported.'
          : availabilityMessage}</p>)}
    </div>
    {open && createPortal(<dialog ref={dialog} className="student-issue-report-dialog" aria-labelledby="student-issue-title" onCancel={event => { event.preventDefault(); close(); }}>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <header><div><span>Step {step} of {reason === 'tutor' ? 3 : 2}</span><h2 id="student-issue-title"><AlertTriangle size={20} />Report a lesson issue</h2></div><button type="button" aria-label="Close report" title="Close report" disabled={saving} onClick={close} autoFocus><X size={20} /></button></header>
        <div className="student-issue-report-body" ref={body}>
          {step === 1 ? <><h3 tabIndex={-1}>How long were you able to study?</h3><div className="student-issue-duration-options"><button type="button" onClick={() => { setDuration('up_to_ten'); setStep(2); }}>10 minutes or less</button><button type="button" onClick={() => { setDuration('over_ten'); setStep(2); }}>More than 10 minutes</button></div></>
            : <fieldset key={step} disabled={saving}><legend tabIndex={-1}>{step === 3 ? 'What happened with the tutor?' : 'What went wrong during the lesson?'}</legend><div className={`student-issue-reasons${step === 3 ? ' student-tutor-issues' : ''}`}>
              {step === 3 ? tutorChoices.map(item => <label key={item.value}><input type="radio" name="tutor-issue" value={item.value} checked={tutorIssue === item.value} onChange={() => { setTutorIssue(item.value); setError(''); }} />{item.label}</label>)
                : reasons.map(item => <label key={item.value}><input type="radio" name="lesson-issue-reason" value={item.value} checked={reason === item.value} onChange={() => { setReason(item.value); setTutorIssue(null); setError(''); }} />{item.label}</label>)}
            </div>{(step === 3 || reason !== 'tutor') && <label className="student-issue-details">Additional details ({detailsRequired ? 'required' : 'optional'})<textarea value={details} required={detailsRequired} maxLength={2000} rows={4} onInput={event => setDetails(event.currentTarget.value)} /></label>}</fieldset>}
          {!available && <p role="alert" className="student-issue-error">{availabilityMessage}</p>}
        </div>
        <footer>{error && <p role="alert" className="student-issue-error">{error}</p>}{step > 1 && <button type="button" disabled={saving} onClick={() => { setStep(step === 3 ? 2 : 1); setError(''); }}><ArrowLeft size={16} />Back</button>}<button type="button" disabled={saving} onClick={close}>Cancel</button>{step === 2 && reason === 'tutor' ? <button key="next-tutor-issue" type="button" className="student-issue-submit" disabled={saving || !available} onClick={() => { setStep(3); setError(''); }}>Next<ArrowRight size={16} /></button> : step > 1 && <button key="submit-report" type="submit" className="student-issue-submit" disabled={saving || !canSubmit}><Send size={16} />{saving ? 'Submitting...' : 'Submit report'}</button>}</footer>
      </form>
    </dialog>, document.body)}
  </>;
}

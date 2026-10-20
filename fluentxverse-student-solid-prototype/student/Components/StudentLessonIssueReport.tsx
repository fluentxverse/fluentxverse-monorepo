import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Send, X } from "lucide-solid";
import { lessonIssueReportApi, type LessonIssueDuration, type LessonIssueReason, type StudentIssueReportStatus } from '../api/lessonIssueReport.api';
import { studentTutorIssues, type StudentTutorIssue } from '../data/studentTutorIssues';
import './StudentLessonIssueReport.css';
import StudentDialog from './Common/StudentDialog';
import { useAuthContext } from '../context/AuthContext';
import { readSessionDraft, saveSessionDraft, sessionDraftKey } from '../../../shared/sessionDraft';
interface IssueDraft { duration: LessonIssueDuration | null; reason: LessonIssueReason | null; tutorIssue: StudentTutorIssue | null; step: 1 | 2 | 3; details: string }
function isIssueDraft(value: unknown): value is IssueDraft {
    const draft = value as IssueDraft | null;
    return Boolean(draft && [null, 'up_to_ten', 'over_ten'].includes(draft.duration) && [1, 2, 3].includes(draft.step)
        && (draft.reason === null || reasons.some(reason => reason.value === draft.reason))
        && (draft.tutorIssue === null || studentTutorIssues.some(issue => issue.value === draft.tutorIssue))
        && typeof draft.details === 'string' && draft.details.length <= 2000);
}
const reasons: {
    value: LessonIssueReason;
    label: string;
}[] = [
    { value: 'connection', label: 'Internet connection problem' }, { value: 'audio', label: 'Audio or microphone problem' },
    { value: 'hardware', label: 'Device problem' }, { value: 'power', label: 'Power interruption' },
    { value: 'emergency', label: 'Health or personal emergency' }, { value: 'tutor', label: 'Tutor-related issue' },
    { value: 'material', label: 'Lesson material problem' }, { value: 'other', label: 'Other lesson issue' },
];
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export default function StudentLessonIssueReport(_props0: {
    bookingId: string;
    compact?: boolean;
    presenceRevision?: string;
}) {
    const [status, setStatus] = createSignal<StudentIssueReportStatus | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [loadError, setLoadError] = createSignal('');
    const [error, setError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [open, setOpen] = createSignal(false);
    const [duration, setDuration] = createSignal<LessonIssueDuration | null>(null);
    const [reason, setReason] = createSignal<LessonIssueReason | null>(null);
    const [tutorIssue, setTutorIssue] = createSignal<StudentTutorIssue | null>(null);
    const [step, setStep] = createSignal<1 | 2 | 3>(1);
    const [details, setDetails] = createSignal('');
    const [saving, setSaving] = createSignal(false);
    const auth = useAuthContext();
    const draftKey = createMemo(() => auth.user?.userId ? sessionDraftKey(auth.user.userId, 'lesson-issue', _props0.bookingId) : null);
    const [draftNotice, setDraftNotice] = createSignal('');
    let openDraftKey: string | null = null;
    const [now, setNow] = createSignal(Date.now());
    const offset = { current: 0 } as {
        current: any;
    };
    const loadedBooking = { current: null } as {
        current: (string | null) | null;
    };
    const body = { current: null } as {
        current: HTMLDivElement | null;
    };
    createEffect(on(() => [_props0["bookingId"], revision(), _props0["presenceRevision"]], () => {
        const _cleanup1 = untrack(() => {
            const controller = new AbortController();
            const initialLoad = loadedBooking.current !== _props0["bookingId"];
            setLoading(initialLoad);
            if (initialLoad) {
                setStatus(null);
                setLoadError('');
            }
            lessonIssueReportApi.get(_props0["bookingId"], controller.signal).then(result => {
                if (controller.signal.aborted)
                    return;
                offset.current = Date.parse(result.serverNow) - Date.now();
                loadedBooking.current = _props0["bookingId"];
                setStatus(result);
                setNow(Date.now());
                setLoadError('');
            }).catch(() => { if (!controller.signal.aborted)
                setLoadError('Could not check reporting availability.'); })
                .finally(() => { if (!controller.signal.aborted)
                setLoading(false); });
            return () => controller.abort();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const timer = window.setInterval(() => setNow(Date.now()), 1000);
            const refresh = () => setRevision(value => value + 1);
            window.addEventListener('focus', refresh);
            return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(() => {
        if (!open() || !draftKey() || openDraftKey !== draftKey() || status()?.report) return;
        const value = { duration: duration(), reason: reason(), tutorIssue: tutorIssue(), step: step(), details: details() };
        let stored = false;
        try { stored = saveSessionDraft(sessionStorage, draftKey()!, value); } catch {}
        if (!stored) setDraftNotice('Draft storage is unavailable. Keep this page open until the report is submitted.');
    });
    const openReport = () => {
        openDraftKey = draftKey();
        let saved: IssueDraft | null = null;
        try { if (draftKey()) saved = readSessionDraft(sessionStorage, draftKey()!, isIssueDraft); } catch {}
        setStep(saved?.step || 1); setDuration(saved?.duration || null); setReason(saved?.reason || null);
        setTutorIssue(saved?.tutorIssue || null); setDetails(saved?.details || ''); setError('');
        setDraftNotice(saved ? 'Your unfinished report was restored.' : ''); setOpen(true);
    };
    createEffect(on(() => [open(), step()], () => {
        const _cleanup4 = untrack(() => {
            if (!open())
                return;
            body.current?.scrollTo({ top: 0 });
            body.current?.querySelector<HTMLElement>('legend, h3')?.focus();
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [_props0["bookingId"], status()?.report, status()?.reason, status()?.lessonEndsAt, status()?.closesAt], () => {
        const _cleanup5 = untrack(() => {
            const timer = window.setInterval(() => {
                const ongoing = Date.now() + offset.current < Date.parse(status()?.lessonEndsAt || '');
                const awaitingChange = ['not_started', 'waiting_for_tutor', 'tutor_joined', 'tutor_disconnected_wait'].includes(status()?.reason || '');
                if (document.visibilityState === 'visible' && !status()?.report && (ongoing || awaitingChange)
                    && Date.now() + offset.current < Date.parse(status()?.closesAt || ''))
                    setRevision(value => value + 1);
            }, 10000);
            return () => window.clearInterval(timer);
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [_props0["bookingId"], status()?.availableAt, status()?.reason, status()?.report], () => {
        const _cleanup6 = untrack(() => {
            if (status()?.report || !status()?.availableAt || !['waiting_for_tutor', 'tutor_disconnected_wait'].includes(status().reason || ''))
                return;
            const delay = Date.parse(status().availableAt) - (Date.now() + offset.current);
            if (!Number.isFinite(delay) || delay < 0)
                return;
            const timer = window.setTimeout(() => setRevision(value => value + 1), delay + 100);
            return () => window.clearTimeout(timer);
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    const available = createMemo(() => Boolean(status()?.eligible && !status().report && !loadError()
        && now() + offset.current >= Date.parse(status().startsAt) && now() + offset.current < Date.parse(status().closesAt)));
    const duringLesson = createMemo(() => Boolean(status() && now() + offset.current < Date.parse(status().lessonEndsAt)));
    const tutorChoices = createMemo(() => duringLesson() ? studentTutorIssues.filter(issue => issue.value === (status()?.duringLessonTutorIssue || 'no_show')) : studentTutorIssues);
    const detailsRequired = createMemo(() => reason() === 'other' || (reason() === 'tutor' && tutorIssue() === 'other'));
    const canSubmit = createMemo(() => available() && Boolean(duration() && reason()) && (reason() !== 'tutor' || (step() === 3 && tutorChoices().some(issue => issue.value === tutorIssue())))
        && (!detailsRequired() || Boolean(details().trim())));
    const availabilityMessage = createMemo(() => status()?.reason === 'cancelled' ? 'Cancelled lessons cannot be reported.'
        : status()?.reason === 'not_started' || status()?.reason === 'waiting_for_tutor'
            ? 'Reporting opens if the tutor has not joined after three minutes, or has been disconnected for 60 seconds during the lesson.'
            : status()?.reason === 'tutor_disconnected_wait'
                ? 'Please wait until the tutor has been disconnected for 60 seconds. Reporting closes if the tutor returns.'
                : status()?.reason === 'tutor_joined'
                    ? 'The tutor is in the classroom. Reporting opens if they disconnect for 60 seconds, or after the lesson ends for up to 48 hours.'
                    : available() && status() ? `Report by ${date.format(new Date(status().closesAt))} JST` : 'The 48-hour reporting window has closed.');
    const close = () => { if (!saving())
        setOpen(false); };
    const submit = async () => {
        if (step() === 1 || !canSubmit() || !duration() || !reason() || saving())
            return;
        setSaving(true);
        setError('');
        try {
            const report = await lessonIssueReportApi.submit(_props0["bookingId"], duration(), reason(), details(), reason() === 'tutor' ? tutorIssue()! : undefined);
            setStatus(current => current && ({ ...current, report, eligible: false }));
            window.dispatchEvent(new Event('lesson-issue-updated'));
            try { if (draftKey()) sessionStorage.removeItem(draftKey()!); } catch {}
            setOpen(false);
        }
        catch (err: any) {
            setError(err?.response?.data?.error || err.message || 'Could not submit your report. Please try again.');
            if ([403, 409].includes(err?.response?.status))
                setRevision(value => value + 1);
        }
        finally {
            setSaving(false);
        }
    };
    return <>
    <div class={`student-issue-report-control${(_props0["compact"] === undefined ? false : _props0["compact"]) ? ' classroom-report-control' : ''}`}>
      <button type="button" class="student-report-issue-button" title={status()?.report ? 'One report per lesson. Your report has been submitted.' : loadError() || availabilityMessage()} disabled={loading() || !available()} onClick={openReport}>
        {status()?.report ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}{status()?.report ? 'Issue reported' : 'Report issue'}
      </button>
      {(_props0["compact"] === undefined ? false : _props0["compact"]) && <span role="status">{loading() ? 'Checking availability...' : status()?.report ? 'Report submitted' : loadError() ? 'Availability unavailable' : available() ? 'One report per lesson' : 'Not available yet'}</span>}
      {(_props0["compact"] === undefined ? false : _props0["compact"]) && loadError() && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}
      {!(_props0["compact"] === undefined ? false : _props0["compact"]) && (loadError() ? <p role="alert">{loadError()}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>
            : status()?.report ? <div role="status"><p>{status().report.status === 'resolved' ? 'Issue resolved' : status().report.status === 'under_review' ? 'Issue under review' : 'Your issue report has been submitted.'}</p>{status().report.tutorIssueLabel && <p>{status().report.tutorIssueLabel}</p>}{status().report.resolution && <p>{status().report.resolution}</p>}{status().report.attendanceCorrection && <p>Attendance corrected: {status().report.attendanceCorrection}</p>}{status().report.ticketTransactionId && <p>Ticket refund recorded: {status().report.ticketTransactionId}</p>}</div> : status() && <p>{status().reason === 'cancelled' ? 'Cancelled lessons cannot be reported.'
                    : availabilityMessage()}</p>)}
    </div>
    {open() && <StudentDialog className="student-issue-report-dialog" label="Report a lesson issue" onClose={close} busy={saving()}>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <header><div><span>Step {step()} of {reason() === 'tutor' ? 3 : 2}</span><h2 id="student-issue-title"><img src="/assets/img/home-icons/issue-v1.webp" alt="" width="32" height="32"/>Report a lesson issue</h2></div><button type="button" aria-label="Close report" title="Close report" disabled={saving()} onClick={close} autofocus><X size={20}/></button></header>
        <div class="student-issue-report-body" ref={_element => body.current = _element}>
          {draftNotice() && <p role="status">{draftNotice()}</p>}
          {step() === 1 ? <><h3 tabIndex={-1}>How long were you able to study?</h3><div class="student-issue-duration-options"><button type="button" onClick={() => { setDuration('up_to_ten'); setStep(2); }}>10 minutes or less</button><button type="button" onClick={() => { setDuration('over_ten'); setStep(2); }}>More than 10 minutes</button></div></>
                : <fieldset disabled={saving()}><legend tabIndex={-1}>{step() === 3 ? 'What happened with the tutor?' : 'What went wrong during the lesson?'}</legend><div class={`student-issue-reasons${step() === 3 ? ' student-tutor-issues' : ''}`}>
              {step() === 3 ? tutorChoices().map(item => <label><input type="radio" name="tutor-issue" value={item.value} checked={tutorIssue() === item.value} onChange={() => { setTutorIssue(item.value); setError(''); }}/>{item.label}</label>)
                        : reasons.map(item => <label><input type="radio" name="lesson-issue-reason" value={item.value} checked={reason() === item.value} onChange={() => { setReason(item.value); setTutorIssue(null); setError(''); }}/>{item.label}</label>)}
            </div>{(step() === 3 || reason() !== 'tutor') && <label class="student-issue-details">Additional details ({detailsRequired() ? 'required' : 'optional'})<textarea value={details()} required={detailsRequired()} maxLength={2000} rows={4} onInput={event => setDetails(event.currentTarget.value)}/></label>}</fieldset>}
          {!available() && <p role="alert" class="student-issue-error">{availabilityMessage()}</p>}
        </div>
        <footer>{error() && <p role="alert" class="student-issue-error">{error()}</p>}{step() > 1 && <button type="button" disabled={saving()} onClick={() => { setStep(step() === 3 ? 2 : 1); setError(''); }}><ArrowLeft size={16}/>Back</button>}<button type="button" disabled={saving()} onClick={close}>Cancel</button>{step() === 2 && reason() === 'tutor' ? <button type="button" class="student-issue-submit" disabled={saving() || !available()} onClick={() => { setStep(3); setError(''); }}>Next<ArrowRight size={16}/></button> : step() > 1 && <button type="submit" class="student-issue-submit" disabled={saving() || !canSubmit()}><Send size={16}/>{saving() ? 'Submitting...' : 'Submit report'}</button>}</footer>
      </form>
    </StudentDialog>}
  </>;
}

import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { API_BASE_URL } from '../config/api';
import { TutorLessonIssueReportDialog, type TroubleDuration, type TroubleReason, type TutorStudentIssue } from './TutorLessonIssueReportDialog';
interface ReportStatus {
    startsAt: string;
    endsAt: string;
    serverNow: string;
    eligible: boolean;
    report: {
        id: string;
    } | null;
}
export default function TutorClassroomIssueReport(_props0: {
    bookingId: string;
}) {
    const [status, setStatus] = createSignal<ReportStatus | null>(null);
    const [loadError, setLoadError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [now, setNow] = createSignal(Date.now());
    const offset = { current: 0 } as {
        current: any;
    };
    const [open, setOpen] = createSignal(false);
    const [duration, setDuration] = createSignal<TroubleDuration | null>(null);
    const [reason, setReason] = createSignal<TroubleReason | null>(null);
    const [studentIssue, setStudentIssue] = createSignal<TutorStudentIssue | null>(null);
    const [saving, setSaving] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const url = createMemo(() => `${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(_props0["bookingId"])}/trouble-report`);
    createEffect(on(() => [url(), revision()], () => {
        const _cleanup1 = untrack(() => {
            const controller = new AbortController();
            fetch(url(), { credentials: 'include', cache: 'no-store', signal: controller.signal }).then(async (response) => {
                const result = await response.json();
                if (!response.ok || !result.success)
                    throw new Error(result.error || 'Could not check reporting availability.');
                if (controller.signal.aborted)
                    return;
                offset.current = Date.parse(result.data.serverNow) - Date.now();
                setStatus(result.data);
                setLoadError('');
                setNow(Date.now());
            }).catch(err => {
                if (!controller.signal.aborted)
                    setLoadError(err.message);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const clock = window.setInterval(() => setNow(Date.now()), 1000);
            const refresh = () => {
                if (!document.hidden)
                    setRevision(value => value + 1);
            };
            const poll = window.setInterval(refresh, 10000);
            window.addEventListener('focus', refresh);
            return () => { window.clearInterval(clock); window.clearInterval(poll); window.removeEventListener('focus', refresh); };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const available = createMemo(() => Boolean(status() && !status().report && !loadError() && status().eligible
        && now() + offset.current >= Date.parse(status().startsAt) && now() + offset.current < Date.parse(status().endsAt)));
    const hint = createMemo(() => status()?.report ? 'One report per lesson. Your report has been submitted.'
        : loadError() || 'Issue reports are available only during the scheduled lesson.');
    const submit = async () => {
        if (!available() || !duration() || !reason() || (reason() === 'student' && !studentIssue()) || saving())
            return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(url(), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, get body() {
                    return JSON.stringify({ get duration() {
                            return duration();
                        }, get reason() {
                            return reason();
                        }, get studentIssue() {
                            return reason() === 'student' ? studentIssue() : undefined;
                        } });
                } });
            const result = await response.json();
            if (!response.ok || !result.success)
                throw new Error(result.error || 'Could not submit the report.');
            setStatus(current => current && ({ ...current, report: result.data, eligible: false }));
            setOpen(false);
        }
        catch (err: any) {
            setError(err.message || 'Could not submit the report.');
            setRevision(value => value + 1);
        }
        finally {
            setSaving(false);
        }
    };
    return <>
    <div class="classroom-tutor-report-control">
      <button type="button" title={hint()} disabled={!available()} onClick={() => { setDuration(null); setReason(null); setStudentIssue(null); setError(null); setOpen(true); }}>
        <TutorIcon name={status()?.report ? 'fi fi-sr-check' : 'fi fi-sr-exclamation'} aria-hidden="true"/>{status()?.report ? 'Issue reported' : 'Report issue'}
      </button>
      <span role="status">{loadError() ? 'Availability unavailable' : status()?.report ? 'Report submitted' : !status() ? 'Checking availability...' : available() ? 'One report per lesson' : 'Outside lesson time'}</span>
      {loadError() && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}
    </div>
    {open() && <TutorLessonIssueReportDialog reportDuration={duration()} reportReason={reason()} reportSubmitting={saving()} reportWindowOpen={available()} reportSubmitError={error()} reportStudentIssue={studentIssue()} setReportStudentIssue={setStudentIssue} setReportDuration={setDuration} setReportReason={setReason} setReportSubmitError={setError} closeReportModal={() => {
                if (!saving())
                    setOpen(false);
            }} submitTroubleReport={submit}/>}
  </>;
}

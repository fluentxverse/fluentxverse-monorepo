import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { lessonWorkflowApi, type LessonWorkflow, type LessonSubmissionIssue } from '../api/lessonWorkflow.api';
import './LessonWorkflowStatus.css';
export default function LessonWorkflowStatus(_props0: {
    sessionId: string;
    revision?: number;
    onSubmitted?: () => void;
    onValidationError?: (issue: LessonSubmissionIssue) => void;
    unsaved?: boolean;
}) {
    const [data, setData] = createSignal<LessonWorkflow | null>(null);
    const [error, setError] = createSignal('');
    const [errorAction, setErrorAction] = createSignal<'load' | 'submit' | null>(null);
    const [saving, setSaving] = createSignal(false);
    const [refresh, setRefresh] = createSignal(0);
    const [now, setNow] = createSignal(Date.now());
    createEffect(on(() => [_props0["sessionId"], _props0["revision"] === undefined ? 0 : _props0["revision"], refresh()], () => {
        const _cleanup1 = untrack(() => {
            let cancelled = false;
            lessonWorkflowApi.get(_props0["sessionId"]).then(value => {
                if (!cancelled) {
                    setData(value);
                    setError('');
                }
            })
                .catch(() => {
                if (!cancelled) {
                    setError('Could not load lesson submission status.');
                    setErrorAction('load');
                }
            });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const timer = window.setInterval(() => setNow(Date.now()), 1000);
            const focus = () => setRefresh(value => value + 1);
            window.addEventListener('focus', focus);
            return () => { window.clearInterval(timer); window.removeEventListener('focus', focus); };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const canSubmit = createMemo(() => !(_props0["unsaved"] === undefined ? false : _props0["unsaved"]) && data() && data().notesStatus !== 'not_required' && data().notesStatus !== 'submitted'
        && now() >= Date.parse(data().endsAt) && now() < Date.parse(data().editableUntil));
    const submit = async () => {
        if (!canSubmit() || saving())
            return;
        setSaving(true);
        setError('');
        try {
            setData(await lessonWorkflowApi.submit(_props0["sessionId"]));
            _props0["onSubmitted"]?.();
        }
        catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Could not submit notes.';
            if (err.response?.status === 400 && _props0["onValidationError"]) {
                _props0["onValidationError"]({ ...err.response?.data?.validation, message });
            }
            else {
                setError(message);
                setErrorAction(err.response?.status === 400 || err.response?.status === 403 ? null : 'submit');
            }
        }
        finally {
            setSaving(false);
        }
    };
    return <div class="lesson-workflow-status">
    {data() && <><div><strong>{data().notesStatus === 'not_required' ? 'Notes not required' : data().notesStatus === 'submitted' ? 'Notes submitted' : data().notesStatus === 'changes_pending' ? 'Unsubmitted updates' : 'Draft notes'}</strong>
      <span>{data().studentAttendance === 'absent' ? 'Student absent' : data().attendanceVerified ? 'Student attendance verified' : 'Student present · Verification pending'}</span>
      {data().notesStatus !== 'not_required' && <span>{now() >= Date.parse(data().editableUntil) ? 'Update window closed' : `Submit by ${new Date(data().editableUntil).toLocaleString('en-US', { timeZone: 'Asia/Manila' })} PHT`}</span>}</div>
      {(_props0["unsaved"] === undefined ? false : _props0["unsaved"]) && <span>Save changes before submitting.</span>}
      {data().notesStatus !== 'not_required' && data().notesStatus !== 'submitted' && <button type="button" disabled={!canSubmit() || saving()} onClick={submit}><TutorIcon name="fi fi-sr-check" aria-hidden="true"/>{saving() ? 'Submitting...' : 'Submit notes & confirm attendance'}</button>}</>}
    {error() && <div class="lesson-workflow-error" role="alert"><p>{error()}</p>
      {(errorAction() === 'load' || errorAction() === 'submit') && <button type="button" disabled={saving()} onClick={() => errorAction() === 'submit' ? submit() : setRefresh(value => value + 1)}>Retry</button>}
    </div>}
  </div>;
}

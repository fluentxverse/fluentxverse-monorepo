import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import TutorArt from "./Common/TutorArt";
import TutorDialog from './Common/TutorDialog';
import './TutorLessonIssueReport.css';
export type TroubleDuration = 'up_to_ten' | 'over_ten';
export type TroubleReason = 'connection' | 'audio' | 'hardware' | 'emergency' | 'power' | 'student';
export type TutorStudentIssue = 'asked_to_cancel' | 'late';
const studentIssues: {
    value: TutorStudentIssue;
    label: string;
}[] = [
    { value: 'asked_to_cancel', label: 'Student asked to cancel' },
    { value: 'late', label: 'Student is late' }
];
const troubleReasons: {
    value: TroubleReason;
    label: string;
}[] = [
    { value: 'connection', label: 'Internet connection problem' },
    { value: 'audio', label: 'Audio or microphone problem' },
    { value: 'hardware', label: 'Device or accessory problem' },
    { value: 'emergency', label: 'Health or urgent personal matter' },
    { value: 'power', label: 'Power interruption' },
    { value: 'student', label: 'Student-related issue' }
];
interface Props {
    reportDuration: TroubleDuration | null;
    reportReason: TroubleReason | null;
    reportStudentIssue: TutorStudentIssue | null;
    setReportStudentIssue: (value: TutorStudentIssue | null) => void;
    reportSubmitting: boolean;
    reportWindowOpen: boolean;
    reportSubmitError: string | null;
    setReportDuration: (value: TroubleDuration | null) => void;
    setReportReason: (value: TroubleReason | null) => void;
    setReportSubmitError: (value: string | null) => void;
    closeReportModal: () => void;
    submitTroubleReport: () => void;
}
export function TutorLessonIssueReportDialog(_props0: Props) {
    const [studentStep, setStudentStep] = createSignal(false);
    const reportStepHeadingRef = { current: null } as {
        current: HTMLHeadingElement | null;
    };
    createEffect(on(() => [_props0["reportDuration"], studentStep()], () => {
        const _cleanup1 = untrack(() => { reportStepHeadingRef.current?.focus(); });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    return (<TutorDialog label="Report a lesson issue" className="trouble-report-dialog" onClose={_props0["closeReportModal"]} busy={_props0["reportSubmitting"]}>
          <section class="trouble-report-modal">
            <header class="trouble-report-header">
              <div>
                <span class="trouble-report-step">Step {studentStep() ? '3' : _props0["reportDuration"] ? '2' : '1'} of {_props0["reportReason"] === 'student' ? '3' : '2'}</span>
                <h2 id="trouble-report-title"><TutorArt name="issue" size={32}/>Report a Lesson Issue</h2>
              </div>
              <button type="button" class="trouble-report-close" aria-label="Close report" disabled={_props0["reportSubmitting"]} onClick={_props0["closeReportModal"]}>
                <TutorIcon name="fi fi-sr-cross" aria-hidden="true"/>
              </button>
            </header>

            <div class="trouble-report-content">
              {!_props0["reportDuration"] ? (<>
                  <h3 ref={_element => reportStepHeadingRef.current = _element} tabIndex={-1}>How long were you able to teach?</h3>
                  <div class="trouble-report-options">
                    <button type="button" disabled={_props0["reportSubmitting"]} onClick={() => _props0["setReportDuration"]('up_to_ten')}>10 minutes or less</button>
                    <button type="button" disabled={_props0["reportSubmitting"]} onClick={() => _props0["setReportDuration"]('over_ten')}>More than 10 minutes</button>
                  </div>
                </>) : studentStep() ? (<>
                  <h3 ref={_element => reportStepHeadingRef.current = _element} tabIndex={-1}>What happened with the student?</h3>
                  <div class="trouble-report-options">
                    {studentIssues.map(issue => <button type="button" disabled={_props0["reportSubmitting"]} class={_props0["reportStudentIssue"] === issue.value ? 'selected' : ''} aria-pressed={_props0["reportStudentIssue"] === issue.value} onClick={() => { _props0["setReportStudentIssue"](issue.value); _props0["setReportSubmitError"](null); }}>{issue.label}</button>)}
                  </div>
                </>) : (<>
                  <h3 ref={_element => reportStepHeadingRef.current = _element} tabIndex={-1}>What interrupted the lesson?</h3>
                  <div class="trouble-report-options trouble-report-reasons">
                    {troubleReasons.map(reason => (<button type="button" class={_props0["reportReason"] === reason.value ? 'selected' : ''} aria-pressed={_props0["reportReason"] === reason.value} disabled={_props0["reportSubmitting"]} onClick={() => { _props0["setReportReason"](reason.value); _props0["setReportStudentIssue"](null); _props0["setReportSubmitError"](null); }}>
                        {reason.label}
                      </button>))}
                  </div>
                </>)}
              {!_props0["reportWindowOpen"] && <p class="trouble-report-error" role="alert">The reporting window has closed. This report cannot be submitted.</p>}
              {_props0["reportSubmitError"] && <p class="trouble-report-error" role="alert">{_props0["reportSubmitError"]}</p>}
            </div>

            <footer class="trouble-report-actions">
              {_props0["reportDuration"] && <button type="button" class="trouble-report-back" disabled={_props0["reportSubmitting"]} onClick={() => {
                if (studentStep())
                    setStudentStep(false);
                else {
                    _props0["setReportDuration"](null);
                    _props0["setReportReason"](null);
                    _props0["setReportStudentIssue"](null);
                }
                _props0["setReportSubmitError"](null);
            }}>Back</button>}
              <button type="button" class="trouble-report-cancel" disabled={_props0["reportSubmitting"]} onClick={_props0["closeReportModal"]}>Cancel</button>
              {_props0["reportDuration"] && _props0["reportReason"] === 'student' && !studentStep()
            ? <button type="button" class="trouble-report-submit" disabled={!_props0["reportWindowOpen"] || _props0["reportSubmitting"]} onClick={() => setStudentStep(true)}>Next</button>
            : _props0["reportDuration"] && <button type="button" class="trouble-report-submit" disabled={!_props0["reportReason"] || (_props0["reportReason"] === 'student' && !_props0["reportStudentIssue"]) || !_props0["reportWindowOpen"] || _props0["reportSubmitting"]} onClick={_props0["submitTroubleReport"]}>{_props0["reportSubmitting"] ? 'Submitting...' : 'Submit Report'}</button>}
            </footer>
          </section>
        </TutorDialog>);
}

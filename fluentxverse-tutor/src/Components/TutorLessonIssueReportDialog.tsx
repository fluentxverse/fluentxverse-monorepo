import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import './TutorLessonIssueReport.css';

export type TroubleDuration = 'up_to_ten' | 'over_ten';
export type TroubleReason = 'connection' | 'audio' | 'hardware' | 'emergency' | 'power' | 'student';
export type TutorStudentIssue = 'asked_to_cancel' | 'late';
const studentIssues: { value: TutorStudentIssue; label: string }[] = [
  { value: 'asked_to_cancel', label: 'Student asked to cancel' },
  { value: 'late', label: 'Student is late' }
];

const troubleReasons: { value: TroubleReason; label: string }[] = [
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
export function TutorLessonIssueReportDialog({ reportDuration, reportReason, reportStudentIssue, setReportStudentIssue, reportSubmitting, reportWindowOpen, reportSubmitError, setReportDuration, setReportReason, setReportSubmitError, closeReportModal, submitTroubleReport }: Props) {
  const [studentStep, setStudentStep] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reportStepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  useEffect(() => { reportStepHeadingRef.current?.focus(); }, [reportDuration, studentStep]);
  return createPortal(
<dialog ref={dialogRef} className="trouble-report-dialog" aria-labelledby="trouble-report-title" onCancel={event => { event.preventDefault(); closeReportModal(); }}>
          <section className="trouble-report-modal">
            <header className="trouble-report-header">
              <div>
                <span className="trouble-report-step">Step {studentStep ? '3' : reportDuration ? '2' : '1'} of {reportReason === 'student' ? '3' : '2'}</span>
                <h2 id="trouble-report-title"><i className="fi fi-sr-exclamation" aria-hidden="true"></i>Report a Lesson Issue</h2>
              </div>
              <button type="button" className="trouble-report-close" aria-label="Close report" disabled={reportSubmitting} onClick={closeReportModal}>
                <i className="fi fi-sr-cross" aria-hidden="true"></i>
              </button>
            </header>

            <div className="trouble-report-content">
              {!reportDuration ? (
                <>
                  <h3 ref={reportStepHeadingRef} tabIndex={-1}>How long were you able to teach?</h3>
                  <div className="trouble-report-options">
                    <button type="button" disabled={reportSubmitting} onClick={() => setReportDuration('up_to_ten')}>10 minutes or less</button>
                    <button type="button" disabled={reportSubmitting} onClick={() => setReportDuration('over_ten')}>More than 10 minutes</button>
                  </div>
                </>
              ) : studentStep ? (
                <>
                  <h3 ref={reportStepHeadingRef} tabIndex={-1}>What happened with the student?</h3>
                  <div className="trouble-report-options">
                    {studentIssues.map(issue => <button key={issue.value} type="button" disabled={reportSubmitting}
                      className={reportStudentIssue === issue.value ? 'selected' : ''} aria-pressed={reportStudentIssue === issue.value}
                      onClick={() => { setReportStudentIssue(issue.value); setReportSubmitError(null); }}>{issue.label}</button>)}
                  </div>
                </>
              ) : (
                <>
                  <h3 ref={reportStepHeadingRef} tabIndex={-1}>What interrupted the lesson?</h3>
                  <div className="trouble-report-options trouble-report-reasons">
                    {troubleReasons.map(reason => (
                      <button
                        key={reason.value}
                        type="button"
                        className={reportReason === reason.value ? 'selected' : ''}
                        aria-pressed={reportReason === reason.value}
                        disabled={reportSubmitting}
                        onClick={() => { setReportReason(reason.value); setReportStudentIssue(null); setReportSubmitError(null); }}
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!reportWindowOpen && <p className="trouble-report-error" role="alert">The reporting window has closed. This report cannot be submitted.</p>}
              {reportSubmitError && <p className="trouble-report-error" role="alert">{reportSubmitError}</p>}
            </div>

            <footer className="trouble-report-actions">
              {reportDuration && <button type="button" className="trouble-report-back" disabled={reportSubmitting} onClick={() => { if (studentStep) setStudentStep(false); else { setReportDuration(null); setReportReason(null); setReportStudentIssue(null); } setReportSubmitError(null); }}>Back</button>}
              <button type="button" className="trouble-report-cancel" disabled={reportSubmitting} onClick={closeReportModal}>Cancel</button>
              {reportDuration && reportReason === 'student' && !studentStep
                ? <button key="next" type="button" className="trouble-report-submit" disabled={!reportWindowOpen || reportSubmitting} onClick={() => setStudentStep(true)}>Next</button>
                : reportDuration && <button key="submit" type="button" className="trouble-report-submit" disabled={!reportReason || (reportReason === 'student' && !reportStudentIssue) || !reportWindowOpen || reportSubmitting} onClick={submitTroubleReport}>{reportSubmitting ? 'Submitting...' : 'Submit Report'}</button>}
            </footer>
          </section>
        </dialog>
, document.body);
}

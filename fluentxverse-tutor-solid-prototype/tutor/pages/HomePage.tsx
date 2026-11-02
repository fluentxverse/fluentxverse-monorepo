import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { useLocation } from "../routing";
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { getExamStatus, getSpeakingExamStatus, type ExamStatus, type SpeakingExamStatus } from '../api/exam.api';
import './HomePage.css';
import TeachingDesk from '../Components/Dashboard/TeachingDesk';
import FirstLessonGuide from '../Components/Dashboard/FirstLessonGuide';
import StatusPanel from '../../../shared/ui/StatusPanel';
import { proofApi, type TutorCertificationProofResponse } from '../api/proof.api';
import { interviewApi, type MyInterview } from '../api/interview.api';
import { hasTeachingAccess } from '../utils/teachingAccess';
import { client } from '../api/utils';
import type { TutorIdentityRecord } from '../../../shared/tutorIdentity';
import InterviewPreparation from '../Components/InterviewPreparation';
const HomePage = () => {
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Home | FluentXVerse';
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const _state0 = useAuthContext();
    const location = useLocation();
    // Check if redirected due to certification requirement
    const [showCertificationAlert, setShowCertificationAlert] = createSignal(false);
    createEffect(on(() => location.search, search => {
        if (new URLSearchParams(search).get('certification') === 'required') setShowCertificationAlert(true);
    }));
    // Exam status state
    const [writtenStatus, setWrittenStatus] = createSignal<ExamStatus | null>(null);
    const [speakingStatus, setSpeakingStatus] = createSignal<SpeakingExamStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = createSignal(true);
    const [statusError, setStatusError] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const [teachingApproved, setTeachingApproved] = createSignal(false);
    const [approvalResolved, setApprovalResolved] = createSignal(false);
    let approvalOwner: string | undefined;
    const [interview, setInterview] = createSignal<MyInterview | null>(null);
    const [approval, setApproval] = createSignal<TutorCertificationProofResponse | null>(null);
    const [interviewError, setInterviewError] = createSignal(false);
    const [identity, setIdentity] = createSignal<TutorIdentityRecord | null>(null);
    const [identityError, setIdentityError] = createSignal(false);
    const [identityLoaded, setIdentityLoaded] = createSignal(false);
    const idAccepted = () => ['accepted', 'booked', 'verified'].includes(identity()?.status || '');
    const identityLabel = () => ({ pending_review: 'ID review pending', accepted: 'ID accepted', booked: 'Present this same ID at your interview', verified: 'Identity verified', resubmit: 'Resubmission required', expired: 'Booking window expired', fraud: 'Account unavailable. Contact support.' })[identity()?.status || ''] || 'ID submission required';
    const interviewPassed = () => interview()?.result ? interview().result === 'pass' : approval()?.snapshot.interviewPassed === true;
    createEffect(on(() => [_state0.user?.userId, revision()], () => {
        let current = true;
        let fetching = false;
        if (approvalOwner !== _state0.user?.userId) {
            approvalOwner = _state0.user?.userId;
            setApprovalResolved(false);
            setTeachingApproved(false);
            setApproval(null);
            setInterview(null);
            setIdentity(null); setIdentityLoaded(false); setIdentityError(false);
            setInterviewError(false);
            setWrittenStatus(null);
            setSpeakingStatus(null);
            setLoadingStatus(true);
            setStatusError(false);
        }
        if (!_state0.user?.userId) return;
        const refresh = async () => {
            if (fetching) return;
            fetching = true;
            try {
                const [result, booking] = await Promise.all([proofApi.getTutorCertificationStatus(), interviewApi.getMyBooking()]);
                if (!current) return;
                const snapshot = result?.snapshot;
                if (!snapshot || !Array.isArray(snapshot.missingRequirements) ||
                    [snapshot.writtenPassed, snapshot.speakingPassed, snapshot.profileApproved, snapshot.interviewPassed].some(value => typeof value !== 'boolean')) {
                    throw new Error('Application status unavailable');
                }
                setApproval(result);
                setInterview(booking);
                const approved = hasTeachingAccess(result) && booking?.result !== 'fail';
                if (!approved && teachingApproved()) {
                    setWrittenStatus(null);
                    setSpeakingStatus(null);
                    setLoadingStatus(true);
                }
                setTeachingApproved(approved);
                setApprovalResolved(true);
                setInterviewError(false);
                try {
                    const response = await client.get('/tutor-identity/status');
                    if (!current) return;
                    if (!response.data.success) throw Error('Identity status unavailable');
                    setIdentity(response.data.data.record); setIdentityLoaded(true); setIdentityError(false);
                } catch { if (current) setIdentityError(true); }
            } catch {
                if (current) setInterviewError(true);
            } finally { fetching = false; }
        };
        void refresh();
        const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
        const onWake = () => { if (!document.hidden) void refresh(); };
        window.addEventListener('focus', onWake);
        document.addEventListener('visibilitychange', onWake);
        onCleanup(() => {
            current = false; window.clearInterval(timer);
            window.removeEventListener('focus', onWake);
            document.removeEventListener('visibilitychange', onWake);
        });
    }));
    // Calculate active step based on exam status
    const getActiveStep = () => {
        if (teachingApproved()) return 4;
        if (interviewPassed()) return 3;
        if (!writtenStatus() || !speakingStatus())
            return 1;
        const bothPassed = writtenStatus().passed === true && speakingStatus().passed === true;
        if (bothPassed)
            return 2; // Move to onboarding
        return 1; // Still on assessment
    };
    const activeStep = createMemo(getActiveStep);
    // Fetch exam statuses on mount
    createEffect(on(() => [_state0.user?.userId, revision(), approvalResolved(), teachingApproved()], () => {
        const _cleanup3 = untrack(() => {
            let active = true;
            let poll: ReturnType<typeof setTimeout> | undefined;
            if (!approvalResolved() || teachingApproved()) return;
            const fetchExamStatus = async () => {
                if (!_state0.user?.userId)
                    return;
                if (!writtenStatus()) setLoadingStatus(true);
                setStatusError(false);
                try {
                    const [writtenRes, speakingRes] = await Promise.all([
                        getExamStatus(_state0.user.userId),
                        getSpeakingExamStatus(_state0.user.userId),
                    ]);
                    if (!active) return;
                    if (!writtenRes.success || !speakingRes.success || !writtenRes.status || !speakingRes.status) throw new Error('Assessment status unavailable');
                    if (writtenRes.success && writtenRes.status) {
                        setWrittenStatus(writtenRes.status);
                    }
                    if (speakingRes.success && speakingRes.status) {
                        setSpeakingStatus(speakingRes.status);
                        if (speakingRes.status.isProcessing) poll = setTimeout(fetchExamStatus, 5000);
                    }
                }
                catch (err) {
                    if (active) setStatusError(true);
                }
                finally {
                    if (active) setLoadingStatus(false);
                }
            };
            fetchExamStatus();
            return () => { active = false; clearTimeout(poll); };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const handleTakeWrittenTest = () => {
        location.route('/exam/written');
    };
    const handleTakeSpeakingTest = () => {
        location.route('/exam/speaking');
    };
    const homeReady = createMemo(() => approvalResolved() && (teachingApproved() || !loadingStatus()));
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <main class="home-page-container">
          <div class="container">
            {interviewError() && <StatusPanel kind="error" title="Could not refresh application status" message={approvalResolved() ? 'Your last confirmed home view is unchanged. Please try again.' : 'Please try again to load your application status.'} onRetry={() => setRevision(value => value + 1)}/>}
            {!homeReady() && !interviewError() && <div class="home-status-placeholder" role="status" aria-label="Loading home" aria-busy="true">
              <div class="home-status-placeholder-heading"/>
              <div class="home-status-placeholder-shortcuts"><span/><span/><span/></div>
              <div class="home-status-placeholder-body"/>
            </div>}
            {homeReady() && <>
            {/* Certification Required Alert */}
            {showCertificationAlert() && !teachingApproved() && (<div class="certification-alert" role="alert">
                <div class="certification-alert-icon">
                  <TutorIcon name="fas fa-lock"/>
                </div>
                <div class="certification-alert-content">
                  <strong>Certification Required</strong>
                  <span>Complete the written and speaking assessments, profile approval, and interview before accessing teaching features.</span>
                </div>
                <button class="certification-alert-close" aria-label="Dismiss certification warning" onClick={() => { setShowCertificationAlert(false); location.route('/home', true); }}>
                  <TutorIcon name="fas fa-times"/>
                </button>
              </div>)}

            {/* Application Status Header */}
            <div class="page-title-row">
              <div class="page-title-icon">
                <TutorArt name="home" size={48}/>
              </div>
              <h2 class="page-title-gradient">{teachingApproved() ? `Welcome back, ${_state0.user?.firstName || "Tutor"}` : "Your teaching journey"}</h2>
            </div>

            {teachingApproved() && <><nav class="tutor-home-shortcuts" aria-label="Teaching workspace">{([{ href: "/schedule", art: "schedule", title: "My schedule" }, { href: "/materials", art: "training", title: "Learning materials" }, { href: "/performance-metrics", art: "growth", title: "Performance metrics" }] as const).map(item => <a href={item.href}><TutorArt name={item.art} size={44}/><span>{item.title}</span><TutorIcon name="fa-arrow-right"/></a>)}</nav><FirstLessonGuide/><TeachingDesk/></>}
            {!teachingApproved() && statusError() && <StatusPanel kind="error" title="Could not refresh assessment progress" onRetry={() => setRevision(value => value + 1)}/>}
            {/* Main Status Card */}
            {!teachingApproved() && (!statusError() || (writtenStatus() && speakingStatus())) && <div class="main-status-card">
              {/* Progress Steps */}
              <div class="progress-steps">
                {/* Progress Line - hidden on mobile via CSS */}
                <div class="progress-line">
                  <div class="progress-line-fill" style={cssStyle({ get width() { return `${(activeStep() - 1) / 3 * 100}%`; } })}></div>
                </div>

                {/* Step 1 */}
                <div class="progress-step">
                  <div class={`progress-step-number ${activeStep() >= 1 ? 'is-active' : 'is-inactive'}`}>1</div>
                  <div class={`progress-step-copy ${activeStep() >= 1 ? 'is-active' : 'is-inactive'}`}>
                    <div class="progress-step-label">SKILLS</div>
                    <div class="progress-step-label">ASSESSMENT</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div class="progress-step">
                  <div class={`progress-step-number ${activeStep() >= 2 ? 'is-active' : 'is-inactive'}`}>2</div>
                  <div class={`progress-step-copy ${activeStep() >= 2 ? 'is-active' : 'is-inactive'}`}>
                    <div class="progress-step-label">ID &amp; INTERVIEW</div>
                  </div>
                </div>

                {/* Step 3 */}
                <div class="progress-step">
                  <div class={`progress-step-number ${activeStep() >= 3 ? 'is-active' : 'is-inactive'}`}>3</div>
                  <div class={`progress-step-copy ${activeStep() >= 3 ? 'is-active' : 'is-inactive'}`}>
                    <div class="progress-step-label">PROFILE</div>
                    <div class="progress-step-label">COMPLETION</div>
                  </div>
                </div>
                <div class="progress-step">
                  <div class={`progress-step-number ${activeStep() >= 4 ? 'is-active' : 'is-inactive'}`}>4</div>
                  <div class={`progress-step-copy ${activeStep() >= 4 ? 'is-active' : 'is-inactive'}`}>
                    <div class="progress-step-label">SCHEDULE SETUP</div>
                  </div>
                </div>
              </div>

              <p class="status-description">
                To join FluentXVerse as an English tutor, you need to complete the following assessment levels:
              </p>

              {/* English Proficiency Section */}
              <div class="assessment-section">
                <h3 class="section-title">
                  ENGLISH PROFICIENCY TEST
                </h3>

                {/* Written Test */}
                <div class={`test-card ${writtenStatus()?.passed === true ? 'passed' : writtenStatus()?.passed === false ? 'failed' : ''}`}>
                  <div class="test-icon test-icon--artwork">
                    <TutorArt name="writtenTest" size={44}/>
                  </div>
                  <div class="test-content">
                    <div class="test-header">
                      <h4>WRITTEN TEST</h4>
                      {!loadingStatus() && writtenStatus() && (<span class={`test-status-badge ${writtenStatus().passed === true ? 'passed' : writtenStatus().passed === false ? 'failed' : 'pending'}`}>
                          {writtenStatus().passed === true ? '✓ PASSED' : writtenStatus().passed === false ? '✗ FAILED' : 'NOT TAKEN'}
                          {typeof writtenStatus().percentage === 'number' && ` (${Math.round(writtenStatus().percentage)}%)`}
                        </span>)}
                    </div>
                    <p>
                      A comprehensive assessment covering grammar, vocabulary, reading comprehension, and teaching methodology. Each exam is uniquely generated for every applicant.
                    </p>
                    {!loadingStatus() && writtenStatus() && writtenStatus().passed !== true && (<p class="attempts-info">
                        <TutorIcon name="fas fa-info-circle"/> {writtenStatus().attemptsThisMonth}/{writtenStatus().maxAttemptsPerMonth} attempts used in 30 days
                      </p>)}
                  </div>
                  {writtenStatus()?.passed !== true && (<button class="test-action-btn" onClick={handleTakeWrittenTest} disabled={(writtenStatus()?.attemptsThisMonth ?? 0) >= (writtenStatus()?.maxAttemptsPerMonth ?? 2)}>
                      {writtenStatus()?.hasActiveExam ? 'RESUME' : writtenStatus()?.passed === false ? 'RETAKE' : 'TAKE TEST'} <TutorIcon name="fas fa-arrow-right"/>
                    </button>)}
                  {writtenStatus()?.passed === true && (<div class="test-complete-badge">
                      <TutorIcon name="fas fa-check-circle"/>
                      COMPLETE
                    </div>)}
                </div>

                {/* Speaking Test */}
                <div class={`test-card ${typeof speakingStatus()?.passed === 'boolean' || speakingStatus()?.isProcessing ? 'processing' : ''}`}>
                  <div class="test-icon test-icon--artwork">
                    <TutorArt name="speakingTest" size={44}/>
                  </div>
                  <div class="test-content">
                    <div class="test-header">
                      <h4>SPEAKING TEST</h4>
                      {!loadingStatus() && speakingStatus() && (<span class={`test-status-badge ${typeof speakingStatus().passed === 'boolean' || speakingStatus().isProcessing ? 'processing' : 'pending'}`}>
                          {speakingStatus().isProcessing ? 'PROCESSING' : speakingStatus().gradingFailed ? 'REVIEW NEEDED' : typeof speakingStatus().passed === 'boolean' ? 'PROVISIONAL AI SCORE' : 'NOT TAKEN'}
                          {typeof speakingStatus().percentage === 'number' && ` (${Math.round(speakingStatus().percentage)}%)`}
                        </span>)}
                    </div>
                    <p>
                      {speakingStatus()?.isProcessing
            ? 'Your saved recordings are being graded. Your result will appear here when ready.'
            : speakingStatus()?.gradingFailed ? 'Grading paused. Your recordings are saved and this has not deducted an exam attempt.'
            : 'AI content scores are provisional, not a final application decision. Pronunciation, delivery, and teaching readiness require human review.'}
                    </p>
                    {!loadingStatus() && speakingStatus() && speakingStatus().passed !== true && !speakingStatus().isProcessing && (<p class="attempts-info">
                        <TutorIcon name="fas fa-info-circle"/> {speakingStatus().attemptsThisMonth}/{speakingStatus().maxAttemptsPerMonth} attempts used in 30 days
                      </p>)}
                  </div>
                  {speakingStatus()?.passed !== true && !speakingStatus()?.isProcessing && (<button class="test-action-btn secondary" onClick={handleTakeSpeakingTest} disabled={writtenStatus()?.passed !== true || (speakingStatus()?.attemptsThisMonth ?? 0) >= (speakingStatus()?.maxAttemptsPerMonth ?? 2)}>
                      {writtenStatus()?.passed !== true ? 'WRITTEN PASS REQUIRED' : speakingStatus()?.gradingFailed ? 'REVIEW' : speakingStatus()?.hasActiveExam ? 'RESUME' : speakingStatus()?.passed === false ? 'RETAKE' : 'TAKE TEST'} <TutorIcon name="fas fa-arrow-right"/>
                    </button>)}
                  {speakingStatus()?.isProcessing && (<div class="test-processing-badge">
                      <TutorIcon name="fas fa-hourglass-half"/>
                      GRADING...
                    </div>)}
                  {speakingStatus()?.passed === true && (<div class="test-complete-badge">
                      <TutorIcon name="fas fa-check-circle"/>
                      CONTENT THRESHOLD MET
                    </div>)}
                </div>
              </div>

              {/* Interview Section */}
              <div class="assessment-section" style={cssStyle({ marginTop: '28px' })}>
                <h3 class="section-title">
                  IDENTITY &amp; INTERVIEW
                </h3>

                <div class="test-card home-identity-step">
                  <div class="test-icon test-icon--artwork"><TutorArt name="privacy" size={48}/></div>
                  <div class="test-content"><div class="test-header"><h4>ID SUBMISSION</h4></div>
                    <span class="identity-home-status" role="status">{identityError() ? 'Identity status could not be refreshed.' : !identityLoaded() ? 'Checking identity status...' : identityLabel()}</span>
                    <p>{!speakingStatus()?.passed ? 'Complete both assessments, then submit one accepted ID for staff review.' : idAccepted() ? 'Keep the same submitted document ready to present during your video interview.' : identity()?.status === 'pending_review' ? 'Your ID is with the recruitment team. Interview booking opens after staff accepts it.' : 'Your assessments are complete. Next, upload a readable ID for staff review before booking your interview.'}</p>
                    {identity()?.status === 'accepted' && <p>Book within 84 hours of ID acceptance. Deadline: {new Date(identity()!.bookingDeadline!).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila).</p>}
                    <a class="action-btn blue" href="/interview">{identity()?.status === 'pending_review' ? 'VIEW ID SUBMISSION' : idAccepted() ? 'ID & INTERVIEW DETAILS' : 'SUBMIT YOUR ID'}</a>
                  </div>
                </div>

                <div class={`test-card ${interviewPassed() ? 'passed' : interview()?.result === 'fail' ? 'failed' : ''}`} role="status" aria-label="Interview result">
                  <div class="test-icon test-icon--artwork"><TutorArt name="schedule" size={44}/></div>
                  <div class="test-content">
                    <div class="test-header">
                      <h4>INTERVIEW RESULT</h4>
                      <span class={`test-status-badge ${interviewPassed() ? 'passed' : interview()?.result === 'fail' ? 'failed' : 'pending'}`}>
                        {interviewPassed() ? 'PASSED' : interview()?.result === 'fail' ? 'NOT PASSED' : interview()?.status === 'completed' || interview()?.mediaClosed ? 'PENDING REVIEW' : interview() ? 'SCHEDULED' : 'NOT SCHEDULED'}
                      </span>
                    </div>
                    <p>{interviewPassed()
                      ? approval()?.snapshot.profileApproved ? 'Your interview and profile are approved.' : approval()?.snapshot.profileStatus === 'pending_review' ? 'You passed your interview. Your profile is awaiting review.' : 'You passed your interview. Next: complete your profile for review.'
                      : interview()?.result === 'fail' ? 'Your interview was not passed. Contact support for feedback and next steps.'
                      : interview()?.status === 'completed' || interview()?.mediaClosed ? 'Your interview has ended. The recruitment team has not saved a decision yet.'
                      : interview() ? `Your interview is scheduled for ${interview().date} at ${interview().time} (Manila time).` : 'After both assessments, submit your ID for acceptance before booking an interview.'}</p>
                    {interviewPassed() && !approval()?.snapshot.profileApproved && <a class="action-btn blue" href="/application/profile">{approval()?.snapshot.profileStatus === 'pending_review' ? 'VIEW APPLICATION PROFILE' : 'COMPLETE YOUR PROFILE'}</a>}
                  </div>
                </div>

                {/* Contact Verification */}
                <div class="test-card">
                  <div class="test-icon test-icon--artwork">
                    <TutorArt name="contactCheck" size={44}/>
                  </div>
                  <div class="test-content">
                    <p>
                      Ensure your contact number is correct and you have a messaging app (Viber, WhatsApp, or Telegram) for interview coordination.
                    </p>
                    <p class="secondary-text">
                      Update your contact details here: <a href={teachingApproved() ? '/profile' : '/application/profile'}>{teachingApproved() ? 'My Profile' : 'Application Profile'}</a>
                    </p>
                  </div>
                </div>

                {approval() !== null && !interviewPassed() && <InterviewPreparation compact/>}

                {/* Book Schedule */}
                {!interviewPassed() && <div class="test-card">
                  <div class="test-icon test-icon--artwork">
                    <TutorArt name="schedule" size={44}/>
                  </div>
                  <div class="test-content">
                    <p>
                      {idAccepted() ? 'Your ID is accepted. Choose an available interview within your booking window. Times are shown in Manila time.' : 'Interview booking becomes available after staff accepts your ID. You can prepare with the guide above while you wait.'}
                    </p>
                    <button class="action-btn green" disabled={!writtenStatus()?.passed || !speakingStatus()?.passed || !idAccepted() || identityError()} onClick={() => location.route('/interview')}>
                      BOOK A SCHEDULE
                    </button>
                  </div>
                </div>}
              </div>
            </div>}
            </>}
          </div>
        </main>
      </div>
    </>);
};
export default HomePage;

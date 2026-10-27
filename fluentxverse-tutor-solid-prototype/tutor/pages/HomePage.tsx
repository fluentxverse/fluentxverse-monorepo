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
import StatusPanel from '../../../shared/ui/StatusPanel';
import { proofApi } from '../api/proof.api';
import { hasTeachingAccess } from '../utils/teachingAccess';
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
    createEffect(on(() => [_state0.user?.userId, revision()], () => {
        let current = true;
        onCleanup(() => { current = false; });
        setTeachingApproved(false);
        if (!_state0.user?.userId) return;
        void proofApi.getTutorCertificationStatus().then(result => {
            if (current) setTeachingApproved(hasTeachingAccess(result));
        }).catch(() => { /* Keep teaching widgets locked when approval cannot be verified. */ });
    }));
    // Calculate active step based on exam status
    const getActiveStep = () => {
        if (!writtenStatus() || !speakingStatus())
            return 1;
        const bothPassed = writtenStatus().passed === true && speakingStatus().passed === true;
        if (bothPassed)
            return 2; // Move to onboarding
        return 1; // Still on assessment
    };
    const activeStep = createMemo(getActiveStep);
    // Fetch exam statuses on mount
    createEffect(on(() => [_state0.user?.userId, revision()], () => {
        const _cleanup3 = untrack(() => {
            let active = true;
            let poll: ReturnType<typeof setTimeout> | undefined;
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
                    if (!writtenRes.success || !speakingRes.success) throw new Error('Assessment status unavailable');
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
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <main class="home-page-container">
          <div class="container">
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

            {teachingApproved() && <><nav class="tutor-home-shortcuts" aria-label="Teaching workspace">{([{ href: "/schedule", art: "schedule", title: "My schedule" }, { href: "/materials", art: "training", title: "Learning materials" }, { href: "/performance-metrics", art: "growth", title: "Performance metrics" }] as const).map(item => <a href={item.href}><TutorArt name={item.art} size={44}/><span>{item.title}</span><TutorIcon name="fa-arrow-right"/></a>)}</nav><TeachingDesk/></>}
            {statusError() && <StatusPanel kind="error" title="Could not refresh assessment progress" onRetry={() => setRevision(value => value + 1)}/>}
            {/* Main Status Card */}
            <div class="main-status-card">
              {/* Progress Steps */}
              <div class="progress-steps">
                {/* Progress Line - hidden on mobile via CSS */}
                <div class="progress-line">
                  <div class="progress-line-fill" style={cssStyle({ get width() { return activeStep() >= 2 ? '50%' : '0%'; } })}></div>
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
                    <div class="progress-step-label">ONBOARDING &</div>
                    <div class="progress-step-label">PROFILE</div>
                  </div>
                </div>

                {/* Step 3 */}
                <div class="progress-step">
                  <div class={`progress-step-number ${activeStep() >= 3 ? 'is-active' : 'is-inactive'}`}>3</div>
                  <div class={`progress-step-copy ${activeStep() >= 3 ? 'is-active' : 'is-inactive'}`}>
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
                  <div class="test-icon" style={cssStyle({
            get background() {
                return writtenStatus()?.passed === true
                    ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                    : writtenStatus()?.passed === false
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)';
            }
        })}>
                    <TutorIcon name={`fas ${writtenStatus()?.passed === true ? 'fa-check' : writtenStatus()?.passed === false ? 'fa-times' : 'fa-pen'}`}/>
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
                  <div class="test-icon" style={cssStyle({
            get background() {
                return speakingStatus()?.isProcessing
                            ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                            : 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)';
            }
        })}>
                    <TutorIcon name={`fas ${speakingStatus()?.isProcessing ? 'fa-spinner fa-spin' : 'fa-microphone'}`}/>
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
                  INTERVIEW
                </h3>

                {/* Contact Verification */}
                <div class="test-card">
                  <div class="test-icon" style={cssStyle({ background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' })}>
                    <TutorIcon name="fas fa-check-circle"/>
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

                {/* Interview Guide */}
                <div class="test-card">
                  <div class="test-icon" style={cssStyle({ background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' })}>
                    <TutorIcon name="fas fa-book-open"/>
                  </div>
                  <div class="test-content">
                    <p>
                      Review our interview guide to learn what to expect and how to showcase your teaching skills.
                    </p>
                    <button class="action-btn blue" onClick={() => location.route('/become-tutor')}>
                      INTERVIEW GUIDE
                    </button>
                  </div>
                </div>

                {/* Book Schedule */}
                <div class="test-card">
                  <div class="test-icon" style={cssStyle({ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' })}>
                    <TutorIcon name="fas fa-calendar-check"/>
                  </div>
                  <div class="test-content">
                    <p>
                      Choose a convenient time for your interview with our recruitment team.
                    </p>
                    <button class="action-btn green" disabled={!writtenStatus()?.passed || !speakingStatus()?.passed} onClick={() => location.route('/interview')}>
                      BOOK A SCHEDULE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>);
};
export default HomePage;

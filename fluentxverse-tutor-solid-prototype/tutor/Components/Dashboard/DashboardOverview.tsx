import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import TutorArt from "../Common/TutorArt";
import { useLocation } from "../../routing";
import { useAuthContext } from '../../context/AuthContext';
import { getExamStatus, getSpeakingExamStatus, type ExamStatus, type SpeakingExamStatus } from '../../api/exam.api';
import { interviewApi, type MyInterview } from '../../api/interview.api';
import { proofApi, type TutorCertificationProofResponse } from '../../api/proof.api';
import './DashboardOverview.css';
interface ProgressData {
    writtenExam: {
        status: 'not_started' | 'in_progress' | 'passed' | 'failed';
        score: number | null;
        attempts: number;
        maxAttempts: number;
    };
    speakingExam: {
        status: 'not_started' | 'in_progress' | 'processing' | 'passed' | 'failed';
        score: number | null;
        attempts: number;
        maxAttempts: number;
    };
    interview: {
        status: 'not_scheduled' | 'scheduled' | 'completed' | 'passed' | 'failed';
        date: string | null;
        time: string | null;
    };
}
const DashboardOverview = () => {
    const _state0 = useAuthContext();
    const location = useLocation();
    const [loading, setLoading] = createSignal(true);
    const [writtenStatus, setWrittenStatus] = createSignal<ExamStatus | null>(null);
    const [speakingStatus, setSpeakingStatus] = createSignal<SpeakingExamStatus | null>(null);
    const [interview, setInterview] = createSignal<MyInterview | null>(null);
    const [proofStatus, setProofStatus] = createSignal<TutorCertificationProofResponse | null>(null);
    createEffect(on(() => [_state0.user?.userId], () => {
        const _cleanup1 = untrack(() => {
            let disposed = false;
            let poll: ReturnType<typeof setTimeout> | undefined;
            const fetchData = async () => {
                if (!_state0.user?.userId)
                    return;
                try {
                    const [writtenRes, speakingRes, interviewRes, proofRes] = await Promise.all([
                        getExamStatus(_state0.user.userId),
                        getSpeakingExamStatus(_state0.user.userId),
                        interviewApi.getMyBooking().catch(() => null),
                        proofApi.getTutorCertificationStatus().catch(() => null)
                    ]);
                    if (disposed) return;
                    if (writtenRes.success && writtenRes.status) {
                        setWrittenStatus(writtenRes.status);
                    }
                    if (speakingRes.success && speakingRes.status) {
                        setSpeakingStatus(speakingRes.status);
                    }
                    setInterview(interviewRes);
                    setProofStatus(proofRes);
                    if (speakingRes.status?.isProcessing) poll = setTimeout(fetchData, 5000);
                }
                catch (err) {
                    console.error('Failed to fetch dashboard data:', err);
                }
                finally {
                    setLoading(false);
                }
            };
            fetchData();
            return () => { disposed = true; clearTimeout(poll); };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    // Calculate progress percentage
    const getProgressPercentage = () => {
        let progress = 0;
        if (writtenStatus()?.passed)
            progress += 33;
        if (speakingStatus()?.passed)
            progress += 33;
        if (proofStatus()?.snapshot.interviewPassed || interview()?.result === 'pass')
            progress += 34;
        return progress;
    };
    // Get certification status text
    const getCertificationStatus = () => {
        const missing = proofStatus()?.snapshot.missingRequirements || [];
        const allPassed = Boolean(proofStatus()) && missing.length === 0;
        if (allPassed)
            return { text: 'Application approved', color: '#10b981' };
        if (speakingStatus()?.isProcessing)
            return { text: 'Speaking Assessment Processing', color: '#3b82f6' };
        if (speakingStatus()?.passed && writtenStatus()?.passed)
            return { text: interview()?.result === 'pass' || proofStatus()?.snapshot.interviewPassed ? 'Profile Review Pending' : 'Interview Pending', color: '#f59e0b' };
        if (writtenStatus()?.passed)
            return { text: 'Speaking Exam Pending', color: '#3b82f6' };
        return { text: 'In Progress', color: '#94a3b8' };
    };
    const getProofBadge = () => {
        const status = proofStatus()?.credential.status || 'requirements_incomplete';
        if (['retired', 'expired', 'revoked'].includes(status))
            return { label: status.toUpperCase(), className: 'processing' };
        if (status === 'verified')
            return { label: 'ZK VERIFIED', className: 'passed' };
        if (status === 'local_proof_generated')
            return { label: 'LOCAL PROOF', className: 'passed' };
        if (status === 'submitted')
            return { label: 'SUBMITTED', className: 'processing' };
        if (status === 'ready_for_proving')
            return { label: 'READY', className: 'passed' };
        if (status === 'failed')
            return { label: 'FAILED', className: 'failed' };
        return { label: 'INCOMPLETE', className: 'pending' };
    };
    const certStatus = createMemo(getCertificationStatus);
    const progressPercent = createMemo(getProgressPercentage);
    return createMemo(() => {
        if (loading()) {
            return (<div class="dashboard-overview loading">
        <div class="loading-spinner">
          <TutorIcon name="fas fa-spinner fa-spin"/>
          <p>Loading your dashboard...</p>
        </div>
      </div>);
        }
        return (<div class="dashboard-overview">
      {/* Welcome Section */}
      <div class="welcome-section">
        <div class="welcome-text">
          <h1>Welcome back, {_state0.user?.firstName || 'Tutor'}! 👋</h1>
          <p>Track your certification progress and upcoming tasks.</p>
        </div>
        <div class="certification-badge" style={cssStyle({ borderColor: certStatus().color })}>
          <span class="badge-status" style={cssStyle({ color: certStatus().color })}>{certStatus().text}</span>
        </div>
      </div>

      {/* Progress Overview */}
      <div class="progress-overview">
        <div class="progress-header">
          <h2><TutorArt name="certificate" size={32}/> Certification Progress</h2>
          <span class="progress-percent">{progressPercent()}%</span>
        </div>

        {/* Progress Ring */}
        <div class="progress-ring-container">
          <svg viewBox="0 0 100 100" class="progress-ring">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" stroke-width="8"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#progressGradient)" stroke-width="8" stroke-dasharray={`${progressPercent() * 2.64} 264`} stroke-dashoffset="66" stroke-linecap="round" transform="rotate(-90 50 50)"/>
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="progress-ring-inner">
            <span class="progress-value">{progressPercent()}%</span>
            <span class="progress-label">Complete</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div class="progress-steps">
          <div class={`progress-step ${writtenStatus()?.passed ? 'completed' : writtenStatus()?.passed === false ? 'failed' : ''}`}>
            <div class="step-icon">
              {writtenStatus()?.passed ? <TutorIcon name="fas fa-check"/> :
                writtenStatus()?.passed === false ? <TutorIcon name="fas fa-times"/> :
                    <span>1</span>}
            </div>
            <div class="step-info">
              <span class="step-title">Written Exam</span>
              <span class="step-status">
                {writtenStatus()?.passed ? `Passed (${Math.round(writtenStatus().percentage || 0)}%)` :
                writtenStatus()?.passed === false ? 'Failed' : 'Not taken'}
              </span>
            </div>
          </div>

          <div class="step-connector"></div>

          <div class={`progress-step ${typeof speakingStatus()?.passed === 'boolean' || speakingStatus()?.isProcessing ? 'processing' : ''}`}>
            <div class="step-icon">
              {typeof speakingStatus()?.passed === 'boolean' ? <TutorIcon name="fas fa-microphone"/> :
                speakingStatus()?.isProcessing ? <TutorIcon name="fas fa-spinner fa-spin"/> :
                        <span>2</span>}
            </div>
            <div class="step-info">
              <span class="step-title">Speaking Exam</span>
              <span class="step-status">
                {speakingStatus()?.isProcessing ? 'Processing...' :
                    typeof speakingStatus()?.passed === 'boolean' ? `Provisional AI score (${Math.round(speakingStatus().percentage || 0)}%)` : 'Not taken'}
              </span>
            </div>
          </div>

          <div class="step-connector"></div>

          <div class={`progress-step ${proofStatus()?.snapshot.interviewPassed || interview()?.result === 'pass' ? 'completed' : interview() ? 'scheduled' : ''}`}>
            <div class="step-icon">
              {proofStatus()?.snapshot.interviewPassed || interview()?.result === 'pass' ? <TutorIcon name="fas fa-check"/> : <span>3</span>}
            </div>
            <div class="step-info">
              <span class="step-title">Interview</span>
              <span class="step-status">
                {proofStatus()?.snapshot.interviewPassed || interview()?.result === 'pass' ? 'Passed' :
                interview() ? `Scheduled: ${interview().date} ${interview().time}` : 'Not scheduled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div class="stats-cards">
        <div class="stat-card written">
          <div class="stat-card-icon">
            <TutorIcon name="fas fa-pen"/>
          </div>
          <div class="stat-card-content">
            <h3>Written Exam</h3>
            <div class="stat-score">
              {typeof writtenStatus()?.passed === 'boolean' ? (<>
                  <span class={`score-badge ${writtenStatus().passed ? 'passed' : 'failed'}`}>
                    {writtenStatus().passed ? 'PASSED' : 'FAILED'}
                  </span>
                  {writtenStatus().percentage !== null && (<span class="score-percent">{Math.round(writtenStatus().percentage)}%</span>)}
                </>) : (<span class="score-badge pending">NOT TAKEN</span>)}
            </div>
            <div class="stat-attempts">
              <TutorIcon name="fas fa-redo"/>
              {writtenStatus()?.attemptsThisMonth || 0}/{writtenStatus()?.maxAttemptsPerMonth || 2} attempts in 30 days
            </div>
          </div>
          {!writtenStatus()?.passed && (<button class="stat-action" onClick={() => location.route('/exam/written')}>
              {writtenStatus()?.hasActiveExam ? 'Resume' : 'Take Exam'}
              <TutorIcon name="fas fa-arrow-right"/>
            </button>)}
        </div>

        <div class="stat-card speaking">
          <div class="stat-card-icon">
            <TutorIcon name="fas fa-microphone"/>
          </div>
          <div class="stat-card-content">
            <h3>Speaking Exam</h3>
            <div class="stat-score">
              {speakingStatus()?.isProcessing ? (<span class="score-badge processing">PROCESSING</span>) : speakingStatus()?.gradingFailed ? (<span class="score-badge processing">REVIEW NEEDED</span>) : typeof speakingStatus()?.passed === 'boolean' ? (<>
                  <span class="score-badge processing">
                    PROVISIONAL AI SCORE
                  </span>
                  {speakingStatus().percentage !== null && (<span class="score-percent">{Math.round(speakingStatus().percentage)}%</span>)}
                </>) : (<span class="score-badge pending">NOT TAKEN</span>)}
            </div>
            <p>Human review is required for a final application decision.</p>
            <div class="stat-attempts">
              <TutorIcon name="fas fa-redo"/>
              {speakingStatus()?.attemptsThisMonth || 0}/{speakingStatus()?.maxAttemptsPerMonth || 2} attempts in 30 days
            </div>
          </div>
          {!speakingStatus()?.passed && !speakingStatus()?.isProcessing && (<button class="stat-action" disabled={!writtenStatus()?.passed} onClick={() => location.route('/exam/speaking')}>
              {!writtenStatus()?.passed ? 'Written pass required' : speakingStatus()?.gradingFailed ? 'Review' : speakingStatus()?.hasActiveExam ? 'Resume' : 'Take Exam'}
              <TutorIcon name="fas fa-arrow-right"/>
            </button>)}
        </div>

        <div class="stat-card interview">
          <div class="stat-card-icon">
            <TutorIcon name="fas fa-video"/>
          </div>
          <div class="stat-card-content">
            <h3>Interview</h3>
            <div class="stat-score">
              {proofStatus()?.snapshot.interviewPassed || interview()?.result === 'pass' ? (<span class="score-badge passed">PASSED</span>) : interview() ? (<span class="score-badge scheduled">SCHEDULED</span>) : (<span class="score-badge pending">NOT SCHEDULED</span>)}
            </div>
            {interview() && interview().status !== 'completed' && (<div class="interview-datetime">
                <TutorIcon name="fas fa-calendar"/>
                {interview().date} at {interview().time}
              </div>)}
          </div>
          {!interview() && writtenStatus()?.passed && speakingStatus()?.passed && (<button class="stat-action" onClick={() => location.route('/interview')}>
              Book Interview
              <TutorIcon name="fas fa-arrow-right"/>
            </button>)}
          {interview() && interview().status !== 'completed' && (<button class="stat-action" onClick={() => location.route(`/interview/room/${interview().id}`)}>
              View Details
              <TutorIcon name="fas fa-arrow-right"/>
            </button>)}
        </div>

        <div class="stat-card zk-proof">
          <div class="stat-card-icon">
            <TutorIcon name="fas fa-shield-alt"/>
          </div>
          <div class="stat-card-content">
            <h3>ZK Certification</h3>
            <div class="stat-score">
              <span class={`score-badge ${getProofBadge().className}`}>
                {getProofBadge().label}
              </span>
            </div>
            <div class="stat-attempts">
              <TutorIcon name="fas fa-fingerprint"/>
              {proofStatus()?.credential.credentialCommitment
                ? `${proofStatus().credential.credentialCommitment.slice(0, 18)}...`
                : `${proofStatus()?.snapshot.missingRequirements.length || 0} requirements remaining`}
            </div>
          </div>
          {proofStatus()?.credential.status === 'requirements_incomplete' && (<button class="stat-action" onClick={() => proofApi.maybeIssueTutorCertification().then(setProofStatus).catch(console.error)}>
              Recheck
              <TutorIcon name="fas fa-sync"/>
            </button>)}
        </div>
      </div>

      {/* Quick Actions */}
      <div class="quick-actions">
        <h2><TutorIcon name="fa-bolt"/> Quick Actions</h2>
        <div class="actions-grid">
          <a href="/profile" class="action-card">
            <div class="action-icon profile">
              <TutorIcon name="fas fa-user-edit"/>
            </div>
            <span>Edit Profile</span>
          </a>
          <a href="/schedule" class="action-card">
            <div class="action-icon schedule">
              <TutorIcon name="fas fa-calendar-alt"/>
            </div>
            <span>My Schedule</span>
          </a>
          <a href="/notifications" class="action-card">
            <div class="action-icon notifications">
              <TutorIcon name="fas fa-bell"/>
            </div>
            <span>Notifications</span>
          </a>
          <a href="/help" class="action-card">
            <div class="action-icon help">
              <TutorIcon name="fas fa-question-circle"/>
            </div>
            <span>Help Center</span>
          </a>
        </div>
      </div>
    </div>);
    }) as unknown as JSX.Element;
};
export default DashboardOverview;

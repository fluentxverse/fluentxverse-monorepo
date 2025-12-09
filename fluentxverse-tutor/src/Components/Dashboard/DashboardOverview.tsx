import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../../context/AuthContext';
import { getExamStatus, getSpeakingExamStatus, type ExamStatus, type SpeakingExamStatus } from '../../api/exam.api';
import { interviewApi, type MyInterview } from '../../api/interview.api';
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
  const { user } = useAuthContext();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [writtenStatus, setWrittenStatus] = useState<ExamStatus | null>(null);
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingExamStatus | null>(null);
  const [interview, setInterview] = useState<MyInterview | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.userId) return;
      
      setLoading(true);
      try {
        const [writtenRes, speakingRes, interviewRes] = await Promise.all([
          getExamStatus(user.userId),
          getSpeakingExamStatus(user.userId),
          interviewApi.getMyBooking().catch(() => null)
        ]);
        
        if (writtenRes.success && writtenRes.status) {
          setWrittenStatus(writtenRes.status);
        }
        if (speakingRes.success && speakingRes.status) {
          setSpeakingStatus(speakingRes.status);
        }
        setInterview(interviewRes);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.userId]);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    let progress = 0;
    if (writtenStatus?.passed) progress += 33;
    if (speakingStatus?.passed) progress += 33;
    if (interview?.status === 'completed') progress += 34;
    return progress;
  };

  // Get certification status text
  const getCertificationStatus = () => {
    const allPassed = writtenStatus?.passed && speakingStatus?.passed && interview?.status === 'completed';
    if (allPassed) return { text: 'Certified', color: '#10b981' };
    if (speakingStatus?.passed && writtenStatus?.passed) return { text: 'Interview Pending', color: '#f59e0b' };
    if (writtenStatus?.passed) return { text: 'Speaking Exam Pending', color: '#3b82f6' };
    return { text: 'In Progress', color: '#94a3b8' };
  };

  const certStatus = getCertificationStatus();
  const progressPercent = getProgressPercentage();

  if (loading) {
    return (
      <div className="dashboard-overview loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h1>Welcome back, {user?.firstName || 'Tutor'}! 👋</h1>
          <p>Track your certification progress and upcoming tasks.</p>
        </div>
        <div className="certification-badge" style={{ borderColor: certStatus.color }}>
          <span className="badge-status" style={{ color: certStatus.color }}>{certStatus.text}</span>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="progress-overview">
        <div className="progress-header">
          <h2><i className="fas fa-chart-line"></i> Certification Progress</h2>
          <span className="progress-percent">{progressPercent}%</span>
        </div>
        
        {/* Progress Ring */}
        <div className="progress-ring-container">
          <svg viewBox="0 0 100 100" className="progress-ring">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r="42" fill="none" 
              stroke="url(#progressGradient)" strokeWidth="8"
              strokeDasharray={`${progressPercent * 2.64} 264`}
              strokeDashoffset="66"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div className="progress-ring-inner">
            <span className="progress-value">{progressPercent}%</span>
            <span className="progress-label">Complete</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`progress-step ${writtenStatus?.passed ? 'completed' : writtenStatus?.passed === false ? 'failed' : ''}`}>
            <div className="step-icon">
              {writtenStatus?.passed ? <i className="fas fa-check"></i> : 
               writtenStatus?.passed === false ? <i className="fas fa-times"></i> : 
               <span>1</span>}
            </div>
            <div className="step-info">
              <span className="step-title">Written Exam</span>
              <span className="step-status">
                {writtenStatus?.passed ? `Passed (${Math.round(writtenStatus.percentage || 0)}%)` : 
                 writtenStatus?.passed === false ? 'Failed' : 'Not taken'}
              </span>
            </div>
          </div>
          
          <div className="step-connector"></div>
          
          <div className={`progress-step ${speakingStatus?.passed ? 'completed' : speakingStatus?.isProcessing ? 'processing' : speakingStatus?.passed === false ? 'failed' : ''}`}>
            <div className="step-icon">
              {speakingStatus?.passed ? <i className="fas fa-check"></i> : 
               speakingStatus?.isProcessing ? <i className="fas fa-spinner fa-spin"></i> :
               speakingStatus?.passed === false ? <i className="fas fa-times"></i> : 
               <span>2</span>}
            </div>
            <div className="step-info">
              <span className="step-title">Speaking Exam</span>
              <span className="step-status">
                {speakingStatus?.passed ? `Passed (${Math.round(speakingStatus.percentage || 0)}%)` : 
                 speakingStatus?.isProcessing ? 'Processing...' :
                 speakingStatus?.passed === false ? 'Failed' : 'Not taken'}
              </span>
            </div>
          </div>
          
          <div className="step-connector"></div>
          
          <div className={`progress-step ${interview?.status === 'completed' ? 'completed' : interview ? 'scheduled' : ''}`}>
            <div className="step-icon">
              {interview?.status === 'completed' ? <i className="fas fa-check"></i> : <span>3</span>}
            </div>
            <div className="step-info">
              <span className="step-title">Interview</span>
              <span className="step-status">
                {interview?.status === 'completed' ? 'Completed' : 
                 interview ? `Scheduled: ${interview.date} ${interview.time}` : 'Not scheduled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card written">
          <div className="stat-card-icon">
            <i className="fas fa-pen"></i>
          </div>
          <div className="stat-card-content">
            <h3>Written Exam</h3>
            <div className="stat-score">
              {writtenStatus?.passed !== undefined ? (
                <>
                  <span className={`score-badge ${writtenStatus.passed ? 'passed' : 'failed'}`}>
                    {writtenStatus.passed ? 'PASSED' : 'FAILED'}
                  </span>
                  {writtenStatus.percentage !== null && (
                    <span className="score-percent">{Math.round(writtenStatus.percentage)}%</span>
                  )}
                </>
              ) : (
                <span className="score-badge pending">NOT TAKEN</span>
              )}
            </div>
            <div className="stat-attempts">
              <i className="fas fa-redo"></i>
              {writtenStatus?.attemptsThisMonth || 0}/{writtenStatus?.maxAttemptsPerMonth || 2} attempts this month
            </div>
          </div>
          {!writtenStatus?.passed && (
            <button className="stat-action" onClick={() => location.route('/exam/written')}>
              {writtenStatus?.hasActiveExam ? 'Resume' : 'Take Exam'}
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
        </div>

        <div className="stat-card speaking">
          <div className="stat-card-icon">
            <i className="fas fa-microphone"></i>
          </div>
          <div className="stat-card-content">
            <h3>Speaking Exam</h3>
            <div className="stat-score">
              {speakingStatus?.isProcessing ? (
                <span className="score-badge processing">PROCESSING</span>
              ) : speakingStatus?.passed !== undefined ? (
                <>
                  <span className={`score-badge ${speakingStatus.passed ? 'passed' : 'failed'}`}>
                    {speakingStatus.passed ? 'PASSED' : 'FAILED'}
                  </span>
                  {speakingStatus.percentage !== null && (
                    <span className="score-percent">{Math.round(speakingStatus.percentage)}%</span>
                  )}
                </>
              ) : (
                <span className="score-badge pending">NOT TAKEN</span>
              )}
            </div>
            <div className="stat-attempts">
              <i className="fas fa-redo"></i>
              {speakingStatus?.attemptsThisMonth || 0}/{speakingStatus?.maxAttemptsPerMonth || 2} attempts this month
            </div>
          </div>
          {!speakingStatus?.passed && !speakingStatus?.isProcessing && (
            <button className="stat-action" onClick={() => location.route('/exam/speaking')}>
              {speakingStatus?.hasActiveExam ? 'Resume' : 'Take Exam'}
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
        </div>

        <div className="stat-card interview">
          <div className="stat-card-icon">
            <i className="fas fa-video"></i>
          </div>
          <div className="stat-card-content">
            <h3>Interview</h3>
            <div className="stat-score">
              {interview?.status === 'completed' ? (
                <span className="score-badge passed">COMPLETED</span>
              ) : interview ? (
                <span className="score-badge scheduled">SCHEDULED</span>
              ) : (
                <span className="score-badge pending">NOT SCHEDULED</span>
              )}
            </div>
            {interview && interview.status !== 'completed' && (
              <div className="interview-datetime">
                <i className="fas fa-calendar"></i>
                {interview.date} at {interview.time}
              </div>
            )}
          </div>
          {!interview && writtenStatus?.passed && speakingStatus?.passed && (
            <button className="stat-action" onClick={() => location.route('/interview')}>
              Book Interview
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
          {interview && interview.status !== 'completed' && (
            <button className="stat-action" onClick={() => location.route(`/interview/room/${interview.id}`)}>
              View Details
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2><i className="fas fa-bolt"></i> Quick Actions</h2>
        <div className="actions-grid">
          <a href="/profile" className="action-card">
            <div className="action-icon profile">
              <i className="fas fa-user-edit"></i>
            </div>
            <span>Edit Profile</span>
          </a>
          <a href="/schedule" className="action-card">
            <div className="action-icon schedule">
              <i className="fas fa-calendar-alt"></i>
            </div>
            <span>My Schedule</span>
          </a>
          <a href="/notifications" className="action-card">
            <div className="action-icon notifications">
              <i className="fas fa-bell"></i>
            </div>
            <span>Notifications</span>
          </a>
          <a href="/help" className="action-card">
            <div className="action-icon help">
              <i className="fas fa-question-circle"></i>
            </div>
            <span>Help Center</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;

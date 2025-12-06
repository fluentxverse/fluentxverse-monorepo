import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { getExamStatus, getSpeakingExamStatus, type ExamStatus, type SpeakingExamStatus } from '../api/exam.api';
import './HomePage.css';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Home | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const location = useLocation();
  
  // Exam status state
  const [writtenStatus, setWrittenStatus] = useState<ExamStatus | null>(null);
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingExamStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Calculate active step based on exam status
  const getActiveStep = () => {
    if (!writtenStatus || !speakingStatus) return 1;
    const bothPassed = writtenStatus.passed === true && speakingStatus.passed === true;
    if (bothPassed) return 2; // Move to onboarding
    return 1; // Still on assessment
  };
  
  const activeStep = getActiveStep();

  // Fetch exam statuses on mount
  useEffect(() => {
    const fetchExamStatus = async () => {
      if (!user?.userId) return;
      
      setLoadingStatus(true);
      try {
        const [writtenRes, speakingRes] = await Promise.all([
          getExamStatus(user.userId),
          getSpeakingExamStatus(user.userId),
        ]);
        
        if (writtenRes.success && writtenRes.status) {
          setWrittenStatus(writtenRes.status);
        }
        if (speakingRes.success && speakingRes.status) {
          setSpeakingStatus(speakingRes.status);
        }
      } catch (err) {
        console.error('Failed to fetch exam status:', err);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchExamStatus();
  }, [user?.userId]);

  const handleTakeWrittenTest = () => {
    location.route('/exam/written');
  };

  const handleTakeSpeakingTest = () => {
    location.route('/exam/speaking');
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="home-page-container">
          <div className="container">
            {/* Notification Banner */}
            <div className="notification-banner">
              <div className="notification-icon">
                <i className="fas fa-bell"></i>
              </div>
              <div className="notification-content">
                <div className="notification-title">
                  PLATFORM UPDATE
                </div>
                <div className="notification-text">
                  We're continuously improving our tutor scheduling and availability features to give you more flexibility.
                </div>
              </div>
              <button className="notification-btn">
                <i className="fas fa-inbox"></i>
                View Inbox
              </button>
            </div>

            {/* Application Status Header */}
            <div className="status-header">
              <div className="status-header-icon">
                <i className="fas fa-tasks"></i>
              </div>
              <h2 className="status-header-title">
                APPLICATION STATUS
              </h2>
            </div>

            {/* Main Status Card */}
            <div className="main-status-card">
              {/* Progress Steps */}
              <div className="progress-steps">
                {/* Progress Line - hidden on mobile via CSS */}
                <div className="progress-line" style={{
                  position: 'absolute',
                  top: '28px',
                  left: '12%',
                  right: '12%',
                  height: '4px',
                  background: 'rgba(2, 69, 174, 0.1)',
                  borderRadius: '2px',
                  zIndex: 0
                }}>
                  <div style={{
                    height: '100%',
                    width: activeStep >= 2 ? '50%' : '0%',
                    background: 'linear-gradient(90deg, #0245ae 0%, #4a9eff 100%)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease',
                    boxShadow: '0 2px 8px rgba(2, 69, 174, 0.3)'
                  }}></div>
                </div>

                {/* Step 1 */}
                <div className="progress-step">
                  <div className="progress-step-number" style={{ 
                    background: activeStep >= 1 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    boxShadow: activeStep >= 1 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>1</div>
                  <div>
                    <div className="progress-step-label" style={{ color: '#0245ae' }}>SKILLS</div>
                    <div className="progress-step-label" style={{ color: '#0245ae' }}>ASSESSMENT</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="progress-step">
                  <div className="progress-step-number" style={{ 
                    background: activeStep >= 2 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    boxShadow: activeStep >= 2 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>2</div>
                  <div>
                    <div className="progress-step-label" style={{ color: activeStep >= 2 ? '#0245ae' : '#94a3b8' }}>ONBOARDING &</div>
                    <div className="progress-step-label" style={{ color: activeStep >= 2 ? '#0245ae' : '#94a3b8' }}>PROFILE</div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="progress-step">
                  <div className="progress-step-number" style={{ 
                    background: activeStep >= 3 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    boxShadow: activeStep >= 3 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>3</div>
                  <div>
                    <div className="progress-step-label" style={{ color: activeStep >= 3 ? '#0245ae' : '#94a3b8' }}>SCHEDULE SETUP</div>
                  </div>
                </div>
              </div>

              <p className="status-description">
                To join FluentXVerse as an English tutor, you need to complete the following assessment levels:
              </p>

              {/* English Proficiency Section */}
              <div className="assessment-section">
                <h3 className="section-title">
                  ENGLISH PROFICIENCY TEST
                </h3>

                {/* Written Test */}
                <div className={`test-card ${writtenStatus?.passed === true ? 'passed' : writtenStatus?.passed === false ? 'failed' : ''}`}>
                  <div className="test-icon" style={{ 
                    background: writtenStatus?.passed === true 
                      ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' 
                      : writtenStatus?.passed === false
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' 
                  }}>
                    <i className={`fas ${writtenStatus?.passed === true ? 'fa-check' : writtenStatus?.passed === false ? 'fa-times' : 'fa-pen'}`}></i>
                  </div>
                  <div className="test-content">
                    <div className="test-header">
                      <h4>WRITTEN TEST</h4>
                      {!loadingStatus && writtenStatus && (
                        <span className={`test-status-badge ${writtenStatus.passed === true ? 'passed' : writtenStatus.passed === false ? 'failed' : 'pending'}`}>
                          {writtenStatus.passed === true ? '✓ PASSED' : writtenStatus.passed === false ? '✗ FAILED' : 'NOT TAKEN'}
                          {writtenStatus.percentage !== null && ` (${Math.round(writtenStatus.percentage)}%)`}
                        </span>
                      )}
                    </div>
                    <p>
                      A comprehensive assessment covering grammar, vocabulary, reading comprehension, and teaching methodology. Each exam is uniquely generated for every applicant. <a href="#">Learn more..</a>
                    </p>
                    {!loadingStatus && writtenStatus && writtenStatus.passed !== true && (
                      <p className="attempts-info">
                        <i className="fas fa-info-circle"></i> {writtenStatus.attemptsThisMonth}/{writtenStatus.maxAttemptsPerMonth} attempts used this month
                      </p>
                    )}
                  </div>
                  {writtenStatus?.passed !== true && (
                    <button 
                      className="test-action-btn" 
                      onClick={handleTakeWrittenTest}
                      disabled={(writtenStatus?.attemptsThisMonth ?? 0) >= (writtenStatus?.maxAttemptsPerMonth ?? 2)}
                    >
                      {writtenStatus?.hasActiveExam ? 'RESUME' : writtenStatus?.passed === false ? 'RETAKE' : 'TAKE TEST'} <i className="fas fa-arrow-right"></i>
                    </button>
                  )}
                  {writtenStatus?.passed === true && (
                    <div className="test-complete-badge">
                      <i className="fas fa-check-circle"></i>
                      COMPLETE
                    </div>
                  )}
                </div>

                {/* Speaking Test */}
                <div className={`test-card ${speakingStatus?.passed === true ? 'passed' : speakingStatus?.passed === false ? 'failed' : ''}`}>
                  <div className="test-icon" style={{ 
                    background: speakingStatus?.passed === true 
                      ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' 
                      : speakingStatus?.passed === false
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' 
                  }}>
                    <i className={`fas ${speakingStatus?.passed === true ? 'fa-check' : speakingStatus?.passed === false ? 'fa-times' : 'fa-microphone'}`}></i>
                  </div>
                  <div className="test-content">
                    <div className="test-header">
                      <h4>SPEAKING TEST</h4>
                      {!loadingStatus && speakingStatus && (
                        <span className={`test-status-badge ${speakingStatus.passed === true ? 'passed' : speakingStatus.passed === false ? 'failed' : 'pending'}`}>
                          {speakingStatus.passed === true ? '✓ PASSED' : speakingStatus.passed === false ? '✗ FAILED' : 'NOT TAKEN'}
                          {speakingStatus.percentage !== null && ` (${Math.round(speakingStatus.percentage)}%)`}
                        </span>
                      )}
                    </div>
                    <p>
                      An assessment to evaluate your pronunciation teaching ability, fluency, and conversational coaching skills. <a href="#">Learn more..</a>
                    </p>
                    {!loadingStatus && speakingStatus && speakingStatus.passed !== true && (
                      <p className="attempts-info">
                        <i className="fas fa-info-circle"></i> {speakingStatus.attemptsThisMonth}/{speakingStatus.maxAttemptsPerMonth} attempts used this month
                      </p>
                    )}
                  </div>
                  {speakingStatus?.passed !== true && (
                    <button 
                      className="test-action-btn secondary" 
                      onClick={handleTakeSpeakingTest}
                      disabled={(speakingStatus?.attemptsThisMonth ?? 0) >= (speakingStatus?.maxAttemptsPerMonth ?? 2)}
                    >
                      {speakingStatus?.hasActiveExam ? 'RESUME' : speakingStatus?.passed === false ? 'RETAKE' : 'TAKE TEST'} <i className="fas fa-arrow-right"></i>
                    </button>
                  )}
                  {speakingStatus?.passed === true && (
                    <div className="test-complete-badge">
                      <i className="fas fa-check-circle"></i>
                      COMPLETE
                    </div>
                  )}
                </div>
              </div>

              {/* Interview Section */}
              <div className="assessment-section" style={{ marginTop: '28px' }}>
                <h3 className="section-title">
                  INTERVIEW
                </h3>

                {/* Contact Verification */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' }}>
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="test-content">
                    <p>
                      Ensure your contact number is correct and you have a messaging app (Viber, WhatsApp, or Telegram) for interview coordination.
                    </p>
                    <p className="secondary-text">
                      Update your contact details here: <a href="#">My Profile</a>
                    </p>
                  </div>
                </div>

                {/* Interview Guide */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' }}>
                    <i className="fas fa-book-open"></i>
                  </div>
                  <div className="test-content">
                    <p>
                      Review our interview guide to learn what to expect and how to showcase your teaching skills.
                    </p>
                    <button className="action-btn blue">
                      INTERVIEW GUIDE
                    </button>
                  </div>
                </div>

                {/* Book Schedule */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <i className="fas fa-calendar-check"></i>
                  </div>
                  <div className="test-content">
                    <p>
                      Choose a convenient time for your interview with our recruitment team.
                    </p>
                    <button className="action-btn green">
                      BOOK A SCHEDULE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default HomePage;

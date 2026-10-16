import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
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
  
  // Check if redirected due to certification requirement
  const [showCertificationAlert, setShowCertificationAlert] = useState(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('certification') === 'required') {
      setShowCertificationAlert(true);
      // Clean up URL
      window.history.replaceState({}, '', '/home');
      // Auto-hide after 5 seconds
      setTimeout(() => setShowCertificationAlert(false), 5000);
    }
  }, []);
  
  // Exam status state
  const [writtenStatus, setWrittenStatus] = useState<ExamStatus | null>(null);
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingExamStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Test accounts that bypass certification requirements
  const TEST_ACCOUNTS = ['paulanthonyarriola@gmail.com'];
  const isTestAccount = user?.email && TEST_ACCOUNTS.includes(user.email);

  // Calculate active step based on exam status
  const getActiveStep = () => {
    // Test accounts always show as certified
    if (isTestAccount) return 2;
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
        <DashboardHeader user={user || undefined} />
        <main className="home-page-container">
          <div className="container">
            {/* Certification Required Alert */}
            {showCertificationAlert && (
              <div className="certification-alert">
                <div className="certification-alert-icon">
                  <TutorIcon name="fas fa-lock" />
                </div>
                <div className="certification-alert-content">
                  <strong>Certification Required</strong>
                  <span>You must complete both the written and speaking exams before accessing that feature.</span>
                </div>
                <button className="certification-alert-close" onClick={() => setShowCertificationAlert(false)}>
                  <TutorIcon name="fas fa-times" />
                </button>
              </div>
            )}

            {/* Application Status Header */}
            <div className="page-title-row">
              <div className="page-title-icon">
                <TutorArt name="home" size={48} />
              </div>
              <h2 className="page-title-gradient">{activeStep >= 2 ? `Welcome back, ${user?.firstName || "Tutor"}` : "Your teaching journey"}</h2>
            </div>

            {activeStep >= 2 && <nav className="tutor-home-shortcuts" aria-label="Teaching workspace">{([{ href: "/schedule", art: "schedule", title: "My schedule" }, { href: "/materials", art: "training", title: "Learning materials" }, { href: "/performance-metrics", art: "growth", title: "Performance metrics" }] as const).map(item => <a href={item.href} key={item.href}><TutorArt name={item.art} size={44} /><span>{item.title}</span><TutorIcon name="fa-arrow-right" /></a>)}</nav>}
            {/* Main Status Card */}
            <div className="main-status-card">
              {/* Progress Steps */}
              <div className="progress-steps">
                {/* Progress Line - hidden on mobile via CSS */}
                <div className="progress-line">
                  <div
                    className="progress-line-fill"
                    style={{ width: activeStep >= 2 ? '50%' : '0%' }}
                  ></div>
                </div>

                {/* Step 1 */}
                <div className="progress-step">
                  <div className={`progress-step-number ${activeStep >= 1 ? 'is-active' : 'is-inactive'}`}>1</div>
                  <div className={`progress-step-copy ${activeStep >= 1 ? 'is-active' : 'is-inactive'}`}>
                    <div className="progress-step-label">SKILLS</div>
                    <div className="progress-step-label">ASSESSMENT</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="progress-step">
                  <div className={`progress-step-number ${activeStep >= 2 ? 'is-active' : 'is-inactive'}`}>2</div>
                  <div className={`progress-step-copy ${activeStep >= 2 ? 'is-active' : 'is-inactive'}`}>
                    <div className="progress-step-label">ONBOARDING &</div>
                    <div className="progress-step-label">PROFILE</div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="progress-step">
                  <div className={`progress-step-number ${activeStep >= 3 ? 'is-active' : 'is-inactive'}`}>3</div>
                  <div className={`progress-step-copy ${activeStep >= 3 ? 'is-active' : 'is-inactive'}`}>
                    <div className="progress-step-label">SCHEDULE SETUP</div>
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
                    <TutorIcon name={`fas ${writtenStatus?.passed === true ? 'fa-check' : writtenStatus?.passed === false ? 'fa-times' : 'fa-pen'}`} />
                  </div>
                  <div className="test-content">
                    <div className="test-header">
                      <h4>WRITTEN TEST</h4>
                      {!loadingStatus && writtenStatus && (
                        <span className={`test-status-badge ${writtenStatus.passed === true ? 'passed' : writtenStatus.passed === false ? 'failed' : 'pending'}`}>
                          {writtenStatus.passed === true ? '✓ PASSED' : writtenStatus.passed === false ? '✗ FAILED' : 'NOT TAKEN'}
                          {typeof writtenStatus.percentage === 'number' && ` (${Math.round(writtenStatus.percentage)}%)`}
                        </span>
                      )}
                    </div>
                    <p>
                      A comprehensive assessment covering grammar, vocabulary, reading comprehension, and teaching methodology. Each exam is uniquely generated for every applicant.
                    </p>
                    {!loadingStatus && writtenStatus && writtenStatus.passed !== true && (
                      <p className="attempts-info">
                        <TutorIcon name="fas fa-info-circle" /> {writtenStatus.attemptsThisMonth}/{writtenStatus.maxAttemptsPerMonth} attempts used this month
                      </p>
                    )}
                  </div>
                  {writtenStatus?.passed !== true && (
                    <button 
                      className="test-action-btn" 
                      onClick={handleTakeWrittenTest}
                      disabled={(writtenStatus?.attemptsThisMonth ?? 0) >= (writtenStatus?.maxAttemptsPerMonth ?? 2)}
                    >
                      {writtenStatus?.hasActiveExam ? 'RESUME' : writtenStatus?.passed === false ? 'RETAKE' : 'TAKE TEST'} <TutorIcon name="fas fa-arrow-right" />
                    </button>
                  )}
                  {writtenStatus?.passed === true && (
                    <div className="test-complete-badge">
                      <TutorIcon name="fas fa-check-circle" />
                      COMPLETE
                    </div>
                  )}
                </div>

                {/* Speaking Test */}
                <div className={`test-card ${speakingStatus?.passed === true ? 'passed' : speakingStatus?.passed === false ? 'failed' : speakingStatus?.isProcessing ? 'processing' : ''}`}>
                  <div className="test-icon" style={{ 
                    background: speakingStatus?.passed === true 
                      ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' 
                      : speakingStatus?.passed === false
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : speakingStatus?.isProcessing
                          ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                          : 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' 
                  }}>
                    <TutorIcon name={`fas ${speakingStatus?.passed === true ? 'fa-check' : speakingStatus?.passed === false ? 'fa-times' : speakingStatus?.isProcessing ? 'fa-spinner fa-spin' : 'fa-microphone'}`} />
                  </div>
                  <div className="test-content">
                    <div className="test-header">
                      <h4>SPEAKING TEST</h4>
                      {!loadingStatus && speakingStatus && (
                        <span className={`test-status-badge ${speakingStatus.passed === true ? 'passed' : speakingStatus.passed === false ? 'failed' : speakingStatus.isProcessing ? 'processing' : 'pending'}`}>
                          {speakingStatus.passed === true ? '✓ PASSED' : speakingStatus.passed === false ? '✗ FAILED' : speakingStatus.isProcessing ? '⏳ PROCESSING' : 'NOT TAKEN'}
                          {typeof speakingStatus.percentage === 'number' && ` (${Math.round(speakingStatus.percentage)}%)`}
                        </span>
                      )}
                    </div>
                    <p>
                      {speakingStatus?.isProcessing 
                        ? 'Your exam is being graded. This may take a few minutes. Please refresh the page to check for results.'
                        : 'An assessment to evaluate your pronunciation teaching ability, fluency, and conversational coaching skills.'
                      }
                    </p>
                    {!loadingStatus && speakingStatus && speakingStatus.passed !== true && !speakingStatus.isProcessing && (
                      <p className="attempts-info">
                        <TutorIcon name="fas fa-info-circle" /> {speakingStatus.attemptsThisMonth}/{speakingStatus.maxAttemptsPerMonth} attempts used this month
                      </p>
                    )}
                  </div>
                  {speakingStatus?.passed !== true && !speakingStatus?.isProcessing && (
                    <button 
                      className="test-action-btn secondary" 
                      onClick={handleTakeSpeakingTest}
                      disabled={(speakingStatus?.attemptsThisMonth ?? 0) >= (speakingStatus?.maxAttemptsPerMonth ?? 2)}
                    >
                      {speakingStatus?.hasActiveExam ? 'RESUME' : speakingStatus?.passed === false ? 'RETAKE' : 'TAKE TEST'} <TutorIcon name="fas fa-arrow-right" />
                    </button>
                  )}
                  {speakingStatus?.isProcessing && (
                    <div className="test-processing-badge">
                      <TutorIcon name="fas fa-hourglass-half" />
                      GRADING...
                    </div>
                  )}
                  {speakingStatus?.passed === true && (
                    <div className="test-complete-badge">
                      <TutorIcon name="fas fa-check-circle" />
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
                    <TutorIcon name="fas fa-check-circle" />
                  </div>
                  <div className="test-content">
                    <p>
                      Ensure your contact number is correct and you have a messaging app (Viber, WhatsApp, or Telegram) for interview coordination.
                    </p>
                    <p className="secondary-text">
                      Update your contact details here: <a href="/profile">My Profile</a>
                    </p>
                  </div>
                </div>

                {/* Interview Guide */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' }}>
                    <TutorIcon name="fas fa-book-open" />
                  </div>
                  <div className="test-content">
                    <p>
                      Review our interview guide to learn what to expect and how to showcase your teaching skills.
                    </p>
                    <button className="action-btn blue" onClick={() => location.route('/become-tutor')}>
                      INTERVIEW GUIDE
                    </button>
                  </div>
                </div>

                {/* Book Schedule */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <TutorIcon name="fas fa-calendar-check" />
                  </div>
                  <div className="test-content">
                    <p>
                      Choose a convenient time for your interview with our recruitment team.
                    </p>
                    <button className="action-btn green" onClick={() => location.route('/interview')}>
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

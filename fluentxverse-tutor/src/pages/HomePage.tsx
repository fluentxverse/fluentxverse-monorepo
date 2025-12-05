import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Home | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [activeStep] = useState(1); // User is on step 1: Skills Assessment

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
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' }}>
                    <i className="fas fa-pen"></i>
                  </div>
                  <div className="test-content">
                    <h4>WRITTEN TEST</h4>
                    <p>
                      A comprehensive assessment covering grammar, vocabulary, reading comprehension, and writing skills to evaluate your English proficiency. <a href="#">Learn more..</a>
                    </p>
                  </div>
                  <div className="test-status done">
                    DONE <i className="fas fa-check-circle"></i>
                  </div>
                </div>

                {/* Speaking Test */}
                <div className="test-card">
                  <div className="test-icon" style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)' }}>
                    <i className="fas fa-microphone"></i>
                  </div>
                  <div className="test-content">
                    <h4>SPEAKING TEST</h4>
                    <p>
                      An oral assessment to evaluate your pronunciation, fluency, and conversational abilities in English. <a href="#">Learn more..</a>
                    </p>
                    <div className="exam-code">
                      Use this exam code when you begin: <strong>FXV2025</strong>
                    </div>
                  </div>
                </div>

                <button className="take-test-btn">
                  TAKE THE TEST
                </button>
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

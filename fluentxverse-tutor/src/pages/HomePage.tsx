import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';

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
        <main style={{ padding: '40px 0', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
          <div className="container">
            {/* Notification Banner */}
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(10px)',
              padding: '20px 28px', 
              borderRadius: '16px', 
              marginBottom: '36px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 20px rgba(2, 69, 174, 0.1)',
              border: '1px solid rgba(2, 69, 174, 0.1)'
            }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '16px', 
                background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)'
              }}>
                <i className="fas fa-bell" style={{ color: '#fff', fontSize: '24px' }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0245ae', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  PLATFORM UPDATE
                </div>
                <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                  We're continuously improving our tutor scheduling and availability features to give you more flexibility.
                </div>
              </div>
              <button style={{ 
                background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)', 
                color: '#fff', 
                border: 'none', 
                padding: '12px 24px', 
                borderRadius: '12px', 
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                transition: 'transform 0.2s ease'
              }}>
                <i className="fas fa-inbox"></i>
                View Inbox
              </button>
            </div>

            {/* Application Status Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '14px', 
              marginBottom: '28px' 
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)'
              }}>
                <i className="fas fa-tasks" style={{ color: '#fff', fontSize: '22px' }}></i>
              </div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '32px', 
                fontWeight: 800, 
                background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '0.5px'
              }}>
                APPLICATION STATUS
              </h2>
            </div>

            {/* Main Status Card */}
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(10px)',
              borderRadius: '24px', 
              padding: '40px', 
              boxShadow: '0 8px 32px rgba(2, 69, 174, 0.12)',
              marginBottom: '36px',
              border: '1px solid rgba(2, 69, 174, 0.08)'
            }}>
              {/* Progress Steps */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '56px',
                position: 'relative'
              }}>
                {/* Progress Line */}
                <div style={{
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
                <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '16px', 
                    background: activeStep >= 1 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 800,
                    marginBottom: '16px',
                    transition: 'all 0.3s ease',
                    boxShadow: activeStep >= 1 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>1</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0245ae', letterSpacing: '0.5px' }}>SKILLS</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0245ae', letterSpacing: '0.5px' }}>ASSESSMENT</div>
                </div>

                {/* Step 2 */}
                <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '16px', 
                    background: activeStep >= 2 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 800,
                    marginBottom: '16px',
                    transition: 'all 0.3s ease',
                    boxShadow: activeStep >= 2 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>2</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: activeStep >= 2 ? '#0245ae' : '#94a3b8', letterSpacing: '0.5px' }}>ONBOARDING &</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: activeStep >= 2 ? '#0245ae' : '#94a3b8', letterSpacing: '0.5px' }}>PROFILE</div>
                </div>

                {/* Step 3 */}
                <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '16px', 
                    background: activeStep >= 3 ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : '#e2e8f0',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 800,
                    marginBottom: '16px',
                    transition: 'all 0.3s ease',
                    boxShadow: activeStep >= 3 ? '0 4px 16px rgba(2, 69, 174, 0.4)' : 'none'
                  }}>3</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: activeStep >= 3 ? '#0245ae' : '#94a3b8', letterSpacing: '0.5px' }}>SCHEDULE SETUP</div>
                </div>
              </div>

              <p style={{ fontSize: '15px', color: '#475569', marginBottom: '40px', lineHeight: '1.6', textAlign: 'center', fontWeight: 500 }}>
                To join FluentXVerse as an English tutor, you need to complete the following assessment levels:
              </p>

              {/* English Proficiency Section */}
              <div style={{ 
                background: 'rgba(248, 250, 252, 0.6)', 
                backdropFilter: 'blur(8px)',
                padding: '32px', 
                borderRadius: '20px',
                marginBottom: '28px',
                border: '1px solid rgba(2, 69, 174, 0.08)'
              }}>
                <h3 style={{ 
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '18px', 
                  fontWeight: 800, 
                  marginBottom: '28px',
                  textAlign: 'center',
                  letterSpacing: '1px'
                }}>
                  ENGLISH PROFICIENCY TEST
                </h3>

                {/* Written Test */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(8px)',
                  padding: '24px', 
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)',
                  border: '1px solid rgba(2, 69, 174, 0.08)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '18px', 
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(2, 69, 174, 0.3)'
                  }}>
                    <i className="fas fa-pen" style={{ color: '#fff', fontSize: '30px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '19px', fontWeight: 800, color: '#0f172a' }}>WRITTEN TEST</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
                      A comprehensive assessment covering grammar, vocabulary, reading comprehension, and writing skills to evaluate your English proficiency. <a href="#" style={{ color: '#0245ae', fontWeight: 600 }}>Learn more..</a>
                    </p>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                    color: '#fff', 
                    padding: '10px 20px', 
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    letterSpacing: '0.5px'
                  }}>
                    DONE <i className="fas fa-check-circle"></i>
                  </div>
                </div>

                {/* Speaking Test */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(8px)',
                  padding: '24px', 
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)',
                  border: '1px solid rgba(2, 69, 174, 0.08)'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '18px', 
                    background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(74, 158, 255, 0.3)'
                  }}>
                    <i className="fas fa-microphone" style={{ color: '#fff', fontSize: '30px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '19px', fontWeight: 800, color: '#0f172a' }}>SPEAKING TEST</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b', marginBottom: '14px', lineHeight: '1.6' }}>
                      An oral assessment to evaluate your pronunciation, fluency, and conversational abilities in English. <a href="#" style={{ color: '#0245ae', fontWeight: 600 }}>Learn more..</a>
                    </p>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                      padding: '12px 18px', 
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#92400e',
                      fontWeight: 600,
                      border: '1px solid #fbbf24'
                    }}>
                      Use this exam code when you begin: <strong style={{ color: '#78350f', fontWeight: 800 }}>FXV2025</strong>
                    </div>
                  </div>
                </div>

                <button style={{ 
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '16px 40px', 
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'block',
                  margin: '0 auto',
                  boxShadow: '0 6px 20px rgba(2, 69, 174, 0.4)',
                  letterSpacing: '0.5px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                  TAKE THE TEST
                </button>
              </div>

              {/* Interview Section with Arrow */}
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '-40px',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '40px solid transparent',
                  borderRight: '40px solid transparent',
                  borderTop: '50px solid #ff1744',
                  zIndex: 2
                }}></div>
              </div>

              <div style={{ 
                background: 'rgba(248, 250, 252, 0.6)', 
                backdropFilter: 'blur(8px)',
                padding: '32px', 
                borderRadius: '20px',
                border: '1px solid rgba(2, 69, 174, 0.08)'
              }}>
                <h3 style={{ 
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '18px', 
                  fontWeight: 800, 
                  marginBottom: '28px',
                  textAlign: 'center',
                  letterSpacing: '1px'
                }}>
                  INTERVIEW
                </h3>

                {/* Contact Verification */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(8px)',
                  padding: '24px', 
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)',
                  border: '1px solid rgba(2, 69, 174, 0.08)'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '18px', 
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(2, 69, 174, 0.3)'
                  }}>
                    <i className="fas fa-check-circle" style={{ color: '#fff', fontSize: '32px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 600, lineHeight: '1.6' }}>
                      Ensure your contact number is correct and you have a messaging app (Viber, WhatsApp, or Telegram) for interview coordination.
                    </p>
                    <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      Update your contact details here: <a href="#" style={{ color: '#0245ae', fontWeight: 700 }}>My Profile</a>
                    </p>
                  </div>
                </div>

                {/* Interview Guide */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(8px)',
                  padding: '24px', 
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)',
                  border: '1px solid rgba(2, 69, 174, 0.08)'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '18px', 
                    background: 'linear-gradient(135deg, #4a9eff 0%, #0245ae 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(74, 158, 255, 0.3)'
                  }}>
                    <i className="fas fa-book-open" style={{ color: '#fff', fontSize: '30px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#475569', fontWeight: 600, lineHeight: '1.6' }}>
                      Review our interview guide to learn what to expect and how to showcase your teaching skills.
                    </p>
                    <button style={{ 
                      background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '12px 24px', 
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                      letterSpacing: '0.5px',
                      transition: 'transform 0.2s ease'
                    }}>
                      INTERVIEW GUIDE
                    </button>
                  </div>
                </div>

                {/* Book Schedule */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(8px)',
                  padding: '24px', 
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)',
                  border: '1px solid rgba(2, 69, 174, 0.08)'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '18px', 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)'
                  }}>
                    <i className="fas fa-calendar-check" style={{ color: '#fff', fontSize: '30px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#475569', fontWeight: 600, lineHeight: '1.6' }}>
                      Choose a convenient time for your interview with our recruitment team.
                    </p>
                    <button style={{ 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '12px 24px', 
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      letterSpacing: '0.5px',
                      transition: 'transform 0.2s ease'
                    }}>
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

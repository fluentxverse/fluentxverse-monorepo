import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import './BecomeTutorPage.css';

const BecomeTutorPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Header />
      <div className="become-tutor-page">
        {/* Hero Section */}
        <section className="tutor-hero-section">
          <div className="tutor-hero-bg-shapes">
            <div className="tutor-shape shape-1"></div>
            <div className="tutor-shape shape-2"></div>
            <div className="tutor-shape shape-3"></div>
          </div>
          <div className="container">
            <div className="tutor-hero-content">
              <span className="tutor-hero-badge">Join Our Team</span>
              <h1 className="tutor-hero-title">Become a FluentXVerse Tutor</h1>
              <p className="tutor-hero-subtitle">
                Turn your English skills into a rewarding online career. Teach from home, set your own schedule, and make a real impact on learners across Asia.
              </p>
              <a href="/register" className="tutor-hero-btn">
                Apply Now <i className="fas fa-arrow-right"></i>
              </a>
            </div>
          </div>
        </section>

        {/* Skills & Qualifications Section */}
        <section className="tutor-requirements-section">
          <div className="container">
            <div className="section-header">
              <span className="section-label">SKILLS & QUALIFICATIONS</span>
              <h2 className="section-title">What We're Looking For</h2>
            </div>
            
            <div className="requirements-grid">
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-user-check"></i>
                </div>
                <h4>Age Requirement</h4>
                <p>Applicants must be 18 years old or above</p>
              </div>
              
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-laptop"></i>
                </div>
                <h4>Digital Literacy</h4>
                <p>Comfortable with digital tools such as video-meeting apps, email, and basic web navigation</p>
              </div>
              
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-comments"></i>
                </div>
                <h4>English Proficiency</h4>
                <p>Strong command of the English language</p>
              </div>
              
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-heart"></i>
                </div>
                <h4>Professional Attitude</h4>
                <p>Patient, professional, and genuinely interested in helping learners</p>
              </div>
              
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-map-marker-alt"></i>
                </div>
                <h4>Location</h4>
                <p>Must currently live in the Philippines</p>
              </div>
              
              {/* <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-id-card"></i>
                </div>
                <h4>Tax ID Required</h4>
                <p>A valid Philippine Tax Identification Number (TIN) is required</p>
              </div> */}
              
              {/* <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-ban"></i>
                </div>
                <h4>Exclusivity</h4>
                <p>Must not be affiliated with any other online ESL company at the same time</p>
              </div> */}
              
              <div className="requirement-card">
                <div className="requirement-icon">
                  <i className="fas fa-graduation-cap"></i>
                </div>
                <h4>Teaching Background</h4>
                <p>Previous teaching or ESL background is beneficial but optional</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tutoring Requirements Section */}
        <section className="tutoring-requirements-section">
          <div className="container">
            <div className="section-header">
              <span className="section-label">TUTORING REQUIREMENTS</span>
              <h2 className="section-title">Technical Setup</h2>
            </div>
            
            <div className="tech-requirements-grid">
              {/* Computer & Software */}
              <div className="tech-card">
                <div className="tech-card-header">
                  <div className="tech-icon">
                    <i className="fas fa-desktop"></i>
                  </div>
                  <h3>Computer & Software</h3>
                </div>
                <div className="tech-card-content">
                  <ul className="tech-list">
                    <li><i className="fas fa-check"></i> A laptop or desktop is required for conducting lessons</li>
                    <li><i className="fas fa-times text-danger"></i> Mobile phones and tablets are not allowed as they cannot meet our lesson quality standards</li>
                    <li><i className="fas fa-check"></i> Your operating system and drivers must be regularly updated</li>
                  </ul>
                  <div className="specs-box">
                    <h5>Minimum System Specifications:</h5>
                    <ul>
                      <li><strong>OS:</strong> Windows 10 / macOS 10.14 or newer</li>
                      <li><strong>CPU:</strong> Dual-core processor or better</li>
                      <li><strong>RAM:</strong> At least 8GB</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Internet Requirements */}
              <div className="tech-card">
                <div className="tech-card-header">
                  <div className="tech-icon">
                    <i className="fas fa-wifi"></i>
                  </div>
                  <h3>Internet Requirements</h3>
                </div>
                <div className="tech-card-content">
                  <ul className="tech-list">
                    <li><i className="fas fa-check"></i> Stable wired connection is preferred</li>
                    <li><i className="fas fa-check"></i> <strong>Recommended:</strong> 15 Mbps up/down</li>
                    <li><i className="fas fa-check"></i> <strong>Minimum:</strong> 3 Mbps up/down</li>
                    <li><i className="fas fa-check"></i> Ping must be below 100 ms for smooth lessons</li>
                    <li><i className="fas fa-check"></i> Use the latest version of Chrome or Firefox</li>
                  </ul>
                </div>
              </div>

              {/* Audio & Video */}
              <div className="tech-card">
                <div className="tech-card-header">
                  <div className="tech-icon">
                    <i className="fas fa-video"></i>
                  </div>
                  <h3>Audio & Video Tools</h3>
                </div>
                <div className="tech-card-content">
                  <ul className="tech-list">
                    <li><i className="fas fa-check"></i> Functional webcam, microphone, and headset</li>
                  </ul>
                  <div className="specs-box">
                    <h5>Preferably with:</h5>
                    <ul>
                      <li>Noise-cancelling mic</li>
                      <li>DSP noise/echo reduction</li>
                      <li>Inline volume or mute controls</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Teaching Environment */}
              <div className="tech-card">
                <div className="tech-card-header">
                  <div className="tech-icon">
                    <i className="fas fa-home"></i>
                  </div>
                  <h3>Teaching Environment</h3>
                </div>
                <div className="tech-card-content">
                  <ul className="tech-list">
                    <li><i className="fas fa-check"></i> Quiet surroundings with no unnecessary noise</li>
                    <li><i className="fas fa-check"></i> Stable lighting and clear video feed</li>
                    <li><i className="fas fa-check"></i> Tidy, distraction-free background (preferably plain)</li>
                    <li><i className="fas fa-check"></i> Presentable attire — smart casual recommended; formal clothing optional</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Antivirus Section */}
            <div className="antivirus-section">
              <div className="antivirus-header">
                <div className="tech-icon">
                  <i className="fas fa-shield-alt"></i>
                </div>
                <h3>Antivirus Protection</h3>
              </div>
              <p className="antivirus-intro">
                An antivirus solution must be installed for security. Preloaded antivirus software is acceptable. If you do not have one installed, here are commonly used free options:
              </p>
              <div className="antivirus-grid">
                <div className="antivirus-card">
                  <h5><i className="fab fa-windows"></i> Windows</h5>
                  <ul>
                    <li>Windows Defender</li>
                    <li>Avira Free Security</li>
                    <li>Bitdefender Free</li>
                    <li>Kaspersky Security Cloud Free</li>
                    <li>Avast Free</li>
                    <li>Sophos Home Free</li>
                  </ul>
                </div>
                <div className="antivirus-card">
                  <h5><i className="fab fa-apple"></i> macOS</h5>
                  <ul>
                    <li>Avast Free Mac</li>
                    <li>Avira Free Antivirus for Mac</li>
                    <li>Sophos Home for Mac</li>
                  </ul>
                </div>
                <div className="antivirus-card">
                  <h5><i className="fab fa-linux"></i> Linux</h5>
                  <ul>
                    <li>ClamAV</li>
                  </ul>
                </div>
              </div>
              <p className="antivirus-disclaimer">
                <i className="fas fa-info-circle"></i> FluentXVerse is not affiliated with any of these services. Please review them yourself before choosing.
              </p>
            </div>
          </div>
        </section>

        {/* Application Flow Section */}
        <section className="application-flow-section">
          <div className="container">
            <div className="section-header">
              <span className="section-label">THE APPLICATION FLOW</span>
              <h2 className="section-title">Your Journey to Becoming a Tutor</h2>
              <p className="section-subtitle">
                FluentXVerse uses a fully online application system, so you can complete every step from home.
              </p>
            </div>
            
            <div className="flow-timeline">
              <div className="flow-step">
                <div className="flow-number">1</div>
                <div className="flow-content">
                  <h4>Create Your Account</h4>
                  <p>Sign up through our website and complete the registration form. Once your account is activated, proceed with the initial checks.</p>
                </div>
              </div>
              
              <div className="flow-step">
                <div className="flow-number">2</div>
                <div className="flow-content">
                  <h4>Screening Stage</h4>
                  <p>You will take an English communication test and undergo a short interview. These help us evaluate your speaking ability, clarity, and teaching readiness.</p>
                </div>
              </div>
              
              <div className="flow-step">
                <div className="flow-number">3</div>
                <div className="flow-content">
                  <h4>Onboarding & Preparation</h4>
                  <p>New tutors complete the FluentXVerse Onboarding Program. You'll then set up your tutor profile, submit required documents, and once approved, you can begin teaching.</p>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* CTA Section */}
        <section className="tutor-cta-section">
          <div className="container">
            <div className="tutor-cta-content">
              <h2>Ready to Start Teaching?</h2>
              <p>Join FluentXVerse today and begin your journey as an online ESL tutor.</p>
              <a href="/register" className="tutor-cta-btn">
                Apply Now <i className="fas fa-arrow-right"></i>
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};

export default BecomeTutorPage;

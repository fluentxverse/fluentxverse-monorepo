import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import './BecomeTutorPage.css';
const BecomeTutorPage = () => {
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            window.scrollTo(0, 0);
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return (<>
      <Header showThemeSwitch={false}/>
      <div class="become-tutor-page">
        {/* Hero Section */}
        <section class="tutor-hero-section">
          <div class="tutor-hero-bg-shapes">
            <div class="tutor-shape shape-1"></div>
            <div class="tutor-shape shape-2"></div>
            <div class="tutor-shape shape-3"></div>
          </div>
          <div class="container">
            <div class="tutor-hero-content">
              <span class="tutor-hero-badge">Join Our Team</span>
              <h1 class="tutor-hero-title">Become a FluentXVerse Tutor</h1>
              <p class="tutor-hero-subtitle">
                Turn your English skills into a rewarding online career. Teach from home, set your own schedule, and make a real impact on learners across Asia.
              </p>
              <a href="/register" class="tutor-hero-btn">
                Apply Now <TutorIcon name="fas fa-arrow-right"/>
              </a>
            </div>
          </div>
        </section>

        {/* Skills & Qualifications Section */}
        <section class="tutor-requirements-section">
          <div class="container">
            <div class="section-header">
              <span class="section-label">SKILLS & QUALIFICATIONS</span>
              <h2 class="section-title">What We're Looking For</h2>
            </div>
            
            <div class="requirements-grid">
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-user-check"/>
                </div>
                <h4>Age Requirement</h4>
                <p>Applicants must be 18 years old or above</p>
              </div>
              
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-laptop"/>
                </div>
                <h4>Digital Literacy</h4>
                <p>Comfortable with digital tools such as video-meeting apps, email, and basic web navigation</p>
              </div>
              
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-comments"/>
                </div>
                <h4>English Proficiency</h4>
                <p>Strong command of the English language</p>
              </div>
              
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-heart"/>
                </div>
                <h4>Professional Attitude</h4>
                <p>Patient, professional, and genuinely interested in helping learners</p>
              </div>
              
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-map-marker-alt"/>
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
              
              <div class="requirement-card">
                <div class="requirement-icon">
                  <TutorIcon name="fas fa-graduation-cap"/>
                </div>
                <h4>Teaching Background</h4>
                <p>Previous teaching or ESL background is beneficial but optional</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tutoring Requirements Section */}
        <section class="tutoring-requirements-section">
          <div class="container">
            <div class="section-header">
              <span class="section-label">TUTORING REQUIREMENTS</span>
              <h2 class="section-title">Technical Setup</h2>
            </div>
            
            <div class="tech-requirements-grid">
              {/* Computer & Software */}
              <div class="tech-card">
                <div class="tech-card-header">
                  <div class="tech-icon">
                    <TutorIcon name="fas fa-desktop"/>
                  </div>
                  <h3>Computer & Software</h3>
                </div>
                <div class="tech-card-content">
                  <ul class="tech-list">
                    <li><TutorIcon name="fas fa-check"/> A laptop or desktop is required for conducting lessons</li>
                    <li><TutorIcon name="fas fa-times text-danger"/> Mobile phones and tablets are not allowed as they cannot meet our lesson quality standards</li>
                    <li><TutorIcon name="fas fa-check"/> Your operating system and drivers must be regularly updated</li>
                  </ul>
                  <div class="specs-box">
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
              <div class="tech-card">
                <div class="tech-card-header">
                  <div class="tech-icon">
                    <TutorIcon name="fas fa-wifi"/>
                  </div>
                  <h3>Internet Requirements</h3>
                </div>
                <div class="tech-card-content">
                  <ul class="tech-list">
                    <li><TutorIcon name="fas fa-check"/> Stable wired connection is preferred</li>
                    <li><TutorIcon name="fas fa-check"/> <strong>Recommended:</strong> 15 Mbps up/down</li>
                    <li><TutorIcon name="fas fa-check"/> <strong>Minimum:</strong> 3 Mbps up/down</li>
                    <li><TutorIcon name="fas fa-check"/> Ping must be below 100 ms for smooth lessons</li>
                    <li><TutorIcon name="fas fa-check"/> Use the latest version of Chrome or Firefox</li>
                  </ul>
                </div>
              </div>

              {/* Audio & Video */}
              <div class="tech-card">
                <div class="tech-card-header">
                  <div class="tech-icon">
                    <TutorIcon name="fas fa-video"/>
                  </div>
                  <h3>Audio & Video Tools</h3>
                </div>
                <div class="tech-card-content">
                  <ul class="tech-list">
                    <li><TutorIcon name="fas fa-check"/> Functional webcam, microphone, and headset</li>
                  </ul>
                  <div class="specs-box">
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
              <div class="tech-card">
                <div class="tech-card-header">
                  <div class="tech-icon">
                    <TutorIcon name="fas fa-home"/>
                  </div>
                  <h3>Teaching Environment</h3>
                </div>
                <div class="tech-card-content">
                  <ul class="tech-list">
                    <li><TutorIcon name="fas fa-check"/> Quiet surroundings with no unnecessary noise</li>
                    <li><TutorIcon name="fas fa-check"/> Stable lighting and clear video feed</li>
                    <li><TutorIcon name="fas fa-check"/> Tidy, distraction-free background (preferably plain)</li>
                    <li><TutorIcon name="fas fa-check"/> Presentable attire, smart casual recommended; formal clothing optional</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Antivirus Section */}
            <div class="antivirus-section">
              <div class="antivirus-header">
                <div class="tech-icon">
                  <TutorIcon name="fas fa-shield-alt"/>
                </div>
                <h3>Antivirus Protection</h3>
              </div>
              <p class="antivirus-intro">
                An antivirus solution must be installed for security. Preloaded antivirus software is acceptable. If you do not have one installed, here are commonly used free options:
              </p>
              <div class="antivirus-grid">
                <div class="antivirus-card">
                  <h5><TutorIcon name="fab fa-windows"/> Windows</h5>
                  <ul>
                    <li>Windows Defender</li>
                    <li>Avira Free Security</li>
                    <li>Bitdefender Free</li>
                    <li>Kaspersky Security Cloud Free</li>
                    <li>Avast Free</li>
                    <li>Sophos Home Free</li>
                  </ul>
                </div>
                <div class="antivirus-card">
                  <h5><TutorIcon name="fab fa-apple"/> macOS</h5>
                  <ul>
                    <li>Avast Free Mac</li>
                    <li>Avira Free Antivirus for Mac</li>
                    <li>Sophos Home for Mac</li>
                  </ul>
                </div>
                <div class="antivirus-card">
                  <h5><TutorIcon name="fab fa-linux"/> Linux</h5>
                  <ul>
                    <li>ClamAV</li>
                  </ul>
                </div>
              </div>
              <p class="antivirus-disclaimer">
                <TutorIcon name="fas fa-info-circle"/> FluentXVerse is not affiliated with any of these services. Please review them yourself before choosing.
              </p>
            </div>
          </div>
        </section>

        {/* Application Flow Section */}
        <section class="application-flow-section">
          <div class="container">
            <div class="section-header">
              <span class="section-label">THE APPLICATION FLOW</span>
              <h2 class="section-title">Your Journey to Becoming a Tutor</h2>
              <p class="section-subtitle">
                FluentXVerse uses a fully online application system, so you can complete every step from home.
              </p>
            </div>
            
            <div class="flow-timeline">
              <div class="flow-step">
                <div class="flow-number">1</div>
                <div class="flow-content">
                  <h4>Create Your Account</h4>
                  <p>Sign up through our website and complete the registration form. Once your account is activated, proceed with the initial checks.</p>
                </div>
              </div>
              
              <div class="flow-step">
                <div class="flow-number">2</div>
                <div class="flow-content">
                  <h4>Screening Stage</h4>
                  <p>You will take an English communication test and undergo a short interview. These help us evaluate your speaking ability, clarity, and teaching readiness.</p>
                </div>
              </div>
              
              <div class="flow-step">
                <div class="flow-number">3</div>
                <div class="flow-content">
                  <h4>Onboarding & Preparation</h4>
                  <p>New tutors complete the FluentXVerse Onboarding Program. You'll then set up your tutor profile, submit required documents, and once approved, you can begin teaching.</p>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* CTA Section */}
        <section class="tutor-cta-section">
          <div class="container">
            <div class="tutor-cta-content">
              <h2>Ready to Start Teaching?</h2>
              <p>Join FluentXVerse today and begin your journey as an online ESL tutor.</p>
              <a href="/register" class="tutor-cta-btn">
                Apply Now <TutorIcon name="fas fa-arrow-right"/>
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>);
};
export default BecomeTutorPage;

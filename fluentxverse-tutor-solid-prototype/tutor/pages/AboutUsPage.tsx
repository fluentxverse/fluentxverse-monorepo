import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import HomeIllustration from '../Components/IndexOne/HomeIllustration';
import AboutIllustration from '../Components/InnerPages/AboutIllustration';
import './AboutUsPage.css';
const AboutUsPage = () => {
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            document.title = 'About Us | FluentXVerse';
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return (<>
      <Header showThemeSwitch={false}/>
      <div class="about-us-wrapper">
        {/* Hero Section */}
        <section class="about-hero-section">
          <picture>
            <source media="(max-width: 900px)" srcset="/assets/img/banner/about-tutor-closeup-mobile-v2.webp"/>
            <img class="about-hero-image" src="/assets/img/banner/about-tutor-closeup-wide-v2.webp" alt="" fetchpriority="high" width={2048} height={683}/>
          </picture>
          
          <div class="container">
            <div class="about-hero-content">
              <span class="about-hero-badge">
                ABOUT US
              </span>
              <h1 class="about-hero-title">FluentXVerse</h1>
              <p class="about-hero-subtitle">
                Helping tutors and learners connect across borders, one conversation at a time.
              </p>
              <div class="about-hero-actions">
                <a class="about-hero-primary" href="/register">Become a Tutor <TutorIcon name="fas fa-arrow-right" aria-hidden="true"/></a>
                <a class="about-hero-secondary" href="#our-mission">Our Mission <TutorIcon name="fas fa-arrow-down" aria-hidden="true"/></a>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section class="about-mission-section" id="our-mission" aria-labelledby="about-mission-title">
          
          <div class="container">
            <div class="about-content-grid">
              <div class="about-text-content">
                <span class="about-label">OUR MISSION</span>
                <h2 class="about-section-title" id="about-mission-title">
                  Empowering Global Learners Through Innovation
                </h2>
                <p class="about-description">
                  To deliver accessible, high-quality English learning through innovative tools, personalized tutoring, and responsible Web3 features that reward consistency, celebrate progress, and build a thriving, global learning community.
                  We aim to support working professionals, and elevate ESL education with transparency, trust, and technology that feels human.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section class="about-vision-section">
          
          <div class="container">
            <div class="about-content-grid reverse">
              <div class="about-image-content">
                <AboutIllustration name="globe"/>
              </div>
              
              <div class="about-text-content">
                <span class="about-label">OUR VISION</span>
                <h2 class="about-section-title">
                  The World's Most Empowering Digital Language Ecosystem
                </h2>
                <p class="about-description">
                  To become the world's most empowering digital language ecosystem where learners, tutors, and creators connect seamlessly across borders, unlocking global opportunities through education, technology, and meaningful human interaction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section class="about-values-section">
          
          <div class="container">
            <div class="about-values-header">
              <span class="about-label">OUR VALUES</span>
              <h2 class="about-section-title centered">What Drives Us Forward</h2>
            </div>

            <div class="about-values-grid">
              <div class="about-value-card">
                <div class="value-icon">
                  <AboutIllustration name="globe"/>
                </div>
                <h3>Global Connection</h3>
                <p>Breaking language barriers to connect tutors and students worldwide, fostering cultural exchange and understanding.</p>
              </div>

              <div class="about-value-card">
                <div class="value-icon">
                  <AboutIllustration name="innovation"/>
                </div>
                <h3>Innovation</h3>
                <p>Leveraging cutting-edge technology to deliver personalized, effective language learning experiences.</p>
              </div>

              <div class="about-value-card">
                <div class="value-icon">
                  <HomeIllustration name="growth"/>
                </div>
                <h3>Empowerment</h3>
                <p>Empowering tutors to share their expertise while helping students achieve their language goals with confidence.</p>
              </div>

              <div class="about-value-card">
                <div class="value-icon">
                  <HomeIllustration name="community"/>
                </div>
                <h3>Community</h3>
                <p>Building a supportive community where tutors grow together through meaningful interactions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section class="about-story-section">
          
          <div class="container">
            <div class="about-story-content">
              <div class="about-story-text">
                <span class="about-label">OUR STORY</span>
                <h2 class="about-section-title">From Vision to Reality</h2>
                <p class="about-description">
                  FluentXVerse was born from a simple observation: talented tutors worldwide struggle to reach students who need them most, while learners face barriers to accessing quality, affordable education.
                </p>
                <p class="about-description">
                  We envisioned a platform where geography doesn't limit opportunity, where a tutor in Manila can inspire a professional in Tokyo or Seoul, where Web3 technology rewards dedication, and where every interaction builds toward something bigger than a single lesson.
                </p>
                <p class="about-description">
                  Today, we're building that future. Through innovative technology, transparent practices, and a deep commitment to human connection, FluentXVerse is redefining what's possible in language education.
                </p>
              </div>
              
              <div class="about-story-highlights">
                <div class="story-highlight-card">
                  <div class="highlight-icon">
                    <HomeIllustration name="schedule"/>
                  </div>
                  <div class="highlight-content">
                    <h4>Founded</h4>
                    <p>2025</p>
                  </div>
                </div>
                
                <div class="story-highlight-card">
                  <div class="highlight-icon">
                    <AboutIllustration name="location"/>
                  </div>
                  <div class="highlight-content">
                    <h4>Headquarters</h4>
                    <p>Philippines</p>
                  </div>
                </div>
                
                <div class="story-highlight-card">
                  <div class="highlight-icon">
                    <HomeIllustration name="training"/>
                  </div>
                  <div class="highlight-content">
                    <h4>Focus</h4>
                    <p>ESL Education</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Meet the Team Section */}
        {/* <section className="about-team-section">
          <div className="about-wave-top-team"></div>
          
          <div className="container">
            <div className="about-team-header">
              <span className="about-label">OUR TEAM</span>
              <h2 className="about-section-title centered">The Minds Behind FluentXVerse</h2>
              <p className="about-team-description">
                A passionate team of educators, technologists, and innovators working to transform language learning.
              </p>
            </div>

            <div className="about-team-grid">
              <div className="team-member-card">
                <div className="team-member-image">
                  <img src="/assets/img/team/member-1.jpg" alt="Team Member" onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23e2e8f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='60' fill='%2394a3b8' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E";
                  }} />
                </div>
                <div className="team-member-info">
                  <h4>Founder & CEO</h4>
                  <p className="team-member-role">Visionary Leader</p>
                  <p className="team-member-bio">Pioneering the future of digital language education with innovative Web3 solutions.</p>
                </div>
              </div>

              <div className="team-member-card">
                <div className="team-member-image">
                  <img src="/assets/img/team/member-2.jpg" alt="Team Member" onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23e2e8f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='60' fill='%2394a3b8' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E";
                  }} />
                </div>
                <div className="team-member-info">
                  <h4>Head of Education</h4>
                  <p className="team-member-role">Curriculum Expert</p>
                  <p className="team-member-bio">Designing learning experiences that make language acquisition effective and enjoyable.</p>
                </div>
              </div>

              <div className="team-member-card">
                <div className="team-member-image">
                  <img src="/assets/img/team/member-3.jpg" alt="Team Member" onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23e2e8f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='60' fill='%2394a3b8' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E";
                  }} />
                </div>
                <div className="team-member-info">
                  <h4>Chief Technology Officer</h4>
                  <p className="team-member-role">Tech Innovator</p>
                  <p className="team-member-bio">Building scalable infrastructure that connects learners and tutors seamlessly.</p>
                </div>
              </div>

              <div className="team-member-card">
                <div className="team-member-image">
                  <img src="/assets/img/team/member-4.jpg" alt="Team Member" onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23e2e8f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='60' fill='%2394a3b8' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E";
                  }} />
                </div>
                <div className="team-member-info">
                  <h4>Community Manager</h4>
                  <p className="team-member-role">Growth Strategist</p>
                  <p className="team-member-bio">Fostering a vibrant community of tutors and learners across the globe.</p>
                </div>
              </div>
            </div>
          </div>
        </section> */}

        {/* CTA Section */}
        <section class="about-cta-section">
          
          <div class="container">
            <div class="about-cta-content">
              <h2>Ready to Make a Difference?</h2>
              <p>Join our community of passionate tutors and help students achieve their English learning goals.</p>
              <a href="/register" class="about-cta-btn">
                <span>Become a Tutor</span>
                <TutorIcon name="fas fa-arrow-right"/>
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>);
};
export default AboutUsPage;

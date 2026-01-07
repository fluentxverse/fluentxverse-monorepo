import { useState, useEffect } from "react";
import "./styles/App.css";

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'about'>(() => {
    const path = window.location.pathname;
    return path === '/about' ? 'about' : 'home';
  });

  const navigateTo = (page: 'home' | 'about') => {
    setCurrentPage(page);
    setIsMenuOpen(false);
    window.history.pushState({}, '', page === 'home' ? '/' : '/about');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPage(path === '/about' ? 'about' : 'home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }} className="logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" className="logo-icon" width="40" height="40" />
            <span className="logo-text">Fluent<span className="logo-x">X</span>Verse</span>
          </a>

          <button
            className="menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
            <li><a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }}>Home</a></li>
            <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about'); }}>About</a></li>
            <li>
              <a href="https://student.fluentxverse.com" className="btn btn-outline" target="_blank" rel="noopener noreferrer">
                Student Portal
              </a>
            </li>
            <li>
              <a href="https://tutor.fluentxverse.com" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                Tutor Portal
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {currentPage === 'home' ? <HomePage navigateTo={navigateTo} /> : <AboutPage navigateTo={navigateTo} />}
    </div>
  );
}

function HomePage({ navigateTo }: { navigateTo: (page: 'home' | 'about') => void }) {
  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-particles"></div>
          {/* Will-o-wisps */}
          <div className="hero-wisps" aria-hidden="true">
            <span className="hero-wisp"></span>
            <span className="hero-wisp"></span>
            <span className="hero-wisp"></span>
            <span className="hero-wisp"></span>
            <span className="hero-wisp"></span>
            <span className="hero-wisp"></span>
          </div>
        </div>

        {/* Hero Content (Top) */}
        <div className="hero-top-content">
          <h1 className="hero-title">
            Breaking Barriers in
            <span className="gradient-text"> Language Education</span>
          </h1>

          <p className="hero-description">
            Connecting talented Filipino tutors with students in Vietnam, Korea, and Japan through 
            innovative technology and meaningful human connection.
          </p>

          <div className="hero-cta">
            <a href="#problem" className="btn btn-primary">
              Explore Our Vision
              <span className="btn-arrow">→</span>
            </a>
            <a href="#" onClick={() => navigateTo('about')} className="btn btn-ghost">
              Learn More
            </a>
          </div>
        </div>

        {/* V-Shape Cards - staggered horizontally */}
        <div className="v-cards" aria-hidden="true">
          {/* First V - Left side */}
          <div className="floating-card v-card v-left-1">
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v-left-2">
            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v-left-3">
            <img src="https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=300&h=480&fit=crop" alt="" />
          </div>

          {/* First V - Right side */}
          <div className="floating-card v-card v-right-1">
            <img src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v-right-2">
            <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v-right-3">
            <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=480&fit=crop" alt="" />
          </div>

          {/* First V - Center */}
          <div className="floating-card v-card v-center">
            <img src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=300&h=480&fit=crop" alt="" />
          </div>

          {/* Second V - Left side */}
          <div className="floating-card v-card v2-left-1">
            <img src="https://images.unsplash.com/photo-1513258496099-48168024aec0?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v2-left-2">
            <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v2-left-3">
            <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=300&h=480&fit=crop" alt="" />
          </div>

          {/* Second V - Right side */}
          <div className="floating-card v-card v2-right-1">
            <img src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v2-right-2">
            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=300&h=480&fit=crop" alt="" />
          </div>
          <div className="floating-card v-card v2-right-3">
            <img src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&h=480&fit=crop" alt="" />
          </div>

          {/* Second V - Center */}
          <div className="floating-card v-card v2-center">
            <img src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&h=480&fit=crop" alt="" />
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="problem-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">The Problem</span>
            <h2 className="section-title">Why Traditional ESL Fails</h2>
            <p className="section-description">
              The current ESL landscape is broken for both tutors and students
            </p>
          </div>

          <div className="problem-grid">
            {/* Platform Fees */}
            <div className="problem-card">
              <div className="problem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="problem-content">
                <h3>High Platform Fees</h3>
                <p>Traditional platforms take up to 40% of tutor earnings, leaving talented educators struggling to make ends meet.</p>
                <div className="problem-stat">
                  <span className="stat-number">40%</span>
                  <span className="stat-label">taken by platforms</span>
                </div>
              </div>
            </div>

            {/* Geographic Barriers */}
            <div className="problem-card">
              <div className="problem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <div className="problem-content">
                <h3>Geographic Barriers</h3>
                <p>Quality tutors can't reach students across borders due to payment, timezone, and platform limitations.</p>
              </div>
            </div>

            {/* Zero Transparency */}
            <div className="problem-card">
              <div className="problem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="problem-content">
                <h3>Zero Transparency</h3>
                <p>No verifiable credentials, progress tracking, or payment visibility for students or tutors.</p>
              </div>
            </div>

            {/* Cookie-Cutter Learning */}
            <div className="problem-card">
              <div className="problem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <div className="problem-content">
                <h3>Cookie-Cutter Learning</h3>
                <p>Same curriculum for everyone ignores individual goals, learning styles, and proficiency levels.</p>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="problem-testimonial">
            <div className="testimonial-quote">"</div>
            <p className="testimonial-text">
              I was earning $3/hour after platform fees. I almost gave up teaching entirely.
            </p>
            <div className="testimonial-author">
              <span className="author-name">Maria, ESL Tutor</span>
              <span className="author-location">Manila, Philippines</span>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="solution-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Our Solution</span>
            <h2 className="section-title">Fluent<span className="title-x">X</span>Verse: A New Paradigm</h2>
            <p className="section-description">
              We're building an ecosystem where tutors thrive and students succeed
            </p>
          </div>

          {/* Hero stats row */}
          <div className="solution-stats">
            <div className="stat-card">
              <div className="stat-number">75%</div>
              <div className="stat-label">Tutor Earnings</div>
              <p>Up to 75% goes to tutors</p>
            </div>
            <div className="stat-card stat-highlight">
              <div className="stat-number">0%</div>
              <div className="stat-label">Hidden Fees</div>
              <p>Transparent pricing always</p>
            </div>
            <div className="stat-card">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Global Access</div>
              <p>Learn anytime, anywhere</p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="solution-pills">
            <div className="pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 10l5 5-5 5"></path>
                <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
              </svg>
              <span>Live 1-on-1 Video Sessions</span>
            </div>
            <div className="pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M7 15h0M12 15h0M17 15h0"></path>
                <path d="M2 10h20"></path>
              </svg>
              <span>Crypto Payments</span>
            </div>
            <div className="pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              <span>Progress Tracking</span>
            </div>
            <div className="pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Community Learning</span>
            </div>
          </div>

          {/* Two column feature cards */}
          <div className="solution-grid">
            <div className="solution-card">
              <div className="solution-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <h3>Empowering Filipino Tutors</h3>
              <p>
                Built with Filipino ESL tutors at its core. We understand the unique strengths, warmth, patience, clear pronunciation, and cultural adaptability that resonates with Asian learners.
              </p>
              <div className="solution-card-footer">
                <span className="footer-tag">Flexible schedules</span>
                <span className="footer-tag">Fair pay</span>
                <span className="footer-tag">Career growth</span>
              </div>
            </div>

            <div className="solution-card">
              <div className="solution-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20"></path>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Connecting Asian Markets</h3>
              <p>
                Focus on students in Vietnam, Korea, and Japan where English fluency opens doors to career advancement, international business, and cultural exchange.
              </p>
              <div className="solution-card-footer">
                <span className="footer-tag">No borders</span>
                <span className="footer-tag">Web3 payments</span>
                <span className="footer-tag">Verified progress</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="technology-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Technology</span>
            <h2 className="section-title">Built for the Future</h2>
            <p className="section-description">
              Modern technology stack designed for scalability, security, and user experience
            </p>
          </div>

          <div className="tech-showcase">
            <div className="tech-hero-row">
              {/* Smart Progress Tracking */}
              <div className="tech-hero-card progress-tracking">
                <div className="tech-hero-visual">
                  <div className="progress-icon-ring">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                  </div>
                </div>
                <div className="tech-hero-content">
                  <span className="tech-feature-badge">Weekly Reports</span>
                  <h3>Smart Progress Tracking</h3>
                  <p>Our AI-powered system measures your weekly progress with detailed metrics. Get personalized reports showing vocabulary growth, fluency improvements, and achievement milestones.</p>
                  <div className="progress-stats">
                    <div className="progress-stat-item">
                      <span className="progress-stat-value">All levels</span>
                      <span className="progress-stat-label">From beginner to advanced welcome</span>
                    </div>
                    <div className="progress-stat-item">
                      <span className="progress-stat-value">3 months</span>
                      <span className="progress-stat-label">Average time to hold basic conversations</span>
                    </div>
                    <div className="progress-stat-item">
                      <span className="progress-stat-value">100%</span>
                      <span className="progress-stat-label">Supportive learning environment</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main feature - WebRTC */}
              <div className="tech-hero-card">
                <div className="tech-hero-visual">
                  <div className="video-ring">
                    <div className="video-ring-inner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="tech-hero-content">
                  <h3>WebRTC Video</h3>
                  <p>Crystal-clear, low-latency video calls that feel like being in the same room. Real-time communication powered by cutting-edge browser technology.</p>
                  <div className="tech-tags">
                    <span>P2P Connection</span>
                    <span>HD Quality</span>
                    <span>&lt;100ms Latency</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tech stack grid */}
            <div className="tech-stack-grid">
              <div className="tech-stack-card">
                <div className="tech-stack-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <path d="M3 9h18M9 21V9"></path>
                  </svg>
                </div>
                <h4>Web3 Integration</h4>
                <p>Wallet auth & crypto payments</p>
              </div>

              <div className="tech-stack-card">
                <div className="tech-stack-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>
                    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"></path>
                    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"></path>
                  </svg>
                </div>
                <h4>Graph Database</h4>
                <p>Memgraph for relationships</p>
              </div>

              <div className="tech-stack-card">
                <div className="tech-stack-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"></path>
                    <line x1="8" y1="6" x2="16" y2="6"></line>
                    <line x1="8" y1="10" x2="14" y2="10"></line>
                  </svg>
                </div>
                <h4>Bun + Elysia</h4>
                <p>Blazing-fast type-safe API</p>
              </div>

              <div className="tech-stack-card">
                <div className="tech-stack-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                    <line x1="14" y1="4" x2="10" y2="20"></line>
                  </svg>
                </div>
                <h4>React + TypeScript</h4>
                <p>Performant on any device</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="vision-section">
        <div className="vision-bg">
          <div className="vision-gradient"></div>
          <div className="vision-grid-lines"></div>
        </div>
        <div className="section-container">
          <div className="vision-header">
            <span className="section-badge">Our Vision</span>
            <h2 className="vision-title">The Future We're Building</h2>
          </div>
          
          <div className="vision-statement">
            <div className="vision-quote-mark">"</div>
            <p className="vision-big-text">
              A world where geography doesn't limit opportunity. Where a tutor in{" "}
              <span className="highlight-city">Manila</span> can inspire a professional in{" "}
              <span className="highlight-city">Seoul</span> or <span className="highlight-city">Hanoi</span>, where technology rewards dedication, 
              and where every interaction builds toward something bigger.
            </p>
          </div>

          <div className="vision-pillars">
            <div className="pillar-card">
              <div className="pillar-number">01</div>
              <div className="pillar-line"></div>
              <h3>Global Reach</h3>
              <p>Breaking down borders between Filipino tutors and Asian learners. Real connections, real impact.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">02</div>
              <div className="pillar-line"></div>
              <h3>Fair Economics</h3>
              <p>Transparent pricing where educators earn what they deserve. No hidden fees, no exploitation.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">03</div>
              <div className="pillar-line"></div>
              <h3>Real Impact</h3>
              <p>Measurable outcomes that change lives and careers. Every lesson is a step toward fluency.</p>
            </div>
          </div>

          <div className="vision-manifesto">
            <p>
              Fluent<span className="text-primary">X</span>Verse isn't just a platform. 
              It's a <strong>movement</strong> to democratize language education, 
              empower educators, and create meaningful connections across cultures.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer navigateTo={navigateTo} />
    </>
  );
}

function AboutPage({ navigateTo }: { navigateTo: (page: 'home' | 'about') => void }) {
  return (
    <>
      {/* About Hero */}
      <section className="about-hero">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-particles"></div>
        </div>
        <div className="section-container">
          <div className="about-hero-content">
            <span className="section-badge">About Us</span>
            <h1 className="hero-title">
              Building Bridges Through
              <span className="gradient-text"> Language</span>
            </h1>
            <p className="hero-description">
              Empowering Filipino tutors to connect with learners across Asia through technology and human connection
            </p>
          </div>
        </div>

        {/* Tech Stack Slider - Inside Hero */}
        <div className="tech-slider-wrapper hero-tech-slider">
          {/* Upper row - moves left */}
          <div className="tech-slider-row">
            <div className="tech-slider-track track-left">
              {[...Array(4)].map((_, i) => (
                <div className="tech-slider-items" key={i}>
                  <div className="tech-slide-item">
                    <svg viewBox="0 0 128 128" className="tech-icon">
                      <g fill="#61DAFB"><circle cx="64" cy="64" r="11.4"/><path d="M107.3 45.2c-2.2-.8-4.5-1.6-6.9-2.3.6-2.4 1.1-4.8 1.5-7.1 2.1-13.2-.2-22.5-6.6-26.1-1.9-1.1-4-1.6-6.4-1.6-7 0-15.9 5.2-24.9 13.9-9-8.7-17.9-13.9-24.9-13.9-2.4 0-4.5.5-6.4 1.6-6.4 3.7-8.7 13-6.6 26.1.4 2.3.9 4.7 1.5 7.1-2.4.7-4.7 1.4-6.9 2.3C8.2 50 1.4 56.6 1.4 64s6.9 14 19.3 18.8c2.2.8 4.5 1.6 6.9 2.3-.6 2.4-1.1 4.8-1.5 7.1-2.1 13.2.2 22.5 6.6 26.1 1.9 1.1 4 1.6 6.4 1.6 7.1 0 16-5.2 24.9-13.9 9 8.7 17.9 13.9 24.9 13.9 2.4 0 4.5-.5 6.4-1.6 6.4-3.7 8.7-13 6.6-26.1-.4-2.3-.9-4.7-1.5-7.1 2.4-.7 4.7-1.4 6.9-2.3 12.5-4.8 19.3-11.4 19.3-18.8s-6.8-14-19.3-18.8zM92.5 14.7c4.1 2.4 5.5 9.8 3.8 20.3-.3 2.1-.8 4.3-1.4 6.6-5.2-1.2-10.7-2-16.5-2.5-3.4-4.8-6.9-9.1-10.4-13 7.4-7.3 14.9-12.3 21-12.3 1.3 0 2.5.3 3.5.9zM81.3 74c-1.8 3.2-3.9 6.4-6.1 9.6-3.7.3-7.4.4-11.2.4-3.9 0-7.6-.1-11.2-.4-2.2-3.2-4.2-6.4-6-9.6-1.9-3.3-3.7-6.7-5.3-10 1.6-3.3 3.4-6.7 5.3-10 1.8-3.2 3.9-6.4 6.1-9.6 3.7-.3 7.4-.4 11.2-.4 3.9 0 7.6.1 11.2.4 2.2 3.2 4.2 6.4 6 9.6 1.9 3.3 3.7 6.7 5.3 10-1.7 3.3-3.4 6.6-5.3 10zm8.3-3.3c1.5 3.5 2.7 6.9 3.8 10.3-3.4.8-7 1.4-10.8 1.9 1.2-1.9 2.5-3.9 3.6-6 1.2-2.1 2.3-4.2 3.4-6.2zM64 97.8c-2.4-2.6-4.7-5.4-6.9-8.3 2.3.1 4.6.2 6.9.2 2.3 0 4.6-.1 6.9-.2-2.2 2.9-4.5 5.7-6.9 8.3zm-18.6-15c-3.8-.5-7.4-1.1-10.8-1.9 1.1-3.3 2.3-6.8 3.8-10.3 1.1 2 2.2 4.1 3.4 6.1 1.2 2.2 2.4 4.1 3.6 6.1zm-7-25.5c-1.5-3.5-2.7-6.9-3.8-10.3 3.4-.8 7-1.4 10.8-1.9-1.2 1.9-2.5 3.9-3.6 6-1.2 2.1-2.3 4.2-3.4 6.2zM64 30.2c2.4 2.6 4.7 5.4 6.9 8.3-2.3-.1-4.6-.2-6.9-.2-2.3 0-4.6.1-6.9.2 2.2-2.9 4.5-5.7 6.9-8.3zm22.2 21l-3.6-6c3.8.5 7.4 1.1 10.8 1.9-1.1 3.3-2.3 6.8-3.8 10.3-1.1-2.1-2.2-4.2-3.4-6.2zM31.7 35c-1.7-10.5-.3-17.9 3.8-20.3 1-.6 2.2-.9 3.5-.9 6 0 13.5 4.9 21 12.3-3.5 3.8-7 8.2-10.4 13-5.8.5-11.3 1.4-16.5 2.5-.6-2.3-1-4.5-1.4-6.6zM7 64c0-4.7 5.7-9.7 15.7-13.4 2-.8 4.2-1.5 6.4-2.1 1.6 5 3.6 10.3 6 15.6-2.4 5.3-4.5 10.5-6 15.5C15.3 75.6 7 69.6 7 64zm28.5 49.3c-4.1-2.4-5.5-9.8-3.8-20.3.3-2.1.8-4.3 1.4-6.6 5.2 1.2 10.7 2 16.5 2.5 3.4 4.8 6.9 9.1 10.4 13-7.4 7.3-14.9 12.3-21 12.3-1.3 0-2.5-.3-3.5-.9zM96.3 93c1.7 10.5.3 17.9-3.8 20.3-1 .6-2.2.9-3.5.9-6 0-13.5-4.9-21-12.3 3.5-3.8 7-8.2 10.4-13 5.8-.5 11.3-1.4 16.5-2.5.6 2.3 1 4.5 1.4 6.6zm9-15.6c-2 .8-4.2 1.5-6.4 2.1-1.6-5-3.6-10.3-6-15.6 2.4-5.3 4.5-10.5 6-15.5 13.8 4 22.1 10 22.1 15.6 0 4.7-5.8 9.7-15.7 13.4z"/></g>
                    </svg>
                    <span>React</span>
                  </div>
                  <div className="tech-slide-item">
                    <img src="https://elysiajs.com/assets/elysia.svg" alt="Elysia" className="tech-icon" />
                    <span>Elysia</span>
                  </div>
                  <div className="tech-slide-item">
                    <svg viewBox="0 0 410 404" className="tech-icon">
                      <path fill="#41D1FF" d="M399.641 59.5246L215.643 388.545C211.844 395.338 202.084 395.378 198.228 388.618L10.5817 59.5563C6.38087 52.1896 12.6802 43.2665 21.0281 44.7586L205.223 77.6824C206.398 77.8924 207.601 77.8904 208.776 77.6763L389.119 44.8058C397.439 43.2894 403.768 52.1434 399.641 59.5246Z"/>
                      <path fill="#9B5BF4" d="M292.965 1.5744L156.801 28.2552C154.563 28.6937 152.906 30.5903 152.771 32.8664L144.395 167.601C144.198 170.947 147.258 173.537 150.51 172.768L189.42 163.257C192.996 162.411 196.177 165.636 195.276 169.199L183.836 213.36C182.901 216.986 186.196 220.216 189.808 219.253L213.853 212.574C217.473 211.608 220.771 214.851 219.82 218.481L201.14 289.221C199.819 294.215 206.493 297.326 209.265 293.007L211.459 289.553L319.831 60.5765C321.684 56.6878 318.105 52.4929 314.073 53.6568L273.388 65.0319C269.665 66.1011 266.424 62.6096 267.633 58.9364L294.948 6.94207C296.146 3.26834 293.094 -0.357573 289.28 0.631257L292.965 1.5744Z"/>
                    </svg>
                    <span>Vite</span>
                  </div>
                  <div className="tech-slide-item">
                    <svg viewBox="0 0 128 128" className="tech-icon">
                      <path fill="#38bdf8" d="M64.004 25.602c-17.067 0-27.73 8.53-32 25.597 6.398-8.531 13.867-11.73 22.398-9.597 4.871 1.214 8.352 4.746 12.207 8.66C72.883 56.629 80.145 64 96.004 64c17.066 0 27.73-8.531 32-25.602-6.399 8.536-13.867 11.735-22.399 9.602-4.87-1.215-8.347-4.746-12.207-8.66-6.27-6.367-13.53-13.738-29.394-13.738zM32.004 64c-17.066 0-27.73 8.531-32 25.602C6.402 81.066 13.87 77.867 22.402 80c4.871 1.215 8.352 4.746 12.207 8.66 6.274 6.367 13.536 13.738 29.395 13.738 17.066 0 27.73-8.53 32-25.597-6.399 8.531-13.867 11.73-22.399 9.597-4.87-1.214-8.347-4.746-12.207-8.66C55.128 71.371 47.868 64 32.004 64z"/>
                    </svg>
                    <span>Tailwind CSS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lower row - moves right */}
          <div className="tech-slider-row">
            <div className="tech-slider-track track-right">
              {[...Array(4)].map((_, i) => (
                <div className="tech-slider-items" key={i}>
                  <div className="tech-slide-item">
                    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" alt="TypeScript" className="tech-icon" />
                    <span>TypeScript</span>
                  </div>
                  <div className="tech-slide-item">
                    <img src="https://bun.sh/logo.svg" alt="Bun" className="tech-icon" />
                    <span>Bun</span>
                  </div>
                  <div className="tech-slide-item">
                    <svg viewBox="0 0 128 128" className="tech-icon">
                      <path fill="#F7DF1E" d="M2 2h124v124H2z"/>
                      <path d="M67.3 106.9c2.5 4.1 5.8 7.1 11.5 7.1 4.8 0 7.9-2.4 7.9-5.7 0-4-1.6-5.4-8.5-7.7-8.3-2.9-13-6.4-13-14 0-7 5.3-12.3 13.7-12.3 5.9 0 10.2 2.1 13.3 7.5l-7.3 4.7c-1.6-2.9-3.3-4-6-4-2.7 0-4.5 1.7-4.5 4 0 2.8 1.7 3.9 7.1 5.6 9.1 3.2 14.4 6.4 14.4 16.1 0 9.5-7.4 14.7-17.4 14.7-9.8 0-16.1-4.7-19.2-10.8l7-4.2zM35.8 107.3c1.9 3.4 3.6 6.2 7.7 6.2 4 0 6.5-1.5 6.5-7.4V74.8h9.7v31.5c0 12.2-7.1 17.7-17.6 17.7-9.4 0-14.9-4.9-17.7-10.8l11.4-5.9z"/>
                    </svg>
                    <span>JavaScript</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="about-mission">
        <div className="section-container">
          <div className="mission-bento">
            <div className="mission-card mission-main">
              <div className="mission-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 8v8M8 12h8"></path>
                </svg>
              </div>
              <h3>Our Mission</h3>
              <p>
                To deliver accessible, high-quality English learning through innovative tools, 
                personalized tutoring, and Web3 features that reward consistency, 
                celebrate progress, and build a thriving global learning community.
              </p>
              <div className="mission-stats">
                <div className="mission-stat">
                  <span className="stat-value">75%</span>
                  <span className="stat-desc">To tutors</span>
                </div>
                <div className="mission-stat">
                  <span className="stat-value">0%</span>
                  <span className="stat-desc">Hidden fees</span>
                </div>
                <div className="mission-stat">
                  <span className="stat-value">24/7</span>
                  <span className="stat-desc">Access</span>
                </div>
              </div>
            </div>
            
            <div className="mission-card mission-vision">
              <div className="mission-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Our Vision</h3>
              <p>
                To become the world's most empowering digital language ecosystem where learners, 
                tutors, and creators connect seamlessly across borders, unlocking global opportunities 
                through education and meaningful human interaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="about-story">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Our Story</span>
            <h2 className="section-title">From Vision to Reality</h2>
          </div>
          
          <div className="story-statement">
            <div className="story-quote-mark">"</div>
            <p className="story-big-text">
              FluentXVerse was born from a simple observation: talented tutors worldwide struggle to 
              reach students who need them most, while learners face barriers to accessing quality, 
              affordable education.
            </p>
          </div>

          <div className="story-content">
            <div className="story-block">
              <p>
                We envisioned a platform where geography doesn't limit opportunity, where a tutor in{" "}
                <span className="highlight-city">Manila</span> can inspire a professional in{" "}
                <span className="highlight-city">Tokyo</span> or <span className="highlight-city">Seoul</span>, 
                where technology rewards dedication, and where every interaction builds toward something bigger than a single lesson.
              </p>
            </div>
            <div className="story-block">
              <p>
                Today, we're building that future. Through innovative technology, transparent practices, 
                and a deep commitment to human connection, FluentXVerse is redefining what's possible 
                in language education.
              </p>
            </div>
          </div>

          <div className="story-highlights">
            <div className="highlight-card">
              <div className="highlight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
                </svg>
              </div>
              <h4>Founded</h4>
              <p>2025</p>
            </div>
            <div className="highlight-card">
              <div className="highlight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <h4>Headquarters</h4>
              <p>Philippines</p>
            </div>
            <div className="highlight-card">
              <div className="highlight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              </div>
              <h4>Focus</h4>
              <p>ESL Education</p>
            </div>
            <div className="highlight-card">
              <div className="highlight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h4>Target Markets</h4>
              <p>Vietnam, Korea, Japan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="about-values">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Our Values</span>
            <h2 className="section-title">What Drives Us Forward</h2>
          </div>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Global Connection</h3>
              <p>Breaking language barriers to connect Filipino tutors with students across Asia, fostering cultural exchange and understanding.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                </svg>
              </div>
              <h3>Innovation</h3>
              <p>Leveraging WebRTC and Web3 technology to deliver personalized, effective language learning experiences.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <h3>Empowerment</h3>
              <p>Ensuring tutors keep up to 75% of their earnings while helping students achieve their language goals with confidence.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3>Community</h3>
              <p>Building a supportive community where tutors and learners grow together through meaningful interactions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="about-team">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Our Team</span>
            <h2 className="section-title">The Minds Behind Fluent<span className="title-x">X</span>Verse</h2>
            <p className="section-description">
              A passionate team of educators, technologists, and innovators working to transform language learning
            </p>
          </div>
          <div className="team-grid">
            <div className="team-card">
              <div className="team-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=face" 
                  alt="Paul Anthony Arriola" 
                  className="team-image"
                />
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="team-linkedin">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              <div className="team-info">
                <h4>Paul Anthony Arriola</h4>
                <p className="team-role">Founder & CEO</p>
                <p className="team-bio">Pioneering the future of digital language education with innovative Web3 solutions.</p>
              </div>
            </div>
            <div className="team-card">
              <div className="team-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=300&fit=crop&crop=face" 
                  alt="Maria Santos" 
                  className="team-image"
                />
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="team-linkedin">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              <div className="team-info">
                <h4>Maria Santos</h4>
                <p className="team-role">Head of Education</p>
                <p className="team-bio">Designing learning experiences that make language acquisition effective and enjoyable.</p>
              </div>
            </div>
            <div className="team-card">
              <div className="team-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=300&fit=crop&crop=face" 
                  alt="James Rodriguez" 
                  className="team-image"
                />
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="team-linkedin">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              <div className="team-info">
                <h4>James Rodriguez</h4>
                <p className="team-role">Chief Technology Officer</p>
                <p className="team-bio">Building scalable infrastructure with WebRTC and modern tech that connects learners and tutors seamlessly.</p>
              </div>
            </div>
            <div className="team-card">
              <div className="team-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=300&fit=crop&crop=face" 
                  alt="Angela Cruz" 
                  className="team-image"
                />
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="team-linkedin">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              <div className="team-info">
                <h4>Angela Cruz</h4>
                <p className="team-role">Community Manager</p>
                <p className="team-bio">Fostering a vibrant community of Filipino tutors and Asian learners across the globe.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer navigateTo={navigateTo} />
    </>
  );
}

function Footer({ navigateTo }: { navigateTo: (page: 'home' | 'about') => void }) {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }} className="logo">
              <img src="/favicon.png" alt="FluentXVerse" className="logo-img" />
              <span className="logo-text">Fluent<span className="brand-x">X</span>Verse</span>
            </a>
            <p>Building the future of language education through technology, community, and human connection.</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Project</h4>
              <ul>
                <li><a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }}>Home</a></li>
                <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about'); }}>About Us</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Platforms</h4>
              <ul>
                <li><a href="https://student.fluentxverse.com" target="_blank" rel="noopener noreferrer">Student Portal</a></li>
                <li><a href="https://tutor.fluentxverse.com" target="_blank" rel="noopener noreferrer">Tutor Portal</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:hello@fluentxverse.com">hello@fluentxverse.com</a></li>
                <li><a href="https://fluentxverse.com">fluentxverse.com</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>All rights reserved © 2026 by FluentXVerse</p>
          <div className="social-links">
            <a href="https://facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://twitter.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;

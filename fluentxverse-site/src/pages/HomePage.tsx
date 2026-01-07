import { Footer } from '../components/Footer';

interface HomePageProps {
  navigateTo: (page: 'home' | 'about') => void;
}

export function HomePage({ navigateTo }: HomePageProps) {
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

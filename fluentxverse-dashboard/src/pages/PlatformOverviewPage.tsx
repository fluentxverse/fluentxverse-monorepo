import './PlatformOverviewPage.css';

const PlatformOverviewPage = () => {
  return (
    <div class="platform-overview-page">
      <div class="page-header">
        <h1>Platform Overview</h1>
        <p class="page-description">
          A high-level view of how the student and tutor apps work end to end.
        </p>
      </div>

      <section class="overview-hero">
        <div class="overview-hero-content">
          <span class="overview-badge">System Flow</span>
          <h2>
            FluentXVerse connects learners and Filipino tutors through real-time sessions,
            structured curriculum, and progress tracking.
          </h2>
          <p>
            The student app is optimized for learning outcomes and engagement. The tutor app is
            optimized for lesson delivery, scheduling, and performance.
          </p>
        </div>
        <div class="overview-hero-panel">
          <div class="hero-panel-item">
            <span class="panel-title">Core Loop</span>
            <p>Discover → Book → Learn → Measure → Retain</p>
          </div>
          <div class="hero-panel-item">
            <span class="panel-title">Primary Markets</span>
            <p>Vietnam, Korea, Japan</p>
          </div>
          <div class="hero-panel-item">
            <span class="panel-title">Tutor Model</span>
            <p>Certified Filipino ESL tutors</p>
          </div>
        </div>
      </section>

      <section class="overview-section">
        <div class="overview-section-header">
          <h2>App Visuals</h2>
          <p>High-level UI snapshots for quick context. Replace with real screenshots anytime.</p>
        </div>
        <div class="overview-visuals">
          <div class="visual-card">
            <div class="visual-header">
              <span class="visual-badge">Student App</span>
              <h3>Learning & Engagement</h3>
            </div>
            <div class="app-mockup student">
              <div class="mockup-top">
                <div class="mockup-dot"></div>
                <div class="mockup-dot"></div>
                <div class="mockup-dot"></div>
              </div>
              <div class="mockup-body">
                <div class="mockup-hero"></div>
                <div class="mockup-row">
                  <div class="mockup-chip"></div>
                  <div class="mockup-chip"></div>
                </div>
                <div class="mockup-card"></div>
                <div class="mockup-card thin"></div>
                <div class="mockup-cta"></div>
              </div>
            </div>
            <p class="visual-caption">Goal setup, booking flow, session room, and progress summary.</p>
          </div>

          <div class="visual-card">
            <div class="visual-header">
              <span class="visual-badge">Tutor App</span>
              <h3>Delivery & Performance</h3>
            </div>
            <div class="app-mockup tutor">
              <div class="mockup-top">
                <div class="mockup-dot"></div>
                <div class="mockup-dot"></div>
                <div class="mockup-dot"></div>
              </div>
              <div class="mockup-body">
                <div class="mockup-hero alt"></div>
                <div class="mockup-row">
                  <div class="mockup-chip"></div>
                  <div class="mockup-chip"></div>
                  <div class="mockup-chip"></div>
                </div>
                <div class="mockup-card"></div>
                <div class="mockup-card thin"></div>
                <div class="mockup-cta alt"></div>
              </div>
            </div>
            <p class="visual-caption">Schedule, lesson tools, session notes, and earnings overview.</p>
          </div>
        </div>
      </section>

      <section class="overview-section">
        <div class="overview-section-header">
          <h2>Student App</h2>
          <p>Designed to remove friction, build consistency, and show measurable progress.</p>
        </div>
        <div class="overview-grid">
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-user-smile-line"></i>
              <h3>Onboarding and Goals</h3>
            </div>
            <p>
              Students set goals, level, and availability. The app matches them with the right
              tutor and curriculum track.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-calendar-check-line"></i>
              <h3>Booking and Scheduling</h3>
            </div>
            <p>
              Students browse tutors, select time slots, and book 1-on-1 sessions. Reminders and
              rescheduling keep attendance high.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-video-chat-line"></i>
              <h3>Live Sessions</h3>
            </div>
            <p>
              WebRTC video lessons with interactive materials, real-time feedback, and lesson notes.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-pulse-line"></i>
              <h3>Progress and Feedback</h3>
            </div>
            <p>
              Session summaries, scores, and growth metrics help students see improvement and stay
              motivated.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-wallet-3-line"></i>
              <h3>Payments and Plans</h3>
            </div>
            <p>
              Transparent pricing, flexible packages, and support for local and crypto payments.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-group-line"></i>
              <h3>Community and Retention</h3>
            </div>
            <p>
              Challenges, milestones, and community touchpoints keep learners engaged over time.
            </p>
          </div>
        </div>
      </section>

      <section class="overview-section">
        <div class="overview-section-header">
          <h2>Tutor App</h2>
          <p>Built for tutor success: stable income, clear performance standards, and growth.</p>
        </div>
        <div class="overview-grid">
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-id-card-line"></i>
              <h3>Qualification and Onboarding</h3>
            </div>
            <p>
              Tutors complete verification, interviews, and certification to ensure consistent
              teaching quality.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-time-line"></i>
              <h3>Availability and Scheduling</h3>
            </div>
            <p>
              Tutors set availability, manage calendars, and accept bookings that match their
              preferences.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-book-open-line"></i>
              <h3>Lesson Delivery</h3>
            </div>
            <p>
              Built-in lesson materials, templates, and activities support efficient, high-quality
              teaching.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-clipboard-line"></i>
              <h3>Session Notes and Reporting</h3>
            </div>
            <p>
              Tutors submit progress notes and evaluations that feed into student analytics.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-bar-chart-grouped-line"></i>
              <h3>Performance and Growth</h3>
            </div>
            <p>
              Ratings, attendance, and outcomes unlock badges, promotions, and better opportunities.
            </p>
          </div>
          <div class="overview-card">
            <div class="overview-card-header">
              <i class="ri-bank-card-line"></i>
              <h3>Earnings and Payouts</h3>
            </div>
            <p>
              Transparent payout tracking, earnings breakdowns, and fast settlement options.
            </p>
          </div>
        </div>
      </section>

      <section class="overview-section">
        <div class="overview-section-header">
          <h2>Data and Operations Loop</h2>
          <p>How the platform stays consistent, measurable, and scalable.</p>
        </div>
        <div class="overview-diagram">
          <div class="diagram-node">
            <div class="node-icon"><i class="ri-user-smile-line"></i></div>
            <span>Students</span>
          </div>
          <div class="diagram-connector"></div>
          <div class="diagram-node">
            <div class="node-icon"><i class="ri-user-voice-line"></i></div>
            <span>Tutors</span>
          </div>
          <div class="diagram-connector"></div>
          <div class="diagram-node">
            <div class="node-icon"><i class="ri-video-chat-line"></i></div>
            <span>Sessions</span>
          </div>
          <div class="diagram-connector"></div>
          <div class="diagram-node">
            <div class="node-icon"><i class="ri-bar-chart-2-line"></i></div>
            <span>Analytics</span>
          </div>
          <div class="diagram-connector"></div>
          <div class="diagram-node">
            <div class="node-icon"><i class="ri-refresh-line"></i></div>
            <span>Retention</span>
          </div>
        </div>
        <div class="overview-flow">
          <div class="flow-step">
            <span class="flow-index">1</span>
            <div>
              <h3>Capture</h3>
              <p>Every session logs attendance, scores, and lesson notes.</p>
            </div>
          </div>
          <div class="flow-step">
            <span class="flow-index">2</span>
            <div>
              <h3>Analyze</h3>
              <p>Performance dashboards highlight trends across students and tutors.</p>
            </div>
          </div>
          <div class="flow-step">
            <span class="flow-index">3</span>
            <div>
              <h3>Improve</h3>
              <p>Curriculum and tutor coaching adjust based on the data.</p>
            </div>
          </div>
          <div class="flow-step">
            <span class="flow-index">4</span>
            <div>
              <h3>Retain</h3>
              <p>Better outcomes drive renewals, referrals, and tutor loyalty.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PlatformOverviewPage;

import { Footer } from '../components/Footer';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
  linkedin: string;
  imagePosition?: string; // Optional: CSS object-position value
}

// ========================================
// TEAM DATA - Edit team members here
// ========================================
const teamMembers: TeamMember[] = [
  {
    name: "Paul Anthony Arriola",
    role: "Founder & CEO",
    bio: "Pioneering the future of digital language education with innovative Web3 solutions.",
    image: "/assets/img/team/paul.webp",
    linkedin: "https://www.linkedin.com/in/paul-anthony-arriola-a0436321b/"
  },
  {
    name: "John Paul Belleza",
    role: "Head of Curriculum Development",
    bio: "Designing learning experiences that make language acquisition effective and enjoyable.",
    image: "/assets/img/team/jp.webp",
    linkedin: "https://www.linkedin.com/in/japalveinz/"
  },
  {
    name: "Jeena Marie Fuentespina",
    role: "Learning Experience Designer",
    bio: "Crafting engaging and intuitive educational journeys for diverse learners.",
    image: "/assets/img/team/jeena.webp",
    linkedin: "https://www.linkedin.com/in/jeena-marie-fuentespina-898659188/"
  },
  {
    name: "Ian Kenneth Soriano",
    role: "Head of Infrastructure and Security",
    bio: "Ensuring a robust, secure, and scalable platform for seamless global learning.",
    image: "/assets/img/team/ian.webp",
    linkedin: "https://www.linkedin.com/in/ian-kenneth-soriano-21011b21a/"    ,
    imagePosition: "center 40%"
  }
];

interface AboutPageProps {
  navigateTo: (page: 'home' | 'about') => void;
}

export function AboutPage({ navigateTo }: AboutPageProps) {
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

      {/* Student Success Obsession Section */}
      <section className="about-commitment">
        <div className="section-container">
          <div className="commitment-content">
            <div className="commitment-header">
              <span className="section-badge">Our Commitment</span>
              <h2 className="section-title">
                Obsessed with Your
                <span className="gradient-text"> English Growth</span>
              </h2>
              <p className="commitment-lead">
                We don't just teach English—we engineer breakthroughs. Every feature, every lesson, 
                every interaction is meticulously designed with one singular focus: making you fluent, confident, and unstoppable.
              </p>
            </div>

            <div className="commitment-grid">
              <div className="commitment-card commitment-featured">
                <div className="commitment-icon-large">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                </div>
                <h3>Data-Driven Progress</h3>
                <p>
                  Advanced analytics track your speaking fluency, pronunciation accuracy, vocabulary growth, 
                  and comprehension speed in real-time. We measure every metric that matters so you can see 
                  tangible improvements week by week.
                </p>
                <div className="commitment-metrics">
                  <div className="metric-badge">
                    <span className="metric-icon">📊</span>
                    <span>Real-time Analytics</span>
                  </div>
                  <div className="metric-badge">
                    <span className="metric-icon">🎯</span>
                    <span>Personalized Insights</span>
                  </div>
                </div>
              </div>

              <div className="commitment-card">
                <div className="commitment-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <h3>1-on-1 Expert Tutoring</h3>
                <p>
                  No group classes, no distractions. Just you and a dedicated tutor who adapts to your 
                  learning style, identifies your weak spots, and pushes you to breakthrough moments.
                </p>
              </div>

              <div className="commitment-card">
                <div className="commitment-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h3>24/7 Learning Access</h3>
                <p>
                  Practice whenever inspiration strikes. Our platform and tutors are available around the 
                  clock to ensure nothing stops your momentum.
                </p>
              </div>

              <div className="commitment-card">
                <div className="commitment-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <h3>Instant Feedback Loop</h3>
                <p>
                  Get immediate corrections on pronunciation, grammar, and fluency. Our AI-powered system 
                  combined with tutor expertise ensures you never practice mistakes.
                </p>
              </div>

              <div className="commitment-card">
                <div className="commitment-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <h3>Zero Hidden Costs</h3>
                <p>
                  Transparent pricing, no surprise fees. Pay for results, not bureaucracy. 
                  Your investment goes directly to your learning success.
                </p>
              </div>

              <div className="commitment-card">
                <div className="commitment-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                  </svg>
                </div>
                <h3>Gamified Milestones</h3>
                <p>
                  Earn rewards, track streaks, and unlock achievements as you progress. 
                  We make fluency feel like an adventure, not a chore.
                </p>
              </div>
            </div>

            <div className="commitment-promise">
              <div className="promise-content">
                <div className="promise-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div className="promise-text">
                  <h4>Our Promise to You</h4>
                  <p>
                    If you're consistent and we're not delivering measurable results, we're failing. 
                    That's why we obsess over every detail—from curriculum design to platform performance—
                    because your English fluency is our mission, not just our business.
                  </p>
                </div>
              </div>
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
            {teamMembers.map((member, index) => (
              <div className="team-card" key={index}>
                <div className="team-image-wrapper">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="team-image"
                    loading="lazy"
                    decoding="async"
                    style={member.imagePosition ? { objectPosition: member.imagePosition } : undefined}
                  />
                  <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="team-linkedin">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </div>
                <div className="team-info">
                  <h4>{member.name}</h4>
                  <p className="team-role">{member.role}</p>
                  <p className="team-bio">{member.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer navigateTo={navigateTo} />
    </>
  );
}

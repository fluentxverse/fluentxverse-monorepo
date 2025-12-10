import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import './AboutUsPage.css';

const AboutUsPage = () => {
  useEffect(() => {
    document.title = 'About Us | FluentXVerse';
  }, []);

  return (
    <>
      <Header />
      <div className="about-us-wrapper">
        {/* Hero Section */}
        <section className="about-hero-section">
          <div className="about-wave-top"></div>
          <div className="about-organic-shape shape-peach"></div>
          <div className="about-organic-shape shape-yellow"></div>
          <div className="about-organic-shape shape-green"></div>
          
          <div className="container">
            <div className="about-hero-content">
              <span className="about-hero-badge">
                <i className="fas fa-globe-americas"></i>
                Connecting Learners Worldwide
              </span>
              <h1 className="about-hero-title">About Us</h1>
              <p className="about-hero-subtitle">
                Building bridges through language, empowering futures through technology
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="about-mission-section">
          <div className="about-wave-divider"></div>
          <div className="about-organic-bg shape-green-right"></div>
          
          <div className="container">
            <div className="about-content-grid">
              <div className="about-text-content">
                <span className="about-label">OUR MISSION</span>
                <h2 className="about-section-title">
                  Empowering Global Learners Through Innovation
                </h2>
                <p className="about-description">
                  To deliver accessible, high-quality English learning through innovative tools, personalized tutoring, and responsible Web3 features that reward consistency, celebrate progress, and build a thriving, global learning community.
                  We aim to support working professionals, and elevate ESL education with transparency, trust, and technology that feels human.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="about-vision-section">
          <div className="about-wave-divider-bottom"></div>
          <div className="about-organic-bg shape-green-left"></div>
          <div className="about-organic-bg shape-peach-right"></div>
          
          <div className="container">
            <div className="about-content-grid reverse">
              <div className="about-image-content">
                <div className="about-image-wrapper">
                  <img 
                    src="/assets/img/banner/about_hero.png" 
                    alt="FluentXVerse Team" 
                    className="about-team-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<div class="image-placeholder"><i class="fas fa-users"></i></div>';
                    }}
                  />
                </div>
              </div>
              
              <div className="about-text-content">
                <span className="about-label">OUR VISION</span>
                <h2 className="about-section-title">
                  The World's Most Empowering Digital Language Ecosystem
                </h2>
                <p className="about-description">
                  To become the world's most empowering digital language ecosystem where learners, tutors, and creators connect seamlessly across borders, unlocking global opportunities through education, technology, and meaningful human interaction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="about-values-section">
          <div className="about-wave-top-alt"></div>
          <div className="about-organic-bg shape-yellow-center"></div>
          
          <div className="container">
            <div className="about-values-header">
              <span className="about-label">OUR VALUES</span>
              <h2 className="about-section-title centered">What Drives Us Forward</h2>
            </div>

            <div className="about-values-grid">
              <div className="about-value-card">
                <div className="value-icon">
                  <i className="fas fa-globe"></i>
                </div>
                <h3>Global Connection</h3>
                <p>Breaking language barriers to connect tutors and students worldwide, fostering cultural exchange and understanding.</p>
              </div>

              <div className="about-value-card">
                <div className="value-icon">
                  <i className="fas fa-lightbulb"></i>
                </div>
                <h3>Innovation</h3>
                <p>Leveraging cutting-edge technology to deliver personalized, effective language learning experiences.</p>
              </div>

              <div className="about-value-card">
                <div className="value-icon">
                  <i className="fas fa-heart"></i>
                </div>
                <h3>Empowerment</h3>
                <p>Empowering tutors to share their expertise while helping students achieve their language goals with confidence.</p>
              </div>

              <div className="about-value-card">
                <div className="value-icon">
                  <i className="fas fa-users"></i>
                </div>
                <h3>Community</h3>
                <p>Building a supportive community where tutors grow together through meaningful interactions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section className="about-story-section">
          <div className="about-wave-divider-story"></div>
          <div className="about-organic-bg shape-blue-story"></div>
          
          <div className="container">
            <div className="about-story-content">
              <div className="about-story-text">
                <span className="about-label">OUR STORY</span>
                <h2 className="about-section-title">From Vision to Reality</h2>
                <p className="about-description">
                  FluentXVerse was born from a simple observation: talented tutors worldwide struggle to reach students who need them most, while learners face barriers to accessing quality, affordable education.
                </p>
                <p className="about-description">
                  We envisioned a platform where geography doesn't limit opportunity—where a tutor in Manila can inspire a professional in Tokyo or Seoul, where Web3 technology rewards dedication, and where every interaction builds toward something bigger than a single lesson.
                </p>
                <p className="about-description">
                  Today, we're building that future. Through innovative technology, transparent practices, and a deep commitment to human connection, FluentXVerse is redefining what's possible in language education.
                </p>
              </div>
              
              <div className="about-story-highlights">
                <div className="story-highlight-card">
                  <div className="highlight-icon">
                    <i className="fas fa-rocket"></i>
                  </div>
                  <div className="highlight-content">
                    <h4>Founded</h4>
                    <p>2025</p>
                  </div>
                </div>
                
                <div className="story-highlight-card">
                  <div className="highlight-icon">
                    <i className="fas fa-map-marked-alt"></i>
                  </div>
                  <div className="highlight-content">
                    <h4>Headquarters</h4>
                    <p>Philippines</p>
                  </div>
                </div>
                
                <div className="story-highlight-card">
                  <div className="highlight-icon">
                    <i className="fas fa-award"></i>
                  </div>
                  <div className="highlight-content">
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
        <section className="about-cta-section">
          <div className="about-organic-bg shape-peach-bottom"></div>
          
          <div className="container">
            <div className="about-cta-content">
              <h2>Ready to Make a Difference?</h2>
              <p>Join our community of passionate tutors and help students achieve their English learning goals.</p>
              <a href="/register" className="about-cta-btn">
                <span>Become a Tutor</span>
                <i className="fas fa-arrow-right"></i>
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};

export default AboutUsPage;

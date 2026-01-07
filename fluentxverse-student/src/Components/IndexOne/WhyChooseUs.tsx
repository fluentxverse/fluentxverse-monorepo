import './WhyChooseUs.css';

const WhyChooseUs = () => {
  const features = [
    {
      icon: 'fas fa-user-graduate',
      title: 'Professional Tutors',
      description: 'Learn from certified, experienced tutors who are passionate about teaching. Our rigorous selection ensures you get effective, engaging lessons every time.',
      highlight: 'Certified & Vetted',
      color: 'purple'
    },
    {
      icon: 'fas fa-calendar-check',
      title: 'Flexible Scheduling',
      description: 'Book lessons that fit your life. Choose from hundreds of available time slots across different time zones. Reschedule anytime with no penalties.',
      highlight: '24/7 Availability',
      color: 'green'
    },
    {
      icon: 'fas fa-wallet',
      title: 'Flexible Payment',
      description: 'No subscriptions or commitments. Buy tickets when you need them—they never expire. Pay only for lessons you take, with no hidden fees.',
      highlight: 'No Subscriptions',
      color: 'orange'
    }
  ];

  return (
    <section className="why-choose-section">
      {/* Floating decorations */}
      <div className="why-decoration why-decoration--1"></div>
      <div className="why-decoration why-decoration--2"></div>
      <div className="why-decoration why-decoration--3"></div>

      <div className="why-choose-container">
        <div className="why-choose-header">
          <span className="why-badge">✨ Why FluentXVerse</span>
          <h2 className="why-title">
            Everything You Need to <span className="why-title-highlight">Succeed</span>
          </h2>
          <p className="why-subtitle">
            We've built the most student-friendly English learning platform with tools designed for your success
          </p>
        </div>

        {/* Featured Progress Tracking Card */}
        <div className="featured-progress-card">
          <div className="featured-card-header">
            <div className="featured-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="featured-title-group">
              <span className="featured-badge">Weekly Reports</span>
              <h3 className="featured-title">Smart Progress Tracking</h3>
            </div>
          </div>
          <p className="featured-description">
            Our AI-powered system measures your weekly progress with detailed metrics. Get personalized reports showing vocabulary growth, fluency improvements, and achievement milestones.
          </p>
          <div className="progress-stats">
            <div className="progress-stat">
              <span className="stat-number">All levels</span>
              <span className="stat-label">from beginner to advanced welcome</span>
            </div>
            <div className="stat-divider"></div>
            <div className="progress-stat">
              <span className="stat-number">3 months</span>
              <span className="stat-label">average time to hold basic conversations</span>
            </div>
            <div className="stat-divider"></div>
            <div className="progress-stat">
              <span className="stat-number">100%</span>
              <span className="stat-label">supportive learning environment</span>
            </div>
          </div>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className={`feature-card ${feature.color}`}>
              <div className={`feature-icon-wrapper ${feature.color}`}>
                <i className={feature.icon}></i>
              </div>
              <div className="feature-content">
                <span className={`feature-highlight ${feature.color}`}>{feature.highlight}</span>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;

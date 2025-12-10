import './CallToAction.css';

const CallToAction = () => {
  return (
    <section className="cta-section">
      <div className="cta-organic-shape shape-blue-1"></div>
      <div className="cta-organic-shape shape-blue-2"></div>
      
      <div className="container">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Your Teaching Journey?</h2>
          <p className="cta-description">
            Join FluentXVerse today and become part of a growing community of Filipino tutors making a difference in ESL education.
          </p>
          <div className="cta-buttons">
            <a href="/register" className="home-cta-btn primary">
              Apply as a Tutor
            </a>
            <a href="/become-tutor" className="home-cta-btn secondary">
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;

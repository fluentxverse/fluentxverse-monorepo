import './CTASection.css'

const CTASection = () => {
  return (
    <section className="cta-section">
      <div className="cta-container">
        <div className="cta-panel">
          <div className="cta-copy">
            <p className="cta-kicker">Ready?</p>
            <h2 className="cta-title">Start Your English Journey</h2>
            <p className="cta-subtitle">
              Join focused lessons, flexible tickets, and tutor-led practice built to help you speak with confidence.
            </p>
          </div>

          <div className="cta-actions">
            <div className="cta-buttons">
              <a href="/auth" className="cta-btn cta-btn-primary">
                <i className="fas fa-rocket"></i>
                <span>Get Started Free</span>
              </a>
              <a href="/browse-tutors" className="cta-btn cta-btn-secondary">
                <i className="fas fa-search"></i>
                <span>Browse Tutors</span>
              </a>
            </div>
            <p className="cta-note">
              <i className="fas fa-check-circle"></i>
              <span>No credit card required. Free trial available.</span>
            </p>
          </div>

          <div className="cta-visual" aria-hidden="true">
            <div className="cta-ticket">
              <span>Trial</span>
              <strong>Free</strong>
            </div>
            <div className="cta-orbit cta-orbit--one"></div>
            <div className="cta-orbit cta-orbit--two"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTASection

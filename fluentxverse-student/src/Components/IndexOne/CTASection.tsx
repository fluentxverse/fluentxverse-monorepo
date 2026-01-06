import './CTASection.css'

const CTASection = () => {
  return (
    <section className="cta-section">
      <div className="cta-container">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Your English Journey?</h2>
          <p className="cta-subtitle">
            Join thousands of students improving their English with native tutors. 
            Your first lesson is just a click away.
          </p>
          <div className="cta-buttons">
            <a href="/auth" className="cta-btn-primary">
              <i className="fas fa-rocket"></i>
              Get Started Free
            </a>
            <a href="/browse-tutors" className="cta-btn-secondary">
              <i className="fas fa-search"></i>
              Browse Tutors
            </a>
          </div>
          <p className="cta-note">
            <i className="fas fa-check-circle"></i>
            No credit card required • Free trial available
          </p>
        </div>
      </div>
    </section>
  )
}

export default CTASection

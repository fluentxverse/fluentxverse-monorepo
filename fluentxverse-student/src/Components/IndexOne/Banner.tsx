import React from 'react'
import './Banner.css'

const Banner = () => {
  return (
    <section className="hero-section">
      <div className="hero-image-wrapper">
        <div className="hero-image-bg"></div>
        <img 
          src="/assets/img/banner/banner_man.png" 
          alt="Become an ESL Tutor" 
          className="hero-image"
        />
      </div>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 col-md-12">
            <div className="hero-content">
              <span className="hero-badge">Join Our Teaching Community</span>
              <h1 className="hero-title">
                Teach English <span className="highlight">Online</span> on Your Terms
              </h1>
              <p className="hero-text">
                Work from anywhere, set your own hours. No commute, no boss, no minimum hours just you and your students.
              </p>
              <div className="hero-buttons">
                <a href="/register" className="cta-button primary">
                  Apply Now
                  <i className="fas fa-arrow-right"></i>
                </a>
                <a href="/about" className="cta-button secondary">
                  Learn More
                  <i className="fas fa-info-circle"></i>
                </a>
              </div>
              <div className="hero-features">
                <div className="feature-badge">
                  <i className="fas fa-money-bill-wave"></i>
                  <span><strong>Earn</strong> at your pace</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-clock"></i>
                  <span><strong>Flexible</strong> Schedule</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-globe-americas"></i>
                  <span><strong>Work</strong> Remotely</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Banner
import React from 'react'
import './Banner.css'

const Banner = () => {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-image-wrapper" aria-hidden="true">
        <div className="hero-image-bg"></div>
        <picture>
          <source srcSet="/assets/img/banner/banner_man.webp" type="image/webp" />
          <img 
            src="/assets/img/banner/banner_man.png" 
            alt="" 
            className="hero-image"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </div>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 col-md-12">
            <div className="hero-content">
              <span className="hero-badge" aria-hidden="true">Join Our Teaching Community</span>
              <h1 id="hero-title" className="hero-title">
                Teach English <span className="highlight">Online</span> on Your Terms
              </h1>
              <p className="hero-text">
                Work from anywhere, set your own hours. No commute, no boss, no minimum hours just you and your students.
              </p>
              <div className="hero-buttons" role="group" aria-label="Call to action buttons">
                <a href="/register" className="cta-button primary">
                  Apply Now
                  <i className="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
                <a href="/about" className="cta-button secondary">
                  Learn More
                  <i className="fas fa-info-circle" aria-hidden="true"></i>
                </a>
              </div>
              <div className="hero-features" role="list" aria-label="Key benefits">
                <div className="feature-badge" role="listitem">
                  <i className="fas fa-money-bill-wave" aria-hidden="true"></i>
                  <span><strong>Earn</strong> at your pace</span>
                </div>
                <div className="feature-badge" role="listitem">
                  <i className="fas fa-clock" aria-hidden="true"></i>
                  <span><strong>Flexible</strong> Schedule</span>
                </div>
                <div className="feature-badge" role="listitem">
                  <i className="fas fa-globe-americas" aria-hidden="true"></i>
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
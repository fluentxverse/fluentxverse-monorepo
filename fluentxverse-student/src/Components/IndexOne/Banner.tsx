import React from 'react'
import './Banner.css'

const Banner = () => {
  return (
    <section className="hero-section">
      <div className="hero-image-wrapper">
        <div className="hero-image-bg"></div>
        <img 
          src="/assets/img/banner/banner_woman.png" 
          alt="Learn English Online" 
          className="hero-image"
        />
      </div>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 col-md-12">
            <div className="hero-content">
              <span className="hero-badge">
                <i className="fas fa-graduation-cap"></i>
                Start Your Learning Journey
              </span>
              <h1 className="hero-title">
                Master <span className="highlight">English</span> with Expert Tutors
              </h1>
              <p className="hero-text">
                Connect with qualified ESL tutors. Learn at your own pace with lessons tailored to your goals and schedule.
              </p>
              <div className="hero-buttons">
                <a href="/browse-tutors" className="cta-button primary">
                  Find Your Tutor
                  <i className="fas fa-search"></i>
                </a>
                <a href="/register" className="cta-button secondary">
                  Start Your Free Trial
                  <i className="fas fa-arrow-right"></i>
                </a>
              </div>
              <div className="hero-features">
                <div className="feature-badge">
                  <i className="fas fa-user-graduate"></i>
                  <span><strong>1-on-1</strong> Lessons</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-calendar-check"></i>
                  <span><strong>Flexible</strong> Scheduling</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-certificate"></i>
                  <span><strong>Certified</strong> Tutors</span>
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
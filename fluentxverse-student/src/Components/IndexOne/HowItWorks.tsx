import { h } from 'preact';
import './HowItWorks.css';

const HowItWorks = () => {
  return (
    <section className="how-it-works">
      <div className="how-it-works__container">
        {/* Decorative elements */}
        <div className="how-it-works__decoration how-it-works__decoration--1"></div>
        <div className="how-it-works__decoration how-it-works__decoration--2"></div>
        
        <div className="how-it-works__content">
          <div className="how-it-works__badge">
            <span className="how-it-works__badge-icon">🚀</span>
            <span>Simple & Easy</span>
          </div>
          
          <h2 className="how-it-works__title">
            How It <span className="how-it-works__highlight">Works</span>
          </h2>
          
          <p className="how-it-works__description">
            Start your English learning journey in just three simple steps. 
            No complicated setup, no long commitments — just effective learning.
          </p>
          
          <div className="how-it-works__steps">
            {/* Step 1 - Book */}
            <div className="how-it-works__step">
              <div className="how-it-works__step-number">1</div>
              <div className="how-it-works__step-icon">
                <i className="fas fa-calendar-check"></i>
              </div>
              <div className="how-it-works__step-content">
                <h3>Book</h3>
                <p>Browse our certified tutors and schedule a lesson that fits your availability.</p>
              </div>
            </div>
            
            {/* Connector */}
            <div className="how-it-works__connector">
              <div className="how-it-works__connector-line"></div>
              <i className="fas fa-chevron-right"></i>
            </div>
            
            {/* Step 2 - Learn */}
            <div className="how-it-works__step how-it-works__step--featured">
              <div className="how-it-works__step-number">2</div>
              <div className="how-it-works__step-icon">
                <i className="fas fa-video"></i>
              </div>
              <div className="how-it-works__step-content">
                <h3>Learn</h3>
                <p>Join live video lessons with your tutor. Practice speaking, listening, and more.</p>
              </div>
            </div>
            
            {/* Connector */}
            <div className="how-it-works__connector">
              <div className="how-it-works__connector-line"></div>
              <i className="fas fa-chevron-right"></i>
            </div>
            
            {/* Step 3 - Progress */}
            <div className="how-it-works__step">
              <div className="how-it-works__step-number">3</div>
              <div className="how-it-works__step-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="how-it-works__step-content">
                <h3>Progress</h3>
                <p>Track your improvement with detailed feedback and celebrate your milestones.</p>
              </div>
            </div>
          </div>
          
          <div className="how-it-works__cta">
            <a href="/register" className="how-it-works__button">
              Get Started Now
              <i className="fas fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

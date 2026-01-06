import { h } from 'preact';
import './BeginnerWelcome.css';

const BeginnerWelcome = () => {
  return (
    <section className="beginner-welcome">
      <div className="beginner-welcome__container">
        {/* Decorative elements */}
        <div className="beginner-welcome__decoration beginner-welcome__decoration--1"></div>
        <div className="beginner-welcome__decoration beginner-welcome__decoration--2"></div>
        
        <div className="beginner-welcome__content">
          <div className="beginner-welcome__badge">
            <span className="beginner-welcome__badge-icon">🌱</span>
            <span>Everyone Starts Somewhere</span>
          </div>
          
          <h2 className="beginner-welcome__title">
            New to English?
            <span className="beginner-welcome__highlight"> You're Welcome Here!</span>
          </h2>
          
          <p className="beginner-welcome__description">
            Whether you're saying "Hello" for the first time or building confidence to speak fluently, 
            FluentXVerse is designed for learners at every level. Our patient, certified tutors 
            specialize in helping beginners overcome the fear of speaking and build a strong foundation.
          </p>
          
          <div className="beginner-welcome__features">
            {/* Featured Card */}
            <div className="beginner-welcome__featured-card">
              <div className="beginner-welcome__featured-icon">
                <i className="fas fa-heart"></i>
              </div>
              <div className="beginner-welcome__featured-content">
                <h3>Patient & Supportive</h3>
                <p>Our tutors understand that learning takes time. No judgment, just encouragement and personalized guidance every step of the way.</p>
              </div>
              <div className="beginner-welcome__featured-decoration"></div>
            </div>
            
            {/* Regular Feature Cards */}
            <div className="beginner-welcome__features-grid">
              <div className="beginner-welcome__feature">
                <div className="beginner-welcome__feature-icon">
                  <i className="fas fa-tachometer-alt"></i>
                </div>
                <div className="beginner-welcome__feature-content">
                  <h3>Learn at Your Pace</h3>
                  <p>Go slow or speed up — lessons adapt to your comfort level and learning style.</p>
                </div>
              </div>
              
              <div className="beginner-welcome__feature">
                <div className="beginner-welcome__feature-icon">
                  <i className="fas fa-comments"></i>
                </div>
                <div className="beginner-welcome__feature-content">
                  <h3>Speak from Day One</h3>
                  <p>Practice real conversations in a safe environment. Making mistakes is how we learn!</p>
                </div>
              </div>
              
              <div className="beginner-welcome__feature">
                <div className="beginner-welcome__feature-icon">
                  <i className="fas fa-chart-line"></i>
                </div>
                <div className="beginner-welcome__feature-content">
                  <h3>Track Your Progress</h3>
                  <p>See how far you've come with personalized feedback and achievement milestones.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="beginner-welcome__cta">
            <a href="/register" className="beginner-welcome__button beginner-welcome__button--primary">
              <i className="fas fa-gift"></i>
              Try a Free Lesson
              <i className="fas fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BeginnerWelcome;

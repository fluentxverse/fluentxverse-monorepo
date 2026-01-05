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
            <div className="beginner-welcome__feature">
              <div className="beginner-welcome__feature-icon">
                <i className="fas fa-heart"></i>
              </div>
              <div className="beginner-welcome__feature-content">
                <h3>Patient & Supportive</h3>
                <p>Our tutors understand that learning takes time. No judgment, just encouragement.</p>
              </div>
            </div>
            
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
          
          <div className="beginner-welcome__stats">
            <div className="beginner-welcome__stat">
              <span className="beginner-welcome__stat-number">85%</span>
              <span className="beginner-welcome__stat-label">of our students started as beginners</span>
            </div>
            <div className="beginner-welcome__stat-divider"></div>
            <div className="beginner-welcome__stat">
              <span className="beginner-welcome__stat-number">3 months</span>
              <span className="beginner-welcome__stat-label">average time to hold basic conversations</span>
            </div>
            <div className="beginner-welcome__stat-divider"></div>
            <div className="beginner-welcome__stat">
              <span className="beginner-welcome__stat-number">100%</span>
              <span className="beginner-welcome__stat-label">supportive learning environment</span>
            </div>
          </div>
          
          <div className="beginner-welcome__cta">
            <a href="/browse-tutors" className="beginner-welcome__button beginner-welcome__button--primary">
              <i className="fas fa-rocket"></i>
              Start Your Journey
            </a>
            <a href="/register" className="beginner-welcome__button beginner-welcome__button--secondary">
              Try a Free Lesson
              <i className="fas fa-arrow-right"></i>
            </a>
          </div>
          
          <div className="beginner-welcome__testimonial">
            <div className="beginner-welcome__testimonial-quote">
              <i className="fas fa-quote-left"></i>
              <p>"I couldn't say more than 'thank you' in English. After 2 months with FluentXVerse, I had my first full conversation with a native speaker. The tutors made me feel comfortable even when I made mistakes!"</p>
            </div>
            <div className="beginner-welcome__testimonial-author">
              <div className="beginner-welcome__testimonial-avatar">K</div>
              <div className="beginner-welcome__testimonial-info">
                <span className="beginner-welcome__testimonial-name">Kim Ji-yeon</span>
                <span className="beginner-welcome__testimonial-level">Started as Complete Beginner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BeginnerWelcome;

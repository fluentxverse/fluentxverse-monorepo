import HomeIllustration from './HomeIllustration';
import './HowItWorks.css';

const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Apply Online',
      description: 'Fill out a simple application form. Share your background, availability, and passion for teaching.',
      illustration: 'home',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
    },
    {
      number: '02',
      title: 'Get Assessed',
      description: 'Complete a brief English proficiency check and a short demo lesson with our team.',
      illustration: 'community',
      gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
    },
    {
      number: '03',
      title: 'Get Certified',
      description: 'Access our exclusive training modules and earn your FluentXVerse teaching certification.',
      illustration: 'training',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
    },
    {
      number: '04',
      title: 'Start Earning',
      description: 'Set your own hours, connect with students worldwide, and grow your teaching career.',
      illustration: 'growth',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
    }
  ] as const;

  return (
    <section className="how-it-works-section">
      <div className="how-it-works-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      
      <div className="container">
        <div className="how-it-works-header">
          <span className="how-it-works-badge">Your Journey</span>
          <h2 className="how-it-works-title">How It Works</h2>
          <p className="how-it-works-subtitle">
            Join thousands of tutors earning on their own terms. Getting started is easy.
          </p>
        </div>
        
        <div className="steps-timeline">
          <div className="timeline-connector"></div>
          
          {steps.map((step, index) => (
            <div className={`step-card ${index % 2 === 1 ? 'step-card-alt' : ''}`} key={index}>
              <div className="step-card-inner">
                <div className="step-number" style={{ background: step.gradient }}>
                  {step.number}
                </div>
                <div className="step-icon-box">
                  <HomeIllustration name={step.illustration} />
                </div>
                <div className="step-content">
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
                <div className="step-glow" style={{ background: step.gradient }}></div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="step-connector-dot" style={{ background: step.gradient }}></div>
              )}
            </div>
          ))}
        </div>
        
        <div className="how-it-works-cta">
          <a href="/register" className="how-it-works-btn">
            <span>Begin Your Journey</span>
            <i className="fas fa-arrow-right"></i>
          </a>
          <p className="cta-note">Free to join • No commitments</p>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

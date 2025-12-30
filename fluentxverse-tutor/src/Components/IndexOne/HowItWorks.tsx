import './HowItWorks.css';

const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Apply Online',
      description: 'Fill out our simple application form. Tell us about yourself, your teaching experience, and why you want to join FluentXVerse.',
      icon: 'fas fa-file-alt'
    },
    {
      number: '02',
      title: 'Take the Assessment',
      description: 'Complete our English proficiency test and teaching demonstration. Show us your communication skills and teaching style.',
      icon: 'fas fa-tasks'
    },
    {
      number: '03',
      title: 'Get Certified',
      description: 'Pass our certification program and receive your FluentXVerse Tutor Badge. Access free training materials to sharpen your skills.',
      icon: 'fas fa-certificate'
    },
    {
      number: '04',
      title: 'Start Teaching',
      description: 'Set your schedule, connect with students, and start earning. Our platform handles bookings, payments, and support.',
      icon: 'fas fa-chalkboard-teacher'
    }
  ];

  return (
    <section className="how-it-works-section">
      <div className="how-it-works-bg"></div>
      
      <div className="container">
        <div className="how-it-works-header">
          <span className="how-it-works-badge">Getting Started</span>
          <h2 className="how-it-works-title">How It Works</h2>
          <p className="how-it-works-subtitle">
            Four simple steps to launch your online teaching career with FluentXVerse
          </p>
        </div>
        
        <div className="steps-container">
          <div className="steps-line"></div>
          
          {steps.map((step, index) => (
            <div className={`step-item ${index % 2 === 1 ? 'reverse' : ''}`} key={index}>
              <div className="step-content">
                <div className="step-number">{step.number}</div>
                <div className="step-icon">
                  <i className={step.icon}></i>
                </div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
              <div className="step-connector">
                <div className="connector-dot"></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="how-it-works-cta">
          <a href="/register" className="how-it-works-btn">
            Start Your Application
            <i className="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

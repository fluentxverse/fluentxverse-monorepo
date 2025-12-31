import './HowItWorks.css';

const HowItWorks = () => {
  const steps = [
    {
      number: '1',
      title: 'Apply',
      description: 'Submit your application with basic info and teaching background.',
      icon: 'fas fa-user-plus'
    },
    {
      number: '2',
      title: 'Assess',
      description: 'Complete a quick English test and demo lesson.',
      icon: 'fas fa-clipboard-check'
    },
    {
      number: '3',
      title: 'Train',
      description: 'Access free certification and teaching resources.',
      icon: 'fas fa-graduation-cap'
    },
    {
      number: '4',
      title: 'Teach',
      description: 'Set your schedule and start earning.',
      icon: 'fas fa-chalkboard-teacher'
    }
  ];

  return (
    <section className="how-it-works-section">
      <div className="container">
        <div className="how-it-works-header">
          <h2 className="how-it-works-title">Start Teaching in 4 Simple Steps</h2>
        </div>
        
        <div className="steps-row">
          {steps.map((step, index) => (
            <div className="step-card" key={index}>
              <div className="step-number-circle">
                <span>{step.number}</span>
              </div>
              <div className="step-icon-wrapper">
                <i className={step.icon}></i>
              </div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
              {index < steps.length - 1 && (
                <div className="step-arrow">
                  <i className="fas fa-chevron-right"></i>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="how-it-works-cta">
          <a href="/register" className="how-it-works-btn">
            Get Started Now
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

import './BenefitsSection.css';

const BenefitsSection = () => {
  const benefits = [
    {
      icon: 'fas fa-clock',
      title: 'Flexible Schedule',
      description: 'Set your own hours and work when it suits you. Early bird or night owl, you decide your teaching schedule.'
    },
    {
      icon: 'fas fa-home',
      title: 'Work From Home',
      description: 'No commute, no office politics. Teach from the comfort of your home or anywhere with a stable internet connection.'
    },
    {
      icon: 'fas fa-wallet',
      title: 'Competitive Pay',
      description: 'Earn competitive rates for your expertise. The more you teach, the more you earn, with transparent payouts.'
    },
    {
      icon: 'fas fa-graduation-cap',
      title: 'Free Training',
      description: 'Access our comprehensive training materials and certification program at no cost. We invest in your growth.'
    },
    {
      icon: 'fas fa-users',
      title: 'Supportive Community',
      description: 'Join a network of Filipino tutors. Share tips, get support, and grow together with fellow educators.'
    },
    {
      icon: 'fas fa-chart-line',
      title: 'Career Growth',
      description: 'Advance from tutor to senior tutor, mentor, or trainer. Build a real career in online ESL education.'
    }
  ];

  return (
    <section className="benefits-section">
      <div className="benefits-bg-shape shape-1"></div>
      <div className="benefits-bg-shape shape-2"></div>
      
      <div className="container">
        <div className="benefits-header">
          <span className="benefits-badge">Why Join Us</span>
          <h2 className="benefits-title">Perks of Teaching with FluentXVerse</h2>
          <p className="benefits-subtitle">
            We believe great tutors deserve great benefits. Here's what you get when you join our team.
          </p>
        </div>
        
        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <div className="benefit-card" key={index}>
              <div className="benefit-icon">
                <i className={benefit.icon}></i>
              </div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;

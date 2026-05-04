import './PricingSection.css';

const pricingPlans = [
  {
    type: 'basic',
    title: 'Basic Ticket',
    tagline: 'General English Lessons',
    price: '$6',
    accent: 'Blue Pass',
    icon: 'fas fa-ticket-alt',
    features: ['Standard tutors', '25-minute lessons', 'General lesson materials', 'Tickets never expire'],
  },
  {
    type: 'premium',
    title: 'Premium Ticket',
    tagline: 'All Tutors + Certified Premium',
    price: '$9',
    accent: 'Top Pick',
    icon: 'fas fa-crown',
    features: ['Access all tutors', 'Certified premium tutors', 'Premium lesson materials', 'Tickets never expire'],
  },
];

const PricingSection = () => {
  return (
    <section className="pricing-section" id="pricing">
      <div className="pricing-container">
        <div className="pricing-header">
          <p className="pricing-kicker">Pricing</p>
          <h2 className="pricing-title">Choose Your Learning Path</h2>
          <p className="pricing-subtitle">Simple tickets. No subscriptions. Learn at your own pace.</p>
        </div>

        <div className="pricing-cards" aria-label="Lesson ticket options">
          {pricingPlans.map((plan) => (
            <article className={`pricing-card pricing-card--${plan.type}`} key={plan.title}>
              <div className="pricing-card__accent">{plan.accent}</div>

              <div className="pricing-card__header">
                <div className="pricing-card__icon">
                  <i className={plan.icon}></i>
                </div>
                <div>
                  <h3>{plan.title}</h3>
                  <span>{plan.tagline}</span>
                </div>
              </div>

              <div className="pricing-card__price">
                <strong>{plan.price}</strong>
                <span>per ticket</span>
              </div>

              <ul className="pricing-card__features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <i className="fas fa-check-circle"></i>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pricing-card__ticket" aria-hidden="true">
                <div className="ticket-face">
                  <span>{plan.type === 'premium' ? 'Premium' : 'Basic'}</span>
                  <strong>{plan.price}</strong>
                </div>
                <div className="ticket-spark ticket-spark--one"></div>
                <div className="ticket-spark ticket-spark--two"></div>
              </div>
            </article>
          ))}
        </div>

        <div className="pricing-trial-banner">
          <div className="trial-copy">
            <span>Free Trial</span>
            <strong>New here?</strong>
            <p>Get a free trial ticket to experience a lesson before purchasing.</p>
          </div>
          <a href="/register" className="trial-btn">
            <span>Start Free Trial</span>
            <i className="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

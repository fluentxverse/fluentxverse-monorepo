import './PricingSection.css';

const PricingSection = () => {
  return (
    <section className="pricing-section">
      <div className="pricing-container">
        <div className="pricing-header">
          <span className="pricing-badge">💎 Pricing</span>
          <h2 className="pricing-title">Choose Your Learning Path</h2>
          <p className="pricing-subtitle">Simple tickets. No subscriptions. Learn at your own pace.</p>
        </div>

        <div className="pricing-cards">
          <div className="pricing-card basic">
            <div className="card-header">
              <div className="card-icon basic-icon">
                <i className="fas fa-ticket-alt"></i>
              </div>
              <div className="card-title-group">
                <h3>Basic Ticket</h3>
                <span className="card-tagline">General English Lessons</span>
              </div>
            </div>
            <div className="card-price">
              <span className="price-amount">$6</span>
              <span className="price-unit">per ticket</span>
            </div>
            <ul className="card-features">
              <li><i className="fas fa-check-circle"></i> Standard tutors</li>
              <li><i className="fas fa-check-circle"></i> 25-minute lessons</li>
              <li><i className="fas fa-check-circle"></i> General lesson materials</li>
              <li><i className="fas fa-check-circle"></i> Tickets never expire</li>
            </ul>
          </div>

          <div className="pricing-card premium">
            <div className="popular-badge">Most Popular</div>
            <div className="card-header">
              <div className="card-icon premium-icon">
                <i className="fas fa-crown"></i>
              </div>
              <div className="card-title-group">
                <h3>Premium Ticket</h3>
                <span className="card-tagline">All Tutors + Certified Premium</span>
              </div>
            </div>
            <div className="card-price">
              <span className="price-amount">$9</span>
              <span className="price-unit">per ticket</span>
            </div>
            <ul className="card-features">
              <li><i className="fas fa-star"></i> Access all tutors</li>
              <li><i className="fas fa-star"></i> Certified premium tutors</li>
              <li><i className="fas fa-star"></i> Premium lesson materials</li>
              <li><i className="fas fa-star"></i> Tickets never expire</li>
            </ul>
          </div>
        </div>

        <div className="pricing-trial-banner">
          <div className="trial-content">
            <div className="trial-icon">🎁</div>
            <div className="trial-text">
              <strong>New here?</strong> Get a free trial ticket to experience a lesson before purchasing.
            </div>
            <a href="/register" className="trial-btn">
              Start Free Trial <i className="fas fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

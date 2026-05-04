import './WhyChooseUs.css';

const successFeatures = [
  {
    title: 'Professional Tutors',
    description:
      'Learn from certified, experienced tutors selected for clear lessons, useful feedback, and student-first coaching.',
    visual: 'tutors',
  },
  {
    title: 'Flexible Scheduling',
    description:
      'Book lessons around your routine with available slots across time zones and simple rescheduling when plans change.',
    visual: 'schedule',
  },
  {
    title: 'Smart Progress Tracking',
    description:
      'See vocabulary growth, fluency gains, and weekly learning milestones with reports that make improvement visible.',
    visual: 'progress',
  },
  {
    title: 'Flexible Payment',
    description:
      'Buy tickets only when you need them. No subscriptions, no hidden fees, and no wasted lessons.',
    visual: 'tickets',
  },
];

const WhyChooseUs = () => {
  return (
    <section className="why-choose-section" id="why-choose">
      <div className="why-choose-container">
        <div className="why-choose-header">
          <h2 className="why-title">Everything You Need To Succeed</h2>
          <p className="why-with">WITH...</p>
        </div>

        <div className="success-card-grid" aria-label="Student success features">
          {successFeatures.map((feature) => (
            <article className={`success-card success-card--${feature.visual}`} key={feature.title}>
              <div className="success-card__copy">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>

              <div className={`success-card__visual success-card__visual--${feature.visual}`} aria-hidden="true">
                {feature.visual === 'tutors' && (
                  <div className="mini-leaderboard mini-leaderboard--tutors">
                    <div className="mini-leaderboard__title">Tutors</div>
                    <div className="mini-leaderboard__row">
                      <span className="rank rank--gold">1</span>
                      <span className="avatar avatar--blue">A</span>
                      <span>Anna</span>
                      <strong>4.9</strong>
                    </div>
                    <div className="mini-leaderboard__row">
                      <span className="rank rank--silver">2</span>
                      <span className="avatar avatar--teal">M</span>
                      <span>Mark</span>
                      <strong>4.8</strong>
                    </div>
                    <div className="mini-leaderboard__row">
                      <span className="rank rank--bronze">3</span>
                      <span className="avatar avatar--pink">J</span>
                      <span>Jean</span>
                      <strong>4.8</strong>
                    </div>
                    <div className="flame-badge">
                      <i className="fas fa-fire"></i>
                    </div>
                  </div>
                )}

                {feature.visual === 'schedule' && (
                  <div className="mini-schedule">
                    <div className="mini-schedule__header">
                      <span>Today</span>
                      <strong>3 Slots</strong>
                    </div>
                    <div className="mini-schedule__slot mini-schedule__slot--active">09:00</div>
                    <div className="mini-schedule__slot">14:30</div>
                    <div className="mini-schedule__slot">20:00</div>
                  </div>
                )}

                {feature.visual === 'progress' && (
                  <div className="mini-progress">
                    <div className="points-chip points-chip--large">+50</div>
                    <div className="points-chip points-chip--wide">+300</div>
                    <div className="points-chip points-chip--small">+25</div>
                    <span className="spark spark--one"></span>
                    <span className="spark spark--two"></span>
                    <span className="spark spark--three"></span>
                  </div>
                )}

                {feature.visual === 'tickets' && (
                  <div className="mini-ticket-stack">
                    <div className="ticket-avatar ticket-avatar--one">
                      <i className="fas fa-ticket-alt"></i>
                    </div>
                    <div className="ticket-avatar ticket-avatar--two">
                      <i className="fas fa-wallet"></i>
                    </div>
                    <div className="ticket-avatar ticket-avatar--three">
                      <i className="fas fa-star"></i>
                    </div>
                    <span className="ticket-multiplier ticket-multiplier--two">x2</span>
                    <span className="ticket-multiplier ticket-multiplier--three">x3</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;

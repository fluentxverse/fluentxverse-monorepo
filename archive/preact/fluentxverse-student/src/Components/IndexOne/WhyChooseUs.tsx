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
                <img className="success-art" src={`/assets/img/home-icons/${feature.visual === 'tutors' ? 'community' : feature.visual === 'schedule' ? 'schedule' : feature.visual === 'progress' ? 'growth' : 'pay'}-v1.webp`} alt="" width="144" height="144" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;

import { Fragment } from 'preact';
import './HowItWorks.css';

const steps = [
  {
    number: '01',
    label: 'Book',
    icon: 'fas fa-calendar-check',
    description: 'Pick a tutor and reserve the lesson time that fits your day.',
    meta: 'Choose your slot',
  },
  {
    number: '02',
    label: 'Learn',
    icon: 'fas fa-video',
    description: 'Join your live class and practice speaking, listening, and real conversation.',
    meta: 'Live 1-on-1 class',
  },
  {
    number: '03',
    label: 'Progress',
    icon: 'fas fa-chart-line',
    description: 'Review feedback, track gains, and keep building confidence every week.',
    meta: 'Weekly growth',
  },
];

const HowItWorks = () => {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works__container">
        <div className="how-it-works__header">
          <p className="how-it-works__kicker">Start In Three Steps</p>
          <h2 className="how-it-works__title">How It Works</h2>
        </div>

        <div className="how-it-works__steps" aria-label="How FluentXVerse lessons work">
          {steps.map((step, index) => (
            <Fragment key={step.number}>
              <article className={`how-it-works__step how-it-works__step--${index + 1}`} key={step.number}>
                <div className="how-it-works__step-number">{step.number}</div>
                <div className="how-it-works__step-icon">
                  <i className={step.icon}></i>
                </div>
                <div className="how-it-works__step-content">
                  <span>{step.meta}</span>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
              </article>

              {index < steps.length - 1 && (
                <div className="how-it-works__connector" aria-hidden="true">
                  <span></span>
                  <i className="fas fa-chevron-right"></i>
                </div>
              )}
            </Fragment>
          ))}
        </div>

        <div className="how-it-works__cta">
          <a href="/register" className="how-it-works__button">
            <span>Get Started Now</span>
            <i className="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

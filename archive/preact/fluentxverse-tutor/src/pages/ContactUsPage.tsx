import TutorIcon from "../Components/Common/TutorIcon";
import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import HomeIllustration from '../Components/IndexOne/HomeIllustration';
import ContactIllustration from '../Components/InnerPages/ContactIllustration';
import './ContactUsPage.css';

const questions = [
  { icon: 'training', title: 'How do I become a tutor?', answer: 'Start your application using the Apply Now button below. You will need to complete a short interview process.' },
  { icon: 'schedule', title: 'What are the working hours?', answer: 'You set your own schedule. Choose the hours that work best for you and your students.' },
  { icon: 'pay', title: 'How do I get paid?', answer: 'Payments are processed weekly. You can receive payments through a bank or digital wallet.' },
  { icon: 'home', title: 'What equipment do I need?', answer: 'A stable internet connection, a computer or laptop with a webcam, and a quiet teaching environment.' },
] as const;

const ContactUsPage = () => {
  useEffect(() => { document.title = 'Contact Us | FluentXVerse'; }, []);

  return (
    <>
      <Header showThemeSwitch={false} />
      <main className="contact-us-page-wrapper">
        <div className="container">
          <header className="contact-us-page-header">
            <div className="contact-us-icon-wrapper"><HomeIllustration name="community" loading="eager" /></div>
            <div>
              <span className="contact-label">FLUENTXVERSE SUPPORT</span>
              <h1>Contact Us</h1>
              <p>We're here to help you succeed.</p>
            </div>
          </header>

          <section className="contact-cards-grid" aria-label="Contact options">
            <article className="contact-card">
              <div className="contact-card-icon"><ContactIllustration name="email" /></div>
              <div className="contact-card-content">
                <h2>Email support</h2>
                <p className="contact-value">support@fluentxverse.com</p>
                <p className="contact-description">Questions about your application or tutor account? Send our team a message.</p>
              </div>
              <a href="mailto:support@fluentxverse.com" className="contact-card-btn">
                <TutorIcon name="fas fa-envelope" aria-hidden="true" /> Send Email
              </a>
            </article>
            <article className="contact-card">
              <div className="contact-card-icon"><ContactIllustration name="phone" /></div>
              <div className="contact-card-content">
                <h2>Viber</h2>
                <p className="contact-value contact-unavailable">Not available yet</p>
                <p className="contact-description">Please use email support while our Viber contact is being set up.</p>
              </div>
              <button className="contact-card-btn" type="button" disabled>
                <TutorIcon name="fab fa-viber" aria-hidden="true" /> Viber unavailable
              </button>
            </article>
          </section>

          <section className="contact-faq-section" aria-labelledby="contact-faq-title">
            <div className="contact-section-header">
              <span className="contact-label">QUICK ANSWERS</span>
              <h2 id="contact-faq-title">Frequently Asked Questions</h2>
              <p>A few things you might be wondering.</p>
            </div>
            <div className="contact-faq-grid">
              {questions.map(question => (
                <article className="contact-faq-card" key={question.icon}>
                  <div className="contact-faq-icon"><HomeIllustration name={question.icon} /></div>
                  <h3>{question.title}</h3>
                  <p>{question.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="contact-cta-section">
          <div className="container contact-cta-content">
            <div className="contact-cta-icon"><HomeIllustration name="training" /></div>
            <div className="contact-cta-text">
              <h2>Ready to Start Teaching?</h2>
              <p>Join our community of tutors and help students around the world improve their English skills.</p>
            </div>
            <a className="contact-card-btn" href="/register">Apply Now <TutorIcon name="fas fa-arrow-right" aria-hidden="true" /></a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default ContactUsPage;

import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import './ContactUsPage.css';

const ContactUsPage = () => {
  useEffect(() => {
    document.title = 'Contact Us | FluentXVerse';
  }, []);

  const handleApplyNow = () => {
    window.location.href = '/register';
  };

  return (
    <>
      <Header />
      <div className="contact-us-page-wrapper">
        {/* Background Decorations */}
        <div className="contact-bg-decoration">
          <div className="circle circle-1"></div>
          <div className="circle circle-2"></div>
          <div className="circle circle-3"></div>
          <div className="circle circle-4"></div>
          <div className="circle circle-5"></div>
          <div className="line line-1"></div>
          <div className="line line-2"></div>
          <div className="line line-3"></div>
          <div className="line line-4"></div>
          <div className="line line-5"></div>
          <div className="dot-grid"></div>
          <div className="dot-grid-2"></div>
          <div className="dot-grid-3"></div>
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
        </div>

        <div className="contact-us-page">
          <div className="container">
            {/* Page Header */}
            <div className="contact-us-page-header">
              <div className="contact-us-page-title">
                <div className="contact-us-icon-wrapper">
                  <i className="fas fa-headset"></i>
                </div>
                <div>
                  <h1>Contact Us</h1>
                  <p>We're here to help you succeed</p>
                </div>
              </div>
            </div>

            {/* Contact Cards */}
            <div className="contact-cards-grid">
              {/* Viber Card */}
              <div className="contact-card">
                <div className="contact-card-icon viber">
                  <i className="fab fa-viber"></i>
                </div>
                <div className="contact-card-content">
                  <h3>Viber</h3>
                  <p className="contact-value">+63 XXX XXX XXXX</p>
                  <p className="contact-description">Chat with us on Viber for quick responses</p>
                </div>
                <a href="viber://chat?number=%2B63XXXXXXXXXX" className="contact-card-btn">
                  <i className="fab fa-viber"></i>
                  Message on Viber
                </a>
              </div>

              {/* Email Card */}
              <div className="contact-card">
                <div className="contact-card-icon email">
                  <i className="fas fa-envelope"></i>
                </div>
                <div className="contact-card-content">
                  <h3>Email</h3>
                  <p className="contact-value">support@fluentxverse.com</p>
                  <p className="contact-description">Send us an email and we'll respond within 24 hours</p>
                </div>
                <a href="mailto:support@fluentxverse.com" className="contact-card-btn">
                  <i className="fas fa-envelope"></i>
                  Send Email
                </a>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="contact-faq-section">
              <div className="section-header">
                <div className="section-icon">
                  <i className="fas fa-question-circle"></i>
                </div>
                <div>
                  <h2>Frequently Asked Questions</h2>
                  <p>Quick answers to common questions</p>
                </div>
              </div>

              <div className="faq-grid">
                <div className="faq-card">
                  <div className="faq-icon">
                    <i className="fas fa-user-plus"></i>
                  </div>
                  <h4>How do I become a tutor?</h4>
                  <p>Click the "Apply Now" button below to start your application. You'll need to complete a short interview process.</p>
                </div>

                <div className="faq-card">
                  <div className="faq-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <h4>What are the working hours?</h4>
                  <p>You set your own schedule! Choose the hours that work best for you and your students.</p>
                </div>

                <div className="faq-card">
                  <div className="faq-icon">
                    <i className="fas fa-money-bill-wave"></i>
                  </div>
                  <h4>How do I get paid?</h4>
                  <p>Payments are processed weekly. You can receive payments via bank digital wallets.</p>
                </div>

                <div className="faq-card">
                  <div className="faq-icon">
                    <i className="fas fa-laptop"></i>
                  </div>
                  <h4>What equipment do I need?</h4>
                  <p>A stable internet connection, a computer or laptop with a webcam, and a quiet teaching environment.</p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="contact-cta-section">
              <div className="cta-content">
                <div className="cta-icon">
                  <i className="fas fa-chalkboard-teacher"></i>
                </div>
                <div className="cta-text">
                  <h2>Ready to Start Teaching?</h2>
                  <p>Join our community of tutors and help students around the world improve their English skills.</p>
                </div>
                <button className="cta-btn" onClick={handleApplyNow}>
                  <span>Apply Now</span>
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ContactUsPage;

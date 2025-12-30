import React from 'react';
import './Contact.css';

const Contact = () => {

  return (
    <>
      <section className="about-hero-v2"></section>
      <section className="contact-section">
        <div className="contact-header">
          <h1>Contact Us</h1>

        </div>
        <div className="contact-content-row compact">
          <div className="contact-info-card">
            <h2>Get in Touch</h2>
            <ul className="contact-info-list">
              <li><i className="fas fa-envelope"></i> <a href="mailto:support@fluentxverse.com">support@fluentxverse.com</a></li>
              <li><i className="fas fa-map-marker-alt"></i> Goa, Camarines Sur, Philippines</li>
            </ul>
            <h3 className="social-heading">Connect With Us</h3>
            <div className="contact-social">
              <a href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><i className="fab fa-twitter" /></a>
              <a href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
              <a href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i className="fab fa-linkedin-in" /></a>
            </div>
            <div className="contact-map">
              <iframe
                title="FluentXVerse Location"
                src="https://www.openstreetmap.org/export/embed.html?bbox=123.45710%2C13.68728%2C123.47710%2C13.70728&layer=mapnik"
                style={{ border: 0, width: '100%', height: '200px', borderRadius: '20px', minHeight: '200px' }}
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </div>
          {/* Message form is currently disabled */}
        </div>
        <div className="contact-faq compact-faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list compact-faq-list">
            <div className="faq-item">
              <h3>How can I become a tutor on FluentXVerse?</h3>
              <p>Visit our "Become a Tutor" page and complete the application process. We welcome passionate language educators from around the world.</p>
            </div>
            <div className="faq-item">
              <h3>Where is FluentXVerse based?</h3>
              <p>We are headquartered in Bicol, Philippines, but our platform connects learners and tutors globally.</p>
            </div>
            <div className="faq-item">
              <h3>How soon will I get a response?</h3>
              <p>We aim to respond to all inquiries within 24-48 hours.</p>
            </div>
          </div>
        </div>

      </section>
    </>
  );
};

export default Contact;

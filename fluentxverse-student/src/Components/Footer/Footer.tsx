import './Footer.css'

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="landing-footer">
      <div className="footer-top-wrap">
        <div className="container">
          <div className="row justify-content-between">
            <div className="col-xl-4 col-lg-4 col-md-5 col-sm-9">
              <div className="footer-widget footer-about-widget">
                <div className="footer-logo mb-25">
                  <a href="/" className="footer-brand-lockup" aria-label="FluentXVerse home">
                    <span className="footer-brand-icon" aria-hidden="true">
                      <img src="/assets/img/logo/icon_logo.png" alt="" width="40" height="40" />
                    </span>
                    <span className="logo-text">
                      Fluent<span className="brand-x">X</span>Verse
                    </span>
                  </a>
                </div>
                <p>
                  Connecting talented Filipino tutors with students across Asia through innovative technology and meaningful human connection.
                </p>
                <div className="footer-social-links">
                  <a href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="X">
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>𝕏</span>
                  </a>
                  <a href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="Facebook">
                    <i className="fab fa-facebook-f"></i>
                  </a>
                  <a href="https://www.youtube.com/@fluentxverse" target="_blank" rel="noopener noreferrer" title="YouTube">
                    <i className="fab fa-youtube"></i>
                  </a>
                </div>
              </div>
            </div>
            <div className="col-lg-2 col-md-3 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Quick Links</h4>
                <ul className="fw-links">
                  <li><a href="/browse-tutors">Find Tutors</a></li>
                  <li><a href="/materials">Materials</a></li>
                  <li><a href="/tickets">Tickets</a></li>
                  <li><a href="/contact">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-4 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Contact Us</h4>
                <ul className="fw-links contact-info">
                  <li>
                    <a href="mailto:support@fluentxverse.com">support@fluentxverse.com</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="copyright-wrap">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6">
              <div className="copyright-text">
                <p>© {currentYear} FluentXVerse. All rights reserved.</p>
              </div>
            </div>
            <div className="col-md-6">
              <ul className="copyright-link-list">
                <li><a href="/privacy-policy">Privacy Policy</a></li>
                <li><a href="/terms-of-service">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

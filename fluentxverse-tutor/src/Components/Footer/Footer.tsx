import React from 'react'
import './Footer.css'

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer>
      <div className="footer-top-wrap">
        <div className="container">
          <div className="row justify-content-between">
            <div className="col-xl-4 col-lg-4 col-md-6 col-sm-12">
              <div className="footer-widget">
                <div className="footer-logo mb-25">
                  <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="assets/img/logo/icon_logo.png" alt="FluentXVerse" />
                    <div className="footer-brand-text"><span className="brand-fluent">Fluent</span><span className="brand-xverse">XVerse</span></div>
                  </a>
                </div>
                <p style={{ marginBottom: '20px', color: '#666', lineHeight: '1.6' }}>
                  Empowering language learners worldwide through innovative technology and dedicated tutors.
                </p>
                <p className="footer-email">Email us:<br />
                  <a href="mailto:support@fluentxverse.com" style={{ color: '#0245ae', textDecoration: 'underline' }}>
                    support@fluentxverse.com
                  </a>
                </p>
                <ul className="footer-social">
                  <li><a href="https://facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#0245ae', color: '#fff' }}><i className="fab fa-facebook-f" /></a></li>
                  <li><a href="https://twitter.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#0245ae', color: '#fff' }}><i className="fab fa-twitter" /></a></li>
                  <li><a href="https://linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#0245ae', color: '#fff' }}><i className="fab fa-linkedin-in" /></a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-2 col-md-3 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Platform</h4>
                <ul className="fw-links">
                  <li><a href="/">Home</a></li>
                  <li><a href="/about">About Us</a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-2 col-md-3 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Support</h4>
                <ul className="fw-links">
                  <li><a href="/contact">Contact Us</a></li>
                  {/* <li><a href="/faq">FAQ</a></li>
                  <li><a href="/help">Help Center</a></li>
                  <li><a href="/feedback">Feedback</a></li> */}
                </ul>
              </div>
            </div>
            <div className="col-lg-2 col-md-3 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Resources</h4>
                <ul className="fw-links">
                  {/* <li><a href="/blog">Blog</a></li>
                  <li><a href="/learning-resources">Learning Tips</a></li> */}
                  <li><a href="/become-tutor">Become a Tutor</a></li>
                  {/* <li><a href="/community">Community</a></li> */}
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
                <p>All rights reserved © {currentYear} by <a href="/">FluentXVerse</a></p>
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

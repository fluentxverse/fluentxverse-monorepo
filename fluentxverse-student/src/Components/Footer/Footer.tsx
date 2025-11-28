import React from 'react'
import './Footer.css'

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer>
      <div className="footer-top-wrap">
        <div className="container">
          <div className="row justify-content-between">
            <div className="col-xl-3 col-lg-4 col-md-5 col-sm-9">
              <div className="footer-widget">
                <div className="footer-logo mb-25">
                  <a href="/"><img src="assets/img/logo/logo.png" alt="" /></a>
                </div>
                <p className="footer-email">Email us:<br />
                  <a href="mailto:hello@decentragri.com" style={{ color: 'var(--purple-color)', textDecoration: 'underline' }}>
                    hello@decentragri.com
                  </a>
                </p>
                <ul className="footer-social">
                  <li><a href="https://x.com/decentragri" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-twitter" /></a></li>
                  <li><a href="https://www.facebook.com/profile.php?id=61577572165938" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-facebook-f" /></a></li>
                  {/* <li><a href="https://www.linkedin.com/in/decentragri-a598bb36b/" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-linkedin-in" /></a></li> */}
                  <li><a href="https://www.youtube.com/@decentragri" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-youtube" /></a></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-2 col-md-3 col-sm-6">
              <div className="footer-widget">
                <h4 className="fw-title">Navigation</h4>
                <ul className="fw-links">
                  <li><a href="/">Home</a></li>
                  <li><a href="/farms">Farms</a></li>
                  <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                  <li><a href="/about">About</a></li>
                  <li><a href="/contact">Contact</a></li>
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
                <p>All rights reserved © {currentYear} by <a href="/">Decentragri</a></p>
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
      <div className="moving-text-banner">
        <div className="moving-text-container">
          <div className="moving-text">
            <span>Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • Agriculture Web3-Powered • </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

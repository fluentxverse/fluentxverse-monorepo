interface FooterProps {
  navigateTo: (page: 'home' | 'about') => void;
}

export function Footer({ navigateTo }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }} className="logo">
              <img src="/favicon.png" alt="FluentXVerse" className="logo-img" />
              <span className="logo-text">Fluent<span className="brand-x">X</span>Verse</span>
            </a>
            <p>Building the future of language education through technology, community, and human connection.</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Project</h4>
              <ul>
                <li><a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }}>Home</a></li>
                <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about'); }}>About Us</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Platforms</h4>
              <ul>
                <li><a href="https://student.fluentxverse.com" target="_blank" rel="noopener noreferrer">Student Portal</a></li>
                <li><a href="https://tutor.fluentxverse.com" target="_blank" rel="noopener noreferrer">Tutor Portal</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:hello@fluentxverse.com">hello@fluentxverse.com</a></li>
                <li><a href="https://fluentxverse.com">fluentxverse.com</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>All rights reserved © 2026 by FluentXVerse</p>
          <div className="social-links">
            <a href="https://facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://twitter.com/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

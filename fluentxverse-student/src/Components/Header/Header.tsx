import { useEffect, useCallback, useState } from 'preact/hooks';
import { useAuthContext } from '../../context/AuthContext';
import { SocialLoginModal } from '../Auth/SocialLoginModal';

import "./Header.css";


const Header = () => {
  const { isAuthenticated } = useAuthContext();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Handler to open mobile menu
  const openMobileMenu = useCallback(() => {
    document.body.classList.add('mobile-menu-visible');
  }, []);

  // Handler to close mobile menu
  const closeMobileMenu = useCallback(() => {
    document.body.classList.remove('mobile-menu-visible');
  }, []);

  // Handler to open login modal
  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
    document.body.style.overflow = 'hidden';
  }, []);

  // Handler to close login modal
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
    document.body.style.overflow = 'unset';
  }, []);

  const handleLoginSuccess = useCallback(() => {
    // Redirect to home after successful login
    window.location.href = '/home';
  }, []);

  useEffect(() => {
    // Sticky header on scroll
    const handleScroll = () => {
      const scroll = window.scrollY;
      const stickyHeader = document.getElementById('sticky-header');
      const headerTopFixed = document.getElementById('header-top-fixed');
      const scrollToTarget = document.querySelector('.scroll-to-target');
      if (scroll < 245) {
        stickyHeader && stickyHeader.classList.remove('sticky-menu');
        scrollToTarget && scrollToTarget.classList.remove('open');
        headerTopFixed && headerTopFixed.classList.remove('header-fixed-position');
      } else {
        stickyHeader && stickyHeader.classList.add('sticky-menu');
        scrollToTarget && scrollToTarget.classList.add('open');
        headerTopFixed && headerTopFixed.classList.add('header-fixed-position');
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Scroll to target
    const scrollToTargetBtn = document.querySelector('.scroll-to-target');
    const handleScrollToTarget = (e: any) => {
      const target = (e.currentTarget as HTMLElement).getAttribute('data-target');
      const el = target ? document.querySelector(target) as HTMLElement | null : null;
      if (el) {
      window.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    };
    if (scrollToTargetBtn) {
      scrollToTargetBtn.addEventListener('click', handleScrollToTarget);
    }

    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollToTargetBtn) {
        scrollToTargetBtn.removeEventListener('click', handleScrollToTarget);
      }
    };
  }, [isAuthenticated]);


 




  return (
    <header>
      <div id='sticky-header' className="menu-area ">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div
                className="mobile-nav-toggler"
                onClick={openMobileMenu}
                role="button"
                tabIndex={0}
                aria-label="Open mobile menu"
                  onKeyPress={(e: any) => { if (e.key === 'Enter' || e.key === ' ') openMobileMenu(); }}
              >
                <i className="fas fa-bars" />
              </div>
              <div className="menu-wrap main-menu">
                <nav className="menu-nav">
                  <div className="logo"><a href="/#"><img src="assets/img/logo/icon_logo.png" alt="" /></a></div>
                  <div className="brand-text">
                    FluentXVerse
                  </div>
                  <div className="navbar-wrap push-menu main-menu d-none d-lg-flex">
                    <ul className="navigation">
                      <li><a href={isAuthenticated ? "/home" : "/"}>Home</a></li>
                      <li><a href="/browse-tutors">Browse Tutors</a></li>
                      {/* <li><a href="/farms">Farms</a></li>
                      <li><a href="/tree-nfts">Trees</a></li>
                      <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                      <li><a href="/about">About</a></li>
                      <li><a href="/contact">Contact</a></li> */}
                    </ul>
                  </div>
                  {!isAuthenticated && (
                    <div className="header-action d-none d-md-block">
                      <ul>
                        <li className="header-login">
                          <button 
                            className="login-btn" 
                            onClick={openLoginModal}
                            aria-label="Login"
                          >
                            <i className="fas fa-user"></i>
                            <span>Login</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </nav>
              </div>
              {/* Mobile Menu  */}
              <div className="mobile-menu">
                <nav className="menu-box">
                  <div
                    className="close-btn"
                    onClick={closeMobileMenu}
                    role="button"
                    tabIndex={0}
                    aria-label="Close mobile menu"
                    onKeyPress={(e: any) => { if (e.key === 'Enter' || e.key === ' ') closeMobileMenu(); }}
                  >
                    <i className="fas fa-times" />
                  </div>
                  <div className="nav-logo"><a href="/#"></a>
                  </div>
                  <div className="menu-outer">
                    <div className="mobile-menu-header">
                      <div className="mobile-logo">
                        <img src="assets/img/logo/icon_logo.png" alt="FluentXVerse" /> <div className="brand-text">FLUENTXVERSE</div>
                      </div>
                    </div>
                    
                    <nav className="mobile-nav">
                      <ul className="navigation">
                        <li>
                          <a href={isAuthenticated ? "/home" : "/"} onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-home" />
                            <span>Home</span>
                          </a>
                        </li>
                        <li>
                          <a href="/farms" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-seedling" />
                            <span>Farms</span>
                          </a>
                        </li>
                        <li>
                          <a href="/tree-nfts" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-tree" />
                            <span>Trees</span>
                          </a>
                        </li>
                        <li>
                          <a 
                            href="https://decentragri.gitbook.io/decentragri.com/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={closeMobileMenu}
                            className="nav-link"
                          >
                            <i className="fas fa-file-alt" />
                            <span>Whitepaper</span>
                          </a>
                        </li>
                        <li>
                          <a href="/about" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-info-circle" />
                            <span>About</span>
                          </a>
                        </li>
                        <li>
                          <a href="/contact" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-envelope" />
                            <span>Contact</span>
                          </a>
                        </li>
                      </ul>
                    </nav>
                    

                  </div>
                  <div className="social-links">
                    <h4 className="social-links-title">Follow us on:</h4>
                    <ul>
                      <li><a href="https://x.com/decentragri" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-twitter" /></a></li>
                      <li><a href="https://www.facebook.com/profile.php?id=61577572165938" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-facebook-f" /></a></li>
                      <li><a href="https://www.linkedin.com/in/decentr-agri-a598bb36b/" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-linkedin-in" /></a></li>
                      <li><a href="https://www.youtube.com/@decentragri" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><i className="fab fa-youtube" /></a></li>
                    </ul>
                  </div>
                </nav>
              </div>
              <div className="menu-backdrop" onClick={closeMobileMenu} />
              {/* End Mobile Menu */}
            </div>
          </div>
        </div>
      </div>

      {/* Social Login Modal */}
      <SocialLoginModal
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        onSuccess={handleLoginSuccess}
      />
    </header>
  )
}

export default Header
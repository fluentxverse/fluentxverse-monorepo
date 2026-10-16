import TutorIcon from "../Common/TutorIcon";
import { useEffect, useCallback, useState } from 'preact/hooks';
import { Link } from 'wouter';
import { useAuthContext } from '../../context/AuthContext';
import TutorDialog from "../Common/TutorDialog";
import LoginModal from "../InnerPages/LoginModal";
import ThemeSwitch from '../Common/ThemeSwitch';
import "./Header.css";

interface HeaderProps {
  showThemeSwitch?: boolean;
}

const Header = ({ showThemeSwitch = false }: HeaderProps) => {
  const { isAuthenticated } = useAuthContext();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Handler to open mobile menu
  const openMobileMenu = useCallback(() => {
    setShowMobileMenu(true);
  }, []);

  // Handler to close mobile menu
  const closeMobileMenu = useCallback(() => {
    setShowMobileMenu(false);
  }, []);

  // Handler to open login modal
  const openLoginModal = useCallback(() => {
    if (isAuthenticated) { window.location.href = '/home'; return; }
    setShowLoginModal(true);
  }, [isAuthenticated]);

  // Handler to close login modal
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
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
    interface ScrollToTargetEvent extends React.MouseEvent<HTMLElement> {
      currentTarget: HTMLElement & { getAttribute(attr: string): string | null };
    }

    const handleScrollToTarget = (e: Event | ScrollToTargetEvent) => {
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
                onKeyPress={e => { if (e.key === 'Enter' || e.key === ' ') openMobileMenu(); }}
              >
                <TutorIcon name="fas fa-bars" />
              </div>
              <div className="menu-wrap main-menu">
                <nav className="menu-nav">
                  <div className="logo"><a href="/#"><img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" width="40" height="40" /></a></div>
                  <div className="brand-text">
                    Fluent<span className="brand-x">X</span>Verse
                  </div>
                  <div className="navbar-wrap push-menu main-menu d-none d-lg-flex">
                    <ul className="navigation">
                      <li><Link to="/">Home</Link></li>
                      <li><Link to="/about">About</Link></li>
                      <li><Link to="/contact">Contact</Link></li>

                      {/* <li><Link to="/farms">Farms</Link></li>
                      <li><Link to="/tree-nfts">Trees</Link></li>
                      <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                      <li><Link to="/about">About</Link></li>
                      <li><Link to="/contact">Contact</Link></li> */}
                    </ul>
                  </div>
                  <div className="header-action d-none d-md-block">
                    <ul>
                      {showThemeSwitch && (
                        <li className="header-theme-switch">
                          <ThemeSwitch size="sm" />
                        </li>
                      )}
                      <li className="header-login">
                        <button 
                          className="login-btn" 
                          onClick={openLoginModal}
                          aria-label={isAuthenticated ? "My workspace" : "Login"}
                        >
                          <TutorIcon name="fas fa-user" />
                          <span>{isAuthenticated ? "My workspace" : "Login"}</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </nav>
              </div>
              {/* Mobile Menu  */}
              {showMobileMenu && <TutorDialog className="tutor-public-menu" label="Navigation" onClose={closeMobileMenu}>
              <div className="mobile-menu">
                <nav className="menu-box">
                  <div
                    className="close-btn"
                    onClick={closeMobileMenu}
                    role="button"
                    tabIndex={0}
                    aria-label="Close mobile menu"
                    onKeyPress={e => { if (e.key === 'Enter' || e.key === ' ') closeMobileMenu(); }}
                  >
                    <TutorIcon name="fas fa-times" />
                  </div>
                  <div className="nav-logo"><a href="/#"></a>
                  </div>
                  <div className="menu-outer">
                    <div className="mobile-menu-header">
                      <div className="mobile-logo">
                        <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" width="32" height="32" /> <div className="brand-text">Fluent<span className="brand-x">X</span>Verse</div>
                      </div>
                    </div>
                    
                    <nav className="mobile-nav">
                      <ul className="navigation">
                        <li>
                          <Link to="/" onClick={closeMobileMenu} className="nav-link">
                            <TutorIcon name="fas fa-home" />
                            <span>Home</span>
                          </Link>
                        </li>
                        <li>
                          <Link to="/about" onClick={closeMobileMenu} className="nav-link">
                            <TutorIcon name="fas fa-info-circle" />
                            <span>About</span>
                          </Link>
                        </li>
                        <li>
                          <Link to="/contact" onClick={closeMobileMenu} className="nav-link">
                            <TutorIcon name="fas fa-envelope" />
                            <span>Contact</span>
                          </Link>
                        </li>
                      </ul>
                    </nav>
                    
                    <div className="mobile-menu-actions">
                      {showThemeSwitch && (
                        <div className="mobile-theme-row">
                          <span className="mobile-theme-row-label">Appearance</span>
                          <ThemeSwitch size="sm" />
                        </div>
                      )}
                      <button 
                        className="mobile-login-btn" 
                        onClick={() => { closeMobileMenu(); openLoginModal(); }}
                      >
                        <TutorIcon name="fas fa-user" />
                        <span>{isAuthenticated ? "My workspace" : "Login"}</span>
                      </button>
                      <Link 
                        to="/register" 
                        onClick={closeMobileMenu} 
                        className="mobile-register-btn"
                      >
                        <TutorIcon name="fas fa-user-plus" />
                        <span>Apply Now</span>
                      </Link>
                    </div>
                  </div>
                  <div className="social-links">
                    <h4 className="social-links-title">Follow us on:</h4>
                    <ul>
                      <li><a href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><TutorIcon name="fab fa-twitter" /></a></li>
                      <li><a href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><TutorIcon name="fab fa-facebook-f" /></a></li>
                      <li><a href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><TutorIcon name="fab fa-linkedin-in" /></a></li>
                      <li><a href="https://www.youtube.com/@fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><TutorIcon name="fab fa-youtube" /></a></li>
                    </ul>
                  </div>
                </nav>
              </div>
              </TutorDialog>}
              {/* End Mobile Menu */}
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} />
    </header>
  )
}

export default Header

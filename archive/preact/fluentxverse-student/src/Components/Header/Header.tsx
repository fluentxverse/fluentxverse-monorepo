import { useEffect, useCallback, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import { SocialLoginModal } from '../Auth/SocialLoginModal';
import LessonNotifications from './LessonNotifications';
import SettingsModal from '../Settings/SettingsModal';
import { Settings, House, Users, CalendarDays, Ticket, BookOpen, User, Menu, X, Sun, Moon } from 'lucide-preact';

import "./Header.css";


const Header = () => {
  const { isAuthenticated } = useAuthContext();
  const { path } = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mobileMenuTrigger = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleTheme } = useThemeStore();
  const isLandingPage = path === '/';
  const isPublicBrowsePage = path === '/register' || (!isAuthenticated && (path === '/browse-tutors' || path.startsWith('/tutor/') || ['/contact', '/privacy-policy', '/terms-of-service'].includes(path)));
  const isThemeLockedPage = isLandingPage || isPublicBrowsePage;
  const homeHref = isAuthenticated ? '/home' : '/';
  const navItems = [
    { href: homeHref, label: 'Home', icon: House },
    { href: '/browse-tutors', label: 'Browse Tutors', icon: Users },
    ...(isAuthenticated
      ? [
          { href: '/schedule', label: 'Schedule', icon: CalendarDays },
          { href: '/tickets', label: 'Tickets', icon: Ticket },
          { href: '/materials', label: 'Materials', icon: BookOpen },
          { href: '/profile', label: 'Profile', icon: User },
        ]
      : []),
  ];

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
  }, []);

  // Handler to close login modal
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    // Redirect to home after successful login
    window.location.href = '/home';
  }, []);

  // Handle wallet connected but user needs to register
  const handleNeedsRegistration = useCallback((walletAddress: string) => {
    // Store wallet address for registration flow
    localStorage.setItem('fxv_pending_wallet', walletAddress);
    // Redirect to registration page
    window.location.href = '/register';
  }, []);

  // Handle wallet connected but profile is incomplete
  const handleIncompleteProfile = useCallback((walletAddress: string, missingFields: string[]) => {
    // Store wallet address and missing fields for completion flow
    localStorage.setItem('fxv_pending_wallet', walletAddress);
    localStorage.setItem('fxv_missing_fields', JSON.stringify(missingFields));
    // Redirect to register page to complete profile (same form can handle it)
    window.location.href = '/register';
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

    handleScroll();
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

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 992px)');
    const closeMenuOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        closeMobileMenu();
      }
    };

    closeMenuOnDesktop(desktopQuery);
    desktopQuery.addEventListener('change', closeMenuOnDesktop);

    return () => {
      desktopQuery.removeEventListener('change', closeMenuOnDesktop);
    };
  }, [closeMobileMenu]);


 




  return (
    <header className={`${!isLandingPage && !isPublicBrowsePage ? 'app-header-shell' : ''}${isLandingPage ? ' landing-header-shell' : ''}${isPublicBrowsePage ? ' public-browse-header-shell' : ''}${isPublicBrowsePage && path !== '/browse-tutors' ? ' public-secondary-header' : ''}${showLoginModal ? ' header-modal-open' : ''}`}>
      <div id='sticky-header' className={`menu-area ${isLandingPage ? 'landing-header-bar' : ''}${isPublicBrowsePage ? ' public-browse-header-bar' : ''}`}>
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div
                className="mobile-nav-toggler"
                ref={mobileMenuTrigger}
                onClick={openMobileMenu}
                role="button"
                tabIndex={0}
                aria-label="Open mobile menu"
                  onKeyPress={(e: any) => { if (e.key === 'Enter' || e.key === ' ') openMobileMenu(); }}
              >
                <Menu size={24} />
              </div>
              <div className={`menu-wrap main-menu ${isLandingPage ? 'landing-menu-wrap' : ''}${isPublicBrowsePage ? ' public-browse-menu-wrap' : ''}`}>
                <nav className="menu-nav">
                  <a
                    href={homeHref}
                    className={`brand-lockup${isLandingPage ? ' brand-lockup--landing' : ''}${isPublicBrowsePage ? ' brand-lockup--public-browse' : ''}`}
                    aria-label="FluentXVerse home"
                  >
                    <span className="logo">
                      <span className="logo__spin" aria-hidden="true">
                        <img className="logo__face logo__face--front" src="/assets/img/logo/icon_logo.png" alt="" width="40" height="40" />
                      </span>
                    </span>
                    <span className="brand-text">
                      Fluent<span className="brand-x">X</span>Verse
                    </span>
                  </a>
                  <div className="navbar-wrap push-menu main-menu d-none d-lg-flex">
                    <ul className={`navigation ${isLandingPage ? 'landing-navigation' : ''}${isPublicBrowsePage ? ' public-browse-navigation' : ''}`}>
                      {navItems.map((item) => (
                        <li key={item.href}>
                          <a href={item.href}>{item.label}</a>
                        </li>
                      ))}
                      {/* <li><a href="/farms">Farms</a></li>
                      <li><a href="/tree-nfts">Trees</a></li>
                      <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                      <li><a href="/about">About</a></li>
                      <li><a href="/contact">Contact</a></li> */}
                    </ul>
                  </div>
                  {isAuthenticated && <LessonNotifications />}
                  <div className={`header-action d-none d-md-block ${isLandingPage ? 'landing-header-actions' : ''}${isPublicBrowsePage ? ' public-browse-header-actions' : ''}`}>
                    <ul>
                      {!isThemeLockedPage && (
                        <li className="theme-toggle">
                          <button
                            type="button"
                            className="theme-btn"
                            onClick={toggleTheme}
                            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                          >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                          </button>
                        </li>
                      )}
                      {!isAuthenticated && (
                        <li className="header-login">
                          <button 
                            className="login-btn" 
                            onClick={openLoginModal}
                            aria-label="Login"
                          >
                            <User size={18} />
                            <span>Login</span>
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
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
                    <X size={24} />
                  </div>
                  <div className="nav-logo"><a href="/#"></a>
                  </div>
                  <div className="menu-outer">
                    <div className="mobile-menu-header">
                      <div className="mobile-logo">
                        <img src="assets/img/logo/icon_logo.webp" alt="FluentXVerse" width="32" height="32" /> <div className="brand-text">Fluent<span className="brand-x">X</span>Verse</div>
                      </div>
                    </div>
                    
                    <nav className="mobile-nav">
                      {!isThemeLockedPage && (
                        <div className="mobile-menu-theme">
                          <button
                            type="button"
                            className="theme-btn mobile-theme-btn"
                            onClick={toggleTheme}
                            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                          >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
                          </button>
                        </div>
                      )}
                      <ul className="navigation">
                        {navItems.map((item) => (
                          <li key={item.href}>
                            <a href={item.href} onClick={closeMobileMenu} className="nav-link">
                              <item.icon size={20} />
                              <span>{item.label}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                      {isAuthenticated && <div className="mobile-menu-actions"><button type="button" className="mobile-login-btn" onClick={() => { closeMobileMenu(); mobileMenuTrigger.current?.focus(); setShowSettings(true); }}><Settings size={20} /><span>Account settings</span></button></div>}
                      {!isAuthenticated && (
                        <div className="mobile-menu-actions">
                          <button
                            type="button"
                            className="mobile-login-btn"
                            onClick={() => {
                              closeMobileMenu();
                              openLoginModal();
                            }}
                          >
                            <User size={18} />
                            <span>Login</span>
                          </button>
                        </div>
                      )}
                    </nav>
                    

                  </div>
                  <div className="social-links">
                    <h4 className="social-links-title">Follow us on:</h4>
                    <ul>
                      <li><a aria-label="X" title="X" href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><span aria-hidden="true">X</span></a></li>
                      <li><a aria-label="Facebook" title="Facebook" href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><span aria-hidden="true">f</span></a></li>
                      <li><a aria-label="LinkedIn" title="LinkedIn" href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><span aria-hidden="true">in</span></a></li>
                      <li><a aria-label="YouTube" title="YouTube" href="https://www.youtube.com/@fluentxverse" target="_blank" rel="noopener noreferrer" style={{ background: '#3a3a3a', color: '#fff' }}><span aria-hidden="true">YT</span></a></li>
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
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <SocialLoginModal
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        onSuccess={handleLoginSuccess}
        onNeedsRegistration={handleNeedsRegistration}
        onIncompleteProfile={handleIncompleteProfile}
      />
    </header>
  )
}

export default Header

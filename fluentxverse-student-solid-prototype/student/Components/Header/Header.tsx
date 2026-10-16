import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useLocation } from "../../routing";
import { useAuthContext } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import { SocialLoginModal } from '../Auth/SocialLoginModal';
import LessonNotifications from './LessonNotifications';
import { TICKETING_VISIBLE } from '../../config/launch';
import SettingsModal from '../Settings/SettingsModal';
import { Settings, House, Users, CalendarDays, Ticket, BookOpen, User, Menu, X, Sun, Moon } from "lucide-solid";
import "./Header.css";
const Header = () => {
    const _state0 = useAuthContext();
    const _state1 = useLocation();
    const [showLoginModal, setShowLoginModal] = createSignal(false);
    const [showSettings, setShowSettings] = createSignal(false);
    const mobileMenuTrigger = { current: null } as {
        current: HTMLDivElement | null;
    };
    const _state2 = useThemeStore();
    const isLandingPage = createMemo(() => _state1.path === '/');
    const isPublicBrowsePage = createMemo(() => _state1.path === '/register' || (!_state0.isAuthenticated && (_state1.path === '/browse-tutors' || _state1.path.startsWith('/tutor/') || ['/contact', '/privacy-policy', '/terms-of-service'].includes(_state1.path))));
    const isThemeLockedPage = createMemo(() => isLandingPage() || isPublicBrowsePage());
    const homeHref = createMemo(() => _state0.isAuthenticated ? '/home' : '/');
    const navItems = createMemo(() => [
        { get href() {
                return homeHref();
            }, label: 'Home', icon: House },
        { href: '/browse-tutors', label: 'Browse Tutors', icon: Users },
        ...(_state0.isAuthenticated ? [
            { href: '/schedule', label: 'Schedule', icon: CalendarDays },
            ...(TICKETING_VISIBLE ? [{ href: '/tickets', label: 'Tickets', icon: Ticket }] : []),
            { href: '/materials', label: 'Materials', icon: BookOpen },
            { href: '/profile', label: 'Profile', icon: User },
        ]
            : []),
    ]);
    // Handler to open mobile menu
    const openMobileMenu = createMemo(on(() => [], () => () => {
        document.body.classList.add('mobile-menu-visible');
    }));
    // Handler to close mobile menu
    const closeMobileMenu = createMemo(on(() => [], () => () => {
        document.body.classList.remove('mobile-menu-visible');
    }));
    // Handler to open login modal
    const openLoginModal = createMemo(on(() => [], () => () => {
        setShowLoginModal(true);
    }));
    // Handler to close login modal
    const closeLoginModal = createMemo(on(() => [], () => () => {
        setShowLoginModal(false);
    }));
    const handleLoginSuccess = createMemo(on(() => [], () => () => {
        // Redirect to home after successful login
        window.location.href = '/home';
    }));
    // Handle wallet connected but user needs to register
    const handleNeedsRegistration = createMemo(on(() => [], () => (walletAddress: string) => {
        // Store wallet address for registration flow
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        // Redirect to registration page
        window.location.href = '/register';
    }));
    // Handle wallet connected but profile is incomplete
    const handleIncompleteProfile = createMemo(on(() => [], () => (walletAddress: string, missingFields: string[]) => {
        // Store wallet address and missing fields for completion flow
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_missing_fields', JSON.stringify(missingFields));
        // Redirect to register page to complete profile (same form can handle it)
        window.location.href = '/register';
    }));
    createEffect(on(() => [_state0.isAuthenticated], () => {
        const _cleanup3 = untrack(() => {
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
                }
                else {
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
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [closeMobileMenu()], () => {
        const _cleanup4 = untrack(() => {
            const desktopQuery = window.matchMedia('(min-width: 992px)');
            const closeMenuOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
                if (event.matches) {
                    closeMobileMenu()();
                }
            };
            closeMenuOnDesktop(desktopQuery);
            desktopQuery.addEventListener('change', closeMenuOnDesktop);
            return () => {
                desktopQuery.removeEventListener('change', closeMenuOnDesktop);
            };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    return (<header class={`${!isLandingPage() && !isPublicBrowsePage() ? 'app-header-shell' : ''}${isLandingPage() ? ' landing-header-shell' : ''}${isPublicBrowsePage() ? ' public-browse-header-shell' : ''}${isPublicBrowsePage() && _state1.path !== '/browse-tutors' ? ' public-secondary-header' : ''}${showLoginModal() ? ' header-modal-open' : ''}`}>
      <div id='sticky-header' class={`menu-area ${isLandingPage() ? 'landing-header-bar' : ''}${isPublicBrowsePage() ? ' public-browse-header-bar' : ''}`}>
        <div class="container">
          <div class="row">
            <div class="col-12">
              <div class="mobile-nav-toggler" ref={_element => mobileMenuTrigger.current = _element} onClick={openMobileMenu()} role="button" tabIndex={0} aria-label="Open mobile menu" onKeyPress={(e: any) => { if (e.key === 'Enter' || e.key === ' ')
        openMobileMenu()(); }}>
                <Menu size={24}/>
              </div>
              <div class={`menu-wrap main-menu ${isLandingPage() ? 'landing-menu-wrap' : ''}${isPublicBrowsePage() ? ' public-browse-menu-wrap' : ''}`}>
                <nav class="menu-nav">
                  <a href={homeHref()} class={`brand-lockup${isLandingPage() ? ' brand-lockup--landing' : ''}${isPublicBrowsePage() ? ' brand-lockup--public-browse' : ''}`} aria-label="FluentXVerse home">
                    <span class="logo">
                      <span class="logo__spin" aria-hidden="true">
                        <img class="logo__face logo__face--front" src="/assets/img/logo/icon_logo.png" alt="" width="40" height="40"/>
                      </span>
                    </span>
                    <span class="brand-text">
                      Fluent<span class="brand-x">X</span>Verse
                    </span>
                  </a>
                  <div class="navbar-wrap push-menu main-menu d-none d-lg-flex">
                    <ul class={`navigation ${isLandingPage() ? 'landing-navigation' : ''}${isPublicBrowsePage() ? ' public-browse-navigation' : ''}`}>
                      {navItems().map((item) => (<li>
                          <a href={item.href}>{item.label}</a>
                        </li>))}
                      {/* <li><a href="/farms">Farms</a></li>
        <li><a href="/tree-nfts">Trees</a></li>
        <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li> */}
                    </ul>
                  </div>
                  {_state0.isAuthenticated && <LessonNotifications />}
                  <div class={`header-action d-none d-md-block ${isLandingPage() ? 'landing-header-actions' : ''}${isPublicBrowsePage() ? ' public-browse-header-actions' : ''}`}>
                    <ul>
                      {!isThemeLockedPage() && (<li class="theme-toggle">
                          <button type="button" class="theme-btn" onClick={_state2.toggleTheme} aria-label={_state2.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={_state2.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                            {_state2.isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
                          </button>
                        </li>)}
                      {!_state0.isAuthenticated && (<li class="header-login">
                          <button class="login-btn" onClick={openLoginModal()} aria-label="Login">
                            <User size={18}/>
                            <span>Login</span>
                          </button>
                        </li>)}
                    </ul>
                  </div>
                </nav>
              </div>
              {/* Mobile Menu  */}
              <div class="mobile-menu">
                <nav class="menu-box">
                  <div class="close-btn" onClick={closeMobileMenu()} role="button" tabIndex={0} aria-label="Close mobile menu" onKeyPress={(e: any) => { if (e.key === 'Enter' || e.key === ' ')
        closeMobileMenu()(); }}>
                    <X size={24}/>
                  </div>
                  <div class="nav-logo"><a href="/#"></a>
                  </div>
                  <div class="menu-outer">
                    <div class="mobile-menu-header">
                      <div class="mobile-logo">
                        <img src="assets/img/logo/icon_logo.webp" alt="FluentXVerse" width="32" height="32"/> <div class="brand-text">Fluent<span class="brand-x">X</span>Verse</div>
                      </div>
                    </div>
                    
                    <nav class="mobile-nav">
                      {!isThemeLockedPage() && (<div class="mobile-menu-theme">
                          <button type="button" class="theme-btn mobile-theme-btn" onClick={_state2.toggleTheme} aria-label={_state2.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                            {_state2.isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
                            <span>{_state2.isDarkMode ? 'Light mode' : 'Dark mode'}</span>
                          </button>
                        </div>)}
                      <ul class="navigation">
                        {navItems().map((item) => (<li>
                            <a href={item.href} onClick={closeMobileMenu()} class="nav-link">
                              <item.icon size={20}/>
                              <span>{item.label}</span>
                            </a>
                          </li>))}
                      </ul>
                      {_state0.isAuthenticated && <div class="mobile-menu-actions"><button type="button" class="mobile-login-btn" onClick={() => { closeMobileMenu()(); mobileMenuTrigger.current?.focus(); setShowSettings(true); }}><Settings size={20}/><span>Account settings</span></button></div>}
                      {!_state0.isAuthenticated && (<div class="mobile-menu-actions">
                          <button type="button" class="mobile-login-btn" onClick={() => {
                closeMobileMenu()();
                openLoginModal()();
            }}>
                            <User size={18}/>
                            <span>Login</span>
                          </button>
                        </div>)}
                    </nav>
                    

                  </div>
                  <div class="social-links">
                    <h4 class="social-links-title">Follow us on:</h4>
                    <ul>
                      <li><a aria-label="LinkedIn" title="LinkedIn" href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer"><i class="ri-linkedin-fill" aria-hidden="true"/></a></li>
                      <li><a aria-label="Facebook" title="Facebook" href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer"><i class="ri-facebook-fill" aria-hidden="true"/></a></li>
                      <li><a aria-label="X" title="X" href="https://x.com/FluentXverse" target="_blank" rel="noopener noreferrer"><i class="ri-twitter-x-fill" aria-hidden="true"/></a></li>
                    </ul>
                  </div>
                </nav>
              </div>
              <div class="menu-backdrop" onClick={closeMobileMenu()}/>
              {/* End Mobile Menu */}
            </div>
          </div>
        </div>
      </div>

      {/* Social Login Modal */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)}/>
      <SocialLoginModal isOpen={showLoginModal()} onClose={closeLoginModal()} onSuccess={handleLoginSuccess()} onNeedsRegistration={handleNeedsRegistration()} onIncompleteProfile={handleIncompleteProfile()}/>
    </header>);
};
export default Header;

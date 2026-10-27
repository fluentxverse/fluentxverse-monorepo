import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import { A as Link } from "@solidjs/router";
import { useAuthContext } from '../../context/AuthContext';
import TutorDialog from "../Common/TutorDialog";
import LoginModal from "../InnerPages/LoginModal";
import ThemeSwitch from '../Common/ThemeSwitch';
import "./Header.css";
import BrandWordmark from '../../../../shared/ui/BrandWordmark';
import SocialBrandIcon from '../../../../shared/ui/SocialBrandIcon';
interface HeaderProps {
    showThemeSwitch?: boolean;
}
const Header = (_props0: HeaderProps) => {
    const _state1 = useAuthContext();
    const [showLoginModal, setShowLoginModal] = createSignal(false);
    const [showMobileMenu, setShowMobileMenu] = createSignal(false);
    // Handler to open mobile menu
    const openMobileMenu = createMemo(on(() => [], () => () => {
        setShowMobileMenu(true);
    }));
    // Handler to close mobile menu
    const closeMobileMenu = createMemo(on(() => [], () => () => {
        setShowMobileMenu(false);
    }));
    // Handler to open login modal
    const openLoginModal = createMemo(on(() => [_state1.isAuthenticated], () => () => {
        if (_state1.isAuthenticated) {
            window.location.href = '/home';
            return;
        }
        setShowLoginModal(true);
    }));
    // Handler to close login modal
    const closeLoginModal = createMemo(on(() => [], () => () => {
        setShowLoginModal(false);
    }));
    createEffect(on(() => [_state1.isAuthenticated], () => {
        const _cleanup2 = untrack(() => {
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
            window.addEventListener('scroll', handleScroll);
            // Scroll to target
            const scrollToTargetBtn = document.querySelector('.scroll-to-target');
            interface ScrollToTargetEvent extends MouseEvent {
                currentTarget: HTMLElement & {
                    getAttribute(attr: string): string | null;
                };
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
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    return (<header>
      <div id='sticky-header' class="menu-area tutor-public-header">
        <div class="container">
          <div class="row">
            <div class="col-12">
              <div class="menu-wrap main-menu">
                <nav class="menu-nav">
                  <div class="logo"><a href="/#"><img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse" width="40" height="40"/></a></div>
                  <div class="brand-text"><BrandWordmark /></div>
                  <div class="navbar-wrap push-menu main-menu d-none d-lg-flex">
                    <ul class="navigation">
                      <li><Link href="/">Home</Link></li>
                      <li><Link href="/about">About</Link></li>
                      <li><Link href="/contact">Contact</Link></li>

                      {/* <li><Link to="/farms">Farms</Link></li>
<li><Link to="/tree-nfts">Trees</Link></li>
<li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
<li><Link to="/about">About</Link></li>
<li><Link to="/contact">Contact</Link></li> */}
                    </ul>
                  </div>
                  <div class="header-action d-none d-md-block">
                    <ul>
                      {(_props0["showThemeSwitch"] === undefined ? false : _props0["showThemeSwitch"]) && (<li class="header-theme-switch">
                          <ThemeSwitch size="sm"/>
                        </li>)}
                      <li class="header-login">
                        <button class="login-btn" onClick={openLoginModal()} aria-label={_state1.isAuthenticated ? "My workspace" : "Login"}>
                          <TutorIcon name="fas fa-user"/>
                          <span>{_state1.isAuthenticated ? "My workspace" : "Login"}</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                  <button type="button" class="mobile-nav-toggler" onClick={openMobileMenu()} aria-label="Open mobile menu" aria-expanded={showMobileMenu()} aria-controls="tutor-public-navigation" aria-haspopup="dialog">
                    <TutorIcon name="fas fa-bars" size={24}/>
                  </button>
                </nav>
              </div>
              {/* Mobile Menu  */}
              {showMobileMenu() && <TutorDialog className="tutor-public-menu" label="Navigation" onClose={closeMobileMenu()}>
              <div class="mobile-menu" id="tutor-public-navigation">
                <nav class="menu-box">
                  <div class="menu-outer">
                    <div class="mobile-menu-header">
                      <div class="mobile-logo">
                        <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse" width="32" height="32"/> <div class="brand-text"><BrandWordmark compact /></div>
                      </div>
                      <button type="button" class="close-btn" onClick={closeMobileMenu()} aria-label="Close mobile menu" autofocus>
                        <TutorIcon name="fas fa-times" size={24}/>
                      </button>
                    </div>
                    
                    <nav class="mobile-nav">
                      <ul class="navigation">
                        <li>
                          <Link href="/" onClick={closeMobileMenu()} class="nav-link">
                            <TutorIcon name="fas fa-home"/>
                            <span>Home</span>
                          </Link>
                        </li>
                        <li>
                          <Link href="/about" onClick={closeMobileMenu()} class="nav-link">
                            <TutorIcon name="fas fa-info-circle"/>
                            <span>About</span>
                          </Link>
                        </li>
                        <li>
                          <Link href="/contact" onClick={closeMobileMenu()} class="nav-link">
                            <TutorIcon name="fas fa-envelope"/>
                            <span>Contact</span>
                          </Link>
                        </li>
                      </ul>
                    </nav>
                    
                    <div class="mobile-menu-actions">
                      {(_props0["showThemeSwitch"] === undefined ? false : _props0["showThemeSwitch"]) && (<div class="mobile-theme-row">
                          <span class="mobile-theme-row-label">Appearance</span>
                          <ThemeSwitch size="sm"/>
                        </div>)}
                      <button class="mobile-login-btn" onClick={() => { closeMobileMenu()(); openLoginModal()(); }}>
                        <TutorIcon name="fas fa-user"/>
                        <span>{_state1.isAuthenticated ? "My workspace" : "Login"}</span>
                      </button>
                    </div>
                  </div>
                  <div class="social-links">
                    <h4 class="social-links-title">Follow us on:</h4>
                    <ul>
                      <li><a aria-label="LinkedIn" title="LinkedIn" href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer"><SocialBrandIcon name="linkedin"/></a></li>
                      <li><a aria-label="Facebook" title="Facebook" href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer"><SocialBrandIcon name="facebook"/></a></li>
                      <li><a aria-label="X" title="X" href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer"><SocialBrandIcon name="x"/></a></li>
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

      <LoginModal isOpen={showLoginModal()} onClose={closeLoginModal()}/>
    </header>);
};
export default Header;

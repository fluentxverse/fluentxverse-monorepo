import { useEffect, useCallback, useState } from 'preact/compat';
import { Link } from 'wouter';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import { loginUser } from '../../api/auth.api';
import "./Header.css";


const Header = () => {
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { isAuthenticated, login } = useAuthContext();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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

  const handleLoginSubmit = useCallback(async (e: any) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await loginUser(email, password);
      if (result?.success && result.user) {
        // Optionally update context if needed
        window.location.href = '/home';
      } else {
        setLoginError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  }, [email, password]);

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
                      <li><Link to="/">Home</Link></li>
                      <li><Link to="/browse-tutors">Browse Tutors</Link></li>
                      {/* <li><Link to="/farms">Farms</Link></li>
                      <li><Link to="/tree-nfts">Trees</Link></li>
                      <li><a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li>
                      <li><Link to="/about">About</Link></li>
                      <li><Link to="/contact">Contact</Link></li> */}
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
                          <Link to="/" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-home" />
                            <span>Home</span>
                          </Link>
                        </li>
                        <li>
                          <Link to="/farms" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-seedling" />
                            <span>Farms</span>
                          </Link>
                        </li>
                        <li>
                          <Link to="/tree-nfts" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-tree" />
                            <span>Trees</span>
                          </Link>
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
                          <Link to="/about" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-info-circle" />
                            <span>About</span>
                          </Link>
                        </li>
                        <li>
                          <Link to="/contact" onClick={closeMobileMenu} className="nav-link">
                            <i className="fas fa-envelope" />
                            <span>Contact</span>
                          </Link>
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

      {/* Login Modal */}
      {showLoginModal && (
        <div className="login-modal-overlay" onMouseDown={closeLoginModal}>
          <div className="login-modal-content" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeLoginModal}>
              <i className="fas fa-times"></i>
            </button>
            <div className="modal-header">
              <div className="modal-logo">
                <img src="assets/img/logo/icon_logo.png" alt="FluentXVerse" />
              </div>
              <div className="modal-brand-text">FluentXVerse</div>
            </div>
            <form className="login-form" onSubmit={handleLoginSubmit as unknown as (e: any) => void}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                  required
                />
              </div>
              <div className="form-options">
                <a href="#" className="forgot-password">Forgot password?</a>
              </div>
              {loginError && (
                <div className="modal-error" style={{ color: '#b00020', marginBottom: '8px' }}>{loginError}</div>
              )}
              <button type="submit" className="login-submit-btn" disabled={loginLoading}>
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>
              <div style={{ marginTop:'8px', fontSize:'12px', color:'#718096', textAlign:'center' }}>

              </div>
            </form>
            <div className="modal-footer">
              <p>Don't have an account? <a href="/register">Join Now</a></p>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
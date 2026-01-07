interface NavbarProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  navigateTo: (page: 'home' | 'about') => void;
}

export function Navbar({ isMenuOpen, setIsMenuOpen, navigateTo }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }} className="logo">
          <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" className="logo-icon" width="40" height="40" />
          <span className="logo-text">Fluent<span className="logo-x">X</span>Verse</span>
        </a>

        <button
          className="menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
          <li><a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home'); }}>Home</a></li>
          <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about'); }}>About</a></li>
          <li>
            <a href="https://student.fluentxverse.com" className="btn btn-outline" target="_blank" rel="noopener noreferrer">
              Student Portal
            </a>
          </li>
          <li>
            <a href="https://tutor.fluentxverse.com" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
              Tutor Portal
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

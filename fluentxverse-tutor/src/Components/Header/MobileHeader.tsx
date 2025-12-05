import { useState, useCallback } from 'preact/hooks';
import { Link, useLocation } from 'wouter';
import { useAuthContext } from '../../context/AuthContext';
import SettingsModal from '../Settings/SettingsModal';
import './MobileHeader.css';

interface MenuItem {
  href: string;
  icon: string;
  label: string;
}

const menuItems: MenuItem[] = [
  { href: "/home", icon: "fi-sr-home", label: "Home" },
  { href: "/schedule", icon: "fi-sr-calendar", label: "Schedule" },
  { href: "/material", icon: "fi-sr-book-alt", label: "Materials" },
  { href: "/metrics", icon: "fi-sr-chart-histogram", label: "Metrics" },
  { href: "/about", icon: "fi-sr-info", label: "About" },
];

const MobileHeader = () => {
  const { user, logout } = useAuthContext();
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Only show for logged-in users
  if (!user) {
    return null;
  }

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    document.body.style.overflow = 'unset';
  }, []);

  const handleLogout = useCallback(async () => {
    closeMenu();
    await logout();
    window.location.href = '/';
  }, [logout, closeMenu]);

  const openSettings = useCallback(() => {
    closeMenu();
    setShowSettings(true);
  }, [closeMenu]);

  return (
    <>
      {/* Sticky Mobile Header */}
      <div className="mobile-header-logged">
        <div className="mobile-header-content">
          <button 
            className="mobile-menu-btn" 
            onClick={openMenu}
            aria-label="Open menu"
          >
            <i className="fas fa-bars"></i>
          </button>
          
          <div className="mobile-header-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
            <span className="mobile-header-brand">FluentXVerse</span>
          </div>

          <div className="mobile-header-user">
            <i className="fas fa-user-circle"></i>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            {/* Menu Header */}
            <div className="mobile-menu-header">
              <div className="mobile-menu-logo">
                <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
                <span>FluentXVerse</span>
              </div>
              <button className="mobile-menu-close" onClick={closeMenu}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* User Info */}
            <div className="mobile-menu-user">
              <div className="user-avatar">
                <i className="fas fa-user-circle"></i>
              </div>
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="mobile-menu-nav">
              <ul>
                {menuItems.map((item) => (
                  <li key={item.href} className={location === item.href ? 'active' : ''}>
                    <Link href={item.href} onClick={closeMenu}>
                      <i className={item.icon}></i>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
                {/* Settings */}
                <li>
                  <button onClick={openSettings} className="menu-btn">
                    <i className="fi-sr-settings"></i>
                    <span>Settings</span>
                  </button>
                </li>
              </ul>
            </nav>

            {/* Logout Button */}
            <div className="mobile-menu-footer">
              <button className="logout-btn" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt"></i>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};

export default MobileHeader;

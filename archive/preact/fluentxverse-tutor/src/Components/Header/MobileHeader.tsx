import TutorDialog from "../Common/TutorDialog";
import { useState, useCallback } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import SettingsModal from '../Settings/SettingsModal';
import ThemeSwitch from '../Common/ThemeSwitch';
import ProfileAvatar from '../Common/ProfileAvatar';
import './MobileHeader.css';

interface MenuItem {
  href: string;
  icon: string;
  label: string;
}

const menuItems: MenuItem[] = [
  { href: "/home", icon: "fi-sr-home", label: "Home" },
  { href: "/profile", icon: "fi-sr-user", label: "My Profile" },
  { href: "/schedule", icon: "fi-sr-calendar", label: "Schedule" },
  { href: "/materials", icon: "fi-sr-book-alt", label: "Materials" },
  { href: "/performance-metrics", icon: "fi-sr-chart-histogram", label: "Metrics" },
  { href: "/about", icon: "fi-sr-info", label: "About" },
];

const MobileHeader = () => {
  const { user, logout, logoutLoading, logoutError } = useAuthContext();
  const resolvedTheme = useThemeStore(state => state.resolvedTheme);
  const { path: location } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);


  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const openSettings = useCallback(() => {
    closeMenu();
    setShowSettings(true);
  }, [closeMenu]);

  if (!user) return null;

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
            <i className="fas fa-bars" aria-hidden="true"></i>
          </button>
          
          <div className="mobile-header-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
            <span className="mobile-header-brand">Fluent<span className="brand-x">X</span>Verse</span>
          </div>

          <a href="/profile" className="mobile-header-user">
            <ProfileAvatar src={user.profilePicture} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', display: 'grid', placeItems: 'center' }} fallback={<i className="fas fa-user-circle" aria-hidden="true"></i>} />
          </a>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <TutorDialog label="Navigation" className={`tutor-menu-dialog ${resolvedTheme === 'dark' ? 'dark-mode' : ''}`} onClose={closeMenu} busy={logoutLoading}>
          <div className="mobile-menu-panel">
            {/* Menu Header */}
            <div className="mobile-menu-header">
              <div className="mobile-menu-logo">
                <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
                <span>Fluent<span className="brand-x">X</span>Verse</span>
              </div>
              <button className="mobile-menu-close" aria-label="Close navigation" onClick={closeMenu}>
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            {/* User Info */}
            <div className="mobile-menu-user">
              <div className="user-avatar">
                <ProfileAvatar src={user.profilePicture} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', display: 'grid', placeItems: 'center' }} fallback={<i className="fas fa-user-circle" aria-hidden="true"></i>} />
              </div>
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>

            <div className="mobile-menu-theme">
              <div className="mobile-menu-theme-copy">
                <span className="mobile-menu-theme-label">Appearance</span>
                <span className="mobile-menu-theme-text">Choose how the tutor app looks</span>
              </div>
              <ThemeSwitch size="sm" showLabels />
            </div>

            {/* Navigation Links */}
            <nav className="mobile-menu-nav">
              <ul>
                {menuItems.map((item) => (
                  <li key={item.href} className={location === item.href ? 'active' : ''}>
                    <a href={item.href} onClick={closeMenu}>
                      <i className={item.icon} aria-hidden="true"></i>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
                {/* Settings */}
                <li>
                  <button onClick={openSettings} className="menu-btn">
                    <i className="fi-sr-settings" aria-hidden="true"></i>
                    <span>Settings</span>
                  </button>
                </li>
              </ul>
            </nav>

            {/* Logout Button */}
            <div className="mobile-menu-footer">
              <button className="logout-btn" onClick={handleLogout} disabled={logoutLoading}>
                <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
                <span>{logoutLoading ? 'Signing out...' : 'Logout'}</span>
              </button>
              {logoutError && <p className="mobile-logout-error" role="alert">{logoutError}</p>}
            </div>
          </div>
        </TutorDialog>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};

export default MobileHeader;

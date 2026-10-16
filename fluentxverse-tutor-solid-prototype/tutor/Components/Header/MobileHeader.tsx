import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from "../Common/TutorDialog";
import { useLocation } from "../../routing";
import { useAuthContext } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import SettingsModal from '../Settings/SettingsModal';
import ProfileAvatar from '../Common/ProfileAvatar';
import ThemeSwitch from '../Common/ThemeSwitch';
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
    const _state0 = useAuthContext();
    const resolvedTheme = createMemo(() => useThemeStore(state => state.resolvedTheme));
    const _state1 = useLocation();
    const [isMenuOpen, setIsMenuOpen] = createSignal(false);
    const [showSettings, setShowSettings] = createSignal(false);
    const openMenu = createMemo(on(() => [], () => () => {
        setIsMenuOpen(true);
    }));
    const closeMenu = createMemo(on(() => [], () => () => {
        setIsMenuOpen(false);
    }));
    const handleLogout = createMemo(on(() => [_state0.logout], () => async () => {
        await _state0.logout();
    }));
    const openSettings = createMemo(on(() => [closeMenu()], () => () => {
        closeMenu()();
        setShowSettings(true);
    }));
    return createMemo(() => {
        if (!_state0.user)
            return null;
        return (<>
      {/* Sticky Mobile Header */}
      <div class="mobile-header-logged">
        <div class="mobile-header-content">
          <button class="mobile-menu-btn" onClick={openMenu()} aria-label="Open menu">
            <i class="fas fa-bars" aria-hidden="true"></i>
          </button>
          
          <div class="mobile-header-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse"/>
            <span class="mobile-header-brand">Fluent<span class="brand-x">X</span>Verse</span>
          </div>

          <a href="/profile" class="mobile-header-user">
            <ProfileAvatar src={_state0.user.profilePicture} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', display: 'grid', placeItems: 'center' }} fallback={<i class="fas fa-user-circle" aria-hidden="true"></i>}/>
          </a>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen() && (<TutorDialog label="Navigation" className={`tutor-menu-dialog ${resolvedTheme() === 'dark' ? 'dark-mode' : ''}`} onClose={closeMenu()} busy={_state0.logoutLoading}>
          <div class="mobile-menu-panel">
            {/* Menu Header */}
            <div class="mobile-menu-header">
              <div class="mobile-menu-logo">
                <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse"/>
                <span>Fluent<span class="brand-x">X</span>Verse</span>
              </div>
              <button class="mobile-menu-close" aria-label="Close navigation" onClick={closeMenu()}>
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            {/* User Info */}
            <div class="mobile-menu-user">
              <div class="user-avatar">
                <ProfileAvatar src={_state0.user.profilePicture} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', display: 'grid', placeItems: 'center' }} fallback={<i class="fas fa-user-circle" aria-hidden="true"></i>}/>
              </div>
              <div class="user-info">
                <span class="user-name">{_state0.user.firstName} {_state0.user.lastName}</span>
                <span class="user-email">{_state0.user.email}</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav class="mobile-menu-nav">
              <ul>
                {menuItems.map((item) => (<li class={_state1.path === item.href ? 'active' : ''}>
                    <a href={item.href} onClick={closeMenu()}>
                      <i class={item.icon} aria-hidden="true"></i>
                      <span>{item.label}</span>
                    </a>
                  </li>))}
                {/* Settings */}
                <li>
                  <button onClick={openSettings()} class="menu-btn">
                    <i class="fi-sr-settings" aria-hidden="true"></i>
                    <span>Settings</span>
                  </button>
                </li>
              </ul>
            </nav>

            <section class="mobile-menu-theme" aria-label="Theme">
              <span class="mobile-menu-theme-label">Theme</span>
              <ThemeSwitch showLabels/>
            </section>

            {/* Logout Button */}
            <div class="mobile-menu-footer">
              <button class="logout-btn" onClick={handleLogout()} disabled={_state0.logoutLoading}>
                <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
                <span>{_state0.logoutLoading ? 'Signing out...' : 'Logout'}</span>
              </button>
              {_state0.logoutError && <p class="mobile-logout-error" role="alert">{_state0.logoutError}</p>}
            </div>
          </div>
        </TutorDialog>)}

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)}/>
    </>);
    }) as unknown as JSX.Element;
};
export default MobileHeader;

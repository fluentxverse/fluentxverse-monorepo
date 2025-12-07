import { useState } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import './Header.css';

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuthContext();

  const getInitials = () => {
    if (!user) return 'AD';
    // Use first 2 chars of username
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const getDisplayName = () => {
    if (!user) return 'Admin';
    return user.username || 'Admin';
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="search-box">
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder="Search tutors, students, sessions..." 
            className="search-input"
          />
          <span className="search-shortcut">⌘K</span>
        </div>
      </div>

      <div className="header-right">
        <button className="header-btn" title="Help">
          <i className="ri-question-line"></i>
        </button>
        
        <div className="notification-wrapper">
          <button 
            className="header-btn notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="ri-notification-3-line"></i>
            <span className="notification-dot"></span>
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Notifications</span>
                <button className="mark-read-btn">Mark all read</button>
              </div>
              <div className="notification-list">
                <div className="notification-item unread">
                  <div className="notification-icon success">
                    <i className="ri-user-add-line"></i>
                  </div>
                  <div className="notification-content">
                    <p>New tutor application from <strong>John Doe</strong></p>
                    <span>2 minutes ago</span>
                  </div>
                </div>
                <div className="notification-item unread">
                  <div className="notification-icon warning">
                    <i className="ri-error-warning-line"></i>
                  </div>
                  <div className="notification-content">
                    <p>Tutor <strong>Jane Smith</strong> failed speaking exam</p>
                    <span>15 minutes ago</span>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon info">
                    <i className="ri-calendar-check-line"></i>
                  </div>
                  <div className="notification-content">
                    <p>5 new sessions scheduled for today</p>
                    <span>1 hour ago</span>
                  </div>
                </div>
              </div>
              <div className="notification-footer">
                <a href="/notifications">View all notifications</a>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider"></div>

        <div className="header-user-wrapper">
          <div 
            className="header-user"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="avatar">
              <span>{getInitials()}</span>
            </div>
            <div className="user-info">
              <span className="user-name">{getDisplayName()}</span>
              <span className="user-role">{user?.role || 'admin'}</span>
            </div>
            <i className={`ri-arrow-${showUserMenu ? 'up' : 'down'}-s-line`}></i>
          </div>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="avatar large">
                  <span>{getInitials()}</span>
                </div>
                <div className="user-dropdown-info">
                  <span className="user-dropdown-name">{getDisplayName()}</span>
                  <span className="user-dropdown-username">@{user?.username}</span>
                </div>
              </div>
              <div className="user-dropdown-divider"></div>
              <button className="user-dropdown-item">
                <i className="ri-settings-3-line"></i>
                Settings
              </button>
              <button className="user-dropdown-item" onClick={handleLogout}>
                <i className="ri-logout-box-r-line"></i>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

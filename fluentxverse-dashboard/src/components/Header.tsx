import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi, RecentActivity } from '../api/admin.api';
import './Header.css';

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuthContext();
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close notifications if clicking outside
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      
      // Close user menu if clicking outside
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, showUserMenu]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getRecentActivity(10);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tutor_registered':
        return { icon: 'ri-user-add-line', class: 'info' };
      case 'exam_passed':
        return { icon: 'ri-checkbox-circle-line', class: 'success' };
      case 'exam_failed':
        return { icon: 'ri-error-warning-line', class: 'warning' };
      case 'student_joined':
        return { icon: 'ri-graduation-cap-line', class: 'info' };
      case 'booking':
        return { icon: 'ri-calendar-check-line', class: 'success' };
      case 'profile_submitted':
        return { icon: 'ri-user-settings-line', class: 'primary' };
      default:
        return { icon: 'ri-notification-3-line', class: 'info' };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

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
        
        <div className="notification-wrapper" ref={notificationRef}>
          <button 
            className="header-btn notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="ri-notification-3-line"></i>
            {notifications.length > 0 && <span className="notification-dot"></span>}
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Activity Feed</span>
                <button className="mark-read-btn" onClick={loadNotifications}>
                  <i className="ri-refresh-line"></i> Refresh
                </button>
              </div>
              <div className="notification-list">
                {loading && notifications.length === 0 ? (
                  <div className="notification-empty">
                    <i className="ri-loader-4-line spin"></i>
                    <p>Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <i className="ri-notification-off-line"></i>
                    <p>No recent activity</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const iconInfo = getNotificationIcon(notification.type);
                    return (
                      <div key={notification.id} className="notification-item">
                        <div className={`notification-icon ${iconInfo.class}`}>
                          <i className={iconInfo.icon}></i>
                        </div>
                        <div className="notification-content">
                          <p>{notification.message}</p>
                          <span>{formatTimeAgo(notification.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="notification-footer">
                <span className="notification-count">{notifications.length} recent activities</span>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider"></div>

        <div className="header-user-wrapper" ref={userMenuRef}>
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

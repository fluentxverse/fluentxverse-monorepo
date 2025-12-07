import { useEffect, useRef } from 'preact/hooks';
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../../hooks/useNotifications';
import { Link } from 'wouter';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  user?: {
    name?: string;
    profilePicture?: string;
    email?: string;
  };
}

const DashboardHeader = ({ user }: DashboardHeaderProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    isDropdownOpen,
    markAsRead,
    markAllAsRead,
    setDropdownOpen,
    toggleDropdown
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, setDropdownOpen]);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    // Navigate if there's a link
    if (notification.data?.link) {
      window.location.href = notification.data.link;
    }
    
    setDropdownOpen(false);
  };

  return (
    <div className="dashboard-header light">
      <div className="logo">
        {/* Logo space */}
      </div>

      <div className="dashboard-header-actions">
        {/* Notifications */}
        <div className="dashboard-notification-container" ref={dropdownRef}>
          <button 
            className={`notification-btn ${isDropdownOpen ? 'active' : ''}`}
            onClick={toggleDropdown}
            aria-label="Notifications"
          >
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <button className="mark-all-read" onClick={markAllAsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              
              <div className="notifications-list">
                {isLoading ? (
                  <div className="notification-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <i className="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                    <span>We'll notify you when something happens</span>
                  </div>
                ) : (
                  notifications.slice(0, 10).map(notification => {
                    const { icon, color } = getNotificationIcon(notification.type);
                    return (
                      <div 
                        key={notification.id} 
                        className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div 
                          className="notification-icon" 
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <i className={`fas ${icon}`}></i>
                        </div>
                        <div className="notification-content">
                          <p className="notification-title">{notification.title}</p>
                          <p className="notification-message">{notification.message}</p>
                          <span className="notification-time">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        {!notification.isRead && (
                          <div className="notification-unread-dot"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="notifications-footer">
                  <Link href="/notifications" className="view-all-notifications">
                    View all notifications
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;

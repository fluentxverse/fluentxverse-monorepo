import { useEffect, useRef, useState } from 'preact/hooks';
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../../hooks/useNotifications';
import { Link } from 'wouter';
import { inboxApi } from '../../api/inbox.api';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  user?: {
    name?: string;
    profilePicture?: string;
    email?: string;
  };
  title?: string;
}

const DashboardHeader = ({ user, title }: DashboardHeaderProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [philippineTime, setPhilippineTime] = useState<string>('');
  const [philippineDate, setPhilippineDate] = useState<string>('');
  const [inboxUnreadCount, setInboxUnreadCount] = useState<number>(0);
  
  // Get user ID from localStorage
  const userId = localStorage.getItem('fxv_user_id') || '';
  
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

  // Fetch inbox unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!userId) return;
      try {
        const count = await inboxApi.getUnreadCount(userId);
        setInboxUnreadCount(count);
      } catch (err) {
        console.error('Failed to fetch inbox unread count:', err);
      }
    };

    fetchUnreadCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Philippine Time Clock
  useEffect(() => {
    const updatePhilippineTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      };
      setPhilippineTime(now.toLocaleTimeString('en-US', options));
      setPhilippineDate(now.toLocaleDateString('en-US', dateOptions));
    };

    updatePhilippineTime();
    const interval = setInterval(updatePhilippineTime, 1000);

    return () => clearInterval(interval);
  }, []);

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
      <div className="header-left">
        {title && (
          <h1 className="dashboard-page-title">{title}</h1>
        )}
        <div className="philippine-clock">
          <i className="fas fa-clock"></i>
          <div className="clock-content">
            <span className="clock-time">{philippineTime}</span>
            <span className="clock-date">{philippineDate}</span>
          </div>
          <span className="clock-timezone">PHT</span>
        </div>
      </div>

      <div className="dashboard-header-actions">
        {/* Inbox Button */}
        <Link href="/inbox" className="inbox-btn" aria-label="Inbox">
          <i className="fas fa-envelope"></i>
          {inboxUnreadCount > 0 && (
            <span className="inbox-badge">
              {inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}
            </span>
          )}
        </Link>

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

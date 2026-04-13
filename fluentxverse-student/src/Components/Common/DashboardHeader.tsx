import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { inboxApi } from '../../api/inbox.api';
import { useThemeStore } from '../../context/ThemeContext';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  title?: string;
  user?: {
    name?: string;
    profilePicture?: string;
    email?: string;
  };
}

const DashboardHeader = ({ title, user }: DashboardHeaderProps) => {
  const { route } = useLocation();
  const [philippineTime, setPhilippineTime] = useState<string>('');
  const [philippineDate, setPhilippineDate] = useState<string>('');
  const [inboxUnreadCount, setInboxUnreadCount] = useState<number>(0);
  const { isDarkMode, toggleTheme } = useThemeStore();

  // Get user ID from localStorage
  const userId = localStorage.getItem('fxv_user_id') || '';

  // Fetch unread inbox count
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

  return (
    <div className={`dashboard-header ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="header-left">
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
        <button
          type="button"
          className="dashboard-theme-btn"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        {/* Inbox Button */}
        <a
          href="/inbox"
          className="inbox-btn"
          aria-label="Inbox"
          onClick={(e) => {
            e.preventDefault();
            route('/inbox');
          }}
        >
          <i className="fas fa-envelope"></i>
          {inboxUnreadCount > 0 && (
            <span className="inbox-badge">
              {inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}
            </span>
          )}
        </a>

        {/* Notifications Button */}
        <a
          href="/notifications"
          className="notification-btn"
          aria-label="Notifications"
          onClick={(e) => {
            e.preventDefault();
            route('/notifications');
          }}
        >
          <i className="fas fa-bell"></i>
        </a>
      </div>
    </div>
  );
};

export default DashboardHeader;

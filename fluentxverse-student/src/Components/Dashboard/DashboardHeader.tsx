import { useState } from 'preact/hooks';
import { useThemeStore } from '../../context/ThemeContext';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  user?: {
    name?: string;
    profilePicture?: string;
    email?: string;
  };
}

const DashboardHeader = ({ user }: DashboardHeaderProps) => {
  const { isDarkMode, toggleTheme } = useThemeStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <div className={`dashboard-header ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="logo">

      </div>

      <div className="dashboard-header-actions">
        {/* Theme toggle */}
        <button 
          className="dashboard-action-btn theme-toggle"
          onClick={toggleTheme}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        {/* Notifications */}
        <div className="dashboard-notification-container">
          <button 
            className={`dashboard-action-btn ${showNotifications ? 'active' : ''}`}
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <i className="fas fa-bell"></i>
            <span className="notification-badge">3</span>
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h4>Notifications</h4>
                <button className="mark-all-read">Mark all as read</button>
              </div>
              <div className="notifications-list">
                <div className="notification-item unread">
                  <div className="notification-icon green">
                    <i className="fas fa-leaf"></i>
                  </div>
                  <div className="notification-content">
                    <p>Your farm data has been analyzed. New insights available!</p>
                    <span className="notification-time">2 hours ago</span>
                  </div>
                </div>
                <div className="notification-item unread">
                  <div className="notification-icon blue">
                    <i className="fas fa-tint"></i>
                  </div>
                  <div className="notification-content">
                    <p>Weather alert: Light rain forecasted for your farm location tomorrow.</p>
                    <span className="notification-time">5 hours ago</span>
                  </div>
                </div>
                <div className="notification-item unread">
                  <div className="notification-icon orange">
                    <i className="fas fa-coins"></i>
                  </div>
                  <div className="notification-content">
                    <p>New financial service available for sustainable farming practices.</p>
                    <span className="notification-time">1 day ago</span>
                  </div>
                </div>
              </div>
              <div className="notifications-footer">
                <button className="view-all-notifications">View all notifications</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;

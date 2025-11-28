import { useAuthStore } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import { useLocation } from 'wouter';
import './Settings.css';

const Settings = () => {
  const { logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      logout();
      // First redirect to homepage
      setLocation('/');
      // Then force a page reload to clear any cached states
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>
        
        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Dark Mode</h3>
              <p>Switch between light and dark themes</p>
            </div>
            <button 
              className={`theme-toggle-btn ${isDarkMode ? 'dark' : 'light'}`}
              onClick={toggleTheme}
            >
              <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Account</h2>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Sign Out</h3>
              <p>Securely log out of your account</p>
            </div>
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              <i className="fas fa-sign-out-alt"></i>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

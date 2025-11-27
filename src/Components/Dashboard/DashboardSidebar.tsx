import { useThemeStore } from '../../context/ThemeContext';
import './DashboardSidebar.css';

interface DashboardSidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  logout?: () => void;
}

const DashboardSidebar = ({ 
  activeSection, 
  setActiveSection,
  logout 
}: DashboardSidebarProps) => {
  const { isDarkMode } = useThemeStore();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'fa-home' },
    { id: 'farm', label: 'Farm Management', icon: 'fa-seedling' },
    { id: 'data', label: 'Farm Data', icon: 'fa-chart-line' },
    { id: 'market', label: 'Marketplace', icon: 'fa-store' },
    { id: 'finance', label: 'Financial Services', icon: 'fa-dollar-sign' },
    { id: 'community', label: 'Community', icon: 'fa-users' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const handleLogout = () => {
    if (logout) {
      logout();
    }
  };

  return (
    <div className={`dashboard-sidebar ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="dashboard-sidebar-header">
        <img 
          src="/assets/img/logo/icon_logo.png" 
          alt="Decentragri Logo" 
          className="dashboard-logo" 
        />
        <h3>Decentragri</h3>
      </div>

      <div className="dashboard-nav">
        {navItems.map((item) => (
          <div 
            key={item.id}
            className={`dashboard-nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => setActiveSection(item.id)}
          >
            <i className={`fas ${item.icon}`}></i>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-sidebar-footer">
        <button 
          className="dashboard-logout-btn"
          onClick={handleLogout}
        >
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardSidebar;

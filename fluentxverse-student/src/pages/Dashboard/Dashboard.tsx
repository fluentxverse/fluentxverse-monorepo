import { useEffect } from 'preact/hooks';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import DashboardHeader from '../../Components/Common/DashboardHeader';
import SideBar from '@/Components/IndexOne/SideBar';
import LoadingSpinner from '@/Components/LoadingSpinner';
import './Dashboard.css';

const Dashboard = () => {
  const { user, isAuthenticated, initialLoading, logout } = useAuthContext();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (!initialLoading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated, initialLoading, user]);

  if (initialLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="main-wrapper">
      <SideBar />
      <div className={`dashboard-container ${isDarkMode ? 'dark-mode' : ''}`}>
        <DashboardHeader user={user || undefined} />
        <div className="dashboard-content">
          <div className="dashboard-welcome">
            <h1>Welcome back, {user?.givenName || 'Student'}!</h1>
            <p>Ready to continue your language learning journey?</p>
            <div className="dashboard-quick-actions">
              <a href="/tutors" className="quick-action-btn">Find a Tutor</a>
              <a href="/schedule" className="quick-action-btn">View Schedule</a>
              <a href="/materials" className="quick-action-btn">Learning Materials</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

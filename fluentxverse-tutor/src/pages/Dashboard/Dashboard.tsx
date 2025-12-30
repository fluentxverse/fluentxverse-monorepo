import { useEffect } from 'preact/hooks';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import DashboardHeader from '@/Components/Dashboard/DashboardHeader';
import SideBar from '@/Components/IndexOne/SideBar';
import DashboardOverview from '@/Components/Dashboard/DashboardOverview';
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
          <DashboardOverview  />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

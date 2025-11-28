import { useEffect } from 'preact/hooks';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import DashboardHeader from '@/Components/Dashboard/DashboardHeader';
import SideBar from '@/Components/IndexOne/SideBar';
import DashboardOverview from '@/Components/Dashboard/DashboardOverview';
import DecentragriLoader from '../../Components/IndexOne/DecentragriLoader';
import './Dashboard.css';

const Dashboard = () => {
  const { user, isAuthenticated, loading, logout } = useAuthContext();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated, loading, user]);

  if (loading) {
    return <DecentragriLoader />;
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

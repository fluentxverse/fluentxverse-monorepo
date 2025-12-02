import { useEffect } from 'preact/hooks';
import { useThemeStore } from '@/context/ThemeContext';
import { useAuthStore } from '@/context/AuthContext';
import DashboardHeader from '@/Components/Dashboard/DashboardHeader';
import SideBar from '@/Components/IndexOne/SideBar';
import DecentragriLoader from '@/Components/IndexOne/DecentragriLoader';
import Wallet from '@components/Wallet/Wallet';

import './Staking.css';


const WalletPage = () => {
  const userInfo = useAuthStore((state) => state.userInfo);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const loading = useAuthStore((state) => state.loading);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    document.title = 'Wallet | FluentXVerse';
  }, []);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      window.location.href = '/';
    }
  }, [isLoggedIn, loading]);

  if (loading) {
    return <DecentragriLoader />;
  }


  return (
    <div className="main-wrapper">
      <SideBar />
      <div className={`dashboard-container ${isDarkMode ? 'dark-mode' : ''}`}>
        <DashboardHeader user={userInfo || undefined} />
        <div className="dashboard-content">
          <Wallet />
        </div>
      </div>
    </div>
  );
};

export default WalletPage;









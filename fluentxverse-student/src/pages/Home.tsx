import { useEffect, useRef } from 'preact/hooks';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, initialLoading, logout, user } = useAuthContext();
  const logoutRetryRef = useRef(false);

  useEffect(() => {
    // Check if we just attempted logout but cookie wasn't cleared
    const pendingLogout = sessionStorage.getItem('fxv_pending_logout');
    
    if (!initialLoading && pendingLogout === 'true') {
      // Clear the flag first to prevent infinite loops
      sessionStorage.removeItem('fxv_pending_logout');
      
      if (isAuthenticated) {
        // Cookie still exists - retry logout
        if (!logoutRetryRef.current) {
          logoutRetryRef.current = true;
          logout();
        }
        return;
      }
    }
    
    // Only redirect if:
    // 1. Initial auth check is complete (not still loading)
    // 2. User is actually authenticated
    // 3. Not coming from a logout (check localStorage as source of truth)
    const hasLocalSession = localStorage.getItem('fxv_user_id');
    
    if (!initialLoading && isAuthenticated && hasLocalSession) {
      window.location.href = '/home';
    }
  }, [isAuthenticated, initialLoading, logout]);

  // Landing page - no redirect needed for unauthenticated users
  const showSidebar = Boolean(isAuthenticated && user);

  return (
    <>
      {showSidebar ? <SideBar /> : null}
      <div className={`main-content ${showSidebar ? '' : 'no-sidebar'}`}>
        <Header/>
        <IndexOne/>
        {/* <CallToAction /> */}
        <Footer />
      </div>
    </>
  );
};

export default Home;
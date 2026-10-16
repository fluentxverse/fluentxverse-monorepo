import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, initialLoading, logout } = useAuthContext();
  const { route } = useLocation();
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
    
    if (!initialLoading && isAuthenticated) {
      route('/home');
    }
  }, [isAuthenticated, initialLoading, logout, route]);

  if (isAuthenticated) return null;

  return (
    <>
      <div className="main-content no-sidebar">
        <Header/>
        <IndexOne/>
        {/* <CallToAction /> */}
        <Footer />
      </div>
    </>
  );
};

export default Home;

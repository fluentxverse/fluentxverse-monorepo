import { useEffect } from 'preact/hooks';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import SideBar from '../Components/IndexOne/SideBar';
import CallToAction from '../Components/Common/CallToAction';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, initialLoading } = useAuthContext();

  // Redirect authenticated users to /home (but wait for auth check to complete)
  useEffect(() => {
    // Don't redirect while still checking authentication
    if (initialLoading) return;
    
    if (isAuthenticated) {
      window.location.href = '/home';
    }
  }, [isAuthenticated, initialLoading]);

  // Landing page - no redirect needed for unauthenticated users
  return (
    <>
      <SideBar/>
      <div className="main-content">
        <Header/>
        <IndexOne/>
        {/* <CallToAction />
        <Footer /> */}
      </div>
    </>
  );
};

export default Home;
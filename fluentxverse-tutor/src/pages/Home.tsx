import { useEffect } from 'preact/hooks';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, initialLoading } = useAuthContext();

  useEffect(() => {
    // Only redirect if:
    // 1. Initial auth check is complete (not still loading)
    // 2. User is actually authenticated
    // 3. Not coming from a logout (check localStorage as source of truth)
    const hasLocalSession = localStorage.getItem('fxv_user_id');
    
    if (!initialLoading && isAuthenticated && hasLocalSession) {
      window.location.href = '/home';
    }
  }, [isAuthenticated, initialLoading]);

  return (
    <>
      <Header/>
      <IndexOne/>
      <Footer />
    </>
  );
};

export default Home;
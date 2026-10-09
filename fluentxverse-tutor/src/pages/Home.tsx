import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, initialLoading } = useAuthContext();
  const { route } = useLocation();

  useEffect(() => {
    if (!initialLoading && isAuthenticated) {
      route('/home');
    }
  }, [isAuthenticated, initialLoading, route]);

  if (isAuthenticated) return null;

  return (
    <>
      <Header showThemeSwitch={false} />
      <IndexOne/>
      <Footer />
    </>
  );
};

export default Home;

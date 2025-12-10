import { useEffect } from 'preact/hooks';
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/home';
    }
  }, [isAuthenticated]);

  return (
    <>
      <Header/>
      <IndexOne/>
      <Footer />
    </>
  );
};

export default Home;
import { useEffect } from 'preact/hooks';
import { useAuthContext } from '@/context/AuthContext';
import HomePage from './HomePage';

const HomeProtected = () => {
  const { isAuthenticated, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [loading, isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated) return null;
  return <HomePage />;
};

export default HomeProtected;

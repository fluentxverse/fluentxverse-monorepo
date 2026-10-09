import { useEffect } from 'preact/hooks';
import { useAuthContext } from '@/context/AuthContext';
import HomePage from './HomePage';

const HomeProtected = () => {
  const { isAuthenticated, initialLoading: loading, sessionExpired } = useAuthContext();

  useEffect(() => {
    if (!loading && !isAuthenticated && !sessionExpired) {
      window.location.href = '/';
    }
  }, [loading, isAuthenticated, sessionExpired]);

  if (loading) return null;
  if (!isAuthenticated) return null;
  return <HomePage />;
};

export default HomeProtected;

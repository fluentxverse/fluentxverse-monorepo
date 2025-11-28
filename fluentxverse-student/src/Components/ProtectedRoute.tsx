import { JSX } from 'preact';
import { useAuthContext } from '../context/AuthContext';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import LoadingSpinner from './LoadingSpinner';
import { PROTECTED_PATHS } from '../config/protectedPaths';

interface ProtectedRouteProps {
  Component: any;
}

export const ProtectedRoute = ({ Component }: ProtectedRouteProps): JSX.Element | null => {
  const { user, initialLoading, loginLoading } = useAuthContext();
  const { route } = useLocation();

  useEffect(() => {
    if (!initialLoading && !user && !loginLoading) {
      route('/');
    }
  }, [initialLoading, user, loginLoading, route]);

  if (initialLoading || loginLoading) return <LoadingSpinner />;
  if (!user) return null;
  return <Component />;
};

// HOC helper to wrap components easily in router config
export const withProtected = (Cmp: any) => () => <ProtectedRoute Component={Cmp} />;
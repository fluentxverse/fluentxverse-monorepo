import { JSX } from 'preact';
import { useAuthContext } from '../context/AuthContext';
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import LoadingSpinner from './LoadingSpinner';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { getExamStatus, getSpeakingExamStatus } from '../api/exam.api';

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

// ============================================================================
// CERTIFIED ROUTE - Only allows access if tutor has passed both exams
// ============================================================================

interface CertifiedRouteProps {
  Component: any;
}

export const CertifiedRoute = ({ Component }: CertifiedRouteProps): JSX.Element | null => {
  const { user, initialLoading, loginLoading } = useAuthContext();
  const { route } = useLocation();
  const [certificationLoading, setCertificationLoading] = useState(true);
  const [isCertified, setIsCertified] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!initialLoading && !user && !loginLoading) {
      route('/');
    }
  }, [initialLoading, user, loginLoading, route]);

  // Check certification status
  useEffect(() => {
    const checkCertification = async () => {
      if (!user?.userId) return;
      
      try {
        const [writtenRes, speakingRes] = await Promise.all([
          getExamStatus(user.userId),
          getSpeakingExamStatus(user.userId),
        ]);
        
        const writtenPassed = writtenRes.success && writtenRes.status?.passed === true;
        const speakingPassed = speakingRes.success && speakingRes.status?.passed === true;
        
        if (writtenPassed && speakingPassed) {
          setIsCertified(true);
        } else {
          // Redirect to home with message
          route('/home?certification=required');
        }
      } catch (err) {
        console.error('Failed to check certification:', err);
        route('/home?certification=error');
      } finally {
        setCertificationLoading(false);
      }
    };

    if (user?.userId && !initialLoading) {
      checkCertification();
    }
  }, [user?.userId, initialLoading, route]);

  if (initialLoading || loginLoading || certificationLoading) return <LoadingSpinner />;
  if (!user) return null;
  if (!isCertified) return null;
  return <Component />;
};

// HOC helper for certified routes
export const withCertified = (Cmp: any) => () => <CertifiedRoute Component={Cmp} />;
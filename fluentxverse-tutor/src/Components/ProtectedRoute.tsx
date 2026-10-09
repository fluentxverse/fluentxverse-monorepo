import { JSX } from 'preact';
import { useAuthContext } from '../context/AuthContext';
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import LoadingSpinner from './LoadingSpinner';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { proofApi } from '../api/proof.api';

interface ProtectedRouteProps {
  Component: any;
}

export const ProtectedRoute = ({ Component }: ProtectedRouteProps): JSX.Element | null => {
  const { user, initialLoading, loginLoading, logoutLoading } = useAuthContext();
  const { route } = useLocation();

  useEffect(() => {
    if (!initialLoading && !user && !loginLoading && !logoutLoading) {
      route('/');
    }
  }, [initialLoading, user, loginLoading, logoutLoading, route]);

  if (initialLoading || loginLoading) return <LoadingSpinner />;
  if (!user) return null;
  return <Component />;
};

// HOC helper to wrap components easily in router config
export const withProtected = (Cmp: any) => () => <ProtectedRoute Component={Cmp} />;

// ============================================================================
// CERTIFIED ROUTE - Only allows access if tutor has passed both exams
// ============================================================================

// Test accounts that bypass certification requirements
const TEST_ACCOUNTS = ['paulanthonyarriola@gmail.com'];

interface CertifiedRouteProps {
  Component: any;
}

export const CertifiedRoute = ({ Component }: CertifiedRouteProps): JSX.Element | null => {
  const { user, initialLoading, loginLoading, logoutLoading } = useAuthContext();
  const { route } = useLocation();
  const [certificationLoading, setCertificationLoading] = useState(true);
  const [isCertified, setIsCertified] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!initialLoading && !user && !loginLoading && !logoutLoading) {
      route('/');
    }
  }, [initialLoading, user, loginLoading, logoutLoading, route]);

  // Check certification status
  useEffect(() => {
    let active = true;
    const checkCertification = async () => {
      if (!user?.userId) return;
      
      // Bypass for test accounts
      if (user.email && TEST_ACCOUNTS.includes(user.email)) {
        setIsCertified(true);
        setCertificationLoading(false);
        return;
      }
      
      try {
        const certification = await proofApi.getTutorCertificationStatus();
        if (!active) return;
        const hasAllRequirements = certification.snapshot.missingRequirements.length === 0;

        if (hasAllRequirements) {
          setIsCertified(true);
        } else {
          // Redirect to home with message
          route('/home?certification=required');
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to check certification:', err);
        route('/home?certification=error');
      } finally {
        if (active) setCertificationLoading(false);
      }
    };

    if (user?.userId && !initialLoading && !logoutLoading) {
      checkCertification();
    }
    return () => { active = false; };
  }, [user?.userId, initialLoading, logoutLoading, route]);

  if (initialLoading || loginLoading || certificationLoading) return <LoadingSpinner />;
  if (!user) return null;
  if (!isCertified) return null;
  return <Component />;
};

// HOC helper for certified routes
export const withCertified = (Cmp: any) => () => <CertifiedRoute Component={Cmp} />;

import { createEffect, createSignal, onCleanup, Show, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { getTutorEmailStatus } from '../api/emailVerification.api';
import { useAuthContext } from '../context/AuthContext';
import { useLocation } from '../routing';
import { ProtectedRoute } from './ProtectedRoute';
import LoadingSpinner from './LoadingSpinner';
import StatusPanel from '../../../shared/ui/StatusPanel';
export const withVerifiedEmail = (Component: Component<any>, allowCompleted = false) => () => {
  const auth = useAuthContext(), location = useLocation(), params = useParams();
  const [ready, setReady] = createSignal(false), [error, setError] = createSignal(false), [revision, setRevision] = createSignal(0);
  createEffect(() => {
    const id = auth.user?.userId; revision();
    if (!id || auth.initialLoading) return;
    let current = true; onCleanup(() => { current = false; }); setReady(false); setError(false);
    void getTutorEmailStatus().then(status => {
      if (!current) return;
      if (status.verified || (allowCompleted && status.assessmentComplete)) setReady(true);
      else location.route('/confirm-email', true);
    }).catch(() => { if (current) setError(true); });
  });
  return <ProtectedRoute Component={() => <Show when={!error()} fallback={<StatusPanel kind="error" title="Could not check email confirmation" message="Please try again. Your application is saved." onRetry={() => setRevision(n => n + 1)} />}><Show when={ready()} fallback={<LoadingSpinner />}><Component {...params} /></Show></Show>} />;
};

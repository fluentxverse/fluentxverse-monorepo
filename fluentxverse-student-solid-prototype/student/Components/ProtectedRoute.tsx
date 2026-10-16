import { createEffect, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { useAuthContext } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
export function ProtectedRoute(props: { Component: any }) {
  const auth = useAuthContext();
  const navigate = useNavigate();
  createEffect(() => {
    if (!auth.initialLoading && !auth.user && !auth.loginLoading && !auth.sessionExpired) navigate('/', { replace: true });
  });
  return <Show when={!auth.initialLoading && !auth.loginLoading} fallback={<LoadingSpinner />}>
    <Show when={auth.isAuthenticated}><Dynamic component={props.Component} /></Show>
  </Show>;
}
export const withProtected = (Component: any) => () => <ProtectedRoute Component={Component} />;

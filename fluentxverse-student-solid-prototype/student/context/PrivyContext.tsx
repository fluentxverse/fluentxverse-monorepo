import { createContext, createSignal, onMount, onCleanup, useContext, type ParentProps } from 'solid-js';
import { createIdentity } from '../../src/identity';
import type { Identity, Provider } from '../../src/types';

interface PrivyIntegrationValue {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  loading: boolean;
  error: string | null;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  initOAuth: (provider: Provider) => Promise<void>;
}
const unavailable: PrivyIntegrationValue = {
  configured: false, ready: true, authenticated: false, userId: null, loading: false, error: null,
  getAccessToken: async () => null, logout: async () => {},
  initOAuth: async () => { throw new Error('Social sign-in is not configured.'); },
};
const Context = createContext<PrivyIntegrationValue>(unavailable);

export function PrivyIntegrationProvider(props: ParentProps) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
  const [ready, setReady] = createSignal(!appId);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [subject, setSubject] = createSignal<string | null>(null);
  let identity: Identity | undefined;
  let disposed = false;
  let generation = 0;
  // This subject only drives the SDK UI. AuthContext verifies the server cookie
  // and student role before granting access to any protected route.
  const tokenSubject = (token: string | null) => {
    try { const payload = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return typeof payload.sub === 'string' ? payload.sub : null; }
    catch { return null; }
  };
  const getAccessToken = async () => {
    const current = generation;
    const token = await identity?.token() || null;
    if (!disposed && current === generation) setSubject(tokenSubject(token));
    return token;
  };
  onMount(() => {
    if (!appId) return;
    void (async () => {
      try {
        identity = await createIdentity(appId);
        await identity.initialize();
        const callback = new URL(location.href);
        try { await identity.complete(callback); }
        finally {
          for (const key of ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider']) callback.searchParams.delete(key);
          history.replaceState(history.state, '', callback);
        }
        await getAccessToken();
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Social sign-in could not be initialized.');
      } finally { if (!disposed) setReady(true); }
    })();
  });
  onCleanup(() => { disposed = true; generation++; });
  const value: PrivyIntegrationValue = {
    configured: Boolean(appId),
    get ready() { return ready(); },
    get loading() { return loading(); },
    get authenticated() { return Boolean(subject()); },
    get userId() { return subject(); },
    get error() { return error(); },
    getAccessToken,
    logout: async () => { generation++; await identity?.logout(); setSubject(null); },
    initOAuth: async provider => {
      if (!ready() || !identity) throw new Error('Sign-in is still loading. Please try again.');
      setLoading(true); setError(null);
      try {
        window.opener = null;
        sessionStorage.removeItem('fxv_pending_logout');
        sessionStorage.removeItem('fxv_privy_auth_error');
        location.assign(await identity.start(provider));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Social sign-in failed.');
        throw cause;
      } finally { setLoading(false); }
    },
  };
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
export const usePrivyIntegration = () => useContext(Context);

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { PrivyProvider, useLoginWithOAuth, usePrivy } from '@privy-io/react-auth';

type SocialProvider = 'twitter' | 'google' | 'apple';

interface PrivyIntegrationValue {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  loading: boolean;
  error: string | null;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  initOAuth: (provider: SocialProvider) => Promise<void>;
}

const unavailableValue: PrivyIntegrationValue = {
  configured: false,
  ready: true,
  authenticated: false,
  userId: null,
  loading: false,
  error: null,
  getAccessToken: async () => null,
  logout: async () => undefined,
  initOAuth: async () => { throw new Error('Social sign-in is not configured for this environment.'); },
};

const PrivyIntegrationContext = createContext<PrivyIntegrationValue>(unavailableValue);

function PrivyRuntimeBridge({ children }: { children: any }) {
  const { ready, authenticated, user, getAccessToken, logout, error } = usePrivy();
  const { initOAuth, loading, state } = useLoginWithOAuth();

  return (
    <PrivyIntegrationContext.Provider value={{
      configured: true,
      ready,
      authenticated,
      userId: user?.id || null,
      loading,
      error: error?.message || (state.status === 'error' ? 'Sign-in could not be completed. Please try again.' : null),
      getAccessToken,
      logout,
      initOAuth: async (provider) => {
        if (!ready) throw new Error('Sign-in is still loading. Please try again in a moment.');
        // Headless OAuth returns to this tab. An inherited opener can cause the
        // SDK to mistake that callback for a popup and skip completing it.
        window.opener = null;
        const url = new URL(window.location.href);
        for (const key of ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider']) url.searchParams.delete(key);
        window.history.replaceState(window.history.state, '', url);
        sessionStorage.removeItem('fxv_pending_logout');
        sessionStorage.removeItem('fxv_privy_auth_error');
        // A failed application-session exchange may leave Privy authenticated.
        // Start a fresh OAuth session so its completion triggers a new exchange.
        if (authenticated) await logout();
        await initOAuth({ provider });
      },
    }}>
      {children}
    </PrivyIntegrationContext.Provider>
  );
}

const PreactPrivyProvider = PrivyProvider as any;

export function PrivyIntegrationProvider({ children }: { children: any }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
  if (!appId) {
    return <PrivyIntegrationContext.Provider value={unavailableValue}>{children}</PrivyIntegrationContext.Provider>;
  }

  return (
    <PreactPrivyProvider
      appId={appId}
      config={{
        loginMethods: ['twitter', 'google', 'apple'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        appearance: { theme: 'light', accentColor: '#0245ae' },
      }}
    >
      <PrivyRuntimeBridge>{children}</PrivyRuntimeBridge>
    </PreactPrivyProvider>
  );
}

export const usePrivyIntegration = () => useContext(PrivyIntegrationContext);

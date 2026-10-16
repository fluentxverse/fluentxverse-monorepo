import type { Identity, Provider } from './types';
import { isPrivyOriginAllowed, originError } from './origin';

export function readCallback(url: URL) {
  const code = url.searchParams.get('privy_oauth_code');
  const state = url.searchParams.get('privy_oauth_state');
  const provider = url.searchParams.get('privy_oauth_provider');
  if (!code && !state && !provider) return null;
  if (!code || !state || !['google', 'twitter', 'apple'].includes(provider || '') || code === 'undefined') {
    throw new Error('Incomplete or canceled OAuth callback. Start sign-in again.');
  }
  return { code, state, provider: provider as Provider };
}

export async function createIdentity(appId: string): Promise<Identity> {
  if (!appId.trim()) throw new Error('Configure a public Privy app ID before running live OAuth.');
  const { default: Privy } = await import('@privy-io/js-sdk-core');
  const prefix = `fxv-solid-lab:privy:${appId.trim()}:`;
  const client = new Privy({
    appId: appId.trim(),
    sessions: { cookieWriteBehavior: 'never' },
    storage: {
      get: key => { const raw = localStorage.getItem(prefix + key); return raw === null ? undefined : JSON.parse(raw); },
      put: (key, value) => localStorage.setItem(prefix + key, JSON.stringify(value)),
      del: key => localStorage.removeItem(prefix + key),
      getKeys: () => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)),
    },
  });
  return {
    initialize: () => client.initialize(),
    originAllowed: () => {
      const config = client.app.getConfig();
      return config ? isPrivyOriginAllowed(config.allowed_domains, location.origin) : undefined;
    },
    enabledProviders: () => {
      const config = client.app.getConfig();
      if (!config) return null;
      const methods = { google: config.google_oauth, twitter: config.twitter_oauth, apple: config.apple_oauth };
      return (['google', 'twitter', 'apple'] as Provider[]).filter(provider => methods[provider]);
    },
    token: () => client.getAccessToken(),
    start: async provider => {
      const config = client.app.getConfig();
      if (config && isPrivyOriginAllowed(config.allowed_domains, location.origin) === false) throw originError(location.origin);
      const enabled = config && { google: config.google_oauth, twitter: config.twitter_oauth, apple: config.apple_oauth };
      if (enabled && !enabled[provider]) {
        throw Object.assign(new Error(`${provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'X'} sign-in is disabled in this Privy app. Enable it in the Privy dashboard or select an enabled provider.`), { code: 'disallowed_login_method' });
      }
      if (await client.getAccessToken()) await client.auth.logout();
      const redirect = new URL(window.location.href);
      for (const key of ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider']) redirect.searchParams.delete(key);
      redirect.searchParams.set('mode', 'live');
      try {
        const result = await client.auth.oauth.generateURL(provider, redirect.href);
        return result.url;
      } catch (error) {
        if ((error as { code?: string }).code === 'invalid_origin') throw originError(location.origin);
        throw error;
      }
    },
    complete: async url => {
      const callback = readCallback(url);
      if (!callback) return false;
      // The SDK verifies the returned state against its persisted PKCE state.
      await client.auth.oauth.loginWithCode(callback.code, callback.state, callback.provider);
      return true;
    },
    logout: () => client.auth.logout(),
  };
}

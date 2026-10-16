import { render } from 'solid-js/web';
import { createSignal, For, Show, onCleanup } from 'solid-js';
import { ArrowRight, Check, CircleAlert, Copy, ExternalLink, LogOut, RefreshCw, ShieldCheck, Wallet } from 'lucide-solid';
import type { EIP1193Provider } from 'viem';
import { createApi } from './api';
import { createSession } from './session';
import { createIdentity } from './identity';
import { connectWallet } from './wallet';
import { createSimulation, type Scenario } from './simulation';
import { originError } from './origin';
import type { Identity, Provider, SessionState } from './types';
import homeArt from '../home-v1.webp';
import './style.css';

type BrowserProvider = EIP1193Provider & {
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
declare global { interface Window { ethereum?: BrowserProvider } }

function App() {
  const initialLive = new URL(location.href).searchParams.get('mode') === 'live';
  const [mode, setMode] = createSignal<'simulation' | 'live'>(initialLive ? 'live' : 'simulation');
  const [tab, setTab] = createSignal('session');
  const [scenario, setScenario] = createSignal<Scenario>('existing');
  const [session, setSession] = createSignal<SessionState>({ phase: 'guest', user: null, message: 'Not signed in.' });
  const [busy, setBusy] = createSignal(false);
  const [notice, setNotice] = createSignal('');
  const [identityStatus, setIdentityStatus] = createSignal('Not tested');
  const [originStatus, setOriginStatus] = createSignal('Not checked');
  const [apiStatus, setApiStatus] = createSignal('Not checked');
  const [originCopied, setOriginCopied] = createSignal(false);
  const [providers, setProviders] = createSignal<Provider[] | null>(null);
  const [wallet, setWallet] = createSignal<Awaited<ReturnType<typeof connectWallet>> | null>(null);
  const [walletStatus, setWalletStatus] = createSignal('Not tested');
  const [entries, setEntries] = createSignal<{ time: string; message: string }[]>([]);
  const [appId, setAppId] = createSignal(import.meta.env.VITE_PRIVY_APP_ID || '');
  const [apiUrl, setApiUrl] = createSignal(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8776');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  let identity: Identity | undefined;
  let removeWalletListeners: (() => void) | undefined;
  let mounted = true;
  const log = (message: string) => {
    if (mounted) setEntries(items => [{ time: new Date().toLocaleTimeString(), message }, ...items].slice(0, 30));
  };
  const publishSession = (state: SessionState) => {
    setSession(state);
    if (mode() === 'live' && state.phase === 'authenticated') setApiStatus('Reachable');
    log(state.message);
  };
  const api = () => mode() === 'simulation' ? simulation : createApi(apiUrl());
  let simulation = createSimulation(scenario);
  let controller = createSession(api(), publishSession);
  const resetController = () => {
    controller.dispose();
    simulation = createSimulation(scenario);
    controller = createSession(api(), publishSession);
    setSession({ phase: 'guest', user: null, message: 'Not signed in.' });
    setNotice('');
  };
  const work = async (action: () => Promise<void>) => {
    if (busy()) return;
    setBusy(true); setNotice('');
    try { await action(); }
    catch (error) {
      // Do not put SDK tokens, callback codes, or arbitrary provider messages into the journal.
      const message = error instanceof Error ? error.message : 'The check failed.';
      setNotice(message); log('Compatibility check failed. See the current error.');
    }
    finally { if (mounted) setBusy(false); }
  };
  const initialize = async () => {
    if (identity) return identity;
    const next = await createIdentity(appId());
    await next.initialize();
    identity = next;
    setProviders(next.enabledProviders());
    setOriginStatus(next.originAllowed() === false ? 'Approval required' : next.originAllowed() === true ? 'Approved' : 'SDK verification required');
    setIdentityStatus('Initialized'); log('Privy core initialized without React.');
    return identity;
  };
  const checkConfiguration = () => work(async () => {
    identity = undefined;
    const current = await initialize();
    try {
      await api().me();
      setApiStatus('Reachable');
    } catch (error) {
      if ((error as { status?: number }).status === 401) setApiStatus('Reachable');
      else { setApiStatus('Unavailable'); throw error; }
    }
    if (current.originAllowed() === false) throw originError(location.origin);
    log('Origin and API configuration checked.');
  });
  const exchangeIdentity = async () => {
    const current = await initialize();
    const token = await current.token();
    if (!token) throw new Error('No Privy session. Complete social sign-in first.');
    await controller.exchange(token);
  };
  const social = (provider: Provider) => work(async () => {
    if (mode() === 'simulation') { setIdentityStatus('Simulated'); await controller.exchange('simulation-only'); return; }
    const current = await initialize();
    window.opener = null;
    location.assign(await current.start(provider));
  });
  const callback = new URL(location.href);
  if (initialLive && ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'].some(key => callback.searchParams.has(key))) {
    void work(async () => {
      try {
        const current = await initialize();
        await current.complete(callback);
        setIdentityStatus('OAuth completed');
        await exchangeIdentity();
      } finally {
        const clean = new URL(location.href);
        for (const key of ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider']) clean.searchParams.delete(key);
        history.replaceState(null, '', clean);
      }
    });
  }
  onCleanup(() => {
    mounted = false;
    controller.dispose();
    removeWalletListeners?.();
    identity = undefined;
  });

  return <div class="app">
    <header><a class="brand" href="/">FluentXVerse <span>Solid Lab</span></a><span class={`mode ${mode()}`}>{mode() === 'simulation' ? 'Simulation' : 'Live integration'}</span></header>
    <main>
      <section class="page-heading"><img src={homeArt} alt="" /><div><p class="eyebrow">Student app / isolated prototype</p><h1>Compatibility workspace</h1></div></section>
      <div class="toolbar">
        <div class="segments" aria-label="Environment"><For each={['simulation', 'live'] as const}>{value => <button disabled={busy() || session().phase === 'authenticated'} classList={{ active: mode() === value }} onClick={() => {
          setMode(value); identity = undefined; setIdentityStatus('Not tested');
          setOriginStatus('Not checked'); setApiStatus('Not checked');
          setProviders(null);
          setWallet(null); removeWalletListeners?.(); setWalletStatus('Not tested'); resetController();
          const url = new URL(location.href); url.searchParams.set('mode', value); history.replaceState(null, '', url);
        }}>{value === 'simulation' ? 'Simulation' : 'Live'}</button>}</For></div>
        <Show when={mode() === 'simulation'}><label class="scenario">Scenario<select value={scenario()} disabled={busy() || session().phase === 'authenticated'} onChange={event => { setScenario(event.currentTarget.value as Scenario); resetController(); }}>
          <option value="existing">Existing student</option><option value="new">Registration required</option><option value="rejected-cookie">Cookie rejected</option><option value="wrong-role">Wrong account role</option><option value="offline">Network failure</option><option value="expired">Expired session</option>
        </select></label></Show>
      </div>
      <nav class="tabs" aria-label="Compatibility views"><For each={['session', 'wallet', 'results']}>{value => <button aria-current={tab() === value ? 'page' : undefined} classList={{ active: tab() === value }} onClick={() => setTab(value)}>{value === 'session' ? 'Login & session' : value === 'wallet' ? 'Wallet' : 'Test journal'}</button>}</For></nav>
      <Show when={notice()}><div class="error" role="alert"><CircleAlert size={18} /><span>{notice()}</span><Show when={mode() === 'live' && originStatus() === 'Approval required'}><a href="https://dashboard.privy.io" target="_blank" rel="noopener noreferrer">Privy dashboard<ExternalLink size={14} /></a></Show></div></Show>
      <Show when={mode() === 'live'}><section class="configuration">
        <label>Privy app ID<input value={appId()} disabled={busy() || session().phase === 'authenticated'} onInput={event => { setAppId(event.currentTarget.value); identity = undefined; setIdentityStatus('Not tested'); setOriginStatus('Not checked'); setProviders(null); }} autocomplete="off" /></label>
        <label>Student API URL<input value={apiUrl()} disabled={busy() || session().phase === 'authenticated'} onInput={event => { setApiUrl(event.currentTarget.value); setApiStatus('Not checked'); resetController(); }} type="url" /></label>
        <button disabled={busy()} onClick={checkConfiguration}><ShieldCheck size={16} />Check configuration</button>
        <div class="origin-details"><span>Browser origin <strong>{location.origin}</strong></span><button class="icon-button" title={originCopied() ? 'Origin copied' : 'Copy origin'} aria-label="Copy origin" onClick={() => work(async () => { await navigator.clipboard.writeText(location.origin); setOriginCopied(true); })}>{originCopied() ? <Check size={16} /> : <Copy size={16} />}</button><span classList={{ pending: originStatus() === 'Approval required', good: originStatus() === 'Approved' }}>Privy: {originStatus()}</span><span classList={{ good: apiStatus() === 'Reachable' }}>API: {apiStatus()}</span></div>
      </section></Show>
      <Show when={tab() === 'session'}>
        <div class="columns"><section class="panel">
          <div class="panel-heading"><h2>Student sign-in</h2><span class="muted">{mode() === 'simulation' ? 'Simulated identity' : 'Privy core SDK'}</span></div>
          <div class="social"><For each={['google', 'twitter', 'apple'] as const}>{provider => <button title={mode() === 'live' && providers() && !providers()!.includes(provider) ? `${provider === 'twitter' ? 'X' : provider[0].toUpperCase() + provider.slice(1)} sign-in is disabled in this Privy app` : undefined} disabled={busy() || session().phase === 'authenticated' || (mode() === 'live' && providers() !== null && !providers()!.includes(provider))} onClick={() => social(provider)}>{provider === 'twitter' ? 'X / Twitter' : provider[0].toUpperCase() + provider.slice(1)}<ArrowRight size={16} /></button>}</For></div>
          <Show when={mode() === 'live'}><form onSubmit={event => { event.preventDefault(); void work(async () => { try { await controller.password(email(), password()); } finally { setPassword(''); } }); }}>
            <label>Email<input type="email" required value={email()} onInput={event => setEmail(event.currentTarget.value)} autocomplete="username" /></label>
            <label>Password<input type="password" required value={password()} onInput={event => setPassword(event.currentTarget.value)} autocomplete="current-password" /></label>
            <button class="primary" disabled={busy() || session().phase === 'authenticated'} type="submit">Sign in<ArrowRight size={16} /></button>
          </form></Show>
          <div class="actions"><Show when={mode() === 'live'}><button disabled={busy()} onClick={() => work(async () => { await initialize(); })}><ShieldCheck size={16} />Initialize SDK</button><button disabled={busy()} onClick={() => work(exchangeIdentity)}><ExternalLink size={16} />Exchange session</button></Show>
            <button disabled={busy()} onClick={() => work(controller.check)}><RefreshCw size={16} />Check session</button>
            <button disabled={busy()} onClick={() => work(() => controller.recover(async () => mode() === 'simulation' ? 'simulation-only' : (await initialize()).token()))}><RefreshCw size={16} />Restore session</button>
            <button disabled={busy()} onClick={() => work(async () => { await controller.logout(); if (identity) await identity.logout(); })}><LogOut size={16} />Sign out</button>
          </div>
        </section><section class="panel state-panel" aria-live="polite">
          <div class="panel-heading"><h2>Session status</h2><span class={`status ${session().phase}`}>{session().phase.replaceAll('_', ' ')}</span></div>
          <dl><dt>Identity SDK</dt><dd>{identityStatus()}</dd><dt>Student session</dt><dd>{session().user ? 'Verified by API' : 'Not confirmed'}</dd><dt>Account</dt><dd>{session().user?.givenName || 'Guest'}</dd><dt>Role</dt><dd>{session().user?.role || '-'}</dd></dl>
          <p class="session-message">{session().message}</p>
          <Show when={session().phase === 'authenticated'}><div class="confirmed"><Check size={20} />Welcome back, {session().user?.givenName || 'student'}</div></Show>
        </section></div>
      </Show>
      <Show when={tab() === 'wallet'}><section class="panel wallet-panel">
        <div class="panel-heading"><h2>Browser wallet</h2><Wallet size={20} /></div>
        <dl><dt>Address</dt><dd class="address">{wallet()?.address || 'Not connected'}</dd><dt>Network</dt><dd>{wallet()?.chainId || '-'}</dd><dt>Signature</dt><dd>{walletStatus()}</dd></dl>
        <div class="actions"><button class="primary" disabled={busy()} onClick={() => work(async () => {
          const connected = await connectWallet(window.ethereum, Number(import.meta.env.VITE_TICKET_CHAIN_ID || 84532), import.meta.env.VITE_TICKET_RPC_URL);
          setWallet(connected); setWalletStatus('Connected'); log('Browser wallet connected to the ticket test network.');
          removeWalletListeners?.();
          const changed = () => { setWallet(null); setWalletStatus('Wallet changed; reconnect required'); };
          window.ethereum?.on?.('accountsChanged', changed); window.ethereum?.on?.('chainChanged', changed); window.ethereum?.on?.('disconnect', changed);
          const provider = window.ethereum;
          removeWalletListeners = () => { for (const event of ['accountsChanged', 'chainChanged', 'disconnect']) provider?.removeListener?.(event, changed); };
        })}><Wallet size={16} />Connect wallet</button>
        <button disabled={busy() || !wallet()} onClick={() => work(async () => {
          const current = wallet()!;
          const message = 'FluentXVerse Solid compatibility test. This signature does not authorize a transaction or account registration.';
          await current.sign(message); setWalletStatus('Signature verified'); log('viem message signature verified locally.');
        })}><ShieldCheck size={16} />Test signature</button>
        <button disabled={busy() || !wallet()} onClick={() => work(async () => {
          const current = wallet()!; const challenge = await api().nonce(current.address);
          const signature = await current.sign(challenge.message);
          await controller.wallet(current.address, signature, challenge.message);
          log(mode() === 'simulation' ? 'Wallet session exchange simulated.' : 'Wallet session exchange completed.');
        })}><ArrowRight size={16} />Wallet sign-in</button>
        <button disabled={busy() || !wallet()} onClick={() => { removeWalletListeners?.(); setWallet(null); setWalletStatus('Disconnected'); }}>Disconnect</button></div>
      </section></Show>
      <Show when={tab() === 'results'}><section class="panel"><div class="panel-heading"><h2>Test journal</h2><button class="icon-button" title="Clear journal" aria-label="Clear journal" onClick={() => setEntries([])}><RefreshCw size={16} /></button></div>
        <Show when={entries().length} fallback={<p class="muted empty">No checks run in this session.</p>}><ol class="journal"><For each={entries()}>{entry => <li><time>{entry.time}</time><span>{entry.message}</span></li>}</For></ol></Show>
      </section></Show>
      <section class="coverage"><h2>Migration gates</h2><dl><dt>Solid state & rendering</dt><dd class="good">Ready for automated checks</dd><dt>Privy headless SDK</dt><dd>{identityStatus()}</dd><dt>OAuth origin</dt><dd>{originStatus()}</dd><dt>OAuth providers</dt><dd>Manual verification required</dd><dt>Student API</dt><dd>{apiStatus()}</dd><dt>Embedded wallets</dt><dd>Not in scope / currently off</dd><dt>Classroom & attendance</dt><dd>Not migrated</dd></dl></section>
    </main><footer>SolidJS prototype <span>Production student app unchanged</span></footer>
  </div>;
}

render(() => <App />, document.getElementById('app')!);

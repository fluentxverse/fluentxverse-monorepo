import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { Gift, RefreshCw, ArrowLeft, ArrowRight, ExternalLink, CheckCircle, Clock } from 'lucide-solid';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import TutorDialog from '../Components/Common/TutorDialog';
import { client, getErrorMessage } from '../api/utils';
import './RewardsPage.css';

type Claim = { id: string; token: string; symbol: string; amountUsd: string; expectedAmountOut: string; minAmountOut: string;
  deadline: number; status: string; createdAt: string; transactionHash: string | null };
type Summary = { wallet: string | null; availableUsd: string; claimsOpen: boolean; assets: { token: string; symbol: string; decimals: number }[];
  claims: Claim[]; explorer: string; chainId: number };
const activeStates = ['authorizing', 'prepared', 'queued', 'submitted', 'confirming'];
function amount(value: string, decimals = 6) {
  const n = BigInt(value), scale = 10n ** BigInt(decimals), whole = n / scale;
  const fraction = (n % scale).toString().padStart(decimals, '0').slice(0, Math.min(decimals, 8)).replace(/0+$/, '');
  return whole.toLocaleString('en-US') + (fraction ? '.' + fraction : '');
}
function usdInput(value: string) { const n = BigInt(value); return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`; }
async function request(path: string, body?: unknown) {
  const { data } = body === undefined ? await client.get('/tutor/rewards' + path) : await client.post('/tutor/rewards' + path, body);
  if (!data.success) throw Error(data.error || 'Rewards could not be checked.');
  return data.data;
}
export default function RewardsPage() {
  const [summary, setSummary] = createSignal<Summary | null>(null), [error, setError] = createSignal(''), [busy, setBusy] = createSignal(false);
  const [token, setToken] = createSignal(''), [value, setValue] = createSignal(''), [quote, setQuote] = createSignal<Claim | null>(null);
  const [saving, setSaving] = createSignal(false), [saveError, setSaveError] = createSignal(''), [notice, setNotice] = createSignal(''), [now, setNow] = createSignal(Date.now());
  let generation = 0, alive = true;
  const selected = createMemo(() => summary()?.assets.find(a => a.token === token()));
  const pending = createMemo(() => summary()?.claims.some(c => activeStates.includes(c.status)));
  const usable = createMemo(() => !busy() && !error() && summary()?.claimsOpen && summary()?.wallet && BigInt(summary()?.availableUsd || '0') > 0n && !pending());
  const expired = createMemo(() => !!quote() && quote()!.deadline * 1000 <= now());
  const refresh = async () => {
    const id = ++generation; setBusy(true);
    try {
      const data: Summary = await request('');
      if (!alive || id !== generation) return;
      setSummary(data); setError('');
      if (!data.assets.some(a => a.token === token())) setToken(data.assets[0]?.token || '');
      if (!value() && BigInt(data.availableUsd) > 0n) setValue(usdInput(data.availableUsd));
    } catch (e) { if (alive && id === generation) setError(getErrorMessage(e)); }
    finally { if (alive && id === generation) setBusy(false); }
  };
  onMount(() => { void refresh(); const poll = setInterval(() => { if (!document.hidden && pending()) void refresh(); }, 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000); onCleanup(() => { alive = false; generation++; clearInterval(poll); clearInterval(clock); }); });
  const review = async (e: SubmitEvent) => {
    e.preventDefault(); if (!usable() || saving()) return;
    setSaving(true); setSaveError(''); setNotice('');
    try { const q = await request('/quote', { token: token(), amountUsd: value() }); if (alive) { setQuote(q); setNow(Date.now()); } }
    catch (e) { if (alive) setSaveError(getErrorMessage(e)); }
    finally { if (alive) setSaving(false); }
  };
  const confirm = async () => {
    if (!quote() || saving()) return;
    setSaving(true); setSaveError('');
    try { await request('/claim', { quoteId: quote()!.id }); if (alive) { setQuote(null); setNotice('Claim submitted. Awaiting confirmation.'); await refresh(); } }
    catch (e) { if (alive) setSaveError(getErrorMessage(e)); }
    finally { if (alive) setSaving(false); }
  };
  return <><SideBar/><div class="main-content"><DashboardHeader/><main class="tutor-reward-page">
    <a class="reward-back" href="/home"><ArrowLeft size={16}/>Workspace</a>
    <header class="reward-page-heading"><h1><Gift size={25}/>Tutor Rewards</h1><button type="button" aria-label="Refresh rewards" title="Refresh rewards" disabled={busy()} onClick={() => void refresh()}><RefreshCw size={18}/></button></header>
    <Show when={error()}><p role="alert" class="reward-error">{error()}</p></Show>
    <Show when={notice()}><p role="status" class="reward-notice"><CheckCircle size={18}/>{notice()}</p></Show>
    <Show when={summary()} fallback={<p role="status">{busy() ? 'Loading rewards...' : 'Rewards are unavailable.'}</p>}>{s => <>
      <section class="reward-balance"><div><span>Available rewards</span><strong>${amount(s().availableUsd)}</strong></div><span class="reward-status">{s().claimsOpen ? 'Claims open' : 'Claims not open yet'}</span></section>
      <Show when={s().wallet}><p class="reward-wallet">Receiving wallet <a href={`${s().explorer}/address/${s().wallet}`} target="_blank" rel="noopener noreferrer">{s().wallet}<ExternalLink size={14}/></a></p></Show>
      <Show when={!s().wallet}><p class="reward-muted">Your reward wallet has not been registered yet.</p></Show>
      <form class="reward-claim-form" onSubmit={review}><h2>Claim rewards</h2><div class="reward-fields">
        <label>Reward asset<select required value={token()} disabled={!usable() || saving()} onChange={e => setToken(e.currentTarget.value)}><Show when={!s().assets.length}><option value="">No available assets</option></Show><For each={s().assets}>{a => <option value={a.token}>{a.symbol}</option>}</For></select></label>
        <label>Amount (USD)<input required inputmode="decimal" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?" value={value()} disabled={!usable() || saving()} onInput={e => setValue(e.currentTarget.value)}/></label>
        <button class="reward-primary" type="submit" disabled={!usable() || saving() || !selected()}>{saving() && !quote() ? 'Checking price...' : 'Review claim'}<ArrowRight size={16}/></button>
      </div><Show when={pending()}><p class="reward-muted"><Clock size={16}/>An earlier claim is awaiting confirmation.</p></Show></form>
      <Show when={saveError() && !quote()}><p role="alert" class="reward-error">{saveError()}</p></Show>
      <section class="reward-history"><h2>Claim history</h2><Show when={s().claims.filter(c => c.status !== 'quoted' && c.status !== 'expired').length} fallback={<p class="reward-muted">No claims yet.</p>}><div class="reward-table-wrap"><table><thead><tr><th>Date</th><th>Asset</th><th>USD</th><th>Status</th><th>Transaction</th></tr></thead><tbody><For each={s().claims.filter(c => c.status !== 'quoted' && c.status !== 'expired')}>{c => <tr><td>{new Date(c.createdAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td><td>{c.symbol}</td><td>${amount(c.amountUsd)}</td><td>{c.status === 'finalized' ? 'Completed' : c.status.replaceAll('_', ' ')}</td><td><Show when={c.transactionHash} fallback={<Show when={['authorizing','prepared'].includes(c.status)}><button disabled={saving()} type="button" onClick={() => { setQuote(c); setSaveError(''); }}>Retry claim</button></Show>}>{hash => <a target="_blank" rel="noopener noreferrer" href={`${s().explorer}/tx/${hash()}`}>View<ExternalLink size={14}/></a>}</Show></td></tr>}</For></tbody></table></div></Show></section>
    </>}</Show>
    <Show when={quote()}>{q => <TutorDialog label="Confirm reward claim" onClose={() => { if (!saving()) { setQuote(null); setSaveError(''); } }} className="reward-confirm-dialog">
      <h2>Confirm reward claim</h2><dl><div><dt>Reward asset</dt><dd>{q().symbol}</dd></div><div><dt>USD to claim</dt><dd>${amount(q().amountUsd)}</dd></div><div><dt>Estimated tokens</dt><dd>{amount(q().expectedAmountOut, selected()?.decimals || 18)}</dd></div><div><dt>Minimum received</dt><dd>{amount(q().minAmountOut, selected()?.decimals || 18)}</dd></div><div><dt>Network fee</dt><dd>Sponsored</dd></div><div><dt>Quote expires</dt><dd>{new Date(q().deadline * 1000).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })} PHT</dd></div></dl>
      <p class="reward-wallet">Receiving wallet <span>{summary()?.wallet}</span></p>
      <Show when={saveError()}><p role="alert" class="reward-error">{saveError()}</p></Show>
      <Show when={expired() && q().status === 'quoted'}><p role="status" class="reward-error">This quote expired. Close it and request a new quote.</p></Show>
      <div class="reward-dialog-actions"><button type="button" disabled={saving()} onClick={() => setQuote(null)}>Cancel</button><button class="reward-primary" type="button" disabled={saving() || (expired() && q().status === 'quoted')} onClick={() => void confirm()}><Gift size={16}/>{saving() ? 'Submitting...' : 'Confirm claim'}</button></div>
    </TutorDialog>}</Show>
  </main></div></>;
}

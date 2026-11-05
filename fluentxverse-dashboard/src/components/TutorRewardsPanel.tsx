import { useEffect, useRef, useState } from 'preact/hooks';
import { apiClient } from '../api/apiClient';
import { operationError } from '../api/operations.api';
import { OpsBadge, OpsEmpty, OpsIcon } from './OperationsWorkspace';
import type { RewardCommand, TutorRewardPreview, TutorRewardSummary } from '../../../shared/tutorRewards';
import { initialRewardSymbols } from '../../../shared/tutorRewards';
import './TutorRewardsPanel.css';

const money = (micros: string | null | undefined) => micros == null ? '-' : '$' + (Number(micros) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const date = (value: string) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '-';
const currentMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7);
const nextMonth = () => { const [y, m] = currentMonth().split('-').map(Number); return `${m === 12 ? y! + 1 : y}-${String(m === 12 ? 1 : m! + 1).padStart(2, '0')}`; };
const short = (address: string) => `${address.slice(0, 8)}...${address.slice(-6)}`;
const pendingStates = ['prepared', 'queued', 'submitted', 'confirming'];
async function request(path = '', method = 'get', body?: unknown) {
  const { data } = await apiClient.request({ url: '/admin/tutor-rewards' + path, method, data: body });
  if (!data.success) throw new Error(data.error || 'Reward request failed.');
  if (!path && (!data.data || typeof data.data.chainId !== 'number' || !Array.isArray(data.data.operations) || !Array.isArray(data.data.blockers))) throw new Error('Rewards response is incomplete.');
  return data.data;
}

type Action = { action: RewardCommand; title: string; params: Record<string, any>; requestId: string };
export default function TutorRewardsPanel({ superadmin, refreshToken = 0 }: { superadmin: boolean; refreshToken?: number }) {
  const [summary, setSummary] = useState<TutorRewardSummary | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [view, setView] = useState('overview'), [reload, setReload] = useState(0);
  const [month, setMonth] = useState(currentMonth()), [preview, setPreview] = useState<TutorRewardPreview | null>(null), [previewError, setPreviewError] = useState(''), [previewLoading, setPreviewLoading] = useState(false);
  const [action, setAction] = useState<Action | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0);
  useEffect(() => {
    let active = true; setError(''); setLoading(true);
    request().then(value => { if (active) setSummary(value); }).catch(e => { if (active) setError(operationError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, refreshToken]);
  useEffect(() => {
    if (!summary || (summary.finalized && !summary.operations.some(o => pendingStates.includes(o.status)))) return;
    const timer = setInterval(() => setReload(n => n + 1), 15000);
    return () => clearInterval(timer);
  }, [summary]);
  useEffect(() => {
    if (view !== 'totals') return;
    const id = ++sequence.current; setPreviewLoading(true); setPreview(null); setPreviewError('');
    request('/preview?month=' + encodeURIComponent(month)).then(value => { if (id === sequence.current) setPreview(value); })
      .catch(e => { if (id === sequence.current) setPreviewError(operationError(e)); }).finally(() => { if (id === sequence.current) setPreviewLoading(false); });
    return () => { sequence.current++; };
  }, [view, month, reload, refreshToken]);
  useEffect(() => {
    if (!action || !dialog.current) return;
    dialog.current.showModal();
    const element = dialog.current;
    return () => { if (element.open) element.close(); };
  }, [action?.requestId]);

  const writable = !loading && !error && !!summary?.deployed && summary.finalized && summary.engineConfigured && BigInt(summary.operatorGasWei) > 0n;
  const open = (kind: RewardCommand, title: string, params: Record<string, any> = {}) => {
    setReason(''); setSaveError(''); setAction({ action: kind, title, params, requestId: crypto.randomUUID() });
  };
  const patch = (values: Record<string, any>) => setAction(a => a && ({ ...a, params: { ...a.params, ...values } }));
  const save = async (event: Event) => {
    event.preventDefault(); if (!action || busy) return;
    setBusy(true); setSaveError('');
    const params = { ...action.params };
    if (params.releaseAt) params.releaseAt = new Date(params.releaseAt + '+08:00').toISOString();
    try {
      await request('/commands', 'post', { action: action.action, requestId: action.requestId, params, reason: reason.trim() });
      setAction(null); setNotice('Operation queued in Engine. Awaiting a verified transaction receipt.'); setReload(n => n + 1);
    } catch (e) { setSaveError(operationError(e)); }
    finally { setBusy(false); }
  };
  const explorer = (kind: 'address' | 'tx', value: string, label?: string) => summary && <a href={`${summary.explorer}/${kind}/${value}`} target="_blank" rel="noopener noreferrer" className="rewards-chain-link">{label || short(value)}<OpsIcon name="external-link" /></a>;
  const eligible = preview?.rows.filter(r => r.completedLessons > 0 || (r.stagedLessons || 0) > 0) || [];
  const nextOffset = Math.floor(Math.max(0, eligible.findIndex(r => r.stagedLessons !== r.completedLessons || r.stagedAmountUsd !== r.amountUsd)) / 128) * 128;
  const mutating = summary?.operations.some(o => pendingStates.includes(o.status));

  return <section className="tutor-rewards" aria-label="Tutor rewards">
    <header className="rewards-heading"><div><h3><OpsIcon name="gift" />Tutor Rewards</h3>{summary && <span className="ops-meta">{summary.network} · USD</span>}</div><div className="rewards-actions">{summary && <OpsBadge value={!summary.deployed ? 'not_deployed' : !summary.finalized ? 'confirming' : summary.claimsPaused ? 'paused' : 'active'} tone={!summary.deployed || !summary.finalized || summary.claimsPaused ? 'warning' : 'success'} />}
      <button type="button" title="Refresh tutor rewards" aria-label="Refresh tutor rewards" disabled={loading} onClick={() => setReload(n => n + 1)}><OpsIcon name="refresh" /></button></div></header>
    {error && <div className="ops-message ops-message-error" role="alert">{error}<button type="button" onClick={() => setReload(n => n + 1)}>Retry</button></div>}
    {notice && <div className="ops-message ops-message-success" role="status">{notice}</div>}
    {loading && !summary && <div className="ops-loading" role="status">Loading tutor rewards...</div>}
    {summary && <>
      <nav className="rewards-tabs" role="tablist" aria-label="Tutor reward views">{[['overview', 'Treasury'], ['totals', 'Monthly totals'], ['assets', 'Reward assets'], ['history', 'Transactions']].map(([key, label]) => <button type="button" key={key} role="tab" id={`reward-tab-${key}`} aria-selected={view === key} aria-controls="reward-content" onClick={() => setView(key!)}>{label}</button>)}</nav>
      <div id="reward-content" role="tabpanel" aria-labelledby={`reward-tab-${view}`}>
        {view === 'overview' && <>
          <dl className="rewards-stats"><div><dt>Treasury</dt><dd>{money(summary.treasuryUsd)}</dd></div><div><dt>Reserved rewards</dt><dd>{money(summary.reservedUsd)}</dd></div><div><dt>Unreserved funds</dt><dd>{money(summary.surplusUsd)}</dd></div><div><dt>Engine gas</dt><dd>{(Number(summary.operatorGasWei) / 1e18).toFixed(6)} <small>ETH</small></dd></div></dl>
          <dl className="rewards-details"><div><dt>{summary.deployed ? 'Contract' : 'Planned contract'}</dt><dd>{explorer('address', summary.contract)}</dd></div><div><dt>Engine wallet</dt><dd>{explorer('address', summary.operator)}</dd></div><div><dt>Settlement token</dt><dd>{explorer('address', summary.settlementToken, summary.settlementSymbol)}</dd></div><div><dt>Allocations</dt><dd><OpsBadge value={summary.allocationsPaused ? 'paused' : 'enabled'} /></dd></div><div><dt>Claims</dt><dd><OpsBadge value={summary.claimsPaused ? 'paused' : 'enabled'} /></dd></div><div><dt>Checked (PHT)</dt><dd>{date(summary.checkedAt)}</dd></div></dl>
          {summary.blockers.length > 0 && <ul className="rewards-status-list">{summary.blockers.map(b => <li key={b}><OpsIcon name="information" />{b}</li>)}</ul>}
          {superadmin && <div className="rewards-command-bar"><button type="button" disabled={!writable || mutating} onClick={() => open('approve_funding', 'Approve Treasury Funding', { amountUsd: '' })}><OpsIcon name="shield-check" />Approve funding</button><button type="button" disabled={!writable || mutating} onClick={() => open('fund', 'Fund Rewards Treasury', { amountUsd: '' })}><OpsIcon name="add-circle" />Fund treasury</button><button type="button" disabled={!writable || mutating} onClick={() => open('set_paused', summary.allocationsPaused ? 'Enable Reward Allocations' : 'Pause Reward Allocations', { claimsPaused: summary.claimsPaused, allocationsPaused: !summary.allocationsPaused })}><OpsIcon name={summary.allocationsPaused ? 'play-circle' : 'pause-circle'} />{summary.allocationsPaused ? 'Enable allocations' : 'Pause allocations'}</button>{!summary.claimsPaused && <button type="button" disabled={!writable || mutating} onClick={() => open('set_paused', 'Pause Reward Claims', { claimsPaused: true, allocationsPaused: summary.allocationsPaused })}><OpsIcon name="pause-circle" />Pause claims</button>}</div>}
        </>}
        {view === 'totals' && <>
          <div className="rewards-toolbar"><label>Reward month<input type="month" value={month} onInput={e => setMonth(e.currentTarget.value)} /></label>{superadmin && <button type="button" disabled={!writable || mutating} onClick={() => open('create_period', 'Create Reward Period', { month: nextMonth(), minimumLessons: 60, rewardPerLessonUsd: '', releaseAt: '' })}><OpsIcon name="calendar-add" />New period</button>}</div>
          {previewError && <div role="alert" className="ops-message ops-message-error">{previewError}</div>}
          {previewLoading ? <div className="ops-loading">Checking finalized lessons...</div> : preview && <>
            <dl className="rewards-stats"><div><dt>Minimum lessons</dt><dd>{preview.period?.exists ? preview.period.minimumLessons : '-'}</dd></div><div><dt>Reward per lesson</dt><dd>{preview.period?.exists ? money(preview.period.rewardPerLessonUsd) : '-'}</dd></div><div><dt>Calculated rewards</dt><dd>{money(preview.totalUsd)}</dd></div><div><dt>Lessons held</dt><dd>{preview.heldLessons}</dd></div></dl>
            {preview.period?.exists && <div className="rewards-period-status"><span>Release: {date(preview.period.releaseAt)} PHT</span><OpsBadge value={preview.period.finalized ? 'finalized' : 'draft'} />{superadmin && !preview.period.finalized && <button type="button" title="Change release date" aria-label="Change release date" disabled={!writable || mutating} onClick={() => open('set_release', 'Change Reward Release Date', { month, releaseAt: '' })}><OpsIcon name="calendar-event" /></button>}</div>}
            {!preview.period?.finalized && preview.blockers.length > 0 && <ul className="rewards-status-list">{preview.blockers.map(b => <li key={b}><OpsIcon name="information" />{b}</li>)}</ul>}
            {preview.rows.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Tutor reward totals"><table className="ops-table"><thead><tr><th>Tutor</th><th>Completed</th><th>Held</th><th>Excluded</th><th>Reward</th><th>Wallet</th><th>Staged</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.tutorId}><td><strong>{row.name}</strong></td><td>{row.completedLessons}</td><td>{row.heldLessons}</td><td>{row.excludedLessons}</td><td>{money(row.amountUsd)}</td><td>{row.wallet ? explorer('address', row.wallet) : <span className="ops-meta">Unavailable</span>}{superadmin && row.wallet && !row.registered && row.completedLessons > 0 && <button type="button" className="rewards-register" disabled={!writable || mutating || summary.allocationsPaused} onClick={() => open('register_tutor', 'Register Tutor Reward Wallet', { tutorId: row.tutorId })}>Register wallet</button>}</td><td>{row.stagedLessons === null ? '-' : row.stagedLessons}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No booked lessons in this month." icon="calendar-check" />}
            {superadmin && <div className="rewards-command-bar"><button type="button" disabled={!writable || mutating || !preview.canStage || !eligible.length} onClick={() => open('stage_counts', 'Stage Finalized Lesson Totals', { month, snapshotDigest: preview.snapshotDigest, offset: nextOffset })}><OpsIcon name="upload-2" />{eligible.length > 128 ? 'Stage next 128 tutors' : 'Stage lesson totals'}</button><button type="button" disabled={!writable || mutating || !preview.canFinalize} onClick={() => open('finalize_period', 'Finalize Monthly Rewards', { month, snapshotDigest: preview.snapshotDigest })}><OpsIcon name="lock" />Finalize rewards</button><button type="button" disabled={!writable || mutating || !preview.period?.finalized || Date.parse(preview.period.releaseAt) > Date.now() || !eligible.length} onClick={() => open('unlock_rewards', 'Unlock Released Rewards', { month, snapshotDigest: preview.snapshotDigest, offset: 0 })}><OpsIcon name="lock-unlock" />Unlock released rewards</button></div>}
          </>}
        </>}
        {view === 'assets' && <>
          <div className="rewards-toolbar"><span className="ops-meta">{summary.assets.filter(a => a.enabled).length} enabled assets</span>{superadmin && <button type="button" disabled={!writable || mutating} onClick={() => open('configure_asset', 'Configure Reward Asset', { token: '', adapter: '', priceFeed: '', maxPriceAgeSeconds: 3600, maxSlippageBps: 100 })}><OpsIcon name="add" />Add asset</button>}</div>
          {summary.assets.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Reward assets"><table className="ops-table"><thead><tr><th>Asset</th><th>Status</th><th>Adapter</th><th>Price feed</th><th>Slippage</th><th>Actions</th></tr></thead><tbody>{summary.assets.map(asset => <tr key={asset.token}><td>{explorer('address', asset.token, asset.symbol)}</td><td><OpsBadge value={asset.enabled ? 'enabled' : 'disabled'} /></td><td>{explorer('address', asset.adapter)}</td><td>{explorer('address', asset.priceFeed)}</td><td>{asset.maxSlippageBps / 100}%</td><td>{superadmin && <div className="rewards-actions"><button type="button" title={`Configure ${asset.symbol}`} aria-label={`Configure ${asset.symbol}`} disabled={!writable || mutating} onClick={() => open('configure_asset', 'Configure Reward Asset', { ...asset })}><OpsIcon name="settings-3" /></button>{asset.enabled && <button type="button" title={`Disable ${asset.symbol}`} aria-label={`Disable ${asset.symbol}`} disabled={!writable || mutating} onClick={() => open('disable_asset', 'Disable Reward Asset', { token: asset.token })}><OpsIcon name="forbid" /></button>}</div>}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No reward assets configured." icon="stock" />}
          {!summary.assets.length && <p className="rewards-proposed"><span className="ops-meta">Planned selection</span><span>{initialRewardSymbols.join(' · ')}</span></p>}
        </>}
        {view === 'history' && (summary.operations.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Reward transactions"><table className="ops-table"><thead><tr><th>Created (PHT)</th><th>Operation</th><th>Status</th><th>Transaction</th><th>Audit reason</th></tr></thead><tbody>{summary.operations.map(o => <tr key={o.id}><td>{date(o.createdAt)}</td><td>{o.action.replaceAll('_', ' ')}</td><td><OpsBadge value={o.status} tone={o.status === 'finalized' ? 'success' : o.status === 'review_required' ? 'danger' : 'warning'} /></td><td>{o.transactionHash ? explorer('tx', o.transactionHash) : <span className="ops-meta">Awaiting Engine</span>}</td><td>{o.reason}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No reward transactions yet." icon="history" />)}
      </div>
    </>}
    {action && <dialog ref={dialog} className="rewards-dialog" aria-labelledby="reward-dialog-title" onCancel={e => { if (busy) e.preventDefault(); else setAction(null); }}>
      <form onSubmit={save}><header><h3 id="reward-dialog-title">{action.title}</h3><button type="button" title="Close reward action" aria-label="Close reward action" disabled={busy} onClick={() => setAction(null)}><OpsIcon name="close" /></button></header>
        {['create_period', 'set_release'].includes(action.action) && <><label>Reward month<input type="month" required disabled={busy || action.action === 'set_release'} value={action.params.month} onInput={e => patch({ month: e.currentTarget.value })} /></label>{action.action === 'create_period' && <div className="rewards-form-grid"><label>Minimum completed lessons<input type="number" min="1" max="4294967295" step="1" required disabled={busy} value={action.params.minimumLessons} onInput={e => patch({ minimumLessons: Number(e.currentTarget.value) })} /></label><label>USD per completed lesson<input type="text" inputMode="decimal" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?" required disabled={busy} value={action.params.rewardPerLessonUsd} placeholder="0.20" onInput={e => patch({ rewardPerLessonUsd: e.currentTarget.value })} /></label></div>}<label>Release date and time (PHT)<input type="datetime-local" required disabled={busy} value={action.params.releaseAt} onInput={e => patch({ releaseAt: e.currentTarget.value })} /></label></>}
        {['fund', 'approve_funding'].includes(action.action) && <label>Funding amount (USD)<input type="text" inputMode="decimal" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?" required disabled={busy} value={action.params.amountUsd} onInput={e => patch({ amountUsd: e.currentTarget.value })} /></label>}
        {action.action === 'configure_asset' && <>{[['token', 'Reward token address'], ['adapter', 'Approved trading adapter'], ['priceFeed', 'USD price feed']].map(([key, label]) => <label key={key}>{label}<input required pattern="0x[0-9a-fA-F]{40}" disabled={busy} value={action.params[key!]} onInput={e => patch({ [key!]: e.currentTarget.value })} /></label>)}<div className="rewards-form-grid"><label>Maximum slippage (basis points)<input type="number" min="0" max="1000" step="1" required disabled={busy} value={action.params.maxSlippageBps} onInput={e => patch({ maxSlippageBps: Number(e.currentTarget.value) })} /></label><label>Maximum price age (seconds)<input type="number" min="1" max="4294967295" step="1" required disabled={busy} value={action.params.maxPriceAgeSeconds} onInput={e => patch({ maxPriceAgeSeconds: Number(e.currentTarget.value) })} /></label></div></>}
        {['stage_counts', 'finalize_period', 'unlock_rewards'].includes(action.action) && <dl className="rewards-confirmation"><div><dt>Reward month</dt><dd>{action.params.month}</dd></div><div><dt>Calculated total</dt><dd>{money(preview?.totalUsd)}</dd></div></dl>}
        {action.action === 'unlock_rewards' && eligible.length > 128 && <label>Tutor batch<select disabled={busy} value={action.params.offset} onChange={e => patch({ offset: Number(e.currentTarget.value) })}>{Array.from({ length: Math.ceil(eligible.length / 128) }, (_, i) => <option key={i} value={i * 128}>Tutors {i * 128 + 1}–{Math.min((i + 1) * 128, eligible.length)}</option>)}</select></label>}
        {action.action === 'set_paused' && <dl className="rewards-confirmation"><div><dt>Allocations</dt><dd>{action.params.allocationsPaused ? 'Paused' : 'Enabled'}</dd></div><div><dt>Claims</dt><dd>{action.params.claimsPaused ? 'Paused' : 'Enabled'}</dd></div></dl>}
        <label>Audit reason<textarea required maxLength={1000} disabled={busy} value={reason} onInput={e => setReason(e.currentTarget.value)} /></label>
        {saveError && <div className="ops-message ops-message-error" role="alert">{saveError}</div>}
        <footer><button type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button type="submit" className="rewards-primary" disabled={busy || !reason.trim()}><OpsIcon name={busy ? 'loader-4' : 'send-plane'} />{busy ? 'Submitting...' : 'Submit to Engine'}</button></footer>
      </form>
    </dialog>}
  </section>;
}

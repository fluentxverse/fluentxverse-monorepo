import { createSignal, createEffect, on, onCleanup, Show, For } from 'solid-js';
import { LockKeyhole, UnlockKeyhole, Download, Upload, RefreshCw, Plus, ShieldCheck, RotateCcw } from 'lucide-solid';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { lessonPassApi } from '../api/lessonPasses.api';
import { PASS_CATALOG, type PassAccount, type PassItem, type PassMode } from '../shared/lessonPasses';
import { decryptPassVault, encryptPassVault, emptyPassVault, newPassNote, newPassReference, type PassVault } from '../utils/lessonPassVault';
import { generatePassProof } from '../utils/lessonPassProof';
import './PrivatePassWallet.css';

const statuses: Record<string, string> = { payment_pending: 'Payment awaiting confirmation', approved: 'Issuance pending', available: 'Available',
  prepared: 'Ownership proof needed', proof_ready: 'Verification queued', submitting_zkverify: 'Verification processing', awaiting_horizen: 'Horizen finality pending',
  certifying: 'Reservation finality pending', ready: 'Ready to book', booked: 'Assigned to lesson', return_requested: 'Return queued', finalizing: 'Settlement pending',
  authorizing: 'Preparing pass', registering: 'Issuance processing' };
export default function PrivatePassWallet(props: { mode: PassMode }) {
  const auth = useAuthContext();
  const [account, setAccount] = createSignal<PassAccount>();
  const [vault, setVault] = createSignal<PassVault>();
  const [password, setPassword] = createSignal('');
  const [confirmation, setConfirmation] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notice, setNotice] = createSignal('');
  const [unlockedVersion, setUnlockedVersion] = createSignal<number>();
  let owner = '', controller: AbortController | undefined;
  const locked = () => { controller?.abort(); setVault(undefined); setUnlockedVersion(undefined); setPassword(''); setConfirmation(''); };
  onCleanup(locked);
  const refresh = async () => {
    const user = await auth.ensureSession(), id = user.userId;
    const data = await lessonPassApi.mine();
    if (auth.user?.userId !== id) throw new Error('Student account changed. Reload the pass wallet.');
    if (vault() && data.vault?.version !== unlockedVersion()) {
      locked(); setNotice('Recovery vault changed on another device. Unlock its latest version.');
    }
    setAccount(data); return data;
  };
  const run = async (action: () => Promise<void>) => {
    if (busy()) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Pass operation unavailable'); }
    finally { setBusy(false); }
  };
  createEffect(on(() => auth.user?.userId, id => {
    if (id !== owner) {
      locked(); setAccount(undefined); setError(''); setNotice(''); owner = id || '';
      if (id) void refresh().catch(e => { if (owner === id) setError((e as Error).message); });
    }
  }));
  const persist = async (next: PassVault) => {
    const id = owner, version = account()?.vault?.version || 0;
    if (!id || auth.user?.userId !== id) throw new Error('Student account changed. Reload.');
    if (vault() && unlockedVersion() !== version) throw new Error('Recovery vault changed. Lock and unlock before saving.');
    const envelope = await encryptPassVault(next, password(), id);
    if (auth.user?.userId !== id) throw new Error('Student account changed. Reload.');
    const saved = await lessonPassApi.save(version, envelope, id);
    if (auth.user?.userId !== id) throw new Error('Student account changed. Reload.');
    setVault(next); setUnlockedVersion(saved.version); setAccount(old => ({ ...old!, vault: saved }));
  };
  const unlock = () => run(async () => {
    const data = await refresh();
    if (data.vault) {
      const id = owner, decrypted = await decryptPassVault(data.vault.envelope, password(), id);
      if (owner !== id || auth.user?.userId !== id) throw new Error('Student account changed. Reload.');
      setVault(decrypted); setUnlockedVersion(data.vault.version);
    }
    else {
      if (password() !== confirmation()) throw new Error('Recovery passphrases do not match');
      await persist(emptyPassVault());
      setNotice('Recovery vault created. Keep the passphrase; it cannot be reset.');
    }
    setConfirmation('');
  });
  const order = (sku: typeof PASS_CATALOG[number]) => run(async () => {
    const data = await refresh(); if (!vault()) throw new Error('Unlock the recovery vault first');
    let pending = vault()!.orders.find(o => o.sku === sku.id && !data.orders.some(n => n.id === o.id));
    if (!pending) {
      const notes = Array.from({ length: sku.quantity }, newPassNote);
      pending = { id: newPassReference(), sku: sku.id, commitments: notes.map(n => n.commitment) };
      await persist({ ...vault()!, notes: [...vault()!.notes, ...notes], orders: [...vault()!.orders, pending] });
    }
    await lessonPassApi.order(pending.id, pending.sku, pending.commitments, owner); await refresh();
    setNotice('Order saved. Payment confirmation is pending.');
  });
  const prepare = (pass: PassItem) => run(async () => {
    await refresh(); if (!vault() || !pass.batchId) throw new Error('Unlock the recovery vault first');
    const note = vault()!.notes.find(n => n.commitment === pass.commitment);
    if (!note) throw new Error('This pass key is missing. Restore its encrypted backup.');
    let intent = vault()!.intents.find(n => n.passId === pass.id && !account()!.reservations.some(r => r.id === n.id));
    if (!intent) {
      const refund = newPassNote(); intent = { id: newPassReference(), passId: pass.id, refundCommitment: refund.commitment };
      await persist({ ...vault()!, notes: [...vault()!.notes, refund], intents: [...vault()!.intents, intent] });
    }
    const authorization = await lessonPassApi.prepare(intent.id, pass.id, intent.refundCommitment);
    const batch = await lessonPassApi.batch(pass.batchId);
    controller = new AbortController();
    const proof = await generatePassProof(note.privateKey, authorization, batch, props.mode, controller.signal);
    await lessonPassApi.proof(intent.id, proof); await refresh(); setNotice('Ownership proof submitted. Verification is pending.');
  });
  const resume = (id: string) => run(async () => {
    await refresh(); const reservation = account()!.reservations.find(r => r.id === id);
    const pass = account()!.passes.find(p => p.id === reservation?.passId);
    const note = vault()?.notes.find(n => n.commitment === pass?.commitment);
    if (!reservation || !pass?.batchId || !note) throw new Error('Unlock or restore this pass key first');
    controller = new AbortController();
    const proof = await generatePassProof(note.privateKey, reservation, await lessonPassApi.batch(pass.batchId), props.mode, controller.signal);
    await lessonPassApi.proof(id, proof); await refresh(); setNotice('Ownership proof submitted. Verification is pending.');
  });
  const download = () => {
    const envelope = account()?.vault?.envelope; if (!envelope) return;
    const url = URL.createObjectURL(new Blob([envelope], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fluentxverse-pass-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = (file?: File) => run(async () => {
    const targetOwner = owner;
    if (!file || file.size > 262144) throw new Error('Choose an encrypted pass backup under 256 KB');
    const imported = await decryptPassVault(await file.text(), password(), owner);
    const data = await refresh();
    const current = data.vault ? await decryptPassVault(data.vault.envelope, password(), owner) : emptyPassVault();
    if (owner !== targetOwner || auth.user?.userId !== targetOwner) throw new Error('Student account changed. Reload.');
    const merge = <T,>(left: T[], right: T[], key: (n: T) => string) => {
      const map = new Map(left.map(n => [key(n), n]));
      for (const n of right) { const old = map.get(key(n)); if (old && JSON.stringify(old) !== JSON.stringify(n)) throw new Error('Backup conflicts with the current vault'); map.set(key(n), n); }
      return [...map.values()];
    };
    await persist({ protocol: current.protocol, notes: merge(current.notes, imported.notes, n => n.commitment),
      orders: merge(current.orders, imported.orders, n => n.id), intents: merge(current.intents, imported.intents, n => n.id) });
    setNotice('Encrypted backup restored.');
  });
  return <><SideBar/><div class="student-tickets"><Header/><main class="lesson-pass-wallet" aria-busy={busy()}>
    <header class="pass-heading"><h1>Lesson passes</h1><button title="Refresh pass status" aria-label="Refresh pass status" disabled={busy()} onClick={() => run(async () => { await refresh(); })}><RefreshCw size={18}/></button></header>
    <Show when={error()}><p class="pass-error" role="alert">{error()}</p></Show>
    <Show when={notice()}><p class="pass-notice" role="status">{notice()}</p></Show>
    <Show when={account()} fallback={<p role="status">{auth.isAuthenticated ? 'Loading passes...' : 'Sign in to access lesson passes.'}</p>}>
      <section class="pass-balances" aria-label="Pass balances">
        <div><span>Ready to book</span><strong>{account()!.reservations.filter(n => n.status === 'ready').length}</strong></div>
        <div><span>Available</span><strong>{account()!.passes.filter(n => n.status === 'available').length}</strong></div>
        <div><span>Assigned to lessons</span><strong>{account()!.reservations.filter(n => n.status === 'booked').length}</strong></div>
      </section>
      <section class="pass-recovery"><div class="pass-section-heading"><h2>Recovery vault</h2><div class="pass-tools">
        <button title="Download encrypted backup" aria-label="Download encrypted backup" onClick={download} disabled={busy() || !account()?.vault}><Download size={18}/></button>
        <Show when={vault()}><button title="Lock recovery vault" aria-label="Lock recovery vault" onClick={locked} disabled={busy()}><LockKeyhole size={18}/></button></Show>
      </div></div>
        <Show when={!vault()} fallback={<p role="status"><ShieldCheck size={16}/> Vault unlocked</p>}>
          <form class="pass-unlock" onSubmit={e => { e.preventDefault(); void unlock(); }}>
            <label>Recovery passphrase<input type="password" autocomplete={account()?.vault ? 'current-password' : 'new-password'} minlength={12} value={password()} onInput={e => setPassword(e.currentTarget.value)} required disabled={busy()}/></label>
            <Show when={!account()?.vault}><label>Confirm passphrase<input type="password" autocomplete="new-password" minlength={12} value={confirmation()} onInput={e => setConfirmation(e.currentTarget.value)} required disabled={busy()}/></label></Show>
            <button class="pass-primary" disabled={busy()}><UnlockKeyhole size={16}/>{account()?.vault ? 'Unlock vault' : 'Create vault'}</button>
          </form>
          <label class="pass-import"><Upload size={16}/> Restore encrypted backup<input aria-label="Restore encrypted backup" type="file" accept="application/json,.json" disabled={busy() || password().length < 12} onChange={e => { const file = e.currentTarget.files?.[0]; void restore(file); e.currentTarget.value = ''; }}/></label>
        </Show>
      </section>
      <section><h2>Orders</h2><div class="pass-packages"><For each={PASS_CATALOG}>{sku => <article class="pass-package">
        <img src="/assets/img/home-icons/basic-ticket-v2.png" alt="" width="80" height="48"/><div><h3>{sku.quantity === 1 ? 'Single lesson' : '30 lessons'}</h3><span>${(sku.cents / 100).toFixed(2)}</span></div>
        <button disabled={busy() || !vault()} onClick={() => order(sku)}><Plus size={16}/>Request order</button>
      </article>}</For></div>
        <For each={account()!.orders}>{n => <div class="pass-row"><div><strong>{n.quantity} lesson{n.quantity === 1 ? '' : 's'}</strong><small>Order {n.id.slice(2, 10)}</small></div><span>{n.status === 'approved' ? 'Payment confirmed' : statuses[n.status] || n.status}</span><span>${(n.cents / 100).toFixed(2)}</span></div>}</For>
      </section>
      <section><h2>Passes</h2><Show when={account()!.passes.length || account()!.reservations.length} fallback={<p class="pass-empty">No lesson passes yet.</p>}>
        <For each={account()!.passes.filter(p => ['available','approved'].includes(p.status))}>{p => <div class="pass-row"><div><strong>{p.origin === 'refund' ? 'Replacement pass' : 'Lesson pass'}</strong><small>{p.commitment.slice(0, 10)}</small></div><span>{statuses[p.status] || p.status}</span>
          <Show when={p.status === 'available'}><button disabled={busy() || !vault()} onClick={() => prepare(p)}><ShieldCheck size={16}/>Prepare</button></Show>
        </div>}</For>
        <For each={account()!.reservations}>{r => <div class="pass-row"><div><strong>Lesson pass</strong><small>{r.id.slice(2,10)}</small></div><span>{statuses[r.status] || r.status}</span>
          <Show when={r.status === 'prepared'}><button disabled={busy() || !vault()} onClick={() => resume(r.id)}><ShieldCheck size={16}/>Prove ownership</button></Show>
          <Show when={r.status === 'ready'}><div class="pass-tools"><a class="pass-primary" href="/browse-tutors">Book lesson</a><button title="Return unused pass" aria-label="Return unused pass" disabled={busy()} onClick={() => run(async () => { await lessonPassApi.return(r.id); await refresh(); })}><RotateCcw size={16}/></button></div></Show>
          <Show when={['prepared','proof_ready','submitting_zkverify','awaiting_horizen','certifying'].includes(r.status) && Date.now() / 1000 > r.deadline}><button disabled={busy()} onClick={() => run(async () => { await lessonPassApi.recover(r.id); await refresh(); })}><RotateCcw size={16}/>Recover</button></Show>
        </div>}</For>
      </Show></section>
    </Show>
  </main></div></>;
}

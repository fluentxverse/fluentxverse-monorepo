import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { Check, Download, RefreshCw, ShieldCheck, Star, Upload } from 'lucide-solid';
import { useAuthContext } from '../context/AuthContext';
import { anonymousReviewsApi, type ReviewAcknowledgment } from '../api/anonymousReviews.api';
import { backupReviewIdentity, loadReviewIdentity, restoreReviewIdentity } from '../utils/anonymousReviewIdentity';
import { REVIEW_TOPICS, type AnonymousReviewContent, type AnonymousReviewEnrollment, type AnonymousReviewGroup, type AnonymousReviewProof } from '../shared/anonymousReviews';
import './AnonymousLessonReview.css';

const labels = ['Very dissatisfied', 'Dissatisfied', 'Okay', 'Satisfied', 'Very satisfied'];
export default function AnonymousLessonReview(props: { enrollment: AnonymousReviewEnrollment; bookingId?: string; onBusyChange?: (value: boolean) => void }) {
  const auth = useAuthContext();
  const [enrollment, setEnrollment] = createSignal(props.enrollment);
  const [group, setGroup] = createSignal<AnonymousReviewGroup | null>(null);
  const [rating, setRating] = createSignal(0), [positive, setPositive] = createSignal<string[]>([]), [improvement, setImprovement] = createSignal<string[]>([]);
  const [busy, setBusy] = createSignal(false), [phase, setPhase] = createSignal(''), [error, setError] = createSignal('');
  const [ack, setAck] = createSignal<ReviewAcknowledgment | null>(null);
  const [locked, setLocked] = createSignal(false);
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  createEffect(() => props.onBusyChange?.(busy()));
  const account = () => auth.user?.userId || '';
  const cacheKey = () => `fxv:review-result:${account()}:${enrollment().groupId}`;
  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const refresh = async () => {
    setError('');
    const user = account(), groupId = enrollment().groupId;
    try {
      const saved = localStorage.getItem(cacheKey());
      if (saved) setAck(JSON.parse(saved));
      const pending = localStorage.getItem(`${cacheKey()}:pending`);
      if (pending) {
        const { content } = JSON.parse(pending); setRating(content.rating); setPositive(content.positive); setImprovement(content.improvement); setLocked(true);
      }
      const result = await anonymousReviewsApi.group(groupId, controller.signal);
      if (account() === user && enrollment().groupId === groupId && !controller.signal.aborted) setGroup(result);
    } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
  };
  createEffect(() => { if (enrollment().enrolled) void refresh(); });
  const run = async (action: () => Promise<void>) => {
    if (busy()) return; setBusy(true); setError('');
    try { await action(); } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { if (!controller.signal.aborted) { setBusy(false); setPhase(''); } }
  };
  const enroll = () => run(async () => {
    if (!props.bookingId || !account()) throw new Error('Student authentication required');
    const user = account(), groupId = enrollment().groupId;
    const identity = loadReviewIdentity(user, groupId, enrollment().commitment);
    const result = await anonymousReviewsApi.enroll(props.bookingId, identity.commitment.toString());
    if (account() !== user || enrollment().groupId !== groupId) throw new Error('Student session changed. Reload feedback to continue.');
    setEnrollment(result);
  });
  const toggle = (kind: 'positive' | 'improvement', id: string, checked: boolean) => {
    const update = (items: string[]) => checked ? [...items.filter(item => item !== id), id] : items.filter(item => item !== id);
    if (kind === 'positive') { setPositive(update); if (checked) setImprovement(items => items.filter(item => item !== id)); }
    else { setImprovement(update); if (checked) setPositive(items => items.filter(item => item !== id)); }
  };
  const submit = (event: Event) => {
    event.preventDefault();
    void run(async () => {
      if (!rating() || !group() || !enrollment().commitment) throw new Error('Choose an overall rating');
      const user = account(), groupId = enrollment().groupId, resultKey = cacheKey();
      const checkSession = () => {
        if (account() !== user || enrollment().groupId !== groupId) throw new Error('Student session changed. Reload feedback to continue.');
      };
      const pendingKey = `${resultKey}:pending`;
      let pending: { content: AnonymousReviewContent; proof: AnonymousReviewProof };
      const saved = localStorage.getItem(pendingKey);
      if (saved) pending = JSON.parse(saved);
      else {
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        const content = { rating: rating(), positive: positive(), improvement: improvement(), salt };
        setPhase('Preparing proof...');
        const { generateAnonymousReview } = await import('../utils/anonymousReviewProof');
        const proof = await generateAnonymousReview(user, enrollment().commitment!, group()!, content, controller.signal);
        checkSession();
        pending = { content, proof }; localStorage.setItem(pendingKey, JSON.stringify(pending)); setLocked(true);
      }
      setPhase('Submitting...');
      checkSession();
      const result = await anonymousReviewsApi.submit(groupId, pending.content, pending.proof, controller.signal);
      checkSession();
      localStorage.setItem(resultKey, JSON.stringify(result)); localStorage.removeItem(pendingKey); setAck(result);
    });
  };
  let input!: HTMLInputElement;
  const restore = (event: Event) => run(async () => {
    const user = account(), groupId = enrollment().groupId, commitment = enrollment().commitment;
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file || file.size > 4096 || !commitment) throw new Error('Choose a valid review key backup');
    const json = await file.text();
    if (account() !== user || enrollment().groupId !== groupId) throw new Error('Student session changed. Reload feedback to continue.');
    restoreReviewIdentity(user, groupId, commitment, json);
    input.value = '';
  });
  return <section class="anonymous-lesson-review" aria-label="Anonymous tutor feedback">
    <header><ShieldCheck size={20}/><div><h3>Anonymous tutor feedback</h3><span>{enrollment().period}</span></div></header>
    <Show when={error()}><p role="alert" class="anonymous-review-error">{error()}</p></Show>
    <Show when={!enrollment().enrolled} fallback={<>
      <div class="anonymous-review-tools">
        <button type="button" title="Download private review key backup" aria-label="Download private review key backup" disabled={busy()} onClick={() => void run(async () => backupReviewIdentity(account(), enrollment().groupId, enrollment().commitment))}><Download size={17}/></button>
        <button type="button" title="Restore private review key" aria-label="Restore private review key" disabled={busy()} onClick={() => input.click()}><Upload size={17}/></button>
        <button type="button" title="Refresh review status" aria-label="Refresh review status" disabled={busy()} onClick={() => void run(async () => {
          const user = account(), groupId = enrollment().groupId, resultKey = cacheKey();
          await refresh();
          if (account() !== user || enrollment().groupId !== groupId) throw new Error('Student session changed. Reload feedback to continue.');
          if (ack()) {
            const result = await anonymousReviewsApi.status(ack()!.id);
            if (account() !== user || enrollment().groupId !== groupId) throw new Error('Student session changed. Reload feedback to continue.');
            localStorage.setItem(resultKey, JSON.stringify(result)); setAck(result);
          }
        })}><RefreshCw size={17}/></button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={restore}/>
        <a href="/reviews">My feedback</a>
      </div>
      <Show when={ack()} fallback={<Show when={group()?.state === 'open'} fallback={<p role="status" class="anonymous-review-status">
        {group()?.state === 'closed' ? 'Feedback window closed.' : group()?.state === 'insufficient_members' ? 'Not enough students enrolled for private feedback.'
          : group()?.state === 'awaiting_activation' ? 'Waiting for review group activation.' : `Feedback opens ${date(enrollment().opensAt)}.`}
      </p>}>
        <form onSubmit={submit}>
          <fieldset disabled={busy() || locked()}><legend>How were your lessons with this tutor?</legend>
            <div class="anonymous-review-stars">{labels.map((label, index) => <label title={`${index + 1} / 5 - ${label}`}>
              <input type="radio" name={`anonymous-rating-${enrollment().groupId}`} checked={rating() === index + 1} onChange={() => setRating(index + 1)} aria-label={`${index + 1} star${index ? 's' : ''} - ${label}`}/>
              <Star size={26} fill={rating() > index ? 'currentColor' : 'none'}/>
            </label>)}</div><p>{rating() ? labels[rating() - 1] : 'Overall rating'}</p>
          </fieldset>
          <div class="anonymous-review-topics">{(['positive', 'improvement'] as const).map(kind => <fieldset disabled={busy() || locked()}>
            <legend>{kind === 'positive' ? 'What went well?' : 'What could be better?'}</legend>
            {REVIEW_TOPICS.filter(topic => kind === 'improvement' || topic.positive).map(topic => <label>
              <input type="checkbox" checked={(kind === 'positive' ? positive() : improvement()).includes(topic.id)} onChange={event => toggle(kind, topic.id, event.currentTarget.checked)}/><span>{topic.label}</span>
            </label>)}
          </fieldset>)}</div>
          <p class="anonymous-review-notice">One review per tutor each month. Published only in a batch of at least five reviews. Small groups or outside information can still reveal who gave feedback.</p>
          <footer><span>Closes {date(enrollment().closesAt)}</span><button type="submit" disabled={busy() || !rating()}><Check size={17}/>{busy() ? phase() || 'Working...' : 'Submit feedback'}</button></footer>
        </form>
      </Show>}>
        <p role="status" class="anonymous-review-status"><Check size={17}/>{ack()?.verified ? 'Feedback verified' : 'Feedback received; verification pending'}</p>
      </Show>
    </>}>
      <p class="anonymous-review-notice">FluentXVerse records your eligibility, but feedback is submitted separately without your account or booking ID. Network metadata and small groups can still identify you.</p>
      <Show when={enrollment().canEnroll && props.bookingId} fallback={<p role="status">Enrollment is not available for this lesson.</p>}>
        <button type="button" class="anonymous-review-primary" disabled={busy()} onClick={enroll}><ShieldCheck size={17}/>{busy() ? 'Enrolling...' : 'Enroll for monthly feedback'}</button>
      </Show>
    </Show>
  </section>;
}

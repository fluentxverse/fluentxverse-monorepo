import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { RefreshCw, Send } from 'lucide-solid';
import { client } from '../api/utils';
import { issueThreadStatus, type LessonIssueThread } from '../../../shared/lessonIssueThread';
import '../../../shared/ui/lesson-issue-threads.css';
const imageUrl = (threadId: string, id: string) => (client.defaults.baseURL || '').replace(/\/$/,'') + '/inbox/lesson-issues/' + encodeURIComponent(threadId) + '/images/' + id;

export default function LessonIssueThreads() {
  const [threads, setThreads] = createStore<LessonIssueThread[]>([]);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  let disposed = false;
  const load = async () => {
    if (loading()) return;
    setLoading(true);
    try { const r = await client.get('/inbox/lesson-issues/'); if (!disposed) { setThreads(reconcile(r.data.data)); setError(''); } }
    catch { if (!disposed) setError('Could not load lesson conversations. Please retry.'); }
    finally { if (!disposed) setLoading(false); }
  };
  onMount(() => { void load(); const timer = setInterval(() => void load(), 60000); onCleanup(() => { disposed = true; clearInterval(timer); }); });
  const date = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) + ' PHT';
  return <Show when={threads.length || error()}><section class="lesson-issue-threads" aria-label="Lesson issue conversations">
    <header><h2>Lesson issue conversations</h2><button type="button" disabled={loading() || busy()} onClick={load} title="Refresh conversations"><RefreshCw size={16}/>Refresh</button></header>
    {error() && <p role="alert">{error()}</p>}
    <For each={threads}>{thread => <details><summary>{date(thread.startsAt)}: {issueThreadStatus[thread.state] || thread.state}</summary>
      <p>Lesson reference: {thread.bookingId}</p>
      <a href={'/lesson/' + encodeURIComponent(thread.bookingId)}>Open lesson</a>
      {thread.decisionReason && <p class="issue-thread-body"><strong>Staff decision: {issueThreadStatus[thread.state]}</strong><br/>{thread.decisionReason}</p>}
      {thread.decisionReason && <h3>Original request</h3>}
      <p class={'issue-thread-body' + (thread.state === 'awaiting_tutor' ? ' issue-thread-warning' : '')}>{thread.body}</p>
      <For each={thread.replies}>{reply => <div class="issue-thread-reply"><strong>{reply.role === 'admin' ? 'FluentXVerse staff' : 'You'}</strong> <time>{date(reply.createdAt)}</time><p class="issue-thread-body">{reply.body}</p>
        <div class="issue-thread-images"><For each={reply.attachments}>{a => <a href={imageUrl(thread.id,a.id)} target="_blank" rel="noopener noreferrer"><img src={imageUrl(thread.id,a.id)} loading="lazy" alt="Lesson issue attachment"/></a>}</For></div></div>}</For>
      <form onSubmit={async event => {
        event.preventDefault(); if (busy()) return;
        const form = event.currentTarget, formData = new FormData(form), text = String(formData.get('text') || '').trim();
        if (text.length < 10) { setError('Please provide at least 10 characters.'); return; }
        setBusy(true);
        try {
          const images = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
          if (images.length > 3 || images.some(f => f.size > 5 * 1024 * 1024)) throw Error('Choose up to 3 images, at most 5 MB each.');
          if (images.length) { const data = new FormData(); data.set('text',text); images.forEach(f => data.append('images',f)); await client.post('/inbox/lesson-issues/' + encodeURIComponent(thread.id) + '/replies-with-images', data, { headers: { 'Content-Type': undefined } }); }
          else await client.post('/inbox/lesson-issues/' + encodeURIComponent(thread.id) + '/replies', { text });
          form.reset(); await load();
        }
        catch (e: any) { setError(e.response?.data?.error || e.message || 'Could not send your explanation. Please retry.'); }
        finally { setBusy(false); }
      }}><label>Your reply<textarea name="text" required minLength={10} maxLength={2000} disabled={busy()}/></label>
        <label>Images (up to 3, 5 MB each)<input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" disabled={busy()}/></label>
        <p>Remove student names and personal information from screenshots before attaching them.</p>
        <button type="submit" disabled={busy()}><Send size={16}/>Send reply</button></form>
    </details>}</For>
  </section></Show>;
}

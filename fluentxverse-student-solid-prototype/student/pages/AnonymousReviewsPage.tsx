import { createSignal, onMount, Show, For } from 'solid-js';
import { RefreshCw } from 'lucide-solid';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import AnonymousLessonReview from '../Components/AnonymousLessonReview';
import { anonymousReviewsApi } from '../api/anonymousReviews.api';
import type { AnonymousReviewEnrollment } from '../shared/anonymousReviews';

export default function AnonymousReviewsPage() {
  const [items, setItems] = createSignal<AnonymousReviewEnrollment[]>([]), [loading, setLoading] = createSignal(true), [error, setError] = createSignal('');
  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await anonymousReviewsApi.mine()); } catch (error) { setError((error as Error).message); } finally { setLoading(false); }
  };
  onMount(() => void load());
  return <div class="anonymous-reviews-layout"><SideBar/><Header/><main class="anonymous-reviews-page">
    <header><h1>My feedback</h1><button type="button" title="Refresh review groups" aria-label="Refresh review groups" disabled={loading()} onClick={() => void load()}><RefreshCw size={19}/></button></header>
    <Show when={error()}><p role="alert">{error()}</p></Show>
    <Show when={!loading()} fallback={<p role="status">Loading feedback...</p>}>
      <Show when={items().length} fallback={!error() && <p>No enrolled review groups yet. <a href="/schedule">View lessons</a></p>}>
        <For each={items()}>{item => <article class="anonymous-review-item"><a href={`/tutor/${encodeURIComponent(item.tutorId)}`}>Tutor profile</a><AnonymousLessonReview enrollment={item}/></article>}</For>
      </Show>
    </Show>
  </main></div>;
}

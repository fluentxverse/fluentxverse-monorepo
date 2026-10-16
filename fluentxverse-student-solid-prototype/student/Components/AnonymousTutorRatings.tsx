import { createEffect, createSignal, onCleanup, Show, For } from 'solid-js';
import { ShieldCheck, Download, LoaderCircle } from 'lucide-solid';
import { anonymousReviewRequest } from '../api/anonymousReviews.api';
import './AnonymousLessonReview.css';

type Summary = { groupId: string; period: string; total: number; average: number;
  tally?: { status: 'verified' | 'platform_calculated'; evidencePath?: string };
  distribution: { rating: number; count: number }[]; topics: { id: string; label: string; positiveCount: number; improvementCount: number }[] };
export default function AnonymousTutorRatings(props: { tutorId: string }) {
  const [data, setData] = createSignal<{ enabled: boolean; summaries: Summary[] } | null>(null);
  const [unavailable, setUnavailable] = createSignal(false);
  const [downloading, setDownloading] = createSignal<string | null>(null);
  const [downloadError, setDownloadError] = createSignal('');
  async function download(summary: Summary) {
    if (downloading() || summary.tally?.status !== 'verified') return;
    setDownloading(summary.groupId); setDownloadError('');
    try {
      const evidence = await anonymousReviewRequest<{ verified: boolean; protocol: string }>(`tally/${summary.groupId}`);
      if (evidence.verified !== true || evidence.protocol !== 'fluentxverse.review-tally.v1') throw new Error('Tally verification is unavailable');
      const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `review-tally-${summary.period}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError((error as Error).message); }
    finally { setDownloading(null); }
  }
  createEffect(() => {
    const controller = new AbortController(); setData(null); setUnavailable(false);
    void anonymousReviewRequest<{ enabled: boolean; summaries: Summary[] }>(`tutor/${encodeURIComponent(props.tutorId)}`, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    onCleanup(() => controller.abort());
  });
  return <>
    <Show when={unavailable()}><p role="status">Verified anonymous feedback is currently unavailable.</p></Show>
    <Show when={data()?.enabled}>
      <section class="anonymous-tutor-ratings"><h3><ShieldCheck size={18}/>Verified anonymous feedback</h3>
        <Show when={data()!.summaries.length} fallback={<p>No published review batches yet.</p>}>
          <For each={data()!.summaries}>{summary => <div class="anonymous-review-item">
            <div class="anonymous-tally-heading"><div><strong>{summary.average.toFixed(1)} / 5</strong><span> | {summary.total} reviews | {summary.period}</span></div>
              <Show when={summary.tally?.status === 'verified'} fallback={<span class="anonymous-tally-label">Platform-calculated tally</span>}>
                <span class="anonymous-tally-label"><ShieldCheck size={15}/>Proof-backed tally</span>
                <button type="button" class="anonymous-tally-download" aria-label={`Download tally proof for ${summary.period}`}
                  title="Download tally proof" disabled={downloading() !== null} onClick={() => void download(summary)}>
                  <Show when={downloading() === summary.groupId} fallback={<Download size={18}/>}><LoaderCircle size={18}/></Show>
                </button>
              </Show>
            </div>
            <dl class="anonymous-review-distribution">{summary.distribution.map(item => <div><dt>{item.rating} stars</dt><dd>{item.count}</dd></div>)}</dl>
            <ul>{summary.topics.filter(topic => topic.positiveCount || topic.improvementCount).map(topic => <li>{topic.label}: {topic.positiveCount} positive, {topic.improvementCount} improvement</li>)}</ul>
          </div>}</For>
        </Show>
        <Show when={downloadError()}><p class="anonymous-review-error" role="alert">{downloadError()}</p></Show>
      </section>
    </Show>
  </>;
}

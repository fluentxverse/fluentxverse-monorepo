import { createEffect, createMemo, createSignal, on, onCleanup, Show } from 'solid-js';
import { Send, Inbox, ArrowRight, ChevronLeft, ChevronRight, RotateCw } from 'lucide-solid';
import { getTutorLessonIssues, type IssueDirection, type IssueFilter, type IssueStatus, type TutorLessonIssues } from '../../api/lessonIssues.api';
import type { MetricsPeriod } from '../../api/performance.api';
import './LessonIssuesView.css';

const statuses: Record<IssueStatus, string> = { submitted: 'Submitted', under_review: 'Under review', resolved: 'Resolved' };
const tones: Record<IssueStatus, string> = { submitted: 'blue', under_review: 'amber', resolved: 'green' };
const time = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : 'Not recorded';

export default function LessonIssuesView(props: {
  period: MetricsPeriod; month: string; revision: number;
  direction: IssueDirection; status: IssueFilter;
  onDirection: (value: IssueDirection) => void; onStatus: (value: IssueFilter) => void;
}) {
  const direction = () => props.direction;
  const status = () => props.status;
  const [page, setPage] = createSignal(1);
  const [data, setData] = createSignal<TutorLessonIssues | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [retry, setRetry] = createSignal(0);
  createEffect(on(() => [props.period, props.month, props.revision, direction(), status(), page(), retry()], () => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    getTutorLessonIssues(props.period, props.month, direction(), status(), page(), controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.response?.data?.error || cause.message || 'Could not load lesson issues'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    onCleanup(() => controller.abort());
  }));
  const ready = createMemo(() => {
    const value = data();
    return value && value.period.period === props.period && (props.period !== 'month' || value.period.month === props.month)
      && value.direction === direction() && value.status === status() && value.page === page() ? value : null;
  });

  return <section class="metrics-section metrics-issues" aria-labelledby="metrics-issues-heading">
    <div class="metrics-section-heading">
      <h2 id="metrics-issues-heading">Lesson issues</h2>
      {ready() && <span>{ready()?.total} reports</span>}
    </div>
    <div class="metrics-issues-toolbar">
      <div class="metrics-issue-directions" role="group" aria-label="Report direction">
        <button type="button" aria-label="Sent reports" aria-pressed={direction() === 'sent'} onClick={() => { props.onDirection('sent'); setPage(1); }}>
          <Send size={16} aria-hidden="true"/>Sent <span>{ready()?.summary.sent ?? '--'}</span>
        </button>
        <button type="button" aria-label="Received reports" aria-pressed={direction() === 'received'} onClick={() => { props.onDirection('received'); setPage(1); }}>
          <Inbox size={16} aria-hidden="true"/>Received <span>{ready()?.summary.received ?? '--'}</span>
        </button>
      </div>
      <label class="metrics-issue-filter">Review status
        <select aria-label="Issue review status" value={status()} onChange={event => { props.onStatus(event.currentTarget.value as IssueFilter); setPage(1); }}>
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
    </div>
    {loading() && <p class="metrics-loading" role="status">Loading lesson issues...</p>}
    {error() && <div class="metrics-error" role="alert">
      <span>{error()}</span>
      <button type="button" onClick={() => setRetry(n => n + 1)}><RotateCw size={16} aria-hidden="true"/>Retry</button>
    </div>}
    <Show when={ready()} keyed>{value => <>
      <dl class="metrics-issue-counts">
        <div><dt>Total reports</dt><dd>{Object.values(value.statusCounts).reduce((sum, count) => sum + count, 0)}</dd></div>
        {(['submitted', 'under_review', 'resolved'] as const).map(key => <div><dt>{statuses[key]}</dt><dd>{value.statusCounts[key]}</dd></div>)}
      </dl>
      {!value.items.length ? <p class="metrics-empty">
        {status() === 'all' ? direction() === 'sent' ? 'No sent lesson issues in this period.' : 'No received lesson issues in this period.' : 'No lesson issues with this review status in this period.'}
      </p> : <ul class="metrics-issue-list" aria-label={direction() === 'sent' ? 'Sent lesson issues' : 'Received lesson issues'}>
        {value.items.map(issue => <li>
          <div class="metrics-issue-content">
            <div class="metrics-issue-heading">
              <h3>{issue.issueLabel || issue.reasonLabel}</h3>
              <span class={`metrics-status ${tones[issue.status]}`}>{statuses[issue.status]}</span>
            </div>
            <dl class="metrics-issue-meta">
              <div><dt>Lesson (PHT)</dt><dd>{time(issue.startsAt)}</dd></div>
              <div><dt>Reported (PHT)</dt><dd>{time(issue.createdAt)}</dd></div>
              <div><dt>Issue duration</dt><dd>{issue.duration === 'over_ten' ? 'More than 10 minutes' : 'Up to 10 minutes'}</dd></div>
            </dl>
            {(issue.details || issue.resolution) && <details class="metrics-issue-details">
              <summary>Report details</summary>
              {issue.details && <p>{issue.details}</p>}
              {issue.resolution && <div><h4>Resolution</h4><p>{issue.resolution}</p>{issue.reviewedAt && <small>Reviewed {time(issue.reviewedAt)} PHT</small>}</div>}
            </details>}
          </div>
          <a class="metrics-icon-button" href={`/lesson/${encodeURIComponent(issue.bookingId)}`} aria-label="Open lesson" title="Open lesson"><ArrowRight size={18} aria-hidden="true"/></a>
        </li>)}
      </ul>}
      {value.totalPages > 1 && <div class="metrics-pagination">
        <span>Page {value.page} of {value.totalPages}</span>
        <button type="button" class="metrics-icon-button" aria-label="Previous issues page" title="Previous issues page" disabled={page() <= 1 || loading()} onClick={() => setPage(n => n - 1)}><ChevronLeft size={18} aria-hidden="true"/></button>
        <button type="button" class="metrics-icon-button" aria-label="Next issues page" title="Next issues page" disabled={page() >= value.totalPages || loading()} onClick={() => setPage(n => n + 1)}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>}
    </>}</Show>
  </section>;
}

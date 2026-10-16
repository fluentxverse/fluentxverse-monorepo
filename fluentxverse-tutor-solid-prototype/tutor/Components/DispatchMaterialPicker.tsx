import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { client } from '../api/utils';
import { dispatchPostDate, dispatchToday, filterDispatchArchive, publishedDispatchArticles, type DispatchArticle } from '../utils/dispatchLibrary';
import './DispatchMaterialPicker.css';
const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1)))
}));
const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const pageSize = 3;
export default function DispatchMaterialPicker(_props0: {
    onOpen: (article: DispatchArticle) => void;
}) {
    const [today, setToday] = createSignal(dispatchToday());
    const [articles, setArticles] = createSignal<DispatchArticle[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const [year, setYear] = createSignal('');
    const [month, setMonth] = createSignal('');
    const [day, setDay] = createSignal('');
    const [page, setPage] = createSignal(0);
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const update = () => setToday(dispatchToday());
            const timer = window.setInterval(update, 60000);
            window.addEventListener('focus', update);
            return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [today(), revision()], () => {
        const _cleanup2 = untrack(() => {
            const controller = new AbortController();
            setLoading(true);
            setError(false);
            client.get<{
                success: boolean;
                articles: DispatchArticle[];
            }>('/dispatch/classroom-library', { signal: controller.signal, timeout: 15000 })
                .then(response => {
                if (!response.data.success || !Array.isArray(response.data.articles))
                    throw new Error('Invalid article library');
                if (controller.signal.aborted)
                    return;
                const published = publishedDispatchArticles(response.data.articles, today());
                const newestPrevious = published.find(article => dispatchPostDate(article)! < today());
                const defaultDate = newestPrevious ? dispatchPostDate(newestPrevious)! : today();
                setArticles(response.data.articles);
                setYear(defaultDate.slice(0, 4));
                setMonth(defaultDate.slice(5, 7));
                setDay('');
                setPage(0);
            })
                .catch(() => {
                if (!controller.signal.aborted)
                    setError(true);
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setLoading(false);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const published = createMemo(() => publishedDispatchArticles(articles(), today()));
    const latest = createMemo(() => published().find(article => dispatchPostDate(article) === today()));
    const archive = createMemo(() => published().filter(article => dispatchPostDate(article)! < today()));
    const years = createMemo(() => [...new Set([today().slice(0, 4), ...archive().map(article => dispatchPostDate(article)!.slice(0, 4))])].sort().reverse());
    const matches = createMemo(() => filterDispatchArchive(archive(), year(), month(), day()));
    const pages = createMemo(() => Math.max(1, Math.ceil(matches().length / pageSize)));
    const days = createMemo(() => month() ? new Date(Date.UTC(Number(year() || '2000'), Number(month()), 0)).getUTCDate() : 31);
    const renderArticle = (article: DispatchArticle) => (<div class="dp-article">
      <time dateTime={dispatchPostDate(article)!}>{dateLabel.format(new Date(`${dispatchPostDate(article)}T00:00:00Z`))}</time>
      <div class="dp-article-copy"><strong>{article.title}</strong><span class="dp-category">{article.category || 'General'}</span></div>
      <button type="button" class="dp-open" onClick={() => _props0["onOpen"](article)} aria-label={`Open article: ${article.title}`}><TutorIcon name="fas fa-book-open" aria-hidden="true"/><span>Open article</span></button>
    </div>);
    return createMemo(() => {
        if (loading())
            return <div class="dispatch-picker dp-state" role="status"><TutorIcon name="fas fa-spinner fa-spin" aria-hidden="true"/>Loading articles...</div>;
        if (error())
            return <div class="dispatch-picker dp-state" role="alert"><span>Could not load Daily Dispatch articles.</span><button type="button" class="dp-retry" onClick={() => setRevision(value => value + 1)}>Try again</button></div>;
        return (<div class="dispatch-picker">
      <section class="dp-section" aria-labelledby="dp-latest-heading">
        <header class="dp-heading"><h3 id="dp-latest-heading"><TutorIcon name="fas fa-newspaper" aria-hidden="true"/>Latest article</h3><span>Today</span></header>
        {latest() ? renderArticle(latest()) : <p class="dp-empty">No article has been posted for today.</p>}
      </section>
      <section class="dp-section" aria-labelledby="dp-archive-heading">
        <header class="dp-heading"><h3 id="dp-archive-heading"><TutorIcon name="fas fa-archive" aria-hidden="true"/>Article archive</h3><span>{matches().length} {matches().length === 1 ? 'article' : 'articles'}</span></header>
        <div class="dp-filters">
          <label>Month<select aria-label="Month" value={month()} onChange={event => { setMonth(event.currentTarget.value); setDay(''); setPage(0); }}><option value="">All months</option>{months.map(item => <option value={item.value}>{item.label}</option>)}</select></label>
          <label>Day<select aria-label="Day" value={day()} onChange={event => { setDay(event.currentTarget.value); setPage(0); }}><option value="">All days</option>{Array.from({ length: days() }, (_, index) => <option value={String(index + 1).padStart(2, '0')}>{index + 1}</option>)}</select></label>
          <label>Year<select aria-label="Year" value={year()} onChange={event => { setYear(event.currentTarget.value); setDay(''); setPage(0); }}><option value="">All years</option>{years().map(value => <option value={value}>{value}</option>)}</select></label>
        </div>
        <div class="dp-results" aria-live="polite">
          {matches().length ? matches().slice(page() * pageSize, (page() + 1) * pageSize).map(renderArticle) : <p class="dp-empty">No previous articles match this date.</p>}
        </div>
        <footer class="dp-pagination">
          <span>{matches().length ? `${page() * pageSize + 1}-${Math.min((page() + 1) * pageSize, matches().length)} of ${matches().length}` : '0 results'}</span>
          <div><button type="button" title="Previous page" aria-label="Previous articles page" disabled={page() === 0} onClick={() => setPage(value => value - 1)}><TutorIcon name="fas fa-chevron-left" aria-hidden="true"/></button><span>{page() + 1} / {pages()}</span><button type="button" title="Next page" aria-label="Next articles page" disabled={page() + 1 >= pages()} onClick={() => setPage(value => value + 1)}><TutorIcon name="fas fa-chevron-right" aria-hidden="true"/></button></div>
        </footer>
      </section>
    </div>);
    }) as unknown as JSX.Element;
}

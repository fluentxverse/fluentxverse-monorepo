import { useEffect, useState } from 'preact/hooks';
import { client } from '../api/utils';
import { dispatchPostDate, dispatchToday, filterDispatchArchive, publishedDispatchArticles, type DispatchArticle } from '../utils/dispatchLibrary';
import './DispatchMaterialPicker.css';

const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))),
}));
const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const pageSize = 3;

export default function DispatchMaterialPicker({ onOpen }: { onOpen: (article: DispatchArticle) => void }) {
  const [today, setToday] = useState(dispatchToday());
  const [articles, setArticles] = useState<DispatchArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const update = () => setToday(dispatchToday());
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    client.get<{ success: boolean; articles: DispatchArticle[] }>('/dispatch/classroom-library', { signal: controller.signal, timeout: 15000 })
      .then(response => {
        if (!response.data.success || !Array.isArray(response.data.articles)) throw new Error('Invalid article library');
        if (controller.signal.aborted) return;
        const published = publishedDispatchArticles(response.data.articles, today);
        const newestPrevious = published.find(article => dispatchPostDate(article)! < today);
        const defaultDate = newestPrevious ? dispatchPostDate(newestPrevious)! : today;
        setArticles(response.data.articles);
        setYear(defaultDate.slice(0, 4));
        setMonth(defaultDate.slice(5, 7));
        setDay('');
        setPage(0);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [today, revision]);

  const published = publishedDispatchArticles(articles, today);
  const latest = published.find(article => dispatchPostDate(article) === today);
  const archive = published.filter(article => dispatchPostDate(article)! < today);
  const years = [...new Set([today.slice(0, 4), ...archive.map(article => dispatchPostDate(article)!.slice(0, 4))])].sort().reverse();
  const matches = filterDispatchArchive(archive, year, month, day);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const days = month ? new Date(Date.UTC(Number(year || '2000'), Number(month), 0)).getUTCDate() : 31;
  const renderArticle = (article: DispatchArticle) => (
    <div className="dp-article" key={article.id}>
      <time dateTime={dispatchPostDate(article)!}>{dateLabel.format(new Date(`${dispatchPostDate(article)}T00:00:00Z`))}</time>
      <div className="dp-article-copy"><strong>{article.title}</strong><span className="dp-category">{article.category || 'General'}</span></div>
      <button type="button" className="dp-open" onClick={() => onOpen(article)} aria-label={`Open article: ${article.title}`}><i className="fas fa-book-open" aria-hidden="true" /><span>Open article</span></button>
    </div>
  );

  if (loading) return <div className="dispatch-picker dp-state" role="status"><i className="fas fa-spinner fa-spin" aria-hidden="true" />Loading articles...</div>;
  if (error) return <div className="dispatch-picker dp-state" role="alert"><span>Could not load Daily Dispatch articles.</span><button type="button" className="dp-retry" onClick={() => setRevision(value => value + 1)}>Try again</button></div>;

  return (
    <div className="dispatch-picker">
      <section className="dp-section" aria-labelledby="dp-latest-heading">
        <header className="dp-heading"><h3 id="dp-latest-heading"><i className="fas fa-newspaper" aria-hidden="true" />Latest article</h3><span>Today</span></header>
        {latest ? renderArticle(latest) : <p className="dp-empty">No article has been posted for today.</p>}
      </section>
      <section className="dp-section" aria-labelledby="dp-archive-heading">
        <header className="dp-heading"><h3 id="dp-archive-heading"><i className="fas fa-archive" aria-hidden="true" />Article archive</h3><span>{matches.length} {matches.length === 1 ? 'article' : 'articles'}</span></header>
        <div className="dp-filters">
          <label>Month<select aria-label="Month" value={month} onChange={event => { setMonth(event.currentTarget.value); setDay(''); setPage(0); }}><option value="">All months</option>{months.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Day<select aria-label="Day" value={day} onChange={event => { setDay(event.currentTarget.value); setPage(0); }}><option value="">All days</option>{Array.from({ length: days }, (_, index) => <option key={index} value={String(index + 1).padStart(2, '0')}>{index + 1}</option>)}</select></label>
          <label>Year<select aria-label="Year" value={year} onChange={event => { setYear(event.currentTarget.value); setDay(''); setPage(0); }}><option value="">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="dp-results" aria-live="polite">
          {matches.length ? matches.slice(page * pageSize, (page + 1) * pageSize).map(renderArticle) : <p className="dp-empty">No previous articles match this date.</p>}
        </div>
        <footer className="dp-pagination">
          <span>{matches.length ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, matches.length)} of ${matches.length}` : '0 results'}</span>
          <div><button type="button" title="Previous page" aria-label="Previous articles page" disabled={page === 0} onClick={() => setPage(value => value - 1)}><i className="fas fa-chevron-left" aria-hidden="true" /></button><span>{page + 1} / {pages}</span><button type="button" title="Next page" aria-label="Next articles page" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}><i className="fas fa-chevron-right" aria-hidden="true" /></button></div>
        </footer>
      </section>
    </div>
  );
}

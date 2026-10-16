/**
 * DailyDispatchPage - Student App
 * Lists all available Daily Dispatch articles for students
 */
import { useState, useEffect } from 'preact/hooks';
import { ArrowLeft, ArrowRight, ArrowUpRight, Search, X } from 'lucide-preact';
import { MaterialLibraryShell, LibraryState } from '../Components/Materials/MaterialLibrary';
import { API_BASE_URL } from '../config/api';


interface DispatchArticle {
  id: string;
  title: string;
  topic: string;
  category: string;
  createdAt: string;
}

export default function DailyDispatchPage() {
  const [articles, setArticles] = useState<DispatchArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRecency, setSelectedRecency] = useState('All');
  const [selectedSort, setSelectedSort] = useState('Newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const CATEGORIES = [
    'All',
    'Technology',
    'Business',
    'Science',
    'Entertainment',
    'Sports',
    'Health & Wellness',
    'Environment',
    'Lifestyle',
    'Education',
  ];

  const RECENCY_OPTIONS = ['All', 'Today', 'This Week', 'This Month'];
  const SORT_OPTIONS = ['Newest', 'Oldest', 'A–Z', 'Z–A'];

  useEffect(() => {
    document.title = 'Daily Dispatch | FluentXVerse';
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/dispatch`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load articles');
      const data = await response.json();
      setArticles(data);
    } catch (err) {
      console.error('Failed to load articles:', err);
      setError('Failed to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                          article.topic.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesRecency = (() => {
      if (selectedRecency === 'All') return true;
      const created = new Date(article.createdAt).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (selectedRecency === 'Today') {
        return now - created < oneDay;
      }
      if (selectedRecency === 'This Week') {
        return now - created < 7 * oneDay;
      }
      if (selectedRecency === 'This Month') {
        return now - created < 30 * oneDay;
      }
      return true;
    })();
    const matchesDateRange = (() => {
      if (!startDate && !endDate) return true;
      const created = new Date(article.createdAt).getTime();
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
      if (start !== null && created < start) return false;
      if (end !== null && created > end) return false;
      return true;
    })();
    return matchesCategory && matchesSearch && matchesRecency && matchesDateRange;
  });

  const sortedArticles = filteredArticles.slice().sort((a, b) => {
    if (selectedSort === 'Newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (selectedSort === 'Oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (selectedSort === 'A–Z') {
      return a.title.localeCompare(b.title);
    }
    if (selectedSort === 'Z–A') {
      return b.title.localeCompare(a.title);
    }
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedArticles = sortedArticles.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedRecency, selectedSort, startDate, endDate]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const clearFilters = () => {
    setSearchQuery(''); setSelectedCategory('All'); setSelectedRecency('All');
    setSelectedSort('Newest'); setStartDate(''); setEndDate(''); setCurrentPage(1);
  };
  const activeFilters = !!(searchQuery || selectedCategory !== 'All' || selectedRecency !== 'All' || startDate || endDate);
  return <MaterialLibraryShell title="Daily Dispatch" category="News & conversation" art="dispatch" description="Explore current stories, build your vocabulary, and bring new ideas to your next conversation.">
    <div className="library-toolbar">
      <label className="library-field library-search-label">Search<div className="library-search"><Search size={18} />
        <input type="search" aria-label="Search articles" placeholder="Search articles" value={searchQuery} onInput={event => setSearchQuery(event.currentTarget.value)} />
        {searchQuery && <button aria-label="Clear search" title="Clear search" onClick={() => setSearchQuery('')}><X size={16} /></button>}
      </div></label>
      <label className="library-field">Category<select aria-label="Category" value={selectedCategory} onChange={event => setSelectedCategory(event.currentTarget.value)}>{CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="library-field">Recency<select aria-label="Recency" value={selectedRecency} onChange={event => setSelectedRecency(event.currentTarget.value)}>{RECENCY_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="library-field">Sort<select aria-label="Sort" value={selectedSort} onChange={event => setSelectedSort(event.currentTarget.value)}>{SORT_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className="library-field library-date-field"><span>Date range</span><div className="library-dates">
        <input type="date" aria-label="Start date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.currentTarget.value)} /><span>to</span>
        <input type="date" aria-label="End date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.currentTarget.value)} />
      </div></div>
      {activeFilters && <button className="library-icon-button" aria-label="Clear filters" title="Clear filters" onClick={clearFilters}><X size={18} /></button>}
    </div>
    {loading || error ? <LibraryState loading={loading} error={loading ? null : error} retry={loadArticles} />
      : !paginatedArticles.length ? <LibraryState empty={activeFilters ? 'No matching articles' : 'No published articles yet'} clear={activeFilters ? clearFilters : undefined} />
      : <>
        <p className="library-result-count" aria-live="polite">{sortedArticles.length} {sortedArticles.length === 1 ? 'article' : 'articles'}</p>
        <div className="library-article-grid">{paginatedArticles.map(article => <a key={article.id} className="library-lesson" href={`/materials/daily-dispatch/${encodeURIComponent(article.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`Read ${article.title}`}>
          <div className="library-lesson-meta">{article.category} · {formatDate(article.createdAt)}</div>
          <h3>{article.title}</h3><p>{article.topic}</p>
          <div className="library-lesson-footer"><span>Read article</span><ArrowUpRight size={18} /></div>
        </a>)}</div>
        {sortedArticles.length > pageSize && <nav className="library-pagination" aria-label="Article pages">
          <button className="library-button" aria-label="Previous page" title="Previous page" disabled={clampedPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}><ArrowLeft size={18} /></button>
          <span>Page {clampedPage} of {totalPages}</span>
          <button className="library-button" aria-label="Next page" title="Next page" disabled={clampedPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}><ArrowRight size={18} /></button>
        </nav>}
      </>}
  </MaterialLibraryShell>;
}

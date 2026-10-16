import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowLeft, ArrowRight, ArrowUpRight, Search, X } from "lucide-solid";
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
    const [articles, setArticles] = createSignal<DispatchArticle[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedCategory, setSelectedCategory] = createSignal('All');
    const [selectedRecency, setSelectedRecency] = createSignal('All');
    const [selectedSort, setSelectedSort] = createSignal('Newest');
    const [startDate, setStartDate] = createSignal('');
    const [endDate, setEndDate] = createSignal('');
    const [currentPage, setCurrentPage] = createSignal(1);
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
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            document.title = 'Daily Dispatch | FluentXVerse';
            loadArticles();
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    const loadArticles = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(`${API_BASE_URL}/dispatch`, {
                credentials: 'include'
            });
            if (!response.ok)
                throw new Error('Failed to load articles');
            const data = await response.json();
            setArticles(data);
        }
        catch (err) {
            console.error('Failed to load articles:', err);
            setError('Failed to load articles. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const filteredArticles = createMemo(() => articles().filter(article => {
        const matchesCategory = selectedCategory() === 'All' || article.category === selectedCategory();
        const matchesSearch = article.title.toLowerCase().includes(searchQuery().trim().toLowerCase()) ||
            article.topic.toLowerCase().includes(searchQuery().trim().toLowerCase());
        const matchesRecency = (() => {
            if (selectedRecency() === 'All')
                return true;
            const created = new Date(article.createdAt).getTime();
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            if (selectedRecency() === 'Today') {
                return now - created < oneDay;
            }
            if (selectedRecency() === 'This Week') {
                return now - created < 7 * oneDay;
            }
            if (selectedRecency() === 'This Month') {
                return now - created < 30 * oneDay;
            }
            return true;
        })();
        const matchesDateRange = (() => {
            if (!startDate() && !endDate())
                return true;
            const created = new Date(article.createdAt).getTime();
            const start = startDate() ? new Date(startDate()).setHours(0, 0, 0, 0) : null;
            const end = endDate() ? new Date(endDate()).setHours(23, 59, 59, 999) : null;
            if (start !== null && created < start)
                return false;
            if (end !== null && created > end)
                return false;
            return true;
        })();
        return matchesCategory && matchesSearch && matchesRecency && matchesDateRange;
    }));
    const sortedArticles = createMemo(() => filteredArticles().slice().sort((a, b) => {
        if (selectedSort() === 'Newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (selectedSort() === 'Oldest') {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (selectedSort() === 'A–Z') {
            return a.title.localeCompare(b.title);
        }
        if (selectedSort() === 'Z–A') {
            return b.title.localeCompare(a.title);
        }
        return 0;
    }));
    const totalPages = createMemo(() => Math.max(1, Math.ceil(sortedArticles().length / pageSize)));
    const clampedPage = createMemo(() => Math.min(currentPage(), totalPages()));
    const paginatedArticles = createMemo(() => sortedArticles().slice((clampedPage() - 1) * pageSize, clampedPage() * pageSize));
    createEffect(on(() => [searchQuery(), selectedCategory(), selectedRecency(), selectedSort(), startDate(), endDate()], () => {
        const _cleanup1 = untrack(() => {
            setCurrentPage(1);
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedRecency('All');
        setSelectedSort('Newest');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };
    const activeFilters = createMemo(() => !!(searchQuery() || selectedCategory() !== 'All' || selectedRecency() !== 'All' || startDate() || endDate()));
    return <MaterialLibraryShell title="Daily Dispatch" category="News & conversation" art="dispatch" description="Explore current stories, build your vocabulary, and bring new ideas to your next conversation.">
    <div class="library-toolbar">
      <label class="library-field library-search-label">Search<div class="library-search"><Search size={18}/>
        <input type="search" aria-label="Search articles" placeholder="Search articles" value={searchQuery()} onInput={event => setSearchQuery(event.currentTarget.value)}/>
        {searchQuery() && <button aria-label="Clear search" title="Clear search" onClick={() => setSearchQuery('')}><X size={16}/></button>}
      </div></label>
      <label class="library-field">Category<select aria-label="Category" value={selectedCategory()} onChange={event => setSelectedCategory(event.currentTarget.value)}>{CATEGORIES.map(value => <option value={value}>{value}</option>)}</select></label>
      <label class="library-field">Recency<select aria-label="Recency" value={selectedRecency()} onChange={event => setSelectedRecency(event.currentTarget.value)}>{RECENCY_OPTIONS.map(value => <option value={value}>{value}</option>)}</select></label>
      <label class="library-field">Sort<select aria-label="Sort" value={selectedSort()} onChange={event => setSelectedSort(event.currentTarget.value)}>{SORT_OPTIONS.map(value => <option value={value}>{value}</option>)}</select></label>
      <div class="library-field library-date-field"><span>Date range</span><div class="library-dates">
        <input type="date" aria-label="Start date" value={startDate()} max={endDate() || undefined} onInput={event => setStartDate(event.currentTarget.value)}/><span>to</span>
        <input type="date" aria-label="End date" value={endDate()} min={startDate() || undefined} onInput={event => setEndDate(event.currentTarget.value)}/>
      </div></div>
      {activeFilters() && <button class="library-icon-button" aria-label="Clear filters" title="Clear filters" onClick={clearFilters}><X size={18}/></button>}
    </div>
    {loading() || error() ? <LibraryState loading={loading()} error={loading() ? null : error()} retry={loadArticles}/>
            : !paginatedArticles().length ? <LibraryState empty={activeFilters() ? 'No matching articles' : 'No published articles yet'} clear={activeFilters() ? clearFilters : undefined}/>
                : <>
        <p class="library-result-count" aria-live="polite">{sortedArticles().length} {sortedArticles().length === 1 ? 'article' : 'articles'}</p>
        <div class="library-article-grid">{paginatedArticles().map(article => <a class="library-lesson" href={`/materials/daily-dispatch/${encodeURIComponent(article.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`Read ${article.title}`}>
          <div class="library-lesson-meta">{article.category} · {formatDate(article.createdAt)}</div>
          <h3>{article.title}</h3><p>{article.topic}</p>
          <div class="library-lesson-footer"><span>Read article</span><ArrowUpRight size={18}/></div>
        </a>)}</div>
        {sortedArticles().length > pageSize && <nav class="library-pagination" aria-label="Article pages">
          <button class="library-button" aria-label="Previous page" title="Previous page" disabled={clampedPage() === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}><ArrowLeft size={18}/></button>
          <span>Page {clampedPage()} of {totalPages()}</span>
          <button class="library-button" aria-label="Next page" title="Next page" disabled={clampedPage() === totalPages()} onClick={() => setCurrentPage(prev => Math.min(totalPages(), prev + 1))}><ArrowRight size={18}/></button>
        </nav>}
      </>}
  </MaterialLibraryShell>;
}

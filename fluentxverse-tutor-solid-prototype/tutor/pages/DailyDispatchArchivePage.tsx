import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { useRoute, useLocation } from "../routing";
import { API_BASE_URL } from '../config/api';
const DailyDispatchLogo = '/assets/img/home-icons/dispatch-v1.png';
import './DailyDispatchArticlePage.css';
interface ArchiveArticleItem {
    id: string;
    title: string;
    topic: string;
    category: string;
    createdAt: string;
    excerpt?: string;
}
interface ArchiveItem {
    month: string;
    count: number;
}
export default function DailyDispatchArchivePage() {
    const _state0 = useRoute();
    const location = useLocation();
    const [articles, setArticles] = createSignal<ArchiveArticleItem[]>([]);
    const [archives, setArchives] = createSignal<ArchiveItem[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    // Decode the month from URL params
    const month = createMemo(() => _state0.params?.month ? decodeURIComponent(_state0.params.month) : '');
    const CATEGORIES = [
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
    createEffect(on(() => [month()], () => {
        const _cleanup1 = untrack(() => {
            if (month()) {
                loadArticles(month());
            }
            loadArchives();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const loadArticles = async (monthStr: string) => {
        try {
            setLoading(true);
            setError('');
            const encodedMonth = encodeURIComponent(monthStr);
            const response = await fetch(`${API_BASE_URL}/dispatch/archives/${encodedMonth}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setArticles(data.articles || []);
            }
            else {
                setError('Failed to load articles. Please try again.');
            }
        }
        catch (err) {
            console.error('Failed to load articles:', err);
            setError('Failed to load articles. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const loadArchives = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/dispatch/archives`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.archives)) {
                    setArchives(data.archives);
                }
                else if (Array.isArray(data)) {
                    setArchives(data);
                }
            }
        }
        catch (err) {
            console.error('Failed to load archives:', err);
        }
    };
    const handleArticleClick = (articleId: string) => {
        location.route(`/materials/daily-dispatch/${articleId}`);
    };
    const handleArchiveClick = (archiveMonth: string) => {
        location.route(`/materials/daily-dispatch/archives/${encodeURIComponent(archiveMonth)}`);
    };
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    return createMemo(() => {
        if (loading()) {
            return (<div class="ddp-loading">
        <div class="ddp-loading-spinner"/>
        <p>Loading articles...</p>
      </div>);
        }
        return (<div class="ddp-container">
      {/* Header Bar with Logo and Categories */}
      <nav class="ddp-header-bar no-print">
        <div class="ddp-header-bar-inner">
          <a href="/materials/daily-dispatch" class="ddp-toolbar-brand" style={cssStyle({ textDecoration: 'none' })}>
            <img src={DailyDispatchLogo} alt="Daily Dispatch" class="ddp-logo"/>
            <span>Daily Dispatch</span>
          </a>
          <div class="ddp-categories-list">
            {CATEGORIES.map((cat) => (<span class="ddp-category-item">
                {cat}
              </span>))}
          </div>
        </div>
      </nav>

      {/* Main Layout with Content and Sidebar */}
      <div class="ddp-layout">
        {/* Main Content */}
        <div class="ddp-content dda-content">
          {/* Archive Header */}
          <header class="dda-header">
            <h1 class="dda-month-title">Month: <span>{month()}</span></h1>
          </header>

          {/* Error Message */}
          {error() && (<div class="dda-error">
              <TutorIcon name="ri-error-warning-line"/>
              <p>{error()}</p>
            </div>)}

          {/* Article List */}
          {articles().length > 0 ? (<div class="dda-articles-list">
              {articles().map((article) => (<article class="dda-article-card" onClick={() => handleArticleClick(article.id)}>
                  <h2 class="dda-article-title">{article.title}</h2>
                  <p class="dda-article-date">{formatDate(article.createdAt)}</p>
                  {article.excerpt && (<p class="dda-article-excerpt">{article.excerpt}...</p>)}
                  <p class="dda-article-category">
                    <span class="dda-article-category-tag">
                      {article.category}
                    </span>
                  </p>
                </article>))}
            </div>) : (!error() && (<div class="dda-no-articles">
                <TutorIcon name="ri-article-line"/>
                <p>No articles found for {month()}</p>
              </div>))}
        </div>

        {/* Sidebar */}
        <aside class="ddp-sidebar no-print">
          {/* Archives */}
          <div class="ddp-sidebar-section">
            <h3 class="ddp-sidebar-title">Archives</h3>
            {archives().length > 0 ? (<ul class="ddp-archives-list">
                {archives().map((archive, i) => (<li class={archive.month === month() ? 'active' : ''}>
                    <a href="#" onClick={(e) => { e.preventDefault(); handleArchiveClick(archive.month); }}>
                      {archive.month}
                    </a>
                    <span class="ddp-archive-count">({archive.count})</span>
                  </li>))}
              </ul>) : (<p class="ddp-sidebar-empty">No archives yet</p>)}
          </div>
        </aside>
      </div>
    </div>);
    }) as unknown as JSX.Element;
}

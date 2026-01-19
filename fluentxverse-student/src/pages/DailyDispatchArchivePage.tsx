/**
 * DailyDispatchArchivePage - Student App
 * Displays articles for a specific month archive
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { API_BASE_URL } from '../config/api';
import DailyDispatchLogo from '../assets/icons/daily-dispatch-logo.svg';
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
  const { params } = useRoute();
  const location = useLocation();
  const [articles, setArticles] = useState<ArchiveArticleItem[]>([]);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Decode the month from URL params
  const month = params?.month ? decodeURIComponent(params.month) : '';

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

  useEffect(() => {
    if (month) {
      loadArticles(month);
    }
    loadArchives();
  }, [month]);

  const loadArticles = async (monthStr: string) => {
    try {
      setLoading(true);
      setError('');
      const encodedMonth = encodeURIComponent(monthStr);
      const response = await fetch(`${API_BASE_URL}/dispatch/archives/${encodedMonth}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setArticles(data.articles || []);
      } else {
        setError('Failed to load articles. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load articles:', err);
      setError('Failed to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadArchives = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/archives`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.archives)) {
          setArchives(data.archives);
        } else if (Array.isArray(data)) {
          setArchives(data);
        }
      }
    } catch (err) {
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
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="ddp-loading">
        <div className="ddp-loading-spinner" />
        <p>Loading articles...</p>
      </div>
    );
  }

  return (
    <div className="ddp-container">
      {/* Header Bar with Logo and Categories */}
      <nav className="ddp-header-bar no-print">
        <div className="ddp-header-bar-inner">
          <a href="/materials/daily-dispatch" className="ddp-toolbar-brand" style={{ textDecoration: 'none' }}>
            <img src={DailyDispatchLogo} alt="Daily Dispatch" className="ddp-logo" />
            <span>Daily Dispatch</span>
          </a>
          <div className="ddp-categories-list">
            {CATEGORIES.map((cat) => (
              <span 
                key={cat} 
                className="ddp-category-item"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Layout with Content and Sidebar */}
      <div className="ddp-layout">
        {/* Main Content */}
        <div className="ddp-content dda-content">
          {/* Archive Header */}
          <header className="dda-header">
            <h1 className="dda-month-title">Month: <span>{month}</span></h1>
          </header>

          {/* Error Message */}
          {error && (
            <div className="dda-error">
              <i className="ri-error-warning-line" />
              <p>{error}</p>
            </div>
          )}

          {/* Article List */}
          {articles.length > 0 ? (
            <div className="dda-articles-list">
              {articles.map((article) => (
                <article 
                  key={article.id} 
                  className="dda-article-card"
                  onClick={() => handleArticleClick(article.id)}
                >
                  <h2 className="dda-article-title">{article.title}</h2>
                  <p className="dda-article-date">{formatDate(article.createdAt)}</p>
                  {article.excerpt && (
                    <p className="dda-article-excerpt">{article.excerpt}...</p>
                  )}
                  <p className="dda-article-category">
                    <span className="dda-article-category-tag">
                      {article.category}
                    </span>
                  </p>
                </article>
              ))}
            </div>
          ) : (
            !error && (
              <div className="dda-no-articles">
                <i className="ri-article-line" />
                <p>No articles found for {month}</p>
              </div>
            )
          )}
        </div>

        {/* Sidebar */}
        <aside className="ddp-sidebar no-print">
          {/* Archives */}
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">Archives</h3>
            {archives.length > 0 ? (
              <ul className="ddp-archives-list">
                {archives.map((archive, i) => (
                  <li key={i} className={archive.month === month ? 'active' : ''}>
                    <a 
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleArchiveClick(archive.month); }}
                    >
                      {archive.month}
                    </a>
                    <span className="ddp-archive-count">({archive.count})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ddp-sidebar-empty">No archives yet</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

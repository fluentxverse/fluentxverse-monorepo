/**
 * DailyDispatchPage - Student App
 * Lists all available Daily Dispatch articles for students
 */
import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { API_BASE_URL } from '../config/api';
import './DailyDispatchPage.css';

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
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.topic.toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleArticleClick = (articleId: string) => {
    window.open(`/materials/daily-dispatch/${articleId}`, '_blank');
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <div className="daily-dispatch-page">
          <div className="dispatch-container">
            {/* Header */}
            <div className="dispatch-header">
              <a href="/materials" className="back-link">
                <i className="fas fa-arrow-left"></i>
                Back to Materials
              </a>
              <div className="dispatch-header-main">
                <div className="dispatch-icon">📰</div>
                <div>
                  <h1 className="dispatch-title">Daily Dispatch</h1>
                  <p className="dispatch-subtitle">
                    Read current news articles and improve your English comprehension
                  </p>
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="dispatch-controls">
              <div className="dispatch-search">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                />
              </div>
              <div className="dispatch-filter-group">
                <div className="dispatch-filter">
                  <label>Category</label>
                  <select
                    className="dispatch-category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="dispatch-filter">
                  <label>Recency</label>
                  <select
                    className="dispatch-category-select"
                    value={selectedRecency}
                    onChange={(e) => setSelectedRecency((e.target as HTMLSelectElement).value)}
                  >
                    {RECENCY_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="dispatch-filter">
                  <label>Sort</label>
                  <select
                    className="dispatch-category-select"
                    value={selectedSort}
                    onChange={(e) => setSelectedSort((e.target as HTMLSelectElement).value)}
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="dispatch-filter dispatch-filter-date">
                  <label>Date Range</label>
                  <div className="dispatch-date-range">
                    <input
                      type="date"
                      className="dispatch-date-input"
                      value={startDate}
                      onChange={(e) => setStartDate((e.target as HTMLInputElement).value)}
                      aria-label="Start date"
                    />
                    <span className="dispatch-date-separator">to</span>
                    <input
                      type="date"
                      className="dispatch-date-input"
                      value={endDate}
                      onChange={(e) => setEndDate((e.target as HTMLInputElement).value)}
                      aria-label="End date"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="dispatch-loading">
                <div className="dispatch-spinner"></div>
                <p>Loading articles...</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="dispatch-error">
                <i className="fas fa-exclamation-circle"></i>
                <p>{error}</p>
                <button onClick={loadArticles}>Try Again</button>
              </div>
            )}

            {/* Articles Grid */}
            {!loading && !error && (
              <div className="dispatch-grid">
                {paginatedArticles.length > 0 ? (
                  paginatedArticles.map(article => (
                    <div
                      key={article.id}
                      className="dispatch-card"
                      onClick={() => handleArticleClick(article.id)}
                    >
                      <div className="dispatch-card-header">
                        <span className="dispatch-card-category">{article.category}</span>
                        <span className="dispatch-card-date">{formatDate(article.createdAt)}</span>
                      </div>
                      <h3 className="dispatch-card-title">{article.title}</h3>
                      <p className="dispatch-card-topic">{article.topic}</p>
                      <div className="dispatch-card-footer">
                        <span className="dispatch-read-btn">
                          <i className="fas fa-book-open"></i>
                          Read Article
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dispatch-empty">
                    <i className="fas fa-newspaper"></i>
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && sortedArticles.length > pageSize && (
              <div className="dispatch-pagination">
                <button
                  className="dispatch-page-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={clampedPage === 1}
                >
                  Newer
                </button>
                <div className="dispatch-page-info">
                  Page {clampedPage} of {totalPages}
                </div>
                <button
                  className="dispatch-page-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={clampedPage === totalPages}
                >
                  Older
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

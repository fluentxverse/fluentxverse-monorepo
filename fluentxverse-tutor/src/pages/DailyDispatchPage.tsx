/**
 * DailyDispatchPage - Tutor App
 * Lists all available Daily Dispatch articles for tutors
 */
import { useState, useEffect } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import './DailyDispatchPage.css';

interface DispatchArticle {
  id: string;
  title: string;
  topic: string;
  category: string;
  createdAt: string;
}

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '';

export default function DailyDispatchPage() {
  const { user } = useAuthContext();
  const [articles, setArticles] = useState<DispatchArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
    return matchesCategory && matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleTutorPreview = (articleId: string) => {
    window.open(`${DASHBOARD_URL}/daily-dispatch/preview/${articleId}`, '_blank');
  };

  const handleStudentPreview = (articleId: string) => {
    window.open(`${DASHBOARD_URL}/daily-dispatch/student/${articleId}`, '_blank');
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="daily-dispatch-page">
          <div className="dispatch-container">
            {/* Header */}
            <div className="dispatch-header">
              <a href="/materials" className="back-link">
                <i className="fi-sr-angle-left"></i>
                Back to Materials
              </a>
              <div className="dispatch-header-main">
                <div className="dispatch-icon">📰</div>
                <div>
                  <h1 className="dispatch-title">Daily Dispatch</h1>
                  <p className="dispatch-subtitle">
                    News articles with vocabulary, comprehension questions, and discussion topics
                  </p>
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="dispatch-controls">
              <div className="dispatch-search">
                <i className="fi-sr-search"></i>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                />
              </div>
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
                <i className="fi-sr-exclamation"></i>
                <p>{error}</p>
                <button onClick={loadArticles}>Try Again</button>
              </div>
            )}

            {/* Articles Grid */}
            {!loading && !error && (
              <div className="dispatch-grid">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
                    <div key={article.id} className="dispatch-card">
                      <div className="dispatch-card-header">
                        <span className="dispatch-card-category">{article.category}</span>
                        <span className="dispatch-card-date">{formatDate(article.createdAt)}</span>
                      </div>
                      <h3 className="dispatch-card-title">{article.title}</h3>
                      <p className="dispatch-card-topic">{article.topic}</p>
                      <div className="dispatch-card-actions">
                        <button
                          className="dispatch-btn dispatch-btn-primary"
                          onClick={() => handleTutorPreview(article.id)}
                        >
                          <i className="fi-sr-document"></i>
                          Tutor View
                        </button>
                        <button
                          className="dispatch-btn dispatch-btn-secondary"
                          onClick={() => handleStudentPreview(article.id)}
                        >
                          <i className="fi-sr-user"></i>
                          Student View
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dispatch-empty">
                    <i className="fi-sr-newspaper"></i>
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

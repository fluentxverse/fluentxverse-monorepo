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
                <i className="fas fa-exclamation-circle"></i>
                <p>{error}</p>
                <button onClick={loadArticles}>Try Again</button>
              </div>
            )}

            {/* Articles Grid */}
            {!loading && !error && (
              <div className="dispatch-grid">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
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
          </div>
        </div>
      </div>
    </>
  );
}

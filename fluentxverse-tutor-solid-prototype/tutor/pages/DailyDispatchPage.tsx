import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
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
export default function DailyDispatchPage() {
    const _state0 = useAuthContext();
    const [articles, setArticles] = createSignal<DispatchArticle[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedCategory, setSelectedCategory] = createSignal('All');
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
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Daily Dispatch | FluentXVerse';
            loadArticles();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const loadArticles = async () => {
        try {
            setLoading(true);
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
        const matchesSearch = article.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
            article.topic.toLowerCase().includes(searchQuery().toLowerCase());
        return matchesCategory && matchesSearch;
    }));
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    const handleTutorPreview = (articleId: string) => {
        window.location.href = `/materials/daily-dispatch/${articleId}`;
    };
    const handleStudentPreview = (articleId: string) => {
        // Open in new tab to show what student sees (without answers)
        window.open(`/materials/daily-dispatch/${articleId}?mode=student`, '_blank');
    };
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <div class="daily-dispatch-page">
          <div class="dispatch-container">
            {/* Header */}
            <div class="dispatch-header">
              <a href="/materials" class="back-link">
                <TutorIcon name="fi-sr-angle-left"/>
                Back to Materials
              </a>
              <div class="dispatch-header-main">
                <div class="dispatch-icon"><TutorArt name="dispatch" size={48}/></div>
                <div>
                  <h1 class="dispatch-title">Daily Dispatch</h1>
                  <p class="dispatch-subtitle">
                    News articles with vocabulary, comprehension questions, and discussion topics
                  </p>
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div class="dispatch-controls">
              <div class="dispatch-search">
                <TutorIcon name="fi-sr-search"/>
                <input type="text" aria-label="Search articles" placeholder="Search articles..." value={searchQuery()} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}/>
              </div>
              <select class="dispatch-category-select" value={selectedCategory()} onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}>
                {CATEGORIES.map(cat => (<option value={cat}>{cat}</option>))}
              </select>
            </div>

            {/* Loading */}
            {loading() && (<div class="dispatch-loading">
                <div class="dispatch-spinner"></div>
                <p>Loading articles...</p>
              </div>)}

            {/* Error */}
            {error() && (<div class="dispatch-error">
                <TutorIcon name="fi-sr-exclamation"/>
                <p>{error()}</p>
                <button onClick={loadArticles}>Try Again</button>
              </div>)}

            {/* Articles Grid */}
            {!loading() && !error() && (<div class="dispatch-grid">
                {filteredArticles().length > 0 ? (filteredArticles().map(article => (<div class="dispatch-card">
                      <div class="dispatch-card-header">
                        <span class="dispatch-card-category">{article.category}</span>
                        <span class="dispatch-card-date">{formatDate(article.createdAt)}</span>
                      </div>
                      <h3 class="dispatch-card-title">{article.title}</h3>
                      <p class="dispatch-card-topic">{article.topic}</p>
                      <div class="dispatch-card-actions">
                        <button class="dispatch-btn dispatch-btn-primary" onClick={() => handleTutorPreview(article.id)}>
                          <TutorIcon name="fi-sr-document"/>
                          Tutor View
                        </button>
                        <button class="dispatch-btn dispatch-btn-secondary" onClick={() => handleStudentPreview(article.id)}>
                          <TutorIcon name="fi-sr-user"/>
                          Student View
                        </button>
                      </div>
                    </div>))) : (<div class="dispatch-empty">
                    <TutorIcon name="fi-sr-newspaper"/>
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or filter</p>
                  </div>)}
              </div>)}
          </div>
        </div>
      </div>
    </>);
}

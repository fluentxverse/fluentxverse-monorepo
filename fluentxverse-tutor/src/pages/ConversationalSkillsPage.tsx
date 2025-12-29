import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './ConversationalSkillsPage.css';

// Helper functions to generate URL-friendly slugs
const generateGoalSlug = (goalText: string): string => {
  return goalText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, '_'); // Replace spaces with underscores
};

const extractLevelNumber = (levelBadge: string): string => {
  const match = levelBadge.match(/(\d+)/);
  return match ? match[1] : '1';
};

const extractChapterNumber = (chapterLabel: string): string => {
  const match = chapterLabel.match(/(\d+)/);
  return match ? match[1] : '1';
};

const ConversationalSkillsPage = () => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Conversational Skills | FluentXVerse';
  }, []);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch ALL published lessons (use 'all' to bypass course filtering)
      // TODO: Once lessons have course metadata, change back to 'conversational-skills'
      const result = await lessonApi.getPublishedLessons('all');
      if (result.success) {
        setLessons(result.lessons);
      } else {
        setError(result.error || 'Failed to load lessons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLessons = lessons.filter(lesson => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lesson.title.toLowerCase().includes(query) ||
      (lesson.lessonData?.header?.lessonLabel || '').toLowerCase().includes(query) ||
      (lesson.lessonData?.header?.goalText || '').toLowerCase().includes(query)
    );
  });

  const handleOpenLesson = (lesson: Lesson) => {
    // Generate the custom URL based on lesson metadata
    const header = lesson.lessonData?.header;
    if (header) {
      const level = extractLevelNumber(header.levelBadge || 'Level 1');
      const chapter = extractChapterNumber(header.chapterLabel || 'Chapter 1');
      const goalSlug = generateGoalSlug(header.goalText || lesson.title);
      
      // Navigate to custom URL with lesson ID as query param
      route(`/conversation-mat/lvl${level}/ch${chapter}/${goalSlug}?id=${lesson.id}`);
    } else if (lesson.url) {
      // Fallback to external URL if no header data
      window.open(lesson.url, '_blank');
    }
  };

  const getLevelFromHeader = (lesson: Lesson): string => {
    return lesson.lessonData?.header?.levelBadge || 'All Levels';
  };

  const getChapterFromHeader = (lesson: Lesson): string => {
    return lesson.lessonData?.header?.chapterLabel || '';
  };

  const getSectionsCount = (lesson: Lesson): number => {
    return lesson.lessonData?.sections?.length || 0;
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="course-detail-page">
          <div className="course-detail-container">
            {/* Page Header */}
            <div className="course-detail-header">
              <a href="/materials" className="back-link">
                <i className="fi-sr-angle-left"></i>
                Back to Materials
              </a>
              <div className="course-hero">
                <div className="course-hero-icon">💬</div>
                <div className="course-hero-content">
                  <span className="course-category-badge">Conversation</span>
                  <h1 className="course-title-main">Conversational Skills</h1>
                  <p className="course-description-main">
                    Master everyday conversations, casual discussions, and natural speaking patterns. 
                    These materials will help your students communicate confidently in any situation.
                  </p>
                  <div className="course-stats-row">
                    <div className="course-stat">
                      <i className="fi-sr-book-alt"></i>
                      <span>{lessons.length} Lessons Available</span>
                    </div>
                    <div className="course-stat">
                      <i className="fi-sr-star"></i>
                      <span>4.9 Rating</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="lessons-search-section">
              <div className="lessons-search">
                <i className="fi-sr-search"></i>
                <input
                  type="text"
                  placeholder="Search lessons..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            {/* Lessons List */}
            {isLoading ? (
              <div className="lessons-loading">
                <div className="spinner"></div>
                <p>Loading lessons...</p>
              </div>
            ) : error ? (
              <div className="lessons-error">
                <div className="error-icon">
                  <i className="fi-sr-exclamation"></i>
                </div>
                <h3>Failed to load lessons</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={loadLessons}>
                  <i className="fi-sr-refresh"></i>
                  Try Again
                </button>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="lessons-empty">
                <div className="empty-icon">
                  <i className="fi-sr-book-open-cover"></i>
                </div>
                {searchQuery ? (
                  <>
                    <h3>No lessons found</h3>
                    <p>No lessons match your search. Try a different keyword.</p>
                    <button className="btn-reset" onClick={() => setSearchQuery('')}>
                      <i className="fi-sr-cross-circle"></i>
                      Clear Search
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No published lessons yet</h3>
                    <p>There are no lessons available for this course yet. Check back later!</p>
                  </>
                )}
              </div>
            ) : (
              <div className="lessons-grid">
                {filteredLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="lesson-card"
                    onClick={() => handleOpenLesson(lesson)}
                  >
                    <div 
                      className="lesson-thumbnail"
                      style={{
                        backgroundImage: lesson.lessonData?.header?.backgroundImage 
                          ? `url(${lesson.lessonData.header.backgroundImage})`
                          : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                      }}
                    >
                      <div className="lesson-thumbnail-overlay">
                        <span className="level-badge">{getLevelFromHeader(lesson)}</span>
                      </div>
                    </div>
                    <div className="lesson-content">
                      <div className="lesson-chapter">{getChapterFromHeader(lesson)}</div>
                      <h3 className="lesson-title">{lesson.title}</h3>
                      <p className="lesson-goal">
                        {lesson.lessonData?.header?.goalText || 'English conversation practice'}
                      </p>
                      <div className="lesson-meta">
                        <span className="lesson-sections">
                          <i className="fi-sr-layers"></i>
                          {getSectionsCount(lesson)} sections
                        </span>
                        <span className="lesson-date">
                          <i className="fi-sr-calendar"></i>
                          {new Date(lesson.publishedAt || lesson.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="lesson-action">
                      <button className="btn-open-lesson">
                        <i className="fi-sr-play"></i>
                        Open Lesson
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ConversationalSkillsPage;

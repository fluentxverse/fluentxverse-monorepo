import { useEffect, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './LessonViewPage.css';

export default function LessonViewPage() {
  const { query } = useRoute();
  const lessonId = query.id as string;
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Lesson | FluentXVerse';
  }, []);

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    } else {
      setError('No lesson ID provided');
      setIsLoading(false);
    }
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await lessonApi.getLesson(lessonId);
      if (result.success && result.lesson) {
        setLesson({
          ...result.lesson,
          lessonData: result.lessonData
        });
        // Update page title with lesson name
        document.title = `${result.lesson.title} | FluentXVerse`;
      } else {
        setError(result.error || 'Failed to load lesson');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelFromHeader = (): string => {
    return lesson?.lessonData?.header?.levelBadge || 'All Levels';
  };

  const getChapterFromHeader = (): string => {
    return lesson?.lessonData?.header?.chapterLabel || '';
  };

  if (isLoading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <Header />
          <div className="lesson-view-page">
            <div className="lesson-view-loading">
              <div className="spinner"></div>
              <p>Loading lesson...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !lesson) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <Header />
          <div className="lesson-view-page">
            <div className="lesson-view-error">
              <div className="error-icon">
                <i className="fas fa-exclamation-circle"></i>
              </div>
              <h3>Failed to load lesson</h3>
              <p>{error || 'Lesson not found'}</p>
              <a href="/materials/conversational-skills" className="btn-back">
                <i className="fas fa-arrow-left"></i>
                Back to Materials
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <div className="lesson-view-page">
          <div className="lesson-view-container">
            {/* Breadcrumb */}
            <div className="lesson-breadcrumb">
              <a href="/materials">Materials</a>
              <i className="fas fa-chevron-right"></i>
              <a href="/materials/conversational-skills">Conversational Skills</a>
              <i className="fas fa-chevron-right"></i>
              <span>{lesson.title}</span>
            </div>

            {/* Lesson Header */}
            <div 
              className="lesson-view-header"
              style={{
                backgroundImage: lesson.lessonData?.header?.backgroundImage 
                  ? `url(${lesson.lessonData.header.backgroundImage})`
                  : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
              }}
            >
              <div className="lesson-header-overlay">
                <div className="lesson-header-content">
                  <div className="lesson-header-badges">
                    <span className="level-badge">{getLevelFromHeader()}</span>
                    <span className="chapter-badge">{getChapterFromHeader()}</span>
                  </div>
                  <h1 className="lesson-title">{lesson.title}</h1>
                  <p className="lesson-goal">
                    {lesson.lessonData?.header?.goalText || 'English conversation practice'}
                  </p>
                  <p className="lesson-subgoal">
                    {lesson.lessonData?.header?.goalSubtext || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Lesson Content - Embedded iframe */}
            <div className="lesson-content-wrapper">
              {lesson.url ? (
                <iframe
                  src={lesson.url}
                  className="lesson-iframe"
                  title={lesson.title}
                  allowFullScreen
                />
              ) : (
                <div className="lesson-no-content">
                  <i className="fas fa-file-alt"></i>
                  <p>Lesson content is not available</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="lesson-actions">
              <a href="/materials/conversational-skills" className="btn-secondary">
                <i className="fas fa-arrow-left"></i>
                Back to Course
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

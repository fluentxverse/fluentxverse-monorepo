import { useEffect, useState } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi } from '../api/lesson.api';
import './LessonViewPage.css';

export default function LessonViewPage() {
  const { query } = useRoute();
  const { route } = useLocation();
  const lessonId = query.id as string;
  
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>('Lesson');
  // Single loading state - true until iframe is fully loaded
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'FluentXVerse';
  }, []);

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    } else {
      setError('No lesson ID provided');
    }
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setError(null);
      
      // Use the tutor endpoint to get the proper tutor view URL (with hints)
      const result = await lessonApi.getTutorLesson(lessonId);
      
      if (result.success && result.viewUrl) {
        setViewUrl(result.viewUrl);
        
        // Update page title with lesson name
        if (result.lesson?.title) {
          setLessonTitle(result.lesson.title);
          document.title = `${result.lesson.title} | FluentXVerse`;
        }
        // Note: isReady stays false until iframe onLoad fires
      } else {
        setError(result.error || 'Failed to load lesson');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    }
  };

  const handleBack = () => {
    // Close this tab if it was opened as a new tab, otherwise navigate back
    if (window.opener) {
      window.close();
    } else {
      route('/materials/conversational-skills');
    }
  };

  // Error state
  if (error) {
    return (
      <div className="lesson-fullpage">
        <div className="lesson-fullpage-error">
          <div className="error-icon">
            <i className="fi-sr-exclamation"></i>
          </div>
          <h3>Failed to load lesson</h3>
          <p>{error}</p>
          <button onClick={handleBack} className="btn-back">
            <i className="fi-sr-arrow-left"></i>
            Back to Materials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-fullpage">
      {/* Single loading spinner - shows until iframe content is fully loaded */}
      {!isReady && (
        <div className="lesson-fullpage-loading">
          <div className="spinner"></div>
          <p>Loading lesson...</p>
        </div>
      )}
      {/* Iframe starts loading immediately when viewUrl is available */}
      {viewUrl && (
        <iframe
          src={viewUrl}
          className={`lesson-fullpage-iframe ${isReady ? 'loaded' : 'loading'}`}
          title={lessonTitle}
          allowFullScreen
          onLoad={() => setIsReady(true)}
        />
      )}
    </div>
  );
}

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Loading Lesson... | FluentXVerse';
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
      
      // Use the student endpoint to get the proper student view URL
      const result = await lessonApi.getStudentLesson(lessonId);
      
      if (result.success && result.viewUrl) {
        setViewUrl(result.viewUrl);
        
        // Update page title with lesson name
        if (result.lesson?.title) {
          setLessonTitle(result.lesson.title);
          document.title = `${result.lesson.title} | FluentXVerse`;
        }
      } else {
        setError(result.error || 'Failed to load lesson');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="lesson-fullpage">
        <div className="lesson-fullpage-loading">
          <div className="spinner"></div>
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (error || !viewUrl) {
    return (
      <div className="lesson-fullpage">
        <div className="lesson-fullpage-error">
          <div className="error-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h3>Failed to load lesson</h3>
          <p>{error || 'Lesson not found'}</p>
          <button onClick={handleBack} className="btn-back">
            <i className="fas fa-arrow-left"></i>
            Back to Materials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-fullpage">
      {/* Full-page iframe */}
      <iframe
        src={viewUrl}
        className="lesson-fullpage-iframe"
        title={lessonTitle}
        allowFullScreen
      />
    </div>
  );
}

import { useEffect, useState, useRef } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi } from '../api/lesson.api';
import './LessonViewPage.css';

export default function LessonViewPage() {
  const { query } = useRoute();
  const { route } = useLocation();
  const lessonId = query.id as string;
  const hasOpenedRef = useRef(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Opening Lesson... | FluentXVerse';
  }, []);

  useEffect(() => {
    if (lessonId && !hasOpenedRef.current) {
      loadAndOpenLesson();
    } else if (!lessonId) {
      setError('No lesson ID provided');
      setIsLoading(false);
    }
  }, [lessonId]);

  const loadAndOpenLesson = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the tutor endpoint to get the proper tutor view URL (with hints)
      const result = await lessonApi.getTutorLesson(lessonId);
      
      if (result.success && result.viewUrl) {
        // Mark that we've opened to prevent double-opening
        hasOpenedRef.current = true;
        
        // Open lesson in new tab
        window.open(result.viewUrl, '_blank');
        
        // Navigate back to materials page
        route('/materials/conversational-skills');
      } else {
        setError(result.error || 'Failed to load lesson');
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    route('/materials/conversational-skills');
  };

  if (isLoading) {
    return (
      <div className="lesson-fullpage">
        <div className="lesson-fullpage-loading">
          <div className="spinner"></div>
          <p>Opening lesson in new tab...</p>
        </div>
      </div>
    );
  }

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

  return null;
}

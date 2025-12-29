import { useEffect, useState } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi } from '../api/lesson.api';
import './LessonViewPage.css';

interface LessonInfo {
  id: string;
  title: string;
  status: string;
}

export default function LessonViewPage() {
  const { query } = useRoute();
  const { route } = useLocation();
  const lessonId = query.id as string;
  
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
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
      
      // Use the student endpoint to get the proper student view URL
      const result = await lessonApi.getStudentLesson(lessonId);
      
      if (result.success && result.viewUrl) {
        setLesson(result.lesson);
        setViewUrl(result.viewUrl);
        
        // Update page title with lesson name
        if (result.lesson?.title) {
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
    route('/materials/conversational-skills');
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
            <i className="fi-sr-exclamation"></i>
          </div>
          <h3>Failed to load lesson</h3>
          <p>{error || 'Lesson not found'}</p>
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
      {/* Back Button - Fixed position */}
      <button 
        className="lesson-back-btn"
        onClick={handleBack}
        title="Back to Materials"
      >
        <i className="fi-sr-arrow-left"></i>
        <span>Back</span>
      </button>

      {/* Full-page iframe */}
      <iframe
        src={viewUrl}
        className="lesson-fullpage-iframe"
        title={lesson?.title || 'Lesson Material'}
        allowFullScreen
      />
    </div>
  );
}
    </>
  );
}

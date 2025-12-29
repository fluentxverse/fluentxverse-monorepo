import { useEffect, useState } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi, type LessonMaterial } from '../api/lesson.api';
import LessonRenderer from '../Components/LessonRenderer';
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
  const [lessonData, setLessonData] = useState<LessonMaterial | null>(null);
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
      
      // Use the tutor endpoint to get the full lesson data with hints
      const result = await lessonApi.getTutorLesson(lessonId);
      
      if (result.success && result.lessonData) {
        setLesson(result.lesson);
        setLessonData(result.lessonData);
        
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
        </div>
      </div>
    );
  }

  if (error || !lessonData) {
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

      {/* Render lesson content directly with tutor view */}
      <div className="lesson-content-wrapper">
        <LessonRenderer lessonData={lessonData} viewMode="tutor" />
      </div>
    </div>
  );
}

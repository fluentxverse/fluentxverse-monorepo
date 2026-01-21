/**
 * YoungLearnersLessonPage
 * Interactive lesson view for Young Learners - kid-friendly interface
 */
import { useEffect, useState, useRef } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi } from '../api/lesson.api';
import './YoungLearnersLessonPage.css';

// ============================================================================
// TYPES
// ============================================================================

interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  image: string;
  audio?: string;
}

interface SongLyric {
  id: string;
  line: string;
  translation?: string;
  timing?: number;
}

interface Song {
  title: string;
  audioUrl?: string;
  lyrics: SongLyric[];
}

interface StoryPage {
  id: string;
  image: string;
  text: string;
  translation?: string;
  audio?: string;
}

interface Story {
  title: string;
  pages: StoryPage[];
}

interface Activity {
  id: string;
  type: string;
  title: string;
  instruction: string;
  instructionJp?: string;
  data: any;
}

interface YoungLearnersLesson {
  id: string;
  level: number;
  unit: number;
  lessonNumber: number;
  theme: string;
  ageGroup: string;
  unitLabel: string;
  lessonTitle: string;
  mascot: string;
  backgroundColor: string;
  greeting: string;
  greetingJp?: string;
  vocabularyWords: VocabularyWord[];
  song: Song | null;
  story: Story | null;
  activities: Activity[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MASCOTS: Record<string, { emoji: string; name: string }> = {
  foxy: { emoji: '🦊', name: 'Foxy' },
  buddy: { emoji: '🐻', name: 'Buddy' },
  sunny: { emoji: '☀️', name: 'Sunny' },
  luna: { emoji: '🌙', name: 'Luna' },
  pippa: { emoji: '🐧', name: 'Pippa' },
  ozzy: { emoji: '🦉', name: 'Ozzy' },
};

const ACTIVITY_EMOJIS: Record<string, string> = {
  coloring: '🖍️',
  matching: '🔗',
  tracing: '✏️',
  counting: '🔢',
  sorting: '📦',
  singing: '🎵',
  story: '📖',
};

type Section = 'welcome' | 'vocabulary' | 'song' | 'story' | 'activities' | 'complete';

// ============================================================================
// COMPONENT
// ============================================================================

export default function YoungLearnersLessonPage() {
  const route = useRoute();
  const location = useLocation();
  const lessonId = route.params?.id;

  const [lesson, setLesson] = useState<YoungLearnersLesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<Section>('welcome');
  
  // Vocabulary state
  const [currentVocabIndex, setCurrentVocabIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  
  // Story state
  const [currentStoryPage, setCurrentStoryPage] = useState(0);
  
  // Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (lesson) {
      document.title = `${lesson.lessonTitle} | Young Learners`;
    }
  }, [lesson]);

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    }
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await lessonApi.getYoungLearnersLesson(lessonId!);
      if (result.success && result.lesson) {
        setLesson(result.lesson);
      } else {
        setError(result.error || 'Failed to load lesson');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    } finally {
      setIsLoading(false);
    }
  };

  // Get sections that have content
  const getAvailableSections = (): Section[] => {
    if (!lesson) return ['welcome'];
    const sections: Section[] = ['welcome'];
    if (lesson.vocabularyWords.length > 0) sections.push('vocabulary');
    if (lesson.song && lesson.song.lyrics.length > 0) sections.push('song');
    if (lesson.story && lesson.story.pages.length > 0) sections.push('story');
    if (lesson.activities.length > 0) sections.push('activities');
    sections.push('complete');
    return sections;
  };

  const availableSections = getAvailableSections();
  const currentSectionIndex = availableSections.indexOf(currentSection);

  // Navigation
  const goToNextSection = () => {
    const nextIndex = currentSectionIndex + 1;
    if (nextIndex < availableSections.length) {
      setCurrentSection(availableSections[nextIndex]);
    }
  };

  const goToPrevSection = () => {
    const prevIndex = currentSectionIndex - 1;
    if (prevIndex >= 0) {
      setCurrentSection(availableSections[prevIndex]);
    }
  };

  // Play audio
  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
  };

  // Toggle card flip
  const toggleCardFlip = (index: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const mascot = lesson ? MASCOTS[lesson.mascot] || MASCOTS.foxy : MASCOTS.foxy;

  // Loading state
  if (isLoading) {
    return (
      <div className="yl-lesson-page" style={{ backgroundColor: '#FFF8DC' }}>
        <div className="yl-lesson-loading">
          <div className="yl-loading-mascot">🦊</div>
          <p>Loading your lesson...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !lesson) {
    return (
      <div className="yl-lesson-page" style={{ backgroundColor: '#FFF8DC' }}>
        <div className="yl-lesson-error">
          <span className="yl-error-emoji">😢</span>
          <h2>Oops!</h2>
          <p>{error || 'Lesson not found'}</p>
          <button onClick={() => location.route('/young-learners')}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="yl-lesson-page" style={{ backgroundColor: lesson.backgroundColor || '#FFF8DC' }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} />
      
      {/* Header */}
      <header className="yl-lesson-header">
        <button className="yl-back-button" onClick={() => location.route('/young-learners')}>
          <i className="ri-arrow-left-line" />
        </button>
        <div className="yl-lesson-title-area">
          <span className="yl-lesson-badge">Level {lesson.level} • Lesson {lesson.lessonNumber}</span>
          <h1>{lesson.lessonTitle}</h1>
        </div>
        <div className="yl-lesson-mascot">{mascot.emoji}</div>
      </header>

      {/* Progress Bar */}
      <div className="yl-progress-bar">
        <div 
          className="yl-progress-fill"
          style={{ width: `${((currentSectionIndex + 1) / availableSections.length) * 100}%` }}
        />
      </div>

      {/* Content */}
      <main className="yl-lesson-content">
        {/* Welcome Section */}
        {currentSection === 'welcome' && (
          <section className="yl-section yl-welcome">
            <div className="yl-welcome-mascot">
              <span className="yl-big-mascot">{mascot.emoji}</span>
              <div className="yl-speech-bubble">
                <p>{lesson.greeting}</p>
                {lesson.greetingJp && <p className="yl-jp">{lesson.greetingJp}</p>}
              </div>
            </div>
            <div className="yl-lesson-preview">
              <h2>What we'll learn today:</h2>
              <div className="yl-preview-items">
                {lesson.vocabularyWords.length > 0 && (
                  <div className="yl-preview-item">
                    <span>📚</span>
                    <span>{lesson.vocabularyWords.length} new words</span>
                  </div>
                )}
                {lesson.song && (
                  <div className="yl-preview-item">
                    <span>🎵</span>
                    <span>A fun song</span>
                  </div>
                )}
                {lesson.story && (
                  <div className="yl-preview-item">
                    <span>📖</span>
                    <span>A story</span>
                  </div>
                )}
                {lesson.activities.length > 0 && (
                  <div className="yl-preview-item">
                    <span>🎮</span>
                    <span>{lesson.activities.length} activities</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Vocabulary Section */}
        {currentSection === 'vocabulary' && (
          <section className="yl-section yl-vocabulary">
            <h2 className="yl-section-title">📚 New Words!</h2>
            <p className="yl-section-subtitle">Tap a card to see the meaning</p>
            
            <div className="yl-vocab-cards">
              {lesson.vocabularyWords.map((word, index) => (
                <div
                  key={word.id}
                  className={`yl-vocab-card ${flippedCards.has(index) ? 'flipped' : ''}`}
                  onClick={() => toggleCardFlip(index)}
                >
                  <div className="yl-vocab-card-inner">
                    <div className="yl-vocab-front">
                      {word.image ? (
                        <img src={word.image} alt={word.word} />
                      ) : (
                        <div className="yl-vocab-placeholder">🖼️</div>
                      )}
                      <h3>{word.word}</h3>
                      {word.audio && (
                        <button
                          className="yl-audio-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(word.audio!);
                          }}
                        >
                          🔊
                        </button>
                      )}
                    </div>
                    <div className="yl-vocab-back">
                      <span className="yl-translation">{word.translation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Song Section */}
        {currentSection === 'song' && lesson.song && (
          <section className="yl-section yl-song">
            <h2 className="yl-section-title">🎵 Sing Along!</h2>
            <h3 className="yl-song-title">{lesson.song.title}</h3>
            
            {lesson.song.audioUrl && (
              <button
                className="yl-play-song-btn"
                onClick={() => playAudio(lesson.song!.audioUrl!)}
              >
                ▶️ Play Song
              </button>
            )}
            
            <div className="yl-lyrics">
              {lesson.song.lyrics.map((lyric, index) => (
                <div key={lyric.id} className="yl-lyric-line">
                  <span className="yl-lyric-number">{index + 1}</span>
                  <div className="yl-lyric-text">
                    <p>{lyric.line}</p>
                    {lyric.translation && <p className="yl-jp">{lyric.translation}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Story Section */}
        {currentSection === 'story' && lesson.story && (
          <section className="yl-section yl-story">
            <h2 className="yl-section-title">📖 Story Time!</h2>
            <h3 className="yl-story-title">{lesson.story.title}</h3>
            
            <div className="yl-story-book">
              <div className="yl-story-page">
                {lesson.story.pages[currentStoryPage]?.image && (
                  <img
                    src={lesson.story.pages[currentStoryPage].image}
                    alt=""
                    className="yl-story-image"
                  />
                )}
                <div className="yl-story-text">
                  <p>{lesson.story.pages[currentStoryPage]?.text}</p>
                  {lesson.story.pages[currentStoryPage]?.translation && (
                    <p className="yl-jp">{lesson.story.pages[currentStoryPage].translation}</p>
                  )}
                </div>
                {lesson.story.pages[currentStoryPage]?.audio && (
                  <button
                    className="yl-audio-button"
                    onClick={() => playAudio(lesson.story!.pages[currentStoryPage].audio!)}
                  >
                    🔊 Listen
                  </button>
                )}
              </div>
              
              <div className="yl-story-nav">
                <button
                  disabled={currentStoryPage === 0}
                  onClick={() => setCurrentStoryPage(p => p - 1)}
                >
                  ← Back
                </button>
                <span>{currentStoryPage + 1} / {lesson.story.pages.length}</span>
                <button
                  disabled={currentStoryPage === lesson.story.pages.length - 1}
                  onClick={() => setCurrentStoryPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Activities Section */}
        {currentSection === 'activities' && (
          <section className="yl-section yl-activities">
            <h2 className="yl-section-title">🎮 Fun Activities!</h2>
            
            <div className="yl-activities-list">
              {lesson.activities.map((activity, index) => (
                <div key={activity.id} className="yl-activity-card">
                  <div className="yl-activity-icon">
                    {ACTIVITY_EMOJIS[activity.type] || '🎯'}
                  </div>
                  <div className="yl-activity-info">
                    <h3>{activity.title || `Activity ${index + 1}`}</h3>
                    <p>{activity.instruction}</p>
                    {activity.instructionJp && (
                      <p className="yl-jp">{activity.instructionJp}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Complete Section */}
        {currentSection === 'complete' && (
          <section className="yl-section yl-complete">
            <div className="yl-complete-content">
              <span className="yl-star-burst">⭐</span>
              <h2>Great Job!</h2>
              <p>You finished the lesson!</p>
              <div className="yl-complete-mascot">
                {mascot.emoji}
              </div>
              <button
                className="yl-home-button"
                onClick={() => location.route('/young-learners')}
              >
                Back to Lessons
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Navigation Footer */}
      <footer className="yl-lesson-footer">
        <button
          className="yl-nav-btn prev"
          onClick={goToPrevSection}
          disabled={currentSectionIndex === 0}
        >
          <i className="ri-arrow-left-line" />
          <span>Back</span>
        </button>
        
        <div className="yl-section-dots">
          {availableSections.map((section, index) => (
            <span
              key={section}
              className={`yl-dot ${index === currentSectionIndex ? 'active' : ''} ${index < currentSectionIndex ? 'completed' : ''}`}
            />
          ))}
        </div>
        
        <button
          className="yl-nav-btn next"
          onClick={goToNextSection}
          disabled={currentSectionIndex === availableSections.length - 1}
        >
          <span>Next</span>
          <i className="ri-arrow-right-line" />
        </button>
      </footer>
    </div>
  );
}

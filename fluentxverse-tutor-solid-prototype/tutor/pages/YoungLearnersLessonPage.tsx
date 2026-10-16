import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { useRoute, useLocation } from "../routing";
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
const MASCOTS: Record<string, {
    emoji: string;
    name: string;
}> = {
    foxy: { emoji: '🦊', name: 'Foxy' },
    buddy: { emoji: '🐻', name: 'Buddy' },
    sunny: { emoji: '☀️', name: 'Sunny' },
    luna: { emoji: '🌙', name: 'Luna' },
    pippa: { emoji: '🐧', name: 'Pippa' },
    ozzy: { emoji: '🦉', name: 'Ozzy' }
};
const ACTIVITY_EMOJIS: Record<string, string> = {
    coloring: '🖍️',
    matching: '🔗',
    tracing: '✏️',
    counting: '🔢',
    sorting: '📦',
    singing: '🎵',
    story: '📖'
};
type Section = 'welcome' | 'vocabulary' | 'song' | 'story' | 'activities' | 'complete';
// ============================================================================
// COMPONENT
// ============================================================================
export default function YoungLearnersLessonPage() {
    const route = useRoute();
    const location = useLocation();
    const lessonId = createMemo(() => route.params?.id);
    const [lesson, setLesson] = createSignal<YoungLearnersLesson | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [currentSection, setCurrentSection] = createSignal<Section>('welcome');
    // Vocabulary state
    const [currentVocabIndex, setCurrentVocabIndex] = createSignal(0);
    const [flippedCards, setFlippedCards] = createSignal<Set<number>>(new Set());
    // Story state
    const [currentStoryPage, setCurrentStoryPage] = createSignal(0);
    // Audio ref
    const audioRef = { current: null } as {
        current: (HTMLAudioElement | null) | null;
    };
    createEffect(on(() => [lesson()], () => {
        const _cleanup0 = untrack(() => {
            if (lesson()) {
                document.title = `${lesson().lessonTitle} | Young Learners`;
            }
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    createEffect(on(() => [lessonId()], () => {
        const _cleanup1 = untrack(() => {
            if (lessonId()) {
                loadLesson();
            }
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const loadLesson = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const result = await lessonApi.getYoungLearnersLesson(lessonId()!);
            if (result.success && result.lesson) {
                setLesson(result.lesson);
            }
            else {
                setError(result.error || 'Failed to load lesson');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
        finally {
            setIsLoading(false);
        }
    };
    // Get sections that have content
    const getAvailableSections = (): Section[] => {
        if (!lesson())
            return ['welcome'];
        const sections: Section[] = ['welcome'];
        if (lesson().vocabularyWords.length > 0)
            sections.push('vocabulary');
        if (lesson().song && lesson().song.lyrics.length > 0)
            sections.push('song');
        if (lesson().story && lesson().story.pages.length > 0)
            sections.push('story');
        if (lesson().activities.length > 0)
            sections.push('activities');
        sections.push('complete');
        return sections;
    };
    const availableSections = getAvailableSections();
    const currentSectionIndex = createMemo(() => availableSections.indexOf(currentSection()));
    // Navigation
    const goToNextSection = () => {
        const nextIndex = currentSectionIndex() + 1;
        if (nextIndex < availableSections.length) {
            setCurrentSection(availableSections[nextIndex]);
        }
    };
    const goToPrevSection = () => {
        const prevIndex = currentSectionIndex() - 1;
        if (prevIndex >= 0) {
            setCurrentSection(availableSections[prevIndex]);
        }
    };
    // Play audio
    const playAudio = (url: string) => {
        if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play().catch(() => { });
        }
    };
    // Toggle card flip
    const toggleCardFlip = (index: number) => {
        setFlippedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            }
            else {
                newSet.add(index);
            }
            return newSet;
        });
    };
    const mascot = createMemo(() => lesson() ? MASCOTS[lesson().mascot] || MASCOTS.foxy : MASCOTS.foxy);
    return createMemo(() => {
        // Loading state
        if (isLoading()) {
            return (<div class="yl-lesson-page" style={cssStyle({ backgroundColor: '#FFF8DC' })}>
        <div class="yl-lesson-loading">
          <div class="yl-loading-mascot">🦊</div>
          <p>Loading your lesson...</p>
        </div>
      </div>);
        }
        // Error state
        if (error() || !lesson()) {
            return (<div class="yl-lesson-page" style={cssStyle({ backgroundColor: '#FFF8DC' })}>
        <div class="yl-lesson-error">
          <span class="yl-error-emoji">😢</span>
          <h2>Oops!</h2>
          <p>{error() || 'Lesson not found'}</p>
          <button onClick={() => location.route('/materials/young-learners')}>
            Go Back
          </button>
        </div>
      </div>);
        }
        return (<div class="yl-lesson-page" style={cssStyle({ get backgroundColor() {
                    return lesson().backgroundColor || '#FFF8DC';
                } })}>
      {/* Hidden audio element */}
      <audio ref={_element => audioRef.current = _element}/>
      
      {/* Header */}
      <header class="yl-lesson-header">
        <button class="yl-back-button" aria-label="Back to Young Learners" title="Back to Young Learners" onClick={() => location.route('/materials/young-learners')}>
          <TutorIcon name="ri-arrow-left-line"/>
        </button>
        <div class="yl-lesson-title-area">
          <span class="yl-lesson-badge">Level {lesson().level} • Lesson {lesson().lessonNumber}</span>
          <h1>{lesson().lessonTitle}</h1>
        </div>
        <div class="yl-lesson-mascot">{mascot().emoji}</div>
      </header>

      {/* Progress Bar */}
      <div class="yl-progress-bar">
        <div class="yl-progress-fill" style={cssStyle({ get width() {
                    return `${((currentSectionIndex() + 1) / availableSections.length) * 100}%`;
                } })}/>
      </div>

      {/* Content */}
      <main class="yl-lesson-content">
        {/* Welcome Section */}
        {currentSection() === 'welcome' && (<section class="yl-section yl-welcome">
            <div class="yl-welcome-mascot">
              <span class="yl-big-mascot">{mascot().emoji}</span>
              <div class="yl-speech-bubble">
                <p>{lesson().greeting}</p>
                {lesson().greetingJp && <p class="yl-jp">{lesson().greetingJp}</p>}
              </div>
            </div>
            <div class="yl-lesson-preview">
              <h2>What we'll learn today:</h2>
              <div class="yl-preview-items">
                {lesson().vocabularyWords.length > 0 && (<div class="yl-preview-item">
                    <span>📚</span>
                    <span>{lesson().vocabularyWords.length} new words</span>
                  </div>)}
                {lesson().song && (<div class="yl-preview-item">
                    <span>🎵</span>
                    <span>A fun song</span>
                  </div>)}
                {lesson().story && (<div class="yl-preview-item">
                    <span>📖</span>
                    <span>A story</span>
                  </div>)}
                {lesson().activities.length > 0 && (<div class="yl-preview-item">
                    <span>🎮</span>
                    <span>{lesson().activities.length} activities</span>
                  </div>)}
              </div>
            </div>
          </section>)}

        {/* Vocabulary Section */}
        {currentSection() === 'vocabulary' && (<section class="yl-section yl-vocabulary">
            <h2 class="yl-section-title">📚 New Words!</h2>
            <p class="yl-section-subtitle">Tap a card to see the meaning</p>
            
            <div class="yl-vocab-cards">
              {lesson().vocabularyWords.map((word, index) => (<div class={`yl-vocab-card ${flippedCards().has(index) ? 'flipped' : ''}`} onClick={() => toggleCardFlip(index)}>
                  <div class="yl-vocab-card-inner">
                    <div class="yl-vocab-front">
                      {word.image ? (<img src={word.image} alt={word.word}/>) : (<div class="yl-vocab-placeholder">🖼️</div>)}
                      <h3>{word.word}</h3>
                      {word.audio && (<button class="yl-audio-button" onClick={(e) => {
                            e.stopPropagation();
                            playAudio(word.audio!);
                        }}>
                          🔊
                        </button>)}
                    </div>
                    <div class="yl-vocab-back">
                      <span class="yl-translation">{word.translation}</span>
                    </div>
                  </div>
                </div>))}
            </div>
          </section>)}

        {/* Song Section */}
        {currentSection() === 'song' && lesson().song && (<section class="yl-section yl-song">
            <h2 class="yl-section-title">🎵 Sing Along!</h2>
            <h3 class="yl-song-title">{lesson().song.title}</h3>
            
            {lesson().song.audioUrl && (<button class="yl-play-song-btn" onClick={() => playAudio(lesson().song!.audioUrl!)}>
                ▶️ Play Song
              </button>)}
            
            <div class="yl-lyrics">
              {lesson().song.lyrics.map((lyric, index) => (<div class="yl-lyric-line">
                  <span class="yl-lyric-number">{index + 1}</span>
                  <div class="yl-lyric-text">
                    <p>{lyric.line}</p>
                    {lyric.translation && <p class="yl-jp">{lyric.translation}</p>}
                  </div>
                </div>))}
            </div>
          </section>)}

        {/* Story Section */}
        {currentSection() === 'story' && lesson().story && (<section class="yl-section yl-story">
            <h2 class="yl-section-title">📖 Story Time!</h2>
            <h3 class="yl-story-title">{lesson().story.title}</h3>
            
            <div class="yl-story-book">
              <div class="yl-story-page">
                {lesson().story.pages[currentStoryPage()]?.image && (<img src={lesson().story.pages[currentStoryPage()].image} alt="" class="yl-story-image"/>)}
                <div class="yl-story-text">
                  <p>{lesson().story.pages[currentStoryPage()]?.text}</p>
                  {lesson().story.pages[currentStoryPage()]?.translation && (<p class="yl-jp">{lesson().story.pages[currentStoryPage()].translation}</p>)}
                </div>
                {lesson().story.pages[currentStoryPage()]?.audio && (<button class="yl-audio-button" onClick={() => playAudio(lesson().story!.pages[currentStoryPage()].audio!)}>
                    🔊 Listen
                  </button>)}
              </div>
              
              <div class="yl-story-nav">
                <button disabled={currentStoryPage() === 0} onClick={() => setCurrentStoryPage(p => p - 1)}>
                  ← Back
                </button>
                <span>{currentStoryPage() + 1} / {lesson().story.pages.length}</span>
                <button disabled={currentStoryPage() === lesson().story.pages.length - 1} onClick={() => setCurrentStoryPage(p => p + 1)}>
                  Next →
                </button>
              </div>
            </div>
          </section>)}

        {/* Activities Section */}
        {currentSection() === 'activities' && (<section class="yl-section yl-activities">
            <h2 class="yl-section-title">🎮 Fun Activities!</h2>
            
            <div class="yl-activities-list">
              {lesson().activities.map((activity, index) => (<div class="yl-activity-card">
                  <div class="yl-activity-icon">
                    {ACTIVITY_EMOJIS[activity.type] || '🎯'}
                  </div>
                  <div class="yl-activity-info">
                    <h3>{activity.title || `Activity ${index + 1}`}</h3>
                    <p>{activity.instruction}</p>
                    {activity.instructionJp && (<p class="yl-jp">{activity.instructionJp}</p>)}
                  </div>
                </div>))}
            </div>
          </section>)}

        {/* Complete Section */}
        {currentSection() === 'complete' && (<section class="yl-section yl-complete">
            <div class="yl-complete-content">
              <span class="yl-star-burst">⭐</span>
              <h2>Great Job!</h2>
              <p>You finished the lesson!</p>
              <div class="yl-complete-mascot">
                {mascot().emoji}
              </div>
              <button class="yl-home-button" onClick={() => location.route('/materials/young-learners')}>
                Back to Lessons
              </button>
            </div>
          </section>)}
      </main>

      {/* Navigation Footer */}
      <footer class="yl-lesson-footer">
        <button class="yl-nav-btn prev" onClick={goToPrevSection} disabled={currentSectionIndex() === 0}>
          <TutorIcon name="ri-arrow-left-line"/>
          <span>Back</span>
        </button>
        
        <div class="yl-section-dots">
          {availableSections.map((section, index) => (<span class={`yl-dot ${index === currentSectionIndex() ? 'active' : ''} ${index < currentSectionIndex() ? 'completed' : ''}`}/>))}
        </div>
        
        <button class="yl-nav-btn next" onClick={goToNextSection} disabled={currentSectionIndex() === availableSections.length - 1}>
          <span>Next</span>
          <TutorIcon name="ri-arrow-right-line"/>
        </button>
      </footer>
    </div>);
    }) as unknown as JSX.Element;
}

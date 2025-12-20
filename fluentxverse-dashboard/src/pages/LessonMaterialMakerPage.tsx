import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { lessonApi } from '../api/lesson.api';
import './LessonMaterialMakerPage.css';

type HeaderConfig = {
  backgroundImage: string;
  overlayColor: string;
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
};

type VocabularyItem = {
  id: string;
  word: string;
  reading: string;
  english: string;
};

type GrammarPoint = {
  id: string;
  structure: string;
  meaning: string;
  example: string;
  translation: string;
};

type ExerciseItem = {
  id: string;
  type: 'fill-blank' | 'multiple-choice' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string;
};

type LessonGoalStep = {
  id: string;
  instruction: string;
  scriptLine?: string; // Green italic text like "Today, let's talk about services."
};

type SectionContent = {
  id: string;
  sectionNumber: number;
  sectionTitle: string;
  explanationEn: string;
  explanationJp: string;
  sectionImage: string;
  importantNote: string;
  copyTemplate: string;
  lessonGoalTitle: string;
  lessonGoalSteps: LessonGoalStep[];
  questionBox: string;
};

type LessonMaterialDraft = {
  version: 2;
  header: HeaderConfig;
  sections: SectionContent[];
  vocabulary: VocabularyItem[];
  grammar: GrammarPoint[];
  exercises: ExerciseItem[];
};

const STORAGE_KEY = 'fxv_admin_lesson_material_draft_v2';

// Helper to format time ago
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const createBlankDraft = (): LessonMaterialDraft => ({
  version: 2,
  header: {
    backgroundImage: '',
    overlayColor: '#0369a1cc',
    levelBadge: 'STARTER',
    chapterLabel: 'Chapter 1: All About Me',
    lessonLabel: 'Lesson 1: Greetings',
    goalText: 'I can say basic greetings.',
    goalSubtext: '基本的な挨拶ができるようになる。',
  },
  sections: [
    {
      id: 'section-1',
      sectionNumber: 1,
      sectionTitle: 'INTRODUCE',
      explanationEn: 'A list of services has a lot of important information. It shows how much and how long each service is.',
      explanationJp: 'サービスのリストにはたくさんの重要な情報が載っています。サービスの値段や時間などです。',
      sectionImage: '',
      importantNote: 'Effective feedback is specific to the student\'s actual performance.',
      copyTemplate: 'Copy the easy-to-use template on a NOTEPAD. Use this template to take note of the student\'s performance all throughout the lesson.',
      lessonGoalTitle: 'LESSON GOAL (1 minute)',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the lesson topic.', scriptLine: '"Today, let\'s talk about services."' },
        { id: 'step-2', instruction: 'Read the lesson goal and ask if it\'s clear.' },
        { id: 'step-3', instruction: 'Read the Introduce explanation.' },
        { id: 'step-4', instruction: 'Ask the question below.' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Good! Let\'s go to the next part!"' },
      ],
      questionBox: 'Do you get manicures?',
    },
  ],
  vocabulary: [],
  grammar: [],
  exercises: [],
});

export default function LessonMaterialMakerPage() {
  const [draft, setDraft] = useState<LessonMaterialDraft>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createBlankDraft();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 2) return createBlankDraft();
      // Merge with defaults to ensure all fields exist (handles old drafts)
      const blank = createBlankDraft();
      return {
        ...blank,
        ...parsed,
        header: { ...blank.header, ...parsed.header },
        sections: Array.isArray(parsed.sections) ? parsed.sections : blank.sections,
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        grammar: Array.isArray(parsed.grammar) ? parsed.grammar : [],
        exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      };
    } catch {
      return createBlankDraft();
    }
  });

  const [showHeaderControls, setShowHeaderControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLessonUrl, setSavedLessonUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    document.title = 'Lesson Material Maker | FluentXVerse Admin';
  }, []);

  // Toggle fullscreen mode - hide/show dashboard layout
  useEffect(() => {
    const dashboardLayout = document.querySelector('.dashboard-layout');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.dashboard-header');
    
    if (isFullscreen) {
      document.body.classList.add('lm-fullscreen-mode');
      dashboardLayout?.classList.add('lm-fullscreen-active');
      sidebar?.classList.add('lm-hidden');
      header?.classList.add('lm-hidden');
    } else {
      document.body.classList.remove('lm-fullscreen-mode');
      dashboardLayout?.classList.remove('lm-fullscreen-active');
      sidebar?.classList.remove('lm-hidden');
      header?.classList.remove('lm-hidden');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('lm-fullscreen-mode');
      dashboardLayout?.classList.remove('lm-fullscreen-active');
      sidebar?.classList.remove('lm-hidden');
      header?.classList.remove('lm-hidden');
    };
  }, [isFullscreen]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  // Autosave function
  const saveToServer = useCallback(async (draftToSave: LessonMaterialDraft) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await lessonApi.saveLesson(draftToSave);
      if (result.success && result.url) {
        setLastSaved(new Date());
        setSavedLessonUrl(result.url);
      } else {
        setSaveError(result.error || 'Failed to save');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced autosave - triggers 2 seconds after last change
  useEffect(() => {
    // Skip autosave on first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for autosave (2 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(draft);
    }, 2000);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, saveToServer]);

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setDraft(prev => ({
        ...prev,
        header: { ...prev.header, backgroundImage: result }
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`lm-builder ${isFullscreen ? 'lm-builder-fullscreen' : ''}`}>
      {/* Hidden file input for header image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="lm-hidden-input"
        onChange={handleImageUpload}
      />

      {/* Floating Toolbar */}
      <div className="lm-toolbar">
        <div className="lm-toolbar-title">
          <i className="ri-file-edit-line" />
          <span>Lesson Builder</span>
        </div>
        <div className="lm-toolbar-actions">
          {/* Autosave status */}
          <div className="lm-autosave-status">
            {isSaving ? (
              <>
                <i className="ri-loader-4-line spinning" />
                <span>Saving...</span>
              </>
            ) : saveError ? (
              <>
                <i className="ri-error-warning-line error-icon" />
                <span className="error-text">Save failed</span>
              </>
            ) : lastSaved ? (
              <>
                <i className="ri-check-line success-icon" />
                <span>Saved {formatTimeAgo(lastSaved)}</span>
              </>
            ) : (
              <>
                <i className="ri-cloud-line" />
                <span>Not saved yet</span>
              </>
            )}
          </div>

          {/* View saved lesson link */}
          {savedLessonUrl && (
            <a
              href={savedLessonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lm-toolbar-btn"
              title="View Saved Lesson"
            >
              <i className="ri-external-link-line" />
              <span>View</span>
            </a>
          )}

          <button
            className={`lm-toolbar-btn ${isFullscreen ? 'active' : ''}`}
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
          >
            <i className={isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} />
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
          <button
            className="lm-toolbar-btn"
            type="button"
            onClick={() => {
              if (!confirm('Reset to blank template? This will delete the current lesson.')) return;
              localStorage.removeItem(STORAGE_KEY);
              setDraft(createBlankDraft());
              setLastSaved(null);
              setSavedLessonUrl(null);
              setSaveError(null);
            }}
            title="Reset"
          >
            <i className="ri-refresh-line" />
          </button>
          <button
            className="lm-toolbar-btn primary"
            type="button"
            disabled={isSaving}
            onClick={() => saveToServer(draft)}
            title="Save Now"
          >
            <i className={isSaving ? 'ri-loader-4-line spinning' : 'ri-save-line'} />
            <span>Save Now</span>
          </button>
        </div>
      </div>

      {/* The actual lesson page preview/editor */}
      <div className="lm-page">
        {/* HEADER SECTION */}
        <div
          className={`lm-header ${showHeaderControls ? 'editing' : ''}`}
          style={{
            backgroundImage: draft.header.backgroundImage ? `url(${draft.header.backgroundImage})` : 'none',
          }}
        >
          {/* Overlay */}
          <div
            className="lm-header-overlay"
            style={{ backgroundColor: draft.header.overlayColor }}
          />

          {/* Header Controls - Always visible in header */}
          <div className="lm-header-toolbar">
            <button
              type="button"
              className="lm-header-tool-btn"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Upload Header Image"
            >
              <i className="ri-image-add-line" />
            </button>
            <div className="lm-header-color-picker" onClick={(e) => e.stopPropagation()}>
              <input
                type="color"
                value={draft.header.overlayColor.slice(0, 7)}
                title="Overlay Color"
                onInput={(e) => {
                  const hex = (e.target as HTMLInputElement).value;
                  const alpha = draft.header.overlayColor.length === 9
                    ? draft.header.overlayColor.slice(7)
                    : 'cc';
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, overlayColor: hex + alpha }
                  }));
                }}
              />
              <select
                value={draft.header.overlayColor.length === 9 ? draft.header.overlayColor.slice(7) : 'cc'}
                title="Overlay Opacity"
                onChange={(e) => {
                  const alpha = (e.target as HTMLSelectElement).value;
                  const hex = draft.header.overlayColor.slice(0, 7);
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, overlayColor: hex + alpha }
                  }));
                }}
              >
                <option value="ff">100%</option>
                <option value="e6">90%</option>
                <option value="cc">80%</option>
                <option value="b3">70%</option>
                <option value="99">60%</option>
                <option value="80">50%</option>
                <option value="66">40%</option>
                <option value="4d">30%</option>
                <option value="33">20%</option>
              </select>
            </div>
            {draft.header.backgroundImage && (
              <button
                type="button"
                className="lm-header-tool-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, backgroundImage: '' }
                  }));
                }}
                title="Remove Image"
              >
                <i className="ri-delete-bin-line" />
              </button>
            )}
          </div>

          {/* Header content */}
          <div className="lm-header-content">
            <div className="lm-header-top">
              <span
                className="lm-level-badge"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, levelBadge: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.levelBadge}
              </span>
              <span className="lm-header-divider">|</span>
              <span
                className="lm-chapter-label"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, chapterLabel: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.chapterLabel}
              </span>
            </div>

            <div
              className="lm-lesson-label"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDraft(prev => ({
                ...prev,
                header: { ...prev.header, lessonLabel: (e.target as HTMLElement).textContent || '' }
              }))}
            >
              {draft.header.lessonLabel}
            </div>

            <div className="lm-goal-row">
              <span className="lm-goal-badge">GOAL</span>
              <span
                className="lm-goal-text"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, goalText: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.goalText}
              </span>
            </div>

            <div
              className="lm-goal-subtext"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDraft(prev => ({
                ...prev,
                header: { ...prev.header, goalSubtext: (e.target as HTMLElement).textContent || '' }
              }))}
            >
              {draft.header.goalSubtext}
            </div>
          </div>

          {/* Header controls popover */}
          {showHeaderControls && (
            <div
              className="lm-header-controls"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lm-control-row">
                <label>Background</label>
                <div className="lm-control-btns">
                  <input
                    type="file"
                    accept="image/*"
                    className="lm-hidden-input"
                    id="header-bg-upload"
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="header-bg-upload" className="lm-ctrl-btn">
                    <i className="ri-upload-2-line" /> Upload
                  </label>
                  {draft.header.backgroundImage && (
                    <button
                      type="button"
                      className="lm-ctrl-btn danger"
                      onClick={() => setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, backgroundImage: '' }
                      }))}
                    >
                      <i className="ri-delete-bin-6-line" /> Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="lm-control-row">
                <label>Overlay Color</label>
                <div className="lm-color-picker">
                  <input
                    type="color"
                    value={draft.header.overlayColor.slice(0, 7)}
                    onInput={(e) => {
                      const hex = (e.target as HTMLInputElement).value;
                      const alpha = draft.header.overlayColor.length === 9
                        ? draft.header.overlayColor.slice(7)
                        : 'cc';
                      setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, overlayColor: hex + alpha }
                      }));
                    }}
                  />
                  <select
                    value={draft.header.overlayColor.length === 9 ? draft.header.overlayColor.slice(7) : 'cc'}
                    onChange={(e) => {
                      const alpha = (e.target as HTMLSelectElement).value;
                      const hex = draft.header.overlayColor.slice(0, 7);
                      setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, overlayColor: hex + alpha }
                      }));
                    }}
                  >
                    <option value="ff">100%</option>
                    <option value="e6">90%</option>
                    <option value="cc">80%</option>
                    <option value="b3">70%</option>
                    <option value="99">60%</option>
                    <option value="80">50%</option>
                    <option value="66">40%</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="lm-ctrl-btn close-btn"
                onClick={() => setShowHeaderControls(false)}
              >
                Done
              </button>
            </div>
          )}

          {/* Edit hint */}
          {draft.header.backgroundImage && !showHeaderControls && (
            <div className="lm-edit-hint">
              <i className="ri-edit-2-line" /> Click to edit header
            </div>
          )}
        </div>

        {/* Page body - sections */}
        <div className="lm-body">
          {draft.sections.map((section, sectionIndex) => (
            <div key={section.id} className="lm-section">
              {/* Two-column layout */}
              <div className="lm-section-layout">
                {/* Left Column - Main Content (60%) */}
                <div className="lm-section-main">
                  {/* Section Title */}
                  <div className="lm-section-title-row">
                    <span className="lm-section-number">{section.sectionNumber}</span>
                    <span
                      className="lm-section-title"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const newSections = [...draft.sections];
                        newSections[sectionIndex] = {
                          ...section,
                          sectionTitle: (e.target as HTMLElement).textContent || ''
                        };
                        setDraft(prev => ({ ...prev, sections: newSections }));
                      }}
                    >
                      {section.sectionTitle}
                    </span>
                  </div>

                  {/* Explanation - English */}
                  <p
                    className="lm-section-explanation"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newSections = [...draft.sections];
                      newSections[sectionIndex] = {
                        ...section,
                        explanationEn: (e.target as HTMLElement).textContent || ''
                      };
                      setDraft(prev => ({ ...prev, sections: newSections }));
                    }}
                  >
                    {section.explanationEn}
                  </p>

                  {/* Explanation - Japanese */}
                  <p
                    className="lm-section-explanation-jp"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newSections = [...draft.sections];
                      newSections[sectionIndex] = {
                        ...section,
                        explanationJp: (e.target as HTMLElement).textContent || ''
                      };
                      setDraft(prev => ({ ...prev, sections: newSections }));
                    }}
                  >
                    {section.explanationJp}
                  </p>

                  {/* Section Image */}
                  <div className="lm-section-image-container">
                    {section.sectionImage ? (
                      <div className="lm-section-image-wrapper">
                        <img src={section.sectionImage} alt="Section visual" className="lm-section-image" />
                        <button
                          type="button"
                          className="lm-section-image-remove"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = { ...section, sectionImage: '' };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    ) : (
                      <label className="lm-section-image-upload">
                        <input
                          type="file"
                          accept="image/*"
                          className="lm-hidden-input"
                          onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const result = ev.target?.result as string;
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = { ...section, sectionImage: result };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <i className="ri-image-add-line" />
                        <span>Click to add section image</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Right Column - Sidebar (40%) */}
                <div className="lm-section-sidebar">
                  {/* Important Note Box */}
                  <div className="lm-important-box">
                    <div className="lm-important-header">
                      <span className="lm-important-label">IMPORTANT:</span>
                      <span
                        className="lm-important-text"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            importantNote: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.importantNote}
                      </span>
                    </div>
                    <p
                      className="lm-important-description"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const newSections = [...draft.sections];
                        newSections[sectionIndex] = {
                          ...section,
                          copyTemplate: (e.target as HTMLElement).textContent || ''
                        };
                        setDraft(prev => ({ ...prev, sections: newSections }));
                      }}
                    >
                      {section.copyTemplate}
                    </p>
                    <button type="button" className="lm-copy-btn">
                      Click to Copy
                    </button>
                  </div>

                  {/* Lesson Goal Box */}
                  <div className="lm-goal-box">
                    <div
                      className="lm-goal-box-header"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const newSections = [...draft.sections];
                        newSections[sectionIndex] = {
                          ...section,
                          lessonGoalTitle: (e.target as HTMLElement).textContent || ''
                        };
                        setDraft(prev => ({ ...prev, sections: newSections }));
                      }}
                    >
                      {section.lessonGoalTitle}
                    </div>
                    <div className="lm-goal-steps">
                      {section.lessonGoalSteps.map((step, stepIndex) => (
                        <div key={step.id} className="lm-goal-step">
                          <span className="lm-step-number">{stepIndex + 1}</span>
                          <div className="lm-step-content">
                            <span
                              className="lm-step-instruction"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newSteps = [...section.lessonGoalSteps];
                                newSteps[stepIndex] = {
                                  ...step,
                                  instruction: (e.target as HTMLElement).textContent || ''
                                };
                                newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {step.instruction}
                            </span>
                            {step.scriptLine && (
                              <div className="lm-step-script">
                                <span className="lm-script-bullet">●</span>
                                <span
                                  className="lm-script-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      scriptLine: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.scriptLine}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Question Box */}
                    <div className="lm-question-box">
                      <div className="lm-question-bullet" />
                      <span
                        className="lm-question-text"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            questionBox: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.questionBox}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Click outside to close header controls */}
      {showHeaderControls && (
        <div
          className="lm-backdrop"
          onClick={() => setShowHeaderControls(false)}
        />
      )}
    </div>
  );
}

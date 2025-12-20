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

type LessonMaterialDraft = {
  version: 2;
  header: HeaderConfig;
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

        {/* Page body - placeholder for future sections */}
        <div className="lm-body">
          {/* VOCABULARY SECTION */}
          <section className="lm-section">
            <div className="lm-section-header">
              <h2>
                <i className="ri-book-2-line" />
                Vocabulary
              </h2>
              <button
                type="button"
                className="lm-add-btn"
                onClick={() => {
                  const newItem: VocabularyItem = {
                    id: `vocab_${Date.now()}`,
                    word: '新しい単語',
                    reading: 'あたらしいたんご',
                    english: 'new word',
                  };
                  setDraft(prev => ({
                    ...prev,
                    vocabulary: [...prev.vocabulary, newItem],
                  }));
                }}
              >
                <i className="ri-add-line" />
                Add Word
              </button>
            </div>

            <div className="lm-vocab-list">
              {draft.vocabulary.length === 0 && (
                <div className="lm-empty-state">
                  <i className="ri-inbox-line" />
                  <span>No vocabulary items yet. Click "Add Word" to start.</span>
                </div>
              )}
              {draft.vocabulary.map((item, idx) => (
                <div key={item.id} className="lm-vocab-card">
                  <div className="lm-vocab-row">
                    <input
                      type="text"
                      className="lm-input lm-vocab-word"
                      value={item.word}
                      placeholder="Japanese word"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.vocabulary];
                          updated[idx] = { ...updated[idx], word: val };
                          return { ...prev, vocabulary: updated };
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="lm-input lm-vocab-reading"
                      value={item.reading}
                      placeholder="ひらがな"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.vocabulary];
                          updated[idx] = { ...updated[idx], reading: val };
                          return { ...prev, vocabulary: updated };
                        });
                      }}
                    />
                  </div>
                  <div className="lm-vocab-row">
                    <input
                      type="text"
                      className="lm-input lm-vocab-english"
                      value={item.english}
                      placeholder="English meaning"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.vocabulary];
                          updated[idx] = { ...updated[idx], english: val };
                          return { ...prev, vocabulary: updated };
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="lm-delete-btn"
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          vocabulary: prev.vocabulary.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* GRAMMAR SECTION */}
          <section className="lm-section">
            <div className="lm-section-header">
              <h2>
                <i className="ri-function-line" />
                Grammar Points
              </h2>
              <button
                type="button"
                className="lm-add-btn"
                onClick={() => {
                  const newItem: GrammarPoint = {
                    id: `grammar_${Date.now()}`,
                    structure: '〜です',
                    meaning: 'It is ~',
                    example: '私は学生です。',
                    translation: 'I am a student.',
                  };
                  setDraft(prev => ({
                    ...prev,
                    grammar: [...prev.grammar, newItem],
                  }));
                }}
              >
                <i className="ri-add-line" />
                Add Grammar
              </button>
            </div>

            <div className="lm-grammar-list">
              {draft.grammar.length === 0 && (
                <div className="lm-empty-state">
                  <i className="ri-inbox-line" />
                  <span>No grammar points yet. Click "Add Grammar" to start.</span>
                </div>
              )}
              {draft.grammar.map((item, idx) => (
                <div key={item.id} className="lm-grammar-card">
                  <div className="lm-grammar-header">
                    <input
                      type="text"
                      className="lm-input lm-grammar-structure"
                      value={item.structure}
                      placeholder="Grammar structure"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.grammar];
                          updated[idx] = { ...updated[idx], structure: val };
                          return { ...prev, grammar: updated };
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="lm-input lm-grammar-meaning"
                      value={item.meaning}
                      placeholder="English meaning"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.grammar];
                          updated[idx] = { ...updated[idx], meaning: val };
                          return { ...prev, grammar: updated };
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="lm-delete-btn"
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          grammar: prev.grammar.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                  <div className="lm-grammar-example">
                    <textarea
                      className="lm-textarea lm-example-jp"
                      value={item.example}
                      placeholder="Example sentence in Japanese"
                      rows={2}
                      onInput={(e) => {
                        const val = (e.target as HTMLTextAreaElement).value;
                        setDraft(prev => {
                          const updated = [...prev.grammar];
                          updated[idx] = { ...updated[idx], example: val };
                          return { ...prev, grammar: updated };
                        });
                      }}
                    />
                    <textarea
                      className="lm-textarea lm-example-en"
                      value={item.translation}
                      placeholder="English translation"
                      rows={2}
                      onInput={(e) => {
                        const val = (e.target as HTMLTextAreaElement).value;
                        setDraft(prev => {
                          const updated = [...prev.grammar];
                          updated[idx] = { ...updated[idx], translation: val };
                          return { ...prev, grammar: updated };
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* EXERCISES SECTION */}
          <section className="lm-section">
            <div className="lm-section-header">
              <h2>
                <i className="ri-questionnaire-line" />
                Exercises
              </h2>
              <div className="lm-add-group">
                <button
                  type="button"
                  className="lm-add-btn"
                  onClick={() => {
                    const newItem: ExerciseItem = {
                      id: `ex_${Date.now()}`,
                      type: 'fill-blank',
                      question: '___は学生です。',
                      correctAnswer: '私',
                    };
                    setDraft(prev => ({
                      ...prev,
                      exercises: [...prev.exercises, newItem],
                    }));
                  }}
                >
                  <i className="ri-add-line" />
                  Fill-in-the-Blank
                </button>
                <button
                  type="button"
                  className="lm-add-btn"
                  onClick={() => {
                    const newItem: ExerciseItem = {
                      id: `ex_${Date.now()}`,
                      type: 'multiple-choice',
                      question: 'What does こんにちは mean?',
                      options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'],
                      correctAnswer: 'Hello',
                    };
                    setDraft(prev => ({
                      ...prev,
                      exercises: [...prev.exercises, newItem],
                    }));
                  }}
                >
                  <i className="ri-add-line" />
                  Multiple Choice
                </button>
              </div>
            </div>

            <div className="lm-exercises-list">
              {draft.exercises.length === 0 && (
                <div className="lm-empty-state">
                  <i className="ri-inbox-line" />
                  <span>No exercises yet. Click buttons above to add exercises.</span>
                </div>
              )}
              {draft.exercises.map((item, idx) => (
                <div key={item.id} className="lm-exercise-card">
                  <div className="lm-exercise-header">
                    <span className="lm-exercise-type">
                      {item.type === 'fill-blank' && <><i className="ri-text-spacing" /> Fill-in-the-Blank</>}
                      {item.type === 'multiple-choice' && <><i className="ri-list-check" /> Multiple Choice</>}
                    </span>
                    <button
                      type="button"
                      className="lm-delete-btn"
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          exercises: prev.exercises.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>

                  <textarea
                    className="lm-textarea lm-exercise-question"
                    value={item.question}
                    placeholder="Exercise question"
                    rows={2}
                    onInput={(e) => {
                      const val = (e.target as HTMLTextAreaElement).value;
                      setDraft(prev => {
                        const updated = [...prev.exercises];
                        updated[idx] = { ...updated[idx], question: val };
                        return { ...prev, exercises: updated };
                      });
                    }}
                  />

                  {item.type === 'multiple-choice' && (
                    <div className="lm-mc-options">
                      <label className="lm-label">Options (one per line)</label>
                      <textarea
                        className="lm-textarea"
                        value={(item.options || []).join('\n')}
                        placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"
                        rows={4}
                        onInput={(e) => {
                          const val = (e.target as HTMLTextAreaElement).value;
                          const options = val.split('\n').filter(opt => opt.trim());
                          setDraft(prev => {
                            const updated = [...prev.exercises];
                            updated[idx] = { ...updated[idx], options };
                            return { ...prev, exercises: updated };
                          });
                        }}
                      />
                    </div>
                  )}

                  <div className="lm-exercise-answer">
                    <label className="lm-label">Correct Answer</label>
                    <input
                      type="text"
                      className="lm-input"
                      value={item.correctAnswer}
                      placeholder="Answer"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setDraft(prev => {
                          const updated = [...prev.exercises];
                          updated[idx] = { ...updated[idx], correctAnswer: val };
                          return { ...prev, exercises: updated };
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
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

/**
 * ConversationalSkillsEditorPage
 * No-code editor for creating Conversational Skills lesson materials
 * Hierarchical view: 10 Levels → 10 Chapters → 10 Lessons per chapter
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  createLesson,
  getLessonById,
  listLessonsByCourse,
  getExistingChapterName,
  checkDuplicate,
  updateLessonHeader,
  deleteLesson,
  duplicateLesson,
  type LessonMaterial,
  type Skill,
  type CreateLessonInput,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import './ConversationalSkillsEditorPage.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_ID = 'conversational-skills';
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const CHAPTERS = Array.from({ length: 5 }, (_, i) => i + 1);
const LESSONS = Array.from({ length: 10 }, (_, i) => i + 1);
const SKILLS: { value: Skill; label: string }[] = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'listening', label: 'Listening' },
  { value: 'reading', label: 'Reading' },
];

const LEVEL_BADGES: Record<number, string> = {
  1: 'STARTER', 2: 'STARTER',
  3: 'BEGINNER', 4: 'BEGINNER',
  5: 'ELEMENTARY', 6: 'ELEMENTARY',
  7: 'INTERMEDIATE', 8: 'INTERMEDIATE',
  9: 'ADVANCED', 10: 'ADVANCED',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#10b981', 2: '#10b981',  // Green - Starter
  3: '#3b82f6', 4: '#3b82f6',  // Blue - Beginner
  5: '#8b5cf6', 6: '#8b5cf6',  // Purple - Elementary
  7: '#f59e0b', 8: '#f59e0b',  // Amber - Intermediate
  9: '#ef4444', 10: '#ef4444', // Red - Advanced
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConversationalSkillsEditorPage() {
  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonMaterial | null>(null);

  // Load lessons on mount
  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const data = await listLessonsByCourse(COURSE_ID);
      setLessons(data);
    } catch (error) {
      console.error('Failed to load lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  // Group lessons by level and chapter
  const lessonsByLevelChapter = useMemo(() => {
    const map: Record<string, LessonMaterial[]> = {};
    lessons.forEach(lesson => {
      const key = `${lesson.level}-${lesson.chapter}`;
      if (!map[key]) map[key] = [];
      map[key].push(lesson);
    });
    // Sort lessons within each chapter
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.lessonNumber - b.lessonNumber);
    });
    return map;
  }, [lessons]);

  // Get chapter name from first lesson in that chapter
  const getChapterName = (level: number, chapter: number): string => {
    const key = `${level}-${chapter}`;
    const chapterLessons = lessonsByLevelChapter[key];
    if (chapterLessons && chapterLessons.length > 0) {
      // Extract chapter name from chapterLabel (e.g., "Chapter 1: All About Me")
      const match = chapterLessons[0].chapterLabel.match(/Chapter \d+:\s*(.*)/);
      return match ? match[1] : '';
    }
    return '';
  };

  // Count lessons in a level
  const getLevelLessonCount = (level: number): number => {
    return lessons.filter(l => l.level === level).length;
  };

  // Count lessons in a chapter
  const getChapterLessonCount = (level: number, chapter: number): number => {
    const key = `${level}-${chapter}`;
    return lessonsByLevelChapter[key]?.length || 0;
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const toggleChapter = (level: number, chapter: number) => {
    const key = `${level}-${chapter}`;
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreateLesson = async (input: CreateLessonInput) => {
    try {
      const lesson = await createLesson(input);
      setLessons([...lessons, lesson]);
      setShowCreateModal(false);
      // Expand to show the newly created lesson
      setExpandedLevels(prev => new Set([...prev, lesson.level]));
      setExpandedChapters(prev => new Set([...prev, `${lesson.level}-${lesson.chapter}`]));
      toast.success('Lesson created successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create lesson');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await deleteLesson(id);
      setLessons(lessons.filter(l => l.id !== id));
      toast.success('Lesson deleted');
    } catch (error) {
      toast.error('Failed to delete lesson');
    }
  };

  const handleDuplicateLesson = async (lesson: LessonMaterial) => {
    try {
      const duplicated = await duplicateLesson(lesson.id);
      setLessons([...lessons, duplicated]);
      // Expand to show the duplicated lesson
      setExpandedLevels(prev => new Set([...prev, duplicated.level]));
      setExpandedChapters(prev => new Set([...prev, `${duplicated.level}-${duplicated.chapter}`]));
      toast.success('Lesson duplicated!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to duplicate lesson');
    }
  };

  const handleEditLesson = (lesson: LessonMaterial) => {
    window.open(`/conversational-skills-visual-editor/${lesson.id}`, '_blank');
  };

  const handlePreviewLesson = (lesson: LessonMaterial) => {
    window.open(`/conversational-skills-preview/${lesson.id}`, '_blank');
  };

  const handleSelectLesson = (lesson: LessonMaterial) => {
    setSelectedLesson(prev => prev?.id === lesson.id ? null : lesson);
  };

  // Computed stats for analytics
  const courseStats = useMemo(() => {
    const totalLessons = lessons.length;
    const speakingCount = lessons.filter(l => l.skill === 'speaking').length;
    const listeningCount = lessons.filter(l => l.skill === 'listening').length;
    const readingCount = lessons.filter(l => l.skill === 'reading').length;
    const completedLevels = LEVELS.filter(level => 
      getLevelLessonCount(level) >= 50 // 5 chapters × 10 lessons
    ).length;
    
    return {
      totalLessons,
      speakingCount,
      listeningCount,
      readingCount,
      completedLevels,
      totalCapacity: 500, // 10 levels × 5 chapters × 10 lessons
      progressPercent: Math.round((totalLessons / 500) * 100),
    };
  }, [lessons]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="cse-page">
      {/* Header */}
      <div className="cse-header">
        <div className="cse-header-content">
          <div className="cse-title-row">
            <div className="cse-title-icon">
              <i className="ri-chat-smile-3-line" />
            </div>
            <div>
              <h1>Conversational Skills</h1>
              <p>{lessons.length} lessons across 10 levels</p>
            </div>
          </div>
          <button className="cse-create-btn" onClick={() => setShowCreateModal(true)}>
            <i className="ri-add-line" />
            Create Lesson
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="cse-main-layout">
        {/* Left: Accordion Container */}
        <div className="cse-accordion-container">
          <div className="cse-accordion">
            {loading ? (
              <div className="cse-loading">
                <i className="ri-loader-4-line" />
                Loading lessons...
              </div>
            ) : (
              LEVELS.map(level => (
                <div className="cse-level" key={level}>
                  {/* Level Header */}
                  <button 
                    className={`cse-level-header ${expandedLevels.has(level) ? 'expanded' : ''}`}
                    onClick={() => toggleLevel(level)}
                    style={{ '--level-color': LEVEL_COLORS[level] } as any}
                  >
                    <div className="cse-level-info">
                      <i className={`ri-arrow-${expandedLevels.has(level) ? 'down' : 'right'}-s-line`} />
                      <span className="cse-level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                        {LEVEL_BADGES[level]}
                      </span>
                      <span className="cse-level-name">Level {level}</span>
                    </div>
                    <span className="cse-level-count">
                      {getLevelLessonCount(level)} lesson{getLevelLessonCount(level) !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Chapters */}
                  {expandedLevels.has(level) && (
                    <div className="cse-chapters">
                      {CHAPTERS.map(chapter => {
                        const chapterKey = `${level}-${chapter}`;
                        const chapterName = getChapterName(level, chapter);
                        const chapterLessons = lessonsByLevelChapter[chapterKey] || [];
                        const hasLessons = chapterLessons.length > 0;

                        return (
                          <div className="cse-chapter" key={chapterKey}>
                            {/* Chapter Header */}
                            <button 
                              className={`cse-chapter-header ${expandedChapters.has(chapterKey) ? 'expanded' : ''} ${!hasLessons ? 'empty' : ''}`}
                              onClick={() => toggleChapter(level, chapter)}
                            >
                              <div className="cse-chapter-info">
                                <i className={`ri-arrow-${expandedChapters.has(chapterKey) ? 'down' : 'right'}-s-line`} />
                                <span className="cse-chapter-number">Chapter {chapter}</span>
                                {chapterName && (
                                  <span className="cse-chapter-name">{chapterName}</span>
                                )}
                              </div>
                              <span className="cse-chapter-count">
                                {getChapterLessonCount(level, chapter)}/10
                              </span>
                            </button>

                            {/* Lessons */}
                            {expandedChapters.has(chapterKey) && (
                              <div className="cse-lessons-list">
                                {chapterLessons.length > 0 ? (
                                  chapterLessons.map(lesson => (
                                    <div 
                                      className={`cse-lesson-row ${selectedLesson?.id === lesson.id ? 'selected' : ''}`} 
                                      key={lesson.id}
                                      onClick={() => handleSelectLesson(lesson)}
                                    >
                                      <div className="cse-lesson-main">
                                        <span className={`cse-skill-dot cse-skill-${lesson.skill}`} />
                                        <span className="cse-lesson-number">L{lesson.lessonNumber}</span>
                                        <span className="cse-lesson-title">{lesson.lessonTitle}</span>
                                      </div>
                                      <div className="cse-lesson-actions">
                                        <button 
                                          className="cse-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handleEditLesson(lesson); }}
                                          title="Edit"
                                        >
                                          <i className="ri-edit-line" />
                                        </button>
                                        <button 
                                          className="cse-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handlePreviewLesson(lesson); }}
                                          title="Preview"
                                        >
                                          <i className="ri-eye-line" />
                                        </button>
                                        <button 
                                          className="cse-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handleDuplicateLesson(lesson); }}
                                          title="Duplicate"
                                        >
                                          <i className="ri-file-copy-line" />
                                        </button>
                                        <button 
                                          className="cse-action-btn cse-action-delete"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}
                                          title="Delete"
                                        >
                                          <i className="ri-delete-bin-line" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="cse-empty-chapter">
                                    <span>No lessons yet</span>
                                    <button 
                                      className="cse-add-lesson-btn"
                                      onClick={() => setShowCreateModal(true)}
                                    >
                                      <i className="ri-add-line" />
                                      Add Lesson
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Analytics Panel */}
        <div className="cse-analytics-panel">
          {selectedLesson ? (
            // Lesson-specific analytics
            <LessonAnalytics lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
          ) : (
            // Course-wide analytics
            <CourseAnalytics stats={courseStats} lessons={lessons} />
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateLessonModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLesson}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE LESSON MODAL
// ============================================================================

function CreateLessonModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateLessonInput) => void;
}) {
  const [form, setForm] = useState({
    level: 1,
    chapter: 1,
    lessonNumber: 1,
    skill: 'speaking' as Skill,
    chapterName: '',
    lessonName: '',
    goalTextEn: '',
    goalTextJp: '',
  });
  const [loading, setLoading] = useState(false);
  const [chapterNameLocked, setChapterNameLocked] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Check for existing chapter name when level/chapter changes
  useEffect(() => {
    const checkChapter = async () => {
      try {
        const existingName = await getExistingChapterName(COURSE_ID, form.level, form.chapter);
        if (existingName) {
          setForm(f => ({ ...f, chapterName: existingName }));
          setChapterNameLocked(true);
        } else {
          setChapterNameLocked(false);
        }
      } catch (error) {
        console.error('Failed to check chapter name:', error);
      }
    };
    checkChapter();
  }, [form.level, form.chapter]);

  // Check for duplicate when selection changes
  useEffect(() => {
    const checkDup = async () => {
      try {
        const exists = await checkDuplicate(
          COURSE_ID,
          form.level,
          form.chapter,
          form.lessonNumber,
          form.skill
        );
        if (exists) {
          setDuplicateWarning(
            `Level ${form.level}, Chapter ${form.chapter}, Lesson ${form.lessonNumber} (${form.skill}) already exists`
          );
        } else {
          setDuplicateWarning('');
        }
      } catch (error) {
        console.error('Failed to check duplicate:', error);
      }
    };
    checkDup();
  }, [form.level, form.chapter, form.lessonNumber, form.skill]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (duplicateWarning) {
      toast.error('This lesson combination already exists');
      return;
    }
    if (!form.chapterName || !form.lessonName || !form.goalTextEn || !form.goalTextJp) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        course: COURSE_ID,
        ...form,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal" onClick={e => e.stopPropagation()}>
        <div className="cse-modal-header">
          <h2>Create New Lesson</h2>
          <button className="cse-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cse-modal-body">
            {/* Dropdowns Row */}
            <div className="cse-form-row cse-form-row-4">
              <div className="cse-form-field">
                <label>Level</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {LEVELS.map(l => (
                    <option key={l} value={l}>Level {l} ({LEVEL_BADGES[l]})</option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Chapter</label>
                <select
                  value={form.chapter}
                  onChange={e => setForm({ ...form, chapter: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {CHAPTERS.map(c => (
                    <option key={c} value={c}>Chapter {c}</option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Lesson</label>
                <select
                  value={form.lessonNumber}
                  onChange={e => setForm({ ...form, lessonNumber: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {LESSONS.map(l => (
                    <option key={l} value={l}>Lesson {l}</option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Skill</label>
                <select
                  value={form.skill}
                  onChange={e => setForm({ ...form, skill: (e.target as HTMLSelectElement).value as Skill })}
                >
                  {SKILLS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="cse-warning">
                <i className="ri-error-warning-line" />
                {duplicateWarning}
              </div>
            )}

            {/* Chapter Name */}
            <div className="cse-form-field">
              <label>
                Chapter Name
                {chapterNameLocked && <span className="cse-locked-label">(auto-filled from existing)</span>}
              </label>
              <input
                type="text"
                value={form.chapterName}
                onChange={e => setForm({ ...form, chapterName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., All About Me"
                disabled={chapterNameLocked}
              />
            </div>

            {/* Lesson Name */}
            <div className="cse-form-field">
              <label>Lesson Name</label>
              <input
                type="text"
                value={form.lessonName}
                onChange={e => setForm({ ...form, lessonName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., Greetings"
              />
            </div>

            {/* Preview */}
            <div className="cse-preview-labels">
              <p><strong>Chapter Label:</strong> Chapter {form.chapter}: {form.chapterName || '...'}</p>
              <p><strong>Lesson Title:</strong> Lesson {form.lessonNumber}: {form.lessonName || '...'}</p>
            </div>

            {/* Goal Text */}
            <div className="cse-form-field">
              <label>Lesson Goal (English)</label>
              <input
                type="text"
                value={form.goalTextEn}
                onChange={e => setForm({ ...form, goalTextEn: (e.target as HTMLInputElement).value })}
                placeholder="e.g., I can say basic greetings."
              />
            </div>
            <div className="cse-form-field">
              <label>Lesson Goal (Japanese)</label>
              <input
                type="text"
                value={form.goalTextJp}
                onChange={e => setForm({ ...form, goalTextJp: (e.target as HTMLInputElement).value })}
                placeholder="e.g., 基本的な挨拶ができるようになる。"
              />
            </div>
          </div>

          <div className="cse-modal-footer">
            <button type="button" className="cse-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="cse-btn-primary" 
              disabled={loading || !!duplicateWarning}
            >
              {loading ? 'Creating...' : 'Create Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// COURSE ANALYTICS (Default View)
// ============================================================================

function CourseAnalytics({ 
  stats, 
  lessons 
}: { 
  stats: {
    totalLessons: number;
    speakingCount: number;
    listeningCount: number;
    readingCount: number;
    completedLevels: number;
    totalCapacity: number;
    progressPercent: number;
  };
  lessons: LessonMaterial[];
}) {
  return (
    <div className="cse-analytics">
      <div className="cse-analytics-header">
        <i className="ri-bar-chart-box-line" />
        <h3>Course Overview</h3>
      </div>

      {/* Progress Circle */}
      <div className="cse-progress-section">
        <div className="cse-progress-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="cse-progress-bg" />
            <circle 
              cx="50" cy="50" r="42" 
              className="cse-progress-fill"
              style={{ 
                strokeDasharray: `${stats.progressPercent * 2.64} 264` 
              }}
            />
          </svg>
          <div className="cse-progress-text">
            <span className="cse-progress-value">{stats.progressPercent}%</span>
            <span className="cse-progress-label">Complete</span>
          </div>
        </div>
        <p className="cse-progress-detail">
          {stats.totalLessons} of {stats.totalCapacity} lessons created
        </p>
      </div>

      {/* Skill Distribution */}
      <div className="cse-stats-section">
        <h4>Skill Distribution</h4>
        <div className="cse-skill-bars">
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-speaking" />
                Speaking
              </span>
              <span className="cse-skill-bar-value">{stats.speakingCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill speaking" 
                style={{ width: `${stats.totalLessons ? (stats.speakingCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-listening" />
                Listening
              </span>
              <span className="cse-skill-bar-value">{stats.listeningCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill listening" 
                style={{ width: `${stats.totalLessons ? (stats.listeningCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-reading" />
                Reading
              </span>
              <span className="cse-skill-bar-value">{stats.readingCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill reading" 
                style={{ width: `${stats.totalLessons ? (stats.readingCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="cse-stats-section">
        <h4>Quick Stats</h4>
        <div className="cse-quick-stats">
          <div className="cse-quick-stat">
            <i className="ri-stack-line" />
            <div>
              <span className="cse-quick-stat-value">10</span>
              <span className="cse-quick-stat-label">Levels</span>
            </div>
          </div>
          <div className="cse-quick-stat">
            <i className="ri-book-2-line" />
            <div>
              <span className="cse-quick-stat-value">50</span>
              <span className="cse-quick-stat-label">Chapters</span>
            </div>
          </div>
          <div className="cse-quick-stat">
            <i className="ri-file-list-3-line" />
            <div>
              <span className="cse-quick-stat-value">{stats.totalLessons}</span>
              <span className="cse-quick-stat-label">Lessons</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="cse-stats-section">
        <h4>Recently Updated</h4>
        <div className="cse-recent-list">
          {lessons.slice(0, 5).map(lesson => (
            <div className="cse-recent-item" key={lesson.id}>
              <span className={`cse-skill-dot cse-skill-${lesson.skill}`} />
              <span className="cse-recent-title">{lesson.lessonTitle}</span>
              <span className="cse-recent-date">
                {new Date(lesson.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {lessons.length === 0 && (
            <p className="cse-empty-recent">No lessons yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LESSON ANALYTICS (Selected Lesson View)
// ============================================================================

function LessonAnalytics({ 
  lesson, 
  onClose 
}: { 
  lesson: LessonMaterial; 
  onClose: () => void;
}) {
  const skillColors: Record<Skill, string> = {
    speaking: '#3b82f6',
    listening: '#8b5cf6',
    reading: '#10b981',
  };

  return (
    <div className="cse-analytics">
      <div className="cse-analytics-header">
        <i className="ri-line-chart-line" />
        <h3>Lesson Analytics</h3>
        <button className="cse-analytics-close" onClick={onClose}>
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Lesson Info Card */}
      <div className="cse-lesson-info-card">
        <div className="cse-lesson-info-badge" style={{ backgroundColor: skillColors[lesson.skill] }}>
          {lesson.skill}
        </div>
        <h4>{lesson.lessonTitle}</h4>
        <p className="cse-lesson-info-chapter">{lesson.chapterLabel}</p>
        <div className="cse-lesson-info-meta">
          <span className="cse-lesson-info-level">{lesson.levelBadge}</span>
          <span>Level {lesson.level}</span>
        </div>
      </div>

      {/* Mock Stats - Engagement */}
      <div className="cse-stats-section">
        <h4>Student Engagement</h4>
        <div className="cse-engagement-stats">
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">1,247</span>
            <span className="cse-engagement-label">Total Views</span>
          </div>
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">892</span>
            <span className="cse-engagement-label">Completions</span>
          </div>
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">71%</span>
            <span className="cse-engagement-label">Completion Rate</span>
          </div>
        </div>
      </div>

      {/* Mock Stats - Performance */}
      <div className="cse-stats-section">
        <h4>Average Performance</h4>
        <div className="cse-performance-bars">
          <div className="cse-performance-item">
            <span className="cse-performance-label">Accuracy</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '78%' }} />
            </div>
            <span className="cse-performance-value">78%</span>
          </div>
          <div className="cse-performance-item">
            <span className="cse-performance-label">Fluency</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '65%' }} />
            </div>
            <span className="cse-performance-value">65%</span>
          </div>
          <div className="cse-performance-item">
            <span className="cse-performance-label">Pronunciation</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '82%' }} />
            </div>
            <span className="cse-performance-value">82%</span>
          </div>
        </div>
      </div>

      {/* Time Stats */}
      <div className="cse-stats-section">
        <h4>Time Metrics</h4>
        <div className="cse-time-stats">
          <div className="cse-time-stat">
            <i className="ri-time-line" />
            <div>
              <span className="cse-time-value">12:34</span>
              <span className="cse-time-label">Avg. Duration</span>
            </div>
          </div>
          <div className="cse-time-stat">
            <i className="ri-calendar-line" />
            <div>
              <span className="cse-time-value">{new Date(lesson.createdAt).toLocaleDateString()}</span>
              <span className="cse-time-label">Created</span>
            </div>
          </div>
          <div className="cse-time-stat">
            <i className="ri-refresh-line" />
            <div>
              <span className="cse-time-value">{new Date(lesson.updatedAt).toLocaleDateString()}</span>
              <span className="cse-time-label">Last Updated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Status */}
      <div className="cse-stats-section">
        <h4>Content Status</h4>
        <div className="cse-content-status">
          <div className={`cse-status-item ${lesson.introductionData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.introductionData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Introduction</span>
          </div>
          <div className={`cse-status-item ${lesson.learnData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.learnData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Learn Section</span>
          </div>
          <div className={`cse-status-item ${lesson.stepBData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.stepBData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Step B</span>
          </div>
          <div className={`cse-status-item ${lesson.applyData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.applyData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Apply Section</span>
          </div>
          <div className={`cse-status-item ${lesson.exerciseData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.exerciseData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Exercise/Mission</span>
          </div>
        </div>
      </div>
    </div>
  );
}

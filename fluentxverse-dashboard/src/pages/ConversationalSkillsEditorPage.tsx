/**
 * ConversationalSkillsEditorPage
 * No-code editor for creating Conversational Skills lesson materials
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  createLesson,
  getLessonById,
  listLessonsByCourse,
  getExistingChapterName,
  checkDuplicate,
  updateLessonHeader,
  deleteLesson,
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConversationalSkillsEditorPage() {
  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonMaterial | null>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');

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

  const handleCreateLesson = async (input: CreateLessonInput) => {
    try {
      const lesson = await createLesson(input);
      setLessons([...lessons, lesson]);
      setShowCreateModal(false);
      setSelectedLesson(lesson);
      setView('editor');
      toast.success('Lesson created successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create lesson');
    }
  };

  const handleSelectLesson = (lesson: LessonMaterial) => {
    setSelectedLesson(lesson);
    setView('editor');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedLesson(null);
    loadLessons(); // Refresh list
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await deleteLesson(id);
      setLessons(lessons.filter(l => l.id !== id));
      if (selectedLesson?.id === id) {
        setView('list');
        setSelectedLesson(null);
      }
      toast.success('Lesson deleted');
    } catch (error) {
      toast.error('Failed to delete lesson');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (view === 'editor' && selectedLesson) {
    return (
      <HeaderEditor
        lesson={selectedLesson}
        onBack={handleBackToList}
        onUpdate={(updated) => {
          setSelectedLesson(updated);
          setLessons(lessons.map(l => l.id === updated.id ? updated : l));
        }}
      />
    );
  }

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
              <p>Create and manage lesson materials</p>
            </div>
          </div>
          <button className="cse-create-btn" onClick={() => setShowCreateModal(true)}>
            <i className="ri-add-line" />
            Create Lesson
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="cse-stats">
        <div className="cse-stat">
          <span className="cse-stat-value">{lessons.length}</span>
          <span className="cse-stat-label">Total Lessons</span>
        </div>
        <div className="cse-stat">
          <span className="cse-stat-value">{lessons.filter(l => l.skill === 'speaking').length}</span>
          <span className="cse-stat-label">Speaking</span>
        </div>
        <div className="cse-stat">
          <span className="cse-stat-value">{lessons.filter(l => l.skill === 'listening').length}</span>
          <span className="cse-stat-label">Listening</span>
        </div>
        <div className="cse-stat">
          <span className="cse-stat-value">{lessons.filter(l => l.skill === 'reading').length}</span>
          <span className="cse-stat-label">Reading</span>
        </div>
      </div>

      {/* Lessons List */}
      <div className="cse-lessons">
        {loading ? (
          <div className="cse-loading">
            <i className="ri-loader-4-line" />
            Loading lessons...
          </div>
        ) : lessons.length === 0 ? (
          <div className="cse-empty">
            <div className="cse-empty-icon">
              <i className="ri-book-open-line" />
            </div>
            <h3>No lessons yet</h3>
            <p>Create your first Conversational Skills lesson</p>
            <button className="cse-create-btn" onClick={() => setShowCreateModal(true)}>
              <i className="ri-add-line" />
              Create Lesson
            </button>
          </div>
        ) : (
          <div className="cse-lessons-grid">
            {lessons.map(lesson => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onSelect={() => handleSelectLesson(lesson)}
                onDelete={() => handleDeleteLesson(lesson.id)}
              />
            ))}
          </div>
        )}
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
// LESSON CARD
// ============================================================================

function LessonCard({
  lesson,
  onSelect,
  onDelete,
}: {
  lesson: LessonMaterial;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const skillColors: Record<Skill, string> = {
    speaking: '#3b82f6',
    listening: '#8b5cf6',
    reading: '#10b981',
  };

  return (
    <div className="cse-lesson-card" onClick={onSelect}>
      <div 
        className="cse-lesson-preview"
        style={{
          backgroundImage: lesson.backgroundImage ? `url(${lesson.backgroundImage})` : undefined,
          backgroundColor: lesson.overlayColor?.replace(/[0-9a-f]{2}$/i, '') || '#0369a1',
        }}
      >
        <span className="cse-lesson-badge">{lesson.levelBadge}</span>
        <div className="cse-lesson-preview-content">
          <p className="cse-lesson-chapter">{lesson.chapterLabel}</p>
          <h3 className="cse-lesson-title">{lesson.lessonTitle}</h3>
        </div>
      </div>
      <div className="cse-lesson-info">
        <div className="cse-lesson-meta">
          <span 
            className="cse-skill-badge"
            style={{ backgroundColor: skillColors[lesson.skill] }}
          >
            {lesson.skill}
          </span>
          <span className="cse-lesson-date">
            {new Date(lesson.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <p className="cse-lesson-goal">{lesson.goalTextEn}</p>
        <button
          className="cse-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <i className="ri-delete-bin-line" />
        </button>
      </div>
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
// HEADER EDITOR
// ============================================================================

function HeaderEditor({
  lesson,
  onBack,
  onUpdate,
}: {
  lesson: LessonMaterial;
  onBack: () => void;
  onUpdate: (lesson: LessonMaterial) => void;
}) {
  const [backgroundImage, setBackgroundImage] = useState(lesson.backgroundImage);
  const [overlayColor, setOverlayColor] = useState(lesson.overlayColor || '#0369a1cc');
  const [saving, setSaving] = useState(false);

  // Parse overlay color into color and opacity
  const baseColor = overlayColor.slice(0, 7);
  const opacity = overlayColor.length === 9 
    ? parseInt(overlayColor.slice(7, 9), 16) / 255 
    : 0.8;

  const handleColorChange = (color: string) => {
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(color + opacityHex);
  };

  const handleOpacityChange = (newOpacity: number) => {
    const opacityHex = Math.round(newOpacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(baseColor + opacityHex);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateLessonHeader(lesson.id, {
        backgroundImage,
        overlayColor,
      });
      onUpdate(updated);
      toast.success('Header saved!');
    } catch (error) {
      toast.error('Failed to save header');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Convert to base64 for now (in production, upload to SeaweedFS)
    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPreview = () => {
    // Store unsaved preview data in sessionStorage to avoid URL size limits
    const previewData = {
      backgroundImage,
      overlayColor,
    };
    sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(previewData));
    window.open(`/conversational-skills-preview/${lesson.id}`, '_blank');
  };

  const handleOpenVisualEditor = () => {
    // Open the visual/WYSIWYG editor in a new tab
    window.open(`/conversational-skills-visual-editor/${lesson.id}`, '_blank');
  };

  return (
    <div className="cse-editor">
      {/* Toolbar */}
      <div className="cse-editor-toolbar">
        <button className="cse-btn-back" onClick={onBack}>
          <i className="ri-arrow-left-line" />
          Back
        </button>
        <div className="cse-editor-title">
          <span className="cse-editor-badge">{lesson.levelBadge}</span>
          <h2>{lesson.lessonTitle}</h2>
        </div>
        <div className="cse-toolbar-actions">
          <button className="cse-btn-visual" onClick={handleOpenVisualEditor}>
            <i className="ri-layout-masonry-line" />
            Visual Editor
          </button>
          <button className="cse-btn-secondary" onClick={handleOpenPreview}>
            <i className="ri-external-link-line" />
            Preview
          </button>
          <button className="cse-btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ri-save-line" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="cse-editor-layout">
        {/* Controls Panel */}
        <aside className="cse-editor-controls">
          <h3>Header Settings</h3>

          {/* Background Image */}
          <div className="cse-control-group">
            <label>Background Image</label>
            <div className="cse-image-upload">
              {backgroundImage ? (
                <div className="cse-image-preview">
                  <img src={backgroundImage} alt="Background" />
                  <button onClick={() => setBackgroundImage('')}>
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
              ) : (
                <label className="cse-upload-btn">
                  <i className="ri-image-add-line" />
                  <span>Upload Image</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Overlay Color */}
          <div className="cse-control-group">
            <label>Overlay Color</label>
            <div className="cse-color-picker">
              <input
                type="color"
                value={baseColor}
                onChange={e => handleColorChange((e.target as HTMLInputElement).value)}
              />
              <span>{baseColor}</span>
            </div>
          </div>

          {/* Overlay Opacity */}
          <div className="cse-control-group">
            <label>Overlay Opacity: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={e => handleOpacityChange(parseFloat((e.target as HTMLInputElement).value))}
            />
          </div>

          {/* Preset Colors */}
          <div className="cse-control-group">
            <label>Preset Colors</label>
            <div className="cse-color-presets">
              {['#0369a1', '#1e3a5f', '#134e4a', '#4c1d95', '#9f1239', '#1f2937'].map(color => (
                <button
                  key={color}
                  className={`cse-color-preset ${baseColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Lesson Info Panel - replaces preview */}
        <main className="cse-editor-main">
          <div className="cse-lesson-info-panel">
            <h3>Lesson Information</h3>
            
            <div className="cse-info-grid">
              <div className="cse-info-item">
                <label>Level</label>
                <span>{lesson.levelBadge} (Level {lesson.level})</span>
              </div>
              <div className="cse-info-item">
                <label>Skill</label>
                <span className="cse-skill-tag" data-skill={lesson.skill}>{lesson.skill}</span>
              </div>
              <div className="cse-info-item">
                <label>Chapter</label>
                <span>{lesson.chapterLabel}</span>
              </div>
              <div className="cse-info-item">
                <label>Lesson</label>
                <span>{lesson.lessonTitle}</span>
              </div>
            </div>

            <div className="cse-info-section">
              <label>Lesson Goal (English)</label>
              <p>{lesson.goalTextEn}</p>
            </div>

            <div className="cse-info-section">
              <label>Lesson Goal (Japanese)</label>
              <p>{lesson.goalTextJp}</p>
            </div>

            <div className="cse-info-meta">
              <span>Created: {new Date(lesson.createdAt).toLocaleDateString()}</span>
              <span>Updated: {new Date(lesson.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Section Editors - Coming Soon */}
          <div className="cse-sections-placeholder">
            <h3>Lesson Sections</h3>
            <p>Section editors coming soon...</p>
            <div className="cse-section-list">
              <div className="cse-section-item">
                <i className="ri-mic-line" />
                <span>Vocabulary</span>
                <span className="cse-section-status">Not configured</span>
              </div>
              <div className="cse-section-item">
                <i className="ri-chat-3-line" />
                <span>Dialogue</span>
                <span className="cse-section-status">Not configured</span>
              </div>
              <div className="cse-section-item">
                <i className="ri-book-read-line" />
                <span>Grammar</span>
                <span className="cse-section-status">Not configured</span>
              </div>
              <div className="cse-section-item">
                <i className="ri-headphone-line" />
                <span>Listening</span>
                <span className="cse-section-status">Not configured</span>
              </div>
              <div className="cse-section-item">
                <i className="ri-pencil-line" />
                <span>Practice</span>
                <span className="cse-section-status">Not configured</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

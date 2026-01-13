/**
 * ConversationalSkillsVisualEditor
 * WYSIWYG visual editor - edit content directly on the styled layout
 * This is the "no-code" page builder experience
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  getLessonById,
  updateLessonHeader,
  type LessonMaterial,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import './ConversationalSkillsVisualEditor.css';

// ============================================================================
// SHARED TYPES
// ============================================================================

interface IntroText {
  language: string;
  text: string;
}

interface LessonIssue {
  title: string;
  points: string[];
}

interface LessonGoalStep {
  instruction: string;
  script?: string | null;
  question?: string | null;
}

interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

// Default introduction data
const DEFAULT_INTRODUCTION_DATA: IntroductionData = {
  introTexts: [
    { 
      language: "en", 
      text: "Many Italians love to communicate not only through words but also through gestures. Knowing the meaning behind their gestures can save you from a lot of trouble!" 
    }
  ],
  introImage: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop",
  lessonIssue: null,
  lessonGoalDuration: "1 minute",
  lessonGoalSteps: [
    { instruction: "Introduce the lesson topic.", script: "Today, let's talk about gestures.", question: null },
    { instruction: "Read the lesson goal and ask if it's clear.", script: null, question: null },
    { instruction: "Read the Introduce explanation.", script: null, question: null },
    { instruction: "Ask the question below.", script: null, question: null },
    { instruction: "Transition to the next section.", script: "Good! Let's go to the next part!", question: null }
  ]
};

// ============================================================================
// LEARN SECTION TYPES & DEFAULTS
// ============================================================================

// Step A can be either VOCABULARY or EXPRESSIONS
type StepAType = 'vocabulary' | 'expressions';

interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string;
  translation: string;
}

// ExpressionItem now uses rich text (HTML) for the definition line
// Users can bold/italic any text with Ctrl+B/Ctrl+I
interface ExpressionItem {
  image: string;
  definitionLine: string; // Rich text HTML like "To <strong>cost an arm and a leg</strong> means to be very expensive."
  exampleSentence: string; // Rich text HTML for example sentence
  extraText?: string; // Optional additional text below example
}

interface DiscussionImage {
  image: string;
  label?: string;
  translation?: string;
}

interface DiscussionPart {
  instruction: string;
  instructionTranslation?: string;
  images: DiscussionImage[]; // Up to 3 images
}

// Pronunciation Part III structure
interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean; // Show in green/bold
}

interface PronunciationColumn {
  soundSymbol: string; // e.g., "/d/"
  images: string[]; // 1-3 images showing mouth position
  words: PronunciationWord[];
}

interface PronunciationPart {
  instruction: string; // "III. Practice reading the words."
  instructionTranslation: string;
  leftColumn: PronunciationColumn;
  rightColumn: PronunciationColumn;
}

interface TutorStep {
  instruction: string;
  script?: string | null;
  tip?: string | null;
}

interface LearnStepData {
  stepType: StepAType;
  stepName: string;
  duration: string;
  partLabel: string;
  partTranslation: string;
  // For vocabulary type
  vocabularyItems?: VocabularyItem[];
  // For expressions type
  expressionItems?: ExpressionItem[];
  // Part II - Discussion (for both vocabulary and expressions)
  discussionPart?: DiscussionPart;
  // Part III - Pronunciation (for both, can be Part II if discussionPart is not set)
  pronunciationPart?: PronunciationPart;
  // Common
  tutorSteps: TutorStep[];
}

interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

// Default VOCABULARY template
const DEFAULT_VOCABULARY_STEP: LearnStepData = {
  stepType: 'vocabulary',
  stepName: "STEP A VOCABULARY",
  duration: "2 minutes",
  partLabel: "I. Listen and repeat.",
  partTranslation: "聴いて、リピートしましょう。",
  vocabularyItems: [
    { image: "", englishText: "wake up", translation: "起きる" },
    { image: "", englishText: "do my hair", highlightedWord: "do", translation: "髪を整える" },
    { image: "", englishText: "eat breakfast", translation: "朝ごはんを食べる" },
    { image: "", englishText: "brush my teeth", translation: "歯を磨く" },
  ],
  tutorSteps: [
    { instruction: "Introduce Learn.", script: "Now, let's try Learn. First we have Step A Vocabulary. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Step 3 with the remaining vocabulary.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

// Default EXPRESSIONS template
const DEFAULT_EXPRESSIONS_STEP: LearnStepData = {
  stepType: 'expressions',
  stepName: "STEP A EXPRESSIONS",
  duration: "4 minutes",
  partLabel: "I. Go over the expressions with your tutor.",
  partTranslation: "講師と一緒に表現を確認しましょう。",
  expressionItems: [
    { 
      image: "",
      definitionLine: "To <strong>cost an arm and a leg</strong> means to be very expensive.",
      exampleSentence: "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>"
    },
    { 
      image: "",
      definitionLine: "To <strong>cost a fortune</strong> requires a lot of money.",
      exampleSentence: "<em>The taxi ride from the airport <strong>cost a fortune</strong> last night!</em>"
    },
    { 
      image: "",
      definitionLine: "<strong>Dirt cheap</strong> means very inexpensive.",
      exampleSentence: "<em>The souvenirs I bought were <strong>dirt cheap</strong>.</em>"
    },
  ],
  tutorSteps: [
    { instruction: "Introduce Present.", script: "Now, let's try Present. First we have Step A Expressions. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first expression's explanation.", script: null, tip: null },
    { instruction: "Read the italicized example sentence and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Steps 3-4 with the remaining expressions.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

const DEFAULT_LEARN_DATA: LearnSectionData = {
  sectionTitle: "LEARN",
  steps: [DEFAULT_VOCABULARY_STEP]
};

// ============================================================================
// RICH TEXT INPUT COMPONENT
// Supports Ctrl+B for bold, Ctrl+I for italic
// ============================================================================

interface RichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
}

function RichTextInput({ value, onChange, placeholder, className = '', singleLine = true }: RichTextInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      // Trigger change after command
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Prevent Enter in single line mode
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Handle input changes
  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  };

  // Handle paste - strip non-formatting HTML
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  };

  // Update content when value prop changes (but not during editing)
  useEffect(() => {
    if (ref.current && !hasFocus) {
      // Only update if different to avoid cursor jumping
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || '';
      }
    }
  }, [value, hasFocus]);

  // Initial setup
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, []);

  const showPlaceholder = !value && !hasFocus;

  return (
    <div className={`csve-rich-text-wrapper ${className}`}>
      <div
        ref={ref}
        className={`csve-rich-text-input ${showPlaceholder ? 'csve-placeholder' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        data-placeholder={placeholder}
        spellcheck={false}
      />
      <div className="csve-rich-text-hint">
        <kbd>Ctrl</kbd>+<kbd>B</kbd> bold &nbsp; <kbd>Ctrl</kbd>+<kbd>I</kbd> italic
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConversationalSkillsVisualEditor() {
  const { params } = useRoute();
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable state - styling
  const [backgroundImage, setBackgroundImage] = useState('');
  const [overlayColor, setOverlayColor] = useState('#134e4acc');
  
  // Editable state - text content
  const [chapterName, setChapterName] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [goalTextEn, setGoalTextEn] = useState('');
  const [goalTextJp, setGoalTextJp] = useState('');
  
  // Introduction section state (lifted up from IntroductionSectionEditor)
  const [introductionData, setIntroductionData] = useState<IntroductionData>(DEFAULT_INTRODUCTION_DATA);
  
  // Learn section state
  const [learnData, setLearnData] = useState<LearnSectionData>(DEFAULT_LEARN_DATA);
  
  // UI state
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  const id = params?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadLesson(id);
    }
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
      setBackgroundImage(data.backgroundImage || '');
      setOverlayColor(data.overlayColor || '#134e4acc');
      setChapterName(data.chapterName || '');
      setLessonName(data.lessonName || '');
      setGoalTextEn(data.goalTextEn || '');
      setGoalTextJp(data.goalTextJp || '');
      
      // Load introduction data from lesson if available
      if (data.introductionData) {
        setIntroductionData(data.introductionData);
      }
      
      // Load learn data from lesson if available
      if (data.learnData) {
        setLearnData(data.learnData);
      }
    } catch (err) {
      console.error('Failed to load lesson:', err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lesson) return;
    
    setSaving(true);
    try {
      const updated = await updateLessonHeader(lesson.id, {
        backgroundImage,
        overlayColor,
        chapterName,
        lessonName,
        goalTextEn,
        goalTextJp,
        introductionData,
        learnData,
      });
      setLesson(updated);
      toast.success('Changes saved!');
    } catch (err) {
      console.error('Failed to save:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPreview = () => {
    if (!lesson) return;
    sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify({
      backgroundImage,
      overlayColor,
      chapterName,
      lessonName,
      goalTextEn,
      goalTextJp,
      introductionData,
      learnData,
    }));
    window.open(`/conversational-skills-preview/${lesson.id}`, '_blank');
  };

  const handleBack = () => {
    window.location.href = `/conversational-skills-editor`;
  };

  // Parse overlay color
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

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="csve-fullpage csve-loading">
        <div className="csve-loader">
          <i className="ri-loader-4-line" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csve-fullpage csve-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Lesson not found'}</h2>
        <button onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="csve-fullpage">
      {/* Editor Toolbar - Fixed at top */}
      <div className="csve-toolbar">
        <div className="csve-toolbar-left">
          <button className="csve-toolbar-btn csve-back-btn" onClick={handleBack}>
            <i className="ri-arrow-left-line" />
            <span>Back</span>
          </button>
          <div className="csve-toolbar-divider" />
          <span className="csve-toolbar-title">
            <span className="csve-badge">{lesson.levelBadge}</span>
            Lesson {lesson.lessonNumber}: {lessonName}
          </span>
        </div>
        <div className="csve-toolbar-center">
          <span className="csve-edit-mode">
            <i className="ri-edit-line" />
            Visual Editor
          </span>
        </div>
        <div className="csve-toolbar-right">
          <button className="csve-toolbar-btn csve-preview-btn" onClick={handleOpenPreview}>
            <i className="ri-eye-line" />
            <span>Preview</span>
          </button>
          <button 
            className="csve-toolbar-btn csve-save-btn" 
            onClick={handleSave}
            disabled={saving}
          >
            <i className="ri-save-line" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas - The actual lesson layout */}
      <div className="csve-canvas" onClick={() => { setActiveElement(null); setEditingField(null); }}>
        {/* Top Navigation Bar */}
        <nav className="csve-topbar">
          <div className="csve-topbar-content">
            <span className="csve-course-info">
              Conversational Skills {lesson.levelBadge} | {lesson.skill.toUpperCase()} | Chapter {lesson.chapter}: {chapterName}
            </span>
          </div>
        </nav>

        {/* Hero Header Section - Clickable to edit */}
        <header
          className={`csve-hero ${activeElement === 'hero' ? 'csve-active' : ''}`}
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          }}
          onClick={(e) => { e.stopPropagation(); setActiveElement('hero'); }}
        >
          <div className="csve-hero-overlay" style={{ backgroundColor: overlayColor }} />
          <div className="csve-hero-content">
            {/* Lesson Label - Chapter name is editable */}
            <p className="csve-lesson-label">
              Lesson {lesson.lessonNumber}:{' '}
              <EditableText
                value={chapterName}
                onChange={setChapterName}
                isEditing={editingField === 'chapterName'}
                onStartEdit={() => setEditingField('chapterName')}
                onEndEdit={() => setEditingField(null)}
                placeholder="Chapter Name"
              />
            </p>
            
            {/* Lesson Name - Editable */}
            <h1 className="csve-lesson-name">
              <EditableText
                value={lessonName}
                onChange={setLessonName}
                isEditing={editingField === 'lessonName'}
                onStartEdit={() => setEditingField('lessonName')}
                onEndEdit={() => setEditingField(null)}
                placeholder="Lesson Name"
              />
            </h1>
            
            <div className="csve-goal-wrapper">
              <div className="csve-goal-row">
                <span className="csve-goal-badge">GOAL</span>
                {/* Goal Text English - Editable */}
                <p className="csve-goal-en">
                  <EditableText
                    value={goalTextEn}
                    onChange={setGoalTextEn}
                    isEditing={editingField === 'goalTextEn'}
                    onStartEdit={() => setEditingField('goalTextEn')}
                    onEndEdit={() => setEditingField(null)}
                    placeholder="Goal (English)"
                  />
                </p>
              </div>
              {/* Goal Text Korean/Japanese - Editable */}
              <p className="csve-goal-jp">
                <EditableText
                  value={goalTextJp}
                  onChange={setGoalTextJp}
                  isEditing={editingField === 'goalTextJp'}
                  onStartEdit={() => setEditingField('goalTextJp')}
                  onEndEdit={() => setEditingField(null)}
                  placeholder="Goal (Korean/Japanese)"
                />
              </p>
            </div>
          </div>

          {/* Edit indicator */}
          {!editingField && (
            <div className="csve-edit-indicator">
              <i className="ri-edit-line" />
              Click text to edit • Click header for styling
            </div>
          )}
        </header>

        {/* Content Sections */}
        <main className="csve-main">
          <div className="csve-sections">
            {/* Introduction Section - Matches Preview */}
            <IntroductionSectionEditor 
              data={introductionData}
              onChange={setIntroductionData}
            />
            
            <LearnSectionEditor 
              data={learnData}
              onChange={setLearnData}
            />
            <PlaceholderSection icon="ri-chat-voice-line" title="Dialogue" />
            <PlaceholderSection icon="ri-file-text-line" title="Grammar" />
            <PlaceholderSection icon="ri-headphone-line" title="Listening" />
            <PlaceholderSection icon="ri-edit-line" title="Practice" />
          </div>
        </main>
      </div>

      {/* Side Panel - Context-sensitive editing */}
      {activeElement === 'hero' && (
        <aside className="csve-panel" onClick={e => e.stopPropagation()}>
          <div className="csve-panel-header">
            <h3>Header Settings</h3>
            <button className="csve-panel-close" onClick={() => setActiveElement(null)}>
              <i className="ri-close-line" />
            </button>
          </div>
          
          <div className="csve-panel-body">
            {/* Background Image */}
            <div className="csve-control">
              <label>Background Image</label>
              <div className="csve-image-control">
                {backgroundImage ? (
                  <div className="csve-image-thumb">
                    <img src={backgroundImage} alt="Background" />
                    <div className="csve-image-actions">
                      <button onClick={() => fileInputRef.current?.click()}>
                        <i className="ri-image-edit-line" />
                      </button>
                      <button onClick={() => setBackgroundImage('')}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="csve-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="ri-image-add-line" />
                    <span>Add Image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Overlay Color */}
            <div className="csve-control">
              <label>Overlay Color</label>
              <div className="csve-color-row">
                <input
                  type="color"
                  value={baseColor}
                  onChange={e => handleColorChange((e.target as HTMLInputElement).value)}
                />
                <span className="csve-color-value">{baseColor}</span>
              </div>
            </div>

            {/* Opacity */}
            <div className="csve-control">
              <label>Opacity: {Math.round(opacity * 100)}%</label>
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
            <div className="csve-control">
              <label>Quick Colors</label>
              <div className="csve-color-presets">
                {['#0369a1', '#1e3a5f', '#134e4a', '#4c1d95', '#9f1239', '#1f2937'].map(color => (
                  <button
                    key={color}
                    className={`csve-preset ${baseColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="csve-panel-divider" />

            {/* Text Fields Section */}
            <div className="csve-control">
              <label>Chapter Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={chapterName}
                onChange={e => setChapterName((e.target as HTMLInputElement).value)}
                placeholder="e.g., All About Me"
              />
            </div>

            <div className="csve-control">
              <label>Lesson Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={lessonName}
                onChange={e => setLessonName((e.target as HTMLInputElement).value)}
                placeholder="e.g., Greetings"
              />
            </div>

            <div className="csve-control">
              <label>Goal (English)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextEn}
                onChange={e => setGoalTextEn((e.target as HTMLInputElement).value)}
                placeholder="e.g., I can say basic greetings."
              />
            </div>

            <div className="csve-control">
              <label>Goal (Korean/Japanese)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextJp}
                onChange={e => setGoalTextJp((e.target as HTMLInputElement).value)}
                placeholder="e.g., 기본 인사를 할 수 있다."
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================================
// EDITABLE TEXT COMPONENT
// ============================================================================

function EditableText({
  value,
  onChange,
  isEditing,
  onStartEdit,
  onEndEdit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="csve-inline-input"
        value={value}
        onChange={e => onChange((e.target as HTMLInputElement).value)}
        onBlur={onEndEdit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onEndEdit();
          }
        }}
        onClick={e => e.stopPropagation()}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className={`csve-editable-text ${!value ? 'csve-placeholder' : ''}`}
      onClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}

// ============================================================================
// PLACEHOLDER SECTION
// ============================================================================

function PlaceholderSection({ icon, title }: { icon: string; title: string }) {
  return (
    <section className="csve-section csve-section-placeholder">
      <div className="csve-section-header">
        <i className={icon} />
        <h2>{title}</h2>
      </div>
      <div className="csve-section-body">
        <p>Section editor coming soon...</p>
      </div>
    </section>
  );
}

// ============================================================================
// INTRODUCTION SECTION EDITOR - FULLY EDITABLE
// ============================================================================

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
];

interface IntroductionSectionEditorProps {
  data: IntroductionData;
  onChange: (data: IntroductionData) => void;
}

function IntroductionSectionEditor({ data, onChange }: IntroductionSectionEditorProps) {
  const introImageInputRef = useRef<HTMLInputElement>(null);
  
  // Extract from props for easier access
  const { introTexts, introImage, lessonIssue, lessonGoalDuration, lessonGoalSteps } = data;

  // UI state
  const [editingIntroText, setEditingIntroText] = useState<number | null>(null);
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  // ============================================================================
  // HELPER: Update data
  // ============================================================================
  
  const updateData = (updates: Partial<IntroductionData>) => {
    onChange({ ...data, ...updates });
  };

  // ============================================================================
  // INTRO TEXT HANDLERS
  // ============================================================================
  
  const handleIntroTextChange = (index: number, text: string) => {
    const updated = [...introTexts];
    updated[index] = { ...updated[index], text };
    updateData({ introTexts: updated });
  };

  const handleAddIntroText = (language: string) => {
    if (introTexts.some(t => t.language === language)) {
      toast.error('This language already exists');
      return;
    }
    updateData({ introTexts: [...introTexts, { language, text: '' }] });
    setShowAddLanguage(false);
    setEditingIntroText(introTexts.length);
  };

  const handleRemoveIntroText = (index: number) => {
    if (introTexts.length === 1) {
      toast.error('At least one language is required');
      return;
    }
    updateData({ introTexts: introTexts.filter((_, i) => i !== index) });
  };

  // ============================================================================
  // IMAGE HANDLERS
  // ============================================================================

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateData({ introImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // LESSON ISSUE HANDLERS
  // ============================================================================

  const handleAddLessonIssue = () => {
    updateData({ lessonIssue: { title: '', points: [''] } });
  };

  const handleRemoveLessonIssue = () => {
    updateData({ lessonIssue: null });
  };

  const handleIssueTitleChange = (title: string) => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, title } });
    }
  };

  const handleIssuePointChange = (index: number, text: string) => {
    if (lessonIssue) {
      const points = [...lessonIssue.points];
      points[index] = text;
      updateData({ lessonIssue: { ...lessonIssue, points } });
    }
  };

  const handleAddIssuePoint = () => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, points: [...lessonIssue.points, ''] } });
    }
  };

  const handleRemoveIssuePoint = (index: number) => {
    if (lessonIssue && lessonIssue.points.length > 1) {
      updateData({ 
        lessonIssue: { 
          ...lessonIssue, 
          points: lessonIssue.points.filter((_, i) => i !== index) 
        } 
      });
    }
  };

  // ============================================================================
  // LESSON GOAL HANDLERS
  // ============================================================================

  const handleStepChange = (index: number, field: keyof LessonGoalStep, value: string | null) => {
    const updated = [...lessonGoalSteps];
    updated[index] = { ...updated[index], [field]: value };
    updateData({ lessonGoalSteps: updated });
  };

  const handleAddStep = () => {
    updateData({ lessonGoalSteps: [...lessonGoalSteps, { instruction: '', script: null, question: null }] });
  };

  const handleRemoveStep = (index: number) => {
    if (lessonGoalSteps.length > 1) {
      updateData({ lessonGoalSteps: lessonGoalSteps.filter((_, i) => i !== index) });
    }
  };

  const handleDurationChange = (duration: string) => {
    updateData({ lessonGoalDuration: duration });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="csve-intro-section">
      <div className="csve-intro-layout">
        {/* Left Column - Main Content */}
        <div className="csve-intro-left">
          {/* FIXED: Section number and title */}
          <div className="csve-section-number">
            <span className="csve-number-badge">1</span>
            <h2 className="csve-section-title">INTRODUCE</h2>
            <div className="csve-section-line" />
          </div>
          
          {/* EDITABLE: Intro texts with multiple language support */}
          <div className="csve-intro-texts">
            {introTexts.map((introText, i) => (
              <div key={i} className="csve-intro-text-block">
                <div className="csve-intro-text-header">
                  <span className="csve-lang-badge">{introText.language.toUpperCase()}</span>
                  {introTexts.length > 1 && (
                    <button 
                      className="csve-remove-btn"
                      onClick={() => handleRemoveIntroText(i)}
                      title="Remove this translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                {editingIntroText === i ? (
                  <textarea
                    className="csve-intro-textarea"
                    value={introText.text}
                    onChange={e => handleIntroTextChange(i, (e.target as HTMLTextAreaElement).value)}
                    onBlur={() => setEditingIntroText(null)}
                    placeholder={`Enter introduction text in ${LANGUAGE_OPTIONS.find(l => l.code === introText.language)?.label || introText.language}...`}
                    autoFocus
                  />
                ) : (
                  <p 
                    className="csve-intro-text csve-editable-block"
                    onClick={() => setEditingIntroText(i)}
                  >
                    {introText.text || <span className="csve-placeholder-text">Click to add text...</span>}
                  </p>
                )}
              </div>
            ))}
            
            {/* Add Language Button */}
            <div className="csve-add-language">
              {showAddLanguage ? (
                <div className="csve-language-picker">
                  {LANGUAGE_OPTIONS.filter(lang => !introTexts.some(t => t.language === lang.code)).map(lang => (
                    <button key={lang.code} onClick={() => handleAddIntroText(lang.code)}>
                      {lang.label}
                    </button>
                  ))}
                  <button className="csve-cancel-btn" onClick={() => setShowAddLanguage(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="csve-add-btn"
                  onClick={() => setShowAddLanguage(true)}
                  disabled={introTexts.length >= LANGUAGE_OPTIONS.length}
                >
                  <i className="ri-add-line" />
                  Add Translation
                </button>
              )}
            </div>
          </div>
          
          {/* EDITABLE: Intro image */}
          <div className="csve-intro-image-wrapper">
            {introImage ? (
              <div className="csve-intro-image csve-editable-block">
                <img src={introImage} alt="Introduction visual" />
                <div className="csve-image-overlay">
                  <button onClick={() => introImageInputRef.current?.click()}>
                    <i className="ri-image-edit-line" />
                    Change
                  </button>
                  <button onClick={() => updateData({ introImage: null })}>
                    <i className="ri-delete-bin-line" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="csve-add-image-btn"
                onClick={() => introImageInputRef.current?.click()}
              >
                <i className="ri-image-add-line" />
                Add Image
              </button>
            )}
            <input
              ref={introImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-intro-right">
          {/* EDITABLE & OPTIONAL: Lesson Issue */}
          {lessonIssue ? (
            <div className="csve-lesson-issue csve-editable-card">
              <div className="csve-issue-header">
                <span>THIS LESSON'S ISSUE</span>
                <div className="csve-issue-badges">
                  <small>For tutors only.</small>
                  <small className="csve-warning">DO NOT SHARE WITH THE STUDENT!</small>
                </div>
                <button 
                  className="csve-card-remove-btn"
                  onClick={handleRemoveLessonIssue}
                  title="Remove Lesson Issue"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="csve-issue-content">
                <input
                  type="text"
                  className="csve-issue-title-input"
                  value={lessonIssue.title}
                  onChange={e => handleIssueTitleChange((e.target as HTMLInputElement).value)}
                  placeholder="Issue title (e.g., Gestures)"
                />
                <ul className="csve-issue-points">
                  {lessonIssue.points.map((point, i) => (
                    <li key={i} className="csve-issue-point-item">
                      <textarea
                        className="csve-issue-point-input"
                        value={point}
                        onChange={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                          handleIssuePointChange(i, textarea.value);
                        }}
                        onFocus={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                        }}
                        placeholder="Enter a point..."
                        rows={1}
                      />
                      {lessonIssue.points.length > 1 && (
                        <button 
                          className="csve-point-remove"
                          onClick={() => handleRemoveIssuePoint(i)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="csve-add-point-btn" onClick={handleAddIssuePoint}>
                  <i className="ri-add-line" />
                  Add Point
                </button>
              </div>
            </div>
          ) : (
            <button className="csve-add-card-btn" onClick={handleAddLessonIssue}>
              <i className="ri-add-circle-line" />
              Add Lesson Issue
              <span className="csve-add-card-hint">Optional tutor-only information</span>
            </button>
          )}

          {/* EDITABLE: Lesson Goal */}
          <div className="csve-lesson-goal-box csve-editable-card">
            <div className="csve-goal-header-edit">
              <span className="csve-goal-title">LESSON GOAL</span>
              <span className="csve-goal-duration-wrap">
                (<input
                  type="text"
                  className="csve-duration-input"
                  value={lessonGoalDuration}
                  onChange={e => handleDurationChange((e.target as HTMLInputElement).value)}
                  placeholder="1 minute"
                />)
              </span>
            </div>
            <div className="csve-goal-steps">
              {lessonGoalSteps.map((step, i) => (
                <div className="csve-goal-step csve-goal-step-editable" key={i}>
                  <span className="csve-step-number">{i + 1}</span>
                  <div className="csve-step-content">
                    <input
                      type="text"
                      className="csve-step-instruction-input"
                      value={step.instruction}
                      onChange={e => handleStepChange(i, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Instruction..."
                    />
                    
                    {/* Script - green text with quotes */}
                    {step.script !== null && (
                      <div className="csve-step-script-block">
                        <span className="csve-script-quote">"</span>
                        <input
                          type="text"
                          className="csve-step-script-input"
                          value={step.script || ''}
                          onChange={e => handleStepChange(i, 'script', (e.target as HTMLInputElement).value)}
                          placeholder="Say this..."
                        />
                        <span className="csve-script-quote">"</span>
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleStepChange(i, 'script', null)}
                          title="Remove script"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    {/* Tip - orange text */}
                    {step.question !== null && (
                      <div className="csve-step-tip-block">
                        <input
                          type="text"
                          className="csve-step-tip-input"
                          value={step.question || ''}
                          onChange={e => handleStepChange(i, 'question', (e.target as HTMLInputElement).value)}
                          placeholder="Add a tip..."
                        />
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleStepChange(i, 'question', null)}
                          title="Remove tip"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    {/* Add buttons */}
                    <div className="csve-step-add-btns">
                      {step.script === null && (
                        <button 
                          className="csve-add-script-btn"
                          onClick={() => handleStepChange(i, 'script', '')}
                        >
                          <i className="ri-add-line" />
                          Add Script
                        </button>
                      )}
                      {step.question === null && (
                        <button 
                          className="csve-add-tip-btn"
                          onClick={() => handleStepChange(i, 'question', '')}
                        >
                          <i className="ri-add-line" />
                          Add Tip
                        </button>
                      )}
                    </div>
                    
                    {lessonGoalSteps.length > 1 && (
                      <button 
                        className="csve-step-remove"
                        onClick={() => handleRemoveStep(i)}
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="csve-add-step-btn" onClick={handleAddStep}>
                <i className="ri-add-line" />
                Add Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LEARN SECTION EDITOR
// ============================================================================

interface LearnSectionEditorProps {
  data: LearnSectionData;
  onChange: (data: LearnSectionData) => void;
}

function LearnSectionEditor({ data, onChange }: LearnSectionEditorProps) {
  const vocabImageInputRef = useRef<HTMLInputElement>(null);
  const exprImageInputRef = useRef<HTMLInputElement>(null);
  const discussImageInputRef = useRef<HTMLInputElement>(null);
  const [activeVocabIndex, setActiveVocabIndex] = useState<{stepIdx: number, vocabIdx: number} | null>(null);
  const [activeExprIndex, setActiveExprIndex] = useState<{stepIdx: number, exprIdx: number} | null>(null);
  const [activeDiscussIndex, setActiveDiscussIndex] = useState<{stepIdx: number, imgIdx: number} | null>(null);

  // Helper to update data
  const updateData = (updates: Partial<LearnSectionData>) => {
    onChange({ ...data, ...updates });
  };

  const updateStep = (stepIndex: number, updates: Partial<LearnStepData>) => {
    const newSteps = [...data.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
    updateData({ steps: newSteps });
  };

  // Switch step type handler
  const handleSwitchStepType = (stepIdx: number, newType: StepAType) => {
    if (newType === 'vocabulary') {
      updateStep(stepIdx, {
        ...DEFAULT_VOCABULARY_STEP,
        stepType: 'vocabulary',
      });
    } else {
      updateStep(stepIdx, {
        ...DEFAULT_EXPRESSIONS_STEP,
        stepType: 'expressions',
      });
    }
  };

  // Vocabulary handlers
  const handleVocabChange = (stepIdx: number, vocabIdx: number, field: keyof VocabularyItem, value: string) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || [])];
    newVocab[vocabIdx] = { ...newVocab[vocabIdx], [field]: value };
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleAddVocab = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || []), { image: '', englishText: '', translation: '' }];
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleRemoveVocab = (stepIdx: number, vocabIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.vocabularyItems || []).length <= 1) {
      toast.error('At least one vocabulary item is required');
      return;
    }
    updateStep(stepIdx, { vocabularyItems: (step.vocabularyItems || []).filter((_, i) => i !== vocabIdx) });
  };

  const handleVocabImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeVocabIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleVocabChange(activeVocabIndex.stepIdx, activeVocabIndex.vocabIdx, 'image', reader.result as string);
      setActiveVocabIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Expression handlers
  const handleExprChange = (stepIdx: number, exprIdx: number, field: keyof ExpressionItem, value: string) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || [])];
    newExpr[exprIdx] = { ...newExpr[exprIdx], [field]: value };
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleAddExpr = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || []), { image: '', definitionLine: 'To <strong>expression</strong> means...', exampleSentence: '<em>Example sentence here.</em>' }];
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleRemoveExpr = (stepIdx: number, exprIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.expressionItems || []).length <= 1) {
      toast.error('At least one expression is required');
      return;
    }
    updateStep(stepIdx, { expressionItems: (step.expressionItems || []).filter((_, i) => i !== exprIdx) });
  };

  const handleExprImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeExprIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleExprChange(activeExprIndex.stepIdx, activeExprIndex.exprIdx, 'image', reader.result as string);
      setActiveExprIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Discussion part handlers
  const handleDiscussInstructionChange = (stepIdx: number, value: string) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '', images: [] }), 
        instruction: value 
      } 
    });
  };

  const handleDiscussImageChange = (stepIdx: number, imgIdx: number, field: keyof DiscussionImage, value: string) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    const newImages = [...currentImages];
    newImages[imgIdx] = { ...newImages[imgIdx], [field]: value };
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: newImages 
      } 
    });
  };

  const handleAddDiscussImage = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    if (currentImages.length >= 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: [...currentImages, { image: '', label: '', translation: '' }] 
      } 
    });
  };

  const handleRemoveDiscussImage = (stepIdx: number, imgIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: currentImages.filter((_, i) => i !== imgIdx) 
      } 
    });
  };

  const handleDiscussImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeDiscussIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleDiscussImageChange(activeDiscussIndex.stepIdx, activeDiscussIndex.imgIdx, 'image', reader.result as string);
      setActiveDiscussIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Add/Remove Discussion Part
  const handleAddDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const partNum = step.discussionPart ? 'III' : 'II';
    updateStep(stepIdx, {
      discussionPart: {
        instruction: `${partNum}. Discussion question goes here.`,
        instructionTranslation: '',
        images: [{ image: '', label: '', translation: '' }]
      }
    });
  };

  const handleRemoveDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const { discussionPart, ...rest } = step;
    updateStep(stepIdx, { discussionPart: undefined });
  };

  // Pronunciation Part handlers
  const handleAddPronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, {
      pronunciationPart: {
        instruction: 'Practice reading the words.',
        instructionTranslation: '単語を読む練習をしましょう。',
        leftColumn: {
          soundSymbol: '/d/',
          images: [''],
          words: [
            { word: 'do', translation: 'する', isHighlighted: true },
            { word: 'dressed', translation: '服を着た', isHighlighted: true },
            { word: 'dust', translation: 'ほこり' },
          ]
        },
        rightColumn: {
          soundSymbol: '/dʒ/',
          images: [''],
          words: [
            { word: 'Jew', translation: 'ユダヤ人' },
            { word: 'jest', translation: '冗談' },
            { word: 'just', translation: 'ちょうど' },
          ]
        }
      }
    });
  };

  const handleRemovePronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, { pronunciationPart: undefined });
  };

  const handlePronunciationChange = (
    stepIdx: number, 
    column: 'leftColumn' | 'rightColumn', 
    field: string, 
    value: any
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    updateStep(stepIdx, {
      pronunciationPart: {
        ...step.pronunciationPart,
        [column]: {
          ...step.pronunciationPart[column],
          [field]: value
        }
      }
    });
  };

  const handlePronunciationWordChange = (
    stepIdx: number,
    column: 'leftColumn' | 'rightColumn',
    wordIdx: number,
    field: keyof PronunciationWord,
    value: string | boolean
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words];
    newWords[wordIdx] = { ...newWords[wordIdx], [field]: value };
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleAddPronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn') => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words, { word: '', translation: '' }];
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleRemovePronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn', wordIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    if (step.pronunciationPart[column].words.length <= 1) {
      toast.error('At least one word is required');
      return;
    }
    const newWords = step.pronunciationPart[column].words.filter((_, i) => i !== wordIdx);
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  // Tutor step handlers
  const handleTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    const newTutorSteps = [...step.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { tutorSteps: newTutorSteps });
  };

  const handleAddTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { tutorSteps: [...step.tutorSteps, { instruction: '', script: null, tip: null }] });
  };

  const handleRemoveTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (step.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { tutorSteps: step.tutorSteps.filter((_, i) => i !== tutorIdx) });
  };

  return (
    <section className="csve-learn-section">
      <div className="csve-section-number">
        <span className="csve-number-badge">2</span>
        <h2 className="csve-section-title">{data.sectionTitle}</h2>
        <div className="csve-section-line" />
      </div>

      {data.steps.map((step, stepIdx) => (
        <div key={stepIdx} className="csve-learn-step">
          {/* Step Type Switcher */}
          <div className="csve-step-type-switcher">
            <span className="csve-switcher-label">Step A Type:</span>
            <div className="csve-switcher-buttons">
              <button
                className={`csve-switcher-btn ${step.stepType === 'vocabulary' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'vocabulary')}
              >
                <i className="ri-book-2-line" />
                Vocabulary
              </button>
              <button
                className={`csve-switcher-btn ${step.stepType === 'expressions' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'expressions')}
              >
                <i className="ri-chat-quote-line" />
                Expressions
              </button>
            </div>
          </div>

          {/* Step Header - Editable */}
          <div className="csve-step-header-edit">
            <input
              type="text"
              className="csve-step-name-input"
              value={step.stepName}
              onChange={e => updateStep(stepIdx, { stepName: (e.target as HTMLInputElement).value })}
              placeholder="STEP NAME"
            />
          </div>

          <div className="csve-learn-layout">
            {/* Left Column - Content */}
            <div className="csve-learn-left">
              {/* Part Label - Editable */}
              <div className="csve-part-label-edit">
                <input
                  type="text"
                  className="csve-part-english-input"
                  value={step.partLabel}
                  onChange={e => updateStep(stepIdx, { partLabel: (e.target as HTMLInputElement).value })}
                  placeholder="Part label (e.g., I. Listen and repeat.)"
                />
                <input
                  type="text"
                  className="csve-part-translation-input"
                  value={step.partTranslation}
                  onChange={e => updateStep(stepIdx, { partTranslation: (e.target as HTMLInputElement).value })}
                  placeholder="Translation"
                />
              </div>

              {/* VOCABULARY Content */}
              {step.stepType === 'vocabulary' && (
                <div className="csve-vocab-grid">
                  {(step.vocabularyItems || []).map((item, vocabIdx) => (
                    <div key={vocabIdx} className="csve-vocab-card csve-editable-card">
                      <div 
                        className="csve-vocab-image"
                        onClick={() => {
                          setActiveVocabIndex({ stepIdx, vocabIdx });
                          vocabImageInputRef.current?.click();
                        }}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.englishText} />
                        ) : (
                          <div className="csve-image-placeholder">
                            <span className="csve-placeholder-dims">150 × 100</span>
                            <span className="csve-placeholder-hint">Click to add</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        className="csve-vocab-english-input"
                        value={item.englishText}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'englishText', (e.target as HTMLInputElement).value)}
                        placeholder="English text"
                      />
                      <input
                        type="text"
                        className="csve-vocab-highlight-input"
                        value={item.highlightedWord || ''}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'highlightedWord', (e.target as HTMLInputElement).value)}
                        placeholder="Highlight word (optional)"
                      />
                      <input
                        type="text"
                        className="csve-vocab-translation-input"
                        value={item.translation}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'translation', (e.target as HTMLInputElement).value)}
                        placeholder="Translation"
                      />
                      {(step.vocabularyItems || []).length > 1 && (
                        <button className="csve-vocab-remove" onClick={() => handleRemoveVocab(stepIdx, vocabIdx)}>
                          <i className="ri-delete-bin-line" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="csve-add-vocab-btn" onClick={() => handleAddVocab(stepIdx)}>
                    <i className="ri-add-line" />
                    Add Vocabulary
                  </button>
                </div>
              )}

              {/* EXPRESSIONS Content */}
              {step.stepType === 'expressions' && (
                <>
                  <div className="csve-expr-list">
                    {(step.expressionItems || []).map((item, exprIdx) => (
                      <div key={exprIdx} className="csve-expr-item">
                        <div 
                          className="csve-expr-image"
                          onClick={() => {
                            setActiveExprIndex({ stepIdx, exprIdx });
                            exprImageInputRef.current?.click();
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt="expression" />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">220 × 165</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                        </div>
                        <div className="csve-expr-content">
                          <div className="csve-expr-number">{exprIdx + 1}.</div>
                          <div className="csve-expr-fields">
                            <RichTextInput
                              value={item.definitionLine}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'definitionLine', html)}
                              placeholder="To cost an arm and a leg means to be very expensive."
                              className="csve-expr-definition-rich"
                            />
                            <RichTextInput
                              value={item.exampleSentence}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'exampleSentence', html)}
                              placeholder="Staying at a five-star hotel will cost an arm and a leg."
                              className="csve-expr-example-rich"
                            />
                            {item.extraText !== undefined ? (
                              <div className="csve-expr-extra-wrap">
                                <RichTextInput
                                  value={item.extraText}
                                  onChange={(html) => handleExprChange(stepIdx, exprIdx, 'extraText', html)}
                                  placeholder="Additional text..."
                                  className="csve-expr-extra-rich"
                                />
                                <button 
                                  className="csve-expr-extra-remove"
                                  onClick={() => {
                                    const step = data.steps[stepIdx];
                                    const newExpr = [...(step.expressionItems || [])];
                                    const { extraText, ...rest } = newExpr[exprIdx];
                                    newExpr[exprIdx] = rest as ExpressionItem;
                                    updateStep(stepIdx, { expressionItems: newExpr });
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="csve-add-extra-text-btn"
                                onClick={() => handleExprChange(stepIdx, exprIdx, 'extraText', '')}
                              >
                                <i className="ri-add-line" /> Add Text
                              </button>
                            )}
                          </div>
                          {(step.expressionItems || []).length > 1 && (
                            <button className="csve-expr-remove" onClick={() => handleRemoveExpr(stepIdx, exprIdx)}>
                              <i className="ri-delete-bin-line" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button className="csve-add-expr-btn" onClick={() => handleAddExpr(stepIdx)}>
                      <i className="ri-add-line" />
                      Add Expression
                    </button>
                  </div>
                </>
              )}

              {/* PART II - Discussion (for both vocabulary and expressions) */}
              {step.discussionPart ? (
                <div className="csve-discuss-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part {step.pronunciationPart ? 'II' : 'II'}</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemoveDiscussionPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    className="csve-discuss-instruction-input"
                    value={step.discussionPart?.instruction || ''}
                    onChange={e => handleDiscussInstructionChange(stepIdx, (e.target as HTMLInputElement).value)}
                    placeholder="II. Discussion question..."
                  />
                  
                  {/* Images Grid - Up to 3 images horizontally */}
                  <div className={`csve-discuss-images csve-discuss-images-${(step.discussionPart?.images || []).length || 1}`}>
                    {(step.discussionPart?.images || []).map((img, imgIdx) => (
                      <div key={imgIdx} className="csve-discuss-image-item">
                        <div 
                          className="csve-discuss-image"
                          onClick={() => {
                            setActiveDiscussIndex({ stepIdx, imgIdx });
                            discussImageInputRef.current?.click();
                          }}
                        >
                          {img.image ? (
                            <img src={img.image} alt={img.label || 'Discussion'} />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">300 × 200</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                          {(step.discussionPart?.images || []).length > 1 && (
                            <button 
                              className="csve-discuss-image-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDiscussImage(stepIdx, imgIdx);
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </div>
                        
                        {/* Label input */}
                        <div className="csve-discuss-label-row">
                          {img.label !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-label-input"
                              value={img.label}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'label', (e.target as HTMLInputElement).value)}
                              placeholder="Label (e.g., hotel)"
                            />
                          ) : (
                            <button 
                              className="csve-add-label-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'label', '')}
                            >
                              <i className="ri-add-line" /> Add Label
                            </button>
                          )}
                        </div>
                        
                        {/* Translation input */}
                        <div className="csve-discuss-translation-row">
                          {img.translation !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-translation-input"
                              value={img.translation}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'translation', (e.target as HTMLInputElement).value)}
                              placeholder="Translation (e.g., ホテル)"
                            />
                          ) : (
                            <button 
                              className="csve-add-translation-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'translation', '')}
                            >
                              <i className="ri-add-line" /> Add Translation
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Image Button */}
                    {(step.discussionPart?.images || []).length < 3 && (
                      <button 
                        className="csve-add-discuss-image-btn"
                        onClick={() => handleAddDiscussImage(stepIdx)}
                      >
                        <i className="ri-add-line" />
                        <span>Add Image</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              {/* PART III - Pronunciation (for both vocabulary and expressions) */}
              {step.pronunciationPart ? (
                <div className="csve-pronunciation-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part {step.discussionPart ? 'III' : 'II'} - Pronunciation</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemovePronunciationPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  
                  {/* Instruction - numeral is computed dynamically */}
                  <div className="csve-pronunciation-instruction">
                    <span className="csve-pronunciation-numeral">{step.discussionPart ? 'III' : 'II'}.</span>
                    <input
                      type="text"
                      className="csve-pronunciation-instr-input"
                      value={step.pronunciationPart.instruction}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instruction: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="Practice reading the words."
                    />
                    <input
                      type="text"
                      className="csve-pronunciation-instr-trans"
                      value={step.pronunciationPart.instructionTranslation}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instructionTranslation: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="単語を読む練習をしましょう。"
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="csve-pronunciation-columns">
                    {/* Left Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.leftColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'leftColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/d/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.leftColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.leftColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.leftColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'leftColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'leftColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.rightColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'rightColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/dʒ/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.rightColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.rightColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.rightColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'rightColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'rightColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Add Part Buttons */}
              <div className="csve-add-parts-row">
                {!step.discussionPart && (
                  <button className="csve-add-part-btn" onClick={() => handleAddDiscussionPart(stepIdx)}>
                    <i className="ri-add-line" /> Add Part {step.pronunciationPart ? 'II' : 'II'} (Discussion)
                  </button>
                )}
                {!step.pronunciationPart && (
                  <button className="csve-add-part-btn" onClick={() => handleAddPronunciationPart(stepIdx)}>
                    <i className="ri-add-line" /> Add Part {step.discussionPart ? 'III' : 'II'} (Pronunciation)
                  </button>
                )}
              </div>
            </div>

            {/* Right Column - Tutor Guide */}
            <div className="csve-learn-right">
              <div className="csve-tutor-guide csve-editable-card">
                <div className="csve-guide-header-edit">
                  <span className="csve-guide-title">{data.sectionTitle} - {step.stepName.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="csve-guide-duration-wrap">
                    (<input
                      type="text"
                      className="csve-duration-input"
                      value={step.duration}
                      onChange={e => updateStep(stepIdx, { duration: (e.target as HTMLInputElement).value })}
                      placeholder="2 minutes"
                    />)
                  </span>
                </div>
                
                <div className="csve-guide-steps">
                  {step.tutorSteps.map((tutorStep, tutorIdx) => (
                    <div key={tutorIdx} className="csve-guide-step csve-guide-step-editable">
                      <span className="csve-guide-number">{tutorIdx + 1}</span>
                      <div className="csve-guide-content">
                        <input
                          type="text"
                          className="csve-guide-instruction-input"
                          value={tutorStep.instruction}
                          onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'instruction', (e.target as HTMLInputElement).value)}
                          placeholder="Instruction..."
                        />
                        
                        {tutorStep.script !== null && tutorStep.script !== undefined && (
                          <div className="csve-guide-script-block">
                            <span className="csve-script-quote">"</span>
                            <input
                              type="text"
                              className="csve-guide-script-input"
                              value={tutorStep.script || ''}
                              onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'script', (e.target as HTMLInputElement).value)}
                              placeholder="Say this..."
                            />
                            <span className="csve-script-quote">"</span>
                            <button 
                              className="csve-remove-extra-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'script', null)}
                              title="Remove script"
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        )}
                        
                        {tutorStep.tip !== null && tutorStep.tip !== undefined && (
                          <div className="csve-guide-tip-block">
                            <input
                              type="text"
                              className="csve-guide-tip-input"
                              value={tutorStep.tip || ''}
                              onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'tip', (e.target as HTMLInputElement).value)}
                              placeholder="Add a tip..."
                            />
                            <button 
                              className="csve-remove-extra-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'tip', null)}
                              title="Remove tip"
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        )}
                        
                        <div className="csve-guide-add-btns">
                          {(tutorStep.script === null || tutorStep.script === undefined) && (
                            <button 
                              className="csve-add-script-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'script', '')}
                            >
                              <i className="ri-add-line" />
                              Add Script
                            </button>
                          )}
                          {(tutorStep.tip === null || tutorStep.tip === undefined) && (
                            <button 
                              className="csve-add-tip-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'tip', '')}
                            >
                              <i className="ri-add-line" />
                              Add Tip
                            </button>
                          )}
                        </div>
                        
                        {step.tutorSteps.length > 1 && (
                          <button 
                            className="csve-guide-step-remove"
                            onClick={() => handleRemoveTutorStep(stepIdx, tutorIdx)}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    className="csve-add-guide-step-btn"
                    onClick={() => handleAddTutorStep(stepIdx)}
                  >
                    <i className="ri-add-line" />
                    Add Tutor Step
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Hidden file inputs */}
      <input ref={vocabImageInputRef} type="file" accept="image/*" onChange={handleVocabImageUpload} style={{ display: 'none' }} />
      <input ref={exprImageInputRef} type="file" accept="image/*" onChange={handleExprImageUpload} style={{ display: 'none' }} />
      <input ref={discussImageInputRef} type="file" accept="image/*" onChange={handleDiscussImageUpload} style={{ display: 'none' }} />
    </section>
  );
}
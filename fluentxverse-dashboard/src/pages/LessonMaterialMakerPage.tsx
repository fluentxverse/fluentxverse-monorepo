/**
 * LessonMaterialMakerPage - Simplified Data-Driven Lesson Editor
 * Uses JSON data structure that LessonRenderer can display
 */
import { useState, useCallback } from 'preact/hooks';
import type {
  LessonMaterial,
  LessonSection,
  TemplateInfo,
  SavedLesson,
  SectionType,
} from '../types/lesson.types';
import { createConversationalTemplate } from './templates/conversational.template';
import { toast } from '../Components/Toast/Toast';
import './LessonMaterialMakerPage.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'fxv_admin_lesson_material_draft_v3';
const SAVED_LESSONS_KEY = 'fxv_admin_saved_lessons_v2';

// Course templates
const COURSE_TEMPLATES: TemplateInfo[] = [
  {
    id: 'conversational-skills',
    name: 'Conversational Skills',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '💬',
    description: 'Speaking, Listening, and Reading combined template',
    sections: 12,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
  {
    id: 'young-learners',
    name: 'Young Learners',
    course: 'Young Learners',
    category: 'Kids',
    icon: '🧒',
    description: 'Fun activities for young English learners',
    sections: 10,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
  {
    id: 'business-english',
    name: 'Business English',
    course: 'Business English',
    category: 'Business',
    icon: '💼',
    description: 'Professional English for workplace',
    sections: 10,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
  {
    id: 'discussion-questions',
    name: 'Discussion Questions',
    course: 'Discussion Questions',
    category: 'Conversation',
    icon: '💡',
    description: '20 thought-provoking questions',
    sections: 1,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LessonMaterialMakerPage() {
  const [view, setView] = useState<'templates' | 'editor' | 'preview'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [lessonData, setLessonData] = useState<LessonMaterial | null>(null);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_LESSONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [activeSection, setActiveSection] = useState(0);
  const [previewMode, setPreviewMode] = useState<'tutor' | 'student'>('tutor');

  // Load template and create lesson data
  const handleSelectTemplate = useCallback((template: TemplateInfo) => {
    setSelectedTemplate(template);
    const data = createConversationalTemplate(); // For now, use conversational for all
    setLessonData(data);
    setView('editor');
    setActiveSection(0);
  }, []);

  // Save lesson
  const handleSave = useCallback(() => {
    if (!lessonData || !selectedTemplate) return;

    const lesson: SavedLesson = {
      id: `lesson-${Date.now()}`,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      level: 1,
      chapter: 1,
      lessonNumber: 1,
      goalName: lessonData.header.goalText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      draft: lessonData,
    };

    const updated = [...savedLessons, lesson];
    setSavedLessons(updated);
    localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessonData));
    toast.success('Lesson saved!');
  }, [lessonData, selectedTemplate, savedLessons]);

  // Update section data
  const updateSection = useCallback((index: number, updates: Partial<LessonSection>) => {
    if (!lessonData) return;
    const newSections = [...lessonData.sections];
    newSections[index] = { ...newSections[index], ...updates };
    setLessonData({ ...lessonData, sections: newSections });
  }, [lessonData]);

  // Update header
  const updateHeader = useCallback((updates: Partial<LessonMaterial['header']>) => {
    if (!lessonData) return;
    setLessonData({ ...lessonData, header: { ...lessonData.header, ...updates } });
  }, [lessonData]);

  // Render based on view
  if (view === 'templates') {
    return (
      <TemplateSelector
        templates={COURSE_TEMPLATES}
        savedLessons={savedLessons}
        onSelect={handleSelectTemplate}
        onLoadLesson={(lesson) => {
          setLessonData(lesson.draft);
          setSelectedTemplate(COURSE_TEMPLATES.find(t => t.id === lesson.templateId) || null);
          setView('editor');
        }}
      />
    );
  }

  if (view === 'preview' && lessonData) {
    return (
      <LessonPreview
        data={lessonData}
        mode={previewMode}
        onBack={() => setView('editor')}
        onModeChange={setPreviewMode}
      />
    );
  }

  if (view === 'editor' && lessonData) {
    return (
      <LessonEditor
        data={lessonData}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onUpdateSection={updateSection}
        onUpdateHeader={updateHeader}
        onSave={handleSave}
        onPreview={() => setView('preview')}
        onBack={() => setView('templates')}
      />
    );
  }

  return <div>Loading...</div>;
}

// ============================================================================
// TEMPLATE SELECTOR
// ============================================================================

function TemplateSelector({
  templates,
  savedLessons,
  onSelect,
  onLoadLesson,
}: {
  templates: TemplateInfo[];
  savedLessons: SavedLesson[];
  onSelect: (t: TemplateInfo) => void;
  onLoadLesson: (l: SavedLesson) => void;
}) {
  const [tab, setTab] = useState<'templates' | 'saved'>('templates');

  return (
    <div className="lm-page">
      <header className="lm-header">
        <h1>Lesson Material Maker</h1>
        <div className="lm-tabs">
          <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
            Templates
          </button>
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            My Lessons ({savedLessons.length})
          </button>
        </div>
      </header>

      {tab === 'templates' && (
        <div className="lm-grid">
          {templates.map((t) => (
            <div key={t.id} className="lm-template-card" onClick={() => onSelect(t)}>
              <span className="lm-icon">{t.icon}</span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <div className="lm-meta">
                <span>{t.sections} sections</span>
                <span>{t.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'saved' && (
        <div className="lm-grid">
          {savedLessons.length === 0 && (
            <p className="lm-empty">No saved lessons yet. Select a template to create one.</p>
          )}
          {savedLessons.map((lesson) => (
            <div key={lesson.id} className="lm-lesson-card" onClick={() => onLoadLesson(lesson)}>
              <h3>{lesson.goalName || 'Untitled Lesson'}</h3>
              <p>Level {lesson.level} • Chapter {lesson.chapter}</p>
              <div className="lm-meta">
                <span>{lesson.templateName}</span>
                <span>{new Date(lesson.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LESSON EDITOR
// ============================================================================

function LessonEditor({
  data,
  activeSection,
  onSectionChange,
  onUpdateSection,
  onUpdateHeader,
  onSave,
  onPreview,
  onBack,
}: {
  data: LessonMaterial;
  activeSection: number;
  onSectionChange: (i: number) => void;
  onUpdateSection: (i: number, u: Partial<LessonSection>) => void;
  onUpdateHeader: (u: Partial<LessonMaterial['header']>) => void;
  onSave: () => void;
  onPreview: () => void;
  onBack: () => void;
}) {
  const section = data.sections[activeSection];

  return (
    <div className="lm-editor">
      {/* Toolbar */}
      <div className="lm-toolbar">
        <button className="lm-btn-back" onClick={onBack}>← Back</button>
        <h2>{data.header.lessonLabel}</h2>
        <div className="lm-toolbar-actions">
          <button className="lm-btn" onClick={onPreview}>Preview</button>
          <button className="lm-btn lm-btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>

      <div className="lm-editor-layout">
        {/* Section Navigation */}
        <aside className="lm-sidebar">
          <h3>Sections</h3>
          {data.sections.map((s, i) => (
            <button
              key={s.id}
              className={`lm-section-btn ${i === activeSection ? 'active' : ''}`}
              onClick={() => onSectionChange(i)}
            >
              <span className="lm-section-num">{s.sectionNumber}</span>
              <span className="lm-section-name">{s.sectionTitle || s.stepTitle || s.sectionType}</span>
            </button>
          ))}
        </aside>

        {/* Editor Panel */}
        <main className="lm-main">
          {/* Header Editor (only show for first section) */}
          {activeSection === 0 && (
            <HeaderEditor header={data.header} onUpdate={onUpdateHeader} />
          )}

          {/* Section Editor */}
          <SectionEditor
            section={section}
            onUpdate={(updates) => onUpdateSection(activeSection, updates)}
          />
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER EDITOR
// ============================================================================

function HeaderEditor({
  header,
  onUpdate,
}: {
  header: LessonMaterial['header'];
  onUpdate: (u: Partial<LessonMaterial['header']>) => void;
}) {
  return (
    <div className="lm-card">
      <h3>Lesson Header</h3>
      <div className="lm-form-grid">
        <label>
          Level Badge
          <input value={header.levelBadge} onChange={(e) => onUpdate({ levelBadge: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Chapter Label
          <input value={header.chapterLabel} onChange={(e) => onUpdate({ chapterLabel: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Lesson Label
          <input value={header.lessonLabel} onChange={(e) => onUpdate({ lessonLabel: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Goal (English)
          <input value={header.goalText} onChange={(e) => onUpdate({ goalText: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Goal (Japanese)
          <input value={header.goalSubtext} onChange={(e) => onUpdate({ goalSubtext: (e.target as HTMLInputElement).value })} />
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION EDITOR - Routes to correct editor based on type
// ============================================================================

function SectionEditor({
  section,
  onUpdate,
}: {
  section: LessonSection;
  onUpdate: (u: Partial<LessonSection>) => void;
}) {
  return (
    <div className="lm-card">
      <div className="lm-section-header">
        <h3>{section.sectionTitle || section.stepTitle}</h3>
        <span className="lm-section-type">{section.sectionType}</span>
      </div>

      {/* Common fields */}
      <div className="lm-form-group">
        <label>
          Section Title
          <input value={section.sectionTitle || ''} onChange={(e) => onUpdate({ sectionTitle: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Step Title
          <input value={section.stepTitle || ''} onChange={(e) => onUpdate({ stepTitle: (e.target as HTMLInputElement).value })} />
        </label>
      </div>

      {/* Type-specific editor */}
      {renderSectionTypeEditor(section, onUpdate)}
    </div>
  );
}

function renderSectionTypeEditor(
  section: LessonSection,
  onUpdate: (u: Partial<LessonSection>) => void
) {
  switch (section.sectionType) {
    case 'introduce':
      return <IntroduceEditor section={section} onUpdate={onUpdate} />;
    case 'vocabulary':
      return <VocabularyEditor section={section} onUpdate={onUpdate} />;
    case 'grammar':
      return <GrammarEditor section={section} onUpdate={onUpdate} />;
    case 'dialogue':
      return <DialogueEditor section={section} onUpdate={onUpdate} />;
    case 'practice':
      return <PracticeEditor section={section} onUpdate={onUpdate} />;
    case 'challenge':
    case 'challenge2':
      return <ChallengeEditor section={section} onUpdate={onUpdate} />;
    default:
      return <GenericEditor section={section} onUpdate={onUpdate} />;
  }
}

// ============================================================================
// SECTION TYPE EDITORS
// ============================================================================

function IntroduceEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Explanation (English)
        <textarea value={section.explanationEn || ''} onChange={(e) => onUpdate({ explanationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Explanation (Japanese)
        <textarea value={section.explanationJp || ''} onChange={(e) => onUpdate({ explanationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Important Note
        <textarea value={section.importantNote || ''} onChange={(e) => onUpdate({ importantNote: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
    </div>
  );
}

function VocabularyEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const vocabCards = section.vocabCards || [];

  const updateCard = (index: number, field: string, value: string) => {
    const newCards = [...vocabCards];
    newCards[index] = { ...newCards[index], [field]: value };
    onUpdate({ vocabCards: newCards });
  };

  const addCard = () => {
    onUpdate({
      vocabCards: [...vocabCards, { id: `vocab-${Date.now()}`, image: '', wordEn: '', wordJp: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Instruction (English)
        <input value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Instruction (Japanese)
        <input value={section.instructionJp || ''} onChange={(e) => onUpdate({ instructionJp: (e.target as HTMLInputElement).value })} />
      </label>

      <h4>Vocabulary Cards</h4>
      <div className="lm-vocab-list">
        {vocabCards.map((card, i) => (
          <div key={card.id} className="lm-vocab-item">
            <input placeholder="English" value={card.wordEn} onChange={(e) => updateCard(i, 'wordEn', (e.target as HTMLInputElement).value)} />
            <input placeholder="Japanese" value={card.wordJp} onChange={(e) => updateCard(i, 'wordJp', (e.target as HTMLInputElement).value)} />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addCard}>+ Add Word</button>
      </div>
    </div>
  );
}

function GrammarEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Grammar Tip (English)
        <textarea value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
      <label>
        Grammar Tip (Japanese)
        <textarea value={section.instructionJp || ''} onChange={(e) => onUpdate({ instructionJp: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
      <p className="lm-hint">Grammar rules can be edited in JSON mode for complex structures.</p>
    </div>
  );
}

function DialogueEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const lines = section.dialogueLines || [];

  const updateLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    onUpdate({ dialogueLines: newLines });
  };

  const addLine = () => {
    onUpdate({
      dialogueLines: [...lines, { id: `line-${Date.now()}`, speaker: '', lineEn: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Situation (English)
        <textarea value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>

      <h4>Dialogue Lines</h4>
      <div className="lm-dialogue-list">
        {lines.map((line, i) => (
          <div key={line.id} className="lm-dialogue-item">
            <input placeholder="Speaker" value={line.speaker} onChange={(e) => updateLine(i, 'speaker', (e.target as HTMLInputElement).value)} className="lm-speaker" />
            <input placeholder="Line" value={line.lineEn} onChange={(e) => updateLine(i, 'lineEn', (e.target as HTMLInputElement).value)} className="lm-line" />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addLine}>+ Add Line</button>
      </div>
    </div>
  );
}

function PracticeEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const items = section.practiceItems || [];

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onUpdate({ practiceItems: newItems });
  };

  const addItem = () => {
    onUpdate({
      practiceItems: [...items, { id: `item-${Date.now()}`, question: '', answer: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Instruction (English)
        <input value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Example
        <input value={section.practiceExample || ''} onChange={(e) => onUpdate({ practiceExample: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Example Answer
        <input value={section.practiceExampleAnswer || ''} onChange={(e) => onUpdate({ practiceExampleAnswer: (e.target as HTMLInputElement).value })} />
      </label>

      <h4>Practice Items</h4>
      <div className="lm-practice-list">
        {items.map((item, i) => (
          <div key={item.id} className="lm-practice-item">
            <input placeholder="Question" value={item.question} onChange={(e) => updateItem(i, 'question', (e.target as HTMLInputElement).value)} />
            <input placeholder="Answer" value={item.answer} onChange={(e) => updateItem(i, 'answer', (e.target as HTMLInputElement).value)} />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addItem}>+ Add Item</button>
      </div>
    </div>
  );
}

function ChallengeEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Challenge Title
        <input value={section.challengeTitle || ''} onChange={(e) => onUpdate({ challengeTitle: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Situation (English)
        <textarea value={section.situationEn || ''} onChange={(e) => onUpdate({ situationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Situation (Japanese)
        <textarea value={section.situationJp || ''} onChange={(e) => onUpdate({ situationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
    </div>
  );
}

function GenericEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Explanation (English)
        <textarea value={section.explanationEn || ''} onChange={(e) => onUpdate({ explanationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Explanation (Japanese)
        <textarea value={section.explanationJp || ''} onChange={(e) => onUpdate({ explanationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
    </div>
  );
}

// ============================================================================
// LESSON PREVIEW
// ============================================================================

function LessonPreview({
  data,
  mode,
  onBack,
  onModeChange,
}: {
  data: LessonMaterial;
  mode: 'tutor' | 'student';
  onBack: () => void;
  onModeChange: (m: 'tutor' | 'student') => void;
}) {
  const [activeSection, setActiveSection] = useState(0);
  const sections = mode === 'student' ? data.sections.filter(s => s.sectionType !== 'feedback') : data.sections;
  const section = sections[activeSection];

  return (
    <div className="lm-preview">
      <div className="lm-preview-toolbar">
        <button onClick={onBack}>← Back to Editor</button>
        <div className="lm-mode-toggle">
          <button className={mode === 'tutor' ? 'active' : ''} onClick={() => onModeChange('tutor')}>Tutor View</button>
          <button className={mode === 'student' ? 'active' : ''} onClick={() => onModeChange('student')}>Student View</button>
        </div>
      </div>

      {/* Header Preview */}
      <header className="lp-header" style={{ background: data.header.overlayColor }}>
        <span className="lp-badge">{data.header.levelBadge}</span>
        <p className="lp-chapter">{data.header.chapterLabel}</p>
        <h1 className="lp-title">{data.header.lessonLabel}</h1>
        <div className="lp-goal">
          <p>{data.header.goalText}</p>
          <p className="lp-subtext">{data.header.goalSubtext}</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="lp-nav">
        {sections.map((s, i) => (
          <button key={s.id} className={i === activeSection ? 'active' : ''} onClick={() => setActiveSection(i)}>
            {s.sectionNumber}. {s.sectionTitle || s.stepTitle || s.sectionType}
          </button>
        ))}
      </nav>

      {/* Section Preview */}
      <div className="lp-content">
        <PreviewSection section={section} mode={mode} />
      </div>
    </div>
  );
}

function PreviewSection({ section, mode }: { section: LessonSection; mode: 'tutor' | 'student' }) {
  return (
    <div className={`lp-section lp-${section.sectionType}`}>
      {section.sectionTitle && <h2>{section.sectionTitle}</h2>}
      {section.stepTitle && <h3>{section.stepTitle}</h3>}
      {section.instructionEn && <p className="lp-instruction">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lp-instruction-jp">{section.instructionJp}</p>}
      {section.explanationEn && <p>{section.explanationEn}</p>}
      {section.explanationJp && <p className="lp-jp">{section.explanationJp}</p>}

      {/* Vocab cards */}
      {section.vocabCards && (
        <div className="lp-vocab-grid">
          {section.vocabCards.map(c => (
            <div key={c.id} className="lp-vocab-card">
              <span className="lp-en">{c.wordEn}</span>
              <span className="lp-jp">{c.wordJp}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dialogue */}
      {section.dialogueLines && (
        <div className="lp-dialogue">
          {section.dialogueLines.map(l => (
            <div key={l.id} className="lp-line">
              <span className="lp-speaker">{l.speaker}</span>
              <span>{l.lineEn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Practice items */}
      {section.practiceItems && (
        <ol className="lp-practice">
          {section.practiceItems.map(p => (
            <li key={p.id}>
              <p>{p.question}</p>
              {mode === 'tutor' && <p className="lp-answer">→ {p.answer}</p>}
            </li>
          ))}
        </ol>
      )}

      {/* Challenge */}
      {section.situationEn && (
        <div className="lp-situation">
          <p>{section.situationEn}</p>
          {section.situationJp && <p className="lp-jp">{section.situationJp}</p>}
        </div>
      )}

      {/* Tutor sidebar steps */}
      {mode === 'tutor' && section.lessonGoalSteps && (
        <aside className="lp-sidebar">
          <h4>{section.lessonGoalTitle || 'Tutor Steps'}</h4>
          <ol>
            {section.lessonGoalSteps.map((step, i) => (
              <li key={step.id}>
                {step.instruction && <p>{step.instruction}</p>}
                {step.scriptLine && <p className="lp-script">"{step.scriptLine}"</p>}
                {step.tipText && <p className="lp-tip">💡 {step.tipText}</p>}
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}

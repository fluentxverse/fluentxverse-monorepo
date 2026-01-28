/**
 * AI Content Generator Widget
 * Generates lesson content with tab-based section selection
 */
import { useState } from 'preact/hooks';
import { generateIntroductionContent, type IntroText, type LessonIssue, type LessonGoalStep } from '../api/ai.api';
import '../styles/AIContentGenerator.css';

export interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

type SectionType = 'introduce' | 'learn' | 'apply' | 'exercise';

interface SectionConfig {
  id: SectionType;
  label: string;
  number: number;
  icon: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'introduce', label: 'Introduce', number: 1, icon: 'ri-lightbulb-line', description: 'Opening & context' },
  { id: 'learn', label: 'Learn', number: 2, icon: 'ri-book-line', description: 'Step A & B vocabulary/grammar' },
  { id: 'apply', label: 'Apply', number: 3, icon: 'ri-chat-3-line', description: 'Practice activity' },
  { id: 'exercise', label: 'Exercise', number: 4, icon: 'ri-checkbox-circle-line', description: 'Exercises' },
];

interface AIContentGeneratorProps {
  topic: string;
  skillLevel: string;
  skill: 'speaking' | 'listening' | 'reading';
  currentIntroductionData?: IntroductionData | null;
  onGenerateIntroduction: (data: IntroductionData) => void;
  level?: number; // Lesson level (1-10) for complexity-based generation
  chapter?: number; // Chapter number for context
  lessonNumber?: number; // Lesson number for context
}

export function AIContentGenerator({
  topic,
  skillLevel,
  skill,
  currentIntroductionData,
  onGenerateIntroduction,
  level,
  chapter,
  lessonNumber,
}: AIContentGeneratorProps) {
  const [activeSection, setActiveSection] = useState<SectionType>('introduce');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<IntroductionData | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'new' | 'improve'>('new');
  const [baseInstructions, setBaseInstructions] = useState<Record<SectionType, string>>({
    introduce: 'Create an engaging introduction that hooks students with relevant context. Include discussion of why this topic matters and what they will learn.',
    learn: 'Generate clear vocabulary and grammar content with practical examples. Include explanations, translations, and usage examples that are easy to understand.',
    apply: 'Design practical speaking/listening activities that students can do. Include realistic scenarios, dialogues, or role-play situations.',
    exercise: 'Create engaging practice exercises that reinforce learning. Include varied question types, clear instructions, and answer keys.',
  });
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCurrentContent, setShowCurrentContent] = useState(false);
  const [includeLessonIssue, setIncludeLessonIssue] = useState(false);

  const currentSectionConfig = SECTIONS.find(s => s.id === activeSection)!;

  const handleGenerateIntroduction = async () => {
    if (!topic || !skillLevel) {
      setError('Please fill in topic and skill level first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await generateIntroductionContent(
        topic,
        skillLevel,
        skill,
        customPrompt, // Pass custom prompt if available
        generationMode === 'improve' ? currentIntroductionData : null, // Only pass current content if improving
        baseInstructions[activeSection], // Pass section-specific fixed instructions
        level, // Pass lesson level for complexity adjustment
        chapter, // Pass chapter for context
        lessonNumber, // Pass lesson number for context
        generationMode, // Pass generation mode to control behavior
        includeLessonIssue // Pass lesson issue toggle
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate content');
      }

      setGeneratedContent(response.data as IntroductionData);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate content');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertContent = () => {
    if (generatedContent) {
      onGenerateIntroduction(generatedContent);
      setShowPreview(false);
      setGeneratedContent(null);
    }
  };

  const handleDismiss = () => {
    setShowPreview(false);
    setGeneratedContent(null);
  };

  return (
    <>
      {/* Floating Toggle Button (when panel is closed) */}
      {!isOpen && (
        <button
          className="ai-fab-toggle"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
        >
          <i className="ri-magic-line" />
        </button>
      )}

      {/* Main Widget Panel */}
      <div className={`ai-content-generator ${isOpen ? 'ai-open' : 'ai-closed'}`}>
        <div className="ai-generator-header">
          <h3>
            <i className="ri-lightbulb-flash-line" />
            AI Assistant
          </h3>
          <p className="ai-generator-subtitle">Section {currentSectionConfig.number}: {currentSectionConfig.label}</p>
          <button
            className="ai-close-toggle-btn"
            onClick={() => setIsOpen(false)}
            title="Close AI Assistant"
          >
            <i className="ri-chevron-right-line" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="ai-tabs-container">
          <div className="ai-tabs">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                className={`ai-tab ${activeSection === section.id ? 'ai-tab-active' : ''}`}
                onClick={() => setActiveSection(section.id)}
                title={section.description}
              >
                <span className="ai-tab-number">{section.number}</span>
                <span className="ai-tab-label">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ai-generator-content">
          {/* Compact Fixed Instructions */}
          <div className="ai-base-instructions-section-compact">
            <label className="ai-instructions-label">
              <i className="ri-lightbulb-line" />
              Base Instructions
            </label>
            <textarea
              className="ai-instructions-input"
              value={baseInstructions[activeSection]}
              onChange={(e) => setBaseInstructions({ ...baseInstructions, [activeSection]: (e.target as HTMLTextAreaElement).value })}
              rows={4}
              placeholder="Core guidelines for content generation"
            />
          </div>

          {/* Compact Custom Prompt */}
          <div className="ai-prompt-section-compact">
            <label className="ai-prompt-label">Additional Notes</label>
            <textarea
              className="ai-prompt-input-compact"
              placeholder="Optional specific requirements..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
              rows={4}
            />
          </div>

          {/* Quick Preview Toggle */}
          {currentIntroductionData && (
            <button
              className="ai-preview-toggle-btn"
              onClick={() => setShowCurrentContent(!showCurrentContent)}
            >
              <i className={`${showCurrentContent ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
              <span>{showCurrentContent ? 'Hide' : 'Show'} Current</span>
            </button>
          )}

          {/* Compact Current Content Display */}
          {showCurrentContent && currentIntroductionData && (
            <div className="ai-current-content">
              <div className="ai-current-section">
                <strong>Current Introduction:</strong>
                {currentIntroductionData.introTexts.map((text: IntroText, idx: number) => (
                  <p key={idx} className="ai-current-text">
                    <span className="ai-lang-badge">{text.language.toUpperCase()}</span>
                    {text.text}
                  </p>
                ))}
              </div>
              {currentIntroductionData.lessonIssue && (
                <div className="ai-current-section">
                  <strong>Current Issue:</strong>
                  <p>{currentIntroductionData.lessonIssue.title}</p>
                </div>
              )}
            </div>
          )}

          {/* Generation Mode Toggle */}
          <div className="ai-mode-selector">
            <label className="ai-mode-label">Generation Mode</label>
            <div className="ai-mode-buttons">
              <button
                className={`ai-mode-btn ${generationMode === 'new' ? 'ai-mode-active' : ''}`}
                onClick={() => setGenerationMode('new')}
              >
                <i className="ri-refresh-line" />
                Generate New
              </button>
              <button
                className={`ai-mode-btn ${generationMode === 'improve' ? 'ai-mode-active' : ''}`}
                onClick={() => setGenerationMode('improve')}
                disabled={!currentIntroductionData}
              >
                <i className="ri-edit-line" />
                Improve Existing
              </button>
            </div>
          </div>

          {/* Lesson Issue Toggle (only in "Generate New" mode) */}
          {generationMode === 'new' && (
            <div className="ai-lesson-issue-toggle">
              <label className="ai-toggle-label">
                <input
                  type="checkbox"
                  checked={includeLessonIssue}
                  onChange={(e) => setIncludeLessonIssue((e.target as HTMLInputElement).checked)}
                  className="ai-toggle-checkbox"
                />
                <span className="ai-toggle-text">
                  <i className="ri-lightbulb-line" />
                  Include Lesson Issue
                </span>
              </label>
            </div>
          )}

          <button
            className="ai-generate-btn"
            onClick={handleGenerateIntroduction}
            disabled={isGenerating || !topic || !skillLevel}
          >
            <i className={`${isGenerating ? 'ri-loader-4-line' : 'ri-magic-line'}`} />
            <span>{isGenerating ? 'Generating...' : `Generate ${currentSectionConfig.label}`}</span>
          </button>

          {error && <div className="ai-error-message">{error}</div>}
        </div>

      {showPreview && generatedContent && (
        <div className="ai-preview-modal">
          <div className="ai-preview-overlay" onClick={handleDismiss} />
          <div className="ai-preview-content">
            <div className="ai-preview-header">
              <h4>Preview Generated Content</h4>
              <button className="ai-close-btn" onClick={handleDismiss}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="ai-preview-body">
              {/* Introduction Texts */}
              <div className="ai-preview-section">
                <h5>Introduction Texts</h5>
                {generatedContent.introTexts.map((text: IntroText, idx: number) => (
                  <div key={idx} className="ai-preview-item">
                    <span className="ai-preview-label">{text.language.toUpperCase()}</span>
                    <p>{text.text}</p>
                  </div>
                ))}
              </div>

              {/* Lesson Issue */}
              {generatedContent.lessonIssue && (
                <div className="ai-preview-section">
                  <h5>Lesson Issue</h5>
                  <div className="ai-preview-item">
                    <strong className="ai-issue-title">{generatedContent.lessonIssue.title}</strong>
                    <ul>
                      {generatedContent.lessonIssue.points.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Lesson Goal Duration */}
              <div className="ai-preview-section">
                <h5>Duration</h5>
                <p className="ai-duration">{generatedContent.lessonGoalDuration}</p>
              </div>

              {/* Lesson Goal Steps */}
              <div className="ai-preview-section">
                <h5>Tutor Steps</h5>
                {generatedContent.lessonGoalSteps.map((step: LessonGoalStep, idx: number) => (
                  <div key={idx} className="ai-preview-item">
                    <strong className="ai-step-num">Step {idx + 1}</strong>
                    <p className="ai-step-instruction">{step.instruction}</p>
                    {step.script && <p className="ai-step-script">📝 Script: {step.script}</p>}
                    {step.question && <p className="ai-step-question">❓ Question: {step.question}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-preview-footer">
              <button className="ai-btn-cancel" onClick={handleDismiss}>
                Cancel
              </button>
              <button className="ai-btn-insert" onClick={handleInsertContent}>
                <i className="ri-check-line" />
                Insert Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

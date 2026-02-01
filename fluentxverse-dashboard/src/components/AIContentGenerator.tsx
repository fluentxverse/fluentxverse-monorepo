/**
 * AI Content Generator Widget
 * Generates lesson content with tab-based section selection
 */
import { useState, useEffect } from 'preact/hooks';
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
  onGenerateLearn?: (data: any) => void;
  onGenerateStepB?: (data: any) => void;
  level?: number;
  chapter?: number;
  lessonNumber?: number;
  lessonGoal: string;
  // Current step types from the editor - these tell us what's currently selected
  currentStepAType?: 'vocabulary' | 'expressions';
  currentStepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation';
  // Current item counts in the editor - AI will generate this many items
  vocabularyCount?: number;
  expressionCount?: number;
}

export function AIContentGenerator({
  topic,
  skillLevel,
  skill,
  currentIntroductionData,
  onGenerateIntroduction,
  onGenerateLearn,
  onGenerateStepB,
  level,
  chapter,
  lessonNumber,
  lessonGoal,
  currentStepAType = 'vocabulary',
  currentStepBType = 'speak-your-mind',
  vocabularyCount,
  expressionCount,
}: AIContentGeneratorProps) {
  const DEFAULT_BASE_INSTRUCTIONS: Record<SectionType, string> = {
    introduce: 'Create an engaging introduction that hooks students with relevant context. Include discussion of why this topic matters and what they will learn.',
    learn: 'Generate clear vocabulary and grammar content with practical examples. Include explanations, translations, and usage examples that are easy to understand.',
    apply: 'Design practical speaking/listening activities that students can do. Include realistic scenarios, dialogues, or role-play situations.',
    exercise: 'Create engaging practice exercises that reinforce learning. Include varied question types, clear instructions, and answer keys.',
  };

  const [activeSection, setActiveSection] = useState<SectionType>('introduce');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any | null>(null);
  const [generatedSection, setGeneratedSection] = useState<SectionType | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'new' | 'improve'>('new');
  const [baseInstructions, setBaseInstructions] = useState<Record<SectionType, string>>(DEFAULT_BASE_INSTRUCTIONS);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCurrentContent, setShowCurrentContent] = useState(false);
  const [includeLessonIssue, setIncludeLessonIssue] = useState(false);
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [translationLanguage, setTranslationLanguage] = useState<'japanese' | 'korean' | 'vietnamese' | 'chinese'>('japanese');
  // For Learn section: track which step (A or B) to generate
  const [learnStep, setLearnStep] = useState<'stepA' | 'stepB'>('stepA');

  // Load base instructions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-base-instructions');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBaseInstructions({ ...DEFAULT_BASE_INSTRUCTIONS, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load base instructions from localStorage:', e);
    }
  }, []);

  // Save base instructions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ai-base-instructions', JSON.stringify(baseInstructions));
    } catch (e) {
      console.error('Failed to save base instructions to localStorage:', e);
    }
  }, [baseInstructions]);

  const currentSectionConfig = SECTIONS.find(s => s.id === activeSection)!;

  const handleGenerateIntroduction = async () => {
    if (!topic || !skillLevel) {
      setError('Please fill in topic and skill level first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // Determine which learnType or stepBType to pass based on the Learn section's selected step
      const learnType = activeSection === 'learn' && learnStep === 'stepA' ? currentStepAType : undefined;
      const stepBType = activeSection === 'learn' && learnStep === 'stepB' ? currentStepBType : undefined;

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
        includeLessonIssue, // Pass lesson issue toggle
        lessonGoal, // Pass lesson goal for context-based generation
        learnType, // Pass Step A type only when in Learn section with Step A selected
        stepBType, // Pass Step B type only when in Learn section with Step B selected
        includeTranslation, // Pass translation toggle
        translationLanguage, // Pass selected translation language
        vocabularyCount, // Pass current vocabulary count from editor
        expressionCount // Pass current expression count from editor
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate content');
      }

      setGeneratedContent(response.data);
      setGeneratedSection(activeSection); // Track which section generated this content
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
      // Only insert if the generated content is from the current section to prevent mixing
      if (generatedSection !== activeSection) {
        setError(`This content was generated for the ${generatedSection} section, not the current ${activeSection} section. Cannot insert.`);
        return;
      }

      // If we're in the Learn section and have vocabulary data, build LearnSectionData
      if (activeSection === 'learn' && generatedContent.learnVocabulary && onGenerateLearn) {
        const vocab = (generatedContent.learnVocabulary || []).map((v: any) => ({
          image: '',
          englishText: v.word || '',
          highlightedWord: v.word || undefined,
          translation: v.translation || v.meaning || '', // Use AI-generated translation if available
        }));

        const learnPayload = {
          sectionTitle: 'LEARN',
          steps: [
            {
              stepType: 'vocabulary',
              stepName: 'STEP A VOCABULARY',
              duration: '2 minutes',
              partLabel: 'I. Listen and repeat.',
              partTranslation: undefined,
              vocabularyItems: vocab,
              tutorSteps: [
                { instruction: 'Introduce Learn.', script: "Now, let's try Learn. First we have Step A Vocabulary. Let's do Part I. Can you see the pictures and text?", tip: null },
                { instruction: 'Read the instructions.', script: null, tip: null },
                { instruction: "Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
                { instruction: 'Repeat Step 3 with the remaining vocabulary.', script: null, tip: null },
                { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
              ]
            },
          ],
        };

        onGenerateLearn(learnPayload);
      } 
      // If we have expressions data, build LearnSectionData with expressions
      else if (activeSection === 'learn' && generatedContent.learnExpressions && onGenerateLearn) {
        const expressions = (generatedContent.learnExpressions || []).map((e: any) => ({
          image: '',
          definitionLine: e.definitionLine || '',
          exampleSentence: e.exampleSentence || '',
          extraText: '',
          translation: e.translation || '', // Include AI-generated translation
        }));

        const learnPayload = {
          sectionTitle: 'LEARN',
          steps: [
            {
              stepType: 'expressions',
              stepName: 'STEP A EXPRESSIONS',
              duration: '4 minutes',
              partLabel: 'I. Go over the expressions with your tutor.',
              partTranslation: undefined,
              expressionItems: expressions,
              tutorSteps: [
                { instruction: 'Introduce Present.', script: "Now, let's try Present. First we have Step A Expressions. Let's do Part I. Can you see the pictures and text?", tip: null },
                { instruction: 'Read the instructions.', script: null, tip: null },
                { instruction: "Read the first expression's explanation.", script: null, tip: null },
                { instruction: 'Read the italicized example sentence and ask the student to repeat. Correct their pronunciation if necessary.', script: null, tip: null },
                { instruction: 'Repeat Steps 3-4 with the remaining expressions.', script: null, tip: null },
                { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
              ]
            },
          ],
        };

        onGenerateLearn(learnPayload);
      }
      // If we have Step B data, build StepBData
      else if (activeSection === 'learn' && generatedContent.stepB && onGenerateStepB) {
        const stepBData = generatedContent.stepB;
        
        if (stepBData.stepType === 'speak-your-mind' && stepBData.speakYourMind) {
          const sym = stepBData.speakYourMind;
          onGenerateStepB({
            stepType: 'speak-your-mind',
            speakYourMind: {
              stepName: 'STEP B SPEAK YOUR MIND',
              duration: '3 minutes',
              explanation: sym.explanation || '',
              explanationTranslation: '',
              speaker1: { image: '', speechBubble: sym.speaker1SpeechBubble || '' },
              speaker2: { image: '', speechBubble: sym.speaker2SpeechBubble || '' },
              question: sym.question || '',
              tutorSteps: [
                { instruction: 'Introduce the grammar/expression concept.', script: null, tip: null },
                { instruction: 'Read the dialogue with the student.', script: null, tip: null },
                { instruction: 'Ask the student the follow-up question.', script: null, tip: null },
              ]
            }
          });
        } else if (stepBData.stepType === 'grammar-tip' && stepBData.grammarTip) {
          const gt = stepBData.grammarTip;
          onGenerateStepB({
            stepType: 'grammar-tip',
            grammarTip: {
              stepName: 'STEP B GRAMMAR TIP',
              duration: '3 minutes',
              explanations: gt.explanations || [],
              tutorSteps: [
                { instruction: 'Read each grammar rule.', script: null, tip: null },
                { instruction: 'Go through the examples with the student.', script: null, tip: null },
              ]
            }
          });
        } else if (stepBData.stepType === 'pronunciation' && stepBData.pronunciation) {
          const pron = stepBData.pronunciation;
          onGenerateStepB({
            stepType: 'pronunciation',
            pronunciation: {
              stepName: 'STEP B PRONUNCIATION',
              duration: '2 minutes',
              tip: pron.tip || '',
              phrases: pron.phrases || [],
              tutorSteps: [
                { instruction: 'Explain the pronunciation tip.', script: null, tip: null },
                { instruction: 'Practice each phrase with the student.', script: null, tip: null },
              ]
            }
          });
        }
      } else {
        onGenerateIntroduction(generatedContent);
      }
      setShowPreview(false);
      setGeneratedContent(null);
      setGeneratedSection(null);
    }
  };

  const handleDismiss = () => {
    setShowPreview(false);
    setGeneratedContent(null);
    setGeneratedSection(null);
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
            <i className="ri-close-line" />
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

        {/* Learn Section Step Selector - Show only when Learn tab is active */}
        {activeSection === 'learn' && (
          <div className="ai-learn-step-selector">
            <div className="ai-step-toggle">
              <button
                className={`ai-step-btn ${learnStep === 'stepA' ? 'ai-step-active' : ''}`}
                onClick={() => setLearnStep('stepA')}
              >
                <span className="ai-step-letter">A</span>
                <span className="ai-step-type">
                  {currentStepAType === 'vocabulary' ? 'Vocabulary' : 'Expressions'}
                </span>
              </button>
              <button
                className={`ai-step-btn ${learnStep === 'stepB' ? 'ai-step-active' : ''}`}
                onClick={() => setLearnStep('stepB')}
              >
                <span className="ai-step-letter">B</span>
                <span className="ai-step-type">
                  {currentStepBType === 'speak-your-mind' ? 'Speak Your Mind' :
                   currentStepBType === 'grammar-tip' ? 'Grammar Tip' : 'Pronunciation'}
                </span>
              </button>
            </div>
            <p className="ai-step-hint">
              {learnStep === 'stepA' 
                ? `Will generate ${currentStepAType} content for Step A`
                : `Will generate ${currentStepBType.replace(/-/g, ' ')} content for Step B`
              }
            </p>
          </div>
        )}

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

          {/* Lesson Issue Toggle (only in "Generate New" mode and Introduce section) */}
          {generationMode === 'new' && activeSection === 'introduce' && (
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

          {/* Translation Toggle (available for all sections) */}
          <div className="ai-lesson-issue-toggle">
            <label className="ai-toggle-label">
              <input
                type="checkbox"
                checked={includeTranslation}
                onChange={(e) => setIncludeTranslation((e.target as HTMLInputElement).checked)}
                className="ai-toggle-checkbox"
              />
              <span className="ai-toggle-text">
                <i className="ri-translate-2" />
                Include Translations
              </span>
            </label>
            {includeTranslation && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'japanese', label: '日本語', flag: '🇯🇵' },
                  { id: 'korean', label: '한국어', flag: '🇰🇷' },
                  { id: 'vietnamese', label: 'Tiếng Việt', flag: '🇻🇳' },
                  { id: 'chinese', label: '中文', flag: '🇨🇳' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setTranslationLanguage(lang.id as any)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      border: translationLanguage === lang.id ? '1px solid var(--matrix-green)' : '1px solid rgba(0, 255, 65, 0.25)',
                      borderRadius: '4px',
                      background: translationLanguage === lang.id ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                      color: translationLanguage === lang.id ? 'var(--matrix-green)' : 'var(--matrix-text-dim)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'inherit',
                      boxShadow: translationLanguage === lang.id ? '0 0 10px var(--matrix-green-glow)' : 'none',
                    }}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              {/* Learn -> Vocabulary Preview */}
              {generatedContent.learnVocabulary && generatedContent.learnVocabulary.length > 0 ? (
                <div className="ai-preview-section">
                  <h5>Vocabulary (Learn - Step A)</h5>
                  <div className="ai-preview-item">
                    <ul>
                      {generatedContent.learnVocabulary.map((v: any, idx: number) => (
                        <li key={idx}>
                          <strong>{v.word}</strong>
                          {v.partOfSpeech ? ` (${v.partOfSpeech})` : ''} — {v.meaning}
                          {v.translation && <span style={{ color: '#a0a0a0', marginLeft: '8px' }}>({v.translation})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : generatedContent.learnExpressions && generatedContent.learnExpressions.length > 0 ? (
                <div className="ai-preview-section">
                  <h5>Expressions (Learn - Step A)</h5>
                  <div className="ai-preview-item">
                    {generatedContent.learnExpressions.map((e: any, idx: number) => (
                      <div key={idx} className="ai-expression-item" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <strong style={{ color: '#4faafe', fontSize: '15px' }}>{e.expression}</strong>
                        {e.translation && <span style={{ color: '#a0a0a0', marginLeft: '8px', fontSize: '13px' }}>({e.translation})</span>}
                        <p style={{ color: '#e0e0e0', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: e.definitionLine }} />
                        <p style={{ fontStyle: 'italic', color: '#a0c4e8', marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: e.exampleSentence }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : generatedContent.stepB ? (
                <div className="ai-preview-section">
                  <h5>
                    {generatedContent.stepB.stepType === 'speak-your-mind' ? 'Speak Your Mind' :
                     generatedContent.stepB.stepType === 'grammar-tip' ? 'Grammar Tip' : 'Pronunciation'} 
                    (Learn - Step B)
                  </h5>
                  <div className="ai-preview-item">
                    {generatedContent.stepB.stepType === 'speak-your-mind' && generatedContent.stepB.speakYourMind && (
                      <>
                        <p><strong style={{ color: '#4faafe' }}>Explanation:</strong></p>
                        <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.explanation }} />
                        <div style={{ display: 'flex', gap: '20px', margin: '10px 0' }}>
                          <div style={{ flex: 1, background: 'rgba(79, 170, 254, 0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <strong style={{ color: '#4faafe' }}>Speaker 1:</strong>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.speaker1SpeechBubble }} />
                          </div>
                          <div style={{ flex: 1, background: 'rgba(100, 200, 150, 0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(100, 200, 150, 0.3)' }}>
                            <strong style={{ color: '#64c896' }}>Speaker 2:</strong>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.speaker2SpeechBubble }} />
                          </div>
                        </div>
                        <p><strong style={{ color: '#4faafe' }}>Question:</strong> <span style={{ color: '#e0e0e0' }}>{generatedContent.stepB.speakYourMind.question}</span></p>
                      </>
                    )}
                    {generatedContent.stepB.stepType === 'grammar-tip' && generatedContent.stepB.grammarTip && (
                      <>
                        {generatedContent.stepB.grammarTip.explanations?.map((exp: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '15px' }}>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: exp.ruleText }} />
                            {exp.ruleTranslation && <p style={{ color: '#a0a0a0' }}>{exp.ruleTranslation}</p>}
                            {exp.examples?.map((ex: any, exIdx: number) => (
                              <div key={exIdx} style={{ marginLeft: '10px', borderLeft: '2px solid rgba(79, 170, 254, 0.5)', paddingLeft: '10px', marginTop: '8px' }}>
                                <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: ex.sentence }} />
                                <p style={{ color: '#a0a0a0', fontSize: '0.9em' }}>{ex.translation}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                    {generatedContent.stepB.stepType === 'pronunciation' && generatedContent.stepB.pronunciation && (
                      <>
                        <p><strong style={{ color: '#4faafe' }}>Tip:</strong> <span style={{ color: '#e0e0e0' }}>{generatedContent.stepB.pronunciation.tip}</span></p>
                        {generatedContent.stepB.pronunciation.phrases?.map((p: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <strong style={{ color: '#4faafe' }}>{p.phrase}</strong>
                            <span style={{ marginLeft: '10px', color: '#a0c4e8' }}>{p.pronunciationGuide}</span>
                            <p style={{ color: '#e0e0e0', marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: p.exampleSentence }} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Introduction Texts */}
                  <div className="ai-preview-section">
                    <h5>Introduction Texts</h5>
                    {generatedContent.introTexts?.map((text: IntroText, idx: number) => (
                      <div key={idx} className="ai-preview-item">
                        <span className="ai-preview-label">{text.language.toUpperCase()}</span>
                        <p>{text.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Lesson Issue */}
                  {generatedContent.lessonIssue && generatedContent.lessonIssue.title && (
                    <div className="ai-preview-section">
                      <h5>Lesson Issue</h5>
                      <div className="ai-preview-item">
                        <strong className="ai-issue-title">{generatedContent.lessonIssue.title}</strong>
                        <ul>
                          {generatedContent.lessonIssue.points?.map((point: string, idx: number) => (
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
                  {generatedContent.lessonGoalSteps?.length > 0 && (
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
                  )}
                </>
              )}
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

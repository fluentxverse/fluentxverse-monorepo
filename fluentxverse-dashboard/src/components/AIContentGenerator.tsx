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

type SectionType = 'introduce' | 'learn' | 'apply' | 'trivia' | 'exercise' | 'mission';

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
  { id: 'trivia', label: 'Trivia', number: 0, icon: 'ri-lightbulb-flash-line', description: 'Trivia Time content' },
  { id: 'exercise', label: 'Exercise', number: 4, icon: 'ri-checkbox-circle-line', description: 'Exercises' },
  { id: 'mission', label: 'Mission', number: 5, icon: 'ri-rocket-line', description: 'Challenge activities' },
];

interface AIContentGeneratorProps {
  topic: string;
  skillLevel: string;
  skill: 'speaking' | 'listening' | 'reading';
  currentIntroductionData?: IntroductionData | null;
  onGenerateIntroduction: (data: IntroductionData) => void;
  onGenerateLearn?: (data: any) => void;
  onGenerateStepB?: (data: any) => void;
  onGenerateApply?: (data: any) => void;
  onGenerateTrivia?: (data: any) => void;
  onGenerateExercise?: (data: any) => void;
  onGenerateMission?: (data: any) => void;
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
  // Current apply activity type
  currentApplyType?: 'speaking' | 'listening' | 'reading';
  // Current dialogue line count (for speaking apply)
  dialogueLineCount?: number;
  // Exercise section props
  currentExerciseStepAType?: 'rephrase' | 'choose' | 'change';
  currentExerciseStepBType?: 'conversation' | 'multiple-choice' | 'speech' | 'compare';
  exerciseItemCount?: number;
  hasExerciseStepB?: boolean;
  // Mission section props
  currentMissionType?: 'speaking' | 'discussion' | 'reading' | 'listening';
  missionQuestionCount?: number;
}

export function AIContentGenerator({
  topic,
  skillLevel,
  skill,
  currentIntroductionData,
  onGenerateIntroduction,
  onGenerateLearn,
  onGenerateStepB,
  onGenerateApply,
  onGenerateTrivia,
  onGenerateExercise,
  onGenerateMission,
  level,
  chapter,
  lessonNumber,
  lessonGoal,
  currentStepAType = 'vocabulary',
  currentStepBType = 'speak-your-mind',
  vocabularyCount,
  expressionCount,
  currentApplyType = 'speaking',
  dialogueLineCount,
  currentExerciseStepAType = 'rephrase',
  currentExerciseStepBType = 'conversation',
  exerciseItemCount,
  hasExerciseStepB = false,
  currentMissionType = 'speaking',
  missionQuestionCount,
}: AIContentGeneratorProps) {
  const DEFAULT_BASE_INSTRUCTIONS: Record<SectionType, string> = {
    introduce: 'Create an engaging introduction that hooks students with relevant context. Include discussion of why this topic matters and what they will learn.',
    learn: 'Generate clear vocabulary and grammar content with practical examples. Include explanations, translations, and usage examples that are easy to understand.',
    apply: 'Design practical speaking/listening activities that students can do. Include realistic scenarios, dialogues, or role-play situations.',
    trivia: 'Create interesting cultural trivia or fun language facts related to the lesson topic. Include engaging questions for discussion.',
    exercise: 'Create engaging practice exercises that reinforce learning. Include varied question types, clear instructions, and answer keys.',
    mission: 'Create immersive challenge activities that let students apply their learning in realistic scenarios. Include roleplay situations, discussion topics, or reading/listening comprehension tasks.',
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
  // For Exercise section: track which step (A or B) to generate
  const [exerciseStep, setExerciseStep] = useState<'stepA' | 'stepB'>('stepA');

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

      // Determine apply type when in Apply section
      const applyType = activeSection === 'apply' ? currentApplyType : undefined;

      // Check if we're generating trivia
      const generateTrivia = activeSection === 'trivia';

      // Check if we're generating exercise content
      const exerciseType = activeSection === 'exercise' 
        ? (exerciseStep === 'stepA' ? currentExerciseStepAType : currentExerciseStepBType)
        : undefined;
      const exerciseStepType = activeSection === 'exercise' ? exerciseStep : undefined;

      // Check if we're generating mission content
      const missionType = activeSection === 'mission' ? currentMissionType : undefined;

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
        expressionCount, // Pass current expression count from editor
        applyType, // Pass apply activity type (speaking/listening/reading)
        dialogueLineCount, // Pass current dialogue line count from editor
        generateTrivia, // Pass trivia generation flag
        exerciseType, // Pass exercise type (rephrase/choose/change or conversation/multiple-choice/speech/compare)
        exerciseStepType, // Pass exercise step (stepA or stepB)
        exerciseItemCount, // Pass exercise item count
        missionType, // Pass mission type (speaking/discussion/reading/listening)
        missionQuestionCount // Pass mission question count
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
      }
      // Handle Apply section content
      else if (activeSection === 'apply' && generatedContent.applyData && onGenerateApply) {
        const apply = generatedContent.applyData;
        
        // Build the Apply payload based on activity type
        const applyPayload = {
          sectionNumber: 3,
          sectionTitle: 'APPLY',
          activityType: apply.activityType || currentApplyType,
          activityTitle: (apply.activityType || currentApplyType).toUpperCase(),
          activityDuration: apply.activityDuration || '3 minutes',
          situationText: apply.situationText || '',
          situationTranslation: apply.situationTranslation || '',
          situationImage: '',
          dialogueLines: (apply.dialogueLines || []).map((line: any) => ({
            speaker: line.speaker || '',
            text: line.text || '',
            isAction: line.isAction || false,
          })),
          readingText: apply.readingText || '',
          readingImage: '',
          readingImageLabel: '',
          tutorSteps: (apply.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            questions: step.questions || [],
            listeningScript: step.listeningScript || '',
          })),
          triviaEnabled: apply.triviaEnabled || false,
          triviaText: apply.triviaText || '',
          triviaTranslation: apply.triviaTranslation || '',
          triviaImage: '',
          triviaDuration: apply.triviaDuration || '1 minute',
          triviaTutorSteps: apply.triviaTutorSteps || [],
        };

        onGenerateApply(applyPayload);
      }
      // Handle Trivia section content (separate from Apply)
      else if (activeSection === 'trivia' && generatedContent.triviaData && onGenerateTrivia) {
        const trivia = generatedContent.triviaData;
        
        const triviaPayload = {
          triviaEnabled: true,
          triviaText: trivia.triviaText || '',
          triviaTranslation: trivia.triviaTranslation || '',
          triviaImage: '',
          triviaDuration: trivia.triviaDuration || '1 minute',
          triviaTutorSteps: (trivia.triviaTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            questions: step.questions || [],
          })),
        };

        onGenerateTrivia(triviaPayload);
      }
      // Handle Exercise section content
      else if (activeSection === 'exercise' && generatedContent.exerciseData && onGenerateExercise) {
        const exercise = generatedContent.exerciseData;
        
        const exercisePayload = {
          exerciseStep: exercise.exerciseStep,
          exerciseType: exercise.exerciseType,
          // Step A common fields
          instructions: exercise.instructions || '',
          instructionsTranslation: exercise.instructionsTranslation || '',
          // Step A - Rephrase fields
          showExpressions: exercise.showExpressions || false,
          expressions: exercise.expressions || [],
          showExample: exercise.showExample || false,
          exampleSentence: exercise.exampleSentence || '',
          exampleAnswer: exercise.exampleAnswer || '',
          exerciseItems: (exercise.exerciseItems || []).map((item: any) => ({
            image: '',
            sentence: item.sentence || '',
          })),
          // Step A - Choose fields
          chooseItems: (exercise.chooseItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Step A - Change fields
          changeItems: (exercise.changeItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Answer key
          answers: (exercise.answers || []).map((answer: any) => ({
            text: answer.text || '',
          })),
          // Tutor steps
          tutorSteps: (exercise.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            answerKey: step.answerKey || [],
          })),
          // Step B common fields
          stepBInstruction: exercise.stepBInstruction || '',
          stepBInstructionTranslation: exercise.stepBInstructionTranslation || '',
          // Step B - Conversation fields
          conversations: (exercise.conversations || []).map((conv: any) => ({
            speakerImage: '',
            speechBubble: conv.speechBubble || '',
            position: conv.position || 'left',
          })),
          // Step B - Multiple Choice fields
          multipleChoiceItems: (exercise.multipleChoiceItems || []).map((item: any) => ({
            boldSentence: item.boldSentence || '',
            optionA: item.optionA || '',
            optionB: item.optionB || '',
          })),
          // Step B - Speech fields
          speechContent: exercise.speechContent || '',
          // Step B - Compare fields
          compareWordBox: exercise.compareWordBox || [],
          compareImages: (exercise.compareImages || []).map((img: any) => ({
            image: '',
            label: img.label || '',
          })),
          compareExample: exercise.compareExample || '',
          compareItems: (exercise.compareItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Step B tutor steps
          stepBTutorSteps: (exercise.stepBTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
          })),
        };

        onGenerateExercise(exercisePayload);
      }
      // Handle Mission section content
      else if (activeSection === 'mission' && generatedContent.missionData && onGenerateMission) {
        const mission = generatedContent.missionData;
        
        const missionPayload = {
          missionType: mission.missionType,
          sectionNumber: 5,
          sectionTitle: 'MISSION',
          challengeNumber: mission.challengeNumber || 1,
          challengeName: mission.challengeName || 'Challenge 1',
          duration: mission.duration || '5-6 minutes',
          situation: mission.situation || '',
          situationTranslation: mission.situationTranslation || '',
          instruction: mission.instruction || '',
          instructionTranslation: mission.instructionTranslation || '',
          showGrammarTip: mission.showGrammarTip || false,
          grammarTipTitle: mission.grammarTipTitle || "Today's grammar tip",
          grammarTipItems: mission.grammarTipItems || [],
          image: '',
          tutorSteps: (mission.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            listeningScript: step.listeningScript || '',
          })),
          questionsIntro: mission.questionsIntro || '',
          questions: (mission.questions || []).map((q: any) => ({
            question: q.question || '',
            hints: q.hints || [],
          })),
          // Discussion type specific
          isOptional: mission.isOptional || false,
          topics: (mission.topics || []).map((topic: any) => ({
            title: topic.title || '',
            questions: topic.questions || [],
          })),
          // Reading type specific
          readingPassage: mission.readingPassage ? {
            title: mission.readingPassage.title || '',
            author: mission.readingPassage.author || '',
            blocks: (mission.readingPassage.blocks || []).map((block: any) => ({
              type: block.type || 'paragraph',
              text: block.text || '',
              image: block.image || '',
            })),
            closingQuestion: mission.readingPassage.closingQuestion || '',
          } : undefined,
          // Listening type specific
          listeningScript: mission.listeningScript || '',
        };

        onGenerateMission(missionPayload);
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

        {/* Apply Section Type Indicator - Show only when Apply tab is active */}
        {activeSection === 'apply' && (
          <div className="ai-apply-indicator">
            <div className="ai-apply-type">
              <i className={`${
                currentApplyType === 'speaking' ? 'ri-mic-line' :
                currentApplyType === 'listening' ? 'ri-headphone-line' : 'ri-book-open-line'
              }`} />
              <span className="ai-apply-type-label">
                {currentApplyType.charAt(0).toUpperCase() + currentApplyType.slice(1)} Activity
              </span>
            </div>
            <p className="ai-step-hint">
              Will generate {currentApplyType} content with {dialogueLineCount || 'default'} dialogue lines
            </p>
          </div>
        )}

        {/* Trivia Section Indicator - Show only when Trivia tab is active */}
        {activeSection === 'trivia' && (
          <div className="ai-apply-indicator ai-trivia-indicator">
            <div className="ai-apply-type">
              <i className="ri-lightbulb-flash-line" />
              <span className="ai-apply-type-label">Trivia Time</span>
            </div>
            <p className="ai-step-hint">
              Will generate cultural trivia, fun facts, and discussion questions
            </p>
          </div>
        )}

        {/* Exercise Section Step Selector - Show only when Exercise tab is active */}
        {activeSection === 'exercise' && (
          <div className="ai-learn-step-selector ai-exercise-selector">
            <div className="ai-step-toggle">
              <button
                className={`ai-step-btn ${exerciseStep === 'stepA' ? 'ai-step-active' : ''}`}
                onClick={() => setExerciseStep('stepA')}
              >
                <span className="ai-step-letter">A</span>
                <span className="ai-step-type">
                  {currentExerciseStepAType === 'rephrase' ? 'Rephrase' :
                   currentExerciseStepAType === 'choose' ? 'Choose' : 'Change'}
                </span>
              </button>
              <button
                className={`ai-step-btn ${exerciseStep === 'stepB' ? 'ai-step-active' : ''}`}
                onClick={() => setExerciseStep('stepB')}
                disabled={!hasExerciseStepB}
                title={!hasExerciseStepB ? 'Step B is not enabled in the editor' : ''}
              >
                <span className="ai-step-letter">B</span>
                <span className="ai-step-type">
                  {currentExerciseStepBType === 'conversation' ? 'Conversation' :
                   currentExerciseStepBType === 'multiple-choice' ? 'Multiple Choice' :
                   currentExerciseStepBType === 'speech' ? 'Speech' : 'Compare'}
                </span>
              </button>
            </div>
            <p className="ai-step-hint">
              {exerciseStep === 'stepA' 
                ? `Will generate ${currentExerciseStepAType} exercise with ${exerciseItemCount || 'default'} items`
                : `Will generate ${currentExerciseStepBType.replace(/-/g, ' ')} exercise for Step B`
              }
            </p>
          </div>
        )}

        {/* Mission Section Type Indicator - Show only when Mission tab is active */}
        {activeSection === 'mission' && (
          <div className="ai-apply-indicator ai-mission-indicator">
            <div className="ai-apply-type">
              <i className={`${
                currentMissionType === 'speaking' ? 'ri-mic-line' :
                currentMissionType === 'discussion' ? 'ri-discuss-line' :
                currentMissionType === 'reading' ? 'ri-book-open-line' : 'ri-headphone-line'
              }`} />
              <span className="ai-apply-type-label">
                {currentMissionType.charAt(0).toUpperCase() + currentMissionType.slice(1)} Challenge
              </span>
            </div>
            <p className="ai-step-hint">
              Will generate {currentMissionType} mission with {missionQuestionCount || 'default'} roleplay questions
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
              ) : generatedContent.triviaData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className="ri-lightbulb-flash-line" style={{ marginRight: '8px', color: '#ffd700' }} />
                    Trivia Time
                  </h5>
                  <div className="ai-preview-item">
                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.3)', marginBottom: '16px' }}>
                      <p style={{ color: '#e0e0e0', fontSize: '15px', lineHeight: '1.6' }}>{generatedContent.triviaData.triviaText}</p>
                      {generatedContent.triviaData.triviaTranslation && (
                        <p style={{ color: '#a0a0a0', marginTop: '10px', fontStyle: 'italic' }}>{generatedContent.triviaData.triviaTranslation}</p>
                      )}
                    </div>
                    <p style={{ color: '#a0a0a0', fontSize: '13px' }}>
                      <i className="ri-time-line" style={{ marginRight: '6px' }} />
                      Duration: {generatedContent.triviaData.triviaDuration || '1 minute'}
                    </p>
                    {generatedContent.triviaData.triviaTutorSteps?.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <strong style={{ color: '#4faafe', fontSize: '14px' }}>Tutor Steps:</strong>
                        {generatedContent.triviaData.triviaTutorSteps.map((step: any, idx: number) => (
                          <div key={idx} style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ color: '#e0e0e0', marginBottom: '6px' }}><strong>Step {idx + 1}:</strong> {step.instruction}</p>
                            {step.scripts?.length > 0 && step.scripts.map((s: any, sIdx: number) => (
                              <p key={sIdx} style={{ color: '#a0c4e8', marginLeft: '10px', fontSize: '13px' }}>📝 "{s.text || s}"</p>
                            ))}
                            {step.questions?.length > 0 && step.questions.map((q: any, qIdx: number) => (
                              <p key={qIdx} style={{ color: '#64c896', marginLeft: '10px', fontSize: '13px' }}>❓ {q.question || q}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : generatedContent.exerciseData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className="ri-checkbox-circle-line" style={{ marginRight: '8px', color: '#64c896' }} />
                    Exercise - {generatedContent.exerciseData.exerciseStep === 'stepA' ? 'Step A' : 'Step B'} ({generatedContent.exerciseData.exerciseType})
                  </h5>
                  <div className="ai-preview-item">
                    {/* Step A Preview */}
                    {generatedContent.exerciseData.exerciseStep === 'stepA' && (
                      <>
                        <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '10px' }}>{generatedContent.exerciseData.instructions}</p>
                        {generatedContent.exerciseData.instructionsTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px', marginBottom: '12px' }}>{generatedContent.exerciseData.instructionsTranslation}</p>
                        )}
                        
                        {/* Expressions box for rephrase */}
                        {generatedContent.exerciseData.showExpressions && generatedContent.exerciseData.expressions?.length > 0 && (
                          <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <strong style={{ color: '#4faafe' }}>Word Box:</strong>
                            <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.expressions.join(' • ')}</p>
                          </div>
                        )}
                        
                        {/* Example */}
                        {generatedContent.exerciseData.showExample && (
                          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(100, 200, 150, 0.1)', borderRadius: '6px', border: '1px solid rgba(100, 200, 150, 0.3)' }}>
                            <strong style={{ color: '#64c896' }}>Example:</strong>
                            <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.exampleSentence}</p>
                            <p style={{ color: '#64c896' }}>→ {generatedContent.exerciseData.exampleAnswer}</p>
                          </div>
                        )}
                        
                        {/* Exercise items */}
                        {(generatedContent.exerciseData.exerciseItems?.length > 0 ||
                          generatedContent.exerciseData.chooseItems?.length > 0 ||
                          generatedContent.exerciseData.changeItems?.length > 0) && (
                          <div style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#4faafe' }}>Items:</strong>
                            <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                              {(generatedContent.exerciseData.exerciseItems ||
                                generatedContent.exerciseData.chooseItems ||
                                generatedContent.exerciseData.changeItems || []).map((item: any, idx: number) => (
                                <li key={idx} style={{ marginBottom: '6px' }} dangerouslySetInnerHTML={{ __html: item.sentence }} />
                              ))}
                            </ol>
                          </div>
                        )}
                        
                        {/* Answer key */}
                        {generatedContent.exerciseData.answers?.length > 0 && (
                          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                            <strong style={{ color: '#ffd700' }}>Answer Key:</strong>
                            <ol style={{ color: '#a0a0a0', paddingLeft: '20px', fontSize: '13px' }}>
                              {generatedContent.exerciseData.answers.map((answer: any, idx: number) => (
                                <li key={idx}>{answer.text}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Step B Preview */}
                    {generatedContent.exerciseData.exerciseStep === 'stepB' && (
                      <>
                        <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '10px' }}>{generatedContent.exerciseData.stepBInstruction}</p>
                        
                        {/* Conversation preview */}
                        {generatedContent.exerciseData.conversations?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            {generatedContent.exerciseData.conversations.map((conv: any, idx: number) => (
                              <div key={idx} style={{
                                display: 'flex',
                                justifyContent: conv.position === 'right' ? 'flex-end' : 'flex-start',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  background: conv.position === 'right' ? 'rgba(100, 200, 150, 0.15)' : 'rgba(79, 170, 254, 0.15)',
                                  padding: '10px 14px',
                                  borderRadius: '12px',
                                  maxWidth: '80%',
                                  border: conv.position === 'right' ? '1px solid rgba(100, 200, 150, 0.3)' : '1px solid rgba(79, 170, 254, 0.3)'
                                }}>
                                  <p style={{ color: '#e0e0e0', margin: 0 }}>{conv.speechBubble}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Multiple choice preview */}
                        {generatedContent.exerciseData.multipleChoiceItems?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            {generatedContent.exerciseData.multipleChoiceItems.map((item: any, idx: number) => (
                              <div key={idx} style={{ marginBottom: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                <p style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{item.boldSentence}</p>
                                <p style={{ color: '#a0c4e8', marginTop: '6px' }}>A: {item.optionA}</p>
                                <p style={{ color: '#64c896', marginTop: '4px' }}>B: {item.optionB}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Speech preview */}
                        {generatedContent.exerciseData.speechContent && (
                          <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <p style={{ color: '#e0e0e0', lineHeight: '1.6' }}>{generatedContent.exerciseData.speechContent}</p>
                          </div>
                        )}
                        
                        {/* Compare preview */}
                        {generatedContent.exerciseData.compareWordBox?.length > 0 && (
                          <div>
                            <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                              <strong style={{ color: '#4faafe' }}>Word Box:</strong>
                              <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.compareWordBox.join(' • ')}</p>
                            </div>
                            {generatedContent.exerciseData.compareExample && (
                              <p style={{ color: '#64c896', marginBottom: '10px' }}>Example: {generatedContent.exerciseData.compareExample}</p>
                            )}
                            <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                              {generatedContent.exerciseData.compareItems?.map((item: any, idx: number) => (
                                <li key={idx}>{item.sentence}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : generatedContent.missionData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className="ri-rocket-line" style={{ marginRight: '8px', color: '#ff9f43' }} />
                    Mission - {generatedContent.missionData.missionType.charAt(0).toUpperCase() + generatedContent.missionData.missionType.slice(1)} Challenge
                  </h5>
                  <div className="ai-preview-item">
                    {/* Challenge Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ background: 'rgba(255, 159, 67, 0.2)', color: '#ff9f43', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Challenge {generatedContent.missionData.challengeNumber || 1}
                      </span>
                      <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{generatedContent.missionData.challengeName}</span>
                      <span style={{ color: '#a0a0a0', fontSize: '13px' }}>• {generatedContent.missionData.duration}</span>
                    </div>
                    
                    {/* Situation */}
                    {generatedContent.missionData.situation && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(79, 170, 254, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.2)' }}>
                        <strong style={{ color: '#4faafe', display: 'block', marginBottom: '6px' }}>Situation:</strong>
                        <p style={{ color: '#e0e0e0', marginBottom: generatedContent.missionData.situationTranslation ? '6px' : '0' }}>{generatedContent.missionData.situation}</p>
                        {generatedContent.missionData.situationTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px' }}>{generatedContent.missionData.situationTranslation}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Instruction */}
                    {generatedContent.missionData.instruction && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(100, 200, 150, 0.1)', borderRadius: '8px', border: '1px solid rgba(100, 200, 150, 0.2)' }}>
                        <strong style={{ color: '#64c896', display: 'block', marginBottom: '6px' }}>Instruction:</strong>
                        <p style={{ color: '#e0e0e0', marginBottom: generatedContent.missionData.instructionTranslation ? '6px' : '0' }}>{generatedContent.missionData.instruction}</p>
                        {generatedContent.missionData.instructionTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px' }}>{generatedContent.missionData.instructionTranslation}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Grammar Tip */}
                    {generatedContent.missionData.showGrammarTip && generatedContent.missionData.grammarTipItems?.length > 0 && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                        <strong style={{ color: '#ffd700', display: 'block', marginBottom: '6px' }}>{generatedContent.missionData.grammarTipTitle || "Today's grammar tip"}:</strong>
                        <p style={{ color: '#e0e0e0' }}>{generatedContent.missionData.grammarTipItems.join(', ')}</p>
                      </div>
                    )}
                    
                    {/* Discussion Topics (for discussion type) */}
                    {generatedContent.missionData.topics?.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Discussion Topics:</strong>
                        {generatedContent.missionData.topics.map((topic: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #ff9f43' }}>
                            <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '6px' }}>{topic.title}</p>
                            <ul style={{ color: '#a0c4e8', paddingLeft: '16px', margin: 0 }}>
                              {topic.questions?.map((q: string, qIdx: number) => (
                                <li key={qIdx} style={{ marginBottom: '4px' }}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Reading Passage (for reading type) */}
                    {generatedContent.missionData.readingPassage && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Reading Passage:</strong>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '4px' }}>{generatedContent.missionData.readingPassage.title}</p>
                          {generatedContent.missionData.readingPassage.author && (
                            <p style={{ color: '#a0a0a0', fontSize: '13px', marginBottom: '10px' }}>— {generatedContent.missionData.readingPassage.author}</p>
                          )}
                          {generatedContent.missionData.readingPassage.blocks?.slice(0, 2).map((block: any, idx: number) => (
                            <p key={idx} style={{ color: '#c0c0c0', marginBottom: '8px', fontSize: '13px' }}>
                              {block.type === 'paragraph' ? (block.text?.slice(0, 150) + '...') : '[Image]'}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Listening Script (for listening type) */}
                    {generatedContent.missionData.listeningScript && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Listening Script:</strong>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <p style={{ color: '#c0c0c0', fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: generatedContent.missionData.listeningScript.slice(0, 200) + '...' }} />
                        </div>
                      </div>
                    )}
                    
                    {/* Questions Preview */}
                    {generatedContent.missionData.questions?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <strong style={{ color: '#4faafe', display: 'block', marginBottom: '8px' }}>Roleplay Questions ({generatedContent.missionData.questions.length}):</strong>
                        <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                          {generatedContent.missionData.questions.slice(0, 4).map((q: any, idx: number) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>
                              {q.question}
                              {q.hints?.length > 0 && (
                                <span style={{ color: '#a0a0a0', fontSize: '12px', marginLeft: '8px' }}>({q.hints.length} hints)</span>
                              )}
                            </li>
                          ))}
                          {generatedContent.missionData.questions.length > 4 && (
                            <li style={{ color: '#a0a0a0', fontStyle: 'italic' }}>...and {generatedContent.missionData.questions.length - 4} more</li>
                          )}
                        </ol>
                      </div>
                    )}
                    
                    {/* Tutor Steps Count */}
                    {generatedContent.missionData.tutorSteps?.length > 0 && (
                      <p style={{ color: '#a0a0a0', fontSize: '12px', marginTop: '12px' }}>
                        <i className="ri-user-line" style={{ marginRight: '4px' }} />
                        {generatedContent.missionData.tutorSteps.length} tutor steps included
                      </p>
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

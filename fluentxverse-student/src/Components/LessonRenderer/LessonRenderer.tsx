/**
 * LessonRenderer - Unified component for rendering lesson materials
 * Receives JSON data and renders all section types accordingly
 */
import { useMemo, useState } from 'preact/hooks';
import type {
  LessonMaterial,
  LessonSection,
  LessonRendererProps,
  VocabCard,
  PronunciationColumn,
  GrammarRule,
  DialogueLine,
  TriviaExample,
  PracticeItem,
  ConversationLine,
  ChallengeQuestion,
  TopicBox,
  FeedbackGuideRow,
  ReadingDialogueLine,
  DiscussionQuestion,
  LessonGoalStep,
} from '../../types/lesson.types';
import './LessonRenderer.css';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LessonRenderer({
  data,
  mode = 'student',
  showTutorSidebar = false,
  currentSectionIndex = 0,
  onSectionChange,
}: LessonRendererProps) {
  const { header, sections } = data;
  const [activeSection, setActiveSection] = useState(currentSectionIndex);

  // Filter sections based on mode (hide feedback from students)
  const visibleSections = useMemo(() => {
    if (mode === 'student') {
      return sections.filter(s => s.sectionType !== 'feedback');
    }
    return sections;
  }, [sections, mode]);

  const handleSectionClick = (index: number) => {
    setActiveSection(index);
    onSectionChange?.(index);
  };

  return (
    <div className={`lr-container lr-mode-${mode}`}>
      {/* Header */}
      <LessonHeaderComponent header={header} />

      {/* Navigation */}
      <nav className="lr-nav">
        {visibleSections.map((section, idx) => (
          <button
            key={section.id}
            className={`lr-nav-item ${idx === activeSection ? 'active' : ''}`}
            onClick={() => handleSectionClick(idx)}
          >
            <span className="lr-nav-num">{section.sectionNumber}</span>
            <span className="lr-nav-title">{section.sectionTitle || section.stepTitle || `Section ${idx + 1}`}</span>
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <div className="lr-content-wrapper">
        {/* Main Content */}
        <main className="lr-main">
          {visibleSections.map((section, idx) => (
            <SectionRenderer
              key={section.id}
              section={section}
              isActive={idx === activeSection}
              mode={mode}
            />
          ))}
        </main>

        {/* Tutor Sidebar */}
        {mode === 'tutor' && showTutorSidebar && visibleSections[activeSection] && (
          <TutorSidebar section={visibleSections[activeSection]} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

function LessonHeaderComponent({ header }: { header: LessonMaterial['header'] }) {
  const bgStyle = header.backgroundImage
    ? { backgroundImage: `url(${header.backgroundImage})` }
    : {};

  return (
    <header className="lr-header" style={bgStyle}>
      <div className="lr-header-overlay" style={{ backgroundColor: header.overlayColor }} />
      <div className="lr-header-content">
        <span className="lr-level-badge">{header.levelBadge}</span>
        <p className="lr-chapter">{header.chapterLabel}</p>
        <h1 className="lr-lesson-title">{header.lessonLabel}</h1>
        <div className="lr-goal">
          <p className="lr-goal-text">{header.goalText}</p>
          <p className="lr-goal-subtext">{header.goalSubtext}</p>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// SECTION RENDERER - Routes to correct section type
// ============================================================================

function SectionRenderer({
  section,
  isActive,
  mode,
}: {
  section: LessonSection;
  isActive: boolean;
  mode: 'student' | 'tutor';
}) {
  if (!isActive) return null;

  const renderContent = () => {
    switch (section.sectionType) {
      case 'introduce':
        return <IntroduceSection section={section} />;
      case 'vocabulary':
        return <VocabularySection section={section} />;
      case 'question':
        return <QuestionSection section={section} />;
      case 'pronunciation':
        return <PronunciationSection section={section} />;
      case 'grammar':
        return <GrammarSection section={section} />;
      case 'dialogue':
        return <DialogueSection section={section} />;
      case 'trivia':
        return <TriviaSection section={section} />;
      case 'practice':
        return <PracticeSection section={section} />;
      case 'produce':
        return <ProduceSection section={section} />;
      case 'challenge':
        return <ChallengeSection section={section} />;
      case 'challenge2':
        return <Challenge2Section section={section} />;
      case 'feedback':
        return mode === 'tutor' ? <FeedbackSection section={section} /> : null;
      case 'listening':
        return <ListeningSection section={section} />;
      case 'listeningChallenge':
        return <ListeningChallengeSection section={section} />;
      case 'reading':
        return <ReadingSection section={section} />;
      case 'discussion-questions':
        return <DiscussionQuestionsSection section={section} />;
      default:
        return <GenericSection section={section} />;
    }
  };

  return (
    <section className={`lr-section lr-section-${section.sectionType}`} id={section.id}>
      {section.sectionTitle && (
        <div className="lr-section-header">
          <span className="lr-section-number">{section.sectionNumber}</span>
          <h2 className="lr-section-title">{section.sectionTitle}</h2>
        </div>
      )}
      {section.stepTitle && <h3 className="lr-step-title">{section.stepTitle}</h3>}
      {renderContent()}
    </section>
  );
}

// ============================================================================
// INTRODUCE SECTION
// ============================================================================

function IntroduceSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-introduce">
      {section.explanationEn && <p className="lr-text-en">{section.explanationEn}</p>}
      {section.explanationJp && <p className="lr-text-jp">{section.explanationJp}</p>}
      {section.sectionImage && (
        <div className="lr-image-wrapper">
          <img src={section.sectionImage} alt="" />
        </div>
      )}
      {section.importantNote && (
        <div className="lr-important-note">
          <i className="ri-information-line" />
          <p>{section.importantNote}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VOCABULARY SECTION
// ============================================================================

function VocabularySection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-vocabulary">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.vocabCards && section.vocabCards.length > 0 && (
        <div className="lr-vocab-grid">
          {section.vocabCards.map((card) => (
            <VocabCardItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function VocabCardItem({ card }: { card: VocabCard }) {
  return (
    <div className="lr-vocab-card">
      {card.image && (
        <div className="lr-vocab-image">
          <img src={card.image} alt={card.wordEn} />
        </div>
      )}
      <div className="lr-vocab-text">
        <span className="lr-vocab-en">{card.wordEn}</span>
        <span className="lr-vocab-jp">{card.wordJp}</span>
      </div>
    </div>
  );
}

// ============================================================================
// QUESTION SECTION (Image cards with labels)
// ============================================================================

function QuestionSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-question">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.imageCards && section.imageCards.length > 0 && (
        <div className="lr-image-cards-grid">
          {section.imageCards.map((card) => (
            <div key={card.id} className="lr-image-card">
              {card.image && <img src={card.image} alt={card.label} />}
              <span className="lr-image-label">{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRONUNCIATION SECTION
// ============================================================================

function PronunciationSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-pronunciation">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.pronunciationColumns && section.pronunciationColumns.length > 0 && (
        <div className="lr-pronunciation-columns">
          {section.pronunciationColumns.map((col) => (
            <PronunciationColumnItem key={col.id} column={col} />
          ))}
        </div>
      )}
    </div>
  );
}

function PronunciationColumnItem({ column }: { column: PronunciationColumn }) {
  return (
    <div className="lr-pronunciation-col">
      <div className="lr-sound-label">{column.soundLabel}</div>
      {column.image && (
        <div className="lr-mouth-image">
          <img src={column.image} alt={column.soundLabel} />
        </div>
      )}
      <ul className="lr-pronunciation-words">
        {column.words.map((word) => (
          <li key={word.id}>
            <span className="lr-word-en">{word.wordEn}</span>
            <span className="lr-word-jp">{word.wordJp}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// GRAMMAR SECTION
// ============================================================================

function GrammarSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-grammar">
      {section.instructionEn && <p className="lr-instruction-en lr-grammar-tip">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.grammarRules && section.grammarRules.length > 0 && (
        <div className="lr-grammar-rules">
          {section.grammarRules.map((rule) => (
            <GrammarRuleItem key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}

function GrammarRuleItem({ rule }: { rule: GrammarRule }) {
  return (
    <div className="lr-grammar-rule">
      <p className="lr-rule-en">{rule.ruleEn}</p>
      <p className="lr-rule-jp">{rule.ruleJp}</p>
      {rule.examples.length > 0 && (
        <div className="lr-grammar-examples">
          {rule.examples.map((ex) => (
            <div key={ex.id} className="lr-grammar-example">
              <p className="lr-example-en">
                {highlightWords(ex.sentenceEn, ex.boldWords || [])}
              </p>
              <p className="lr-example-jp">{ex.sentenceJp}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to bold specific words
function highlightWords(text: string, words: string[]) {
  if (!words.length) return <>{text}</>;

  let result = text;
  words.forEach((word) => {
    const regex = new RegExp(`(${word})`, 'gi');
    result = result.replace(regex, '|||$1|||');
  });

  const segments = result.split('|||');
  return (
    <>
      {segments.map((seg, i) =>
        words.some((w) => w.toLowerCase() === seg.toLowerCase()) ? (
          <strong key={i}>{seg}</strong>
        ) : (
          seg
        )
      )}
    </>
  );
}

// ============================================================================
// DIALOGUE SECTION
// ============================================================================

function DialogueSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-dialogue">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.dialogueImage && (
        <div className="lr-dialogue-image">
          <img src={section.dialogueImage} alt="Scene" />
        </div>
      )}

      {section.dialogueLines && section.dialogueLines.length > 0 && (
        <div className="lr-dialogue-lines">
          {section.dialogueLines.map((line) => (
            <DialogueLineItem key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}

function DialogueLineItem({ line }: { line: DialogueLine }) {
  return (
    <div className={`lr-dialogue-line ${line.isItalic ? 'italic' : ''}`}>
      <span className="lr-speaker">{line.speaker}</span>
      <span className="lr-line-text">{line.lineEn}</span>
    </div>
  );
}

// ============================================================================
// TRIVIA SECTION
// ============================================================================

function TriviaSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-trivia">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.triviaImage && (
        <div className="lr-trivia-image">
          <img src={section.triviaImage} alt="" />
        </div>
      )}

      {section.triviaExamples && section.triviaExamples.length > 0 && (
        <div className="lr-trivia-examples">
          {section.triviaExamples.map((ex) => (
            <TriviaExampleItem key={ex.id} example={ex} />
          ))}
        </div>
      )}
    </div>
  );
}

function TriviaExampleItem({ example }: { example: TriviaExample }) {
  return (
    <div className={`lr-trivia-example ${example.isCorrect ? 'correct' : 'incorrect'}`}>
      <div className="lr-trivia-marker">{example.isCorrect ? 'O' : 'X'}</div>
      <div className="lr-trivia-content">
        <p className="lr-trivia-line-a">
          <span className="lr-speaker">{example.speakerA}:</span> {example.lineA}
        </p>
        {example.lineAJp && <p className="lr-trivia-jp">{example.lineAJp}</p>}
        <p className="lr-trivia-line-b">
          <span className="lr-speaker">{example.speakerB}:</span> {example.lineB}
        </p>
        {example.lineBJp && <p className="lr-trivia-jp">{example.lineBJp}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// PRACTICE SECTION
// ============================================================================

function PracticeSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-practice">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {/* Word box */}
      {section.wordBox && section.wordBox.length > 0 && (
        <div className="lr-word-box">
          {section.wordBox.map((word, i) => (
            <span key={i} className="lr-word-chip">{word}</span>
          ))}
        </div>
      )}

      {/* Example */}
      {section.practiceExample && (
        <div className="lr-practice-example">
          <p className="lr-example-q">{section.practiceExample}</p>
          {section.practiceExampleAnswer && (
            <p className="lr-example-a">{section.practiceExampleAnswer}</p>
          )}
        </div>
      )}

      {/* Practice items */}
      {section.practiceItems && section.practiceItems.length > 0 && (
        <ol className="lr-practice-items">
          {section.practiceItems.map((item, idx) => (
            <PracticeItemRow key={item.id} item={item} number={idx + 1} />
          ))}
        </ol>
      )}

      {/* Conversation lines */}
      {section.conversationLines && section.conversationLines.length > 0 && (
        <div className="lr-conversation">
          {section.conversationLines.map((line) => (
            <ConversationLineItem key={line.id} line={line} />
          ))}
        </div>
      )}

      {section.practiceImage && (
        <div className="lr-practice-image">
          <img src={section.practiceImage} alt="" />
        </div>
      )}
    </div>
  );
}

function PracticeItemRow({ item, number }: { item: PracticeItem; number: number }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <li className="lr-practice-item">
      <span className="lr-item-num">{number}.</span>
      <div className="lr-item-content">
        <p className="lr-item-question">{item.question}</p>
        {item.questionJp && <p className="lr-item-jp">{item.questionJp}</p>}
        <button className="lr-show-answer" onClick={() => setShowAnswer(!showAnswer)}>
          {showAnswer ? 'Hide Answer' : 'Show Answer'}
        </button>
        {showAnswer && <p className="lr-item-answer">{item.answer}</p>}
      </div>
    </li>
  );
}

function ConversationLineItem({ line }: { line: ConversationLine }) {
  return (
    <div className={`lr-conv-line lr-conv-${line.speaker.toLowerCase()}`}>
      <span className="lr-conv-speaker">{line.speaker}:</span>
      <span className="lr-conv-text">{line.text}</span>
    </div>
  );
}

// ============================================================================
// PRODUCE SECTION
// ============================================================================

function ProduceSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-produce">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}
      {section.sectionImage && (
        <div className="lr-image-wrapper">
          <img src={section.sectionImage} alt="" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHALLENGE SECTION
// ============================================================================

function ChallengeSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-challenge">
      {section.challengeTitle && <h4 className="lr-challenge-title">{section.challengeTitle}</h4>}

      {section.situationEn && (
        <div className="lr-situation">
          <p className="lr-situation-en">{section.situationEn}</p>
          {section.situationJp && <p className="lr-situation-jp">{section.situationJp}</p>}
        </div>
      )}

      {section.grammarTipTitle && section.grammarTipItems && (
        <div className="lr-grammar-tip-box">
          <h5>{section.grammarTipTitle}</h5>
          <div className="lr-tip-items">
            {section.grammarTipItems.map((item, i) => (
              <span key={i} className="lr-tip-item">{item}</span>
            ))}
          </div>
        </div>
      )}

      {section.challengeQuestions && section.challengeQuestions.length > 0 && (
        <div className="lr-challenge-questions">
          {section.challengeQuestions.map((q) => (
            <ChallengeQuestionItem key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChallengeQuestionItem({ question }: { question: ChallengeQuestion }) {
  return (
    <div className="lr-challenge-q">
      <p className="lr-q-main">{question.question}</p>
      {question.subQuestions && question.subQuestions.length > 0 && (
        <ul className="lr-sub-questions">
          {question.subQuestions.map((sq, i) => (
            <li key={i} className="lr-sub-q">{sq}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// CHALLENGE 2 SECTION (Topics)
// ============================================================================

function Challenge2Section({ section }: { section: LessonSection }) {
  return (
    <div className="lr-challenge2">
      {section.isOptional && <span className="lr-optional-badge">If Time Allows</span>}
      {section.challengeTitle && <h4 className="lr-challenge-title">{section.challengeTitle}</h4>}

      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.topicBoxes && section.topicBoxes.length > 0 && (
        <div className="lr-topic-boxes">
          {section.topicBoxes.map((box) => (
            <TopicBoxItem key={box.id} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicBoxItem({ box }: { box: TopicBox }) {
  return (
    <div className="lr-topic-box">
      <div className="lr-topic-header">
        <span className="lr-topic-num">Topic {box.topicNumber}</span>
        <span className="lr-topic-title">{box.topicTitle}</span>
      </div>
      <ul className="lr-topic-questions">
        {box.questions.map((q) => (
          <li key={q.id}>{q.question}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// FEEDBACK SECTION (Tutor only)
// ============================================================================

function FeedbackSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-feedback">
      <h4 className="lr-feedback-title">Lesson Goal Achievement</h4>

      {section.feedbackRubric && section.feedbackRubric.length > 0 && (
        <div className="lr-rubric">
          {section.feedbackRubric.map((item) => (
            <div key={item.score} className="lr-rubric-item">
              <span className="lr-rubric-score">{item.score}</span>
              <span className="lr-rubric-label">{item.label}</span>
              <span className="lr-rubric-desc">{item.description}</span>
            </div>
          ))}
        </div>
      )}

      {section.feedbackCategories && section.feedbackCategories.length > 0 && (
        <div className="lr-feedback-categories">
          <h5>Personalized Feedback Categories</h5>
          {section.feedbackCategories.map((cat) => (
            <div key={cat.id} className="lr-feedback-cat">
              <span className="lr-cat-title">{cat.title}</span>
              <span className="lr-cat-jp">{cat.titleJp}</span>
              <span className="lr-cat-desc">{cat.descJp}</span>
            </div>
          ))}
        </div>
      )}

      {section.feedbackGuide && section.feedbackGuide.length > 0 && (
        <div className="lr-feedback-guide">
          <h5>Personalized Feedback Guide</h5>
          <table className="lr-guide-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Focus On</th>
                <th>Example Feedback</th>
              </tr>
            </thead>
            <tbody>
              {section.feedbackGuide.map((row) => (
                <FeedbackGuideRowItem key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.feedbackTemplate && (
        <div className="lr-feedback-template">
          <h5>Copy Template</h5>
          <pre className="lr-template-text">{section.feedbackTemplate}</pre>
          <button
            className="lr-copy-btn"
            onClick={() => navigator.clipboard.writeText(section.feedbackTemplate || '')}
          >
            <i className="ri-file-copy-line" /> Copy
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackGuideRowItem({ row }: { row: FeedbackGuideRow }) {
  return (
    <tr>
      <td>
        <strong>{row.category}</strong>
        <br />
        <small>{row.categoryDesc}</small>
      </td>
      <td dangerouslySetInnerHTML={{ __html: row.focusOn }} />
      <td dangerouslySetInnerHTML={{ __html: row.exampleFeedback }} />
    </tr>
  );
}

// ============================================================================
// LISTENING SECTION
// ============================================================================

function ListeningSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-listening">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.listeningScriptText && (
        <div className="lr-listening-script">
          <h5>Script</h5>
          <pre className="lr-script-text">{section.listeningScriptText}</pre>
        </div>
      )}

      {section.listeningQuestions && section.listeningQuestions.length > 0 && (
        <div className="lr-listening-questions">
          <h5>Questions</h5>
          {section.listeningQuestions.map((q) => (
            <div key={q.id} className="lr-listening-q">
              <p className="lr-q-en">{q.questionEn}</p>
              <p className="lr-q-jp">{q.questionJp}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LISTENING CHALLENGE SECTION
// ============================================================================

function ListeningChallengeSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-listening-challenge">
      {section.roleplaySetupLines && section.roleplaySetupLines.length > 0 && (
        <div className="lr-roleplay-setup">
          {section.roleplaySetupLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {section.roleplayScript && (
        <div className="lr-roleplay-script">
          <pre>{section.roleplayScript}</pre>
        </div>
      )}

      {section.roleplayTips && section.roleplayTips.length > 0 && (
        <div className="lr-roleplay-tips">
          {section.roleplayTips.map((tip, i) => (
            <p key={i} className="lr-tip">◆ {tip}</p>
          ))}
        </div>
      )}

      {section.roleplayConversation && section.roleplayConversation.length > 0 && (
        <div className="lr-roleplay-conversation">
          {section.roleplayConversation.map((line) => (
            <div key={line.id} className={`lr-roleplay-line ${line.isHeader ? 'header' : ''} ${line.isFooter ? 'footer' : ''}`}>
              <span className="lr-line-num">{line.number}.</span>
              <span className="lr-line-text">{line.text}</span>
              {line.comment && <span className="lr-line-comment">{line.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// READING SECTION
// ============================================================================

function ReadingSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-reading">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.readingImage && (
        <div className="lr-reading-image">
          <img src={section.readingImage} alt="" />
        </div>
      )}

      {section.readingDialogueLines && section.readingDialogueLines.length > 0 && (
        <div className="lr-reading-dialogue">
          {section.readingDialogueLines.map((line) => (
            <ReadingDialogueLineItem key={line.id} line={line} />
          ))}
        </div>
      )}

      {section.readingQuestions && section.readingQuestions.length > 0 && (
        <div className="lr-reading-questions">
          <h5>Questions</h5>
          {section.readingQuestions.map((q) => (
            <div key={q.id} className="lr-reading-q">
              <p className="lr-q-text">{q.questionEn}</p>
              <p className="lr-q-answer">{q.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingDialogueLineItem({ line }: { line: ReadingDialogueLine }) {
  const renderText = () => {
    if (!line.underlineWords || line.underlineWords.length === 0) {
      return line.lineEn;
    }

    let text = line.lineEn;
    line.underlineWords.forEach((word) => {
      text = text.replace(new RegExp(`(${word})`, 'gi'), '<u>$1</u>');
    });

    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div className="lr-reading-line">
      <span className="lr-reading-speaker">{line.speaker}:</span>
      <span className="lr-reading-text">{renderText()}</span>
    </div>
  );
}

// ============================================================================
// DISCUSSION QUESTIONS SECTION
// ============================================================================

function DiscussionQuestionsSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-discussion">
      {section.instructionEn && <p className="lr-instruction-en">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lr-instruction-jp">{section.instructionJp}</p>}

      {section.discussionQuestions && section.discussionQuestions.length > 0 && (
        <div className="lr-discussion-list">
          {section.discussionQuestions.map((q) => (
            <DiscussionQuestionItem key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscussionQuestionItem({ question }: { question: DiscussionQuestion }) {
  return (
    <div className="lr-discussion-q">
      <span className="lr-q-num">{question.number}.</span>
      <div className="lr-q-content">
        <p className="lr-q-text">{question.question}</p>
        <span className="lr-q-category">{question.category}</span>
      </div>
    </div>
  );
}

// ============================================================================
// GENERIC SECTION (Fallback)
// ============================================================================

function GenericSection({ section }: { section: LessonSection }) {
  return (
    <div className="lr-generic">
      {section.explanationEn && <p className="lr-text-en">{section.explanationEn}</p>}
      {section.explanationJp && <p className="lr-text-jp">{section.explanationJp}</p>}
      {section.sectionImage && (
        <div className="lr-image-wrapper">
          <img src={section.sectionImage} alt="" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TUTOR SIDEBAR
// ============================================================================

function TutorSidebar({ section }: { section: LessonSection }) {
  return (
    <aside className="lr-tutor-sidebar">
      {section.sidebarTitle && (
        <div className="lr-sidebar-header">
          <h4>{section.sidebarTitle}</h4>
          {section.sidebarSubtitle && <span>{section.sidebarSubtitle}</span>}
        </div>
      )}

      {section.lessonGoalTitle && <h5 className="lr-goal-title">{section.lessonGoalTitle}</h5>}

      {section.lessonGoalSteps && section.lessonGoalSteps.length > 0 && (
        <ol className="lr-goal-steps">
          {section.lessonGoalSteps.map((step, idx) => (
            <LessonGoalStepItem key={step.id} step={step} number={idx + 1} />
          ))}
        </ol>
      )}

      {/* Answer box for practice sections */}
      {section.answerItems && section.answerItems.length > 0 && (
        <div className="lr-answer-box">
          <h5>Answers</h5>
          <ol>
            {section.answerItems.map((ans, i) => (
              <li key={i}>{ans}</li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}

function LessonGoalStepItem({ step, number }: { step: LessonGoalStep; number: number }) {
  return (
    <li className="lr-step-item">
      <span className="lr-step-num">{number}.</span>
      <div className="lr-step-content">
        {step.instruction && <p className="lr-step-instruction">{step.instruction}</p>}
        {step.scriptLine && <p className="lr-step-script">"{step.scriptLine}"</p>}
        {step.scriptLines && step.scriptLines.map((line, i) => (
          <p key={i} className="lr-step-script">"{line}"</p>
        ))}
        {step.tipText && <p className="lr-step-tip">💡 {step.tipText}</p>}
      </div>
    </li>
  );
}

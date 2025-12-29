import { useMemo } from 'preact/hooks';
import './LessonRenderer.css';

interface LessonHeader {
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
  backgroundImage: string;
  overlayColor: string;
}

interface DialogueLine {
  id?: string;
  speaker: string;
  japanese: string;
  romaji: string;
  english: string;
}

interface PracticeQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  explanationJp?: string;
}

interface VocabularyItem {
  id?: string;
  word: string;
  reading?: string;
  meaning: string;
  example?: string;
  exampleMeaning?: string;
}

interface GrammarItem {
  id?: string;
  pattern: string;
  explanation: string;
  explanationJp?: string;
  examples: Array<{
    japanese: string;
    reading?: string;
    english: string;
  }>;
}

interface ExerciseItem {
  id?: string;
  type: 'fill-blank' | 'matching' | 'translation' | 'multiple-choice';
  question: string;
  answer?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
}

interface LessonSection {
  id: string;
  sectionNumber: number;
  sectionTitle: string;
  sectionType?: 'introduce' | 'dialogue' | 'question' | 'trivia' | 'practice' | 'feedback' | 'challenge2' | 'pronunciation' | 'grammar';
  explanationEn?: string;
  explanationJp?: string;
  sectionImage?: string;
  dialogueLines?: DialogueLine[];
  questionText?: string;
  questionTextJp?: string;
  questionChoices?: string[];
  questionAnswer?: string;
  questionAnswerIndex?: number;
  questionExplanation?: string;
  questionExplanationJp?: string;
  triviaTitle?: string;
  triviaTitleJp?: string;
  triviaFact?: string;
  triviaFactJp?: string;
  triviaImage?: string;
  practiceQuestions?: PracticeQuestion[];
  tutorTipTitle?: string;
  tutorTip?: string;
  feedbackText?: string;
  feedbackTextJp?: string;
  feedbackHighlight?: string;
  challenge2Title?: string;
  challenge2Explanation?: string;
  challenge2ExplanationJp?: string;
  pronunciationWord?: string;
  pronunciationRomaji?: string;
  pronunciationMeaning?: string;
  pronunciationTip?: string;
  pronunciationAudio?: string;
  grammarPattern?: string;
  grammarExplanation?: string;
  grammarExplanationJp?: string;
  grammarExamples?: Array<{ japanese: string; reading?: string; english: string }>;
}

interface LessonMaterial {
  version?: number;
  header: LessonHeader;
  sections: LessonSection[];
  vocabulary?: VocabularyItem[];
  grammar?: GrammarItem[];
  exercises?: ExerciseItem[];
}

interface LessonRendererProps {
  lessonData: LessonMaterial;
  viewMode?: 'student' | 'tutor';
}

export default function LessonRenderer({ lessonData, viewMode = 'student' }: LessonRendererProps) {
  const { header, sections, vocabulary, grammar, exercises } = lessonData;

  // Filter out feedback sections in student view
  const visibleSections = useMemo(() => {
    if (viewMode === 'student') {
      return sections.filter(s => s.sectionType !== 'feedback');
    }
    return sections;
  }, [sections, viewMode]);

  // Render section content based on type
  const renderSectionContent = (section: LessonSection) => {
    const sectionType = section.sectionType || 'introduce';

    switch (sectionType) {
      case 'introduce':
        return (
          <>
            {section.explanationEn && (
              <p className="lr-explanation">{section.explanationEn}</p>
            )}
            {section.explanationJp && (
              <p className="lr-explanation-jp">{section.explanationJp}</p>
            )}
            {section.sectionImage && (
              <div className="lr-section-image">
                <img src={section.sectionImage} alt="Section visual" />
              </div>
            )}
          </>
        );

      case 'dialogue':
        return (
          <div className="lr-dialogue-container">
            {section.dialogueLines?.map((line, idx) => (
              <div key={line.id || idx} className="lr-dialogue-line">
                <div className="lr-dialogue-speaker">{line.speaker}</div>
                <div className="lr-dialogue-content">
                  <p className="lr-dialogue-japanese">{line.japanese}</p>
                  {line.romaji && <p className="lr-dialogue-romaji">{line.romaji}</p>}
                  <p className="lr-dialogue-english">{line.english}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'question':
        return (
          <div className="lr-question-container">
            {section.questionText && (
              <p className="lr-question-text">{section.questionText}</p>
            )}
            {section.questionTextJp && (
              <p className="lr-question-text-jp">{section.questionTextJp}</p>
            )}
            {section.questionChoices && section.questionChoices.length > 0 && (
              <div className="lr-question-choices">
                {section.questionChoices.map((choice, idx) => (
                  <div key={idx} className="lr-question-choice">
                    <span className="lr-choice-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="lr-choice-text">{choice}</span>
                  </div>
                ))}
              </div>
            )}
            {section.questionAnswer && (
              <div className="lr-question-answer">
                <span className="lr-answer-label">Answer:</span>
                <span className="lr-answer-text">{section.questionAnswer}</span>
              </div>
            )}
            {(section.questionExplanation || section.questionExplanationJp) && (
              <div className="lr-question-explanation">
                {section.questionExplanation && <p>{section.questionExplanation}</p>}
                {section.questionExplanationJp && <p className="lr-jp">{section.questionExplanationJp}</p>}
              </div>
            )}
          </div>
        );

      case 'trivia':
        return (
          <div className="lr-trivia-container">
            <div className="lr-trivia-badge">
              <i className="fas fa-lightbulb"></i>
              <span>Did You Know?</span>
            </div>
            {section.triviaTitle && (
              <h4 className="lr-trivia-title">{section.triviaTitle}</h4>
            )}
            {section.triviaTitleJp && (
              <h5 className="lr-trivia-title-jp">{section.triviaTitleJp}</h5>
            )}
            {section.triviaFact && (
              <p className="lr-trivia-fact">{section.triviaFact}</p>
            )}
            {section.triviaFactJp && (
              <p className="lr-trivia-fact-jp">{section.triviaFactJp}</p>
            )}
            {section.triviaImage && (
              <div className="lr-trivia-image">
                <img src={section.triviaImage} alt="Trivia illustration" />
              </div>
            )}
          </div>
        );

      case 'practice':
        return (
          <div className="lr-practice-container">
            {section.practiceQuestions?.map((q, idx) => (
              <div key={q.id || idx} className="lr-practice-question">
                <div className="lr-practice-number">Q{idx + 1}</div>
                <div className="lr-practice-content">
                  <p className="lr-practice-text">{q.question}</p>
                  {q.options && q.options.length > 0 && (
                    <div className="lr-practice-options">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="lr-practice-option">
                          <span className="lr-option-letter">{String.fromCharCode(65 + optIdx)}</span>
                          <span className="lr-option-text">{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'feedback':
        // Only show in tutor view
        if (viewMode === 'student') return null;
        return (
          <div className="lr-feedback-container">
            <div className="lr-feedback-badge">
              <i className="fas fa-comment-alt"></i>
              <span>Tutor Feedback</span>
            </div>
            {section.feedbackText && (
              <p className="lr-feedback-text">{section.feedbackText}</p>
            )}
            {section.feedbackTextJp && (
              <p className="lr-feedback-text-jp">{section.feedbackTextJp}</p>
            )}
            {section.feedbackHighlight && (
              <div className="lr-feedback-highlight">{section.feedbackHighlight}</div>
            )}
          </div>
        );

      case 'challenge2':
        return (
          <div className="lr-challenge-container">
            <div className="lr-challenge-badge">
              <i className="fas fa-trophy"></i>
              <span>Challenge</span>
            </div>
            {section.challenge2Title && (
              <h4 className="lr-challenge-title">{section.challenge2Title}</h4>
            )}
            {section.challenge2Explanation && (
              <p className="lr-challenge-explanation">{section.challenge2Explanation}</p>
            )}
            {section.challenge2ExplanationJp && (
              <p className="lr-challenge-explanation-jp">{section.challenge2ExplanationJp}</p>
            )}
          </div>
        );

      case 'pronunciation':
        return (
          <div className="lr-pronunciation-container">
            <div className="lr-pronunciation-badge">
              <i className="fas fa-volume-up"></i>
              <span>Pronunciation</span>
            </div>
            {section.pronunciationWord && (
              <div className="lr-pronunciation-word">{section.pronunciationWord}</div>
            )}
            {section.pronunciationRomaji && (
              <div className="lr-pronunciation-romaji">{section.pronunciationRomaji}</div>
            )}
            {section.pronunciationMeaning && (
              <div className="lr-pronunciation-meaning">{section.pronunciationMeaning}</div>
            )}
            {section.pronunciationTip && (
              <div className="lr-pronunciation-tip">
                <i className="fas fa-info-circle"></i>
                <span>{section.pronunciationTip}</span>
              </div>
            )}
          </div>
        );

      case 'grammar':
        return (
          <div className="lr-grammar-section">
            {section.grammarPattern && (
              <div className="lr-grammar-pattern">{section.grammarPattern}</div>
            )}
            {section.grammarExplanation && (
              <p className="lr-grammar-explanation">{section.grammarExplanation}</p>
            )}
            {section.grammarExplanationJp && (
              <p className="lr-grammar-explanation-jp">{section.grammarExplanationJp}</p>
            )}
            {section.grammarExamples && section.grammarExamples.length > 0 && (
              <div className="lr-grammar-examples">
                {section.grammarExamples.map((ex, idx) => (
                  <div key={idx} className="lr-grammar-example">
                    <p className="lr-example-jp">{ex.japanese}</p>
                    {ex.reading && <p className="lr-example-romaji">{ex.reading}</p>}
                    <p className="lr-example-en">{ex.english}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <>
            {section.explanationEn && <p className="lr-explanation">{section.explanationEn}</p>}
            {section.explanationJp && <p className="lr-explanation-jp">{section.explanationJp}</p>}
          </>
        );
    }
  };

  return (
    <div className="lr-container">
      {/* Header */}
      <div 
        className="lr-header" 
        style={{ 
          backgroundImage: header.backgroundImage ? `url(${header.backgroundImage})` : undefined,
          background: !header.backgroundImage ? 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)' : undefined
        }}
      >
        <div className="lr-header-overlay" style={{ backgroundColor: header.overlayColor || 'rgba(0,0,0,0.45)' }} />
        <div className="lr-header-content">
          <div className="lr-header-top">
            <span className="lr-level-badge">{header.levelBadge || 'Level 1'}</span>
            <span className="lr-header-divider">|</span>
            <span className="lr-chapter-label">{header.chapterLabel}</span>
          </div>
          <h1 className="lr-lesson-label">{header.lessonLabel}</h1>
          <div className="lr-goal-row">
            <span className="lr-goal-badge">Goal</span>
            <span className="lr-goal-text">{header.goalText}</span>
          </div>
          {header.goalSubtext && (
            <p className="lr-goal-subtext">{header.goalSubtext}</p>
          )}
        </div>
      </div>

      {/* Body - Sections */}
      <div className="lr-body">
        {visibleSections.map((section) => (
          <div key={section.id} className={`lr-section lr-section-${section.sectionType || 'introduce'}`}>
            {/* Section Title - hide for some section types */}
            {section.sectionType !== 'question' && 
             section.sectionType !== 'trivia' && 
             section.sectionType !== 'challenge2' &&
             section.sectionType !== 'pronunciation' &&
             section.sectionType !== 'grammar' &&
             !(section.sectionType === 'practice' && !section.sectionTitle) && (
              <div className="lr-section-header">
                <span className="lr-section-number">{section.sectionNumber}</span>
                <h2 className="lr-section-title">{section.sectionTitle}</h2>
              </div>
            )}
            <div className="lr-section-content">
              {renderSectionContent(section)}
            </div>
          </div>
        ))}

        {/* Vocabulary Section */}
        {vocabulary && vocabulary.length > 0 && (
          <div className="lr-section lr-section-vocabulary">
            <div className="lr-section-header">
              <span className="lr-section-number">
                <i className="fas fa-book"></i>
              </span>
              <h2 className="lr-section-title">Vocabulary</h2>
            </div>
            <div className="lr-vocabulary-grid">
              {vocabulary.map((item, idx) => (
                <div key={item.id || idx} className="lr-vocab-card">
                  <div className="lr-vocab-word">{item.word}</div>
                  {item.reading && <div className="lr-vocab-reading">{item.reading}</div>}
                  <div className="lr-vocab-meaning">{item.meaning}</div>
                  {item.example && (
                    <div className="lr-vocab-example">
                      <p className="lr-vocab-example-jp">{item.example}</p>
                      {item.exampleMeaning && <p className="lr-vocab-example-en">{item.exampleMeaning}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar Section */}
        {grammar && grammar.length > 0 && (
          <div className="lr-section lr-section-grammar-list">
            <div className="lr-section-header">
              <span className="lr-section-number">
                <i className="fas fa-pencil-alt"></i>
              </span>
              <h2 className="lr-section-title">Grammar Points</h2>
            </div>
            <div className="lr-grammar-list">
              {grammar.map((item, idx) => (
                <div key={item.id || idx} className="lr-grammar-card">
                  <div className="lr-grammar-pattern">{item.pattern}</div>
                  <p className="lr-grammar-explanation">{item.explanation}</p>
                  {item.explanationJp && <p className="lr-grammar-explanation-jp">{item.explanationJp}</p>}
                  {item.examples && item.examples.length > 0 && (
                    <div className="lr-grammar-examples">
                      {item.examples.map((ex, exIdx) => (
                        <div key={exIdx} className="lr-grammar-example">
                          <p className="lr-example-jp">{ex.japanese}</p>
                          {ex.reading && <p className="lr-example-romaji">{ex.reading}</p>}
                          <p className="lr-example-en">{ex.english}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exercises Section */}
        {exercises && exercises.length > 0 && (
          <div className="lr-section lr-section-exercises">
            <div className="lr-section-header">
              <span className="lr-section-number">
                <i className="fas fa-tasks"></i>
              </span>
              <h2 className="lr-section-title">Exercises</h2>
            </div>
            <div className="lr-exercises-list">
              {exercises.map((item, idx) => (
                <div key={item.id || idx} className="lr-exercise-card">
                  <div className="lr-exercise-number">#{idx + 1}</div>
                  <div className="lr-exercise-content">
                    <p className="lr-exercise-question">{item.question}</p>
                    {item.options && item.options.length > 0 && (
                      <div className="lr-exercise-options">
                        {item.options.map((opt, optIdx) => (
                          <div key={optIdx} className="lr-exercise-option">
                            <span className="lr-option-letter">{String.fromCharCode(65 + optIdx)}</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

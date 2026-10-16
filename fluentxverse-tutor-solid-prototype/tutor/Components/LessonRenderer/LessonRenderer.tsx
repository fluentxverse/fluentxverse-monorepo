import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import type { LessonMaterial, LessonSection, LessonRendererProps, VocabCard, PronunciationColumn, GrammarRule, DialogueLine, TriviaExample, PracticeItem, ConversationLine, ChallengeQuestion, TopicBox, FeedbackGuideRow, ReadingDialogueLine, DiscussionQuestion, LessonGoalStep, } from '../../types/lesson.types';
import './LessonRenderer.css';
// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function LessonRenderer(_props0: LessonRendererProps) {
    const { header, sections } = _props0["data"];
    const [activeSection, setActiveSection] = createSignal(_props0["currentSectionIndex"] === undefined ? 0 : _props0["currentSectionIndex"]);
    // Filter sections based on mode (hide feedback from students)
    const visibleSections = createMemo(() => {
        if ((_props0["mode"] === undefined ? 'student' : _props0["mode"]) === 'student') {
            return sections.filter(s => s.sectionType !== 'feedback');
        }
        return sections;
    });
    const handleSectionClick = (index: number) => {
        setActiveSection(index);
        _props0["onSectionChange"]?.(index);
    };
    return (<div class={`lr-container lr-mode-${_props0["mode"] === undefined ? 'student' : _props0["mode"]}`}>
      {/* Header */}
      <LessonHeaderComponent header={header}/>

      {/* Navigation */}
      <nav class="lr-nav">
        {visibleSections().map((section, idx) => (<button class={`lr-nav-item ${idx === activeSection() ? 'active' : ''}`} onClick={() => handleSectionClick(idx)}>
            <span class="lr-nav-num">{section.sectionNumber}</span>
            <span class="lr-nav-title">{section.sectionTitle || section.stepTitle || `Section ${idx + 1}`}</span>
          </button>))}
      </nav>

      {/* Content Area */}
      <div class="lr-content-wrapper">
        {/* Main Content */}
        <main class="lr-main">
          {visibleSections().map((section, idx) => (<SectionRenderer section={section} isActive={idx === activeSection()} mode={_props0["mode"] === undefined ? 'student' : _props0["mode"]}/>))}
        </main>

        {/* Tutor Sidebar */}
        {(_props0["mode"] === undefined ? 'student' : _props0["mode"]) === 'tutor' && (_props0["showTutorSidebar"] === undefined ? false : _props0["showTutorSidebar"]) && visibleSections()[activeSection()] && (<TutorSidebar section={visibleSections()[activeSection()]}/>)}
      </div>
    </div>);
}
// ============================================================================
// HEADER COMPONENT
// ============================================================================
function LessonHeaderComponent(_props1: {
    header: LessonMaterial['header'];
}) {
    const bgStyle = createMemo(() => _props1["header"].backgroundImage
        ? { backgroundImage: `url(${_props1["header"].backgroundImage})` }
        : {});
    return (<header class="lr-header" style={cssStyle(bgStyle())}>
      <div class="lr-header-overlay" style={cssStyle({ get backgroundColor() {
                return _props1["header"].overlayColor;
            } })}/>
      <div class="lr-header-content">
        <span class="lr-level-badge">{_props1["header"].levelBadge}</span>
        <p class="lr-chapter">{_props1["header"].chapterLabel}</p>
        <h1 class="lr-lesson-title">{_props1["header"].lessonLabel}</h1>
        <div class="lr-goal">
          <p class="lr-goal-text">{_props1["header"].goalText}</p>
          <p class="lr-goal-subtext">{_props1["header"].goalSubtext}</p>
        </div>
      </div>
    </header>);
}
// ============================================================================
// SECTION RENDERER - Routes to correct section type
// ============================================================================
function SectionRenderer(_props2: {
    section: LessonSection;
    isActive: boolean;
    mode: 'student' | 'tutor';
}) {
    return createMemo(() => {
        if (!_props2["isActive"])
            return null;
        const renderContent = () => {
            switch (_props2["section"].sectionType) {
                case 'introduce':
                    return <IntroduceSection section={_props2["section"]}/>;
                case 'vocabulary':
                    return <VocabularySection section={_props2["section"]}/>;
                case 'question':
                    return <QuestionSection section={_props2["section"]}/>;
                case 'pronunciation':
                    return <PronunciationSection section={_props2["section"]}/>;
                case 'grammar':
                    return <GrammarSection section={_props2["section"]}/>;
                case 'dialogue':
                    return <DialogueSection section={_props2["section"]}/>;
                case 'trivia':
                    return <TriviaSection section={_props2["section"]}/>;
                case 'practice':
                    return <PracticeSection section={_props2["section"]}/>;
                case 'produce':
                    return <ProduceSection section={_props2["section"]}/>;
                case 'challenge':
                    return <ChallengeSection section={_props2["section"]}/>;
                case 'challenge2':
                    return <Challenge2Section section={_props2["section"]}/>;
                case 'feedback':
                    return _props2["mode"] === 'tutor' ? <FeedbackSection section={_props2["section"]}/> : null;
                case 'listening':
                    return <ListeningSection section={_props2["section"]}/>;
                case 'listeningChallenge':
                    return <ListeningChallengeSection section={_props2["section"]}/>;
                case 'reading':
                    return <ReadingSection section={_props2["section"]}/>;
                case 'discussion-questions':
                    return <DiscussionQuestionsSection section={_props2["section"]}/>;
                default:
                    return <GenericSection section={_props2["section"]}/>;
            }
        };
        return (<section class={`lr-section lr-section-${_props2["section"].sectionType}`} id={_props2["section"].id}>
      {_props2["section"].sectionTitle && (<div class="lr-section-header">
          <span class="lr-section-number">{_props2["section"].sectionNumber}</span>
          <h2 class="lr-section-title">{_props2["section"].sectionTitle}</h2>
        </div>)}
      {_props2["section"].stepTitle && <h3 class="lr-step-title">{_props2["section"].stepTitle}</h3>}
      {renderContent()}
    </section>);
    }) as unknown as JSX.Element;
}
// ============================================================================
// INTRODUCE SECTION
// ============================================================================
function IntroduceSection(_props3: {
    section: LessonSection;
}) {
    return (<div class="lr-introduce">
      {_props3["section"].explanationEn && <p class="lr-text-en">{_props3["section"].explanationEn}</p>}
      {_props3["section"].explanationJp && <p class="lr-text-jp">{_props3["section"].explanationJp}</p>}
      {_props3["section"].sectionImage && (<div class="lr-image-wrapper">
          <img src={_props3["section"].sectionImage} alt=""/>
        </div>)}
      {_props3["section"].importantNote && (<div class="lr-important-note">
          <TutorIcon name="ri-information-line"/>
          <p>{_props3["section"].importantNote}</p>
        </div>)}
    </div>);
}
// ============================================================================
// VOCABULARY SECTION
// ============================================================================
function VocabularySection(_props4: {
    section: LessonSection;
}) {
    return (<div class="lr-vocabulary">
      {_props4["section"].instructionEn && <p class="lr-instruction-en">{_props4["section"].instructionEn}</p>}
      {_props4["section"].instructionJp && <p class="lr-instruction-jp">{_props4["section"].instructionJp}</p>}

      {_props4["section"].vocabCards && _props4["section"].vocabCards.length > 0 && (<div class="lr-vocab-grid">
          {_props4["section"].vocabCards.map((card) => (<VocabCardItem card={card}/>))}
        </div>)}
    </div>);
}
function VocabCardItem(_props5: {
    card: VocabCard;
}) {
    return (<div class="lr-vocab-card">
      {_props5["card"].image && (<div class="lr-vocab-image">
          <img src={_props5["card"].image} alt={_props5["card"].wordEn}/>
        </div>)}
      <div class="lr-vocab-text">
        <span class="lr-vocab-en">{_props5["card"].wordEn}</span>
        <span class="lr-vocab-jp">{_props5["card"].wordJp}</span>
      </div>
    </div>);
}
// ============================================================================
// QUESTION SECTION (Image cards with labels)
// ============================================================================
function QuestionSection(_props6: {
    section: LessonSection;
}) {
    return (<div class="lr-question">
      {_props6["section"].instructionEn && <p class="lr-instruction-en">{_props6["section"].instructionEn}</p>}
      {_props6["section"].instructionJp && <p class="lr-instruction-jp">{_props6["section"].instructionJp}</p>}

      {_props6["section"].imageCards && _props6["section"].imageCards.length > 0 && (<div class="lr-image-cards-grid">
          {_props6["section"].imageCards.map((card) => (<div class="lr-image-card">
              {card.image && <img src={card.image} alt={card.label}/>}
              <span class="lr-image-label">{card.label}</span>
            </div>))}
        </div>)}
    </div>);
}
// ============================================================================
// PRONUNCIATION SECTION
// ============================================================================
function PronunciationSection(_props7: {
    section: LessonSection;
}) {
    return (<div class="lr-pronunciation">
      {_props7["section"].instructionEn && <p class="lr-instruction-en">{_props7["section"].instructionEn}</p>}
      {_props7["section"].instructionJp && <p class="lr-instruction-jp">{_props7["section"].instructionJp}</p>}

      {_props7["section"].pronunciationColumns && _props7["section"].pronunciationColumns.length > 0 && (<div class="lr-pronunciation-columns">
          {_props7["section"].pronunciationColumns.map((col) => (<PronunciationColumnItem column={col}/>))}
        </div>)}
    </div>);
}
function PronunciationColumnItem(_props8: {
    column: PronunciationColumn;
}) {
    return (<div class="lr-pronunciation-col">
      <div class="lr-sound-label">{_props8["column"].soundLabel}</div>
      {_props8["column"].image && (<div class="lr-mouth-image">
          <img src={_props8["column"].image} alt={_props8["column"].soundLabel}/>
        </div>)}
      <ul class="lr-pronunciation-words">
        {_props8["column"].words.map((word) => (<li>
            <span class="lr-word-en">{word.wordEn}</span>
            <span class="lr-word-jp">{word.wordJp}</span>
          </li>))}
      </ul>
    </div>);
}
// ============================================================================
// GRAMMAR SECTION
// ============================================================================
function GrammarSection(_props9: {
    section: LessonSection;
}) {
    return (<div class="lr-grammar">
      {_props9["section"].instructionEn && <p class="lr-instruction-en lr-grammar-tip">{_props9["section"].instructionEn}</p>}
      {_props9["section"].instructionJp && <p class="lr-instruction-jp">{_props9["section"].instructionJp}</p>}

      {_props9["section"].grammarRules && _props9["section"].grammarRules.length > 0 && (<div class="lr-grammar-rules">
          {_props9["section"].grammarRules.map((rule) => (<GrammarRuleItem rule={rule}/>))}
        </div>)}
    </div>);
}
function GrammarRuleItem(_props10: {
    rule: GrammarRule;
}) {
    return (<div class="lr-grammar-rule">
      <p class="lr-rule-en">{_props10["rule"].ruleEn}</p>
      <p class="lr-rule-jp">{_props10["rule"].ruleJp}</p>
      {_props10["rule"].examples.length > 0 && (<div class="lr-grammar-examples">
          {_props10["rule"].examples.map((ex) => (<div class="lr-grammar-example">
              <p class="lr-example-en">
                {highlightWords(ex.sentenceEn, ex.boldWords || [])}
              </p>
              <p class="lr-example-jp">{ex.sentenceJp}</p>
            </div>))}
        </div>)}
    </div>);
}
// Helper to bold specific words
function highlightWords(text: string, words: string[]) {
    if (!words.length)
        return <>{text}</>;
    let result = text;
    words.forEach((word) => {
        const regex = new RegExp(`(${word})`, 'gi');
        result = result.replace(regex, '|||$1|||');
    });
    const segments = result.split('|||');
    return (<>
      {segments.map((seg, i) => words.some((w) => w.toLowerCase() === seg.toLowerCase()) ? (<strong>{seg}</strong>) : (seg))}
    </>);
}
// ============================================================================
// DIALOGUE SECTION
// ============================================================================
function DialogueSection(_props11: {
    section: LessonSection;
}) {
    return (<div class="lr-dialogue">
      {_props11["section"].instructionEn && <p class="lr-instruction-en">{_props11["section"].instructionEn}</p>}
      {_props11["section"].instructionJp && <p class="lr-instruction-jp">{_props11["section"].instructionJp}</p>}

      {_props11["section"].dialogueImage && (<div class="lr-dialogue-image">
          <img src={_props11["section"].dialogueImage} alt="Scene"/>
        </div>)}

      {_props11["section"].dialogueLines && _props11["section"].dialogueLines.length > 0 && (<div class="lr-dialogue-lines">
          {_props11["section"].dialogueLines.map((line) => (<DialogueLineItem line={line}/>))}
        </div>)}
    </div>);
}
function DialogueLineItem(_props12: {
    line: DialogueLine;
}) {
    return (<div class={`lr-dialogue-line ${_props12["line"].isItalic ? 'italic' : ''}`}>
      <span class="lr-speaker">{_props12["line"].speaker}</span>
      <span class="lr-line-text">{_props12["line"].lineEn}</span>
    </div>);
}
// ============================================================================
// TRIVIA SECTION
// ============================================================================
function TriviaSection(_props13: {
    section: LessonSection;
}) {
    return (<div class="lr-trivia">
      {_props13["section"].instructionEn && <p class="lr-instruction-en">{_props13["section"].instructionEn}</p>}
      {_props13["section"].instructionJp && <p class="lr-instruction-jp">{_props13["section"].instructionJp}</p>}

      {_props13["section"].triviaImage && (<div class="lr-trivia-image">
          <img src={_props13["section"].triviaImage} alt=""/>
        </div>)}

      {_props13["section"].triviaExamples && _props13["section"].triviaExamples.length > 0 && (<div class="lr-trivia-examples">
          {_props13["section"].triviaExamples.map((ex) => (<TriviaExampleItem example={ex}/>))}
        </div>)}
    </div>);
}
function TriviaExampleItem(_props14: {
    example: TriviaExample;
}) {
    return (<div class={`lr-trivia-example ${_props14["example"].isCorrect ? 'correct' : 'incorrect'}`}>
      <div class="lr-trivia-marker">{_props14["example"].isCorrect ? 'O' : 'X'}</div>
      <div class="lr-trivia-content">
        <p class="lr-trivia-line-a">
          <span class="lr-speaker">{_props14["example"].speakerA}:</span> {_props14["example"].lineA}
        </p>
        {_props14["example"].lineAJp && <p class="lr-trivia-jp">{_props14["example"].lineAJp}</p>}
        <p class="lr-trivia-line-b">
          <span class="lr-speaker">{_props14["example"].speakerB}:</span> {_props14["example"].lineB}
        </p>
        {_props14["example"].lineBJp && <p class="lr-trivia-jp">{_props14["example"].lineBJp}</p>}
      </div>
    </div>);
}
// ============================================================================
// PRACTICE SECTION
// ============================================================================
function PracticeSection(_props15: {
    section: LessonSection;
}) {
    return (<div class="lr-practice">
      {_props15["section"].instructionEn && <p class="lr-instruction-en">{_props15["section"].instructionEn}</p>}
      {_props15["section"].instructionJp && <p class="lr-instruction-jp">{_props15["section"].instructionJp}</p>}

      {/* Word box */}
      {_props15["section"].wordBox && _props15["section"].wordBox.length > 0 && (<div class="lr-word-box">
          {_props15["section"].wordBox.map((word, i) => (<span class="lr-word-chip">{word}</span>))}
        </div>)}

      {/* Example */}
      {_props15["section"].practiceExample && (<div class="lr-practice-example">
          <p class="lr-example-q">{_props15["section"].practiceExample}</p>
          {_props15["section"].practiceExampleAnswer && (<p class="lr-example-a">{_props15["section"].practiceExampleAnswer}</p>)}
        </div>)}

      {/* Practice items */}
      {_props15["section"].practiceItems && _props15["section"].practiceItems.length > 0 && (<ol class="lr-practice-items">
          {_props15["section"].practiceItems.map((item, idx) => (<PracticeItemRow item={item} number={idx + 1}/>))}
        </ol>)}

      {/* Conversation lines */}
      {_props15["section"].conversationLines && _props15["section"].conversationLines.length > 0 && (<div class="lr-conversation">
          {_props15["section"].conversationLines.map((line) => (<ConversationLineItem line={line}/>))}
        </div>)}

      {_props15["section"].practiceImage && (<div class="lr-practice-image">
          <img src={_props15["section"].practiceImage} alt=""/>
        </div>)}
    </div>);
}
function PracticeItemRow(_props16: {
    item: PracticeItem;
    number: number;
}) {
    const [showAnswer, setShowAnswer] = createSignal(false);
    return (<li class="lr-practice-item">
      <span class="lr-item-num">{_props16["number"]}.</span>
      <div class="lr-item-content">
        <p class="lr-item-question">{_props16["item"].question}</p>
        {_props16["item"].questionJp && <p class="lr-item-jp">{_props16["item"].questionJp}</p>}
        <button class="lr-show-answer" onClick={() => setShowAnswer(!showAnswer())}>
          {showAnswer() ? 'Hide Answer' : 'Show Answer'}
        </button>
        {showAnswer() && <p class="lr-item-answer">{_props16["item"].answer}</p>}
      </div>
    </li>);
}
function ConversationLineItem(_props17: {
    line: ConversationLine;
}) {
    return (<div class={`lr-conv-line lr-conv-${_props17["line"].speaker.toLowerCase()}`}>
      <span class="lr-conv-speaker">{_props17["line"].speaker}:</span>
      <span class="lr-conv-text">{_props17["line"].text}</span>
    </div>);
}
// ============================================================================
// PRODUCE SECTION
// ============================================================================
function ProduceSection(_props18: {
    section: LessonSection;
}) {
    return (<div class="lr-produce">
      {_props18["section"].instructionEn && <p class="lr-instruction-en">{_props18["section"].instructionEn}</p>}
      {_props18["section"].instructionJp && <p class="lr-instruction-jp">{_props18["section"].instructionJp}</p>}
      {_props18["section"].sectionImage && (<div class="lr-image-wrapper">
          <img src={_props18["section"].sectionImage} alt=""/>
        </div>)}
    </div>);
}
// ============================================================================
// CHALLENGE SECTION
// ============================================================================
function ChallengeSection(_props19: {
    section: LessonSection;
}) {
    return (<div class="lr-challenge">
      {_props19["section"].challengeTitle && <h4 class="lr-challenge-title">{_props19["section"].challengeTitle}</h4>}

      {_props19["section"].situationEn && (<div class="lr-situation">
          <p class="lr-situation-en">{_props19["section"].situationEn}</p>
          {_props19["section"].situationJp && <p class="lr-situation-jp">{_props19["section"].situationJp}</p>}
        </div>)}

      {_props19["section"].grammarTipTitle && _props19["section"].grammarTipItems && (<div class="lr-grammar-tip-box">
          <h5>{_props19["section"].grammarTipTitle}</h5>
          <div class="lr-tip-items">
            {_props19["section"].grammarTipItems.map((item, i) => (<span class="lr-tip-item">{item}</span>))}
          </div>
        </div>)}

      {_props19["section"].challengeQuestions && _props19["section"].challengeQuestions.length > 0 && (<div class="lr-challenge-questions">
          {_props19["section"].challengeQuestions.map((q) => (<ChallengeQuestionItem question={q}/>))}
        </div>)}
    </div>);
}
function ChallengeQuestionItem(_props20: {
    question: ChallengeQuestion;
}) {
    return (<div class="lr-challenge-q">
      <p class="lr-q-main">{_props20["question"].question}</p>
      {_props20["question"].subQuestions && _props20["question"].subQuestions.length > 0 && (<ul class="lr-sub-questions">
          {_props20["question"].subQuestions.map((sq, i) => (<li class="lr-sub-q">{sq}</li>))}
        </ul>)}
    </div>);
}
// ============================================================================
// CHALLENGE 2 SECTION (Topics)
// ============================================================================
function Challenge2Section(_props21: {
    section: LessonSection;
}) {
    return (<div class="lr-challenge2">
      {_props21["section"].isOptional && <span class="lr-optional-badge">If Time Allows</span>}
      {_props21["section"].challengeTitle && <h4 class="lr-challenge-title">{_props21["section"].challengeTitle}</h4>}

      {_props21["section"].instructionEn && <p class="lr-instruction-en">{_props21["section"].instructionEn}</p>}
      {_props21["section"].instructionJp && <p class="lr-instruction-jp">{_props21["section"].instructionJp}</p>}

      {_props21["section"].topicBoxes && _props21["section"].topicBoxes.length > 0 && (<div class="lr-topic-boxes">
          {_props21["section"].topicBoxes.map((box) => (<TopicBoxItem box={box}/>))}
        </div>)}
    </div>);
}
function TopicBoxItem(_props22: {
    box: TopicBox;
}) {
    return (<div class="lr-topic-box">
      <div class="lr-topic-header">
        <span class="lr-topic-num">Topic {_props22["box"].topicNumber}</span>
        <span class="lr-topic-title">{_props22["box"].topicTitle}</span>
      </div>
      <ul class="lr-topic-questions">
        {_props22["box"].questions.map((q) => (<li>{q.question}</li>))}
      </ul>
    </div>);
}
// ============================================================================
// FEEDBACK SECTION (Tutor only)
// ============================================================================
function FeedbackSection(_props23: {
    section: LessonSection;
}) {
    return (<div class="lr-feedback">
      <h4 class="lr-feedback-title">Lesson Goal Achievement</h4>

      {_props23["section"].feedbackRubric && _props23["section"].feedbackRubric.length > 0 && (<div class="lr-rubric">
          {_props23["section"].feedbackRubric.map((item) => (<div class="lr-rubric-item">
              <span class="lr-rubric-score">{item.score}</span>
              <span class="lr-rubric-label">{item.label}</span>
              <span class="lr-rubric-desc">{item.description}</span>
            </div>))}
        </div>)}

      {_props23["section"].feedbackCategories && _props23["section"].feedbackCategories.length > 0 && (<div class="lr-feedback-categories">
          <h5>Personalized Feedback Categories</h5>
          {_props23["section"].feedbackCategories.map((cat) => (<div class="lr-feedback-cat">
              <span class="lr-cat-title">{cat.title}</span>
              <span class="lr-cat-jp">{cat.titleJp}</span>
              <span class="lr-cat-desc">{cat.descJp}</span>
            </div>))}
        </div>)}

      {_props23["section"].feedbackGuide && _props23["section"].feedbackGuide.length > 0 && (<div class="lr-feedback-guide">
          <h5>Personalized Feedback Guide</h5>
          <table class="lr-guide-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Focus On</th>
                <th>Example Feedback</th>
              </tr>
            </thead>
            <tbody>
              {_props23["section"].feedbackGuide.map((row) => (<FeedbackGuideRowItem row={row}/>))}
            </tbody>
          </table>
        </div>)}

      {_props23["section"].feedbackTemplate && (<div class="lr-feedback-template">
          <h5>Copy Template</h5>
          <pre class="lr-template-text">{_props23["section"].feedbackTemplate}</pre>
          <button class="lr-copy-btn" onClick={() => navigator.clipboard.writeText(_props23["section"].feedbackTemplate || '')}>
            <TutorIcon name="ri-file-copy-line"/> Copy
          </button>
        </div>)}
    </div>);
}
function FeedbackGuideRowItem(_props24: {
    row: FeedbackGuideRow;
}) {
    return (<tr>
      <td>
        <strong>{_props24["row"].category}</strong>
        <br />
        <small>{_props24["row"].categoryDesc}</small>
      </td>
      <td innerHTML={{ get __html() {
                return _props24["row"].focusOn;
            } }.__html}/>
      <td innerHTML={{ get __html() {
                return _props24["row"].exampleFeedback;
            } }.__html}/>
    </tr>);
}
// ============================================================================
// LISTENING SECTION
// ============================================================================
function ListeningSection(_props25: {
    section: LessonSection;
}) {
    return (<div class="lr-listening">
      {_props25["section"].instructionEn && <p class="lr-instruction-en">{_props25["section"].instructionEn}</p>}
      {_props25["section"].instructionJp && <p class="lr-instruction-jp">{_props25["section"].instructionJp}</p>}

      {_props25["section"].listeningScriptText && (<div class="lr-listening-script">
          <h5>Script</h5>
          <pre class="lr-script-text">{_props25["section"].listeningScriptText}</pre>
        </div>)}

      {_props25["section"].listeningQuestions && _props25["section"].listeningQuestions.length > 0 && (<div class="lr-listening-questions">
          <h5>Questions</h5>
          {_props25["section"].listeningQuestions.map((q) => (<div class="lr-listening-q">
              <p class="lr-q-en">{q.questionEn}</p>
              <p class="lr-q-jp">{q.questionJp}</p>
            </div>))}
        </div>)}
    </div>);
}
// ============================================================================
// LISTENING CHALLENGE SECTION
// ============================================================================
function ListeningChallengeSection(_props26: {
    section: LessonSection;
}) {
    return (<div class="lr-listening-challenge">
      {_props26["section"].roleplaySetupLines && _props26["section"].roleplaySetupLines.length > 0 && (<div class="lr-roleplay-setup">
          {_props26["section"].roleplaySetupLines.map((line, i) => (<p>{line}</p>))}
        </div>)}

      {_props26["section"].roleplayScript && (<div class="lr-roleplay-script">
          <pre>{_props26["section"].roleplayScript}</pre>
        </div>)}

      {_props26["section"].roleplayTips && _props26["section"].roleplayTips.length > 0 && (<div class="lr-roleplay-tips">
          {_props26["section"].roleplayTips.map((tip, i) => (<p class="lr-tip">◆ {tip}</p>))}
        </div>)}

      {_props26["section"].roleplayConversation && _props26["section"].roleplayConversation.length > 0 && (<div class="lr-roleplay-conversation">
          {_props26["section"].roleplayConversation.map((line) => (<div class={`lr-roleplay-line ${line.isHeader ? 'header' : ''} ${line.isFooter ? 'footer' : ''}`}>
              <span class="lr-line-num">{line.number}.</span>
              <span class="lr-line-text">{line.text}</span>
              {line.comment && <span class="lr-line-comment">{line.comment}</span>}
            </div>))}
        </div>)}
    </div>);
}
// ============================================================================
// READING SECTION
// ============================================================================
function ReadingSection(_props27: {
    section: LessonSection;
}) {
    return (<div class="lr-reading">
      {_props27["section"].instructionEn && <p class="lr-instruction-en">{_props27["section"].instructionEn}</p>}
      {_props27["section"].instructionJp && <p class="lr-instruction-jp">{_props27["section"].instructionJp}</p>}

      {_props27["section"].readingImage && (<div class="lr-reading-image">
          <img src={_props27["section"].readingImage} alt=""/>
        </div>)}

      {_props27["section"].readingDialogueLines && _props27["section"].readingDialogueLines.length > 0 && (<div class="lr-reading-dialogue">
          {_props27["section"].readingDialogueLines.map((line) => (<ReadingDialogueLineItem line={line}/>))}
        </div>)}

      {_props27["section"].readingQuestions && _props27["section"].readingQuestions.length > 0 && (<div class="lr-reading-questions">
          <h5>Questions</h5>
          {_props27["section"].readingQuestions.map((q) => (<div class="lr-reading-q">
              <p class="lr-q-text">{q.questionEn}</p>
              <p class="lr-q-answer">{q.answer}</p>
            </div>))}
        </div>)}
    </div>);
}
function ReadingDialogueLineItem(_props28: {
    line: ReadingDialogueLine;
}) {
    const renderText = () => {
        if (!_props28["line"].underlineWords || _props28["line"].underlineWords.length === 0) {
            return _props28["line"].lineEn;
        }
        let text = _props28["line"].lineEn;
        _props28["line"].underlineWords.forEach((word) => {
            text = text.replace(new RegExp(`(${word})`, 'gi'), '<u>$1</u>');
        });
        return <span innerHTML={{ __html: text }.__html}/>;
    };
    return (<div class="lr-reading-line">
      <span class="lr-reading-speaker">{_props28["line"].speaker}:</span>
      <span class="lr-reading-text">{renderText()}</span>
    </div>);
}
// ============================================================================
// DISCUSSION QUESTIONS SECTION
// ============================================================================
function DiscussionQuestionsSection(_props29: {
    section: LessonSection;
}) {
    return (<div class="lr-discussion">
      {_props29["section"].instructionEn && <p class="lr-instruction-en">{_props29["section"].instructionEn}</p>}
      {_props29["section"].instructionJp && <p class="lr-instruction-jp">{_props29["section"].instructionJp}</p>}

      {_props29["section"].discussionQuestions && _props29["section"].discussionQuestions.length > 0 && (<div class="lr-discussion-list">
          {_props29["section"].discussionQuestions.map((q) => (<DiscussionQuestionItem question={q}/>))}
        </div>)}
    </div>);
}
function DiscussionQuestionItem(_props30: {
    question: DiscussionQuestion;
}) {
    return (<div class="lr-discussion-q">
      <span class="lr-q-num">{_props30["question"].number}.</span>
      <div class="lr-q-content">
        <p class="lr-q-text">{_props30["question"].question}</p>
        <span class="lr-q-category">{_props30["question"].category}</span>
      </div>
    </div>);
}
// ============================================================================
// GENERIC SECTION (Fallback)
// ============================================================================
function GenericSection(_props31: {
    section: LessonSection;
}) {
    return (<div class="lr-generic">
      {_props31["section"].explanationEn && <p class="lr-text-en">{_props31["section"].explanationEn}</p>}
      {_props31["section"].explanationJp && <p class="lr-text-jp">{_props31["section"].explanationJp}</p>}
      {_props31["section"].sectionImage && (<div class="lr-image-wrapper">
          <img src={_props31["section"].sectionImage} alt=""/>
        </div>)}
    </div>);
}
// ============================================================================
// TUTOR SIDEBAR
// ============================================================================
function TutorSidebar(_props32: {
    section: LessonSection;
}) {
    return (<aside class="lr-tutor-sidebar">
      {_props32["section"].sidebarTitle && (<div class="lr-sidebar-header">
          <h4>{_props32["section"].sidebarTitle}</h4>
          {_props32["section"].sidebarSubtitle && <span>{_props32["section"].sidebarSubtitle}</span>}
        </div>)}

      {_props32["section"].lessonGoalTitle && <h5 class="lr-goal-title">{_props32["section"].lessonGoalTitle}</h5>}

      {_props32["section"].lessonGoalSteps && _props32["section"].lessonGoalSteps.length > 0 && (<ol class="lr-goal-steps">
          {_props32["section"].lessonGoalSteps.map((step, idx) => (<LessonGoalStepItem step={step} number={idx + 1}/>))}
        </ol>)}

      {/* Answer box for practice sections */}
      {_props32["section"].answerItems && _props32["section"].answerItems.length > 0 && (<div class="lr-answer-box">
          <h5>Answers</h5>
          <ol>
            {_props32["section"].answerItems.map((ans, i) => (<li>{ans}</li>))}
          </ol>
        </div>)}
    </aside>);
}
function LessonGoalStepItem(_props33: {
    step: LessonGoalStep;
    number: number;
}) {
    return (<li class="lr-step-item">
      <span class="lr-step-num">{_props33["number"]}.</span>
      <div class="lr-step-content">
        {_props33["step"].instruction && <p class="lr-step-instruction">{_props33["step"].instruction}</p>}
        {_props33["step"].scriptLine && <p class="lr-step-script">"{_props33["step"].scriptLine}"</p>}
        {_props33["step"].scriptLines && _props33["step"].scriptLines.map((line, i) => (<p class="lr-step-script">"{line}"</p>))}
        {_props33["step"].tipText && <p class="lr-step-tip">💡 {_props33["step"].tipText}</p>}
      </div>
    </li>);
}

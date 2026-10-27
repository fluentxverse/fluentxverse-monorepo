import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from '../Components/Common/TutorArt';
import { ArrowLeft, ArrowRight, BookOpenText, Clock3, ListOrdered, RotateCcw, ShieldCheck, SpellCheck } from 'lucide-solid';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { toastConfirm } from '../Components/Common/Toast';
import { generateExam, submitExam, getActiveExam, saveExamAnswers, checkExpiredExam, type ClientExam, type ExamQuestion, type FillInBlankQuestion, type ComprehensionQuestion, type ComprehensionPassage, type ExamResult, } from '../api/exam.api';
import './ExamPage.css';
import './WrittenExamPage.css';
type ExamPhase = 'intro' | 'loading' | 'exam' | 'submitting' | 'results' | 'expired';
// LocalStorage keys for exam state persistence (backup only)
const STORAGE_KEYS = {
    EXAM_ID: 'fluentx_exam_id',
    ANSWERS: 'fluentx_exam_answers',
    CURRENT_QUESTION: 'fluentx_exam_current_question'
};
// Debounce interval for server-side saving (ms)
const SAVE_DEBOUNCE_MS = 2000;
const ExamPage = () => {
    const _state0 = useAuthContext();
    const [phase, setPhase] = createSignal<ExamPhase>('intro');
    const [exam, setExam] = createSignal<ClientExam | null>(null);
    const [currentQuestion, setCurrentQuestion] = createSignal(0);
    const [answers, setAnswers] = createSignal<number[]>([]);
    const [timeRemaining, setTimeRemaining] = createSignal(0);
    const [result, setResult] = createSignal<ExamResult | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [isResuming, setIsResuming] = createSignal(false);
    const [canRetake, setCanRetake] = createSignal(false);
    const timerRef = { current: null } as {
        current: (number | null) | null;
    };
    const saveTimeoutRef = { current: null } as {
        current: (number | null) | null;
    };
    const submitRef = { current: undefined } as {
        current: (() => Promise<void>) | null;
    };
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Written Proficiency Test | FluentXVerse';
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    // Calculate remaining time based on server startedAt timestamp
    const calculateRemainingTime = createMemo(on(() => [], () => (examData: ClientExam): number => {
        if (!examData.startedAt) {
            // Fallback to full time if no startedAt (shouldn't happen)
            return examData.timeLimit * 60;
        }
        const startTime = new Date(examData.startedAt).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalSeconds = examData.timeLimit * 60;
        const remaining = totalSeconds - elapsedSeconds;
        return Math.max(0, remaining);
    }));
    // Save answers to localStorage (backup)
    const saveToLocalStorage = createMemo(on(() => [], () => (examId: string, answersArr: number[], currentQ: number) => {
        try {
            localStorage.setItem(STORAGE_KEYS.EXAM_ID, examId);
            localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answersArr));
            localStorage.setItem(STORAGE_KEYS.CURRENT_QUESTION, currentQ.toString());
        }
        catch (e) {
            console.warn('Failed to save exam state to localStorage:', e);
        }
    }));
    // Save answers to server (debounced)
    const saveToServer = createMemo(on(() => [], () => (examId: string, tutorId: string, answersArr: number[], currentQ: number) => {
        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        // Debounce server saves
        saveTimeoutRef.current = window.setTimeout(async () => {
            try {
                await saveExamAnswers(examId, tutorId, answersArr, currentQ);
            }
            catch (e) {
                console.warn('Failed to save answers to server:', e);
            }
        }, SAVE_DEBOUNCE_MS);
    }));
    // Combined save function
    const saveAnswers = createMemo(on(() => [_state0.user, saveToLocalStorage(), saveToServer()], () => (examId: string, answersArr: number[], currentQ: number) => {
        // Always save to localStorage immediately
        saveToLocalStorage()(examId, answersArr, currentQ);
        // Also save to server (debounced)
        if (_state0.user) {
            saveToServer()(examId, _state0.user.userId, answersArr, currentQ);
        }
    }));
    // Load answers from localStorage
    const loadFromStorage = createMemo(on(() => [], () => (examId: string): {
        answers: number[];
        currentQuestion: number;
    } | null => {
        try {
            const storedExamId = localStorage.getItem(STORAGE_KEYS.EXAM_ID);
            if (storedExamId !== examId)
                return null;
            const storedAnswers = localStorage.getItem(STORAGE_KEYS.ANSWERS);
            const storedQuestion = localStorage.getItem(STORAGE_KEYS.CURRENT_QUESTION);
            if (storedAnswers) {
                return {
                    answers: JSON.parse(storedAnswers),
                    currentQuestion: storedQuestion ? parseInt(storedQuestion, 10) : 0
                };
            }
        }
        catch (e) {
            console.warn('Failed to load exam state from localStorage:', e);
        }
        return null;
    }));
    // Clear localStorage after exam submission
    const clearStorage = createMemo(on(() => [], () => () => {
        try {
            localStorage.removeItem(STORAGE_KEYS.EXAM_ID);
            localStorage.removeItem(STORAGE_KEYS.ANSWERS);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_QUESTION);
        }
        catch (e) {
            console.warn('Failed to clear exam state from localStorage:', e);
        }
    }));
    // Check for active exam on page load and auto-resume
    createEffect(on(() => [_state0.user, calculateRemainingTime(), loadFromStorage(), clearStorage()], () => {
        const _cleanup2 = untrack(() => {
            const checkForActiveExam = async () => {
                if (!_state0.user)
                    return;
                try {
                    // First, check if there's an expired exam that needs auto-submission
                    const expiredCheck = await checkExpiredExam(_state0.user.userId);
                    if (expiredCheck.expired && expiredCheck.result) {
                        // Exam was expired and auto-submitted by server
                        setResult(expiredCheck.result);
                        setCanRetake(expiredCheck.canRetake || false);
                        clearStorage()();
                        setPhase('expired');
                        return;
                    }
                    // Check for active (non-expired) exam
                    const response = await getActiveExam(_state0.user.userId);
                    if (response.success && response.exam) {
                        const remainingTime = calculateRemainingTime()(response.exam);
                        if (remainingTime <= 0) {
                            // Edge case: expired between check-expired and getActive calls
                            // Submit now
                            const answersToSubmit = response.exam.savedAnswers ||
                                new Array(response.exam.questions.length).fill(-1);
                            setPhase('submitting');
                            const submitResponse = await submitExam(response.exam.examId, _state0.user.userId, answersToSubmit);
                            if (submitResponse.success && submitResponse.result) {
                                setResult(submitResponse.result);
                                clearStorage()();
                                setPhase('results');
                            }
                            return;
                        }
                        // Resume with remaining time
                        setIsResuming(true);
                        setExam(response.exam);
                        // Prefer server-saved answers, fallback to localStorage
                        if (response.exam.savedAnswers) {
                            setAnswers(response.exam.savedAnswers);
                            setCurrentQuestion(response.exam.currentQuestion || 0);
                        }
                        else {
                            const stored = loadFromStorage()(response.exam.examId);
                            if (stored) {
                                setAnswers(stored.answers);
                                setCurrentQuestion(stored.currentQuestion);
                            }
                            else {
                                setAnswers(new Array(response.exam.questions.length).fill(-1));
                                setCurrentQuestion(0);
                            }
                        }
                        setTimeRemaining(remainingTime);
                        setPhase('exam');
                    }
                }
                catch (err) {
                    console.error('Error checking for active exam:', err);
                }
            };
            checkForActiveExam();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Beforeunload warning during exam
    createEffect(on(() => [phase()], () => {
        const _cleanup3 = untrack(() => {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                if (phase() === 'exam') {
                    e.preventDefault();
                    e.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
                    return e.returnValue;
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    // Timer countdown
    createEffect(on(() => [phase()], () => {
        const _cleanup4 = untrack(() => {
            if (phase() === 'exam' && timeRemaining() > 0) {
                timerRef.current = window.setInterval(() => {
                    setTimeRemaining((prev) => {
                        if (prev <= 1) {
                            handleSubmit();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    const startExam = async () => {
        if (!_state0.user)
            return;
        setPhase('loading');
        setError(null);
        setIsResuming(false);
        try {
            const response = await generateExam(_state0.user.userId);
            if (response.success && response.exam) {
                setExam(response.exam);
                // Initialize answers array with -1 (unanswered)
                const initialAnswers = new Array(response.exam.questions.length).fill(-1);
                setAnswers(initialAnswers);
                // Calculate remaining time based on server startedAt
                const remaining = calculateRemainingTime()(response.exam);
                setTimeRemaining(remaining);
                setCurrentQuestion(0);
                // Save initial state to localStorage and server
                saveAnswers()(response.exam.examId, initialAnswers, 0);
                setPhase('exam');
            }
            else {
                setError(response.message || 'Failed to generate exam');
                setPhase('intro');
            }
        }
        catch (err) {
            console.error('Error starting exam:', err);
            const message = (err as any)?.response?.data?.message;
            setError(typeof message === 'string' ? message : 'Your assessment could not be prepared. Please try again. Your exam has not started.');
            setPhase('intro');
        }
    };
    const selectAnswer = (answerIndex: number) => {
        const newAnswers = [...answers()];
        newAnswers[currentQuestion()] = answerIndex;
        setAnswers(newAnswers);
        // Save to localStorage and server for resilience
        if (exam()) {
            saveAnswers()(exam().examId, newAnswers, currentQuestion());
        }
    };
    const goToQuestion = (index: number) => {
        setCurrentQuestion(index);
        // Save current question to localStorage and server
        if (exam()) {
            saveAnswers()(exam().examId, answers(), index);
        }
    };
    const handleSubmit = async () => {
        if (!exam() || !_state0.user)
            return;
        const unanswered = answers().filter((a) => a === -1).length;
        if (unanswered > 0 && timeRemaining() > 0) {
            const confirmed = await toastConfirm(`You have ${unanswered} unanswered question(s). Are you sure you want to submit?`, 'Submit Exam');
            if (!confirmed)
                return;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setPhase('submitting');
        try {
            const response = await submitExam(exam().examId, _state0.user.userId, answers());
            if (response.success && response.result) {
                // Clear localStorage after successful submission
                clearStorage()();
                setResult(response.result);
                setPhase('results');
            }
            else {
                setError(response.message || 'Failed to submit exam');
                setPhase('exam');
            }
        }
        catch (err) {
            console.error('Error submitting exam:', err);
            setError('Failed to submit exam. Please try again.');
            setPhase('exam');
        }
    };
    const getTypeIcon = (type: ExamQuestion['type']) => {
        switch (type) {
            case 'grammar':
                return 'fas fa-spell-check';
            case 'vocabulary':
                return 'fas fa-book';
            case 'comprehension':
                return 'fas fa-glasses';
            default:
                return 'fas fa-question';
        }
    };
    const getTypeColor = (type: ExamQuestion['type']) => {
        switch (type) {
            case 'grammar':
                return '#3b82f6';
            case 'vocabulary':
                return '#8b5cf6';
            case 'comprehension':
                return '#10b981';
            default:
                return '#6b7280';
        }
    };
    // Get passage for a comprehension question
    const getPassageForQuestion = (question: ComprehensionQuestion): ComprehensionPassage | undefined => {
        if (!exam())
            return undefined;
        return exam().passages.find((p) => p.id === question.passageId);
    };
    // Render fill-in-the-blank question (grammar/vocabulary)
    const renderFillInBlank = (question: FillInBlankQuestion) => {
        return (<div class="fill-in-blank-question">
        <p class="sentence-text">{question.sentence}</p>
        <div class="answer-options">
          {question.options.map((option, idx) => (<button type="button" aria-pressed={answers()[currentQuestion()] === idx} class={`answer-option ${answers()[currentQuestion()] === idx ? 'selected' : ''}`} onClick={() => selectAnswer(idx)}>
              <span class="option-letter">{String.fromCharCode(65 + idx)}</span>
              <span class="option-text">{option}</span>
            </button>))}
        </div>
      </div>);
    };
    // Render comprehension question
    const renderComprehension = (question: ComprehensionQuestion) => {
        const passage = getPassageForQuestion(question);
        return (<div class="comprehension-question">
        {passage && (<div class="passage-box">
            <div class="passage-header">
              <TutorIcon name="fas fa-book-reader"/>
              <span>{passage.title}</span>
            </div>
            <p class="passage-text">{passage.content}</p>
          </div>)}
        <div class="comprehension-q">
          <p class="question-text">{question.question}</p>
          <div class="answer-options">
            {question.options.map((option, idx) => (<button type="button" aria-pressed={answers()[currentQuestion()] === idx} class={`answer-option ${answers()[currentQuestion()] === idx ? 'selected' : ''}`} onClick={() => selectAnswer(idx)}>
                <span class="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span class="option-text">{option}</span>
              </button>))}
          </div>
        </div>
      </div>);
    };
    // Render intro screen
    const renderIntro = () => (<div class="exam-intro">
      <div class="written-intro-content">
        <a class="written-back" href="/home"><ArrowLeft size={16} />Tutor application</a>
        <header class="written-heading"><TutorArt name="training" size={52} /><div>
          <p class="written-eyebrow">STEP 1 / WRITTEN ASSESSMENT</p>
          <h1>Written Proficiency Test</h1>
        </div></header>
        <p class="exam-intro-description">
          Demonstrate your English grammar, vocabulary, and reading comprehension.
          Your 25-minute timer begins when your questions are ready.
        </p>

        <div class="exam-info-grid">
          <div class="exam-info-item">
            <ListOrdered size={20}/>
            <span class="exam-info-value">30</span>
            <span class="exam-info-label">Questions</span>
          </div>
          <div class="exam-info-item">
            <Clock3 size={20}/>
            <span class="exam-info-value">25</span>
            <span class="exam-info-label">Minutes</span>
          </div>
          <div class="exam-info-item">
            <ShieldCheck size={20}/>
            <span class="exam-info-value">90%</span>
            <span class="exam-info-label">Passing score</span>
          </div>
          <div class="exam-info-item">
            <RotateCcw size={20}/>
            <span class="exam-info-value">2</span>
            <span class="exam-info-label">Attempts / 30 days</span>
          </div>
        </div>

        <div class="written-overview">
        <section class="exam-categories" aria-labelledby="written-sections-title">
          <h2 id="written-sections-title">Three sections. One assessment.</h2>
          <div class="written-section-list">
            <div class="written-section"><span class="written-section-icon grammar"><SpellCheck size={21}/></span><div><h3>Grammar</h3><p>Sentence structure and correct usage</p></div><span>10 questions</span></div>
            <div class="written-section"><span class="written-section-icon vocabulary"><BookOpenText size={21}/></span><div><h3>Vocabulary</h3><p>The right word in context</p></div><span>10 questions</span></div>
            <div class="written-section"><span class="written-section-icon comprehension"><TutorIcon name="fas fa-glasses"/></span><div><h3>Reading comprehension</h3><p>Understand passages and their meaning</p></div><span>10 questions</span></div>
          </div>
        </section>
        <div class="exam-rules">
          <h2>Before you begin</h2>
          <ol>
            <li>Choose one answer per question. Use each option exactly as written.</li>
            <li>You can revisit questions and change your answers before submitting.</li>
            <li>The timer continues if you leave or refresh. Saved progress can be resumed.</li>
            <li>Your exam submits when time runs out. Unanswered questions count as incorrect.</li>
          </ol>
        </div>
        </div>

        {error() && <div class="exam-error" role="alert">{error()}</div>}

        <footer class="written-intro-actions"><p>Ready when you are. Allow 25 uninterrupted minutes.</p><button class="start-exam-btn" onClick={startExam}>Start Exam<ArrowRight size={18}/></button></footer>
      </div>
    </div>);
    // Render loading screen
    const renderLoading = () => (<div class="exam-loading">
      <div class="loading-spinner"></div>
      <h3>Preparing your assessment</h3>
      <p>Your questions are being generated and checked. Your timer has not started.</p>
    </div>);
    // Render exam screen
    const renderExam = () => {
        if (!exam() || exam().questions.length === 0)
            return null;
        const question = exam().questions[currentQuestion()];
        // Determine section for navigation styling
        const getSectionForIndex = (idx: number) => {
            if (idx < 10)
                return 'grammar';
            if (idx < 20)
                return 'vocabulary';
            return 'comprehension';
        };
        return (<div class="exam-container">
        {/* Resume indicator */}
        {isResuming() && (<div class="exam-resume-banner">
            <TutorIcon name="fas fa-sync-alt"/>
            <span>Exam resumed - your previous answers have been restored</span>
          </div>)}
        
        {/* Timer and Progress Header */}
        <div class="exam-header">
          <div class="exam-timer" classList={{ 'is-low': timeRemaining() < 300 }}>
            <TutorIcon name="fas fa-clock"/>
            {formatTime(timeRemaining())}
          </div>
          <div class="exam-progress">
            <span>Question {currentQuestion() + 1} of {exam().questions.length}</span>
            <div class="progress-bar">
              <div class="progress-fill" style={cssStyle({ get width() {
                    return `${((currentQuestion() + 1) / exam().questions.length) * 100}%`;
                } })}></div>
            </div>
          </div>
        </div>

        {/* Section Labels */}
        <div class="section-labels">
          <div class="section-label" style={cssStyle({ borderColor: '#3b82f6' })}>
            <span>Grammar</span>
            <small>1-10</small>
          </div>
          <div class="section-label" style={cssStyle({ borderColor: '#8b5cf6' })}>
            <span>Vocabulary</span>
            <small>11-20</small>
          </div>
          <div class="section-label" style={cssStyle({ borderColor: '#10b981' })}>
            <span>Comprehension</span>
            <small>21-30</small>
          </div>
        </div>

        {/* Question Navigation */}
        <div class="question-nav">
          {exam().questions.map((_, idx) => (<button type="button" aria-label={`Question ${idx + 1}${answers()[idx] !== -1 ? ', answered' : ', unanswered'}`} aria-current={idx === currentQuestion() ? 'step' : undefined} title={`Question ${idx + 1}`} class={`question-nav-btn ${idx === currentQuestion() ? 'active' : ''} ${answers()[idx] !== -1 ? 'answered' : ''}`} style={cssStyle({
                    borderBottomColor: getTypeColor(getSectionForIndex(idx) as ExamQuestion['type']),
                    get backgroundColor() {
                        return idx === currentQuestion() ? getTypeColor(getSectionForIndex(idx) as ExamQuestion['type']) : undefined;
                    }
                })} onClick={() => goToQuestion(idx)}>
              {idx + 1}
            </button>))}
        </div>

        {/* Question Card */}
        <div class="question-card">
          <div class="question-meta">
            <span class="question-category" style={cssStyle({ background: getTypeColor(question.type) })}>
              <TutorIcon name={getTypeIcon(question.type)}/>
              {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
            </span>
            <span class="question-number">
              Question {currentQuestion() + 1}
            </span>
          </div>

          {question.type === 'comprehension'
                ? renderComprehension(question as ComprehensionQuestion)
                : renderFillInBlank(question as FillInBlankQuestion)}
        </div>

        {/* Navigation Buttons */}
        <div class="exam-nav-buttons">
          <button class="nav-btn prev" onClick={() => goToQuestion(currentQuestion() - 1)} disabled={currentQuestion() === 0}>
            <TutorIcon name="fas fa-chevron-left"/>
            Previous
          </button>

          {currentQuestion() < exam().questions.length - 1 ? (<button class="nav-btn next" onClick={() => goToQuestion(currentQuestion() + 1)}>
              Next
              <TutorIcon name="fas fa-chevron-right"/>
            </button>) : (<button class="nav-btn submit" onClick={handleSubmit}>
              <TutorIcon name="fas fa-check"/>
              Submit
            </button>)}
        </div>

        {error() && <div class="exam-error">{error()}</div>}
      </div>);
    };
    // Render submitting screen
    const renderSubmitting = () => (<div class="exam-loading">
      <div class="loading-spinner"></div>
      <h3>Grading Your Exam...</h3>
      <p>Please wait while we evaluate your answers.</p>
    </div>);
    // Render results screen
    const renderResults = () => {
        if (!result())
            return null;
        return (<div class="exam-results">
        <div class={`results-header ${result().passed ? 'passed' : 'failed'}`}>
          <div class="results-icon">
            <TutorIcon name={result().passed ? 'fas fa-trophy' : 'fas fa-redo'}/>
          </div>
          <h2>{result().passed ? 'Congratulations!' : 'Keep Practicing'}</h2>
          <p class="results-status">
            {result().passed ? 'You passed the exam!' : 'You did not pass this time.'}
          </p>
        </div>

        <div class="score-card">
          <div class="score-circle" style={cssStyle({
                get background() {
                    return `conic-gradient(${result().passed ? '#10b981' : '#ef4444'} ${result().percentage * 3.6}deg, #e5e7eb 0deg)`;
                }
            })}>
            <div class="score-inner">
              <span class="score-percentage">{Math.round(result().percentage)}%</span>
              <span class="score-fraction">{result().score}/{result().totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        <div class="section-breakdown">
          <h4>Section Scores</h4>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#3b82f6' })}>
                <TutorIcon name="fas fa-spell-check"/>
                Grammar
              </div>
              <div class="breakdown-score">
                {result().sectionScores.grammar.correct}/{result().sectionScores.grammar.total}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#8b5cf6' })}>
                <TutorIcon name="fas fa-book"/>
                Vocabulary
              </div>
              <div class="breakdown-score">
                {result().sectionScores.vocabulary.correct}/{result().sectionScores.vocabulary.total}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#10b981' })}>
                <TutorIcon name="fas fa-glasses"/>
                Comprehension
              </div>
              <div class="breakdown-score">
                {result().sectionScores.comprehension.correct}/{result().sectionScores.comprehension.total}
              </div>
            </div>
          </div>
        </div>

        <div class="results-actions">
          <a href="/home" class="results-btn secondary">
            <TutorIcon name="fas fa-home"/>
            Back to Home
          </a>
          {!result().passed && (<button class="results-btn primary" onClick={() => {
                    setPhase('intro');
                    setExam(null);
                    setAnswers([]);
                    setResult(null);
                }}>
              <TutorIcon name="fas fa-redo"/>
              Try Again
            </button>)}
        </div>
      </div>);
    };
    // Render expired exam screen
    const renderExpired = () => {
        if (!result())
            return null;
        return (<div class="exam-results">
        <div class={`results-header ${result().passed ? 'passed' : 'failed'}`}>
          <div class="results-icon">
            <TutorIcon name={result().passed ? 'fas fa-trophy' : 'fas fa-clock'}/>
          </div>
          <h2>{result().passed ? 'Congratulations!' : 'Time Expired'}</h2>
          <p class="results-status">
            {result().passed
                ? 'Your exam time expired, but based on your saved answers, you passed!'
                : 'Your exam time expired. Based on your saved answers, you did not pass.'}
          </p>
        </div>

        <div class="score-card">
          <div class="score-circle" style={cssStyle({
                get background() {
                    return `conic-gradient(${result().passed ? '#10b981' : '#ef4444'} ${result().percentage * 3.6}deg, #e5e7eb 0deg)`;
                }
            })}>
            <div class="score-inner">
              <span class="score-percentage">{Math.round(result().percentage)}%</span>
              <span class="score-fraction">{result().score}/{result().totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        <div class="section-breakdown">
          <h4>Section Scores</h4>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#3b82f6' })}>
                <TutorIcon name="fas fa-spell-check"/>
                Grammar
              </div>
              <div class="breakdown-score">
                {result().sectionScores.grammar.correct}/{result().sectionScores.grammar.total}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#8b5cf6' })}>
                <TutorIcon name="fas fa-book"/>
                Vocabulary
              </div>
              <div class="breakdown-score">
                {result().sectionScores.vocabulary.correct}/{result().sectionScores.vocabulary.total}
              </div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-header" style={cssStyle({ background: '#10b981' })}>
                <TutorIcon name="fas fa-glasses"/>
                Comprehension
              </div>
              <div class="breakdown-score">
                {result().sectionScores.comprehension.correct}/{result().sectionScores.comprehension.total}
              </div>
            </div>
          </div>
        </div>

        <div class="expired-info">
          <TutorIcon name="fas fa-info-circle"/>
          <p>
            {canRetake() ? 'You can retake the exam. Click below to start a new attempt.'
                : 'You have used both exam attempts in the last 30 days. Try again when an attempt becomes available.'}
          </p>
        </div>

        <div class="results-actions">
          <a href="/home" class="results-btn secondary">
            <TutorIcon name="fas fa-home"/>
            Back to Home
          </a>
          {canRetake() && !result().passed && (<button class="results-btn primary" onClick={() => {
                    setPhase('intro');
                    setExam(null);
                    setAnswers([]);
                    setResult(null);
                    setCanRetake(false);
                }}>
              <TutorIcon name="fas fa-redo"/>
              Start New Exam
            </button>)}
        </div>
      </div>);
    };
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <main class="exam-page written-exam-page">
          <div class="container">
            {phase() === 'intro' && renderIntro()}
            {phase() === 'loading' && renderLoading()}
            {phase() === 'exam' && renderExam()}
            {phase() === 'submitting' && renderSubmitting()}
            {phase() === 'results' && renderResults()}
            {phase() === 'expired' && renderExpired()}
          </div>
        </main>
      </div>
    </>);
};
export default ExamPage;

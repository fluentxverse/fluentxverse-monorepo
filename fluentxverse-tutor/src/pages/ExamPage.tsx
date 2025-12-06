import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import {
  generateExam,
  submitExam,
  getActiveExam,
  saveExamAnswers,
  checkExpiredExam,
  type ClientExam,
  type ExamQuestion,
  type FillInBlankQuestion,
  type ComprehensionQuestion,
  type ComprehensionPassage,
  type ExamResult,
} from '../api/exam.api';
import './ExamPage.css';

type ExamPhase = 'intro' | 'loading' | 'exam' | 'submitting' | 'results' | 'expired';

// LocalStorage keys for exam state persistence (backup only)
const STORAGE_KEYS = {
  EXAM_ID: 'fluentx_exam_id',
  ANSWERS: 'fluentx_exam_answers',
  CURRENT_QUESTION: 'fluentx_exam_current_question',
};

// Debounce interval for server-side saving (ms)
const SAVE_DEBOUNCE_MS = 2000;

const ExamPage = () => {
  const { user } = useAuthContext();
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [exam, setExam] = useState<ClientExam | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [canRetake, setCanRetake] = useState(false);
  const timerRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const submitRef = useRef<() => Promise<void>>();

  useEffect(() => {
    document.title = 'Written Proficiency Test | FluentXVerse';
  }, []);

  // Calculate remaining time based on server startedAt timestamp
  const calculateRemainingTime = useCallback((examData: ClientExam): number => {
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
  }, []);

  // Save answers to localStorage (backup)
  const saveToLocalStorage = useCallback((examId: string, answersArr: number[], currentQ: number) => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXAM_ID, examId);
      localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answersArr));
      localStorage.setItem(STORAGE_KEYS.CURRENT_QUESTION, currentQ.toString());
    } catch (e) {
      console.warn('Failed to save exam state to localStorage:', e);
    }
  }, []);

  // Save answers to server (debounced)
  const saveToServer = useCallback((examId: string, tutorId: string, answersArr: number[], currentQ: number) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce server saves
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await saveExamAnswers(examId, tutorId, answersArr, currentQ);
        console.log('📝 Answers saved to server');
      } catch (e) {
        console.warn('Failed to save answers to server:', e);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Combined save function
  const saveAnswers = useCallback((examId: string, answersArr: number[], currentQ: number) => {
    // Always save to localStorage immediately
    saveToLocalStorage(examId, answersArr, currentQ);
    
    // Also save to server (debounced)
    if (user) {
      saveToServer(examId, user.userId, answersArr, currentQ);
    }
  }, [user, saveToLocalStorage, saveToServer]);

  // Load answers from localStorage
  const loadFromStorage = useCallback((examId: string): { answers: number[]; currentQuestion: number } | null => {
    try {
      const storedExamId = localStorage.getItem(STORAGE_KEYS.EXAM_ID);
      if (storedExamId !== examId) return null;
      
      const storedAnswers = localStorage.getItem(STORAGE_KEYS.ANSWERS);
      const storedQuestion = localStorage.getItem(STORAGE_KEYS.CURRENT_QUESTION);
      
      if (storedAnswers) {
        return {
          answers: JSON.parse(storedAnswers),
          currentQuestion: storedQuestion ? parseInt(storedQuestion, 10) : 0,
        };
      }
    } catch (e) {
      console.warn('Failed to load exam state from localStorage:', e);
    }
    return null;
  }, []);

  // Clear localStorage after exam submission
  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.EXAM_ID);
      localStorage.removeItem(STORAGE_KEYS.ANSWERS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_QUESTION);
    } catch (e) {
      console.warn('Failed to clear exam state from localStorage:', e);
    }
  }, []);

  // Check for active exam on page load and auto-resume
  useEffect(() => {
    const checkForActiveExam = async () => {
      if (!user) return;
      
      try {
        // First, check if there's an expired exam that needs auto-submission
        const expiredCheck = await checkExpiredExam(user.userId);
        
        if (expiredCheck.expired && expiredCheck.result) {
          // Exam was expired and auto-submitted by server
          setResult(expiredCheck.result);
          setCanRetake(expiredCheck.canRetake || false);
          clearStorage();
          setPhase('expired');
          return;
        }
        
        // Check for active (non-expired) exam
        const response = await getActiveExam(user.userId);
        if (response.success && response.exam) {
          const remainingTime = calculateRemainingTime(response.exam);
          
          if (remainingTime <= 0) {
            // Edge case: expired between check-expired and getActive calls
            // Submit now
            const answersToSubmit = response.exam.savedAnswers || 
              new Array(response.exam.questions.length).fill(-1);
            
            setPhase('submitting');
            const submitResponse = await submitExam(response.exam.examId, user.userId, answersToSubmit);
            if (submitResponse.success && submitResponse.result) {
              setResult(submitResponse.result);
              clearStorage();
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
          } else {
            const stored = loadFromStorage(response.exam.examId);
            if (stored) {
              setAnswers(stored.answers);
              setCurrentQuestion(stored.currentQuestion);
            } else {
              setAnswers(new Array(response.exam.questions.length).fill(-1));
              setCurrentQuestion(0);
            }
          }
          
          setTimeRemaining(remainingTime);
          setPhase('exam');
        }
      } catch (err) {
        console.error('Error checking for active exam:', err);
      }
    };
    
    checkForActiveExam();
  }, [user, calculateRemainingTime, loadFromStorage, clearStorage]);

  // Beforeunload warning during exam
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === 'exam') {
        e.preventDefault();
        e.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  // Timer countdown
  useEffect(() => {
    if (phase === 'exam' && timeRemaining > 0) {
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
  }, [phase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startExam = async () => {
    if (!user) return;
    
    setPhase('loading');
    setError(null);
    setIsResuming(false);

    try {
      const response = await generateExam(user.userId);

      if (response.success && response.exam) {
        setExam(response.exam);
        // Initialize answers array with -1 (unanswered)
        const initialAnswers = new Array(response.exam.questions.length).fill(-1);
        setAnswers(initialAnswers);
        
        // Calculate remaining time based on server startedAt
        const remaining = calculateRemainingTime(response.exam);
        setTimeRemaining(remaining);
        setCurrentQuestion(0);
        
        // Save initial state to localStorage and server
        saveAnswers(response.exam.examId, initialAnswers, 0);
        
        setPhase('exam');
      } else {
        setError(response.message || 'Failed to generate exam');
        setPhase('intro');
      }
    } catch (err) {
      console.error('Error starting exam:', err);
      setError('Failed to connect to server. Please try again.');
      setPhase('intro');
    }
  };

  const selectAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
    
    // Save to localStorage and server for resilience
    if (exam) {
      saveAnswers(exam.examId, newAnswers, currentQuestion);
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentQuestion(index);
    
    // Save current question to localStorage and server
    if (exam) {
      saveAnswers(exam.examId, answers, index);
    }
  };

  const handleSubmit = async () => {
    if (!exam || !user) return;

    const unanswered = answers.filter((a) => a === -1).length;

    if (unanswered > 0 && timeRemaining > 0) {
      const confirm = window.confirm(
        `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirm) return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setPhase('submitting');

    try {
      const response = await submitExam(exam.examId, user.userId, answers);

      if (response.success && response.result) {
        // Clear localStorage after successful submission
        clearStorage();
        setResult(response.result);
        setPhase('results');
      } else {
        setError(response.message || 'Failed to submit exam');
        setPhase('exam');
      }
    } catch (err) {
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
    if (!exam) return undefined;
    return exam.passages.find((p) => p.id === question.passageId);
  };

  // Render fill-in-the-blank question (grammar/vocabulary)
  const renderFillInBlank = (question: FillInBlankQuestion) => {
    return (
      <div className="fill-in-blank-question">
        <p className="sentence-text">{question.sentence}</p>
        <div className="answer-options">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              className={`answer-option ${answers[currentQuestion] === idx ? 'selected' : ''}`}
              onClick={() => selectAnswer(idx)}
            >
              <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
              <span className="option-text">{option}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render comprehension question
  const renderComprehension = (question: ComprehensionQuestion) => {
    const passage = getPassageForQuestion(question);
    
    return (
      <div className="comprehension-question">
        {passage && (
          <div className="passage-box">
            <div className="passage-header">
              <i className="fas fa-book-reader"></i>
              <span>{passage.title}</span>
            </div>
            <p className="passage-text">{passage.content}</p>
          </div>
        )}
        <div className="comprehension-q">
          <p className="question-text">{question.question}</p>
          <div className="answer-options">
            {question.options.map((option, idx) => (
              <button
                key={idx}
                className={`answer-option ${answers[currentQuestion] === idx ? 'selected' : ''}`}
                onClick={() => selectAnswer(idx)}
              >
                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render intro screen
  const renderIntro = () => (
    <div className="exam-intro">
      <div className="exam-intro-card">
        <div className="exam-intro-icon">
          <i className="fas fa-pen"></i>
        </div>
        <h2>Written Proficiency Test</h2>
        <p className="exam-intro-description">
          This exam will assess your English proficiency to become a FluentXVerse tutor.
          Each exam is uniquely generated to ensure fairness.
        </p>

        <div className="exam-info-grid">
          <div className="exam-info-item">
            <i className="fas fa-list-ol"></i>
            <span>30 Questions</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-clock"></i>
            <span>25 Minutes</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-percentage"></i>
            <span>90% to Pass</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-redo"></i>
            <span>2 Attempts/Month</span>
          </div>
        </div>

        <div className="exam-categories">
          <h4>Sections:</h4>
          <div className="category-tags">
            <span className="category-tag" style={{ background: '#3b82f6', color: 'white' }}>
              <i className="fas fa-spell-check"></i> Grammar (10 questions)
            </span>
            <span className="category-tag" style={{ background: '#8b5cf6', color: 'white' }}>
              <i className="fas fa-book"></i> Vocabulary (10 questions)
            </span>
            <span className="category-tag" style={{ background: '#10b981', color: 'white' }}>
              <i className="fas fa-glasses"></i> Comprehension (5 questions)
            </span>
          </div>
        </div>

        <div className="exam-rules">
          <h4>Instructions:</h4>
          <ul>
            <li>Fill in the blank with the correct word from the options</li>
            <li>Read passages carefully before answering comprehension questions</li>
            <li>Do not refresh or leave the page during the exam</li>
            <li>The exam will auto-submit when time runs out</li>
            <li><strong>Unanswered questions are marked as incorrect</strong></li>
            <li>Results will be shown immediately after submission</li>
          </ul>
        </div>

        {error && <div className="exam-error">{error}</div>}

        <button className="start-exam-btn" onClick={startExam}>
          <i className="fas fa-play"></i>
          Start Exam
        </button>
      </div>
    </div>
  );

  // Render loading screen
  const renderLoading = () => (
    <div className="exam-loading">
      <div className="loading-spinner"></div>
      <h3>Generating Your Unique Exam...</h3>
      <p>We are creating personalized questions just for you.</p>
    </div>
  );

  // Render exam screen
  const renderExam = () => {
    if (!exam || exam.questions.length === 0) return null;
    const question = exam.questions[currentQuestion];

    // Determine section for navigation styling
    const getSectionForIndex = (idx: number) => {
      if (idx < 10) return 'grammar';
      if (idx < 20) return 'vocabulary';
      return 'comprehension';
    };

    return (
      <div className="exam-container">
        {/* Resume indicator */}
        {isResuming && (
          <div className="exam-resume-banner">
            <i className="fas fa-sync-alt"></i>
            <span>Exam resumed - your previous answers have been restored</span>
          </div>
        )}
        
        {/* Timer and Progress Header */}
        <div className="exam-header">
          <div className="exam-timer" style={{ color: timeRemaining < 300 ? '#ef4444' : '#0245ae' }}>
            <i className="fas fa-clock"></i>
            {formatTime(timeRemaining)}
          </div>
          <div className="exam-progress">
            <span>Question {currentQuestion + 1} of {exam.questions.length}</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentQuestion + 1) / exam.questions.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Section Labels */}
        <div className="section-labels">
          <div className="section-label" style={{ borderColor: '#3b82f6' }}>
            <span>Grammar</span>
            <small>1-10</small>
          </div>
          <div className="section-label" style={{ borderColor: '#8b5cf6' }}>
            <span>Vocabulary</span>
            <small>11-20</small>
          </div>
          <div className="section-label" style={{ borderColor: '#10b981' }}>
            <span>Comprehension</span>
            <small>21-25</small>
          </div>
        </div>

        {/* Question Navigation */}
        <div className="question-nav">
          {exam.questions.map((_, idx) => (
            <button
              key={idx}
              className={`question-nav-btn ${idx === currentQuestion ? 'active' : ''} ${answers[idx] !== -1 ? 'answered' : ''}`}
              style={{ 
                borderBottomColor: getTypeColor(getSectionForIndex(idx) as ExamQuestion['type']),
                backgroundColor: idx === currentQuestion ? getTypeColor(getSectionForIndex(idx) as ExamQuestion['type']) : undefined
              }}
              onClick={() => goToQuestion(idx)}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Question Card */}
        <div className="question-card">
          <div className="question-meta">
            <span className="question-category" style={{ background: getTypeColor(question.type) }}>
              <i className={getTypeIcon(question.type)}></i>
              {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
            </span>
            <span className="question-number">
              Question {currentQuestion + 1}
            </span>
          </div>

          {question.type === 'comprehension' 
            ? renderComprehension(question as ComprehensionQuestion)
            : renderFillInBlank(question as FillInBlankQuestion)
          }
        </div>

        {/* Navigation Buttons */}
        <div className="exam-nav-buttons">
          <button
            className="nav-btn prev"
            onClick={() => goToQuestion(currentQuestion - 1)}
            disabled={currentQuestion === 0}
          >
            <i className="fas fa-chevron-left"></i>
            Previous
          </button>

          {currentQuestion < exam.questions.length - 1 ? (
            <button
              className="nav-btn next"
              onClick={() => goToQuestion(currentQuestion + 1)}
            >
              Next
              <i className="fas fa-chevron-right"></i>
            </button>
          ) : (
            <button className="nav-btn submit" onClick={handleSubmit}>
              <i className="fas fa-check"></i>
              Submit
            </button>
          )}
        </div>

        {error && <div className="exam-error">{error}</div>}
      </div>
    );
  };

  // Render submitting screen
  const renderSubmitting = () => (
    <div className="exam-loading">
      <div className="loading-spinner"></div>
      <h3>Grading Your Exam...</h3>
      <p>Please wait while we evaluate your answers.</p>
    </div>
  );

  // Render results screen
  const renderResults = () => {
    if (!result) return null;

    return (
      <div className="exam-results">
        <div className={`results-header ${result.passed ? 'passed' : 'failed'}`}>
          <div className="results-icon">
            <i className={result.passed ? 'fas fa-trophy' : 'fas fa-redo'}></i>
          </div>
          <h2>{result.passed ? 'Congratulations!' : 'Keep Practicing'}</h2>
          <p className="results-status">
            {result.passed ? 'You passed the exam!' : 'You did not pass this time.'}
          </p>
        </div>

        <div className="score-card">
          <div className="score-circle" style={{ 
            background: `conic-gradient(${result.passed ? '#10b981' : '#ef4444'} ${result.percentage * 3.6}deg, #e5e7eb 0deg)` 
          }}>
            <div className="score-inner">
              <span className="score-percentage">{Math.round(result.percentage)}%</span>
              <span className="score-fraction">{result.score}/{result.totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        <div className="section-breakdown">
          <h4>Section Scores</h4>
          <div className="breakdown-grid">
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#3b82f6' }}>
                <i className="fas fa-spell-check"></i>
                Grammar
              </div>
              <div className="breakdown-score">
                {result.sectionScores.grammar.correct}/{result.sectionScores.grammar.total}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#8b5cf6' }}>
                <i className="fas fa-book"></i>
                Vocabulary
              </div>
              <div className="breakdown-score">
                {result.sectionScores.vocabulary.correct}/{result.sectionScores.vocabulary.total}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#10b981' }}>
                <i className="fas fa-glasses"></i>
                Comprehension
              </div>
              <div className="breakdown-score">
                {result.sectionScores.comprehension.correct}/{result.sectionScores.comprehension.total}
              </div>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <a href="/home" className="results-btn secondary">
            <i className="fas fa-home"></i>
            Back to Home
          </a>
          {!result.passed && (
            <button className="results-btn primary" onClick={() => {
              setPhase('intro');
              setExam(null);
              setAnswers([]);
              setResult(null);
            }}>
              <i className="fas fa-redo"></i>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render expired exam screen
  const renderExpired = () => {
    if (!result) return null;

    return (
      <div className="exam-results">
        <div className={`results-header ${result.passed ? 'passed' : 'failed'}`}>
          <div className="results-icon">
            <i className={result.passed ? 'fas fa-trophy' : 'fas fa-clock'}></i>
          </div>
          <h2>{result.passed ? 'Congratulations!' : 'Time Expired'}</h2>
          <p className="results-status">
            {result.passed 
              ? 'Your exam time expired, but based on your saved answers, you passed!' 
              : 'Your exam time expired. Based on your saved answers, you did not pass.'}
          </p>
        </div>

        <div className="score-card">
          <div className="score-circle" style={{ 
            background: `conic-gradient(${result.passed ? '#10b981' : '#ef4444'} ${result.percentage * 3.6}deg, #e5e7eb 0deg)` 
          }}>
            <div className="score-inner">
              <span className="score-percentage">{Math.round(result.percentage)}%</span>
              <span className="score-fraction">{result.score}/{result.totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        <div className="section-breakdown">
          <h4>Section Scores</h4>
          <div className="breakdown-grid">
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#3b82f6' }}>
                <i className="fas fa-spell-check"></i>
                Grammar
              </div>
              <div className="breakdown-score">
                {result.sectionScores.grammar.correct}/{result.sectionScores.grammar.total}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#8b5cf6' }}>
                <i className="fas fa-book"></i>
                Vocabulary
              </div>
              <div className="breakdown-score">
                {result.sectionScores.vocabulary.correct}/{result.sectionScores.vocabulary.total}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-header" style={{ background: '#10b981' }}>
                <i className="fas fa-glasses"></i>
                Comprehension
              </div>
              <div className="breakdown-score">
                {result.sectionScores.comprehension.correct}/{result.sectionScores.comprehension.total}
              </div>
            </div>
          </div>
        </div>

        <div className="expired-info">
          <i className="fas fa-info-circle"></i>
          <p>
            {canRetake 
              ? 'You can retake the exam. Click below to start a new attempt.'
              : 'You have used all your exam attempts this month. Please try again next month.'}
          </p>
        </div>

        <div className="results-actions">
          <a href="/home" className="results-btn secondary">
            <i className="fas fa-home"></i>
            Back to Home
          </a>
          {canRetake && !result.passed && (
            <button className="results-btn primary" onClick={() => {
              setPhase('intro');
              setExam(null);
              setAnswers([]);
              setResult(null);
              setCanRetake(false);
            }}>
              <i className="fas fa-redo"></i>
              Start New Exam
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="exam-page">
          <div className="container">
            {phase === 'intro' && renderIntro()}
            {phase === 'loading' && renderLoading()}
            {phase === 'exam' && renderExam()}
            {phase === 'submitting' && renderSubmitting()}
            {phase === 'results' && renderResults()}
            {phase === 'expired' && renderExpired()}
          </div>
        </main>
      </div>
    </>
  );
};

export default ExamPage;

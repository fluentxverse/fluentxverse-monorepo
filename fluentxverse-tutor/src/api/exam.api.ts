import { client } from './utils';

// ============================================================================
// EXAM TYPES
// ============================================================================

// Grammar/Vocabulary question (fill-in-the-blank)
export interface FillInBlankQuestion {
  id: number;
  type: 'grammar' | 'vocabulary';
  sentence: string;        // The sentence with _____ blank
  options: string[];       // 4 options (A, B, C, D)
}

// Comprehension question (based on passage)
export interface ComprehensionQuestion {
  id: number;
  type: 'comprehension';
  passageId: number;       // Reference to which passage
  question: string;        // The question about the passage
  options: string[];       // 4 options (A, B, C, D)
}

// Reading passage for comprehension section
export interface ComprehensionPassage {
  id: number;
  title: string;
  content: string;
}

export type ExamQuestion = FillInBlankQuestion | ComprehensionQuestion;

export interface ClientExam {
  examId: string;
  title: string;
  description: string;
  timeLimit: number;       // in minutes
  passingScore: number;    // percentage
  startedAt?: string;      // ISO timestamp when exam was started (for calculating remaining time)
  savedAnswers?: number[]; // Server-saved answers for resume
  currentQuestion?: number; // Last question user was on
  passages: ComprehensionPassage[];
  questions: ExamQuestion[];
}

export interface SectionScore {
  correct: number;
  total: number;
}

export interface ExamResult {
  examId: string;
  tutorId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  sectionScores: {
    grammar: SectionScore;
    vocabulary: SectionScore;
    comprehension: SectionScore;
  };
  answers: {
    questionId: number;
    selectedAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
  }[];
  completedAt: string;
}

export interface ExamStatus {
  hasActiveExam: boolean;
  hasCompletedExam: boolean;
  passed: boolean | null;
  percentage: number | null;
  examId: string | null;
  attemptsThisMonth: number;
  maxAttemptsPerMonth: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate a new written exam for the tutor
 */
export const generateExam = async (
  tutorId: string
): Promise<{ success: boolean; message: string; exam?: ClientExam }> => {
  try {
    const response = await client.post('/exam/written/generate', {
      tutorId,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to generate exam:', error);
    throw error;
  }
};

/**
 * Get active exam for tutor (to resume incomplete exam)
 */
export const getActiveExam = async (
  tutorId: string
): Promise<{ success: boolean; exam?: ClientExam }> => {
  try {
    const response = await client.get(`/exam/active/${tutorId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get active exam:', error);
    throw error;
  }
};

/**
 * Submit exam answers
 * @param answers - Array of selected answer indices (0-3 for A-D) for each question
 */
export const submitExam = async (
  examId: string,
  tutorId: string,
  answers: number[]
): Promise<{ success: boolean; message: string; result?: ExamResult }> => {
  try {
    const response = await client.post('/exam/written/submit', {
      examId,
      tutorId,
      answers,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to submit exam:', error);
    throw error;
  }
};

/**
 * Save exam answers to server (for resume functionality)
 */
export const saveExamAnswers = async (
  examId: string,
  tutorId: string,
  answers: number[],
  currentQuestion: number
): Promise<{ success: boolean }> => {
  try {
    const response = await client.post('/exam/written/save', {
      examId,
      tutorId,
      answers,
      currentQuestion,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to save exam answers:', error);
    // Don't throw - saving is best-effort
    return { success: false };
  }
};

/**
 * Check if exam has expired and auto-submit if so
 */
export const checkExpiredExam = async (
  tutorId: string
): Promise<{ 
  success: boolean; 
  expired: boolean; 
  result?: ExamResult; 
  canRetake?: boolean;
  message?: string;
}> => {
  try {
    const response = await client.post('/exam/written/check-expired', {
      tutorId,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to check expired exam:', error);
    return { success: false, expired: false };
  }
};

/**
 * Get exam result with full details (for review after completion)
 */
export const getExamResult = async (
  tutorId: string,
  examId: string
): Promise<{ success: boolean; exam?: ClientExam; result?: ExamResult }> => {
  try {
    const response = await client.get(`/exam/result/${tutorId}/${examId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get exam result:', error);
    throw error;
  }
};

/**
 * Check exam status for tutor (has taken, passed, etc.)
 */
export const getExamStatus = async (
  tutorId: string
): Promise<{ success: boolean; status?: ExamStatus }> => {
  try {
    const response = await client.get(`/exam/status/${tutorId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get exam status:', error);
    throw error;
  }
};

// ============================================================================
// SPEAKING EXAM TYPES
// ============================================================================

export interface ReadAloudTask {
  id: number;
  type: 'read-aloud';
  instruction: string;
  sentence: string;
  timeLimit: number;
}

export interface PictureDescriptionTask {
  id: number;
  type: 'picture-description';
  instruction: string;
  imageUrl: string;
  timeLimit: number;
}

export interface SituationalResponseTask {
  id: number;
  type: 'situational-response';
  instruction: string;
  scenario: string;
  prompt: string;
  timeLimit: number;
}

export interface TeachingDemoTask {
  id: number;
  type: 'teaching-demo';
  instruction: string;
  topic: string;
  targetLevel: 'beginner' | 'intermediate' | 'advanced';
  timeLimit: number;
}

export interface OpenResponseTask {
  id: number;
  type: 'open-response';
  instruction: string;
  question: string;
  timeLimit: number;
}

export type SpeakingTask =
  | ReadAloudTask
  | PictureDescriptionTask
  | SituationalResponseTask
  | TeachingDemoTask
  | OpenResponseTask;

export interface ClientSpeakingExam {
  examId: string;
  title: string;
  description: string;
  totalTimeLimit: number;
  passingScore: number;
  tasks: SpeakingTask[];
}

export interface TaskRecording {
  taskId: number;
  audioUrl: string;
  duration: number;
  transcription?: string;
}

export interface TaskScore {
  taskId: number;
  taskType: SpeakingTask['type'];
  transcription: string;
  scores: {
    pronunciation: number;
    fluency: number;
    vocabulary: number;
    grammar: number;
    coherence: number;
    taskCompletion: number;
  };
  averageScore: number;
  percentage: number;
  feedback: string;
}

export interface SpeakingExamResult {
  examId: string;
  tutorId: string;
  overallScore: number;
  passed: boolean;
  taskScores: TaskScore[];
  sectionAverages: {
    pronunciation: number;
    fluency: number;
    vocabulary: number;
    grammar: number;
    coherence: number;
    taskCompletion: number;
  };
  overallFeedback: string;
  completedAt: string;
}

export interface SpeakingExamStatus {
  hasActiveExam: boolean;
  hasCompletedExam: boolean;
  passed: boolean | null;
  percentage: number | null;
  examId: string | null;
  attemptsThisMonth: number;
  maxAttemptsPerMonth: number;
}

// ============================================================================
// SPEAKING EXAM API FUNCTIONS
// ============================================================================

/**
 * Generate a new speaking exam for the tutor
 */
export const generateSpeakingExam = async (
  tutorId: string
): Promise<{ success: boolean; message: string; exam?: ClientSpeakingExam }> => {
  try {
    const response = await client.post('/exam/speaking/generate', {
      tutorId,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to generate speaking exam:', error);
    throw error;
  }
};

/**
 * Get active speaking exam for tutor
 */
export const getActiveSpeakingExam = async (
  tutorId: string
): Promise<{ success: boolean; exam?: ClientSpeakingExam }> => {
  try {
    const response = await client.get(`/exam/speaking/active/${tutorId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get active speaking exam:', error);
    throw error;
  }
};

/**
 * Transcribe audio using Whisper API
 */
export const transcribeAudio = async (
  audioBase64: string
): Promise<{ success: boolean; transcription?: string }> => {
  try {
    const response = await client.post('/exam/speaking/transcribe', {
      audioBase64,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to transcribe audio:', error);
    throw error;
  }
};

/**
 * Submit speaking exam with recordings
 */
export const submitSpeakingExam = async (
  examId: string,
  tutorId: string,
  recordings: TaskRecording[]
): Promise<{ success: boolean; message: string; result?: SpeakingExamResult }> => {
  try {
    const response = await client.post('/exam/speaking/submit', {
      examId,
      tutorId,
      recordings,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to submit speaking exam:', error);
    throw error;
  }
};

/**
 * Get speaking exam result
 */
export const getSpeakingExamResult = async (
  tutorId: string,
  examId: string
): Promise<{ success: boolean; exam?: ClientSpeakingExam; result?: SpeakingExamResult }> => {
  try {
    const response = await client.get(`/exam/speaking/result/${tutorId}/${examId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get speaking exam result:', error);
    throw error;
  }
};

/**
 * Get speaking exam status for tutor
 */
export const getSpeakingExamStatus = async (
  tutorId: string
): Promise<{ success: boolean; status?: SpeakingExamStatus }> => {
  try {
    const response = await client.get(`/exam/speaking/status/${tutorId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get speaking exam status:', error);
    throw error;
  }
};

export default {
  // Written exam
  generateExam,
  getActiveExam,
  submitExam,
  saveExamAnswers,
  checkExpiredExam,
  getExamResult,
  getExamStatus,
  // Speaking exam
  generateSpeakingExam,
  getActiveSpeakingExam,
  transcribeAudio,
  submitSpeakingExam,
  getSpeakingExamResult,
  getSpeakingExamStatus,
};

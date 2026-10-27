import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { client } from './utils';
// ============================================================================
// EXAM TYPES
// ============================================================================
// Grammar/Vocabulary question (fill-in-the-blank)
export interface FillInBlankQuestion {
    id: number;
    type: 'grammar' | 'vocabulary';
    sentence: string; // The sentence with _____ blank
    options: string[]; // 4 options (A, B, C, D)
}
// Comprehension question (based on passage)
export interface ComprehensionQuestion {
    id: number;
    type: 'comprehension';
    passageId: number; // Reference to which passage
    question: string; // The question about the passage
    options: string[]; // 4 options (A, B, C, D)
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
    timeLimit: number; // in minutes
    passingScore: number; // percentage
    startedAt?: string; // ISO timestamp when exam was started (for calculating remaining time)
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
export const generateExam = async (tutorId: string): Promise<{
    success: boolean;
    message: string;
    exam?: ClientExam;
}> => {
    try {
        const response = await client.post('/exam/written/generate', {
            tutorId
        }, { timeout: 100000 });
        return response.data;
    }
    catch (error) {
        console.error('Failed to generate exam:', error);
        throw error;
    }
};
/**
 * Get active exam for tutor (to resume incomplete exam)
 */
export const getActiveExam = async (tutorId: string): Promise<{
    success: boolean;
    exam?: ClientExam;
}> => {
    try {
        const response = await client.get('/exam/active');
        return response.data;
    }
    catch (error) {
        console.error('Failed to get active exam:', error);
        throw error;
    }
};
/**
 * Submit exam answers
 * @param answers - Array of selected answer indices (0-3 for A-D) for each question
 */
export const submitExam = async (examId: string, tutorId: string, answers: number[]): Promise<{
    success: boolean;
    message: string;
    result?: ExamResult;
}> => {
    try {
        const response = await client.post('/exam/written/submit', {
            examId,
            tutorId,
            answers
        });
        return response.data;
    }
    catch (error) {
        console.error('Failed to submit exam:', error);
        throw error;
    }
};
/**
 * Save exam answers to server (for resume functionality)
 */
export const saveExamAnswers = async (examId: string, tutorId: string, answers: number[], currentQuestion: number): Promise<{
    success: boolean;
}> => {
    try {
        const response = await client.post('/exam/written/save', {
            examId,
            tutorId,
            answers,
            currentQuestion
        });
        return response.data;
    }
    catch (error) {
        console.error('Failed to save exam answers:', error);
        // Don't throw - saving is best-effort
        return { success: false };
    }
};
/**
 * Check if exam has expired and auto-submit if so
 */
export const checkExpiredExam = async (tutorId: string): Promise<{
    success: boolean;
    expired: boolean;
    result?: ExamResult;
    canRetake?: boolean;
    message?: string;
}> => {
    try {
        const response = await client.post('/exam/written/check-expired', {
            tutorId
        });
        return response.data;
    }
    catch (error) {
        console.error('Failed to check expired exam:', error);
        return { success: false, expired: false };
    }
};
/**
 * Get exam result with full details (for review after completion)
 */
export const getExamResult = async (tutorId: string, examId: string): Promise<{
    success: boolean;
    exam?: ClientExam;
    result?: ExamResult;
}> => {
    try {
        const response = await client.get(`/exam/result/${encodeURIComponent(examId)}`);
        return response.data;
    }
    catch (error) {
        console.error('Failed to get exam result:', error);
        throw error;
    }
};
/**
 * Check exam status for tutor (has taken, passed, etc.)
 */
export const getExamStatus = async (_tutorId: string): Promise<{
    success: boolean;
    status?: ExamStatus;
}> => {
    try {
        const response = await client.get('/exam/status');
        return response.data;
    }
    catch (error) {
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
export type SpeakingTask = ReadAloudTask | PictureDescriptionTask | SituationalResponseTask | TeachingDemoTask | OpenResponseTask;
export interface ClientSpeakingExam {
    format?: 'read-aloud.v1';
    examId: string;
    title: string;
    description: string;
    totalTimeLimit: number;
    passingScore: number;
    startedAt?: string;
    savedTaskIds?: number[];
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
        pronunciation: number | null;
        fluency: number | null;
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
    format?: 'read-aloud.v1';
    examId: string;
    tutorId: string;
    overallScore: number;
    passed: boolean;
    taskScores: TaskScore[];
    sectionAverages: {
        pronunciation: number | null;
        fluency: number | null;
        vocabulary: number;
        grammar: number;
        coherence: number;
        taskCompletion: number;
    };
    overallFeedback: string;
    completedAt: string;
    assessmentMode?: 'transcript-content';
    audioReviewRequired?: boolean;
    decisionStatus?: 'human_review_required';
}
export interface SpeakingExamStatus {
    hasActiveExam: boolean;
    hasCompletedExam: boolean;
    isProcessing: boolean; // true when exam is submitted but still being graded
    passed: boolean | null;
    percentage: number | null;
    examId: string | null;
    attemptsThisMonth: number;
    maxAttemptsPerMonth: number;
    state?: string;
    gradingFailed?: boolean;
    canRetryGrading?: boolean;
}
// ============================================================================
// SPEAKING EXAM API FUNCTIONS
// ============================================================================
/**
 * Generate a new speaking exam for the tutor
 */
export const generateSpeakingExam = async (tutorId: string): Promise<{
    success: boolean;
    message: string;
    exam?: ClientSpeakingExam;
}> => {
    try {
        const response = await client.post('/exam/speaking/generate', {
            tutorId
        }, { timeout: 100000 });
        return response.data;
    }
    catch (error) {
        console.error('Failed to generate speaking exam:', error);
        throw error;
    }
};
/**
 * Get active speaking exam for tutor
 */
export const getActiveSpeakingExam = async (tutorId: string): Promise<{
    success: boolean;
    exam?: ClientSpeakingExam;
}> => {
    try {
        const response = await client.get('/exam/speaking/active');
        return response.data;
    }
    catch (error) {
        console.error('Failed to get active speaking exam:', error);
        throw error;
    }
};
/**
 * Queue grading after all recordings have been saved
 */
export const submitSpeakingExam = async (examId: string, _tutorId: string): Promise<{
    success: boolean;
    message: string;
    result?: SpeakingExamResult;
    state?: string;
}> => {
    try {
        const response = await client.post('/exam/speaking/submit', {
            examId
        });
        return response.data;
    }
    catch (error) {
        console.error('Failed to submit speaking exam:', error);
        throw error;
    }
};
/**
 * Get speaking exam result
 */
export const getSpeakingExamResult = async (tutorId: string, examId: string): Promise<{
    success: boolean;
    exam?: ClientSpeakingExam;
    result?: SpeakingExamResult;
}> => {
    try {
        const response = await client.get(`/exam/speaking/result/${encodeURIComponent(examId)}`);
        return response.data;
    }
    catch (error) {
        console.error('Failed to get speaking exam result:', error);
        throw error;
    }
};
export const saveSpeakingRecording = async (examId: string, recording: TaskRecording) => {
    const response = await client.post('/exam/speaking/recording', { examId, recording });
    return response.data as { success: boolean; saved: boolean; taskId: number };
};
export const retrySpeakingGrading = async (examId: string) => {
    const response = await client.post('/exam/speaking/retry', { examId });
    return response.data as { success: boolean; state: string };
};
/**
 * Get speaking exam status for tutor
 */
export const getSpeakingExamStatus = async (_tutorId: string): Promise<{
    success: boolean;
    status?: SpeakingExamStatus;
}> => {
    try {
        const response = await client.get('/exam/speaking/status');
        return response.data;
    }
    catch (error) {
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
    submitSpeakingExam,
    getSpeakingExamResult,
    getSpeakingExamStatus
};

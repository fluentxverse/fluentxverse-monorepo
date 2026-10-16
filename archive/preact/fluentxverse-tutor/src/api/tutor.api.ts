import type { 
  Tutor, 
  TutorProfile, 
  TutorSearchParams, 
  TutorSearchResponse 
} from '../types/tutor.types';
import { client as api } from './utils';

export interface ClassroomVocabularyNote {
  word: string;
  definitions: {
    meaning: string;
    partOfSpeech: string;
    japaneseNative?: string;
    japaneseRomanized?: string;
    koreanNative?: string;
    koreanRomanized?: string;
    vietnameseNative?: string;
    vietnameseRomanized?: string;
  }[];
  selectedDefinitionIndex: number;
  isLoading: boolean;
  showDefinition: boolean;
  showTranslation: boolean;
}

export interface ClassroomGrammarNote {
  youSaid: string;
  correct: string;
  simpleExplanation: string;
  technicalExplanation: string;
  isLoading: boolean;
  showExplanation: boolean;
}

export interface ClassroomPronunciationNote {
  word: string;
  phonetic: string;
  isLoading: boolean;
  showPhonetic: boolean;
}

export interface ClassroomNotesRecord {
  id: string;
  sessionId: string;
  tutorId: string;
  studentId: string | null;
  materialType: string;
  materialId: string;
  materialTitle: string | null;
  materialLevel?: number | null;
  materialChapter?: number | null;
  isUsed?: boolean;
  completionStatus?: 'in_progress' | 'completed' | null;
  stoppedAt?: string | null;
  stoppedAtLabel?: string | null;
  progressDetails?: string;
  courseId: string | null;
  lessonId: string | null;
  articleId: string | null;
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  studentComment: string;
  tutorMemo: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveClassroomNotesInput {
  materialType: string;
  materialId: string;
  materialTitle?: string;
  isUsed?: boolean;
  clientUpdatedAt?: number;
  completionStatus?: 'in_progress' | 'completed' | null;
  stoppedAt?: string | null;
  progressDetails?: string;
  courseId?: string | null;
  lessonId?: string | null;
  articleId?: string | null;
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  studentComment?: string;
  tutorMemo?: string;
}

export type LessonNotesTab = 'current' | 'recent' | 'mine' | 'first';

export interface LessonNotesEntry {
  workflow?: { attendanceVerified: boolean; notesStatus: string; closed: boolean; outcome: string };
  englishLevelAssessment?: number | null;
  sessionId: string;
  startsAt: string;
  tutorName: string;
  durationMinutes?: number;
  studentAttendance?: string | null;
  notes: ClassroomNotesRecord[];
  studentComment?: string;
  tutorMemo?: string;
  summaryUpdatedAt?: string | null;
}

export interface ClassroomLessonNotes {
  studentAttendance?: string | null;
  englishLevelAssessment?: number | null;
  materials: ClassroomNotesRecord[];
  studentComment: string;
  tutorMemo: string;
  updatedAt: string | null;
}

export interface ClassroomMaterialProgress {
  sections: { id: string; label: string }[];
  previous: { sessionId: string; startsAt: string; completionStatus: 'in_progress' | 'completed';
    stoppedAt: string | null; stoppedAtLabel: string | null; progressDetails: string } | null;
}

export interface LessonNotesEditWindow {
  studentAttendance?: string | null;
  startsAt: string;
  endsAt: string;
  editableUntil: string;
  serverNow: string;
  canEdit: boolean;
  reason: 'not_started' | 'expired' | 'cancelled' | null;
}

export interface ClassroomExerciseMark {
  sessionId: string;
  tutorId: string;
  studentId: string;
  lessonId: string;
  step: 'A' | 'B';
  itemIndex: number;
  itemType: string;
  prompt: string;
  answerKey: string;
  isCorrect: boolean;
  studentResponse: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveClassroomExerciseMarkInput {
  lessonId: string;
  step: 'A' | 'B';
  itemIndex: number;
  itemType: string;
  prompt: string;
  answerKey: string;
  isCorrect: boolean | null;
  studentResponse?: string;
}

export const tutorApi = {
  setLessonStudentAttendance: async (sessionId: string, status: 'present' | 'absent', reason?: string) => {
    const response = await api.put<{ success: boolean }>(`/tutor/lesson-student-attendance/${encodeURIComponent(sessionId)}`, { status, reason });
    if (!response.data.success) throw new Error('Unable to update student attendance');
  },
  getLessonNotesEditWindow: async (sessionId: string, signal?: AbortSignal): Promise<LessonNotesEditWindow> => {
    const response = await api.get<{ success: boolean; data: LessonNotesEditWindow }>(`/tutor/lesson-notes-edit-window/${encodeURIComponent(sessionId)}`, { signal });
    if (!response.data.success) throw new Error('Unable to check the editing window');
    return response.data.data;
  },
  getClassroomMaterialProgress: async (sessionId: string, materialType: string, materialId: string): Promise<ClassroomMaterialProgress> => {
    const response = await api.get<{ success: boolean; data: ClassroomMaterialProgress }>(`/tutor/classroom-material-progress/${encodeURIComponent(sessionId)}`, { params: { materialType, materialId } });
    if (!response.data.success) throw new Error('Unable to load material progress');
    return response.data.data;
  },
  getClassroomLessonNotes: async (sessionId: string, signal?: AbortSignal): Promise<ClassroomLessonNotes> => {
    const response = await api.get<{ success: boolean; data: ClassroomLessonNotes }>(`/tutor/classroom-lesson-notes/${encodeURIComponent(sessionId)}`, { signal });
    if (!response.data.success) throw new Error('Unable to load lesson notes');
    return response.data.data;
  },
  saveClassroomLessonNotes: async (sessionId: string, summary: Pick<ClassroomLessonNotes, 'studentComment' | 'tutorMemo' | 'englishLevelAssessment'> & { clientUpdatedAt?: number }) => {
    const response = await api.put<{ success: boolean }>(`/tutor/classroom-lesson-notes/${encodeURIComponent(sessionId)}`, summary);
    if (!response.data.success) throw new Error('Unable to save lesson notes');
  },
  getLessonNotes: async (sessionId: string, tab: LessonNotesTab, signal?: AbortSignal): Promise<LessonNotesEntry[]> => {
    const response = await api.get<{ success: boolean; data: LessonNotesEntry[] }>(
      `/tutor/lesson-notes/${encodeURIComponent(sessionId)}`, { params: { tab }, signal, timeout: 15000 },
    );
    if (!response.data.success) throw new Error('Unable to load lesson notes');
    return response.data.data;
  },
  /**
   * Search tutors with filters
   */
  searchTutors: async (params: TutorSearchParams): Promise<TutorSearchResponse> => {
    const response = await api.get<{ success: boolean; data: TutorSearchResponse }>('/tutor/search', {
      params: {
        q: params.query,
        languages: params.languages,
        specializations: params.specializations,
        minRating: params.minRating,
        maxHourlyRate: params.maxHourlyRate,
        minHourlyRate: params.minHourlyRate,
        isAvailable: params.isAvailable,
        sortBy: params.sortBy,
        page: params.page,
        limit: params.limit
      }
    });

    if (!response.data.success) {
      throw new Error('Failed to search tutors');
    }

    return response.data.data;
  },

  /**
   * Get featured tutors
   */
  getFeaturedTutors: async (limit = 6): Promise<Tutor[]> => {
    const response = await api.get<{ success: boolean; data: Tutor[] }>('/tutor/featured', {
      params: { limit }
    });

    if (!response.data.success) {
      throw new Error('Failed to get featured tutors');
    }

    return response.data.data;
  },

  /**
   * Get tutor profile by ID
   */
  getTutorProfile: async (tutorId: string): Promise<TutorProfile> => {
    const response = await api.get<{ success: boolean; data: TutorProfile }>(`/tutor/${tutorId}`);

    if (!response.data.success) {
      throw new Error('Tutor not found');
    }

    return response.data.data;
  },

  /**
   * Get available filter options
   */
  getFilterLanguages: async (): Promise<string[]> => {
    const response = await api.get<{ success: boolean; data: string[] }>('/tutor/filters/languages');

    if (!response.data.success) {
      throw new Error('Failed to get languages');
    }

    return response.data.data;
  },


  /**
   * Upload tutor profile picture
   */
  uploadProfilePicture: async (file: File): Promise<string> => {
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB safeguard client-side
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large. Max ${(MAX_BYTES / (1024*1024)).toFixed(1)}MB`);
    }
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<{ success: boolean; url?: string; error?: string }>(
      '/tutor/profile-picture',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (!response.data.success || !response.data.url) {
      throw new Error(response.data.error || 'Failed to upload profile picture');
    }

    return response.data.url;
  },

  /**
   * Submit profile for admin review
   */
  submitProfileForReview: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post<{ success: boolean; message?: string; error?: string }>(
      '/tutor/profile/submit'
    );

    return response.data;
  },

  /**
   * Get student's lesson request (for tutor's classroom view)
   */
  getStudentLessonRequest: async (studentId: string, sessionId?: string): Promise<{
    lessonId: string;
    courseId: string;
    title: string;
    lessonNumber: number;
    goal: string;
    level?: number | null;
    chapter?: number | null;
    studentPreferences?: {
      cameraOn?: boolean;
      proficiency?: string;
      errorCorrection?: string;
      otherRequests?: string;
    };
  } | null> => {
    const response = await api.get<{ success: boolean; data: any }>(`/tutor/student/${studentId}/lesson-request`, {
      params: sessionId ? { sessionId } : undefined,
    });

    if (!response.data.success) {
      throw new Error('Could not load the material request');
    }

    return response.data.data;
  },

  getClassroomNotes: async (
    sessionId: string,
    materialType: string,
    materialId: string,
  ): Promise<ClassroomNotesRecord | null> => {
    const response = await api.get<{ success: boolean; data: ClassroomNotesRecord | null }>(
      `/tutor/classroom-notes/${sessionId}`,
      {
        params: { materialType, materialId },
      }
    );

    if (!response.data.success) {
      throw new Error('Failed to get classroom notes');
    }

    return response.data.data;
  },

  saveClassroomNotes: async (
    sessionId: string,
    payload: SaveClassroomNotesInput,
  ): Promise<ClassroomNotesRecord> => {
    const response = await api.put<{ success: boolean; data: ClassroomNotesRecord }>(
      `/tutor/classroom-notes/${sessionId}`,
      payload
    );

    if (!response.data.success) {
      throw new Error('Failed to save classroom notes');
    }

    return response.data.data;
  },

  getClassroomExerciseMarks: async (sessionId: string, lessonId: string): Promise<ClassroomExerciseMark[]> => {
    const response = await api.get<{ success: boolean; data: ClassroomExerciseMark[] }>(
      `/tutor/classroom-exercise-marks/${encodeURIComponent(sessionId)}`,
      { params: { lessonId } },
    );
    if (!response.data.success) throw new Error('Failed to load exercise marks');
    return response.data.data;
  },

  saveClassroomExerciseMark: async (
    sessionId: string,
    payload: SaveClassroomExerciseMarkInput,
  ): Promise<ClassroomExerciseMark | null> => {
    const response = await api.put<{ success: boolean; data: ClassroomExerciseMark | null }>(
      `/tutor/classroom-exercise-marks/${encodeURIComponent(sessionId)}`,
      payload,
    );
    if (!response.data.success) throw new Error('Failed to save exercise mark');
    return response.data.data;
  },
};

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export interface LessonHeader {
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
  backgroundImage: string;
  overlayColor: string;
}

export interface VocabularyItem {
  id: string;
  word: string;
  reading: string;
  english: string;
}

export interface GrammarPoint {
  id: string;
  structure: string;
  meaning: string;
  example: string;
  translation: string;
}

export interface Exercise {
  id: string;
  type: 'fill-blank' | 'multiple-choice' | 'matching';
  question: string;
  correctAnswer: string;
  options?: string[];
}

export interface LessonMaterial {
  version?: number;
  header: LessonHeader;
  vocabulary: VocabularyItem[];
  grammar: GrammarPoint[];
  exercises: Exercise[];
}

export interface SaveLessonResponse {
  success: boolean;
  lessonId?: string;
  url?: string;
  headerImageUrl?: string;
  message?: string;
  error?: string;
}

export interface LessonListItem {
  id: string;
  createdAt: string;
  url: string;
}

export interface GetLessonResponse {
  success: boolean;
  lesson?: LessonMaterial;
  url?: string;
  error?: string;
}

export interface ListLessonsResponse {
  success: boolean;
  lessons: LessonListItem[];
  error?: string;
}

/**
 * Convert base64 data URL to Blob
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) return null;
    
    const match = parts[0].match(/:(.*?);/);
    if (!match) return null;
    
    const mime = match[1];
    const bstr = atob(parts[1]);
    const u8arr = new Uint8Array(bstr.length);
    
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

export const lessonApi = {
  /**
   * Save lesson material to server
   * @param lesson - The lesson data (header, vocabulary, grammar, exercises)
   * @returns The saved lesson URL and ID
   */
  async saveLesson(lesson: LessonMaterial): Promise<SaveLessonResponse> {
    const formData = new FormData();
    
    // Prepare lesson data - remove the base64 image from JSON
    const lessonToSave: LessonMaterial = {
      ...lesson,
      header: {
        ...lesson.header,
        backgroundImage: '' // Will be handled separately
      }
    };
    
    formData.append('lessonData', JSON.stringify(lessonToSave));
    
    // If there's a base64 header image, convert to blob and add
    if (lesson.header.backgroundImage && lesson.header.backgroundImage.startsWith('data:')) {
      const imageBlob = dataUrlToBlob(lesson.header.backgroundImage);
      if (imageBlob) {
        // Get extension from mime type
        const ext = imageBlob.type.split('/')[1] || 'jpg';
        formData.append('headerImage', imageBlob, `header.${ext}`);
      }
    }
    
    const response = await api.post<SaveLessonResponse>('/lesson/save', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Get a lesson by ID
   */
  async getLesson(lessonId: string): Promise<GetLessonResponse> {
    const response = await api.get<GetLessonResponse>(`/lesson/${lessonId}`);
    return response.data;
  },

  /**
   * List all lessons
   */
  async listLessons(): Promise<ListLessonsResponse> {
    const response = await api.get<ListLessonsResponse>('/lesson/list');
    return response.data;
  },

  /**
   * Delete a lesson
   */
  async deleteLesson(lessonId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.delete(`/lesson/${lessonId}`);
    return response.data;
  }
};

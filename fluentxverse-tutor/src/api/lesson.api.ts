import { client } from './utils';

export interface LessonHeader {
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
  backgroundImage: string;
  overlayColor: string;
}

export interface LessonMaterial {
  version?: number;
  header: LessonHeader;
  sections?: any[];
  vocabulary?: any[];
  grammar?: any[];
  exercises?: any[];
  [key: string]: any;
}

export interface Lesson {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'finished' | 'published' | 'archived';
  parentId: string | null;
  forkOf: string | null;
  isFork: boolean;
  createdBy: string;
  createdByName: string | null;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  currentVersion?: number;
  url?: string;
  lessonData?: LessonMaterial;
}

export interface PublishedLessonsResponse {
  success: boolean;
  lessons: Lesson[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export const lessonApi = {
  /**
   * Get published lessons for a specific course
   */
  async getPublishedLessons(courseSlug: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<PublishedLessonsResponse> {
    const response = await client.get<PublishedLessonsResponse>(`/lesson/published/${courseSlug}`, {
      params: options
    });
    return response.data;
  },

  /**
   * Get a specific lesson by ID (full data)
   */
  async getLesson(lessonId: string): Promise<{ success: boolean; lesson: Lesson | null; lessonData?: LessonMaterial; url?: string; error?: string }> {
    const response = await client.get(`/lesson/${lessonId}`);
    return response.data;
  },

  /**
   * Get student view of a lesson (stripped of tutor hints)
   * Returns viewUrl for displaying in dashboard's student view mode
   */
  async getStudentLesson(lessonId: string): Promise<{ 
    success: boolean; 
    lesson: { id: string; title: string; status: string } | null; 
    lessonData?: LessonMaterial; 
    materialType?: string; 
    viewUrl?: string;
    error?: string 
  }> {
    const response = await client.get(`/lesson/${lessonId}/student`);
    return response.data;
  },

  /**
   * Get tutor view of a lesson (full version with hints/tips)
   * Returns viewUrl for displaying in dashboard's tutor view mode
   */
  async getTutorLesson(lessonId: string): Promise<{ 
    success: boolean; 
    lesson: Lesson | null; 
    lessonData?: LessonMaterial; 
    materialType?: string; 
    viewUrl?: string;
    error?: string 
  }> {
    const response = await client.get(`/lesson/${lessonId}/tutor`);
    return response.data;
  }
};

export default lessonApi;

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
   * Get published lessons for a specific course (from lesson system)
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
   * Get published lesson materials for a specific course (from lesson-materials system)
   * Used for conversational-skills which uses Memgraph storage
   */
  async getPublishedLessonMaterials(course: string): Promise<{ success: boolean; lessons: any[]; error?: string }> {
    const response = await client.get(`/lesson-materials/published/${course}`);
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
   * Get student-facing lesson data from the backend.
   * The backend may optionally return a viewUrl for server-managed viewers.
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
   * Get a backend-provided view URL for a lesson material when available.
   */
  async getLessonMaterialView(lessonId: string): Promise<{ 
    success: boolean; 
    lesson: { id: string; title: string; status: string } | null; 
    viewUrl?: string;
    error?: string 
  }> {
    const response = await client.get(`/lesson-materials/view/${lessonId}`);
    return response.data;
  },
  
  /**
   * Get full lesson material data for local student rendering.
   */
  async getPublicLessonMaterial(lessonId: string): Promise<{ 
    success: boolean; 
    lesson: any | null; 
    error?: string 
  }> {
    const response = await client.get(`/lesson-materials/public/${lessonId}`);
    return response.data;
  },

  // ============================================================================
  // YOUNG LEARNERS API
  // ============================================================================

  /**
   * Get all published Young Learners lessons
   */
  async getYoungLearnersLessons(): Promise<{ 
    success: boolean; 
    lessons: any[]; 
    error?: string 
  }> {
    const response = await client.get('/young-learners/published');
    return response.data;
  },

  /**
   * Get a specific Young Learners lesson by ID (public)
   */
  async getYoungLearnersLesson(lessonId: string): Promise<{ 
    success: boolean; 
    lesson: any | null; 
    error?: string 
  }> {
    const response = await client.get(`/young-learners/public/${lessonId}`);
    return response.data;
  }
};

export default lessonApi;

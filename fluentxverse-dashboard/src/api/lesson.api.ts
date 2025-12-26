import { apiClient } from './apiClient';

const api = apiClient;

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

// Database-backed lesson record
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
  forkCount?: number;
  hasPendingMergeRequest?: boolean;
  url?: string; // Added by API
}

// Version history entry
export interface LessonVersion {
  id: string;
  lessonId: string;
  versionNumber: number;
  lessonData: LessonMaterial;
  changeSummary: string | null;
  changedBy: string;
  changedByName: string | null;
  createdAt: string;
}

// Merge request
export interface MergeRequest {
  id: string;
  sourceLessonId: string;
  sourceVersion: number;
  targetLessonId: string;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  requestedBy: string;
  requestedByName: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLesson?: Lesson;
  targetLesson?: Lesson;
}

// Merge request comment
export interface MergeRequestComment {
  id: string;
  mergeRequestId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface SaveLessonResponse {
  success: boolean;
  lessonId?: string;
  url?: string;
  headerImageUrl?: string;
  message?: string;
  error?: string;
}

export interface CreateLessonResponse {
  success: boolean;
  lesson?: Lesson;
  version?: LessonVersion;
  url?: string;
  headerImageUrl?: string;
  message?: string;
  error?: string;
}

export interface UpdateLessonResponse {
  success: boolean;
  lesson?: Lesson;
  version?: LessonVersion;
  url?: string;
  message?: string;
  error?: string;
}

export interface ForkLessonResponse {
  success: boolean;
  lesson?: Lesson;
  version?: LessonVersion;
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
  lesson?: Lesson | null;
  lessonData?: LessonMaterial;
  url?: string;
  error?: string;
}

export interface ListLessonsResponse {
  success: boolean;
  lessons: Lesson[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export interface MergeRequestResponse {
  success: boolean;
  mergeRequest?: MergeRequest;
  message?: string;
  error?: string;
}

export interface ListMergeRequestsResponse {
  success: boolean;
  mergeRequests: MergeRequest[];
  error?: string;
}

export interface VersionHistoryResponse {
  success: boolean;
  versions: LessonVersion[];
  error?: string;
}

export interface VersionResponse {
  success: boolean;
  version?: LessonVersion;
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

/**
 * Check if a string is a base64 data URL
 */
function isBase64Image(str: string | undefined): boolean {
  return !!str && str.startsWith('data:image');
}

/**
 * Extract all base64 images from lesson data and add them to FormData
 * Returns the lesson data with base64 images replaced with placeholder keys
 */
function extractAndPrepareImages(lesson: any, formData: FormData): any {
  const lessonCopy = JSON.parse(JSON.stringify(lesson));
  let imageIndex = 0;
  
  // Helper to process an image field
  const processImage = (obj: any, key: string, prefix: string) => {
    if (obj && isBase64Image(obj[key])) {
      const blob = dataUrlToBlob(obj[key]);
      if (blob) {
        const imageKey = `${prefix}_${imageIndex++}`;
        const ext = blob.type.split('/')[1] || 'jpg';
        formData.append(imageKey, blob, `${imageKey}.${ext}`);
        obj[key] = `__UPLOAD__:${imageKey}`; // Placeholder to be replaced by server
      }
    }
  };
  
  // Process header image
  processImage(lessonCopy.header, 'backgroundImage', 'header');
  
  // Process sections if present
  if (Array.isArray(lessonCopy.sections)) {
    lessonCopy.sections.forEach((section: any, sIdx: number) => {
      // Section-level images
      processImage(section, 'sectionImage', `section_${sIdx}`);
      processImage(section, 'dialogueImage', `section_${sIdx}_dialogue`);
      processImage(section, 'triviaImage', `section_${sIdx}_trivia`);
      processImage(section, 'practiceImage', `section_${sIdx}_practice`);
      processImage(section, 'readingImage', `section_${sIdx}_reading`);
      
      // Vocab cards
      if (Array.isArray(section.vocabCards)) {
        section.vocabCards.forEach((card: any, cIdx: number) => {
          processImage(card, 'image', `section_${sIdx}_vocab_${cIdx}`);
        });
      }
      
      // Image cards
      if (Array.isArray(section.imageCards)) {
        section.imageCards.forEach((card: any, cIdx: number) => {
          processImage(card, 'image', `section_${sIdx}_imgcard_${cIdx}`);
        });
      }
      
      // Trivia examples
      if (Array.isArray(section.triviaExamples)) {
        section.triviaExamples.forEach((ex: any, eIdx: number) => {
          processImage(ex, 'image', `section_${sIdx}_triviaex_${eIdx}`);
        });
      }
    });
  }
  
  return lessonCopy;
}

export const lessonApi = {
  /**
   * Create a new lesson (database-backed)
   * Extracts all base64 images and uploads them separately for better performance
   */
  async createLesson(lesson: LessonMaterial): Promise<CreateLessonResponse> {
    const formData = new FormData();
    
    // Extract all base64 images and add them to formData
    // This replaces base64 strings with placeholders like "__UPLOAD__:key"
    const lessonToSave = extractAndPrepareImages(lesson, formData);
    
    formData.append('lessonData', JSON.stringify(lessonToSave));
    
    const response = await api.post<CreateLessonResponse>('/lesson/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Update a lesson (creates new version)
   * Extracts all base64 images and uploads them separately for better performance
   */
  async updateLesson(lessonId: string, lesson: LessonMaterial, changeSummary?: string): Promise<UpdateLessonResponse> {
    const formData = new FormData();
    
    // Extract all base64 images and add them to formData
    const lessonToSave = extractAndPrepareImages(lesson, formData);
    
    formData.append('lessonData', JSON.stringify(lessonToSave));
    if (changeSummary) {
      formData.append('changeSummary', changeSummary);
    }
    
    const response = await api.put<UpdateLessonResponse>(`/lesson/update/${lessonId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Fork a lesson (create personal copy)
   */
  async forkLesson(lessonId: string): Promise<ForkLessonResponse> {
    const response = await api.post<ForkLessonResponse>(`/lesson/fork/${lessonId}`);
    return response.data;
  },

  /**
   * Get forks of a lesson
   */
  async getLessonForks(lessonId: string): Promise<{ success: boolean; forks: Lesson[]; error?: string }> {
    const response = await api.get(`/lesson/forks/${lessonId}`);
    return response.data;
  },

  /**
   * Create a merge request (from fork to original)
   */
  async createMergeRequest(sourceLessonId: string, title: string, description?: string): Promise<MergeRequestResponse> {
    const response = await api.post<MergeRequestResponse>('/lesson/merge-request', {
      sourceLessonId,
      title,
      description
    });
    return response.data;
  },

  /**
   * Get merge requests for a lesson
   */
  async getMergeRequests(lessonId: string, status?: string): Promise<ListMergeRequestsResponse> {
    const params = status ? { status } : {};
    const response = await api.get<ListMergeRequestsResponse>(`/lesson/merge-requests/${lessonId}`, { params });
    return response.data;
  },

  /**
   * Get a specific merge request
   */
  async getMergeRequest(mrId: string): Promise<MergeRequestResponse> {
    const response = await api.get<MergeRequestResponse>(`/lesson/merge-request/${mrId}`);
    return response.data;
  },

  /**
   * Review a merge request (approve, reject, or merge)
   */
  async reviewMergeRequest(mrId: string, action: 'approve' | 'reject' | 'merge', comment?: string): Promise<MergeRequestResponse> {
    const response = await api.post<MergeRequestResponse>(`/lesson/merge-request/${mrId}/review`, {
      action,
      comment
    });
    return response.data;
  },

  /**
   * Publish a lesson
   */
  async publishLesson(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/publish/${lessonId}`);
    return response.data;
  },

  /**
   * Get version history for a lesson
   */
  async getVersionHistory(lessonId: string): Promise<VersionHistoryResponse> {
    const response = await api.get<VersionHistoryResponse>(`/lesson/versions/${lessonId}`);
    return response.data;
  },

  /**
   * Get a specific version
   */
  async getVersion(lessonId: string, versionNumber: number): Promise<VersionResponse> {
    const response = await api.get<VersionResponse>(`/lesson/version/${lessonId}/${versionNumber}`);
    return response.data;
  },

  /**
   * Get my lessons (current user's lessons)
   */
  async getMyLessons(options?: {
    status?: 'draft' | 'published' | 'archived';
    includeForks?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListLessonsResponse> {
    const response = await api.get<ListLessonsResponse>('/lesson/my-lessons', { params: options });
    return response.data;
  },

  /**
   * Get pending merge requests for my lessons
   */
  async getMyMergeRequests(): Promise<ListMergeRequestsResponse> {
    const response = await api.get<ListMergeRequestsResponse>('/lesson/my-merge-requests');
    return response.data;
  },

  /**
   * Save lesson material to server (legacy - backwards compatible)
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
   * List all lessons (with optional filters)
   */
  async listLessons(options?: {
    status?: 'draft' | 'published' | 'archived';
    createdBy?: string;
    includeForks?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListLessonsResponse> {
    const response = await api.get<ListLessonsResponse>('/lesson/list', { params: options });
    return response.data;
  },

  /**
   * Delete a lesson
   */
  async deleteLesson(lessonId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.delete(`/lesson/${lessonId}`);
    return response.data;
  },

  // ============= IMPROVEMENT API METHODS =============

  /**
   * Restore a specific version (creates new version from old content)
   */
  async restoreVersion(lessonId: string, versionNumber: number): Promise<{ success: boolean; lesson?: Lesson; version?: LessonVersion; message?: string; error?: string }> {
    const response = await api.post(`/lesson/restore/${lessonId}/${versionNumber}`);
    return response.data;
  },

  /**
   * Unpublish a lesson (set back to draft)
   */
  async unpublishLesson(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/unpublish/${lessonId}`);
    return response.data;
  },

  /**
   * Archive a lesson
   */
  async archiveLesson(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/archive/${lessonId}`);
    return response.data;
  },

  /**
   * Mark a lesson as finished
   */
  async markAsFinished(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/mark-finished/${lessonId}`);
    return response.data;
  },

  /**
   * Mark a lesson back to draft
   */
  async markAsDraft(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/mark-draft/${lessonId}`);
    return response.data;
  },

  /**
   * Save lesson as a template
   */
  async saveAsTemplate(lessonId: string): Promise<{ success: boolean; lesson?: Lesson; message?: string; error?: string }> {
    const response = await api.post(`/lesson/save-as-template/${lessonId}`);
    return response.data;
  },

  /**
   * Get comments for a merge request
   */
  async getMergeRequestComments(mrId: string): Promise<{ success: boolean; comments: MergeRequestComment[]; error?: string }> {
    const response = await api.get(`/lesson/merge-request/${mrId}/comments`);
    return response.data;
  },

  /**
   * Add a comment to a merge request
   */
  async addMergeRequestComment(mrId: string, content: string): Promise<{ success: boolean; comment?: MergeRequestComment; message?: string; error?: string }> {
    const response = await api.post(`/lesson/merge-request/${mrId}/comments`, { content });
    return response.data;
  },

  /**
   * Update merge request status
   */
  async updateMergeRequestStatus(mrId: string, status: 'pending' | 'approved' | 'rejected' | 'merged'): Promise<{ success: boolean; mergeRequest?: MergeRequest; message?: string; error?: string }> {
    const response = await api.patch(`/lesson/merge-request/${mrId}/status`, { status });
    return response.data;
  },

  /**
   * Search lessons with advanced filters
   */
  async searchLessons(options: {
    query?: string;
    status?: string;
    authorId?: string;
    language?: string;
    level?: string;
    isTemplate?: boolean;
    isFork?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<ListLessonsResponse> {
    const params: Record<string, string | number | boolean> = {};
    if (options.query) params.q = options.query;
    if (options.status) params.status = options.status;
    if (options.authorId) params.authorId = options.authorId;
    if (options.language) params.language = options.language;
    if (options.level) params.level = options.level;
    if (options.isTemplate !== undefined) params.isTemplate = options.isTemplate;
    if (options.isFork !== undefined) params.isFork = options.isFork;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.sortOrder) params.sortOrder = options.sortOrder;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    
    const response = await api.get<ListLessonsResponse>('/lesson/search', { params });
    return response.data;
  },

  /**
   * Perform bulk actions on multiple lessons
   */
  async bulkAction(action: 'publish' | 'unpublish' | 'archive' | 'delete', lessonIds: string[]): Promise<{
    success: boolean;
    message?: string;
    results: { lessonId: string; success: boolean; error?: string }[];
    error?: string;
  }> {
    const response = await api.post('/lesson/bulk-action', { action, lessonIds });
    return response.data;
  },

  // ============= CATEGORIES & TAGS =============

  /**
   * Get all categories (tree structure)
   */
  async getCategories(): Promise<{ success: boolean; categories: LessonCategory[]; error?: string }> {
    const response = await api.get('/lesson/categories');
    return response.data;
  },

  /**
   * Get all tags
   */
  async getTags(): Promise<{ success: boolean; tags: LessonTag[]; error?: string }> {
    const response = await api.get('/lesson/tags');
    return response.data;
  },

  /**
   * Get popular tags
   */
  async getPopularTags(limit = 20): Promise<{ success: boolean; tags: LessonTag[]; error?: string }> {
    const response = await api.get('/lesson/tags/popular', { params: { limit } });
    return response.data;
  },

  /**
   * Get tags for a lesson
   */
  async getLessonTags(lessonId: string): Promise<{ success: boolean; tags: LessonTag[]; error?: string }> {
    const response = await api.get(`/lesson/tags/lesson/${lessonId}`);
    return response.data;
  },

  /**
   * Assign tags to a lesson
   */
  async assignTags(lessonId: string, tagIds: string[]): Promise<{ success: boolean; error?: string }> {
    const response = await api.post(`/lesson/tags/lesson/${lessonId}`, { tagIds });
    return response.data;
  },

  // ============= MEDIA =============

  /**
   * Get all media for a lesson
   */
  async getLessonMedia(lessonId: string): Promise<{ success: boolean; media: LessonMedia[]; error?: string }> {
    const response = await api.get(`/lesson/${lessonId}/media`);
    return response.data;
  },

  /**
   * Upload media to a lesson
   */
  async uploadMedia(lessonId: string, file: File, metadata: {
    type: 'audio' | 'video' | 'image' | 'document';
    title?: string;
    description?: string;
    duration?: number;
    vocabularyItemId?: string;
  }): Promise<{ success: boolean; media?: LessonMedia; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', metadata.type);
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.duration) formData.append('duration', metadata.duration.toString());
    if (metadata.vocabularyItemId) formData.append('vocabularyItemId', metadata.vocabularyItemId);
    
    const response = await api.post(`/lesson/${lessonId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Delete media
   */
  async deleteMedia(mediaId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.delete(`/lesson/media/${mediaId}`);
    return response.data;
  },

  // ============= ANALYTICS =============

  /**
   * Record a lesson view
   */
  async recordView(lessonId: string, sessionId?: string): Promise<{ success: boolean; viewId?: string; error?: string }> {
    const response = await api.post(`/lesson/${lessonId}/view`, { sessionId });
    return response.data;
  },

  /**
   * Get lesson progress
   */
  async getProgress(lessonId: string): Promise<{ success: boolean; progress?: LessonProgress; error?: string }> {
    const response = await api.get(`/lesson/${lessonId}/progress`);
    return response.data;
  },

  /**
   * Get all user progress
   */
  async getMyProgress(): Promise<{ success: boolean; progress: LessonProgress[]; error?: string }> {
    const response = await api.get('/lesson/my-progress');
    return response.data;
  },

  /**
   * Get lessons due for review
   */
  async getLessonsDueForReview(): Promise<{ success: boolean; lessons: LessonProgress[]; error?: string }> {
    const response = await api.get('/lesson/due-for-review');
    return response.data;
  },

  /**
   * Get lesson stats
   */
  async getLessonStats(lessonId: string): Promise<{ success: boolean; stats?: LessonStats; error?: string }> {
    const response = await api.get(`/lesson/${lessonId}/stats`);
    return response.data;
  },

  /**
   * Bookmark a lesson
   */
  async bookmarkLesson(lessonId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.post(`/lesson/${lessonId}/bookmark`);
    return response.data;
  },

  /**
   * Remove bookmark
   */
  async removeBookmark(lessonId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.delete(`/lesson/${lessonId}/bookmark`);
    return response.data;
  },

  /**
   * Get user bookmarks
   */
  async getMyBookmarks(): Promise<{ success: boolean; bookmarks: string[]; error?: string }> {
    const response = await api.get('/lesson/my-bookmarks');
    return response.data;
  },

  /**
   * Check if lesson is bookmarked
   */
  async isBookmarked(lessonId: string): Promise<{ success: boolean; bookmarked: boolean; error?: string }> {
    const response = await api.get(`/lesson/${lessonId}/is-bookmarked`);
    return response.data;
  }
};

// ============= ADDITIONAL TYPES =============

export interface LessonCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  children?: LessonCategory[];
}

export interface LessonTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  usageCount: number;
}

export interface LessonMedia {
  id: string;
  lessonId: string;
  type: 'audio' | 'video' | 'image' | 'document';
  filename: string;
  storagePath: string;
  mimeType: string | null;
  fileSize: number | null;
  title: string | null;
  description: string | null;
  duration: number | null;
  vocabularyItemId: string | null;
}

export interface LessonProgress {
  id: string;
  lessonId: string;
  userId: string;
  startedAt: string;
  lastAccessedAt: string;
  completedAt: string | null;
  sectionsCompleted: string[];
  vocabularyMastered: string[];
  exercisesCompleted: ExerciseResult[];
  vocabularyScore: number | null;
  grammarScore: number | null;
  exerciseScore: number | null;
  overallScore: number | null;
  nextReviewDate: string | null;
  reviewCount: number;
}

export interface ExerciseResult {
  exerciseId: string;
  correct: boolean;
  answer: string;
  completedAt: string;
}

export interface LessonStats {
  lessonId: string;
  totalViews: number;
  uniqueViewers: number;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  avgVocabularyScore: number | null;
  avgGrammarScore: number | null;
  avgExerciseScore: number | null;
  avgOverallScore: number | null;
  avgTimeSpent: number;
  bookmarkCount: number;
}
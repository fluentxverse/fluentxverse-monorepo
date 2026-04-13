const BUSINESS_ENGLISH_PUBLIC_LESSON_PREFIX = 'fxv-business-english-public-lesson';
const BUSINESS_ENGLISH_PUBLIC_LESSON_TTL_MS = 30 * 60 * 1000;
const BUSINESS_ENGLISH_LESSON_LIST_PREFIX = 'fxv-business-english-lesson-list';
const BUSINESS_ENGLISH_LESSON_LIST_TTL_MS = 30 * 60 * 1000;

const buildPublicLessonKey = (lessonId: string) => `${BUSINESS_ENGLISH_PUBLIC_LESSON_PREFIX}:${lessonId}`;
const buildLessonListKey = (courseId: string) => `${BUSINESS_ENGLISH_LESSON_LIST_PREFIX}:${courseId}`;

export const readCachedBusinessEnglishLesson = <T = any>(lessonId: string): T | null => {
  if (!lessonId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(buildPublicLessonKey(lessonId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
    if (!parsed?.savedAt || parsed.savedAt + BUSINESS_ENGLISH_PUBLIC_LESSON_TTL_MS < Date.now()) {
      window.sessionStorage.removeItem(buildPublicLessonKey(lessonId));
      return null;
    }

    return parsed.data ?? null;
  } catch {
    return null;
  }
};

export const cacheBusinessEnglishLesson = <T = any>(lessonId: string, lesson: T): void => {
  if (!lessonId || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildPublicLessonKey(lessonId),
      JSON.stringify({
        savedAt: Date.now(),
        data: lesson,
      }),
    );
  } catch {
    // Ignore storage errors.
  }
};

export const readCachedBusinessEnglishLessonList = <T = any>(courseId: string): T[] | null => {
  if (!courseId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(buildLessonListKey(courseId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T[] };
    if (!parsed?.savedAt || parsed.savedAt + BUSINESS_ENGLISH_LESSON_LIST_TTL_MS < Date.now()) {
      window.sessionStorage.removeItem(buildLessonListKey(courseId));
      return null;
    }

    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
};

export const cacheBusinessEnglishLessonList = <T = any>(courseId: string, lessons: T[]): void => {
  if (!courseId || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildLessonListKey(courseId),
      JSON.stringify({
        savedAt: Date.now(),
        data: lessons,
      }),
    );
  } catch {
    // Ignore storage errors.
  }
};

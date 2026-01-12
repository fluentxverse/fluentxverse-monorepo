import { client } from "./utils";

export interface LessonPreferences {
  preferCameraOn: boolean;
  errorCorrection: 'during_feedback' | 'proactively' | 'tutor_choice';
  otherRequests: string;
}

export interface AboutMe {
  purpose: string;
  occupation: string;
  hobbies: string[];
  bio: string;
}

export interface LastViewedLesson {
  courseId: string;
  lessonId: string;
  lessonNumber: number;
  title: string;
  goal: string;
  viewedAt: number;
}

export interface StudentProfile {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  fullName: string;
  initials: string;
  mobileNumber?: string;
  birthDate?: string;
  joinDate?: string | number;
  totalLessons: number;
  upcomingLessons: number;
  attendance: number;
  smartWalletAddress?: string;
  currentProficiency?: string;
  learningGoals?: string[];
  preferredLearningStyle?: string;
  availability?: string[];
  country?: string;
  timezone?: string;
  interests?: string;
  preferredTopics?: string[];
  lessonPreferences?: LessonPreferences;
  purpose?: string;
  occupation?: string;
  hobbies?: string[];
  bio?: string;
}

/**
 * Get the current student's profile
 */
export const getStudentProfile = async (): Promise<{ success: boolean; data?: StudentProfile; error?: string }> => {
  try {
    const { data } = await client.get('/student/profile');
    return data;
  } catch (error: any) {
    console.error('[StudentAPI] Failed to get profile:', error);
    return { success: false, error: error.message || 'Failed to get profile' };
  }
};

/**
 * Update the student's lesson preferences
 */
export const updateLessonPreferences = async (preferences: LessonPreferences): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data } = await client.put('/student/preferences', preferences);
    return data;
  } catch (error: any) {
    console.error('[StudentAPI] Failed to update preferences:', error);
    return { success: false, error: error.message || 'Failed to update preferences' };
  }
};

/**
 * Update the student's About Me info (purpose, occupation, hobbies)
 */
export const updateAboutMe = async (aboutMe: AboutMe): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data } = await client.put('/student/about-me', aboutMe);
    return data;
  } catch (error: any) {
    console.error('[StudentAPI] Failed to update about me:', error);
    return { success: false, error: error.message || 'Failed to update about me' };
  }
};

/**
 * Save the last viewed lesson for the student
 */
export const saveLastViewedLesson = async (lesson: LastViewedLesson): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data } = await client.put('/student/last-viewed-lesson', lesson);
    return data;
  } catch (error: any) {
    console.error('[StudentAPI] Failed to save last viewed lesson:', error);
    return { success: false, error: error.message || 'Failed to save last viewed lesson' };
  }
};

/**
 * Get the last viewed lesson for the student
 */
export const getLastViewedLesson = async (): Promise<{ success: boolean; data?: LastViewedLesson; error?: string }> => {
  try {
    const { data } = await client.get('/student/last-viewed-lesson');
    return data;
  } catch (error: any) {
    console.error('[StudentAPI] Failed to get last viewed lesson:', error);
    return { success: false, error: error.message || 'Failed to get last viewed lesson' };
  }
};

// Export as a unified API object
export const studentApi = {
  getStudentProfile,
  updateLessonPreferences,
  updateAboutMe,
  saveLastViewedLesson,
  getLastViewedLesson,
};

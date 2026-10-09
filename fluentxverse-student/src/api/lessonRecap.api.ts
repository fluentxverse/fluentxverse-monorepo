import { client } from './utils';

export interface LessonMaterialRequest {
  courseId: string; lessonId: string; title: string; lessonNumber: number;
  level: number | null; chapter: number | null; goal: string;
}
export interface StudentLessonMaterialNotes {
  materialId: string; materialType: string; courseId: string | null; materialTitle: string | null;
  materialLevel: number | null; materialChapter: number | null;
  completionStatus: 'completed' | 'in_progress' | null; stoppedAtLabel: string | null; progressDetails: string;
  vocabularyItems: { word: string; selectedDefinitionIndex: number; definitions: {
    meaning: string; partOfSpeech: string; japaneseNative: string; japaneseRomanized: string;
  }[] }[];
  grammarItems: { youSaid: string; correct: string }[];
  pronunciationItems: { word: string; phonetic: string }[];
}
export interface StudentLessonRecap {
  workflow?: { attendanceVerified: boolean; outcome: string; notesStatus: string; closed: boolean; editableUntil: string; endsAt: string };
  studentAttendance: string | null; startsAt: string; canRequestMaterial: boolean;
  materialRequest: LessonMaterialRequest | null; materials: StudentLessonMaterialNotes[];
  studentComment: string; englishLevelAssessment: number | null;
  previousLessonId: string | null; nextLessonId: string | null;
}
export const lessonRecapApi = {
  async materialRequest(bookingId: string, signal?: AbortSignal): Promise<Pick<StudentLessonRecap, 'canRequestMaterial' | 'materialRequest'>> {
    const { data } = await client.get(`/schedule/lesson-material-request/${encodeURIComponent(bookingId)}`, { signal });
    if (!data.success) throw new Error(data.error || 'Could not load material request');
    return data.data;
  },
  async get(bookingId: string, signal?: AbortSignal): Promise<StudentLessonRecap> {
    const { data } = await client.get(`/schedule/lesson-recap/${encodeURIComponent(bookingId)}`, { signal });
    if (!data.success) throw new Error(data.error || 'Could not load lesson recap');
    return data.data;
  },
  async request(bookingId: string, courseId: string | null, materialId?: string): Promise<LessonMaterialRequest | null> {
    const { data } = await client.put(`/schedule/lesson-material-request/${encodeURIComponent(bookingId)}`, { courseId, materialId });
    if (!data.success) throw new Error(data.error || 'Could not save material request');
    return data.data;
  },
};

export const lessonCourseName = (course: string | null) => course === 'daily-dispatch' ? 'Daily Dispatch'
  : course === 'business-english' ? 'Business English' : course === 'conversational-skills' ? 'Conversational Skills' : 'Lesson material';
export const studentMaterialUrl = (course: string, id: string) => course === 'daily-dispatch'
  ? `/materials/daily-dispatch/${encodeURIComponent(id)}` : course === 'conversational-skills'
    ? `/materials/conversational-skills/${encodeURIComponent(id)}` : `/lesson/view?id=${encodeURIComponent(id)}`;

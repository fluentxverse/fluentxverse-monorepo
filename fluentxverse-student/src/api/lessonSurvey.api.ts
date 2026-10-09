import { client } from './utils';

export interface LessonSurveyInput { rating: number; positive: string[]; improvement: string[]; comment: string }
export interface LessonSurveyState {
  eligible: boolean; reason: string | null; endsAt: string | null; closesAt: string | null;
  readyAt?: string | null;
  topics: { id: string; label: string; positive: boolean }[];
  survey: (LessonSurveyInput & { submittedAt: string }) | null;
}
export const lessonSurveyApi = {
  async get(bookingId: string, signal?: AbortSignal): Promise<LessonSurveyState> {
    const { data } = await client.get(`/schedule/lesson/${encodeURIComponent(bookingId)}/survey`, { signal });
    if (!data.success) throw new Error(data.error || 'Could not load your lesson survey.');
    return data.data;
  },
  async submit(bookingId: string, input: LessonSurveyInput): Promise<NonNullable<LessonSurveyState['survey']>> {
    const { data } = await client.post(`/schedule/lesson/${encodeURIComponent(bookingId)}/survey`, input);
    if (!data.success) throw new Error(data.error || 'Could not submit your lesson survey.');
    return data.data;
  },
};

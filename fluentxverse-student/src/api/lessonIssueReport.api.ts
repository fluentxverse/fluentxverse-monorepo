import { client } from './utils';
import type { StudentTutorIssue } from '../data/studentTutorIssues';
export type LessonIssueDuration = 'up_to_ten' | 'over_ten';
export type LessonIssueReason = 'connection' | 'audio' | 'hardware' | 'emergency' | 'power' | 'tutor' | 'material' | 'other';
export interface StudentLessonIssueReport { id: string; duration: LessonIssueDuration; reason: LessonIssueReason; details: string; tutorIssue?: StudentTutorIssue | null; tutorIssueLabel?: string | null; createdAt: string; status?: string; resolution?: string; attendanceCorrection?: string | null; ticketTransactionId?: string | null; }
export interface StudentIssueReportStatus {
  startsAt: string; lessonEndsAt: string; closesAt: string; serverNow: string; eligible: boolean;
  reason: 'cancelled' | 'expired' | 'not_started' | 'waiting_for_tutor' | 'tutor_joined' | 'tutor_disconnected_wait' | null; report: StudentLessonIssueReport | null;
  availableAt?: string | null;
  duringLessonTutorIssue?: 'no_show' | 'left_early' | null;
}
export const lessonIssueReportApi = {
  async get(bookingId: string, signal?: AbortSignal): Promise<StudentIssueReportStatus> {
    const { data } = await client.get(`/schedule/lesson/${encodeURIComponent(bookingId)}/issue-report`, { signal });
    if (!data.success) throw new Error(data.error || 'Could not check reporting availability');
    return data.data;
  },
  async submit(bookingId: string, duration: LessonIssueDuration, reason: LessonIssueReason, details: string, tutorIssue?: StudentTutorIssue): Promise<StudentLessonIssueReport> {
    const { data } = await client.post(`/schedule/lesson/${encodeURIComponent(bookingId)}/issue-report`, { duration, reason, details, tutorIssue });
    if (!data.success) throw new Error(data.error || 'Could not submit issue report');
    return data.data;
  },
};

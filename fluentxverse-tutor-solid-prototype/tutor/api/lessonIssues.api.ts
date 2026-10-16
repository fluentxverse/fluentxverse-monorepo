import { client } from './utils';
import type { MetricsPeriod } from './performance.api';

export type IssueDirection = 'sent' | 'received';
export type IssueStatus = 'submitted' | 'under_review' | 'resolved';
export type IssueFilter = IssueStatus | 'all';
export interface TutorLessonIssue {
  id: string;
  bookingId: string;
  studentName: string;
  startsAt: string | null;
  direction: IssueDirection;
  reason: string;
  reasonLabel: string;
  issueLabel: string | null;
  duration: 'up_to_ten' | 'over_ten';
  details: string;
  status: IssueStatus;
  resolution: string;
  createdAt: string | null;
  reviewedAt: string | null;
}
export interface TutorLessonIssues {
  period: { period: MetricsPeriod; month: string | null; from: string | null; to: string | null };
  timezone: string;
  generatedAt: string;
  direction: IssueDirection;
  status: IssueFilter;
  summary: Record<IssueDirection, number>;
  statusCounts: Record<IssueStatus, number>;
  items: TutorLessonIssue[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export async function getTutorLessonIssues(period: MetricsPeriod, month: string, direction: IssueDirection, status: IssueFilter, page: number, signal: AbortSignal): Promise<TutorLessonIssues> {
  const response = await client.get('/tutor/lesson-issues', {
    params: { period, month: period === 'month' ? month : undefined, direction, status, page }, signal,
  });
  if (!response.data.success || !Array.isArray(response.data.data?.items) || !response.data.data?.summary)
    throw new Error(response.data.error || 'Could not load lesson issues');
  return response.data.data;
}

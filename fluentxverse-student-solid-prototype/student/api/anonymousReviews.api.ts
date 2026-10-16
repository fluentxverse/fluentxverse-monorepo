import { client } from './utils';
import { API_BASE_URL } from '../config/api';
import type { AnonymousReviewContent, AnonymousReviewEnrollment, AnonymousReviewGroup, AnonymousReviewProof } from '../shared/anonymousReviews';
export type ReviewAcknowledgment = { id: string; status: string; verified: boolean };

// This transport deliberately bypasses the authenticated Axios client and interceptors.
export async function anonymousReviewRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/anonymous-reviews/public/${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Anonymous review service is unavailable');
  return result.data as T;
}
export const anonymousReviewsApi = {
  async mine(): Promise<AnonymousReviewEnrollment[]> {
    const { data } = await client.get('/anonymous-reviews/me');
    if (!data.success) throw new Error(data.error || 'Could not load review groups');
    return data.data;
  },
  async enroll(bookingId: string, commitment: string): Promise<AnonymousReviewEnrollment> {
    const { data } = await client.post(`/anonymous-reviews/enroll/${encodeURIComponent(bookingId)}`, { commitment });
    if (!data.success) throw new Error(data.error || 'Could not enroll for feedback');
    return data.data;
  },
  group: (id: string, signal?: AbortSignal) => anonymousReviewRequest<AnonymousReviewGroup>(`group/${id}`, undefined, signal),
  submit: (groupId: string, content: AnonymousReviewContent, proof: AnonymousReviewProof, signal?: AbortSignal) =>
    anonymousReviewRequest<ReviewAcknowledgment>('submit', { groupId, content, proof }, signal),
  status: (id: string) => anonymousReviewRequest<ReviewAcknowledgment>('status', { id }),
};

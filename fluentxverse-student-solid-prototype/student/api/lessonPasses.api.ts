import { client } from './utils';
import { TICKETING_VISIBLE } from '../config/launch';
import type { PassAccount, PassAuthorization, PassBatch, PassMode } from '../shared/lessonPasses';
import type { AnonymousReviewProof } from '../shared/anonymousReviews';

async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown): Promise<T> {
  try {
    const response = await client.request({ method, url: `/lesson-passes${path}`, data,
      headers: { 'Cache-Control': 'no-store' } });
    if (!response.data.success) throw new Error(response.data.error || 'Pass operation unavailable');
    return response.data.data;
  } catch (error: any) { throw new Error(error.response?.data?.error || error.message || 'Pass operation unavailable'); }
}
export const lessonPassApi = {
  mode: async () => {
    const mode = await request<PassMode>('GET', '/mode');
    if (!mode || !['legacy_erc1155','private_passes','trial'].includes(mode.mode)) throw new Error('Lesson booking configuration is unavailable');
    if (!TICKETING_VISIBLE && mode.mode !== 'trial') throw new Error('Trial booking is not available yet. Please try again later.');
    return mode;
  },
  mine: () => request<PassAccount>('GET', '/me'),
  save: (version: number, envelope: string, accountId: string) => request<{ version: number; envelope: string }>('PUT', '/vault', { version, envelope, accountId }),
  order: (id: string, sku: string, commitments: string[], accountId: string) => request('POST', '/orders', { id, sku, commitments, accountId }),
  batch: (id: string) => request<PassBatch>('GET', `/batch/${id}`),
  prepare: (id: string, passId: string, refundCommitment: string) => request<PassAuthorization>('POST', '/reservations', { id, passId, refundCommitment }),
  proof: (id: string, proof: AnonymousReviewProof) => request('POST', `/reservations/${id}/proof`, proof),
  return: (id: string) => request('POST', `/reservations/${id}/return`),
  recover: (id: string) => request('POST', `/reservations/${id}/recover`),
};

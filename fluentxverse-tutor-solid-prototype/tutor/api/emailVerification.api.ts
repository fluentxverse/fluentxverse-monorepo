import { client } from './utils';
export interface TutorEmailStatus {
  verified: boolean;
  assessmentComplete: boolean;
  email: string;
  sender: string;
  resendAvailableAt: number;
  deliveryStatus: 'not_sent' | 'sending' | 'accepted' | 'unknown';
}
export async function getTutorEmailStatus(): Promise<TutorEmailStatus> {
  return (await client.get('/tutor/email-verification/')).data.data;
}
export async function sendTutorEmailConfirmation() {
  return (await client.post('/tutor/email-verification/send', undefined, { timeout: 90000 })).data.data;
}
export async function confirmTutorEmail(token: string) {
  return (await client.post('/tutor/email-verification/confirm', { token })).data.data;
}

import type { Socket } from 'socket.io-client';

export type ClassroomMediaToken = { token?: string; closesAt?: string; serverNow?: string; error?: string };

export function requestClassroomMediaToken(socket: Socket): Promise<ClassroomMediaToken> {
  return new Promise((resolve, reject) => {
    socket.timeout(40_000).emit('classroom:media-token', (timeout: Error | null, result: ClassroomMediaToken) => {
      if (timeout) { reject(new Error('Call access timed out. Please retry.')); return; }
      if (!result?.token || !result.closesAt || !result.serverNow || result.error) {
        reject(new Error(result?.error || 'Unable to obtain call access.')); return;
      }
      resolve(result);
    });
  });
}

export function classroomMediaLeaseRemaining(result: ClassroomMediaToken, elapsedMs: number) {
  // Use server time and monotonic elapsed time, not the user's wall clock.
  const remaining = Date.parse(result.closesAt || '') - Date.parse(result.serverNow || '') - elapsedMs;
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('This lesson call has ended.');
  return remaining;
}

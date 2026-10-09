import { expect, test } from 'bun:test';
import { requestClassroomMediaToken, classroomMediaLeaseRemaining } from '../src/utils/classroomMedia';

const token = { token: 'temporary-participant-token', serverNow: '2026-10-09T00:00:00Z', closesAt: '2026-10-09T00:25:00Z' };
function socket(result: unknown, timeout: Error | null = null) {
  return { timeout: (ms: number) => {
    expect(ms).toBe(40000);
    return { emit: (event: string, callback: Function) => {
      expect(event).toBe('classroom:media-token');
      callback(timeout, result);
    } };
  } } as any;
}

test('media token requests require the authorized socket acknowledgement', async () => {
  expect(await requestClassroomMediaToken(socket(token))).toEqual(token);
});
test('timeout and server rejection become visible call errors', async () => {
  await expect(requestClassroomMediaToken(socket(undefined, new Error('timeout')))).rejects.toThrow('timed out');
  await expect(requestClassroomMediaToken(socket({ error: 'Join an authorized classroom' }))).rejects.toThrow('authorized classroom');
});
test('missing token or server clock metadata fails closed', async () => {
  for (const result of [{}, { token: 'token' }, { token: 'token', closesAt: token.closesAt }])
    await expect(requestClassroomMediaToken(socket(result))).rejects.toThrow('Unable to obtain');
});
test('call lifetime uses server timestamps and subtracts SDK setup time', () => {
  expect(classroomMediaLeaseRemaining(token, 10000)).toBe(1490000);
});
test('invalid timestamps and expired leases fail closed', () => {
  expect(() => classroomMediaLeaseRemaining({ ...token, serverNow: 'invalid' }, 0)).toThrow();
  expect(() => classroomMediaLeaseRemaining(token, 1500000)).toThrow('ended');
});

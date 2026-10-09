import { expect, test } from 'bun:test';
import { classroomCallStatus as tutorStatus } from '../src/utils/classroomCallStatus';
import { classroomCallStatus as studentStatus } from '../../fluentxverse-student/src/utils/classroomCallStatus';

for (const [role, status] of [['tutor', tutorStatus], ['student', studentStatus]] as const) {
  const ready = {
    signalingConnected: true, localMediaReady: true, peerPresent: true,
    peerConnecting: false, peerConnected: false, remoteRole: role === 'tutor' ? 'student' as const : 'tutor' as const,
  };
  test(`${role}: working local devices do not imply a connected call or spin indefinitely`, () => {
    expect(status(ready)).toEqual({ state: 'waiting', message: `Ready. Waiting for ${ready.remoteRole} to connect...`, spinning: false });
    expect(status({ ...ready, peerPresent: false, peerConnecting: true }).state).toBe('waiting');
  });
  test(`${role}: an actual peer connection attempt is shown separately`, () => {
    expect(status({ ...ready, peerConnecting: true })).toEqual({ state: 'connecting', message: `Connecting to ${ready.remoteRole}...`, spinning: true });
  });
  test(`${role}: local device setup is distinguished from lesson signaling`, () => {
    expect(status({ ...ready, localMediaReady: false }).state).toBe('media');
    expect(status({ ...ready, localMediaReady: false, signalingConnected: false }).message).toBe('Connecting to lesson...');
    expect(status({ ...ready, signalingConnected: false }).message).toBe('Reconnecting to lesson...');
  });
  test(`${role}: connected calls remain connected when the camera is off or local media is unavailable`, () => {
    expect(status({ ...ready, peerConnected: true, localMediaReady: false })).toEqual({ state: 'connected', message: 'Connected', spinning: false });
  });
  test(`${role}: errors and signaling loss are never masked by connected media`, () => {
    expect(status({ ...ready, peerConnected: true, error: 'Permission denied' })).toEqual({ state: 'error', message: 'Permission denied', spinning: false });
    expect(status({ ...ready, peerConnected: true, signalingConnected: false }).state).toBe('joining');
  });
}

interface CallStatusInput {
  signalingConnected: boolean;
  localMediaReady: boolean;
  peerPresent: boolean;
  peerConnecting: boolean;
  peerConnected: boolean;
  remoteRole: 'student' | 'tutor';
  error?: string | null;
}

export function classroomCallStatus(input: CallStatusInput) {
  if (input.error) return { state: 'error', message: input.error, spinning: false };
  if (!input.signalingConnected) return { state: 'joining', message: input.localMediaReady ? 'Reconnecting to lesson...' : 'Connecting to lesson...', spinning: true };
  if (input.peerConnected) return { state: 'connected', message: 'Connected', spinning: false };
  if (!input.localMediaReady) return { state: 'media', message: 'Preparing your camera and microphone...', spinning: true };
  if (input.peerPresent && input.peerConnecting) return { state: 'connecting', message: `Connecting to ${input.remoteRole}...`, spinning: true };
  return { state: 'waiting', message: `Ready. Waiting for ${input.remoteRole} to connect...`, spinning: false };
}

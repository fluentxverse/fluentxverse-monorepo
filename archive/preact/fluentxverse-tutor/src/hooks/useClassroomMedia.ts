import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Socket } from 'socket.io-client';
import type RealtimeKitClient from '@cloudflare/realtimekit';
import { useWebRTC } from './useWebRTC';
import { requestClassroomMediaToken, classroomMediaLeaseRemaining } from '../utils/classroomMedia';

type MediaProvider = 'webrtc' | 'realtimekit';
type Devices = { audioDeviceId?: string; videoDeviceId?: string };
type Props = {
  provider?: MediaProvider;
  sessionId?: string;
  remoteUserId?: string;
  socket?: Socket | null;
  initiator?: boolean;
  enabled: boolean;
};


function streamFromParticipant(participant: {
  audioEnabled: boolean; videoEnabled: boolean;
  audioTrack?: MediaStreamTrack; videoTrack?: MediaStreamTrack;
}) {
  return new MediaStream([
    ...(participant.audioEnabled && participant.audioTrack?.readyState === 'live' ? [participant.audioTrack] : []),
    ...(participant.videoEnabled && participant.videoTrack?.readyState === 'live' ? [participant.videoTrack] : []),
  ]);
}

function useRealtimeKit({ provider, sessionId, socket, enabled }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meetingRef = useRef<RealtimeKitClient | null>(null);
  const desired = useRef({ audio: true, video: true, devices: {} as Devices });
  const disposeRef = useRef<() => void>(() => {});

  const cleanup = useCallback(() => disposeRef.current(), []);

  const syncLocal = useCallback(() => {
    const meeting = meetingRef.current;
    if (meeting) setLocalStream(streamFromParticipant(meeting.self));
  }, []);

  const applyDevices = useCallback(async (devices: Devices) => {
    desired.current.devices = devices;
    const self = meetingRef.current?.self;
    if (!self) return;
    if (devices.audioDeviceId) await self.setDevice(await self.getDeviceById(devices.audioDeviceId, 'audio'));
    if (devices.videoDeviceId) await self.setDevice(await self.getDeviceById(devices.videoDeviceId, 'video'));
    syncLocal();
  }, [syncLocal]);

  const startLocalStream = useCallback(async (_audio = true, _video = true, devices: Devices = {}) => {
    await applyDevices(devices);
  }, [applyDevices]);

  const controlQueue = useRef(Promise.resolve());
  const syncControls = useCallback(() => {
    const meeting = meetingRef.current;
    controlQueue.current = controlQueue.current.catch(() => {}).then(async () => {
      if (!meeting || meetingRef.current !== meeting || !meeting.self.roomJoined) return;
      const self = meeting.self;
      if (self.audioEnabled !== desired.current.audio)
        await (desired.current.audio ? self.enableAudio() : self.disableAudio());
      if (self.videoEnabled !== desired.current.video)
        await (desired.current.video ? self.enableVideo() : self.disableVideo());
      syncLocal();
    });
    return controlQueue.current;
  }, [syncLocal]);

  const toggleAudio = useCallback((value: boolean) => {
    desired.current.audio = value;
    void syncControls().catch(() => setError('Unable to update the microphone. Check device permissions.'));
  }, [syncControls]);

  const toggleVideo = useCallback((value: boolean) => {
    desired.current.video = value;
    void syncControls().catch(() => setError('Unable to update the camera. Check device permissions.'));
  }, [syncControls]);

  useEffect(() => {
    if (provider !== 'realtimekit' || !enabled || !sessionId || !socket) return;
    let cancelled = false;
    let meeting: RealtimeKitClient | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let unregister = () => {};
    const dispose = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(expiry);
      clearTimeout(retry);
      unregister();
      if (meetingRef.current === meeting) meetingRef.current = null;
      if (meeting) {
        const tracks = [meeting.self.audioTrack, meeting.self.videoTrack].filter(Boolean);
        void meeting.leave().catch(() => {}).finally(() => tracks.forEach(track => track.stop()));
      }
      setLocalStream(null);
      setRemoteStream(null);
      setConnected(false);
      setConnecting(false);
    };
    disposeRef.current = dispose;

    const connect = async (attempt = 0) => {
      setConnecting(true);
      setError(null);
      try {
        const credentials = await requestClassroomMediaToken(socket);
        const receivedAt = performance.now();
        if (cancelled) return;
        const { default: Client } = await import('@cloudflare/realtimekit');
        if (cancelled) return;
        const initialized = await Client.init({
          authToken: credentials.token!,
          defaults: { audio: false, video: false },
          onError: () => { if (!cancelled) setError('The lesson call encountered a connection error.'); },
        });
        if (cancelled) { await initialized.leave(); return; }
        meeting = initialized;
        meetingRef.current = meeting;
        // Existing video elements own playback, including mobile autoplay recovery.
        const sync = () => {
          if (cancelled || !meeting) return;
          syncLocal();
          const peer = meeting.participants.joined.toArray().find(participant => !participant.flags?.recorder && !participant.flags?.hiddenParticipant);
          setRemoteStream(peer ? streamFromParticipant(peer) : null);
          const transports = meeting.meta.mediaState;
          const connected = meeting.self.roomJoined && Boolean(peer)
            && meeting.meta.socketState.state === 'connected'
            && transports.send.state === 'connected' && transports.recv.state === 'connected';
          setConnected(connected);
          setConnecting(!connected);
          if (connected) setError(null);
        };
        const onLeft = () => { if (!cancelled) { setError('The lesson call has ended.'); dispose(); } };
        const onPermissionError = () => setError('Camera or microphone access was denied. Check browser permissions.');
        meeting.self.on('audioUpdate', sync);
        meeting.self.on('videoUpdate', sync);
        meeting.self.on('roomJoined', sync);
        meeting.self.on('roomLeft', onLeft);
        meeting.self.on('mediaPermissionError', onPermissionError);
        meeting.participants.joined.on('participantsUpdate', sync);
        meeting.participants.joined.on('audioUpdate', sync);
        meeting.participants.joined.on('videoUpdate', sync);
        meeting.meta.on('mediaConnectionUpdate', sync);
        meeting.meta.on('socketConnectionUpdate', sync);
        unregister = () => {
          if (!meeting) return;
          meeting.self.off('audioUpdate', sync);
          meeting.self.off('videoUpdate', sync);
          meeting.self.off('roomJoined', sync);
          meeting.self.off('roomLeft', onLeft);
          meeting.self.off('mediaPermissionError', onPermissionError);
          meeting.participants.joined.off('participantsUpdate', sync);
          meeting.participants.joined.off('audioUpdate', sync);
          meeting.participants.joined.off('videoUpdate', sync);
          meeting.meta.off('mediaConnectionUpdate', sync);
          meeting.meta.off('socketConnectionUpdate', sync);
        };
        const remaining = classroomMediaLeaseRemaining(credentials, performance.now() - receivedAt);
        expiry = setTimeout(dispose, remaining);
        await applyDevices(desired.current.devices);
        await meeting.join();
        if (cancelled) { await meeting.leave(); return; }
        await syncControls();
        sync();
      } catch {
        if (cancelled) return;
        unregister();
        if (meeting) await meeting.leave().catch(() => {});
        meeting = null;
        meetingRef.current = null;
        clearTimeout(expiry);
        setLocalStream(null);
        setRemoteStream(null);
        setConnected(false);
        setError('Unable to connect to the lesson call. Check your connection and device permissions.');
        if (attempt < 2) retry = setTimeout(() => void connect(attempt + 1), 3000 * (attempt + 1));
        else setConnecting(false);
      }
    };
    void connect();
    return dispose;
  }, [provider, sessionId, socket, enabled, syncLocal, applyDevices, syncControls]);

  return { localStream, remoteStream, isConnected, isConnecting, error, startLocalStream,
    toggleAudio, toggleVideo, switchMediaDevices: applyDevices, cleanup };
}

export function useClassroomMedia(props: Props) {
  const legacy = useWebRTC({ ...props, enabled: props.provider === 'webrtc' && props.enabled });
  const realtimekit = useRealtimeKit(props);
  const startLocalStream = useCallback(async (audio = true, video = true, devices: Devices = {}) => {
    if (props.provider === 'webrtc') return legacy.startLocalStream(audio, video, devices);
    if (props.provider === 'realtimekit') return realtimekit.startLocalStream(audio, video, devices);
  }, [props.provider, legacy.startLocalStream, realtimekit.startLocalStream]);
  const cleanup = useCallback(() => { legacy.cleanup(); realtimekit.cleanup(); }, [legacy.cleanup, realtimekit.cleanup]);
  const media = props.provider === 'realtimekit' ? realtimekit : legacy;
  return { ...media, startLocalStream, cleanup };
}

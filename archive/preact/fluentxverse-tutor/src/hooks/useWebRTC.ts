import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../client/socket/socket.client';

interface UseWebRTCProps {
  remoteUserId?: string;
  socket?: Socket | null;
  initiator?: boolean;
  enabled?: boolean;
}

interface MediaDeviceSelection {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

const buildAudioConstraints = (devices: MediaDeviceSelection): MediaTrackConstraints => ({
  ...(devices.audioDeviceId ? { deviceId: { exact: devices.audioDeviceId } } : {}),
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: false },
  channelCount: { ideal: 1 },
});

const findMediaTransceiver = (pc: RTCPeerConnection, kind: string) => {
  const matching = pc.getTransceivers().filter(transceiver =>
    transceiver.receiver.track.kind === kind || transceiver.sender.track?.kind === kind
  );
  return matching.find(transceiver => transceiver.mid !== null) || matching[0];
};

export const useWebRTC = ({ remoteUserId, socket, initiator = false, enabled = true }: UseWebRTCProps = {}) => {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(socket ?? null);
  const startingLocalStreamRef = useRef<Promise<MediaStream> | null>(null);
  const deviceSelectionRef = useRef<MediaDeviceSelection>({});
  const remoteUserIdRef = useRef<string | undefined>(remoteUserId);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const creatingConnectionRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const offerRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerReadyRef = useRef(false);
  const offeringRef = useRef(false);
  const answeringRef = useRef(false);
  const connectionGenerationRef = useRef(0);
  const mediaGenerationRef = useRef(0);

  useEffect(() => {
    socketRef.current = socket ?? null;
  }, [socket]);

  const getActiveSocket = useCallback(() => socketRef.current ?? getSocket(), []);

  const buildMediaConstraints = useCallback((
    audio = true,
    video = true,
    devices: MediaDeviceSelection = deviceSelectionRef.current
  ): MediaStreamConstraints => ({
    audio: audio ? buildAudioConstraints(devices) : false,
    video: video
      ? devices.videoDeviceId
        ? { deviceId: { exact: devices.videoDeviceId } }
        : true
      : false,
  }), []);

  const ensureMediaTransceivers = useCallback((pc: RTCPeerConnection) => {
    const ensureKind = (kind: 'audio' | 'video') => {
      const existing = findMediaTransceiver(pc, kind);

      if (existing) {
        if (existing.direction === 'inactive' || existing.direction === 'recvonly') {
          existing.direction = 'sendrecv';
        }
        return existing;
      }

      return pc.addTransceiver(kind, { direction: 'sendrecv' });
    };

    ensureKind('audio');
    ensureKind('video');
  }, []);

  const addLocalTracksToPeerConnection = useCallback(async (pc: RTCPeerConnection) => {
    ensureMediaTransceivers(pc);

    if (!localStreamRef.current) return;

    for (const track of localStreamRef.current.getTracks()) {
      const transceiver = findMediaTransceiver(pc, track.kind);

      if (transceiver) {
        if (transceiver.direction === 'inactive' || transceiver.direction === 'recvonly') {
          transceiver.direction = 'sendrecv';
        }

        const senderWithStreams = transceiver.sender as RTCRtpSender & {
          setStreams?: (...streams: MediaStream[]) => void;
        };
        senderWithStreams.setStreams?.(localStreamRef.current);

        if (transceiver.sender.track?.id !== track.id) {
          await transceiver.sender.replaceTrack(track);
        }
        continue;
      }

      const senderExists = pc.getSenders().some(sender => sender.track?.id === track.id);
      if (!senderExists) {
        pc.addTrack(track, localStreamRef.current);
      }
    }
  }, [ensureMediaTransceivers]);

  const resetPeerConnection = useCallback(() => {
    connectionGenerationRef.current++;
    if (offerRetryRef.current) clearTimeout(offerRetryRef.current);
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    offerRetryRef.current = null;
    disconnectTimerRef.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
    pendingCandidates.current = [];
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    const previousUserId = remoteUserIdRef.current;
    remoteUserIdRef.current = remoteUserId;
    if (previousUserId && remoteUserId && previousUserId !== remoteUserId) {
      resetPeerConnection();
    }
  }, [remoteUserId, resetPeerConnection]);

  const getIceConfiguration = useCallback(async (): Promise<RTCConfiguration> => {
    const fallback: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
    const activeSocket = getActiveSocket();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out loading call relay settings')), 10000);
      activeSocket.emit('webrtc:ice-config', (config: RTCConfiguration & { error?: string }) => {
        clearTimeout(timeout);
        if (config?.error) { reject(new Error(config.error)); return; }
        resolve(config?.iceServers?.length ? config : fallback);
      });
    });
  }, [getActiveSocket]);

  // Initialize peer connection
  const createPeerConnection = useCallback(async (): Promise<RTCPeerConnection> => {
    if (peerConnection.current) {
      return peerConnection.current;
    }
    if (creatingConnectionRef.current) return creatingConnectionRef.current;

    creatingConnectionRef.current = (async () => {
    setIsConnecting(true);
    const generation = connectionGenerationRef.current;
    const iceServers = await getIceConfiguration();
    if (generation !== connectionGenerationRef.current) throw new Error('Call setup was cancelled');

    const pc = new RTCPeerConnection(iceServers);
    // Answerers use the channels from the received offer, not pre-created unmatched channels.
    if (initiator) ensureMediaTransceivers(pc);

    // Handle ICE candidates - use ref to always have latest remoteUserId
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        try {
          const socket = getActiveSocket();
          socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            to: remoteUserIdRef.current
          });
        } catch (err) {
          console.error('Failed to send ICE candidate:', err);
        }
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
        return;
      }

      const stream = remoteStreamRef.current ?? new MediaStream();
      if (!stream.getTracks().some(track => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }
      remoteStreamRef.current = stream;
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (peerConnection.current !== pc) return;
      setIsConnected(pc.connectionState === 'connected');
      setIsConnecting(pc.connectionState === 'new' || pc.connectionState === 'connecting');
      
      if (pc.connectionState === 'connected') {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        setError(null);
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection failed or disconnected');
        if (initiator && remoteUserIdRef.current && !disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(async () => {
            disconnectTimerRef.current = null;
            if (peerConnection.current === pc &&
                (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
              try {
                const configuration = await getIceConfiguration();
                if (peerConnection.current !== pc) return;
                pc.setConfiguration(configuration);
                if (pc.signalingState === 'stable') pc.restartIce();
                else resetPeerConnection();
                void createOfferRef.current();
              } catch (err) {
                console.error('Failed to restart the call:', err);
                resetPeerConnection();
                void createOfferRef.current();
              }
            }
          }, pc.connectionState === 'failed' ? 0 : 3000);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (peerConnection.current !== pc || pc.connectionState !== 'connected') return;
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    };

    peerConnection.current = pc;
    return pc;
    })();
    try {
      return await creatingConnectionRef.current;
    } finally {
      creatingConnectionRef.current = null;
    }
  }, [ensureMediaTransceivers, getIceConfiguration, getActiveSocket, initiator, resetPeerConnection]);

  const createOfferRef = useRef<() => Promise<void>>(async () => {});

  // Get local media stream
  const startLocalStream = useCallback(async (audio = true, video = true, devices?: MediaDeviceSelection) => {
    if (devices) {
      deviceSelectionRef.current = devices;
    }

    // If we already have a stream, return it
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (startingLocalStreamRef.current) {
      return startingLocalStreamRef.current;
    }

    startingLocalStreamRef.current = (async () => {
      const generation = mediaGenerationRef.current;
      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints(audio, video));
        } catch (err: any) {
          if (!video) {
            throw err;
          }

          console.warn('Camera unavailable, retrying with microphone only:', err);
          stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints(audio, false));
          setError('Camera is unavailable. Joined with microphone only.');
        }
      
        if (generation !== mediaGenerationRef.current) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error('Media setup was cancelled');
        }
        setLocalStream(stream);
        localStreamRef.current = stream;

        if (initiator && peerReadyRef.current) void createOfferRef.current();

        return stream;
      } catch (err) {
        console.error('❌ Error accessing media devices:', err);
        setError('Failed to access camera or microphone');
        throw err;
      } finally {
        startingLocalStreamRef.current = null;
      }
    })();

    return startingLocalStreamRef.current;
  }, [buildMediaConstraints, initiator]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    if (!enabledRef.current) return;
    const targetUserId = remoteUserIdRef.current;
    if (!targetUserId) {
      console.error('❌ No remote user ID provided for offer');
      return;
    }
    if (offeringRef.current) return;

    offeringRef.current = true;
    try {
      const pc = await createPeerConnection();
      if (pc.connectionState === 'connected') return;
      await addLocalTracksToPeerConnection(pc);

      if (pc.signalingState === 'stable') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
      }
      if (pc.signalingState !== 'have-local-offer' || !pc.localDescription) return;

      const socket = getActiveSocket();
      const sendOffer = (attempt: number) => {
        if (peerConnection.current !== pc || pc.signalingState !== 'have-local-offer') return;
        socket.timeout(2500).emit('webrtc:offer', {
          offer: pc.localDescription,
          to: targetUserId
        }, (err: Error | null, result: { delivered: boolean }) => {
          if ((err || !result?.delivered) && attempt < 5 && peerConnection.current === pc) {
            offerRetryRef.current = setTimeout(() => sendOffer(attempt + 1), 1500);
          }
        });
      };
      sendOffer(0);

    } catch (err) {
      console.error('❌ Error creating offer:', err);
      setError('Failed to create offer');
    } finally {
      offeringRef.current = false;
    }
  }, [createPeerConnection, addLocalTracksToPeerConnection, getActiveSocket]);

  createOfferRef.current = createOffer;

  // Handle received offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
    if (!enabledRef.current || answeringRef.current) return;
    answeringRef.current = true;
    try {
      
      // Update remote user ID if we didn't know it
      if (!remoteUserIdRef.current) {
        remoteUserIdRef.current = fromUserId;
      }

      if (!localStreamRef.current) {
        try {
          await startLocalStream(true, true);
        } catch (err) {
          console.warn('Answering WebRTC offer without local media:', err);
        }
      }
      
      const pc = await createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await addLocalTracksToPeerConnection(pc);

      // Add any pending ICE candidates
      while (pendingCandidates.current.length > 0) {
        const candidate = pendingCandidates.current.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getActiveSocket();
      socket.emit('webrtc:answer', {
        answer,
        to: fromUserId
      });

    } catch (err) {
      console.error('❌ Error handling offer:', err);
      setError('Failed to handle offer');
    } finally {
      answeringRef.current = false;
    }
  }, [createPeerConnection, addLocalTracksToPeerConnection, getActiveSocket, startLocalStream]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnection.current;
      if (!pc) {
        console.error('❌ No peer connection for answer');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Add any pending ICE candidates
      while (pendingCandidates.current.length > 0) {
        const candidate = pendingCandidates.current.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
        }
      }
      
    } catch (err) {
      console.error('❌ Error handling answer:', err);
      setError('Failed to handle answer');
    }
  }, []);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnection.current;
      if (!pc || !pc.remoteDescription) {
        // Queue the candidate if we don't have a remote description yet
        pendingCandidates.current.push(new RTCIceCandidate(candidate));
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('❌ Error handling ICE candidate:', err);
    }
  }, []);

  const switchMediaDevices = useCallback(async (devices: MediaDeviceSelection) => {
    deviceSelectionRef.current = devices;

    const previousStream = localStreamRef.current;
    const shouldKeepVideo = Boolean(previousStream?.getVideoTracks().some(track => track.readyState === 'live'));

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        buildMediaConstraints(true, shouldKeepVideo, devices)
      );

      localStreamRef.current = stream;
      setLocalStream(stream);

      if (!enabledRef.current) { previousStream?.getTracks().forEach(track => track.stop()); return; }
      const pc = await createPeerConnection();
      await addLocalTracksToPeerConnection(pc);

      for (const kind of ['audio', 'video'] as const) {
        const hasTrack = stream.getTracks().some(track => track.kind === kind);
        if (hasTrack) continue;

        const transceiver = findMediaTransceiver(pc, kind);
        await transceiver?.sender.replaceTrack(null);
      }

      previousStream?.getTracks().forEach(track => track.stop());

      if (initiator && pc.signalingState === 'stable' && remoteUserIdRef.current) {
        await createOffer();
      }
    } catch (err) {
      console.error('❌ Error switching media devices:', err);
      setError('Failed to switch camera or microphone');
      throw err;
    }
  }, [addLocalTracksToPeerConnection, buildMediaConstraints, createOffer, createPeerConnection, initiator]);

  // Toggle audio
  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async (enabled: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const pc = peerConnection.current;
    const videoTransceiver = pc ? findMediaTransceiver(pc, 'video') : undefined;

    if (!enabled) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
        track.stop();
        stream.removeTrack(track);
      });

      await videoTransceiver?.sender.replaceTrack(null);
      setLocalStream(new MediaStream(stream.getTracks()));
      if (initiator && pc?.signalingState === 'stable' && remoteUserIdRef.current) {
        await createOffer();
      }
      return;
    }

    let videoTrack = stream.getVideoTracks().find(track => track.readyState === 'live');
    if (!videoTrack) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints(false, true));
        videoTrack = videoStream.getVideoTracks()[0];
        stream.addTrack(videoTrack);
      } catch (err) {
        console.error('❌ Error enabling camera:', err);
        setError('Failed to access camera');
        return;
      }
    } else {
      videoTrack.enabled = true;
    }

    if (pc && videoTrack) {
      await addLocalTracksToPeerConnection(pc);
    }

    setLocalStream(new MediaStream(stream.getTracks()));
    if (initiator && pc?.signalingState === 'stable' && remoteUserIdRef.current) {
      await createOffer();
    }
  }, [addLocalTracksToPeerConnection, buildMediaConstraints, createOffer, initiator]);

  // Cleanup
  const cleanup = useCallback(() => {
    mediaGenerationRef.current++;
    peerReadyRef.current = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    startingLocalStreamRef.current = null;

    resetPeerConnection();

    setLocalStream(null);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
    setError(null);
  }, [resetPeerConnection]);

  // Setup Socket.IO listeners
  useEffect(() => {
    if (!enabled) { resetPeerConnection(); return; }
    try {
      const activeSocket = getActiveSocket();

      const onOffer = ({ offer, from }: any) => {
        handleOffer(offer, from);
      };

      const onAnswer = ({ answer }: any) => {
        handleAnswer(answer);
      };

      const onIceCandidate = ({ candidate }: any) => {
        handleIceCandidate(candidate);
      };

      const onPeerLeft = () => {
        resetPeerConnection();
      };

      const onDisconnect = () => resetPeerConnection();
      const onPeerReady = ({ from }: { from: string }) => {
        if (!initiator || from !== remoteUserIdRef.current) return;
        peerReadyRef.current = true;
        if (localStreamRef.current) void createOfferRef.current();
      };

      activeSocket.on('webrtc:offer', onOffer);
      activeSocket.on('webrtc:answer', onAnswer);
      activeSocket.on('webrtc:ice-candidate', onIceCandidate);
      activeSocket.on('webrtc:peer-left', onPeerLeft);
      activeSocket.on('disconnect', onDisconnect);
      activeSocket.on('webrtc:ready', onPeerReady);

      return () => {
        activeSocket.off('webrtc:offer', onOffer);
        activeSocket.off('webrtc:answer', onAnswer);
        activeSocket.off('webrtc:ice-candidate', onIceCandidate);
        activeSocket.off('webrtc:peer-left', onPeerLeft);
        activeSocket.off('disconnect', onDisconnect);
        activeSocket.off('webrtc:ready', onPeerReady);
      };
    } catch (err) {
      // Socket will be initialized by the parent component
    }
  }, [socket, getActiveSocket, handleOffer, handleAnswer, handleIceCandidate, resetPeerConnection, initiator, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    isConnected,
    isConnecting,
    error,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    switchMediaDevices,
    cleanup
  };
};

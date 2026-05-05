import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../client/socket/socket.client';

interface UseWebRTCProps {
  remoteUserId?: string;
  socket?: Socket | null;
}

export const useWebRTC = ({ remoteUserId, socket }: UseWebRTCProps = {}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(socket ?? null);
  const startingLocalStreamRef = useRef<Promise<MediaStream> | null>(null);
  const remoteUserIdRef = useRef<string | undefined>(remoteUserId);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  useEffect(() => {
    socketRef.current = socket ?? null;
  }, [socket]);

  const getActiveSocket = useCallback(() => socketRef.current ?? getSocket(), []);

  const ensureMediaTransceivers = useCallback((pc: RTCPeerConnection) => {
    const ensureKind = (kind: 'audio' | 'video') => {
      const existing = pc.getTransceivers().find(transceiver =>
        transceiver.receiver.track.kind === kind || transceiver.sender.track?.kind === kind
      );

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
      const transceiver = pc.getTransceivers().find(item =>
        item.receiver.track.kind === track.kind || item.sender.track?.kind === track.kind
      );

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

  // Keep remoteUserIdRef in sync and reset connection if remote user changes
  useEffect(() => {
    const previousUserId = remoteUserIdRef.current;
    remoteUserIdRef.current = remoteUserId;
    
    // If remote user ID changed and we had a connection, reset it
    if (previousUserId && remoteUserId && previousUserId !== remoteUserId) {
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      pendingCandidates.current = [];
      remoteStreamRef.current = null;
      setRemoteStream(null);
      setIsConnected(false);
    }
  }, [remoteUserId]);

  // ICE server configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      return peerConnection.current;
    }

    const pc = new RTCPeerConnection(iceServers);
    ensureMediaTransceivers(pc);

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
      setIsConnected(pc.connectionState === 'connected');
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection failed or disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
    };

    peerConnection.current = pc;
    return pc;
  }, [ensureMediaTransceivers, getActiveSocket]);

  // Get local media stream
  const startLocalStream = useCallback(async (audio = true, video = true) => {
    // If we already have a stream, return it
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (startingLocalStreamRef.current) {
      return startingLocalStreamRef.current;
    }

    startingLocalStreamRef.current = (async () => {
      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio, video });
        } catch (err: any) {
          if (!video) {
            throw err;
          }

          console.warn('Camera unavailable, retrying with microphone only:', err);
          stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
          setError('Camera is unavailable. Joined with microphone only.');
        }
      
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Add tracks to peer connection
        const pc = createPeerConnection();
        await addLocalTracksToPeerConnection(pc);

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
  }, [createPeerConnection, addLocalTracksToPeerConnection]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    const targetUserId = remoteUserIdRef.current;
    if (!targetUserId) {
      console.error('❌ No remote user ID provided for offer');
      return;
    }

    try {
      const pc = createPeerConnection();
      await addLocalTracksToPeerConnection(pc);
      
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getActiveSocket();
      socket.emit('webrtc:offer', {
        offer,
        to: targetUserId
      });

    } catch (err) {
      console.error('❌ Error creating offer:', err);
      setError('Failed to create offer');
    }
  }, [createPeerConnection, addLocalTracksToPeerConnection, getActiveSocket]);

  // Handle received offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
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
      
      const pc = createPeerConnection();
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
    const videoTransceiver = pc?.getTransceivers().find(transceiver =>
      transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video'
    );

    if (!enabled) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
        track.stop();
        stream.removeTrack(track);
      });

      await videoTransceiver?.sender.replaceTrack(null);
      setLocalStream(new MediaStream(stream.getTracks()));
      if (pc?.signalingState === 'stable' && remoteUserIdRef.current) {
        await createOffer();
      }
      return;
    }

    let videoTrack = stream.getVideoTracks().find(track => track.readyState === 'live');
    if (!videoTrack) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    if (pc?.signalingState === 'stable' && remoteUserIdRef.current) {
      await createOffer();
    }
  }, [addLocalTracksToPeerConnection, createOffer]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    startingLocalStreamRef.current = null;

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setLocalStream(null);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
    setError(null);
  }, []);

  // Setup Socket.IO listeners
  useEffect(() => {
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
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setIsConnected(false);
      };

      activeSocket.on('webrtc:offer', onOffer);
      activeSocket.on('webrtc:answer', onAnswer);
      activeSocket.on('webrtc:ice-candidate', onIceCandidate);
      activeSocket.on('webrtc:peer-left', onPeerLeft);

      return () => {
        activeSocket.off('webrtc:offer', onOffer);
        activeSocket.off('webrtc:answer', onAnswer);
        activeSocket.off('webrtc:ice-candidate', onIceCandidate);
        activeSocket.off('webrtc:peer-left', onPeerLeft);
      };
    } catch (err) {
      // Socket will be initialized by the parent component
    }
  }, [socket, getActiveSocket, handleOffer, handleAnswer, handleIceCandidate]);

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
    error,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    cleanup
  };
};

import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { getSocket } from '../client/socket/socket.client';

interface UseWebRTCProps {
  remoteUserId?: string;
}

export const useWebRTC = ({ remoteUserId }: UseWebRTCProps = {}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteUserIdRef = useRef<string | undefined>(remoteUserId);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  // Keep remoteUserIdRef in sync and reset connection if remote user changes
  useEffect(() => {
    const previousUserId = remoteUserIdRef.current;
    remoteUserIdRef.current = remoteUserId;
    
    // If remote user ID changed and we had a connection, reset it
    if (previousUserId && remoteUserId && previousUserId !== remoteUserId) {
      console.log('🔄 Remote user ID changed from', previousUserId, 'to', remoteUserId, '- resetting peer connection');
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      pendingCandidates.current = [];
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

    console.log('🔗 Creating new peer connection');
    const pc = new RTCPeerConnection(iceServers);

    // Handle ICE candidates - use ref to always have latest remoteUserId
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        try {
          const socket = getSocket();
          socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            to: remoteUserIdRef.current
          });
          console.log('🧊 Sent ICE candidate to:', remoteUserIdRef.current);
        } catch (err) {
          console.error('Failed to send ICE candidate:', err);
        }
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📺 Received remote track:', event.track.kind, {
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        id: event.track.id
      });
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('📺 Remote stream received:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().map(t => ({ 
            enabled: t.enabled, 
            muted: t.muted, 
            readyState: t.readyState 
          })),
          audioTracks: stream.getAudioTracks().map(t => ({ 
            enabled: t.enabled, 
            muted: t.muted, 
            readyState: t.readyState 
          }))
        });
        setRemoteStream(stream);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection failed or disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
    };

    peerConnection.current = pc;
    return pc;
  }, []);

  // Get local media stream
  const startLocalStream = useCallback(async (audio = true, video = true) => {
    // If we already have a stream, return it
    if (localStreamRef.current) {
      console.log('🎥 Returning existing local stream');
      return localStreamRef.current;
    }

    try {
      console.log('🎥 Requesting local media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      console.log('🎥 Got local media stream with tracks:', stream.getTracks().map(t => t.kind).join(', '));
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Add tracks to peer connection
      const pc = createPeerConnection();
      stream.getTracks().forEach(track => {
        console.log('➕ Adding track to peer connection:', track.kind);
        pc.addTrack(track, stream);
      });

      return stream;
    } catch (err) {
      console.error('❌ Error accessing media devices:', err);
      setError('Failed to access camera or microphone');
      throw err;
    }
  }, [createPeerConnection]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    const targetUserId = remoteUserIdRef.current;
    if (!targetUserId) {
      console.error('❌ No remote user ID provided for offer');
      return;
    }

    try {
      const pc = createPeerConnection();
      console.log('📤 Creating offer for:', targetUserId);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('webrtc:offer', {
        offer,
        to: targetUserId
      });

      console.log('✅ Offer sent to:', targetUserId);
    } catch (err) {
      console.error('❌ Error creating offer:', err);
      setError('Failed to create offer');
    }
  }, [createPeerConnection]);

  // Handle received offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
    try {
      console.log('📥 Handling offer from:', fromUserId);
      
      // Update remote user ID if we didn't know it
      if (!remoteUserIdRef.current) {
        remoteUserIdRef.current = fromUserId;
      }
      
      const pc = createPeerConnection();
      
      // Ensure local tracks are added to the peer connection
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        const existingTrackKinds = senders.map(s => s.track?.kind).filter(Boolean);
        
        localStreamRef.current.getTracks().forEach(track => {
          if (!existingTrackKinds.includes(track.kind)) {
            console.log('➕ Adding local track before answering:', track.kind);
            pc.addTrack(track, localStreamRef.current!);
          }
        });
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Add any pending ICE candidates
      while (pendingCandidates.current.length > 0) {
        const candidate = pendingCandidates.current.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
          console.log('🧊 Added pending ICE candidate');
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket.emit('webrtc:answer', {
        answer,
        to: fromUserId
      });

      console.log('✅ Answer sent to:', fromUserId);
    } catch (err) {
      console.error('❌ Error handling offer:', err);
      setError('Failed to handle offer');
    }
  }, [createPeerConnection]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnection.current;
      if (!pc) {
        console.error('❌ No peer connection for answer');
        return;
      }

      console.log('📥 Setting remote description from answer');
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Add any pending ICE candidates
      while (pendingCandidates.current.length > 0) {
        const candidate = pendingCandidates.current.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
          console.log('🧊 Added pending ICE candidate');
        }
      }
      
      console.log('✅ Answer received and set');
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
        console.log('🧊 Queuing ICE candidate (no remote description yet)');
        pendingCandidates.current.push(new RTCIceCandidate(candidate));
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('🧊 ICE candidate added');
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
  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setError(null);
  }, []);

  // Setup Socket.IO listeners
  useEffect(() => {
    try {
      const socket = getSocket();

      socket.on('webrtc:offer', ({ offer, from }) => {
        console.log('📥 Received offer from:', from);
        handleOffer(offer, from);
      });

      socket.on('webrtc:answer', ({ answer, from }) => {
        console.log('📥 Received answer from:', from);
        handleAnswer(answer);
      });

      socket.on('webrtc:ice-candidate', ({ candidate, from }) => {
        console.log('🧊 Received ICE candidate from:', from);
        handleIceCandidate(candidate);
      });

      socket.on('webrtc:peer-left', () => {
        console.log('👋 Peer left');
        setRemoteStream(null);
        setIsConnected(false);
      });

      return () => {
        socket.off('webrtc:offer');
        socket.off('webrtc:answer');
        socket.off('webrtc:ice-candidate');
        socket.off('webrtc:peer-left');
      };
    } catch (err) {
      console.warn('Socket not initialized yet for WebRTC listeners:', err);
      // Socket will be initialized by the parent component
    }
  }, [handleOffer, handleAnswer, handleIceCandidate]);

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

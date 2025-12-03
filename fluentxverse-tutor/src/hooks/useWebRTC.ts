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

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        const socket = getSocket();
        socket.emit('webrtc:ice-candidate', {
          candidate: event.candidate,
          to: remoteUserId
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      setRemoteStream(event.streams[0]);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection failed or disconnected');
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [remoteUserId]);

  // Get local media stream
  const startLocalStream = useCallback(async (audio = true, video = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Add tracks to peer connection
      const pc = createPeerConnection();
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera or microphone');
      throw err;
    }
  }, [createPeerConnection]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    if (!remoteUserId) {
      console.error('No remote user ID provided');
      return;
    }

    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('webrtc:offer', {
        offer,
        to: remoteUserId
      });

      console.log('Offer sent to:', remoteUserId);
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create offer');
    }
  }, [remoteUserId, createPeerConnection]);

  // Handle received offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (remoteUserId) {
        const socket = getSocket();
        socket.emit('webrtc:answer', {
          answer,
          to: remoteUserId
        });
      }

      console.log('Answer sent');
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Failed to handle offer');
    }
  }, [remoteUserId, createPeerConnection]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnection.current;
      if (!pc) {
        console.error('No peer connection');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Answer received and set');
    } catch (err) {
      console.error('Error handling answer:', err);
      setError('Failed to handle answer');
    }
  }, []);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    try {
      const pc = peerConnection.current;
      if (!pc) {
        console.error('No peer connection');
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added');
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
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
        console.log('Received offer from:', from);
        handleOffer(offer);
      });

      socket.on('webrtc:answer', ({ answer, from }) => {
        console.log('Received answer from:', from);
        handleAnswer(answer);
      });

      socket.on('webrtc:ice-candidate', ({ candidate, from }) => {
        console.log('Received ICE candidate from:', from);
        handleIceCandidate(candidate);
      });

      socket.on('webrtc:peer-left', () => {
        console.log('Peer left');
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

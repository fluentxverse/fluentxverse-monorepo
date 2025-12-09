import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { getSocket, connectSocket, initSocket } from '../client/socket/socket.client';
import './InterviewRoomPage.css';

interface InterviewRoomProps {
  interviewId?: string;
}

const InterviewRoomPage = ({ interviewId }: InterviewRoomProps) => {
  const { user } = useAuthContext();
  
  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pre-call setup states
  const [setupComplete, setSetupComplete] = useState(false);
  const [deviceTestPassed, setDeviceTestPassed] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  
  // Call states
  const [callDuration, setCallDuration] = useState(0);
  const [waitingForAdmin, setWaitingForAdmin] = useState(false);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const roomIdRef = useRef<string>(`interview-${interviewId || 'default'}`);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Get available devices and auto-start preview
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permissions and get initial stream
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Set initial stream for preview
        localStreamRef.current = initialStream;
        setLocalStream(initialStream);
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        setCameras(videoDevices);
        setMics(audioDevices);
        
        if (videoDevices.length > 0) setSelectedCamera(videoDevices[0].deviceId);
        if (audioDevices.length > 0) setSelectedMic(audioDevices[0].deviceId);
        
        // Mark devices as tested since we have a working stream
        setDeviceTestPassed(true);
      } catch (err) {
        console.error('Error getting devices:', err);
        setError('Could not access camera or microphone. Please check permissions.');
      }
    };
    
    getDevices();
  }, []);

  // Start local preview stream
  const startPreview = async () => {
    try {
      // Stop any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Use setTimeout to ensure the video element is rendered
      setTimeout(() => {
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log('Auto-play prevented:', e));
        }
      }, 100);
      
      setDeviceTestPassed(true);
      setError(null);
    } catch (err) {
      console.error('Error starting preview:', err);
      setError('Failed to start camera preview. Please check your device permissions.');
      setDeviceTestPassed(false);
    }
  };

  // Stop preview stream
  const stopPreview = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  // Create peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit('interview:ice-candidate', {
          roomId: roomIdRef.current,
          candidate: event.candidate
        });
      }
    };
    
    pc.ontrack = (event) => {
      console.log('📺 Remote track received');
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');
      
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        setWaitingForAdmin(false);
        setError(null);
        startCallTimer();
      }
      
      if (pc.connectionState === 'failed') {
        setError('Connection failed. The video call could not be established. Please check your network and try again.');
        stopCallTimer();
        setIsConnecting(false);
      }
      
      if (pc.connectionState === 'disconnected') {
        setError('Connection lost. Attempting to reconnect...');
      }
      
      if (pc.connectionState === 'closed') {
        setError(null);
        stopCallTimer();
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        setError('Network connection failed. Please check your firewall settings or try a different network.');
      }
    };
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    peerConnectionRef.current = pc;
    return pc;
  };

  // Join interview room
  const joinRoom = async () => {
    if (!localStreamRef.current) {
      setError('Please test your devices first');
      return;
    }
    
    setIsConnecting(true);
    setWaitingForAdmin(true);
    
    try {
      // Initialize socket if needed
      const token = user ? JSON.stringify({
        userId: user.userId,
        email: user.email,
        tier: 2
      }) : undefined;
      
      initSocket(token);
      connectSocket();
      
      const socket = getSocket();
      const pc = createPeerConnection();
      
      // Join the interview room
      socket.emit('interview:join', {
        roomId: roomIdRef.current,
        odIuser: user?.userId,
        role: 'tutor'
      });
      
      // Listen for admin joining
      socket.on('interview:admin-joined', async () => {
        console.log('Admin joined, creating offer...');
        setWaitingForAdmin(false);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        socket.emit('interview:offer', {
          roomId: roomIdRef.current,
          offer
        });
      });
      
      // Listen for answer
      socket.on('interview:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
        console.log('Received answer');
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      });
      
      // Listen for ICE candidates
      socket.on('interview:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });
      
      // Listen for call ended
      socket.on('interview:ended', () => {
        handleEndCall();
      });
      
      setSetupComplete(true);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join interview room');
      setIsConnecting(false);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Call timer
  const startCallTimer = () => {
    callTimerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // End call
  const handleEndCall = () => {
    stopCallTimer();
    stopPreview();
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setIsConnected(false);
    setRemoteStream(null);
    
    // Redirect back to interview booking
    window.location.href = '/interview';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallTimer();
      stopPreview();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Sync video element with stream when localStream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Auto-play prevented:', e));
    }
  }, [localStream]);

  // Re-attach stream when transitioning to call view (DOM element changes)
  useEffect(() => {
    if (setupComplete && localStream && localVideoRef.current) {
      setTimeout(() => {
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(e => console.log('Auto-play prevented:', e));
        }
      }, 100);
    }
  }, [setupComplete, localStream]);

  // Device change handler
  useEffect(() => {
    if (deviceTestPassed && localStream) {
      stopPreview();
      startPreview();
    }
  }, [selectedCamera, selectedMic]);

  return (
    <div className="interview-room">
      {!setupComplete ? (
        // Pre-call Setup Screen
        <div className="interview-setup">
          <div className="setup-container">
            <div className="setup-header">
              <div className="setup-icon">
                <i className="ri-video-chat-line"></i>
              </div>
              <h1>Interview Room Setup</h1>
              <p>Test your camera and microphone before joining</p>
            </div>

            {error && (
              <div className="setup-error">
                <i className="ri-error-warning-line"></i>
                {error}
              </div>
            )}

            <div className="setup-content">
              {/* Video Preview */}
              <div className="video-preview-container">
                <div className="video-preview">
                  {localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="video-placeholder">
                      <i className="ri-camera-line"></i>
                      <p>Camera preview will appear here</p>
                    </div>
                  )}
                </div>
                
                {deviceTestPassed && (
                  <div className="device-status success">
                    <i className="ri-check-line"></i>
                    Devices working correctly
                  </div>
                )}
              </div>

              {/* Device Selection */}
              <div className="device-selection">
                <div className="device-group">
                  <label>
                    <i className="ri-camera-line"></i>
                    Camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera((e.target as HTMLSelectElement).value)}
                  >
                    {cameras.map(camera => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="device-group">
                  <label>
                    <i className="ri-mic-line"></i>
                    Microphone
                  </label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic((e.target as HTMLSelectElement).value)}
                  >
                    {mics.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mics.indexOf(mic) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn-test-devices" onClick={startPreview}>
                  <i className="ri-refresh-line"></i>
                  Test Devices
                </button>
              </div>
            </div>

            {/* Setup Actions */}
            <div className="setup-actions">
              <button className="btn-back" onClick={() => window.location.href = '/interview'}>
                <i className="ri-arrow-left-line"></i>
                Back
              </button>
              <button
                className="btn-join"
                onClick={joinRoom}
                disabled={!deviceTestPassed || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <i className="ri-loader-4-line ri-spin"></i>
                    Connecting...
                  </>
                ) : (
                  <>
                    <i className="ri-video-chat-line"></i>
                    Join Interview
                  </>
                )}
              </button>
            </div>

            {/* Tips */}
            <div className="setup-tips">
              <h4><i className="ri-lightbulb-line"></i> Tips for a great interview</h4>
              <ul>
                <li>Find a quiet, well-lit room</li>
                <li>Use headphones to reduce echo</li>
                <li>Close other apps using your camera</li>
                <li>Have a stable internet connection</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        // Active Call Screen
        <div className="interview-call">
          {/* Call Header */}
          <div className="call-header">
            <div className="call-info">
              <span className="call-status">
                {isConnected ? (
                  <><i className="ri-record-circle-fill live"></i> Live</>
                ) : waitingForAdmin ? (
                  <><i className="ri-time-line"></i> Waiting for interviewer...</>
                ) : (
                  <><i className="ri-loader-4-line ri-spin"></i> Connecting...</>
                )}
              </span>
              {isConnected && (
                <span className="call-duration">{formatDuration(callDuration)}</span>
              )}
            </div>
            <div className="call-title">
              <i className="ri-video-chat-line"></i>
              Speaking Interview
            </div>
          </div>

          {/* Video Grid */}
          <div className="video-grid">
            {/* Remote Video (Admin/Interviewer) */}
            <div className="video-container remote">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                />
              ) : (
                <div className="video-placeholder">
                  <div className="avatar-placeholder">
                    <i className="ri-user-line"></i>
                  </div>
                  <p>{waitingForAdmin ? 'Waiting for interviewer...' : 'Connecting...'}</p>
                </div>
              )}
              <div className="video-label">Interviewer</div>
            </div>

            {/* Local Video (Self) */}
            <div className="video-container local">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
              />
              {!isVideoEnabled && (
                <div className="video-off-overlay">
                  <i className="ri-camera-off-line"></i>
                </div>
              )}
              <div className="video-label">You</div>
            </div>
          </div>

          {/* Call Controls */}
          <div className="call-controls">
            <button
              className={`control-btn ${!isAudioEnabled ? 'off' : ''}`}
              onClick={toggleAudio}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              <i className={isAudioEnabled ? 'ri-mic-line' : 'ri-mic-off-line'}></i>
            </button>
            
            <button
              className={`control-btn ${!isVideoEnabled ? 'off' : ''}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <i className={isVideoEnabled ? 'ri-camera-line' : 'ri-camera-off-line'}></i>
            </button>
            
            <button
              className="control-btn end-call"
              onClick={handleEndCall}
              title="Leave interview"
            >
              <i className="ri-phone-line"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoomPage;

import { useState, useEffect, useRef } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import './InterviewRoomPage.css';

interface InterviewRoomPageProps {
  interviewId?: string;
  tutorId?: string;
  tutorName?: string;
}

interface RubricScores {
  grammar: number;
  fluency: number;
  pronunciation: number;
  vocabulary: number;
  professionalism: number;
}

interface TimestampNote {
  time: string;
  note: string;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

const InterviewRoomPage = ({ interviewId, tutorId, tutorName }: InterviewRoomPageProps) => {
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
  const [tutorConnected, setTutorConnected] = useState(false);
  
  // Notes & Rubric state
  const [notes, setNotes] = useState<string>('');
  const [timestampNotes, setTimestampNotes] = useState<TimestampNote[]>([]);
  const [rubricScores, setRubricScores] = useState<RubricScores>({
    grammar: 3,
    fluency: 3,
    pronunciation: 3,
    vocabulary: 3,
    professionalism: 3
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const roomIdRef = useRef<string>(`interview-${interviewId || 'default'}`);
  const autoSaveTimerRef = useRef<number | null>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Format current time for timestamps
  const formatCurrentTime = () => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add timestamp note
  const addTimestampNote = () => {
    if (notes.trim()) {
      const newNote: TimestampNote = {
        time: formatCurrentTime(),
        note: notes.trim()
      };
      setTimestampNotes(prev => [...prev, newNote]);
      setNotes('');
    }
  };

  // Update rubric score
  const updateRubricScore = (category: keyof RubricScores, score: number) => {
    setRubricScores(prev => ({ ...prev, [category]: score }));
  };

  // Calculate average score
  const calculateAverageScore = () => {
    const scores = Object.values(rubricScores);
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  // Auto-save to localStorage
  useEffect(() => {
    if (setupComplete && interviewId) {
      const saveData = {
        notes,
        timestampNotes,
        rubricScores,
        callDuration
      };
      localStorage.setItem(`interview-${interviewId}`, JSON.stringify(saveData));
      setLastSaved(new Date().toLocaleTimeString());
    }
  }, [notes, timestampNotes, rubricScores, setupComplete, interviewId]);

  // Load saved data on mount
  useEffect(() => {
    if (interviewId) {
      const saved = localStorage.getItem(`interview-${interviewId}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.notes) setNotes(data.notes);
          if (data.timestampNotes) setTimestampNotes(data.timestampNotes);
          if (data.rubricScores) setRubricScores(data.rubricScores);
        } catch (e) {
          console.error('Failed to load saved data:', e);
        }
      }
    }
  }, [interviewId]);

  // Submit interview result (pass/fail)
  const submitResult = async (result: 'pass' | 'fail') => {
    if (!interviewId || !tutorId) {
      setError('Missing interview or tutor information');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/interview/result', {
        slotId: interviewId,
        tutorId: tutorId,
        result,
        rubricScores,
        notes: timestampNotes.map(t => `[${t.time}] ${t.note}`).join('\n') + (notes ? `\n[Final] ${notes}` : ''),
        timestamps: timestampNotes
      });

      setResultSubmitted(true);
      localStorage.removeItem(`interview-${interviewId}`);
      
      // Show success and redirect
      setTimeout(() => {
        window.location.href = '/applications';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit result');
    } finally {
      setIsSaving(false);
    }
  };

  // Get available devices and auto-start preview
  useEffect(() => {
    const getDevices = async () => {
      try {
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = initialStream;
        setLocalStream(initialStream);
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        setCameras(videoDevices);
        setMics(audioDevices);
        
        if (videoDevices.length > 0) setSelectedCamera(videoDevices[0].deviceId);
        if (audioDevices.length > 0) setSelectedMic(audioDevices[0].deviceId);
        setDeviceTestPassed(true);
      } catch (err) {
        console.error('Error getting devices:', err);
        setError('Could not access camera or microphone. Please check permissions.');
      }
    };
    
    getDevices();
  }, []);

  // Sync video element with stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Auto-play prevented:', e));
    }
  }, [localStream]);

  // Sync remote video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Remote auto-play prevented:', e));
    }
  }, [remoteStream]);

  const startPreview = async () => {
    try {
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

  const stopPreview = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('interview:ice-candidate', {
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
        setTutorConnected(true);
        startCallTimer();
      }
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection lost. Please try rejoining.');
        stopCallTimer();
      }
    };
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    peerConnectionRef.current = pc;
    return pc;
  };

  const joinRoom = async () => {
    if (!localStreamRef.current) {
      setError('Please test your devices first');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8767', {
        transports: ['websocket'],
        auth: { token: 'admin-interview' }
      });
      
      socketRef.current = socket;
      const pc = createPeerConnection();
      
      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('interview:join', {
          roomId: roomIdRef.current,
          odIuser: 'admin',
          role: 'admin'
        });
      });
      
      socket.on('interview:tutor-joined', async () => {
        console.log('Tutor joined the room');
        setTutorConnected(true);
      });
      
      socket.on('interview:offer', async (data: { offer: RTCSessionDescriptionInit }) => {
        console.log('Received offer from tutor');
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('interview:answer', {
          roomId: roomIdRef.current,
          answer
        });
      });
      
      socket.on('interview:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });
      
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

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

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

  const handleEndCall = () => {
    stopCallTimer();
    
    if (socketRef.current) {
      socketRef.current.emit('interview:end', { roomId: roomIdRef.current });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setIsConnected(false);
    setRemoteStream(null);
    setTutorConnected(false);
  };

  useEffect(() => {
    return () => {
      stopCallTimer();
      stopPreview();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (deviceTestPassed && localStream && (selectedCamera || selectedMic)) {
      // Only restart if selection actually changed
    }
  }, [selectedCamera, selectedMic]);

  // Rubric category labels
  const rubricCategories = [
    { key: 'grammar', label: 'Grammar & Accuracy', icon: 'ri-text' },
    { key: 'fluency', label: 'Fluency & Flow', icon: 'ri-speed-line' },
    { key: 'pronunciation', label: 'Pronunciation', icon: 'ri-volume-up-line' },
    { key: 'vocabulary', label: 'Vocabulary Range', icon: 'ri-book-open-line' },
    { key: 'professionalism', label: 'Professionalism', icon: 'ri-user-star-line' }
  ];

  return (
    <div className="interview-room">
      {resultSubmitted ? (
        <div className="result-submitted">
          <div className="result-card">
            <div className="result-icon success">
              <i className="ri-checkbox-circle-fill"></i>
            </div>
            <h2>Interview Result Submitted!</h2>
            <p>Redirecting to applications...</p>
          </div>
        </div>
      ) : !setupComplete ? (
        <div className="interview-setup">
          <div className="setup-container">
            <div className="setup-header">
              <div className="setup-icon">
                <i className="ri-video-chat-line"></i>
              </div>
              <h1>Interview Room</h1>
              <p>Prepare to conduct the interview{tutorName ? ` with ${tutorName}` : ''}</p>
            </div>

            {error && (
              <div className="setup-error">
                <i className="ri-error-warning-line"></i>
                {error}
              </div>
            )}

            <div className="setup-content">
              <div className="video-preview-container">
                <div className="video-preview">
                  {localStream ? (
                    <video ref={localVideoRef} autoPlay muted playsInline />
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

              <div className="device-selection">
                <div className="device-group">
                  <label><i className="ri-camera-line"></i> Camera</label>
                  <select value={selectedCamera} onChange={(e) => setSelectedCamera((e.target as HTMLSelectElement).value)}>
                    {cameras.map(camera => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="device-group">
                  <label><i className="ri-mic-line"></i> Microphone</label>
                  <select value={selectedMic} onChange={(e) => setSelectedMic((e.target as HTMLSelectElement).value)}>
                    {mics.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mics.indexOf(mic) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn-test-devices" onClick={startPreview}>
                  <i className="ri-refresh-line"></i> Test Devices
                </button>
              </div>
            </div>

            <div className="setup-actions">
              <button className="btn-back" onClick={() => window.location.href = '/interviews'}>
                <i className="ri-arrow-left-line"></i> Back
              </button>
              <button className="btn-join" onClick={joinRoom} disabled={!deviceTestPassed || isConnecting}>
                {isConnecting ? (
                  <><i className="ri-loader-4-line ri-spin"></i> Connecting...</>
                ) : (
                  <><i className="ri-video-chat-line"></i> Start Interview</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="interview-call">
          <div className="call-header">
            <div className="call-info">
              <span className="call-status">
                {isConnected ? (
                  <><i className="ri-record-circle-fill live"></i> Live</>
                ) : tutorConnected ? (
                  <><i className="ri-loader-4-line ri-spin"></i> Connecting...</>
                ) : (
                  <><i className="ri-time-line"></i> Waiting for candidate...</>
                )}
              </span>
              {(isConnected || callDuration > 0) && (
                <span className="call-duration">{formatDuration(callDuration)}</span>
              )}
            </div>
            <div className="call-title">
              <i className="ri-video-chat-line"></i>
              Speaking Interview {tutorName && <span className="candidate-name">- {tutorName}</span>}
            </div>
            {lastSaved && (
              <div className="auto-save-indicator">
                <i className="ri-save-line"></i> Auto-saved {lastSaved}
              </div>
            )}
          </div>

          <div className="call-body">
            <div className="video-section">
              <div className="video-grid">
                <div className="video-container remote">
                  {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline />
                  ) : (
                    <div className="video-placeholder">
                      <div className="avatar-placeholder">
                        <i className="ri-user-line"></i>
                      </div>
                      <p>{tutorConnected ? 'Connecting video...' : 'Waiting for candidate to join...'}</p>
                    </div>
                  )}
                  <div className="video-label">Candidate</div>
                </div>

                <div className="video-container local">
                  <video ref={localVideoRef} autoPlay muted playsInline />
                  {!isVideoEnabled && (
                    <div className="video-off-overlay">
                      <i className="ri-camera-off-line"></i>
                    </div>
                  )}
                  <div className="video-label">You (Interviewer)</div>
                </div>
              </div>

              <div className="call-controls">
                <button className={`control-btn ${!isAudioEnabled ? 'off' : ''}`} onClick={toggleAudio} title={isAudioEnabled ? 'Mute' : 'Unmute'}>
                  <i className={isAudioEnabled ? 'ri-mic-line' : 'ri-mic-off-line'}></i>
                </button>
                <button className={`control-btn ${!isVideoEnabled ? 'off' : ''}`} onClick={toggleVideo} title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
                  <i className={isVideoEnabled ? 'ri-camera-line' : 'ri-camera-off-line'}></i>
                </button>
                <button className="control-btn end-call" onClick={handleEndCall} title="End interview">
                  <i className="ri-phone-line"></i>
                </button>
              </div>
            </div>

            <div className="notes-section">
              <div className="notes-header">
                <h3><i className="ri-file-text-line"></i> Interview Notes</h3>
              </div>

              {/* Rubric Scoring */}
              <div className="rubric-section">
                <h4><i className="ri-star-line"></i> Evaluation Rubric</h4>
                <div className="rubric-grid">
                  {rubricCategories.map(({ key, label, icon }) => (
                    <div key={key} className="rubric-item">
                      <div className="rubric-label">
                        <i className={icon}></i>
                        <span>{label}</span>
                      </div>
                      <div className="rubric-scores">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            className={`score-btn ${rubricScores[key as keyof RubricScores] === score ? 'active' : ''}`}
                            onClick={() => updateRubricScore(key as keyof RubricScores, score)}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rubric-average">
                  <span>Average Score:</span>
                  <strong>{calculateAverageScore()}/5</strong>
                </div>
              </div>

              {/* Timestamp Notes */}
              <div className="timestamp-section">
                <h4><i className="ri-time-line"></i> Timestamped Notes</h4>
                <div className="timestamp-notes-list">
                  {timestampNotes.map((note, index) => (
                    <div key={index} className="timestamp-note">
                      <span className="timestamp">[{note.time}]</span>
                      <span className="note-text">{note.note}</span>
                    </div>
                  ))}
                </div>
                <div className="note-input-area">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
                    placeholder="Type a note and press Add to timestamp it..."
                    rows={3}
                  />
                  <button className="btn-add-note" onClick={addTimestampNote} disabled={!notes.trim()}>
                    <i className="ri-add-line"></i> Add [{formatCurrentTime()}]
                  </button>
                </div>
              </div>

              {/* Pass/Fail Buttons */}
              <div className="result-section">
                <h4><i className="ri-checkbox-circle-line"></i> Interview Result</h4>
                <div className="result-buttons">
                  <button 
                    className="btn-result btn-pass"
                    onClick={() => submitResult('pass')}
                    disabled={isSaving}
                  >
                    <i className="ri-checkbox-circle-fill"></i>
                    {isSaving ? 'Submitting...' : 'Pass'}
                  </button>
                  <button 
                    className="btn-result btn-fail"
                    onClick={() => submitResult('fail')}
                    disabled={isSaving}
                  >
                    <i className="ri-close-circle-fill"></i>
                    {isSaving ? 'Submitting...' : 'Fail'}
                  </button>
                </div>
                <p className="result-hint">
                  <i className="ri-information-line"></i>
                  Submitting will end the interview and save all notes & scores
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="call-error">
              <i className="ri-error-warning-line"></i>
              {error}
              <button onClick={() => setError(null)}><i className="ri-close-line"></i></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InterviewRoomPage;

import { useState, useRef, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket } from '../client/socket/socket.client';
import { useWebRTC } from '../hooks/useWebRTC';
import './ClassroomPage.css';

interface ClassroomPageProps {
  sessionId?: string;
}

interface ChatMessage {
  id: string;
  sender: 'tutor' | 'student';
  text: string;
  timestamp: string;
  correction?: string;
}

interface LessonSection {
  id: string;
  type: 'dialogue' | 'trivia' | 'practice';
  title: string;
  content: any;
}

const ClassroomPage = ({ sessionId }: ClassroomPageProps) => {
  useEffect(() => {
    document.title = 'Classroom | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const { route } = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localPipRef = useRef<HTMLVideoElement>(null);
  const remotePipRef = useRef<HTMLVideoElement>(null);
  
  // Extract sessionId from router params first, then pathname as fallback
  const routeSessionId = (route as any)?.params?.sessionId as string | undefined;
  const querySessionId = (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('sessionId') || undefined;
    } catch {
      return undefined;
    }
  })();
  const currentSessionId = sessionId || routeSessionId || querySessionId || window.location.pathname.split('/classroom/')[1]?.split('?')[0];
  
  // Initialize socket immediately
  useEffect(() => {
    if (currentSessionId) {
      console.log('🔌 [Classroom] Initializing socket...');
      initSocket();
      connectSocket();
    }
  }, [currentSessionId]);
  
  // State
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeMaterialSection, setActiveMaterialSection] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [tutorInfo, setTutorInfo] = useState<{ name: string; id: string; initials: string; date: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);

  // WebRTC Hook
  const {
    localStream,
    remoteStream,
    isConnected,
    error: webrtcError,
    startLocalStream,
    toggleAudio,
    toggleVideo,
    cleanup
  } = useWebRTC({ remoteUserId: tutorInfo?.id });

  // Mock student data (will be replaced with real data)
  const studentData = {
    name: 'Student',
    initials: 'ST',
    sessionTime: '10:00AM - 10:25AM',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  };

  // Mock chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'student',
      text: 'No, because I like to meeting new people.',
      timestamp: '10:01 AM',
      correction: 'No, because I like to meet new people.'
    },
    {
      id: '2',
      sender: 'tutor',
      text: 'Humorous [hyoo-mer-uhs]',
      timestamp: '10:02 AM'
    },
    {
      id: '3',
      sender: 'student',
      text: 'They are humorous because they like speaking jokes.',
      timestamp: '10:03 AM',
      correction: 'They are humorous because they like telling jokes.'
    }
  ]);

  // Mock lesson material sections
  const lessonSections: LessonSection[] = [
    {
      id: '1',
      type: 'dialogue',
      title: 'UNDERSTAND',
      content: {
        dialogue: [
          { speaker: 'Sofia', text: 'Oh, good! What are they like?' },
          { speaker: 'Haru', text: "His mom's so friendly. She talked to me a lot and even cooked her special pasta for me." },
          { speaker: 'Sofia', text: 'She sounds like a nice lady. What about his dad?' },
          { speaker: 'Haru', text: "Oh, he's really funny. He told jokes all night." }
        ],
        instructions: [
          'Transition to the next part',
          '"Great! Let\'s go to the next part!"'
        ]
      }
    },
    {
      id: '2',
      type: 'trivia',
      title: 'TRIVIA (1 minute)',
      content: {
        explanation: 'The word funny has two meanings in English. It can mean humorous or strange. To show the positive meaning of funny, you can use it with so or really. To show the negative meaning, you can use funny with a bit or a little.',
        examples: [
          { text: "He's really funny.", meaning: '(humorous)' },
          { text: "He's a little funny.", meaning: '(strange)' }
        ],
        instructions: [
          'Introduce the Trivia',
          '"Let\'s look at the Trivia."',
          'Read the trivia.',
          'Confirm the student\'s understanding.',
          '"Is it clear?"',
          'Ask the question below:',
          'Do you have any funny friends? Are they humorous funny or strange funny?'
        ]
      }
    },
    {
      id: '3',
      type: 'practice',
      title: 'PRACTICE - STEP A (2 minutes)',
      content: {
        instruction: 'Choose the most polite answer in the parentheses. Strengthen the positive traits and soften the negative traits.',
        exercises: [
          { id: 1, text: 'Robin is (a bit / so) negative. She complains a lot.' },
          { id: 2, text: 'My date was (a little / really) funny. I laughed all night.' },
          { id: 3, text: 'The bus driver seems (a bit / so) friendly. He always smiles at everyone.' }
        ],
        tutorInstructions: [
          'Introduce Practice',
          '"Okay, now let\'s do Practice."',
          '"We\'re going to practice the grammar tip we read earlier."',
          '"First we have Step A."',
          'Read the instructions.'
        ]
      }
    }
  ];

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Socket.IO and join session
  useEffect(() => {
    if (!currentSessionId) {
      console.error('No session ID provided');
      return;
    }

    const socket = getSocket();

    // Join the session room
    socket.emit('session:join', { sessionId: currentSessionId });
    console.log('🎓 Student joining session:', currentSessionId);

    // Listen for tutor joining
    socket.on('session:user-joined', ({ userId, userType }) => {
      console.log(`👥 User joined: ${userType} - ${userId}`);
      if (userType === 'tutor') {
        setTutorInfo({ id: userId, name: 'Tutor', initials: 'TT', date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) });
        setIsConnecting(false);
      }
    });

    // Listen for student leaving
    socket.on('session:user-left', ({ userType }) => {
      console.log(`👋 User left: ${userType}`);
      if (userType === 'student') {
        setStudentInfo(null);
      }
    });

    // Listen for session state
    socket.on('session:state', (state) => {
      console.log('📊 Session state:', state);
      if (state.participants.studentId) {
        setStudentInfo({ id: state.participants.studentId, name: 'Student', initials: 'ST', date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) });
        setIsConnecting(false);
      }
    });

    return () => {
      socket.emit('session:leave');
      socket.off('session:user-joined');
      socket.off('session:user-left');
      socket.off('session:state');
    };
  }, [currentSessionId]);

  // Start local media as soon as page loads on student side
  useEffect(() => {
    startLocalStream(true, true).catch(() => {});
  }, [startLocalStream]);

  // Start local media when component mounts
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        console.log('🎥 [Classroom] Starting local media stream...');
        console.log('🎥 [Classroom] startLocalStream function:', typeof startLocalStream);
        await startLocalStream(true, true);
        console.log('🎥 [Classroom] Local media stream started successfully');
      } catch (err) {
        console.error('❌ [Classroom] Failed to start media:', err);
      }
    };

    initWebRTC();
  }, [startLocalStream]);

  // Attach local stream to video element
  useEffect(() => {
    console.log('📹 [Classroom] Local stream state:', localStream ? 'EXISTS' : 'NULL');
    console.log('📹 [Classroom] Local video ref:', localVideoRef.current ? 'EXISTS' : 'NULL');
    if (localStream && localVideoRef.current) {
      console.log('📹 [Classroom] Attaching local stream to video element');
      localVideoRef.current.srcObject = localStream;
      // Ensure the video plays
      localVideoRef.current.play().catch(err => {
        console.error('❌ [Classroom] Error playing local video:', err);
      });
      console.log('📹 [Classroom] Local stream attached successfully');
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Ensure the video plays
      remoteVideoRef.current.play().catch(err => {
        console.error('❌ [Classroom] Error playing remote video:', err);
      });
      console.log('📺 Remote stream attached');
    }
  }, [remoteStream]);
  // Detect local speaking using Web Audio API
  useEffect(() => {
    if (!localStream) return;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(localStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);

    let rafId: number;
    const threshold = 40; // simple energy threshold
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      // compute average energy
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      setIsSpeakingLocal(avg > threshold);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      try { source.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      try { audioCtx.close(); } catch {}
    };
  }, [localStream]);

  // Re-attach correct streams when swapping views
  useEffect(() => {
    if (isSwapped) {
      // Remote should be in main; local in PiP
      if (remoteStream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (localStream && localPipRef.current) {
        localPipRef.current.srcObject = localStream;
        localPipRef.current.play().catch(() => {});
      }
    } else {
      // Local should be in main; remote in PiP
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
      if (remoteStream && remotePipRef.current) {
        remotePipRef.current.srcObject = remoteStream;
        remotePipRef.current.play().catch(() => {});
      }
    }
  }, [isSwapped, localStream, remoteStream]);

  // Handle audio/video toggles
  useEffect(() => {
    toggleAudio(!isMuted);
  }, [isMuted, toggleAudio]);

  useEffect(() => {
    toggleVideo(!isVideoOff);
  }, [isVideoOff, toggleVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'tutor',
      text: message,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
    setChatMessages(prev => [...prev, newMsg]);
    setMessage('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLeaveClassroom = () => {
    if (confirm('Are you sure you want to leave the classroom?')) {
      cleanup();
      getSocket().emit('session:leave');
      route('/schedule');
    }
  };

  return (
    <div className="classroom-container">
      {/* Left Panel - Video & Chat */}
      <div className="classroom-left">
        {/* Header Bar */}
        <div className="classroom-header">
          <div className="classroom-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" style={{ height: '32px' }} />
            <span>FluentXVerse</span>
          </div>
          <div className="classroom-session-info">
            <div className="session-time-display">
              <span className="timer">{formatTime(elapsedTime)}</span>
              <span className="session-date">{studentData.date}</span>
            </div>
          </div>
        </div>

        {/* Video Area */}
        <div className="video-section">
          {/* Main Video */}
          <div className="video-main">
            {/* Connection Status overlay inside video */}
            {isConnecting && (
              <div className="connection-status overlay-top">
                <div className="spinner"></div>
                <p>Waiting for tutor to join...</p>
              </div>
            )}
            {isSwapped ? (
              // Student (remote) in main
              remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              ) : (
                <div className="video-placeholder student-video">
                  <div className="video-avatar-large">{studentData.initials}</div>
                  <span className="video-name">{studentData.name}</span>
                  {!isConnected && studentInfo && <span className="connection-text">Connecting...</span>}
                </div>
              )
            ) : (
              // Student (local) in main
              <>
                <video 
                  ref={localVideoRef} 
                  muted 
                  autoPlay 
                  playsInline 
                  className="local-video" 
                  style={{ display: isVideoOff ? 'none' : 'block' }}
                />
                {/* Speaking indicator bottom-left when local is main */}
                {!isVideoOff && (
                  <div className={`mic-indicator mic-large ${isSpeakingLocal ? 'active' : ''}`}> 
                    <div className="mic-dot" />
                  </div>
                )}
                {isVideoOff && (
                  <div className="video-placeholder tutor-video">
                    <div className="video-avatar-large">
                      {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                    </div>
                    <span className="video-name">{user?.firstName || 'Tutor'}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Picture-in-Picture (click to show tutor in main) */}
          <div className="video-pip" onClick={() => setIsSwapped(false)} title="Show tutor in main">
            {isSwapped ? (
              // Tutor (local) in PiP
              <>
                <video 
                  muted 
                  autoPlay 
                  playsInline 
                  className="local-video-small" 
                  style={{ display: isVideoOff ? 'none' : 'block' }}
                  ref={localPipRef}
                />
                {/* Speaking indicator bottom-left for PiP when local is PiP */}
                {!isVideoOff && (
                  <div className={`mic-indicator ${isSpeakingLocal ? 'active' : ''}`}>
                    <div className="mic-dot" />
                  </div>
                )}
                {isVideoOff && (
                  <div className="video-placeholder tutor-video">
                    <div className="video-avatar-small">
                      {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Student (remote) in PiP
              remoteStream ? (
                <video autoPlay playsInline className="remote-video-small" ref={remotePipRef} />
              ) : (
                <div className="video-placeholder student-video">
                  <div className="video-avatar-small">{studentData.initials}</div>
                </div>
              )
            )}
          </div>

          {/* Video Controls */}
          <div className="video-controls">
            <button
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={() => setIsMuted(prev => !prev)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>
            <button
              className={`control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={() => setIsVideoOff(prev => !prev)}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              )}
            </button>
            <button className="control-btn end-call" onClick={handleLeaveClassroom} title="Leave classroom">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                <line x1="23" y1="1" x2="1" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-header">
            <i className="fi fi-sr-comment-alt"></i>
            <span>Chat</span>
          </div>
          <div className="chat-messages">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender}`}>
                {msg.correction && (
                  <div className="message-correction">
                    <span className="label">You said:</span> {msg.text}
                    <br />
                    <span className="label">Correct:</span> {msg.correction}
                  </div>
                )}
                {!msg.correction && (
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                )}
                <span className="message-time">{msg.timestamp}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Enter your message here"
              value={message}
              onChange={(e) => setMessage((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="send-btn" onClick={handleSendMessage}>
              <i className="fi fi-sr-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Learning Materials */}
      <div className="classroom-right">
        {/* Material Navigation */}
        <div className="material-nav">
          {lessonSections.map((section, idx) => (
            <button
              key={section.id}
              className={`material-nav-btn ${activeMaterialSection === idx ? 'active' : ''}`}
              onClick={() => setActiveMaterialSection(idx)}
            >
              <span className="nav-number">{idx + 1}</span>
              <span className="nav-label">{section.type.toUpperCase()}</span>
            </button>
          ))}
        </div>

        {/* Material Content */}
        <div className="material-content">
          {lessonSections[activeMaterialSection].type === 'dialogue' && (
            <div className="material-dialogue">
              <h3 className="material-title">{lessonSections[activeMaterialSection].title}</h3>
              <div className="dialogue-box">
                {lessonSections[activeMaterialSection].content.dialogue.map((line: any, idx: number) => (
                  <div key={idx} className="dialogue-line">
                    <span className="speaker">{line.speaker}:</span>
                    <span className="text">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lessonSections[activeMaterialSection].type === 'trivia' && (
            <div className="material-trivia">
              <h3 className="material-title">
                <i className="fi fi-sr-lightbulb-on"></i>
                {lessonSections[activeMaterialSection].title}
              </h3>
              <div className="trivia-box">
                <p className="trivia-explanation">
                  {lessonSections[activeMaterialSection].content.explanation}
                </p>
                <div className="trivia-examples">
                  {lessonSections[activeMaterialSection].content.examples.map((ex: any, idx: number) => (
                    <div key={idx} className="example-item">
                      <span className="example-marker">○</span>
                      <span className="example-text">{ex.text}</span>
                      <span className="example-meaning">{ex.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {lessonSections[activeMaterialSection].type === 'practice' && (
            <div className="material-practice">
              <h3 className="material-title">
                <i className="fi fi-sr-pencil"></i>
                {lessonSections[activeMaterialSection].title}
              </h3>
              <div className="practice-box">
                <p className="practice-instruction">
                  {lessonSections[activeMaterialSection].content.instruction}
                </p>
                <div className="practice-exercises">
                  {lessonSections[activeMaterialSection].content.exercises.map((ex: any) => (
                    <div key={ex.id} className="exercise-item">
                      <span className="exercise-number">{ex.id}.</span>
                      <span className="exercise-text">{ex.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tutor Instructions Sidebar */}
        <div className="tutor-instructions">
          <h4 className="instructions-title">
            {lessonSections[activeMaterialSection].type.toUpperCase()}
          </h4>
          <div className="instructions-list">
            {(lessonSections[activeMaterialSection].content.instructions ||
              lessonSections[activeMaterialSection].content.tutorInstructions)?.map((inst: string, idx: number) => (
              <div key={idx} className={`instruction-item ${inst.startsWith('"') ? 'quote' : ''}`}>
                {inst.startsWith('"') ? (
                  <span className="instruction-quote">{inst}</span>
                ) : (
                  <>
                    <span className="instruction-number">{idx + 1}</span>
                    <span className="instruction-text">{inst}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <button className="next-section-btn" onClick={() => setActiveMaterialSection(prev => Math.min(prev + 1, lessonSections.length - 1))}>
            <span>Next Section</span>
            <i className="fi fi-sr-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomPage;

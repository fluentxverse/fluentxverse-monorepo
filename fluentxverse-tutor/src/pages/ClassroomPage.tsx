import { useState, useRef, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import './ClassroomPage.css';

interface ClassroomPageProps {
  studentId?: string;
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

const ClassroomPage = ({ studentId }: ClassroomPageProps) => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // RMS scaled 0-100
  const [micSpeaking, setMicSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<any>(null);
  const speakingFramesRef = useRef(0);
  const isMutedRef = useRef(false);
  const [activeMaterialSection, setActiveMaterialSection] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false); // swap main vs PiP

  // Mock student data
  const studentData = {
    name: 'Maria Santos',
    initials: 'MS',
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
      route(`/student/${studentId || 'STD001'}`);
    }
  };

  // Initialize local media (audio + video)
  useEffect(() => {
    let rafId: number;
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        // Attach video
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        // Audio analyser
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray: any = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        const tick = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          let sumSquares = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            const v = (dataArrayRef.current[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / dataArrayRef.current.length);
          const scaled = rms * 100;
          setMicLevel(scaled);
          const threshold = 2; // lowered for better sensitivity
          if (!isMutedRef.current && scaled > threshold) {
            speakingFramesRef.current = Math.min(speakingFramesRef.current + 2, 12);
          } else {
            speakingFramesRef.current = Math.max(speakingFramesRef.current - 1, 0);
          }
          setMicSpeaking(speakingFramesRef.current >= 2);
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } catch (err: any) {
        setMediaError(err?.message || 'Failed to access camera/microphone');
      }
    };
    init();
    return () => {
      cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  // Handle mute toggle (update track enable state)
  useEffect(() => {
    isMutedRef.current = isMuted;
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  // Handle video toggle
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoOff;
    });
  }, [isVideoOff]);

  // Reattach stream to video element when camera turned back on or swap changes
  useEffect(() => {
    if (isVideoOff) return; // only act when camera is on
    const stream = streamRef.current;
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    // If track ended (rare on enable/disable), reacquire
    if (tracks.length === 0 || tracks[0].readyState === 'ended') {
      (async () => {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Preserve existing audio if any
          if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            audioTracks.forEach(t => newStream.addTrack(t));
          }
          streamRef.current = newStream;
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.play().catch(() => {});
          }
        } catch (e) {
          // Ignore; mediaError already handled elsewhere
        }
      })();
      return;
    }
    // Normal case: just re-bind stream to new video element after remount/swap
    // Use setTimeout to ensure video element is mounted after swap
    setTimeout(() => {
      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }, 0);
  }, [isVideoOff, isSwapped]);

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
            <div className="session-student">
              <div className="student-avatar-small">{studentData.initials}</div>
              <span>{studentData.name}</span>
            </div>
            <div className="session-time-display">
              <span className="timer">{formatTime(elapsedTime)}</span>
              <span className="session-date">{studentData.date}</span>
            </div>
          </div>
        </div>

        {/* Video Area (Swapped: tutor/user main, student PiP) */}
        <div className="video-section">
          {/* Main Video */}
          <div className="video-main">
            {isSwapped ? (
              // Student in main
              <div className="video-placeholder student-video">
                <div className="video-avatar-large">{studentData.initials}</div>
                <span className="video-name">{studentData.name}</span>
              </div>
            ) : (
              // Tutor/User in main
              (!isVideoOff && !mediaError) ? (
                <div className="local-video-full">
                  <video ref={videoRef} muted playsInline className="local-video" />
                  <div className={`mic-indicator mic-large ${micSpeaking ? 'active' : ''}`}
                    title={isMuted ? 'Muted' : micSpeaking ? 'Speaking' : 'Idle'}>
                    <span className="mic-dot" />
                  </div>
                </div>
              ) : (
                <div className="video-placeholder tutor-video">
                  <div className="video-avatar-large">
                    {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                  </div>
                  <span className="video-name">{user?.firstName || 'Tutor'}</span>
                  {mediaError && <span className="media-error-text">Media blocked</span>}
                </div>
              )
            )}
          </div>

          {/* Picture-in-Picture (click to swap) */}
          <div className="video-pip" onClick={() => setIsSwapped(prev => !prev)} title="Click to swap">
            {isSwapped ? (
              // Tutor/User in PiP
              (!isVideoOff && !mediaError) ? (
                <div className="local-video-wrapper">
                  <video ref={!isSwapped ? undefined : videoRef} muted playsInline className="local-video" />
                  <div className={`mic-indicator ${micSpeaking ? 'active' : ''}`}
                    title={isMuted ? 'Muted' : micSpeaking ? 'Speaking' : 'Idle'}>
                    <span className="mic-dot" />
                  </div>
                </div>
              ) : (
                <div className="video-placeholder tutor-video">
                  <div className="video-avatar-small">
                    {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                  </div>
                </div>
              )
            ) : (
              // Student in PiP
              <div className="video-placeholder student-video">
                <div className="video-avatar-small">{studentData.initials}</div>
              </div>
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

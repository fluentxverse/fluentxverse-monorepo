import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import './StudentProfilePage.css';

interface StudentProfilePageProps {
  studentId?: string;
}

interface LessonNote {
  date: string;
  time: string;
  note: string;
  rating: number;
}

const StudentProfilePage = ({ studentId }: StudentProfilePageProps) => {
  useEffect(() => {
    document.title = 'Student Profile | FluentXVerse';
  }, []);

interface Session {
  id: string;
  date: string;
  time: string;
  status: 'completed' | 'upcoming' | 'cancelled';
  topic: string;
  rating?: number;
}

const StudentProfilePage = ({ studentId }: StudentProfilePageProps) => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'notes' | 'materials'>('overview');
  const [showHeadsetModal, setShowHeadsetModal] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micLevel, setMicLevel] = useState(0);
  const [isPlayingLeft, setIsPlayingLeft] = useState(false);
  const [isPlayingRight, setIsPlayingRight] = useState(false);
  const [camPermission, setCamPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const openHeadsetModal = async () => {
    setShowHeadsetModal(true);
    try {
      // Request audio and video permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermission('granted');
      
      // Set up audio analysis for mic level
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Start monitoring mic level
      const updateMicLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setMicLevel(Math.min(100, average * 1.5));
        }
        animationFrameRef.current = requestAnimationFrame(updateMicLevel);
      };
      updateMicLevel();
    } catch (err) {
      setMicPermission('denied');
    }

    // Camera permission and setup
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      cameraStreamRef.current = cam;
      setCamPermission('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = cam;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setCamPermission('denied');
    }
  };

  const closeHeadsetModal = () => {
    setShowHeadsetModal(false);
    setMicPermission('pending');
    setMicLevel(0);
    setCamPermission('pending');
    
    // Clean up
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const playTestSound = (channel: 'left' | 'right') => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panner = ctx.createStereoPanner();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = channel === 'left' ? 440 : 880;
    panner.pan.value = channel === 'left' ? -1 : 1;
    gainNode.gain.value = 0.3;
    
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(ctx.destination);
    
    if (channel === 'left') setIsPlayingLeft(true);
    else setIsPlayingRight(true);
    
    oscillator.start();
    oscillator.stop(ctx.currentTime + 1);
    
    setTimeout(() => {
      if (channel === 'left') setIsPlayingLeft(false);
      else setIsPlayingRight(false);
      ctx.close();
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Mock student data - replace with API call
  const studentData = {
    id: studentId || 'STD001',
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    initials: 'MS',
    level: 'Intermediate',
    nationality: 'Philippines',
    joinDate: 'Jan 15, 2025',
    totalLessons: 48,
    attendance: 96,
    averageRating: 4.8,
    goals: 'Improve business English communication and presentation skills',
    interests: 'Technology, Travel, Business',
    timezone: 'GMT+8 (Philippine Time)',
    preferredTopics: ['Business English', 'Conversation', 'Pronunciation']
  };

  const upcomingSessions: Session[] = [
    { id: '1', date: 'Nov 26, 2025', time: '7:00 PM', status: 'upcoming', topic: 'Business Presentations' },
    { id: '2', date: 'Nov 27, 2025', time: '8:00 PM', status: 'upcoming', topic: 'Email Writing' },
    { id: '3', date: 'Nov 28, 2025', time: '7:30 PM', status: 'upcoming', topic: 'Conversation Practice' }
  ];

  const pastSessions: Session[] = [
    { id: '4', date: 'Nov 24, 2025', time: '7:00 PM', status: 'completed', topic: 'Job Interviews', rating: 5 },
    { id: '5', date: 'Nov 23, 2025', time: '8:00 PM', status: 'completed', topic: 'Business Vocabulary', rating: 5 },
    { id: '6', date: 'Nov 22, 2025', time: '7:30 PM', status: 'completed', topic: 'Presentation Skills', rating: 4 }
  ];

  const lessonNotes: LessonNote[] = [
    {
      date: 'Nov 24, 2025',
      time: '7:00 PM',
      note: 'Excellent progress with interview vocabulary. Student showed confidence in role-play exercises. Focus on reducing filler words ("um", "like") in next session.',
      rating: 5
    },
    {
      date: 'Nov 23, 2025',
      time: '8:00 PM',
      note: 'Good understanding of business terminology. Practiced negotiation phrases. Recommend more practice with formal email writing.',
      rating: 5
    },
    {
      date: 'Nov 22, 2025',
      time: '7:30 PM',
      note: 'Strong presentation delivery. Voice projection improved. Continue working on transition phrases between slides.',
      rating: 4
    }
  ];

  return (
    <div className="student-profile-page">
      <SideBar />
      
      <div className="student-profile-content">
        <Header />
        
        <div className="student-profile-main">
          {/* Back Button */}
          <button className="back-button" onClick={() => route('/schedule')}>
            <i className="fi fi-sr-arrow-left"></i>
            Back to Schedule
          </button>

          {/* Profile Header Card */}
          <div className="profile-header-card">
            <div className="profile-header-content">
              {/* Profile Photo */}
              <div className="profile-photo-container">
                <div className="profile-avatar">
                  {studentData.initials}
                </div>
                <div className="profile-level-badge">
                  {studentData.level}
                </div>
              </div>

              {/* Profile Info */}
              <div className="profile-info">
                <div className="profile-name-row">
                  <h1 className="profile-name">{studentData.name}</h1>
                  <span className="profile-id-badge">{studentData.id}</span>
                </div>

                <div className="contact-info-grid">
                  <div className="contact-info-item">
                    <i className="fi fi-sr-envelope"></i>
                    <span>{studentData.email}</span>
                  </div>
                  <div className="contact-info-item">
                    <i className="fi fi-sr-globe"></i>
                    <span>{studentData.nationality}</span>
                  </div>
                  <div className="contact-info-item">
                    <i className="fi fi-sr-calendar"></i>
                    <span>Joined {studentData.joinDate}</span>
                  </div>
                  <div className="contact-info-item">
                    <i className="fi fi-sr-clock"></i>
                    <span>{studentData.timezone}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="stats-container">
                  <div className="stat-card blue">
                    <div className="stat-value">{studentData.totalLessons}</div>
                    <div className="stat-label">Total Lessons</div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-value">{studentData.attendance}%</div>
                    <div className="stat-label">Attendance</div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-value with-icon">
                      {studentData.averageRating}
                      <i className="fi fi-sr-star"></i>
                    </div>
                    <div className="stat-label">Avg Rating</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Right side */}
              <div className="profile-action-buttons">
                <button className="enter-classroom-btn" onClick={() => route(`/classroom/${studentData.id}`)}>
                  <i className="fi fi-sr-video-camera"></i>
                  <span>Enter Classroom</span>
                </button>
                <button className="test-headset-btn" onClick={openHeadsetModal}>
                  <i className="fi fi-sr-headset"></i>
                  <span>Test Headset</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            {(['overview', 'history', 'notes', 'materials'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="overview-grid">
              {/* Learning Goals */}
              <div className="content-card">
                <h3 className="card-title">
                  <i className="fi fi-sr-target"></i>
                  Learning Goals
                </h3>
                <p className="card-text">{studentData.goals}</p>

                <h4 className="section-subtitle">Interests</h4>
                <p className="card-text">{studentData.interests}</p>

                <h4 className="section-subtitle">Preferred Topics</h4>
                <div className="topic-tags">
                  {studentData.preferredTopics.map((topic, idx) => (
                    <span key={idx} className="topic-tag">{topic}</span>
                  ))}
                </div>
              </div>

              {/* Upcoming Sessions */}
              <div className="content-card">
                <h3 className="card-title">
                  <i className="fi fi-sr-calendar-lines"></i>
                  Upcoming
                </h3>
                <div className="sessions-list">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="session-card">
                      <div className="session-topic">{session.topic}</div>
                      <div className="session-meta">
                        <i className="fi fi-sr-calendar"></i>
                        {session.date}
                      </div>
                      <div className="session-meta" style={{ marginTop: '4px' }}>
                        <i className="fi fi-sr-clock"></i>
                        {session.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="content-card simple">
              <h3 className="card-title blue">
                <i className="fi fi-sr-time-past"></i>
                Lesson History
              </h3>
              <div className="sessions-list">
                {pastSessions.map((session) => (
                  <div key={session.id} className="session-card completed">
                    <div>
                      <div className="session-topic">{session.topic}</div>
                      <div className="session-meta-row">
                        <span className="session-meta-item">
                          <i className="fi fi-sr-calendar"></i>
                          {session.date}
                        </span>
                        <span className="session-meta-item">
                          <i className="fi fi-sr-clock"></i>
                          {session.time}
                        </span>
                      </div>
                    </div>
                    {session.rating && (
                      <div className="rating-badge">
                        <i className="fi fi-sr-star"></i>
                        {session.rating}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="content-card simple">
              <h3 className="card-title blue">
                <i className="fi fi-sr-edit"></i>
                Lesson Notes
              </h3>
              <div className="notes-list">
                {lessonNotes.map((note, idx) => (
                  <div key={idx} className="note-card">
                    <div className="note-header">
                      <div className="note-date-time">
                        <span className="note-date">{note.date}</span>
                        <span className="note-time">{note.time}</span>
                      </div>
                      <div className="rating-badge small">
                        <i className="fi fi-sr-star"></i>
                        {note.rating}
                      </div>
                    </div>
                    <p className="note-content">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="empty-state">
              <i className="fi fi-sr-book"></i>
              <h3>No Materials Yet</h3>
              <p>Shared lesson materials will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Headset Test Modal */}
      {showHeadsetModal && (
        <div className="headset-modal-overlay" onClick={closeHeadsetModal}>
          <div className="headset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="headset-modal-header">
              <h2>
                <i className="fi fi-sr-computer"></i>
                Device & Media Test
              </h2>
              <button className="modal-close-btn" onClick={closeHeadsetModal}>
                <i className="fi fi-sr-cross"></i>
              </button>
            </div>

            <div className="headset-modal-content">
              {/* Microphone Test */}
              <div className="test-section">
                <h3>
                  <i className="fi fi-sr-microphone"></i>
                  Microphone Test
                </h3>
                {micPermission === 'pending' && (
                  <div className="mic-status pending">
                    <i className="fi fi-sr-spinner"></i>
                    Requesting microphone access...
                  </div>
                )}
                {micPermission === 'denied' && (
                  <div className="mic-status denied">
                    <i className="fi fi-sr-exclamation"></i>
                    Microphone access denied. Please allow access in your browser settings.
                  </div>
                )}
                {micPermission === 'granted' && (
                  <div className="mic-test-area">
                    <div className="mic-status granted">
                      <i className="fi fi-sr-check"></i>
                      Microphone connected! Speak to test.
                    </div>
                    <div className="mic-level-container">
                      <div className="mic-level-bar">
                        <div 
                          className="mic-level-fill" 
                          style={{ width: `${micLevel}%` }}
                        ></div>
                      </div>
                      <span className="mic-level-text">{Math.round(micLevel)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Test */}
              <div className="test-section">
                <h3>
                  <i className="fi fi-sr-camera"></i>
                  Camera Test
                </h3>
                {camPermission === 'pending' && (
                  <div className="cam-status pending">
                    <i className="fi fi-sr-spinner"></i>
                    Requesting camera access...
                  </div>
                )}
                {camPermission === 'denied' && (
                  <div className="cam-status denied">
                    <i className="fi fi-sr-exclamation"></i>
                    Camera access denied. Please allow access in your browser settings.
                  </div>
                )}
                {camPermission === 'granted' && (
                  <div className="camera-test-area">
                    <div className="camera-preview">
                      <video ref={videoRef} playsInline muted />
                    </div>
                    <div className="camera-controls">
                      <button
                        className="camera-btn"
                        onClick={() => {
                          if (!videoRef.current) return;
                          if (videoRef.current.paused) videoRef.current.play();
                          else videoRef.current.pause();
                        }}
                      >
                        <i className="fi fi-sr-play"></i>
                        <span>Play/Pause</span>
                      </button>
                      <button
                        className="camera-btn"
                        onClick={async () => {
                          try {
                            // Reinitialize camera in case user switched devices
                            if (cameraStreamRef.current) {
                              cameraStreamRef.current.getTracks().forEach(t => t.stop());
                            }
                            const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
                            cameraStreamRef.current = cam;
                            if (videoRef.current) {
                              videoRef.current.srcObject = cam;
                              await videoRef.current.play();
                            }
                          } catch {}
                        }}
                      >
                        <i className="fi fi-sr-refresh"></i>
                        <span>Restart Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Speaker Test */}
              <div className="test-section">
                <h3>
                  <i className="fi fi-sr-volume"></i>
                  Speaker Test
                </h3>
                <p className="test-description">Click the buttons below to test your left and right speakers.</p>
                <div className="speaker-buttons">
                  <button 
                    className={`speaker-btn left ${isPlayingLeft ? 'playing' : ''}`}
                    onClick={() => playTestSound('left')}
                    disabled={isPlayingLeft}
                  >
                    <i className="fi fi-sr-arrow-left"></i>
                    <span>Left Speaker</span>
                    {isPlayingLeft && <div className="sound-wave"></div>}
                  </button>
                  <button 
                    className={`speaker-btn right ${isPlayingRight ? 'playing' : ''}`}
                    onClick={() => playTestSound('right')}
                    disabled={isPlayingRight}
                  >
                    <span>Right Speaker</span>
                    <i className="fi fi-sr-arrow-right"></i>
                    {isPlayingRight && <div className="sound-wave"></div>}
                  </button>
                </div>
              </div>
            </div>

            <div className="headset-modal-footer">
              <button className="done-btn" onClick={closeHeadsetModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
}

export default StudentProfilePage

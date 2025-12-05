import { useState, useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket } from '../client/socket/socket.client';
import { useWebRTC } from '../hooks/useWebRTC';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import type { ChatMessageData } from '../types/socket.types';
import type { Socket } from 'socket.io-client';
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
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
}

// Format text with bold, italic, and clickable links
const formatMessageText = (text: string): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = [];
  
  // Combined regex for bold (*text*), italic (_text_), and URLs
  const regex = /(\*[^*]+\*)|(_[^_]+_)|(https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const matchedText = match[0];
    
    if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
      // Bold text
      parts.push(<strong key={`bold-${keyIndex++}`}>{matchedText.slice(1, -1)}</strong>);
    } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
      // Italic text
      parts.push(<em key={`italic-${keyIndex++}`}>{matchedText.slice(1, -1)}</em>);
    } else if (matchedText.startsWith('http')) {
      // URL - make it clickable
      parts.push(
        <a 
          key={`link-${keyIndex++}`} 
          href={matchedText} 
          target="_blank" 
          rel="noopener noreferrer"
          className="chat-link"
        >
          {matchedText}
        </a>
      );
    }
    
    lastIndex = match.index + matchedText.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};

// Format file size for display
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  
  // Track stream IDs for forcing re-renders
  const [localStreamId, setLocalStreamId] = useState<string>('');
  const [remoteStreamId, setRemoteStreamId] = useState<string>('');
  
  // Socket state for passing to child components
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  
  // Extract sessionId from router params or query string, fallback to pathname
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
  
  // Initialize socket and join session
  useEffect(() => {
    if (!currentSessionId) return;
    
    console.log('🔌 [Classroom] Initializing socket...');
    // Destroy any existing socket to ensure fresh connection with correct auth
    destroySocket();
    initSocket();
    connectSocket();
    
    const socket = getSocket();
    setSocketInstance(socket);
    
    // Wait for connection before joining
    const onConnect = () => {
      console.log('✅ [Classroom] Socket connected, joining session:', currentSessionId);
      socket.emit('session:join', { sessionId: currentSessionId });
      socket.emit('chat:request-history', { sessionId: currentSessionId });
    };
    
    // Handle incoming chat messages
    const onChatMessage = (data: ChatMessageData) => {
      console.log('💬 [Classroom] Received message:', data);
      const newMsg: ChatMessage = {
        id: data.id,
        sender: data.senderType,
        text: data.text,
        timestamp: new Date(data.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        correction: data.correction,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize
      };
      setChatMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, newMsg];
      });
    };
    
    // Handle chat history
    const onChatHistory = (messages: ChatMessageData[]) => {
      console.log('📜 [Classroom] Received chat history:', messages.length, 'messages');
      const formattedMessages: ChatMessage[] = messages.map(msg => ({
        id: msg.id,
        sender: msg.senderType,
        text: msg.text,
        timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        correction: msg.correction,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileType: msg.fileType,
        fileSize: msg.fileSize
      }));
      setChatMessages(formattedMessages);
    };
    
    // Handle typing indicator
    const onTyping = (data: { userId: string; isTyping: boolean }) => {
      setRemoteTyping(data.isTyping);
    };
    
    // Handle session state
    const onSessionState = (data: any) => {
      console.log('📋 [Classroom] Session state:', data);
      if (data.status === 'active') {
        setIsConnecting(false);
      }
      // Always update student info with latest from session state
      if (data.participants?.studentId) {
        setStudentInfo({
          id: data.participants.studentId,
          name: 'Student',
          initials: 'ST',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
        console.log('🎯 [Classroom] Updated studentInfo to:', data.participants.studentId);
      } else {
        // No student in session, clear studentInfo
        setStudentInfo(null);
      }
    };
    
    // Handle user joined
    const onUserJoined = (data: { userId: string; userType: string }) => {
      console.log('👋 [Classroom] User joined:', data);
      if (data.userType === 'student') {
        setIsConnecting(false);
        // Always update with the latest student ID
        setStudentInfo({
          id: data.userId,
          name: 'Student',
          initials: 'ST',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
        console.log('🎯 [Classroom] Student joined with ID:', data.userId);
      }
    };
    
    // Handle user left
    const onUserLeft = (data: { userId: string; userType: string }) => {
      console.log('👋 [Classroom] User left:', data);
      if (data.userType === 'student') {
        setStudentInfo(null);
      }
    };
    
    // Set up listeners
    socket.on('connect', onConnect);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:history', onChatHistory);
    socket.on('chat:typing', onTyping);
    socket.on('session:state', onSessionState);
    socket.on('session:user-joined', onUserJoined);
    socket.on('session:user-left', onUserLeft);
    
    // If already connected, join immediately
    if (socket.connected) {
      onConnect();
    }
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:history', onChatHistory);
      socket.off('chat:typing', onTyping);
      socket.off('session:state', onSessionState);
      socket.off('session:user-joined', onUserJoined);
      socket.off('session:user-left', onUserLeft);
    };
  }, [currentSessionId]);
  
  // State
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{ name: string; id: string; initials: string; date: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Try to enable audio - will succeed if user has engagement history with the site
  useEffect(() => {
    if (audioEnabled) return;
    
    // Try to play unmuted immediately (works if site has media engagement)
    const tryAutoUnmute = async () => {
      const testAudio = new Audio();
      testAudio.volume = 0.01; // Very quiet
      try {
        await testAudio.play();
        testAudio.pause();
        // Success! Browser allows autoplay with sound
        setAudioEnabled(true);
        console.log('🔊 Autoplay with sound allowed by browser');
        return;
      } catch {
        // Autoplay blocked, need user interaction
        console.log('🔇 Autoplay blocked, waiting for user interaction');
      }
    };
    
    tryAutoUnmute();
    
    // Fallback: enable on first user interaction
    const enableAudio = () => {
      setAudioEnabled(true);
      [remoteVideoRef.current, remotePipRef.current].forEach(video => {
        if (video) {
          video.muted = false;
          console.log('🔊 Audio enabled via user interaction');
        }
      });
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, [audioEnabled]);

  // WebRTC Hook
  const {
    localStream,
    remoteStream,
    isConnected,
    error: webrtcError,
    startLocalStream,
    createOffer,
    toggleAudio,
    toggleVideo,
    cleanup
  } = useWebRTC({ remoteUserId: studentInfo?.id });

  // Mock student data (will be replaced with real data)
  const studentData = studentInfo || {
    name: 'Student',
    initials: 'ST',
    sessionTime: '10:00AM - 10:25AM',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  };

  // Chat messages - start empty, will load from server
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Start local media when component mounts (only once)
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        console.log('🎥 [Classroom] Starting local media stream...');
        await startLocalStream(true, true);
        console.log('🎥 [Classroom] Local media stream started successfully');
      } catch (err) {
        console.error('❌ [Classroom] Failed to start media:', err);
      }
    };

    initWebRTC();
  }, []); // Empty deps - only run once on mount

  // When student info is known and local stream is ready, tutor initiates offer
  useEffect(() => {
    if (studentInfo?.id && localStream) {
      console.log('👨‍🏫 Initiating offer to student:', studentInfo.id);
      createOffer();
    }
  }, [studentInfo?.id, localStream, createOffer]);

  // Attach all streams to all video refs - robust effect with interval checking
  useEffect(() => {
    const attachStreams = () => {
      let attached = false;
      
      if (localStream) {
        if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
          console.log('📹 [Classroom] Local stream attached to main video');
          attached = true;
        }
        if (localPipRef.current && localPipRef.current.srcObject !== localStream) {
          localPipRef.current.srcObject = localStream;
          localPipRef.current.play().catch(() => {});
          console.log('📹 [Classroom] Local stream attached to PiP video');
          attached = true;
        }
        // Update stream ID to force re-render if needed
        const newLocalId = localStream.id || Date.now().toString();
        setLocalStreamId(prev => prev !== newLocalId ? newLocalId : prev);
      }
      
      if (remoteStream) {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
          console.log('📺 [Classroom] Remote stream attached to main video');
          attached = true;
        }
        if (remotePipRef.current && remotePipRef.current.srcObject !== remoteStream) {
          remotePipRef.current.srcObject = remoteStream;
          remotePipRef.current.play().catch(() => {});
          console.log('📺 [Classroom] Remote stream attached to PiP video');
          attached = true;
        }
        // Update stream ID to force re-render if needed
        const newRemoteId = remoteStream.id || Date.now().toString();
        setRemoteStreamId(prev => prev !== newRemoteId ? newRemoteId : prev);
      }
      
      return attached;
    };
    
    // Attach immediately
    attachStreams();
    
    // Keep checking periodically until streams are attached (handles late DOM mounting)
    const intervalId = setInterval(() => {
      const allAttached = attachStreams();
      // Check if all expected streams are attached
      const localAttached = !localStream || (localVideoRef.current?.srcObject === localStream);
      const remoteAttached = !remoteStream || (remoteVideoRef.current?.srcObject === remoteStream && remotePipRef.current?.srcObject === remoteStream);
      
      if (localAttached && remoteAttached) {
        // All streams attached, can reduce frequency but keep monitoring
      }
    }, 500);
    
    // Also attach after short delays to handle race conditions
    const timeouts = [100, 300, 1000, 2000].map(delay => 
      setTimeout(attachStreams, delay)
    );
    
    return () => {
      clearInterval(intervalId);
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [localStream, remoteStream]);

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

  // Handle file selection
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file and get URL (using base64 for now - in production use cloud storage)
  const uploadFile = async (file: File): Promise<{ url: string; type: 'image' | 'file' }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const fileType = file.type.startsWith('image/') ? 'image' : 'file';
        resolve({ url: base64, type: fileType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedFile) || !currentSessionId) return;
    
    try {
      const socket = getSocket();
      
      let fileData: { fileUrl?: string; fileName?: string; fileType?: 'image' | 'file'; fileSize?: number } = {};
      
      if (selectedFile) {
        setIsUploading(true);
        const { url, type } = await uploadFile(selectedFile);
        fileData = {
          fileUrl: url,
          fileName: selectedFile.name,
          fileType: type,
          fileSize: selectedFile.size
        };
        setIsUploading(false);
      }
      
      socket.emit('chat:send', {
        sessionId: currentSessionId,
        text: message.trim() || (selectedFile ? ` ${fileData.fileType === 'image' ? 'image' : 'file'}` : ''),
        ...fileData
      });
      // Stop typing indicator when message is sent
      socket.emit('chat:typing', { isTyping: false });
      console.log('📤 [Classroom] Sent message:', message.trim(), fileData.fileName ? `with file: ${fileData.fileName}` : '');
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsUploading(false);
    }
    
    setMessage('');
    clearSelectedFile();
  };

  // Handle typing indicator
  const handleTyping = (typing: boolean) => {
    try {
      const socket = getSocket();
      socket.emit('chat:typing', { isTyping: typing });
    } catch (error) {
      // Socket might not be ready
    }
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

  const [lessonEndedSent, setLessonEndedSent] = useState(false);

  const handleEndLesson = () => {
    if (lessonEndedSent) {
      // Already sent, do nothing - button just shows status
      return;
    }
    // Send end lesson signal to student (tutor stays in classroom)
    getSocket().emit('session:end-lesson', { 
      message: 'The lesson time is over. Thank you for learning with us!' 
    });
    setLessonEndedSent(true);
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

        {/* Video Area */}
        <div className="video-section">
          {/* Main Video */}
          <div className="video-main">
            {/* Connection Status overlay inside video */}
            {isConnecting && (
              <div className="connection-status overlay-top">
                <div className="spinner"></div>
                <p>Waiting for student to join...</p>
              </div>
            )}
            {/* All video elements always rendered, visibility controlled by isSwapped */}
            {/* Remote video in main (visible when swapped) */}
            <video 
              ref={(el) => {
                remoteVideoRef.current = el;
                if (el && remoteStream && el.srcObject !== remoteStream) {
                  el.srcObject = remoteStream;
                  el.muted = !audioEnabled;
                  el.play().catch(() => {});
                  console.log('🎬 Remote Main: Stream attached');
                }
              }}
              autoPlay 
              playsInline 
              muted={!audioEnabled}
              className="remote-video"
              style={{ display: isSwapped && remoteStream ? 'block' : 'none' }}
            />
            {/* Remote placeholder in main (visible when swapped and no stream) */}
            {isSwapped && !remoteStream && (
              <div className="video-placeholder student-video">
                <div className="video-avatar-large">{studentData.initials}</div>
                <span className="video-name">{studentData.name}</span>
                {!isConnected && studentInfo && <span className="connection-text">Connecting...</span>}
              </div>
            )}
            {/* Local video in main (visible when not swapped) */}
            <video 
              ref={localVideoRef} 
              muted 
              autoPlay 
              playsInline 
              className="local-video" 
              style={{ display: !isSwapped && !isVideoOff ? 'block' : 'none' }}
            />
            {/* Speaking indicator for local in main */}
            {!isSwapped && !isVideoOff && (
              <div className={`mic-indicator mic-large ${isSpeakingLocal ? 'active' : ''}`}> 
                <div className="mic-dot" />
              </div>
            )}
            {/* Local placeholder in main (visible when not swapped and video off) */}
            {!isSwapped && isVideoOff && (
              <div className="video-placeholder tutor-video">
                <div className="video-avatar-large">
                  {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                </div>
                <span className="video-name">{user?.firstName || 'Tutor'}</span>
              </div>
            )}
          </div>

          {/* Picture-in-Picture (click to swap) */}
          <div className="video-pip" onClick={() => setIsSwapped(prev => !prev)} title="Click to swap">
            {/* All PiP video elements always rendered, visibility controlled by isSwapped */}
            {/* Local video in PiP (visible when swapped) */}
            <video 
              muted 
              autoPlay 
              playsInline 
              className="local-video-small" 
              style={{ display: isSwapped && !isVideoOff ? 'block' : 'none' }}
              ref={localPipRef}
            />
            {/* Speaking indicator for local in PiP */}
            {isSwapped && !isVideoOff && (
              <div className={`mic-indicator ${isSpeakingLocal ? 'active' : ''}`}>
                <div className="mic-dot" />
              </div>
            )}
            {/* Local placeholder in PiP (visible when swapped and video off) */}
            {isSwapped && isVideoOff && (
              <div className="video-placeholder tutor-video">
                <div className="video-avatar-small">
                  {user?.firstName?.charAt(0) || 'T'}{user?.lastName?.charAt(0) || ''}
                </div>
              </div>
            )}
            {/* Remote video in PiP (visible when not swapped) */}
            <video 
              autoPlay 
              playsInline 
              muted={!audioEnabled}
              className="remote-video-small" 
              ref={(el) => {
                remotePipRef.current = el;
                if (el && remoteStream && el.srcObject !== remoteStream) {
                  el.srcObject = remoteStream;
                  el.muted = !audioEnabled;
                  el.play().catch(() => {});
                  console.log('🎬 Remote PiP: Stream attached');
                }
              }}
              style={{ display: !isSwapped && remoteStream ? 'block' : 'none' }}
            />
            {/* Remote placeholder in PiP (visible when not swapped and no stream) */}
            {!isSwapped && !remoteStream && (
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
            <button className={`control-btn end-call ${lessonEndedSent ? 'sent' : ''}`} onClick={handleEndLesson} title={lessonEndedSent ? 'Leave classroom' : 'Notify student lesson is over'}>
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
            {chatMessages.map((msg) => {
              // In tutor app: tutor messages are "self" (right), student messages are "other" (left)
              const isOwnMessage = msg.sender === 'tutor';

              return (
              <div key={msg.id} className={`chat-message ${isOwnMessage ? 'self' : 'other'}`}>
                {msg.correction && (
                  <div className="message-correction">
                    <span className="label">You said:</span> {formatMessageText(msg.text)}
                    <br />
                    <span className="label">Correct:</span> {formatMessageText(msg.correction)}
                  </div>
                )}
                {!msg.correction && (
                  <div className="message-bubble">
                    {/* File/Image attachment */}
                    {msg.fileUrl && msg.fileType === 'image' && (
                      <div className="message-image">
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                          <img src={msg.fileUrl} alt={msg.fileName || 'Shared image'} />
                        </a>
                      </div>
                    )}
                    {msg.fileUrl && msg.fileType === 'file' && (
                      <a href={msg.fileUrl} download={msg.fileName} className="message-file">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="12" y1="18" x2="12" y2="12"></line>
                          <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                        <span className="file-name">{msg.fileName}</span>
                        {msg.fileSize && <span className="file-size">{formatFileSize(msg.fileSize)}</span>}
                      </a>
                    )}
                    {/* Text content with formatting */}
                    {msg.text && !msg.text.startsWith() && (
                      <span className="message-text">{formatMessageText(msg.text)}</span>
                    )}
                  </div>
                )}
                <span className="message-time">{msg.timestamp}</span>
              </div>
              );
            })}
            {remoteTyping && (
              <div className="typing-indicator">
                <span>Student is typing</span>
                <span className="typing-dots">...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          {/* File preview */}
          {selectedFile && (
            <div className="file-preview-bar">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="file-preview-thumb" />
              ) : (
                <div className="file-preview-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
              )}
              <span className="file-preview-name">{selectedFile.name}</span>
              <span className="file-preview-size">{formatFileSize(selectedFile.size)}</span>
              <button className="file-preview-remove" onClick={clearSelectedFile}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
          
          <div className="chat-input-area">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
              style={{ display: 'none' }}
            />
            <button 
              className="attach-btn" 
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            <input
              type="text"
              placeholder="Type a message... (*bold* _italic_)"
              value={message}
              onChange={(e) => {
                const newValue = (e.target as HTMLInputElement).value;
                setMessage(newValue);
                // Only show typing if there's actual text
                handleTyping(newValue.trim().length > 0);
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              onBlur={() => handleTyping(false)}
            />
            <button className="send-btn" onClick={handleSendMessage} disabled={isUploading}>
              {isUploading ? (
                <span className="upload-spinner"></span>
              ) : (
                <i className="fi fi-sr-paper-plane"></i>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Learning Materials */}
      <div className="classroom-right">
        {/* Material Header */}
        <div className="material-header">
          <i className="fi fi-sr-book-open-reader"></i>
          <span>Learning Material</span>
        </div>

        {/* PDF Viewer */}
        <div className="pdf-viewer-container">
          <PdfViewer socket={socketInstance} sessionId={currentSessionId} userType="tutor" />
        </div>
      </div>
    </div>
  );
};

export default ClassroomPage;

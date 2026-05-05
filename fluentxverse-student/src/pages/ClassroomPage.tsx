import { useState, useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket, fetchSocketAuthToken } from '../client/socket/socket.client';
import { useWebRTC } from '../hooks/useWebRTC';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import { toast, toastConfirm } from '../Components/Common/Toast';
import { studentApi, type StudentProfile, type LessonPreferences } from '../api/student.api';
import { lessonApi, type Lesson } from '../api/lesson.api';
import type { ChatMessageData } from '../types/socket.types';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import './ClassroomPage.css';

// Daily Dispatch article interface
interface DispatchArticle {
  id: string;
  title: string;
  topic: string;
  category: string;
  createdAt: string;
}

// Conversational Skills lesson interface for viewing
interface ConversationalLesson {
  id: string;
  title: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  goalTextEn: string;
  viewUrl?: string;
}

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
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);
  const lessonDropdownRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localPipRef = useRef<HTMLVideoElement>(null);
  const remotePipRef = useRef<HTMLVideoElement>(null);
  
  // Track stream IDs for forcing re-renders
  const [localStreamId, setLocalStreamId] = useState<string>('');
  const [remoteStreamId, setRemoteStreamId] = useState<string>('');
  
  // Socket state for passing to child components
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  
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
  
  // Initialize socket and join session
  useEffect(() => {
    if (!currentSessionId) return;

    let socket: Socket | null = null;
    let isCancelled = false;

    // Wait for connection before joining
    const onConnect = () => {
      if (!socket) return;
      socket.emit('session:join', { sessionId: currentSessionId });
      socket.emit('chat:request-history', { sessionId: currentSessionId });
    };
    
    // Handle incoming chat messages
    const onChatMessage = (data: ChatMessageData) => {
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
      if (data.status === 'active') {
        setIsConnecting(false);
      }
      // Always update tutor info with latest from session state
      if (data.participants?.tutorId) {
        setTutorInfo({
          id: data.participants.tutorId,
          name: 'Tutor',
          initials: 'TU',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
      } else {
        // No tutor in session, clear tutorInfo
        setTutorInfo(null);
      }
    };
    
    // Handle user joined
    const onUserJoined = (data: { userId: string; userType: string }) => {
      if (data.userType === 'tutor') {
        setIsConnecting(false);
        // Always update with the latest tutor ID
        setTutorInfo({
          id: data.userId,
          name: 'Tutor',
          initials: 'TU',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
      }
    };
    
    // Handle user left
    const onUserLeft = (data: { userId: string; userType: string }) => {
      if (data.userType === 'tutor') {
        setTutorInfo(null);
      }
    };
    
    // Handle lesson ended by tutor
    const onLessonEnded = (data: { tutorId: string; message?: string }) => {
      setLessonEndedMessage(data.message || 'The tutor has ended the lesson. Thank you for learning with us!');
    };
    
    const setupSocket = async () => {
      // Destroy any existing socket to ensure a fresh connection with current auth.
      destroySocket();
      const socketToken = await fetchSocketAuthToken();

      if (isCancelled) {
        return;
      }

      socket = initSocket(socketToken);
      setSocketInstance(socket);

      // Set up listeners before connecting so the first connect event is not missed.
      socket.on('connect', onConnect);
      socket.on('chat:message', onChatMessage);
      socket.on('chat:history', onChatHistory);
      socket.on('chat:typing', onTyping);
      socket.on('session:state', onSessionState);
      socket.on('session:user-joined', onUserJoined);
      socket.on('session:user-left', onUserLeft);
      socket.on('session:lesson-ended', onLessonEnded);

      if (socket.connected) {
        onConnect();
      } else {
        connectSocket();
      }
    };

    void setupSocket().catch((error) => {
      console.error('Failed to initialize classroom socket:', error);
    });
    
    return () => {
      isCancelled = true;
      if (!socket) return;
      socket.off('connect', onConnect);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:history', onChatHistory);
      socket.off('chat:typing', onTyping);
      socket.off('session:state', onSessionState);
      socket.off('session:user-joined', onUserJoined);
      socket.off('session:user-left', onUserLeft);
      socket.off('session:lesson-ended', onLessonEnded);
      setSocketInstance(null);
    };
  }, [currentSessionId]);
  
  // State
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [tutorInfo, setTutorInfo] = useState<{ name: string; id: string; initials: string; date: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [lessonEndedMessage, setLessonEndedMessage] = useState<string | null>(null);
  
  // Material/Lesson state
  const [chosenLesson, setChosenLesson] = useState<{
    lessonId: string;
    courseId: string;
    title: string;
    lessonNumber: number;
    goal: string;
  } | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);
  
  // Student profile state
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  
  // Material selector state - hierarchical
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [showLessonRequest, setShowLessonRequest] = useState(true);
  const [lessonViewUrl, setLessonViewUrl] = useState<string | null>(null);
  const [loadingViewUrl, setLoadingViewUrl] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [courseDropdownMenuStyle, setCourseDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const [levelDropdownMenuStyle, setLevelDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [chapterDropdownMenuStyle, setChapterDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isLessonDropdownOpen, setIsLessonDropdownOpen] = useState(false);
  const [lessonDropdownMenuStyle, setLessonDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  
  // Course definitions
  const courses = [
    { id: 'conversational-skills', name: 'Conversational Skills', icon: '💬', description: 'Conversation lessons for practical speaking practice.' },
    { id: 'business-english', name: 'Business English', icon: '💼', description: 'Workplace English lessons and professional scenarios.' },
    { id: 'young-learners', name: 'Young Learners', icon: '🎨', description: 'Visual lessons designed for younger students.' },
    { id: 'daily-dispatch', name: 'Daily Dispatch', icon: '📰', description: 'News-based reading and discussion material.' },
  ];
  const selectedCourseOption = courses.find(course => course.id === selectedCourse) || null;
  const showSelectedCourseDetails = Boolean(selectedCourse) && !isCourseDropdownOpen;

  const buildDropdownMenuStyle = (container: HTMLDivElement | null): JSX.CSSProperties | null => {
    if (!container) return null;

    const triggerRect = container.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 16;
    const preferredMaxHeight = 240;
    const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const width = Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(triggerRect.left, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );

    return {
      top: `${triggerRect.bottom + gap}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.min(preferredMaxHeight, Math.max(140, spaceBelow))}px`,
    };
  };

  const updateCourseDropdownMenuPosition = () => {
    setCourseDropdownMenuStyle(buildDropdownMenuStyle(courseDropdownRef.current));
  };

  const updateLevelDropdownMenuPosition = () => {
    setLevelDropdownMenuStyle(buildDropdownMenuStyle(levelDropdownRef.current));
  };

  const updateChapterDropdownMenuPosition = () => {
    setChapterDropdownMenuStyle(buildDropdownMenuStyle(chapterDropdownRef.current));
  };

  const updateLessonDropdownMenuPosition = () => {
    setLessonDropdownMenuStyle(buildDropdownMenuStyle(lessonDropdownRef.current));
  };

  const toggleCourseDropdown = () => {
    if (isCourseDropdownOpen) {
      setIsCourseDropdownOpen(false);
      return;
    }

    updateCourseDropdownMenuPosition();
    setIsLevelDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    setIsCourseDropdownOpen(true);
  };

  const toggleLevelDropdown = () => {
    if (!availableLevels.length) return;
    if (isLevelDropdownOpen) {
      setIsLevelDropdownOpen(false);
      return;
    }

    updateLevelDropdownMenuPosition();
    setIsCourseDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    setIsLevelDropdownOpen(true);
  };

  const toggleChapterDropdown = () => {
    if (selectedLevel === null || !availableChapters.length) return;
    if (isChapterDropdownOpen) {
      setIsChapterDropdownOpen(false);
      return;
    }

    updateChapterDropdownMenuPosition();
    setIsCourseDropdownOpen(false);
    setIsLevelDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    setIsChapterDropdownOpen(true);
  };

  const toggleLessonDropdown = () => {
    if (!filteredLessons.length) return;
    if (isLessonDropdownOpen) {
      setIsLessonDropdownOpen(false);
      return;
    }

    updateLessonDropdownMenuPosition();
    setIsCourseDropdownOpen(false);
    setIsLevelDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(true);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideSelector =
        courseDropdownRef.current?.contains(target) ||
        levelDropdownRef.current?.contains(target) ||
        chapterDropdownRef.current?.contains(target) ||
        lessonDropdownRef.current?.contains(target);

      if (!clickedInsideSelector) {
        setIsCourseDropdownOpen(false);
        setIsLevelDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setIsLessonDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCourseDropdownOpen(false);
        setIsLevelDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setIsLessonDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isCourseDropdownOpen && !isLevelDropdownOpen && !isChapterDropdownOpen && !isLessonDropdownOpen) {
      setCourseDropdownMenuStyle(null);
      setLevelDropdownMenuStyle(null);
      setChapterDropdownMenuStyle(null);
      setLessonDropdownMenuStyle(null);
      return;
    }

    const syncDropdownPosition = () => {
      if (isCourseDropdownOpen) updateCourseDropdownMenuPosition();
      if (isLevelDropdownOpen) updateLevelDropdownMenuPosition();
      if (isChapterDropdownOpen) updateChapterDropdownMenuPosition();
      if (isLessonDropdownOpen) updateLessonDropdownMenuPosition();
    };

    syncDropdownPosition();
    window.addEventListener('resize', syncDropdownPosition);
    window.addEventListener('scroll', syncDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', syncDropdownPosition);
      window.removeEventListener('scroll', syncDropdownPosition, true);
    };
  }, [isCourseDropdownOpen, isLevelDropdownOpen, isChapterDropdownOpen, isLessonDropdownOpen]);

  const isLessonMaterialCourse = (courseId?: string | null) =>
    courseId === 'conversational-skills' || courseId === 'business-english';

  const transformLessonMaterialToLesson = (lessonMaterial: any): Lesson => {
    const chapterLabel = lessonMaterial.chapterLabel
      || (lessonMaterial.chapterName
        ? `Chapter ${lessonMaterial.chapter}: ${lessonMaterial.chapterName}`
        : `Chapter ${lessonMaterial.chapter}`);
    const lessonLabel = lessonMaterial.lessonTitle || `Lesson ${lessonMaterial.lessonNumber}: ${lessonMaterial.lessonName}`;

    return {
      id: lessonMaterial.id,
      title: lessonLabel,
      slug: lessonMaterial.id,
      status: 'published',
      parentId: null,
      forkOf: null,
      isFork: false,
      createdBy: lessonMaterial.createdBy || '',
      createdByName: lessonMaterial.createdByName || null,
      storagePath: '',
      createdAt: lessonMaterial.createdAt || '',
      updatedAt: lessonMaterial.updatedAt || '',
      publishedAt: lessonMaterial.updatedAt || null,
      lessonData: {
        course: lessonMaterial.course,
        header: {
          levelBadge: `Level ${lessonMaterial.level || 1}`,
          chapterLabel,
          lessonLabel,
          goalText: lessonMaterial.goalTextEn || '',
          goalSubtext: lessonMaterial.goalTextJp || '',
          backgroundImage: lessonMaterial.backgroundImage || '',
          overlayColor: lessonMaterial.overlayColor || '',
        }
      } as Lesson['lessonData'],
    };
  };

  const resolveStudentMaterialViewUrl = async (courseId: string | undefined, lessonId: string): Promise<string | null> => {
    if (courseId === 'conversational-skills') {
      return `/materials/conversational-skills/${lessonId}`;
    }

    if (courseId === 'young-learners') {
      return `/materials/young-learners/lesson/${lessonId}`;
    }

    if (courseId === 'business-english') {
      const result = await lessonApi.getLessonMaterialView(lessonId);
      return result.success ? result.viewUrl || null : null;
    }

    const result = await lessonApi.getStudentLesson(lessonId);
    return result.success ? result.viewUrl || null : null;
  };
  
  // Daily Dispatch state
  const [dispatchArticles, setDispatchArticles] = useState<DispatchArticle[]>([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [viewingDispatchArticle, setViewingDispatchArticle] = useState<DispatchArticle | null>(null);
  
  // Conversational Skills viewing state
  const [viewingConversationalLesson, setViewingConversationalLesson] = useState<ConversationalLesson | null>(null);
  const [conversationalViewUrl, setConversationalViewUrl] = useState<string | null>(null);
  const [loadingConversationalView, setLoadingConversationalView] = useState(false);
  
  // File sharing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper functions for lesson data extraction
  const getLevelNumber = (lesson: Lesson): number => {
    const levelBadge = lesson.lessonData?.header?.levelBadge || '';
    const match = levelBadge.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };
  
  const getChapterNumber = (lesson: Lesson): number => {
    const chapterLabel = lesson.lessonData?.header?.chapterLabel || '';
    const match = chapterLabel.match(/Chapter\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };
  
  const getLessonNumber = (lesson: Lesson): number => {
    const lessonLabel = lesson.lessonData?.header?.lessonLabel || lesson.title || '';
    const match = lessonLabel.match(/Lesson\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  // Handle course selection - load lessons for that course
  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedLevel(null);
    setSelectedChapter(null);
    setSelectedLessonId('');
    setDispatchArticles([]);
    
    if (!courseId) return;
    
    // Handle Daily Dispatch separately
    if (courseId === 'daily-dispatch') {
      setLoadingDispatch(true);
      try {
        const response = await fetch(`${API_BASE_URL}/dispatch`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // Handle both array response and wrapped response
          const articles: DispatchArticle[] = Array.isArray(data) ? data : (data.articles || data.data || []);
          // Sort articles by date (most recent first)
          const sortedArticles = articles.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setDispatchArticles(sortedArticles);
        }
      } catch (err) {
        console.error('Failed to load dispatch articles:', err);
      } finally {
        setLoadingDispatch(false);
      }
      return;
    }
    
    setLoadingMaterials(true);
    try {
      // Use lesson-materials endpoint for builder-backed courses
      if (isLessonMaterialCourse(courseId)) {
        const result = await lessonApi.getPublishedLessonMaterials(courseId);
        if (result.success && result.lessons) {
          setAvailableLessons(result.lessons.map(transformLessonMaterialToLesson));
        }
      } else {
        // Use regular lesson endpoint for other courses
        const result = await lessonApi.getPublishedLessons(courseId);
        if (result.success && result.lessons) {
          setAvailableLessons(result.lessons);
        }
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Get unique levels from available lessons
  const availableLevels = [...new Set(availableLessons.map(l => getLevelNumber(l)))].sort((a, b) => a - b);
  
  // Get chapters for selected level
  const availableChapters = selectedLevel !== null 
    ? [...new Set(availableLessons.filter(l => getLevelNumber(l) === selectedLevel).map(l => getChapterNumber(l)))].sort((a, b) => a - b)
    : [];
  
  // Get lessons for selected level and chapter
  const filteredLessons = selectedLevel !== null && selectedChapter !== null
    ? availableLessons.filter(l => getLevelNumber(l) === selectedLevel && getChapterNumber(l) === selectedChapter)
    : [];
  const chosenCourseLabel = chosenLesson
    ? courses.find(course => course.id === chosenLesson.courseId)?.name || 'Lesson Material'
    : 'Not selected';
  const previousLessonLabel = chosenLesson && chosenLesson.lessonNumber > 1
    ? `Lesson ${chosenLesson.lessonNumber - 1}`
    : 'No previous lesson';
  const previousLessonMeta = chosenLesson && chosenLesson.lessonNumber > 1
    ? 'Completed before your current material'
    : 'This is the first lesson in the sequence';
  const recommendedLessonLabel = chosenLesson
    ? `Lesson ${chosenLesson.lessonNumber + 1}`
    : 'Choose a material below';
  const recommendedLessonMeta = chosenLesson
    ? 'Recommended next step in this course'
    : 'Your recommendation appears after selecting a lesson';
  const selectedCourseLevelLessons = selectedLevel !== null
    ? availableLessons.filter(lesson => getLevelNumber(lesson) === selectedLevel)
    : [];
  const selectedLevelSummary = selectedLevel !== null
    ? `${selectedCourseLevelLessons.length} lesson${selectedCourseLevelLessons.length === 1 ? '' : 's'} available`
    : availableLevels.length > 0
      ? `${availableLevels.length} level${availableLevels.length === 1 ? '' : 's'} available`
      : 'Levels will appear here';
  const selectedChapterSummary = selectedLevel === null
    ? 'Choose a level first'
    : availableChapters.length > 0
      ? `${availableChapters.length} chapter${availableChapters.length === 1 ? '' : 's'} in this level`
      : 'No chapters available yet';
  const selectedLesson = selectedLessonId
    ? filteredLessons.find(lesson => lesson.id === selectedLessonId) || null
    : null;
  const selectedLessonSummary = selectedLesson
    ? selectedLesson.lessonData?.header?.goalText || selectedLesson.title
    : filteredLessons.length > 0
      ? `${filteredLessons.length} lesson${filteredLessons.length === 1 ? '' : 's'} in this chapter`
      : selectedChapter === null
        ? 'Choose a chapter first'
        : 'No lessons available yet';
  const hasOpenMaterial = Boolean(chosenLesson || viewingDispatchArticle || viewingConversationalLesson);
  const materialTabTitle = viewingDispatchArticle?.title
    || viewingConversationalLesson?.title
    || chosenLesson?.title
    || 'Selected Material';
  const materialTabContext = viewingDispatchArticle
    ? viewingDispatchArticle.category
    : viewingConversationalLesson
      ? `Level ${viewingConversationalLesson.level} • Chapter ${viewingConversationalLesson.chapter}`
      : chosenLesson
        ? chosenCourseLabel
        : 'Open material';
  const materialTabIconClass = viewingDispatchArticle
    ? 'fas fa-newspaper'
    : viewingConversationalLesson
      ? 'fas fa-comments'
      : 'fas fa-book-open';

  // Handle selecting a new material
  const handleApplyMaterial = async () => {
    if (!selectedLessonId) return;
    
    const selectedLesson = availableLessons.find(l => l.id === selectedLessonId);
    if (selectedLesson) {
      const newLesson = {
        lessonId: selectedLesson.id,
        courseId: selectedCourse,
        title: selectedLesson.title,
        lessonNumber: getLessonNumber(selectedLesson),
        goal: selectedLesson.lessonData?.header?.goalText || ''
      };
      
      setChosenLesson(newLesson);
      
      // Save to backend
      try {
        await studentApi.saveLastViewedLesson({
          courseId: newLesson.courseId,
          lessonId: newLesson.lessonId,
          lessonNumber: newLesson.lessonNumber,
          title: newLesson.title,
          goal: newLesson.goal,
          viewedAt: Date.now()
        });
      } catch (err) {
        console.error('Failed to save lesson selection:', err);
      }
      
      // Fetch the lesson viewUrl for iframe display
      setLoadingViewUrl(true);
      try {
        const nextViewUrl = await resolveStudentMaterialViewUrl(selectedCourse, selectedLesson.id);
        setLessonViewUrl(nextViewUrl);
      } catch (err) {
        console.error('Failed to get lesson view URL:', err);
      } finally {
        setLoadingViewUrl(false);
      }
      
      // Reset selectors and hide lesson request to show material
      setSelectedCourse('');
      setSelectedLevel(null);
      setSelectedChapter(null);
      setSelectedLessonId('');
      setAvailableLessons([]);
      setShowLessonRequest(false);
    }
  };

  // Fetch last viewed lesson and student profile on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingLesson(true);
        
        // Fetch both lesson and profile in parallel
        const [lessonResponse, profileResponse] = await Promise.all([
          studentApi.getLastViewedLesson(),
          studentApi.getStudentProfile()
        ]);
        
        if (lessonResponse.success && lessonResponse.data) {
          const lessonData = lessonResponse.data;
          setChosenLesson({
            lessonId: lessonData.lessonId || '',
            courseId: lessonData.courseId || '',
            title: lessonData.title || '',
            lessonNumber: lessonData.lessonNumber || 1,
            goal: lessonData.goal || ''
          });
          
          // Also fetch the lesson viewUrl for iframe display
          if (lessonData.lessonId) {
            try {
              const nextViewUrl = await resolveStudentMaterialViewUrl(lessonData.courseId, lessonData.lessonId);
              setLessonViewUrl(nextViewUrl);
            } catch (err) {
              console.error('Failed to get lesson view URL:', err);
            }
          }
        }
        
        if (profileResponse.success && profileResponse.data) {
          setStudentProfile(profileResponse.data);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoadingLesson(false);
      }
    };
    
    fetchData();
  }, []);

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
        return;
      } catch {
        // Autoplay blocked, need user interaction
      }
    };
    
    tryAutoUnmute();
    
    // Fallback: enable on first user interaction
    const enableAudio = () => {
      setAudioEnabled(true);
      [remoteVideoRef.current, remotePipRef.current].forEach(video => {
        if (video) {
          video.muted = false;
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
    toggleAudio,
    toggleVideo,
    cleanup
  } = useWebRTC({ remoteUserId: tutorInfo?.id, socket: socketInstance });
  const localHasVideo = Boolean(localStream?.getVideoTracks().some(track => track.readyState === 'live'));
  const remoteHasVideo = Boolean(remoteStream?.getVideoTracks().some(track => track.readyState === 'live'));

  // Mock student data (will be replaced with real data)
  const studentData = {
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
        await startLocalStream(true, true);
      } catch (err) {
        console.error('❌ [Classroom] Failed to start media:', err);
      }
    };

    initWebRTC();
  }, []); // Empty deps - only run once on mount

  // The tutor side owns WebRTC offer creation. The student waits for the offer
  // and answers it, which avoids simultaneous-offer glare.

  // Attach all streams to all video refs - robust effect with interval checking
  useEffect(() => {
    const attachStreams = () => {
      let attached = false;
      
      if (localStream) {
        if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
          attached = true;
        }
        if (localPipRef.current && localPipRef.current.srcObject !== localStream) {
          localPipRef.current.srcObject = localStream;
          localPipRef.current.play().catch(() => {});
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
          attached = true;
        }
        if (remotePipRef.current && remotePipRef.current.srcObject !== remoteStream) {
          remotePipRef.current.srcObject = remoteStream;
          remotePipRef.current.play().catch(() => {});
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

  // Listen for close messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'close-lesson-material') {
        setViewingConversationalLesson(null);
        setConversationalViewUrl(null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // File handling functions
  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
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

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; fileName: string; fileType: 'image' | 'file'; fileSize: number } | null> => {
    // For demo purposes, convert to base64 data URL
    // In production, upload to cloud storage (S3, Cloudinary, etc.)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          url: dataUrl,
          fileName: file.name,
          fileType: file.type.startsWith('image/') ? 'image' : 'file',
          fileSize: file.size
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedFile) || !currentSessionId) return;
    
    try {
      let fileData: { url: string; fileName: string; fileType: 'image' | 'file'; fileSize: number } | null = null;
      
      if (selectedFile) {
        setIsUploading(true);
        fileData = await uploadFile(selectedFile);
        setIsUploading(false);
        
        if (!fileData) {
          toast.error('Failed to upload file');
          return;
        }
      }
      
      const socket = getSocket();
      socket.emit('chat:send', {
        sessionId: currentSessionId,
        text: message.trim() || (fileData ? `Sent ${fileData.fileType === 'image' ? 'an image' : 'a file'}: ${fileData.fileName}` : ''),
        fileUrl: fileData?.url,
        fileName: fileData?.fileName,
        fileType: fileData?.fileType,
        fileSize: fileData?.fileSize
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsUploading(false);
    }
    
    handleTyping(false);
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

  const handleLeaveClassroom = async () => {
    if (await toastConfirm('Are you sure you want to leave the classroom?', 'Leave Classroom')) {
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
            <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse" style={{ height: '32px' }} />
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
            {/* All video elements always rendered, visibility controlled by isSwapped */}
            {/* Remote video in main (visible when swapped) */}
            <video 
              ref={(el) => {
                remoteVideoRef.current = el;
                if (el && remoteStream && el.srcObject !== remoteStream) {
                  el.srcObject = remoteStream;
                  el.muted = !audioEnabled;
                  el.play().catch(() => {});
                }
              }}
              autoPlay 
              playsInline 
              muted={!audioEnabled}
              className="remote-video"
              style={{ display: isSwapped && remoteHasVideo ? 'block' : 'none' }}
            />
            {/* Remote placeholder in main (visible when swapped and no stream) */}
            {isSwapped && !remoteHasVideo && (
              <div className="video-placeholder student-video">
                <div className="video-avatar-large">{studentData.initials}</div>
                <span className="video-name">{studentData.name}</span>
                {!isConnected && tutorInfo && <span className="connection-text">Connecting...</span>}
              </div>
            )}
            {/* Local video in main (visible when not swapped) */}
            <video 
              ref={localVideoRef} 
              muted 
              autoPlay 
              playsInline 
              className="local-video" 
              style={{ display: !isSwapped && !isVideoOff && localHasVideo ? 'block' : 'none' }}
            />
            {/* Speaking indicator for local in main */}
            {!isSwapped && !isVideoOff && localHasVideo && (
              <div className={`mic-indicator mic-large ${isSpeakingLocal ? 'active' : ''}`}> 
                <div className="mic-dot" />
              </div>
            )}
            {/* Local placeholder in main (visible when not swapped and video off) */}
            {!isSwapped && (isVideoOff || !localHasVideo) && (
              <div className="video-placeholder tutor-video">
                <div className="video-avatar-large">
                  {user?.firstName?.charAt(0) || 'S'}{user?.lastName?.charAt(0) || ''}
                </div>
                <span className="video-name">{user?.firstName || 'Student'}</span>
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
              style={{ display: isSwapped && !isVideoOff && localHasVideo ? 'block' : 'none' }}
              ref={localPipRef}
            />
            {/* Speaking indicator for local in PiP */}
            {isSwapped && !isVideoOff && localHasVideo && (
              <div className={`mic-indicator ${isSpeakingLocal ? 'active' : ''}`}>
                <div className="mic-dot" />
              </div>
            )}
            {/* Local placeholder in PiP (visible when swapped and video off) */}
            {isSwapped && (isVideoOff || !localHasVideo) && (
              <div className="video-placeholder tutor-video">
                <div className="video-avatar-small">
                  {user?.firstName?.charAt(0) || 'S'}{user?.lastName?.charAt(0) || ''}
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
                }
              }}
              style={{ display: !isSwapped && remoteHasVideo ? 'block' : 'none' }}
            />
            {/* Remote placeholder in PiP (visible when not swapped and no stream) */}
            {!isSwapped && !remoteHasVideo && (
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
            {chatMessages.map((msg) => {
              // In student app: student messages are "self" (right), tutor messages are "other" (left)
              const isOwnMessage = msg.sender === 'student';
              return (
              <div key={msg.id} className={`chat-message ${isOwnMessage ? 'self' : 'other'}`}>
                {msg.correction && (
                  <div className="message-correction">
                    <span className="label">You said:</span> {msg.text}
                    <br />
                    <span className="label">Correct:</span> {msg.correction}
                  </div>
                )}
                {!msg.correction && (
                  <div className="message-bubble">
                    {/* Display image if present */}
                    {msg.fileUrl && msg.fileType === 'image' && (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={msg.fileUrl} 
                          alt={msg.fileName || 'Shared image'} 
                          className="message-image"
                        />
                      </a>
                    )}
                    {/* Display file link if present */}
                    {msg.fileUrl && msg.fileType === 'file' && (
                      <a 
                        href={msg.fileUrl} 
                        download={msg.fileName}
                        className="message-file"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <i className="fi fi-sr-file"></i>
                        <span className="file-info">
                          <span className="file-name">{msg.fileName}</span>
                          {msg.fileSize && <span className="file-size">{formatFileSize(msg.fileSize)}</span>}
                        </span>
                      </a>
                    )}
                    {/* Display formatted text */}
                    {msg.text && (!msg.fileUrl || !msg.text.startsWith('Sent ')) && (
                      <span>{formatMessageText(msg.text)}</span>
                    )}
                  </div>
                )}
                <span className="message-time">{msg.timestamp}</span>
              </div>
              );
            })}
            {remoteTyping && (
              <div className="typing-indicator">
                <span>Tutor is typing</span>
                <span className="typing-dots">...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {/* File Preview Bar */}
          {selectedFile && (
            <div className="file-preview-bar">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="file-preview-thumb" />
              ) : (
                <i className="fi fi-sr-file file-preview-icon"></i>
              )}
              <span className="file-preview-name">{selectedFile.name}</span>
              <span className="file-preview-size">{formatFileSize(selectedFile.size)}</span>
              <button className="file-preview-remove" onClick={clearSelectedFile} title="Remove file">
                <i className="fi fi-sr-cross-small"></i>
              </button>
            </div>
          )}
          <div className="chat-input-area">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
            />
            <button 
              className="attach-btn" 
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              disabled={isUploading}
            >
              <i className="fi fi-sr-clip"></i>
            </button>
            <textarea
              placeholder="Type a message... (*bold* _italic_) | Shift+Enter for new line"
              value={message}
              onChange={(e) => {
                const newValue = (e.target as HTMLTextAreaElement).value;
                setMessage(newValue);
                handleTyping(newValue.trim().length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isUploading) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              onBlur={() => handleTyping(false)}
              disabled={isUploading}
              rows={1}
            />
            <button 
              className="send-btn" 
              onClick={handleSendMessage}
              disabled={isUploading || (!message.trim() && !selectedFile)}
            >
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
        <div className="material-topbar">
          <div className="material-header">
            <i className="fi fi-sr-book-open-reader"></i>
            <span>Learning Material</span>
          </div>
          <div className="material-tabs">
            <button
              type="button"
              className={`material-tab ${showLessonRequest ? 'is-active' : ''}`}
              onClick={() => setShowLessonRequest(true)}
            >
              <span className="material-tab-icon" aria-hidden="true">
                <i className="fas fa-clipboard-list"></i>
              </span>
              <span className="material-tab-copy">
                <span className="material-tab-label">Lesson Selection</span>
                <span className="material-tab-meta">Request and material picker</span>
              </span>
            </button>
            {hasOpenMaterial && (
              <button
                type="button"
                className={`material-tab ${!showLessonRequest ? 'is-active' : ''}`}
                onClick={() => setShowLessonRequest(false)}
              >
                <span className="material-tab-icon" aria-hidden="true">
                  <i className={materialTabIconClass}></i>
                </span>
                <span className="material-tab-copy">
                  <span className="material-tab-label">{materialTabTitle}</span>
                  <span className="material-tab-meta">{materialTabContext}</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Material Header - conditionally show dispatch/conversational header */}
        {!showLessonRequest && viewingDispatchArticle ? (
          <div className={`dispatch-view-header ${selectedCourse === 'daily-dispatch' ? 'daily-dispatch-theme' : ''}`}>
            <button 
              className="btn-back-to-request"
              onClick={() => setViewingDispatchArticle(null)}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Back to Selection
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">{viewingDispatchArticle.category}</span>
              <span className="dispatch-view-date">
                {new Date(viewingDispatchArticle.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        ) : !showLessonRequest && viewingConversationalLesson ? (
          <div className="dispatch-view-header conversational-theme">
            <button 
              className="btn-back-to-request"
              onClick={() => {
                setViewingConversationalLesson(null);
                setConversationalViewUrl(null);
              }}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Back to Selection
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">Level {viewingConversationalLesson.level}</span>
              <span className="dispatch-view-date">
                Chapter {viewingConversationalLesson.chapter} • Lesson {viewingConversationalLesson.lessonNumber}
              </span>
            </div>
          </div>
        ) : null}

        {/* Chosen Material Display or PDF Viewer */}
        <div className={`material-content ${showLessonRequest ? 'material-content--request' : ''}`}>
          {loadingLesson ? (
            <div className="material-loading">
              <div className="spinner"></div>
              <p>Loading your lesson...</p>
            </div>
          ) : !showLessonRequest && viewingDispatchArticle ? (
            <iframe 
              src={`/materials/daily-dispatch/${viewingDispatchArticle.id}`}
              className="dispatch-article-iframe"
              title={viewingDispatchArticle.title}
            />
          ) : !showLessonRequest && viewingConversationalLesson && conversationalViewUrl ? (
            <iframe 
              src={conversationalViewUrl}
              className="dispatch-article-iframe conversational-iframe"
              title={viewingConversationalLesson.title}
            />
          ) : showLessonRequest ? (
            <div className="lesson-request-container">
              {/* Lesson Plan Section - always show */}
              <div className="lesson-request-section">
                <div className="lesson-request-header">
                  <div className="lesson-request-title-wrap">
                    <h2 className="lesson-request-title">
                      <i className="fas fa-clipboard-list" />
                      Lesson Request
                    </h2>
                    <p className="lesson-request-subtitle">
                      Review your selected lesson before class begins.
                    </p>
                  </div>
                  <div className="lesson-request-meta">
                    <span className={`lesson-request-status ${chosenLesson ? 'lesson-request-status--ready' : 'lesson-request-status--pending'}`}>
                      {chosenLesson ? 'Material chosen' : 'Awaiting selection'}
                    </span>
                    <p className="lesson-request-updated">
                      Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
                
                <div className="lesson-request-body">
                  <div className="lesson-request-content">
                    <div className="lesson-request-details">
                      <div className="request-material-summary">
                        <div className="request-material-heading">
                          <span className="request-eyebrow">Your lesson path</span>
                          <span className="request-course-pill">{chosenCourseLabel}</span>
                        </div>

                        <div className="request-summary-grid request-summary-grid--student">
                          <div className="request-stat-card">
                            <span className="request-detail-label">Previous lesson</span>
                            <span className="request-detail-value request-detail-value--text">{previousLessonLabel}</span>
                            <span className="request-detail-meta">{previousLessonMeta}</span>
                          </div>

                          <div className="request-stat-card">
                            <span className="request-detail-label">Current course</span>
                            <span className="request-detail-value request-detail-value--text">{chosenCourseLabel}</span>
                            <span className="request-detail-meta">
                              {chosenLesson ? 'Course library selected for class' : 'Choose a course library below'}
                            </span>
                          </div>

                          <div className="request-stat-card request-stat-card--wide">
                            <span className="request-detail-label">Recommended next lesson</span>
                            <span className="request-detail-value request-detail-value--text">{recommendedLessonLabel}</span>
                            <span className="request-detail-meta">{recommendedLessonMeta}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Hierarchical Material Selector */}
              <div className="material-selector-section">
                <div className="material-selector-header">
                  <div className="material-selector-header-icon">
                    <i className="fas fa-book-open"></i>
                  </div>
                  <div className="material-selector-copy">
                    <label className="material-selector-label">Select a Material</label>
                    <p className="material-selector-description">
                      Choose the course library you want to study from. You can switch materials whenever you need.
                    </p>
                  </div>
                  {chosenLesson && (
                    <span className="material-selector-chip">
                      Requested lesson {chosenLesson.lessonNumber}
                    </span>
                  )}
                </div>
                <div className="material-selector-body">
                  <div className="material-selector-layout">
                    <div className="material-selector-primary">
                      {/* Course Selector */}
                      <div className="material-selector-row material-selector-row--course">
                        <div className="material-selector-field">
                          <span className="material-selector-field-label">Course library</span>
                          <div
                            className={`material-selector-combobox ${isCourseDropdownOpen ? 'is-open' : ''}`}
                            ref={courseDropdownRef}
                          >
                            <button
                              type="button"
                              className="material-selector-trigger"
                              onClick={toggleCourseDropdown}
                              aria-haspopup="listbox"
                              aria-expanded={isCourseDropdownOpen}
                            >
                              <span className="material-selector-trigger-content">
                                {selectedCourseOption ? (
                                  <>
                                    <span className="material-selector-trigger-icon" aria-hidden="true">
                                      {selectedCourseOption.icon}
                                    </span>
                                    <span className="material-selector-trigger-copy">
                                      <span className="material-selector-trigger-title">{selectedCourseOption.name}</span>
                                      <span className="material-selector-trigger-subtitle">{selectedCourseOption.description}</span>
                                    </span>
                                  </>
                                ) : (
                                  <span className="material-selector-trigger-placeholder">
                                    Select a course library
                                  </span>
                                )}
                              </span>
                              <span className="material-selector-trigger-arrow" aria-hidden="true">
                                <i className={`fas ${isCourseDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                              </span>
                            </button>

                            {isCourseDropdownOpen && (
                              <div
                                className="material-selector-menu"
                                role="listbox"
                                aria-label="Course library"
                                style={courseDropdownMenuStyle || undefined}
                              >
                                {courses.map(course => (
                                  <button
                                    key={course.id}
                                    type="button"
                                    className={`material-selector-option ${selectedCourse === course.id ? 'is-selected' : ''}`}
                                    onClick={() => {
                                      setIsCourseDropdownOpen(false);
                                      void handleCourseChange(course.id);
                                    }}
                                    role="option"
                                    aria-selected={selectedCourse === course.id}
                                  >
                                    <span className="material-selector-option-icon" aria-hidden="true">
                                      {course.icon}
                                    </span>
                                    <span className="material-selector-option-copy">
                                      <span className="material-selector-option-title">{course.name}</span>
                                      <span className="material-selector-option-description">{course.description}</span>
                                    </span>
                                    {selectedCourse === course.id && (
                                      <span className="material-selector-option-check" aria-hidden="true">
                                        <i className="fas fa-check"></i>
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="material-selector-secondary">
                      {!selectedCourse && (
                        <div className="material-selector-empty-panel">
                          <div className="material-selector-empty-icon">
                            <i className="fas fa-arrow-left"></i>
                          </div>
                          <div>
                            <p className="material-selector-empty-title">Choose a course to begin</p>
                            <p className="material-selector-empty-copy">
                              After choosing a library, the available levels, chapters, and lessons appear here.
                            </p>
                          </div>
                        </div>
                      )}
                {/* Daily Dispatch Card - shows when Daily Dispatch is selected */}
                {showSelectedCourseDetails && selectedCourse === 'daily-dispatch' && (
                  <>
                    {/* Latest Article Card */}
                    <div className="dispatch-article-card">
                      <div className="dispatch-card-label">Latest Article</div>
                      {loadingDispatch ? (
                        <div className="dispatch-loading">
                          <div className="spinner-small"></div>
                          <span>Loading...</span>
                        </div>
                      ) : dispatchArticles.length > 0 ? (
                        <>
                          <div className="dispatch-table-header">
                            <span className="dispatch-col-date">Post Date</span>
                            <span className="dispatch-col-title">Title</span>
                            <span className="dispatch-col-category">Category</span>
                            <span className="dispatch-col-action">Action</span>
                          </div>
                          <div className="dispatch-table-row">
                            <span className="dispatch-col-date">
                              {new Date(dispatchArticles[0].createdAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="dispatch-col-title">{dispatchArticles[0].title}</span>
                            <span className="dispatch-col-category">{dispatchArticles[0].category}</span>
                            <button 
                              className="dispatch-col-action dispatch-open-link"
                              onClick={() => setViewingDispatchArticle(dispatchArticles[0])}
                            >
                              Open Article
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="dispatch-empty">
                          <p>No articles available</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Previous Articles Card */}
                    {dispatchArticles.length > 1 && (
                      <div className="dispatch-article-card dispatch-previous-card">
                        <div className="dispatch-card-label">Previous Articles</div>
                        <div className="dispatch-table-header">
                          <span className="dispatch-col-date">Post Date</span>
                          <span className="dispatch-col-title">Title</span>
                          <span className="dispatch-col-category">Category</span>
                          <span className="dispatch-col-action">Action</span>
                        </div>
                        {dispatchArticles.slice(1).map((article) => (
                          <div className="dispatch-table-row" key={article.id}>
                            <span className="dispatch-col-date">
                              {new Date(article.createdAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="dispatch-col-title">{article.title}</span>
                            <span className="dispatch-col-category">{article.category}</span>
                            <button 
                              className="dispatch-col-action dispatch-open-link"
                              onClick={() => setViewingDispatchArticle(article)}
                            >
                              Open Article
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                
                {/* Conversational Skills Card - shows when Conversational Skills is selected */}
                {selectedCourse === 'conversational-skills' && (
                  <>
                    {loadingMaterials ? (
                      <div className="dispatch-article-card">
                        <div className="dispatch-loading">
                          <div className="spinner-small"></div>
                          <span>Loading lessons...</span>
                        </div>
                      </div>
                    ) : availableLessons.length > 0 ? (
                      <>
                        {/* Group lessons by Level, then Chapter */}
                        {availableLevels.map(level => {
                          const levelLessons = availableLessons.filter(l => getLevelNumber(l) === level);
                          const chaptersInLevel = [...new Set(levelLessons.map(l => getChapterNumber(l)))].sort((a, b) => a - b);
                          
                          return (
                            <div key={level} className="lesson-card conversational-skills-card">
                              <div className="lesson-card-label">Level {level}</div>
                              {chaptersInLevel.map(chapter => {
                                const chapterLessons = levelLessons
                                  .filter(l => getChapterNumber(l) === chapter)
                                  .sort((a, b) => getLessonNumber(a) - getLessonNumber(b));
                                
                                return (
                                  <div key={chapter} className="lesson-chapter-group">
                                    <div className="lesson-chapter-header">Chapter {chapter}</div>
                                    <div className="lesson-table-header conversational-header">
                                      <span className="lesson-col-number">Lesson</span>
                                      <span className="lesson-col-title">Title</span>
                                      <span className="lesson-col-goal">Goal</span>
                                      <span className="lesson-col-action">Action</span>
                                    </div>
                                    {chapterLessons.map(lesson => {
                                      const goalText = lesson.lessonData?.header?.goalText || '';
                                      return (
                                        <div className="lesson-table-row conversational-row" key={lesson.id}>
                                          <span className="lesson-col-number">Lesson {getLessonNumber(lesson)}</span>
                                          <span className="lesson-col-title">{lesson.title}</span>
                                          <span className="lesson-col-goal" title={goalText}>
                                            {goalText || '—'}
                                          </span>
                                          <button 
                                            className="dispatch-open-link"
                                            onClick={async () => {
                                              // Set the viewing lesson to show in material area
                                              const viewLesson: ConversationalLesson = {
                                                id: lesson.id,
                                                title: lesson.title,
                                                level: level,
                                                chapter: chapter,
                                                lessonNumber: getLessonNumber(lesson),
                                                goalTextEn: goalText
                                              };
                                              setViewingConversationalLesson(viewLesson);
                                              // Use local route directly instead of API call
                                              setConversationalViewUrl(`/materials/conversational-skills/${lesson.id}`);
                                            }}
                                          >
                                            Open Material
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="dispatch-article-card">
                        <div className="dispatch-empty">
                          <p>No lessons available</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {/* Level and chapter selectors - shows for lesson-library courses */}
                {selectedCourse && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && availableLevels.length > 0 && (
                  <div className="material-selector-filter-grid">
                    <div className="material-selector-field">
                      <span className="material-selector-field-label">Level</span>
                      <div
                        className={`material-selector-combobox material-selector-combobox--filter ${isLevelDropdownOpen ? 'is-open' : ''}`}
                        ref={levelDropdownRef}
                      >
                        <button
                          type="button"
                          className="material-selector-trigger material-selector-trigger--filter"
                          onClick={toggleLevelDropdown}
                          aria-haspopup="listbox"
                          aria-expanded={isLevelDropdownOpen}
                        >
                          <span className="material-selector-trigger-content">
                            <span className="material-selector-trigger-icon material-selector-trigger-icon--level" aria-hidden="true">
                              <i className="fas fa-layer-group"></i>
                            </span>
                            <span className="material-selector-trigger-copy">
                              <span className="material-selector-trigger-title">
                                {selectedLevel !== null ? `Level ${selectedLevel}` : 'Select a level'}
                              </span>
                              <span className="material-selector-trigger-subtitle">{selectedLevelSummary}</span>
                            </span>
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isLevelDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>
                        {isLevelDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Level"
                            style={levelDropdownMenuStyle || undefined}
                          >
                            {availableLevels.map(level => {
                              const levelLessons = availableLessons.filter(lesson => getLevelNumber(lesson) === level);

                              return (
                                <button
                                  key={level}
                                  type="button"
                                  className={`material-selector-option ${selectedLevel === level ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    setSelectedLevel(level);
                                    setSelectedChapter(null);
                                    setSelectedLessonId('');
                                    setIsLevelDropdownOpen(false);
                                    setIsChapterDropdownOpen(false);
                                    setIsLessonDropdownOpen(false);
                                  }}
                                  role="option"
                                  aria-selected={selectedLevel === level}
                                >
                                  <span className="material-selector-option-icon material-selector-option-icon--level" aria-hidden="true">
                                    <i className="fas fa-layer-group"></i>
                                  </span>
                                  <span className="material-selector-option-copy">
                                    <span className="material-selector-option-title">Level {level}</span>
                                    <span className="material-selector-option-description">
                                      {levelLessons.length} lesson{levelLessons.length === 1 ? '' : 's'} available
                                    </span>
                                  </span>
                                  {selectedLevel === level && (
                                    <span className="material-selector-option-check" aria-hidden="true">
                                      <i className="fas fa-check"></i>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="material-selector-field">
                      <span className="material-selector-field-label">Chapter</span>
                      <div
                        className={`material-selector-combobox material-selector-combobox--filter ${isChapterDropdownOpen ? 'is-open' : ''}`}
                        ref={chapterDropdownRef}
                      >
                        <button
                          type="button"
                          className="material-selector-trigger material-selector-trigger--filter"
                          onClick={toggleChapterDropdown}
                          aria-haspopup="listbox"
                          aria-expanded={isChapterDropdownOpen}
                          disabled={selectedLevel === null || availableChapters.length === 0}
                        >
                          <span className="material-selector-trigger-content">
                            <span className="material-selector-trigger-icon material-selector-trigger-icon--chapter" aria-hidden="true">
                              <i className="fas fa-list"></i>
                            </span>
                            <span className="material-selector-trigger-copy">
                              <span className="material-selector-trigger-title">
                                {selectedChapter !== null ? `Chapter ${selectedChapter}` : 'Select a chapter'}
                              </span>
                              <span className="material-selector-trigger-subtitle">{selectedChapterSummary}</span>
                            </span>
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isChapterDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>
                        {isChapterDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Chapter"
                            style={chapterDropdownMenuStyle || undefined}
                          >
                            {availableChapters.map(chapter => {
                              const chapterLessons = availableLessons.filter(
                                lesson => getLevelNumber(lesson) === selectedLevel && getChapterNumber(lesson) === chapter
                              );

                              return (
                                <button
                                  key={chapter}
                                  type="button"
                                  className={`material-selector-option ${selectedChapter === chapter ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    setSelectedChapter(chapter);
                                    setSelectedLessonId('');
                                    setIsChapterDropdownOpen(false);
                                    setIsLessonDropdownOpen(false);
                                  }}
                                  role="option"
                                  aria-selected={selectedChapter === chapter}
                                >
                                  <span className="material-selector-option-icon material-selector-option-icon--chapter" aria-hidden="true">
                                    <i className="fas fa-list"></i>
                                  </span>
                                  <span className="material-selector-option-copy">
                                    <span className="material-selector-option-title">Chapter {chapter}</span>
                                    <span className="material-selector-option-description">
                                      {chapterLessons.length} lesson{chapterLessons.length === 1 ? '' : 's'} in this chapter
                                    </span>
                                  </span>
                                  {selectedChapter === chapter && (
                                    <span className="material-selector-option-check" aria-hidden="true">
                                      <i className="fas fa-check"></i>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Lesson Selector - shows when chapter is selected (for other courses) */}
                {selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedChapter !== null && filteredLessons.length > 0 && (
                  <div className="material-selector-row">
                    <div className="material-selector-field">
                      <span className="material-selector-field-label">Lesson</span>
                      <div
                        className={`material-selector-combobox material-selector-combobox--filter ${isLessonDropdownOpen ? 'is-open' : ''}`}
                        ref={lessonDropdownRef}
                      >
                        <button
                          type="button"
                          className="material-selector-trigger material-selector-trigger--filter"
                          onClick={toggleLessonDropdown}
                          aria-haspopup="listbox"
                          aria-expanded={isLessonDropdownOpen}
                        >
                          <span className="material-selector-trigger-content">
                            <span className="material-selector-trigger-icon material-selector-trigger-icon--lesson" aria-hidden="true">
                              <i className="fas fa-book-open"></i>
                            </span>
                            <span className="material-selector-trigger-copy">
                              <span className="material-selector-trigger-title">
                                {selectedLesson ? selectedLesson.title : 'Select a lesson'}
                              </span>
                              <span className="material-selector-trigger-subtitle">{selectedLessonSummary}</span>
                            </span>
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isLessonDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>
                        {isLessonDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Lesson"
                            style={lessonDropdownMenuStyle || undefined}
                          >
                            {filteredLessons
                              .slice()
                              .sort((a, b) => getLessonNumber(a) - getLessonNumber(b))
                              .map(lesson => (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  className={`material-selector-option ${selectedLessonId === lesson.id ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    setSelectedLessonId(lesson.id);
                                    setIsLessonDropdownOpen(false);
                                  }}
                                  role="option"
                                  aria-selected={selectedLessonId === lesson.id}
                                >
                                  <span className="material-selector-option-icon material-selector-option-icon--lesson" aria-hidden="true">
                                    <i className="fas fa-book-open"></i>
                                  </span>
                                  <span className="material-selector-option-copy">
                                    <span className="material-selector-option-title">{lesson.title}</span>
                                    <span className="material-selector-option-description">
                                      {lesson.lessonData?.header?.goalText || `Lesson ${getLessonNumber(lesson)}`}
                                    </span>
                                  </span>
                                  {selectedLessonId === lesson.id && (
                                    <span className="material-selector-option-check" aria-hidden="true">
                                      <i className="fas fa-check"></i>
                                    </span>
                                  )}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Loading indicator - for other courses with dropdowns */}
                {selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && loadingMaterials && (
                  <div className="material-loading-inline">
                    <div className="spinner-small"></div>
                    <span>Loading...</span>
                  </div>
                )}
                
                {/* Select Button - shows when a lesson is selected (for other courses) */}
                {selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedLessonId && (
                  <div className="material-selector-row">
                    <button 
                      className="btn-search-material"
                      onClick={handleApplyMaterial}
                    >
                      <i className="fi fi-sr-check"></i>
                      Select Material
                    </button>
                  </div>
                )}
                </div>
                </div>
              </div>
            </div>
            </div>
          ) : chosenLesson && !showLessonRequest ? (
            <div className="lesson-material-view">
              {loadingViewUrl ? (
                <div className="material-loading">
                  <div className="spinner"></div>
                  <p>Loading lesson...</p>
                </div>
              ) : lessonViewUrl ? (
                <iframe 
                  src={lessonViewUrl}
                  className="lesson-material-iframe"
                  title={chosenLesson.title}
                />
              ) : (
                <div className="material-loading">
                  <p>Unable to load lesson view</p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-material-selected">
              <div className="empty-material-icon">
                <i className="fi fi-sr-book-open-cover"></i>
              </div>
              <h3>No Lesson Selected</h3>
              <p>Choose a lesson from your profile to use during your class</p>
              <a href="/profile" className="btn-select-material">
                <i className="fi fi-sr-plus"></i>
                Select a Lesson
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Ended Toast Notification */}
      {lessonEndedMessage && (
        <div className="lesson-ended-toast">
          <div className="toast-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="toast-content">
            <span className="toast-title">Lesson Time Over</span>
            <span className="toast-message">{lessonEndedMessage}</span>
          </div>
          <button 
            className="toast-close"
            onClick={() => setLessonEndedMessage(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ClassroomPage;

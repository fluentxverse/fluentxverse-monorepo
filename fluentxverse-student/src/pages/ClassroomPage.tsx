import { useState, useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket, fetchSocketAuthToken } from '../client/socket/socket.client';
import { useClassroomMedia } from '../hooks/useClassroomMedia';
import { ClassroomRecordingNotice } from '../Components/ClassroomRecordingNotice';
import { useClassroomStart } from '../hooks/useClassroomStart';
import { classroomCallStatus } from '../utils/classroomCallStatus';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import StudentLessonIssueReport from '../Components/StudentLessonIssueReport';
import ClassroomLessonSurvey from '../Components/ClassroomLessonSurvey';
import { toast, toastConfirm } from '../Components/Common/Toast';
import { studentApi, type StudentProfile, type LessonPreferences } from '../api/student.api';
import { lessonApi, type Lesson } from '../api/lesson.api';
import type { ChatMessageData, ClassroomActivityLogData, SharedClassroomMaterial, ShareMaterialResult } from '../types/socket.types';
import type { Socket } from 'socket.io-client';
import DispatchMaterialPicker from '../Components/DispatchMaterialPicker';
import CurriculumMaterialPicker from '../Components/CurriculumMaterialPicker';
import { dispatchPostDate, type DispatchArticle } from '../utils/dispatchLibrary';
import { useThemeStore } from '../context/ThemeContext';
import { materialFrameUrl } from '../utils/materialFrameUrl';
import './ClassroomPage.css';

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
  material?: SharedClassroomMaterial;
  id: string;
  sender: 'tutor' | 'student';
  text: string;
  timestamp: string;
  correction?: string;
  isEdited?: boolean;
  editedAt?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
}

interface MediaDeviceSettings {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

const CLASSROOM_DEVICE_SETTINGS_KEY = 'fxv-classroom-device-settings';

const readSavedDeviceSettings = (): MediaDeviceSettings => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(CLASSROOM_DEVICE_SETTINGS_KEY);
    return raw ? JSON.parse(raw) as MediaDeviceSettings : {};
  } catch {
    return {};
  }
};

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

const shouldShowMessageText = (msg: ChatMessage) =>
  Boolean(msg.text && (!msg.fileUrl || !msg.text.startsWith('Sent ')));

// Format file size for display
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ClassroomPage = ({ sessionId }: ClassroomPageProps) => {
  const [mediaProvider, setMediaProvider] = useState<'webrtc' | 'realtimekit'>();
  useEffect(() => {
    document.title = 'Classroom | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const isDarkMode = useThemeStore(state => state.isDarkMode);
  const materialLoadId = useRef(0);
  const materialOpenId = useRef(0);
  const { route } = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localPipRef = useRef<HTMLVideoElement>(null);
  const remotePipRef = useRef<HTMLVideoElement>(null);
  
  // Track stream IDs for forcing re-renders
  const [localStreamId, setLocalStreamId] = useState<string>('');
  const [remoteStreamId, setRemoteStreamId] = useState<string>('');
  
  // Socket state for passing to child components
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [classroomJoined, setClassroomJoined] = useState(false);
  const lastSharedMaterial = useRef<string | null>(null);
  const [signalingConnected, setSignalingConnected] = useState(false);
  const [signalingError, setSignalingError] = useState<string | null>(null);
  
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
  const lessonStart = useClassroomStart(socketInstance, currentSessionId);
  
  // Initialize socket and join session
  useEffect(() => {
    if (!currentSessionId) return;

    let socket: Socket | null = null;
    let isCancelled = false;

    // Wait for connection before joining
    const onConnect = () => {
      if (!socket) return;
      setClassroomJoined(false);
      setSignalingConnected(true);
      setSignalingError(null);
      socket.emit('session:join', { sessionId: currentSessionId });
    };
    const onDisconnect = () => {
      setClassroomJoined(false);
      setSignalingConnected(false);
      setIsConnecting(true);
    };
    const onConnectError = () => setSignalingError('Unable to connect to the lesson. Check your connection and try again.');
    
    // Handle incoming chat messages
    const onChatMessage = (data: ChatMessageData) => {
      if (data.isDeleted) {
        setChatMessages(prev => prev.filter(msg => msg.id !== data.id));
        setOpenMessageMenuId(prev => prev === data.id ? null : prev);
        setEditingMessageId(prev => prev === data.id ? null : prev);
        return;
      }

      const newMsg: ChatMessage = {
        id: data.id,
        sender: data.senderType,
        text: data.text,
        timestamp: new Date(data.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        correction: data.correction,
        isEdited: data.isEdited,
        editedAt: data.editedAt,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        material: data.material
      };
      setChatMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, newMsg];
      });
    };

    const onChatMessageUpdated = (data: ChatMessageData) => {
      if (data.isDeleted) {
        setChatMessages(prev => prev.filter(msg => msg.id !== data.id));
        setOpenMessageMenuId(prev => prev === data.id ? null : prev);
        setEditingMessageId(prev => prev === data.id ? null : prev);
        return;
      }

      setChatMessages(prev => prev.map(msg =>
        msg.id === data.id
          ? {
              ...msg,
              text: data.text,
              correction: data.correction,
              isEdited: data.isEdited,
              editedAt: data.editedAt
            }
          : msg
      ));
    };

    const onChatMessageDeleted = (data: { sessionId?: string; messageId?: string; id?: string }) => {
      if ('sessionId' in data && data.sessionId && data.sessionId !== currentSessionId) return;

      const deletedMessageId = data.messageId ?? data.id;
      if (!deletedMessageId) return;

      setChatMessages(prev => prev.filter(msg => msg.id !== deletedMessageId));
      setOpenMessageMenuId(prev => prev === deletedMessageId ? null : prev);
      setEditingMessageId(prev => prev === deletedMessageId ? null : prev);
    };

    const onChatError = (data: { message: string }) => {
      toast.error(data.message);
    };
    const onSessionError = (data: { message: string }) => {
      setSignalingError(data.message);
      toast.error(data.message);
    };
    
    // Handle chat history
    const onChatHistory = (messages: ChatMessageData[]) => {
      const formattedMessages: ChatMessage[] = messages.map(msg => ({
        id: msg.id,
        sender: msg.senderType,
        text: msg.text,
        timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        correction: msg.correction,
        isEdited: msg.isEdited,
        editedAt: msg.editedAt,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileType: msg.fileType,
        fileSize: msg.fileSize,
        material: msg.material
      }));
      setChatMessages(formattedMessages);
    };
    
    // Handle typing indicator
    const onTyping = (data: { userId: string; isTyping: boolean }) => {
      setRemoteTyping(data.isTyping);
    };
    
    // Handle session state
    const onSessionState = (data: any) => {
      if (data.sessionId !== currentSessionId) return;
      setMediaProvider(previous => data.mediaProvider || previous || 'webrtc');
      setClassroomJoined(true);
      socket?.emit('chat:request-history', { sessionId: currentSessionId });
      setIsConnecting(!data.participants?.tutorId);
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
        setIsConnecting(true);
      }
    };

    const onVideoState = (data: { sessionId: string; userType: 'tutor' | 'student'; enabled: boolean }) => {
      if (data.sessionId !== currentSessionId || data.userType !== 'tutor') return;
      setRemoteVideoEnabled(data.enabled);
    };
    
    // Handle lesson ended by tutor
    const onLessonEnded = (data: { tutorId: string; message?: string }) => {
      setLessonEndedMessage(data.message || 'The tutor has ended the lesson. Thank you for learning with us!');
    };

    const onActivityHistory = (logs: ClassroomActivityLogData[]) => {
      setActivityLogs(logs);
      setIsHistoryLoading(false);
    };

    const onActivityLog = (log: ClassroomActivityLogData) => {
      setActivityLogs(prev => prev.some(item => item.id === log.id) ? prev : [...prev, log]);
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
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('chat:message', onChatMessage);
      socket.on('chat:message-updated', onChatMessageUpdated);
      socket.on('chat:message-deleted', onChatMessageDeleted);
      socket.on('chat:history', onChatHistory);
      socket.on('chat:typing', onTyping);
      socket.on('chat:error', onChatError);
      socket.on('session:state', onSessionState);
      socket.on('session:error', onSessionError);
      socket.on('session:user-joined', onUserJoined);
      socket.on('session:user-left', onUserLeft);
      socket.on('session:lesson-ended', onLessonEnded);
      socket.on('classroom:video-state', onVideoState);
      socket.on('classroom:activity-history', onActivityHistory);
      socket.on('classroom:activity-log', onActivityLog);

      if (socket.connected) {
        onConnect();
      } else {
        connectSocket();
      }
    };

    void setupSocket().catch((error) => {
      console.error('Failed to initialize classroom socket:', error);
      if (!isCancelled) onConnectError();
    });
    
    return () => {
      isCancelled = true;
      if (!socket) return;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:message-updated', onChatMessageUpdated);
      socket.off('chat:message-deleted', onChatMessageDeleted);
      socket.off('chat:history', onChatHistory);
      socket.off('chat:typing', onTyping);
      socket.off('chat:error', onChatError);
      socket.off('session:state', onSessionState);
      socket.off('session:error', onSessionError);
      socket.off('session:user-joined', onUserJoined);
      socket.off('session:user-left', onUserLeft);
      socket.off('session:lesson-ended', onLessonEnded);
      socket.off('classroom:video-state', onVideoState);
      socket.off('classroom:activity-history', onActivityHistory);
      socket.off('classroom:activity-log', onActivityLog);
      if (socket.connected) socket.emit('session:leave');
      socket.disconnect();
      setSocketInstance(null);
    };
  }, [currentSessionId]);
  
  // State
  const [message, setMessage] = useState('');
  const elapsedTime = lessonStart.elapsed;
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSwapped, setIsSwapped] = useState(true);
  const [tutorInfo, setTutorInfo] = useState<{ name: string; id: string; initials: string; date: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [lessonEndedMessage, setLessonEndedMessage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ClassroomActivityLogData[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(() => readSavedDeviceSettings().audioDeviceId || '');
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(() => readSavedDeviceSettings().videoDeviceId || '');
  const [isApplyingDeviceSettings, setIsApplyingDeviceSettings] = useState(false);
  
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
  const [showLessonRequest, setShowLessonRequest] = useState(true);
  const [lessonViewUrl, setLessonViewUrl] = useState<string | null>(null);
  const [loadingViewUrl, setLoadingViewUrl] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [courseDropdownMenuStyle, setCourseDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  
  // Course definitions
  const courses = [
    { id: 'conversational-skills', name: 'Conversational Skills', icon: '💬', description: 'Conversation lessons for practical speaking practice.' },
    { id: 'business-english', name: 'Business English', icon: '💼', description: 'Workplace English lessons and professional scenarios.' },
    { id: 'daily-dispatch', name: 'Daily Dispatch', icon: '📰', description: 'News-based reading and discussion material.' },
  ];
  const selectedCourseOption = courses.find(course => course.id === selectedCourse) || null;
  const showSelectedCourseDetails = Boolean(selectedCourse);

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

  const toggleCourseDropdown = () => {
    if (isCourseDropdownOpen) {
      setIsCourseDropdownOpen(false);
      return;
    }
    updateCourseDropdownMenuPosition();
    setIsCourseDropdownOpen(true);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!courseDropdownRef.current?.contains(event.target as Node)) setIsCourseDropdownOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCourseDropdownOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isCourseDropdownOpen) {
      setCourseDropdownMenuStyle(null);
      return;
    }
    const syncPosition = () => updateCourseDropdownMenuPosition();
    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [isCourseDropdownOpen]);

  useEffect(() => () => {
    materialLoadId.current += 1;
    materialOpenId.current += 1;
  }, []);

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
  const [viewingDispatchArticle, setViewingDispatchArticle] = useState<DispatchArticle | null>(null);
  
  // Conversational Skills viewing state
  const [viewingConversationalLesson, setViewingConversationalLesson] = useState<ConversationalLesson | null>(null);
  const [conversationalViewUrl, setConversationalViewUrl] = useState<string | null>(null);
  
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

  const handleCourseChange = async (courseId: string) => {
    const requestId = ++materialLoadId.current;
    setSelectedCourse(courseId);
    setAvailableLessons([]);
    setLoadingMaterials(false);
    if (!courseId || courseId === 'daily-dispatch') return;
    setLoadingMaterials(true);
    try {
      const result = isLessonMaterialCourse(courseId)
        ? await lessonApi.getPublishedLessonMaterials(courseId)
        : await lessonApi.getPublishedLessons(courseId);
      if (requestId !== materialLoadId.current) return;
      if (!result.success || !result.lessons) throw new Error('Could not load course');
      setAvailableLessons(isLessonMaterialCourse(courseId)
        ? result.lessons.map(transformLessonMaterialToLesson)
        : result.lessons);
    } catch (err) {
      if (requestId === materialLoadId.current) toast.error('Could not load lessons. Please choose the course again.');
    } finally {
      if (requestId === materialLoadId.current) setLoadingMaterials(false);
    }
  };

  const chosenCourseLabel = chosenLesson
    ? courses.find(course => course.id === chosenLesson.courseId)?.name || 'Lesson Material'
    : 'Not selected';
  const previousLessonLabel = chosenLesson && chosenLesson.lessonNumber > 1
    ? `Lesson ${chosenLesson.lessonNumber - 1}`
    : 'No previous lesson';
  const previousLessonMeta = chosenLesson && chosenLesson.lessonNumber > 1
    ? 'Completed before your current material'
    : 'This is the first lesson in the sequence';
  const hasOpenMaterial = Boolean(chosenLesson || viewingDispatchArticle || viewingConversationalLesson);
  const openedMaterialId = viewingDispatchArticle?.id || viewingConversationalLesson?.id || chosenLesson?.lessonId;
  const openedMaterialCourse = viewingDispatchArticle ? 'daily-dispatch'
    : viewingConversationalLesson ? 'conversational-skills' : chosenLesson?.courseId;

  useEffect(() => {
    if (!lessonStart.live || showLessonRequest || loadingLesson || loadingViewUrl || !classroomJoined || !socketInstance?.connected
      || !openedMaterialId || !openedMaterialCourse || !currentSessionId
      || (!viewingDispatchArticle && !viewingConversationalLesson && !lessonViewUrl)
      || !['daily-dispatch', 'conversational-skills', 'business-english'].includes(openedMaterialCourse)) return;
    const key = `${currentSessionId}:${openedMaterialCourse}:${openedMaterialId}`;
    if (lastSharedMaterial.current === key) return;
    lastSharedMaterial.current = key;
    socketInstance.timeout(10000).emit('chat:share-material', {
      sessionId: currentSessionId, courseId: openedMaterialCourse, materialId: openedMaterialId,
    }, (error: Error | null, result?: ShareMaterialResult) => {
      if (error || !result?.success) {
        if (lastSharedMaterial.current === key) lastSharedMaterial.current = null;
        toast.error(result?.message || 'Material was not sent to your tutor. Reopen it to try again.');
      }
    });
  }, [lessonStart.live, showLessonRequest, loadingLesson, loadingViewUrl, classroomJoined, socketInstance,
    openedMaterialId, openedMaterialCourse, currentSessionId, lessonViewUrl]);
  const isViewingBusinessEnglishMaterial = !showLessonRequest && !viewingDispatchArticle && !viewingConversationalLesson && chosenLesson?.courseId === 'business-english';
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

  const handleApplyMaterial = async (lessonId: string) => {
    const selectedLesson = availableLessons.find(lesson => lesson.id === lessonId);
    if (!selectedLesson) return;
    const requestId = ++materialOpenId.current;
    const newLesson = {
      lessonId: selectedLesson.id, courseId: selectedCourse, title: selectedLesson.title,
      lessonNumber: getLessonNumber(selectedLesson),
      goal: selectedLesson.lessonData?.header?.goalText || '',
    };
    setChosenLesson(newLesson);
    setViewingDispatchArticle(null);
    setViewingConversationalLesson(selectedCourse === 'conversational-skills' ? {
      id: newLesson.lessonId, title: newLesson.title, level: getLevelNumber(selectedLesson),
      chapter: getChapterNumber(selectedLesson), lessonNumber: newLesson.lessonNumber, goalTextEn: newLesson.goal,
    } : null);
    setConversationalViewUrl(selectedCourse === 'conversational-skills'
      ? `/materials/conversational-skills/${selectedLesson.id}` : null);
    setLessonViewUrl(null);
    setLoadingViewUrl(true);
    setShowLessonRequest(false);
    try {
      const nextViewUrl = await resolveStudentMaterialViewUrl(newLesson.courseId, selectedLesson.id);
      if (requestId === materialOpenId.current) setLessonViewUrl(nextViewUrl);
    } catch (err) {
      if (requestId === materialOpenId.current) toast.error('Could not open this lesson. Please try again.');
    } finally {
      if (requestId === materialOpenId.current) setLoadingViewUrl(false);
    }
    try {
      await studentApi.saveLastViewedLesson({
        sessionId: currentSessionId, ...newLesson, viewedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to save lesson selection:', err);
    }
  };

  // Fetch last viewed lesson and student profile on mount
  useEffect(() => {
    setChosenLesson(null);
    setLessonViewUrl(null);

    const fetchData = async () => {
      try {
        setLoadingLesson(true);
        
        // Fetch both lesson and profile in parallel
        const [lessonResponse, profileResponse] = await Promise.all([
          studentApi.getLastViewedLesson(currentSessionId),
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
  }, [currentSessionId]);

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
    isConnecting: isMediaConnecting,
    error: webrtcError,
    startLocalStream,
    toggleAudio,
    toggleVideo,
    switchMediaDevices,
    cleanup
  } = useClassroomMedia({ provider: mediaProvider, sessionId: currentSessionId, remoteUserId: tutorInfo?.id, socket: socketInstance, enabled: lessonStart.live });
  useEffect(() => { if (lessonStart.closed) cleanup(); }, [lessonStart.closed, cleanup]);
  useEffect(() => {
    if (mediaProvider !== 'webrtc' || !lessonStart.live || !tutorInfo?.id || !socketInstance) return;
    const ready = () => { if (socketInstance.connected) socketInstance.emit('webrtc:ready'); };
    ready();
    const timer = window.setInterval(ready, 4000);
    return () => window.clearInterval(timer);
  }, [mediaProvider, lessonStart.live, tutorInfo?.id, socketInstance]);
  const callConnected = isConnected && signalingConnected && !signalingError && !webrtcError;
  useEffect(() => {
    const update = () => socketInstance?.emit('classroom:call-state', { connected: Boolean(callConnected) });
    update(); socketInstance?.on('connect', update);
    return () => { socketInstance?.off('connect', update); };
  }, [socketInstance, callConnected]);
  const callStatus = classroomCallStatus({
    signalingConnected,
    localMediaReady: Boolean(localStream?.getTracks().some(track => track.readyState === 'live')),
    peerPresent: !isConnecting,
    peerConnecting: isMediaConnecting,
    peerConnected: isConnected,
    remoteRole: 'tutor',
    error: signalingError || webrtcError,
  });
  const [connectedBannerDismissed, setConnectedBannerDismissed] = useState(false);

  useEffect(() => {
    setConnectedBannerDismissed(false);
    if (!callConnected) return;
    const timer = window.setTimeout(() => setConnectedBannerDismissed(true), 3000);
    return () => window.clearTimeout(timer);
  }, [callConnected, currentSessionId]);

  const localHasVideo = Boolean(localStream?.getVideoTracks().some(track => track.readyState === 'live'));
  const remoteHasVideo = remoteVideoEnabled && Boolean(remoteStream?.getVideoTracks().some(track => track.readyState === 'live'));

  // Mock student data (will be replaced with real data)
  const studentData = {
    name: 'Student',
    initials: 'ST',
    sessionTime: '10:00AM - 10:25AM',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  };
  const remoteParticipantData = tutorInfo || {
    name: 'Tutor',
    initials: 'T',
    date: studentData.date
  };

  // Chat messages - start empty, will load from server
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  const requestActivityHistory = () => {
    if (!currentSessionId || !socketInstance) return;
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      setIsHistoryLoading(false);
      return;
    }

    setIsSettingsOpen(false);
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    socketInstance.emit('classroom:request-activity-history', { sessionId: currentSessionId });
  };

  const loadMediaDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter(device => device.kind === 'audioinput'));
      setVideoInputDevices(devices.filter(device => device.kind === 'videoinput'));
    } catch (error) {
      console.error('Failed to load media devices:', error);
      toast.error('Failed to load camera and microphone devices');
    }
  };

  const openDeviceSettings = async () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }

    setIsHistoryOpen(false);
    setIsSettingsOpen(true);
    await loadMediaDevices();
  };

  const applyDeviceSettings = async () => {
    setIsApplyingDeviceSettings(true);
    try {
      const settings = {
        audioDeviceId: selectedAudioDeviceId || undefined,
        videoDeviceId: selectedVideoDeviceId || undefined,
      };

      window.localStorage.setItem(CLASSROOM_DEVICE_SETTINGS_KEY, JSON.stringify(settings));
      await switchMediaDevices(settings);
      await loadMediaDevices();
      setIsSettingsOpen(false);
      toast.success('Classroom devices updated');
    } catch (error) {
      console.error('Failed to apply device settings:', error);
      toast.error('Failed to apply classroom devices');
    } finally {
      setIsApplyingDeviceSettings(false);
    }
  };

  const formatActivityTime = (createdAt: string) =>
    new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const formatActivityDate = (createdAt?: string) =>
    createdAt
      ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Start local media when component mounts (only once)
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        await startLocalStream(true, true, {
          audioDeviceId: selectedAudioDeviceId || undefined,
          videoDeviceId: selectedVideoDeviceId || undefined,
        });
      } catch (err) {
        console.error('❌ [Classroom] Failed to start media:', err);
      }
    };

    initWebRTC();
  }, [startLocalStream]);

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

  // Detect local speaking using a calibrated noise floor so room noise does not flicker the mic indicator.
  useEffect(() => {
    if (!localStream?.getAudioTracks().some(track => track.readyState === 'live')) return;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(localStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    const dataArray = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    let rafId: number;
    let calibratedNoiseFloor = 0.018;
    let isSpeaking = false;
    let lastVoiceAt = 0;
    const minVoiceLevel = 0.055;
    const releaseDelayMs = 260;

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        const centeredSample = (dataArray[i] - 128) / 128;
        sumSquares += centeredSample * centeredSample;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);
      calibratedNoiseFloor = Math.min(
        0.08,
        calibratedNoiseFloor * 0.96 + Math.min(rms, 0.08) * 0.04
      );

      const voiceThreshold = Math.max(minVoiceLevel, calibratedNoiseFloor * 3.6);
      const now = performance.now();
      const hasVoice = rms > voiceThreshold;

      if (hasVoice) {
        lastVoiceAt = now;
      }

      const nextIsSpeaking = hasVoice || now - lastVoiceAt < releaseDelayMs;
      if (nextIsSpeaking !== isSpeaking) {
        isSpeaking = nextIsSpeaking;
        setIsSpeakingLocal(nextIsSpeaking);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      setIsSpeakingLocal(false);
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
    if (currentSessionId && socketInstance?.connected) {
      socketInstance.emit('classroom:video-state', { sessionId: currentSessionId, enabled: !isVideoOff });
    }
  }, [currentSessionId, isVideoOff, socketInstance, toggleVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Listen for close messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === 'close-lesson-material') {
        setShowLessonRequest(true);
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
    if (!lessonStart.live) return;
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
    if (!lessonStart.live) return;
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

  const beginEditMessage = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.text);
    setOpenMessageMenuId(null);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const submitEditMessage = (messageId: string) => {
    const nextText = editingMessageText.trim();
    if (!nextText || !currentSessionId) return;

    const socket = getSocket();
    socket.emit('chat:edit', { sessionId: currentSessionId, messageId, text: nextText });
    cancelEditMessage();
  };

  const deleteOwnMessage = (messageId: string) => {
    if (!currentSessionId) return;

    setOpenMessageMenuId(null);
    setEditingMessageId(prev => prev === messageId ? null : prev);

    const socket = getSocket();
    socket.emit('chat:delete', { sessionId: currentSessionId, messageId }, (result) => {
      if (!result?.success) {
        toast.error(result?.message || 'Unable to delete message');
        return;
      }

      socket.emit('chat:request-history', { sessionId: currentSessionId });
    });

    window.setTimeout(() => {
      if (socket.connected) {
        socket.emit('chat:request-history', { sessionId: currentSessionId });
      }
    }, 500);
  };

  const applyMessageFormatting = (textarea: HTMLTextAreaElement, marker: '*' | '_') => {
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    const hasSelection = start !== end;
    const isWrappedSelection = hasSelection && start > 0 && end < value.length && value[start - 1] === marker && value[end] === marker;

    let nextMessage = value;
    let nextSelectionStart = start;
    let nextSelectionEnd = end;

    if (isWrappedSelection) {
      nextMessage = `${value.slice(0, start - 1)}${selectedText}${value.slice(end + 1)}`;
      nextSelectionStart = start - 1;
      nextSelectionEnd = end - 1;
    } else if (hasSelection) {
      nextMessage = `${value.slice(0, start)}${marker}${selectedText}${marker}${value.slice(end)}`;
      nextSelectionStart = start + 1;
      nextSelectionEnd = end + 1;
    } else {
      nextMessage = `${value.slice(0, start)}${marker}${marker}${value.slice(end)}`;
      nextSelectionStart = start + 1;
      nextSelectionEnd = start + 1;
    }

    setMessage(nextMessage);
    handleTyping(nextMessage.trim().length > 0);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  const handleChatInputKeyDown = (e: KeyboardEvent) => {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    const modifierPressed = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (modifierPressed && key === 'b') {
      e.preventDefault();
      applyMessageFormatting(textarea, '*');
      return;
    }

    if (modifierPressed && key === 'i') {
      e.preventDefault();
      applyMessageFormatting(textarea, '_');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !isUploading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle typing indicator
  const handleTyping = (typing: boolean) => {
    if (!lessonStart.live) return;
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

        {currentSessionId && <StudentLessonIssueReport key={currentSessionId} bookingId={currentSessionId} compact presenceRevision={activityLogs.at(-1)?.id} />}
        {currentSessionId && <ClassroomLessonSurvey key={`survey-${currentSessionId}`} bookingId={currentSessionId} socket={socketInstance} />}
        {!lessonStart.live && <div className="classroom-start-wait" role={signalingError ? 'alert' : 'status'}>{lessonStart.closed ? lessonStart.message : signalingError || lessonStart.message}</div>}
        {lessonStart.wrapUp && <div className="classroom-start-wait" role="status">{lessonStart.wrapUpMessage}</div>}

        {/* Video Area */}
        <ClassroomRecordingNotice key={currentSessionId} socket={socketInstance} provider={mediaProvider} />
        <div className="video-section">
          {/* Main Video */}
          <div className="video-main">
            {/* Connection Status overlay inside video */}
            {lessonStart.live && (!callConnected || !connectedBannerDismissed) && (
            <div className={`connection-status overlay-top${callStatus.state === 'error' ? ' call-error' : callConnected ? ' call-connected' : ''}`}
              role={callStatus.state === 'error' ? 'alert' : 'status'}
              data-call-state={callStatus.state}>
              {callStatus.spinning && <div className="spinner"></div>}
              <p>{callStatus.message}</p>
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
              <div className="video-placeholder remote-camera-off">
                <i className="fas fa-video-slash camera-off-icon" aria-hidden="true"></i>
                <span className="camera-off-text">The camera is turned off</span>
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
              <div className="video-placeholder remote-camera-off pip-camera-off" aria-label="No camera">
                <i className="fas fa-video-slash camera-off-icon" aria-hidden="true"></i>
              </div>
            )}
          </div>

          {/* Video Controls */}
          <div className="video-controls">
            <button
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={() => setIsMuted(prev => !prev)}
              disabled={!lessonStart.live}
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
              disabled={!lessonStart.live}
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
            <div className="chat-header-actions" aria-label="Chat tools">
              <button type="button" className="chat-tool-btn" title="Classroom history" aria-label="Classroom history" onClick={requestActivityHistory}>
                <i className="fi fi-sr-time-past"></i>
              </button>
              <button type="button" className="chat-tool-btn" title="Device settings" aria-label="Device settings" onClick={openDeviceSettings}>
                <i className="fi fi-sr-settings"></i>
              </button>
            </div>
          </div>
          {(isHistoryOpen || isSettingsOpen) && (
            <div className="classroom-chat-popover">
              {isHistoryOpen && (
                <div className="classroom-modal classroom-history-modal" role="dialog" aria-modal="false" aria-labelledby="classroom-history-title">
                  <div className="classroom-modal-header">
                    <div>
                      <h2 id="classroom-history-title">History</h2>
                      <div className="classroom-modal-meta">
                        <span>SID: {currentSessionId}</span>
                        <span><i className="fi fi-sr-calendar"></i>{formatActivityDate(activityLogs[0]?.createdAt)}</span>
                      </div>
                    </div>
                    <button type="button" className="classroom-modal-close" aria-label="Close history" onClick={() => setIsHistoryOpen(false)}>
                      <i className="fi fi-sr-cross-small"></i>
                    </button>
                  </div>

                  <div className="classroom-history-list">
                    {isHistoryLoading ? (
                      <div className="classroom-modal-empty">Loading history...</div>
                    ) : activityLogs.length === 0 ? (
                      <div className="classroom-modal-empty">No classroom activity yet.</div>
                    ) : (
                      activityLogs.map(log => (
                        <div key={log.id} className={`classroom-history-item ${log.userType}`}>
                          <span className="classroom-history-marker" aria-hidden="true"></span>
                          <span className="classroom-history-time">{formatActivityTime(log.createdAt)}</span>
                          <span className="classroom-history-message">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="classroom-modal-footer">
                    <button type="button" className="classroom-modal-primary" onClick={requestActivityHistory}>
                      <i className="fi fi-sr-refresh"></i>
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {isSettingsOpen && (
                <div className="classroom-modal classroom-settings-modal" role="dialog" aria-modal="false" aria-labelledby="classroom-settings-title">
                  <div className="classroom-modal-header">
                    <div>
                      <h2 id="classroom-settings-title">Settings</h2>
                      <div className="classroom-modal-meta">
                        <span>Classroom devices</span>
                      </div>
                    </div>
                    <button type="button" className="classroom-modal-close" aria-label="Close settings" onClick={() => setIsSettingsOpen(false)}>
                      <i className="fi fi-sr-cross-small"></i>
                    </button>
                  </div>

                  <div className="classroom-device-fields">
                    <label className="classroom-device-field">
                      <span><i className="fi fi-sr-microphone"></i>Microphone</span>
                      <select value={selectedAudioDeviceId} onChange={(event) => setSelectedAudioDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default microphone</option>
                        {audioInputDevices.map((device, index) => (
                          <option key={device.deviceId || `audio-${index}`} value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="classroom-device-field">
                      <span><i className="fi fi-sr-video-camera"></i>Camera</span>
                      <select value={selectedVideoDeviceId} onChange={(event) => setSelectedVideoDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default camera</option>
                        {videoInputDevices.map((device, index) => (
                          <option key={device.deviceId || `video-${index}`} value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="classroom-modal-footer">
                    <button type="button" className="classroom-modal-secondary" onClick={loadMediaDevices}>
                      <i className="fi fi-sr-refresh"></i>
                      Refresh
                    </button>
                    <button type="button" className="classroom-modal-primary" disabled={isApplyingDeviceSettings} onClick={applyDeviceSettings}>
                      <i className="fi fi-sr-check"></i>
                      {isApplyingDeviceSettings ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="chat-messages">
            {chatMessages.map((msg) => {
              // In student app: student messages are "self" (right), tutor messages are "other" (left)
              const isOwnMessage = msg.sender === 'student';
              const canManageMessage = isOwnMessage && !msg.correction && msg.id !== 'error';
              const canEditMessage = canManageMessage && !msg.material && shouldShowMessageText(msg);
              const isEditingMessage = editingMessageId === msg.id;
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
                  <div className="message-row">
                    <div className="message-bubble">
                      {isEditingMessage ? (
                        <div className="message-edit-panel">
                          <textarea
                            className="message-edit-input"
                            value={editingMessageText}
                            rows={2}
                            onInput={(event) => setEditingMessageText((event.currentTarget as HTMLTextAreaElement).value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                submitEditMessage(msg.id);
                              }

                              if (event.key === 'Escape') {
                                cancelEditMessage();
                              }
                            }}
                            autoFocus
                          />
                          <div className="message-edit-actions">
                            <button type="button" className="message-edit-cancel" onClick={cancelEditMessage}>Cancel</button>
                            <button type="button" className="message-edit-save" disabled={!editingMessageText.trim()} onClick={() => submitEditMessage(msg.id)}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                          {msg.material && (
                            <div className="chat-material-share">
                              <strong>{msg.material.title}</strong>
                              <span>Shared with your tutor</span>
                            </div>
                          )}
                          {!msg.material && shouldShowMessageText(msg) && (
                            <span>{formatMessageText(msg.text)}</span>
                          )}
                          {msg.isEdited && <span className="message-edited-label">edited</span>}
                        </>
                      )}
                    </div>
                    {canManageMessage && !isEditingMessage && (
                      <div className="message-actions">
                        <button
                          type="button"
                          className="message-more-btn"
                          aria-label="Message actions"
                          title="Message actions"
                          onClick={() => setOpenMessageMenuId(openMessageMenuId === msg.id ? null : msg.id)}
                        >
                          <span aria-hidden="true">•••</span>
                        </button>
                        {openMessageMenuId === msg.id && (
                          <div className="message-action-menu">
                            {canEditMessage && (
                              <button type="button" onClick={() => beginEditMessage(msg)}>
                                <i className="fi fi-sr-pencil"></i>
                                Edit
                              </button>
                            )}
                            <button type="button" className="danger" onClick={() => deleteOwnMessage(msg.id)}>
                              <i className="fi fi-sr-trash"></i>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
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
              disabled={!lessonStart.live || isUploading}
            >
              <i className="fi fi-sr-clip"></i>
            </button>
            <textarea
              placeholder={lessonStart.live ? 'Type a message...' : 'Chat opens at lesson start'}
              aria-label="Chat message. Press Shift and Enter for a new line."
              value={message}
              onChange={(e) => {
                const newValue = (e.target as HTMLTextAreaElement).value;
                setMessage(newValue);
                handleTyping(newValue.trim().length > 0);
              }}
              onKeyDown={(e) => {
                handleChatInputKeyDown(e as KeyboardEvent);
              }}
              onBlur={() => handleTyping(false)}
              disabled={!lessonStart.live || isUploading}
              rows={1}
            />
            <button 
              className="send-btn" 
              onClick={handleSendMessage}
              disabled={!lessonStart.live || isUploading || (!message.trim() && !selectedFile)}
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
          <div className="dispatch-view-header daily-dispatch-theme">
            <button 
              className="btn-back-to-request"
              onClick={() => setShowLessonRequest(true)}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Go to Selection Tab
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">{viewingDispatchArticle.category}</span>
              <span className="dispatch-view-date">
                {new Date(`${dispatchPostDate(viewingDispatchArticle)}T00:00:00Z`).toLocaleDateString('en-US', {
                  timeZone: 'UTC',
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
              onClick={() => setShowLessonRequest(true)}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Go to Selection Tab
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">Level {viewingConversationalLesson.level}</span>
              <span className="dispatch-view-date">
                Chapter {viewingConversationalLesson.chapter} • Lesson {viewingConversationalLesson.lessonNumber}
              </span>
            </div>
          </div>
        ) : isViewingBusinessEnglishMaterial ? (
          <div className={`dispatch-view-header business-english-theme business-english-theme--${isDarkMode ? 'dark' : 'light'}`}>
            <button type="button" className="btn-back-to-request" onClick={() => setShowLessonRequest(true)}>
              <i className="fi fi-sr-arrow-left" />Go to Selection Tab
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">Business English</span>
              <span className="dispatch-view-date">{chosenLesson?.title}</span>
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
            <div className="lesson-request-container lesson-request-container--dispatch">
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
                            <span className="request-detail-label">Current material chosen</span>
                            <span className="request-detail-value request-detail-value--text">{chosenLesson?.title || 'No material selected yet'}</span>
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
                  <div className="material-selector-layout material-selector-layout--dispatch">
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
                      {showSelectedCourseDetails && selectedCourse === 'daily-dispatch' && (
                        <DispatchMaterialPicker onOpen={article => {
                          materialOpenId.current += 1;
                          setLoadingViewUrl(false);
                          setViewingDispatchArticle(article);
                          setViewingConversationalLesson(null);
                          setConversationalViewUrl(null);
                          setLessonViewUrl(null);
                          setShowLessonRequest(false);
                        }} />
                      )}
                      {showSelectedCourseDetails && selectedCourse !== 'daily-dispatch' && (
                        <CurriculumMaterialPicker
                          key={selectedCourse}
                          loading={loadingMaterials}
                          currentId={chosenLesson?.courseId === selectedCourse ? chosenLesson.lessonId : undefined}
                          materials={availableLessons.map(item => ({
                            id: item.id, title: item.title, level: getLevelNumber(item),
                            chapter: getChapterNumber(item), lesson: getLessonNumber(item),
                            goal: item.lessonData?.header?.goalText || '',
                          }))}
                          onOpen={item => void handleApplyMaterial(item.id)}
                        />
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
                  src={materialFrameUrl(lessonViewUrl, isDarkMode ? 'dark' : 'light', window.location.origin)}
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

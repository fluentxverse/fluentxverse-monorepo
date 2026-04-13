import { useState, useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket } from '../client/socket/socket.client';
import { useThemeStore } from '../context/ThemeContext';
import { useWebRTC } from '../hooks/useWebRTC';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import { toast, toastConfirm } from '../Components/Common/Toast';
import { lessonApi, type Lesson } from '../api/lesson.api';
import {
  tutorApi,
  type ClassroomGrammarNote,
  type ClassroomNotesRecord,
  type ClassroomPronunciationNote,
  type SaveClassroomNotesInput,
  type ClassroomVocabularyNote,
} from '../api/tutor.api';
import type { ChatMessageData } from '../types/socket.types';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import BusinessEnglishPreviewPage from './BusinessEnglishPreviewPage';
import {
  cacheBusinessEnglishLesson,
  cacheBusinessEnglishLessonList,
  readCachedBusinessEnglishLesson,
  readCachedBusinessEnglishLessonList,
} from '../utils/businessEnglishCache';
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

interface StudentLessonRequest {
  lessonId: string;
  courseId: string;
  title: string;
  lessonNumber: number;
  goal: string;
  studentPreferences?: {
    cameraOn?: boolean;
    proficiency?: string;
    errorCorrection?: string;
    otherRequests?: string;
  };
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

type ClassroomPersistedOpenMaterial =
  | {
      kind: 'dispatch';
      article: DispatchArticle;
    }
  | {
      kind: 'conversational';
      lesson: ConversationalLesson;
      viewUrl: string;
    }
  | {
      kind: 'lesson';
      request: StudentLessonRequest;
      viewUrl: string | null;
      businessEnglishTheme?: 'light' | 'dark';
    };

interface ClassroomPersistedState {
  showLessonRequest: boolean;
  openMaterial: ClassroomPersistedOpenMaterial | null;
}

interface ActiveNotesTarget {
  materialType: 'business-english' | 'daily-dispatch';
  materialId: string;
  courseId?: string | null;
  lessonId?: string | null;
  articleId?: string | null;
}

interface ClassroomNotesSnapshot {
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  studentComment: string;
  tutorMemo: string;
}

interface ClassroomNotesDraft extends ClassroomNotesSnapshot {
  sessionId: string;
  materialType: ActiveNotesTarget['materialType'];
  materialId: string;
  courseId?: string | null;
  lessonId?: string | null;
  articleId?: string | null;
  updatedAt: number;
}

const buildClassroomPersistedStateKey = (sessionId: string) => `fxv-tutor-classroom-state:${sessionId}`;
const buildClassroomNotesBindingKey = (sessionId: string, target: ActiveNotesTarget) =>
  `${sessionId}:${target.materialType}:${target.materialId}`;
const buildClassroomNotesDraftKey = (bindingKey: string) => `fxv-tutor-classroom-notes:${bindingKey}`;

const createEmptyVocabularyItem = (): ClassroomVocabularyNote => ({
  word: '',
  definitions: [],
  selectedDefinitionIndex: 0,
  isLoading: false,
  showDefinition: false,
  showTranslation: false,
});

const createEmptyGrammarItem = (): ClassroomGrammarNote => ({
  youSaid: '',
  correct: '',
  simpleExplanation: '',
  technicalExplanation: '',
  isLoading: false,
  showExplanation: false,
});

const createEmptyPronunciationItem = (): ClassroomPronunciationNote => ({
  word: '',
  phonetic: '',
  isLoading: false,
  showPhonetic: false,
});

const normalizeVocabularyItems = (items: ClassroomVocabularyNote[] = []): ClassroomVocabularyNote[] => {
  const normalized = items.map((item) => {
    const definitions = Array.isArray(item.definitions) ? item.definitions : [];
    const selectedDefinitionIndex = Math.min(
      Math.max(item.selectedDefinitionIndex || 0, 0),
      Math.max(definitions.length - 1, 0),
    );

    return {
      word: item.word || '',
      definitions,
      selectedDefinitionIndex,
      isLoading: false,
      showDefinition: Boolean(item.showDefinition),
      showTranslation: Boolean(item.showTranslation),
    };
  });

  return normalized.length > 0 ? normalized : [createEmptyVocabularyItem()];
};

const normalizeGrammarItems = (items: ClassroomGrammarNote[] = []): ClassroomGrammarNote[] => {
  const normalized = items.map((item) => ({
    youSaid: item.youSaid || '',
    correct: item.correct || '',
    simpleExplanation: item.simpleExplanation || '',
    technicalExplanation: item.technicalExplanation || '',
    isLoading: false,
    showExplanation: Boolean(item.showExplanation),
  }));

  return normalized.length > 0 ? normalized : [createEmptyGrammarItem()];
};

const normalizePronunciationItems = (items: ClassroomPronunciationNote[] = []): ClassroomPronunciationNote[] => {
  const normalized = items.map((item) => ({
    word: item.word || '',
    phonetic: item.phonetic || '',
    isLoading: false,
    showPhonetic: Boolean(item.showPhonetic),
  }));

  return normalized.length > 0 ? normalized : [createEmptyPronunciationItem()];
};

const normalizeClassroomNotesSnapshot = (
  snapshot?: Partial<ClassroomNotesSnapshot> | null,
): ClassroomNotesSnapshot => ({
  vocabularyItems: normalizeVocabularyItems(snapshot?.vocabularyItems),
  grammarItems: normalizeGrammarItems(snapshot?.grammarItems),
  pronunciationItems: normalizePronunciationItems(snapshot?.pronunciationItems),
  studentComment: snapshot?.studentComment || '',
  tutorMemo: snapshot?.tutorMemo || '',
});

const createClassroomNotesDraft = (
  sessionId: string,
  target: ActiveNotesTarget,
  snapshot: Partial<ClassroomNotesSnapshot> | null | undefined,
  updatedAt = Date.now(),
): ClassroomNotesDraft => {
  const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);

  return {
    sessionId,
    materialType: target.materialType,
    materialId: target.materialId,
    courseId: target.courseId || null,
    lessonId: target.lessonId || null,
    articleId: target.articleId || null,
    updatedAt,
    ...normalizedSnapshot,
  };
};

const buildClassroomNotesPayload = (
  target: ActiveNotesTarget,
  snapshot: Partial<ClassroomNotesSnapshot> | null | undefined,
): SaveClassroomNotesInput => {
  const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);

  return {
    materialType: target.materialType,
    materialId: target.materialId,
    courseId: target.courseId || null,
    lessonId: target.lessonId || null,
    articleId: target.articleId || null,
    ...normalizedSnapshot,
  };
};

const parseNotesUpdatedAt = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
};

const readClassroomNotesDraft = (bindingKey: string): ClassroomNotesDraft | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildClassroomNotesDraftKey(bindingKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ClassroomNotesDraft> | null;
    if (!parsed || typeof parsed.sessionId !== 'string' || typeof parsed.materialId !== 'string' || typeof parsed.materialType !== 'string') {
      return null;
    }

    const normalizedSnapshot = normalizeClassroomNotesSnapshot(parsed);
    return {
      sessionId: parsed.sessionId,
      materialType: parsed.materialType as ActiveNotesTarget['materialType'],
      materialId: parsed.materialId,
      courseId: parsed.courseId || null,
      lessonId: parsed.lessonId || null,
      articleId: parsed.articleId || null,
      updatedAt: parseNotesUpdatedAt(parsed.updatedAt),
      ...normalizedSnapshot,
    };
  } catch (error) {
    console.error('Failed to read classroom notes draft:', error);
    return null;
  }
};

const persistClassroomNotesDraft = (bindingKey: string, draft: ClassroomNotesDraft) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildClassroomNotesDraftKey(bindingKey), JSON.stringify(draft));
  } catch (error) {
    console.error('Failed to persist classroom notes draft:', error);
  }
};

// Format text with bold, italic, clickable links, and line breaks
const formatMessageText = (text: string): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = [];
  
  // First, split by newlines to handle line breaks
  const lines = text.split('\n');
  
  lines.forEach((line, lineIndex) => {
    // Combined regex for bold (*text*), italic (_text_), and URLs
    const regex = /(\*[^*]+\*)|(_[^_]+_)|(https?:\/\/[^\s<]+)/g;
    let lastIndex = 0;
    let match;
    let keyIndex = 0;
    
    while ((match = regex.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      
      const matchedText = match[0];
      
      if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        // Bold text
        parts.push(<strong key={`bold-${lineIndex}-${keyIndex++}`}>{matchedText.slice(1, -1)}</strong>);
      } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
        // Italic text
        parts.push(<em key={`italic-${lineIndex}-${keyIndex++}`}>{matchedText.slice(1, -1)}</em>);
      } else if (matchedText.startsWith('http')) {
        // URL - make it clickable
        parts.push(
          <a 
            key={`link-${lineIndex}-${keyIndex++}`} 
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
    
    // Add remaining text from this line
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    } else if (line.length === 0 && lines.length > 1) {
      // Empty line - just add the break
    }
    
    // Add line break after each line except the last
    if (lineIndex < lines.length - 1) {
      parts.push(<br key={`br-${lineIndex}`} />);
    }
  });
  
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
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const { route } = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localPipRef = useRef<HTMLVideoElement>(null);
  const remotePipRef = useRef<HTMLVideoElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);
  const lessonDropdownRef = useRef<HTMLDivElement>(null);
  const materialCourseCacheRef = useRef<Record<string, Lesson[]>>({});
  const businessEnglishPrefetchRef = useRef<Record<string, Promise<void>>>({});
  const restoredClassroomStateRef = useRef<ClassroomPersistedState | null>(null);
  const hydratedClassroomSessionRef = useRef<string | null>(null);
  
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

  useEffect(() => {
    if (!currentSessionId || hydratedClassroomSessionRef.current === currentSessionId) {
      return;
    }

    hydratedClassroomSessionRef.current = currentSessionId;

    try {
      const raw = window.sessionStorage.getItem(buildClassroomPersistedStateKey(currentSessionId));
      if (!raw) {
        restoredClassroomStateRef.current = null;
        return;
      }

      const persistedState = JSON.parse(raw) as ClassroomPersistedState;
      restoredClassroomStateRef.current = persistedState;
      setShowLessonRequest(persistedState.showLessonRequest ?? true);

      if (!persistedState.openMaterial) {
        return;
      }

      if (persistedState.openMaterial.kind === 'dispatch') {
        setViewingDispatchArticle(persistedState.openMaterial.article);
        setViewingConversationalLesson(null);
        setConversationalViewUrl(null);
        setLessonViewUrl(null);
        return;
      }

      if (persistedState.openMaterial.kind === 'conversational') {
        setViewingDispatchArticle(null);
        setViewingConversationalLesson(persistedState.openMaterial.lesson);
        setConversationalViewUrl(persistedState.openMaterial.viewUrl);
        setLessonViewUrl(null);
        return;
      }

      setViewingDispatchArticle(null);
      setViewingConversationalLesson(null);
      setConversationalViewUrl(null);
      setStudentLessonRequest(persistedState.openMaterial.request);
      setLessonViewUrl(persistedState.openMaterial.viewUrl);
    } catch (error) {
      console.error('Failed to restore classroom material state:', error);
      restoredClassroomStateRef.current = null;
    }
  }, [currentSessionId]);
  
  // Initialize socket and join session
  useEffect(() => {
    if (!currentSessionId) return;
    
    // Destroy any existing socket to ensure fresh connection with correct auth
    destroySocket();
    initSocket();
    connectSocket();
    
    const socket = getSocket();
    setSocketInstance(socket);
    
    // Wait for connection before joining
    const onConnect = () => {
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
    
    // Fetch student's lesson request - declared early so it can be used in multiple handlers
    const fetchStudentLessonRequest = async (studentId: string) => {
      try {
        const lessonRequest = await tutorApi.getStudentLessonRequest(studentId);
        if (lessonRequest) {
          const restoredOpenMaterial = restoredClassroomStateRef.current?.openMaterial;

          if (restoredOpenMaterial?.kind === 'lesson') {
            const mergedLessonRequest: StudentLessonRequest = {
              ...lessonRequest,
              ...restoredOpenMaterial.request,
              studentPreferences: lessonRequest.studentPreferences || restoredOpenMaterial.request.studentPreferences,
            };

            setStudentLessonRequest(mergedLessonRequest);

            if (mergedLessonRequest.lessonId) {
              try {
                const nextViewUrl = restoredOpenMaterial.viewUrl
                  || await resolveTutorMaterialViewUrl(mergedLessonRequest.courseId, mergedLessonRequest.lessonId);
                setLessonViewUrl(nextViewUrl);
              } catch (err) {
                console.error('Failed to restore lesson view URL:', err);
              }
            }

            return;
          }

          setStudentLessonRequest(lessonRequest);

          // Also fetch the lesson viewUrl for iframe display
          if (lessonRequest.lessonId && (!restoredOpenMaterial || restoredOpenMaterial.kind === 'lesson')) {
            try {
              const nextViewUrl = await resolveTutorMaterialViewUrl(lessonRequest.courseId, lessonRequest.lessonId);
              setLessonViewUrl(nextViewUrl);
            } catch (err) {
              console.error('Failed to get lesson view URL:', err);
            }
          }
        }
      } catch (err) {
        console.error('📚 [Classroom] Failed to fetch student lesson request:', err);
      }
    };
    
    // Handle session state
    const onSessionState = (data: any) => {
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
        
        // Fetch the student's lesson request
        fetchStudentLessonRequest(data.participants.studentId);
      } else {
        // No student in session, clear studentInfo
        setStudentInfo(null);
      }
    };
    
    // Handle user joined
    const onUserJoined = (data: { userId: string; userType: string }) => {
      if (data.userType === 'student') {
        setIsConnecting(false);
        // Always update with the latest student ID
        setStudentInfo({
          id: data.userId,
          name: 'Student',
          initials: 'ST',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
        
        // Fetch the student's lesson request
        fetchStudentLessonRequest(data.userId);
      }
    };
    
    // Handle user left
    const onUserLeft = (data: { userId: string; userType: string }) => {
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
  
  // Daily Dispatch Notes Widget state
  const [showNotesWidget, setShowNotesWidget] = useState(false);
  const [vocabularyItems, setVocabularyItems] = useState<ClassroomVocabularyNote[]>([createEmptyVocabularyItem()]);
  const [grammarItems, setGrammarItems] = useState<ClassroomGrammarNote[]>([createEmptyGrammarItem()]);
  const [pronunciationItems, setPronunciationItems] = useState<ClassroomPronunciationNote[]>([createEmptyPronunciationItem()]);
  const [studentComment, setStudentComment] = useState('');
  const [tutorMemo, setTutorMemo] = useState('');
  const [notesPersistenceState, setNotesPersistenceState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'draft' | 'error'>('idle');
  const notesHydratedKeyRef = useRef<string | null>(null);
  const notesSkipAutosaveRef = useRef(false);
  const notesSkipDraftPersistRef = useRef(false);
  const notesAutosaveTimeoutRef = useRef<number | null>(null);
  const notesDraftUpdatedAtRef = useRef(0);
  const latestNotesDraftRef = useRef<ClassroomNotesDraft | null>(null);
  const notesLastExitFlushAtRef = useRef(0);
  
  // Vocabulary item handlers
  const addVocabularyItem = () => {
    setVocabularyItems(prev => [...prev, createEmptyVocabularyItem()]);
  };
  
  const updateVocabularyWord = (index: number, value: string) => {
    setVocabularyItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      // If word changed and there were definitions, reset them
      if (item.definitions.length > 0 && value !== item.word) {
        updated[index] = {
          ...item,
          word: value,
          definitions: [],
          selectedDefinitionIndex: 0,
          showDefinition: false,
          showTranslation: false
        };
      } else {
        updated[index] = { ...item, word: value };
      }
      return updated;
    });
  };
  
  const selectDefinition = (itemIndex: number, defIndex: number) => {
    setVocabularyItems(prev => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], selectedDefinitionIndex: defIndex };
      return updated;
    });
  };
  
  const removeVocabularyItem = (index: number) => {
    setVocabularyItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleVocabularyTranslation = (index: number) => {
    setVocabularyItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], showTranslation: !updated[index].showTranslation };
      return updated;
    });
  };

  const toggleVocabularyDefinition = (index: number) => {
    setVocabularyItems(prev => {
      const updated = [...prev];
      // When hiding definition, also hide translation
      const newShowDef = !updated[index].showDefinition;
      updated[index] = { 
        ...updated[index], 
        showDefinition: newShowDef,
        showTranslation: newShowDef ? updated[index].showTranslation : false
      };
      return updated;
    });
  };

  // Get vocabulary definition from AI
  const getVocabularyDefinition = async (index: number) => {
    const item = vocabularyItems[index];
    if (!item.word.trim()) return;

    // Set loading state
    setVocabularyItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isLoading: true };
      return updated;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/ai/vocabulary-definition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ word: item.word })
      });

      if (!response.ok) throw new Error('Failed to get definition');

      const data = await response.json();
      
      
      setVocabularyItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          definitions: data.definitions || [],
          selectedDefinitionIndex: 0,
          isLoading: false,
          showDefinition: true
        };
        return updated;
      });
    } catch (error) {
      console.error('Vocabulary definition failed:', error);
      toast.error('Failed to get vocabulary definition');
      setVocabularyItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoading: false };
        return updated;
      });
    }
  };

  // Send vocabulary to chat
  const sendVocabularyToChat = (index: number) => {
    const item = vocabularyItems[index];
    const selectedDef = item.definitions[item.selectedDefinitionIndex];
    if (!item.word.trim() || !selectedDef?.meaning || !currentSessionId) return;
    
    const partOfSpeech = selectedDef.partOfSpeech ? ` (${selectedDef.partOfSpeech})` : '';
    const formattedMessage = `${item.word}${partOfSpeech} - ${selectedDef.meaning}`;
    
    try {
      const socket = getSocket();
      socket.emit('chat:send', {
        sessionId: currentSessionId,
        text: formattedMessage
      });
      // Hide definition after sending
      setVocabularyItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], showDefinition: false, showTranslation: false };
        return updated;
      });
      toast.success('Vocabulary sent to chat');
    } catch (error) {
      console.error('Failed to send vocabulary to chat:', error);
      toast.error('Failed to send to chat');
    }
  };

  // Grammar item handlers
  const addGrammarItem = () => {
    setGrammarItems(prev => [...prev, createEmptyGrammarItem()]);
  };

  const updateGrammarItem = (index: number, field: 'youSaid' | 'correct' | 'simpleExplanation' | 'technicalExplanation' | 'showExplanation', value: string | boolean) => {
    setGrammarItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Update "You Said" and reset correction so user can re-check
  const updateYouSaid = (index: number, value: string) => {
    setGrammarItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      // If the text changed and there was a previous correction, reset it
      if (item.correct && value !== item.youSaid) {
        updated[index] = {
          ...item,
          youSaid: value,
          correct: '',
          simpleExplanation: '',
          technicalExplanation: '',
          showExplanation: false
        };
      } else {
        updated[index] = { ...item, youSaid: value };
      }
      return updated;
    });
  };

  const removeGrammarItem = (index: number) => {
    setGrammarItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleGrammarExplanation = (index: number) => {
    setGrammarItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], showExplanation: !updated[index].showExplanation };
      return updated;
    });
  };

  // Send grammar correction to chat
  const sendGrammarToChat = (index: number) => {
    const item = grammarItems[index];
    if (!item.youSaid.trim() || !item.correct.trim() || !currentSessionId) return;
    
    const formattedMessage = `You said: ${item.youSaid}\nCorrect: ${item.correct}`;
    
    try {
      const socket = getSocket();
      socket.emit('chat:send', {
        sessionId: currentSessionId,
        text: formattedMessage
      });
      toast.success('Grammar correction sent to chat');
    } catch (error) {
      console.error('Failed to send grammar to chat:', error);
      toast.error('Failed to send to chat');
    }
  };

  // Get grammar correction from OpenAI
  const getGrammarCorrection = async (index: number) => {
    const item = grammarItems[index];
    if (!item.youSaid.trim()) return;

    // Set loading state
    setGrammarItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isLoading: true };
      return updated;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/ai/grammar-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: item.youSaid })
      });

      if (!response.ok) throw new Error('Failed to get correction');

      const data = await response.json();
      
      
      setGrammarItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          correct: data.corrected || item.youSaid,
          simpleExplanation: data.simpleExplanation || 'No correction needed.',
          technicalExplanation: data.technicalExplanation || 'No correction needed.',
          isLoading: false
        };
        return updated;
      });
    } catch (error) {
      console.error('Grammar check failed:', error);
      toast.error('Failed to get grammar correction');
      setGrammarItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoading: false };
        return updated;
      });
    }
  };
  
  // Pronunciation item handlers
  const addPronunciationItem = () => {
    setPronunciationItems(prev => [...prev, createEmptyPronunciationItem()]);
  };

  const updatePronunciationWord = (index: number, value: string) => {
    setPronunciationItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      // If word changed and there was phonetic, reset it
      if (item.phonetic && value !== item.word) {
        updated[index] = {
          ...item,
          word: value,
          phonetic: '',
          showPhonetic: false
        };
      } else {
        updated[index] = { ...item, word: value };
      }
      return updated;
    });
  };

  const removePronunciationItem = (index: number) => {
    setPronunciationItems(prev => prev.filter((_, i) => i !== index));
  };

  const togglePronunciationPhonetic = (index: number) => {
    setPronunciationItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], showPhonetic: !updated[index].showPhonetic };
      return updated;
    });
  };

  // Get pronunciation from AI
  const getPronunciationFromAI = async (index: number) => {
    const item = pronunciationItems[index];
    if (!item.word.trim()) return;

    // Set loading state
    setPronunciationItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isLoading: true };
      return updated;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/ai/pronunciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ word: item.word })
      });

      if (!response.ok) throw new Error('Failed to get pronunciation');

      const data = await response.json();
      
      
      setPronunciationItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          phonetic: data.phonetic || '',
          isLoading: false,
          showPhonetic: true
        };
        return updated;
      });
    } catch (error) {
      console.error('Pronunciation failed:', error);
      toast.error('Failed to get pronunciation');
      setPronunciationItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoading: false };
        return updated;
      });
    }
  };

  // Send pronunciation to chat
  const sendPronunciationToChat = (index: number) => {
    const item = pronunciationItems[index];
    if (!item.word.trim() || !item.phonetic || !currentSessionId) return;
    
    const formattedMessage = `${item.word} - [${item.phonetic}]`;
    
    try {
      const socket = getSocket();
      socket.emit('chat:send', {
        sessionId: currentSessionId,
        text: formattedMessage
      });
      // Hide phonetic after sending
      setPronunciationItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], showPhonetic: false };
        return updated;
      });
      toast.success('Pronunciation sent to chat');
    } catch (error) {
      console.error('Failed to send pronunciation to chat:', error);
      toast.error('Failed to send to chat');
    }
  };
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Student lesson request state (received from student)
  const [studentLessonRequest, setStudentLessonRequest] = useState<StudentLessonRequest | null>(null);
  
  // Material selector state - hierarchical
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [courseDropdownMenuStyle, setCourseDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const [levelDropdownMenuStyle, setLevelDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [chapterDropdownMenuStyle, setChapterDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [isLessonDropdownOpen, setIsLessonDropdownOpen] = useState(false);
  const [lessonDropdownMenuStyle, setLessonDropdownMenuStyle] = useState<JSX.CSSProperties | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [showLessonRequest, setShowLessonRequest] = useState(true);
  const [lessonViewUrl, setLessonViewUrl] = useState<string | null>(null);
  const [loadingViewUrl, setLoadingViewUrl] = useState(false);
  const businessEnglishTheme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  
  // Course definitions
  const courses = [
    { id: 'conversational-skills', name: 'Conversational Skills', icon: '💬', description: 'Dialogue practice and speaking prompts' },
    { id: 'business-english', name: 'Business English', icon: '💼', description: 'Meetings, workplace language, and email tone' },
    { id: 'young-learners', name: 'Young Learners', icon: '🎨', description: 'Playful lessons for younger students' },
    { id: 'daily-dispatch', name: 'Daily Dispatch', icon: '📰', description: 'Current-events articles for discussion practice' },
  ];
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

  const prefetchBusinessEnglishLesson = async (lessonId: string): Promise<void> => {
    if (!lessonId || readCachedBusinessEnglishLesson(lessonId)) {
      return;
    }

    if (businessEnglishPrefetchRef.current[lessonId]) {
      return businessEnglishPrefetchRef.current[lessonId];
    }

    const request = (async () => {
      try {
        const result = await lessonApi.getPublicLessonMaterial(lessonId);
        if (result.success && result.lesson) {
          cacheBusinessEnglishLesson(lessonId, result.lesson);
        }
      } catch (error) {
        console.error('Failed to prefetch Business English lesson:', error);
      } finally {
        delete businessEnglishPrefetchRef.current[lessonId];
      }
    })();

    businessEnglishPrefetchRef.current[lessonId] = request;
    return request;
  };

  const warmBusinessEnglishCourseCache = async (): Promise<Lesson[]> => {
    const inMemoryLessons = materialCourseCacheRef.current['business-english'];
    if (inMemoryLessons?.length) {
      return inMemoryLessons;
    }

    const cachedLessons = readCachedBusinessEnglishLessonList<Lesson>('business-english');
    if (cachedLessons?.length) {
      materialCourseCacheRef.current['business-english'] = cachedLessons;
      return cachedLessons;
    }

    const result = await lessonApi.getPublishedLessonMaterials('business-english');
    if (!result.success || !result.lessons) {
      return [];
    }

    const nextLessons = result.lessons.map(transformLessonMaterialToLesson);
    materialCourseCacheRef.current['business-english'] = nextLessons;
    cacheBusinessEnglishLessonList('business-english', nextLessons);
    return nextLessons;
  };

  const resolveTutorMaterialViewUrl = async (courseId: string | undefined, lessonId: string): Promise<string | null> => {
    if (courseId === 'conversational-skills') {
      return `/materials/conversational-skills/${lessonId}`;
    }

    if (courseId === 'young-learners') {
      return `/materials/young-learners/lesson/${lessonId}`;
    }

    if (courseId === 'business-english') {
      return `/materials/business-english/${lessonId}`;
    }

    const result = await lessonApi.getTutorLesson(lessonId);
    return result.success ? result.viewUrl || null : null;
  };

  const selectedCourseOption = courses.find(course => course.id === selectedCourse) || null;
  const selectedMaterialHref = studentLessonRequest
    ? studentLessonRequest.courseId === 'business-english'
      ? `/materials/business-english/${studentLessonRequest.lessonId}`
      : studentLessonRequest.courseId === 'conversational-skills'
        ? `/materials/conversational-skills/${studentLessonRequest.lessonId}`
        : studentLessonRequest.courseId === 'young-learners'
          ? `/materials/young-learners/lesson/${studentLessonRequest.lessonId}`
          : `/lesson/view?id=${studentLessonRequest.lessonId}`
    : '#';
  const activeMaterialCourseId = !showLessonRequest ? studentLessonRequest?.courseId || '' : '';
  const isViewingBusinessEnglishMaterial =
    activeMaterialCourseId === 'business-english' && !showLessonRequest;
  const businessEnglishHeaderTitle = studentLessonRequest?.title || 'Business English lesson';
  
  // Daily Dispatch state
  const [dispatchArticles, setDispatchArticles] = useState<DispatchArticle[]>([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [viewingDispatchArticle, setViewingDispatchArticle] = useState<DispatchArticle | null>(null);
  
  // Conversational Skills viewing state
  const [viewingConversationalLesson, setViewingConversationalLesson] = useState<ConversationalLesson | null>(null);
  const [conversationalViewUrl, setConversationalViewUrl] = useState<string | null>(null);
  const [loadingConversationalView, setLoadingConversationalView] = useState(false);
  const hasOpenMaterial = Boolean(
    viewingDispatchArticle ||
    (viewingConversationalLesson && conversationalViewUrl) ||
    lessonViewUrl ||
    loadingViewUrl,
  );
  const materialTabTitle = viewingDispatchArticle?.title
    || viewingConversationalLesson?.title
    || studentLessonRequest?.title
    || (loadingViewUrl ? 'Opening material...' : 'Current material');
  const materialTabContext = viewingDispatchArticle
    ? 'Daily Dispatch'
    : viewingConversationalLesson
      ? 'Conversational Skills'
      : studentLessonRequest?.courseId === 'business-english'
        ? 'Business English'
        : studentLessonRequest?.courseId === 'young-learners'
          ? 'Young Learners'
          : 'Lesson Material';
  const materialTabIconClass = viewingDispatchArticle
    ? 'fas fa-newspaper'
    : viewingConversationalLesson
      ? 'fas fa-comments'
      : studentLessonRequest?.courseId === 'business-english'
        ? 'fas fa-briefcase'
        : studentLessonRequest?.courseId === 'young-learners'
          ? 'fas fa-seedling'
          : 'fas fa-book-open';
  const activeNotesMaterial = !showLessonRequest
    ? viewingDispatchArticle
      ? 'daily-dispatch'
      : isViewingBusinessEnglishMaterial
        ? 'business-english'
        : null
    : null;
  const showNotesWidgetTrigger = Boolean(activeNotesMaterial);
  const notesWidgetTitle = activeNotesMaterial === 'business-english'
    ? 'Business English Notes'
    : 'Daily Dispatch Notes';
  const notesWidgetFabTitle = activeNotesMaterial === 'business-english'
    ? 'Business English Notes'
    : 'Daily Dispatch Notes';
  const notesWidgetIconClass = activeNotesMaterial === 'business-english'
    ? 'fas fa-briefcase'
    : 'fas fa-newspaper';
  const notesWidgetClassName = activeNotesMaterial === 'business-english'
    ? `dispatch-notes-widget dispatch-notes-widget--business-english dispatch-notes-widget--business-english-${businessEnglishTheme}`
    : 'dispatch-notes-widget dispatch-notes-widget--daily-dispatch';
  const notesWidgetFabClassName = activeNotesMaterial === 'business-english'
    ? `dispatch-notes-fab dispatch-notes-fab--business-english dispatch-notes-fab--business-english-${businessEnglishTheme}`
    : 'dispatch-notes-fab dispatch-notes-fab--daily-dispatch';
  const activeNotesTarget: ActiveNotesTarget | null = !showLessonRequest
    ? viewingDispatchArticle
      ? {
          materialType: 'daily-dispatch',
          materialId: viewingDispatchArticle.id,
          courseId: 'daily-dispatch',
          articleId: viewingDispatchArticle.id,
        }
      : isViewingBusinessEnglishMaterial && studentLessonRequest?.lessonId
        ? {
            materialType: 'business-english',
            materialId: studentLessonRequest.lessonId,
            courseId: studentLessonRequest.courseId || 'business-english',
            lessonId: studentLessonRequest.lessonId,
          }
        : null
    : null;
  const activeNotesBindingKey = currentSessionId && activeNotesTarget
    ? buildClassroomNotesBindingKey(currentSessionId, activeNotesTarget)
    : null;
  const activeNotesMaterialType = activeNotesTarget?.materialType || null;
  const activeNotesMaterialId = activeNotesTarget?.materialId || null;
  const activeNotesCourseId = activeNotesTarget?.courseId || null;
  const activeNotesLessonId = activeNotesTarget?.lessonId || null;
  const activeNotesArticleId = activeNotesTarget?.articleId || null;

  const applyNotesSnapshot = (snapshot: Partial<ClassroomNotesSnapshot> | null | undefined) => {
    const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);
    setVocabularyItems(normalizedSnapshot.vocabularyItems);
    setGrammarItems(normalizedSnapshot.grammarItems);
    setPronunciationItems(normalizedSnapshot.pronunciationItems);
    setStudentComment(normalizedSnapshot.studentComment);
    setTutorMemo(normalizedSnapshot.tutorMemo);
  };

  const syncDraftFromServerRecord = (
    bindingKey: string,
    target: ActiveNotesTarget,
    record: ClassroomNotesRecord,
  ) => {
    if (!currentSessionId) {
      return;
    }

    const syncedDraft = createClassroomNotesDraft(
      currentSessionId,
      target,
      record,
      parseNotesUpdatedAt(record.updatedAt),
    );
    notesDraftUpdatedAtRef.current = syncedDraft.updatedAt;
    latestNotesDraftRef.current = syncedDraft;
    persistClassroomNotesDraft(bindingKey, syncedDraft);
  };

  const saveNotesSnapshotToBackend = async (
    bindingKey: string,
    target: ActiveNotesTarget,
    snapshot: Partial<ClassroomNotesSnapshot> | null | undefined,
  ) => {
    if (!currentSessionId) {
      throw new Error('Missing classroom session id');
    }

    const savedRecord = await tutorApi.saveClassroomNotes(
      currentSessionId,
      buildClassroomNotesPayload(target, snapshot),
    );

    syncDraftFromServerRecord(bindingKey, target, savedRecord);
    return savedRecord;
  };

  useEffect(() => {
    if (!currentSessionId || !activeNotesTarget || !activeNotesBindingKey) {
      latestNotesDraftRef.current = null;
      return;
    }

    const updatedAt = notesDraftUpdatedAtRef.current || Date.now();
    latestNotesDraftRef.current = createClassroomNotesDraft(
      currentSessionId,
      activeNotesTarget,
      {
        vocabularyItems,
        grammarItems,
        pronunciationItems,
        studentComment,
        tutorMemo,
      },
      updatedAt,
    );
  }, [
    activeNotesBindingKey,
    activeNotesArticleId,
    currentSessionId,
    activeNotesCourseId,
    grammarItems,
    activeNotesLessonId,
    activeNotesMaterialId,
    activeNotesMaterialType,
    pronunciationItems,
    studentComment,
    tutorMemo,
    vocabularyItems,
  ]);

  useEffect(() => {
    if (!currentSessionId) {
      return;
    }

    let openMaterial: ClassroomPersistedOpenMaterial | null = null;

    if (viewingDispatchArticle) {
      openMaterial = {
        kind: 'dispatch',
        article: viewingDispatchArticle,
      };
    } else if (viewingConversationalLesson && conversationalViewUrl) {
      openMaterial = {
        kind: 'conversational',
        lesson: viewingConversationalLesson,
        viewUrl: conversationalViewUrl,
      };
    } else if (lessonViewUrl && studentLessonRequest) {
      openMaterial = {
        kind: 'lesson',
        request: studentLessonRequest,
        viewUrl: lessonViewUrl,
        businessEnglishTheme: studentLessonRequest.courseId === 'business-english' ? businessEnglishTheme : undefined,
      };
    }

    try {
      if (!openMaterial) {
        restoredClassroomStateRef.current = null;
        window.sessionStorage.removeItem(buildClassroomPersistedStateKey(currentSessionId));
        return;
      }

      const persistedState: ClassroomPersistedState = {
        showLessonRequest,
        openMaterial,
      };
      restoredClassroomStateRef.current = persistedState;

      window.sessionStorage.setItem(
        buildClassroomPersistedStateKey(currentSessionId),
        JSON.stringify(persistedState),
      );
    } catch (error) {
      console.error('Failed to persist classroom material state:', error);
    }
  }, [
    businessEnglishTheme,
    conversationalViewUrl,
    currentSessionId,
    lessonViewUrl,
    showLessonRequest,
    studentLessonRequest,
    viewingConversationalLesson,
    viewingDispatchArticle,
  ]);

  useEffect(() => {
    if (!showNotesWidgetTrigger && showNotesWidget) {
      setShowNotesWidget(false);
    }
  }, [showNotesWidget, showNotesWidgetTrigger]);

  useEffect(() => {
    return () => {
      if (notesAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(notesAutosaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentSessionId || !activeNotesTarget || !activeNotesBindingKey) {
      notesHydratedKeyRef.current = null;
      setNotesPersistenceState('idle');
      return;
    }

    let cancelled = false;
    const localDraft = readClassroomNotesDraft(activeNotesBindingKey);
    setNotesPersistenceState('loading');

    if (localDraft) {
      notesHydratedKeyRef.current = activeNotesBindingKey;
      notesSkipAutosaveRef.current = true;
      notesSkipDraftPersistRef.current = true;
      notesDraftUpdatedAtRef.current = localDraft.updatedAt;
      latestNotesDraftRef.current = localDraft;
      applyNotesSnapshot(localDraft);
    }

    void (async () => {
      try {
        const savedNotes = await tutorApi.getClassroomNotes(
          currentSessionId,
          activeNotesTarget.materialType,
          activeNotesTarget.materialId,
        );

        if (cancelled) {
          return;
        }

        const remoteUpdatedAt = savedNotes ? parseNotesUpdatedAt(savedNotes.updatedAt) : 0;
        const shouldPreferLocalDraft = Boolean(
          localDraft && (!savedNotes || localDraft.updatedAt >= remoteUpdatedAt),
        );

        if (shouldPreferLocalDraft && localDraft) {
          notesHydratedKeyRef.current = activeNotesBindingKey;
          notesSkipAutosaveRef.current = true;
          notesSkipDraftPersistRef.current = true;
          notesDraftUpdatedAtRef.current = localDraft.updatedAt;
          latestNotesDraftRef.current = localDraft;
          applyNotesSnapshot(localDraft);

          if (!savedNotes || localDraft.updatedAt > remoteUpdatedAt) {
            setNotesPersistenceState('saving');

            try {
              await saveNotesSnapshotToBackend(activeNotesBindingKey, activeNotesTarget, localDraft);

              if (!cancelled && notesHydratedKeyRef.current === activeNotesBindingKey) {
                setNotesPersistenceState('saved');
              }
            } catch (error) {
              console.error('Failed to sync restored classroom notes draft:', error);
              if (!cancelled && notesHydratedKeyRef.current === activeNotesBindingKey) {
                setNotesPersistenceState('draft');
              }
            }
            return;
          }

          setNotesPersistenceState('saved');
          return;
        }

        notesHydratedKeyRef.current = activeNotesBindingKey;
        notesSkipAutosaveRef.current = true;
        notesSkipDraftPersistRef.current = true;

        if (savedNotes) {
          applyNotesSnapshot(savedNotes);
          syncDraftFromServerRecord(activeNotesBindingKey, activeNotesTarget, savedNotes);
          setNotesPersistenceState('saved');
          return;
        }

        notesDraftUpdatedAtRef.current = 0;
        latestNotesDraftRef.current = null;
        applyNotesSnapshot(null);
        setNotesPersistenceState('idle');
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load classroom notes:', error);
        notesHydratedKeyRef.current = activeNotesBindingKey;
        notesSkipAutosaveRef.current = true;
        notesSkipDraftPersistRef.current = true;

        if (localDraft) {
          notesDraftUpdatedAtRef.current = localDraft.updatedAt;
          latestNotesDraftRef.current = localDraft;
          applyNotesSnapshot(localDraft);
          setNotesPersistenceState('draft');
          return;
        }

        notesDraftUpdatedAtRef.current = 0;
        latestNotesDraftRef.current = null;
        applyNotesSnapshot(null);
        setNotesPersistenceState('error');
        toast.error('Failed to load saved notes');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeNotesBindingKey, activeNotesMaterialId, activeNotesMaterialType, currentSessionId]);

  useEffect(() => {
    if (!currentSessionId || !activeNotesTarget || !activeNotesBindingKey) {
      return;
    }

    if (notesHydratedKeyRef.current !== activeNotesBindingKey) {
      return;
    }

    if (notesSkipAutosaveRef.current) {
      notesSkipAutosaveRef.current = false;
      return;
    }

    if (notesAutosaveTimeoutRef.current !== null) {
      window.clearTimeout(notesAutosaveTimeoutRef.current);
    }

    notesAutosaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          setNotesPersistenceState('saving');
          await saveNotesSnapshotToBackend(activeNotesBindingKey, activeNotesTarget, {
            vocabularyItems,
            grammarItems,
            pronunciationItems,
            studentComment,
            tutorMemo,
          });

          if (notesHydratedKeyRef.current === activeNotesBindingKey) {
            setNotesPersistenceState('saved');
          }
        } catch (error) {
          console.error('Failed to save classroom notes:', error);
          if (notesHydratedKeyRef.current === activeNotesBindingKey) {
            setNotesPersistenceState(latestNotesDraftRef.current ? 'draft' : 'error');
          }
        }
      })();
    }, 700);

    return () => {
      if (notesAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(notesAutosaveTimeoutRef.current);
        notesAutosaveTimeoutRef.current = null;
      }
    };
  }, [
    activeNotesBindingKey,
    activeNotesArticleId,
    currentSessionId,
    grammarItems,
    activeNotesCourseId,
    activeNotesLessonId,
    activeNotesMaterialId,
    activeNotesMaterialType,
    pronunciationItems,
    studentComment,
    tutorMemo,
    vocabularyItems,
  ]);

  useEffect(() => {
    if (!currentSessionId || !activeNotesTarget || !activeNotesBindingKey) {
      return;
    }

    if (notesHydratedKeyRef.current !== activeNotesBindingKey) {
      return;
    }

    if (notesSkipDraftPersistRef.current) {
      notesSkipDraftPersistRef.current = false;
      return;
    }

    const updatedAt = Date.now();
    const draft = createClassroomNotesDraft(
      currentSessionId,
      activeNotesTarget,
      {
        vocabularyItems,
        grammarItems,
        pronunciationItems,
        studentComment,
        tutorMemo,
      },
      updatedAt,
    );

    notesDraftUpdatedAtRef.current = updatedAt;
    latestNotesDraftRef.current = draft;
    persistClassroomNotesDraft(activeNotesBindingKey, draft);
  }, [
    activeNotesBindingKey,
    activeNotesArticleId,
    currentSessionId,
    activeNotesCourseId,
    grammarItems,
    activeNotesLessonId,
    activeNotesMaterialId,
    activeNotesMaterialType,
    pronunciationItems,
    studentComment,
    tutorMemo,
    vocabularyItems,
  ]);

  useEffect(() => {
    if (!currentSessionId || !activeNotesTarget || !activeNotesBindingKey) {
      return;
    }

    const flushNotesDraft = (requestKeepaliveSave: boolean) => {
      const now = Date.now();
      if (now - notesLastExitFlushAtRef.current < 250) {
        return;
      }

      const currentDraft = latestNotesDraftRef.current;
      if (!currentDraft) {
        return;
      }

      notesLastExitFlushAtRef.current = now;

      const flushedDraft = createClassroomNotesDraft(
        currentSessionId,
        activeNotesTarget,
        currentDraft,
        now,
      );

      notesDraftUpdatedAtRef.current = now;
      latestNotesDraftRef.current = flushedDraft;
      persistClassroomNotesDraft(activeNotesBindingKey, flushedDraft);

      if (!requestKeepaliveSave) {
        return;
      }

      try {
        void window.fetch(`${API_BASE_URL}/tutor/classroom-notes/${encodeURIComponent(currentSessionId)}`, {
          method: 'PUT',
          credentials: 'include',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildClassroomNotesPayload(activeNotesTarget, flushedDraft)),
        }).catch((error) => {
          console.error('Failed to flush classroom notes during page exit:', error);
        });
      } catch (error) {
        console.error('Failed to flush classroom notes during page exit:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNotesDraft(false);
      }
    };

    const handlePageHide = () => {
      flushNotesDraft(true);
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    activeNotesArticleId,
    activeNotesBindingKey,
    currentSessionId,
    activeNotesCourseId,
    activeNotesLessonId,
    activeNotesMaterialId,
    activeNotesMaterialType,
  ]);

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
    setIsCourseDropdownOpen(false);
    setIsLevelDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    
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

    if (courseId === 'business-english') {
      const cachedLessons = materialCourseCacheRef.current[courseId] || readCachedBusinessEnglishLessonList<Lesson>(courseId);
      if (cachedLessons?.length) {
        materialCourseCacheRef.current[courseId] = cachedLessons;
        setAvailableLessons(cachedLessons);
        return;
      }
    } else if (isLessonMaterialCourse(courseId)) {
      const cachedLessons = materialCourseCacheRef.current[courseId];
      if (cachedLessons?.length) {
        setAvailableLessons(cachedLessons);
        return;
      }
    }
    
    setLoadingMaterials(true);
    try {
      // Use lesson-materials endpoint for builder-backed courses
      if (courseId === 'business-english') {
        const nextLessons = await warmBusinessEnglishCourseCache();
        setAvailableLessons(nextLessons);
      } else if (isLessonMaterialCourse(courseId)) {
        const result = await lessonApi.getPublishedLessonMaterials(courseId);
        if (result.success && result.lessons) {
          const nextLessons = result.lessons.map(transformLessonMaterialToLesson);
          materialCourseCacheRef.current[courseId] = nextLessons;
          setAvailableLessons(nextLessons);
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

    setIsLevelDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    updateCourseDropdownMenuPosition();
    setIsCourseDropdownOpen(true);
  };

  const toggleLevelDropdown = () => {
    if (!availableLevels.length) return;
    if (isLevelDropdownOpen) {
      setIsLevelDropdownOpen(false);
      return;
    }

    setIsCourseDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    updateLevelDropdownMenuPosition();
    setIsLevelDropdownOpen(true);
  };

  const toggleChapterDropdown = () => {
    if (selectedLevel === null || !availableChapters.length) return;
    if (isChapterDropdownOpen) {
      setIsChapterDropdownOpen(false);
      return;
    }

    setIsCourseDropdownOpen(false);
    setIsLevelDropdownOpen(false);
    setIsLessonDropdownOpen(false);
    updateChapterDropdownMenuPosition();
    setIsChapterDropdownOpen(true);
  };

  const toggleLessonDropdown = () => {
    if (!filteredLessons.length) return;
    if (isLessonDropdownOpen) {
      setIsLessonDropdownOpen(false);
      return;
    }

    setIsCourseDropdownOpen(false);
    setIsLevelDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    updateLessonDropdownMenuPosition();
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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCourseDropdownOpen(false);
        setIsLevelDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setIsLessonDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
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

    const syncDropdownPositions = () => {
      if (isCourseDropdownOpen) updateCourseDropdownMenuPosition();
      if (isLevelDropdownOpen) updateLevelDropdownMenuPosition();
      if (isChapterDropdownOpen) updateChapterDropdownMenuPosition();
      if (isLessonDropdownOpen) updateLessonDropdownMenuPosition();
    };

    syncDropdownPositions();
    window.addEventListener('resize', syncDropdownPositions);
    window.addEventListener('scroll', syncDropdownPositions, true);

    return () => {
      window.removeEventListener('resize', syncDropdownPositions);
      window.removeEventListener('scroll', syncDropdownPositions, true);
    };
  }, [isCourseDropdownOpen, isLevelDropdownOpen, isChapterDropdownOpen, isLessonDropdownOpen]);

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
  const selectedBusinessLevelLessons = selectedLevel !== null
    ? availableLessons.filter(lesson => getLevelNumber(lesson) === selectedLevel)
    : [];
  const selectedLevelSummary = selectedLevel !== null
    ? `${selectedBusinessLevelLessons.length} lesson${selectedBusinessLevelLessons.length === 1 ? '' : 's'} available`
    : availableLevels.length > 0
      ? `${availableLevels.length} level${availableLevels.length === 1 ? '' : 's'} available`
      : 'Levels will appear here';
  const selectedChapterSummary = selectedLevel === null
    ? 'Choose a level first'
    : availableChapters.length > 0
      ? `${availableChapters.length} chapter${availableChapters.length === 1 ? '' : 's'} in this level`
      : 'No chapters available yet';
  const selectedBusinessLesson = selectedLessonId
    ? filteredLessons.find(lesson => lesson.id === selectedLessonId) || null
    : null;
  const selectedLessonSummary = selectedBusinessLesson
    ? selectedBusinessLesson.lessonData?.header?.goalText || selectedBusinessLesson.title
    : filteredLessons.length > 0
      ? `${filteredLessons.length} lesson${filteredLessons.length === 1 ? '' : 's'} in this chapter`
      : selectedChapter === null
        ? 'Choose a chapter first'
        : 'No lessons available yet';
  const showSelectedCourseDetails = Boolean(selectedCourse) && !isCourseDropdownOpen;

  // Handle selecting a new material (for tutor to override)
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
      
      setStudentLessonRequest(prev => prev ? { ...prev, ...newLesson } : newLesson);
      
      setViewingDispatchArticle(null);
      setViewingConversationalLesson(null);
      setConversationalViewUrl(null);

      if (selectedCourse === 'business-english') {
        setLoadingViewUrl(false);
        setLessonViewUrl(`/materials/business-english/${selectedLesson.id}`);
        setShowLessonRequest(false);
        void prefetchBusinessEnglishLesson(selectedLesson.id);
        return;
      }

      // Fetch the lesson viewUrl for iframe display (use tutor view for tutor)
      setLoadingViewUrl(true);
      try {
        const nextViewUrl = await resolveTutorMaterialViewUrl(selectedCourse, selectedLesson.id);
        setLessonViewUrl(nextViewUrl);
      } catch (err) {
        console.error('Failed to get lesson view URL:', err);
      } finally {
        setLoadingViewUrl(false);
      }

      // Keep the current selection state warm so switching tabs feels instant
      setShowLessonRequest(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await warmBusinessEnglishCourseCache();
      } catch (error) {
        console.error('Failed to warm Business English selector cache:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (studentLessonRequest?.courseId === 'business-english' && studentLessonRequest.lessonId) {
      void prefetchBusinessEnglishLesson(studentLessonRequest.lessonId);
    }
  }, [studentLessonRequest?.courseId, studentLessonRequest?.lessonId]);

  useEffect(() => {
    if (selectedCourse !== 'business-english') {
      return;
    }

    const firstLessonInChapter = filteredLessons[0];
    if (firstLessonInChapter) {
      void prefetchBusinessEnglishLesson(firstLessonInChapter.id);
    }
  }, [filteredLessons, selectedCourse]);

  useEffect(() => {
    if (selectedCourse === 'business-english' && selectedLessonId) {
      void prefetchBusinessEnglishLesson(selectedLessonId);
    }
  }, [selectedCourse, selectedLessonId]);

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
        await startLocalStream(true, true);
      } catch (err) {
        console.error('❌ [Classroom] Failed to start media:', err);
      }
    };

    initWebRTC();
  }, []); // Empty deps - only run once on mount

  // When student info is known and local stream is ready, tutor initiates offer
  useEffect(() => {
    if (studentInfo?.id && localStream) {
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
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'close-lesson-material' || event.data?.type === 'closeMaterial') {
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

  // Handle file selection
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
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

  const handleLeaveClassroom = async () => {
    if (await toastConfirm('Are you sure you want to leave the classroom?', 'Leave Classroom')) {
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
          <div className="classroom-header-actions">
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
                    {msg.text && !msg.text.startsWith('*') && (
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
            <textarea
              placeholder="Type a message... (*bold* _italic_) | Shift+Enter for new line"
              value={message}
              onChange={(e) => {
                const newValue = (e.target as HTMLTextAreaElement).value;
                setMessage(newValue);
                // Only show typing if there's actual text
                handleTyping(newValue.trim().length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              onBlur={() => handleTyping(false)}
              rows={1}
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
              onClick={() => setShowLessonRequest(true)}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Go to Selection Tab
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
          <div className={`dispatch-view-header business-english-theme business-english-theme--${businessEnglishTheme}`}>
            <button
              className="btn-back-to-request"
              onClick={() => {
                setShowLessonRequest(true);
              }}
            >
              <i className="fi fi-sr-arrow-left"></i>
              Go to Selection Tab
            </button>
            <div className="dispatch-view-meta">
              <span className="dispatch-view-category">Business English</span>
              <span className="dispatch-view-date">{businessEnglishHeaderTitle}</span>
            </div>
          </div>
        ) : null}

        {/* Chosen Material Display or PDF Viewer */}
        <div className={`material-content ${showLessonRequest ? 'material-content--request' : ''}`}>
          {showLessonRequest ? (
            <div className="lesson-request-container">
              {/* Lesson Request Section - always show, even if no material selected */}
              <div className="lesson-request-section">
                <div className="lesson-request-header">
                  <div className="lesson-request-title-wrap">
                    <h2 className="lesson-request-title">
                      <i className="fas fa-clipboard-list" />
                      Lesson Request
                    </h2>
                    <p className="lesson-request-subtitle">
                      Review the student's selected lesson and the teaching cues they shared before class begins.
                    </p>
                  </div>
                  <div className="lesson-request-meta">
                    <span className={`lesson-request-status ${studentLessonRequest ? 'lesson-request-status--ready' : 'lesson-request-status--pending'}`}>
                      {studentLessonRequest ? 'Material chosen' : 'Awaiting selection'}
                    </span>
                    <p className="lesson-request-updated">
                      Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
                
                <div className="lesson-request-body">
                  <div className="lesson-request-content">
                    <div className="lesson-request-details">
                      <div className="request-intro-block">
                        <span className="request-eyebrow">Student brief</span>
                        <p className="request-intro">Student's lesson request details below.</p>
                      </div>
                      
                      {studentLessonRequest ? (
                        <>
                          <div className="request-detail-grid">
                            <div className="request-detail-card request-detail-card--primary">
                              <span className="request-detail-label">Selected material</span>
                              <a 
                                href={selectedMaterialHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="request-link"
                              >
                                {studentLessonRequest.title}
                              </a>
                              <span className="request-detail-meta">Open lesson in a new tab</span>
                            </div>

                            <div className="request-detail-card request-detail-card--compact">
                              <span className="request-detail-label">Lesson number</span>
                              <span className="request-detail-value">Lesson {studentLessonRequest.lessonNumber}</span>
                            </div>
                          </div>

                        </>
                      ) : (
                        <div className="request-empty-state">
                          <div className="request-empty-icon">
                            <i className="fas fa-book-open" />
                          </div>
                          <div className="request-empty-copy">
                            <p className="request-empty-title">No material selected yet</p>
                            <p className="request-empty-description">
                              You can still choose a lesson below and guide the student from the classroom.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="student-preferences-sidebar">
                      <div className="student-preferences-header">
                        <span className="preference-kicker">Student setup</span>
                        <h4 className="preference-panel-title">Teaching preferences</h4>
                      </div>

                      <div className="preference-card-grid">
                        <div className="preference-card preference-card--camera">
                          <span className="preference-card-label">Camera</span>
                          <p className="preference-card-value">
                            {studentLessonRequest?.studentPreferences?.cameraOn !== false ? 'On' : 'Off'}
                          </p>
                          <span className="preference-card-note">Use this as your default video setup.</span>
                        </div>

                        <div className="preference-card preference-card--proficiency">
                          <span className="preference-card-label">Proficiency</span>
                          <p className="preference-card-value">
                            {studentLessonRequest?.studentPreferences?.proficiency || 'Not set'}
                          </p>
                          <span className="preference-card-note">Helpful for pacing and vocabulary choices.</span>
                        </div>

                        <div className="preference-card preference-card--correction">
                          <span className="preference-card-label">Error correction</span>
                          <p className="preference-card-value">
                            {studentLessonRequest?.studentPreferences?.errorCorrection === 'proactively' 
                              ? 'Correct proactively'
                              : studentLessonRequest?.studentPreferences?.errorCorrection === 'during_feedback'
                              ? 'Save for feedback'
                              : 'Tutor decides'}
                          </p>
                          <span className="preference-card-note">
                            {studentLessonRequest?.studentPreferences?.errorCorrection === 'proactively' 
                              ? 'Student prefers immediate support during class.'
                              : studentLessonRequest?.studentPreferences?.errorCorrection === 'during_feedback'
                              ? 'Student prefers review during feedback time.'
                              : 'No strong preference was shared.'}
                          </span>
                        </div>

                        {studentLessonRequest?.studentPreferences?.otherRequests && (
                          <div className="preference-card preference-card--wide preference-card--other">
                            <span className="preference-card-label">Other request</span>
                            <p className="preference-card-value">{studentLessonRequest.studentPreferences.otherRequests}</p>
                          </div>
                        )}
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
                      Choose the course library you want to teach from. You can switch materials whenever you need.
                    </p>
                  </div>
                  {studentLessonRequest && (
                    <span className="material-selector-chip">
                      Requested lesson {studentLessonRequest.lessonNumber}
                    </span>
                  )}
                </div>
                <div className="material-selector-body">
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
                              onClick={() => {
                                setViewingDispatchArticle(dispatchArticles[0]);
                                setViewingConversationalLesson(null);
                                setConversationalViewUrl(null);
                                setLessonViewUrl(null);
                                setShowLessonRequest(false);
                              }}
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
                              onClick={() => {
                                setViewingDispatchArticle(article);
                                setViewingConversationalLesson(null);
                                setConversationalViewUrl(null);
                                setLessonViewUrl(null);
                                setShowLessonRequest(false);
                              }}
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
                {showSelectedCourseDetails && selectedCourse === 'conversational-skills' && (
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
                                              setViewingDispatchArticle(null);
                                              setViewingConversationalLesson(viewLesson);
                                              // Use local route directly instead of API call
                                              setConversationalViewUrl(`/materials/conversational-skills/${lesson.id}`);
                                              setLessonViewUrl(null);
                                              setShowLessonRequest(false);
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
                
                {/* Business English filters */}
                {showSelectedCourseDetails && selectedCourse === 'business-english' && availableLevels.length > 0 && (
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
                            {selectedLevel !== null ? (
                              <>
                                <span className="material-selector-trigger-icon material-selector-trigger-icon--level" aria-hidden="true">
                                  <i className="fas fa-layer-group"></i>
                                </span>
                                <span className="material-selector-trigger-copy">
                                  <span className="material-selector-trigger-title">Level {selectedLevel}</span>
                                  <span className="material-selector-trigger-subtitle">{selectedLevelSummary}</span>
                                </span>
                              </>
                            ) : (
                              <span className="material-selector-trigger-placeholder">
                                Select a Business English level
                              </span>
                            )}
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isLevelDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>

                        {isLevelDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Business English level"
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
                            {selectedChapter !== null ? (
                              <>
                                <span className="material-selector-trigger-icon material-selector-trigger-icon--chapter" aria-hidden="true">
                                  <i className="fas fa-list-ul"></i>
                                </span>
                                <span className="material-selector-trigger-copy">
                                  <span className="material-selector-trigger-title">Chapter {selectedChapter}</span>
                                  <span className="material-selector-trigger-subtitle">{selectedChapterSummary}</span>
                                </span>
                              </>
                            ) : (
                              <span className="material-selector-trigger-placeholder">
                                {selectedLevel === null ? 'Choose a level first' : 'Select a chapter'}
                              </span>
                            )}
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isChapterDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>

                        {isChapterDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Business English chapter"
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
                                    <i className="fas fa-list-ul"></i>
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

                {/* Business English lesson selector */}
                {showSelectedCourseDetails && selectedCourse === 'business-english' && selectedChapter !== null && filteredLessons.length > 0 && (
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
                            {selectedBusinessLesson ? (
                              <>
                                <span className="material-selector-trigger-icon material-selector-trigger-icon--lesson" aria-hidden="true">
                                  <i className="fas fa-book-open"></i>
                                </span>
                                <span className="material-selector-trigger-copy">
                                  <span className="material-selector-trigger-title">{selectedBusinessLesson.title}</span>
                                  <span className="material-selector-trigger-subtitle">{selectedLessonSummary}</span>
                                </span>
                              </>
                            ) : (
                              <span className="material-selector-trigger-placeholder">
                                Select a lesson
                              </span>
                            )}
                          </span>
                          <span className="material-selector-trigger-arrow" aria-hidden="true">
                            <i className={`fas ${isLessonDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </span>
                        </button>

                        {isLessonDropdownOpen && (
                          <div
                            className="material-selector-menu"
                            role="listbox"
                            aria-label="Business English lesson"
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
                                      {lesson.lessonData?.header?.goalText || 'Open this lesson in the classroom viewer'}
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

                {/* Level Selector - shows for other courses */}
                {showSelectedCourseDetails && selectedCourse && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedCourse !== 'business-english' && availableLevels.length > 0 && (
                  <div className="material-selector-row">
                    <select 
                      className="material-selector-dropdown"
                      value={selectedLevel ?? ''}
                      onChange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        setSelectedLevel(val ? parseInt(val) : null);
                        setSelectedChapter(null);
                        setSelectedLessonId('');
                      }}
                    >
                      <option value="">-- Select Level --</option>
                      {availableLevels.map(level => (
                        <option key={level} value={level}>Level {level}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Chapter Selector - shows when level is selected (for other courses) */}
                {showSelectedCourseDetails && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedCourse !== 'business-english' && selectedLevel !== null && availableChapters.length > 0 && (
                  <div className="material-selector-row">
                    <select 
                      className="material-selector-dropdown"
                      value={selectedChapter ?? ''}
                      onChange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        setSelectedChapter(val ? parseInt(val) : null);
                        setSelectedLessonId('');
                      }}
                    >
                      <option value="">-- Select Chapter --</option>
                      {availableChapters.map(chapter => (
                        <option key={chapter} value={chapter}>Chapter {chapter}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Lesson Selector - shows when chapter is selected (for other courses) */}
                {showSelectedCourseDetails && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedCourse !== 'business-english' && selectedChapter !== null && filteredLessons.length > 0 && (
                  <div className="material-selector-row">
                    <select 
                      className="material-selector-dropdown"
                      value={selectedLessonId}
                      onChange={(e) => setSelectedLessonId((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">-- Select Lesson --</option>
                      {filteredLessons.map(lesson => (
                        <option key={lesson.id} value={lesson.id}>
                          Lesson {getLessonNumber(lesson)}: {lesson.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Loading indicator - for other courses with dropdowns */}
                {showSelectedCourseDetails && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && loadingMaterials && (
                  <div className="material-loading-inline">
                    <div className="spinner-small"></div>
                    <span>Loading...</span>
                  </div>
                )}
                
                {/* Select Button - shows when a lesson is selected (for other courses) */}
                {showSelectedCourseDetails && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedLessonId && (
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
          ) : !showLessonRequest && isViewingBusinessEnglishMaterial && studentLessonRequest?.lessonId ? (
            <div className="lesson-material-view lesson-material-view--business-english">
              {loadingViewUrl ? (
                <div className="material-loading">
                  <div className="spinner"></div>
                  <p>Loading lesson...</p>
                </div>
              ) : (
                <BusinessEnglishPreviewPage
                  key={studentLessonRequest.lessonId}
                  lessonId={studentLessonRequest.lessonId}
                  embedded
                  forcedTheme={businessEnglishTheme}
                  onRequestClose={() => setShowLessonRequest(true)}
                />
              )}
            </div>
          ) : !showLessonRequest && lessonViewUrl ? (
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
                  title={studentLessonRequest?.title || 'Lesson Material'}
                />
              ) : (
                <div className="pdf-viewer-container">
                  <PdfViewer socket={socketInstance} sessionId={currentSessionId} userType="tutor" />
                </div>
              )}
            </div>
          ) : (
            <div className="pdf-viewer-container">
              <PdfViewer socket={socketInstance} sessionId={currentSessionId} userType="tutor" />
            </div>
          )}
        </div>
      </div>

      {/* Classroom Notes Floating Button */}
      {showNotesWidgetTrigger && (
        <button 
          className={`${notesWidgetFabClassName} ${showNotesWidget ? 'active' : ''}`}
          onClick={() => setShowNotesWidget(!showNotesWidget)}
          title={notesWidgetFabTitle}
        >
          <i className={showNotesWidget ? 'fi fi-sr-cross-small' : 'fi fi-sr-pencil'} />
        </button>
      )}

      {/* Classroom Notes Widget */}
      {showNotesWidgetTrigger && showNotesWidget && (
        <div className={notesWidgetClassName}>
          <div className="dispatch-notes-header">
            <h3>
              <i className={notesWidgetIconClass} />
              {notesWidgetTitle}
            </h3>
            <button 
              className="dispatch-notes-close"
              onClick={() => setShowNotesWidget(false)}
            >
              <i className="fi fi-sr-cross" />
            </button>
          </div>
          
          <div className="dispatch-notes-content">
            <div className="dispatch-notes-section">
              <label className="dispatch-notes-label">
                <i className="fi fi-sr-book-alt" />
                VOCABULARY
              </label>
              <div className="vocabulary-items">
                {vocabularyItems.map((item, index) => (
                  <div className="vocabulary-row" key={index}>
                    {vocabularyItems.length > 1 && (
                      <button 
                        className="vocabulary-remove-btn"
                        onClick={() => removeVocabularyItem(index)}
                        title="Remove"
                      >
                        <i className="fi fi-sr-cross-small" />
                      </button>
                    )}
                    <div className="vocabulary-inputs">
                      <div className="vocabulary-field">
                        <span className="vocabulary-field-label">Word/Phrase:</span>
                        <div className="vocabulary-input-row">
                          <input
                            type="text"
                            className="vocabulary-word-input"
                            placeholder="Enter word or phrase..."
                            value={item.word}
                            onChange={(e) => updateVocabularyWord(index, (e.target as HTMLInputElement).value)}
                            onBlur={() => item.word.trim() && !item.definitions.length && getVocabularyDefinition(index)}
                          />
                          <button
                            className={`vocabulary-check-btn ${item.isLoading ? 'loading' : ''}`}
                            onClick={() => item.word.trim() && getVocabularyDefinition(index)}
                            disabled={item.isLoading || !item.word.trim()}
                            title="Get definition"
                          >
                            <i className={item.isLoading ? "fi fi-sr-spinner" : "fi fi-sr-refresh"} />
                          </button>
                        </div>
                      </div>
                      <div className="vocabulary-field">
                        <span className="vocabulary-field-label">Definition:</span>
                        <div className="vocabulary-definition-row">
                          {item.isLoading ? (
                            <div className="vocabulary-loading">
                              <i className="fi fi-sr-spinner" />
                              Getting definition...
                            </div>
                          ) : item.definitions.length > 0 ? (
                            <>
                              {item.showDefinition ? (
                                <div className="vocabulary-definition-content">
                                  {item.definitions.length > 1 && (
                                    <div className="vocabulary-definition-tabs">
                                      {item.definitions.map((def, defIdx) => (
                                        <button
                                          key={defIdx}
                                          className={`vocabulary-def-tab ${item.selectedDefinitionIndex === defIdx ? 'active' : ''}`}
                                          onClick={() => selectDefinition(index, defIdx)}
                                          title={def.meaning}
                                        >
                                          {defIdx + 1}. {def.partOfSpeech || 'def'}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="vocabulary-definition-display">
                                    {item.definitions[item.selectedDefinitionIndex]?.partOfSpeech && (
                                      <span className="vocabulary-part-of-speech">
                                        ({item.definitions[item.selectedDefinitionIndex].partOfSpeech})
                                      </span>
                                    )}
                                    <span className="vocabulary-meaning">
                                      {item.definitions[item.selectedDefinitionIndex]?.meaning}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="vocabulary-definition-hidden">
                                  <span>Definition hidden</span>
                                </div>
                              )}
                              <button 
                                className={`vocabulary-toggle-btn ${item.showDefinition ? 'active' : ''}`}
                                onClick={() => toggleVocabularyDefinition(index)}
                                title={item.showDefinition ? "Hide definition" : "Show definition"}
                              >
                                <i className={item.showDefinition ? "fi fi-sr-eye" : "fi fi-sr-eye-crossed"} />
                              </button>
                              {item.showDefinition && item.definitions[item.selectedDefinitionIndex]?.koreanNative && (
                                <button 
                                  className={`vocabulary-info-btn ${item.showTranslation ? 'active' : ''}`}
                                  onClick={() => toggleVocabularyTranslation(index)}
                                  title="Show translations"
                                >
                                  <i className="fi fi-sr-info" />
                                </button>
                              )}
                              {item.word.trim() && item.definitions[item.selectedDefinitionIndex]?.meaning && (
                                <button
                                  className="vocabulary-send-btn"
                                  onClick={() => sendVocabularyToChat(index)}
                                  title="Send to chat"
                                >
                                  <i className="fi fi-sr-paper-plane" />
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="vocabulary-definition-placeholder">
                              Enter a word and click refresh to get definition
                            </div>
                          )}
                        </div>
                      </div>
                      {item.showTranslation && item.definitions[item.selectedDefinitionIndex] && (
                        <div className="vocabulary-translations">
                          {item.definitions[item.selectedDefinitionIndex].koreanNative && (
                            <div className="vocabulary-translation-item korean">
                              <span className="translation-flag">🇰🇷</span>
                              <div className="translation-content">
                                <span className="translation-native">{item.definitions[item.selectedDefinitionIndex].koreanNative}</span>
                                <span className="translation-romanized">{item.definitions[item.selectedDefinitionIndex].koreanRomanized}</span>
                              </div>
                            </div>
                          )}
                          {item.definitions[item.selectedDefinitionIndex].vietnameseNative && (
                            <div className="vocabulary-translation-item vietnamese">
                              <span className="translation-flag">🇻🇳</span>
                              <div className="translation-content">
                                <span className="translation-native">{item.definitions[item.selectedDefinitionIndex].vietnameseNative}</span>
                                <span className="translation-romanized">{item.definitions[item.selectedDefinitionIndex].vietnameseRomanized}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="vocabulary-add-btn" onClick={addVocabularyItem}>
                <i className="fi fi-sr-plus" />
                Add Word
              </button>
            </div>
            
            <div className="dispatch-notes-section">
              <label className="dispatch-notes-label">
                <i className="fi fi-sr-text" />
                GRAMMAR
              </label>
              <div className="grammar-items">
                {grammarItems.map((item, index) => (
                  <div className="grammar-row" key={index}>
                    {grammarItems.length > 1 && (
                      <button 
                        className="grammar-remove-btn"
                        onClick={() => removeGrammarItem(index)}
                        title="Remove"
                      >
                        <i className="fi fi-sr-cross-small" />
                      </button>
                    )}
                    <div className="grammar-inputs">
                      <div className="grammar-field">
                        <span className="grammar-field-label">You said:</span>
                        <div className="grammar-input-row">
                          <textarea
                            className="grammar-input"
                            placeholder="Enter incorrect sentence..."
                            value={item.youSaid}
                            onChange={(e) => updateYouSaid(index, (e.target as HTMLTextAreaElement).value)}
                            onBlur={() => item.youSaid.trim() && !item.correct && getGrammarCorrection(index)}
                            rows={1}
                          />
                          <button
                            className={`grammar-check-btn ${item.isLoading ? 'loading' : ''}`}
                            onClick={() => item.youSaid.trim() && getGrammarCorrection(index)}
                            disabled={item.isLoading || !item.youSaid.trim()}
                            title="Check grammar"
                          >
                            <i className={item.isLoading ? "fi fi-sr-spinner" : "fi fi-sr-refresh"} />
                          </button>
                        </div>
                      </div>
                      <div className="grammar-field">
                        <span className="grammar-field-label">Correct:</span>
                        <div className="grammar-correct-row">
                          {item.isLoading ? (
                            <div className="grammar-loading">
                              <i className="fi fi-sr-spinner" />
                              Checking...
                            </div>
                          ) : (
                            <>
                              <textarea
                                className="grammar-input grammar-input-correct"
                                placeholder="Corrected sentence..."
                                value={item.correct}
                                onChange={(e) => updateGrammarItem(index, 'correct', (e.target as HTMLTextAreaElement).value)}
                                rows={1}
                              />
                              {(item.simpleExplanation || item.technicalExplanation) && (
                                <button 
                                  className={`grammar-info-btn ${item.showExplanation ? 'active' : ''}`}
                                  onClick={() => toggleGrammarExplanation(index)}
                                  title="Show explanation"
                                >
                                  <i className="fi fi-sr-info" />
                                </button>
                              )}
                              {item.youSaid.trim() && item.correct.trim() && (
                                <button
                                  className="grammar-send-btn"
                                  onClick={() => sendGrammarToChat(index)}
                                  title="Send to chat"
                                >
                                  <i className="fi fi-sr-paper-plane" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {item.showExplanation && (item.simpleExplanation || item.technicalExplanation) && (
                        <div className="grammar-explanation">
                          <div className="grammar-explanation-simple">
                            <i className="fi fi-sr-lightbulb-on" />
                            {item.simpleExplanation}
                          </div>
                          <div className="grammar-explanation-technical">
                            <i className="fi fi-sr-book-alt" />
                            {item.technicalExplanation}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="grammar-add-btn" onClick={addGrammarItem}>
                <i className="fi fi-sr-plus" />
                Add Grammar Note
              </button>
            </div>
            
            <div className="dispatch-notes-section">
              <label className="dispatch-notes-label">
                <i className="fi fi-sr-microphone" />
                PRONUNCIATION
              </label>
              <div className="pronunciation-items">
                {pronunciationItems.map((item, index) => (
                  <div className="pronunciation-row" key={index}>
                    {pronunciationItems.length > 1 && (
                      <button 
                        className="pronunciation-remove-btn"
                        onClick={() => removePronunciationItem(index)}
                        title="Remove"
                      >
                        <i className="fi fi-sr-cross-small" />
                      </button>
                    )}
                    <div className="pronunciation-inputs">
                      <div className="pronunciation-field">
                        <span className="pronunciation-field-label">Word:</span>
                        <div className="pronunciation-input-row">
                          <input
                            type="text"
                            className="pronunciation-word-input"
                            placeholder="Enter word..."
                            value={item.word}
                            onChange={(e) => updatePronunciationWord(index, (e.target as HTMLInputElement).value)}
                            onBlur={() => item.word.trim() && !item.phonetic && getPronunciationFromAI(index)}
                          />
                          <button
                            className={`pronunciation-check-btn ${item.isLoading ? 'loading' : ''}`}
                            onClick={() => item.word.trim() && getPronunciationFromAI(index)}
                            disabled={item.isLoading || !item.word.trim()}
                            title="Get pronunciation"
                          >
                            <i className={item.isLoading ? "fi fi-sr-spinner" : "fi fi-sr-refresh"} />
                          </button>
                        </div>
                      </div>
                      <div className="pronunciation-field">
                        <span className="pronunciation-field-label">Phonetic:</span>
                        <div className="pronunciation-phonetic-row">
                          {item.isLoading ? (
                            <div className="pronunciation-loading">
                              <i className="fi fi-sr-spinner" />
                              Getting pronunciation...
                            </div>
                          ) : item.phonetic ? (
                            <>
                              {item.showPhonetic ? (
                                <div className="pronunciation-phonetic-content">
                                  <div className="pronunciation-display">
                                    <span className="pronunciation-phonetic-display">{item.phonetic}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="pronunciation-phonetic-hidden">
                                  <span>Pronunciation hidden</span>
                                </div>
                              )}
                              <button 
                                className={`pronunciation-toggle-btn ${item.showPhonetic ? 'active' : ''}`}
                                onClick={() => togglePronunciationPhonetic(index)}
                                title={item.showPhonetic ? "Hide pronunciation" : "Show pronunciation"}
                              >
                                <i className={item.showPhonetic ? "fi fi-sr-eye" : "fi fi-sr-eye-crossed"} />
                              </button>
                              {item.word.trim() && item.phonetic && (
                                <button
                                  className="pronunciation-send-btn"
                                  onClick={() => sendPronunciationToChat(index)}
                                  title="Send to chat"
                                >
                                  <i className="fi fi-sr-paper-plane" />
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="pronunciation-phonetic-placeholder">
                              Enter a word and click refresh to get pronunciation
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="pronunciation-add-btn" onClick={addPronunciationItem}>
                <i className="fi fi-sr-plus" />
                Add Pronunciation Note
              </button>
            </div>

            <div className="dispatch-notes-section">
              <label className="dispatch-notes-label">
                <i className="fas fa-comment-dots" />
                COMMENT TO STUDENT
              </label>
              <textarea
                className="dispatch-notes-textarea dispatch-notes-textarea--tall"
                placeholder="Write a comment the student can review after the lesson..."
                value={studentComment}
                onChange={(e) => setStudentComment((e.target as HTMLTextAreaElement).value)}
              />
            </div>

            <div className="dispatch-notes-section">
              <label className="dispatch-notes-label">
                <i className="fas fa-sticky-note" />
                TUTOR MEMO
              </label>
              <textarea
                className="dispatch-notes-textarea dispatch-notes-textarea--tall"
                placeholder="Private tutor memo for this assigned lesson..."
                value={tutorMemo}
                onChange={(e) => setTutorMemo((e.target as HTMLTextAreaElement).value)}
              />
            </div>
          </div>
          
          <div className="dispatch-notes-footer">
            <div className={`dispatch-notes-save-state dispatch-notes-save-state--${notesPersistenceState}`}>
              {notesPersistenceState === 'loading'
                ? 'Loading saved notes...'
                : notesPersistenceState === 'saving'
                  ? 'Saving...'
                  : notesPersistenceState === 'saved'
                    ? 'Saved to this lesson'
                    : notesPersistenceState === 'draft'
                      ? 'Draft kept on this device'
                    : notesPersistenceState === 'error'
                      ? 'Save unavailable'
                      : 'Notes stay with this lesson'}
            </div>
            <button 
              className="dispatch-notes-clear"
              onClick={() => {
                setVocabularyItems([createEmptyVocabularyItem()]);
                setGrammarItems([createEmptyGrammarItem()]);
                setPronunciationItems([createEmptyPronunciationItem()]);
                setStudentComment('');
                setTutorMemo('');
              }}
            >
              <i className="fi fi-sr-trash" />
              Clear All
            </button>
            <button 
              className="dispatch-notes-copy"
              onClick={() => {
                const vocabText = vocabularyItems
                  .filter(item => item.word.trim() || item.definitions.length > 0)
                  .map(item => {
                    const def = item.definitions[item.selectedDefinitionIndex];
                    return `• ${item.word}: ${def?.meaning || '(no definition)'}`;
                  })
                  .join('\n');
                const grammarText = grammarItems
                  .filter(item => item.youSaid.trim() || item.correct.trim())
                  .map(item => `• "${item.youSaid}" → "${item.correct}"${item.simpleExplanation ? ` (${item.simpleExplanation})` : ''}`)
                  .join('\n');
                const pronunciationText = pronunciationItems
                  .filter(item => item.word.trim() || item.phonetic)
                  .map(item => `• ${item.word} - [${item.phonetic}]`)
                  .join('\n');
                const notes = `VOCABULARY:\n${vocabText || '(none)'}\n\nGRAMMAR:\n${grammarText || '(none)'}\n\nPRONUNCIATION:\n${pronunciationText || '(none)'}\n\nCOMMENT TO STUDENT:\n${studentComment.trim() || '(none)'}\n\nTUTOR MEMO:\n${tutorMemo.trim() || '(none)'}`;
                navigator.clipboard.writeText(notes);
                toast.success('Notes copied to clipboard!');
              }}
            >
              <i className="fi fi-sr-clipboard" />
              Copy Notes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomPage;

import { useState, useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket } from '../client/socket/socket.client';
import { useWebRTC } from '../hooks/useWebRTC';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import { toast, toastConfirm } from '../Components/Common/Toast';
import { lessonApi, type Lesson } from '../api/lesson.api';
import { tutorApi } from '../api/tutor.api';
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
          setStudentLessonRequest(lessonRequest);
          
          // Also fetch the lesson viewUrl for iframe display
          if (lessonRequest.lessonId) {
            try {
              const lessonResult = await lessonApi.getTutorLesson(lessonRequest.lessonId);
              if (lessonResult.success && lessonResult.viewUrl) {
                setLessonViewUrl(lessonResult.viewUrl);
              }
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
  const [vocabularyItems, setVocabularyItems] = useState<{
    word: string;
    definitions: {
      meaning: string;
      partOfSpeech: string;
      koreanNative: string;
      koreanRomanized: string;
      vietnameseNative: string;
      vietnameseRomanized: string;
    }[];
    selectedDefinitionIndex: number;
    isLoading: boolean;
    showDefinition: boolean;
    showTranslation: boolean;
  }[]>([
    { word: '', definitions: [], selectedDefinitionIndex: 0, isLoading: false, showDefinition: false, showTranslation: false }
  ]);
  const [grammarItems, setGrammarItems] = useState<{
    youSaid: string;
    correct: string;
    simpleExplanation: string;
    technicalExplanation: string;
    isLoading: boolean;
    showExplanation: boolean;
  }[]>([
    { youSaid: '', correct: '', simpleExplanation: '', technicalExplanation: '', isLoading: false, showExplanation: false }
  ]);
  const [pronunciationItems, setPronunciationItems] = useState<{
    word: string;
    phonetic: string;
    isLoading: boolean;
    showPhonetic: boolean;
  }[]>([
    { word: '', phonetic: '', isLoading: false, showPhonetic: false }
  ]);
  
  // Vocabulary item handlers
  const addVocabularyItem = () => {
    setVocabularyItems(prev => [...prev, { word: '', definitions: [], selectedDefinitionIndex: 0, isLoading: false, showDefinition: false, showTranslation: false }]);
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
    setGrammarItems(prev => [...prev, { youSaid: '', correct: '', simpleExplanation: '', technicalExplanation: '', isLoading: false, showExplanation: false }]);
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
    setPronunciationItems(prev => [...prev, { word: '', phonetic: '', isLoading: false, showPhonetic: false }]);
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
  const [studentLessonRequest, setStudentLessonRequest] = useState<{
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
  } | null>(null);
  
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
  
  // Course definitions
  const courses = [
    { id: 'conversational-skills', name: 'Conversational Skills', icon: '💬' },
    { id: 'business-english', name: 'Business English', icon: '💼' },
    { id: 'young-learners', name: 'Young Learners', icon: '🎨' },
    { id: 'daily-dispatch', name: 'Daily Dispatch', icon: '📰' },
  ];
  
  // Daily Dispatch state
  const [dispatchArticles, setDispatchArticles] = useState<DispatchArticle[]>([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [viewingDispatchArticle, setViewingDispatchArticle] = useState<DispatchArticle | null>(null);
  
  // Conversational Skills viewing state
  const [viewingConversationalLesson, setViewingConversationalLesson] = useState<ConversationalLesson | null>(null);
  const [conversationalViewUrl, setConversationalViewUrl] = useState<string | null>(null);
  const [loadingConversationalView, setLoadingConversationalView] = useState(false);

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
      // Use lesson-materials endpoint for conversational-skills (Memgraph storage)
      if (courseId === 'conversational-skills') {
        const result = await lessonApi.getPublishedLessonMaterials(courseId);
        if (result.success && result.lessons) {
          // Transform lesson-materials format to match expected Lesson format
          const transformedLessons = result.lessons.map((l: any) => ({
            id: l.id,
            title: l.lessonTitle || `Lesson ${l.lessonNumber}: ${l.lessonName}`,
            slug: l.id,
            status: 'published' as const,
            lessonData: {
              header: {
                levelBadge: l.levelBadge,
                chapterLabel: l.chapterLabel,
                lessonLabel: l.lessonTitle,
                goalText: l.goalTextEn || '',
              }
            }
          })) as Lesson[];
          setAvailableLessons(transformedLessons);
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
      
      // Fetch the lesson viewUrl for iframe display (use tutor view for tutor)
      setLoadingViewUrl(true);
      try {
        const result = await lessonApi.getTutorLesson(selectedLesson.id);
        if (result.success && result.viewUrl) {
          setLessonViewUrl(result.viewUrl);
        }
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
        {/* Material Header - conditionally show dispatch/conversational header or regular header */}
        {viewingDispatchArticle ? (
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
        ) : viewingConversationalLesson ? (
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
        ) : (
          <div className="material-header">
            <i className="fi fi-sr-book-open-reader"></i>
            <span>Learning Material</span>
          </div>
        )}

        {/* Chosen Material Display or PDF Viewer */}
        <div className="material-content">
          {viewingDispatchArticle ? (
            <iframe 
              src={`/materials/daily-dispatch/${viewingDispatchArticle.id}`}
              className="dispatch-article-iframe"
              title={viewingDispatchArticle.title}
            />
          ) : viewingConversationalLesson && conversationalViewUrl ? (
            <iframe 
              src={conversationalViewUrl}
              className="dispatch-article-iframe conversational-iframe"
              title={viewingConversationalLesson.title}
            />
          ) : showLessonRequest ? (
            <div className="lesson-request-container">
              {/* Lesson Request Section - always show, even if no material selected */}
              <div className="lesson-request-section">
                <div className="lesson-request-header">
                  <h2 className="lesson-request-title">
                    <i className="ri-file-list-3-line" />
                    Lesson Request
                  </h2>
                  <p className="lesson-request-updated">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                </div>
                
                <div className="lesson-request-body">
                  <div className="lesson-request-content">
                    <div className="lesson-request-details">
                      <p className="request-intro">Student's lesson request details below.</p>
                      
                      {studentLessonRequest ? (
                        <table className="request-table">
                          <tbody>
                            <tr className="request-row">
                              <td className="request-label">Material:</td>
                              <td className="request-value">
                                <a 
                                  href={`/lesson/view?id=${studentLessonRequest.lessonId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="request-link"
                                >
                                  {studentLessonRequest.title}
                                </a>
                              </td>
                            </tr>
                            <tr className="request-row">
                              <td className="request-label">Lesson Number:</td>
                              <td className="request-value">Lesson {studentLessonRequest.lessonNumber}</td>
                            </tr>
                            {studentLessonRequest.goal && (
                              <tr className="request-row">
                                <td className="request-label">Goal:</td>
                                <td className="request-value">{studentLessonRequest.goal}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-material-selected">No material selected by student yet.</p>
                      )}
                    </div>
                    
                    {/* Student Preferences Sidebar */}
                    <div className="student-preferences-sidebar">
                      <div className="preference-section">
                        <h4 className="preference-title">Student Preferences</h4>
                        <p className="preference-item">Camera: {studentLessonRequest?.studentPreferences?.cameraOn !== false ? 'On' : 'Off'}</p>
                        <p className="preference-item">Proficiency: {studentLessonRequest?.studentPreferences?.proficiency || 'Not set'}</p>
                      </div>
                      
                      <div className="preference-section">
                        <h4 className="preference-title">Error Correction</h4>
                        <p className="preference-item">
                          {studentLessonRequest?.studentPreferences?.errorCorrection === 'proactively' 
                            ? 'Please correct my errors proactively'
                            : studentLessonRequest?.studentPreferences?.errorCorrection === 'during_feedback'
                            ? 'Please correct errors during feedback time'
                            : 'Tutor\'s choice'}
                        </p>
                      </div>
                      
                      {studentLessonRequest?.studentPreferences?.otherRequests && (
                        <div className="preference-section">
                          <h4 className="preference-title">Other Request</h4>
                          <p className="preference-item">{studentLessonRequest.studentPreferences.otherRequests}</p>
                        </div>
                      )}
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
                  <label className="material-selector-label">Select a Material</label>
                </div>
                <div className="material-selector-body">
                {/* Course Selector */}
                <div className="material-selector-row">
                  <select 
                    className="material-selector-dropdown"
                    value={selectedCourse}
                    onChange={(e) => handleCourseChange((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">-- Select Course --</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Daily Dispatch Card - shows when Daily Dispatch is selected */}
                {selectedCourse === 'daily-dispatch' && (
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
                
                {/* Level Selector - shows for other courses */}
                {selectedCourse && selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && availableLevels.length > 0 && (
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
                {selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedLevel !== null && availableChapters.length > 0 && (
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
                {selectedCourse !== 'daily-dispatch' && selectedCourse !== 'conversational-skills' && selectedChapter !== null && filteredLessons.length > 0 && (
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

      {/* Daily Dispatch Notes Floating Button - only shows when viewing Daily Dispatch article */}
      {viewingDispatchArticle && (
        <button 
          className={`dispatch-notes-fab dispatch-notes-fab--daily-dispatch ${showNotesWidget ? 'active' : ''}`}
          onClick={() => setShowNotesWidget(!showNotesWidget)}
          title="Daily Dispatch Notes"
        >
          <i className={showNotesWidget ? 'fi fi-sr-cross-small' : 'fi fi-sr-pencil'} />
        </button>
      )}

      {/* Daily Dispatch Notes Widget */}
      {viewingDispatchArticle && showNotesWidget && (
        <div className="dispatch-notes-widget dispatch-notes-widget--daily-dispatch">
          <div className="dispatch-notes-header">
            <h3>
              <i className="ri-newspaper-line" />
              Daily Dispatch Notes
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
          </div>
          
          <div className="dispatch-notes-footer">
            <button 
              className="dispatch-notes-clear"
              onClick={() => {
                setVocabularyItems([{ word: '', definitions: [], selectedDefinitionIndex: 0, isLoading: false, showDefinition: false, showTranslation: false }]);
                setGrammarItems([{ youSaid: '', correct: '', simpleExplanation: '', technicalExplanation: '', isLoading: false, showExplanation: false }]);
                setPronunciationItems([{ word: '', phonetic: '', isLoading: false, showPhonetic: false }]);
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
                const notes = `VOCABULARY:\n${vocabText || '(none)'}\n\nGRAMMAR:\n${grammarText || '(none)'}\n\nPRONUNCIATION:\n${pronunciationText || '(none)'}`;
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

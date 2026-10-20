import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { JSX } from "solid-js";
import { useLocation } from "../routing";
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
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronUp, FileText, History, Info, Mic, MicOff, MoreHorizontal, Paperclip, Pencil, PhoneOff, Plus, RefreshCw, Send, Settings, ShieldCheck, Trash2, Video, VideoOff, X } from "lucide-solid";
import './ClassroomPage.css';
const classroomArt = (name: string, className = '') => <img class={'classroom-art ' + className} src={'/assets/img/home-icons/' + name + (name === 'dispatch' ? '-v1.png' : '-v1.webp')} alt=""/>;
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
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = window.localStorage.getItem(CLASSROOM_DEVICE_SETTINGS_KEY);
        return raw ? JSON.parse(raw) as MediaDeviceSettings : {};
    }
    catch {
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
            parts.push(<strong>{matchedText.slice(1, -1)}</strong>);
        }
        else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
            // Italic text
            parts.push(<em>{matchedText.slice(1, -1)}</em>);
        }
        else if (matchedText.startsWith('http')) {
            // URL - make it clickable
            parts.push(<a href={matchedText} target="_blank" rel="noopener noreferrer" class="chat-link">
          {matchedText}
        </a>);
        }
        lastIndex = match.index + matchedText.length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
};
const shouldShowMessageText = (msg: ChatMessage) => Boolean(msg.text && (!msg.fileUrl || !msg.text.startsWith('Sent ')));
// Format file size for display
const formatFileSize = (bytes?: number): string => {
    if (!bytes)
        return '';
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const ClassroomPage = (_props0: ClassroomPageProps) => {
    const [mediaProvider, setMediaProvider] = createSignal<'webrtc' | 'realtimekit'>();
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            document.title = 'Classroom | FluentXVerse';
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const _state1 = useAuthContext();
    const isDarkMode = createMemo(() => useThemeStore(state => state.isDarkMode));
    const materialLoadId = { current: 0 } as {
        current: any;
    };
    const materialOpenId = { current: 0 } as {
        current: any;
    };
    const _state2 = useLocation();
    const chatEndRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const courseDropdownRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const localVideoRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    const remoteVideoRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    const localPipRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    const remotePipRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    // Track stream IDs for forcing re-renders
    const [localStreamId, setLocalStreamId] = createSignal<string>('');
    const [remoteStreamId, setRemoteStreamId] = createSignal<string>('');
    // Socket state for passing to child components
    const [socketInstance, setSocketInstance] = createSignal<Socket | null>(null);
    const [classroomJoined, setClassroomJoined] = createSignal(false);
    const lastSharedMaterial = { current: null } as {
        current: (string | null) | null;
    };
    const [signalingConnected, setSignalingConnected] = createSignal(false);
    const [signalingError, setSignalingError] = createSignal<string | null>(null);
    // Extract sessionId from router params first, then pathname as fallback
    const routeSessionId = createMemo(() => (_state2.route as any)?.params?.sessionId as string | undefined);
    const querySessionId = (() => {
        try {
            const sp = new URLSearchParams(window.location.search);
            return sp.get('sessionId') || undefined;
        }
        catch {
            return undefined;
        }
    })();
    const currentSessionId = createMemo(() => _props0["sessionId"] || routeSessionId() || querySessionId || window.location.pathname.split('/classroom/')[1]?.split('?')[0]);
    const lessonStart = useClassroomStart(() => socketInstance(), () => currentSessionId());
    // Initialize socket and join session
    createEffect(on(() => [currentSessionId()], () => {
        const _cleanup5 = untrack(() => {
            if (!currentSessionId())
                return;
            let socket: Socket | null = null;
            let isCancelled = false;
            // Wait for connection before joining
            const onConnect = () => {
                if (!socket)
                    return;
                setClassroomJoined(false);
                setSignalingConnected(true);
                setSignalingError(null);
                socket.emit('session:join', { get sessionId() {
                        return currentSessionId();
                    } });
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
                    if (prev.some(m => m.id === data.id))
                        return prev;
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
                setChatMessages(prev => prev.map(msg => msg.id === data.id
                    ? {
                        ...msg,
                        text: data.text,
                        correction: data.correction,
                        isEdited: data.isEdited,
                        editedAt: data.editedAt
                    }
                    : msg));
            };
            const onChatMessageDeleted = (data: {
                sessionId?: string;
                messageId?: string;
                id?: string;
            }) => {
                if ('sessionId' in data && data.sessionId && data.sessionId !== currentSessionId())
                    return;
                const deletedMessageId = data.messageId ?? data.id;
                if (!deletedMessageId)
                    return;
                setChatMessages(prev => prev.filter(msg => msg.id !== deletedMessageId));
                setOpenMessageMenuId(prev => prev === deletedMessageId ? null : prev);
                setEditingMessageId(prev => prev === deletedMessageId ? null : prev);
            };
            const onChatError = (data: {
                message: string;
            }) => {
                toast.error(data.message);
            };
            const onSessionError = (data: {
                message: string;
            }) => {
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
            const onTyping = (data: {
                userId: string;
                isTyping: boolean;
            }) => {
                setRemoteTyping(data.isTyping);
            };
            // Handle session state
            const onSessionState = (data: any) => {
                if (data.sessionId !== currentSessionId())
                    return;
                setMediaProvider(previous => data.mediaProvider || previous || 'webrtc');
                setClassroomJoined(true);
                socket?.emit('chat:request-history', { get sessionId() {
                        return currentSessionId();
                    } });
                setIsConnecting(!data.participants?.tutorId);
                // Always update tutor info with latest from session state
                if (data.participants?.tutorId) {
                    setTutorInfo({
                        id: data.participants.tutorId,
                        name: 'Tutor',
                        initials: 'TU',
                        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    });
                }
                else {
                    // No tutor in session, clear tutorInfo
                    setTutorInfo(null);
                }
            };
            // Handle user joined
            const onUserJoined = (data: {
                userId: string;
                userType: string;
            }) => {
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
            const onUserLeft = (data: {
                userId: string;
                userType: string;
            }) => {
                if (data.userType === 'tutor') {
                    setTutorInfo(null);
                    setIsConnecting(true);
                }
            };
            const onVideoState = (data: {
                sessionId: string;
                userType: 'tutor' | 'student';
                enabled: boolean;
            }) => {
                if (data.sessionId !== currentSessionId() || data.userType !== 'tutor')
                    return;
                setRemoteVideoEnabled(data.enabled);
            };
            // Handle lesson ended by tutor
            const onLessonEnded = (data: {
                tutorId: string;
                message?: string;
            }) => {
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
                }
                else {
                    connectSocket();
                }
            };
            void setupSocket().catch((error) => {
                console.error('Failed to initialize classroom socket:', error);
                if (!isCancelled)
                    onConnectError();
            });
            return () => {
                isCancelled = true;
                if (!socket)
                    return;
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
                if (socket.connected)
                    socket.emit('session:leave');
                socket.disconnect();
                setSocketInstance(null);
            };
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    // State
    const [message, setMessage] = createSignal('');
    const elapsedTime = createMemo(() => lessonStart.elapsed);
    const [isMuted, setIsMuted] = createSignal(false);
    const [isVideoOff, setIsVideoOff] = createSignal(false);
    const [isSwapped, setIsSwapped] = createSignal(true);
    const [tutorInfo, setTutorInfo] = createSignal<{
        name: string;
        id: string;
        initials: string;
        date: string;
    } | null>(null);
    const [isConnecting, setIsConnecting] = createSignal(true);
    const [isSpeakingLocal, setIsSpeakingLocal] = createSignal(false);
    const [remoteVideoEnabled, setRemoteVideoEnabled] = createSignal(true);
    const [isTyping, setIsTyping] = createSignal(false);
    const [remoteTyping, setRemoteTyping] = createSignal(false);
    const [audioEnabled, setAudioEnabled] = createSignal(false);
    const [lessonEndedMessage, setLessonEndedMessage] = createSignal<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = createSignal(false);
    const [isHistoryLoading, setIsHistoryLoading] = createSignal(false);
    const [activityLogs, setActivityLogs] = createSignal<ClassroomActivityLogData[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
    const [recordingAvailable, setRecordingAvailable] = createSignal(false);
    const [recordingRevision, setRecordingRevision] = createSignal(0);
    const [audioInputDevices, setAudioInputDevices] = createSignal<MediaDeviceInfo[]>([]);
    const [videoInputDevices, setVideoInputDevices] = createSignal<MediaDeviceInfo[]>([]);
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = createSignal((() => readSavedDeviceSettings().audioDeviceId || '')());
    const [selectedVideoDeviceId, setSelectedVideoDeviceId] = createSignal((() => readSavedDeviceSettings().videoDeviceId || '')());
    const [isApplyingDeviceSettings, setIsApplyingDeviceSettings] = createSignal(false);
    // Material/Lesson state
    const [chosenLesson, setChosenLesson] = createSignal<{
        lessonId: string;
        courseId: string;
        title: string;
        lessonNumber: number;
        goal: string;
    } | null>(null);
    const [loadingLesson, setLoadingLesson] = createSignal(true);
    // Student profile state
    const [studentProfile, setStudentProfile] = createSignal<StudentProfile | null>(null);
    // Material selector state - hierarchical
    const [availableLessons, setAvailableLessons] = createSignal<Lesson[]>([]);
    const [loadingMaterials, setLoadingMaterials] = createSignal(false);
    const [selectedCourse, setSelectedCourse] = createSignal<string>('');
    const [showLessonRequest, setShowLessonRequest] = createSignal(true);
    const [lessonViewUrl, setLessonViewUrl] = createSignal<string | null>(null);
    const [loadingViewUrl, setLoadingViewUrl] = createSignal(false);
    const [isCourseDropdownOpen, setIsCourseDropdownOpen] = createSignal(false);
    const [courseDropdownMenuStyle, setCourseDropdownMenuStyle] = createSignal<JSX.CSSProperties | null>(null);
    // Course definitions
    const courses = [
        { id: 'conversational-skills', name: 'Conversational Skills', icon: 'community', description: 'Conversation lessons for practical speaking practice.' },
        { id: 'business-english', name: 'Business English', icon: 'business', description: 'Workplace English lessons and professional scenarios.' },
        { id: 'daily-dispatch', name: 'Daily Dispatch', icon: 'dispatch', description: 'News-based reading and discussion material.' },
    ];
    const selectedCourseOption = createMemo(() => courses.find(course => course.id === selectedCourse()) || null);
    const showSelectedCourseDetails = createMemo(() => Boolean(selectedCourse()));
    const buildDropdownMenuStyle = (container: HTMLDivElement | null): JSX.CSSProperties | null => {
        if (!container)
            return null;
        const triggerRect = container.getBoundingClientRect();
        const gap = 8;
        const viewportPadding = 16;
        const preferredMaxHeight = 240;
        const spaceBelow = Math.max(0, window.innerHeight - triggerRect.bottom - gap - viewportPadding);
        const spaceAbove = Math.max(0, triggerRect.top - gap - viewportPadding);
        const opensUp = spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
        const width = Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2);
        const left = Math.min(Math.max(triggerRect.left, viewportPadding), window.innerWidth - width - viewportPadding);
        return {
            top: opensUp ? 'auto' : `${triggerRect.bottom + gap}px`,
            bottom: opensUp ? `${window.innerHeight - triggerRect.top + gap}px` : 'auto',
            left: `${left}px`,
            width: `${width}px`,
            'max-height': `${Math.min(preferredMaxHeight, opensUp ? spaceAbove : spaceBelow)}px`
        };
    };
    const updateCourseDropdownMenuPosition = () => {
        setCourseDropdownMenuStyle(buildDropdownMenuStyle(courseDropdownRef.current));
    };
    const toggleCourseDropdown = () => {
        if (isCourseDropdownOpen()) {
            setIsCourseDropdownOpen(false);
            return;
        }
        updateCourseDropdownMenuPosition();
        setIsCourseDropdownOpen(true);
    };
    createEffect(on(() => [], () => {
        const _cleanup6 = untrack(() => {
            const handlePointerDown = (event: MouseEvent) => {
                if (!courseDropdownRef.current?.contains(event.target as Node))
                    setIsCourseDropdownOpen(false);
            };
            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape')
                    setIsCourseDropdownOpen(false);
            };
            document.addEventListener('mousedown', handlePointerDown);
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('mousedown', handlePointerDown);
                document.removeEventListener('keydown', handleKeyDown);
            };
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    createEffect(on(() => [isCourseDropdownOpen()], () => {
        const _cleanup7 = untrack(() => {
            if (!isCourseDropdownOpen()) {
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
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    createEffect(on(() => [], () => {
        const _cleanup8 = untrack(() => () => {
            materialLoadId.current += 1;
            materialOpenId.current += 1;
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    const isLessonMaterialCourse = (courseId?: string | null) => courseId === 'conversational-skills' || courseId === 'business-english';
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
                    overlayColor: lessonMaterial.overlayColor || ''
                }
            } as Lesson['lessonData']
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
    const [viewingDispatchArticle, setViewingDispatchArticle] = createSignal<DispatchArticle | null>(null);
    // Conversational Skills viewing state
    const [viewingConversationalLesson, setViewingConversationalLesson] = createSignal<ConversationalLesson | null>(null);
    const [conversationalViewUrl, setConversationalViewUrl] = createSignal<string | null>(null);
    // File sharing state
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [filePreview, setFilePreview] = createSignal<string | null>(null);
    const [isUploading, setIsUploading] = createSignal(false);
    const fileInputRef = { current: null } as {
        current: HTMLInputElement | null;
    };
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
        if (!courseId || courseId === 'daily-dispatch')
            return;
        setLoadingMaterials(true);
        try {
            const result = isLessonMaterialCourse(courseId)
                ? await lessonApi.getPublishedLessonMaterials(courseId)
                : await lessonApi.getPublishedLessons(courseId);
            if (requestId !== materialLoadId.current)
                return;
            if (!result.success || !result.lessons)
                throw new Error('Could not load course');
            setAvailableLessons(isLessonMaterialCourse(courseId)
                ? result.lessons.map(transformLessonMaterialToLesson)
                : result.lessons);
        }
        catch (err) {
            if (requestId === materialLoadId.current)
                toast.error('Could not load lessons. Please choose the course again.');
        }
        finally {
            if (requestId === materialLoadId.current)
                setLoadingMaterials(false);
        }
    };
    const chosenCourseLabel = createMemo(() => chosenLesson() ? courses.find(course => course.id === chosenLesson().courseId)?.name || 'Lesson Material'
        : 'Not selected');
    const previousLessonLabel = createMemo(() => chosenLesson() && chosenLesson().lessonNumber > 1
        ? `Lesson ${chosenLesson().lessonNumber - 1}`
        : 'No previous lesson');
    const previousLessonMeta = createMemo(() => chosenLesson() && chosenLesson().lessonNumber > 1
        ? 'Completed before your current material'
        : 'This is the first lesson in the sequence');
    const hasOpenMaterial = createMemo(() => Boolean(chosenLesson() || viewingDispatchArticle() || viewingConversationalLesson()));
    const openedMaterialId = createMemo(() => viewingDispatchArticle()?.id || viewingConversationalLesson()?.id || chosenLesson()?.lessonId);
    const openedMaterialCourse = createMemo(() => viewingDispatchArticle() ? 'daily-dispatch'
        : viewingConversationalLesson() ? 'conversational-skills' : chosenLesson()?.courseId);
    createEffect(on(() => [lessonStart.live, showLessonRequest(), loadingLesson(), loadingViewUrl(), classroomJoined(), socketInstance(), openedMaterialId(), openedMaterialCourse(), currentSessionId(), lessonViewUrl()], () => {
        const _cleanup9 = untrack(() => {
            if (!lessonStart.live || showLessonRequest() || loadingLesson() || loadingViewUrl() || !classroomJoined() || !socketInstance()?.connected
                || !openedMaterialId() || !openedMaterialCourse() || !currentSessionId()
                || (!viewingDispatchArticle() && !viewingConversationalLesson() && !lessonViewUrl())
                || !['daily-dispatch', 'conversational-skills', 'business-english'].includes(openedMaterialCourse()))
                return;
            const key = `${currentSessionId()}:${openedMaterialCourse()}:${openedMaterialId()}`;
            if (lastSharedMaterial.current === key)
                return;
            lastSharedMaterial.current = key;
            socketInstance().timeout(10000).emit('chat:share-material', {
                get sessionId() {
                    return currentSessionId();
                },
                get courseId() {
                    return openedMaterialCourse();
                },
                get materialId() {
                    return openedMaterialId();
                }
            }, (error: Error | null, result?: ShareMaterialResult) => {
                if (error || !result?.success) {
                    if (lastSharedMaterial.current === key)
                        lastSharedMaterial.current = null;
                    toast.error(result?.message || 'Material was not sent to your tutor. Reopen it to try again.');
                }
            });
        });
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    const isViewingBusinessEnglishMaterial = createMemo(() => !showLessonRequest() && !viewingDispatchArticle() && !viewingConversationalLesson() && chosenLesson()?.courseId === 'business-english');
    const materialTabTitle = createMemo(() => viewingDispatchArticle()?.title
        || viewingConversationalLesson()?.title
        || chosenLesson()?.title
        || 'Selected Material');
    const materialTabContext = createMemo(() => viewingDispatchArticle() ? viewingDispatchArticle().category
        : viewingConversationalLesson() ? `Level ${viewingConversationalLesson().level} • Chapter ${viewingConversationalLesson().chapter}`
            : chosenLesson() ? chosenCourseLabel() : 'Open material');
    const handleApplyMaterial = async (lessonId: string) => {
        const selectedLesson = availableLessons().find(lesson => lesson.id === lessonId);
        if (!selectedLesson)
            return;
        const requestId = ++materialOpenId.current;
        const newLesson = {
            lessonId: selectedLesson.id,
            get courseId() {
                return selectedCourse();
            },
            title: selectedLesson.title,
            lessonNumber: getLessonNumber(selectedLesson),
            goal: selectedLesson.lessonData?.header?.goalText || ''
        };
        setChosenLesson(newLesson);
        setViewingDispatchArticle(null);
        setViewingConversationalLesson(selectedCourse() === 'conversational-skills' ? {
            id: newLesson.lessonId, title: newLesson.title, level: getLevelNumber(selectedLesson),
            chapter: getChapterNumber(selectedLesson), lessonNumber: newLesson.lessonNumber, goalTextEn: newLesson.goal
        } : null);
        setConversationalViewUrl(selectedCourse() === 'conversational-skills'
            ? `/materials/conversational-skills/${selectedLesson.id}` : null);
        setLessonViewUrl(null);
        setLoadingViewUrl(true);
        setShowLessonRequest(false);
        try {
            const nextViewUrl = await resolveStudentMaterialViewUrl(newLesson.courseId, selectedLesson.id);
            if (requestId === materialOpenId.current)
                setLessonViewUrl(nextViewUrl);
        }
        catch (err) {
            if (requestId === materialOpenId.current)
                toast.error('Could not open this lesson. Please try again.');
        }
        finally {
            if (requestId === materialOpenId.current)
                setLoadingViewUrl(false);
        }
        try {
            await studentApi.saveLastViewedLesson({
                get sessionId() {
                    return currentSessionId();
                },
                ...newLesson, viewedAt: Date.now()
            });
        }
        catch (err) {
            console.error('Failed to save lesson selection:', err);
        }
    };
    // Fetch last viewed lesson and student profile on mount
    createEffect(on(() => [currentSessionId()], () => {
        const _cleanup10 = untrack(() => {
            setChosenLesson(null);
            setLessonViewUrl(null);
            const fetchData = async () => {
                try {
                    setLoadingLesson(true);
                    // Fetch both lesson and profile in parallel
                    const [lessonResponse, profileResponse] = await Promise.all([
                        studentApi.getLastViewedLesson(currentSessionId()),
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
                            }
                            catch (err) {
                                console.error('Failed to get lesson view URL:', err);
                            }
                        }
                    }
                    if (profileResponse.success && profileResponse.data) {
                        setStudentProfile(profileResponse.data);
                    }
                }
                catch (err) {
                    console.error('Failed to load data:', err);
                }
                finally {
                    setLoadingLesson(false);
                }
            };
            fetchData();
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    // Try to enable audio - will succeed if user has engagement history with the site
    createEffect(on(() => [audioEnabled()], () => {
        const _cleanup11 = untrack(() => {
            if (audioEnabled())
                return;
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
                }
                catch {
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
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    // WebRTC Hook
    const _state3 = useClassroomMedia({ get provider() {
            return mediaProvider();
        }, get sessionId() {
            return currentSessionId();
        }, get remoteUserId() {
            return tutorInfo()?.id;
        }, get socket() {
            return socketInstance();
        }, get enabled() {
            return lessonStart.live;
        } });
    createEffect(on(() => [lessonStart.closed, _state3.cleanup], () => {
        const _cleanup12 = untrack(() => { if (lessonStart.closed)
            _state3.cleanup(); });
        if (typeof _cleanup12 === "function")
            onCleanup(_cleanup12);
    }));
    createEffect(on(() => [mediaProvider(), lessonStart.live, tutorInfo()?.id, socketInstance()], () => {
        const _cleanup13 = untrack(() => {
            if (mediaProvider() !== 'webrtc' || !lessonStart.live || !tutorInfo()?.id || !socketInstance())
                return;
            const ready = () => { if (socketInstance().connected)
                socketInstance().emit('webrtc:ready'); };
            ready();
            const timer = window.setInterval(ready, 4000);
            return () => window.clearInterval(timer);
        });
        if (typeof _cleanup13 === "function")
            onCleanup(_cleanup13);
    }));
    const callConnected = createMemo(() => _state3.isConnected && signalingConnected() && !signalingError() && !_state3.error);
    createEffect(on(() => [socketInstance(), callConnected()], () => {
        const _cleanup14 = untrack(() => {
            const update = () => socketInstance()?.emit('classroom:call-state', { get connected() {
                    return Boolean(callConnected());
                } });
            update();
            socketInstance()?.on('connect', update);
            return () => { socketInstance()?.off('connect', update); };
        });
        if (typeof _cleanup14 === "function")
            onCleanup(_cleanup14);
    }));
    const callStatus = createMemo(() => classroomCallStatus({
        get signalingConnected() {
            return signalingConnected();
        },
        get localMediaReady() {
            return Boolean(_state3.localStream?.getTracks().some(track => track.readyState === 'live'));
        },
        get peerPresent() {
            return !isConnecting();
        },
        get peerConnecting() {
            return _state3.isConnecting;
        },
        get peerConnected() {
            return _state3.isConnected;
        },
        remoteRole: 'tutor',
        get error() {
            return signalingError() || _state3.error;
        }
    }));
    const [connectedBannerDismissed, setConnectedBannerDismissed] = createSignal(false);
    createEffect(on(() => [callConnected(), currentSessionId()], () => {
        const _cleanup15 = untrack(() => {
            setConnectedBannerDismissed(false);
            if (!callConnected())
                return;
            const timer = window.setTimeout(() => setConnectedBannerDismissed(true), 3000);
            return () => window.clearTimeout(timer);
        });
        if (typeof _cleanup15 === "function")
            onCleanup(_cleanup15);
    }));
    const localHasVideo = createMemo(() => Boolean(_state3.localStream?.getVideoTracks().some(track => track.readyState === 'live')));
    const remoteHasVideo = createMemo(() => remoteVideoEnabled() && Boolean(_state3.remoteStream?.getVideoTracks().some(track => track.readyState === 'live')));
    // Mock student data (will be replaced with real data)
    const studentData = {
        name: 'Student',
        initials: 'ST',
        sessionTime: '10:00AM - 10:25AM',
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };
    const remoteParticipantData = createMemo(() => tutorInfo() || {
        name: 'Tutor',
        initials: 'T',
        date: studentData.date
    });
    // Chat messages - start empty, will load from server
    const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
    const [openMessageMenuId, setOpenMessageMenuId] = createSignal<string | null>(null);
    const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
    const [editingMessageText, setEditingMessageText] = createSignal('');
    const requestActivityHistory = () => {
        if (!currentSessionId() || !socketInstance())
            return;
        if (isHistoryOpen()) {
            setIsHistoryOpen(false);
            setIsHistoryLoading(false);
            return;
        }
        setIsSettingsOpen(false);
        setIsHistoryOpen(true);
        setIsHistoryLoading(true);
        socketInstance().emit('classroom:request-activity-history', { get sessionId() {
                return currentSessionId();
            } });
    };
    const loadMediaDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioInputDevices(devices.filter(device => device.kind === 'audioinput'));
            setVideoInputDevices(devices.filter(device => device.kind === 'videoinput'));
        }
        catch (error) {
            console.error('Failed to load media devices:', error);
            toast.error('Failed to load camera and microphone devices');
        }
    };
    const openDeviceSettings = async () => {
        if (isSettingsOpen()) {
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
                get audioDeviceId() {
                    return selectedAudioDeviceId() || undefined;
                },
                get videoDeviceId() {
                    return selectedVideoDeviceId() || undefined;
                }
            };
            window.localStorage.setItem(CLASSROOM_DEVICE_SETTINGS_KEY, JSON.stringify(settings));
            await _state3.switchMediaDevices(settings);
            await loadMediaDevices();
            setIsSettingsOpen(false);
            toast.success('Classroom devices updated');
        }
        catch (error) {
            console.error('Failed to apply device settings:', error);
            toast.error('Failed to apply classroom devices');
        }
        finally {
            setIsApplyingDeviceSettings(false);
        }
    };
    const formatActivityTime = (createdAt: string) => new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formatActivityDate = (createdAt?: string) => createdAt
        ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    // Start local media when component mounts (only once)
    createEffect(on(() => [_state3.startLocalStream], () => {
        const _cleanup16 = untrack(() => {
            const initWebRTC = async () => {
                try {
                    await _state3.startLocalStream(true, true, {
                        get audioDeviceId() {
                            return selectedAudioDeviceId() || undefined;
                        },
                        get videoDeviceId() {
                            return selectedVideoDeviceId() || undefined;
                        }
                    });
                }
                catch (err) {
                    console.error('❌ [Classroom] Failed to start media:', err);
                }
            };
            initWebRTC();
        });
        if (typeof _cleanup16 === "function")
            onCleanup(_cleanup16);
    }));
    // The tutor side owns WebRTC offer creation. The student waits for the offer
    // and answers it, which avoids simultaneous-offer glare.
    // Attach all streams to all video refs - robust effect with interval checking
    createEffect(on(() => [_state3.localStream, _state3.remoteStream], () => {
        const _cleanup17 = untrack(() => {
            const attachStreams = () => {
                let attached = false;
                if (_state3.localStream) {
                    if (localVideoRef.current && localVideoRef.current.srcObject !== _state3.localStream) {
                        localVideoRef.current.srcObject = _state3.localStream;
                        localVideoRef.current.play().catch(() => { });
                        attached = true;
                    }
                    if (localPipRef.current && localPipRef.current.srcObject !== _state3.localStream) {
                        localPipRef.current.srcObject = _state3.localStream;
                        localPipRef.current.play().catch(() => { });
                        attached = true;
                    }
                    // Update stream ID to force re-render if needed
                    const newLocalId = _state3.localStream.id || Date.now().toString();
                    setLocalStreamId(prev => prev !== newLocalId ? newLocalId : prev);
                }
                if (_state3.remoteStream) {
                    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== _state3.remoteStream) {
                        remoteVideoRef.current.srcObject = _state3.remoteStream;
                        remoteVideoRef.current.play().catch(() => { });
                        attached = true;
                    }
                    if (remotePipRef.current && remotePipRef.current.srcObject !== _state3.remoteStream) {
                        remotePipRef.current.srcObject = _state3.remoteStream;
                        remotePipRef.current.play().catch(() => { });
                        attached = true;
                    }
                    // Update stream ID to force re-render if needed
                    const newRemoteId = _state3.remoteStream.id || Date.now().toString();
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
                const localAttached = !_state3.localStream || (localVideoRef.current?.srcObject === _state3.localStream);
                const remoteAttached = !_state3.remoteStream || (remoteVideoRef.current?.srcObject === _state3.remoteStream && remotePipRef.current?.srcObject === _state3.remoteStream);
                if (localAttached && remoteAttached) {
                    // All streams attached, can reduce frequency but keep monitoring
                }
            }, 500);
            // Also attach after short delays to handle race conditions
            const timeouts = [100, 300, 1000, 2000].map(delay => setTimeout(attachStreams, delay));
            return () => {
                clearInterval(intervalId);
                timeouts.forEach(t => clearTimeout(t));
            };
        });
        if (typeof _cleanup17 === "function")
            onCleanup(_cleanup17);
    }));
    // Detect local speaking using a calibrated noise floor so room noise does not flicker the mic indicator.
    createEffect(on(() => [_state3.localStream], () => {
        const _cleanup18 = untrack(() => {
            if (!_state3.localStream?.getAudioTracks().some(track => track.readyState === 'live'))
                return;
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(_state3.localStream);
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
                calibratedNoiseFloor = Math.min(0.08, calibratedNoiseFloor * 0.96 + Math.min(rms, 0.08) * 0.04);
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
                try {
                    source.disconnect();
                }
                catch { }
                try {
                    analyser.disconnect();
                }
                catch { }
                try {
                    audioCtx.close();
                }
                catch { }
            };
        });
        if (typeof _cleanup18 === "function")
            onCleanup(_cleanup18);
    }));
    // Handle audio/video toggles
    createEffect(on(() => [isMuted(), _state3.toggleAudio], () => {
        const _cleanup19 = untrack(() => {
            _state3.toggleAudio(!isMuted());
        });
        if (typeof _cleanup19 === "function")
            onCleanup(_cleanup19);
    }));
    createEffect(on(() => [currentSessionId(), isVideoOff(), socketInstance(), _state3.toggleVideo], () => {
        const _cleanup20 = untrack(() => {
            _state3.toggleVideo(!isVideoOff());
            if (currentSessionId() && socketInstance()?.connected) {
                socketInstance().emit('classroom:video-state', { get sessionId() {
                        return currentSessionId();
                    }, get enabled() {
                        return !isVideoOff();
                    } });
            }
        });
        if (typeof _cleanup20 === "function")
            onCleanup(_cleanup20);
    }));
    // Cleanup on unmount
    createEffect(on(() => [_state3.cleanup], () => {
        const _cleanup21 = untrack(() => {
            return () => {
                _state3.cleanup();
            };
        });
        if (typeof _cleanup21 === "function")
            onCleanup(_cleanup21);
    }));
    // Listen for close messages from iframe
    createEffect(on(() => [], () => {
        const _cleanup22 = untrack(() => {
            const handleMessage = (event: MessageEvent) => {
                if (event.origin === window.location.origin && event.data?.type === 'close-lesson-material') {
                    setShowLessonRequest(true);
                }
            };
            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        });
        if (typeof _cleanup22 === "function")
            onCleanup(_cleanup22);
    }));
    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // File handling functions
    const handleFileSelect = (e: Event) => {
        if (!lessonStart.live)
            return;
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file)
            return;
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
        }
        else {
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
    const uploadFile = async (file: File): Promise<{
        url: string;
        fileName: string;
        fileType: 'image' | 'file';
        fileSize: number;
    } | null> => {
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
        if (!lessonStart.live)
            return;
        if ((!message().trim() && !selectedFile()) || !currentSessionId())
            return;
        try {
            let fileData: {
                url: string;
                fileName: string;
                fileType: 'image' | 'file';
                fileSize: number;
            } | null = null;
            if (selectedFile()) {
                setIsUploading(true);
                fileData = await uploadFile(selectedFile());
                setIsUploading(false);
                if (!fileData) {
                    toast.error('Failed to upload file');
                    return;
                }
            }
            const socket = getSocket();
            socket.emit('chat:send', {
                get sessionId() {
                    return currentSessionId();
                },
                get text() {
                    return message().trim() || (fileData ? `Sent ${fileData.fileType === 'image' ? 'an image' : 'a file'}: ${fileData.fileName}` : '');
                },
                fileUrl: fileData?.url,
                fileName: fileData?.fileName,
                fileType: fileData?.fileType,
                fileSize: fileData?.fileSize
            });
        }
        catch (error) {
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
        const nextText = editingMessageText().trim();
        if (!nextText || !currentSessionId())
            return;
        const socket = getSocket();
        socket.emit('chat:edit', { get sessionId() {
                return currentSessionId();
            }, messageId, text: nextText });
        cancelEditMessage();
    };
    const deleteOwnMessage = (messageId: string) => {
        if (!currentSessionId())
            return;
        setOpenMessageMenuId(null);
        setEditingMessageId(prev => prev === messageId ? null : prev);
        const socket = getSocket();
        socket.emit('chat:delete', { get sessionId() {
                return currentSessionId();
            }, messageId }, (result) => {
            if (!result?.success) {
                toast.error(result?.message || 'Unable to delete message');
                return;
            }
            socket.emit('chat:request-history', { get sessionId() {
                    return currentSessionId();
                } });
        });
        window.setTimeout(() => {
            if (socket.connected) {
                socket.emit('chat:request-history', { get sessionId() {
                        return currentSessionId();
                    } });
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
        }
        else if (hasSelection) {
            nextMessage = `${value.slice(0, start)}${marker}${selectedText}${marker}${value.slice(end)}`;
            nextSelectionStart = start + 1;
            nextSelectionEnd = end + 1;
        }
        else {
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
        if (e.key === 'Enter' && !e.shiftKey && !isUploading()) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    // Handle typing indicator
    const handleTyping = (typing: boolean) => {
        if (!lessonStart.live)
            return;
        try {
            const socket = getSocket();
            socket.emit('chat:typing', { isTyping: typing });
        }
        catch (error) {
            // Socket might not be ready
        }
    };
    createEffect(on(() => [chatMessages()], () => {
        const _cleanup23 = untrack(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        if (typeof _cleanup23 === "function")
            onCleanup(_cleanup23);
    }));
    const handleLeaveClassroom = async () => {
        if (await toastConfirm('Are you sure you want to leave the classroom?', 'Leave Classroom')) {
            _state2.route('/schedule');
        }
    };
    return (<div class="classroom-container">
      {/* Left Panel - Video & Chat */}
      <div class="classroom-left">
        {/* Header Bar */}
        <div class="classroom-header">
          <div class="classroom-logo">
            <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse" style={cssStyle({ height: '32px' })}/>
            <span>FluentXVerse</span>
          </div>
          <div class="classroom-session-info">
            <div class="session-time-display">
              <span class="timer">{formatTime(elapsedTime())}</span>
              <span class="session-date">{studentData.date}</span>
            </div>
          </div>
        </div>

        {currentSessionId() && <StudentLessonIssueReport bookingId={currentSessionId()} compact presenceRevision={activityLogs().at(-1)?.id}/>}
        {currentSessionId() && <ClassroomLessonSurvey bookingId={currentSessionId()} socket={socketInstance()}/>}
        {!lessonStart.live && <div class="classroom-start-wait" role={signalingError() ? 'alert' : 'status'}>{lessonStart.closed ? lessonStart.message : signalingError() || lessonStart.message}</div>}
        {lessonStart.wrapUp && <div class="classroom-start-wait" role="status">{lessonStart.wrapUpMessage}</div>}

        {/* Video Area */}
        <ClassroomRecordingNotice socket={socketInstance()} provider={mediaProvider()} openRevision={recordingRevision()} onAvailabilityChange={setRecordingAvailable}/>
        <div class="video-section" tabIndex={0} aria-label="Lesson video and call controls">
          {/* Main Video */}
          <div class="video-main">
            {/* Connection Status overlay inside video */}
            {lessonStart.live && (!callConnected() || !connectedBannerDismissed()) && (<div class={`connection-status overlay-top${callStatus().state === 'error' ? ' call-error' : callConnected() ? ' call-connected' : ''}`} role={callStatus().state === 'error' ? 'alert' : 'status'} data-call-state={callStatus().state}>
              {callStatus().spinning && <div class="spinner"></div>}
              <p>{callStatus().message}</p>
            </div>)}
            {/* All video elements always rendered, visibility controlled by isSwapped */}
            {/* Remote video in main (visible when swapped) */}
            <video ref={(el) => {
            remoteVideoRef.current = el;
            if (el && _state3.remoteStream && el.srcObject !== _state3.remoteStream) {
                el.srcObject = _state3.remoteStream;
                el.muted = !audioEnabled();
                el.play().catch(() => { });
            }
        }} autoplay playsinline muted={!audioEnabled()} class="remote-video" style={cssStyle({ get display() {
            return isSwapped() && remoteHasVideo() ? 'block' : 'none';
        } })}/>
            {/* Remote placeholder in main (visible when swapped and no stream) */}
            {isSwapped() && !remoteHasVideo() && (<div class="video-placeholder remote-camera-off">
                <VideoOff class="camera-off-icon" aria-hidden="true"/>
                <span class="camera-off-text">The camera is turned off</span>
              </div>)}
            {/* Local video in main (visible when not swapped) */}
            <video ref={_element => localVideoRef.current = _element} muted autoplay playsinline class="local-video" style={cssStyle({ get display() {
            return !isSwapped() && !isVideoOff() && localHasVideo() ? 'block' : 'none';
        } })}/>
            {/* Speaking indicator for local in main */}
            {!isSwapped() && !isVideoOff() && localHasVideo() && (<div class={`mic-indicator mic-large ${isSpeakingLocal() ? 'active' : ''}`}> 
                <div class="mic-dot"/>
              </div>)}
            {/* Local placeholder in main (visible when not swapped and video off) */}
            {!isSwapped() && (isVideoOff() || !localHasVideo()) && (<div class="video-placeholder tutor-video">
                <div class="video-avatar-large">
                  {_state1.user?.firstName?.charAt(0) || 'S'}{_state1.user?.lastName?.charAt(0) || ''}
                </div>
                <span class="video-name">{_state1.user?.firstName || 'Student'}</span>
              </div>)}
          </div>

          {/* Picture-in-Picture (click to swap) */}
          <div class="video-pip" onClick={() => setIsSwapped(prev => !prev)} title="Click to swap">
            {/* All PiP video elements always rendered, visibility controlled by isSwapped */}
            {/* Local video in PiP (visible when swapped) */}
            <video muted autoplay playsinline class="local-video-small" style={cssStyle({ get display() {
            return isSwapped() && !isVideoOff() && localHasVideo() ? 'block' : 'none';
        } })} ref={_element => localPipRef.current = _element}/>
            {/* Speaking indicator for local in PiP */}
            {isSwapped() && !isVideoOff() && localHasVideo() && (<div class={`mic-indicator ${isSpeakingLocal() ? 'active' : ''}`}>
                <div class="mic-dot"/>
              </div>)}
            {/* Local placeholder in PiP (visible when swapped and video off) */}
            {isSwapped() && (isVideoOff() || !localHasVideo()) && (<div class="video-placeholder tutor-video">
                <div class="video-avatar-small">
                  {_state1.user?.firstName?.charAt(0) || 'S'}{_state1.user?.lastName?.charAt(0) || ''}
                </div>
              </div>)}
            {/* Remote video in PiP (visible when not swapped) */}
            <video autoplay playsinline muted={!audioEnabled()} class="remote-video-small" ref={(el) => {
            remotePipRef.current = el;
            if (el && _state3.remoteStream && el.srcObject !== _state3.remoteStream) {
                el.srcObject = _state3.remoteStream;
                el.muted = !audioEnabled();
                el.play().catch(() => { });
            }
        }} style={cssStyle({ get display() {
            return !isSwapped() && remoteHasVideo() ? 'block' : 'none';
        } })}/>
            {/* Remote placeholder in PiP (visible when not swapped and no stream) */}
            {!isSwapped() && !remoteHasVideo() && (<div class="video-placeholder remote-camera-off pip-camera-off" aria-label="No camera">
                <VideoOff class="camera-off-icon" aria-hidden="true"/>
              </div>)}
          </div>

          {/* Video Controls */}
          <div class="video-controls">
            <button class={`control-btn ${isMuted() ? 'active' : ''}`} onClick={() => setIsMuted(prev => !prev)} disabled={!lessonStart.live} title={isMuted() ? 'Unmute microphone' : 'Mute microphone'} aria-label={isMuted() ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={isMuted()}>
              {isMuted() ? (<MicOff size={20}/>) : (<Mic size={20}/>)}
            </button>
            <button class={`control-btn ${isVideoOff() ? 'active' : ''}`} onClick={() => setIsVideoOff(prev => !prev)} disabled={!lessonStart.live} title={isVideoOff() ? 'Turn on camera' : 'Turn off camera'} aria-label={isVideoOff() ? 'Turn on camera' : 'Turn off camera'} aria-pressed={isVideoOff()}>
              {isVideoOff() ? (<VideoOff size={20}/>) : (<Video size={20}/>)}
            </button>
            <button class="control-btn end-call" onClick={handleLeaveClassroom} title="Leave classroom" aria-label="Leave classroom">
              <PhoneOff size={20}/>
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <div class="chat-section">
          <div class="chat-header">
            {classroomArt('community')}
            <span>Chat</span>
            <div class="chat-header-actions" aria-label="Chat tools">
              <button type="button" class="chat-tool-btn" title="Classroom history" aria-label="Classroom history" onClick={requestActivityHistory}>
                <History size={18}/>
              </button>
              <button type="button" class="chat-tool-btn" title="Device settings" aria-label="Device settings" onClick={openDeviceSettings}>
                <Settings size={18}/>
              </button>
            </div>
          </div>
          {(isHistoryOpen() || isSettingsOpen()) && (<div class="classroom-chat-popover">
              {isHistoryOpen() && (<div class="classroom-modal classroom-history-modal" role="dialog" aria-modal="false" aria-labelledby="classroom-history-title">
                  <div class="classroom-modal-header">
                    <div>
                      <h2 id="classroom-history-title">History</h2>
                      <div class="classroom-modal-meta">
                        <span>SID: {currentSessionId()}</span>
                        <span><CalendarDays size={15}/>{formatActivityDate(activityLogs()[0]?.createdAt)}</span>
                      </div>
                    </div>
                    <button type="button" class="classroom-modal-close" aria-label="Close history" onClick={() => setIsHistoryOpen(false)}>
                      <X size={18}/>
                    </button>
                  </div>

                  <div class="classroom-history-list">
                    {isHistoryLoading() ? (<div class="classroom-modal-empty">Loading history...</div>) : activityLogs().length === 0 ? (<div class="classroom-modal-empty">No classroom activity yet.</div>) : (activityLogs().map(log => (<div class={`classroom-history-item ${log.userType}`}>
                          <span class="classroom-history-marker" aria-hidden="true"></span>
                          <span class="classroom-history-time">{formatActivityTime(log.createdAt)}</span>
                          <span class="classroom-history-message">{log.message}</span>
                        </div>)))}
                  </div>

                  <div class="classroom-modal-footer">
                    <button type="button" class="classroom-modal-primary" onClick={requestActivityHistory}>
                      <RefreshCw size={16}/>
                      Refresh
                    </button>
                  </div>
                </div>)}

              {isSettingsOpen() && (<div class="classroom-modal classroom-settings-modal" role="dialog" aria-modal="false" aria-labelledby="classroom-settings-title">
                  <div class="classroom-modal-header">
                    <div>
                      <h2 id="classroom-settings-title">Settings</h2>
                      <div class="classroom-modal-meta">
                        <span>Classroom devices</span>
                      </div>
                    </div>
                    <button type="button" class="classroom-modal-close" aria-label="Close settings" onClick={() => setIsSettingsOpen(false)}>
                      <X size={18}/>
                    </button>
                  </div>

                  <div class="classroom-device-fields">
                    <label class="classroom-device-field">
                      <span><Mic size={16}/>Microphone</span>
                      <select value={selectedAudioDeviceId()} onChange={(event) => setSelectedAudioDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default microphone</option>
                        {audioInputDevices().map((device, index) => (<option value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>))}
                      </select>
                    </label>

                    <label class="classroom-device-field">
                      <span><Video size={16}/>Camera</span>
                      <select value={selectedVideoDeviceId()} onChange={(event) => setSelectedVideoDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default camera</option>
                        {videoInputDevices().map((device, index) => (<option value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>))}
                      </select>
                    </label>
                  </div>

                  {recordingAvailable() && <button type="button" class="classroom-recording-settings" onClick={() => setRecordingRevision(value => value + 1)}><ShieldCheck size={17}/>Recording permission</button>}

                  <div class="classroom-modal-footer">
                    <button type="button" class="classroom-modal-secondary" onClick={loadMediaDevices}>
                      <RefreshCw size={16}/>
                      Refresh
                    </button>
                    <button type="button" class="classroom-modal-primary" disabled={isApplyingDeviceSettings()} onClick={applyDeviceSettings}>
                      <Check size={16}/>
                      {isApplyingDeviceSettings() ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>)}
            </div>)}
          <div class="chat-messages">
            {chatMessages().map((msg) => {
            // In student app: student messages are "self" (right), tutor messages are "other" (left)
            const isOwnMessage = msg.sender === 'student';
            const canManageMessage = isOwnMessage && !msg.correction && msg.id !== 'error';
            const canEditMessage = canManageMessage && !msg.material && shouldShowMessageText(msg);
            const isEditingMessage = editingMessageId() === msg.id;
            return (<div class={`chat-message ${isOwnMessage ? 'self' : 'other'}`}>
                {msg.correction && (<div class="message-correction">
                    <span class="label">You said:</span> {msg.text}
                    <br />
                    <span class="label">Correct:</span> {msg.correction}
                  </div>)}
                {!msg.correction && (<div class="message-row">
                    <div class="message-bubble">
                      {isEditingMessage ? (<div class="message-edit-panel">
                          <textarea class="message-edit-input" value={editingMessageText()} rows={2} onInput={(event) => setEditingMessageText((event.currentTarget as HTMLTextAreaElement).value)} onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                submitEditMessage(msg.id);
                            }
                            if (event.key === 'Escape') {
                                cancelEditMessage();
                            }
                        }} autofocus/>
                          <div class="message-edit-actions">
                            <button type="button" class="message-edit-cancel" onClick={cancelEditMessage}>Cancel</button>
                            <button type="button" class="message-edit-save" disabled={!editingMessageText().trim()} onClick={() => submitEditMessage(msg.id)}>Save</button>
                          </div>
                        </div>) : (<>
                          {/* Display image if present */}
                          {msg.fileUrl && msg.fileType === 'image' && (<a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                              <img src={msg.fileUrl} alt={msg.fileName || 'Shared image'} class="message-image"/>
                            </a>)}
                          {/* Display file link if present */}
                          {msg.fileUrl && msg.fileType === 'file' && (<a href={msg.fileUrl} download={msg.fileName} class="message-file" target="_blank" rel="noopener noreferrer">
                              <FileText size={22}/>
                              <span class="file-info">
                                <span class="file-name">{msg.fileName}</span>
                                {msg.fileSize && <span class="file-size">{formatFileSize(msg.fileSize)}</span>}
                              </span>
                            </a>)}
                          {/* Display formatted text */}
                          {msg.material && (<div class="chat-material-share">
                              <strong>{msg.material.title}</strong>
                              <span>Shared with your tutor</span>
                            </div>)}
                          {!msg.material && shouldShowMessageText(msg) && (<span>{formatMessageText(msg.text)}</span>)}
                          {msg.isEdited && <span class="message-edited-label">edited</span>}
                        </>)}
                    </div>
                    {canManageMessage && !isEditingMessage && (<div class="message-actions">
                        <button type="button" class="message-more-btn" aria-label="Message actions" title="Message actions" onClick={() => setOpenMessageMenuId(openMessageMenuId() === msg.id ? null : msg.id)}>
                          <MoreHorizontal size={18}/>
                        </button>
                        {openMessageMenuId() === msg.id && (<div class="message-action-menu">
                            {canEditMessage && (<button type="button" onClick={() => beginEditMessage(msg)}>
                                <Pencil size={16}/>
                                Edit
                              </button>)}
                            <button type="button" class="danger" onClick={() => deleteOwnMessage(msg.id)}>
                              <Trash2 size={16}/>
                              Delete
                            </button>
                          </div>)}
                      </div>)}
                  </div>)}
                <span class="message-time">{msg.timestamp}</span>
              </div>);
        })}
            {remoteTyping() && (<div class="typing-indicator">
                <span>Tutor is typing</span>
                <span class="typing-dots">...</span>
              </div>)}
            <div ref={_element => chatEndRef.current = _element}/>
          </div>
          {/* File Preview Bar */}
          {selectedFile() && (<div class="file-preview-bar">
              {filePreview() ? (<img src={filePreview()} alt="Preview" class="file-preview-thumb"/>) : (<FileText size={24} class="file-preview-icon"/>)}
              <span class="file-preview-name">{selectedFile().name}</span>
              <span class="file-preview-size">{formatFileSize(selectedFile().size)}</span>
              <button class="file-preview-remove" onClick={clearSelectedFile} title="Remove file" aria-label="Remove file">
                <X size={18}/>
              </button>
            </div>)}
          <div class="chat-input-area">
            <input type="file" ref={_element => fileInputRef.current = _element} onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt" style={cssStyle({ display: 'none' })}/>
            <button class="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={!lessonStart.live || isUploading()}>
              <Paperclip size={20}/>
            </button>
            <textarea placeholder={lessonStart.live ? 'Type a message...' : 'Chat opens at lesson start'} aria-label="Chat message. Press Shift and Enter for a new line." value={message()} onInput={(e) => {
            const newValue = (e.target as HTMLTextAreaElement).value;
            setMessage(newValue);
            handleTyping(newValue.trim().length > 0);
        }} onKeyDown={(e) => {
            handleChatInputKeyDown(e as KeyboardEvent);
        }} onBlur={() => handleTyping(false)} disabled={!lessonStart.live || isUploading()} rows={1}/>
            <button class="send-btn" title="Send message" aria-label="Send message" onClick={handleSendMessage} disabled={!lessonStart.live || isUploading() || (!message().trim() && !selectedFile())}>
              {isUploading() ? (<span class="upload-spinner"></span>) : (<Send size={20}/>)}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Learning Materials */}
      <div class="classroom-right">
        <div class="material-topbar">
          <div class="material-header">
            {classroomArt('training')}
            <span>Learning Material</span>
          </div>
          <div class="material-tabs">
            <button type="button" class={`material-tab ${showLessonRequest() ? 'is-active' : ''}`} onClick={() => setShowLessonRequest(true)}>
              <span class="material-tab-icon" aria-hidden="true">
                {classroomArt('schedule')}
              </span>
              <span class="material-tab-copy">
                <span class="material-tab-label">Lesson Selection</span>
                <span class="material-tab-meta">Request and material picker</span>
              </span>
            </button>
            {hasOpenMaterial() && (<button type="button" class={`material-tab ${!showLessonRequest() ? 'is-active' : ''}`} onClick={() => setShowLessonRequest(false)}>
                <span class="material-tab-icon" aria-hidden="true">
                  {classroomArt(viewingDispatchArticle() ? 'dispatch' : 'training')}
                </span>
                <span class="material-tab-copy">
                  <span class="material-tab-label">{materialTabTitle()}</span>
                  <span class="material-tab-meta">{materialTabContext()}</span>
                </span>
              </button>)}
          </div>
        </div>

        {/* Material Header - conditionally show dispatch/conversational header */}
        {!showLessonRequest() && viewingDispatchArticle() ? (<div class="dispatch-view-header daily-dispatch-theme">
            <button class="btn-back-to-request" onClick={() => setShowLessonRequest(true)}>
              <ArrowLeft size={17}/>
              Go to Selection Tab
            </button>
            <div class="dispatch-view-meta">
              <span class="dispatch-view-category">{viewingDispatchArticle().category}</span>
              <span class="dispatch-view-date">
                {new Date(`${dispatchPostDate(viewingDispatchArticle())}T00:00:00Z`).toLocaleDateString('en-US', {
                timeZone: 'UTC',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            })}
              </span>
            </div>
          </div>) : !showLessonRequest() && viewingConversationalLesson() ? (<div class="dispatch-view-header conversational-theme">
            <button class="btn-back-to-request" onClick={() => setShowLessonRequest(true)}>
              <ArrowLeft size={17}/>
              Go to Selection Tab
            </button>
            <div class="dispatch-view-meta">
              <span class="dispatch-view-category">Level {viewingConversationalLesson().level}</span>
              <span class="dispatch-view-date">
                Chapter {viewingConversationalLesson().chapter} • Lesson {viewingConversationalLesson().lessonNumber}
              </span>
            </div>
          </div>) : isViewingBusinessEnglishMaterial() ? (<div class={`dispatch-view-header business-english-theme business-english-theme--${isDarkMode() ? 'dark' : 'light'}`}>
            <button type="button" class="btn-back-to-request" onClick={() => setShowLessonRequest(true)}>
              <ArrowLeft size={17}/>Go to Selection Tab
            </button>
            <div class="dispatch-view-meta">
              <span class="dispatch-view-category">Business English</span>
              <span class="dispatch-view-date">{chosenLesson()?.title}</span>
            </div>
          </div>) : null}

        {/* Chosen Material Display or PDF Viewer */}
        <div class={`material-content ${showLessonRequest() ? 'material-content--request' : ''}`}>
          {loadingLesson() ? (<div class="material-loading">
              <div class="spinner"></div>
              <p>Loading your lesson...</p>
            </div>) : !showLessonRequest() && viewingDispatchArticle() ? (<iframe src={`/materials/daily-dispatch/${viewingDispatchArticle().id}`} class="dispatch-article-iframe" title={viewingDispatchArticle().title}/>) : !showLessonRequest() && viewingConversationalLesson() && conversationalViewUrl() ? (<iframe src={conversationalViewUrl()} class="dispatch-article-iframe conversational-iframe" title={viewingConversationalLesson().title}/>) : showLessonRequest() ? (<div class="lesson-request-container lesson-request-container--dispatch">
              {/* Lesson Plan Section - always show */}
              <div class="lesson-request-section">
                <div class="lesson-request-header">
                  <div class="lesson-request-title-wrap">
                    <h2 class="lesson-request-title">
                      {classroomArt('schedule')}
                      Lesson Request
                    </h2>
                    <p class="lesson-request-subtitle">
                      Review your selected lesson before class begins.
                    </p>
                  </div>
                  <div class="lesson-request-meta">
                    <span class={`lesson-request-status ${chosenLesson() ? 'lesson-request-status--ready' : 'lesson-request-status--pending'}`}>
                      {chosenLesson() ? 'Material chosen' : 'Awaiting selection'}
                    </span>
                    <p class="lesson-request-updated">
                      Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
                
                <div class="lesson-request-body">
                  <div class="lesson-request-content">
                    <div class="lesson-request-details">
                      <div class="request-material-summary">
                        <div class="request-material-heading">
                          <span class="request-eyebrow">Your lesson path</span>
                          <span class="request-course-pill">{chosenCourseLabel()}</span>
                        </div>

                        <div class="request-summary-grid request-summary-grid--student">
                          <div class="request-stat-card">
                            <span class="request-detail-label">Previous lesson</span>
                            <span class="request-detail-value request-detail-value--text">{previousLessonLabel()}</span>
                            <span class="request-detail-meta">{previousLessonMeta()}</span>
                          </div>

                          <div class="request-stat-card">
                            <span class="request-detail-label">Current course</span>
                            <span class="request-detail-value request-detail-value--text">{chosenCourseLabel()}</span>
                            <span class="request-detail-meta">
                              {chosenLesson() ? 'Course library selected for class' : 'Choose a course library below'}
                            </span>
                          </div>

                          <div class="request-stat-card request-stat-card--wide">
                            <span class="request-detail-label">Current material chosen</span>
                            <span class="request-detail-value request-detail-value--text">{chosenLesson()?.title || 'No material selected yet'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Hierarchical Material Selector */}
              <div class="material-selector-section">
                <div class="material-selector-header">
                  <div class="material-selector-header-icon">
                    {classroomArt('training')}
                  </div>
                  <div class="material-selector-copy">
                    <label class="material-selector-label">Select a Material</label>
                    <p class="material-selector-description">
                      Choose the course library you want to study from. You can switch materials whenever you need.
                    </p>
                  </div>
                  {chosenLesson() && (<span class="material-selector-chip">
                      Requested lesson {chosenLesson().lessonNumber}
                    </span>)}
                </div>
                <div class="material-selector-body">
                  <div class="material-selector-layout material-selector-layout--dispatch">
                    <div class="material-selector-primary">
                      {/* Course Selector */}
                      <div class="material-selector-row material-selector-row--course">
                        <div class="material-selector-field">
                          <span class="material-selector-field-label">Course library</span>
                          <div class={`material-selector-combobox ${isCourseDropdownOpen() ? 'is-open' : ''}`} ref={_element => courseDropdownRef.current = _element}>
                            <button type="button" class="material-selector-trigger" onClick={toggleCourseDropdown} aria-haspopup="listbox" aria-expanded={isCourseDropdownOpen()}>
                              <span class="material-selector-trigger-content">
                                {selectedCourseOption() ? (<>
                                    <span class="material-selector-trigger-icon" aria-hidden="true">
                                      {classroomArt(selectedCourseOption().icon)}
                                    </span>
                                    <span class="material-selector-trigger-copy">
                                      <span class="material-selector-trigger-title">{selectedCourseOption().name}</span>
                                      <span class="material-selector-trigger-subtitle">{selectedCourseOption().description}</span>
                                    </span>
                                  </>) : (<span class="material-selector-trigger-placeholder">
                                    Select a course library
                                  </span>)}
                              </span>
                              <span class="material-selector-trigger-arrow" aria-hidden="true">
                                {isCourseDropdownOpen() ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
                              </span>
                            </button>

                            {isCourseDropdownOpen() && (<div class="material-selector-menu" role="listbox" aria-label="Course library" style={cssStyle(courseDropdownMenuStyle() || undefined)}>
                                {courses.map(course => (<button type="button" class={`material-selector-option ${selectedCourse() === course.id ? 'is-selected' : ''}`} onClick={() => {
                        setIsCourseDropdownOpen(false);
                        void handleCourseChange(course.id);
                    }} role="option" aria-selected={selectedCourse() === course.id}>
                                    <span class="material-selector-option-icon" aria-hidden="true">
                                      {classroomArt(course.icon)}
                                    </span>
                                    <span class="material-selector-option-copy">
                                      <span class="material-selector-option-title">{course.name}</span>
                                      <span class="material-selector-option-description">{course.description}</span>
                                    </span>
                                    {selectedCourse() === course.id && (<span class="material-selector-option-check" aria-hidden="true">
                                        <Check size={17}/>
                                      </span>)}
                                  </button>))}
                              </div>)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="material-selector-secondary">
                      {!selectedCourse() && (<div class="material-selector-empty-panel">
                          <div class="material-selector-empty-icon">
                            <ArrowLeft size={20}/>
                          </div>
                          <div>
                            <p class="material-selector-empty-title">Choose a course to begin</p>
                            <p class="material-selector-empty-copy">
                              After choosing a library, the available levels, chapters, and lessons appear here.
                            </p>
                          </div>
                        </div>)}
                      {showSelectedCourseDetails() && selectedCourse() === 'daily-dispatch' && (<DispatchMaterialPicker onOpen={article => {
                    materialOpenId.current += 1;
                    setLoadingViewUrl(false);
                    setViewingDispatchArticle(article);
                    setViewingConversationalLesson(null);
                    setConversationalViewUrl(null);
                    setLessonViewUrl(null);
                    setShowLessonRequest(false);
                }}/>)}
                      {showSelectedCourseDetails() && selectedCourse() !== 'daily-dispatch' && (<CurriculumMaterialPicker loading={loadingMaterials()} currentId={chosenLesson()?.courseId === selectedCourse() ? chosenLesson().lessonId : undefined} materials={availableLessons().map(item => ({
                    id: item.id, title: item.title, level: getLevelNumber(item),
                    chapter: getChapterNumber(item), lesson: getLessonNumber(item),
                    goal: item.lessonData?.header?.goalText || ''
                }))} onOpen={item => void handleApplyMaterial(item.id)}/>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>) : chosenLesson() && !showLessonRequest() ? (<div class="lesson-material-view">
              {loadingViewUrl() ? (<div class="material-loading">
                  <div class="spinner"></div>
                  <p>Loading lesson...</p>
                </div>) : lessonViewUrl() ? (<iframe src={materialFrameUrl(lessonViewUrl(), isDarkMode() ? 'dark' : 'light', window.location.origin)} class="lesson-material-iframe" title={chosenLesson().title}/>) : (<div class="material-loading">
                  <p>Unable to load lesson view</p>
                </div>)}
            </div>) : (<div class="no-material-selected">
              <div class="empty-material-icon">
                {classroomArt('training')}
              </div>
              <h3>No Lesson Selected</h3>
              <p>Choose a lesson from your profile to use during your class</p>
              <a href="/profile" class="btn-select-material">
                <Plus size={18}/>
                Select a Lesson
              </a>
            </div>)}
        </div>
      </div>

      {/* Lesson Ended Toast Notification */}
      {lessonEndedMessage() && (<div class="lesson-ended-toast">
          <div class="toast-icon">
            <Info size={20}/>
          </div>
          <div class="toast-content">
            <span class="toast-title">Lesson Time Over</span>
            <span class="toast-message">{lessonEndedMessage()}</span>
          </div>
          <button class="toast-close" title="Dismiss lesson notice" aria-label="Dismiss lesson notice" onClick={() => setLessonEndedMessage(null)}>
            <X size={18}/>
          </button>
        </div>)}
    </div>);
};
export default ClassroomPage;

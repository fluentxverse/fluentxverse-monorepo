import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { JSX } from "solid-js";
import { useLocation } from "../routing";
import { useAuthContext } from '../context/AuthContext';
import { initSocket, connectSocket, getSocket, destroySocket } from '../client/socket/socket.client';
import { useThemeStore } from '../context/ThemeContext';
import { materialFrameUrl } from '../utils/materialFrameUrl';
import { lessonNotesLabels } from '../data/lessonNotesLabels';
import { lessonMaterialNotesIcon } from '../data/lessonNotesIcons';
import { getLessonVocabularyMeaning } from '../utils/lessonVocabulary';
import { useClassroomMedia } from '../hooks/useClassroomMedia';
import { ClassroomRecordingNotice } from '../Components/ClassroomRecordingNotice';
import { useClassroomStart } from '../hooks/useClassroomStart';
import { useClassroomLessonNotes } from '../hooks/useClassroomLessonNotes';
import { classroomCallStatus } from '../utils/classroomCallStatus';
import PdfViewer from '../Components/PdfViewer/PdfViewer';
import TutorClassroomIssueReport from '../Components/TutorClassroomIssueReport';
import DispatchMaterialPicker from '../Components/DispatchMaterialPicker';
import CurriculumMaterialPicker from '../Components/CurriculumMaterialPicker';
import LearningNotesFields from '../Components/LearningNotesFields';
import LessonFeedbackFields from '../Components/LessonFeedbackFields';
import MaterialProgressEditor from '../Components/MaterialProgressEditor';
import { dispatchPostDate, type DispatchArticle } from '../utils/dispatchLibrary';
import { toast, toastConfirm } from '../Components/Common/Toast';
import { lessonApi, type Lesson } from '../api/lesson.api';
import { tutorApi, type ClassroomGrammarNote, type ClassroomMaterialProgress, type ClassroomNotesRecord, type ClassroomPronunciationNote, type SaveClassroomNotesInput, type ClassroomVocabularyNote, } from '../api/tutor.api';
import type { ChatMessageData, ClassroomActivityLogData, SharedClassroomMaterial } from '../types/socket.types';
import type { Socket } from 'socket.io-client';
import type { Notification } from '../types/notification.types';
import { API_BASE_URL } from '../config/api';
import BusinessEnglishPreviewPage from './BusinessEnglishPreviewPage';
import { cacheBusinessEnglishLesson, cacheBusinessEnglishLessonList, readCachedBusinessEnglishLesson, readCachedBusinessEnglishLessonList, } from '../utils/businessEnglishCache';
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
type ClassroomPersistedOpenMaterial = {
    kind: 'dispatch';
    article: DispatchArticle;
} | {
    kind: 'conversational';
    lesson: ConversationalLesson;
    viewUrl: string;
} | {
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
    materialType: 'business-english' | 'daily-dispatch' | 'conversational-skills';
    materialId: string;
    materialTitle?: string;
    courseId?: string | null;
    lessonId?: string | null;
    articleId?: string | null;
}
interface MaterialProgressFields {
    isUsed: boolean;
    completionStatus: 'in_progress' | 'completed' | null;
    stoppedAt: string | null;
    stoppedAtLabel: string | null;
    progressDetails: string;
}
interface ClassroomNotesSnapshot extends MaterialProgressFields {
    vocabularyItems: ClassroomVocabularyNote[];
    grammarItems: ClassroomGrammarNote[];
    pronunciationItems: ClassroomPronunciationNote[];
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
const buildClassroomNotesBindingKey = (sessionId: string, target: ActiveNotesTarget) => `${sessionId}:${target.materialType}:${target.materialId}`;
const buildClassroomNotesDraftKey = (bindingKey: string) => `fxv-tutor-classroom-notes:${bindingKey}`;
const createEmptyVocabularyItem = (): ClassroomVocabularyNote => ({
    word: '',
    definitions: [],
    selectedDefinitionIndex: 0,
    isLoading: false,
    showDefinition: false,
    showTranslation: false
});
const createEmptyGrammarItem = (): ClassroomGrammarNote => ({
    youSaid: '',
    correct: '',
    simpleExplanation: '',
    technicalExplanation: '',
    isLoading: false,
    showExplanation: false
});
const createEmptyPronunciationItem = (): ClassroomPronunciationNote => ({
    word: '',
    phonetic: '',
    isLoading: false,
    showPhonetic: false
});
const normalizeVocabularyItems = (items: ClassroomVocabularyNote[] = []): ClassroomVocabularyNote[] => {
    const normalized = items.map((item) => {
        const definitions = Array.isArray(item.definitions) ? item.definitions : [];
        const selectedDefinitionIndex = Math.min(Math.max(item.selectedDefinitionIndex || 0, 0), Math.max(definitions.length - 1, 0));
        return {
            word: item.word || '',
            definitions,
            selectedDefinitionIndex,
            isLoading: false,
            showDefinition: Boolean(item.showDefinition),
            showTranslation: Boolean(item.showTranslation)
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
        showExplanation: Boolean(item.showExplanation)
    }));
    return normalized.length > 0 ? normalized : [createEmptyGrammarItem()];
};
const normalizePronunciationItems = (items: ClassroomPronunciationNote[] = []): ClassroomPronunciationNote[] => {
    const normalized = items.map((item) => ({
        word: item.word || '',
        phonetic: item.phonetic || '',
        isLoading: false,
        showPhonetic: Boolean(item.showPhonetic)
    }));
    return normalized.length > 0 ? normalized : [createEmptyPronunciationItem()];
};
const normalizeClassroomNotesSnapshot = (snapshot?: Partial<ClassroomNotesSnapshot> | null): ClassroomNotesSnapshot => ({
    vocabularyItems: normalizeVocabularyItems(snapshot?.vocabularyItems),
    grammarItems: normalizeGrammarItems(snapshot?.grammarItems),
    pronunciationItems: normalizePronunciationItems(snapshot?.pronunciationItems),
    isUsed: Boolean(snapshot?.isUsed),
    completionStatus: snapshot?.completionStatus || null,
    stoppedAt: snapshot?.stoppedAt || null,
    stoppedAtLabel: snapshot?.stoppedAtLabel || null,
    progressDetails: snapshot?.progressDetails || ''
});
const createClassroomNotesDraft = (sessionId: string, target: ActiveNotesTarget, snapshot: Partial<ClassroomNotesSnapshot> | null | undefined, updatedAt = Date.now()): ClassroomNotesDraft => {
    const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);
    return {
        sessionId,
        materialType: target.materialType,
        materialId: target.materialId,
        courseId: target.courseId || null,
        lessonId: target.lessonId || null,
        articleId: target.articleId || null,
        updatedAt,
        ...normalizedSnapshot
    };
};
const buildClassroomNotesPayload = (target: ActiveNotesTarget, snapshot: Partial<ClassroomNotesSnapshot> | null | undefined): SaveClassroomNotesInput => {
    const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);
    return {
        materialType: target.materialType,
        materialId: target.materialId,
        materialTitle: target.materialTitle,
        courseId: target.courseId || undefined,
        lessonId: target.lessonId || undefined,
        articleId: target.articleId || undefined,
        ...normalizedSnapshot
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
            ...normalizedSnapshot
        };
    }
    catch (error) {
        console.error('Failed to read classroom notes draft:', error);
        return null;
    }
};
const persistClassroomNotesDraft = (bindingKey: string, draft: ClassroomNotesDraft) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const key = buildClassroomNotesDraftKey(bindingKey);
        let previous = {};
        try {
            previous = JSON.parse(window.localStorage.getItem(key) || '{}');
        }
        catch { /* Replace malformed drafts. */ }
        window.localStorage.setItem(key, JSON.stringify({ ...previous, ...draft }));
    }
    catch (error) {
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
        // Add remaining text from this line
        if (lastIndex < line.length) {
            parts.push(line.slice(lastIndex));
        }
        else if (line.length === 0 && lines.length > 1) {
            // Empty line - just add the break
        }
        // Add line break after each line except the last
        if (lineIndex < lines.length - 1) {
            parts.push(<br />);
        }
    });
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
        const _cleanup5 = untrack(() => {
            document.title = 'Classroom | FluentXVerse';
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    const _state1 = useAuthContext();
    const resolvedTheme = createMemo(() => useThemeStore((state) => state.resolvedTheme));
    const _state2 = useLocation();
    const chatEndRef = { current: null } as {
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
    const courseDropdownRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const materialCourseCacheRef = { current: {} } as {
        current: Record<string, Lesson[]> | null;
    };
    const businessEnglishPrefetchRef = { current: {} } as {
        current: Record<string, Promise<void>> | null;
    };
    const restoredClassroomStateRef = { current: null } as {
        current: (ClassroomPersistedState | null) | null;
    };
    const hydratedClassroomSessionRef = { current: null } as {
        current: (string | null) | null;
    };
    const receivedReportIds = { current: new Set<string>() } as {
        current: any;
    };
    // Track stream IDs for forcing re-renders
    const [localStreamId, setLocalStreamId] = createSignal<string>('');
    const [remoteStreamId, setRemoteStreamId] = createSignal<string>('');
    // Socket state for passing to child components
    const [socketInstance, setSocketInstance] = createSignal<Socket | null>(null);
    const [signalingConnected, setSignalingConnected] = createSignal(false);
    const [signalingError, setSignalingError] = createSignal<string | null>(null);
    // Extract sessionId from router params or query string, fallback to pathname
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
    createEffect(on(() => [currentSessionId()], () => {
        const _cleanup6 = untrack(() => {
            if (!currentSessionId() || hydratedClassroomSessionRef.current === currentSessionId()) {
                return;
            }
            hydratedClassroomSessionRef.current = currentSessionId();
            try {
                const raw = window.sessionStorage.getItem(buildClassroomPersistedStateKey(currentSessionId()));
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
            }
            catch (error) {
                console.error('Failed to restore classroom material state:', error);
                restoredClassroomStateRef.current = null;
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    // Initialize socket and join session
    createEffect(on(() => [currentSessionId()], () => {
        const _cleanup7 = untrack(() => {
            if (!currentSessionId())
                return;
            // Destroy any existing socket to ensure fresh connection with correct auth
            destroySocket();
            initSocket();
            connectSocket();
            const socket = getSocket();
            setSocketInstance(socket);
            // Wait for connection before joining
            const onConnect = () => {
                setSignalingConnected(true);
                setSignalingError(null);
                socket.emit('session:join', { get sessionId() {
                        return currentSessionId();
                    } });
            };
            const onDisconnect = () => {
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
            // Fetch student's lesson request - declared early so it can be used in multiple handlers
            const fetchStudentLessonRequest = async (studentId: string) => {
                try {
                    const lessonRequest = await tutorApi.getStudentLessonRequest(studentId, currentSessionId());
                    if (lessonRequest) {
                        const restoredOpenMaterial = restoredClassroomStateRef.current?.openMaterial;
                        if (restoredOpenMaterial?.kind === 'lesson') {
                            const mergedLessonRequest: StudentLessonRequest = {
                                ...lessonRequest,
                                ...restoredOpenMaterial.request,
                                studentPreferences: lessonRequest.studentPreferences || restoredOpenMaterial.request.studentPreferences
                            };
                            setStudentLessonRequest(mergedLessonRequest);
                            if (mergedLessonRequest.lessonId) {
                                try {
                                    const nextViewUrl = restoredOpenMaterial.viewUrl
                                        || await resolveTutorMaterialViewUrl(mergedLessonRequest.courseId, mergedLessonRequest.lessonId);
                                    setLessonViewUrl(nextViewUrl);
                                }
                                catch (err) {
                                    console.error('Failed to restore lesson view URL:', err);
                                }
                            }
                            return;
                        }
                        setStudentLessonRequest(lessonRequest);
                        // Also fetch the lesson viewUrl for iframe display
                        if (lessonRequest.lessonId && !restoredOpenMaterial) {
                            try {
                                const nextViewUrl = await resolveTutorMaterialViewUrl(lessonRequest.courseId, lessonRequest.lessonId);
                                setLessonViewUrl(nextViewUrl);
                            }
                            catch (err) {
                                console.error('Failed to get lesson view URL:', err);
                            }
                        }
                    }
                }
                catch (err) {
                    console.error('📚 [Classroom] Failed to fetch student lesson request:', err);
                }
            };
            // Handle session state
            const onSessionState = (data: any) => {
                if (data.sessionId !== currentSessionId())
                    return;
                setMediaProvider(previous => data.mediaProvider || previous || 'webrtc');
                socket.emit('chat:request-history', { get sessionId() {
                        return currentSessionId();
                    } });
                setIsConnecting(!data.participants?.studentId);
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
                }
                else {
                    // No student in session, clear studentInfo
                    setStudentInfo(null);
                }
            };
            const onSessionError = (data: {
                message: string;
            }) => {
                setSignalingError(data.message);
                toast.error(data.message);
            };
            // Handle user joined
            const onUserJoined = (data: {
                userId: string;
                userType: string;
            }) => {
                if (data.userType === 'tutor')
                    window.dispatchEvent(new Event('fxv:tutor-schedule-updated'));
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
            const onUserLeft = (data: {
                userId: string;
                userType: string;
            }) => {
                if (data.userType === 'student') {
                    setStudentInfo(null);
                    setIsConnecting(true);
                }
            };
            const onVideoState = (data: {
                sessionId: string;
                userType: 'tutor' | 'student';
                enabled: boolean;
            }) => {
                if (data.sessionId !== currentSessionId() || data.userType !== 'student')
                    return;
                setRemoteVideoEnabled(data.enabled);
            };
            const onActivityHistory = (logs: ClassroomActivityLogData[]) => {
                setActivityLogs(logs);
                setIsHistoryLoading(false);
            };
            const onActivityLog = (log: ClassroomActivityLogData) => {
                setActivityLogs(prev => prev.some(item => item.id === log.id) ? prev : [...prev, log]);
            };
            const onLessonReportReceived = (notification: Notification) => {
                if (notification.title !== 'Lesson report received' || notification.data?.bookingId !== currentSessionId() || receivedReportIds.current.has(notification.id))
                    return;
                receivedReportIds.current.add(notification.id);
                toast.warning('The student reported an issue with this lesson.', 'Report Received');
            };
            // Set up listeners
            socket.on('notification:new', onLessonReportReceived);
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
            socket.on('classroom:video-state', onVideoState);
            socket.on('classroom:activity-history', onActivityHistory);
            socket.on('classroom:activity-log', onActivityLog);
            // If already connected, join immediately
            if (socket.connected) {
                onConnect();
            }
            return () => {
                socket.off('notification:new', onLessonReportReceived);
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
                socket.off('classroom:video-state', onVideoState);
                socket.off('classroom:activity-history', onActivityHistory);
                socket.off('classroom:activity-log', onActivityLog);
                if (socket.connected)
                    socket.emit('session:leave');
                socket.disconnect();
            };
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    // State
    const [message, setMessage] = createSignal('');
    const elapsedTime = createMemo(() => lessonStart.elapsed);
    const [isMuted, setIsMuted] = createSignal(false);
    const [isVideoOff, setIsVideoOff] = createSignal(false);
    const [isSwapped, setIsSwapped] = createSignal(true);
    const [studentInfo, setStudentInfo] = createSignal<{
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
    // Daily Dispatch Notes Widget state
    const [showNotesWidget, setShowNotesWidget] = createSignal(false);
    const [vocabularyItems, setVocabularyItems] = createSignal<ClassroomVocabularyNote[]>([createEmptyVocabularyItem()]);
    const [grammarItems, setGrammarItems] = createSignal<ClassroomGrammarNote[]>([createEmptyGrammarItem()]);
    const [pronunciationItems, setPronunciationItems] = createSignal<ClassroomPronunciationNote[]>([createEmptyPronunciationItem()]);
    const [materialProgress, setMaterialProgress] = createSignal<MaterialProgressFields>({ isUsed: false, completionStatus: null, stoppedAt: null, stoppedAtLabel: null, progressDetails: '' });
    const [progressContext, setProgressContext] = createSignal<{
        bindingKey: string;
        data: ClassroomMaterialProgress | null;
    }>({ bindingKey: '', data: null });
    const [progressRevision, setProgressRevision] = createSignal(0);
    const progressContextsRef = { current: {} } as {
        current: Record<string, ClassroomMaterialProgress> | null;
    };
    const _state3 = useClassroomLessonNotes(() => currentSessionId());
    const [notesSelection, setNotesSelection] = createSignal<{
        sessionId: string;
        target: ActiveNotesTarget;
    } | null>(null);
    const selectedNotesTarget = createMemo(() => notesSelection()?.sessionId === currentSessionId() ? notesSelection().target : null);
    const [previewedNotes, setPreviewedNotes] = createSignal<{
        sessionId: string;
        targets: ActiveNotesTarget[];
    }>({ get sessionId() {
            return currentSessionId();
        }, targets: [] });
    const previewedNotesTargets = createMemo(() => previewedNotes().sessionId === currentSessionId() ? previewedNotes().targets : []);
    const [notesPersistenceState, setNotesPersistenceState] = createSignal<'idle' | 'loading' | 'saving' | 'saved' | 'draft' | 'error'>('idle');
    const notesHydratedKeyRef = { current: null } as {
        current: (string | null) | null;
    };
    const notesSkipAutosaveRef = { current: false } as {
        current: any;
    };
    const notesSkipDraftPersistRef = { current: false } as {
        current: any;
    };
    const notesAutosaveTimeoutRef = { current: null } as {
        current: (number | null) | null;
    };
    const notesDraftUpdatedAtRef = { current: 0 } as {
        current: any;
    };
    const latestNotesDraftRef = { current: null } as {
        current: (ClassroomNotesDraft | null) | null;
    };
    const notesLastExitFlushAtRef = { current: 0 } as {
        current: any;
    };
    const notesSaveQueuesRef = { current: {} } as {
        current: Record<string, Promise<ClassroomNotesRecord>> | null;
    };
    const activeNotesKeyRef = { current: null } as {
        current: (string | null) | null;
    };
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
            }
            else {
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
        const item = vocabularyItems()[index];
        const bindingKey = activeNotesKeyRef.current;
        if (!item.word.trim())
            return;
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
            if (!response.ok)
                throw new Error('Failed to get definition');
            const data = await response.json();
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            setVocabularyItems(prev => {
                if (prev[index]?.word !== item.word)
                    return prev;
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
        }
        catch (error) {
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            console.error('Vocabulary definition failed:', error);
            toast.error('Failed to get vocabulary definition');
            setVocabularyItems(prev => {
                if (prev[index]?.word !== item.word)
                    return prev;
                const updated = [...prev];
                updated[index] = { ...updated[index], isLoading: false };
                return updated;
            });
        }
    };
    // Send vocabulary to chat
    const sendVocabularyToChat = (index: number) => {
        const item = vocabularyItems()[index];
        const selectedDef = item.definitions[item.selectedDefinitionIndex];
        if (!item.word.trim() || !selectedDef?.meaning || !currentSessionId())
            return;
        const partOfSpeech = selectedDef.partOfSpeech ? ` (${selectedDef.partOfSpeech})` : '';
        const formattedMessage = `${item.word}${partOfSpeech} - ${selectedDef.meaning}`;
        try {
            const socket = getSocket();
            socket.emit('chat:send', {
                get sessionId() {
                    return currentSessionId();
                },
                text: formattedMessage
            });
            // Hide definition after sending
            setVocabularyItems(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], showDefinition: false, showTranslation: false };
                return updated;
            });
            toast.success('Vocabulary sent to chat');
        }
        catch (error) {
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
            }
            else {
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
        const item = grammarItems()[index];
        if (!item.youSaid.trim() || !item.correct.trim() || !currentSessionId())
            return;
        const formattedMessage = `You said: ${item.youSaid}\nCorrect: ${item.correct}`;
        try {
            const socket = getSocket();
            socket.emit('chat:send', {
                get sessionId() {
                    return currentSessionId();
                },
                text: formattedMessage
            });
            toast.success('Grammar correction sent to chat');
        }
        catch (error) {
            console.error('Failed to send grammar to chat:', error);
            toast.error('Failed to send to chat');
        }
    };
    // Get grammar correction from OpenAI
    const getGrammarCorrection = async (index: number) => {
        const item = grammarItems()[index];
        const bindingKey = activeNotesKeyRef.current;
        if (!item.youSaid.trim())
            return;
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
            if (!response.ok)
                throw new Error('Failed to get correction');
            const data = await response.json();
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            setGrammarItems(prev => {
                if (prev[index]?.youSaid !== item.youSaid)
                    return prev;
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
        }
        catch (error) {
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            console.error('Grammar check failed:', error);
            toast.error('Failed to get grammar correction');
            setGrammarItems(prev => {
                if (prev[index]?.youSaid !== item.youSaid)
                    return prev;
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
            }
            else {
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
        const item = pronunciationItems()[index];
        const bindingKey = activeNotesKeyRef.current;
        if (!item.word.trim())
            return;
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
            if (!response.ok)
                throw new Error('Failed to get pronunciation');
            const data = await response.json();
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            setPronunciationItems(prev => {
                if (prev[index]?.word !== item.word)
                    return prev;
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    phonetic: data.phonetic || '',
                    isLoading: false,
                    showPhonetic: true
                };
                return updated;
            });
        }
        catch (error) {
            if (bindingKey !== activeNotesKeyRef.current)
                return;
            console.error('Pronunciation failed:', error);
            toast.error('Failed to get pronunciation');
            setPronunciationItems(prev => {
                if (prev[index]?.word !== item.word)
                    return prev;
                const updated = [...prev];
                updated[index] = { ...updated[index], isLoading: false };
                return updated;
            });
        }
    };
    // Send pronunciation to chat
    const sendPronunciationToChat = (index: number) => {
        const item = pronunciationItems()[index];
        if (!item.word.trim() || !item.phonetic || !currentSessionId())
            return;
        const formattedMessage = `${item.word} - [${item.phonetic}]`;
        try {
            const socket = getSocket();
            socket.emit('chat:send', {
                get sessionId() {
                    return currentSessionId();
                },
                text: formattedMessage
            });
            // Hide phonetic after sending
            setPronunciationItems(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], showPhonetic: false };
                return updated;
            });
            toast.success('Pronunciation sent to chat');
        }
        catch (error) {
            console.error('Failed to send pronunciation to chat:', error);
            toast.error('Failed to send to chat');
        }
    };
    // File upload state
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [filePreview, setFilePreview] = createSignal<string | null>(null);
    const [isUploading, setIsUploading] = createSignal(false);
    const fileInputRef = { current: null } as {
        current: HTMLInputElement | null;
    };
    // Student lesson request state (received from student)
    const [studentLessonRequest, setStudentLessonRequest] = createSignal<StudentLessonRequest | null>(null);
    // Material selector state - hierarchical
    const [availableLessons, setAvailableLessons] = createSignal<Lesson[]>([]);
    const materialLoadIdRef = { current: 0 } as {
        current: any;
    };
    const [loadingMaterials, setLoadingMaterials] = createSignal(false);
    const [selectedCourse, setSelectedCourse] = createSignal<string>('');
    const [isCourseDropdownOpen, setIsCourseDropdownOpen] = createSignal(false);
    const [courseDropdownMenuStyle, setCourseDropdownMenuStyle] = createSignal<JSX.CSSProperties | null>(null);
    const [showLessonRequest, setShowLessonRequest] = createSignal(true);
    const [lessonViewUrl, setLessonViewUrl] = createSignal<string | null>(null);
    const [loadingViewUrl, setLoadingViewUrl] = createSignal(false);
    const businessEnglishTheme: Accessor<'light' | 'dark'> = createMemo(() => resolvedTheme() === 'dark' ? 'dark' : 'light');
    // Course definitions
    const courses = [
        { id: 'conversational-skills', name: 'Conversational Skills', icon: '💬', description: 'Conversation lessons for practical speaking practice.' },
        { id: 'business-english', name: 'Business English', icon: '💼', description: 'Workplace English lessons and professional scenarios.' },
        { id: 'young-learners', name: 'Young Learners', icon: '🎨', description: 'Visual lessons designed for younger students.' },
        { id: 'daily-dispatch', name: 'Daily Dispatch', icon: '📰', description: 'News-based reading and discussion material.' },
    ];
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
            }
            catch (error) {
                console.error('Failed to prefetch Business English lesson:', error);
            }
            finally {
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
    const selectedCourseOption = createMemo(() => courses.find(course => course.id === selectedCourse()) || null);
    const requestedCourseLabel = createMemo(() => studentLessonRequest() ? courses.find(course => course.id === studentLessonRequest().courseId)?.name || 'Lesson Material'
        : 'Not selected');
    const previousLessonLabel = createMemo(() => studentLessonRequest() && studentLessonRequest().lessonNumber > 1
        ? `Lesson ${studentLessonRequest().lessonNumber - 1}`
        : 'No previous lesson');
    const cameraPreference = createMemo(() => studentLessonRequest()?.studentPreferences?.cameraOn === false ? 'Off' : 'On');
    const proficiencyPreference = createMemo(() => studentLessonRequest()?.studentPreferences?.proficiency || 'Not set');
    const correctionPreference = createMemo(() => studentLessonRequest()?.studentPreferences?.errorCorrection === 'proactively'
        ? 'Correct proactively'
        : studentLessonRequest()?.studentPreferences?.errorCorrection === 'during_feedback'
            ? 'Save for feedback'
            : 'Tutor decides');
    const correctionPreferenceNote = createMemo(() => studentLessonRequest()?.studentPreferences?.errorCorrection === 'proactively'
        ? 'Student prefers support during class.'
        : studentLessonRequest()?.studentPreferences?.errorCorrection === 'during_feedback'
            ? 'Student prefers review near the end.'
            : 'No strong correction preference was shared.');
    const activeMaterialCourseId = createMemo(() => !showLessonRequest() ? studentLessonRequest()?.courseId || '' : '');
    const isViewingBusinessEnglishMaterial = createMemo(() => activeMaterialCourseId() === 'business-english' && !showLessonRequest());
    const businessEnglishHeaderTitle = createMemo(() => studentLessonRequest()?.title || 'Business English lesson');
    // Daily Dispatch state
    const [viewingDispatchArticle, setViewingDispatchArticle] = createSignal<DispatchArticle | null>(null);
    // Conversational Skills viewing state
    const [viewingConversationalLesson, setViewingConversationalLesson] = createSignal<ConversationalLesson | null>(null);
    const [conversationalViewUrl, setConversationalViewUrl] = createSignal<string | null>(null);
    const [loadingConversationalView, setLoadingConversationalView] = createSignal(false);
    const hasOpenMaterial = createMemo(() => Boolean(viewingDispatchArticle() ||
        (viewingConversationalLesson() && conversationalViewUrl()) || lessonViewUrl() || loadingViewUrl()));
    const materialTabTitle = createMemo(() => viewingDispatchArticle()?.title
        || viewingConversationalLesson()?.title
        || studentLessonRequest()?.title
        || (loadingViewUrl() ? 'Opening material...' : 'Current material'));
    const materialTabContext = createMemo(() => viewingDispatchArticle() ? 'Daily Dispatch'
        : viewingConversationalLesson() ? 'Conversational Skills'
            : studentLessonRequest()?.courseId === 'business-english'
                ? 'Business English'
                : studentLessonRequest()?.courseId === 'young-learners'
                    ? 'Young Learners'
                    : 'Lesson Material');
    const materialTabIconClass = createMemo(() => viewingDispatchArticle() ? 'fas fa-newspaper'
        : viewingConversationalLesson() ? 'fas fa-comments'
            : studentLessonRequest()?.courseId === 'business-english'
                ? 'fas fa-briefcase'
                : studentLessonRequest()?.courseId === 'young-learners'
                    ? 'fas fa-seedling'
                    : 'fas fa-book-open');
    const displayedNotesTarget = createMemo<ActiveNotesTarget | null>(() => !showLessonRequest()
        ? viewingDispatchArticle() ? { materialType: 'daily-dispatch', materialId: viewingDispatchArticle().id, materialTitle: viewingDispatchArticle().title, courseId: 'daily-dispatch', articleId: viewingDispatchArticle().id }
            : viewingConversationalLesson() ? { materialType: 'conversational-skills', materialId: viewingConversationalLesson().id, materialTitle: viewingConversationalLesson().title, courseId: 'conversational-skills', lessonId: viewingConversationalLesson().id }
                : isViewingBusinessEnglishMaterial() && studentLessonRequest()?.lessonId ? { materialType: 'business-english', materialId: studentLessonRequest().lessonId, materialTitle: studentLessonRequest().title, courseId: 'business-english', lessonId: studentLessonRequest().lessonId }
                    : null : null);
    const notesTargets = createMemo(() => [...new Map<string, ActiveNotesTarget>([
            ..._state3.materials.filter(note => note.sessionId === currentSessionId()).map(note => [`${note.materialType}:${note.materialId}`, { ...note, materialType: note.materialType as ActiveNotesTarget['materialType'], materialTitle: note.materialTitle || undefined }] as [
                string,
                ActiveNotesTarget
            ]),
            ...previewedNotesTargets().map(target => [`${target.materialType}:${target.materialId}`, target] as [
                string,
                ActiveNotesTarget
            ]),
            ...(displayedNotesTarget() ? [[`${displayedNotesTarget().materialType}:${displayedNotesTarget().materialId}`, displayedNotesTarget()] as [
                    string,
                    ActiveNotesTarget
                ]] : []),
        ]).values()]);
    const activeNotesTarget = createMemo(() => selectedNotesTarget() || displayedNotesTarget() || notesTargets()[0] || null);
    const activeNotesMaterial = createMemo(() => activeNotesTarget()?.materialType || null);
    const showNotesWidgetTrigger = createMemo(() => Boolean(activeNotesTarget()) || _state3.ready);
    const notesWidgetTitle = 'Lesson notes';
    const notesWidgetFabTitle = 'Lesson notes';
    const notesWidgetIconClass = createMemo(() => lessonMaterialNotesIcon(activeNotesMaterial()));
    const notesWidgetClassName = createMemo(() => activeNotesMaterial() === 'business-english'
        ? `dispatch-notes-widget dispatch-notes-widget--business-english dispatch-notes-widget--business-english-${businessEnglishTheme()}`
        : 'dispatch-notes-widget dispatch-notes-widget--daily-dispatch');
    const notesWidgetFabClassName = createMemo(() => activeNotesMaterial() === 'business-english'
        ? `dispatch-notes-fab dispatch-notes-fab--business-english dispatch-notes-fab--business-english-${businessEnglishTheme()}`
        : 'dispatch-notes-fab dispatch-notes-fab--daily-dispatch');
    const activeNotesBindingKey = createMemo(() => currentSessionId() && activeNotesTarget()
        ? buildClassroomNotesBindingKey(currentSessionId(), activeNotesTarget())
        : null);
    const activeNotesMaterialType = createMemo(() => activeNotesTarget()?.materialType || null);
    const activeNotesMaterialId = createMemo(() => activeNotesTarget()?.materialId || null);
    const activeNotesCourseId = createMemo(() => activeNotesTarget()?.courseId || null);
    const activeNotesLessonId = createMemo(() => activeNotesTarget()?.lessonId || null);
    const activeNotesArticleId = createMemo(() => activeNotesTarget()?.articleId || null);
    createEffect(() => activeNotesKeyRef.current = activeNotesBindingKey());
    const activeMaterialUsed = createMemo(() => _state3.materials.some(note => note.sessionId === currentSessionId() && note.materialType === activeNotesMaterialType() && note.materialId === activeNotesMaterialId()));
    const activeProgressContext = createMemo(() => progressContext().bindingKey === activeNotesBindingKey() ? progressContext().data : null);
    const applyNotesSnapshot = (snapshot: Partial<ClassroomNotesSnapshot> | null | undefined, context?: ClassroomMaterialProgress | null) => {
        const normalizedSnapshot = normalizeClassroomNotesSnapshot(snapshot);
        setVocabularyItems(normalizedSnapshot.vocabularyItems);
        setGrammarItems(normalizedSnapshot.grammarItems);
        setPronunciationItems(normalizedSnapshot.pronunciationItems);
        const previous = context?.previous?.completionStatus === 'in_progress' ? context.previous : null;
        const hasProgress = Boolean(snapshot?.completionStatus);
        const completed = activeNotesMaterialType() === 'daily-dispatch' || snapshot?.completionStatus === 'completed';
        const stoppedAt = hasProgress ? normalizedSnapshot.stoppedAt : previous?.stoppedAt || null;
        const stoppedAtLabel = hasProgress ? normalizedSnapshot.stoppedAtLabel : previous?.stoppedAtLabel || null;
        const excluded = (activeNotesMaterialType() === 'conversational-skills' &&
            (/^(missionData\d*|feedbackData)(\.|$)/.test(stoppedAt || '') || /^Part [56]\b/.test(stoppedAtLabel || ''))) ||
            (activeNotesMaterialType() === 'business-english' && /^(discussion|feedback)(\.|$)/.test(stoppedAt || ''));
        const progress: MaterialProgressFields = { isUsed: normalizedSnapshot.isUsed,
            completionStatus: completed ? 'completed' : 'in_progress',
            stoppedAt: completed || excluded ? null : stoppedAt,
            stoppedAtLabel: completed || excluded ? null : stoppedAtLabel,
            progressDetails: completed || excluded ? '' : hasProgress ? normalizedSnapshot.progressDetails : previous?.progressDetails || '' };
        setMaterialProgress(progress);
        return { ...normalizedSnapshot, ...progress };
    };
    const syncDraftFromServerRecord = (bindingKey: string, target: ActiveNotesTarget, record: ClassroomNotesRecord, saveStartedAt = Infinity) => {
        if (!currentSessionId()) {
            return;
        }
        const syncedDraft = createClassroomNotesDraft(currentSessionId(), target, record, parseNotesUpdatedAt(record.updatedAt));
        if ((readClassroomNotesDraft(bindingKey)?.updatedAt || 0) > saveStartedAt)
            return;
        if (activeNotesKeyRef.current === bindingKey) {
            notesDraftUpdatedAtRef.current = syncedDraft.updatedAt;
            latestNotesDraftRef.current = syncedDraft;
        }
        persistClassroomNotesDraft(bindingKey, syncedDraft);
    };
    const saveNotesSnapshotToBackend = async (bindingKey: string, target: ActiveNotesTarget, snapshot: Partial<ClassroomNotesSnapshot> | null | undefined, isUsed = false) => {
        if (!currentSessionId()) {
            throw new Error('Missing classroom session id');
        }
        const saveStartedAt = Date.now();
        const pending = (notesSaveQueuesRef.current[bindingKey] || Promise.resolve()).catch(() => { }).then(() => tutorApi.saveClassroomNotes(currentSessionId(), { ...buildClassroomNotesPayload(target, snapshot), clientUpdatedAt: saveStartedAt, ...(isUsed ? { isUsed: true } : {}) }));
        notesSaveQueuesRef.current[bindingKey] = pending;
        const savedRecord = await pending;
        syncDraftFromServerRecord(bindingKey, target, savedRecord, saveStartedAt);
        _state3.rememberMaterial(savedRecord);
        return savedRecord;
    };
    const selectNotesMaterial = (target: ActiveNotesTarget) => {
        if (notesAutosaveTimeoutRef.current !== null)
            window.clearTimeout(notesAutosaveTimeoutRef.current);
        const draft = latestNotesDraftRef.current;
        if (draft && activeNotesTarget() && activeNotesBindingKey() && notesHydratedKeyRef.current === activeNotesBindingKey() &&
            draft.materialId === activeNotesTarget().materialId && draft.materialType === activeNotesTarget().materialType) {
            const latestDraft = createClassroomNotesDraft(currentSessionId(), activeNotesTarget(), mergeProps({ get vocabularyItems() {
                    return vocabularyItems();
                } }, { get grammarItems() {
                    return grammarItems();
                } }, { get pronunciationItems() {
                    return pronunciationItems();
                } }, () => materialProgress()), Date.now());
            persistClassroomNotesDraft(activeNotesBindingKey(), latestDraft);
            void saveNotesSnapshotToBackend(activeNotesBindingKey(), activeNotesTarget(), latestDraft).catch(() => { });
        }
        setNotesSelection({ sessionId: currentSessionId(), target });
    };
    createEffect(on(() => [currentSessionId(), displayedNotesTarget()?.materialType, displayedNotesTarget()?.materialId], () => {
        const _cleanup8 = untrack(() => {
            if (!displayedNotesTarget())
                return;
            setPreviewedNotes(previous => {
                const targets = previous.sessionId === currentSessionId() ? previous.targets : [];
                return { sessionId: currentSessionId(), targets: targets.some(item => item.materialType === displayedNotesTarget().materialType && item.materialId === displayedNotesTarget().materialId)
                        ? targets : [...targets, displayedNotesTarget()] };
            });
            if (!selectedNotesTarget() || activeNotesMaterialType() !== displayedNotesTarget().materialType || activeNotesMaterialId() !== displayedNotesTarget().materialId)
                selectNotesMaterial(displayedNotesTarget());
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    createEffect(on(() => [
        activeNotesBindingKey(),
        activeNotesArticleId(),
        currentSessionId(),
        activeNotesCourseId(),
        grammarItems(),
        activeNotesLessonId(),
        activeNotesMaterialId(),
        activeNotesMaterialType(),
        pronunciationItems(),
        materialProgress(),
        vocabularyItems(),
    ], () => {
        const _cleanup9 = untrack(() => {
            if (!currentSessionId() || !activeNotesTarget() || !activeNotesBindingKey()) {
                latestNotesDraftRef.current = null;
                return;
            }
            const updatedAt = notesDraftUpdatedAtRef.current || Date.now();
            latestNotesDraftRef.current = createClassroomNotesDraft(currentSessionId(), activeNotesTarget(), mergeProps({ get vocabularyItems() {
                    return vocabularyItems();
                } }, { get grammarItems() {
                    return grammarItems();
                } }, { get pronunciationItems() {
                    return pronunciationItems();
                } }, () => materialProgress()), updatedAt);
        });
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    createEffect(on(() => [
        businessEnglishTheme(),
        conversationalViewUrl(),
        currentSessionId(),
        lessonViewUrl(),
        showLessonRequest(),
        studentLessonRequest(),
        viewingConversationalLesson(),
        viewingDispatchArticle(),
    ], () => {
        const _cleanup10 = untrack(() => {
            if (!currentSessionId()) {
                return;
            }
            let openMaterial: ClassroomPersistedOpenMaterial | null = null;
            if (viewingDispatchArticle()) {
                openMaterial = {
                    kind: 'dispatch',
                    get article() {
                        return viewingDispatchArticle();
                    }
                };
            }
            else if (viewingConversationalLesson() && conversationalViewUrl()) {
                openMaterial = {
                    kind: 'conversational',
                    get lesson() {
                        return viewingConversationalLesson();
                    },
                    get viewUrl() {
                        return conversationalViewUrl();
                    }
                };
            }
            else if (lessonViewUrl() && studentLessonRequest()) {
                openMaterial = {
                    kind: 'lesson',
                    get request() {
                        return studentLessonRequest();
                    },
                    get viewUrl() {
                        return lessonViewUrl();
                    },
                    get businessEnglishTheme() {
                        return studentLessonRequest().courseId === 'business-english' ? businessEnglishTheme() : undefined;
                    }
                };
            }
            try {
                if (!openMaterial) {
                    restoredClassroomStateRef.current = null;
                    window.sessionStorage.removeItem(buildClassroomPersistedStateKey(currentSessionId()));
                    return;
                }
                const persistedState: ClassroomPersistedState = {
                    get showLessonRequest() {
                        return showLessonRequest();
                    },
                    openMaterial
                };
                restoredClassroomStateRef.current = persistedState;
                window.sessionStorage.setItem(buildClassroomPersistedStateKey(currentSessionId()), JSON.stringify(persistedState));
            }
            catch (error) {
                console.error('Failed to persist classroom material state:', error);
            }
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    createEffect(on(() => [showNotesWidget(), showNotesWidgetTrigger()], () => {
        const _cleanup11 = untrack(() => {
            if (!showNotesWidgetTrigger() && showNotesWidget()) {
                setShowNotesWidget(false);
            }
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    createEffect(on(() => [], () => {
        const _cleanup12 = untrack(() => {
            return () => {
                if (notesAutosaveTimeoutRef.current !== null) {
                    window.clearTimeout(notesAutosaveTimeoutRef.current);
                }
            };
        });
        if (typeof _cleanup12 === "function")
            onCleanup(_cleanup12);
    }));
    createEffect(on(() => [activeNotesBindingKey(), activeNotesMaterialId(), activeNotesMaterialType(), currentSessionId(), progressRevision()], () => {
        const _cleanup13 = untrack(() => {
            if (!currentSessionId() || !activeNotesTarget() || !activeNotesBindingKey()) {
                notesHydratedKeyRef.current = null;
                setNotesPersistenceState('idle');
                return;
            }
            let cancelled = false;
            const localDraft = readClassroomNotesDraft(activeNotesBindingKey());
            setNotesPersistenceState('loading');
            if (localDraft) {
                notesHydratedKeyRef.current = activeNotesBindingKey();
                notesSkipAutosaveRef.current = true;
                notesSkipDraftPersistRef.current = true;
                notesDraftUpdatedAtRef.current = localDraft.updatedAt;
                latestNotesDraftRef.current = localDraft;
                applyNotesSnapshot(localDraft);
            }
            void (async () => {
                try {
                    // A quick return to a material must wait for its outgoing save before hydrating.
                    await notesSaveQueuesRef.current[activeNotesBindingKey()]?.catch(() => { });
                    if (cancelled)
                        return;
                    const savedNotes = await tutorApi.getClassroomNotes(currentSessionId(), activeNotesTarget().materialType, activeNotesTarget().materialId);
                    const context = progressContextsRef.current[activeNotesBindingKey()] || await tutorApi.getClassroomMaterialProgress(currentSessionId(), activeNotesMaterialType()!, activeNotesMaterialId()!).catch(() => null);
                    if (context)
                        progressContextsRef.current[activeNotesBindingKey()] = context;
                    if (cancelled) {
                        return;
                    }
                    setProgressContext({ bindingKey: activeNotesBindingKey(), data: context });
                    const remoteUpdatedAt = savedNotes ? parseNotesUpdatedAt(savedNotes.updatedAt) : 0;
                    const shouldPreferLocalDraft = Boolean(localDraft && (!savedNotes || localDraft.updatedAt >= remoteUpdatedAt));
                    if (shouldPreferLocalDraft && localDraft) {
                        notesHydratedKeyRef.current = activeNotesBindingKey();
                        notesSkipAutosaveRef.current = true;
                        notesSkipDraftPersistRef.current = true;
                        notesDraftUpdatedAtRef.current = localDraft.updatedAt;
                        latestNotesDraftRef.current = localDraft;
                        const restoredSnapshot = applyNotesSnapshot(localDraft, context);
                        if (!savedNotes || localDraft.updatedAt > remoteUpdatedAt) {
                            setNotesPersistenceState('saving');
                            try {
                                await saveNotesSnapshotToBackend(activeNotesBindingKey(), activeNotesTarget(), restoredSnapshot);
                                if (!cancelled && notesHydratedKeyRef.current === activeNotesBindingKey()) {
                                    setNotesPersistenceState('saved');
                                }
                            }
                            catch (error) {
                                console.error('Failed to sync restored classroom notes draft:', error);
                                if (!cancelled && notesHydratedKeyRef.current === activeNotesBindingKey()) {
                                    setNotesPersistenceState('draft');
                                }
                            }
                            return;
                        }
                        setNotesPersistenceState('saved');
                        return;
                    }
                    notesHydratedKeyRef.current = activeNotesBindingKey();
                    notesSkipAutosaveRef.current = true;
                    notesSkipDraftPersistRef.current = true;
                    if (savedNotes) {
                        applyNotesSnapshot(savedNotes, context);
                        syncDraftFromServerRecord(activeNotesBindingKey(), activeNotesTarget(), savedNotes);
                        setNotesPersistenceState('saved');
                        return;
                    }
                    notesDraftUpdatedAtRef.current = 0;
                    latestNotesDraftRef.current = null;
                    applyNotesSnapshot(null, context);
                    setNotesPersistenceState('idle');
                }
                catch (error) {
                    if (cancelled) {
                        return;
                    }
                    console.error('Failed to load classroom notes:', error);
                    notesHydratedKeyRef.current = activeNotesBindingKey();
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
        });
        if (typeof _cleanup13 === "function")
            onCleanup(_cleanup13);
    }));
    createEffect(on(() => [
        activeNotesBindingKey(),
        activeNotesArticleId(),
        currentSessionId(),
        grammarItems(),
        activeNotesCourseId(),
        activeNotesLessonId(),
        activeNotesMaterialId(),
        activeNotesMaterialType(),
        pronunciationItems(),
        materialProgress(),
        vocabularyItems(),
    ], () => {
        const _cleanup14 = untrack(() => {
            if (!currentSessionId() || !activeNotesTarget() || !activeNotesBindingKey()) {
                return;
            }
            if (notesHydratedKeyRef.current !== activeNotesBindingKey()) {
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
                        await saveNotesSnapshotToBackend(activeNotesBindingKey(), activeNotesTarget(), mergeProps({ get vocabularyItems() {
                                return vocabularyItems();
                            } }, { get grammarItems() {
                                return grammarItems();
                            } }, { get pronunciationItems() {
                                return pronunciationItems();
                            } }, () => materialProgress()));
                        if (notesHydratedKeyRef.current === activeNotesBindingKey()) {
                            setNotesPersistenceState('saved');
                        }
                    }
                    catch (error) {
                        console.error('Failed to save classroom notes:', error);
                        if (notesHydratedKeyRef.current === activeNotesBindingKey()) {
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
        });
        if (typeof _cleanup14 === "function")
            onCleanup(_cleanup14);
    }));
    createEffect(on(() => [
        activeNotesBindingKey(),
        activeNotesArticleId(),
        currentSessionId(),
        activeNotesCourseId(),
        grammarItems(),
        activeNotesLessonId(),
        activeNotesMaterialId(),
        activeNotesMaterialType(),
        pronunciationItems(),
        materialProgress(),
        vocabularyItems(),
    ], () => {
        const _cleanup15 = untrack(() => {
            if (!currentSessionId() || !activeNotesTarget() || !activeNotesBindingKey()) {
                return;
            }
            if (notesHydratedKeyRef.current !== activeNotesBindingKey()) {
                return;
            }
            if (notesSkipDraftPersistRef.current) {
                notesSkipDraftPersistRef.current = false;
                return;
            }
            const updatedAt = Date.now();
            const draft = createClassroomNotesDraft(currentSessionId(), activeNotesTarget(), mergeProps({ get vocabularyItems() {
                    return vocabularyItems();
                } }, { get grammarItems() {
                    return grammarItems();
                } }, { get pronunciationItems() {
                    return pronunciationItems();
                } }, () => materialProgress()), updatedAt);
            notesDraftUpdatedAtRef.current = updatedAt;
            latestNotesDraftRef.current = draft;
            persistClassroomNotesDraft(activeNotesBindingKey(), draft);
        });
        if (typeof _cleanup15 === "function")
            onCleanup(_cleanup15);
    }));
    createEffect(on(() => [
        activeNotesArticleId(),
        activeNotesBindingKey(),
        currentSessionId(),
        activeNotesCourseId(),
        activeNotesLessonId(),
        activeNotesMaterialId(),
        activeNotesMaterialType(),
    ], () => {
        const _cleanup16 = untrack(() => {
            if (!currentSessionId() || !activeNotesTarget() || !activeNotesBindingKey()) {
                return;
            }
            const flushNotesDraft = (requestKeepaliveSave: boolean) => {
                const now = Date.now();
                if (requestKeepaliveSave && now - notesLastExitFlushAtRef.current < 250) {
                    return;
                }
                const currentDraft = latestNotesDraftRef.current;
                if (!currentDraft || currentDraft.sessionId !== currentSessionId() ||
                    currentDraft.materialType !== activeNotesMaterialType() || currentDraft.materialId !== activeNotesMaterialId() ||
                    notesHydratedKeyRef.current !== activeNotesBindingKey()) {
                    return;
                }
                if (requestKeepaliveSave)
                    notesLastExitFlushAtRef.current = now;
                const flushedDraft = createClassroomNotesDraft(currentSessionId(), activeNotesTarget(), currentDraft, now);
                notesDraftUpdatedAtRef.current = now;
                latestNotesDraftRef.current = flushedDraft;
                persistClassroomNotesDraft(activeNotesBindingKey(), flushedDraft);
                if (!requestKeepaliveSave) {
                    return;
                }
                try {
                    void window.fetch(`${API_BASE_URL}/tutor/classroom-notes/${encodeURIComponent(currentSessionId())}`, {
                        method: 'PUT',
                        credentials: 'include',
                        keepalive: true,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        get body() {
                            return JSON.stringify(mergeProps(() => buildClassroomNotesPayload(activeNotesTarget(), flushedDraft), { clientUpdatedAt: now }));
                        }
                    }).catch((error) => {
                        console.error('Failed to flush classroom notes during page exit:', error);
                    });
                }
                catch (error) {
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
                flushNotesDraft(true);
            };
        });
        if (typeof _cleanup16 === "function")
            onCleanup(_cleanup16);
    }));
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
        const loadId = ++materialLoadIdRef.current;
        setSelectedCourse(courseId);
        setAvailableLessons([]);
        setLoadingMaterials(false);
        setIsCourseDropdownOpen(false);
        if (!courseId)
            return;
        // Handle Daily Dispatch separately
        if (courseId === 'daily-dispatch') {
            return;
        }
        if (courseId === 'business-english') {
            const cachedLessons = materialCourseCacheRef.current[courseId] || readCachedBusinessEnglishLessonList<Lesson>(courseId);
            if (cachedLessons?.length) {
                materialCourseCacheRef.current[courseId] = cachedLessons;
                setAvailableLessons(cachedLessons);
                return;
            }
        }
        else if (isLessonMaterialCourse(courseId)) {
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
                if (loadId !== materialLoadIdRef.current)
                    return;
                setAvailableLessons(nextLessons);
            }
            else if (isLessonMaterialCourse(courseId)) {
                const result = await lessonApi.getPublishedLessonMaterials(courseId);
                if (loadId !== materialLoadIdRef.current)
                    return;
                if (result.success && result.lessons) {
                    const nextLessons = result.lessons.map(transformLessonMaterialToLesson);
                    materialCourseCacheRef.current[courseId] = nextLessons;
                    setAvailableLessons(nextLessons);
                }
            }
            else {
                // Use regular lesson endpoint for other courses
                const result = await lessonApi.getPublishedLessons(courseId);
                if (loadId !== materialLoadIdRef.current)
                    return;
                if (result.success && result.lessons) {
                    setAvailableLessons(result.lessons);
                }
            }
        }
        catch (err) {
            console.error('Failed to load lessons:', err);
        }
        finally {
            if (loadId === materialLoadIdRef.current)
                setLoadingMaterials(false);
        }
    };
    const buildDropdownMenuStyle = (container: HTMLDivElement | null): JSX.CSSProperties | null => {
        if (!container)
            return null;
        const triggerRect = container.getBoundingClientRect();
        const gap = 8;
        const viewportPadding = 16;
        const preferredMaxHeight = 240;
        const spaceBelow = Math.max(0, window.innerHeight - triggerRect.bottom - viewportPadding - gap);
        const spaceAbove = Math.max(0, triggerRect.top - viewportPadding - gap);
        const openAbove = spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
        const maxHeight = Math.min(preferredMaxHeight, openAbove ? spaceAbove : spaceBelow);
        const top = openAbove ? triggerRect.top - gap - maxHeight : triggerRect.bottom + gap;
        const width = Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2);
        const left = Math.min(Math.max(triggerRect.left, viewportPadding), window.innerWidth - width - viewportPadding);
        return {
            top: `${Math.max(viewportPadding, Math.min(top, window.innerHeight - viewportPadding - maxHeight))}px`,
            left: `${left}px`,
            width: `${width}px`,
            'max-height': `${maxHeight}px`
        };
    };
    const updateCourseDropdownMenuPosition = () => {
        setCourseDropdownMenuStyle(buildDropdownMenuStyle(courseDropdownRef.current));
    };
    const toggleCourseDropdown = () => {
        if (!isCourseDropdownOpen())
            updateCourseDropdownMenuPosition();
        setIsCourseDropdownOpen(value => !value);
    };
    createEffect(on(() => [], () => {
        const _cleanup17 = untrack(() => {
            const handlePointerDown = (event: MouseEvent) => {
                if (!courseDropdownRef.current?.contains(event.target as Node))
                    setIsCourseDropdownOpen(false);
            };
            const handleEscape = (event: KeyboardEvent) => {
                if (event.key === 'Escape')
                    setIsCourseDropdownOpen(false);
            };
            document.addEventListener('mousedown', handlePointerDown);
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('mousedown', handlePointerDown);
                document.removeEventListener('keydown', handleEscape);
            };
        });
        if (typeof _cleanup17 === "function")
            onCleanup(_cleanup17);
    }));
    createEffect(on(() => [isCourseDropdownOpen()], () => {
        const _cleanup18 = untrack(() => {
            if (!isCourseDropdownOpen()) {
                setCourseDropdownMenuStyle(null);
                return;
            }
            const syncDropdownPositions = () => updateCourseDropdownMenuPosition();
            syncDropdownPositions();
            window.addEventListener('resize', syncDropdownPositions);
            window.addEventListener('scroll', syncDropdownPositions, true);
            return () => {
                window.removeEventListener('resize', syncDropdownPositions);
                window.removeEventListener('scroll', syncDropdownPositions, true);
            };
        });
        if (typeof _cleanup18 === "function")
            onCleanup(_cleanup18);
    }));
    const currentMaterialTitle = createMemo(() => studentLessonRequest()?.title || 'No material selected yet');
    const currentMaterialMeta = createMemo(() => studentLessonRequest() ? `Lesson ${studentLessonRequest().lessonNumber}`
        : 'Awaiting student selection');
    const hasCurrentMaterial = createMemo(() => Boolean(studentLessonRequest()?.lessonId));
    const showSelectedCourseDetails = createMemo(() => Boolean(selectedCourse()) && !isCourseDropdownOpen());
    const handleOpenCurrentMaterial = async () => {
        if (!studentLessonRequest()?.lessonId)
            return;
        setViewingDispatchArticle(null);
        setViewingConversationalLesson(null);
        setConversationalViewUrl(null);
        if (studentLessonRequest().courseId === 'business-english') {
            setLoadingViewUrl(false);
            setLessonViewUrl(`/materials/business-english/${studentLessonRequest().lessonId}`);
            setShowLessonRequest(false);
            void prefetchBusinessEnglishLesson(studentLessonRequest().lessonId);
            return;
        }
        setLoadingViewUrl(true);
        setShowLessonRequest(false);
        try {
            const nextViewUrl = await resolveTutorMaterialViewUrl(studentLessonRequest().courseId, studentLessonRequest().lessonId);
            setLessonViewUrl(nextViewUrl);
        }
        catch (err) {
            console.error('Failed to open current material:', err);
        }
        finally {
            setLoadingViewUrl(false);
        }
    };
    const openSharedMaterial = (material: SharedClassroomMaterial) => {
        setViewingDispatchArticle(null);
        setViewingConversationalLesson(null);
        setConversationalViewUrl(null);
        setLessonViewUrl(null);
        setLoadingViewUrl(false);
        if (material.courseId === 'daily-dispatch') {
            setViewingDispatchArticle({
                id: material.id, title: material.title, topic: '', category: material.category || 'General',
                postedDate: material.postedDate, createdAt: material.createdAt || ''
            });
        }
        else if (material.courseId === 'conversational-skills') {
            setViewingConversationalLesson({
                id: material.id, title: material.title, level: material.level || 1,
                chapter: material.chapter || 1, lessonNumber: material.lessonNumber || 1, goalTextEn: ''
            });
            setConversationalViewUrl(`/materials/conversational-skills/${encodeURIComponent(material.id)}`);
        }
        else if (material.courseId === 'business-english') {
            setStudentLessonRequest(previous => ({
                ...previous, lessonId: material.id, courseId: material.courseId,
                title: material.title, lessonNumber: material.lessonNumber || 1, goal: ''
            }));
            setLessonViewUrl(`/materials/business-english/${encodeURIComponent(material.id)}`);
            void prefetchBusinessEnglishLesson(material.id);
        }
        else
            return;
        setShowLessonRequest(false);
    };
    // Handle selecting a new material (for tutor to override)
    const handleApplyMaterial = async (lessonId: string) => {
        if (!lessonId)
            return;
        const selectedLesson = availableLessons().find(l => l.id === lessonId);
        if (selectedLesson) {
            const newLesson = {
                lessonId: selectedLesson.id,
                get courseId() {
                    return selectedCourse();
                },
                title: selectedLesson.title,
                lessonNumber: getLessonNumber(selectedLesson),
                goal: selectedLesson.lessonData?.header?.goalText || ''
            };
            setStudentLessonRequest(prev => prev ? { ...prev, ...newLesson } : newLesson);
            setViewingDispatchArticle(null);
            setViewingConversationalLesson(null);
            setConversationalViewUrl(null);
            if (selectedCourse() === 'business-english') {
                setLoadingViewUrl(false);
                setLessonViewUrl(`/materials/business-english/${selectedLesson.id}`);
                setShowLessonRequest(false);
                void prefetchBusinessEnglishLesson(selectedLesson.id);
                return;
            }
            // Fetch the lesson viewUrl for iframe display (use tutor view for tutor)
            setLoadingViewUrl(true);
            try {
                const nextViewUrl = await resolveTutorMaterialViewUrl(selectedCourse(), selectedLesson.id);
                setLessonViewUrl(nextViewUrl);
            }
            catch (err) {
                console.error('Failed to get lesson view URL:', err);
            }
            finally {
                setLoadingViewUrl(false);
            }
            // Keep the current selection state warm so switching tabs feels instant
            setShowLessonRequest(false);
        }
    };
    createEffect(on(() => [], () => {
        const _cleanup19 = untrack(() => {
            void (async () => {
                try {
                    await warmBusinessEnglishCourseCache();
                }
                catch (error) {
                    console.error('Failed to warm Business English selector cache:', error);
                }
            })();
        });
        if (typeof _cleanup19 === "function")
            onCleanup(_cleanup19);
    }));
    createEffect(on(() => [studentLessonRequest()?.courseId, studentLessonRequest()?.lessonId], () => {
        const _cleanup20 = untrack(() => {
            if (studentLessonRequest()?.courseId === 'business-english' && studentLessonRequest().lessonId) {
                void prefetchBusinessEnglishLesson(studentLessonRequest().lessonId);
            }
        });
        if (typeof _cleanup20 === "function")
            onCleanup(_cleanup20);
    }));
    createEffect(on(() => [availableLessons(), selectedCourse()], () => {
        const _cleanup21 = untrack(() => {
            if (selectedCourse() !== 'business-english') {
                return;
            }
            availableLessons().slice(0, 3).forEach(lesson => void prefetchBusinessEnglishLesson(lesson.id));
        });
        if (typeof _cleanup21 === "function")
            onCleanup(_cleanup21);
    }));
    // Try to enable audio - will succeed if user has engagement history with the site
    createEffect(on(() => [audioEnabled()], () => {
        const _cleanup22 = untrack(() => {
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
        if (typeof _cleanup22 === "function")
            onCleanup(_cleanup22);
    }));
    // WebRTC Hook
    const _state4 = useClassroomMedia({ get provider() {
            return mediaProvider();
        }, get sessionId() {
            return currentSessionId();
        }, get remoteUserId() {
            return studentInfo()?.id;
        }, get socket() {
            return socketInstance();
        }, initiator: true, get enabled() {
            return lessonStart.live;
        } });
    createEffect(on(() => [lessonStart.closed, _state4.cleanup], () => {
        const _cleanup23 = untrack(() => {
            if (lessonStart.closed)
                _state4.cleanup();
        });
        if (typeof _cleanup23 === "function")
            onCleanup(_cleanup23);
    }));
    const callConnected = createMemo(() => _state4.isConnected && signalingConnected() && !signalingError() && !_state4.error);
    createEffect(on(() => [socketInstance(), callConnected()], () => {
        const _cleanup24 = untrack(() => {
            const update = () => socketInstance()?.emit('classroom:call-state', { get connected() {
                    return Boolean(callConnected());
                } });
            update();
            socketInstance()?.on('connect', update);
            return () => { socketInstance()?.off('connect', update); };
        });
        if (typeof _cleanup24 === "function")
            onCleanup(_cleanup24);
    }));
    const callStatus = createMemo(() => classroomCallStatus({
        signalingConnected: signalingConnected(),
        localMediaReady: Boolean(_state4.localStream?.getTracks().some(track => track.readyState === 'live')),
        peerPresent: !isConnecting(),
        peerConnecting: _state4.isConnecting,
        peerConnected: _state4.isConnected,
        remoteRole: 'student',
        error: signalingError() || _state4.error
    }));
    const [connectedBannerDismissed, setConnectedBannerDismissed] = createSignal(false);
    createEffect(on(() => [callConnected(), currentSessionId()], () => {
        const _cleanup25 = untrack(() => {
            setConnectedBannerDismissed(false);
            if (!callConnected())
                return;
            const timer = window.setTimeout(() => setConnectedBannerDismissed(true), 3000);
            return () => window.clearTimeout(timer);
        });
        if (typeof _cleanup25 === "function")
            onCleanup(_cleanup25);
    }));
    const localHasVideo = createMemo(() => Boolean(_state4.localStream?.getVideoTracks().some(track => track.readyState === 'live')));
    const remoteHasVideo = createMemo(() => remoteVideoEnabled() && Boolean(_state4.remoteStream?.getVideoTracks().some(track => track.readyState === 'live')));
    // Mock student data (will be replaced with real data)
    const studentData = createMemo(() => studentInfo() || {
        name: 'Student',
        initials: 'ST',
        sessionTime: '10:00AM - 10:25AM',
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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
            await _state4.switchMediaDevices(settings);
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
    createEffect(on(() => [_state4.startLocalStream], () => {
        const _cleanup26 = untrack(() => {
            const initWebRTC = async () => {
                try {
                    await _state4.startLocalStream(true, true, {
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
        if (typeof _cleanup26 === "function")
            onCleanup(_cleanup26);
    }));
    // Attach all streams to all video refs - robust effect with interval checking
    createEffect(on(() => [_state4.localStream, _state4.remoteStream], () => {
        const _cleanup27 = untrack(() => {
            const attachStreams = () => {
                let attached = false;
                if (_state4.localStream) {
                    if (localVideoRef.current && localVideoRef.current.srcObject !== _state4.localStream) {
                        localVideoRef.current.srcObject = _state4.localStream;
                        localVideoRef.current.play().catch(() => { });
                        attached = true;
                    }
                    if (localPipRef.current && localPipRef.current.srcObject !== _state4.localStream) {
                        localPipRef.current.srcObject = _state4.localStream;
                        localPipRef.current.play().catch(() => { });
                        attached = true;
                    }
                    // Update stream ID to force re-render if needed
                    const newLocalId = _state4.localStream.id || Date.now().toString();
                    setLocalStreamId(prev => prev !== newLocalId ? newLocalId : prev);
                }
                if (_state4.remoteStream) {
                    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== _state4.remoteStream) {
                        remoteVideoRef.current.srcObject = _state4.remoteStream;
                        remoteVideoRef.current.play().catch(() => { });
                        attached = true;
                    }
                    if (remotePipRef.current && remotePipRef.current.srcObject !== _state4.remoteStream) {
                        remotePipRef.current.srcObject = _state4.remoteStream;
                        remotePipRef.current.play().catch(() => { });
                        attached = true;
                    }
                    // Update stream ID to force re-render if needed
                    const newRemoteId = _state4.remoteStream.id || Date.now().toString();
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
                const localAttached = !_state4.localStream || (localVideoRef.current?.srcObject === _state4.localStream);
                const remoteAttached = !_state4.remoteStream || (remoteVideoRef.current?.srcObject === _state4.remoteStream && remotePipRef.current?.srcObject === _state4.remoteStream);
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
        if (typeof _cleanup27 === "function")
            onCleanup(_cleanup27);
    }));
    // Detect local speaking using a calibrated noise floor so room noise does not flicker the mic indicator.
    createEffect(on(() => [_state4.localStream], () => {
        const _cleanup28 = untrack(() => {
            if (!_state4.localStream?.getAudioTracks().some(track => track.readyState === 'live'))
                return;
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(_state4.localStream);
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
        if (typeof _cleanup28 === "function")
            onCleanup(_cleanup28);
    }));
    // Handle audio/video toggles
    createEffect(on(() => [isMuted(), _state4.toggleAudio], () => {
        const _cleanup29 = untrack(() => {
            _state4.toggleAudio(!isMuted());
        });
        if (typeof _cleanup29 === "function")
            onCleanup(_cleanup29);
    }));
    createEffect(on(() => [currentSessionId(), isVideoOff(), socketInstance(), _state4.toggleVideo], () => {
        const _cleanup30 = untrack(() => {
            _state4.toggleVideo(!isVideoOff());
            if (currentSessionId() && socketInstance()?.connected) {
                socketInstance().emit('classroom:video-state', { get sessionId() {
                        return currentSessionId();
                    }, get enabled() {
                        return !isVideoOff();
                    } });
            }
        });
        if (typeof _cleanup30 === "function")
            onCleanup(_cleanup30);
    }));
    // Cleanup on unmount
    createEffect(on(() => [_state4.cleanup], () => {
        const _cleanup31 = untrack(() => {
            return () => {
                _state4.cleanup();
            };
        });
        if (typeof _cleanup31 === "function")
            onCleanup(_cleanup31);
    }));
    // Listen for close messages from iframe
    createEffect(on(() => [], () => {
        const _cleanup32 = untrack(() => {
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
        });
        if (typeof _cleanup32 === "function")
            onCleanup(_cleanup32);
    }));
    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // Handle file selection
    const handleFileSelect = (e: Event) => {
        if (!lessonStart.live)
            return;
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file)
            return;
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
        }
        else {
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
    const uploadFile = async (file: File): Promise<{
        url: string;
        type: 'image' | 'file';
    }> => {
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
        if (!lessonStart.live)
            return;
        if ((!message().trim() && !selectedFile()) || !currentSessionId())
            return;
        try {
            const socket = getSocket();
            let fileData: {
                fileUrl?: string;
                fileName?: string;
                fileType?: 'image' | 'file';
                fileSize?: number;
            } = {};
            if (selectedFile()) {
                setIsUploading(true);
                const { url, type } = await uploadFile(selectedFile());
                fileData = {
                    fileUrl: url,
                    get fileName() {
                        return selectedFile().name;
                    },
                    fileType: type,
                    get fileSize() {
                        return selectedFile().size;
                    }
                };
                setIsUploading(false);
            }
            socket.emit('chat:send', {
                get sessionId() {
                    return currentSessionId();
                },
                get text() {
                    return message().trim() || (selectedFile() ? ` ${fileData.fileType === 'image' ? 'image' : 'file'}` : '');
                },
                ...fileData
            });
            // Stop typing indicator when message is sent
            socket.emit('chat:typing', { isTyping: false });
        }
        catch (error) {
            console.error('Failed to send message:', error);
            setIsUploading(false);
        }
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
        if (e.key === 'Enter' && !e.shiftKey) {
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
        const _cleanup33 = untrack(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        if (typeof _cleanup33 === "function")
            onCleanup(_cleanup33);
    }));
    const handleLeaveClassroom = async () => {
        if (await toastConfirm('Are you sure you want to leave the classroom?', 'Leave Classroom')) {
            _state2.route('/schedule');
        }
    };
    const [lessonEndedSent, setLessonEndedSent] = createSignal(false);
    const handleEndLesson = async () => {
        if (lessonEndedSent()) {
            await handleLeaveClassroom();
            return;
        }
        // Send end lesson signal to student (tutor stays in classroom)
        getSocket().emit('session:end-lesson', {
            message: 'The lesson time is over. Thank you for learning with us!'
        });
        setLessonEndedSent(true);
    };
    return (<div class="classroom-container">
      {/* Left Panel - Video & Chat */}
      <div class="classroom-left">
        {/* Header Bar */}
        <div class="classroom-header">
          <div class="classroom-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" style={cssStyle({ height: '32px' })}/>
            <span>FluentXVerse</span>
          </div>
          <div class="classroom-header-actions">
            <div class="classroom-session-info">
              <div class="session-time-display">
                <span class="timer">{formatTime(elapsedTime())}</span>
                <span class="session-date">{studentData().date}</span>
              </div>
            </div>
          </div>
        </div>

        {currentSessionId() && <TutorClassroomIssueReport bookingId={currentSessionId()}/>}
        {!lessonStart.live && <div class="classroom-start-wait" role={signalingError() ? 'alert' : 'status'}>{lessonStart.closed ? lessonStart.message : signalingError() || lessonStart.message}</div>}
        {lessonStart.wrapUp && <div class="classroom-start-wait" role="status">{lessonStart.wrapUpMessage}</div>}

        {/* Video Area */}
        <ClassroomRecordingNotice socket={socketInstance()} provider={mediaProvider()} openRevision={recordingRevision()} onAvailabilityChange={setRecordingAvailable}/>
        <div class="video-section">
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
            if (el && _state4.remoteStream && el.srcObject !== _state4.remoteStream) {
                el.srcObject = _state4.remoteStream;
                el.muted = !audioEnabled();
                el.play().catch(() => { });
            }
        }} autoplay playsinline muted={!audioEnabled()} class="remote-video" style={cssStyle({ get display() {
                return isSwapped() && remoteHasVideo() ? 'block' : 'none';
            } })}/>
            {/* Remote placeholder in main (visible when swapped and no stream) */}
            {isSwapped() && !remoteHasVideo() && (<div class="video-placeholder remote-camera-off">
                <TutorIcon name="fas fa-video-slash camera-off-icon" aria-hidden="true"/>
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
                  {_state1.user?.firstName?.charAt(0) || 'T'}{_state1.user?.lastName?.charAt(0) || ''}
                </div>
                <span class="video-name">{_state1.user?.firstName || 'Tutor'}</span>
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
                  {_state1.user?.firstName?.charAt(0) || 'T'}{_state1.user?.lastName?.charAt(0) || ''}
                </div>
              </div>)}
            {/* Remote video in PiP (visible when not swapped) */}
            <video autoplay playsinline muted={!audioEnabled()} class="remote-video-small" ref={(el) => {
            remotePipRef.current = el;
            if (el && _state4.remoteStream && el.srcObject !== _state4.remoteStream) {
                el.srcObject = _state4.remoteStream;
                el.muted = !audioEnabled();
                el.play().catch(() => { });
            }
        }} style={cssStyle({ get display() {
                return !isSwapped() && remoteHasVideo() ? 'block' : 'none';
            } })}/>
            {/* Remote placeholder in PiP (visible when not swapped and no stream) */}
            {!isSwapped() && !remoteHasVideo() && (<div class="video-placeholder remote-camera-off pip-camera-off" aria-label="No camera">
                <TutorIcon name="fas fa-video-slash camera-off-icon" aria-hidden="true"/>
              </div>)}
          </div>

          {/* Video Controls */}
          <div class="video-controls">
            <button class={`control-btn ${isMuted() ? 'active' : ''}`} onClick={() => setIsMuted(prev => !prev)} disabled={!lessonStart.live} title={isMuted() ? 'Unmute' : 'Mute'}>
              {isMuted() ? (<TutorIcon name="fa-microphone-slash" size={20}/>) : (<TutorIcon name="fa-microphone" size={20}/>)}
            </button>
            <button class={`control-btn ${isVideoOff() ? 'active' : ''}`} onClick={() => setIsVideoOff(prev => !prev)} disabled={!lessonStart.live} title={isVideoOff() ? 'Turn on camera' : 'Turn off camera'}>
              {isVideoOff() ? (<TutorIcon name="fa-video-slash" size={20}/>) : (<TutorIcon name="fa-video" size={20}/>)}
            </button>
            <button class={`control-btn end-call ${lessonEndedSent() ? 'sent' : ''}`} onClick={handleEndLesson} title={lessonEndedSent() ? 'Leave classroom' : 'Notify student lesson is over'}>
              <TutorIcon name="fa-phone-slash" size={20}/>
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <div class="chat-section">
          <div class="chat-header">
            <TutorIcon name="fi fi-sr-comment-alt"/>
            <span>Chat</span>
            <div class="chat-header-actions" aria-label="Chat tools">
              <button type="button" class="chat-tool-btn" title="Classroom history" aria-label="Classroom history" onClick={requestActivityHistory}>
                <TutorIcon name="fi fi-sr-time-past"/>
              </button>
              <button type="button" class="chat-tool-btn" title="Device settings" aria-label="Device settings" onClick={openDeviceSettings}>
                <TutorIcon name="fi fi-sr-settings"/>
              </button>
            </div>
          </div>
          {(isHistoryOpen() || isSettingsOpen()) && (<div class="classroom-chat-popover">
              {isHistoryOpen() && (<TutorDialog label="Classroom history" className="classroom-modal classroom-history-modal" onClose={() => setIsHistoryOpen(false)}>
                  <div class="classroom-modal-header">
                    <div>
                      <h2 id="classroom-history-title">History</h2>
                      <div class="classroom-modal-meta">
                        <span>SID: {currentSessionId()}</span>
                        <span><TutorIcon name="fi fi-sr-calendar"/>{formatActivityDate(activityLogs()[0]?.createdAt)}</span>
                      </div>
                    </div>
                    <button type="button" class="classroom-modal-close" aria-label="Close history" onClick={() => setIsHistoryOpen(false)}>
                      <TutorIcon name="fi fi-sr-cross-small"/>
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
                      <TutorIcon name="fi fi-sr-refresh"/>
                      Refresh
                    </button>
                  </div>
                </TutorDialog>)}

              {isSettingsOpen() && (<TutorDialog label="Classroom settings" className="classroom-modal classroom-settings-modal" onClose={() => setIsSettingsOpen(false)} busy={isApplyingDeviceSettings()}>
                  <div class="classroom-modal-header">
                    <div>
                      <h2 id="classroom-settings-title">Settings</h2>
                      <div class="classroom-modal-meta">
                        <span>Classroom devices</span>
                      </div>
                    </div>
                    <button type="button" class="classroom-modal-close" aria-label="Close settings" onClick={() => setIsSettingsOpen(false)}>
                      <TutorIcon name="fi fi-sr-cross-small"/>
                    </button>
                  </div>

                  {recordingAvailable() && <button type="button" class="classroom-recording-settings" onClick={() => setRecordingRevision(value => value + 1)}><TutorIcon name="fa-shield-alt"/>Recording permission</button>}
                  <div class="classroom-device-fields">
                    <label class="classroom-device-field">
                      <span><TutorIcon name="fi fi-sr-microphone"/>Microphone</span>
                      <select value={selectedAudioDeviceId()} onChange={(event) => setSelectedAudioDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default microphone</option>
                        {audioInputDevices().map((device, index) => (<option value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>))}
                      </select>
                    </label>

                    <label class="classroom-device-field">
                      <span><TutorIcon name="fi fi-sr-video-camera"/>Camera</span>
                      <select value={selectedVideoDeviceId()} onChange={(event) => setSelectedVideoDeviceId((event.currentTarget as HTMLSelectElement).value)}>
                        <option value="">Default camera</option>
                        {videoInputDevices().map((device, index) => (<option value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>))}
                      </select>
                    </label>
                  </div>

                  <div class="classroom-modal-footer">
                    <button type="button" class="classroom-modal-secondary" onClick={loadMediaDevices}>
                      <TutorIcon name="fi fi-sr-refresh"/>
                      Refresh
                    </button>
                    <button type="button" class="classroom-modal-primary" disabled={isApplyingDeviceSettings()} onClick={applyDeviceSettings}>
                      <TutorIcon name="fi fi-sr-check"/>
                      {isApplyingDeviceSettings() ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </TutorDialog>)}
            </div>)}
          <div class="chat-messages">
            {chatMessages().map((msg) => {
            // In tutor app: tutor messages are "self" (right), student messages are "other" (left)
            const isOwnMessage = msg.sender === 'tutor';
            const canManageMessage = isOwnMessage && !msg.correction && msg.id !== 'error';
            const canEditMessage = canManageMessage && shouldShowMessageText(msg);
            const isEditingMessage = editingMessageId() === msg.id;
            return (<div class={`chat-message ${isOwnMessage ? 'self' : 'other'}`}>
                {msg.correction && (<div class="message-correction">
                    <span class="label">You said:</span> {formatMessageText(msg.text)}
                    <br />
                    <span class="label">Correct:</span> {formatMessageText(msg.correction)}
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
                          {/* File/Image attachment */}
                          {msg.fileUrl && msg.fileType === 'image' && (<div class="message-image">
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                <img src={msg.fileUrl} alt={msg.fileName || 'Shared image'}/>
                              </a>
                            </div>)}
                          {msg.fileUrl && msg.fileType === 'file' && (<a href={msg.fileUrl} download={msg.fileName} class="message-file">
                              <TutorIcon name="fa-file-alt" size={20}/>
                              <span class="file-name">{msg.fileName}</span>
                              {msg.fileSize && <span class="file-size">{formatFileSize(msg.fileSize)}</span>}
                            </a>)}
                          {/* Text content with formatting */}
                          {msg.material && msg.sender === 'student' && (<div class="chat-material-share">
                              <strong>{msg.material.title}</strong>
                              <button type="button" onClick={() => openSharedMaterial(msg.material!)}>
                                <TutorIcon name="fas fa-book-open" aria-hidden="true"/>Open Material
                              </button>
                            </div>)}
                          {!msg.material && shouldShowMessageText(msg) && (<span class="message-text">{formatMessageText(msg.text)}</span>)}
                          {msg.isEdited && <span class="message-edited-label">edited</span>}
                        </>)}
                    </div>
                    {canManageMessage && !isEditingMessage && (<div class="message-actions">
                        <button type="button" class="message-more-btn" aria-label="Message actions" title="Message actions" onClick={() => setOpenMessageMenuId(openMessageMenuId() === msg.id ? null : msg.id)}>
                          <span aria-hidden="true">•••</span>
                        </button>
                        {openMessageMenuId() === msg.id && (<div class="message-action-menu">
                            {canEditMessage && (<button type="button" onClick={() => beginEditMessage(msg)}>
                                <TutorIcon name="fi fi-sr-pencil"/>
                                Edit
                              </button>)}
                            <button type="button" class="danger" onClick={() => deleteOwnMessage(msg.id)}>
                              <TutorIcon name="fi fi-sr-trash"/>
                              Delete
                            </button>
                          </div>)}
                      </div>)}
                  </div>)}
                <span class="message-time">{msg.timestamp}</span>
              </div>);
        })}
            {remoteTyping() && (<div class="typing-indicator">
                <span>Student is typing</span>
                <span class="typing-dots">...</span>
              </div>)}
            <div ref={_element => chatEndRef.current = _element}/>
          </div>
          
          {/* File preview */}
          {selectedFile() && (<div class="file-preview-bar">
              {filePreview() ? (<img src={filePreview()} alt="Preview" class="file-preview-thumb"/>) : (<div class="file-preview-icon">
                  <TutorIcon name="fa-file-alt" size={20}/>
                </div>)}
              <span class="file-preview-name">{selectedFile().name}</span>
              <span class="file-preview-size">{formatFileSize(selectedFile().size)}</span>
              <button class="file-preview-remove" onClick={clearSelectedFile}>
                <TutorIcon name="fa-times" size={20}/>
              </button>
            </div>)}
          
          <div class="chat-input-area">
            <input type="file" ref={_element => fileInputRef.current = _element} onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" style={cssStyle({ display: 'none' })}/>
            <button class="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={!lessonStart.live || isUploading()}>
              <TutorIcon name="fa-paperclip" size={20}/>
            </button>
            <textarea placeholder={lessonStart.live ? 'Type a message...' : 'Chat opens at lesson start'} aria-label="Chat message. Press Shift and Enter for a new line." value={message()} onInput={(e) => {
            const newValue = (e.target as HTMLTextAreaElement).value;
            setMessage(newValue);
            // Only show typing if there's actual text
            handleTyping(newValue.trim().length > 0);
        }} onKeyDown={(e) => {
            handleChatInputKeyDown(e as KeyboardEvent);
        }} onBlur={() => handleTyping(false)} disabled={!lessonStart.live || isUploading()} rows={1}/>
            <button class="send-btn" onClick={handleSendMessage} disabled={!lessonStart.live || isUploading()}>
              {isUploading() ? (<span class="upload-spinner"></span>) : (<TutorIcon name="fi fi-sr-paper-plane"/>)}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Learning Materials */}
      <div class="classroom-right">
        <div class="material-topbar">
          <div class="material-header">
            <TutorIcon name="fi fi-sr-book-open-reader"/>
            <span>Learning Material</span>
          </div>
          <div class="material-tabs">
            <button type="button" class={`material-tab ${showLessonRequest() ? 'is-active' : ''}`} onClick={() => setShowLessonRequest(true)}>
              <span class="material-tab-icon" aria-hidden="true">
                <TutorIcon name="fas fa-clipboard-list"/>
              </span>
              <span class="material-tab-copy">
                <span class="material-tab-label">Lesson Selection</span>
                <span class="material-tab-meta">Request and material picker</span>
              </span>
            </button>
            {hasOpenMaterial() && (<button type="button" class={`material-tab ${!showLessonRequest() ? 'is-active' : ''}`} onClick={() => setShowLessonRequest(false)}>
                <span class="material-tab-icon" aria-hidden="true">
                  <TutorIcon name={materialTabIconClass()}/>
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
              <TutorIcon name="fi fi-sr-arrow-left"/>
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
              <TutorIcon name="fi fi-sr-arrow-left"/>
              Go to Selection Tab
            </button>
            <div class="dispatch-view-meta">
              <span class="dispatch-view-category">Level {viewingConversationalLesson().level}</span>
              <span class="dispatch-view-date">
                Chapter {viewingConversationalLesson().chapter} • Lesson {viewingConversationalLesson().lessonNumber}
              </span>
            </div>
          </div>) : isViewingBusinessEnglishMaterial() ? (<div class={`dispatch-view-header business-english-theme business-english-theme--${businessEnglishTheme()}`}>
            <button class="btn-back-to-request" onClick={() => {
                setShowLessonRequest(true);
            }}>
              <TutorIcon name="fi fi-sr-arrow-left"/>
              Go to Selection Tab
            </button>
            <div class="dispatch-view-meta">
              <span class="dispatch-view-category">Business English</span>
              <span class="dispatch-view-date">{businessEnglishHeaderTitle()}</span>
            </div>
          </div>) : null}

        {/* Chosen Material Display or PDF Viewer */}
        <div class={`material-content ${showLessonRequest() ? 'material-content--request' : ''}`}>
          {showLessonRequest() ? (<div class="lesson-request-container lesson-request-container--dispatch">
              {/* Lesson Request Section - always show, even if no material selected */}
              <div class="lesson-request-section">
                <div class="lesson-request-header">
                  <div class="lesson-request-title-wrap">
                    <h2 class="lesson-request-title">
                      <TutorArt name="training" size={32}/>
                      Lesson Request
                    </h2>
                    <p class="lesson-request-subtitle">
                      Review the student's selected lesson and the teaching cues they shared before class begins.
                    </p>
                  </div>
                  <div class="lesson-request-meta">
                    <span class={`lesson-request-status ${studentLessonRequest() ? 'lesson-request-status--ready' : 'lesson-request-status--pending'}`}>
                      {studentLessonRequest() ? 'Material chosen' : 'Awaiting selection'}
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
                          <span class="request-eyebrow">Student brief</span>
                          <span class="request-course-pill">{requestedCourseLabel()}</span>
                        </div>

                        <div class="request-summary-grid">
                          <div class="request-stat-card">
                            <span class="request-detail-label">Previous lesson</span>
                            <span class="request-detail-value request-detail-value--text">{previousLessonLabel()}</span>
                            <span class="request-detail-meta">
                              {studentLessonRequest() && studentLessonRequest().lessonNumber > 1
                ? 'Most recent sequence before this request'
                : 'This is the first lesson in the sequence'}
                            </span>
                          </div>

                          <div class="request-stat-card">
                            <span class="request-detail-label">Current course</span>
                            <span class="request-detail-value request-detail-value--text">{requestedCourseLabel()}</span>
                            <span class="request-detail-meta">
                              {studentLessonRequest() ? 'Course library selected by student' : 'Awaiting student selection'}
                            </span>
                          </div>

                          <div class="request-stat-card request-stat-card--wide">
                            <span class="request-detail-label">Current material chosen</span>
                            <button type="button" class="request-link request-link--material" onClick={handleOpenCurrentMaterial} disabled={!hasCurrentMaterial()}>
                              {currentMaterialTitle()}
                            </button>
                            <span class="request-detail-meta">{currentMaterialMeta()}</span>
                          </div>

                        </div>
                      </div>
                    </div>
                    
                    <div class="student-preferences-sidebar">
                      <div class="student-preferences-header">
                        <span class="preference-kicker">Student setup</span>
                        <h4 class="preference-panel-title">Teaching cues</h4>
                      </div>

                      <div class="preference-list">
                        <div class="preference-row preference-row--camera">
                          <span class="preference-row-icon" aria-hidden="true">
                            <TutorIcon name="fas fa-video"/>
                          </span>
                          <span class="preference-row-copy">
                            <span class="preference-card-label">Camera</span>
                            <span class="preference-card-value">{cameraPreference()}</span>
                          </span>
                        </div>

                        <div class="preference-row preference-row--proficiency">
                          <span class="preference-row-icon" aria-hidden="true">
                            <TutorIcon name="fas fa-signal"/>
                          </span>
                          <span class="preference-row-copy">
                            <span class="preference-card-label">Proficiency</span>
                            <span class="preference-card-value">{proficiencyPreference()}</span>
                          </span>
                        </div>

                        <div class="preference-row preference-row--correction">
                          <span class="preference-row-icon" aria-hidden="true">
                            <TutorIcon name="fas fa-comment-dots"/>
                          </span>
                          <span class="preference-row-copy">
                            <span class="preference-card-label">Error correction</span>
                            <span class="preference-card-value">{correctionPreference()}</span>
                            <span class="preference-card-note">{correctionPreferenceNote()}</span>
                          </span>
                        </div>

                        {studentLessonRequest()?.studentPreferences?.otherRequests && (<div class="preference-row preference-row--other">
                            <span class="preference-row-icon" aria-hidden="true">
                              <TutorIcon name="fas fa-sticky-note"/>
                            </span>
                            <span class="preference-row-copy">
                              <span class="preference-card-label">Other request</span>
                              <span class="preference-card-value">{studentLessonRequest().studentPreferences.otherRequests}</span>
                            </span>
                          </div>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Hierarchical Material Selector */}
              <div class="material-selector-section">
                <div class="material-selector-header">
                  <div class="material-selector-header-icon">
                    <TutorArt name="training" size={32}/>
                  </div>
                  <div class="material-selector-copy">
                    <label class="material-selector-label">Select a Material</label>
                    <p class="material-selector-description">
                      Choose the course library you want to teach from. You can switch materials whenever you need.
                    </p>
                  </div>
                  {studentLessonRequest() && (<span class="material-selector-chip">
                      Requested lesson {studentLessonRequest().lessonNumber}
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
                                  {selectedCourseOption().icon}
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
                            <TutorIcon name={`fas ${isCourseDropdownOpen() ? 'fa-chevron-up' : 'fa-chevron-down'}`}/>
                          </span>
                        </button>

                        {isCourseDropdownOpen() && (<div class="material-selector-menu" role="listbox" aria-label="Course library" style={cssStyle(courseDropdownMenuStyle() || undefined)}>
                            {courses.map(course => (<button type="button" class={`material-selector-option ${selectedCourse() === course.id ? 'is-selected' : ''}`} onClick={() => {
                        setIsCourseDropdownOpen(false);
                        void handleCourseChange(course.id);
                    }} role="option" aria-selected={selectedCourse() === course.id}>
                                <span class="material-selector-option-icon" aria-hidden="true">
                                  {course.icon}
                                </span>
                                <span class="material-selector-option-copy">
                                  <span class="material-selector-option-title">{course.name}</span>
                                  <span class="material-selector-option-description">{course.description}</span>
                                </span>
                                {selectedCourse() === course.id && (<span class="material-selector-option-check" aria-hidden="true">
                                    <TutorIcon name="fas fa-check"/>
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
                      <TutorIcon name="fas fa-arrow-left"/>
                    </div>
                    <div>
                      <p class="material-selector-empty-title">Choose a course to begin</p>
                      <p class="material-selector-empty-copy">
                        After choosing a library, the available levels, chapters, and lessons appear here.
                      </p>
                    </div>
                  </div>)}
                
                {/* Daily Dispatch Card - shows when Daily Dispatch is selected */}
                {showSelectedCourseDetails() && selectedCourse() === 'daily-dispatch' && (<DispatchMaterialPicker onOpen={article => {
                    setViewingDispatchArticle(article);
                    setViewingConversationalLesson(null);
                    setConversationalViewUrl(null);
                    setLessonViewUrl(null);
                    setShowLessonRequest(false);
                }}/>)}
                
                {showSelectedCourseDetails() && selectedCourse() !== 'daily-dispatch' && (<CurriculumMaterialPicker loading={loadingMaterials()} currentId={studentLessonRequest()?.courseId === selectedCourse() ? studentLessonRequest().lessonId : undefined} materials={availableLessons().map(item => ({
                    id: item.id, title: item.title, level: getLevelNumber(item),
                    chapter: getChapterNumber(item), lesson: getLessonNumber(item),
                    goal: item.lessonData?.header?.goalText || ''
                }))} onOpen={item => {
                    if (selectedCourse() === 'conversational-skills') {
                        setViewingDispatchArticle(null);
                        setViewingConversationalLesson({
                            id: item.id, title: item.title, level: item.level,
                            chapter: item.chapter, lessonNumber: item.lesson, goalTextEn: item.goal
                        });
                        setConversationalViewUrl(`/materials/conversational-skills/${item.id}`);
                        setLessonViewUrl(null);
                        setShowLessonRequest(false);
                    }
                    else {
                        void handleApplyMaterial(item.id);
                    }
                }}/>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>) : !showLessonRequest() && viewingDispatchArticle() ? (<iframe src={`/materials/daily-dispatch/${viewingDispatchArticle().id}`} class="dispatch-article-iframe" title={viewingDispatchArticle().title}/>) : !showLessonRequest() && viewingConversationalLesson() && conversationalViewUrl() ? (<iframe src={currentSessionId() ? `${conversationalViewUrl()}${conversationalViewUrl().includes('?') ? '&' : '?'}sessionId=${encodeURIComponent(currentSessionId())}`
                : conversationalViewUrl()} class="dispatch-article-iframe conversational-iframe" title={viewingConversationalLesson().title}/>) : !showLessonRequest() && isViewingBusinessEnglishMaterial() && studentLessonRequest()?.lessonId ? (<div class="lesson-material-view lesson-material-view--business-english">
              {loadingViewUrl() ? (<div class="material-loading">
                  <div class="spinner"></div>
                  <p>Loading lesson...</p>
                </div>) : (<BusinessEnglishPreviewPage lessonId={studentLessonRequest().lessonId} embedded forcedTheme={businessEnglishTheme()} onRequestClose={() => setShowLessonRequest(true)}/>)}
            </div>) : !showLessonRequest() && lessonViewUrl() ? (<div class="lesson-material-view">
              {loadingViewUrl() ? (<div class="material-loading">
                  <div class="spinner"></div>
                  <p>Loading lesson...</p>
                </div>) : lessonViewUrl() ? (<iframe src={materialFrameUrl(lessonViewUrl(), resolvedTheme(), window.location.origin)} class="lesson-material-iframe" title={studentLessonRequest()?.title || 'Lesson Material'}/>) : (<div class="pdf-viewer-container">
                  <PdfViewer socket={socketInstance()} sessionId={currentSessionId()} userType="tutor"/>
                </div>)}
            </div>) : (<div class="pdf-viewer-container">
              <PdfViewer socket={socketInstance()} sessionId={currentSessionId()} userType="tutor"/>
            </div>)}
        </div>
      </div>

      {/* Classroom Notes Floating Button */}
      {showNotesWidgetTrigger() && (<button class={`${notesWidgetFabClassName()} ${showNotesWidget() ? 'active' : ''}`} onClick={() => setShowNotesWidget(!showNotesWidget())} title={notesWidgetFabTitle}>
          <TutorIcon name={showNotesWidget() ? 'fi fi-sr-cross-small' : 'fi fi-sr-pencil'}/>
        </button>)}

      {/* Classroom Notes Widget */}
      {showNotesWidgetTrigger() && showNotesWidget() && (<div class={notesWidgetClassName()}>
          <div class="dispatch-notes-header">
            <h3>
              <TutorIcon name={notesWidgetIconClass()}/>
              {notesWidgetTitle}
            </h3>
            <button class="dispatch-notes-close" onClick={() => setShowNotesWidget(false)}>
              <TutorIcon name="fi fi-sr-cross"/>
            </button>
          </div>

          <div class="lesson-notes-material-picker">
            <label for="notes-material">Material notes</label>
            <select id="notes-material" value={activeNotesTarget() ? `${activeNotesMaterialType()}:${activeNotesMaterialId()}` : ''} disabled={!notesTargets().length} onChange={event => {
                const target = notesTargets().find(item => `${item.materialType}:${item.materialId}` === (event.target as HTMLSelectElement).value);
                if (target)
                    selectNotesMaterial(target);
            }}>
              {!notesTargets().length && <option value="">No material selected</option>}
              {notesTargets().map(target => <option value={`${target.materialType}:${target.materialId}`}>
                {target.materialType === 'daily-dispatch' ? 'Daily Dispatch' : target.materialType === 'business-english' ? 'Business English' : 'Conversational Skills'} - {target.materialTitle || 'Untitled material'}
              </option>)}
            </select>
            <button type="button" disabled={!activeNotesTarget() || activeMaterialUsed() || notesPersistenceState() === 'loading' || notesHydratedKeyRef.current !== activeNotesBindingKey()} onClick={async () => {
                if (!activeNotesTarget() || !activeNotesBindingKey())
                    return;
                const key = activeNotesBindingKey();
                setNotesPersistenceState('saving');
                try {
                    await saveNotesSnapshotToBackend(key, activeNotesTarget(), mergeProps({ get vocabularyItems() {
                            return vocabularyItems();
                        } }, { get grammarItems() {
                            return grammarItems();
                        } }, { get pronunciationItems() {
                            return pronunciationItems();
                        } }, () => materialProgress()), true);
                    if (activeNotesKeyRef.current === key)
                        setNotesPersistenceState('saved');
                }
                catch {
                    if (activeNotesKeyRef.current === key)
                        setNotesPersistenceState('draft');
                    toast.error('Could not mark this material as used');
                }
            }}>
              <TutorIcon name={activeMaterialUsed() ? 'fi fi-sr-check' : 'fi fi-sr-book-alt'} aria-hidden="true"/>
              {activeMaterialUsed() ? 'Used in this lesson' : 'Use in lesson'}
            </button>
          </div>
          <div class="dispatch-notes-content">
            {activeNotesTarget() && <fieldset class="lesson-material-note-fields" disabled={notesPersistenceState() === 'loading' || notesHydratedKeyRef.current !== activeNotesBindingKey()}>
            <MaterialProgressEditor materialType={activeNotesMaterialType()} progress={materialProgress()} context={activeProgressContext()} loading={notesPersistenceState() === 'loading'} onChange={patch => setMaterialProgress(previous => ({ ...previous, ...patch, isUsed: true }))} onRetry={() => {
                    if (activeNotesBindingKey())
                        delete progressContextsRef.current[activeNotesBindingKey()];
                    setProgressRevision(value => value + 1);
                }}/>
            <LearningNotesFields vocabularyItems={vocabularyItems()} grammarItems={grammarItems()} pronunciationItems={pronunciationItems()} addVocabularyItem={addVocabularyItem} updateVocabularyWord={updateVocabularyWord} getVocabularyDefinition={getVocabularyDefinition} removeVocabularyItem={removeVocabularyItem} selectDefinition={selectDefinition} toggleVocabularyDefinition={toggleVocabularyDefinition} toggleVocabularyTranslation={toggleVocabularyTranslation} sendVocabularyToChat={sendVocabularyToChat} addGrammarItem={addGrammarItem} updateYouSaid={updateYouSaid} getGrammarCorrection={getGrammarCorrection} removeGrammarItem={removeGrammarItem} updateGrammarItem={updateGrammarItem} toggleGrammarExplanation={toggleGrammarExplanation} sendGrammarToChat={sendGrammarToChat} addPronunciationItem={addPronunciationItem} updatePronunciationWord={updatePronunciationWord} getPronunciationFromAI={getPronunciationFromAI} removePronunciationItem={removePronunciationItem} togglePronunciationPhonetic={togglePronunciationPhonetic} sendPronunciationToChat={sendPronunciationToChat}/>
            </fieldset>}

            <LessonFeedbackFields studentComment={_state3.studentComment} tutorMemo={_state3.tutorMemo} required feedbackError={_state3.studentComment.trim().length > 0 && _state3.studentComment.trim().length < 100 ? 'Student feedback must contain at least 100 characters.' : ''} handoffError={_state3.tutorMemo.length > 150 ? 'Tutor handoff must not exceed 150 characters.' : ''} setStudentComment={_state3.setStudentComment} setTutorMemo={_state3.setTutorMemo} disabled={!_state3.ready}/>
          </div>
          
          <div class="dispatch-notes-footer">
            <div class={`dispatch-notes-save-state dispatch-notes-save-state--${notesPersistenceState()}`}>
              {notesPersistenceState() === 'loading'
                ? 'Loading saved notes...'
                : notesPersistenceState() === 'saving'
                    ? 'Saving...'
                    : notesPersistenceState() === 'saved'
                        ? 'Draft saved to this lesson'
                        : notesPersistenceState() === 'draft'
                            ? 'Draft kept on this device'
                            : notesPersistenceState() === 'error'
                                ? 'Save unavailable'
                                : 'Notes stay with this lesson'}
            </div>
            <div class={`dispatch-notes-save-state dispatch-notes-save-state--${_state3.saveState}`}>
              Lesson feedback: {_state3.saveState === 'saved' ? 'saved' : _state3.saveState === 'saving' ? 'saving...' : _state3.saveState === 'loading' ? 'loading...' : _state3.saveState === 'error' ? 'unavailable' : _state3.saveState === 'draft' ? 'draft on this device' : 'ready'}
              {(_state3.saveState === 'error' || _state3.saveState === 'draft') && <button type="button" class="lesson-summary-retry" onClick={_state3.retry} title="Retry saving lesson feedback" aria-label="Retry saving lesson feedback"><TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/></button>}
            </div>
            <a href={`/lesson/${encodeURIComponent(_props0["sessionId"] || '')}`} target="_blank" rel="noopener noreferrer" class="lesson-notes-review-link"><TutorIcon name="fi fi-sr-check" aria-hidden="true"/>Review & submit lesson notes</a>
            <button class="dispatch-notes-clear" title="Clear learning notes for this material; keep progress and lesson feedback" disabled={!activeNotesTarget() || notesPersistenceState() === 'loading'} onClick={() => {
                setVocabularyItems([createEmptyVocabularyItem()]);
                setGrammarItems([createEmptyGrammarItem()]);
                setPronunciationItems([createEmptyPronunciationItem()]);
            }}>
              <TutorIcon name="fi fi-sr-trash"/>
              Clear notes
            </button>
            <button class="dispatch-notes-copy" onClick={() => {
                const wordsText = vocabularyItems().filter(item => item.word.trim())
                    .map(item => `• ${item.word}`)
                    .join('\n');
                const vocabText = vocabularyItems().filter(item => item.word.trim())
                    .map(item => `• ${item.word} - ${getLessonVocabularyMeaning(item)}`)
                    .join('\n');
                const grammarText = grammarItems().filter(item => item.youSaid.trim() || item.correct.trim())
                    .map(item => `• "${item.youSaid}" → "${item.correct}"${item.simpleExplanation ? ` (${item.simpleExplanation})` : ''}`)
                    .join('\n');
                const pronunciationText = pronunciationItems().filter(item => item.word.trim() || item.phonetic)
                    .map(item => `• ${item.word} - [${item.phonetic}]`)
                    .join('\n');
                const progressText = materialProgress().completionStatus === 'completed' ? 'Completed' : `In progress\nStopped at: ${materialProgress().stoppedAtLabel || '(not recorded)'}${materialProgress().progressDetails.trim() ? `\n${materialProgress().progressDetails.trim()}` : ''}`;
                const notes = `Material used: ${activeNotesTarget()?.materialTitle || '(not set)'}\n${progressText}\n\n${lessonNotesLabels.words}:\n${wordsText || '(none)'}\n\n${lessonNotesLabels.vocabulary}:\n${vocabText || '(none)'}\n\n${lessonNotesLabels.grammar}:\n${grammarText || '(none)'}\n\n${lessonNotesLabels.pronunciation}:\n${pronunciationText || '(none)'}\n\n${lessonNotesLabels.studentFeedback}:\n${_state3.studentComment.trim() || '(none)'}\n\n${lessonNotesLabels.tutorHandoff}:\n${_state3.tutorMemo.trim() || '(none)'}`;
                navigator.clipboard.writeText(notes);
                toast.success('Notes copied to clipboard!');
            }}>
              <TutorIcon name="fi fi-sr-clipboard"/>
              Copy Notes
            </button>
          </div>
        </div>)}

    </div>);
};
export default ClassroomPage;

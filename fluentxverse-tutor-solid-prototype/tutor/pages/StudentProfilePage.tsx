import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import { useLocation } from "../routing";
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import LessonNotesCard from '../Components/LessonNotesCard';
import LessonMaterialRequest from '../Components/LessonMaterialRequest';
import { TutorLessonIssueReportDialog, type TroubleDuration, type TroubleReason, type TutorStudentIssue } from '../Components/TutorLessonIssueReportDialog';
import { useAuthContext } from '../context/AuthContext';
import { useNotificationStore } from '../context/NotificationContext';
import { API_BASE_URL } from '../config/api';
import { canJoinClassroom } from '../utils/classroomWindow';
import './StudentProfilePage.css';
interface StudentProfilePageProps {
    studentId?: string;
    bookingId?: string;
}
interface LevelAssessment {
    studentLevel?: string;
    curriculum?: string;
    dateAssessed?: string;
    assessedBy?: string;
    remarks?: string[];
    scores?: {
        comprehension?: number | null;
        pronunciation?: number | null;
        grammar?: number | null;
        maxScore?: number | null;
    };
}
interface LessonPreferences {
    preferCameraOn: boolean;
    errorCorrection: 'during_feedback' | 'proactively' | 'tutor_choice';
    otherRequests: string;
}
interface ChatLogMessage {
    id: string;
    senderType: 'tutor' | 'student';
    text: string;
    correction?: string | null;
    timestamp: string;
    isEdited: boolean;
}
interface TroubleReportStatus {
    startsAt: string;
    endsAt: string;
    serverNow: string;
    report: {
        id: string;
        createdAt: string;
        studentIssueLabel?: string | null;
        status?: string;
        resolution?: string;
        attendanceCorrection?: string | null;
        ticketTransactionId?: string | null;
    } | null;
    studentReport?: {
        id: string;
        duration: TroubleDuration;
        reason: string;
        details: string;
        tutorIssueLabel?: string | null;
        createdAt: string;
        status: string;
        resolution: string;
    } | null;
}
const LessonReportOutcome = (_props0: {
    id?: string;
    title: string;
    report: {
        status?: string;
        studentIssueLabel?: string | null;
        tutorIssueLabel?: string | null;
        reason?: string;
        duration?: TroubleDuration;
        details?: string;
        resolution?: string;
        attendanceCorrection?: string | null;
        ticketTransactionId?: string | null;
    };
    received?: boolean;
}) => {
    const status = createMemo(() => _props0["report"].status === 'resolved' ? 'resolved' : _props0["report"].status === 'under_review' ? 'under_review' : 'submitted');
    const issue = createMemo(() => _props0["report"].studentIssueLabel || _props0["report"].tutorIssueLabel || _props0["report"].reason);
    return (<section id={_props0["id"]} class={`lesson-report-outcome${(_props0["received"] === undefined ? false : _props0["received"]) ? ' student-report-received' : ''}`} aria-label={_props0["title"]}>
      <header class="lesson-report-header">
        <h2><span class="lesson-section-icon"><TutorArt name="community" size={32}/></span>{_props0["title"]}</h2>
        <span class={`lesson-report-status lesson-report-status--${status()}`}>
          <TutorIcon name={`fi ${status() === 'resolved' ? 'fi-sr-check' : 'fi-sr-clock'}`} aria-hidden="true"/>
          {status() === 'resolved' ? 'Resolved' : status() === 'under_review' ? 'Under review' : 'Submitted'}
        </span>
      </header>
      {issue() && <p class="lesson-report-issue">{issue()}</p>}
      <dl class="lesson-report-fields">
        {_props0["report"].reason && _props0["report"].reason !== issue() && <div><dt>Category</dt><dd>{_props0["report"].reason}</dd></div>}
        {_props0["report"].duration && <div><dt>Duration</dt><dd>{_props0["report"].duration === 'up_to_ten' ? 'Up to 10 minutes' : 'Over 10 minutes'}</dd></div>}
        {_props0["report"].details && <div><dt>Details</dt><dd>{_props0["report"].details}</dd></div>}
        {_props0["report"].resolution && <div><dt>Resolution</dt><dd>{_props0["report"].resolution}</dd></div>}
        {_props0["report"].attendanceCorrection && <div><dt>Student attendance corrected</dt><dd>{_props0["report"].attendanceCorrection}</dd></div>}
        {_props0["report"].ticketTransactionId && <div><dt>Ticket refund reference</dt><dd>{_props0["report"].ticketTransactionId}</dd></div>}
      </dl>
    </section>);
};
const correctionLabels: Record<LessonPreferences['errorCorrection'], string> = {
    during_feedback: 'During feedback',
    proactively: 'Proactively',
    tutor_choice: "Tutor's choice"
};
const correctionDescriptions: Record<LessonPreferences['errorCorrection'], string> = {
    during_feedback: 'Corrections are saved for the end-of-lesson review.',
    proactively: 'Corrections happen as you move through the lesson.',
    tutor_choice: 'Your tutor chooses the best timing for corrections.'
};
const englishLevelLabels = [
    'Just starting', 'Simple introductions', 'Everyday basics', 'Short conversations',
    'Getting comfortable', 'Sharing experiences', 'Confident conversations',
    'Clear and independent', 'Fluent for work or study', 'Near-native ease'
];
const formatEnglishLevel = (value?: string) => {
    if (!value)
        return 'Not provided';
    const match = /^Level (10|[1-9])$/.exec(value);
    return match ? `${value} - ${englishLevelLabels[Number(match[1]) - 1]}` : `${value} (previous scale)`;
};
const StudentProfilePage = (_props1: StudentProfilePageProps) => {
    const _state2 = useAuthContext();
    const _state3 = useLocation();
    // Extract bookingId or studentId from URL path
    const bookingId = createMemo(() => _props1["bookingId"] || _state3.path.split('/lesson/')[1]);
    const studentId = createMemo(() => _props1["studentId"] || _state3.path.split('/student/')[1]);
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            document.title = 'Student Profile | FluentXVerse';
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const [showHeadsetModal, setShowHeadsetModal] = createSignal(false);
    const [showReportModal, setShowReportModal] = createSignal(false);
    const [reportDuration, setReportDuration] = createSignal<TroubleDuration | null>(null);
    const [reportReason, setReportReason] = createSignal<TroubleReason | null>(null);
    const [reportStudentIssue, setReportStudentIssue] = createSignal<TutorStudentIssue | null>(null);
    const [reportSubmitting, setReportSubmitting] = createSignal(false);
    const [reportSubmitError, setReportSubmitError] = createSignal<string | null>(null);
    const [reportStatus, setReportStatus] = createSignal<TroubleReportStatus | null>(null);
    const [reportStatusError, setReportStatusError] = createSignal<string | null>(null);
    const [reportStatusLoading, setReportStatusLoading] = createSignal(false);
    const [reportRevision, setReportRevision] = createSignal(0);
    const receivedNotification = createMemo(() => useNotificationStore(state => state.notifications.find(notification => notification.title === 'Lesson report received' && notification.data?.bookingId === bookingId())?.id));
    const [reportClockOffset, setReportClockOffset] = createSignal(0);
    const [reportNow, setReportNow] = createSignal(Date.now());
    const [showChatLog, setShowChatLog] = createSignal(false);
    const [chatLog, setChatLog] = createSignal<ChatLogMessage[]>([]);
    const [chatLogLoading, setChatLogLoading] = createSignal(false);
    const [chatLogError, setChatLogError] = createSignal<string | null>(null);
    const [showAssessmentResults, setShowAssessmentResults] = createSignal(false);
    const [micPermission, setMicPermission] = createSignal<'pending' | 'granted' | 'denied'>('pending');
    const [micLevel, setMicLevel] = createSignal(0);
    const [isPlayingLeft, setIsPlayingLeft] = createSignal(false);
    const [isPlayingRight, setIsPlayingRight] = createSignal(false);
    const [camPermission, setCamPermission] = createSignal<'pending' | 'granted' | 'denied'>('pending');
    const cameraStreamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const videoRef = { current: null } as {
        current: (HTMLVideoElement | null) | null;
    };
    const audioContextRef = { current: null } as {
        current: (AudioContext | null) | null;
    };
    const analyserRef = { current: null } as {
        current: (AnalyserNode | null) | null;
    };
    const micStreamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const animationFrameRef = { current: null } as {
        current: (number | null) | null;
    };
    // Student data state
    const [studentData, setStudentData] = createSignal<any>(null);
    const [lessonData, setLessonData] = createSignal<any>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    createEffect(on(() => [], () => {
        const _cleanup5 = untrack(() => {
            const timer = window.setInterval(() => setReportNow(Date.now()), 1000);
            return () => window.clearInterval(timer);
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [lessonData()?.bookingId, reportRevision(), receivedNotification()], () => {
        const _cleanup6 = untrack(() => {
            if (!lessonData()?.bookingId)
                return;
            const controller = new AbortController();
            setReportStatusLoading(true);
            setReportStatusError(null);
            fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(lessonData().bookingId)}/trouble-report`, {
                credentials: 'include',
                cache: 'no-store',
                signal: controller.signal
            })
                .then(async (response) => {
                const result = await response.json();
                if (!response.ok || !result.success)
                    throw new Error(result.error || 'Unable to check reporting window');
                setReportClockOffset(Date.parse(result.data.serverNow) - Date.now());
                setReportStatus(result.data);
            })
                .catch(err => {
                if (!controller.signal.aborted)
                    setReportStatusError(err.message || 'Unable to check reporting window');
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setReportStatusLoading(false);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    createEffect(on(() => [lessonData()?.bookingId], () => {
        const _cleanup7 = untrack(() => {
            setReportStatus(null);
            if (!lessonData()?.bookingId)
                return;
            const refresh = () => {
                if (!document.hidden)
                    setReportRevision(value => value + 1);
            };
            const timer = window.setInterval(refresh, 10000);
            window.addEventListener('focus', refresh);
            return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    const reportWindowOpen = createMemo(() => Boolean(reportStatus() && !reportStatus().report && lessonData()?.status !== 'cancelled' &&
        reportNow() + reportClockOffset() >= Date.parse(reportStatus().startsAt) &&
        reportNow() + reportClockOffset() < Date.parse(reportStatus().endsAt)));
    const canEnterClassroom = createMemo(() => Boolean(reportStatus() && canJoinClassroom(lessonData()?.status || '', Date.parse(reportStatus().startsAt), Date.parse(reportStatus().endsAt), reportNow() + reportClockOffset())));
    const closeReportModal = () => {
        if (!reportSubmitting())
            setShowReportModal(false);
    };
    const submitTroubleReport = async () => {
        if (!bookingId() || !reportDuration() || !reportReason() || (reportReason() === 'student' && !reportStudentIssue()) || !reportWindowOpen() || reportSubmitting())
            return;
        setReportSubmitting(true);
        setReportSubmitError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(bookingId())}/trouble-report`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                get body() {
                    return JSON.stringify({ get duration() {
                            return reportDuration();
                        }, get reason() {
                            return reportReason();
                        }, get studentIssue() {
                            return reportReason() === 'student' ? reportStudentIssue() : undefined;
                        } });
                }
            });
            const result = await response.json();
            if (!response.ok || !result.success)
                throw new Error(result.error || 'Could not submit the report');
            setReportStatus(current => current ? { ...current, report: result.data } : current);
            setShowReportModal(false);
        }
        catch (err: any) {
            setReportSubmitError(err.message || 'Could not submit the report');
            setReportRevision(value => value + 1);
        }
        finally {
            setReportSubmitting(false);
        }
    };
    createEffect(on(() => [showReportModal(), reportSubmitting()], () => {
        const _cleanup8 = untrack(() => {
            if (!showReportModal())
                return;
            const closeOnEscape = (event: KeyboardEvent) => {
                if (event.key === 'Escape')
                    closeReportModal();
            };
            window.addEventListener('keydown', closeOnEscape);
            return () => window.removeEventListener('keydown', closeOnEscape);
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    createEffect(on(() => [showChatLog(), bookingId()], () => {
        const _cleanup9 = untrack(() => {
            if (!showChatLog() || !bookingId())
                return;
            const controller = new AbortController();
            setChatLogLoading(true);
            setChatLogError(null);
            fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(bookingId())}/chat-log`, {
                credentials: 'include',
                signal: controller.signal
            })
                .then(async (response) => {
                const result = await response.json();
                if (!response.ok || !result.success)
                    throw new Error(result.error || 'Failed to load chat log');
                setChatLog(result.data);
            })
                .catch(err => {
                if (!controller.signal.aborted)
                    setChatLogError(err.message || 'Failed to load chat log');
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setChatLogLoading(false);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    createEffect(on(() => [showChatLog()], () => {
        const _cleanup10 = untrack(() => {
            if (!showChatLog())
                return;
            const closeOnEscape = (event: KeyboardEvent) => {
                if (event.key === 'Escape')
                    setShowChatLog(false);
            };
            window.addEventListener('keydown', closeOnEscape);
            return () => window.removeEventListener('keydown', closeOnEscape);
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    // Fetch student data (either from bookingId or studentId)
    createEffect(on(() => [bookingId(), studentId()], () => {
        const _cleanup11 = untrack(() => {
            const fetchData = async () => {
                setShowAssessmentResults(false);
                // If we have a bookingId, first fetch lesson details to get student info
                if (bookingId()) {
                    try {
                        setLoading(true);
                        const lessonUrl = `${API_BASE_URL}/schedule/tutor-lesson/${bookingId()}`;
                        const lessonResponse = await fetch(lessonUrl, {
                            credentials: 'include'
                        });
                        const lessonResult = await lessonResponse.json();
                        if (lessonResult.success && lessonResult.data) {
                            setLessonData(lessonResult.data);
                            // Now fetch full student profile using the studentId from lesson
                            const studentUrl = `${API_BASE_URL}/tutor/student/${lessonResult.data.studentId}`;
                            const studentResponse = await fetch(studentUrl, {
                                credentials: 'include'
                            });
                            const studentResult = await studentResponse.json();
                            if (studentResult.success && studentResult.data) {
                                setStudentData(studentResult.data);
                            }
                            else {
                                setError(studentResult.error || 'Failed to load student data');
                            }
                        }
                        else {
                            setError(lessonResult.error || 'Failed to load lesson details');
                        }
                    }
                    catch (err) {
                        console.error('[StudentProfile] Error fetching data:', err);
                        setError('Failed to load lesson data');
                    }
                    finally {
                        setLoading(false);
                    }
                    return;
                }
                // Fallback: fetch by studentId if no bookingId
                if (!studentId()) {
                    setLoading(false);
                    return;
                }
                try {
                    setLoading(true);
                    const url = `${API_BASE_URL}/tutor/student/${studentId()}`;
                    const response = await fetch(url, {
                        credentials: 'include'
                    });
                    const result = await response.json();
                    if (result.success && result.data) {
                        setStudentData(result.data);
                    }
                    else {
                        console.error('[StudentProfile] Failed to load student data:', result.error);
                        setError(result.error || 'Failed to load student data');
                    }
                }
                catch (err) {
                    console.error('[StudentProfile] Error fetching student data:', err);
                    setError('Failed to load student profile');
                }
                finally {
                    setLoading(false);
                }
            };
            fetchData();
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    const openHeadsetModal = async () => {
        setShowHeadsetModal(true);
    };
    // Check if we're on a secure context (HTTPS or localhost)
    const isSecureContext = typeof window !== 'undefined' && (window.isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    // Error message for insecure context
    const [micError, setMicError] = createSignal<string | null>(null);
    const [camError, setCamError] = createSignal<string | null>(null);
    // Separate function to request mic permission (triggered by button click)
    const requestMicPermission = async () => {
        setMicPermission('pending');
        setMicError(null);
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setMicError('Camera/Mic access requires HTTPS. On mobile Chrome, go to chrome://flags and enable "Insecure origins treated as secure", then add your LAN URL.');
            setMicPermission('denied');
            return;
        }
        try {
            // Request audio permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            setMicPermission('granted');
            // Set up audio analysis for mic level - resume AudioContext for mobile
            audioContextRef.current = new AudioContext();
            // Resume AudioContext (required for mobile browsers)
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
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
        }
        catch (err: any) {
            console.error('Mic permission error:', err);
            if (err.name === 'NotAllowedError') {
                setMicError('Permission denied. Please allow microphone access in your browser settings.');
            }
            else if (err.name === 'NotFoundError') {
                setMicError('No microphone found. Please connect a microphone and try again.');
            }
            else if (err.name === 'NotReadableError') {
                setMicError('Microphone is in use by another app. Please close other apps using the mic.');
            }
            else if (err.name === 'SecurityError' || err.message?.includes('secure')) {
                setMicError('HTTPS required. On mobile Chrome: go to chrome://flags → "Insecure origins treated as secure" → add http://192.168.0.102:5173');
            }
            else {
                setMicError(`Error: ${err.message || 'Unable to access microphone'}`);
            }
            setMicPermission('denied');
        }
    };
    // Separate function to request camera permission (triggered by button click)
    const requestCameraPermission = async () => {
        setCamPermission('pending');
        setCamError(null);
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCamError('Camera/Mic access requires HTTPS. On mobile Chrome, go to chrome://flags and enable "Insecure origins treated as secure", then add your LAN URL.');
            setCamPermission('denied');
            return;
        }
        try {
            const cam = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 360 },
                    facingMode: 'user' // Front camera on mobile
                }
            });
            cameraStreamRef.current = cam;
            setCamPermission('granted');
            // Small delay to ensure video element is ready
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = cam;
                    videoRef.current.play().catch(() => { });
                }
            }, 100);
        }
        catch (err: any) {
            console.error('Camera permission error:', err);
            if (err.name === 'NotAllowedError') {
                setCamError('Permission denied. Please allow camera access in your browser settings.');
            }
            else if (err.name === 'NotFoundError') {
                setCamError('No camera found. Please connect a camera and try again.');
            }
            else if (err.name === 'NotReadableError') {
                setCamError('Camera is in use by another app. Please close other apps using the camera.');
            }
            else if (err.name === 'SecurityError' || err.message?.includes('secure')) {
                setCamError('HTTPS required. On mobile Chrome: go to chrome://flags → "Insecure origins treated as secure" → add http://192.168.0.102:5173');
            }
            else {
                setCamError(`Error: ${err.message || 'Unable to access camera'}`);
            }
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
        if (channel === 'left')
            setIsPlayingLeft(true);
        else
            setIsPlayingRight(true);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 1);
        setTimeout(() => {
            if (channel === 'left')
                setIsPlayingLeft(false);
            else
                setIsPlayingRight(false);
            ctx.close();
        }, 1000);
    };
    createEffect(on(() => [], () => {
        const _cleanup12 = untrack(() => {
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
        });
        if (typeof _cleanup12 === "function")
            onCleanup(_cleanup12);
    }));
    return createMemo(() => {
        // Show loading state
        if (loading()) {
            return (<>
        <SideBar />
        <div class="main-content">
          <DashboardHeader user={_state2.user || undefined}/>
          <div class="student-profile-state">
            <p>Loading student profile...</p>
          </div>
        </div>
      </>);
        }
        // Show error state
        if (error() || !studentData()) {
            return (<>
        <SideBar />
        <div class="main-content">
          <DashboardHeader user={_state2.user || undefined}/>
          <div class="student-profile-state error">
            <p>{error() || 'Student not found'}</p>
          </div>
        </div>
      </>);
        }
        // Use real student data from API
        const formatJoinDate = (date: string | undefined) => {
            if (!date)
                return 'N/A';
            try {
                const parsed = new Date(date);
                if (isNaN(parsed.getTime()))
                    return 'N/A';
                return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            catch {
                return 'N/A';
            }
        };
        const displayData = {
            id: studentData().id || 'N/A',
            name: studentData().fullName || `${studentData().givenName || ''} ${studentData().familyName || ''}`.trim() || 'Unknown Student',
            initials: studentData().initials || (studentData().givenName?.[0] || 'S') + (studentData().familyName?.[0] || 'T'),
            nationality: studentData().country || 'Not specified',
            joinDate: formatJoinDate(studentData().joinDate),
            totalLessons: studentData().totalLessons || 0,
            attendance: studentData().attendance || 0
        };
        const assessment = createMemo(() => studentData().levelAssessment as LevelAssessment | null | undefined);
        const assessmentScores = createMemo(() => assessment()?.scores);
        const assessmentRemarks = createMemo(() => (assessment()?.remarks || []).map(remark => remark.trim()).filter(Boolean));
        const hasAssessmentDetails = createMemo(() => Boolean(assessmentRemarks().length || assessmentScores()?.comprehension != null || assessmentScores()?.pronunciation != null || assessmentScores()?.grammar != null));
        const hobbies = createMemo(() => Array.isArray(studentData().hobbies) ? studentData().hobbies.filter((hobby: unknown): hobby is string => typeof hobby === 'string' && Boolean(hobby.trim())) : []);
        const preferences = createMemo(() => (studentData().lessonPreferences || {
            preferCameraOn: true,
            errorCorrection: 'tutor_choice',
            otherRequests: ''
        }) as LessonPreferences);
        return (<div class="student-profile-page">
      <SideBar />
      
      <div class="student-profile-content">
        <DashboardHeader user={_state2.user || undefined}/>
        
        <div class="student-profile-main">
          {/* Back Button */}
          <button class="back-button" onClick={() => window.location.href = '/schedule'}>
            <TutorIcon name="fi fi-sr-arrow-left"/>
            Back to Schedule
          </button>

          {/* Lesson Info Card - Only shown when accessed via /lesson/:bookingId */}
          {lessonData() && (<div class="lesson-info-card">
              <div class="lesson-info-header">
                <TutorArt name="schedule" size={40}/>
                <h2>Scheduled Lesson</h2>
              </div>
              <div class="lesson-info-details">
                <div class="lesson-info-item">
                  <TutorIcon name="fi fi-sr-calendar"/>
                  <span>{new Date(lessonData().slotDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="lesson-info-item">
                  <TutorIcon name="fi fi-sr-clock"/>
                  <span>{lessonData().slotTime} PHT</span>
                </div>
                <div class="lesson-info-item">
                  <TutorIcon name="fi fi-sr-hourglass-end"/>
                  <span>{lessonData().durationMinutes} minutes</span>
                </div>
              </div>
            </div>)}

          {/* Profile Header Card */}
          <div class="profile-header-card">
            <div class="profile-header-content">
              {/* Profile Photo */}
              <div class="profile-photo-container">
                <div class="profile-avatar">
                  {displayData.initials}
                </div>
              </div>

              {/* Profile Info */}
              <div class="profile-info">
                <span class="profile-eyebrow">Student</span>
                <div class="profile-name-row">
                  <h1 class="profile-name">{displayData.name}</h1>
                  <span class="profile-id-badge">{displayData.id}</span>
                </div>

                <div class="contact-info-grid">
                  <div class="contact-info-item">
                    <TutorIcon name="fi fi-sr-globe"/>
                    <span>{displayData.nationality}</span>
                  </div>
                  <div class="contact-info-item">
                    <TutorIcon name="fi fi-sr-calendar"/>
                    <span>Registered {displayData.joinDate}</span>
                  </div>
                </div>

                {/* Stats */}
                <div class="stats-container">
                  <div class="stat-card blue">
                    <div class="stat-value">{displayData.totalLessons}</div>
                    <div class="stat-label">Total Lessons</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Right side */}
              <div class="profile-action-buttons">
                {lessonData() ? (<button type="button" class="enter-classroom-btn" disabled={!canEnterClassroom()} onClick={() => {
                    if (!canEnterClassroom())
                        return;
                    window.open(`/classroom/${lessonData().sessionId || bookingId()}`, '_blank', 'noopener,noreferrer');
                }} title={canEnterClassroom() ? 'Enter the classroom in a new tab' : 'The classroom opens five minutes before the lesson and closes three minutes after it ends.'}>
                    <TutorIcon name="fi fi-sr-video-camera" aria-hidden="true"/>
                    <span>Enter Classroom</span>
                  </button>) : (<button class="enter-classroom-btn" onClick={() => {
                    // Navigate to schedule to see booked sessions with this student
                    window.location.href = '/schedule';
                }} title="View your schedule to enter a classroom session">
                    <TutorIcon name="fi fi-sr-calendar"/>
                    <span>View Sessions</span>
                  </button>)}
                <button class="test-headset-btn" onClick={openHeadsetModal}>
                  <TutorIcon name="fi fi-sr-headset"/>
                  <span>Test Headset</span>
                </button>
                {lessonData() && (<button type="button" class="open-chatlog-btn" onClick={() => setShowChatLog(true)}>
                    <TutorIcon name="fi fi-sr-comments" aria-hidden="true"/>
                    <span>Open Chatlog</span>
                  </button>)}
                {lessonData() && (<button type="button" class={`lesson-issue-report-btn${reportStatus()?.studentReport ? ' report-received' : ''}`} disabled={!reportStatus()?.studentReport && (!reportWindowOpen() || reportStatusLoading())} title={reportStatus()?.studentReport ? 'View the issue reported by the student' : reportStatusError() || (reportStatus()?.report ? 'An issue has already been reported for this lesson' : 'Available only during the scheduled lesson')} onClick={() => {
                    if (reportStatus()?.studentReport) {
                        document.getElementById('student-lesson-report')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                        return;
                    }
                    setReportDuration(null);
                    setReportReason(null);
                    setReportStudentIssue(null);
                    setReportSubmitError(null);
                    setShowReportModal(true);
                }}>
                    <TutorIcon name="fi fi-sr-exclamation" aria-hidden="true"/>
                    <span>{reportStatus()?.studentReport ? 'Report Received' : reportStatus()?.report ? 'Issue Reported' : 'Report Issue'}</span>
                  </button>)}
              </div>
            </div>
          </div>

          {reportStatus()?.report && <LessonReportOutcome title="Lesson issue report" report={reportStatus().report}/>}
          {reportStatus()?.studentReport && <LessonReportOutcome id="student-lesson-report" title="Student report received" report={reportStatus().studentReport} received/>}
          <section class="learner-profile-card" aria-labelledby="learner-profile-title">
            <h2 id="learner-profile-title" class="learner-profile-title"><span class="lesson-section-icon"><TutorArt name="training" size={32}/></span>Learning profile</h2>
            <div class="learner-profile-grid">
              <div class="learner-profile-field">
                <span class="learner-profile-label"><TutorIcon name="fi fi-sr-signal-alt" aria-hidden="true"/>Self-assessed English level</span>
                <strong>{formatEnglishLevel(studentData().currentProficiency)}</strong>
                <span class="learner-profile-note">Chosen by the student</span>
              </div>
              <div class="learner-profile-field learner-profile-assessment">
                <span class="learner-profile-label"><TutorIcon name="fi fi-sr-chart-histogram" aria-hidden="true"/>Level assessment</span>
                {assessment() ? (<>
                    <strong>{assessment().studentLevel ? formatEnglishLevel(assessment().studentLevel) : 'Level not recorded'}</strong>
                    <span class="learner-profile-note">{[assessment().curriculum, assessment().dateAssessed && `Assessed ${formatJoinDate(assessment().dateAssessed)}`, assessment().assessedBy && `By ${assessment().assessedBy}`].filter(Boolean).join(' · ') || 'Recorded by an assessor'}</span>
                  </>) : <strong>None yet</strong>}
              </div>
            </div>
            {assessment() && hasAssessmentDetails() && (<>
                <div id="assessment-results" class="assessment-results" hidden={!showAssessmentResults()}>
                  {assessmentScores() && (['comprehension', 'pronunciation', 'grammar'] as const).some(skill => assessmentScores()[skill] != null) && (<div class="assessment-results-scores">
                      {(['comprehension', 'pronunciation', 'grammar'] as const).map(skill => assessmentScores()[skill] != null && (<div class="assessment-results-score">
                          <span>{skill}</span>
                          <strong>{assessmentScores()[skill]}{assessmentScores().maxScore ? ` / ${assessmentScores().maxScore}` : ''}</strong>
                        </div>))}
                    </div>)}
                  {assessmentRemarks().length > 0 && (<div class="assessment-results-remarks">
                      <h3>Assessment remarks</h3>
                      <ul>{assessmentRemarks().map((remark, index) => <li>{remark}</li>)}</ul>
                    </div>)}
                  {assessment().assessedBy && <p class="assessment-results-assessor">Assessment conducted by <strong>{assessment().assessedBy}</strong></p>}
                </div>
                <div class="assessment-results-action">
                  <button type="button" class="assessment-results-toggle" aria-expanded={showAssessmentResults()} aria-controls="assessment-results" onClick={() => setShowAssessmentResults(value => !value)}>
                    {showAssessmentResults() ? 'Hide assessment results' : 'View assessment results'}
                    <TutorIcon name={`fi fi-sr-angle-small-${showAssessmentResults() ? 'up' : 'down'}`} aria-hidden="true"/>
                  </button>
                </div>
              </>)}
          </section>

          {lessonData() && (<aside class="lesson-recording-notice" aria-label="Lesson recording notice">
              <TutorIcon name="fi fi-sr-info" aria-hidden="true"/>
              <p><strong>Recording notice:</strong> Lessons may be recorded to review teaching quality and maintain service standards. Recordings are handled confidentially and used only for quality assurance and compliance reviews.</p>
            </aside>)}

          <section class="lesson-context" aria-labelledby="lesson-context-title">
            <div class="lesson-context-heading">
              <h2 id="lesson-context-title"><span class="lesson-section-icon"><TutorArt name="community" size={32}/></span>Student context</h2>
              <a href="/materials" class="lesson-materials-link">
                <TutorIcon name="fi fi-sr-book" aria-hidden="true"/>
                Browse materials
                <TutorIcon name="fi fi-sr-arrow-right" aria-hidden="true"/>
              </a>
            </div>
            <div class="lesson-context-columns">
              <div class="lesson-context-column">
                <h3><TutorIcon name="fi fi-sr-user" aria-hidden="true"/>About me</h3>
                {studentData().bio && <p class="lesson-context-bio">{studentData().bio}</p>}
                <div class="lesson-context-field"><span><TutorIcon name="fi fi-sr-target" aria-hidden="true"/>Purpose</span><strong>{studentData().purpose || 'Not set'}</strong></div>
                <div class="lesson-context-field"><span><TutorIcon name="fi fi-sr-briefcase" aria-hidden="true"/>Occupation</span><strong>{studentData().occupation || 'Not set'}</strong></div>
                <div class="lesson-context-field">
                  <span><TutorIcon name="fi fi-sr-heart" aria-hidden="true"/>Hobbies</span>
                  {hobbies().length ? <div class="lesson-context-hobbies">{hobbies().map((hobby: string) => <strong>{hobby}</strong>)}</div> : <strong>Not set</strong>}
                </div>
              </div>
              <div class="lesson-context-column">
                <h3><TutorIcon name="fi fi-sr-settings-sliders" aria-hidden="true"/>Lesson preferences</h3>
                <div class="lesson-context-field"><span><TutorIcon name="fi fi-sr-video-camera" aria-hidden="true"/>Session setup</span><strong>{preferences().preferCameraOn ? 'Prefer camera on' : 'Start audio-first'}</strong></div>
                <div class="lesson-context-field">
                  <span><TutorIcon name="fi fi-sr-comment-alt" aria-hidden="true"/>Correction style</span>
                  <strong>{correctionLabels[preferences().errorCorrection] || correctionLabels.tutor_choice}</strong>
                  <small>{correctionDescriptions[preferences().errorCorrection] || correctionDescriptions.tutor_choice}</small>
                </div>
                <div class="lesson-context-field"><span><TutorIcon name="fi fi-sr-bookmark" aria-hidden="true"/>Other requests</span><strong>{preferences().otherRequests || 'None added'}</strong></div>
              </div>
            </div>
          </section>
          {lessonData() && <LessonMaterialRequest studentId={studentData().id || lessonData().studentId} sessionId={lessonData().sessionId || bookingId()!}/>}
          {lessonData() && <LessonNotesCard sessionId={lessonData().sessionId || bookingId()!}/>}
        </div>
      </div>

      {showChatLog() && (<TutorDialog label="Lesson chat log" className="tutor-chatlog-dialog" onClose={() => setShowChatLog(false)}>
          <section class="chatlog-modal" aria-labelledby="chatlog-title" onClick={event => event.stopPropagation()}>
            <header class="chatlog-modal-header">
              <h2 id="chatlog-title"><TutorArt name="community" size={32}/>Lesson Chatlog</h2>
              <button type="button" class="chatlog-close-btn" aria-label="Close chatlog" onClick={() => setShowChatLog(false)}>
                <TutorIcon name="fi fi-sr-cross" aria-hidden="true"/>
              </button>
            </header>
            <div class="chatlog-modal-body" aria-live="polite">
              {chatLogLoading() ? <p class="chatlog-state">Loading messages...</p> :
                    chatLogError() ? <p class="chatlog-state chatlog-error">{chatLogError()}</p> :
                        chatLog().length === 0 ? <p class="chatlog-state">No messages for this lesson yet.</p> :
                            <ol class="chatlog-messages">
                  {chatLog().map(message => (<li class={`chatlog-message ${message.senderType}`}>
                      <div class="chatlog-message-meta">
                        <strong>{message.senderType === 'tutor' ? 'Tutor' : 'Student'}</strong>
                        <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString()}</time>
                        {message.isEdited && <span>Edited</span>}
                      </div>
                      <p>{message.text}</p>
                      {message.correction && <p class="chatlog-correction"><strong>Correction:</strong> {message.correction}</p>}
                    </li>))}
                </ol>}
            </div>
          </section>
        </TutorDialog>)}

      {showReportModal() && <TutorLessonIssueReportDialog reportStudentIssue={reportStudentIssue()} setReportStudentIssue={setReportStudentIssue} reportDuration={reportDuration()} reportReason={reportReason()} reportSubmitting={reportSubmitting()} reportWindowOpen={reportWindowOpen()} reportSubmitError={reportSubmitError()} setReportDuration={setReportDuration} setReportReason={setReportReason} setReportSubmitError={setReportSubmitError} closeReportModal={closeReportModal} submitTroubleReport={submitTroubleReport}/>}

      {/* Headset Test Modal */}
      {showHeadsetModal() && (<TutorDialog label="Test headset" className="tutor-headset-dialog" onClose={closeHeadsetModal}>
          <div class="headset-modal" onClick={(e) => e.stopPropagation()}>
            <div class="headset-modal-header">
              <h2>
                <TutorArt name="community" size={32}/>
                Device & Media Test
              </h2>
              <button class="modal-close-btn" onClick={closeHeadsetModal} aria-label="Close headset test">
                <TutorIcon name="fi fi-sr-cross"/>
              </button>
            </div>

            <div class="headset-modal-content">
              {/* Microphone Test */}
              <div class="test-section">
                <h3>
                  <TutorIcon name="fi fi-sr-microphone"/>
                  Microphone Test
                </h3>
                {micPermission() === 'pending' && (<div class="permission-request-area">
                    <p class="test-description">Click the button below to allow microphone access and test your mic.</p>
                    <button class="request-permission-btn" onClick={requestMicPermission}>
                      <TutorIcon name="fi fi-sr-microphone"/>
                      Allow Microphone Access
                    </button>
                  </div>)}
                {micPermission() === 'denied' && (<div class="mic-status denied">
                    <TutorIcon name="fi fi-sr-exclamation"/>
                    <div class="denied-reason">
                      {micError() || 'Microphone access denied. Please allow access in your browser settings.'}
                      {!window.isSecureContext && (<div class="https-hint">
                          <strong>Tip:</strong> On mobile Chrome, go to:<br />
                          <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br />
                          Add your server URL and restart Chrome.
                        </div>)}
                    </div>
                    <button class="retry-permission-btn" onClick={requestMicPermission}>
                      <TutorIcon name="fi fi-sr-refresh"/>
                      Try Again
                    </button>
                  </div>)}
                {micPermission() === 'granted' && (<div class="mic-test-area">
                    <div class="mic-status granted">
                      <TutorIcon name="fi fi-sr-check"/>
                      Microphone connected! Speak to test.
                    </div>
                    <div class="mic-level-container">
                      <div class="mic-level-bar">
                        <div class="mic-level-fill" style={cssStyle({ get width() {
                            return `${micLevel()}%`;
                        } })}></div>
                      </div>
                      <span class="mic-level-text">{Math.round(micLevel())}%</span>
                    </div>
                  </div>)}
              </div>

              {/* Camera Test */}
              <div class="test-section">
                <h3>
                  <TutorIcon name="fi fi-sr-camera"/>
                  Camera Test
                </h3>
                {camPermission() === 'pending' && (<div class="permission-request-area">
                    <p class="test-description">Click the button below to allow camera access and test your video.</p>
                    <button class="request-permission-btn camera" onClick={requestCameraPermission}>
                      <TutorIcon name="fi fi-sr-camera"/>
                      Allow Camera Access
                    </button>
                  </div>)}
                {camPermission() === 'denied' && (<div class="cam-status denied">
                    <TutorIcon name="fi fi-sr-exclamation"/>
                    <div class="denied-reason">
                      {camError() || 'Camera access denied. Please allow access in your browser settings.'}
                      {!window.isSecureContext && (<div class="https-hint">
                          <strong>Tip:</strong> On mobile Chrome, go to:<br />
                          <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br />
                          Add your server URL and restart Chrome.
                        </div>)}
                    </div>
                    <button class="retry-permission-btn" onClick={requestCameraPermission}>
                      <TutorIcon name="fi fi-sr-refresh"/>
                      Try Again
                    </button>
                  </div>)}
                {camPermission() === 'granted' && (<div class="camera-test-area">
                    <div class="camera-preview">
                      <video ref={_element => videoRef.current = _element} playsinline muted autoplay/>
                    </div>
                    <div class="camera-controls">
                      <button class="camera-btn" onClick={() => {
                        if (!videoRef.current)
                            return;
                        if (videoRef.current.paused)
                            videoRef.current.play();
                        else
                            videoRef.current.pause();
                    }}>
                        <TutorIcon name="fi fi-sr-play"/>
                        <span>Play/Pause</span>
                      </button>
                      <button class="camera-btn" onClick={async () => {
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
                        }
                        catch { }
                    }}>
                        <TutorIcon name="fi fi-sr-refresh"/>
                        <span>Restart Camera</span>
                      </button>
                    </div>
                  </div>)}
              </div>

              {/* Speaker Test */}
              <div class="test-section">
                <h3>
                  <TutorIcon name="fi fi-sr-volume"/>
                  Speaker Test
                </h3>
                <p class="test-description">Click the buttons below to test your left and right speakers.</p>
                <div class="speaker-buttons">
                  <button class={`speaker-btn left ${isPlayingLeft() ? 'playing' : ''}`} onClick={() => playTestSound('left')} disabled={isPlayingLeft()}>
                    <TutorIcon name="fi fi-sr-arrow-left"/>
                    <span>Left Speaker</span>
                    {isPlayingLeft() && <div class="sound-wave"></div>}
                  </button>
                  <button class={`speaker-btn right ${isPlayingRight() ? 'playing' : ''}`} onClick={() => playTestSound('right')} disabled={isPlayingRight()}>
                    <span>Right Speaker</span>
                    <TutorIcon name="fi fi-sr-arrow-right"/>
                    {isPlayingRight() && <div class="sound-wave"></div>}
                  </button>
                </div>
              </div>
            </div>

            <div class="headset-modal-footer">
              <button class="done-btn" onClick={closeHeadsetModal}>
                Done
              </button>
            </div>
          </div>
        </TutorDialog>)}
    </div>);
    }) as unknown as JSX.Element;
};
export default StudentProfilePage;

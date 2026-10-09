import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
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
  scores?: { comprehension?: number | null; pronunciation?: number | null; grammar?: number | null; maxScore?: number | null };
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
  report: { id: string; createdAt: string; studentIssueLabel?: string | null; status?: string; resolution?: string; attendanceCorrection?: string | null; ticketTransactionId?: string | null } | null;
  studentReport?: { id: string; duration: TroubleDuration; reason: string; details: string; tutorIssueLabel?: string | null; createdAt: string; status: string; resolution: string } | null;
}

const LessonReportOutcome = ({ id, title, report, received = false }: {
  id?: string;
  title: string;
  report: {
    status?: string; studentIssueLabel?: string | null; tutorIssueLabel?: string | null;
    reason?: string; duration?: TroubleDuration; details?: string; resolution?: string;
    attendanceCorrection?: string | null; ticketTransactionId?: string | null;
  };
  received?: boolean;
}) => {
  const status = report.status === 'resolved' ? 'resolved' : report.status === 'under_review' ? 'under_review' : 'submitted';
  const issue = report.studentIssueLabel || report.tutorIssueLabel || report.reason;
  return (
    <section id={id} className={`lesson-report-outcome${received ? ' student-report-received' : ''}`} aria-label={title}>
      <header className="lesson-report-header">
        <h2><span className="lesson-section-icon"><i className="fi fi-sr-exclamation" aria-hidden="true" /></span>{title}</h2>
        <span className={`lesson-report-status lesson-report-status--${status}`}>
          <i className={`fi ${status === 'resolved' ? 'fi-sr-check' : 'fi-sr-clock'}`} aria-hidden="true" />
          {status === 'resolved' ? 'Resolved' : status === 'under_review' ? 'Under review' : 'Submitted'}
        </span>
      </header>
      {issue && <p className="lesson-report-issue">{issue}</p>}
      <dl className="lesson-report-fields">
        {report.reason && report.reason !== issue && <div><dt>Category</dt><dd>{report.reason}</dd></div>}
        {report.duration && <div><dt>Duration</dt><dd>{report.duration === 'up_to_ten' ? 'Up to 10 minutes' : 'Over 10 minutes'}</dd></div>}
        {report.details && <div><dt>Details</dt><dd>{report.details}</dd></div>}
        {report.resolution && <div><dt>Resolution</dt><dd>{report.resolution}</dd></div>}
        {report.attendanceCorrection && <div><dt>Student attendance corrected</dt><dd>{report.attendanceCorrection}</dd></div>}
        {report.ticketTransactionId && <div><dt>Ticket refund reference</dt><dd>{report.ticketTransactionId}</dd></div>}
      </dl>
    </section>
  );
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
  if (!value) return 'Not provided';
  const match = /^Level (10|[1-9])$/.exec(value);
  return match ? `${value} - ${englishLevelLabels[Number(match[1]) - 1]}` : `${value} (previous scale)`;
};

const StudentProfilePage = ({ studentId: studentIdProp, bookingId: bookingIdProp }: StudentProfilePageProps) => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  
  // Extract bookingId or studentId from URL path
  const bookingId = bookingIdProp || window.location.pathname.split('/lesson/')[1]?.split('?')[0];
  const studentId = studentIdProp || window.location.pathname.split('/student/')[1]?.split('?')[0];
  
  
  useEffect(() => {
    document.title = 'Student Profile | FluentXVerse';
  }, []);

  const [showHeadsetModal, setShowHeadsetModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDuration, setReportDuration] = useState<TroubleDuration | null>(null);
  const [reportReason, setReportReason] = useState<TroubleReason | null>(null);
  const [reportStudentIssue, setReportStudentIssue] = useState<TutorStudentIssue | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<TroubleReportStatus | null>(null);
  const [reportStatusError, setReportStatusError] = useState<string | null>(null);
  const [reportStatusLoading, setReportStatusLoading] = useState(false);
  const [reportRevision, setReportRevision] = useState(0);
  const receivedNotification = useNotificationStore(state => state.notifications.find(notification => notification.title === 'Lesson report received' && notification.data?.bookingId === bookingId)?.id);
  const [reportClockOffset, setReportClockOffset] = useState(0);
  const [reportNow, setReportNow] = useState(Date.now());
  const [showChatLog, setShowChatLog] = useState(false);
  const [chatLog, setChatLog] = useState<ChatLogMessage[]>([]);
  const [chatLogLoading, setChatLogLoading] = useState(false);
  const [chatLogError, setChatLogError] = useState<string | null>(null);
  const [showAssessmentResults, setShowAssessmentResults] = useState(false);
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

  // Student data state
  const [studentData, setStudentData] = useState<any>(null);
  const [lessonData, setLessonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setReportNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lessonData?.bookingId) return;
    const controller = new AbortController();
    setReportStatusLoading(true);
    setReportStatusError(null);
    fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(lessonData.bookingId)}/trouble-report`, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to check reporting window');
        setReportClockOffset(Date.parse(result.data.serverNow) - Date.now());
        setReportStatus(result.data);
      })
      .catch(err => {
        if (!controller.signal.aborted) setReportStatusError(err.message || 'Unable to check reporting window');
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportStatusLoading(false);
      });
    return () => controller.abort();
  }, [lessonData?.bookingId, reportRevision, receivedNotification]);

  useEffect(() => {
    setReportStatus(null);
    if (!lessonData?.bookingId) return;
    const refresh = () => { if (!document.hidden) setReportRevision(value => value + 1); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [lessonData?.bookingId]);

  const reportWindowOpen = Boolean(
    reportStatus && !reportStatus.report && lessonData?.status !== 'cancelled' &&
    reportNow + reportClockOffset >= Date.parse(reportStatus.startsAt) &&
    reportNow + reportClockOffset < Date.parse(reportStatus.endsAt)
  );
  const canEnterClassroom = Boolean(reportStatus && canJoinClassroom(lessonData?.status || '',
    Date.parse(reportStatus.startsAt), Date.parse(reportStatus.endsAt), reportNow + reportClockOffset));

  const closeReportModal = () => {
    if (!reportSubmitting) setShowReportModal(false);
  };

  const submitTroubleReport = async () => {
    if (!bookingId || !reportDuration || !reportReason || (reportReason === 'student' && !reportStudentIssue) || !reportWindowOpen || reportSubmitting) return;
    setReportSubmitting(true);
    setReportSubmitError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(bookingId)}/trouble-report`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: reportDuration, reason: reportReason, studentIssue: reportReason === 'student' ? reportStudentIssue : undefined })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not submit the report');
      setReportStatus(current => current ? { ...current, report: result.data } : current);
      setShowReportModal(false);
    } catch (err: any) {
      setReportSubmitError(err.message || 'Could not submit the report');
      setReportRevision(value => value + 1);
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showReportModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReportModal();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showReportModal, reportSubmitting]);

  useEffect(() => {
    if (!showChatLog || !bookingId) return;
    const controller = new AbortController();
    setChatLogLoading(true);
    setChatLogError(null);

    fetch(`${API_BASE_URL}/schedule/tutor-lesson/${encodeURIComponent(bookingId)}/chat-log`, {
      credentials: 'include',
      signal: controller.signal
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed to load chat log');
        setChatLog(result.data);
      })
      .catch(err => {
        if (!controller.signal.aborted) setChatLogError(err.message || 'Failed to load chat log');
      })
      .finally(() => {
        if (!controller.signal.aborted) setChatLogLoading(false);
      });

    return () => controller.abort();
  }, [showChatLog, bookingId]);

  useEffect(() => {
    if (!showChatLog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowChatLog(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showChatLog]);

  // Fetch student data (either from bookingId or studentId)
  useEffect(() => {
    const fetchData = async () => {
      setShowAssessmentResults(false);
      // If we have a bookingId, first fetch lesson details to get student info
      if (bookingId) {
        
        try {
          setLoading(true);
          const lessonUrl = `${API_BASE_URL}/schedule/tutor-lesson/${bookingId}`;
          
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
            } else {
              setError(studentResult.error || 'Failed to load student data');
            }
          } else {
            setError(lessonResult.error || 'Failed to load lesson details');
          }
        } catch (err) {
          console.error('[StudentProfile] Error fetching data:', err);
          setError('Failed to load lesson data');
        } finally {
          setLoading(false);
        }
        return;
      }
      
      // Fallback: fetch by studentId if no bookingId
      if (!studentId) {
        setLoading(false);
        return;
      }
      
      
      try {
        setLoading(true);
        const url = `${API_BASE_URL}/tutor/student/${studentId}`;
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setStudentData(result.data);
        } else {
          console.error('[StudentProfile] Failed to load student data:', result.error);
          setError(result.error || 'Failed to load student data');
        }
      } catch (err) {
        console.error('[StudentProfile] Error fetching student data:', err);
        setError('Failed to load student profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, studentId]);

  const openHeadsetModal = async () => {
    setShowHeadsetModal(true);
    // Don't auto-request permissions - let user click buttons on mobile
    // This is more reliable for mobile browsers
  };

  // Check if we're on a secure context (HTTPS or localhost)
  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  // Error message for insecure context
  const [micError, setMicError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

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
    } catch (err: any) {
      console.error('Mic permission error:', err);
      if (err.name === 'NotAllowedError') {
        setMicError('Permission denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setMicError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        setMicError('Microphone is in use by another app. Please close other apps using the mic.');
      } else if (err.name === 'SecurityError' || err.message?.includes('secure')) {
        setMicError('HTTPS required. On mobile Chrome: go to chrome://flags → "Insecure origins treated as secure" → add http://192.168.0.102:5173');
      } else {
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
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera permission error:', err);
      if (err.name === 'NotAllowedError') {
        setCamError('Permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError') {
        setCamError('Camera is in use by another app. Please close other apps using the camera.');
      } else if (err.name === 'SecurityError' || err.message?.includes('secure')) {
        setCamError('HTTPS required. On mobile Chrome: go to chrome://flags → "Insecure origins treated as secure" → add http://192.168.0.102:5173');
      } else {
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

  // Show loading state
  if (loading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader user={user || undefined} />
          <div className="student-profile-state">
            <p>Loading student profile...</p>
          </div>
        </div>
      </>
    );
  }

  // Show error state
  if (error || !studentData) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader user={user || undefined} />
          <div className="student-profile-state error">
            <p>{error || 'Student not found'}</p>
          </div>
        </div>
      </>
    );
  }
  
  // Use real student data from API
  const formatJoinDate = (date: string | undefined) => {
    if (!date) return 'N/A';
    try {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return 'N/A';
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const displayData = {
    id: studentData.id || 'N/A',
    name: studentData.fullName || `${studentData.givenName || ''} ${studentData.familyName || ''}`.trim() || 'Unknown Student',
    initials: studentData.initials || (studentData.givenName?.[0] || 'S') + (studentData.familyName?.[0] || 'T'),
    nationality: studentData.country || 'Not specified',
    joinDate: formatJoinDate(studentData.joinDate),
    totalLessons: studentData.totalLessons || 0,
    attendance: studentData.attendance || 0,
  };
  const assessment = studentData.levelAssessment as LevelAssessment | null | undefined;
  const assessmentScores = assessment?.scores;
  const assessmentRemarks = (assessment?.remarks || []).map(remark => remark.trim()).filter(Boolean);
  const hasAssessmentDetails = Boolean(assessmentRemarks.length || assessmentScores?.comprehension != null || assessmentScores?.pronunciation != null || assessmentScores?.grammar != null);
  const hobbies = Array.isArray(studentData.hobbies) ? studentData.hobbies.filter((hobby: unknown): hobby is string => typeof hobby === 'string' && Boolean(hobby.trim())) : [];
  const preferences = (studentData.lessonPreferences || {
    preferCameraOn: true,
    errorCorrection: 'tutor_choice',
    otherRequests: ''
  }) as LessonPreferences;

  return (
    <div className="student-profile-page">
      <SideBar />
      
      <div className="student-profile-content">
        <DashboardHeader user={user || undefined} />
        
        <div className="student-profile-main">
          {/* Back Button */}
          <button className="back-button" onClick={() => window.location.href = '/schedule'}>
            <i className="fi fi-sr-arrow-left"></i>
            Back to Schedule
          </button>

          {/* Lesson Info Card - Only shown when accessed via /lesson/:bookingId */}
          {lessonData && (
            <div className="lesson-info-card">
              <div className="lesson-info-header">
                <i className="fi fi-sr-graduation-cap"></i>
                <h2>Scheduled Lesson</h2>
              </div>
              <div className="lesson-info-details">
                <div className="lesson-info-item">
                  <i className="fi fi-sr-calendar"></i>
                  <span>{new Date(lessonData.slotDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="lesson-info-item">
                  <i className="fi fi-sr-clock"></i>
                  <span>{lessonData.slotTime} PHT</span>
                </div>
                <div className="lesson-info-item">
                  <i className="fi fi-sr-hourglass-end"></i>
                  <span>{lessonData.durationMinutes} minutes</span>
                </div>
              </div>
            </div>
          )}

          {/* Profile Header Card */}
          <div className="profile-header-card">
            <div className="profile-header-content">
              {/* Profile Photo */}
              <div className="profile-photo-container">
                <div className="profile-avatar">
                  {displayData.initials}
                </div>
              </div>

              {/* Profile Info */}
              <div className="profile-info">
                <span className="profile-eyebrow">Student</span>
                <div className="profile-name-row">
                  <h1 className="profile-name">{displayData.name}</h1>
                  <span className="profile-id-badge">{displayData.id}</span>
                </div>

                <div className="contact-info-grid">
                  <div className="contact-info-item">
                    <i className="fi fi-sr-globe"></i>
                    <span>{displayData.nationality}</span>
                  </div>
                  <div className="contact-info-item">
                    <i className="fi fi-sr-calendar"></i>
                    <span>Registered {displayData.joinDate}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="stats-container">
                  <div className="stat-card blue">
                    <div className="stat-value">{displayData.totalLessons}</div>
                    <div className="stat-label">Total Lessons</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Right side */}
              <div className="profile-action-buttons">
                {lessonData ? (
                  <button 
                    type="button"
                    className="enter-classroom-btn" 
                    disabled={!canEnterClassroom}
                    onClick={() => {
                      if (!canEnterClassroom) return;
                      window.open(`/classroom/${lessonData.sessionId || bookingId}`, '_blank', 'noopener,noreferrer');
                    }}
                    title={canEnterClassroom ? 'Enter the classroom in a new tab' : 'The classroom opens five minutes before the lesson and closes three minutes after it ends.'}
                  >
                    <i className="fi fi-sr-video-camera" aria-hidden="true"></i>
                    <span>Enter Classroom</span>
                  </button>
                ) : (
                  <button 
                    className="enter-classroom-btn" 
                    onClick={() => {
                      // Navigate to schedule to see booked sessions with this student
                      window.location.href = '/schedule';
                    }}
                    title="View your schedule to enter a classroom session"
                  >
                    <i className="fi fi-sr-calendar"></i>
                    <span>View Sessions</span>
                  </button>
                )}
                <button className="test-headset-btn" onClick={openHeadsetModal}>
                  <i className="fi fi-sr-headset"></i>
                  <span>Test Headset</span>
                </button>
                {lessonData && (
                  <button type="button" className="open-chatlog-btn" onClick={() => setShowChatLog(true)}>
                    <i className="fi fi-sr-comments" aria-hidden="true"></i>
                    <span>Open Chatlog</span>
                  </button>
                )}
                {lessonData && (
                  <button
                    type="button"
                    className={`lesson-issue-report-btn${reportStatus?.studentReport ? ' report-received' : ''}`}
                    disabled={!reportStatus?.studentReport && (!reportWindowOpen || reportStatusLoading)}
                    title={reportStatus?.studentReport ? 'View the issue reported by the student' : reportStatusError || (reportStatus?.report ? 'An issue has already been reported for this lesson' : 'Available only during the scheduled lesson')}
                    onClick={() => {
                      if (reportStatus?.studentReport) { document.getElementById('student-lesson-report')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
                      setReportDuration(null);
                      setReportReason(null);
                      setReportStudentIssue(null);
                      setReportSubmitError(null);
                      setShowReportModal(true);
                    }}
                  >
                    <i className="fi fi-sr-exclamation" aria-hidden="true"></i>
                    <span>{reportStatus?.studentReport ? 'Report Received' : reportStatus?.report ? 'Issue Reported' : 'Report Issue'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {reportStatus?.report && <LessonReportOutcome title="Lesson issue report" report={reportStatus.report} />}
          {reportStatus?.studentReport && <LessonReportOutcome id="student-lesson-report" title="Student report received" report={reportStatus.studentReport} received />}
          <section className="learner-profile-card" aria-labelledby="learner-profile-title">
            <h2 id="learner-profile-title" className="learner-profile-title"><span className="lesson-section-icon"><i className="fi fi-sr-graduation-cap" aria-hidden="true"></i></span>Learning profile</h2>
            <div className="learner-profile-grid">
              <div className="learner-profile-field">
                <span className="learner-profile-label"><i className="fi fi-sr-signal-alt" aria-hidden="true"></i>Self-assessed English level</span>
                <strong>{formatEnglishLevel(studentData.currentProficiency)}</strong>
                <span className="learner-profile-note">Chosen by the student</span>
              </div>
              <div className="learner-profile-field learner-profile-assessment">
                <span className="learner-profile-label"><i className="fi fi-sr-chart-histogram" aria-hidden="true"></i>Level assessment</span>
                {assessment ? (
                  <>
                    <strong>{assessment.studentLevel ? formatEnglishLevel(assessment.studentLevel) : 'Level not recorded'}</strong>
                    <span className="learner-profile-note">{[assessment.curriculum, assessment.dateAssessed && `Assessed ${formatJoinDate(assessment.dateAssessed)}`, assessment.assessedBy && `By ${assessment.assessedBy}`].filter(Boolean).join(' · ') || 'Recorded by an assessor'}</span>
                  </>
                ) : <strong>None yet</strong>}
              </div>
            </div>
            {assessment && hasAssessmentDetails && (
              <>
                <div id="assessment-results" className="assessment-results" hidden={!showAssessmentResults}>
                  {assessmentScores && (['comprehension', 'pronunciation', 'grammar'] as const).some(skill => assessmentScores[skill] != null) && (
                    <div className="assessment-results-scores">
                      {(['comprehension', 'pronunciation', 'grammar'] as const).map(skill => assessmentScores[skill] != null && (
                        <div key={skill} className="assessment-results-score">
                          <span>{skill}</span>
                          <strong>{assessmentScores[skill]}{assessmentScores.maxScore ? ` / ${assessmentScores.maxScore}` : ''}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {assessmentRemarks.length > 0 && (
                    <div className="assessment-results-remarks">
                      <h3>Assessment remarks</h3>
                      <ul>{assessmentRemarks.map((remark, index) => <li key={index}>{remark}</li>)}</ul>
                    </div>
                  )}
                  {assessment.assessedBy && <p className="assessment-results-assessor">Assessment conducted by <strong>{assessment.assessedBy}</strong></p>}
                </div>
                <div className="assessment-results-action">
                  <button
                    type="button"
                    className="assessment-results-toggle"
                    aria-expanded={showAssessmentResults}
                    aria-controls="assessment-results"
                    onClick={() => setShowAssessmentResults(value => !value)}
                  >
                    {showAssessmentResults ? 'Hide assessment results' : 'View assessment results'}
                    <i className={`fi fi-sr-angle-small-${showAssessmentResults ? 'up' : 'down'}`} aria-hidden="true"></i>
                  </button>
                </div>
              </>
            )}
          </section>

          {lessonData && (
            <aside className="lesson-recording-notice" aria-label="Lesson recording notice">
              <i className="fi fi-sr-info" aria-hidden="true"></i>
              <p><strong>Recording notice:</strong> Lessons may be recorded to review teaching quality and maintain service standards. Recordings are handled confidentially and used only for quality assurance and compliance reviews.</p>
            </aside>
          )}

          <section className="lesson-context" aria-labelledby="lesson-context-title">
            <div className="lesson-context-heading">
              <h2 id="lesson-context-title"><span className="lesson-section-icon"><i className="fi fi-sr-user" aria-hidden="true"></i></span>Student context</h2>
              <a href="/materials" className="lesson-materials-link">
                <i className="fi fi-sr-book" aria-hidden="true"></i>
                Browse materials
                <i className="fi fi-sr-arrow-right" aria-hidden="true"></i>
              </a>
            </div>
            <div className="lesson-context-columns">
              <div className="lesson-context-column">
                <h3><i className="fi fi-sr-user" aria-hidden="true"></i>About me</h3>
                {studentData.bio && <p className="lesson-context-bio">{studentData.bio}</p>}
                <div className="lesson-context-field"><span><i className="fi fi-sr-target" aria-hidden="true"></i>Purpose</span><strong>{studentData.purpose || 'Not set'}</strong></div>
                <div className="lesson-context-field"><span><i className="fi fi-sr-briefcase" aria-hidden="true"></i>Occupation</span><strong>{studentData.occupation || 'Not set'}</strong></div>
                <div className="lesson-context-field">
                  <span><i className="fi fi-sr-heart" aria-hidden="true"></i>Hobbies</span>
                  {hobbies.length ? <div className="lesson-context-hobbies">{hobbies.map((hobby: string) => <strong key={hobby}>{hobby}</strong>)}</div> : <strong>Not set</strong>}
                </div>
              </div>
              <div className="lesson-context-column">
                <h3><i className="fi fi-sr-settings-sliders" aria-hidden="true"></i>Lesson preferences</h3>
                <div className="lesson-context-field"><span><i className="fi fi-sr-video-camera" aria-hidden="true"></i>Session setup</span><strong>{preferences.preferCameraOn ? 'Prefer camera on' : 'Start audio-first'}</strong></div>
                <div className="lesson-context-field">
                  <span><i className="fi fi-sr-comment-alt" aria-hidden="true"></i>Correction style</span>
                  <strong>{correctionLabels[preferences.errorCorrection] || correctionLabels.tutor_choice}</strong>
                  <small>{correctionDescriptions[preferences.errorCorrection] || correctionDescriptions.tutor_choice}</small>
                </div>
                <div className="lesson-context-field"><span><i className="fi fi-sr-bookmark" aria-hidden="true"></i>Other requests</span><strong>{preferences.otherRequests || 'None added'}</strong></div>
              </div>
            </div>
          </section>
          {lessonData && <LessonMaterialRequest key={`request-${bookingId}`} studentId={studentData.id || lessonData.studentId} sessionId={lessonData.sessionId || bookingId!} />}
          {lessonData && <LessonNotesCard key={lessonData.sessionId || bookingId} sessionId={lessonData.sessionId || bookingId!} />}
        </div>
      </div>

      {showChatLog && (
        <div className="chatlog-modal-overlay" onClick={() => setShowChatLog(false)}>
          <section className="chatlog-modal" role="dialog" aria-modal="true" aria-labelledby="chatlog-title" onClick={event => event.stopPropagation()}>
            <header className="chatlog-modal-header">
              <h2 id="chatlog-title"><i className="fi fi-sr-comments" aria-hidden="true"></i>Lesson Chatlog</h2>
              <button type="button" className="chatlog-close-btn" aria-label="Close chatlog" onClick={() => setShowChatLog(false)}>
                <i className="fi fi-sr-cross" aria-hidden="true"></i>
              </button>
            </header>
            <div className="chatlog-modal-body" aria-live="polite">
              {chatLogLoading ? <p className="chatlog-state">Loading messages...</p> :
                chatLogError ? <p className="chatlog-state chatlog-error">{chatLogError}</p> :
                chatLog.length === 0 ? <p className="chatlog-state">No messages for this lesson yet.</p> :
                <ol className="chatlog-messages">
                  {chatLog.map(message => (
                    <li key={message.id} className={`chatlog-message ${message.senderType}`}>
                      <div className="chatlog-message-meta">
                        <strong>{message.senderType === 'tutor' ? 'Tutor' : 'Student'}</strong>
                        <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString()}</time>
                        {message.isEdited && <span>Edited</span>}
                      </div>
                      <p>{message.text}</p>
                      {message.correction && <p className="chatlog-correction"><strong>Correction:</strong> {message.correction}</p>}
                    </li>
                  ))}
                </ol>}
            </div>
          </section>
        </div>
      )}

      {showReportModal && <TutorLessonIssueReportDialog
        reportStudentIssue={reportStudentIssue} setReportStudentIssue={setReportStudentIssue}
        reportDuration={reportDuration} reportReason={reportReason} reportSubmitting={reportSubmitting}
        reportWindowOpen={reportWindowOpen} reportSubmitError={reportSubmitError}
        setReportDuration={setReportDuration} setReportReason={setReportReason} setReportSubmitError={setReportSubmitError}
        closeReportModal={closeReportModal} submitTroubleReport={submitTroubleReport}
      />}

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
                  <div className="permission-request-area">
                    <p className="test-description">Click the button below to allow microphone access and test your mic.</p>
                    <button className="request-permission-btn" onClick={requestMicPermission}>
                      <i className="fi fi-sr-microphone"></i>
                      Allow Microphone Access
                    </button>
                  </div>
                )}
                {micPermission === 'denied' && (
                  <div className="mic-status denied">
                    <i className="fi fi-sr-exclamation"></i>
                    <div className="denied-reason">
                      {micError || 'Microphone access denied. Please allow access in your browser settings.'}
                      {!window.isSecureContext && (
                        <div className="https-hint">
                          <strong>Tip:</strong> On mobile Chrome, go to:<br/>
                          <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br/>
                          Add your server URL and restart Chrome.
                        </div>
                      )}
                    </div>
                    <button className="retry-permission-btn" onClick={requestMicPermission}>
                      <i className="fi fi-sr-refresh"></i>
                      Try Again
                    </button>
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
                  <div className="permission-request-area">
                    <p className="test-description">Click the button below to allow camera access and test your video.</p>
                    <button className="request-permission-btn camera" onClick={requestCameraPermission}>
                      <i className="fi fi-sr-camera"></i>
                      Allow Camera Access
                    </button>
                  </div>
                )}
                {camPermission === 'denied' && (
                  <div className="cam-status denied">
                    <i className="fi fi-sr-exclamation"></i>
                    <div className="denied-reason">
                      {camError || 'Camera access denied. Please allow access in your browser settings.'}
                      {!window.isSecureContext && (
                        <div className="https-hint">
                          <strong>Tip:</strong> On mobile Chrome, go to:<br/>
                          <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br/>
                          Add your server URL and restart Chrome.
                        </div>
                      )}
                    </div>
                    <button className="retry-permission-btn" onClick={requestCameraPermission}>
                      <i className="fi fi-sr-refresh"></i>
                      Try Again
                    </button>
                  </div>
                )}
                {camPermission === 'granted' && (
                  <div className="camera-test-area">
                    <div className="camera-preview">
                      <video ref={videoRef} playsInline muted autoPlay />
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


export default StudentProfilePage

import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { scheduleApi, type StudentBooking } from '../api/schedule.api';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { ArrowRight, ArrowLeft, ChevronDown, ChevronUp, CalendarDays, Headphones, Pencil, X, Check, Eye, RotateCw, LoaderCircle, CircleAlert, Monitor, Mic, Camera, Volume2, Play, Briefcase, Heart, Target, NotebookPen, UserRound, SlidersHorizontal } from 'lucide-preact';
import { getStudentProfile, updateLessonPreferences, updateAboutMe, saveLastViewedLesson, getLastViewedLesson, type StudentProfile, type LessonPreferences, type AboutMe, type LastViewedLesson, type LevelAssessment } from '../api/student.api';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './StudentProfilePage.css';


const OTHER_REQUESTS_MAX_LENGTH = 150;

function ProfileArt({ name }: { name: string }) {
  return <img className="profile-art" src={`/assets/img/home-icons/${name}-v1.webp`} alt="" width="40" height="40" />;
}

function bookingMoment(booking: StudentBooking) {
  const match = booking.slotTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  const date = new Date(`${booking.slotDate}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const StudentProfilePage = () => {
  const { route } = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'materials'>('overview');
  const [history, setHistory] = useState<StudentBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [lessonsError, setLessonsError] = useState('');
  const [showHeadsetModal, setShowHeadsetModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const modalCloseRef = useRef<(() => void) | null>(null);
  
  // Materials tab state
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [lastViewedCourse, setLastViewedCourse] = useState<string | null>(null);
  const [lastViewedLesson, setLastViewedLesson] = useState<{
    lessonId: string;
    level: number;
    chapter: number;
    lessonNumber: number;
    title: string;
    skill: string;
    goal: string;
  } | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<number[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  
  const courses = [
    { id: 'conversational-skills', name: 'Conversational Skills', icon: 'community', category: 'Conversation' },
    { id: 'business-english', name: 'Business English', icon: 'training', category: 'Business' },
    { id: 'young-learners', name: 'Young Learners', icon: 'home', category: 'Kids' },
  ];
  
  const getLevelNumber = (lesson: Lesson): number => {
    const levelBadge = lesson.lessonData?.header?.levelBadge || '';
    const match = levelBadge.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };
  
  const getLessonNumber = (lesson: Lesson): number => {
    const lessonLabel = lesson.lessonData?.header?.lessonLabel || lesson.title || '';
    const match = lessonLabel.match(/Lesson\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };
  
  const getChapterNumber = (lesson: Lesson): number => {
    const chapterLabel = lesson.lessonData?.header?.chapterLabel || '';
    const match = chapterLabel.match(/Chapter\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };
  
  const groupedLessons = lessons.reduce((acc, lesson) => {
    const level = getLevelNumber(lesson);
    const chapter = getChapterNumber(lesson);
    
    if (!acc[level]) acc[level] = {};
    if (!acc[level][chapter]) acc[level][chapter] = [];
    acc[level][chapter].push(lesson);
    return acc;
  }, {} as Record<number, Record<number, Lesson[]>>);
  
  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };
  
  const toggleChapter = (chapterKey: string) => {
    setExpandedChapters(prev =>
      prev.includes(chapterKey) ? prev.filter(c => c !== chapterKey) : [...prev, chapterKey]
    );
  };
  
  const handleChooseLesson = async (lesson: Lesson, e: Event) => {
    e.stopPropagation();
    
    // Save lesson details to Memgraph
    const lessonDetails = {
      lessonId: lesson.id,
      level: getLevelNumber(lesson),
      chapter: getChapterNumber(lesson),
      lessonNumber: getLessonNumber(lesson),
      title: lesson.title,
      skill: (lesson.lessonData as any)?.skill || 'Speaking',
      goal: lesson.lessonData?.header?.goalText || 'English conversation practice'
    };
    
    const lessonData: LastViewedLesson = {
      courseId: selectedCourse || '',
      lessonId: lesson.id,
      lessonNumber: lessonDetails.lessonNumber,
      title: lessonDetails.title,
      goal: lessonDetails.goal,
      viewedAt: Date.now()
    };
    
    try {
      const result = await saveLastViewedLesson(lessonData);
      if (result.success) {
        setLastViewedLesson(lessonDetails);
        // Store for booking reference
        localStorage.setItem('selectedLessonForBooking', lesson.id);
        
        // Show success notification
        setNotification({ 
          message: `Lesson "${lesson.title}" selected for your next booking!`, 
          type: 'success' 
        });
        
        // Auto-dismiss notification after 3 seconds
        setTimeout(() => setNotification(null), 3000);
        
        // Switch back to course selection to show the chosen lesson
        setTimeout(() => {
          setSelectedCourse(null);
          setLessons([]);
        }, 500);
      } else {
        setNotification({ 
          message: 'Failed to save lesson selection. Please try again.', 
          type: 'error' 
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Failed to save lesson:', error);
      setNotification({ 
        message: 'Failed to save lesson selection. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };
  
  const handleViewLesson = async (lesson: Lesson, e: Event) => {
    e.stopPropagation();
    // Save lesson details for "Continue Learning"
    const lessonDetails = {
      lessonId: lesson.id,
      level: getLevelNumber(lesson),
      chapter: getChapterNumber(lesson),
      lessonNumber: getLessonNumber(lesson),
      title: lesson.title,
      skill: (lesson.lessonData as any)?.skill || 'Speaking',
      goal: lesson.lessonData?.header?.goalText || 'English conversation practice'
    };
    setLastViewedLesson(lessonDetails);
    
    // Save to Memgraph via API
    const lessonData: LastViewedLesson = {
      courseId: selectedCourse || '',
      lessonId: lesson.id,
      lessonNumber: lessonDetails.lessonNumber,
      title: lessonDetails.title,
      goal: lessonDetails.goal,
      viewedAt: Date.now()
    };
    
    try {
      await saveLastViewedLesson(lessonData);
    } catch (error) {
      console.error('Failed to save last viewed lesson:', error);
      setNotification({ 
        message: 'Failed to save lesson progress', 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 3000);
    }
    
    window.open(selectedCourse === 'conversational-skills' ? `/materials/conversational-skills/${encodeURIComponent(lesson.id)}` : `/lesson/view?id=${encodeURIComponent(lesson.id)}`, '_blank');
  };
  
  const loadCourseLessons = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoadingLessons(true);
      setLessonsError('');
      setLessons([]);
      
      // Use lesson-materials endpoint for conversational-skills
      if (selectedCourse === 'conversational-skills' || selectedCourse === 'business-english') {
        const result = await lessonApi.getPublishedLessonMaterials(selectedCourse);
        if (result.success) {
          // Transform lesson-materials format to match expected Lesson format
          const transformedLessons = result.lessons.map((l: any) => ({
            id: l.id,
            title: l.lessonTitle || `Lesson ${l.lessonNumber}: ${l.lessonName}`,
            slug: l.id,
            status: 'published' as const,
            lessonData: {
              header: {
                levelBadge: l.levelBadge || `Level ${l.level || 1}`,
                chapterLabel: l.chapterLabel || `Chapter ${l.chapter || 1}`,
                lessonLabel: l.lessonTitle || `Lesson ${l.lessonNumber}: ${l.lessonName}`,
                goalText: l.goalTextEn || '',
              }
            }
          }));
          setLessons(transformedLessons as Lesson[]);
        } else setLessonsError(result.error || 'Could not load lessons.');
      } else {
        // Use regular lesson endpoint for other courses
        const result = await lessonApi.getPublishedLessons('all');
        if (result.success) {
          // Filter by selected course
          const filteredLessons = result.lessons.filter(lesson => {
            const courseName = (lesson.lessonData as any)?.course || '';
            const selectedCourseName = courses.find(c => c.id === selectedCourse)?.name || '';
            return courseName.toLowerCase() === selectedCourseName.toLowerCase();
          });
          setLessons(filteredLessons);
        } else setLessonsError(result.error || 'Could not load lessons.');
      }
    } catch (error) {
      setLessonsError('Could not load lessons. Please try again.');
    } finally {
      setLoadingLessons(false);
    }
  };
  
  useEffect(() => {
    document.title = 'My Profile | FluentXVerse';
    // Load last viewed lesson from API
    const loadLastViewedLesson = async () => {
      try {
        const result = await getLastViewedLesson();
        if (result.success && result.data) {
          setLastViewedCourse(result.data.courseId);
          // For now, we can only get lessonNumber, title, and goal from the API
          // Level, chapter, and skill will need to be fetched when we load the lessons
          setLastViewedLesson({
            lessonId: result.data.lessonId || '',
            level: 1, // Default, will be updated when course is loaded
            chapter: 1, // Default, will be updated when course is loaded
            lessonNumber: result.data.lessonNumber,
            title: result.data.title,
            skill: 'Speaking', // Default, will be updated when course is loaded
            goal: result.data.goal
          });
        } else {
        }
      } catch (error) {
        console.error('[StudentProfile] Failed to load last viewed lesson:', error);
      }
    };
    loadLastViewedLesson();
  }, []);
  
  useEffect(() => {
    if (selectedCourse) {
      loadCourseLessons();
      setLastViewedCourse(selectedCourse);
    }
  }, [selectedCourse]);
  
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

  // Profile data state
  const [profileData, setProfileData] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lesson preferences state
  const [preferences, setPreferences] = useState<LessonPreferences>({
    preferCameraOn: true,
    errorCorrection: 'tutor_choice',
    otherRequests: ''
  });
  const [initialPreferences, setInitialPreferences] = useState<LessonPreferences>({
    preferCameraOn: true,
    errorCorrection: 'tutor_choice',
    otherRequests: ''
  });
  const [editPreferences, setEditPreferences] = useState<LessonPreferences>({
    preferCameraOn: true,
    errorCorrection: 'tutor_choice',
    otherRequests: ''
  });
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const havePreferencesChanged = (current: LessonPreferences, initial: LessonPreferences) => {
    return current.preferCameraOn !== initial.preferCameraOn ||
           current.errorCorrection !== initial.errorCorrection ||
           current.otherRequests !== initial.otherRequests;
  };

  const hasPreferencesChanged = () => havePreferencesChanged(preferences, initialPreferences);
  const hasEditPreferencesChanged = () => havePreferencesChanged(editPreferences, initialPreferences);

  const getErrorCorrectionLabel = (value: LessonPreferences['errorCorrection']) => {
    if (value === 'during_feedback') return 'During feedback';
    if (value === 'proactively') return 'Proactively';
    return "Tutor's choice";
  };

  const getErrorCorrectionDescription = (value: LessonPreferences['errorCorrection']) => {
    if (value === 'during_feedback') return 'Corrections are saved for the end-of-lesson review.';
    if (value === 'proactively') return 'Corrections happen as you move through the lesson.';
    return 'Your tutor chooses the best timing for corrections.';
  };

  // About Me state
  const [aboutMe, setAboutMe] = useState<AboutMe>({
    purpose: '',
    occupation: '',
    hobbies: [],
    bio: ''
  });
  const [editAboutMe, setEditAboutMe] = useState<AboutMe>({
    purpose: '',
    occupation: '',
    hobbies: [],
    bio: ''
  });
  const [showAboutMeModal, setShowAboutMeModal] = useState(false);
  const [savingAboutMe, setSavingAboutMe] = useState(false);
  const [aboutMeMessage, setAboutMeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // About Me choices
  const purposeChoices = [
    'Career Advancement',
    'Business Communication',
    'Travel',
    'Academic Studies',
    'Immigration',
    'Personal Interest',
    'Social Communication',
    'Other'
  ];

  const occupationChoices = [
    'Manufacturing',
    'Research',
    'Healthcare',
    'Education',
    'IT / Technology',
    'Finance / Banking',
    'Sales / Marketing',
    'Engineering',
    'Hospitality / Tourism',
    'Government',
    'Student',
    'Other'
  ];

  const hobbyChoices = [
    'Sports',
    'Internet / Gaming',
    'Reading',
    'Music',
    'Movies / TV Shows',
    'Cooking',
    'Travel',
    'Photography',
    'Art / Design',
    'Fitness',
    'Nature / Outdoors',
    'Technology'
  ];

  const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getStudentProfile();
        
        if (result.success && result.data) {
          setProfileData(result.data);
          // Load saved preferences if available
          if (result.data.lessonPreferences) {
            const lessonPreferences = {
              ...result.data.lessonPreferences,
              otherRequests: (result.data.lessonPreferences.otherRequests || '').slice(0, OTHER_REQUESTS_MAX_LENGTH)
            };
            setPreferences(lessonPreferences);
            setInitialPreferences(lessonPreferences);
            setEditPreferences(lessonPreferences);
          }
          // Load saved About Me data if available
          if (result.data.purpose || result.data.occupation || result.data.hobbies || result.data.bio) {
            const aboutMeData = {
              purpose: result.data.purpose || '',
              occupation: result.data.occupation || '',
              hobbies: result.data.hobbies || [],
              bio: result.data.bio || ''
            };
            setAboutMe(aboutMeData);
          }
        } else {
          setError(result.error || 'Failed to load profile');
        }
      } catch (err: any) {
        console.error('[StudentProfile] Error fetching profile:', err);
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
  };
  useEffect(() => { fetchProfile(); }, []);

  // Save preferences handler
  const handleSavePreferences = async (nextPreferences: LessonPreferences = preferences) => {
    setSavingPreferences(true);
    setPreferencesMessage(null);
    
    try {
      const result = await updateLessonPreferences(nextPreferences);
      if (result.success) {
        setPreferencesMessage({ type: 'success', text: 'Preferences saved!' });
        setPreferences({ ...nextPreferences });
        setInitialPreferences({ ...nextPreferences });
        setEditPreferences({ ...nextPreferences });
        setTimeout(() => {
          setPreferencesMessage(null);
          setShowPreferencesModal(false);
        }, 1200);
      } else {
        setPreferencesMessage({ type: 'error', text: result.error || 'Failed to save preferences' });
      }
    } catch (err: any) {
      setPreferencesMessage({ type: 'error', text: err.message || 'Failed to save preferences' });
    } finally {
      setSavingPreferences(false);
    }
  };

  const openPreferencesModal = () => {
    setEditPreferences({ ...preferences });
    setPreferencesMessage(null);
    setShowPreferencesModal(true);
  };

  const closePreferencesModal = () => {
    if (!savingPreferences) {
      setShowPreferencesModal(false);
      setPreferencesMessage(null);
    }
  };

  // Save About Me handler
  const handleSaveAboutMe = async () => {
    setSavingAboutMe(true);
    setAboutMeMessage(null);
    
    try {
      const result = await updateAboutMe(editAboutMe);
      if (result.success) {
        setAboutMeMessage({ type: 'success', text: 'About Me saved successfully!' });
        // Update the main aboutMe state with saved values
        setAboutMe(editAboutMe);
        setTimeout(() => {
          setAboutMeMessage(null);
          setShowAboutMeModal(false);
        }, 1500);
      } else {
        setAboutMeMessage({ type: 'error', text: result.error || 'Failed to save' });
      }
    } catch (err: any) {
      setAboutMeMessage({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setSavingAboutMe(false);
    }
  };

  // Open About Me modal
  const openAboutMeModal = () => {
    setEditAboutMe({ ...aboutMe });
    setAboutMeMessage(null);
    setShowAboutMeModal(true);
  };

  // Close About Me modal
  const closeAboutMeModal = () => {
    if (savingAboutMe) return;
    setShowAboutMeModal(false);
    setAboutMeMessage(null);
  };

  // Toggle hobby selection in edit modal
  const toggleHobby = (hobby: string) => {
    setEditAboutMe(prev => ({
      ...prev,
      hobbies: prev.hobbies.includes(hobby)
        ? prev.hobbies.filter(h => h !== hobby)
        : [...prev.hobbies, hobby]
    }));
  };

  // Format join date helper
  const formatJoinDate = (date: string | number | undefined) => {
    if (!date) return 'N/A';
    try {
      const parsed = typeof date === 'number' ? new Date(date) : new Date(date);
      if (isNaN(parsed.getTime())) return 'N/A';
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const formatAssessmentDate = (date: LevelAssessment['dateAssessed']) => {
    if (!date) return 'Not recorded';
    if (typeof date === 'string' && Number.isNaN(Date.parse(date))) return date;
    try {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return String(date);
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(date);
    }
  };

  const formatAssessmentScore = (score: number | null | undefined, maxScore: number | null | undefined) => {
    if (score === null || score === undefined) return 'Not scored';
    return `${score} / ${maxScore || 3}`;
  };

  // Display data with safe fallbacks
  const displayData = profileData ? {
    id: profileData.id || 'N/A',
    name: profileData.fullName || `${profileData.givenName || ''} ${profileData.familyName || ''}`.trim() || 'Unknown',
    email: profileData.email || 'Not provided',
    initials: profileData.initials || (profileData.givenName?.[0] || 'S') + (profileData.familyName?.[0] || 'T'),
    level: profileData.currentProficiency || 'Beginner',
    nationality: profileData.country || 'Not specified',
    joinDate: formatJoinDate(profileData.joinDate),
    totalLessons: profileData.totalLessons || 0,
    upcomingLessons: profileData.upcomingLessons || 0,
    attendance: profileData.attendance || 0,
    goals: Array.isArray(profileData.learningGoals) && profileData.learningGoals.length > 0 
      ? profileData.learningGoals.join(', ') 
      : 'Set your learning goals in Settings',
    interests: profileData.interests || 'Not specified',
    timezone: profileData.timezone || 'GMT+8 (Philippine Time)',
    preferredTopics: Array.isArray(profileData.preferredTopics) && profileData.preferredTopics.length > 0
      ? profileData.preferredTopics 
      : ['Business English', 'Conversation', 'Pronunciation'],
    levelAssessment: profileData.levelAssessment || null
  } : null;

  const assessmentData = displayData?.levelAssessment || null;
  const assessmentHasData = Boolean(
    assessmentData && (
      assessmentData.studentLevel ||
      assessmentData.curriculum ||
      assessmentData.dateAssessed ||
      assessmentData.assessedBy ||
      assessmentData.scores?.comprehension !== null && assessmentData.scores?.comprehension !== undefined ||
      assessmentData.scores?.pronunciation !== null && assessmentData.scores?.pronunciation !== undefined ||
      assessmentData.scores?.grammar !== null && assessmentData.scores?.grammar !== undefined ||
      (Array.isArray(assessmentData.remarks) && assessmentData.remarks.length > 0)
    )
  );

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

  const loadHistory = async () => {
    setHistoryLoading(true); setHistoryError('');
    try {
      const bookings = await scheduleApi.getStudentBookings();
      setHistory(bookings.filter(booking => {
        const moment = bookingMoment(booking);
        return booking.status === 'completed' || (!!moment && moment.getTime() + booking.durationMinutes * 60000 <= Date.now());
      }).sort((a, b) => (bookingMoment(b)?.getTime() || 0) - (bookingMoment(a)?.getTime() || 0)));
    } catch { setHistoryError('Could not load your lesson history.'); }
    finally { setHistoryLoading(false); }
  };
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab]);

  modalCloseRef.current = showHeadsetModal ? closeHeadsetModal : showPreferencesModal ? closePreferencesModal : closeAboutMeModal;
  useEffect(() => {
    if (!showAboutMeModal && !showPreferencesModal && !showHeadsetModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('.student-profile-page [role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        modalCloseRef.current?.();
      }
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [showAboutMeModal, showPreferencesModal, showHeadsetModal]);

  // Loading state
  if (loading) {
    return (
      <div className="student-profile-page">
        <SideBar />
        <div className="student-profile-content">
          <Header />
          <div className="student-profile-main">
            <div className="loading-container">
              <ProfileArt name="home" />
              <p>Loading your profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !displayData) {
    return (
      <div className="student-profile-page">
        <SideBar />
        <div className="student-profile-content">
          <Header />
          <div className="student-profile-main">
            <div className="error-container">
              <CircleAlert size={18} />
              <p>{error || 'Failed to load profile'}</p>
              <button onClick={fetchProfile}><RotateCw size={16} />Try again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-profile-page">
      <SideBar />
      
      <div className="student-profile-content">
        <Header />
        
        <div className="student-profile-main">
          {/* Page Header */}
          <div className="profile-page-header">
            <div className="profile-header-left">
              <ProfileArt name="home" />
              <div>
                <span className="profile-page-subtitle">Your learning profile</span>
                <h1 className="profile-page-title">My Profile</h1>
              </div>
            </div>
          </div>

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
                <div className="profile-name-row">
                  <h2 className="profile-name">{displayData.name}</h2><p className="profile-email">{displayData.email}</p>
                </div>

                <div className="contact-info-grid">
                  <div className="contact-info-item">
                    <CalendarDays size={18} />
                    <span>Joined {displayData.joinDate}</span>
                  </div>
                  <div className="contact-info-item lessons-stat">
                    <span className="lessons-count">{displayData.totalLessons}</span>
                    <span>lessons completed</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Right side */}
              <div className="profile-action-buttons">
                <button 
                  className="profile-book-button"
                  onClick={() => route('/browse-tutors')}
                  title="View your schedule to book lessons"
                >
                  <CalendarDays size={18} />
                  <span>Book a Lesson</span>
                </button>
                <button className="test-headset-btn" onClick={openHeadsetModal}>
                  <Headphones size={18} />
                  <span>Test Headset</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs-container" role="group" aria-label="Profile views">
            {(['overview', 'history', 'materials'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                aria-pressed={activeTab === tab}
              >
                {tab === 'history' ? 'History & Notes' : tab === 'overview' ? 'Overview' : 'Materials'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="overview-grid">
              {/* About Me - Display Only */}
              <div className="content-card about-me-card">
                <div className="card-title-row">
                  <h3 className="card-title">
                    <ProfileArt name="community" />
                    About Me
                  </h3>
                  <button className="edit-about-me-btn" onClick={openAboutMeModal} aria-label="Edit about me" title="Edit about me">
                    <Pencil size={18} />
                  </button>
                </div>

                {/* Bio Display */}
                {aboutMe.bio && (
                  <div className="bio-display">
                    <p>{aboutMe.bio}</p>
                  </div>
                )}

                {/* Purpose Display */}
                <div className="about-me-display-field">
                  <span className="display-label">Purpose</span>
                  <span className="display-value">{aboutMe.purpose || 'Not set'}</span>
                </div>

                {/* Occupation Display */}
                <div className="about-me-display-field">
                  <span className="display-label">Occupation</span>
                  <span className="display-value">{aboutMe.occupation || 'Not set'}</span>
                </div>

                {/* Hobbies Display */}
                <div className="about-me-display-field">
                  <span className="display-label">Hobbies</span>
                  {aboutMe.hobbies.length > 0 ? (
                    <div className="hobbies-display">
                      {aboutMe.hobbies.map((hobby, idx) => (
                        <span key={idx} className="hobby-tag">{hobby}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="display-value">Not set</span>
                  )}
                </div>
              </div>

              {/* Level Assessment Card */}
              <div className="content-card assessment-card">
                <h3 className="card-title">
                  <ProfileArt name="growth" />
                  Level Assessment
                </h3>

                {assessmentHasData && assessmentData ? (
                  <>
                    <div className="assessment-summary-grid">
                      <div className="assessment-summary-item">
                        <span className="assessment-label">Student Level</span>
                        <strong>{assessmentData.studentLevel || 'Not recorded'}</strong>
                      </div>
                      <div className="assessment-summary-item">
                        <span className="assessment-label">Curriculum</span>
                        <strong>{assessmentData.curriculum || 'Not recorded'}</strong>
                      </div>
                      <div className="assessment-summary-item">
                        <span className="assessment-label">Date Assessed</span>
                        <strong>{formatAssessmentDate(assessmentData.dateAssessed)}</strong>
                      </div>
                    </div>

                    <div className="assessment-score-section">
                      <span className="assessment-section-label">Assessment Scores</span>
                      <div className="assessment-score-grid">
                        <div className="assessment-score-pill">
                          <span>Comprehension</span>
                          <strong>{formatAssessmentScore(assessmentData.scores?.comprehension, assessmentData.scores?.maxScore)}</strong>
                        </div>
                        <div className="assessment-score-pill">
                          <span>Pronunciation</span>
                          <strong>{formatAssessmentScore(assessmentData.scores?.pronunciation, assessmentData.scores?.maxScore)}</strong>
                        </div>
                        <div className="assessment-score-pill">
                          <span>Grammar</span>
                          <strong>{formatAssessmentScore(assessmentData.scores?.grammar, assessmentData.scores?.maxScore)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="assessment-remarks">
                      <span className="assessment-section-label">Assessment Remarks</span>
                      {assessmentData.remarks && assessmentData.remarks.length > 0 ? (
                        <ul>
                          {assessmentData.remarks.map((remark, index) => (
                            <li key={`${remark}-${index}`}>{remark}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="assessment-empty-text">No remarks recorded.</p>
                      )}
                    </div>

                    <div className="assessment-footer">
                      <span>Assessment conducted by</span>
                      <strong>{assessmentData.assessedBy || 'Not recorded'}</strong>
                    </div>
                  </>
                ) : (
                  <div className="assessment-empty-state">
                    <span className="assessment-empty-icon">
                      <ProfileArt name="growth" />
                    </span>
                    <strong>No level assessment yet</strong>
                    <p>Your assessment results will appear here after they are recorded.</p>
                  </div>
                )}
              </div>

              {/* Lesson Preferences Card */}
              <div className="content-card preferences-card preferences-card-v2">
                <div className="card-title-row">
                  <h3 className="card-title">
                    <ProfileArt name="schedule" />
                    Lesson Preferences
                  </h3>
                  <button className="edit-about-me-btn" onClick={openPreferencesModal} aria-label="Edit lesson preferences" title="Edit lesson preferences">
                    <Pencil size={18} />
                  </button>
                </div>

                <div className="lesson-preferences-display">
                  <div className="lesson-preference-display-item">
                    <span className="display-label">Session Setup</span>
                    <span className="display-value">{preferences.preferCameraOn ? 'Prefer camera on' : 'Start audio-first'}</span>
                  </div>
                  <div className="lesson-preference-display-item">
                    <span className="display-label">Correction Style</span>
                    <span className="display-value">{getErrorCorrectionLabel(preferences.errorCorrection)}</span>
                    <span className="display-helper">{getErrorCorrectionDescription(preferences.errorCorrection)}</span>
                  </div>
                  <div className="lesson-preference-display-item">
                    <span className="display-label">Other Requests</span>
                    <span className="display-value">{preferences.otherRequests || 'None added'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && <section className="profile-history-section">
            <div className="profile-section-heading"><ProfileArt name="schedule" /><h3>History & Notes</h3><a href="/schedule?tab=past">All past lessons<ArrowRight size={16} /></a></div>
            {historyLoading ? <p role="status">Loading lesson history...</p> : historyError ? <div role="alert"><p>{historyError}</p><button className="profile-secondary-button" onClick={loadHistory}><RotateCw size={16} />Try again</button></div> : history.length ? <div className="profile-history-list">{history.map(booking => {
              const moment = bookingMoment(booking);
              return <a className="profile-history-item" href={`/lesson/${encodeURIComponent(booking.bookingId)}`} key={booking.bookingId}>
                <ProfileAvatar src={booking.tutorAvatar} alt={booking.tutorName || 'Tutor'} className="profile-history-avatar" fallback={booking.tutorName?.[0] || 'T'} />
                <div><h4>{booking.tutorName || 'Tutor'}</h4><p>{moment ? moment.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' JST' : booking.slotDate} · {booking.durationMinutes} min</p></div>
                <span>{booking.status === 'cancelled' ? 'Cancelled' : 'Lesson details & notes'}</span><ArrowRight size={18} />
              </a>;
            })}</div> : <div className="profile-empty"><ProfileArt name="training" /><h3>No lesson history yet</h3></div>}
          </section>}

          {activeTab === 'materials' && (
            <div className="materials-selector-container">
              {!selectedCourse ? (
                <>
                  <div className="materials-header-section">
                    <ProfileArt name="training" />
                    <h3>Choose a Course</h3>
                    <p>Select a course to start your learning journey</p>
                  </div>
                  
                  {/* Last Viewed Course */}
                  {lastViewedCourse && (
                    <div className="last-viewed-course">
                      <div className="last-viewed-label">
                        <CalendarDays size={18} />
                        <span>Continue Learning</span>
                      </div>
                      <div
                        className="last-viewed-card"
                      >
                        <div className="last-viewed-icon">
                          <ProfileArt name={courses.find(c => c.id === lastViewedCourse)?.icon || 'training'} />
                        </div>
                        <div className="last-viewed-info">
                          <h4>{courses.find(c => c.id === lastViewedCourse)?.name || 'Learning material'}</h4>
                          {lastViewedLesson ? (
                            <div className="last-viewed-lesson-details">
                              <div className="lesson-detail-item">
                                <span className="detail-label">Level</span>
                                <span className="detail-value">{lastViewedLesson.level}</span>
                              </div>
                              <span className="detail-separator">•</span>
                              <div className="lesson-detail-item">
                                <span className="detail-label">Chapter</span>
                                <span className="detail-value">{lastViewedLesson.chapter}</span>
                              </div>
                              <span className="detail-separator">•</span>
                              <div className="lesson-detail-item">
                                <span className="detail-label">Lesson</span>
                                <span className="detail-value">{lastViewedLesson.lessonNumber}</span>
                              </div>
                              <span className="detail-separator">•</span>
                              <div className="lesson-detail-item">
                                <span className="detail-label">{lastViewedLesson.skill}</span>
                              </div>
                              <span className="detail-separator">•</span>
                              <div className="lesson-detail-item">
                                <span className="detail-value">{lastViewedLesson.title}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="last-viewed-subtitle">Pick up where you left off</span>
                          )}
                        </div>
                        <button 
                          className="last-viewed-view-btn" aria-label="Preview last viewed lesson"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (lastViewedLesson?.lessonId) {
                              window.open(`/lesson/view?id=${lastViewedLesson.lessonId}`, '_blank');
                            }
                          }}
                          title="Preview last viewed lesson"
                        >
                          <Eye size={18} />
                        </button>
                        <button className="profile-secondary-button" onClick={() => setSelectedCourse(lastViewedCourse)}>Continue<ArrowRight size={16} /></button>
                      </div>
                    </div>
                  )}
                  
                  <div className="course-cards-grid">
                    {courses.map(course => (
                      <button type="button"
                        key={course.id}
                        className="course-select-card"
                        onClick={() => setSelectedCourse(course.id)}
                      >
                        <ProfileArt name={course.icon} />
                        <h4>{course.name}</h4>
                        <span className="course-card-category">{course.category}</span><ArrowRight size={18} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="materials-nav-header">
                    <button 
                      className="back-to-courses-btn"
                      onClick={() => {
                        setSelectedCourse(null);
                        setLessons([]);
                        setSelectedLevel(null);
                      }}
                    >
                      <ArrowLeft size={18} />
                      Back to Courses
                    </button>
                    <h3>{courses.find(c => c.id === selectedCourse)?.name}</h3>
                  </div>
                  
                  {loadingLessons ? (
                    <div className="loading-lessons">
                      <LoaderCircle size={18} />
                      <p>Loading lessons...</p>
                    </div>
                  ) : lessonsError ? (<div role="alert" className="profile-empty"><p>{lessonsError}</p><button className="profile-secondary-button" onClick={loadCourseLessons}><RotateCw size={16} />Try again</button></div>) : lessons.length === 0 ? (
                    <div className="empty-state">
                      <NotebookPen size={18} />
                      <h3>No Lessons Available</h3>
                      <p>There are no published lessons for this course yet</p>
                    </div>
                  ) : (
                    <div className="lessons-by-level">
                      {Object.keys(groupedLessons).sort((a, b) => Number(a) - Number(b)).map(levelKey => {
                        const level = Number(levelKey);
                        const isLevelExpanded = expandedLevels.includes(level);
                        const chapters = groupedLessons[level];
                        const totalLessonsInLevel = Object.values(chapters).flat().length;
                        
                        return (
                          <div key={level} className={`level-accordion ${isLevelExpanded ? 'expanded' : ''}`}>
                            <button 
                              className="level-accordion-header" aria-expanded={isLevelExpanded}
                              onClick={() => toggleLevel(level)}
                            >
                              <div className="level-accordion-info">
                                <span className="level-badge">Level {level}</span>
                                <span className="level-lesson-count">{totalLessonsInLevel} lessons available</span>
                              </div>
                              {isLevelExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            
                            {isLevelExpanded && (
                              <div className="level-accordion-content">
                                {Object.keys(chapters).sort((a, b) => Number(a) - Number(b)).map(chapterKey => {
                                  const chapter = Number(chapterKey);
                                  const chapterLessons = chapters[chapter];
                                  const chapterAccordionKey = `${level}-${chapter}`;
                                  const isChapterExpanded = expandedChapters.includes(chapterAccordionKey);
                                  
                                  return (
                                    <div key={chapterAccordionKey} className={`chapter-accordion ${isChapterExpanded ? 'expanded' : ''}`}>
                                      <button 
                                        className="chapter-accordion-header" aria-expanded={isChapterExpanded}
                                        onClick={() => toggleChapter(chapterAccordionKey)}
                                      >
                                        <div className="chapter-accordion-info">
                                          <span className="chapter-title">Chapter {chapter}</span>
                                          <span className="chapter-lesson-count">{chapterLessons.length} lessons</span>
                                        </div>
                                        {isChapterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </button>
                                      
                                      {isChapterExpanded && (
                                        <div className="chapter-accordion-content">
                                          <div className="lessons-table-container">
                                            <table className="lessons-table">
                                              <thead>
                                                <tr>
                                                  <th>Lesson</th>
                                                  <th>Skill</th>
                                                  <th>Title</th>
                                                  <th>Goal</th>
                                                  <th></th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {chapterLessons.sort((a, b) => getLessonNumber(a) - getLessonNumber(b)).map(lesson => (
                                                  <tr key={lesson.id} className="lesson-row">
                                                    <td className="lesson-col-number">
                                                      {getLessonNumber(lesson)}
                                                    </td>
                                                    <td className="lesson-col-skill">
                                                      {(lesson.lessonData as any)?.skill || 'Speaking'}
                                                    </td>
                                                    <td className="lesson-col-title">
                                                      {lesson.title}
                                                    </td>
                                                    <td className="lesson-col-goal">
                                                      {lesson.lessonData?.header?.goalText || 'English conversation practice'}
                                                    </td>
                                                    <td className="lesson-col-actions">
                                                      <button 
                                                        className="btn-view-lesson"
                                                        onClick={(e) => handleViewLesson(lesson, e)}
                                                        title="Preview lesson"
                                                      >
                                                        <Eye size={18} />
                                                      </button>
                                                      <button 
                                                        className="btn-choose-lesson"
                                                        onClick={(e) => handleChooseLesson(lesson, e)}
                                                      >
                                                        <Check size={18} />
                                                        Choose Lesson
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Headset Test Modal */}
      {showHeadsetModal && (
        <div className="headset-modal-overlay" onClick={closeHeadsetModal}>
          <div className="headset-modal" role="dialog" aria-modal="true" aria-label="Device & Media Test" onClick={(e) => e.stopPropagation()}>
            <div className="headset-modal-header">
              <h2>
                <Monitor size={18} />
                Device & Media Test
              </h2>
              <button className="modal-close-btn" aria-label="Close device test" title="Close device test" onClick={closeHeadsetModal}>
                <X size={18} />
              </button>
            </div>

            <div className="headset-modal-content">
              {/* Microphone Test */}
              <div className="test-section">
                <h3>
                  <Mic size={18} />
                  Microphone Test
                </h3>
                {micPermission === 'pending' && (
                  <div className="mic-status pending">
                    <LoaderCircle size={18} />
                    Requesting microphone access...
                  </div>
                )}
                {micPermission === 'denied' && (
                  <div className="mic-status denied">
                    <CircleAlert size={18} />
                    Microphone access denied. Please allow access in your browser settings.
                  </div>
                )}
                {micPermission === 'granted' && (
                  <div className="mic-test-area">
                    <div className="mic-status granted">
                      <Check size={18} />
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
                  <Camera size={18} />
                  Camera Test
                </h3>
                {camPermission === 'pending' && (
                  <div className="cam-status pending">
                    <LoaderCircle size={18} />
                    Requesting camera access...
                  </div>
                )}
                {camPermission === 'denied' && (
                  <div className="cam-status denied">
                    <CircleAlert size={18} />
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
                        <Play size={18} />
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
                        <RotateCw size={18} />
                        <span>Restart Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Speaker Test */}
              <div className="test-section">
                <h3>
                  <Volume2 size={18} />
                  Speaker Test
                </h3>
                <p className="test-description">Click the buttons below to test your left and right speakers.</p>
                <div className="speaker-buttons">
                  <button 
                    className={`speaker-btn left ${isPlayingLeft ? 'playing' : ''}`}
                    onClick={() => playTestSound('left')}
                    disabled={isPlayingLeft}
                  >
                    <ArrowLeft size={18} />
                    <span>Left Speaker</span>
                    {isPlayingLeft && <div className="sound-wave"></div>}
                  </button>
                  <button 
                    className={`speaker-btn right ${isPlayingRight ? 'playing' : ''}`}
                    onClick={() => playTestSound('right')}
                    disabled={isPlayingRight}
                  >
                    <span>Right Speaker</span>
                    <ArrowRight size={18} />
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

      {/* Lesson Preferences Edit Modal */}
      {showPreferencesModal && (
        <div className="about-me-modal-overlay" onClick={closePreferencesModal}>
          <div className="about-me-modal preferences-edit-modal" role="dialog" aria-modal="true" aria-label="Edit Lesson Preferences" onClick={(e) => e.stopPropagation()}>
            <div className="about-me-modal-header">
              <div className="modal-header-icon">
                <SlidersHorizontal size={18} />
              </div>
              <div className="modal-header-text">
                <h2>Edit Lesson Preferences</h2>
                <p>Set your default classroom preferences</p>
              </div>
              <button className="close-modal-btn" aria-label="Close editor" title="Close editor" onClick={closePreferencesModal}>
                <X size={18} />
              </button>
            </div>

            <div className="about-me-modal-body">
              <label className="profile-camera-setting"><input type="checkbox" checked={editPreferences.preferCameraOn} onChange={event => setEditPreferences(prev => ({ ...prev, preferCameraOn: event.currentTarget.checked }))} />Prefer camera on</label>
              <fieldset className="profile-correction-settings"><legend>Correction style</legend>{([
                ['during_feedback', 'During feedback'], ['proactively', 'Proactively'], ['tutor_choice', "Tutor's choice"]
              ] as const).map(([value, label]) => <label key={value}><input type="radio" name="correction-style" value={value} checked={editPreferences.errorCorrection === value} onChange={() => setEditPreferences(prev => ({ ...prev, errorCorrection: value }))} /><span><strong>{label}</strong><small>{getErrorCorrectionDescription(value)}</small></span></label>)}</fieldset>
              <label className="about-me-field"><span className="field-label">Other requests</span><textarea aria-label="Other requests" value={editPreferences.otherRequests} maxLength={OTHER_REQUESTS_MAX_LENGTH} onInput={event => setEditPreferences(prev => ({ ...prev, otherRequests: event.currentTarget.value }))} rows={4} /><span className="char-count">{editPreferences.otherRequests.length}/{OTHER_REQUESTS_MAX_LENGTH}</span></label>
            </div>

            <div className="about-me-modal-footer">
              {preferencesMessage && (
                <span className={`preference-message ${preferencesMessage.type}`}>
                  {preferencesMessage.text}
                </span>
              )}
              <div className="modal-actions">
                <button className="cancel-btn" onClick={closePreferencesModal} disabled={savingPreferences}>
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={() => handleSavePreferences(editPreferences)}
                  disabled={savingPreferences || !hasEditPreferencesChanged()}
                >
                  {savingPreferences ? (
                    <><LoaderCircle size={18} /> Saving...</>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Me Edit Modal */}
      {showAboutMeModal && (
        <div className="about-me-modal-overlay" onClick={closeAboutMeModal}>
          <div className="about-me-modal" role="dialog" aria-modal="true" aria-label="Edit About Me" onClick={(e) => e.stopPropagation()}>
            <div className="about-me-modal-header">
              <div className="modal-header-icon">
                <UserRound size={18} />
              </div>
              <div className="modal-header-text">
                <h2>Edit About Me</h2>
                <p>Tell us more about yourself</p>
              </div>
              <button className="close-modal-btn" aria-label="Close editor" title="Close editor" onClick={closeAboutMeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="about-me-modal-body">
              {/* Bio */}
              <div className="about-me-field">
                <label className="field-label">
                  <NotebookPen size={18} />
                  Bio
                </label>
                <textarea
                  className="about-me-textarea" aria-label="Bio"
                  placeholder="Write a short bio about yourself..."
                  value={editAboutMe.bio}
                  onChange={(e) => setEditAboutMe(prev => ({ ...prev, bio: (e.target as HTMLTextAreaElement).value }))}
                  rows={3}
                  maxLength={300}
                />
                <span className="char-count">{editAboutMe.bio.length}/300</span>
              </div>

              {/* Purpose */}
              <div className="about-me-field">
                <label className="field-label">
                  <Target size={18} />
                  Purpose for Learning English
                </label>
                <select
                  className="about-me-select" aria-label="Purpose for learning English"
                  value={editAboutMe.purpose}
                  onChange={(e) => setEditAboutMe(prev => ({ ...prev, purpose: (e.target as HTMLSelectElement).value }))}
                >
                  <option value="">Select your purpose...</option>
                  {purposeChoices.map((purpose) => (
                    <option key={purpose} value={purpose}>{purpose}</option>
                  ))}
                </select>
              </div>

              {/* Occupation */}
              <div className="about-me-field">
                <label className="field-label">
                  <Briefcase size={18} />
                  Occupation
                </label>
                <select
                  className="about-me-select" aria-label="Occupation"
                  value={editAboutMe.occupation}
                  onChange={(e) => setEditAboutMe(prev => ({ ...prev, occupation: (e.target as HTMLSelectElement).value }))}
                >
                  <option value="">Select your occupation...</option>
                  {occupationChoices.map((occupation) => (
                    <option key={occupation} value={occupation}>{occupation}</option>
                  ))}
                </select>
              </div>

              {/* Hobbies - Multi-select with checkboxes */}
              <div className="about-me-field">
                <label className="field-label">
                  <Heart size={18} />
                  Hobbies & Interests
                </label>
                <div className="hobbies-grid">
                  {hobbyChoices.map((hobby) => (
                    <label key={hobby} className={`hobby-checkbox ${editAboutMe.hobbies.includes(hobby) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={editAboutMe.hobbies.includes(hobby)}
                        onChange={() => toggleHobby(hobby)}
                      />
                      <span className="checkbox-mark">
                        <Check size={18} />
                      </span>
                      <span className="hobby-label">{hobby}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="about-me-modal-footer">
              {aboutMeMessage && (
                <span className={`about-me-message ${aboutMeMessage.type}`}>
                  {aboutMeMessage.text}
                </span>
              )}
              <div className="modal-actions">
                <button className="cancel-btn" onClick={closeAboutMeModal}>
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={handleSaveAboutMe}
                  disabled={savingAboutMe}
                >
                  {savingAboutMe ? (
                    <><LoaderCircle size={18} /> Saving...</>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <div className="notification-content">
            {notification.type === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfilePage;

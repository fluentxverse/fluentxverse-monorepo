import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import {
  generateSpeakingExam,
  submitSpeakingExam,
  getActiveSpeakingExam,
  type ClientSpeakingExam,
  type SpeakingTask,
  type TaskRecording,
  type SpeakingExamResult,
} from '../api/exam.api';
import './SpeakingExamPage.css';

type ExamPhase = 
  | 'intro'           // Initial instructions
  | 'mic-test'        // Testing microphone
  | 'speaker-test'    // Testing speakers
  | 'loading'         // Generating exam
  | 'prep'            // Prep time before recording
  | 'recording'       // Currently recording
  | 'submitting'      // Submitting exam
  | 'results'         // Showing results
  | 'error';          // Microphone failure

// Prep time per task type (seconds)
const PREP_TIME: Record<SpeakingTask['type'], number> = {
  'read-aloud': 10,
  'picture-description': 15,
  'situational-response': 10,
  'teaching-demo': 15,
  'open-response': 12,
};

const SpeakingExamPage = () => {
  const { user } = useAuthContext();
  
  // Phase management
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [exam, setExam] = useState<ClientSpeakingExam | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [result, setResult] = useState<SpeakingExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);
  
  // Mic test state
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micLevel, setMicLevel] = useState(0);
  const [micDetectedOnce, setMicDetectedOnce] = useState(false);
  const [micTestPassed, setMicTestPassed] = useState(false);
  const [speakerTestPassed, setSpeakerTestPassed] = useState(false);
  
  // Recording state
  const [recordings, setRecordings] = useState<TaskRecording[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Recording timing
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    document.title = 'Speaking Proficiency Test | FluentXVerse';
    return () => {
      // Cleanup on unmount
      stopMicAnalysis();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Current task helper
  const currentTask = exam?.tasks[currentTaskIndex] || null;

  // ============================================================================
  // MICROPHONE HANDLING
  // ============================================================================
  
  const requestMicPermission = async () => {
    console.log('🎤 Requesting microphone permission...');
    
    // Check if we already have a stream
    if (streamRef.current) {
      console.log('✅ Stream already exists, setting up audio context');
      setMicPermission('granted');
      setupAudioContext(streamRef.current);
      return;
    }
    
    try {
      // Check existing permission state first
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('📋 Current permission state:', permissionStatus.state);
        } catch (e) {
          // permissions.query might not support microphone in all browsers
          console.log('📋 Could not query permission state');
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');
      streamRef.current = stream;
      setMicPermission('granted');
      setupAudioContext(stream);
    } catch (err) {
      console.error('❌ Mic permission denied:', err);
      setMicPermission('denied');
      setError('Microphone access is required for the speaking exam. Please allow microphone access and try again.');
      setPhase('error');
    }
  };
  
  const setupAudioContext = (stream: MediaStream) => {
    // Clean up existing audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    // Set up audio analysis for level visualization
    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);
    
    // Start level monitoring
    startMicLevelMonitoring();
  };

  const startMicLevelMonitoring = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = Math.min(100, (average / 128) * 100);
      setMicLevel(normalizedLevel);
      
      // Once mic is detected, keep it detected
      if (normalizedLevel > 5) {
        setMicDetectedOnce(true);
      }
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  const stopMicAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    stopMicAnalysis();
  };

  // ============================================================================
  // RECORDING HANDLING
  // ============================================================================

  const startRecording = async () => {
    console.log('🎙️ Starting recording for task:', currentTaskIndex + 1);
    
    // Clear any existing timer first to prevent race conditions
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (!streamRef.current) {
      // Try to get mic permission again
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err) {
        setError('Microphone access lost. Exam failed.');
        setPhase('error');
        return;
      }
    }
    
    audioChunksRef.current = [];
    
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = () => {
        setError('Recording failed. Exam failed.');
        setPhase('error');
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      recordingStartRef.current = Date.now();
      
      // Play start cue sound
      playStartCue();
      
      // Start recording phase
      const taskTime = currentTask?.timeLimit || 30;
      console.log('⏱️ Recording for', taskTime, 'seconds');
      setTimeRemaining(taskTime);
      setPhase('recording');
      
      // Start countdown - use a simple counter approach
      let timeLeft = taskTime;
      timerRef.current = window.setInterval(() => {
        timeLeft -= 1;
        setTimeRemaining(timeLeft);
        
        if (timeLeft <= 0) {
          // Time's up - clear timer and stop recording
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Use setTimeout to avoid calling async from interval
          setTimeout(() => stopRecordingAndAdvance(), 0);
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Exam failed.');
      setPhase('error');
    }
  };

  const stopRecordingAndAdvance = async () => {
    console.log('🛑 Stopping recording and advancing...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      console.log('⚠️ No active recording, advancing without saving');
      advanceToNextTask();
      return;
    }
    
    const mediaRecorder = mediaRecorderRef.current;
    
    // Get final recording
    const newRecording = await new Promise<TaskRecording>((resolve) => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        console.log('📼 Recording captured:', duration, 'seconds, size:', audioBlob.size);
        
        // Convert to base64 for submission
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log('📦 Base64 converted, length:', base64.length);
          
          const recording: TaskRecording = {
            taskId: currentTask?.id || 0,
            audioUrl: base64,
            duration,
          };
          
          resolve(recording);
        };
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.stop();
    });
    
    // Update recordings state
    const updatedRecordings = [...recordings, newRecording];
    setRecordings(updatedRecordings);
    console.log('📝 Total recordings so far:', updatedRecordings.length);
    
    mediaRecorderRef.current = null;
    advanceToNextTask(updatedRecordings);
  };

  const advanceToNextTask = (currentRecordings?: TaskRecording[]) => {
    if (!exam) return;
    
    const nextIndex = currentTaskIndex + 1;
    console.log('➡️ Advancing to task', nextIndex + 1, 'of', exam.tasks.length);
    
    if (nextIndex >= exam.tasks.length) {
      // All tasks completed - submit exam with passed recordings
      console.log('✅ All tasks completed, submitting exam with', currentRecordings?.length || recordings.length, 'recordings');
      submitExam(currentRecordings || recordings);
    } else {
      // Move to next task
      setCurrentTaskIndex(nextIndex);
      startPrepPhase(exam.tasks[nextIndex]);
    }
  };

  // ============================================================================
  // PHASE HANDLERS
  // ============================================================================

  const startMicTest = () => {
    console.log('🔧 Starting mic test...');
    setPhase('mic-test');
    requestMicPermission();
  };

  const confirmMicTest = () => {
    if (micDetectedOnce) {
      setMicTestPassed(true);
      setPhase('speaker-test');
    }
  };

  const playSpeakerTest = () => {
    // Create a test tone
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440; // A4 note
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    
    // Play for 1 second
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 1000);
  };

  const playStartCue = () => {
    // Play a short "toot" sound to indicate recording has started
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Higher pitch "toot" sound
    oscillator.frequency.value = 880; // A5 note (higher pitch)
    oscillator.type = 'sine';
    gainNode.gain.value = 0.4;
    
    // Quick fade out for cleaner sound
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start();
    
    // Short beep - 300ms
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 300);
  };

  const confirmSpeakerTest = () => {
    setSpeakerTestPassed(true);
  };

  const startExam = async () => {
    if (!user?.userId) return;
    
    setPhase('loading');
    setError(null);
    
    try {
      // Check for active exam first
      const activeRes = await getActiveSpeakingExam(user.userId);
      if (activeRes.success && activeRes.exam) {
        setExam(activeRes.exam);
        startPrepPhase(activeRes.exam.tasks[0]);
        return;
      }
      
      // Generate new exam
      const res = await generateSpeakingExam(user.userId);
      if (res.success && res.exam) {
        setExam(res.exam);
        startPrepPhase(res.exam.tasks[0]);
      } else {
        setError(res.message || 'Failed to generate exam');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start exam');
    }
  };

  const startPrepPhase = (task: SpeakingTask) => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const prepTime = PREP_TIME[task.type];
    console.log('📋 Starting prep phase for', prepTime, 'seconds');
    setTimeRemaining(prepTime);
    setPhase('prep');
    
    // Use a simple counter approach instead of setState callback
    let timeLeft = prepTime;
    timerRef.current = window.setInterval(() => {
      timeLeft -= 1;
      setTimeRemaining(timeLeft);
      
      if (timeLeft <= 0) {
        // Prep time over - clear timer and start recording
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        console.log('📋 Prep time finished, starting recording');
        setTimeout(() => startRecording(), 0);
      }
    }, 1000);
  };

  const skipPrepTime = () => {
    console.log('⏭️ Skipping prep time');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Use setTimeout to ensure clean transition
    setTimeout(() => startRecording(), 0);
  };

  const submitExam = async (recordingsToSubmit: TaskRecording[]) => {
    if (!exam || !user?.userId) return;
    
    console.log('📤 Submitting exam with', recordingsToSubmit.length, 'recordings');
    setPhase('submitting');
    stopStream();
    
    try {
      const res = await submitSpeakingExam(exam.examId, user.userId, recordingsToSubmit);
      if (res.success && res.result) {
        setResult(res.result);
        setPhase('results');
      } else {
        setError(res.message || 'Failed to submit exam');
        setPhase('error');
      }
    } catch (err: any) {
      console.error('❌ Submit error:', err);
      setError(err.message || 'Failed to submit exam');
      setPhase('error');
    }
  };

  // ============================================================================
  // FORMAT HELPERS
  // ============================================================================

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTaskTypeLabel = (type: SpeakingTask['type']): string => {
    const labels: Record<SpeakingTask['type'], string> = {
      'read-aloud': 'Read Aloud',
      'picture-description': 'Picture Description',
      'situational-response': 'Situational Response',
      'teaching-demo': 'Teaching Demonstration',
      'open-response': 'Open Response',
    };
    return labels[type];
  };

  const getTaskIcon = (type: SpeakingTask['type']): string => {
    const icons: Record<SpeakingTask['type'], string> = {
      'read-aloud': 'fa-book',
      'picture-description': 'fa-image',
      'situational-response': 'fa-comments',
      'teaching-demo': 'fa-chalkboard-teacher',
      'open-response': 'fa-microphone',
    };
    return icons[type];
  };

  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  const renderIntro = () => (
    <div className="exam-intro">
      <div className="exam-intro-card speaking">
        <div className="exam-intro-icon">
          <i className="fas fa-microphone" />
        </div>
        <h2>Speaking Proficiency Test</h2>
        <p className="exam-intro-description">
          This exam assesses your English speaking skills through various task types.
          You will be recorded and evaluated by AI on pronunciation, fluency, vocabulary,
          grammar, coherence, and task completion.
        </p>

        <div className="exam-info-grid">
          <div className="exam-info-item">
            <i className="fas fa-tasks" />
            <span>10 Tasks</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-clock" />
            <span>~15 mins</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-trophy" />
            <span>85% to Pass</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-redo" />
            <span>2 Attempts/Month</span>
          </div>
        </div>

        <div className="exam-categories">
          <h4>Task Types</h4>
          <div className="category-tags">
            <span className="category-tag">
              <i className="fas fa-book" /> Read Aloud
            </span>
            <span className="category-tag">
              <i className="fas fa-image" /> Picture Description
            </span>
            <span className="category-tag">
              <i className="fas fa-comments" /> Situational Response
            </span>
            <span className="category-tag">
              <i className="fas fa-chalkboard-teacher" /> Teaching Demo
            </span>
            <span className="category-tag">
              <i className="fas fa-microphone" /> Open Response
            </span>
          </div>
        </div>

        <div className="exam-rules speaking-rules">
          <h4><i className="fas fa-exclamation-triangle" /> Important Instructions</h4>
          <ul>
            <li><strong>Microphone Required:</strong> You must have a working microphone.</li>
            <li><strong>Quiet Environment:</strong> Find a quiet place with minimal background noise.</li>
            <li><strong>One Chance Per Task:</strong> You cannot re-record a task once it's completed.</li>
            <li><strong>No Pausing:</strong> The exam cannot be paused once started.</li>
            <li><strong>Browser Access:</strong> Please allow microphone access when prompted.</li>
            <li><strong>Recording Failure = Fail:</strong> If your microphone fails during the exam, it will be marked as failed.</li>
          </ul>
        </div>

        <button className="start-exam-btn" onClick={startMicTest}>
          <i className="fas fa-cog" /> Test Your Equipment
        </button>
      </div>
    </div>
  );

  const renderMicTest = () => (
    <div className="exam-intro">
      <div className="equipment-test-card">
        <div className="test-icon mic">
          <i className="fas fa-microphone" />
        </div>
        <h2>Microphone Test</h2>
        <p>Speak into your microphone to test it. The level meter should move when you speak.</p>

        {micPermission === 'pending' && (
          <div className="permission-prompt">
            <div className="loading-spinner small" />
            <p>Requesting microphone access...</p>
          </div>
        )}

        {micPermission === 'denied' && (
          <div className="permission-denied">
            <i className="fas fa-times-circle" />
            <p>Microphone access denied. Please enable it in your browser settings.</p>
            <button className="retry-btn" onClick={requestMicPermission}>
              Try Again
            </button>
          </div>
        )}

        {micPermission === 'granted' && (
          <>
            <div className="mic-level-container">
              <div className="mic-level-bar">
                <div 
                  className="mic-level-fill" 
                  style={{ width: `${micLevel}%` }}
                />
              </div>
              <span className="mic-level-label">
                {micDetectedOnce ? '✓ Microphone detected!' : 'Speak now...'}
              </span>
            </div>

            <div className="test-instructions">
              <p>👋 Say "Hello, my name is..." to test your microphone.</p>
            </div>

            <button 
              className={`confirm-test-btn ${micDetectedOnce ? 'active' : 'disabled'}`}
              onClick={confirmMicTest}
              disabled={!micDetectedOnce}
            >
              <i className="fas fa-check-circle" /> Microphone Works
            </button>
          </>
        )}
      </div>
    </div>
  );

  const renderSpeakerTest = () => (
    <div className="exam-intro">
      <div className="equipment-test-card">
        <div className="test-icon speaker">
          <i className="fas fa-volume-up" />
        </div>
        <h2>Speaker Test</h2>
        <p>Click the button below to play a test sound. Make sure you can hear it clearly.</p>

        <button className="play-sound-btn" onClick={playSpeakerTest}>
          <i className="fas fa-play-circle" /> Play Test Sound
        </button>

        <div className="speaker-confirm">
          <p>Did you hear the sound?</p>
          <div className="confirm-buttons">
            <button className="confirm-yes" onClick={confirmSpeakerTest}>
              <i className="fas fa-check" /> Yes, I heard it
            </button>
            <button className="confirm-no" onClick={playSpeakerTest}>
              <i className="fas fa-redo" /> Play Again
            </button>
          </div>
        </div>

        {speakerTestPassed && (
          <div className="all-tests-passed">
            <i className="fas fa-check-circle" />
            <p>All equipment tests passed!</p>
            <button className="start-exam-btn" onClick={startExam}>
              <i className="fas fa-play" /> Start Speaking Exam
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="exam-loading">
      <div className="loading-spinner" />
      <h3>Generating Your Speaking Exam</h3>
      <p>We are creating personalized speaking tasks for you...</p>
    </div>
  );

  const renderTaskContent = () => {
    if (!currentTask) return null;

    switch (currentTask.type) {
      case 'read-aloud':
        return (
          <div className="task-content read-aloud">
            <p className="task-instruction">{currentTask.instruction}</p>
            <div className="read-aloud-text">
              <p>{currentTask.sentence}</p>
            </div>
          </div>
        );

      case 'picture-description':
        return (
          <div className="task-content picture-description">
            <p className="task-instruction">{currentTask.instruction}</p>
            <div className="task-image-container">
              <img src={currentTask.imageUrl} alt="Describe this image" />
            </div>
          </div>
        );

      case 'situational-response':
        return (
          <div className="task-content situational-response">
            <p className="task-instruction">{currentTask.instruction}</p>
            <div className="scenario-box">
              <h4>Scenario:</h4>
              <p>{currentTask.scenario}</p>
            </div>
            <div className="prompt-box">
              <h4>Your Task:</h4>
              <p>{currentTask.prompt}</p>
            </div>
          </div>
        );

      case 'teaching-demo':
        return (
          <div className="task-content teaching-demo">
            <p className="task-instruction">{currentTask.instruction}</p>
            <div className="teaching-topic">
              <h4>Topic to Explain:</h4>
              <p>{currentTask.topic}</p>
            </div>
            <div className="target-level">
              <span className={`level-badge ${currentTask.targetLevel}`}>
                Target: {currentTask.targetLevel.charAt(0).toUpperCase() + currentTask.targetLevel.slice(1)} Students
              </span>
            </div>
          </div>
        );

      case 'open-response':
        return (
          <div className="task-content open-response">
            <p className="task-instruction">{currentTask.instruction}</p>
            <div className="question-box">
              <p>{currentTask.question}</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderPrep = () => (
    <div className="exam-task-container">
      <div className="task-header">
        <div className="task-progress">
          <span>Task {currentTaskIndex + 1} of {exam?.tasks.length || 10}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentTaskIndex) / (exam?.tasks.length || 10)) * 100}%` }}
            />
          </div>
        </div>
        <div className="task-type-badge">
          <i className={`fas ${getTaskIcon(currentTask?.type || 'read-aloud')}`} />
          <span>{getTaskTypeLabel(currentTask?.type || 'read-aloud')}</span>
        </div>
      </div>

      <div className="task-main prep-phase">
        <div className="prep-timer">
          <div className="timer-circle prep">
            <span className="timer-value">{timeRemaining}</span>
            <span className="timer-label">Prep Time</span>
          </div>
        </div>

        <div className="prep-instructions">
          <p><i className="fas fa-eye" /> Read and prepare your response</p>
        </div>

        {renderTaskContent()}

        <button className="skip-prep-btn" onClick={skipPrepTime}>
          <i className="fas fa-forward" /> I'm Ready - Start Recording
        </button>
      </div>
    </div>
  );

  const renderRecording = () => (
    <div className="exam-task-container">
      <div className="task-header">
        <div className="task-progress">
          <span>Task {currentTaskIndex + 1} of {exam?.tasks.length || 10}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentTaskIndex) / (exam?.tasks.length || 10)) * 100}%` }}
            />
          </div>
        </div>
        <div className="task-type-badge">
          <i className={`fas ${getTaskIcon(currentTask?.type || 'read-aloud')}`} />
          <span>{getTaskTypeLabel(currentTask?.type || 'read-aloud')}</span>
        </div>
      </div>

      <div className="task-main recording-phase">
        <div className="recording-indicator">
          <div className="recording-dot pulse" />
          <span>Recording...</span>
        </div>

        <div className="recording-timer">
          <div className="timer-circle recording">
            <span className="timer-value">{formatTime(timeRemaining)}</span>
            <span className="timer-label">Time Left</span>
          </div>
        </div>

        {renderTaskContent()}

        <div className="recording-actions">
          <button className="done-speaking-btn" onClick={stopRecordingAndAdvance}>
            <i className="fas fa-forward" /> Done Speaking - Next Task
          </button>
        </div>

        <div className="recording-hint">
          <i className="fas fa-info-circle" />
          <span>Speak clearly into your microphone. Recording will stop automatically.</span>
        </div>
      </div>
    </div>
  );

  const renderSubmitting = () => (
    <div className="exam-loading submitting-exam">
      <div className="loading-spinner" />
      <h3>Processing Your Exam</h3>
      <p>Your recordings are being transcribed and evaluated by our AI.</p>
      <div className="submitting-progress">
        <div className="progress-steps">
          <div className="step active">
            <i className="fas fa-upload" />
            <span>Uploading</span>
          </div>
          <div className="step active">
            <i className="fas fa-microphone" />
            <span>Transcribing</span>
          </div>
          <div className="step">
            <i className="fas fa-check-circle" />
            <span>Grading</span>
          </div>
        </div>
        <p className="time-estimate">
          <i className="fas fa-clock" /> This usually takes 1-2 minutes. Please don't close this page.
        </p>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!result) return null;

    const getScoreColor = (score: number) => {
      if (score >= 85) return 'excellent';
      if (score >= 70) return 'good';
      if (score >= 50) return 'fair';
      return 'poor';
    };

    return (
      <div className="exam-results speaking-results">
        <div className="results-header">
          <div className={`result-badge ${result.passed ? 'passed' : 'failed'}`}>
            <i className={`fas ${result.passed ? 'fa-check-circle' : 'fa-times-circle'}`} />
            <span>{result.passed ? 'PASSED' : 'FAILED'}</span>
          </div>
          <h2>Speaking Exam Results</h2>
        </div>

        <div className="score-overview">
          <div className={`overall-score ${getScoreColor(result.overallScore)}`}>
            <span className="score-value">{Math.round(result.overallScore)}%</span>
            <span className="score-label">Overall Score</span>
          </div>
          <p className="passing-note">
            {result.passed 
              ? '🎉 Congratulations! You have passed the speaking exam.'
              : `You needed 85% to pass. You have ${2 - 1} attempt(s) remaining this month.`
            }
          </p>
        </div>

        <div className="section-scores">
          <h3>Category Breakdown</h3>
          <div className="score-grid">
            {Object.entries(result.sectionAverages).map(([category, score]) => (
              <div key={category} className="score-item">
                <span className="score-category">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </span>
                <div className="score-bar-container">
                  <div 
                    className={`score-bar ${getScoreColor(score * 20)}`}
                    style={{ width: `${score * 20}%` }}
                  />
                </div>
                <span className="score-number">{score.toFixed(1)}/5</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overall-feedback">
          <h3>Feedback</h3>
          <p>{result.overallFeedback}</p>
        </div>

        <div className="task-scores-detail">
          <h3>Task Details</h3>
          {result.taskScores.map((taskScore, index) => (
            <div key={taskScore.taskId} className="task-score-card">
              <div className="task-score-header">
                <span className="task-number">Task {index + 1}</span>
                <span className="task-type">{getTaskTypeLabel(taskScore.taskType)}</span>
                <span className={`task-percentage ${getScoreColor(taskScore.percentage)}`}>
                  {Math.round(taskScore.percentage)}%
                </span>
              </div>
              <p className="task-feedback">{taskScore.feedback}</p>
            </div>
          ))}
        </div>

        <div className="results-actions">
          <a href="/home" className="back-home-btn">
            <i className="fas fa-home" /> Back to Dashboard
          </a>
        </div>
      </div>
    );
  };

  const renderError = () => (
    <div className="exam-error">
      <div className="error-card">
        <div className="error-icon">
          <i className="fas fa-times-circle" />
        </div>
        <h2>Exam Failed</h2>
        <p>{error || 'An error occurred during the exam.'}</p>
        <div className="error-actions">
          <a href="/home" className="back-home-btn">
            <i className="fas fa-home" /> Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const renderContent = () => {
    switch (phase) {
      case 'intro':
        return renderIntro();
      case 'mic-test':
        return renderMicTest();
      case 'speaker-test':
        return renderSpeakerTest();
      case 'loading':
        return renderLoading();
      case 'prep':
        return renderPrep();
      case 'recording':
        return renderRecording();
      case 'submitting':
        return renderSubmitting();
      case 'results':
        return renderResults();
      case 'error':
        return renderError();
      default:
        return renderIntro();
    }
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <main className="speaking-exam-page">
          {renderContent()}
        </main>
      </div>
    </>
  );
};

export default SpeakingExamPage;

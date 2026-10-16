import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { generateSpeakingExam, submitSpeakingExam, getActiveSpeakingExam, type ClientSpeakingExam, type SpeakingTask, type TaskRecording, type SpeakingExamResult, } from '../api/exam.api';
import './SpeakingExamPage.css';
type ExamPhase = 'intro' // Initial instructions
 | 'mic-test' // Testing microphone
 | 'speaker-test' // Testing speakers
 | 'loading' // Generating exam
 | 'prep' // Prep time before recording
 | 'recording' // Currently recording
 | 'submitting' // Submitting exam
 | 'results' // Showing results
 | 'error'; // Microphone failure
// Prep time per task type (seconds)
const PREP_TIME: Record<SpeakingTask['type'], number> = {
    'read-aloud': 10,
    'picture-description': 15,
    'situational-response': 10,
    'teaching-demo': 15,
    'open-response': 12
};
const SpeakingExamPage = () => {
    const _state0 = useAuthContext();
    // Phase management
    const [phase, setPhase] = createSignal<ExamPhase>('intro');
    const [exam, setExam] = createSignal<ClientSpeakingExam | null>(null);
    const [currentTaskIndex, setCurrentTaskIndex] = createSignal(0);
    const [result, setResult] = createSignal<SpeakingExamResult | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    // Timer state
    const [timeRemaining, setTimeRemaining] = createSignal(0);
    const timerRef = { current: null } as {
        current: (number | null) | null;
    };
    // Mic test state
    const [micPermission, setMicPermission] = createSignal<'pending' | 'granted' | 'denied'>('pending');
    const [micLevel, setMicLevel] = createSignal(0);
    const [micDetectedOnce, setMicDetectedOnce] = createSignal(false);
    const [micTestPassed, setMicTestPassed] = createSignal(false);
    const [speakerTestPassed, setSpeakerTestPassed] = createSignal(false);
    // Recording state
    const [recordings, setRecordings] = createSignal<TaskRecording[]>([]);
    const mediaRecorderRef = { current: null } as {
        current: (MediaRecorder | null) | null;
    };
    const audioChunksRef = { current: [] } as {
        current: Blob[] | null;
    };
    const streamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const analyserRef = { current: null } as {
        current: (AnalyserNode | null) | null;
    };
    const audioContextRef = { current: null } as {
        current: (AudioContext | null) | null;
    };
    const animationFrameRef = { current: null } as {
        current: (number | null) | null;
    };
    // Recording timing
    const recordingStartRef = { current: 0 } as {
        current: number | null;
    };
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Speaking Proficiency Test | FluentXVerse';
            return () => {
                // Cleanup on unmount
                stopMicAnalysis();
                if (timerRef.current)
                    clearInterval(timerRef.current);
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    // Current task helper
    const currentTask = createMemo(() => exam()?.tasks[currentTaskIndex()] || null);
    // ============================================================================
    // MICROPHONE HANDLING
    // ============================================================================
    const requestMicPermission = async () => {
        // Check if we already have a stream
        if (streamRef.current) {
            setMicPermission('granted');
            setupAudioContext(streamRef.current);
            return;
        }
        try {
            // Check existing permission state first
            if (navigator.permissions) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                }
                catch (e) {
                    // permissions.query might not support microphone in all browsers
                }
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            setMicPermission('granted');
            setupAudioContext(stream);
        }
        catch (err) {
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
        if (!analyserRef.current)
            return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const updateLevel = () => {
            if (!analyserRef.current)
                return;
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
            }
            catch (err) {
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
            const taskTime = currentTask()?.timeLimit || 30;
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
        }
        catch (err) {
            console.error('Failed to start recording:', err);
            setError('Failed to start recording. Exam failed.');
            setPhase('error');
        }
    };
    const stopRecordingAndAdvance = async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            advanceToNextTask();
            return;
        }
        const mediaRecorder = mediaRecorderRef.current;
        // Get final recording
        const newRecording = await new Promise<TaskRecording>((resolve) => {
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
                // Convert to base64 for submission
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    const recording: TaskRecording = {
                        get taskId() {
                            return currentTask()?.id || 0;
                        },
                        audioUrl: base64,
                        duration
                    };
                    resolve(recording);
                };
                reader.readAsDataURL(audioBlob);
            };
            mediaRecorder.stop();
        });
        // Update recordings state
        const updatedRecordings = [...recordings(), newRecording];
        setRecordings(updatedRecordings);
        mediaRecorderRef.current = null;
        advanceToNextTask(updatedRecordings);
    };
    const advanceToNextTask = (currentRecordings?: TaskRecording[]) => {
        if (!exam())
            return;
        const nextIndex = currentTaskIndex() + 1;
        if (nextIndex >= exam().tasks.length) {
            // All tasks completed - submit exam with passed recordings
            submitExam(currentRecordings || recordings());
        }
        else {
            // Move to next task
            setCurrentTaskIndex(nextIndex);
            startPrepPhase(exam().tasks[nextIndex]);
        }
    };
    // ============================================================================
    // PHASE HANDLERS
    // ============================================================================
    const startMicTest = () => {
        setPhase('mic-test');
        requestMicPermission();
    };
    const confirmMicTest = () => {
        if (micDetectedOnce()) {
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
        if (!_state0.user?.userId)
            return;
        setPhase('loading');
        setError(null);
        try {
            // Check for active exam first
            const activeRes = await getActiveSpeakingExam(_state0.user.userId);
            if (activeRes.success && activeRes.exam) {
                setExam(activeRes.exam);
                startPrepPhase(activeRes.exam.tasks[0]);
                return;
            }
            // Generate new exam
            const res = await generateSpeakingExam(_state0.user.userId);
            if (res.success && res.exam) {
                setExam(res.exam);
                startPrepPhase(res.exam.tasks[0]);
            }
            else {
                setError(res.message || 'Failed to generate exam');
            }
        }
        catch (err: any) {
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
                setTimeout(() => startRecording(), 0);
            }
        }, 1000);
    };
    const skipPrepTime = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        // Use setTimeout to ensure clean transition
        setTimeout(() => startRecording(), 0);
    };
    const submitExam = async (recordingsToSubmit: TaskRecording[]) => {
        if (!exam() || !_state0.user?.userId)
            return;
        setPhase('submitting');
        stopStream();
        try {
            const res = await submitSpeakingExam(exam().examId, _state0.user.userId, recordingsToSubmit);
            if (res.success && res.result) {
                setResult(res.result);
                setPhase('results');
            }
            else {
                setError(res.message || 'Failed to submit exam');
                setPhase('error');
            }
        }
        catch (err: any) {
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
            'open-response': 'Open Response'
        };
        return labels[type];
    };
    const getTaskIcon = (type: SpeakingTask['type']): string => {
        const icons: Record<SpeakingTask['type'], string> = {
            'read-aloud': 'fa-book',
            'picture-description': 'fa-image',
            'situational-response': 'fa-comments',
            'teaching-demo': 'fa-chalkboard-teacher',
            'open-response': 'fa-microphone'
        };
        return icons[type];
    };
    // ============================================================================
    // RENDER SECTIONS
    // ============================================================================
    const renderIntro = () => (<div class="exam-intro">
      <div class="exam-intro-card speaking">
        <div class="exam-intro-icon">
          <TutorIcon name="fas fa-microphone"/>
        </div>
        <h2>Speaking Proficiency Test</h2>
        <p class="exam-intro-description">
          This exam assesses your English speaking skills through various task types.
          You will be recorded and evaluated by AI on pronunciation, fluency, vocabulary,
          grammar, coherence, and task completion.
        </p>

        <div class="exam-info-grid">
          <div class="exam-info-item">
            <TutorIcon name="fas fa-tasks"/>
            <span>10 Tasks</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-clock"/>
            <span>~15 mins</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-trophy"/>
            <span>85% to Pass</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-redo"/>
            <span>2 Attempts/Month</span>
          </div>
        </div>

        <div class="exam-categories">
          <h4>Task Types</h4>
          <div class="category-tags">
            <span class="category-tag">
              <TutorIcon name="fas fa-book"/> Read Aloud
            </span>
            <span class="category-tag">
              <TutorIcon name="fas fa-image"/> Picture Description
            </span>
            <span class="category-tag">
              <TutorIcon name="fas fa-comments"/> Situational Response
            </span>
            <span class="category-tag">
              <TutorIcon name="fas fa-chalkboard-teacher"/> Teaching Demo
            </span>
            <span class="category-tag">
              <TutorIcon name="fas fa-microphone"/> Open Response
            </span>
          </div>
        </div>

        <div class="exam-rules speaking-rules">
          <h4><TutorIcon name="fas fa-exclamation-triangle"/> Important Instructions</h4>
          <ul>
            <li><strong>Microphone Required:</strong> You must have a working microphone.</li>
            <li><strong>Quiet Environment:</strong> Find a quiet place with minimal background noise.</li>
            <li><strong>One Chance Per Task:</strong> You cannot re-record a task once it's completed.</li>
            <li><strong>No Pausing:</strong> The exam cannot be paused once started.</li>
            <li><strong>Browser Access:</strong> Please allow microphone access when prompted.</li>
            <li><strong>Recording Failure = Fail:</strong> If your microphone fails during the exam, it will be marked as failed.</li>
          </ul>
        </div>

        <button class="start-exam-btn" onClick={startMicTest}>
          <TutorIcon name="fas fa-cog"/> Test Your Equipment
        </button>
      </div>
    </div>);
    const renderMicTest = () => (<div class="exam-intro">
      <div class="equipment-test-card">
        <div class="test-icon mic">
          <TutorIcon name="fas fa-microphone"/>
        </div>
        <h2>Microphone Test</h2>
        <p>Speak into your microphone to test it. The level meter should move when you speak.</p>

        {micPermission() === 'pending' && (<div class="permission-prompt">
            <div class="loading-spinner small"/>
            <p>Requesting microphone access...</p>
          </div>)}

        {micPermission() === 'denied' && (<div class="permission-denied">
            <TutorIcon name="fas fa-times-circle"/>
            <p>Microphone access denied. Please enable it in your browser settings.</p>
            <button class="retry-btn" onClick={requestMicPermission}>
              Try Again
            </button>
          </div>)}

        {micPermission() === 'granted' && (<>
            <div class="mic-level-container">
              <div class="mic-level-bar">
                <div class="mic-level-fill" style={cssStyle({ get width() {
                    return `${micLevel()}%`;
                } })}/>
              </div>
              <span class="mic-level-label">
                {micDetectedOnce() ? '✓ Microphone detected!' : 'Speak now...'}
              </span>
            </div>

            <div class="test-instructions">
              <p>👋 Say "Hello, my name is..." to test your microphone.</p>
            </div>

            <button class={`confirm-test-btn ${micDetectedOnce() ? 'active' : 'disabled'}`} onClick={confirmMicTest} disabled={!micDetectedOnce()}>
              <TutorIcon name="fas fa-check-circle"/> Microphone Works
            </button>
          </>)}
      </div>
    </div>);
    const renderSpeakerTest = () => (<div class="exam-intro">
      <div class="equipment-test-card">
        <div class="test-icon speaker">
          <TutorIcon name="fas fa-volume-up"/>
        </div>
        <h2>Speaker Test</h2>
        <p>Click the button below to play a test sound. Make sure you can hear it clearly.</p>

        <button class="play-sound-btn" onClick={playSpeakerTest}>
          <TutorIcon name="fas fa-play-circle"/> Play Test Sound
        </button>

        <div class="speaker-confirm">
          <p>Did you hear the sound?</p>
          <div class="confirm-buttons">
            <button class="confirm-yes" onClick={confirmSpeakerTest}>
              <TutorIcon name="fas fa-check"/> Yes, I heard it
            </button>
            <button class="confirm-no" onClick={playSpeakerTest}>
              <TutorIcon name="fas fa-redo"/> Play Again
            </button>
          </div>
        </div>

        {speakerTestPassed() && (<div class="all-tests-passed">
            <TutorIcon name="fas fa-check-circle"/>
            <p>All equipment tests passed!</p>
            <button class="start-exam-btn" onClick={startExam}>
              <TutorIcon name="fas fa-play"/> Start Speaking Exam
            </button>
          </div>)}
      </div>
    </div>);
    const renderLoading = () => (<div class="exam-loading">
      <div class="loading-spinner"/>
      <h3>Generating Your Speaking Exam</h3>
      <p>We are creating personalized speaking tasks for you...</p>
    </div>);
    const renderTaskContent = () => {
        const task = currentTask();
        if (!task)
            return null;
        switch (task.type) {
            case 'read-aloud':
                return (<div class="task-content read-aloud">
            <p class="task-instruction">{currentTask().instruction}</p>
            <div class="read-aloud-text">
              <p>{task.sentence}</p>
            </div>
          </div>);
            case 'picture-description':
                return (<div class="task-content picture-description">
            <p class="task-instruction">{currentTask().instruction}</p>
            <div class="task-image-container">
              <img src={task.imageUrl} alt="Describe this image"/>
            </div>
          </div>);
            case 'situational-response':
                return (<div class="task-content situational-response">
            <p class="task-instruction">{currentTask().instruction}</p>
            <div class="scenario-box">
              <h4>Scenario:</h4>
              <p>{task.scenario}</p>
            </div>
            <div class="prompt-box">
              <h4>Your Task:</h4>
              <p>{task.prompt}</p>
            </div>
          </div>);
            case 'teaching-demo':
                return (<div class="task-content teaching-demo">
            <p class="task-instruction">{currentTask().instruction}</p>
            <div class="teaching-topic">
              <h4>Topic to Explain:</h4>
              <p>{task.topic}</p>
            </div>
            <div class="target-level">
              <span class={`level-badge ${task.targetLevel}`}>
                Target: {task.targetLevel.charAt(0).toUpperCase() + task.targetLevel.slice(1)} Students
              </span>
            </div>
          </div>);
            case 'open-response':
                return (<div class="task-content open-response">
            <p class="task-instruction">{currentTask().instruction}</p>
            <div class="question-box">
              <p>{task.question}</p>
            </div>
          </div>);
            default:
                return null;
        }
    };
    const renderPrep = () => (<div class="exam-task-container">
      <div class="task-header">
        <div class="task-progress">
          <span>Task {currentTaskIndex() + 1} of {exam()?.tasks.length || 10}</span>
          <div class="progress-bar">
            <div class="progress-fill" style={cssStyle({ get width() {
                return `${((currentTaskIndex()) / (exam()?.tasks.length || 10)) * 100}%`;
            } })}/>
          </div>
        </div>
        <div class="task-type-badge">
          <TutorIcon name={`fas ${getTaskIcon(currentTask()?.type || 'read-aloud')}`}/>
          <span>{getTaskTypeLabel(currentTask()?.type || 'read-aloud')}</span>
        </div>
      </div>

      <div class="task-main prep-phase">
        <div class="prep-timer">
          <div class="timer-circle prep">
            <span class="timer-value">{timeRemaining()}</span>
            <span class="timer-label">Prep Time</span>
          </div>
        </div>

        <div class="prep-instructions">
          <p><TutorIcon name="fas fa-eye"/> Read and prepare your response</p>
        </div>

        {renderTaskContent()}

        <button class="skip-prep-btn" onClick={skipPrepTime}>
          <TutorIcon name="fas fa-forward"/> I'm Ready - Start Recording
        </button>
      </div>
    </div>);
    const renderRecording = () => (<div class="exam-task-container">
      <div class="task-header">
        <div class="task-progress">
          <span>Task {currentTaskIndex() + 1} of {exam()?.tasks.length || 10}</span>
          <div class="progress-bar">
            <div class="progress-fill" style={cssStyle({ get width() {
                return `${((currentTaskIndex()) / (exam()?.tasks.length || 10)) * 100}%`;
            } })}/>
          </div>
        </div>
        <div class="task-type-badge">
          <TutorIcon name={`fas ${getTaskIcon(currentTask()?.type || 'read-aloud')}`}/>
          <span>{getTaskTypeLabel(currentTask()?.type || 'read-aloud')}</span>
        </div>
      </div>

      <div class="task-main recording-phase">
        <div class="recording-indicator">
          <div class="recording-dot pulse"/>
          <span>Recording...</span>
        </div>

        <div class="recording-timer">
          <div class="timer-circle recording">
            <span class="timer-value">{formatTime(timeRemaining())}</span>
            <span class="timer-label">Time Left</span>
          </div>
        </div>

        {renderTaskContent()}

        <div class="recording-actions">
          <button class="done-speaking-btn" onClick={stopRecordingAndAdvance}>
            <TutorIcon name="fas fa-forward"/> Done Speaking - Next Task
          </button>
        </div>

        <div class="recording-hint">
          <TutorIcon name="fas fa-info-circle"/>
          <span>Speak clearly into your microphone. Recording will stop automatically.</span>
        </div>
      </div>
    </div>);
    const renderSubmitting = () => (<div class="exam-loading submitting-exam">
      <div class="loading-spinner"/>
      <h3>Processing Your Exam</h3>
      <p>Your recordings are being transcribed and evaluated by our AI.</p>
      <div class="submitting-progress">
        <div class="progress-steps">
          <div class="step active">
            <TutorIcon name="fas fa-upload"/>
            <span>Uploading</span>
          </div>
          <div class="step active">
            <TutorIcon name="fas fa-microphone"/>
            <span>Transcribing</span>
          </div>
          <div class="step">
            <TutorIcon name="fas fa-check-circle"/>
            <span>Grading</span>
          </div>
        </div>
        <p class="time-estimate">
          <TutorIcon name="fas fa-clock"/> This usually takes 1-2 minutes. Please don't close this page.
        </p>
      </div>
    </div>);
    const renderResults = () => {
        if (!result())
            return null;
        const getScoreColor = (score: number) => {
            if (score >= 85)
                return 'excellent';
            if (score >= 70)
                return 'good';
            if (score >= 50)
                return 'fair';
            return 'poor';
        };
        return (<div class="exam-results speaking-results">
        <div class="results-header">
          <div class={`result-badge ${result().passed ? 'passed' : 'failed'}`}>
            <TutorIcon name={`fas ${result().passed ? 'fa-check-circle' : 'fa-times-circle'}`}/>
            <span>{result().passed ? 'PASSED' : 'FAILED'}</span>
          </div>
          <h2>Speaking Exam Results</h2>
        </div>

        <div class="score-overview">
          <div class={`overall-score ${getScoreColor(result().overallScore)}`}>
            <span class="score-value">{Math.round(result().overallScore)}%</span>
            <span class="score-label">Overall Score</span>
          </div>
          <p class="passing-note">
            {result().passed
                ? '🎉 Congratulations! You have passed the speaking exam.'
                : `You needed 85% to pass. You have ${2 - 1} attempt(s) remaining this month.`}
          </p>
        </div>

        <div class="section-scores">
          <h3>Category Breakdown</h3>
          <div class="score-grid">
            {Object.entries(result().sectionAverages).map(([category, score]) => (<div class="score-item">
                <span class="score-category">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </span>
                <div class="score-bar-container">
                  <div class={`score-bar ${getScoreColor(score * 20)}`} style={cssStyle({ width: `${score * 20}%` })}/>
                </div>
                <span class="score-number">{score.toFixed(1)}/5</span>
              </div>))}
          </div>
        </div>

        <div class="overall-feedback">
          <h3>Feedback</h3>
          <p>{result().overallFeedback}</p>
        </div>

        <div class="task-scores-detail">
          <h3>Task Details</h3>
          {result().taskScores.map((taskScore, index) => (<div class="task-score-card">
              <div class="task-score-header">
                <span class="task-number">Task {index + 1}</span>
                <span class="task-type">{getTaskTypeLabel(taskScore.taskType)}</span>
                <span class={`task-percentage ${getScoreColor(taskScore.percentage)}`}>
                  {Math.round(taskScore.percentage)}%
                </span>
              </div>
              <p class="task-feedback">{taskScore.feedback}</p>
            </div>))}
        </div>

        <div class="results-actions">
          <a href="/home" class="back-home-btn">
            <TutorIcon name="fas fa-home"/> Back to Dashboard
          </a>
        </div>
      </div>);
    };
    const renderError = () => (<div class="exam-error">
      <div class="error-card">
        <div class="error-icon">
          <TutorIcon name="fas fa-times-circle"/>
        </div>
        <h2>Exam Failed</h2>
        <p>{error() || 'An error occurred during the exam.'}</p>
        <div class="error-actions">
          <a href="/home" class="back-home-btn">
            <TutorIcon name="fas fa-home"/> Back to Dashboard
          </a>
        </div>
      </div>
    </div>);
    // ============================================================================
    // MAIN RENDER
    // ============================================================================
    const renderContent = () => {
        switch (phase()) {
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
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <main class="speaking-exam-page">
          {renderContent()}
        </main>
      </div>
    </>);
};
export default SpeakingExamPage;

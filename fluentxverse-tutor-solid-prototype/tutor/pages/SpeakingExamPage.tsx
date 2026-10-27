import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { generateSpeakingExam, submitSpeakingExam, getActiveSpeakingExam, getSpeakingExamStatus, getSpeakingExamResult,
    getExamStatus, saveSpeakingRecording, retrySpeakingGrading,
    type ClientSpeakingExam, type SpeakingTask, type TaskRecording, type SpeakingExamResult, } from '../api/exam.api';
import './SpeakingExamPage.css';
type ExamPhase = 'intro' // Initial instructions
 | 'mic-test' // Testing microphone
 | 'speaker-test' // Testing speakers
 | 'loading' // Generating exam
 | 'prep' // Prep time before recording
 | 'recording' // Currently recording
 | 'submitting' // Submitting exam
 | 'saving'
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
    const [canStart, setCanStart] = createSignal(false);
    const [canRetryGrading, setCanRetryGrading] = createSignal(false);
    const [jobId, setJobId] = createSignal<string | null>(null);
    const [pendingRecording, setPendingRecording] = createSignal<TaskRecording | null>(null);
    let disposed = false, advancing = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;
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
                disposed = true;
                clearTimeout(pollTimer);
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.onstop = null;
                    if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
                }
                stopStream();
                if (timerRef.current)
                    clearInterval(timerRef.current);
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    // Current task helper
    const currentTask = createMemo(() => exam()?.tasks[currentTaskIndex()] || null);
    createEffect(on(phase, value => {
        if (['prep', 'results', 'error'].includes(value)) {
            const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
            onCleanup(() => cancelAnimationFrame(frame));
        }
    }));
    const pollResult = async (id: string) => {
        if (disposed || !_state0.user?.userId) return;
        clearTimeout(pollTimer);
        try {
            const response = await getSpeakingExamStatus(_state0.user.userId);
            if (disposed) return;
            const status = response.status;
            if (!response.success || !status) throw new Error('Assessment status unavailable.');
            if (status.hasCompletedExam && status.examId === id) {
                const completed = await getSpeakingExamResult(_state0.user.userId, id);
                if (disposed) return;
                if (!completed.result) throw new Error('Assessment result unavailable.');
                setResult(completed.result); setPhase('results'); return;
            }
            if (status.gradingFailed) {
                setCanRetryGrading(!!status.canRetryGrading);
                setError('Grading could not finish. Your recordings are saved; no exam attempt has been deducted.');
                setPhase('error'); return;
            }
        } catch {
            // A network outage must not erase the submitted job or start a second attempt.
        }
        if (!disposed) pollTimer = setTimeout(() => pollResult(id), 5000);
    };
    createEffect(on(() => _state0.user?.userId, userId => {
        if (!userId) return;
        let cancelled = false;
        void (async () => {
            try {
                const written = await getExamStatus(userId);
                if (cancelled || disposed) return;
                setCanStart(written.status?.passed === true);
                const oral = await getSpeakingExamStatus(userId);
                if (cancelled || disposed) return;
                if (oral.status?.examId && (oral.status.isProcessing || oral.status.hasCompletedExam || oral.status.gradingFailed)) {
                    setJobId(oral.status.examId); setPhase('submitting');
                    void pollResult(oral.status.examId);
                }
            } catch (err) { if (!cancelled && !disposed) setError(errorMessage(err, 'Unable to load application progress.')); }
        })();
        onCleanup(() => { cancelled = true; clearTimeout(pollTimer); });
    }));
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
            if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
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
        stopMicAnalysis();
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
        if (disposed || advancing || mediaRecorderRef.current?.state === 'recording' || phase() !== 'prep') return;
        if (exam()?.startedAt && Date.now() >= Date.parse(exam()!.startedAt!) + exam()!.totalTimeLimit * 60000) { await submitExam(); return; }
        // Clear any existing timer first to prevent race conditions
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (!streamRef.current) {
            // Try to get mic permission again
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
                streamRef.current = stream;
            }
            catch (err) {
                setError('Microphone access was lost. Your completed recordings are saved.');
                setPhase('error');
                return;
            }
        }
        audioChunksRef.current = [];
        try {
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
            if (!mimeType) throw new Error('This browser cannot record a supported audio format.');
            const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current?.push(event.data);
                }
            };
            mediaRecorder.onerror = () => {
                setError('Recording failed. Your completed recordings are saved.');
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
            setError(errorMessage(err, 'Failed to start recording. Your completed recordings are saved.'));
            setPhase('error');
        }
    };
    const stopRecordingAndAdvance = async () => {
        if (advancing || disposed || !currentTask()) return;
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            return;
        }
        advancing = true;
        const taskId = currentTask()!.id;
        const mediaRecorder = mediaRecorderRef.current;
        setPhase('saving');
        // Get final recording
        try {
        const newRecording = await new Promise<TaskRecording>((resolve, reject) => {
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current || [], { type: mediaRecorder.mimeType });
                const duration = (Date.now() - (recordingStartRef.current || Date.now())) / 1000;
                // Convert to base64 for submission
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    const recording: TaskRecording = {
                        taskId,
                        audioUrl: base64,
                        duration
                    };
                    resolve(recording);
                };
                reader.onerror = () => reject(new Error('Unable to read recording.'));
                reader.readAsDataURL(audioBlob);
            };
            mediaRecorder.stop();
        });
        mediaRecorderRef.current = null;
        if (disposed) return;
        if (newRecording.duration < 0.5 || newRecording.duration > (currentTask()?.timeLimit ?? 120) + 5) {
            throw new Error('The recording duration is invalid. Resume this unsaved task and record again.');
        }
        setPendingRecording(newRecording);
        await persistRecording(newRecording);
        } catch (err) {
            if (!disposed) { setError(errorMessage(err, 'Unable to save recording. Please retry.')); setPhase('error'); }
        } finally { advancing = false; }
    };
    const persistRecording = async (recording: TaskRecording) => {
        if (!exam() || disposed) return;
        let saved;
        try { saved = await saveSpeakingRecording(exam()!.examId, recording); }
        catch (err: any) {
            if ([400, 404, 409, 413, 422].includes(err?.response?.status)) setPendingRecording(null);
            throw err;
        }
        if (!saved.success || !saved.saved) throw new Error('Recording was not saved. Please retry.');
        if (disposed) return;
        setPendingRecording(null);
        advanceToNextTask();
    };
    const advanceToNextTask = () => {
        if (!exam())
            return;
        const nextIndex = currentTaskIndex() + 1;
        if (nextIndex >= exam().tasks.length) {
            // All tasks completed - submit exam with passed recordings
            void submitExam();
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
        if (!_state0.user?.userId || !canStart())
            return;
        setPhase('loading');
        setError(null);
        try {
            // Check for active exam first
            const activeRes = await getActiveSpeakingExam(_state0.user.userId);
            if (activeRes.success && activeRes.exam) {
                resumeExam(activeRes.exam);
                return;
            }
            // Generate new exam
            const res = await generateSpeakingExam(_state0.user.userId);
            if (res.success && res.exam) {
                resumeExam(res.exam);
            }
            else {
                setError(res.message || 'Failed to generate exam'); setPhase('error');
            }
        }
        catch (err: any) {
            setError(errorMessage(err, 'Failed to start exam')); setPhase('error');
        }
    };
    const resumeExam = (active: ClientSpeakingExam) => {
        if (disposed) return;
        setExam(active);
        const index = active.tasks.findIndex(task => !active.savedTaskIds?.includes(task.id));
        if (index < 0 || (active.startedAt && Date.now() >= Date.parse(active.startedAt) + active.totalTimeLimit * 60000)) { void submitExam(); return; }
        setCurrentTaskIndex(index);
        startPrepPhase(active.tasks[index]!);
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
    const submitExam = async () => {
        if (!exam() || !_state0.user?.userId)
            return;
        setPhase('submitting');
        stopStream();
        try {
            const res = await submitSpeakingExam(exam().examId, _state0.user.userId);
            if (disposed) return;
            if (res.success && res.result) {
                setResult(res.result);
                setPhase('results');
            }
            else if (res.success && (res.state === 'queued' || res.state === 'processing')) {
                setJobId(exam()!.examId);
                void pollResult(exam()!.examId);
            } else {
                setError(res.message || 'Failed to submit exam');
                setPhase('error');
            }
        }
        catch (err: any) {
            setError(errorMessage(err, 'Failed to submit exam'));
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
          Read 10 short sentences aloud, one at a time. You do not need to describe
          pictures, answer questions, or teach a topic. AI compares your transcribed
          words with each sentence. Scores are provisional, not a final application
          decision. Pronunciation and delivery still require human review.
        </p>

        <div class="exam-info-grid">
          <div class="exam-info-item">
            <TutorIcon name="fas fa-tasks"/>
            <span>10 Sentences</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-clock"/>
            <span>30 Seconds Each</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-trophy"/>
            <span>85% Content Threshold</span>
          </div>
          <div class="exam-info-item">
            <TutorIcon name="fas fa-redo"/>
            <span>2 Attempts / 30 Days</span>
          </div>
        </div>

        <div class="exam-categories">
          <h4>Assessment</h4>
          <div class="category-tags">
            <span class="category-tag">
              <TutorIcon name="fas fa-book"/> Read Aloud Only
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
            <li><strong>Saved Progress:</strong> Completed recordings are saved. A recording or grading error does not itself fail your application.</li>
          </ul>
        </div>

        {error() && <p role="alert">{error()}</p>}
        <button class="start-exam-btn" disabled={!canStart()} onClick={startMicTest}>
          <TutorIcon name="fas fa-cog"/> {canStart() ? 'Test Your Equipment' : 'Written Exam Pass Required'}
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
            <p class="task-vocabulary-guidance">Use varied, precise vocabulary naturally. Clear everyday words are welcome; uncommon words are not required.</p>
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
          <p><TutorIcon name="fas fa-eye"/> {currentTask()?.type === 'read-aloud' ? 'Read the sentence before recording' : 'Read and prepare your response'}</p>
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
          <TutorIcon name="fas fa-clock"/> Recordings are saved. You can return to your dashboard while grading finishes.
        </p>
      </div>
      <a class="back-home-btn" href="/home">Back to Dashboard</a>
    </div>);
    const renderResults = () => {
        if (!result())
            return null;
        const readAloud = result().format === 'read-aloud.v1';
        const readAloudLabels: Record<string, string> = { vocabulary: 'Words read', grammar: 'Sentence', coherence: 'Word order', taskCompletion: 'Coverage' };
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
          <div class="result-badge provisional">
            <TutorIcon name="fas fa-clipboard-check"/>
            <span>AI CONTENT ASSESSMENT</span>
          </div>
          <h2>{readAloud ? 'Read-Aloud Results' : 'Speaking Exam Results'}</h2>
        </div>

        <div class="score-overview">
          <div class={`overall-score ${getScoreColor(result().overallScore)}`}>
            <span class="score-value">{Math.round(result().overallScore)}%</span>
            <span class="score-label">Provisional Content Score</span>
          </div>
          <p class="passing-note">
            {result().passed
                ? 'The AI content score meets the 85% screening threshold. Human review is required for a final application decision.'
                : 'The AI content score is below the 85% screening threshold. This is not a final rejection. Human review is required; contact support to discuss your assessment.'}
          </p>
        </div>

        <div class="section-scores">
          <h3>Category Breakdown</h3>
          <div class="score-grid">
            {Object.entries(result().sectionAverages).map(([category, score]) => (<div class="score-item">
                <span class="score-category">
                  {readAloudLabels[category] && readAloud ? readAloudLabels[category] : category === 'taskCompletion' ? 'Task completion' : category.charAt(0).toUpperCase() + category.slice(1)}
                </span>
                <div class="score-bar-container">
                  <div class={`score-bar ${getScoreColor((score ?? 0) * 20)}`} style={cssStyle({ width: `${(score ?? 0) * 20}%` })}/>
                </div>
                <span class="score-number">{score === null ? 'Human review' : `${score.toFixed(1)}/5`}</span>
              </div>))}
          </div>
        </div>

        <div class="overall-feedback">
          <h3>What This Score Means</h3>
          <p>{readAloud
            ? 'This score compares the transcript with the supplied sentences. It does not measure spontaneous speaking, teaching ability, pronunciation, accent, or delivery. Human review is still required.'
            : 'This score covers transcribed content only. It does not assess pronunciation, accent, or delivery, and it does not replace a human decision about your application.'}</p>
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
          <a href="mailto:tutor@fluentxverse.com" class="back-home-btn">Contact Tutor Applications</a>
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
        <h2>Assessment Paused</h2>
        <p>{error() || 'An error occurred during the exam.'}</p>
        <div class="error-actions">
          {pendingRecording() && <button class="back-home-btn" onClick={async () => {
              if (advancing) return; advancing = true; setPhase('saving');
              try { await persistRecording(pendingRecording()!); } catch (err) { setError(errorMessage(err, 'Upload failed.')); setPhase('error'); }
              finally { advancing = false; }
          }}>Retry Saving Recording</button>}
          {canRetryGrading() && jobId() && <button class="back-home-btn" onClick={async () => {
              setCanRetryGrading(false);
              try { await retrySpeakingGrading(jobId()!); setPhase('submitting'); void pollResult(jobId()!); }
              catch (err) { setError(errorMessage(err, 'Please contact support to resume grading.')); }
          }}>Retry Grading</button>}
          {!pendingRecording() && !jobId() && <button class="back-home-btn" onClick={() => { setError(null); setPhase('intro'); }}>Resume Assessment</button>}
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
            case 'saving':
                return <div class="exam-loading"><div class="loading-spinner"/><h3>Saving Recording</h3><p>Task {currentTaskIndex() + 1}</p></div>;
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

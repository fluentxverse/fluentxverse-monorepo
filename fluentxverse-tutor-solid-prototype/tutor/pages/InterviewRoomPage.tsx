import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { getSocket, connectSocket, initSocket } from '../client/socket/socket.client';
import './InterviewRoomPage.css';
import { useParams } from '@solidjs/router';
import { InterviewCall } from '../../../shared/interviewCall';
import { API_BASE_URL } from '../config/api';
import { refreshSession } from '../api/auth.api';
import { startClassroomSessionRefresh } from '../utils/sessionRefresh';
interface InterviewRoomProps {
    interviewId?: string;
}
const InterviewRoomPage = (_props0: InterviewRoomProps) => {
    const params = useParams();
    const interviewId = _props0.interviewId || params.interviewId;
    let call: InterviewCall | null = null;
    let disposed = false;
    let mediaVersion = 0;
    const [roomReady, setRoomReady] = createSignal(false);
    const [recording, setRecording] = createSignal(false);
    const [ended, setEnded] = createSignal(false);
    // Media states
    const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = createSignal<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = createSignal(true);
    const [isVideoEnabled, setIsVideoEnabled] = createSignal(true);
    const [isConnected, setIsConnected] = createSignal(false);
    const [isConnecting, setIsConnecting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    // Pre-call setup states
    const [setupComplete, setSetupComplete] = createSignal(false);
    const [deviceTestPassed, setDeviceTestPassed] = createSignal(false);
    const [selectedCamera, setSelectedCamera] = createSignal<string>('');
    const [selectedMic, setSelectedMic] = createSignal<string>('');
    const [cameras, setCameras] = createSignal<MediaDeviceInfo[]>([]);
    const [mics, setMics] = createSignal<MediaDeviceInfo[]>([]);
    // Call states
    const [callDuration, setCallDuration] = createSignal(0);
    const [waitingForAdmin, setWaitingForAdmin] = createSignal(false);
    // Refs
    const localVideoRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    const remoteVideoRef = { current: null } as {
        current: HTMLVideoElement | null;
    };
    const localStreamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const callTimerRef = { current: null } as {
        current: (number | null) | null;
    };
    const roomIdRef = { current: `interview-${interviewId || 'default'}` } as {
        current: string | null;
    };
    // Get available devices and auto-start preview
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const getDevices = async () => {
                const version = ++mediaVersion;
                try {
                    const response = await fetch(`${API_BASE_URL}/interview/room/${encodeURIComponent(interviewId || '')}`, { credentials: 'include' });
                    const data = await response.json();
                    if (!response.ok || !data.success || data.data.status !== 'booked' || data.data.mediaClosed) throw Error(data.error || 'Interview is not available to join.');
                    if (disposed) return;
                    setRoomReady(true);
                    // Request permissions and get initial stream
                    const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    if (disposed || ended() || version !== mediaVersion) { initialStream.getTracks().forEach(track => track.stop()); return; }
                    // Set initial stream for preview
                    localStreamRef.current = initialStream;
                    setLocalStream(initialStream);
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(d => d.kind === 'videoinput');
                    const audioDevices = devices.filter(d => d.kind === 'audioinput');
                    setCameras(videoDevices);
                    setMics(audioDevices);
                    if (videoDevices.length > 0)
                        setSelectedCamera(videoDevices[0].deviceId);
                    if (audioDevices.length > 0)
                        setSelectedMic(audioDevices[0].deviceId);
                    // Mark devices as tested since we have a working stream
                    setDeviceTestPassed(true);
                }
                catch (err) {
                    console.error('Error getting devices:', err);
                    setError(err instanceof Error ? err.message : 'Could not access camera or microphone. Please check permissions.');
                }
            };
            getDevices();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Start local preview stream
    const startPreview = async () => {
        const version = ++mediaVersion;
        if (ended()) return;
        try {
            // Stop any existing stream first
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            const constraints: MediaStreamConstraints = {
                get video() {
                    return selectedCamera() ? { get deviceId() {
                            return { get exact() {
                                    return selectedCamera();
                                } };
                        } } : true;
                },
                get audio() {
                    return selectedMic() ? { get deviceId() {
                            return { get exact() {
                                    return selectedMic();
                                } };
                        } } : true;
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (disposed || ended() || version !== mediaVersion) { stream.getTracks().forEach(track => track.stop()); return; }
            localStreamRef.current = stream;
            setLocalStream(stream);
            // Use setTimeout to ensure the video element is rendered
            setTimeout(() => {
                if (localVideoRef.current && stream) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => { });
                }
            }, 100);
            setDeviceTestPassed(true);
            setError(null);
        }
        catch (err) {
            console.error('Error starting preview:', err);
            setError('Failed to start camera preview. Please check your device permissions.');
            setDeviceTestPassed(false);
        }
    };
    // Stop preview stream
    const stopPreview = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
    };
    // Join interview room
    const joinRoom = async () => {
        if (!localStreamRef.current || !roomReady() || ended() || isConnecting()) {
            setError('Please test your devices first');
            return;
        }
        setIsConnecting(true);
        setWaitingForAdmin(true);
        try {
            call?.close();
            const socket = initSocket();
            call = new InterviewCall({ socket, roomId: roomIdRef.current!, role: 'tutor', stream: localStreamRef.current,
                onStream: stream => { if (!disposed) setRemoteStream(stream); },
                onState: state => {
                    if (disposed) return;
                    setIsConnected(state === 'connected');
                    setIsConnecting(['connecting', 'reconnecting'].includes(state));
                    setWaitingForAdmin(state === 'waiting');
                    if (state === 'connected') { setError(null); startCallTimer(); } else stopCallTimer();
                },
                onError: message => { if (!disposed) { setError(message); setIsConnecting(false); } },
                onEnded: () => handleEndCall(false),
            });
            const ready = call.start();
            connectSocket();
            await ready;
            if (!disposed && !ended()) setSetupComplete(true);
        }
        catch (err) {
            console.error('Error joining room:', err);
            setError('Failed to join interview room');
            setIsConnecting(false);
            call?.close();
        }
    };
    // Toggle audio
    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };
    // Toggle video
    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };
    // Call timer
    const startCallTimer = () => {
        if (callTimerRef.current !== null) return;
        callTimerRef.current = window.setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };
    const stopCallTimer = () => {
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
    };
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // End call
    const handleEndCall = (notify = true) => {
        if (ended()) return;
        setEnded(true); mediaVersion++;
        if (notify) call?.end(); else call?.close();
        stopCallTimer();
        stopPreview();
        setIsConnected(false);
        setRemoteStream(null);
        setIsConnecting(false); setWaitingForAdmin(false); setRecording(false);
    };
    // Cleanup on unmount
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            return () => {
                disposed = true; mediaVersion++; call?.close();
                stopCallTimer();
                stopPreview();
            };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(setupComplete, active => {
        if (!active) return;
        const socket = getSocket();
        const status = (data: { recording: boolean }) => setRecording(data.recording);
        socket.on('interview:recording-status', status);
        onCleanup(() => socket.off('interview:recording-status', status));
    }));
    createEffect(on(() => setupComplete() && !ended(), active => {
        const stop = startClassroomSessionRefresh(active, refreshSession, () => {});
        if (stop) onCleanup(stop);
    }));
    // Sync video element with stream when localStream changes
    createEffect(on(() => [localStream()], () => {
        const _cleanup4 = untrack(() => {
            if (localStream() && localVideoRef.current) {
                localVideoRef.current.srcObject = localStream();
                localVideoRef.current.play().catch(() => { });
            }
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    // Re-attach stream when transitioning to call view (DOM element changes)
    createEffect(on(() => [setupComplete(), localStream()], () => {
        const _cleanup5 = untrack(() => {
            if (setupComplete() && localStream() && localVideoRef.current) {
                setTimeout(() => {
                    if (localVideoRef.current && localStream()) {
                        localVideoRef.current.srcObject = localStream();
                        localVideoRef.current.play().catch(() => { });
                    }
                }, 100);
            }
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    // Device change handler
    createEffect(on(() => [selectedCamera(), selectedMic()], () => {
        const _cleanup6 = untrack(() => {
            if (deviceTestPassed() && localStream()) {
                stopPreview();
                startPreview();
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    return (<div class="interview-room">
      {!setupComplete() ? (
        // Pre-call Setup Screen
        <div class="interview-setup">
          <div class="setup-container">
            <div class="setup-header">
              <div class="setup-icon">
                <TutorIcon name="ri-video-chat-line"/>
              </div>
              <h1>Interview Room Setup</h1>
              <p>Test your camera and microphone before joining</p>
            </div>

            {error() && (<div class="setup-error">
                <TutorIcon name="ri-error-warning-line"/>
                {error()}
              </div>)}

            <div class="setup-content">
              {/* Video Preview */}
              <div class="video-preview-container">
                <div class="video-preview">
                  {localStream() ? (<video ref={element => { localVideoRef.current = element; element.srcObject = localStream(); void element.play().catch(() => {}); }} autoplay muted playsinline/>) : (<div class="video-placeholder">
                      <TutorIcon name="ri-camera-line"/>
                      <p>Camera preview will appear here</p>
                    </div>)}
                </div>
                
                {deviceTestPassed() && (<div class="device-status success">
                    <TutorIcon name="ri-check-line"/>
                    Devices working correctly
                  </div>)}
              </div>

              {/* Device Selection */}
              <div class="device-selection">
                <div class="device-group">
                  <label>
                    <TutorIcon name="ri-camera-line"/>
                    Camera
                  </label>
                  <select disabled={ended() || isConnecting()} value={selectedCamera()} onChange={(e) => { setSelectedCamera((e.target as HTMLSelectElement).value); setDeviceTestPassed(false); }}>
                    {cameras().map(camera => (<option value={camera.deviceId}>
                        {camera.label || `Camera ${cameras().indexOf(camera) + 1}`}
                      </option>))}
                  </select>
                </div>

                <div class="device-group">
                  <label>
                    <TutorIcon name="ri-mic-line"/>
                    Microphone
                  </label>
                  <select disabled={ended() || isConnecting()} value={selectedMic()} onChange={(e) => { setSelectedMic((e.target as HTMLSelectElement).value); setDeviceTestPassed(false); }}>
                    {mics().map(mic => (<option value={mic.deviceId}>
                        {mic.label || `Microphone ${mics().indexOf(mic) + 1}`}
                      </option>))}
                  </select>
                </div>

                <button disabled={ended() || !roomReady() || isConnecting()} class="btn-test-devices" onClick={startPreview}>
                  <TutorIcon name="ri-refresh-line"/>
                  Test Devices
                </button>
              </div>
            </div>

            {/* Setup Actions */}
            <div class="setup-actions">
              <button class="btn-back" onClick={() => window.location.href = '/interview'}>
                <TutorIcon name="ri-arrow-left-line"/>
                Back
              </button>
              <button class="btn-join" onClick={joinRoom} disabled={!deviceTestPassed() || isConnecting() || !roomReady() || ended()}>
                {isConnecting() ? (<>
                    <TutorIcon name="ri-loader-4-line ri-spin"/>
                    Connecting...
                  </>) : (<>
                    <TutorIcon name="ri-video-chat-line"/>
                    Join Interview
                  </>)}
              </button>
            </div>

            {/* Tips */}
            <div class="setup-tips">
              <h4><TutorIcon name="ri-lightbulb-line"/> Tips for a great interview</h4>
              <ul>
                <li>Find a quiet, well-lit room</li>
                <li>Use headphones to reduce echo</li>
                <li>Close other apps using your camera</li>
                <li>Have a stable internet connection</li>
              </ul>
            </div>
          </div>
        </div>) : (
        // Active Call Screen
        <div class="interview-call">
          {/* Call Header */}
          <div class="call-header">
            <div class="call-info">
              <span class="call-status">
                {ended() ? 'Interview ended' : isConnected() ? (<><TutorIcon name="ri-record-circle-fill live"/> Live</>) : waitingForAdmin() ? (<><TutorIcon name="ri-time-line"/> Waiting for interviewer...</>) : (<><TutorIcon name="ri-loader-4-line ri-spin"/> Connecting...</>)}
              </span>
              {isConnected() && (<span class="call-duration">{formatDuration(callDuration())}</span>)}
            </div>
            <div class="call-title">
              <TutorIcon name="ri-video-chat-line"/>
              Speaking Interview
            </div>
          </div>

          {/* Video Grid */}
          <div class="video-grid">
            {/* Remote Video (Admin/Interviewer) */}
            <div class="video-container remote">
              {remoteStream() ? (<video ref={element => { remoteVideoRef.current = element; element.srcObject = remoteStream(); void element.play().catch(() => {}); }} autoplay playsinline/>) : (<div class="video-placeholder">
                  <div class="avatar-placeholder">
                    <TutorIcon name="ri-user-line"/>
                  </div>
                  <p>{waitingForAdmin() ? 'Waiting for interviewer...' : 'Connecting...'}</p>
                </div>)}
              <div class="video-label">Interviewer</div>
            </div>

            {/* Local Video (Self) */}
            <div class="video-container local">
              <video ref={element => { localVideoRef.current = element; element.srcObject = localStream(); void element.play().catch(() => {}); }} autoplay muted playsinline/>
              {!isVideoEnabled() && (<div class="video-off-overlay">
                  <TutorIcon name="ri-camera-off-line"/>
                </div>)}
              <div class="video-label">You</div>
            </div>
          </div>

          {/* Call Controls */}
          <div class="call-controls">
            <button disabled={ended()} class={`control-btn ${!isAudioEnabled() ? 'off' : ''}`} onClick={toggleAudio} title={isAudioEnabled() ? 'Mute' : 'Unmute'}>
              <TutorIcon name={isAudioEnabled() ? 'ri-mic-line' : 'ri-mic-off-line'}/>
            </button>
            
            <button disabled={ended()} class={`control-btn ${!isVideoEnabled() ? 'off' : ''}`} onClick={toggleVideo} title={isVideoEnabled() ? 'Turn off camera' : 'Turn on camera'}>
              <TutorIcon name={isVideoEnabled() ? 'ri-camera-line' : 'ri-camera-off-line'}/>
            </button>
            
            <button disabled={ended()} class="control-btn" onClick={() => { if (getSocket().connected) call?.recover(); else connectSocket(); }} title="Reconnect interview"><TutorIcon name="ri-refresh-line"/></button>
            <button disabled={ended()} class="control-btn end-call" onClick={() => handleEndCall()} title="Leave interview">
              <TutorIcon name="ri-phone-line"/>
            </button>
          </div>
          <div class="interview-recording-notice" role="status">{ended() ? <a href="/interview">Back to interviews</a> : recording() ? 'Recording for screening and quality review' : 'This interview may be recorded for screening and quality review.'}</div>
        </div>)}
    </div>);
};
export default InterviewRoomPage;

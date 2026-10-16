import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import type { Socket } from 'socket.io-client';
import { getSocket } from '../client/socket/socket.client';
interface UseWebRTCProps {
    remoteUserId?: string;
    socket?: Socket | null;
    initiator?: boolean;
    enabled?: boolean;
}
interface MediaDeviceSelection {
    audioDeviceId?: string;
    videoDeviceId?: string;
}
const buildAudioConstraints = (devices: MediaDeviceSelection): MediaTrackConstraints => ({
    ...(devices.audioDeviceId ? { deviceId: { exact: devices.audioDeviceId } } : {}),
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: false },
    channelCount: { ideal: 1 }
});
const findMediaTransceiver = (pc: RTCPeerConnection, kind: string) => {
    const matching = pc.getTransceivers().filter(transceiver => transceiver.receiver.track.kind === kind || transceiver.sender.track?.kind === kind);
    return matching.find(transceiver => transceiver.mid !== null) || matching[0];
};
export const useWebRTC = (_props0: UseWebRTCProps = {}) => {
    const enabledRef = { current: _props0["enabled"] === undefined ? true : _props0["enabled"] } as {
        current: any;
    };
    createEffect(() => enabledRef.current = _props0["enabled"] === undefined ? true : _props0["enabled"]);
    const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = createSignal<MediaStream | null>(null);
    const [isConnected, setIsConnected] = createSignal(false);
    const [isConnecting, setIsConnecting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const peerConnection = { current: null } as {
        current: (RTCPeerConnection | null) | null;
    };
    const localStreamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const remoteStreamRef = { current: null } as {
        current: (MediaStream | null) | null;
    };
    const socketRef = { current: _props0["socket"] ?? null } as {
        current: (Socket | null) | null;
    };
    const startingLocalStreamRef = { current: null } as {
        current: (Promise<MediaStream> | null) | null;
    };
    const deviceSelectionRef = { current: {} } as {
        current: MediaDeviceSelection | null;
    };
    const remoteUserIdRef = { current: _props0["remoteUserId"] } as {
        current: (string | undefined) | null;
    };
    const pendingCandidates = { current: [] } as {
        current: RTCIceCandidate[] | null;
    };
    const creatingConnectionRef = { current: null } as {
        current: (Promise<RTCPeerConnection> | null) | null;
    };
    const offerRetryRef = { current: null } as {
        current: (ReturnType<typeof setTimeout> | null) | null;
    };
    const disconnectTimerRef = { current: null } as {
        current: (ReturnType<typeof setTimeout> | null) | null;
    };
    const peerReadyRef = { current: false } as {
        current: any;
    };
    const offeringRef = { current: false } as {
        current: any;
    };
    const answeringRef = { current: false } as {
        current: any;
    };
    const connectionGenerationRef = { current: 0 } as {
        current: any;
    };
    const mediaGenerationRef = { current: 0 } as {
        current: any;
    };
    createEffect(on(() => [_props0["socket"]], () => {
        const _cleanup5 = untrack(() => {
            socketRef.current = _props0["socket"] ?? null;
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    const getActiveSocket = createMemo(on(() => [], () => () => socketRef.current ?? getSocket()));
    const buildMediaConstraints = createMemo(on(() => [], () => (audio = true, video = true, devices: MediaDeviceSelection = deviceSelectionRef.current): MediaStreamConstraints => ({
        audio: audio ? buildAudioConstraints(devices) : false,
        video: video
            ? devices.videoDeviceId
                ? { deviceId: { exact: devices.videoDeviceId } }
                : true
            : false
    })));
    const ensureMediaTransceivers = createMemo(on(() => [], () => (pc: RTCPeerConnection) => {
        const ensureKind = (kind: 'audio' | 'video') => {
            const existing = findMediaTransceiver(pc, kind);
            if (existing) {
                if (existing.direction === 'inactive' || existing.direction === 'recvonly') {
                    existing.direction = 'sendrecv';
                }
                return existing;
            }
            return pc.addTransceiver(kind, { direction: 'sendrecv' });
        };
        ensureKind('audio');
        ensureKind('video');
    }));
    const addLocalTracksToPeerConnection = createMemo(on(() => [ensureMediaTransceivers()], () => async (pc: RTCPeerConnection) => {
        ensureMediaTransceivers()(pc);
        if (!localStreamRef.current)
            return;
        for (const track of localStreamRef.current.getTracks()) {
            const transceiver = findMediaTransceiver(pc, track.kind);
            if (transceiver) {
                if (transceiver.direction === 'inactive' || transceiver.direction === 'recvonly') {
                    transceiver.direction = 'sendrecv';
                }
                const senderWithStreams = transceiver.sender as RTCRtpSender & {
                    setStreams?: (...streams: MediaStream[]) => void;
                };
                senderWithStreams.setStreams?.(localStreamRef.current);
                if (transceiver.sender.track?.id !== track.id) {
                    await transceiver.sender.replaceTrack(track);
                }
                continue;
            }
            const senderExists = pc.getSenders().some(sender => sender.track?.id === track.id);
            if (!senderExists) {
                pc.addTrack(track, localStreamRef.current);
            }
        }
    }));
    const resetPeerConnection = createMemo(on(() => [], () => () => {
        connectionGenerationRef.current++;
        if (offerRetryRef.current)
            clearTimeout(offerRetryRef.current);
        if (disconnectTimerRef.current)
            clearTimeout(disconnectTimerRef.current);
        offerRetryRef.current = null;
        disconnectTimerRef.current = null;
        peerConnection.current?.close();
        peerConnection.current = null;
        pendingCandidates.current = [];
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setIsConnected(false);
        setIsConnecting(false);
    }));
    createEffect(on(() => [_props0["remoteUserId"], resetPeerConnection()], () => {
        const _cleanup6 = untrack(() => {
            const previousUserId = remoteUserIdRef.current;
            remoteUserIdRef.current = _props0["remoteUserId"];
            if (previousUserId && _props0["remoteUserId"] && previousUserId !== _props0["remoteUserId"]) {
                resetPeerConnection()();
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    const getIceConfiguration = createMemo(on(() => [getActiveSocket()], () => async (): Promise<RTCConfiguration> => {
        const fallback: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
        const activeSocket = getActiveSocket()();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out loading call relay settings')), 10000);
            activeSocket.emit('webrtc:ice-config', (config: RTCConfiguration & {
                error?: string;
            }) => {
                clearTimeout(timeout);
                if (config?.error) {
                    reject(new Error(config.error));
                    return;
                }
                resolve(config?.iceServers?.length ? config : fallback);
            });
        });
    }));
    // Initialize peer connection
    const createPeerConnection = createMemo(on(() => [ensureMediaTransceivers(), getIceConfiguration(), getActiveSocket(), _props0["initiator"] === undefined ? false : _props0["initiator"], resetPeerConnection()], () => async (): Promise<RTCPeerConnection> => {
        if (peerConnection.current) {
            return peerConnection.current;
        }
        if (creatingConnectionRef.current)
            return creatingConnectionRef.current;
        creatingConnectionRef.current = (async () => {
            setIsConnecting(true);
            const generation = connectionGenerationRef.current;
            const iceServers = await getIceConfiguration()();
            if (generation !== connectionGenerationRef.current)
                throw new Error('Call setup was cancelled');
            const pc = new RTCPeerConnection(iceServers);
            // Answerers use the channels from the received offer, not pre-created unmatched channels.
            if (_props0["initiator"] === undefined ? false : _props0["initiator"])
                ensureMediaTransceivers()(pc);
            // Handle ICE candidates - use ref to always have latest remoteUserId
            pc.onicecandidate = (event) => {
                if (event.candidate && remoteUserIdRef.current) {
                    try {
                        const socket = getActiveSocket()();
                        socket.emit('webrtc:ice-candidate', {
                            candidate: event.candidate,
                            to: remoteUserIdRef.current
                        });
                    }
                    catch (err) {
                        console.error('Failed to send ICE candidate:', err);
                    }
                }
            };
            // Handle remote stream
            pc.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    remoteStreamRef.current = event.streams[0];
                    setRemoteStream(event.streams[0]);
                    return;
                }
                const stream = remoteStreamRef.current ?? new MediaStream();
                if (!stream.getTracks().some(track => track.id === event.track.id)) {
                    stream.addTrack(event.track);
                }
                remoteStreamRef.current = stream;
                setRemoteStream(new MediaStream(stream.getTracks()));
            };
            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                if (peerConnection.current !== pc)
                    return;
                setIsConnected(pc.connectionState === 'connected');
                setIsConnecting(pc.connectionState === 'new' || pc.connectionState === 'connecting');
                if (pc.connectionState === 'connected') {
                    if (disconnectTimerRef.current)
                        clearTimeout(disconnectTimerRef.current);
                    setError(null);
                }
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    setError('Connection failed or disconnected');
                    if ((_props0["initiator"] === undefined ? false : _props0["initiator"]) && remoteUserIdRef.current && !disconnectTimerRef.current) {
                        disconnectTimerRef.current = setTimeout(async () => {
                            disconnectTimerRef.current = null;
                            if (peerConnection.current === pc &&
                                (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
                                try {
                                    const configuration = await getIceConfiguration()();
                                    if (peerConnection.current !== pc)
                                        return;
                                    pc.setConfiguration(configuration);
                                    if (pc.signalingState === 'stable')
                                        pc.restartIce();
                                    else
                                        resetPeerConnection()();
                                    void createOfferRef.current();
                                }
                                catch (err) {
                                    console.error('Failed to restart the call:', err);
                                    resetPeerConnection()();
                                    void createOfferRef.current();
                                }
                            }
                        }, pc.connectionState === 'failed' ? 0 : 3000);
                    }
                }
            };
            pc.oniceconnectionstatechange = () => {
                if (peerConnection.current !== pc || pc.connectionState !== 'connected')
                    return;
                setIsConnected(true);
                setIsConnecting(false);
                setError(null);
            };
            peerConnection.current = pc;
            return pc;
        })();
        try {
            return await creatingConnectionRef.current;
        }
        finally {
            creatingConnectionRef.current = null;
        }
    }));
    const createOfferRef = { current: async () => { } } as {
        current: (() => Promise<void>) | null;
    };
    // Get local media stream
    const startLocalStream = createMemo(on(() => [buildMediaConstraints(), _props0["initiator"] === undefined ? false : _props0["initiator"]], () => async (audio = true, video = true, devices?: MediaDeviceSelection) => {
        if (devices) {
            deviceSelectionRef.current = devices;
        }
        // If we already have a stream, return it
        if (localStreamRef.current) {
            return localStreamRef.current;
        }
        if (startingLocalStreamRef.current) {
            return startingLocalStreamRef.current;
        }
        startingLocalStreamRef.current = (async () => {
            const generation = mediaGenerationRef.current;
            try {
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints()(audio, video));
                }
                catch (err: any) {
                    if (!video) {
                        throw err;
                    }
                    console.warn('Camera unavailable, retrying with microphone only:', err);
                    stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints()(audio, false));
                    setError('Camera is unavailable. Joined with microphone only.');
                }
                if (generation !== mediaGenerationRef.current) {
                    stream.getTracks().forEach(track => track.stop());
                    throw new Error('Media setup was cancelled');
                }
                setLocalStream(stream);
                localStreamRef.current = stream;
                if ((_props0["initiator"] === undefined ? false : _props0["initiator"]) && peerReadyRef.current)
                    void createOfferRef.current();
                return stream;
            }
            catch (err) {
                console.error('❌ Error accessing media devices:', err);
                setError('Failed to access camera or microphone');
                throw err;
            }
            finally {
                startingLocalStreamRef.current = null;
            }
        })();
        return startingLocalStreamRef.current;
    }));
    // Create and send offer
    const createOffer = createMemo(on(() => [createPeerConnection(), addLocalTracksToPeerConnection(), getActiveSocket()], () => async () => {
        if (!enabledRef.current)
            return;
        const targetUserId = remoteUserIdRef.current;
        if (!targetUserId) {
            console.error('❌ No remote user ID provided for offer');
            return;
        }
        if (offeringRef.current)
            return;
        offeringRef.current = true;
        try {
            const pc = await createPeerConnection()();
            if (pc.connectionState === 'connected')
                return;
            await addLocalTracksToPeerConnection()(pc);
            if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
            }
            if (pc.signalingState !== 'have-local-offer' || !pc.localDescription)
                return;
            const socket = getActiveSocket()();
            const sendOffer = (attempt: number) => {
                if (peerConnection.current !== pc || pc.signalingState !== 'have-local-offer')
                    return;
                socket.timeout(2500).emit('webrtc:offer', {
                    offer: pc.localDescription,
                    to: targetUserId
                }, (err: Error | null, result: {
                    delivered: boolean;
                }) => {
                    if ((err || !result?.delivered) && attempt < 5 && peerConnection.current === pc) {
                        offerRetryRef.current = setTimeout(() => sendOffer(attempt + 1), 1500);
                    }
                });
            };
            sendOffer(0);
        }
        catch (err) {
            console.error('❌ Error creating offer:', err);
            setError('Failed to create offer');
        }
        finally {
            offeringRef.current = false;
        }
    }));
    createEffect(() => createOfferRef.current = createOffer());
    // Handle received offer
    const handleOffer = createMemo(on(() => [createPeerConnection(), addLocalTracksToPeerConnection(), getActiveSocket(), startLocalStream()], () => async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
        if (!enabledRef.current || answeringRef.current)
            return;
        answeringRef.current = true;
        try {
            // Update remote user ID if we didn't know it
            if (!remoteUserIdRef.current) {
                remoteUserIdRef.current = fromUserId;
            }
            if (!localStreamRef.current) {
                try {
                    await startLocalStream()(true, true);
                }
                catch (err) {
                    console.warn('Answering WebRTC offer without local media:', err);
                }
            }
            const pc = await createPeerConnection()();
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await addLocalTracksToPeerConnection()(pc);
            // Add any pending ICE candidates
            while (pendingCandidates.current.length > 0) {
                const candidate = pendingCandidates.current.shift();
                if (candidate) {
                    await pc.addIceCandidate(candidate);
                }
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const socket = getActiveSocket()();
            socket.emit('webrtc:answer', {
                answer,
                to: fromUserId
            });
        }
        catch (err) {
            console.error('❌ Error handling offer:', err);
            setError('Failed to handle offer');
        }
        finally {
            answeringRef.current = false;
        }
    }));
    // Handle received answer
    const handleAnswer = createMemo(on(() => [], () => async (answer: RTCSessionDescriptionInit) => {
        try {
            const pc = peerConnection.current;
            if (!pc) {
                console.error('❌ No peer connection for answer');
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Add any pending ICE candidates
            while (pendingCandidates.current.length > 0) {
                const candidate = pendingCandidates.current.shift();
                if (candidate) {
                    await pc.addIceCandidate(candidate);
                }
            }
        }
        catch (err) {
            console.error('❌ Error handling answer:', err);
            setError('Failed to handle answer');
        }
    }));
    // Handle received ICE candidate
    const handleIceCandidate = createMemo(on(() => [], () => async (candidate: RTCIceCandidateInit) => {
        try {
            const pc = peerConnection.current;
            if (!pc || !pc.remoteDescription) {
                // Queue the candidate if we don't have a remote description yet
                pendingCandidates.current.push(new RTCIceCandidate(candidate));
                return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        catch (err) {
            console.error('❌ Error handling ICE candidate:', err);
        }
    }));
    const switchMediaDevices = createMemo(on(() => [addLocalTracksToPeerConnection(), buildMediaConstraints(), createOffer(), createPeerConnection(), _props0["initiator"] === undefined ? false : _props0["initiator"]], () => async (devices: MediaDeviceSelection) => {
        deviceSelectionRef.current = devices;
        const previousStream = localStreamRef.current;
        const shouldKeepVideo = Boolean(previousStream?.getVideoTracks().some(track => track.readyState === 'live'));
        try {
            const stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints()(true, shouldKeepVideo, devices));
            localStreamRef.current = stream;
            setLocalStream(stream);
            if (!enabledRef.current) {
                previousStream?.getTracks().forEach(track => track.stop());
                return;
            }
            const pc = await createPeerConnection()();
            await addLocalTracksToPeerConnection()(pc);
            for (const kind of ['audio', 'video'] as const) {
                const hasTrack = stream.getTracks().some(track => track.kind === kind);
                if (hasTrack)
                    continue;
                const transceiver = findMediaTransceiver(pc, kind);
                await transceiver?.sender.replaceTrack(null);
            }
            previousStream?.getTracks().forEach(track => track.stop());
            if ((_props0["initiator"] === undefined ? false : _props0["initiator"]) && pc.signalingState === 'stable' && remoteUserIdRef.current) {
                await createOffer()();
            }
        }
        catch (err) {
            console.error('❌ Error switching media devices:', err);
            setError('Failed to switch camera or microphone');
            throw err;
        }
    }));
    // Toggle audio
    const toggleAudio = createMemo(on(() => [], () => (enabled: boolean) => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }));
    // Toggle video
    const toggleVideo = createMemo(on(() => [addLocalTracksToPeerConnection(), buildMediaConstraints(), createOffer(), _props0["initiator"] === undefined ? false : _props0["initiator"]], () => async (enabled: boolean) => {
        const stream = localStreamRef.current;
        if (!stream)
            return;
        const pc = peerConnection.current;
        const videoTransceiver = pc ? findMediaTransceiver(pc, 'video') : undefined;
        if (!enabled) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = false;
                track.stop();
                stream.removeTrack(track);
            });
            await videoTransceiver?.sender.replaceTrack(null);
            setLocalStream(new MediaStream(stream.getTracks()));
            if ((_props0["initiator"] === undefined ? false : _props0["initiator"]) && pc?.signalingState === 'stable' && remoteUserIdRef.current) {
                await createOffer()();
            }
            return;
        }
        let videoTrack = stream.getVideoTracks().find(track => track.readyState === 'live');
        if (!videoTrack) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints()(false, true));
                videoTrack = videoStream.getVideoTracks()[0];
                stream.addTrack(videoTrack);
            }
            catch (err) {
                console.error('❌ Error enabling camera:', err);
                setError('Failed to access camera');
                return;
            }
        }
        else {
            videoTrack.enabled = true;
        }
        if (pc && videoTrack) {
            await addLocalTracksToPeerConnection()(pc);
        }
        setLocalStream(new MediaStream(stream.getTracks()));
        if ((_props0["initiator"] === undefined ? false : _props0["initiator"]) && pc?.signalingState === 'stable' && remoteUserIdRef.current) {
            await createOffer()();
        }
    }));
    // Cleanup
    const cleanup = createMemo(on(() => [resetPeerConnection()], () => () => {
        mediaGenerationRef.current++;
        peerReadyRef.current = false;
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        startingLocalStreamRef.current = null;
        resetPeerConnection()();
        setLocalStream(null);
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setIsConnected(false);
        setError(null);
    }));
    // Setup Socket.IO listeners
    createEffect(on(() => [_props0["socket"], getActiveSocket(), handleOffer(), handleAnswer(), handleIceCandidate(), resetPeerConnection(), _props0["initiator"] === undefined ? false : _props0["initiator"], _props0["enabled"] === undefined ? true : _props0["enabled"]], () => {
        const _cleanup7 = untrack(() => {
            if (!(_props0["enabled"] === undefined ? true : _props0["enabled"])) {
                resetPeerConnection()();
                return;
            }
            try {
                const activeSocket = getActiveSocket()();
                const onOffer = (_props1: any) => {
                    handleOffer()(_props1["offer"], _props1["from"]);
                };
                const onAnswer = (_props2: any) => {
                    handleAnswer()(_props2["answer"]);
                };
                const onIceCandidate = (_props3: any) => {
                    handleIceCandidate()(_props3["candidate"]);
                };
                const onPeerLeft = () => {
                    resetPeerConnection()();
                };
                const onDisconnect = () => resetPeerConnection()();
                const onPeerReady = (_props4: {
                    from: string;
                }) => {
                    if (!(_props0["initiator"] === undefined ? false : _props0["initiator"]) || _props4["from"] !== remoteUserIdRef.current)
                        return;
                    peerReadyRef.current = true;
                    if (localStreamRef.current)
                        void createOfferRef.current();
                };
                activeSocket.on('webrtc:offer', onOffer);
                activeSocket.on('webrtc:answer', onAnswer);
                activeSocket.on('webrtc:ice-candidate', onIceCandidate);
                activeSocket.on('webrtc:peer-left', onPeerLeft);
                activeSocket.on('disconnect', onDisconnect);
                activeSocket.on('webrtc:ready', onPeerReady);
                return () => {
                    activeSocket.off('webrtc:offer', onOffer);
                    activeSocket.off('webrtc:answer', onAnswer);
                    activeSocket.off('webrtc:ice-candidate', onIceCandidate);
                    activeSocket.off('webrtc:peer-left', onPeerLeft);
                    activeSocket.off('disconnect', onDisconnect);
                    activeSocket.off('webrtc:ready', onPeerReady);
                };
            }
            catch (err) {
                // Socket will be initialized by the parent component
            }
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    // Cleanup on unmount
    createEffect(on(() => [cleanup()], () => {
        const _cleanup8 = untrack(() => {
            return () => {
                cleanup()();
            };
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    return {
        get localStream() {
            return localStream();
        },
        get remoteStream() {
            return remoteStream();
        },
        get isConnected() {
            return isConnected();
        },
        get isConnecting() {
            return isConnecting();
        },
        get error() {
            return error();
        },
        get startLocalStream() {
            return startLocalStream();
        },
        get createOffer() {
            return createOffer();
        },
        get toggleAudio() {
            return toggleAudio();
        },
        get toggleVideo() {
            return toggleVideo();
        },
        get switchMediaDevices() {
            return switchMediaDevices();
        },
        get cleanup() {
            return cleanup();
        }
    };
};

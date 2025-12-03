# WebRTC Video Call Testing Guide

## Overview
Both student and tutor ClassroomPage components now have WebRTC video calling functionality integrated with Socket.IO signaling.

## What's Implemented

### Backend (Socket.IO Server)
- ✅ WebRTC signaling handler (`webrtc.handler.ts`)
- ✅ Session management (join/leave rooms)
- ✅ Peer-to-peer connection relay (offer, answer, ICE candidates)
- ✅ Socket.IO server running on port 8766

### Frontend (Both Student & Tutor)
- ✅ `useWebRTC` hook for managing WebRTC connections
- ✅ Socket.IO client integration
- ✅ Session room joining
- ✅ Local and remote video stream handling
- ✅ Audio/video toggle controls
- ✅ Connection state management

## How to Test

### Step 1: Start the Backend
```bash
cd fluentxverse-server
bun install  # if not already done
bun run dev
```

Server should start on:
- HTTP API: `http://localhost:8765`
- Socket.IO: `http://localhost:8766`

### Step 2: Start Student App
```bash
cd fluentxverse-student
bun install  # if not already done
bun run dev
```

Student app should start on `http://localhost:5173` (or next available port)

### Step 3: Start Tutor App
```bash
cd fluentxverse-tutor
bun install  # if not already done
bun run dev
```

Tutor app should start on `http://localhost:5174` (or next available port)

### Step 4: Test Video Connection

#### Option 1: Using a Real Booking
1. Book a lesson as a student
2. Get the `bookingId` from the database or API response
3. Navigate to:
   - Student: `http://localhost:5173/classroom/{sessionId}`
   - Tutor: `http://localhost:5174/classroom/{sessionId}`
4. Both should connect to the same session room

#### Option 2: Quick Test with Same Session ID
1. Open Student app: `http://localhost:5173/classroom/test-session-123`
2. Open Tutor app: `http://localhost:5174/classroom/test-session-123`
3. Both should join the same session and connect via WebRTC

### Step 5: Test Different Scenarios

#### Test Camera/Microphone Permissions
- Both users should be prompted for camera/microphone access
- Grant permissions to see video streams

#### Test Connection Flow
1. **Student joins first:**
   - Student sees "Waiting for tutor to join..."
   - Tutor joins
   - Student initiates WebRTC offer
   - Connection establishes

2. **Tutor joins first:**
   - Tutor sees "Waiting for student to join..."
   - Student joins
   - Student initiates offer
   - Connection establishes

#### Test Controls
- ✅ Mute/Unmute button
- ✅ Video on/off button
- ✅ Leave classroom button
- ✅ Swap main/PiP videos (click on PiP)

#### Test Peer Disconnect
- One user leaves
- Other user should see "Peer left" in console
- Remote video should disappear

## Browser Console Logs

Look for these logs to verify functionality:

### Student Side:
```
🎓 Student joining session: {sessionId}
👥 User joined: tutor - {tutorId}
🎥 Starting local media stream...
📞 Creating offer for tutor...
📺 Remote stream attached
```

### Tutor Side:
```
👨‍🏫 Tutor joining session: {sessionId}
👥 User joined: student - {studentId}
🎥 Starting local media stream...
Received offer from: {studentId}
📺 Remote stream attached
```

### Socket.IO Server:
```
✅ Socket.IO server initialized
📞 WebRTC offer sent from {studentId} to {tutorId}
📞 WebRTC answer sent from {tutorId} to {studentId}
🧊 ICE candidate sent from {userId} to {peerId}
```

## Troubleshooting

### No Video Stream
1. Check browser console for permission errors
2. Ensure HTTPS or localhost (WebRTC requires secure context)
3. Verify Socket.IO connection: `socket.connected` should be `true`
4. Check if `localStream` and `remoteStream` are not null

### Connection Fails
1. Verify both users are in the same session room
2. Check Socket.IO server is running on port 8766
3. Look for ICE candidate exchange in console logs
4. Test with different browsers (Chrome, Firefox, Edge)

### STUN/TURN Issues
- Currently using Google's public STUN servers
- For production, consider setting up your own TURN server
- If users are behind strict firewalls, TURN server is required

### Socket.IO Not Connecting
1. Check `VITE_SOCKET_URL` environment variable
2. Default: `http://localhost:8766`
3. Ensure CORS is configured correctly in server
4. Check network tab for WebSocket connection

## Environment Variables

### Student App (.env)
```bash
VITE_SOCKET_URL=http://localhost:8766
VITE_API_URL=http://localhost:8765
```

### Tutor App (.env)
```bash
VITE_SOCKET_URL=http://localhost:8766
VITE_API_URL=http://localhost:8765
```

## Next Steps / TODO

- [ ] Add session validation (check booking status)
- [ ] Display actual tutor/student names from database
- [ ] Implement chat functionality with Socket.IO
- [ ] Add screen sharing capability
- [ ] Implement session recording
- [ ] Add bandwidth/connection quality indicators
- [ ] Implement session timer and auto-end
- [ ] Add TURN server for production
- [ ] Error handling and reconnection logic
- [ ] Mobile responsive video layout

## Testing Checklist

- [ ] Both users can see each other's video
- [ ] Audio works in both directions
- [ ] Mute/unmute works correctly
- [ ] Video on/off works correctly
- [ ] Swap video works (PiP to main)
- [ ] Leave classroom cleans up connections
- [ ] Connection status messages display correctly
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile browsers

## Known Limitations

1. **No session validation yet**: Any sessionId works for testing
2. **Mock student/tutor info**: Names are placeholders
3. **No chat integration**: Chat is still using mock data
4. **No recording**: Video calls are not recorded
5. **STUN only**: May not work behind strict NATs/firewalls

## Architecture Notes

### WebRTC Flow:
1. Student joins session → Socket.IO room
2. Tutor joins session → Socket.IO room
3. Student creates local media stream
4. Student creates WebRTC offer → sends via Socket.IO
5. Tutor receives offer → creates answer → sends via Socket.IO
6. Student receives answer
7. ICE candidates exchanged via Socket.IO
8. Peer connection established
9. Video/audio streams flow directly peer-to-peer

### Key Components:
- `useWebRTC.ts`: Hook managing RTCPeerConnection
- `socket.client.ts`: Socket.IO client initialization
- `webrtc.handler.ts`: Server-side signaling relay
- `ClassroomPage.tsx`: UI and orchestration

### Security Considerations:
- [ ] Validate session belongs to user
- [ ] Check booking status and timing
- [ ] Rate limit Socket.IO events
- [ ] Sanitize session IDs
- [ ] Implement session expiry
- [ ] Add authentication to Socket.IO handshake

---

**Ready to test!** 🎥 Open two browser tabs/windows and navigate to the same sessionId on student and tutor apps.

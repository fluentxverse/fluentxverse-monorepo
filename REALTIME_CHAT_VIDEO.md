# Real-Time Chat & Video Call System

This system implements real-time chat and peer-to-peer video calling using Socket.IO for signaling and WebRTC for media streaming.

## Architecture

### Backend (Port 8766)
- **Socket.IO Server**: WebSocket server for real-time communication and WebRTC signaling
- **PostgreSQL Database**: Stores chat messages, sessions, and participant data
- **Services**:
  - `ChatService`: Handles message persistence and retrieval
  - `SessionService`: Manages session state and participants

### Frontend
- **Socket.IO Client**: Connects to backend WebSocket server
- **Custom Hooks**:
  - `useChat`: Chat messaging functionality
  - `useSession`: Session management (join/leave)
  - `useWebRTC`: Video/audio streaming with WebRTC

## Database Schema

### Tables
1. **sessions**: Stores tutoring session metadata
   - `id`, `tutor_id`, `student_id`, `status`, `start_time`, `end_time`, `duration_minutes`

2. **chat_messages**: Stores all chat messages
   - `id`, `session_id`, `sender_id`, `sender_type`, `message_text`, `correction_text`, `created_at`

3. **session_participants**: Tracks active participants
   - `id`, `session_id`, `user_id`, `user_type`, `socket_id`, `is_active`, `joined_at`, `left_at`

## Socket.IO Events

### Client → Server
- **Chat Events**:
  - `chat:send` - Send a chat message
  - `chat:typing` - Indicate typing status
  - `chat:request-history` - Request message history

- **Session Events**:
  - `session:join` - Join a session room
  - `session:leave` - Leave a session room

- **WebRTC Signaling**:
  - `webrtc:offer` - Send WebRTC offer
  - `webrtc:answer` - Send WebRTC answer
  - `webrtc:ice-candidate` - Send ICE candidate

### Server → Client
- **Chat Events**:
  - `chat:message` - Receive new message
  - `chat:history` - Receive message history
  - `chat:typing` - Receive typing status

- **Session Events**:
  - `session:user-joined` - User joined session
  - `session:user-left` - User left session
  - `session:state` - Session state update

- **WebRTC Signaling**:
  - `webrtc:offer` - Receive WebRTC offer
  - `webrtc:answer` - Receive WebRTC answer
  - `webrtc:ice-candidate` - Receive ICE candidate
  - `webrtc:peer-left` - Peer disconnected

## Setup & Usage

### 1. Start PostgreSQL Database
```bash
cd fluentxverse-server
docker compose up -d fluentxverse-postgres
```

### 2. Configure Environment
Add to `fluentxverse-server/.env`:
```
DATABASE_URL=postgresql://fluentxverse_user:fluentxverse_pass@localhost:5432/fluentxverse
FRONTEND_URL=http://localhost:5173
```

### 3. Start Backend Server
```bash
cd fluentxverse-server
bun run dev
```
- HTTP server runs on port 8765
- Socket.IO server runs on port 8766

### 4. Start Frontend
```bash
cd fluentxverse
bun run dev
```

## Frontend Integration Example

### Initialize Socket Connection
```typescript
import { initSocket, connectSocket } from './client/socket/socket.client';

// Initialize socket (call once when user logs in)
const socket = initSocket();
connectSocket();
```

### Use Chat in Component
```typescript
import { useChat } from './hooks/useChat';

function ChatComponent({ sessionId }: { sessionId: string }) {
  const { messages, sendMessage, sendTyping, isTyping } = useChat(sessionId);

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.text}</div>
      ))}
      {isTyping && <div>Other user is typing...</div>}
    </div>
  );
}
```

### Use Video Call in Component
```typescript
import { useWebRTC } from './hooks/useWebRTC';
import { useSession } from './hooks/useSession';

function VideoCallComponent({ sessionId, remoteUserId }: Props) {
  const { joinSession, leaveSession, sessionState } = useSession();
  const { 
    localStream, 
    remoteStream, 
    startLocalStream, 
    createOffer,
    toggleAudio,
    toggleVideo 
  } = useWebRTC({ remoteUserId });

  useEffect(() => {
    // Join session room
    joinSession(sessionId);
    
    // Start local media
    startLocalStream(true, true);

    return () => {
      leaveSession();
    };
  }, []);

  // When both users are in the session, initiate call
  useEffect(() => {
    if (sessionState?.status === 'active') {
      createOffer(); // Tutor creates offer
    }
  }, [sessionState]);

  return (
    <div>
      <video ref={el => el && (el.srcObject = localStream)} autoPlay muted />
      <video ref={el => el && (el.srcObject = remoteStream)} autoPlay />
      <button onClick={() => toggleAudio(false)}>Mute</button>
      <button onClick={() => toggleVideo(false)}>Stop Video</button>
    </div>
  );
}
```

## WebRTC Flow

1. **Both users join session**: `session:join` event
2. **Server notifies both users**: `session:state` with participant info
3. **Tutor creates offer**: Calls `createOffer()` → sends `webrtc:offer`
4. **Student receives offer**: Creates answer → sends `webrtc:answer`
5. **Tutor receives answer**: Connection established
6. **ICE candidates exchanged**: Both peers send/receive `webrtc:ice-candidate`
7. **Media streaming begins**: Audio/video flows peer-to-peer

## Authentication

Socket.IO connections are authenticated using the existing cookie-based auth system:
- Extracts `auth` cookie from handshake headers
- Parses user data (userId, email, tier)
- Determines userType based on tier (tier 2+ = tutor, else student)

## Security Considerations

1. **Authentication**: All socket connections require valid auth cookie
2. **Session Rooms**: Users can only join sessions they're authorized for
3. **Message Validation**: Server validates all incoming messages
4. **Rate Limiting**: Consider implementing rate limiting for chat/signaling events
5. **CORS**: Configured to allow frontend origin only

## Troubleshooting

### Socket won't connect
- Check auth cookie is present and valid
- Verify Socket.IO server is running on port 8766
- Check CORS settings match your frontend URL

### Video/audio not working
- Ensure browser has camera/microphone permissions
- Check STUN servers are reachable
- Verify both peers are in the same session room
- Check browser console for WebRTC errors

### Messages not saving
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check database connection in server logs
- Ensure session exists in database

## File Structure

```
fluentxverse-server/src/
├── db/
│   ├── postgres.ts              # PostgreSQL connection pool
│   └── memgraph.ts              # Memgraph (user auth) connection
├── socket/
│   ├── socket.server.ts         # Socket.IO initialization
│   ├── handlers/
│   │   ├── chat.handler.ts      # Chat event handlers
│   │   ├── webrtc.handler.ts    # WebRTC signaling handlers
│   │   └── session.handler.ts   # Session management handlers
│   ├── middleware/
│   │   └── auth.middleware.ts   # Socket authentication
│   └── types/
│       └── socket.types.ts      # Socket event type definitions
└── services/
    ├── chat.services/
    │   └── chat.service.ts      # Chat message CRUD
    └── session.services/
        └── session.service.ts   # Session & participant management

fluentxverse/src/
├── client/socket/
│   └── socket.client.ts         # Socket.IO client initialization
├── hooks/
│   ├── useChat.ts               # Chat hook
│   ├── useSession.ts            # Session hook
│   └── useWebRTC.ts             # WebRTC hook
└── types/
    └── socket.types.ts          # Frontend socket types
```

## Next Steps

1. **Integrate with ClassroomPage.tsx**: Replace mock chat with real Socket.IO chat
2. **Session Creation**: Add API endpoint to create tutoring sessions
3. **Permissions**: Implement proper authorization for session access
4. **Recording**: Add session recording functionality
5. **Screen Sharing**: Extend WebRTC for screen sharing
6. **File Sharing**: Add file upload/download in chat
7. **Notifications**: Add desktop notifications for new messages
8. **Reconnection**: Handle reconnection scenarios gracefully

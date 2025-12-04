import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { chatHandler } from './handlers/chat.handler';
import { webrtcHandler } from './handlers/webrtc.handler';
import { sessionHandler } from './handlers/session.handler';
import { authMiddleware } from './middleware/auth.middleware';

export const initSocketServer = (httpServer: HTTPServer) => {
  const allowedOrigins = (
    process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174'
  )
    .split(',')
    .map(o => o.trim());

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(authMiddleware);

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Extract user info from socket (set by auth middleware)
    const userId = socket.data.userId;
    const userType = socket.data.userType;

    console.log(`User ${userId} (${userType}) connected with socket ${socket.id}`);

    // Register event handlers
    chatHandler(io, socket);
    webrtcHandler(io, socket);
    sessionHandler(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO server initialized');
  return io;
};

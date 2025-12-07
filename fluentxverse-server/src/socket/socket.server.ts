import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { chatHandler } from './handlers/chat.handler';
import { webrtcHandler } from './handlers/webrtc.handler';
import { sessionHandler } from './handlers/session.handler';
import { highlightHandler } from './handlers/highlight.handler';
import { notificationHandler } from './handlers/notification.handler';
import { authMiddleware } from './middleware/auth.middleware';

// Store the IO instance for access from other modules
let ioInstance: SocketIOServer | null = null;

/**
 * Get the Socket.IO server instance
 */
export const getIO = (): SocketIOServer | null => {
  return ioInstance;
};

export const initSocketServer = (httpServer: HTTPServer) => {
  const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://192.168.0.102:5173',
    'http://192.168.0.102:5174'
  ];
  
  const envOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);
  
  const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Store the IO instance for global access
  ioInstance = io;

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
    highlightHandler(io, socket);
    notificationHandler(io, socket);

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

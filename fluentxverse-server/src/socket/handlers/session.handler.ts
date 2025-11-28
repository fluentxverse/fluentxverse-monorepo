import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';
import { SessionService } from '../../services/session.services/session.service';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const sessionService = new SessionService();

export const sessionHandler = (io: TypedServer, socket: TypedSocket) => {
  // Join a session
  socket.on('session:join', async (data) => {
    try {
      const { sessionId } = data;
      const userId = socket.data.userId;
      const userType = socket.data.userType;

      // Join the socket.io room
      await socket.join(sessionId);
      socket.data.sessionId = sessionId;

      // Update participant status in database
      await sessionService.addParticipant({
        sessionId,
        userId,
        socketId: socket.id,
        userType
      });

      // Get all participants in the session
      const participants = await sessionService.getSessionParticipants(sessionId);
      
      // Prepare session state
      const sessionState = {
        sessionId,
        participants: {
          tutorId: participants.find(p => p.user_type === 'tutor')?.user_id,
          studentId: participants.find(p => p.user_type === 'student')?.user_id,
          tutorSocketId: participants.find(p => p.user_type === 'tutor')?.socket_id,
          studentSocketId: participants.find(p => p.user_type === 'student')?.socket_id
        },
        status: participants.length === 2 ? 'active' : 'waiting'
      } as const;

      // Notify all users in the session
      io.to(sessionId).emit('session:user-joined', {
        userId,
        userType
      });

      // Send session state to all participants
      io.to(sessionId).emit('session:state', sessionState);

      console.log(`✅ User ${userId} (${userType}) joined session ${sessionId}`);
      console.log(`Session state: ${sessionState.status}, participants:`, sessionState.participants);
    } catch (error) {
      console.error('Error handling session:join:', error);
    }
  });

  // Leave a session
  socket.on('session:leave', async () => {
    try {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      const userType = socket.data.userType;

      if (!sessionId) {
        return;
      }

      // Remove participant from database
      await sessionService.removeParticipant(sessionId, userId);

      // Leave the socket.io room
      await socket.leave(sessionId);
      socket.data.sessionId = undefined;

      // Notify others in the session
      socket.to(sessionId).emit('session:user-left', {
        userId,
        userType
      });

      // Get remaining participants
      const participants = await sessionService.getSessionParticipants(sessionId);
      
      // Send updated session state
      const sessionState = {
        sessionId,
        participants: {
          tutorId: participants.find(p => p.user_type === 'tutor')?.user_id,
          studentId: participants.find(p => p.user_type === 'student')?.user_id,
          tutorSocketId: participants.find(p => p.user_type === 'tutor')?.socket_id,
          studentSocketId: participants.find(p => p.user_type === 'student')?.socket_id
        },
        status: participants.length === 2 ? 'active' : 'waiting'
      } as const;

      io.to(sessionId).emit('session:state', sessionState);

      console.log(`👋 User ${userId} (${userType}) left session ${sessionId}`);
    } catch (error) {
      console.error('Error handling session:leave:', error);
    }
  });

  // Handle disconnect (automatic leave)
  socket.on('disconnect', async () => {
    try {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      const userType = socket.data.userType;

      if (sessionId) {
        await sessionService.removeParticipant(sessionId, userId);
        
        socket.to(sessionId).emit('session:user-left', {
          userId,
          userType
        });

        console.log(`🔌 User ${userId} disconnected from session ${sessionId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect cleanup:', error);
    }
  });
};

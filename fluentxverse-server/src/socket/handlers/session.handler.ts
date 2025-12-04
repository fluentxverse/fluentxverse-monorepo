import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';
import { SessionService } from '../../services/session.services/session.service';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const sessionService = new SessionService();
// In-memory fallback store for dev or DB-down scenarios
const memParticipants: Record<string, Array<{ user_id: string; socket_id: string; user_type: 'tutor' | 'student' }>> = {};

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

      let participants: Array<{ user_id: string; socket_id: string; user_type: 'tutor' | 'student' }> = [];
      try {
        // Preferred: persist to database
        await sessionService.addParticipant({
          sessionId,
          userId,
          socketId: socket.id,
          userType
        });
        participants = await sessionService.getSessionParticipants(sessionId);
      } catch (err) {
        // Fallback: use in-memory participants to keep signaling working in dev
        const list = memParticipants[sessionId] || [];
        const updated = list.filter(p => p.user_id !== userId).concat([{ user_id: userId, socket_id: socket.id, user_type: userType }]);
        memParticipants[sessionId] = updated;
        participants = updated;
        console.warn('⚠️ Using in-memory session participants due to DB error:', (err as Error)?.message);
      }
      
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

      // Remove participant, prefer DB then fallback
      try {
        await sessionService.removeParticipant(sessionId, userId);
      } catch (err) {
        const list = memParticipants[sessionId] || [];
        memParticipants[sessionId] = list.filter(p => p.user_id !== userId);
      }

      // Leave the socket.io room
      await socket.leave(sessionId);
      socket.data.sessionId = undefined;

      // Notify others in the session
      socket.to(sessionId).emit('session:user-left', {
        userId,
        userType
      });

      // Get remaining participants
      let participants: Array<{ user_id: string; socket_id: string; user_type: 'tutor' | 'student' }> = [];
      try {
        participants = await sessionService.getSessionParticipants(sessionId);
      } catch {
        participants = memParticipants[sessionId] || [];
      }
      
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
        try {
          await sessionService.removeParticipant(sessionId, userId);
        } catch {
          const list = memParticipants[sessionId] || [];
          memParticipants[sessionId] = list.filter(p => p.user_id !== userId);
        }
        
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

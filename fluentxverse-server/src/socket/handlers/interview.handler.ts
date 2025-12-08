import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Store interview room participants
const interviewRooms = new Map<string, { tutorSocketId?: string; adminSocketId?: string }>();

export const interviewHandler = (io: TypedServer, socket: TypedSocket) => {
  // Join interview room
  socket.on('interview:join', async (data: { roomId: string; odIuser?: string; role: 'tutor' | 'admin' }) => {
    try {
      const { roomId, role } = data;
      
      // Leave any existing interview rooms
      socket.rooms.forEach(room => {
        if (room.startsWith('interview-')) {
          socket.leave(room);
        }
      });
      
      // Join the new room
      socket.join(roomId);
      socket.data.interviewRoomId = roomId;
      socket.data.interviewRole = role;
      
      // Update room participants
      if (!interviewRooms.has(roomId)) {
        interviewRooms.set(roomId, {});
      }
      
      const room = interviewRooms.get(roomId)!;
      if (role === 'tutor') {
        room.tutorSocketId = socket.id;
      } else if (role === 'admin') {
        room.adminSocketId = socket.id;
      }
      
      console.log(`👔 ${role} joined interview room: ${roomId}`);
      
      // Notify other participant
      if (role === 'admin' && room.tutorSocketId) {
        // Admin joined, notify tutor
        io.to(room.tutorSocketId).emit('interview:admin-joined' as any);
        console.log(`📢 Notified tutor that admin joined`);
      } else if (role === 'tutor' && room.adminSocketId) {
        // Tutor joined, notify admin
        io.to(room.adminSocketId).emit('interview:tutor-joined' as any);
        console.log(`📢 Notified admin that tutor joined`);
      }
    } catch (error) {
      console.error('Error joining interview room:', error);
    }
  });

  // Handle interview offer (tutor -> admin)
  socket.on('interview:offer', async (data: { roomId: string; offer: { type: string; sdp?: string } }) => {
    try {
      const { roomId, offer } = data;
      const room = interviewRooms.get(roomId);
      
      if (room?.adminSocketId) {
        io.to(room.adminSocketId).emit('interview:offer' as any, { offer });
        console.log(`📞 Interview offer sent to admin`);
      }
    } catch (error) {
      console.error('Error handling interview offer:', error);
    }
  });

  // Handle interview answer (admin -> tutor)
  socket.on('interview:answer', async (data: { roomId: string; answer: { type: string; sdp?: string } }) => {
    try {
      const { roomId, answer } = data;
      const room = interviewRooms.get(roomId);
      
      if (room?.tutorSocketId) {
        io.to(room.tutorSocketId).emit('interview:answer' as any, { answer });
        console.log(`📞 Interview answer sent to tutor`);
      }
    } catch (error) {
      console.error('Error handling interview answer:', error);
    }
  });

  // Handle ICE candidates
  socket.on('interview:ice-candidate', async (data: { roomId: string; candidate: { candidate: string; sdpMid?: string; sdpMLineIndex?: number } }) => {
    try {
      const { roomId, candidate } = data;
      const room = interviewRooms.get(roomId);
      const senderRole = socket.data.interviewRole;
      
      // Send to the other participant
      const targetSocketId = senderRole === 'tutor' ? room?.adminSocketId : room?.tutorSocketId;
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('interview:ice-candidate' as any, { candidate });
        console.log(`🧊 ICE candidate forwarded in interview`);
      }
    } catch (error) {
      console.error('Error handling interview ICE candidate:', error);
    }
  });

  // End interview
  socket.on('interview:end', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      
      // Notify all participants
      io.to(roomId).emit('interview:ended' as any);
      
      // Cleanup room
      interviewRooms.delete(roomId);
      
      console.log(`🔚 Interview ended: ${roomId}`);
    } catch (error) {
      console.error('Error ending interview:', error);
    }
  });

  // Handle disconnect - cleanup interview rooms
  socket.on('disconnect', () => {
    const roomId = socket.data.interviewRoomId;
    if (roomId) {
      const room = interviewRooms.get(roomId);
      if (room) {
        const role = socket.data.interviewRole;
        if (role === 'tutor') {
          delete room.tutorSocketId;
          // Notify admin
          if (room.adminSocketId) {
            io.to(room.adminSocketId).emit('interview:tutor-left' as any);
          }
        } else if (role === 'admin') {
          delete room.adminSocketId;
          // Notify tutor
          if (room.tutorSocketId) {
            io.to(room.tutorSocketId).emit('interview:admin-left' as any);
          }
        }
        
        // Cleanup if room is empty
        if (!room.tutorSocketId && !room.adminSocketId) {
          interviewRooms.delete(roomId);
        }
      }
    }
  });
};

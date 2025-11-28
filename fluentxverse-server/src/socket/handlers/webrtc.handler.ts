import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const webrtcHandler = (io: TypedServer, socket: TypedSocket) => {
  // Handle WebRTC offer
  socket.on('webrtc:offer', async (data) => {
    try {
      const { offer, to } = data;
      const from = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!sessionId) {
        console.error('No session ID found for WebRTC offer');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:offer', { offer, from });
        console.log(`📞 WebRTC offer sent from ${from} to ${to}`);
      } else {
        console.error(`Target socket not found for user ${to}`);
      }
    } catch (error) {
      console.error('Error handling webrtc:offer:', error);
    }
  });

  // Handle WebRTC answer
  socket.on('webrtc:answer', async (data) => {
    try {
      const { answer, to } = data;
      const from = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!sessionId) {
        console.error('No session ID found for WebRTC answer');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:answer', { answer, from });
        console.log(`📞 WebRTC answer sent from ${from} to ${to}`);
      } else {
        console.error(`Target socket not found for user ${to}`);
      }
    } catch (error) {
      console.error('Error handling webrtc:answer:', error);
    }
  });

  // Handle ICE candidate
  socket.on('webrtc:ice-candidate', async (data) => {
    try {
      const { candidate, to } = data;
      const from = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!sessionId) {
        console.error('No session ID found for ICE candidate');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:ice-candidate', { candidate, from });
        console.log(`🧊 ICE candidate sent from ${from} to ${to}`);
      } else {
        console.error(`Target socket not found for user ${to}`);
      }
    } catch (error) {
      console.error('Error handling webrtc:ice-candidate:', error);
    }
  });

  // Handle peer leaving
  socket.on('disconnect', async () => {
    try {
      const sessionId = socket.data.sessionId;
      if (sessionId) {
        // Notify other peers that this user left
        socket.to(sessionId).emit('webrtc:peer-left');
        console.log(`📞 User ${socket.data.userId} left WebRTC session`);
      }
    } catch (error) {
      console.error('Error handling peer disconnect:', error);
    }
  });
};

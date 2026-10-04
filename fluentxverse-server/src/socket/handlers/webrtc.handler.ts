import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';
import { getIceConfiguration } from '../iceConfiguration';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const webrtcHandler = (io: TypedServer, socket: TypedSocket) => {
  socket.on('webrtc:ice-config', callback => {
    if (typeof callback === 'function' && (socket.data.sessionId || socket.data.interviewRoomId)) {
      callback(getIceConfiguration(socket.data.userId));
    }
  });

  socket.on('webrtc:ready', () => {
    const sessionId = socket.data.sessionId;
    if (sessionId && socket.rooms.has(sessionId) && socket.data.userType === 'student') {
      socket.to(sessionId).emit('webrtc:ready', { from: socket.data.userId });
    }
  });

  // Handle WebRTC offer
  socket.on('webrtc:offer', async (data, callback) => {
    try {
      const { offer, to } = data;
      const from = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!sessionId || !socket.rooms.has(sessionId) || !offer || typeof to !== 'string') {
        console.error('No session ID found for WebRTC offer');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:offer', { offer, from });
        callback?.({ delivered: true });
      } else {
        console.error(`Target socket not found for user ${to}`);
        callback?.({ delivered: false });
      }
    } catch (error) {
      console.error('Error handling webrtc:offer:', error);
      callback?.({ delivered: false });
    }
  });

  // Handle WebRTC answer
  socket.on('webrtc:answer', async (data) => {
    try {
      const { answer, to } = data;
      const from = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!sessionId || !socket.rooms.has(sessionId) || !answer || typeof to !== 'string') {
        console.error('No session ID found for WebRTC answer');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:answer', { answer, from });
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

      if (!sessionId || !socket.rooms.has(sessionId) || !candidate || typeof to !== 'string') {
        console.error('No session ID found for ICE candidate');
        return;
      }

      // Find target socket in the same session
      const sockets = await io.in(sessionId).fetchSockets();
      const targetSocket = sockets.find(s => s.data.userId === to);

      if (targetSocket) {
        targetSocket.emit('webrtc:ice-candidate', { candidate, from });
      } else {
        console.error(`Target socket not found for user ${to}`);
      }
    } catch (error) {
      console.error('Error handling webrtc:ice-candidate:', error);
    }
  });

};

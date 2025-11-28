import type { Socket } from 'socket.io';
import type { AuthData } from '../../services/auth.services/auth.interface';

export const authMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Extract auth cookie from handshake
    const cookieString = socket.handshake.headers.cookie;
    
    if (!cookieString) {
      return next(new Error('Authentication required: No cookies found'));
    }

    // Parse the auth cookie
    const authCookie = cookieString
      .split('; ')
      .find(row => row.startsWith('auth='))
      ?.split('=')[1];

    if (!authCookie) {
      return next(new Error('Authentication required: No auth cookie found'));
    }

    // Decode and parse the cookie value
    const decodedCookie = decodeURIComponent(authCookie);
    const authData: AuthData = JSON.parse(decodedCookie);

    if (!authData.userId || !authData.email) {
      return next(new Error('Invalid authentication data'));
    }

    // Attach user data to socket
    socket.data.userId = authData.userId;
    socket.data.userType = authData.tier >= 2 ? 'tutor' : 'student'; // Assuming tier 2+ are tutors
    socket.data.email = authData.email;

    console.log(`✅ Socket authenticated: User ${authData.userId} (${socket.data.userType})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

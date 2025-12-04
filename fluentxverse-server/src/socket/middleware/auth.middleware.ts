import type { Socket } from 'socket.io';
import type { AuthData } from '../../services/auth.services/auth.interface';

export const authMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Prefer explicit token from handshake.auth; fallback to cookie in dev
    const tokenFromAuth = (socket.handshake.auth as any)?.token as string | undefined;
    const cookieString = socket.handshake.headers.cookie;
    let authData: AuthData | null = null;

    if (tokenFromAuth) {
      try {
        authData = JSON.parse(tokenFromAuth) as AuthData;
      } catch {
        // If token is not JSON, skip parsing – your real impl could verify JWT here
        authData = null;
      }
    }

    if (!authData && cookieString) {
      const authCookie = cookieString
        .split('; ')
        .find(row => row.startsWith('auth='))
        ?.split('=')[1];

      if (authCookie) {
        const decodedCookie = decodeURIComponent(authCookie);
        try {
          authData = JSON.parse(decodedCookie) as AuthData;
        } catch {
          authData = null;
        }
      }
    }

    // In development, allow anonymous sockets but mark as unauthenticated
    const isDev = process.env.NODE_ENV !== 'production';
    if (!authData && isDev) {
      socket.data.userId = `anon-${socket.id}`;
      socket.data.userType = 'student';
      socket.data.email = undefined;
      console.warn('⚠️ Dev mode: allowing unauthenticated socket', socket.id);
      return next();
    }

    if (!authData) {
      return next(new Error('Authentication required: No valid auth token or cookie'));
    }

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

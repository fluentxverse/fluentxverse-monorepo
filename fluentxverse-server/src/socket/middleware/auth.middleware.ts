import type { Socket } from 'socket.io';
import { verifyAuthToken, type JwtAuthPayload } from '../../utils/jwt';

type AdminCookieAuth = {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

export const authMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Prefer explicit token from handshake.auth; fallback to cookie in dev
    const tokenFromAuth = (socket.handshake.auth as any)?.token as string | undefined;
    const cookieString = socket.handshake.headers.cookie;
    let authPayload: JwtAuthPayload | null = null;

    // Try to verify JWT token from handshake.auth
    if (tokenFromAuth) {
      authPayload = await verifyAuthToken(tokenFromAuth);
      if (authPayload) {
        console.log('🔐 Auth verified from handshake token - userId:', authPayload.userId);
      }
    }

    // Try cookies if no valid token from handshake
    if (!authPayload && cookieString) {
      console.log('🍪 Cookie string received, attempting JWT verification');

      // Admin dashboard cookie
      const adminAuthCookie = cookieString
        .split('; ')
        .find(row => row.startsWith('adminAuth='))
        ?.split('=')[1];

      if (adminAuthCookie) {
        const decodedCookie = decodeURIComponent(adminAuthCookie);
        const adminPayload = await verifyAuthToken(decodedCookie);
        if (adminPayload?.userId) {
          socket.data.userId = adminPayload.userId;
          socket.data.userType = 'admin';
          socket.data.email = adminPayload.email;
          console.log(`✅ Socket authenticated: Admin ${adminPayload.userId}`);
          return next();
        }
      }
      
      // Check for tutorAuth cookie first (tutor app), then fallback to studentAuth cookie
      let authCookie = cookieString
        .split('; ')
        .find(row => row.startsWith('tutorAuth='))
        ?.split('=')[1];
      
      console.log('🍪 tutorAuth cookie found:', authCookie ? 'YES' : 'NO');
      
      if (!authCookie) {
        authCookie = cookieString
          .split('; ')
          .find(row => row.startsWith('studentAuth='))
          ?.split('=')[1];
        console.log('🍪 studentAuth cookie found:', authCookie ? 'YES' : 'NO');
      }

      if (authCookie) {
        const decodedCookie = decodeURIComponent(authCookie);
        authPayload = await verifyAuthToken(decodedCookie);
        if (authPayload) {
          console.log('🍪 JWT verified from cookie - userId:', authPayload.userId);
        }
      }
    }

    // In development, allow anonymous sockets but mark as unauthenticated
    const isDev = process.env.NODE_ENV !== 'production';
    if (!authPayload && isDev) {
      // This shouldn't happen now since clients send their tier, but fallback just in case
      socket.data.userId = `anon-${socket.id}`;
      socket.data.userType = 'student';
      socket.data.email = undefined;
      console.warn('⚠️ Dev mode: allowing unauthenticated socket', socket.id);
      return next();
    }

    if (!authPayload) {
      return next(new Error('Authentication required: No valid JWT token or cookie'));
    }

    if (!authPayload.userId || !authPayload.email) {
      return next(new Error('Invalid authentication data'));
    }

    // Attach user data to socket
    socket.data.userId = authPayload.userId;
    socket.data.userType = (authPayload.tier && authPayload.tier >= 2) ? 'tutor' : 'student';
    socket.data.email = authPayload.email;

    console.log(`✅ Socket authenticated: User ${authPayload.userId} (${socket.data.userType})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

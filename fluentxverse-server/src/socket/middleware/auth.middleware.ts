import type { Socket } from 'socket.io';
import type { AuthData } from '../../services/auth.services/auth.interface';

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
      console.log('🍪 Cookie string received:', cookieString);

      // Admin dashboard cookie
      const adminAuthCookie = cookieString
        .split('; ')
        .find(row => row.startsWith('adminAuth='))
        ?.split('=')[1];

      if (adminAuthCookie) {
        const decodedCookie = decodeURIComponent(adminAuthCookie);
        try {
          const adminAuth = JSON.parse(decodedCookie) as AdminCookieAuth;
          if (adminAuth?.userId) {
            socket.data.userId = adminAuth.userId;
            socket.data.userType = 'admin';
            socket.data.email = undefined;
            console.log(`✅ Socket authenticated: Admin ${adminAuth.userId}`);
            return next();
          }
        } catch (e) {
          console.log('🍪 Failed to parse adminAuth cookie:', e);
        }
      }
      
      // Check for tutorAuth cookie first (tutor app), then fallback to auth cookie (student app)
      let authCookie = cookieString
        .split('; ')
        .find(row => row.startsWith('tutorAuth='))
        ?.split('=')[1];
      
      console.log('🍪 tutorAuth cookie found:', authCookie ? 'YES' : 'NO');
      
      if (!authCookie) {
        authCookie = cookieString
          .split('; ')
          .find(row => row.startsWith('auth='))
          ?.split('=')[1];
        console.log('🍪 auth cookie found:', authCookie ? 'YES' : 'NO');
      }

      if (authCookie) {
        const decodedCookie = decodeURIComponent(authCookie);
        try {
          authData = JSON.parse(decodedCookie) as AuthData;
          console.log('🍪 Auth data from cookie - userId:', authData.userId, 'email:', authData.email);
        } catch (e) {
          console.log('🍪 Failed to parse cookie:', e);
          authData = null;
        }
      }
    }
    
    console.log('🔐 Token from handshake.auth:', tokenFromAuth ? 'EXISTS' : 'NULL');
    if (tokenFromAuth && authData) {
      console.log('🔐 Auth data from token - userId:', authData.userId);
    }

    // In development, allow anonymous sockets but mark as unauthenticated
    const isDev = process.env.NODE_ENV !== 'production';
    if (!authData && isDev) {
      // This shouldn't happen now since clients send their tier, but fallback just in case
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
    socket.data.userType = (authData.tier && authData.tier >= 2) ? 'tutor' : 'student';
    socket.data.email = authData.email;

    console.log(`✅ Socket authenticated: User ${authData.userId} (${socket.data.userType})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

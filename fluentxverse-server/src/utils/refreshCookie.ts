import type { Cookie } from 'elysia';
import type { AuthData } from '@/services/auth.services/auth.interface';

/**
 * Refresh the auth cookie with a new expiration time (1 hour)
 * Call this on every authenticated request to keep the session alive
 */
export function refreshAuthCookie(cookie: Record<string, Cookie<any>>, authData: AuthData) {
  cookie.auth?.set({
    value: JSON.stringify({
      userId: authData.userId,
      email: authData.email,
      firstName: authData.firstName,
      lastName: authData.lastName,
      walletAddress: authData.walletAddress,
      mobileNumber: authData.mobileNumber,
      tier: authData.tier
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour in seconds
    path: '/'
  });
}

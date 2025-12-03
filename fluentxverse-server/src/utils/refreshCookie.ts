import type { Cookie } from 'elysia';
import type { AuthData } from '@/services/auth.services/auth.interface';

/**
 * Refresh the auth cookie with a new expiration time (1 hour)
 * Call this on every authenticated request to keep the session alive
 */
export function refreshAuthCookie(cookie: Record<string, Cookie<any>>, authData: AuthData, cookieName: 'tutorAuth' | 'studentAuth' = 'tutorAuth') {
  cookie[cookieName]?.set({
    value: JSON.stringify({
      userId: authData.userId,
      email: authData.email,
      firstName: authData.firstName,
      lastName: authData.lastName,
      familyName: authData.familyName,
      givenName: authData.givenName,
      walletAddress: authData.walletAddress,
      mobileNumber: authData.mobileNumber,
      tier: authData.tier,
      role: authData.role
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour in seconds
    path: '/'
  });
}

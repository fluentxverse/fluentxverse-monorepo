import type { AuthData } from '@/services/auth.services/auth.interface';

/**
 * Shared admin guard for reusable across routes
 */
export const createAdminGuard = (cookie: any, set: any): AuthData | null => {
  const raw = cookie.adminAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
  if ((authData as any).role && (authData as any).role !== 'admin') {
    set.status = 403;
    return null;
  }
  return authData;
};

/**
 * Tutor guard for tutor-only routes
 */
export const createTutorGuard = (cookie: any, set: any): AuthData | null => {
  const raw = cookie.tutorAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
  return authData;
};

/**
 * Student guard for student-only routes
 */
export const createStudentGuard = (cookie: any, set: any): AuthData | null => {
  const raw = cookie.studentAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
  return authData;
};

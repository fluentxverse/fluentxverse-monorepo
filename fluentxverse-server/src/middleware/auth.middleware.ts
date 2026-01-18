import { verifyAuthToken, type JwtAuthPayload } from '@/utils/jwt';

/**
 * Shared admin guard for reusable across routes
 * Returns JWT payload if valid, null otherwise
 */
export const createAdminGuard = async (cookie: any, set: any): Promise<JwtAuthPayload | null> => {
  const raw = cookie.adminAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const payload = await verifyAuthToken(raw);
  if (!payload) {
    set.status = 401;
    return null;
  }
  if (payload.role && payload.role !== 'admin' && payload.role !== 'superadmin') {
    set.status = 403;
    return null;
  }
  return payload;
};

/**
 * Tutor guard for tutor-only routes
 * Returns JWT payload if valid, null otherwise
 */
export const createTutorGuard = async (cookie: any, set: any): Promise<JwtAuthPayload | null> => {
  const raw = cookie.tutorAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const payload = await verifyAuthToken(raw);
  if (!payload) {
    set.status = 401;
    return null;
  }
  return payload;
};

/**
 * Student guard for student-only routes
 * Returns JWT payload if valid, null otherwise
 */
export const createStudentGuard = async (cookie: any, set: any): Promise<JwtAuthPayload | null> => {
  const raw = cookie.studentAuth?.value;
  if (!raw) {
    set.status = 401;
    return null;
  }
  const payload = await verifyAuthToken(raw);
  if (!payload) {
    set.status = 401;
    return null;
  }
  return payload;
};

/**
 * Any authenticated user guard (admin, tutor, or student)
 * Useful for read-only resources accessible to all authenticated users
 * Returns JWT payload if valid, null otherwise
 */
export const createAnyAuthGuard = async (cookie: any, set: any): Promise<JwtAuthPayload | null> => {
  // Try admin cookie first
  const adminRaw = cookie.adminAuth?.value;
  if (adminRaw) {
    const payload = await verifyAuthToken(adminRaw);
    if (payload) return payload;
  }
  
  // Try tutor cookie
  const tutorRaw = cookie.tutorAuth?.value;
  if (tutorRaw) {
    const payload = await verifyAuthToken(tutorRaw);
    if (payload) return payload;
  }
  
  // Try student cookie
  const studentRaw = cookie.studentAuth?.value;
  if (studentRaw) {
    const payload = await verifyAuthToken(studentRaw);
    if (payload) return payload;
  }
  
  set.status = 401;
  return null;
};

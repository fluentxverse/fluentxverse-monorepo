import type { TutorProfileData } from '../types/tutorProfile.types';

export function createTutorProfileCache(now = Date.now) {
  let entry: { userId: string; data: TutorProfileData; expiresAt: number } | null = null;
  let revision = 0;
  return {
    get revision() { return revision; },
    read(userId: string): TutorProfileData | null {
      if (!entry || entry.userId !== userId || entry.expiresAt <= now()) return null;
      return entry.data;
    },
    write(userId: string, data: TutorProfileData, expectedRevision: number) {
      if (expectedRevision !== revision) return false;
      entry = { userId, data, expiresAt: now() + 30000 };
      return true;
    },
    clear() { entry = null; revision++; },
  };
}

// Private, bounded, tab-memory only. Authentication changes and profile writes clear it.
export const tutorProfileCache = createTutorProfileCache();
export const changesTutorProfile = (url = '') => /^\/tutor\/(?:profile(?:\/submit)?|profile-picture|intro-video|user\/(?:personal-info|email))\/?$/.test(url);

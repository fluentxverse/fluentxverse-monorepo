// Tutor-related types and interfaces for backend

export interface Tutor {
  userId: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  profilePicture?: string;
  bio?: string;
  tier: number;
  hourlyRate?: number;
  languages?: string[];
  specializations?: string[];
  totalSessions?: number;
  rating?: number;
  totalReviews?: number;
  isAvailable?: boolean;
  nextAvailableSlot?: string;
  country?: string;
  timezone?: string;
  isVerified?: boolean;
  joinedDate?: string;
}

export interface TutorProfile extends Tutor {
  education?: string[];
  certifications?: string[];
  experienceYears?: number;
  teachingStyle?: string;
  introduction?: string;
  videoIntroUrl?: string;
  completionRate?: number;
  responseTime?: string;
  repeatStudents?: number;
}

export interface TutorFilters {
  languages?: string[];
  specializations?: string[];
  minRating?: number;
  maxHourlyRate?: number;
  minHourlyRate?: number;
  isAvailable?: boolean;
  sortBy?: 'rating' | 'price-low' | 'price-high' | 'popular' | 'newest';
}

export interface TutorSearchParams extends TutorFilters {
  query?: string;
  page?: number;
  limit?: number;
}

export interface TutorSearchResponse {
  tutors: Tutor[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

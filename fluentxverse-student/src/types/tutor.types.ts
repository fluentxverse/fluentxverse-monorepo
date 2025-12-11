// Tutor-related types and interfaces

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
  
  // Tutor-specific fields
  hourlyRate?: number;
  languages?: string[];
  specializations?: string[];
  totalSessions?: number;
  rating?: number;
  totalReviews?: number;
  
  // Availability
  isAvailable?: boolean;
  nextAvailableSlot?: string;
  
  // Location
  country?: string;
  timezone?: string;
  
  // Profile completion
  isVerified?: boolean;
  joinedDate?: string;
}

export interface TutorProfile extends Tutor {
  // Extended profile information
  education?: string[];
  certifications?: string[];
  experienceYears?: number;
  teachingStyle?: string;
  introduction?: string;
  videoIntroUrl?: string;
  
  // Personal info education fields
  schoolAttended?: string;
  major?: string;
  teachingQualifications?: string;
  
  // Detailed stats
  completionRate?: number;
  responseTime?: string; // e.g., "within 2 hours"
  repeatStudents?: number;
}

export interface TutorFilters {
  languages?: string[];
  specializations?: string[];
  maxHourlyRate?: number;
  minHourlyRate?: number;
  dateFilter?: string; // ISO date string YYYY-MM-DD
  startTime?: string; // HH:MM format (24-hour)
  endTime?: string; // HH:MM format (24-hour)
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

export interface TutorReview {
  id: string;
  tutorId: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  sessionDate: string;
}

export interface TutorAvailability {
  tutorId: string;
  availableSlots: TimeSlot[];
}

export interface TimeSlot {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  isBooked: boolean;
}

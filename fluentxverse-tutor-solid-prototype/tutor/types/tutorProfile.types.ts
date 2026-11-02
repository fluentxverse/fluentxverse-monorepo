interface ProfileItemStatus {
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedAt?: string;
}
export interface TutorProfileData {
  userId?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  nickname?: string;
  email: string;
  phoneNumber?: string;
  country?: string;
  bio?: string;
  introduction?: string;
  teachingStyle?: string;
  languages?: string[];
  specializations?: string[];
  interests?: string[];
  education?: string[];
  schoolAttended?: string;
  major?: string;
  educationalAttainment?: string;
  teachingExperience?: string;
  teachingQualifications?: string[];
  certifications?: string[];
  experienceYears?: number;
  hourlyRate?: number;
  rating?: number;
  totalReviews?: number;
  totalSessions?: number;
  isVerified?: boolean;
  isAvailable?: boolean;
  profilePicture?: string;
  videoIntroUrl?: string;
  profileStatus?: 'incomplete' | 'pending_review' | 'approved' | 'rejected';
  profileSubmittedAt?: string;
  profileItemStatuses?: Partial<Record<'nickname' | 'profilePicture' | 'videoIntro' | 'bio' | 'education' | 'interests', ProfileItemStatus>>;
  profileRejectionReason?: string;
  pendingProfileChanges?: { itemKey: string; fieldKey?: string; newValue: any; status: 'pending' | 'approved' | 'rejected'; rejectionReason?: string; submittedAt: string }[];
  hasPendingChanges?: boolean;
}

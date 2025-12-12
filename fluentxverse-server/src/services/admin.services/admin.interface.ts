export interface DashboardStats {
  totalTutors: number;
  certifiedTutors: number;
  pendingTutors: number;
  totalStudents: number;
  totalSessions: number;
  totalRevenue: number;
}

export interface ExamStats {
  writtenExams: {
    total: number;
    passed: number;
    failed: number;
  };
  speakingExams: {
    total: number;
    passed: number;
    failed: number;
    processing: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'tutor_registered' | 'exam_passed' | 'exam_failed' | 'student_joined' | 'booking';
  message: string;
  timestamp: string;
  userId?: string;
}

export interface PendingTutor {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  status: 'pending_written' | 'pending_speaking' | 'processing';
  writtenExamPassed: boolean;
  speakingExamPassed: boolean;
  interviewResult?: 'pass' | 'fail' | null;
  interviewDate?: string | null;
}

export interface PendingProfileReview {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  videoIntroUrl?: string;
  schoolAttended?: string;
  major?: string;
  interests?: string[];
  submittedAt: string;
  profileStatus: 'pending_review';
}

export interface TutorListItem {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  writtenExamPassed: boolean;
  speakingExamPassed: boolean;
  writtenExamScore?: number;
  speakingExamScore?: number;
  status: 'pending' | 'certified' | 'processing' | 'failed';
  languages: string[];
  totalSessions: number;
  rating: number;
  // Suspension fields
  isSuspended: boolean;
  suspendedUntil?: string;
  suspendedReason?: string;
  suspendedAt?: string;
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  totalSessions: number;
  totalSpent: number;
  status: 'active' | 'inactive';
  lastActive: string;
  // Suspension fields
  isSuspended: boolean;
  suspendedUntil?: string;
  suspendedReason?: string;
  suspendedAt?: string;
}

// Admin Auth Types
export interface AdminUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'superadmin';
  createdAt: string;
}

export interface AdminLoginParams {
  username: string;
  password: string;
}

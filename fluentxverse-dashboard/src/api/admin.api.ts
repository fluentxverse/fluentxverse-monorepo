import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export interface RecentActivity {
  id: string;
  type: 'tutor_registered' | 'exam_passed' | 'exam_failed' | 'student_joined' | 'booking';
  message: string;
  timestamp: string;
  userId?: string;
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
  status: 'pending' | 'certified' | 'processing' | 'failed' | 'pending_profile';
  profileStatus?: 'incomplete' | 'pending_review' | 'approved' | 'rejected';
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

export interface SuspensionHistoryItem {
  id: string;
  action: 'suspended' | 'unsuspended' | 'auto-unsuspended';
  reason: string;
  until?: string;
  previousSuspendedUntil?: string;
  previousReason?: string;
  createdAt: string;
  targetType: 'tutor' | 'student';
  suspendedBy?: string;
  unsuspendedBy?: string;
}

export interface AnalyticsData {
  period: string;
  tutorTrend: { date: string; count: number }[];
  studentTrend: { date: string; count: number }[];
  examStats: { type: string; total: number; passed: number }[];
  suspensionStats: { action: string; targetType: string; count: number }[];
  summary: {
    totalTutors: number;
    totalStudents: number;
    suspendedTutors: number;
    suspendedStudents: number;
    newTutors: number;
    newStudents: number;
  };
}

export interface SuspensionAnalytics {
  recentLogs: {
    id: string;
    action: string;
    reason: string;
    targetType: string;
    createdAt: string;
    adminName: string | null;
  }[];
  reasonDistribution: { reason: string; count: number }[];
  monthlyTrend: { month: number; year: number; action: string; count: number }[];
}

// Inbox/System Message types
export type MessageCategory = 'announcement' | 'update' | 'alert' | 'news' | 'promotion';
export type TargetAudience = 'all' | 'students' | 'tutors';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  targetAudience: TargetAudience;
  priority: MessagePriority;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageParams {
  title: string;
  content: string;
  category: MessageCategory;
  targetAudience: TargetAudience;
  priority?: MessagePriority;
  createdBy: string;
}

// API Response type
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const adminApi = {
  /**
   * Get dashboard overview statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>('/admin/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get stats');
    }
    return response.data.data!;
  },

  /**
   * Get exam statistics
   */
  async getExamStats(): Promise<ExamStats> {
    const response = await api.get<ApiResponse<ExamStats>>('/admin/exam-stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get exam stats');
    }
    return response.data.data!;
  },

  /**
   * Get pending tutors
   */
  async getPendingTutors(limit: number = 10): Promise<PendingTutor[]> {
    const response = await api.get<ApiResponse<PendingTutor[]>>('/admin/pending-tutors', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending tutors');
    }
    return response.data.data!;
  },

  /**
   * Get pending profile reviews
   */
  async getPendingProfiles(limit: number = 20): Promise<PendingProfileReview[]> {
    const response = await api.get<ApiResponse<PendingProfileReview[]>>('/admin/pending-profiles', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending profiles');
    }
    return response.data.data!;
  },

  /**
   * Review a tutor profile (approve/reject)
   */
  async reviewProfile(tutorId: string, action: 'approve' | 'reject', reason?: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/profile/${tutorId}/review`, {
      action,
      reason
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to review profile');
    }
  },

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    const response = await api.get<ApiResponse<RecentActivity[]>>('/admin/activity', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get recent activity');
    }
    return response.data.data!;
  },

  /**
   * Get tutors list with filters
   */
  async getTutors(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'certified' | 'pending' | 'processing' | 'failed';
    search?: string;
  }): Promise<{ tutors: TutorListItem[]; total: number }> {
    const response = await api.get<ApiResponse<{ tutors: TutorListItem[]; total: number }>>('/admin/tutors', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get tutors');
    }
    return response.data.data!;
  },

  /**
   * Get students list with filters
   */
  async getStudents(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'active' | 'inactive';
    search?: string;
  }): Promise<{ students: StudentListItem[]; total: number }> {
    const response = await api.get<ApiResponse<{ students: StudentListItem[]; total: number }>>('/admin/students', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get students');
    }
    return response.data.data!;
  },

  /**
   * Suspend a tutor
   */
  async suspendTutor(tutorId: string, reason: string, until: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/tutors/${tutorId}/suspend`, {
      reason,
      until
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to suspend tutor');
    }
  },

  /**
   * Unsuspend a tutor
   */
  async unsuspendTutor(tutorId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/tutors/${tutorId}/unsuspend`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unsuspend tutor');
    }
  },

  /**
   * Suspend a student
   */
  async suspendStudent(studentId: string, reason: string, until: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/students/${studentId}/suspend`, {
      reason,
      until
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to suspend student');
    }
  },

  /**
   * Unsuspend a student
   */
  async unsuspendStudent(studentId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/students/${studentId}/unsuspend`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unsuspend student');
    }
  },

  /**
   * Get suspension history for a tutor
   */
  async getTutorSuspensionHistory(tutorId: string): Promise<SuspensionHistoryItem[]> {
    const response = await api.get<ApiResponse<SuspensionHistoryItem[]>>(`/admin/tutors/${tutorId}/suspension-history`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension history');
    }
    return response.data.data!;
  },

  /**
   * Get suspension history for a student
   */
  async getStudentSuspensionHistory(studentId: string): Promise<SuspensionHistoryItem[]> {
    const response = await api.get<ApiResponse<SuspensionHistoryItem[]>>(`/admin/students/${studentId}/suspension-history`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension history');
    }
    return response.data.data!;
  },

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(period: string = 'week'): Promise<AnalyticsData> {
    const response = await api.get<ApiResponse<AnalyticsData>>('/admin/analytics', {
      params: { period }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get analytics');
    }
    return response.data.data!;
  },

  /**
   * Get suspension analytics
   */
  async getSuspensionAnalytics(): Promise<SuspensionAnalytics> {
    const response = await api.get<ApiResponse<SuspensionAnalytics>>('/admin/analytics/suspensions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension analytics');
    }
    return response.data.data!;
  },

  // ============ INBOX / SYSTEM MESSAGES ============

  /**
   * Get all system messages
   */
  async getSystemMessages(params?: {
    category?: MessageCategory;
    targetAudience?: TargetAudience;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: SystemMessage[]; total: number }> {
    const response = await api.get<ApiResponse<{ messages: SystemMessage[]; total: number }>>('/inbox/admin/messages', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get system messages');
    }
    return response.data.data!;
  },

  /**
   * Create a new system message
   */
  async createSystemMessage(params: CreateMessageParams): Promise<SystemMessage> {
    const response = await api.post<ApiResponse<SystemMessage>>('/inbox/admin/create', params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create message');
    }
    return response.data.data!;
  },

  /**
   * Update a system message
   */
  async updateSystemMessage(messageId: string, updates: Partial<CreateMessageParams>): Promise<SystemMessage> {
    const response = await api.put<ApiResponse<SystemMessage>>(`/inbox/admin/update/${messageId}`, updates);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update message');
    }
    return response.data.data!;
  },

  /**
   * Delete a system message
   */
  async deleteSystemMessage(messageId: string): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/inbox/admin/delete/${messageId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete message');
    }
  }
};

export default adminApi;

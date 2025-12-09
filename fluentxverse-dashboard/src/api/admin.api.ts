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
  }
};

export default adminApi;

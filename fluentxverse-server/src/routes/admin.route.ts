import Elysia, { t } from 'elysia';
import { AdminService } from '../services/admin.services/admin.service';

const adminService = new AdminService();

const Admin = new Elysia({ prefix: '/admin' })
  /**
   * Get dashboard overview stats
   * GET /admin/stats
   */
  .get('/stats', async () => {
    try {
      const stats = await adminService.getDashboardStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in /admin/stats:', error);
      return {
        success: false,
        error: 'Failed to get dashboard stats'
      };
    }
  })

  /**
   * Get exam statistics
   * GET /admin/exam-stats
   */
  .get('/exam-stats', async () => {
    try {
      const stats = await adminService.getExamStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in /admin/exam-stats:', error);
      return {
        success: false,
        error: 'Failed to get exam stats'
      };
    }
  })

  /**
   * Get pending tutors (not fully certified)
   * GET /admin/pending-tutors
   */
  .get('/pending-tutors', async ({ query }) => {
    try {
      const limit = query.limit ? Number(query.limit) : 10;
      const tutors = await adminService.getPendingTutors(limit);
      return {
        success: true,
        data: tutors
      };
    } catch (error) {
      console.error('Error in /admin/pending-tutors:', error);
      return {
        success: false,
        error: 'Failed to get pending tutors'
      };
    }
  })

  /**
   * Get all tutors with filters
   * GET /admin/tutors
   */
  .get('/tutors', async ({ query }) => {
    try {
      const params = {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        status: (query.status as 'all' | 'certified' | 'pending' | 'processing' | 'failed') || 'all',
        search: query.search || ''
      };
      const result = await adminService.getTutors(params);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error in /admin/tutors:', error);
      return {
        success: false,
        error: 'Failed to get tutors'
      };
    }
  })

  /**
   * Get all students with filters
   * GET /admin/students
   */
  .get('/students', async ({ query }) => {
    try {
      const params = {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        status: (query.status as 'all' | 'active' | 'inactive') || 'all',
        search: query.search || ''
      };
      const result = await adminService.getStudents(params);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error in /admin/students:', error);
      return {
        success: false,
        error: 'Failed to get students'
      };
    }
  })

  /**
   * Get recent activity feed
   * GET /admin/activity
   */
  .get('/activity', async ({ query }) => {
    try {
      const limit = query.limit ? Number(query.limit) : 10;
      const activities = await adminService.getRecentActivity(limit);
      return {
        success: true,
        data: activities
      };
    } catch (error) {
      console.error('Error in /admin/activity:', error);
      return {
        success: false,
        error: 'Failed to get recent activity'
      };
    }
  });

export default Admin;

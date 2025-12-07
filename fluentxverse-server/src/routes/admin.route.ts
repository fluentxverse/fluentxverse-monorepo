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
  })

  /**
   * Admin Login
   * POST /admin/login
   */
  .post('/login', async ({ body, cookie }) => {
    try {
      const { username, password } = body as { username: string; password: string };
      
      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required'
        };
      }

      const admin = await adminService.login({ username, password });

      // Set httpOnly cookie
      cookie.adminAuth?.set({
        value: JSON.stringify({
          userId: admin.id,
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role
        }),
        httpOnly: true,
        secure: false, // Set to true in production
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/'
      });

      return {
        success: true,
        message: 'Login successful',
        user: {
          userId: admin.id,
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role
        }
      };
    } catch (error: any) {
      console.error('Error in /admin/login:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })

  /**
   * Admin Logout
   * POST /admin/logout
   */
  .post('/logout', async ({ cookie }) => {
    try {
      // Clear the admin auth cookie
      cookie.adminAuth?.set({
        value: '',
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      });

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Error in /admin/logout:', error);
      return {
        success: false,
        error: 'Logout failed'
      };
    }
  })

  /**
   * Get current admin user
   * GET /admin/me
   */
  .get('/me', async ({ cookie }) => {
    try {
      const authCookie = cookie.adminAuth?.value;
      
      if (!authCookie) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      let userData;
      try {
        userData = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      } catch {
        return {
          success: false,
          error: 'Invalid session'
        };
      }

      if (!userData?.userId) {
        return {
          success: false,
          error: 'Invalid session'
        };
      }

      // Optionally verify admin still exists in DB
      const admin = await adminService.getById(userData.userId);
      if (!admin) {
        // Clear invalid cookie
        cookie.adminAuth?.set({
          value: '',
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 0,
          path: '/'
        });
        return {
          success: false,
          error: 'Session expired'
        };
      }

      return {
        success: true,
        user: {
          userId: admin.id,
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role
        }
      };
    } catch (error) {
      console.error('Error in /admin/me:', error);
      return {
        success: false,
        error: 'Failed to get user info'
      };
    }
  })

  /**
   * Create admin user (for initial setup - should be protected in production)
   * POST /admin/create
   */
  .post('/create', async ({ body }) => {
    try {
      const { username, password, firstName, lastName, role } = body as {
        username: string;
        password: string;
        firstName?: string;
        lastName?: string;
        role?: 'admin' | 'superadmin';
      };

      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required'
        };
      }

      const admin = await adminService.createAdmin(username, password, firstName, lastName, role);

      return {
        success: true,
        message: 'Admin created successfully',
        data: {
          id: admin.id,
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role
        }
      };
    } catch (error: any) {
      console.error('Error in /admin/create:', error);
      return {
        success: false,
        error: error.message || 'Failed to create admin'
      };
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      role: t.Optional(t.Union([t.Literal('admin'), t.Literal('superadmin')]))
    })
  });

export default Admin;

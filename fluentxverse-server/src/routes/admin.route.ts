import Elysia, { t } from 'elysia';
import { AdminService } from '../services/admin.services/admin.service';
import { suspensionJobService } from '../services/admin.services/suspension.job';

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
   * Suspend a tutor
   * POST /admin/tutors/:tutorId/suspend
   */
  .post('/tutors/:tutorId/suspend', async ({ params, body }) => {
    try {
      const { tutorId } = params;
      const { reason, until } = body as { reason: string; until: string };
      
      if (!reason || !until) {
        return {
          success: false,
          error: 'Reason and suspension end date are required'
        };
      }

      await adminService.suspendTutor(tutorId, reason, new Date(until));
      return {
        success: true,
        data: { message: 'Tutor suspended successfully' }
      };
    } catch (error) {
      console.error('Error in /admin/tutors/:tutorId/suspend:', error);
      return {
        success: false,
        error: 'Failed to suspend tutor'
      };
    }
  }, {
    body: t.Object({
      reason: t.String(),
      until: t.String()
    })
  })

  /**
   * Unsuspend a tutor
   * POST /admin/tutors/:tutorId/unsuspend
   */
  .post('/tutors/:tutorId/unsuspend', async ({ params }) => {
    try {
      const { tutorId } = params;
      await adminService.unsuspendTutor(tutorId);
      return {
        success: true,
        data: { message: 'Tutor unsuspended successfully' }
      };
    } catch (error) {
      console.error('Error in /admin/tutors/:tutorId/unsuspend:', error);
      return {
        success: false,
        error: 'Failed to unsuspend tutor'
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
   * Suspend a student
   * POST /admin/students/:studentId/suspend
   */
  .post('/students/:studentId/suspend', async ({ params, body }) => {
    try {
      const { studentId } = params;
      const { reason, until } = body as { reason: string; until: string };
      
      if (!reason || !until) {
        return {
          success: false,
          error: 'Reason and suspension end date are required'
        };
      }

      await adminService.suspendStudent(studentId, reason, new Date(until));
      return {
        success: true,
        data: { message: 'Student suspended successfully' }
      };
    } catch (error) {
      console.error('Error in /admin/students/:studentId/suspend:', error);
      return {
        success: false,
        error: 'Failed to suspend student'
      };
    }
  }, {
    body: t.Object({
      reason: t.String(),
      until: t.String()
    })
  })

  /**
   * Unsuspend a student
   * POST /admin/students/:studentId/unsuspend
   */
  .post('/students/:studentId/unsuspend', async ({ params }) => {
    try {
      const { studentId } = params;
      await adminService.unsuspendStudent(studentId);
      return {
        success: true,
        data: { message: 'Student unsuspended successfully' }
      };
    } catch (error) {
      console.error('Error in /admin/students/:studentId/unsuspend:', error);
      return {
        success: false,
        error: 'Failed to unsuspend student'
      };
    }
  })

  /**
   * Get suspension history for a tutor
   * GET /admin/tutors/:tutorId/suspension-history
   */
  .get('/tutors/:tutorId/suspension-history', async ({ params }) => {
    try {
      const { tutorId } = params;
      const history = await suspensionJobService.getSuspensionHistory(tutorId, 'tutor');
      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('Error in /admin/tutors/:tutorId/suspension-history:', error);
      return {
        success: false,
        error: 'Failed to get suspension history'
      };
    }
  })

  /**
   * Get suspension history for a student
   * GET /admin/students/:studentId/suspension-history
   */
  .get('/students/:studentId/suspension-history', async ({ params }) => {
    try {
      const { studentId } = params;
      const history = await suspensionJobService.getSuspensionHistory(studentId, 'student');
      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('Error in /admin/students/:studentId/suspension-history:', error);
      return {
        success: false,
        error: 'Failed to get suspension history'
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
  })

  /**
   * List all admin users
   * GET /admin/list
   */
  .get('/list', async ({ cookie }) => {
    try {
      const authCookie = cookie.adminAuth?.value;
      if (!authCookie) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      let userData;
      try {
        userData = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      } catch {
        return { success: false, error: 'Invalid session' };
      }

      if (!userData?.userId) {
        return { success: false, error: 'Invalid session' };
      }

      // Verify current user is superadmin
      const currentAdmin = await adminService.getById(userData.userId);
      if (!currentAdmin || currentAdmin.role !== 'superadmin') {
        return {
          success: false,
          error: 'Only superadmins can list admin users'
        };
      }

      const admins = await adminService.listAdmins();
      return {
        success: true,
        data: admins
      };
    } catch (error) {
      console.error('Error in /admin/list:', error);
      return {
        success: false,
        error: 'Failed to list admins'
      };
    }
  })

  /**
   * Delete an admin user
   * DELETE /admin/:id
   */
  .delete('/:id', async ({ params, cookie }) => {
    try {
      const authCookie = cookie.adminAuth?.value;
      if (!authCookie) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      let userData;
      try {
        userData = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      } catch {
        return { success: false, error: 'Invalid session' };
      }

      if (!userData?.userId) {
        return { success: false, error: 'Invalid session' };
      }

      // Verify current user is superadmin
      const currentAdmin = await adminService.getById(userData.userId);
      if (!currentAdmin || currentAdmin.role !== 'superadmin') {
        return {
          success: false,
          error: 'Only superadmins can delete admin users'
        };
      }

      // Prevent self-deletion
      if (params.id === userData.userId) {
        return {
          success: false,
          error: 'Cannot delete your own account'
        };
      }

      const deleted = await adminService.deleteAdmin(params.id);
      return {
        success: deleted,
        message: deleted ? 'Admin deleted successfully' : 'Admin not found'
      };
    } catch (error) {
      console.error('Error in DELETE /admin/:id:', error);
      return {
        success: false,
        error: 'Failed to delete admin'
      };
    }
  })

  /**
   * Update an admin user
   * PUT /admin/:id
   */
  .put('/:id', async ({ params, body, cookie }) => {
    try {
      const authCookie = cookie.adminAuth?.value;
      if (!authCookie) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      let userData;
      try {
        userData = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      } catch {
        return { success: false, error: 'Invalid session' };
      }

      if (!userData?.userId) {
        return { success: false, error: 'Invalid session' };
      }

      // Verify current user is superadmin
      const currentAdmin = await adminService.getById(userData.userId);
      if (!currentAdmin || currentAdmin.role !== 'superadmin') {
        return {
          success: false,
          error: 'Only superadmins can update admin users'
        };
      }

      const { firstName, lastName, role } = body as {
        firstName?: string;
        lastName?: string;
        role?: 'admin' | 'superadmin';
      };

      const updated = await adminService.updateAdmin(params.id, { firstName, lastName, role });
      if (!updated) {
        return {
          success: false,
          error: 'Admin not found'
        };
      }

      return {
        success: true,
        data: updated
      };
    } catch (error) {
      console.error('Error in PUT /admin/:id:', error);
      return {
        success: false,
        error: 'Failed to update admin'
      };
    }
  }, {
    body: t.Object({
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      role: t.Optional(t.Union([t.Literal('admin'), t.Literal('superadmin')]))
    })
  })

  /**
   * Change password for current admin
   * POST /admin/change-password
   */
  .post('/change-password', async ({ body, cookie }) => {
    try {
      const authCookie = cookie.adminAuth?.value;
      if (!authCookie) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      let userData;
      try {
        userData = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      } catch {
        return { success: false, error: 'Invalid session' };
      }

      if (!userData?.userId) {
        return { success: false, error: 'Invalid session' };
      }

      const { currentPassword, newPassword } = body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return {
          success: false,
          error: 'Current password and new password are required'
        };
      }

      if (newPassword.length < 8) {
        return {
          success: false,
          error: 'New password must be at least 8 characters'
        };
      }

      const result = await adminService.changePassword(userData.userId, currentPassword, newPassword);
      return result;
    } catch (error) {
      console.error('Error in /admin/change-password:', error);
      return {
        success: false,
        error: 'Failed to change password'
      };
    }
  }, {
    body: t.Object({
      currentPassword: t.String(),
      newPassword: t.String()
    })
  })

  /**
   * Get comprehensive analytics data
   * GET /admin/analytics
   */
  .get('/analytics', async ({ query }) => {
    try {
      const period = (query.period as string) || 'week';
      const analytics = await adminService.getAnalytics(period);
      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      console.error('Error in /admin/analytics:', error);
      return {
        success: false,
        error: 'Failed to get analytics data'
      };
    }
  })

  /**
   * Get suspension analytics
   * GET /admin/analytics/suspensions
   */
  .get('/analytics/suspensions', async () => {
    try {
      const data = await adminService.getSuspensionAnalytics();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error in /admin/analytics/suspensions:', error);
      return {
        success: false,
        error: 'Failed to get suspension analytics'
      };
    }
  });

export default Admin;

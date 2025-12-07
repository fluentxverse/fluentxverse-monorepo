import Elysia, { t } from 'elysia';
import { NotificationService } from '../services/notification.services/notification.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { refreshAuthCookie } from '../utils/refreshCookie';

const notificationService = new NotificationService();

const Notification = new Elysia({ prefix: '/notifications' })
  /**
   * Get all notifications for the current user
   * GET /notifications
   */
  .get('/', async ({ query, cookie, set }) => {
    try {
      // Check for tutor auth first, then student auth
      let raw = cookie.tutorAuth?.value || cookie.studentAuth?.value;
      const cookieName = cookie.tutorAuth?.value ? 'tutorAuth' : 'studentAuth';
      
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, cookieName);

      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const notifications = await notificationService.getNotifications({
        userId,
        limit,
        offset
      });

      const unreadCount = await notificationService.getUnreadCount(userId);

      return {
        success: true,
        data: {
          notifications,
          unreadCount
        }
      };
    } catch (error) {
      console.error('Error in GET /notifications:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to get notifications'
      };
    }
  })

  /**
   * Get unread notification count
   * GET /notifications/unread-count
   */
  .get('/unread-count', async ({ cookie, set }) => {
    try {
      let raw = cookie.tutorAuth?.value || cookie.studentAuth?.value;
      const cookieName = cookie.tutorAuth?.value ? 'tutorAuth' : 'studentAuth';
      
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      refreshAuthCookie(cookie, authData, cookieName);

      const unreadCount = await notificationService.getUnreadCount(userId);

      return {
        success: true,
        data: { unreadCount }
      };
    } catch (error) {
      console.error('Error in GET /notifications/unread-count:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to get unread count'
      };
    }
  })

  /**
   * Mark a notification as read
   * POST /notifications/:id/read
   */
  .post('/:id/read', async ({ params, cookie, set }) => {
    try {
      let raw = cookie.tutorAuth?.value || cookie.studentAuth?.value;
      const cookieName = cookie.tutorAuth?.value ? 'tutorAuth' : 'studentAuth';
      
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      refreshAuthCookie(cookie, authData, cookieName);

      const success = await notificationService.markAsRead(params.id, userId);

      if (!success) {
        set.status = 404;
        return { success: false, error: 'Notification not found' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in POST /notifications/:id/read:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to mark notification as read'
      };
    }
  })

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  .post('/read-all', async ({ cookie, set }) => {
    try {
      let raw = cookie.tutorAuth?.value || cookie.studentAuth?.value;
      const cookieName = cookie.tutorAuth?.value ? 'tutorAuth' : 'studentAuth';
      
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      refreshAuthCookie(cookie, authData, cookieName);

      const updated = await notificationService.markAllAsRead(userId);

      return {
        success: true,
        data: { updated }
      };
    } catch (error) {
      console.error('Error in POST /notifications/read-all:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to mark all notifications as read'
      };
    }
  })

  /**
   * Delete a notification
   * DELETE /notifications/:id
   */
  .delete('/:id', async ({ params, cookie, set }) => {
    try {
      let raw = cookie.tutorAuth?.value || cookie.studentAuth?.value;
      const cookieName = cookie.tutorAuth?.value ? 'tutorAuth' : 'studentAuth';
      
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      refreshAuthCookie(cookie, authData, cookieName);

      const success = await notificationService.deleteNotification(params.id, userId);

      if (!success) {
        set.status = 404;
        return { success: false, error: 'Notification not found' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in DELETE /notifications/:id:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to delete notification'
      };
    }
  });

export default Notification;

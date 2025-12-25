import Elysia, { t } from 'elysia';
import { inboxService } from '../services/inbox.services/inbox.service';
import { db } from '../db/postgres';
import type { MessageCategory, TargetAudience, MessagePriority } from '../services/inbox.services/inbox.interface';

const Inbox = new Elysia({ prefix: '/inbox' })

  /**
   * Health check for inbox - verifies database tables exist
   * GET /inbox/health
   */
  .get('/health', async () => {
    try {
      // Check if tables exist
      const tablesResult = await db`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('system_messages', 'system_message_recipients')
      `;
      
      const tables = tablesResult.map((r: any) => r.table_name);
      const messagesTableExists = tables.includes('system_messages');
      const recipientsTableExists = tables.includes('system_message_recipients');
      
      // Get message count
      let messageCount = 0;
      if (messagesTableExists) {
        const countResult = await db`SELECT COUNT(*) as count FROM system_messages`;
        messageCount = parseInt(countResult[0]?.count || '0', 10);
      }
      
      return {
        success: true,
        data: {
          messagesTableExists,
          recipientsTableExists,
          messageCount,
          tables
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Database check failed',
        details: error?.message
      };
    }
  })

  /**
   * Get messages for a user (student or tutor)
   * GET /inbox/messages
   */
  .get('/messages', async ({ query }) => {
    try {
      const userId = query.userId;
      const userType = query.userType as 'tutor' | 'student';

      if (!userId || !userType) {
        return {
          success: false,
          error: 'userId and userType are required'
        };
      }

      const result = await inboxService.getUserMessages({
        userId,
        userType,
        category: query.category as MessageCategory,
        isRead: query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined,
        isPinned: query.isPinned === 'true' ? true : query.isPinned === 'false' ? false : undefined,
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0
      });

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('Error in /inbox/messages:', error);
      return {
        success: false,
        error: 'Failed to get messages',
        // Include error details in development for debugging
        ...(process.env.NODE_ENV !== 'production' && { details: error?.message })
      };
    }
  })

  /**
   * Get unread count for a user
   * GET /inbox/unread-count
   */
  .get('/unread-count', async ({ query }) => {
    try {
      const userId = query.userId;
      const userType = query.userType as 'tutor' | 'student';

      if (!userId || !userType) {
        return {
          success: false,
          error: 'userId and userType are required'
        };
      }

      const count = await inboxService.getUnreadCount(userId, userType);

      return {
        success: true,
        data: { unreadCount: count }
      };
    } catch (error: any) {
      console.error('Error in /inbox/unread-count:', error);
      return {
        success: false,
        error: 'Failed to get unread count',
        // Include error details in development for debugging
        ...(process.env.NODE_ENV !== 'production' && { details: error?.message })
      };
    }
  })

  /**
   * Mark a message as read
   * POST /inbox/mark-read/:messageId
   */
  .post('/mark-read/:messageId', async ({ params, body }) => {
    try {
      const { userId, userType } = body as { userId: string; userType: 'tutor' | 'student' };

      if (!userId || !userType) {
        return {
          success: false,
          error: 'userId and userType are required'
        };
      }

      await inboxService.markAsRead({
        messageId: params.messageId,
        userId,
        userType
      });

      return {
        success: true,
        message: 'Message marked as read'
      };
    } catch (error) {
      console.error('Error in /inbox/mark-read:', error);
      return {
        success: false,
        error: 'Failed to mark message as read'
      };
    }
  })

  /**
   * Mark all messages as read for a user
   * POST /inbox/mark-all-read
   */
  .post('/mark-all-read', async ({ body }) => {
    try {
      const { userId, userType } = body as { userId: string; userType: 'tutor' | 'student' };

      if (!userId || !userType) {
        return {
          success: false,
          error: 'userId and userType are required'
        };
      }

      const count = await inboxService.markAllAsRead(userId, userType);

      return {
        success: true,
        message: `${count} messages marked as read`
      };
    } catch (error) {
      console.error('Error in /inbox/mark-all-read:', error);
      return {
        success: false,
        error: 'Failed to mark all messages as read'
      };
    }
  })

  /**
   * Toggle pin status for a message
   * POST /inbox/toggle-pin/:messageId
   */
  .post('/toggle-pin/:messageId', async ({ params, body }) => {
    try {
      const { userId, userType } = body as { userId: string; userType: 'tutor' | 'student' };

      if (!userId || !userType) {
        return {
          success: false,
          error: 'userId and userType are required'
        };
      }

      const isPinned = await inboxService.togglePin({
        messageId: params.messageId,
        userId,
        userType
      });

      return {
        success: true,
        data: { isPinned }
      };
    } catch (error) {
      console.error('Error in /inbox/toggle-pin:', error);
      return {
        success: false,
        error: 'Failed to toggle pin'
      };
    }
  })

  /**
   * Admin: Create a new system message
   * POST /inbox/admin/create
   */
  .post('/admin/create', async ({ body }) => {
    try {
      const { title, content, category, targetAudience, priority, createdBy } = body as {
        title: string;
        content: string;
        category: MessageCategory;
        targetAudience: TargetAudience;
        priority?: MessagePriority;
        createdBy: string;
      };

      if (!title || !content || !category || !targetAudience || !createdBy) {
        return {
          success: false,
          error: 'title, content, category, targetAudience, and createdBy are required'
        };
      }

      const message = await inboxService.createMessage({
        title,
        content,
        category,
        targetAudience,
        priority,
        createdBy
      });

      return {
        success: true,
        data: message
      };
    } catch (error) {
      console.error('Error in /inbox/admin/create:', error);
      return {
        success: false,
        error: 'Failed to create message'
      };
    }
  })

  /**
   * Admin: Get all system messages
   * GET /inbox/admin/messages
   */
  .get('/admin/messages', async ({ query }) => {
    try {
      const result = await inboxService.getAllMessages({
        category: query.category as MessageCategory,
        targetAudience: query.targetAudience as TargetAudience,
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error in /inbox/admin/messages:', error);
      return {
        success: false,
        error: 'Failed to get messages'
      };
    }
  })

  /**
   * Admin: Update a system message
   * PUT /inbox/admin/update/:messageId
   */
  .put('/admin/update/:messageId', async ({ params, body }) => {
    try {
      const updates = body as {
        title?: string;
        content?: string;
        category?: MessageCategory;
        targetAudience?: TargetAudience;
        priority?: MessagePriority;
      };

      const message = await inboxService.updateMessage(params.messageId, updates);

      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      return {
        success: true,
        data: message
      };
    } catch (error) {
      console.error('Error in /inbox/admin/update:', error);
      return {
        success: false,
        error: 'Failed to update message'
      };
    }
  })

  /**
   * Admin: Delete a system message
   * DELETE /inbox/admin/delete/:messageId
   */
  .delete('/admin/delete/:messageId', async ({ params }) => {
    try {
      const deleted = await inboxService.deleteMessage(params.messageId);

      return {
        success: true,
        message: deleted ? 'Message deleted' : 'Message not found'
      };
    } catch (error) {
      console.error('Error in /inbox/admin/delete:', error);
      return {
        success: false,
        error: 'Failed to delete message'
      };
    }
  });

export default Inbox;

import { client } from './utils';

export type MessageCategory = 'announcement' | 'update' | 'alert' | 'news' | 'promotion';

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  targetAudience: 'all' | 'students' | 'tutors';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isPinned: boolean;
  readAt: string | null;
}

export interface MessageStats {
  total: number;
  unread: number;
  pinned: number;
}

export interface GetMessagesResponse {
  messages: SystemMessage[];
  stats: MessageStats;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const inboxApi = {
  /**
   * Get all messages for the current tutor
   */
  async getMessages(params?: {
    userId: string;
    category?: MessageCategory;
    isRead?: boolean;
    isPinned?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<GetMessagesResponse> {
    const response = await client.get<ApiResponse<GetMessagesResponse>>('/inbox/messages', {
      params: {
        ...params,
        userType: 'tutor'
      }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get messages');
    }
    return response.data.data!;
  },

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const response = await client.get<ApiResponse<{ unreadCount: number }>>('/inbox/unread-count', {
      params: { userId, userType: 'tutor' }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get unread count');
    }
    return response.data.data!.unreadCount;
  },

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string, userId: string): Promise<void> {
    const response = await client.post<ApiResponse<void>>(`/inbox/mark-read/${messageId}`, {
      userId,
      userType: 'tutor'
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark as read');
    }
  },

  /**
   * Mark all messages as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const response = await client.post<ApiResponse<void>>('/inbox/mark-all-read', {
      userId,
      userType: 'tutor'
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark all as read');
    }
  },

  /**
   * Toggle pin status for a message
   */
  async togglePin(messageId: string, userId: string): Promise<boolean> {
    const response = await client.post<ApiResponse<{ isPinned: boolean }>>(`/inbox/toggle-pin/${messageId}`, {
      userId,
      userType: 'tutor'
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to toggle pin');
    }
    return response.data.data!.isPinned;
  }
};

export default inboxApi;

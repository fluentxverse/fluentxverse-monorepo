import { query } from '../../db/postgres';

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_type: 'tutor' | 'student';
  message_text: string;
  correction_text: string | null;
  created_at: Date;
}

export interface SaveMessageData {
  sessionId: string;
  senderId: string;
  senderType: 'tutor' | 'student';
  text: string;
  correction?: string;
}

export class ChatService {
  async saveMessage(data: SaveMessageData): Promise<ChatMessage> {
    const { sessionId, senderId, senderType, text, correction } = data;

    const result = await query(
      `INSERT INTO chat_messages (session_id, sender_id, sender_type, message_text, correction_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sessionId, senderId, senderType, text, correction || null]
    );

    return result.rows[0];
  }

  async getSessionMessages(sessionId: string, limit = 100): Promise<ChatMessage[]> {
    const result = await query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, limit]
    );

    return result.rows;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM chat_messages WHERE id = $1`,
      [messageId]
    );

    return (result.rowCount || 0) > 0;
  }

  async updateCorrection(messageId: string, correction: string): Promise<ChatMessage | null> {
    const result = await query(
      `UPDATE chat_messages
       SET correction_text = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [correction, messageId]
    );

    return result.rows[0] || null;
  }
}

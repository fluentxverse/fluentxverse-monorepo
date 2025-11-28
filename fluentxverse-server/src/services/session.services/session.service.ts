import { query } from '../../db/postgres';

export interface Session {
  id: string;
  tutor_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'cancelled';
  start_time: Date;
  end_time: Date | null;
  duration_minutes: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  user_type: 'tutor' | 'student';
  socket_id: string;
  is_active: boolean;
  joined_at: Date;
  left_at: Date | null;
}

export interface AddParticipantData {
  sessionId: string;
  userId: string;
  socketId: string;
  userType: 'tutor' | 'student';
}

export class SessionService {
  async createSession(tutorId: string, studentId: string): Promise<Session> {
    const result = await query(
      `INSERT INTO sessions (tutor_id, student_id, status, start_time)
       VALUES ($1, $2, 'active', NOW())
       RETURNING *`,
      [tutorId, studentId]
    );

    return result.rows[0];
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await query(
      `SELECT * FROM sessions WHERE id = $1`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  async endSession(sessionId: string): Promise<Session | null> {
    const result = await query(
      `UPDATE sessions
       SET status = 'completed',
           end_time = NOW(),
           duration_minutes = EXTRACT(EPOCH FROM (NOW() - start_time)) / 60,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  async addParticipant(data: AddParticipantData): Promise<SessionParticipant> {
    const { sessionId, userId, socketId, userType } = data;

    // First, deactivate any existing active participants for this user in this session
    await query(
      `UPDATE session_participants
       SET is_active = false, left_at = NOW()
       WHERE session_id = $1 AND user_id = $2 AND is_active = true`,
      [sessionId, userId]
    );

    // Add new participant record
    const result = await query(
      `INSERT INTO session_participants (session_id, user_id, user_type, socket_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [sessionId, userId, userType, socketId]
    );

    return result.rows[0];
  }

  async removeParticipant(sessionId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE session_participants
       SET is_active = false, left_at = NOW()
       WHERE session_id = $1 AND user_id = $2 AND is_active = true`,
      [sessionId, userId]
    );

    return (result.rowCount || 0) > 0;
  }

  async getSessionParticipants(sessionId: string): Promise<SessionParticipant[]> {
    const result = await query(
      `SELECT * FROM session_participants
       WHERE session_id = $1 AND is_active = true
       ORDER BY joined_at ASC`,
      [sessionId]
    );

    return result.rows;
  }

  async getUserActiveSessions(userId: string): Promise<Session[]> {
    const result = await query(
      `SELECT s.* FROM sessions s
       JOIN session_participants sp ON s.id = sp.session_id
       WHERE sp.user_id = $1 AND sp.is_active = true AND s.status = 'active'
       ORDER BY s.start_time DESC`,
      [userId]
    );

    return result.rows;
  }
}

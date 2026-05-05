import { db, query } from '../../db/postgres';

export type ClassroomActivityUserType = 'tutor' | 'student';
export type ClassroomActivityEventType = 'entered' | 'left' | 'lesson_ended';

export interface ClassroomActivityLog {
  id: string;
  sessionId: string;
  userId: string;
  userType: ClassroomActivityUserType;
  eventType: ClassroomActivityEventType;
  message: string;
  createdAt: string;
}

export interface LogClassroomActivityInput {
  sessionId: string;
  userId: string;
  userType: ClassroomActivityUserType;
  eventType: ClassroomActivityEventType;
  message?: string;
}

const generateActivityId = () => `clog-${crypto.randomUUID()}`;

const buildMessage = (userType: ClassroomActivityUserType, eventType: ClassroomActivityEventType) => {
  const actor = userType === 'tutor' ? 'Tutor' : 'Student';

  if (eventType === 'entered') {
    return `${actor} entered the lesson room.`;
  }

  if (eventType === 'left') {
    return `${actor} left the lesson room.`;
  }

  return `${actor} ended the lesson.`;
};

export class ClassroomActivityService {
  private static initPromise: Promise<void> | null = null;

  private async ensureTable(): Promise<void> {
    if (!ClassroomActivityService.initPromise) {
      ClassroomActivityService.initPromise = (async () => {
        await db`
          CREATE TABLE IF NOT EXISTS classroom_activity_logs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_type TEXT NOT NULL CHECK (user_type IN ('tutor', 'student')),
            event_type TEXT NOT NULL CHECK (event_type IN ('entered', 'left', 'lesson_ended')),
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        await db`
          CREATE INDEX IF NOT EXISTS classroom_activity_logs_session_created_idx
          ON classroom_activity_logs (session_id, created_at DESC)
        `;
      })();
    }

    await ClassroomActivityService.initPromise;
  }

  private mapRow(row: any): ClassroomActivityLog {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userType: row.user_type,
      eventType: row.event_type,
      message: row.message,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  async log(input: LogClassroomActivityInput): Promise<ClassroomActivityLog> {
    await this.ensureTable();

    const id = generateActivityId();
    const message = input.message || buildMessage(input.userType, input.eventType);

    const result = await query(
      `INSERT INTO classroom_activity_logs (id, session_id, user_id, user_type, event_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.sessionId, input.userId, input.userType, input.eventType, message]
    );

    return this.mapRow(result.rows[0]);
  }

  async getSessionActivity(sessionId: string, limit = 100): Promise<ClassroomActivityLog[]> {
    await this.ensureTable();

    const result = await query(
      `SELECT *
       FROM classroom_activity_logs
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, limit]
    );

    return result.rows.map((row: any) => this.mapRow(row));
  }
}

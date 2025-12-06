import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import type { 
  InterviewSlot, 
  InterviewWeekSchedule,
  PendingInterview 
} from './interview.interface';

// Generate unique ID for interview slots
function generateSlotId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'INT-';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Format date as YYYY-MM-DD
function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class InterviewService {
  /**
   * Create interview slots (Admin only)
   */
  async createSlots(slots: { date: string; time: string }[]): Promise<InterviewSlot[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const createdSlots: InterviewSlot[] = [];
      const now = new Date().toISOString();

      for (const slot of slots) {
        const slotId = generateSlotId();
        
        // Check if slot already exists for this date/time
        const existingResult = await session.run(`
          MATCH (s:InterviewSlot {date: $date, time: $time})
          RETURN s
        `, { date: slot.date, time: slot.time });

        if (existingResult.records.length > 0) {
          console.log(`Interview slot already exists for ${slot.date} ${slot.time}, skipping`);
          continue;
        }

        await session.run(`
          CREATE (s:InterviewSlot {
            id: $id,
            date: $date,
            time: $time,
            status: 'open',
            createdAt: $createdAt
          })
        `, {
          id: slotId,
          date: slot.date,
          time: slot.time,
          createdAt: now
        });

        createdSlots.push({
          id: slotId,
          date: slot.date,
          time: slot.time,
          status: 'open',
          createdAt: now
        });
      }

      return createdSlots;
    } finally {
      await session.close();
    }
  }

  /**
   * Get interview schedule for a week (Admin view)
   */
  async getWeekSchedule(weekOffset: number = 0): Promise<InterviewWeekSchedule> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Calculate week boundaries
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7));
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekStart = formatDateISO(monday);
      const weekEnd = formatDateISO(sunday);

      // Get all interview slots for this week
      const result = await session.run(`
        MATCH (s:InterviewSlot)
        WHERE s.date >= $weekStart AND s.date <= $weekEnd
        OPTIONAL MATCH (u:User {id: s.tutorId})
        RETURN s, u
        ORDER BY s.date, s.time
      `, { weekStart, weekEnd });

      const slots: InterviewSlot[] = result.records.map(record => {
        const s = record.get('s').properties;
        const u = record.get('u')?.properties;

        return {
          id: s.id,
          date: s.date,
          time: s.time,
          status: s.status,
          tutorId: s.tutorId,
          tutorName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : undefined,
          tutorEmail: u?.email,
          createdAt: s.createdAt,
          bookedAt: s.bookedAt,
          notes: s.notes
        };
      });

      return {
        weekStart,
        weekEnd,
        slots
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get available interview slots for tutors
   */
  async getAvailableSlots(weekOffset: number = 0): Promise<InterviewSlot[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Calculate week boundaries
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7));
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekStart = formatDateISO(monday);
      const weekEnd = formatDateISO(sunday);

      // Get only open interview slots for this week
      const result = await session.run(`
        MATCH (s:InterviewSlot {status: 'open'})
        WHERE s.date >= $weekStart AND s.date <= $weekEnd
        RETURN s
        ORDER BY s.date, s.time
      `, { weekStart, weekEnd });

      return result.records.map(record => {
        const s = record.get('s').properties;
        return {
          id: s.id,
          date: s.date,
          time: s.time,
          status: s.status as 'open',
          createdAt: s.createdAt
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Book an interview slot (Tutor)
   */
  async bookSlot(slotId: string, tutorId: string): Promise<InterviewSlot> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const now = new Date().toISOString();

      // Check if tutor already has a pending interview
      const existingBooking = await session.run(`
        MATCH (s:InterviewSlot {tutorId: $tutorId, status: 'booked'})
        RETURN s
      `, { tutorId });

      if (existingBooking.records.length > 0) {
        throw new Error('You already have a pending interview. Please cancel it first to book a new one.');
      }

      // Book the slot
      const result = await session.run(`
        MATCH (s:InterviewSlot {id: $slotId, status: 'open'})
        SET s.status = 'booked',
            s.tutorId = $tutorId,
            s.bookedAt = $bookedAt
        RETURN s
      `, { slotId, tutorId, bookedAt: now });

      const record = result.records[0];
      if (!record) {
        throw new Error('Interview slot not available or already booked');
      }

      const s = record.get('s').properties;
      return {
        id: s.id,
        date: s.date,
        time: s.time,
        status: s.status,
        tutorId: s.tutorId,
        createdAt: s.createdAt,
        bookedAt: s.bookedAt
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Cancel an interview slot booking (Tutor or Admin)
   */
  async cancelBooking(slotId: string, tutorId?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // If tutorId is provided, verify it's the tutor's booking
      if (tutorId) {
        const result = await session.run(`
          MATCH (s:InterviewSlot {id: $slotId, tutorId: $tutorId, status: 'booked'})
          SET s.status = 'open',
              s.tutorId = null,
              s.bookedAt = null
          RETURN s
        `, { slotId, tutorId });

        if (result.records.length === 0) {
          throw new Error('Interview booking not found or you do not have permission to cancel');
        }
      } else {
        // Admin cancel - no tutorId check
        const result = await session.run(`
          MATCH (s:InterviewSlot {id: $slotId, status: 'booked'})
          SET s.status = 'open',
              s.tutorId = null,
              s.bookedAt = null
          RETURN s
        `, { slotId });

        if (result.records.length === 0) {
          throw new Error('Interview booking not found');
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Delete interview slots (Admin only)
   */
  async deleteSlots(slotIds: string[]): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      await session.run(`
        MATCH (s:InterviewSlot)
        WHERE s.id IN $slotIds AND s.status = 'open'
        DELETE s
      `, { slotIds });
    } finally {
      await session.close();
    }
  }

  /**
   * Get pending interviews (for admin dashboard)
   */
  async getPendingInterviews(limit: number = 10): Promise<PendingInterview[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (s:InterviewSlot {status: 'booked'})
        MATCH (u:User {id: s.tutorId})
        RETURN s, u
        ORDER BY s.date, s.time
        LIMIT $limit
      `, { limit: neo4j.int(limit) });

      return result.records.map(record => {
        const s = record.get('s').properties;
        const u = record.get('u').properties;
        return {
          id: s.id,
          date: s.date,
          time: s.time,
          tutorId: u.id,
          tutorName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          tutorEmail: u.email,
          bookedAt: s.bookedAt
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Mark interview as completed (Admin)
   */
  async completeInterview(slotId: string, notes?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const completedAt = new Date().toISOString();
      
      await session.run(`
        MATCH (s:InterviewSlot {id: $slotId, status: 'booked'})
        SET s.status = 'completed',
            s.completedAt = $completedAt,
            s.notes = $notes
        RETURN s
      `, { slotId, completedAt, notes: notes || null });
    } finally {
      await session.close();
    }
  }

  /**
   * Get tutor's current interview booking
   */
  async getTutorInterview(tutorId: string): Promise<InterviewSlot | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (s:InterviewSlot {tutorId: $tutorId, status: 'booked'})
        RETURN s
        LIMIT 1
      `, { tutorId });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const s = record.get('s').properties;
      return {
        id: s.id,
        date: s.date,
        time: s.time,
        status: s.status,
        tutorId: s.tutorId,
        createdAt: s.createdAt,
        bookedAt: s.bookedAt
      };
    } finally {
      await session.close();
    }
  }
}

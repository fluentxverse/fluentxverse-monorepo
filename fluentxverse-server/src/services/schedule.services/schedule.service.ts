import { getDriver } from '../../db/memgraph';
import { nanoid } from 'nanoid';
import type {
  TimeSlot,
  Booking,
  WeeklyTemplate,
  PenaltyHistory,
  OpenSlotsInput,
  CloseSlotsInput,
  BulkOpenSlotsInput,
  MarkAttendanceInput,
  WeekScheduleParams,
  WeekSchedule,
  AvailableSlot,
  BookSlotInput,
  CancelBookingInput,
  SaveTemplateInput,
  ApplyTemplateInput,
  PenaltySummary
} from './schedule.interface';
import { determinePenaltyCode, PENALTY_RULES, PENALTY_CODE_DETAILS } from '../../config/penaltyCodes';

export class ScheduleService {
  
  /**
   * Open time slots for tutoring
   */
  async openSlots(input: OpenSlotsInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const now = new Date();
      const minOpenTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes ahead
      
      for (const slot of input.slots) {
        const slotDateTime = new Date(`${slot.date}T${slot.time}:00`);
        
        // Validate: slot must be at least 5 minutes in the future
        if (slotDateTime <= minOpenTime) {
          throw new Error(`Cannot open slot at ${slot.date} ${slot.time} - must be at least 5 minutes in the future`);
        }
        
        const slotId = nanoid(16);
        
        // Create TimeSlot node in Memgraph
        await session.run(
          `
          MATCH (t:User {id: $tutorId})
          CREATE (s:TimeSlot {
            slotId: $slotId,
            tutorId: $tutorId,
            slotDate: $slotDate,
            slotTime: $slotTime,
            durationMinutes: 25,
            status: 'open',
            isRecurring: false,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          CREATE (t)-[:OPENS_SLOT]->(s)
          `,
          {
            tutorId: input.tutorId,
            slotId,
            slotDate: slot.date,
            slotTime: slot.time
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Close open time slots
   */
  async closeSlots(input: CloseSlotsInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const now = new Date();
      const shortNoticeThreshold = new Date(now.getTime() + PENALTY_RULES.SHORT_NOTICE_HOURS * 60 * 60 * 1000);
      
      for (const slotId of input.slotIds) {
        // Check slot status and time
        const result = await session.run(
          `
          MATCH (s:TimeSlot {slotId: $slotId, tutorId: $tutorId})
          RETURN s
          `,
          { slotId, tutorId: input.tutorId }
        );
        
        if (result.records.length === 0) {
          throw new Error(`Slot ${slotId} not found or doesn't belong to tutor`);
        }
        
        const slot = result.records[0]?.get('s').properties;
        
        if (slot.status === 'booked') {
          throw new Error(`Cannot close booked slot ${slotId}`);
        }
        
        const slotDateTime = new Date(`${slot.slotDate}T${slot.slotTime}:00`);
        
        // Check for short notice cancellation (TA-303)
        if (slotDateTime <= shortNoticeThreshold && slot.status === 'open') {
          // Assign TA-303 penalty
          await this.assignPenalty({
            tutorId: input.tutorId,
            slotId,
            penaltyCode: '303',
            reason: `Closed open slot with less than ${PENALTY_RULES.SHORT_NOTICE_HOURS} hours notice`
          });
        }
        
        // Update slot status to available (closed)
        await session.run(
          `
          MATCH (s:TimeSlot {slotId: $slotId})
          SET s.status = 'available', s.updatedAt = datetime()
          `,
          { slotId }
        );
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Bulk open slots for a date range
   */
  async bulkOpenSlots(input: BulkOpenSlotsInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      const now = new Date();
      const minOpenTime = new Date(now.getTime() + 5 * 60 * 1000);
      
      const slots: Array<{ date: string; time: string }> = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        
        // Skip if specific days are requested and this day isn't included
        if (input.daysOfWeek && !input.daysOfWeek.includes(dayOfWeek)) {
          continue;
        }
        
        for (const time of input.times) {
          const slotDateTime = new Date(`${d.toISOString().split('T')[0]}T${time}:00`);
          
          if (slotDateTime > minOpenTime) {
            slots.push({
              date: d.toISOString().split('T')[0] || '',
              time
            });
          }
        }
      }
      
      if (slots.length > 100) {
        throw new Error('Cannot open more than 100 slots at once');
      }
      
      await this.openSlots({ tutorId: input.tutorId, slots });
    } finally {
      await session.close();
    }
  }

  /**
   * Get tutor's schedule for a specific week
   */
  async getTutorSchedule(params: WeekScheduleParams): Promise<WeekSchedule> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1 + (params.weekOffset * 7));
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      const startDate = monday.toISOString().split('T')[0];
      const endDate = sunday.toISOString().split('T')[0];
      
      // Get all slots for the week
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(s:TimeSlot)
        WHERE s.slotDate >= $startDate AND s.slotDate <= $endDate
        OPTIONAL MATCH (s)<-[:BOOKS]-(b:Booking)
        OPTIONAL MATCH (b)-[:BOOKED_BY]->(student:Student)
        RETURN s, b, student
        ORDER BY s.slotDate, s.slotTime
        `,
        { tutorId: params.tutorId, startDate, endDate }
      );
      
      const slots = result.records.map(record => {
        const slot = record.get('s')?.properties;
        const booking = record.get('b')?.properties;
        const student = record.get('student')?.properties;
        
        return {
          date: slot.slotDate,
          time: slot.slotTime,
          status: slot.status,
          bookingId: booking?.bookingId,
          studentId: student?.id,
          studentName: student ? `${student.givenName} ${student.familyName}` : undefined,
          penaltyCode: booking?.penaltyCode,
          attendanceTutor: booking?.attendanceTutor,
          attendanceStudent: booking?.attendanceStudent
        };
      });
      
      return {
        weekStart: monday,
        weekEnd: sunday,
        slots
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get available slots for student booking
   */
  async getAvailableSlots(tutorId: string, startDate: string, endDate: string): Promise<AvailableSlot[]> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const now = new Date();
      const minBookTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min ahead
      
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(s:TimeSlot)
        WHERE s.slotDate >= $startDate 
          AND s.slotDate <= $endDate
          AND s.status = 'open'
        RETURN s
        ORDER BY s.slotDate, s.slotTime
        `,
        { tutorId, startDate, endDate }
      );
      
      return result.records
        .map(record => {
          const slot = record.get('s').properties;
          const slotDateTime = new Date(`${slot.slotDate}T${slot.slotTime}:00`);
          
          // Filter out slots less than 30 minutes away
          if (slotDateTime <= minBookTime) {
            return null;
          }
          
          return {
            slotId: slot.slotId,
            tutorId: slot.tutorId,
            date: slot.slotDate,
            time: slot.slotTime,
            durationMinutes: slot.durationMinutes
          };
        })
        .filter(Boolean) as AvailableSlot[];
    } finally {
      await session.close();
    }
  }

  /**
   * Book a time slot (student action)
   */
  async bookSlot(input: BookSlotInput): Promise<Booking> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Check slot availability
      const slotResult = await session.run(
        `
        MATCH (s:TimeSlot {slotId: $slotId, status: 'open'})
        RETURN s
        `,
        { slotId: input.slotId }
      );
      
      if (slotResult.records.length === 0) {
        throw new Error('Slot not available for booking');
      }
      
      const slot = slotResult.records[0]?.get('s').properties;
      const slotDateTime = new Date(`${slot.slotDate}T${slot.slotTime}:00`);
      const now = new Date();
      const minBookTime = new Date(now.getTime() + 30 * 60 * 1000);
      
      if (slotDateTime <= minBookTime) {
        throw new Error('Cannot book slot less than 30 minutes in advance');
      }
      
      const bookingId = nanoid(16);
      
      // Create booking and update slot
      await session.run(
        `
        MATCH (s:TimeSlot {slotId: $slotId})
        MATCH (student:Student {id: $studentId})
        SET s.status = 'booked', s.updatedAt = datetime()
        CREATE (b:Booking {
          bookingId: $bookingId,
          slotId: $slotId,
          tutorId: $tutorId,
          studentId: $studentId,
          slotDateTime: datetime($slotDateTime),
          durationMinutes: $durationMinutes,
          status: 'confirmed',
          bookedAt: datetime()
        })
        CREATE (b)-[:BOOKS]->(s)
        CREATE (b)-[:BOOKED_BY]->(student)
        `,
        {
          slotId: input.slotId,
          bookingId,
          studentId: input.studentId,
          tutorId: slot.tutorId,
          slotDateTime: slotDateTime.toISOString(),
          durationMinutes: slot.durationMinutes
        }
      );
      
      return {
        bookingId,
        slotId: input.slotId,
        tutorId: slot.tutorId,
        studentId: input.studentId,
        slotDateTime,
        durationMinutes: slot.durationMinutes,
        status: 'confirmed',
        bookedAt: now
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Mark attendance for a session
   */
  async markAttendance(input: MarkAttendanceInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      if (input.bookingId) {
        // Mark attendance for booked session
        await session.run(
          `
          MATCH (b:Booking {bookingId: $bookingId})
          SET b.${input.role === 'tutor' ? 'attendanceTutor' : 'attendanceStudent'} = $status,
              b.updatedAt = datetime()
          `,
          { bookingId: input.bookingId, status: input.status }
        );
        
        // Check if both attendances marked and auto-assign penalties if needed
        const result = await session.run(
          `
          MATCH (b:Booking {bookingId: $bookingId})
          RETURN b
          `,
          { bookingId: input.bookingId }
        );
        
        const booking = result.records[0]?.get('b').properties;
        
        // If tutor marked absent and it's a booked slot -> TA-301
        if (booking.attendanceTutor === 'absent') {
          await this.assignPenalty({
            tutorId: booking.tutorId,
            bookingId: input.bookingId,
            penaltyCode: '301',
            reason: 'Tutor marked absent for booked session'
          });
        }
        
        // If student marked absent -> STU-502
        if (booking.attendanceStudent === 'absent') {
          await this.assignPenalty({
            tutorId: booking.tutorId,
            bookingId: input.bookingId,
            penaltyCode: '502',
            reason: 'Student did not attend booked session'
          });
        }
      } else if (input.slotId) {
        // Mark attendance for open (unbooked) slot
        await session.run(
          `
          MATCH (s:TimeSlot {slotId: $slotId})
          SET s.attendanceMarked = $status,
              s.updatedAt = datetime()
          `,
          { slotId: input.slotId, status: input.status }
        );
        
        // If tutor marked absent for open slot -> TA-302
        if (input.status === 'absent') {
          await this.assignPenalty({
            tutorId: input.tutorId,
            slotId: input.slotId,
            penaltyCode: '302',
            reason: 'Tutor marked absent for open (unbooked) slot'
          });
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Assign penalty code to tutor
   */
  async assignPenalty(params: {
    tutorId: string;
    bookingId?: string;
    slotId?: string;
    penaltyCode: string;
    reason: string;
  }): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const penaltyId = nanoid(16);
      const penaltyInfo = PENALTY_CODE_DETAILS[params.penaltyCode as keyof typeof PENALTY_CODE_DETAILS];
      
      // Create penalty node
      await session.run(
        `
        MATCH (t:User {id: $tutorId})
        CREATE (p:Penalty {
          penaltyId: $penaltyId,
          tutorId: $tutorId,
          bookingId: $bookingId,
          slotId: $slotId,
          penaltyCode: $penaltyCode,
          penaltyReason: $reason,
          severity: $severity,
          affectsCompensation: $affectsCompensation,
          createdAt: datetime()
        })
        CREATE (t)-[:HAS_PENALTY]->(p)
        `,
        {
          tutorId: params.tutorId,
          penaltyId,
          bookingId: params.bookingId || null,
          slotId: params.slotId || null,
          penaltyCode: params.penaltyCode,
          reason: params.reason,
          severity: penaltyInfo?.severity || 'medium',
          affectsCompensation: penaltyInfo?.affectsCompensation || false
        }
      );
      
      // If booking penalty, update booking record
      if (params.bookingId) {
        await session.run(
          `
          MATCH (b:Booking {bookingId: $bookingId})
          SET b.penaltyCode = $penaltyCode,
              b.penaltyReason = $reason,
              b.penaltyTimestamp = datetime()
          `,
          {
            bookingId: params.bookingId,
            penaltyCode: params.penaltyCode,
            reason: params.reason
          }
        );
      }
      
      // Check if tutor should be auto-blocked (3+ TA-301 in 30 days)
      if (params.penaltyCode === '301') {
        await this.checkAndApplyAutoBlock(params.tutorId);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Check if tutor should be auto-blocked based on penalty count
   */
  private async checkAndApplyAutoBlock(tutorId: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - PENALTY_RULES.PENALTY_WINDOW_DAYS);
      
      // Count TA-301 penalties in last 30 days
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_PENALTY]->(p:Penalty)
        WHERE p.penaltyCode = '301'
          AND p.createdAt >= datetime($since)
        RETURN count(p) as count
        `,
        { tutorId, since: thirtyDaysAgo.toISOString() }
      );
      
      const count = result.records[0]?.get('count')?.toNumber() || 0;
      
      if (count >= PENALTY_RULES.TA_BOOKED_THRESHOLD) {
        // Assign BLK-601 penalty block
        const blockUntil = new Date();
        blockUntil.setDate(blockUntil.getDate() + PENALTY_RULES.BLOCK_DURATION_DAYS);
        
        await session.run(
          `
          MATCH (t:User {id: $tutorId})
          CREATE (p:Penalty {
            penaltyId: $penaltyId,
            tutorId: $tutorId,
            penaltyCode: '601',
            penaltyReason: $reason,
            severity: 'critical',
            affectsCompensation: true,
            blockUntil: datetime($blockUntil),
            createdAt: datetime()
          })
          CREATE (t)-[:HAS_PENALTY]->(p)
          SET t.isBlocked = true, t.blockExpiresAt = datetime($blockUntil)
          `,
          {
            tutorId,
            penaltyId: nanoid(16),
            reason: `Automatic block: ${count} TA-301 penalties in ${PENALTY_RULES.PENALTY_WINDOW_DAYS} days`,
            blockUntil: blockUntil.toISOString()
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Get penalty summary for tutor
   */
  async getPenaltySummary(tutorId: string): Promise<PenaltySummary> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get penalty counts
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_PENALTY]->(p:Penalty)
        WHERE p.createdAt >= datetime($since)
        RETURN p.penaltyCode as code, count(*) as count
        `,
        { tutorId, since: firstOfMonth.toISOString() }
      );
      
      const thisMonth = { ta301: 0, ta302: 0, ta303: 0, total: 0 };
      
      for (const record of result.records) {
        const code = record.get('code');
        const count = record.get('count').toNumber();
        thisMonth.total += count;
        if (code === '301') thisMonth.ta301 = count;
        if (code === '302') thisMonth.ta302 = count;
        if (code === '303') thisMonth.ta303 = count;
      }
      
      // Get last 30 days
      const result30 = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_PENALTY]->(p:Penalty)
        WHERE p.createdAt >= datetime($since)
        RETURN p.penaltyCode as code, count(*) as count
        `,
        { tutorId, since: thirtyDaysAgo.toISOString() }
      );
      
      const last30Days = { ta301: 0, ta302: 0, ta303: 0, total: 0 };
      
      for (const record of result30.records) {
        const code = record.get('code');
        const count = record.get('count').toNumber();
        last30Days.total += count;
        if (code === '301') last30Days.ta301 = count;
        if (code === '302') last30Days.ta302 = count;
        if (code === '303') last30Days.ta303 = count;
      }
      
      // Check block status
      const blockResult = await session.run(
        `
        MATCH (t:User {id: $tutorId})
        RETURN t.isBlocked as isBlocked, t.blockExpiresAt as blockExpiresAt
        `,
        { tutorId }
      );
      
      const tutorData = blockResult.records[0];
      const isBlocked = tutorData?.get('isBlocked') || false;
      const blockExpiresAt = tutorData?.get('blockExpiresAt');
      
      // Get recent penalties
      const recentResult = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_PENALTY]->(p:Penalty)
        RETURN p
        ORDER BY p.createdAt DESC
        LIMIT 10
        `,
        { tutorId }
      );
      
      const recentPenalties = recentResult.records.map(r => r.get('p').properties);
      
      return {
        tutorId,
        thisMonth,
        last30Days,
        activeBlock: isBlocked,
        blockExpiresAt: blockExpiresAt ? new Date(blockExpiresAt) : undefined,
        recentPenalties
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Save weekly template for recurring schedule
   */
  async saveWeeklyTemplate(input: SaveTemplateInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Delete existing templates
      await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_TEMPLATE]->(template:ScheduleTemplate)
        DETACH DELETE template
        `,
        { tutorId: input.tutorId }
      );
      
      // Create new templates
      for (const slot of input.schedule) {
        await session.run(
          `
          MATCH (t:User {id: $tutorId})
          CREATE (template:ScheduleTemplate {
            templateId: $templateId,
            tutorId: $tutorId,
            dayOfWeek: $dayOfWeek,
            slotTime: $slotTime,
            isActive: true,
            createdAt: datetime()
          })
          CREATE (t)-[:HAS_TEMPLATE]->(template)
          `,
          {
            tutorId: input.tutorId,
            templateId: nanoid(16),
            dayOfWeek: slot.dayOfWeek,
            slotTime: slot.time
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Apply weekly template to date range
   */
  async applyTemplate(input: ApplyTemplateInput): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Get template
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:HAS_TEMPLATE]->(template:ScheduleTemplate)
        WHERE template.isActive = true
        RETURN template
        `,
        { tutorId: input.tutorId }
      );
      
      const templates = result.records.map(r => r.get('template').properties);
      
      if (templates.length === 0) {
        throw new Error('No active template found for tutor');
      }
      
      // Generate slots from template
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      const slots: Array<{ date: string; time: string }> = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        
        for (const template of templates) {
          if (template.dayOfWeek === dayOfWeek) {
            slots.push({
              date: d.toISOString().split('T')[0] || '',
              time: template.slotTime
            });
          }
        }
      }
      
      if (slots.length > 0) {
        await this.openSlots({ tutorId: input.tutorId, slots });
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Get student's bookings
   */
  async getStudentBookings(studentId: string): Promise<Array<{
    bookingId: string;
    tutorId: string;
    tutorName: string;
    tutorAvatar?: string;
    slotDate: string;
    slotTime: string;
    durationMinutes: number;
    status: string;
    attendanceTutor?: string;
    attendanceStudent?: string;
    bookedAt: Date;
  }>> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `
        MATCH (b:Booking)-[:BOOKED_BY]->(s:Student {id: $studentId})
        MATCH (b)-[:BOOKS]->(slot:TimeSlot)
        MATCH (slot)-[:OPENS_SLOT]-(tutor:User)
        WHERE b.status IN ['confirmed', 'completed']
        RETURN b, slot, tutor
        ORDER BY slot.slotDate DESC, slot.slotTime DESC
        `,
        { studentId }
      );
      
      return result.records.map(record => {
        const booking = record.get('b').properties;
        const slot = record.get('slot').properties;
        const tutor = record.get('tutor').properties;
        
        return {
          bookingId: booking.bookingId,
          tutorId: tutor.id,
          tutorName: `${tutor.givenName || ''} ${tutor.familyName || ''}`.trim(),
          tutorAvatar: tutor.profilePicture,
          slotDate: slot.slotDate,
          slotTime: slot.slotTime,
          durationMinutes: parseInt(slot.durationMinutes) || 30,
          status: booking.status,
          attendanceTutor: booking.attendanceTutor,
          attendanceStudent: booking.attendanceStudent,
          bookedAt: new Date(booking.bookedAt)
        };
      });
    } finally {
      await session.close();
    }
  }
}

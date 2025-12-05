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
      
      // Helper to convert 12h time to 24h format for Date parsing
      const convert12hTo24h = (time12: string): string => {
        const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return '00:00';
        let hour = parseInt(match[1], 10);
        const minute = match[2];
        const isPM = match[3].toUpperCase() === 'PM';
        
        if (hour === 12) {
          hour = isPM ? 12 : 0;
        } else if (isPM) {
          hour += 12;
        }
        
        return `${String(hour).padStart(2, '0')}:${minute}`;
      };
      
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
          
          // Convert 12h time to 24h for proper Date parsing
          const time24h = convert12hTo24h(slot.slotTime);
          const slotDateTime = new Date(`${slot.slotDate}T${time24h}:00`);
          
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
      console.log('=== SERVICE: bookSlot START ===');
      console.log('Input:', JSON.stringify(input, null, 2));
      
      // Check slot availability
      console.log('Checking slot availability for slotId:', input.slotId);
      const slotResult = await session.run(
        `
        MATCH (s:TimeSlot {slotId: $slotId, status: 'open'})
        RETURN s
        `,
        { slotId: input.slotId }
      );
      
      console.log('Slot query returned', slotResult.records.length, 'records');
      
      if (slotResult.records.length === 0) {
        console.log('ERROR: Slot not available - either not found or status is not "open"');
        throw new Error('Slot not available for booking');
      }
      
      const slot = slotResult.records[0]?.get('s').properties;
      console.log('Slot found:', JSON.stringify(slot, null, 2));
      
      // Parse slotTime - it's already in 12-hour format like "6:00 PM"
      // Convert to 24-hour format for Date constructor
      const slotTime = slot.slotTime; // e.g., "6:00 PM"
      console.log('Parsing slot time:', slotTime, 'for date:', slot.slotDate);
      let slotDateTime: Date;
      
      try {
        // Parse the time string (e.g., "6:00 PM")
        const timeMatch = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!timeMatch) {
          console.log('ERROR: Time format does not match regex');
          throw new Error(`Invalid time format: ${slotTime}`);
        }
        
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const meridiem = timeMatch[3].toUpperCase();
        
        console.log('Parsed time components:', { hours, minutes, meridiem });
        
        // Convert to 24-hour format
        if (meridiem === 'PM' && hours !== 12) {
          hours += 12;
        } else if (meridiem === 'AM' && hours === 12) {
          hours = 0;
        }
        
        console.log('Converted to 24-hour format:', hours);
        
        // Create date with proper format
        slotDateTime = new Date(`${slot.slotDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        
        console.log('Created slotDateTime:', slotDateTime.toISOString());
        
        if (isNaN(slotDateTime.getTime())) {
          console.log('ERROR: Invalid date created');
          throw new Error(`Invalid date/time combination: ${slot.slotDate} ${slotTime}`);
        }
      } catch (error: any) {
        console.error('Error parsing slot time:', error);
        throw new Error(`Failed to parse slot time: ${error.message}`);
      }
      
      const now = new Date();
      const minBookTime = new Date(now.getTime() + 5 * 60 * 1000); // Changed to 5 minutes
      
      console.log('Current time:', now.toISOString());
      console.log('Minimum booking time (5 min ahead):', minBookTime.toISOString());
      console.log('Slot time:', slotDateTime.toISOString());
      
      if (slotDateTime <= minBookTime) {
        console.log('ERROR: Slot is too soon to book');
        throw new Error('Cannot book slot less than 5 minutes in advance');
      }
      
      const bookingId = nanoid(16);
      console.log('Generated bookingId:', bookingId);
      
      // Check if student exists
      console.log('Checking if student exists...');
      const studentCheck = await session.run(
        `MATCH (student:Student {id: $studentId}) RETURN student`,
        { studentId: input.studentId }
      );
      
      if (studentCheck.records.length === 0) {
        console.log('ERROR: Student not found with ID:', input.studentId);
        console.log('This user might be logged in as a tutor (User node) instead of a student (Student node)');
        throw new Error('Student account not found. Please make sure you are logged in as a student.');
      }
      
      console.log('Student found, proceeding with booking...');
      
      // Create booking and update slot
      console.log('Creating booking in database...');
      console.log('Parameters:', {
        slotId: input.slotId,
        bookingId,
        studentId: input.studentId,
        tutorId: slot.tutorId,
        slotDateTime: slotDateTime.toISOString(),
        durationMinutes: slot.durationMinutes
      });
      
      const bookingResult = await session.run(
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
        RETURN b, s
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
      
      console.log('Booking query returned', bookingResult.records.length, 'records');
      console.log('Booking created successfully in database');
      console.log('=== SERVICE: bookSlot END ===');
      
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

  /**
   * Get student statistics for dashboard
   */
  async getStudentStats(studentId: string): Promise<{
    lessonsCompleted: number;
    upcomingLessons: number;
    totalHours: number;
    nextLesson?: {
      tutorName: string;
      tutorAvatar?: string;
      slotDate: string;
      slotTime: string;
      bookingId: string;
    };
  }> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const now = new Date();
      
      // Get completed lessons count
      const completedResult = await session.run(
        `
        MATCH (b:Booking)-[:BOOKED_BY]->(s:Student {id: $studentId})
        WHERE b.status = 'completed'
        RETURN count(b) as completedCount
        `,
        { studentId }
      );
      
      // Get upcoming lessons - filter by date in application code since slotTime is in 12-hour format
      const upcomingResult = await session.run(
        `
        MATCH (b:Booking)-[:BOOKED_BY]->(s:Student {id: $studentId})
        MATCH (b)-[:BOOKS]->(slot:TimeSlot)
        MATCH (slot)-[:OPENS_SLOT]-(tutor:User)
        WHERE b.status = 'confirmed'
        RETURN b.bookingId as bookingId,
               tutor.firstName as tutorFirstName,
               tutor.lastName as tutorLastName,
               tutor.givenName as tutorGivenName,
               tutor.familyName as tutorFamilyName,
               tutor.profilePicture as tutorAvatar,
               slot.slotDate as slotDate,
               slot.slotTime as slotTime
        ORDER BY slot.slotDate ASC, slot.slotTime ASC
        `,
        { studentId }
      );
      
      // Get total hours from completed lessons
      const hoursResult = await session.run(
        `
        MATCH (b:Booking)-[:BOOKED_BY]->(s:Student {id: $studentId})
        MATCH (b)-[:BOOKS]->(slot:TimeSlot)
        WHERE b.status = 'completed'
        RETURN sum(slot.durationMinutes) as totalMinutes
        `,
        { studentId }
      );
      
      const completedCount = completedResult.records[0]?.get('completedCount')?.toNumber() || 0;
      
      // Filter future lessons in application code and get count + next lesson
      const futureBookings = upcomingResult.records
        .map(record => {
          const slotDate = record.get('slotDate');
          const slotTime = record.get('slotTime');
          
          // Parse slotTime (e.g., "6:00 PM") to create proper Date
          const timeMatch = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!timeMatch) return null;
          
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const meridiem = timeMatch[3].toUpperCase();
          
          // Convert to 24-hour format
          if (meridiem === 'PM' && hours !== 12) {
            hours += 12;
          } else if (meridiem === 'AM' && hours === 12) {
            hours = 0;
          }
          
          const slotDateTime = new Date(`${slotDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
          
          if (isNaN(slotDateTime.getTime()) || slotDateTime <= now) {
            return null;
          }
          
          return {
            bookingId: record.get('bookingId'),
            tutorFirstName: record.get('tutorFirstName'),
            tutorLastName: record.get('tutorLastName'),
            tutorGivenName: record.get('tutorGivenName'),
            tutorFamilyName: record.get('tutorFamilyName'),
            tutorAvatar: record.get('tutorAvatar'),
            slotDate,
            slotTime,
            slotDateTime
          };
        })
        .filter(Boolean) as Array<{
          bookingId: string;
          tutorFirstName: string;
          tutorLastName: string;
          tutorGivenName: string;
          tutorFamilyName: string;
          tutorAvatar?: string;
          slotDate: string;
          slotTime: string;
          slotDateTime: Date;
        }>;
      
      const upcomingCount = futureBookings.length;
      const totalMinutes = hoursResult.records[0]?.get('totalMinutes')?.toNumber() || 0;
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal
      
      let nextLesson = undefined;
      if (futureBookings.length > 0) {
        // Sort by datetime and get the earliest
        futureBookings.sort((a, b) => a.slotDateTime.getTime() - b.slotDateTime.getTime());
        const next = futureBookings[0];
        
        if (next) {
          // Try firstName/lastName first (tutors), fall back to givenName/familyName (students)
          const firstName = next.tutorFirstName || next.tutorGivenName || '';
          const lastName = next.tutorLastName || next.tutorFamilyName || '';
          

          
          nextLesson = {
            tutorName: `${firstName} ${lastName}`.trim() || 'Tutor',
            tutorAvatar: next.tutorAvatar,
            slotDate: next.slotDate,
            slotTime: next.slotTime,
            bookingId: next.bookingId
          };
        }
      }
      
      const stats = {
        lessonsCompleted: completedCount,
        upcomingLessons: upcomingCount,
        totalHours,
        nextLesson
      };
      

      
      return stats;
    } finally {
      await session.close();
    }
  }

  /**
   * Get recent activity for student dashboard
   */
  async getStudentRecentActivity(studentId: string, limit: number = 10): Promise<Array<{
    type: 'lesson_completed' | 'lesson_booked';
    tutorName: string;
    tutorAvatar?: string;
    date: string;
    action: string;
    bookingId?: string;
    slotDate?: string;
    timestamp: Date;
  }>> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Ensure limit is an integer
      const limitInt = Math.floor(Number(limit)) || 10;
      
      // Get completed lessons and bookings
      const result = await session.run(
        `
        MATCH (b:Booking)-[:BOOKED_BY]->(s:Student {id: $studentId})
        MATCH (b)-[:BOOKS]->(slot:TimeSlot)
        MATCH (slot)-[:OPENS_SLOT]-(tutor:User)
        WHERE b.status IN ['completed', 'confirmed']
        WITH b, slot, tutor,
             CASE 
               WHEN b.status = 'completed' THEN slot.slotDate + 'T' + slot.slotTime
               ELSE b.bookedAt
             END as sortTime
        RETURN b, slot, tutor, sortTime
        ORDER BY sortTime DESC
        LIMIT ${limitInt}
        `,
        { studentId }
      );
      
      return result.records.map(record => {
        const booking = record.get('b').properties;
        const slot = record.get('slot').properties;
        const tutor = record.get('tutor').properties;
        
        // Try firstName/lastName first (tutors), fall back to givenName/familyName
        const tutorName = `${tutor.firstName || tutor.givenName || ''} ${tutor.lastName || tutor.familyName || ''}`.trim();
        const isCompleted = booking.status === 'completed';
        
        // For completed lessons, use slot date; for bookings, use bookedAt timestamp
        let activityDate: Date;
        if (isCompleted) {
          // Parse slotDate as a date (e.g., "2025-12-03")
          activityDate = new Date(slot.slotDate + 'T00:00:00');
        } else {
          // bookedAt is a Neo4j DateTime object, convert to JavaScript Date
          const bookedAtDateTime = booking.bookedAt;
          if (bookedAtDateTime && bookedAtDateTime.__isDateTime__) {
            activityDate = new Date(
              bookedAtDateTime.year.toInt(),
              bookedAtDateTime.month.toInt() - 1,
              bookedAtDateTime.day.toInt(),
              bookedAtDateTime.hour.toInt(),
              bookedAtDateTime.minute.toInt(),
              bookedAtDateTime.second.toInt()
            );
          } else {
            // Fallback if it's already a date string
            activityDate = new Date(booking.bookedAt);
          }
        }
        
        // Validate date
        if (isNaN(activityDate.getTime())) {
          console.error('Invalid date for activity:', { slotDate: slot.slotDate, bookedAt: booking.bookedAt });
          activityDate = new Date(); // fallback to now
        }
        
        return {
          type: isCompleted ? 'lesson_completed' : 'lesson_booked',
          tutorName,
          tutorAvatar: tutor.profilePicture,
          date: this.formatActivityDate(activityDate),
          action: isCompleted 
            ? 'Completed lesson' 
            : `Booked lesson for ${this.formatBookingDate(slot.slotDate)}`,
          bookingId: booking.bookingId,
          slotDate: slot.slotDate,
          timestamp: activityDate
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Format date for activity display (e.g., "Nov 28", "Yesterday", "Today")
   */
  private formatActivityDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (activityDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  /**
   * Format date for booking display (e.g., "Dec 3", "Tomorrow")
   */
  private formatBookingDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (slotDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (slotDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  /**
   * Get detailed lesson information by booking ID
   */
  async getLessonDetails(bookingId: string, studentId: string) {
    const session = getDriver().session();
    try {
      
      // Match Booking -> TimeSlot and derive tutor via OFFERS relationship
      // Use slotDateTime stored on Booking for date/time extraction
      const query = `
        MATCH (booking:Booking {bookingId: $bookingId})-[:BOOKED_BY]->(student:Student {id: $studentId})
        OPTIONAL MATCH (booking)-[:BOOKS]->(slot:TimeSlot)
        OPTIONAL MATCH (slot)<-[:OFFERS]-(tutorRel)
        OPTIONAL MATCH (tutorDirect)
        WHERE tutorDirect.userId = booking.tutorId OR tutorDirect.id = booking.tutorId
        WITH booking, student,
             coalesce(tutorRel, tutorDirect) AS tutor
        RETURN 
          booking.bookingId AS bookingId,
          booking.status AS status,
          booking.bookedAt AS bookedAt,
          booking.slotDateTime AS slotDateTime,
          booking.durationMinutes AS durationMinutes,
          tutor.userId AS tutorUserId,
          tutor.id AS tutorId,
          COALESCE(tutor.firstName, tutor.givenName, '') AS tFirst,
          COALESCE(tutor.lastName, tutor.familyName, '') AS tLast,
          tutor.profilePicture AS tutorAvatar,
          tutor.bio AS tutorBio,
          tutor.hourlyRate AS hourlyRate
      `;

      const result = await session.run(query, { bookingId, studentId });

      if (result.records.length === 0) {
        // Fallback attempt: match tutor by booking.tutorId using WHERE
        const fallbackQuery = `
          MATCH (booking:Booking {bookingId: $bookingId})-[:BOOKED_BY]->(student:Student {id: $studentId})
          MATCH (tutor:User)
          WHERE tutor.userId = booking.tutorId
          RETURN 
            booking.bookingId AS bookingId,
            booking.status AS status,
            booking.bookedAt AS bookedAt,
            booking.slotDateTime AS slotDateTime,
            booking.durationMinutes AS durationMinutes,
            tutor.userId AS tutorId,
            COALESCE(tutor.firstName, tutor.givenName, 'Tutor') + ' ' + 
            COALESCE(tutor.lastName, tutor.familyName, '') AS tutorName,
            tutor.profilePicture AS tutorAvatar,
            tutor.bio AS tutorBio,
            tutor.hourlyRate AS hourlyRate
        `;
        const fallbackResult = await session.run(fallbackQuery, { bookingId, studentId });
        if (fallbackResult.records.length > 0) {
          const fr = fallbackResult.records[0];

          // Extract slotDateTime
          const slotDateTime = fr?.get('slotDateTime');
          const year = slotDateTime.year.toInt();
          const month = String(slotDateTime.month.toInt()).padStart(2, '0');
          const day = String(slotDateTime.day.toInt()).padStart(2, '0');
          const hour = slotDateTime.hour.toInt();
          const minute = String(slotDateTime.minute.toInt()).padStart(2, '0');
          const period = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          const slotDate = `${year}-${month}-${day}`;
          const slotTime = `${hour12}:${minute} ${period}`;

          const lessonDetails = {
            bookingId: fr?.get('bookingId'),
            tutorId: fr?.get('tutorId'),
            tutorName: fr?.get('tutorName')?.trim?.() || fr?.get('tutorName'),
            tutorAvatar: fr?.get('tutorAvatar'),
            tutorBio: fr?.get('tutorBio'),
            hourlyRate: fr?.get('hourlyRate')?.toNumber?.() || fr?.get('hourlyRate'),
            slotDate,
            slotTime,
            durationMinutes: fr?.get('durationMinutes')?.toNumber?.() || fr?.get('durationMinutes'),
            status: fr?.get('status'),
            bookedAt: fr?.get('bookedAt'),
            sessionId: bookingId
          };
          return lessonDetails;
        }
        
        // As a last resort, return booking-only details (tutor may be missing)
        const bookingOnly = {
          bookingId,
          tutorId: null,
          tutorName: null,
          tutorAvatar: null,
          tutorBio: null,
          hourlyRate: null,
          // Extract date/time from debug bookingProps above if present
          slotDate: undefined,
          slotTime: undefined,
          durationMinutes: undefined,
          status: undefined,
          bookedAt: undefined,
          sessionId: bookingId
        };
        return bookingOnly;
      }

      const record = result.records[0]!;
      
      // Extract slotDateTime and convert to date and time strings
      const slotDateTime = record.get('slotDateTime');
      const year = slotDateTime.year.toInt();
      const month = String(slotDateTime.month.toInt()).padStart(2, '0');
      const day = String(slotDateTime.day.toInt()).padStart(2, '0');
      
      // The slotDateTime is stored in UTC, convert to Philippine time (UTC+8)
      let hour = slotDateTime.hour.toInt() + 8;
      if (hour >= 24) hour -= 24;
      
      const minute = String(slotDateTime.minute.toInt()).padStart(2, '0');
      
      // Format as date string (YYYY-MM-DD)
      const slotDate = `${year}-${month}-${day}`;
      
      // Format as 12-hour time string (H:MM AM/PM) in Philippine time
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const slotTime = `${hour12}:${minute} ${period}`;
      
      const first = record.get('tFirst');
      const last = record.get('tLast');
      const derivedTutorName = `${(first || '').trim()} ${(last || '').trim()}`.trim() || 'Tutor';

      // Convert bookedAt DateTime to ISO string
      const bookedAtDateTime = record.get('bookedAt');
      let bookedAtISO = new Date().toISOString();
      if (bookedAtDateTime) {
        try {
          const bookedAtDate = new Date(
            bookedAtDateTime.year.toInt(),
            bookedAtDateTime.month.toInt() - 1,
            bookedAtDateTime.day.toInt(),
            bookedAtDateTime.hour.toInt(),
            bookedAtDateTime.minute.toInt(),
            bookedAtDateTime.second.toInt()
          );
          bookedAtISO = bookedAtDate.toISOString();
        } catch (e) {
          console.error('Error converting bookedAt:', e);
        }
      }

      const lessonDetails = {
        bookingId: record.get('bookingId'),
        tutorId: record.get('tutorUserId') || record.get('tutorId') || null,
        tutorName: derivedTutorName,
        tutorAvatar: record.get('tutorAvatar'),
        tutorBio: record.get('tutorBio'),
        hourlyRate: record.get('hourlyRate')?.toNumber?.() || record.get('hourlyRate'),
        slotDate,
        slotTime,
        durationMinutes: record.get('durationMinutes')?.toNumber?.() || record.get('durationMinutes'),
        status: record.get('status'),
        bookedAt: bookedAtISO,
        sessionId: bookingId // Use bookingId as sessionId for classroom
      };

      return lessonDetails;
    } catch (error) {
      console.error('Error getting lesson details:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

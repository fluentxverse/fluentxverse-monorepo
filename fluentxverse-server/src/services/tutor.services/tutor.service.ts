import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import type { Tutor, TutorProfile, TutorSearchParams, TutorSearchResponse } from './tutor.interface';
import { NotificationService } from '../notification.services/notification.service';
import { getIO } from '../../socket/socket.server';

// Helper to convert Neo4j DateTime to ISO string
function neo4jDateTimeToISO(dt: any): string | undefined {
  if (!dt) return undefined;
  if (typeof dt === 'string') return dt;
  if (dt.toStandardDate) {
    return dt.toStandardDate().toISOString();
  }
  if (dt.year) {
    const year = dt.year.low ?? dt.year;
    const month = (dt.month.low ?? dt.month) - 1;
    const day = dt.day.low ?? dt.day;
    const hour = dt.hour?.low ?? dt.hour ?? 0;
    const minute = dt.minute?.low ?? dt.minute ?? 0;
    const second = dt.second?.low ?? dt.second ?? 0;
    return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
  }
  return undefined;
}

// Helper to convert 12h time format to 24h format
function convert12hTo24h(time12: string): string {
  // If already in 24h format, return as-is
  if (!time12.includes('AM') && !time12.includes('PM')) {
    return time12;
  }
  
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Helper to check if a slot is still bookable (not past and at least 5 min away)
function isSlotBookable(slotDate: string, slotTime: string): boolean {
  const now = new Date();
  const minBookTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 min from now
  
  const time24h = convert12hTo24h(slotTime);
  // Slot times are in PHT (UTC+8)
  const slotDateTime = new Date(`${slotDate}T${time24h}:00+08:00`);
  
  return slotDateTime > minBookTime;
}

export class TutorService {
  /**
   * Search and filter tutors
   */
  public async searchTutors(params: TutorSearchParams): Promise<TutorSearchResponse> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const {
        query: searchQuery,
        page = 1,
        limit = 12,
        dateFilter,
        startTime,
        endTime
      } = params;

      // Ensure page and limit are integers
      const pageNum = Math.max(1, Math.floor(Number(page)));
      const limitNum = Math.max(1, Math.min(100, Math.floor(Number(limit)))); // Cap at 100
      const skip = (pageNum - 1) * limitNum;
      
      // Name search - use toLower() for case-insensitive matching (Memgraph doesn't support (?i) regex)
      const nameSearchLower = searchQuery ? searchQuery.toLowerCase() : null;

      // Helper function to convert 24h time to minutes since midnight for comparison
      const timeToMinutes = (time24: string): number => {
        const [hourStr, minute] = time24.split(':');
        let hour = parseInt(hourStr || "0", 10);
        // Handle "24:XX" as next day (1440+ minutes)
        if (hour === 24) {
          return 1440 + parseInt(minute || "0", 10);
        }
        return hour * 60 + parseInt(minute || "0", 10);
      };

      // Helper function to convert any time string to minutes for comparison
      // Handles both 12h format ("11:30 PM") and 24h format ("18:00")
      const timeToMinutesAny = (timeStr: string): number => {
        // First try 12h format: "11:30 PM" or "12:00 AM"
        const match12h = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (match12h && match12h[1] && match12h[2] && match12h[3]) {
          let hour = parseInt(match12h[1], 10);
          const minute = parseInt(match12h[2], 10);
          const isPM = match12h[3].toUpperCase() === 'PM';
          
          if (hour === 12) {
            hour = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
          } else if (isPM) {
            hour += 12;
          }
          
          return hour * 60 + minute;
        }
        
        // Try 24h format: "18:00" or "6:00"
        const match24h = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (match24h && match24h[1] && match24h[2]) {
          const hour = parseInt(match24h[1], 10);
          const minute = parseInt(match24h[2], 10);
          return hour * 60 + minute;
        }
        
        console.warn('Could not parse time string:', timeStr);
        return 0;
      };

      // Build WHERE clause for date and time filtering
      let whereClause = '';
      let matchPattern = 'MATCH (u:User)';
      const queryParams: any = { dateFilter, skip: neo4j.int(skip), limit: neo4j.int(limitNum) };
      
      // Certification requirement - tutor must have passed both exams AND have approved profile
      // OR be a test account (bypass for development) - use toLower for case-insensitive email check
      // IMPORTANT: Wrap entire check in parentheses for correct OR precedence
      const TEST_ACCOUNT_IDS = ['paulanthonyarriola@gmail.com']; // Test tutor emails
      const certificationCheck = `((u.writtenExamPassed = true AND u.speakingExamPassed = true AND u.profileStatus = 'approved') OR toLower(u.email) = 'paulanthonyarriola@gmail.com')`;
      
      // Name search condition (case-insensitive using toLower and CONTAINS)
      const nameSearchCondition = nameSearchLower 
        ? `(toLower(u.firstName) CONTAINS $nameSearch OR toLower(u.lastName) CONTAINS $nameSearch OR toLower(u.displayName) CONTAINS $nameSearch OR toLower(u.firstName + ' ' + u.lastName) CONTAINS $nameSearch)`
        : '';
      
      if (nameSearchLower) {
        queryParams.nameSearch = nameSearchLower;
        console.log('🔎 Name search term:', nameSearchLower);
      }
      
      // Get today's date for "all dates" filter
      const today = new Date().toISOString().split('T')[0];
      queryParams.today = today;
      
      console.log('🔎 Building query with dateFilter:', dateFilter, 'startTime:', startTime, 'endTime:', endTime, 'searchQuery:', searchQuery);
      console.log('🔎 Today\'s date for filtering:', today);
      
      // Debug: Check if any tutors have open slots
      const debugResult = await session.run(`
        MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)
        WHERE s.status = 'open'
        RETURN u.id as tutorId, u.email as email, u.firstName as firstName, u.writtenExamPassed as written, u.speakingExamPassed as speaking, u.profileStatus as profileStatus, s.slotDate as slotDate, s.slotTime as slotTime
        LIMIT 20
      `);
      console.log('🔍 DEBUG - Total open slots found:', debugResult.records.length);
      if (debugResult.records.length > 0) {
        const uniqueDates = new Set(debugResult.records.map(r => r.get('slotDate')));
        console.log('🔍 DEBUG - Unique slot dates:', Array.from(uniqueDates));
      }
      debugResult.records.forEach(r => {
        console.log('🔍 DEBUG - Slot:', {
          tutorId: r.get('tutorId'),
          email: r.get('email'),
          firstName: r.get('firstName'),
          written: r.get('written'),
          speaking: r.get('speaking'),
          profileStatus: r.get('profileStatus'),
          slotDate: r.get('slotDate'),
          slotTime: r.get('slotTime')
        });
      });
      
      // Debug: Check specific date filter
      if (dateFilter) {
        const dateDebugResult = await session.run(`
          MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)
          WHERE s.slotDate = $dateFilter AND s.status = 'open'
          RETURN count(s) as slotCount, u.email as email
        `, { dateFilter });
        console.log('🔍 DEBUG - Slots for dateFilter', dateFilter, ':', dateDebugResult.records.map(r => ({
          email: r.get('email'),
          slotCount: r.get('slotCount')?.toNumber?.() || r.get('slotCount')
        })));
      }
      
      if (dateFilter) {
        // Only show tutors who have open slots on the specified PHT date AND are certified
        // The date filter now comes from the client as a PHT date
        matchPattern = `MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)`;
        whereClause = `WHERE s.slotDate = $dateFilter AND s.status = 'open' AND ${certificationCheck}`;
        
        // Add name search if provided
        if (nameSearchCondition) {
          whereClause += ` AND ${nameSearchCondition}`;
        }
        
        // Add time range filtering if provided - we'll filter in post-processing
        // because string comparison of 12-hour times doesn't work correctly
        // No time filtering in Cypher query - we'll handle it after fetching
        
        console.log('📅 Using date filter match pattern:', matchPattern);
        console.log('📅 Using date filter WHERE clause:', whereClause);
        
        // Store time filters for post-processing
        if (startTime) {
          queryParams.startTimeMinutes = timeToMinutes(startTime);
          console.log('📅 Start time filter (minutes):', queryParams.startTimeMinutes);
        }
        if (endTime) {
          queryParams.endTimeMinutes = timeToMinutes(endTime);
          console.log('📅 End time filter (minutes):', queryParams.endTimeMinutes);
        }
      } else {
        // "All Dates" - show tutors who have ANY open slots from today onwards AND are certified
        // Also apply time range filtering if provided
        let whereConditions = `s.slotDate >= $today AND s.status = 'open' AND ${certificationCheck}`;
        
        // Add name search if provided
        if (nameSearchCondition) {
          whereConditions += ` AND ${nameSearchCondition}`;
        }
        
        matchPattern = `MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)
          WHERE ${whereConditions}`;
        whereClause = '';
        
        // Store time filters for post-processing
        if (startTime) {
          queryParams.startTimeMinutes = timeToMinutes(startTime);
          console.log('📅 All Dates - Start time filter (minutes):', queryParams.startTimeMinutes);
        }
        if (endTime) {
          queryParams.endTimeMinutes = timeToMinutes(endTime);
          console.log('📅 All Dates - End time filter (minutes):', queryParams.endTimeMinutes);
        }
        
        console.log('📅 No date filter, showing tutors with any open slots from today with time range filter');
      }

      // Get total count of tutors matching filter
      // When filtering by time, we need to check slots individually
      let countQuery: string;
      let tutorsQuery: string;
      
      // Always need to check if slots are still bookable (not past and at least 5 min away)
      // So we always need to collect slot data for post-processing
      const needsTimeFiltering = startTime || endTime;
      
      if (needsTimeFiltering || dateFilter) {
        // For time filtering or date filtering, we need to get slots and filter in code
        // because string comparison of 12-hour format doesn't work correctly
        // Also need to filter out past/close slots
        countQuery = `
          ${matchPattern}
          ${whereClause}
          RETURN DISTINCT u, collect({date: s.slotDate, time: s.slotTime}) as slots
        `;
        
        tutorsQuery = countQuery; // Same query, we'll handle pagination in code
      } else if (!dateFilter) {
        // "All Dates" mode without time filter - need to get tutors with their slots for bookable check
        countQuery = `
          ${matchPattern}
          RETURN DISTINCT u, collect({date: s.slotDate, time: s.slotTime}) as slots
        `;
        
        tutorsQuery = countQuery; // Same query, we'll handle pagination in code
      }

      console.log('🔢 Count query:', countQuery);
      console.log('🔢 Tutors query:', tutorsQuery);
      console.log('🔢 Query parameters:', JSON.stringify(queryParams, null, 2));
      console.log('🔢 dateFilter value:', dateFilter);
      console.log('🔢 needsTimeFiltering:', needsTimeFiltering);
      
      let total: number;
      let tutors: Tutor[];
      
      // All modes now use slot-level filtering to exclude past/close slots
      const result = await session.run(countQuery, queryParams);
      
      // Filter tutors who have at least one BOOKABLE slot (not past and at least 5 min away)
      const filteredTutors: Tutor[] = [];
      
      for (const record of result.records) {
        const user = record.get('u').properties;
        const slots: Array<{date: string; time: string}> = record.get('slots') || [];
        
        // Filter to only bookable slots (not past and at least 5 min away)
        const bookableSlots = slots.filter((slot: {date: string; time: string}) => 
          isSlotBookable(slot.date, slot.time)
        );
        
        // If time range filter is applied, also check that
        let matchingSlots = bookableSlots;
        if (queryParams.startTimeMinutes || queryParams.endTimeMinutes) {
          matchingSlots = bookableSlots.filter((slot: {date: string; time: string}) => {
            const slotMinutes = timeToMinutesAny(slot.time);
            const startOk = !queryParams.startTimeMinutes || slotMinutes >= queryParams.startTimeMinutes;
            const endOk = !queryParams.endTimeMinutes || slotMinutes <= queryParams.endTimeMinutes;
            return startOk && endOk;
          });
        }
        
        // Only include tutor if they have at least one bookable slot
        if (matchingSlots.length > 0) {
          filteredTutors.push({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            displayName: `${user.firstName} ${user.lastName}`,
            profilePicture: user.profilePicture,
            tier: user.tier,
            timezone: user.timezone,
            isVerified: user.isVerified || false,
            isAvailable: true,
            joinedDate: user.createdAt
          });
        }
      }
      
      total = filteredTutors.length;
      // Apply pagination in code
      const startIdx = (pageNum - 1) * limitNum;
      tutors = filteredTutors.slice(startIdx, startIdx + limitNum);
      
      console.log(`📅 Slot filtering: ${result.records.length} tutors with open slots, ${total} with bookable slots`);

      return {
        tutors,
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: skip + tutors.length < total
      };
    } catch (error) {
      console.error('Error searching tutors:', error);
      throw new Error('Failed to search tutors');
    } finally {
      await session.close();
    }
  }

  /**
   * Get weekly availability for a tutor
   * Returns slots converted to KST (Asia/Seoul) timezone for student display
   */
  public async getAvailability(tutorId: string): Promise<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Get current date in Philippine Time (UTC+8) for accurate slot querying
      const now = new Date();
      const phtNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      
      // Start from yesterday (PHT) to catch any late-night slots that convert to today in KST
      const startDateObj = new Date(phtNow);
      startDateObj.setDate(startDateObj.getDate() - 1);
      const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
      
      // End date: 7 days from now in PHT
      const endDateObj = new Date(phtNow);
      endDateObj.setDate(endDateObj.getDate() + 7);
      const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      
      console.log('🔍 getAvailability - tutorId:', tutorId);
      console.log('🔍 getAvailability - PHT now:', phtNow.toISOString());
      console.log('🔍 getAvailability - Date range:', startDate, 'to', endDate);
      
      // Get time slots with optional booking info (to get studentId from Booking node)
      const result = await session.run(
        `
        MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(s:TimeSlot)
        WHERE s.slotDate >= $startDate 
          AND s.slotDate <= $endDate
        OPTIONAL MATCH (b:Booking)-[:BOOKS]->(s)
        RETURN s, b.studentId as bookingStudentId
        ORDER BY s.slotDate, s.slotTime
        `,
        { tutorId, startDate, endDate }
      );
      
      // Helper to parse 12h time to {hour, minute}
      const parse12hTime = (time12: string): { hour: number; minute: number } => {
        const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match || !match[1] || !match[2] || !match[3]) return { hour: 0, minute: 0 };
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const isPM = match[3].toUpperCase() === 'PM';
        
        if (hour === 12) {
          hour = isPM ? 12 : 0;
        } else if (isPM) {
          hour += 12;
        }
        
        return { hour, minute };
      };
      
      // Check if a slot is in the past (Philippine time)
      const isSlotInPast = (dateStr: string, time12: string): boolean => {
        const { hour, minute } = parse12hTime(time12);
        
        // Create slot datetime in Philippine time (UTC+8)
        const slotDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`);
        const now = new Date();
        
        return slotDate < now;
      };
      
      // Convert Philippine time to KST (KST = PHT + 1 hour)
      // When PHT time + 1 hour >= 24, the date also advances to next day
      const convertPHTtoKST = (dateStr: string, time12: string): { date: string; time: string } => {
        const { hour, minute } = parse12hTime(time12);
        
        // Add 1 hour for KST
        let kstHour = hour + 1;
        let kstDate = dateStr;
        
        // Handle hour overflow - date advances to next day
        if (kstHour >= 24) {
          kstHour -= 24;
          // Advance date by 1 day
          const nextDay = new Date(dateStr);
          nextDay.setDate(nextDay.getDate() + 1);
          kstDate = nextDay.toISOString().split('T')[0];
        }
        
        const kstTime = `${String(kstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        return { date: kstDate, time: kstTime };
      };
      
      console.log('🔍 getAvailability - Found', result.records.length, 'slots from DB');
      
      const slots = result.records.map(record => {
        const slot = record.get('s').properties;
        const bookingStudentId = record.get('bookingStudentId');
        
        console.log('🔍 Raw slot:', slot.slotDate, slot.slotTime, 'status:', slot.status);
        
        const { date, time } = convertPHTtoKST(slot.slotDate, slot.slotTime);
        
        console.log('🔍 Converted to KST:', date, time);
        
        // Check if slot is in the past
        const isPast = isSlotInPast(slot.slotDate, slot.slotTime);
        
        // Map status - mark as TAKEN if in the past and was open
        let status: 'AVAIL' | 'TAKEN' | 'BOOKED' = 'AVAIL';
        if (slot.status === 'booked') {
          status = 'BOOKED';
        } else if (slot.status === 'taken' || isPast) {
          // Past unbooked slots are marked as TAKEN (unavailable)
          status = 'TAKEN';
        }
        
        // Get studentId from TimeSlot or from Booking node
        const studentId = slot.studentId || bookingStudentId;
        
        return {
          date,
          time,
          status,
          studentId
        };
      });
      
      console.log('🔍 Returning slots:', slots.length, 'with AVAIL:', slots.filter(s => s.status === 'AVAIL').length);
      
      return slots;
    } finally {
      await session.close();
    }
  }

  /**
   * Set user's profile picture URL
   * For approved profiles, this goes through the pending changes queue
   */
  public async setProfilePicture(userId: string, url: string): Promise<{ hasPendingChanges: boolean }> {
    // Use updateProfile to handle the pending changes flow for approved profiles
    return this.updateProfile(userId, { profilePicture: url });
  }

  /**
   * Update tutor profile fields (bio, introduction, etc.)
   * If profile is already approved, reviewable changes go to pending queue
   */
  public async updateProfile(userId: string, data: Record<string, any>): Promise<{ hasPendingChanges: boolean }> {
    const driver = getDriver();
    const session = driver.session();
    try {
      // First check if profile is already approved
      const statusResult = await session.run(
        `MATCH (u:User { id: $userId }) RETURN u.profileStatus as profileStatus, u.pendingProfileChanges as pendingChanges`,
        { userId }
      );
      
      const record = statusResult.records[0];
      const profileStatus = record?.get('profileStatus');
      const isApproved = profileStatus === 'approved';
      
      // Fields that require re-approval after profile is approved
      const reviewableFields = ['bio', 'profilePicture', 'videoIntroUrl', 'schoolAttended', 'major', 'interests'];
      
      // Separate reviewable vs non-reviewable changes
      const directUpdates: Record<string, any> = {};
      const pendingUpdates: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (isApproved && reviewableFields.includes(key)) {
          pendingUpdates[key] = value;
        } else {
          directUpdates[key] = value;
        }
      }
      
      // Apply direct updates immediately
      if (Object.keys(directUpdates).length > 0) {
        const setStatements: string[] = [];
        const params: Record<string, any> = { userId };

        for (const [key, value] of Object.entries(directUpdates)) {
          setStatements.push(`u.${key} = $${key}`);
          params[key] = value;
        }

        await session.run(
          `
          MATCH (u:User { id: $userId })
          SET ${setStatements.join(', ')}
          `,
          params
        );
      }
      
      // If profile is approved, save reviewable changes as pending
      if (isApproved && Object.keys(pendingUpdates).length > 0) {
        // Get current pending changes
        let currentPendingChanges: any[] = [];
        const existingPending = record?.get('pendingChanges');
        if (existingPending) {
          try {
            currentPendingChanges = typeof existingPending === 'string' 
              ? JSON.parse(existingPending) 
              : existingPending;
          } catch {}
        }
        
        // Map field keys to item keys
        const fieldToItemKey: Record<string, string> = {
          'bio': 'bio',
          'profilePicture': 'profilePicture',
          'videoIntroUrl': 'videoIntro',
          'schoolAttended': 'education',
          'major': 'education',
          'interests': 'interests'
        };
        
        // Add or update pending changes
        for (const [key, value] of Object.entries(pendingUpdates)) {
          const itemKey = fieldToItemKey[key] || key;
          
          // Remove existing pending change for this item
          currentPendingChanges = currentPendingChanges.filter(c => c.itemKey !== itemKey);
          
          // Add new pending change
          currentPendingChanges.push({
            itemKey,
            fieldKey: key, // Store original field key for when we apply the change
            newValue: value,
            status: 'pending',
            submittedAt: new Date().toISOString()
          });
        }
        
        // Save pending changes and notify admins
        await session.run(
          `
          MATCH (u:User { id: $userId })
          SET u.pendingProfileChanges = $pendingChanges,
              u.hasPendingChanges = true
          `,
          { userId, pendingChanges: JSON.stringify(currentPendingChanges) }
        );
        
        // Notify admins about pending changes
        const adminResult = await session.run(
          `MATCH (a:Admin) RETURN a.id as adminId`
        );
        
        const notificationService = new NotificationService();
        const io = getIO();
        
        // Get tutor name for notification
        const tutorResult = await session.run(
          `MATCH (u:User { id: $userId }) RETURN u.firstName as firstName, u.lastName as lastName`,
          { userId }
        );
        const tutorRecord = tutorResult.records[0];
        const tutorName = tutorRecord ? `${tutorRecord.get('firstName') || ''} ${tutorRecord.get('lastName') || ''}`.trim() : 'A tutor';
        
        for (const adminRecord of adminResult.records) {
          const adminId = adminRecord.get('adminId');
          if (adminId) {
            const notification = await notificationService.createNotification({
              userId: adminId,
              userType: 'admin',
              type: 'profile_change_submitted',
              title: 'Profile Change Request',
              message: `${tutorName} has made changes to their approved profile that require review.`,
              data: {
                tutorId: userId,
                tutorName: tutorName,
                link: '/applications'
              }
            });
            
            if (io) {
              io.to(`notifications:${adminId}`).emit('notification:new', notification);
            }
          }
        }
        
        return { hasPendingChanges: true };
      }
      
      return { hasPendingChanges: false };
    } finally {
      await session.close();
    }
  }

  /**
   * Submit profile for admin review
   */
  public async submitProfileForReview(userId: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    try {
      // Update profile status and get tutor info
      const result = await session.run(
        `
        MATCH (u:User { id: $userId })
        SET u.profileStatus = 'pending_review',
            u.profileSubmittedAt = datetime()
        RETURN u.firstName as firstName, u.lastName as lastName, u.email as email
        `,
        { userId }
      );
      
      const record = result.records[0];
      const tutorName = record ? `${record.get('firstName') || ''} ${record.get('lastName') || ''}`.trim() : 'A tutor';
      
      // Get all admin users to notify them
      const adminResult = await session.run(
        `MATCH (a:Admin) RETURN a.id as adminId`
      );
      
      const notificationService = new NotificationService();
      const io = getIO();
      
      // Send notification to each admin
      for (const adminRecord of adminResult.records) {
        const adminId = adminRecord.get('adminId');
        if (adminId) {
          const notification = await notificationService.createNotification({
            userId: adminId,
            userType: 'admin',
            type: 'profile_submitted',
            title: 'New Profile Submission',
            message: `${tutorName} has submitted their profile for review.`,
            data: {
              tutorId: userId,
              tutorName: tutorName,
              link: '/applications'
            }
          });
          
          // Emit real-time notification via socket
          if (io) {
            io.to(`notifications:${adminId}`).emit('notification:new', notification);
          }
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Get current profile picture URL for a user
   */
  public async getCurrentProfilePicture(userId: string): Promise<string | undefined> {
    const driver = getDriver();
    const session = driver.session();
    try {
      const res = await session.run(
        `
        MATCH (u:User { id: $userId })
        RETURN u.profilePicture as profilePicture
        `,
        { userId }
      );
      const record = res.records[0];
      const url = record?.get('profilePicture');
      return url || undefined;
    } finally {
      await session.close();
    }
  }

  /**
   * Get current video intro URL for a user
   */
  public async getVideoIntroUrl(userId: string): Promise<string | undefined> {
    const driver = getDriver();
    const session = driver.session();
    try {
      const res = await session.run(
        `
        MATCH (u:User { id: $userId })
        RETURN u.videoIntroUrl as videoIntroUrl
        `,
        { userId }
      );
      const record = res.records[0];
      const url = record?.get('videoIntroUrl');
      return url || undefined;
    } finally {
      await session.close();
    }
  }

  /**
   * Get profile status for a user
   */
  public async getProfileStatus(userId: string): Promise<string | undefined> {
    const driver = getDriver();
    const session = driver.session();
    try {
      const res = await session.run(
        `
        MATCH (u:User { id: $userId })
        RETURN u.profileStatus as profileStatus
        `,
        { userId }
      );
      const record = res.records[0];
      return record?.get('profileStatus') || undefined;
    } finally {
      await session.close();
    }
  }

  /**
   * Get tutor profile by ID
   */
  public async getTutorProfile(tutorId: string): Promise<TutorProfile | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const query = `
        MATCH (u:User {id: $tutorId})
        RETURN u
      `;

      const result = await session.run(query, { tutorId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const user = record.get('u').properties;

      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`,
        profilePicture: user.profilePicture,
        bio: user.bio,
        introduction: user.introduction,
        tier: user.tier,
        timezone: user.timezone,
        country: user.country,
        languages: user.languages ? JSON.parse(user.languages) : [],
        specializations: user.specializations ? JSON.parse(user.specializations) : [],
        interests: user.interests ? JSON.parse(user.interests) : [],
        hourlyRate: user.hourlyRate ? parseFloat(user.hourlyRate) : undefined,
        experienceYears: user.experienceYears ? parseInt(user.experienceYears) : undefined,
        education: user.education ? JSON.parse(user.education) : [],
        certifications: user.certifications ? JSON.parse(user.certifications) : [],
        schoolAttended: user.schoolAttended || undefined,
        major: user.major || undefined,
        teachingQualifications: user.teachingQualifications || undefined,
        teachingStyle: user.teachingStyle,
        videoIntroUrl: user.videoIntroUrl,
        rating: user.rating ? parseFloat(user.rating) : undefined,
        totalReviews: user.totalReviews ? parseInt(user.totalReviews) : 0,
        totalSessions: user.totalSessions ? parseInt(user.totalSessions) : 0,
        isVerified: user.isVerified || false,
        isAvailable: user.isAvailable || false,
        joinedDate: user.createdAt,
        profileStatus: user.profileStatus || 'incomplete',
        profileSubmittedAt: neo4jDateTimeToISO(user.profileSubmittedAt),
        profileItemStatuses: user.profileItemStatuses ? JSON.parse(user.profileItemStatuses) : undefined,
        profileRejectionReason: user.profileRejectionReason || undefined,
        pendingProfileChanges: user.pendingProfileChanges ? JSON.parse(user.pendingProfileChanges) : undefined,
        hasPendingChanges: user.hasPendingChanges || false
      };
    } catch (error) {
      console.error('Error getting tutor profile:', error);
      throw new Error('Failed to get tutor profile');
    } finally {
      await session.close();
    }
  }

  /**
   * Get student profile for tutor view (includes booking stats)
   */
  public async getStudentProfile(studentId: string, tutorId: string) {
    console.log('[TutorService] getStudentProfile called with:', { studentId, tutorId });
    
    const driver = getDriver();
    const session = driver.session();

    try {
      console.log('[TutorService] Executing student profile query...');
      
      const result = await session.run(
        `
        MATCH (s:Student {id: $studentId})
        OPTIONAL MATCH (s)<-[:BOOKED_BY]-(b:Booking)
        OPTIONAL MATCH (b)-[:BOOKS]->(slot:TimeSlot)<-[:OPENS_SLOT]-(tutor:User {id: $tutorId})
        WITH s, 
             COUNT(DISTINCT CASE WHEN b.status = 'confirmed' OR b.status = 'completed' THEN b END) as totalLessons,
             COUNT(DISTINCT CASE WHEN tutor IS NOT NULL THEN b END) as lessonsWithThisTutor,
             COUNT(DISTINCT CASE WHEN b.status = 'completed' AND b.attendanceStatus = 'present' THEN b END) as attendedLessons,
             COUNT(DISTINCT CASE WHEN b.status = 'confirmed' AND slot.slotDate IS NOT NULL THEN b END) as upcomingLessons
        RETURN s {
          .*,
          totalLessons: totalLessons,
          lessonsWithThisTutor: lessonsWithThisTutor,
          attendedLessons: attendedLessons,
          upcomingLessons: upcomingLessons,
          attendanceRate: CASE WHEN totalLessons > 0 THEN (attendedLessons * 100.0 / totalLessons) ELSE 0 END
        } as student
        `,
        { studentId, tutorId }
      );

      console.log('[TutorService] Query returned', result.records.length, 'records');

      if (result.records.length === 0) {
        console.error('[TutorService] Student not found with ID:', studentId);
        throw new Error('Student not found');
      }

      const studentData = result.records[0]?.get('student');
      console.log('[TutorService] Raw student data:', studentData);
      
      const profileData = {
        id: studentData.id,
        email: studentData.email,
        givenName: studentData.givenName,
        familyName: studentData.familyName,
        fullName: `${studentData.givenName} ${studentData.familyName}`,
        initials: `${studentData.givenName?.[0] || ''}${studentData.familyName?.[0] || ''}`.toUpperCase(),
        mobileNumber: studentData.mobileNumber,
        birthDate: studentData.birthDate,
        joinDate: studentData.signUpdate || 'N/A',
        totalLessons: typeof studentData.totalLessons === 'object' ? studentData.totalLessons.toInt() : (studentData.totalLessons || 0),
        lessonsWithThisTutor: typeof studentData.lessonsWithThisTutor === 'object' ? studentData.lessonsWithThisTutor.toInt() : (studentData.lessonsWithThisTutor || 0),
        upcomingLessons: typeof studentData.upcomingLessons === 'object' ? studentData.upcomingLessons.toInt() : (studentData.upcomingLessons || 0),
        attendance: Math.round(studentData.attendanceRate || 0),
        smartWalletAddress: studentData.smartWalletAddress,
        // Additional fields that might be in personal info
        currentProficiency: studentData.currentProficiency,
        learningGoals: studentData.learningGoals ? JSON.parse(studentData.learningGoals) : [],
        preferredLearningStyle: studentData.preferredLearningStyle,
        availability: studentData.availability ? JSON.parse(studentData.availability) : [],
        country: studentData.country,
        timezone: studentData.timezone || 'GMT+8 (Philippine Time)'
      };
      
      console.log('[TutorService] Returning profile data (abbreviated):', {
        id: profileData.id,
        email: profileData.email,
        totalLessons: profileData.totalLessons
      });
      
      return profileData;
    } catch (error) {
      console.error('[TutorService] Error getting student profile:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

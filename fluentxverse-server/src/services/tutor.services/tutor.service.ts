import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import type { Tutor, TutorProfile, TutorSearchParams, TutorSearchResponse } from './tutor.interface';

export class TutorService {
  /**
   * Search and filter tutors
   */
  public async searchTutors(params: TutorSearchParams): Promise<TutorSearchResponse> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const {
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

      // Helper function to convert 12h time string to minutes for comparison
      const time12ToMinutes = (time12: string): number => {
        // Format: "11:30 PM" or "12:00 AM"
        const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match || !match[1] || !match[2] || !match[3]) return 0;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const isPM = match[3].toUpperCase() === 'PM';
        
        if (hour === 12) {
          hour = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
        } else if (isPM) {
          hour += 12;
        }
        
        return hour * 60 + minute;
      };

      // Build WHERE clause for date and time filtering
      let whereClause = '';
      let matchPattern = 'MATCH (u:User)';
      const queryParams: any = { dateFilter, skip: neo4j.int(skip), limit: neo4j.int(limitNum) };
      
      // Certification requirement - tutor must have passed both exams
      // OR be a test account (bypass for development)
      const TEST_ACCOUNT_IDS = ['paulanthonyarriola@gmail.com']; // Test tutor emails
      const certificationCheck = `(u.writtenExamPassed = true AND u.speakingExamPassed = true) OR u.email IN ['paulanthonyarriola@gmail.com']`;
      
      // Get today's date for "all dates" filter
      const today = new Date().toISOString().split('T')[0];
      queryParams.today = today;
      
      console.log('🔎 Building query with dateFilter:', dateFilter, 'startTime:', startTime, 'endTime:', endTime);
      
      if (dateFilter) {
        // Only show tutors who have open slots on the specified date AND are certified
        matchPattern = `MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)`;
        whereClause = `WHERE s.slotDate = $dateFilter AND s.status = 'open' AND ${certificationCheck}`;
        
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
        matchPattern = `MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)
          WHERE s.slotDate >= $today AND s.status = 'open' AND ${certificationCheck}`;
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
      
      // Check if we need time filtering (either with date filter or "All Dates")
      const needsTimeFiltering = startTime || endTime;
      
      if (needsTimeFiltering) {
        // For time filtering, we need to get slots and filter in code
        // because string comparison of 12-hour format doesn't work correctly
        countQuery = `
          ${matchPattern}
          ${whereClause}
          RETURN DISTINCT u, collect(s.slotTime) as slotTimes
        `;
        
        tutorsQuery = countQuery; // Same query, we'll handle pagination in code
      } else if (!dateFilter) {
        // "All Dates" mode without time filter - need to get tutors with their slot count
        countQuery = `
          ${matchPattern}
          WITH u, count(s) as slotCount
          WHERE slotCount > 0
          RETURN count(DISTINCT u) as total
        `;
        
        tutorsQuery = `
          ${matchPattern}
          WITH u, count(s) as slotCount
          WHERE slotCount > 0
          RETURN DISTINCT u, slotCount
          SKIP $skip
          LIMIT $limit
        `;
      } else {
        countQuery = `
          ${matchPattern}
          ${whereClause}
          RETURN count(DISTINCT u) as total
        `;
        
        tutorsQuery = `
          ${matchPattern}
          ${whereClause}
          RETURN DISTINCT u
          SKIP $skip
          LIMIT $limit
        `;
      }

      console.log('🔢 Count query:', countQuery);
      console.log('🔢 Query parameters:', queryParams);
      
      let total: number;
      let tutors: Tutor[];
      
      if (needsTimeFiltering) {
        // Time filtering mode (with or without date filter) - fetch all matching tutors with their slots
        const result = await session.run(countQuery, queryParams);
        
        // Filter tutors who have at least one slot in the time range
        const filteredTutors: Tutor[] = [];
        
        for (const record of result.records) {
          const user = record.get('u').properties;
          const slotTimes: string[] = record.get('slotTimes') || [];
          
          // Check if any slot falls within the time range
          const hasMatchingSlot = slotTimes.some((slotTime: string) => {
            const slotMinutes = time12ToMinutes(slotTime);
            const startOk = !queryParams.startTimeMinutes || slotMinutes >= queryParams.startTimeMinutes;
            const endOk = !queryParams.endTimeMinutes || slotMinutes <= queryParams.endTimeMinutes;
            return startOk && endOk;
          });
          
          if (hasMatchingSlot) {
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
        
        console.log(`📅 Time filtering: ${result.records.length} tutors found, ${total} after time filter`);
      } else if (!dateFilter) {
        // "All Dates" mode without time filter - tutors with any open slots
        const countResult = await session.run(countQuery, queryParams);
        total = countResult.records[0]?.get('total')?.toNumber?.() || 0;

        // Get tutors with pagination
        const result = await session.run(tutorsQuery, queryParams);
        
        tutors = result.records.map(record => {
          const user = record.get('u').properties;
          const slotCount = record.get('slotCount')?.toNumber?.() || 0;
          return {
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
            isAvailable: slotCount > 0,
            joinedDate: user.createdAt
          };
        });
        
        console.log(`📅 All Dates mode: ${total} tutors with open slots`);
      } else {
        // Standard mode with date filter but no time filter
        const countResult = await session.run(countQuery, queryParams);
        total = countResult.records[0]?.get('total')?.toNumber?.() || 0;

        // Get tutors with pagination
        const result = await session.run(tutorsQuery, queryParams);
        
        tutors = result.records.map(record => {
          const user = record.get('u').properties;
          return {
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
          };
        });
      }

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
      // Get next 7 days
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
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
        const dateParts = dateStr.split('-').map(Number);
        const year = dateParts[0] ?? 0;
        const month = dateParts[1] ?? 1;
        const day = dateParts[2] ?? 1;
        
        // Create slot datetime in Philippine time
        const slotDate = new Date(year, month - 1, day, hour, minute);
        const now = new Date();
        
        return slotDate < now;
      };
      
      // Convert Philippine time to KST (KST = PHT + 1 hour)
      // IMPORTANT: Keep the tutor's original date, only convert the time
      // So 11:00 PM PHT Dec 5 becomes 00:00 KST Dec 5 (not Dec 6)
      const convertPHTtoKST = (dateStr: string, time12: string): { date: string; time: string } => {
        const { hour, minute } = parse12hTime(time12);
        
        // Add 1 hour for KST
        let kstHour = hour + 1;
        
        // Handle hour overflow (wrap around to 00:00, 00:30, etc.)
        if (kstHour >= 24) {
          kstHour -= 24;
        }
        
        // Keep the original date (tutor's schedule date)
        const kstTime = `${String(kstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        return { date: dateStr, time: kstTime };
      };
      
      return result.records.map(record => {
        const slot = record.get('s').properties;
        const bookingStudentId = record.get('bookingStudentId');
        const { date, time } = convertPHTtoKST(slot.slotDate, slot.slotTime);
        
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
    } finally {
      await session.close();
    }
  }

  /**
   * Set user's profile picture URL, optionally clearing previous one
   */
  public async setProfilePicture(userId: string, url: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        `
        MATCH (u:User { id: $userId })
        SET u.profilePicture = $url
        `,
        { userId, url }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Update tutor profile fields (bio, introduction, etc.)
   */
  public async updateProfile(userId: string, data: Record<string, any>): Promise<void> {
    const driver = getDriver();
    const session = driver.session();
    try {
      const setStatements: string[] = [];
      const params: Record<string, any> = { userId };

      for (const [key, value] of Object.entries(data)) {
        setStatements.push(`u.${key} = $${key}`);
        params[key] = value;
      }

      if (setStatements.length === 0) return;

      await session.run(
        `
        MATCH (u:User { id: $userId })
        SET ${setStatements.join(', ')}
        `,
        params
      );
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
        joinedDate: user.createdAt
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

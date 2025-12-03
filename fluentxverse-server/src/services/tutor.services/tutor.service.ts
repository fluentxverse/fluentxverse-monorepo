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

      // Helper function to convert time string to comparable format
      const convertTo12HourFormat = (time24: string): string => {
        const [hourStr, minute] = time24.split(':');
        let hour = parseInt(hourStr || "0", 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
      };

      // Build WHERE clause for date and time filtering
      let whereClause = '';
      let matchPattern = 'MATCH (u:User)';
      const queryParams: any = { dateFilter, skip: neo4j.int(skip), limit: neo4j.int(limitNum) };
      
      console.log('🔎 Building query with dateFilter:', dateFilter, 'startTime:', startTime, 'endTime:', endTime);
      
      if (dateFilter) {
        // Only show tutors who have open slots on the specified date
        matchPattern = `MATCH (u:User)-[:OPENS_SLOT]->(s:TimeSlot)`;
        whereClause = `WHERE s.slotDate = $dateFilter AND s.status = 'open'`;
        
        // Add time range filtering if provided
        if (startTime || endTime) {
          const timeConditions = [];
          
          if (startTime) {
            const startTime12 = convertTo12HourFormat(startTime);
            queryParams.startTime = startTime12;
            timeConditions.push('s.slotTime >= $startTime');
            console.log('📅 Adding start time filter:', startTime12);
          }
          
          if (endTime) {
            const endTime12 = convertTo12HourFormat(endTime);
            queryParams.endTime = endTime12;
            timeConditions.push('s.slotTime <= $endTime');
            console.log('📅 Adding end time filter:', endTime12);
          }
          
          if (timeConditions.length > 0) {
            whereClause += ` AND ${timeConditions.join(' AND ')}`;
          }
        }
        
        console.log('📅 Using date filter match pattern:', matchPattern);
        console.log('📅 Using date filter WHERE clause:', whereClause);
      } else {
        console.log('📅 No date filter, showing all tutors');
      }

      // Get total count of tutors matching filter
      const countQuery = `
        ${matchPattern}
        ${whereClause}
        RETURN count(DISTINCT u) as total
      `;

      console.log('🔢 Count query:', countQuery);
      console.log('🔢 Query parameters:', queryParams);
      
      const countResult = await session.run(countQuery, queryParams);
      const total = countResult.records[0]?.get('total').toNumber() || 0;
      

      // Get tutors with pagination
      const tutorsQuery = `
        ${matchPattern}
        ${whereClause}
        RETURN DISTINCT u
        SKIP $skip
        LIMIT $limit
      `;

      const result = await session.run(tutorsQuery, queryParams);
      


      const tutors: Tutor[] = result.records.map(record => {
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
          joinedDate: user.createdAt
        };
      });

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
   */
  public async getAvailability(tutorId: string): Promise<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>> {
    // TODO: Implement real availability from Memgraph when schema is ready.
    // For now, return empty set indicating no opened slots.
    return [];
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
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (s:Student {id: $studentId})
        OPTIONAL MATCH (s)<-[:BOOKED_BY]-(b:Booking)
        OPTIONAL MATCH (b)-[:BOOKS]->(slot:TimeSlot)<-[:OPENS_SLOT]-(tutor:User {id: $tutorId})
        WITH s, 
             COUNT(DISTINCT CASE WHEN b.status = 'confirmed' OR b.status = 'completed' THEN b END) as totalLessons,
             COUNT(DISTINCT CASE WHEN tutor IS NOT NULL THEN b END) as lessonsWithThisTutor,
             COUNT(DISTINCT CASE WHEN b.status = 'completed' AND b.attendanceStatus = 'present' THEN b END) as attendedLessons,
             COUNT(DISTINCT CASE WHEN b.status = 'confirmed' AND slot.slotDate >= date() THEN b END) as upcomingLessons
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

      if (result.records.length === 0) {
        throw new Error('Student not found');
      }

      const studentData = result.records[0]?.get('student');
      
      return {
        id: studentData.id,
        email: studentData.email,
        givenName: studentData.givenName,
        familyName: studentData.familyName,
        fullName: `${studentData.givenName} ${studentData.familyName}`,
        initials: `${studentData.givenName?.[0] || ''}${studentData.familyName?.[0] || ''}`.toUpperCase(),
        mobileNumber: studentData.mobileNumber,
        birthDate: studentData.birthDate,
        joinDate: studentData.signUpdate || 'N/A',
        totalLessons: studentData.totalLessons || 0,
        lessonsWithThisTutor: studentData.lessonsWithThisTutor || 0,
        upcomingLessons: studentData.upcomingLessons || 0,
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
    } catch (error) {
      console.error('Error getting student profile:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

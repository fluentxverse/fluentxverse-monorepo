import { getDriver } from '../../db/memgraph';
import type { Tutor, TutorProfile, TutorSearchParams, TutorSearchResponse } from './tutor.interface';

export class TutorService {
  /**
   * Search and filter tutors
   */
  async searchTutors(params: TutorSearchParams): Promise<TutorSearchResponse> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const {
        query = '',
        languages = [],
        specializations = [],
        minRating = 0,
        maxHourlyRate,
        minHourlyRate,
        isAvailable,
        sortBy = 'rating',
        page = 1,
        limit = 12
      } = params;

      const skip = (page - 1) * limit;

      // Build WHERE clause conditions
      const conditions: string[] = ['u.tier >= 2']; // Only tutors (tier 2+)
      const queryParams: Record<string, any> = { skip, limit };

      // Text search on name and bio
      if (query) {
        conditions.push('(toLower(u.firstName) CONTAINS toLower($query) OR toLower(u.lastName) CONTAINS toLower($query) OR toLower(u.bio) CONTAINS toLower($query))');
        queryParams.query = query;
      }

      // Filter by languages
      if (languages.length > 0) {
        conditions.push('ANY(lang IN $languages WHERE lang IN u.languages)');
        queryParams.languages = languages;
      }

      // Filter by specializations
      if (specializations.length > 0) {
        conditions.push('ANY(spec IN $specializations WHERE spec IN u.specializations)');
        queryParams.specializations = specializations;
      }

      // Filter by rating
      if (minRating > 0) {
        conditions.push('u.rating >= $minRating');
        queryParams.minRating = minRating;
      }

      // Filter by hourly rate
      if (maxHourlyRate !== undefined) {
        conditions.push('u.hourlyRate <= $maxHourlyRate');
        queryParams.maxHourlyRate = maxHourlyRate;
      }

      if (minHourlyRate !== undefined) {
        conditions.push('u.hourlyRate >= $minHourlyRate');
        queryParams.minHourlyRate = minHourlyRate;
      }

      // Filter by availability
      if (isAvailable) {
        conditions.push('u.isAvailable = true');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build ORDER BY clause
      let orderBy = 'ORDER BY u.rating DESC, u.totalSessions DESC';
      switch (sortBy) {
        case 'price-low':
          orderBy = 'ORDER BY u.hourlyRate ASC';
          break;
        case 'price-high':
          orderBy = 'ORDER BY u.hourlyRate DESC';
          break;
        case 'popular':
          orderBy = 'ORDER BY u.totalSessions DESC, u.rating DESC';
          break;
        case 'newest':
          orderBy = 'ORDER BY u.createdAt DESC';
          break;
      }

      // Get total count
      const countQuery = `
        MATCH (u:User)
        ${whereClause}
        RETURN count(u) as total
      `;

      const countResult = await session.run(countQuery, queryParams);
      const total = countResult.records[0]?.get('total').toNumber() || 0;

      // Get tutors
      const tutorsQuery = `
        MATCH (u:User)
        ${whereClause}
        RETURN u
        ${orderBy}
        SKIP $skip
        LIMIT $limit
      `;

      const result = await session.run(tutorsQuery, queryParams);

      const tutors: Tutor[] = result.records.map(record => {
        const user = record.get('u').properties;
        return {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          displayName: `${user.firstName} ${user.lastName}`,
          profilePicture: user.profilePicture,
          bio: user.bio,
          tier: user.tier,
          hourlyRate: user.hourlyRate,
          languages: user.languages || [],
          specializations: user.specializations || [],
          totalSessions: user.totalSessions || 0,
          rating: user.rating,
          totalReviews: user.totalReviews || 0,
          isAvailable: user.isAvailable,
          nextAvailableSlot: user.nextAvailableSlot,
          country: user.country,
          timezone: user.timezone,
          isVerified: user.isVerified || false,
          joinedDate: user.createdAt
        };
      });

      return {
        tutors,
        total,
        page,
        limit,
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
   * Get tutor profile by ID
   */
  async getTutorProfile(tutorId: string): Promise<TutorProfile | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `MATCH (u:User {userId: $tutorId})
         WHERE u.tier >= 2
         RETURN u`,
        { tutorId }
      );

      if (result.records.length === 0) {
        return null;
      }

      const user = result.records[0].get('u').properties;

      return {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        displayName: `${user.firstName} ${user.lastName}`,
        profilePicture: user.profilePicture,
        bio: user.bio,
        tier: user.tier,
        hourlyRate: user.hourlyRate,
        languages: user.languages || [],
        specializations: user.specializations || [],
        totalSessions: user.totalSessions || 0,
        rating: user.rating,
        totalReviews: user.totalReviews || 0,
        isAvailable: user.isAvailable,
        nextAvailableSlot: user.nextAvailableSlot,
        country: user.country,
        timezone: user.timezone,
        isVerified: user.isVerified || false,
        joinedDate: user.createdAt,
        education: user.education || [],
        certifications: user.certifications || [],
        experienceYears: user.experienceYears,
        teachingStyle: user.teachingStyle,
        introduction: user.introduction,
        videoIntroUrl: user.videoIntroUrl,
        completionRate: user.completionRate,
        responseTime: user.responseTime,
        repeatStudents: user.repeatStudents
      };
    } catch (error) {
      console.error('Error getting tutor profile:', error);
      throw new Error('Failed to get tutor profile');
    } finally {
      await session.close();
    }
  }

  /**
   * Get featured/recommended tutors
   */
  async getFeaturedTutors(limit = 6): Promise<Tutor[]> {
    return this.searchTutors({
      sortBy: 'rating',
      limit,
      page: 1,
      minRating: 4.5
    }).then(response => response.tutors);
  }

  /**
   * Get available languages from all tutors
   */
  async getAvailableLanguages(): Promise<string[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `MATCH (u:User)
         WHERE u.tier >= 2 AND u.languages IS NOT NULL
         UNWIND u.languages as lang
         RETURN DISTINCT lang
         ORDER BY lang`
      );

      return result.records.map(record => record.get('lang'));
    } catch (error) {
      console.error('Error getting languages:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get available specializations from all tutors
   */
  async getAvailableSpecializations(): Promise<string[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `MATCH (u:User)
         WHERE u.tier >= 2 AND u.specializations IS NOT NULL
         UNWIND u.specializations as spec
         RETURN DISTINCT spec
         ORDER BY spec`
      );

      return result.records.map(record => record.get('spec'));
    } catch (error) {
      console.error('Error getting specializations:', error);
      return [];
    } finally {
      await session.close();
    }
  }
}

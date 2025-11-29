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
        limit = 12
      } = params;

      // Ensure page and limit are integers
      const pageNum = Math.max(1, Math.floor(Number(page)));
      const limitNum = Math.max(1, Math.min(100, Math.floor(Number(limit)))); // Cap at 100
      const skip = (pageNum - 1) * limitNum;

      // Get total count of tutors
      const countQuery = `
        MATCH (u:User)
        RETURN count(u) as total
      `;

      const countResult = await session.run(countQuery);
      const total = countResult.records[0]?.get('total').toNumber() || 0;

      // Get tutors with pagination
      const tutorsQuery = `
        MATCH (u:User)
        RETURN u
        SKIP $skip
        LIMIT $limit
      `;

      const result = await session.run(tutorsQuery, {
        skip: neo4j.int(skip),
        limit: neo4j.int(limitNum)
      });

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
}

import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import type { 
  DashboardStats, 
  ExamStats, 
  PendingTutor, 
  TutorListItem,
  StudentListItem,
  RecentActivity 
} from './admin.interface';

export class AdminService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get tutor counts
      const tutorResult = await session.run(`
        MATCH (u:User {role: 'tutor'})
        RETURN 
          count(u) as totalTutors,
          count(CASE WHEN u.writtenExamPassed = true AND u.speakingExamPassed = true THEN 1 END) as certifiedTutors,
          count(CASE WHEN NOT (u.writtenExamPassed = true AND u.speakingExamPassed = true) THEN 1 END) as pendingTutors
      `);

      const tutorRecord = tutorResult.records[0];
      const totalTutors = tutorRecord?.get('totalTutors')?.toNumber?.() ?? tutorRecord?.get('totalTutors') ?? 0;
      const certifiedTutors = tutorRecord?.get('certifiedTutors')?.toNumber?.() ?? tutorRecord?.get('certifiedTutors') ?? 0;
      const pendingTutors = tutorRecord?.get('pendingTutors')?.toNumber?.() ?? tutorRecord?.get('pendingTutors') ?? 0;

      // Get student count
      const studentResult = await session.run(`
        MATCH (u:User {role: 'student'})
        RETURN count(u) as totalStudents
      `);
      const totalStudents = studentResult.records[0]?.get('totalStudents')?.toNumber?.() ?? 
                           studentResult.records[0]?.get('totalStudents') ?? 0;

      // Get session count
      const sessionResult = await session.run(`
        MATCH (s:Session)
        RETURN count(s) as totalSessions
      `);
      const totalSessions = sessionResult.records[0]?.get('totalSessions')?.toNumber?.() ?? 
                           sessionResult.records[0]?.get('totalSessions') ?? 0;

      // TODO: Get actual revenue from wallet/payment data
      const totalRevenue = 0;

      return {
        totalTutors,
        certifiedTutors,
        pendingTutors,
        totalStudents,
        totalSessions,
        totalRevenue
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get exam statistics
   */
  async getExamStats(): Promise<ExamStats> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get written exam stats
      const writtenResult = await session.run(`
        MATCH (u:User {role: 'tutor'})
        WHERE u.writtenExamAttempts IS NOT NULL AND u.writtenExamAttempts > 0
        RETURN 
          count(u) as total,
          count(CASE WHEN u.writtenExamPassed = true THEN 1 END) as passed,
          count(CASE WHEN u.writtenExamPassed = false THEN 1 END) as failed
      `);

      const writtenRecord = writtenResult.records[0];
      const writtenTotal = writtenRecord?.get('total')?.toNumber?.() ?? writtenRecord?.get('total') ?? 0;
      const writtenPassed = writtenRecord?.get('passed')?.toNumber?.() ?? writtenRecord?.get('passed') ?? 0;
      const writtenFailed = writtenRecord?.get('failed')?.toNumber?.() ?? writtenRecord?.get('failed') ?? 0;

      // Get speaking exam stats
      const speakingResult = await session.run(`
        MATCH (u:User {role: 'tutor'})
        WHERE u.speakingExamAttempts IS NOT NULL AND u.speakingExamAttempts > 0
        RETURN 
          count(u) as total,
          count(CASE WHEN u.speakingExamPassed = true THEN 1 END) as passed,
          count(CASE WHEN u.speakingExamPassed = false THEN 1 END) as failed
      `);

      const speakingRecord = speakingResult.records[0];
      const speakingTotal = speakingRecord?.get('total')?.toNumber?.() ?? speakingRecord?.get('total') ?? 0;
      const speakingPassed = speakingRecord?.get('passed')?.toNumber?.() ?? speakingRecord?.get('passed') ?? 0;
      const speakingFailed = speakingRecord?.get('failed')?.toNumber?.() ?? speakingRecord?.get('failed') ?? 0;

      // Get processing count (speaking exams currently being graded)
      const processingResult = await session.run(`
        MATCH (u:User {role: 'tutor'})
        WHERE u.speakingExamStatus = 'processing'
        RETURN count(u) as processing
      `);
      const processing = processingResult.records[0]?.get('processing')?.toNumber?.() ?? 
                        processingResult.records[0]?.get('processing') ?? 0;

      return {
        writtenExams: {
          total: writtenTotal,
          passed: writtenPassed,
          failed: writtenFailed
        },
        speakingExams: {
          total: speakingTotal,
          passed: speakingPassed,
          failed: speakingFailed,
          processing
        }
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get pending tutors (not fully certified)
   */
  async getPendingTutors(limit: number = 10): Promise<PendingTutor[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (u:User {role: 'tutor'})
        WHERE NOT (u.writtenExamPassed = true AND u.speakingExamPassed = true)
        RETURN u
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(limit) });

      return result.records.map(record => {
        const u = record.get('u').properties;
        const writtenPassed = u.writtenExamPassed === true;
        const speakingPassed = u.speakingExamPassed === true;
        const isProcessing = u.speakingExamStatus === 'processing';

        let status: 'pending_written' | 'pending_speaking' | 'processing';
        if (!writtenPassed) {
          status = 'pending_written';
        } else if (isProcessing) {
          status = 'processing';
        } else {
          status = 'pending_speaking';
        }

        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          registeredAt: u.createdAt || new Date().toISOString(),
          status,
          writtenExamPassed: writtenPassed,
          speakingExamPassed: speakingPassed
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get all tutors with filters
   */
  async getTutors(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'certified' | 'pending' | 'processing' | 'failed';
    search?: string;
  }): Promise<{ tutors: TutorListItem[]; total: number }> {
    const driver = getDriver();
    const session = driver.session();
    const { page = 1, limit = 20, status = 'all', search = '' } = params;
    const skip = (page - 1) * limit;

    try {
      let whereClause = "WHERE u.role = 'tutor'";
      
      if (search) {
        whereClause += ` AND (toLower(u.firstName) CONTAINS toLower($search) OR toLower(u.lastName) CONTAINS toLower($search) OR toLower(u.email) CONTAINS toLower($search))`;
      }

      if (status === 'certified') {
        whereClause += ' AND u.writtenExamPassed = true AND u.speakingExamPassed = true';
      } else if (status === 'pending') {
        whereClause += ' AND NOT (u.writtenExamPassed = true AND u.speakingExamPassed = true)';
      } else if (status === 'processing') {
        whereClause += " AND u.speakingExamStatus = 'processing'";
      }

      // Get total count
      const countResult = await session.run(`
        MATCH (u:User)
        ${whereClause}
        RETURN count(u) as total
      `, { search });
      const total = countResult.records[0]?.get('total')?.toNumber?.() ?? 
                   countResult.records[0]?.get('total') ?? 0;

      // Get tutors
      const result = await session.run(`
        MATCH (u:User)
        ${whereClause}
        RETURN u
        ORDER BY u.createdAt DESC
        SKIP $skip
        LIMIT $limit
      `, { search, skip: neo4j.int(skip), limit: neo4j.int(limit) });

      const tutors: TutorListItem[] = result.records.map(record => {
        const u = record.get('u').properties;
        const writtenPassed = u.writtenExamPassed === true;
        const speakingPassed = u.speakingExamPassed === true;
        const isProcessing = u.speakingExamStatus === 'processing';

        let tutorStatus: 'pending' | 'certified' | 'processing' | 'failed';
        if (writtenPassed && speakingPassed) {
          tutorStatus = 'certified';
        } else if (isProcessing) {
          tutorStatus = 'processing';
        } else {
          tutorStatus = 'pending';
        }

        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          registeredAt: u.createdAt || new Date().toISOString(),
          writtenExamPassed: writtenPassed,
          speakingExamPassed: speakingPassed,
          writtenExamScore: u.writtenExamScore,
          speakingExamScore: u.speakingExamScore,
          status: tutorStatus,
          languages: u.languages || ['English'],
          totalSessions: u.totalSessions || 0,
          rating: u.rating || 0
        };
      });

      return { tutors, total };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all students with filters
   */
  async getStudents(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'active' | 'inactive';
    search?: string;
  }): Promise<{ students: StudentListItem[]; total: number }> {
    const driver = getDriver();
    const session = driver.session();
    const { page = 1, limit = 20, status = 'all', search = '' } = params;
    const skip = (page - 1) * limit;

    try {
      let whereClause = "WHERE u.role = 'student'";
      
      if (search) {
        whereClause += ` AND (toLower(u.givenName) CONTAINS toLower($search) OR toLower(u.familyName) CONTAINS toLower($search) OR toLower(u.email) CONTAINS toLower($search))`;
      }

      // Get total count
      const countResult = await session.run(`
        MATCH (u:User)
        ${whereClause}
        RETURN count(u) as total
      `, { search });
      const total = countResult.records[0]?.get('total')?.toNumber?.() ?? 
                   countResult.records[0]?.get('total') ?? 0;

      // Get students
      const result = await session.run(`
        MATCH (u:User)
        ${whereClause}
        RETURN u
        ORDER BY u.createdAt DESC
        SKIP $skip
        LIMIT $limit
      `, { search, skip: neo4j.int(skip), limit: neo4j.int(limit) });

      const students: StudentListItem[] = result.records.map(record => {
        const u = record.get('u').properties;
        
        // Calculate if active (active in last 7 days)
        const lastActive = u.lastActive ? new Date(u.lastActive) : new Date(u.createdAt);
        const daysSinceActive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        const isActive = daysSinceActive <= 7;

        return {
          id: u.id,
          name: `${u.givenName || ''} ${u.familyName || ''}`.trim(),
          email: u.email,
          joinedAt: u.createdAt || new Date().toISOString(),
          totalSessions: u.totalSessions || 0,
          totalSpent: u.totalSpent || 0,
          status: isActive ? 'active' : 'inactive',
          lastActive: u.lastActive || u.createdAt || new Date().toISOString()
        };
      });

      return { students, total };
    } finally {
      await session.close();
    }
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get recent tutor registrations
      const tutorResult = await session.run(`
        MATCH (u:User {role: 'tutor'})
        RETURN u.id as id, u.firstName as firstName, u.lastName as lastName, u.createdAt as timestamp, 'tutor_registered' as type
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(Math.ceil(limit / 2)) });

      // Get recent student registrations
      const studentResult = await session.run(`
        MATCH (u:User {role: 'student'})
        RETURN u.id as id, u.givenName as firstName, u.familyName as lastName, u.createdAt as timestamp, 'student_joined' as type
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(Math.ceil(limit / 2)) });

      const activities: RecentActivity[] = [];

      // Process tutor registrations
      tutorResult.records.forEach(record => {
        const firstName = record.get('firstName') || '';
        const lastName = record.get('lastName') || '';
        activities.push({
          id: record.get('id'),
          type: 'tutor_registered',
          message: `New tutor registered: ${firstName} ${lastName}`.trim(),
          timestamp: record.get('timestamp') || new Date().toISOString(),
          userId: record.get('id')
        });
      });

      // Process student registrations
      studentResult.records.forEach(record => {
        const firstName = record.get('firstName') || '';
        const lastName = record.get('lastName') || '';
        activities.push({
          id: record.get('id'),
          type: 'student_joined',
          message: `New student: ${firstName} ${lastName}`.trim(),
          timestamp: record.get('timestamp') || new Date().toISOString(),
          userId: record.get('id')
        });
      });

      // Sort by timestamp and limit
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return activities.slice(0, limit);
    } finally {
      await session.close();
    }
  }
}

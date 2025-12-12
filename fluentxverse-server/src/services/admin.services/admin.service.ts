import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import { hash, compare } from 'bcrypt-ts';
import type { 
  DashboardStats, 
  ExamStats, 
  PendingTutor,
  PendingProfileReview,
  TutorListItem,
  StudentListItem,
  RecentActivity,
  AdminUser,
  AdminLoginParams
} from './admin.interface';
import { NotificationService } from '../notification.services/notification.service';
import { getIO } from '../../socket/socket.server';

// Helper to safely convert Neo4j Integer to JavaScript number
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (typeof value === 'object' && 'low' in value && 'high' in value) {
    // Manual conversion for Neo4j Integer-like objects
    return neo4j.int(value.low, value.high).toNumber();
  }
  if (typeof value?.toNumber === 'function') return value.toNumber();
  return Number(value) || 0;
}

// Helper to parse exam result and check if passed
function examPassed(resultJson: string | null): boolean {
  if (!resultJson) return false;
  try {
    const result = JSON.parse(resultJson);
    return result.passed === true;
  } catch {
    return false;
  }
}

export class AdminService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get all tutors with their exam results
      const tutorResult = await session.run(`
        MATCH (u:User)
        OPTIONAL MATCH (u)-[:TAKES]->(we:Exam {type: 'written', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(se:Exam {type: 'speaking', status: 'completed'})
        RETURN u.id as tutorId,
               collect(DISTINCT we.result) as writtenResults,
               collect(DISTINCT se.result) as speakingResults
      `);

      let totalTutors = 0;
      let certifiedTutors = 0;
      let pendingTutors = 0;

      for (const record of tutorResult.records) {
        totalTutors++;
        const writtenResults = record.get('writtenResults') || [];
        const speakingResults = record.get('speakingResults') || [];
        
        // Check if any written exam passed
        const writtenPassed = writtenResults.some((r: string) => examPassed(r));
        // Check if any speaking exam passed
        const speakingPassed = speakingResults.some((r: string) => examPassed(r));
        
        if (writtenPassed && speakingPassed) {
          certifiedTutors++;
        } else {
          pendingTutors++;
        }
      }

      // Get student count - Students have their own label
      const studentResult = await session.run(`
        MATCH (s:Student)
        RETURN count(s) as totalStudents
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
      // Get written exam stats from Exam nodes
      const writtenResult = await session.run(`
        MATCH (u:User)-[:TAKES]->(e:Exam {type: 'written', status: 'completed'})
        RETURN e.result as result
      `);

      let writtenTotal = 0;
      let writtenPassed = 0;
      let writtenFailed = 0;
      for (const record of writtenResult.records) {
        writtenTotal++;
        if (examPassed(record.get('result'))) {
          writtenPassed++;
        } else {
          writtenFailed++;
        }
      }

      // Get speaking exam stats from Exam nodes
      const speakingResult = await session.run(`
        MATCH (u:User)-[:TAKES]->(e:Exam {type: 'speaking', status: 'completed'})
        RETURN e.result as result
      `);

      let speakingTotal = 0;
      let speakingPassed = 0;
      let speakingFailed = 0;
      for (const record of speakingResult.records) {
        speakingTotal++;
        if (examPassed(record.get('result'))) {
          speakingPassed++;
        } else {
          speakingFailed++;
        }
      }

      // Get processing count (speaking exams currently being graded)
      const processingResult = await session.run(`
        MATCH (u:User)-[:TAKES]->(e:Exam {type: 'speaking', status: 'processing'})
        RETURN count(e) as processing
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
      // Get all tutors with their exam results and interview status to determine certification status
      const result = await session.run(`
        MATCH (u:User)
        OPTIONAL MATCH (u)-[:TAKES]->(we:Exam {type: 'written', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(se:Exam {type: 'speaking', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(sp:Exam {type: 'speaking', status: 'processing'})
        OPTIONAL MATCH (slot:InterviewSlot {tutorId: u.id, status: 'completed'})
        RETURN u,
               collect(DISTINCT we.result) as writtenResults,
               collect(DISTINCT se.result) as speakingResults,
               count(DISTINCT sp) as processingCount,
               slot.result as interviewResult,
               slot.completedAt as interviewDate
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(limit * 2) }); // Get more to filter

      const pendingTutors: PendingTutor[] = [];
      
      for (const record of result.records) {
        const u = record.get('u').properties;
        const writtenResults = record.get('writtenResults') || [];
        const speakingResults = record.get('speakingResults') || [];
        const processingCount = record.get('processingCount')?.toNumber?.() ?? record.get('processingCount') ?? 0;
        const interviewResult = record.get('interviewResult') as 'pass' | 'fail' | null;
        const interviewDate = record.get('interviewDate') as string | null;
        
        const writtenPassed = writtenResults.some((r: string) => examPassed(r));
        const speakingPassed = speakingResults.some((r: string) => examPassed(r));
        const isProcessing = processingCount > 0;
        
        // Only include non-certified tutors
        if (writtenPassed && speakingPassed) continue;
        
        let status: 'pending_written' | 'pending_speaking' | 'processing';
        if (!writtenPassed) {
          status = 'pending_written';
        } else if (isProcessing) {
          status = 'processing';
        } else {
          status = 'pending_speaking';
        }

        pendingTutors.push({
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          registeredAt: u.createdAt || new Date().toISOString(),
          status,
          writtenExamPassed: writtenPassed,
          speakingExamPassed: speakingPassed,
          interviewResult: interviewResult || null,
          interviewDate: interviewDate || null
        });
        
        if (pendingTutors.length >= limit) break;
      }

      return pendingTutors;
    } finally {
      await session.close();
    }
  }

  /**
   * Get pending profile reviews (tutors who submitted their profile for admin review)
   */
  async getPendingProfileReviews(limit: number = 20): Promise<PendingProfileReview[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (u:User)
        WHERE u.profileStatus = 'pending_review'
        RETURN u
        ORDER BY u.profileSubmittedAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(limit) });

      return result.records.map(record => {
        const u = record.get('u').properties;
        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          profilePicture: u.profilePicture || undefined,
          bio: u.bio || undefined,
          videoIntroUrl: u.videoIntroUrl || undefined,
          schoolAttended: u.schoolAttended || undefined,
          major: u.major || undefined,
          interests: u.interests ? JSON.parse(u.interests) : [],
          submittedAt: u.profileSubmittedAt || u.createdAt || new Date().toISOString(),
          profileStatus: 'pending_review' as const
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Approve or reject a tutor profile
   */
  async reviewTutorProfile(tutorId: string, action: 'approve' | 'reject', reason?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const result = await session.run(`
        MATCH (u:User { id: $tutorId })
        SET u.profileStatus = $newStatus,
            u.profileReviewedAt = datetime(),
            u.profileRejectionReason = $reason
        RETURN u.firstName as firstName, u.lastName as lastName
      `, { 
        tutorId, 
        newStatus, 
        reason: action === 'reject' ? reason : null 
      });
      
      // Send notification to the tutor
      const notificationService = new NotificationService();
      const io = getIO();
      
      const record = result.records[0];
      const tutorName = record ? `${record.get('firstName') || ''} ${record.get('lastName') || ''}`.trim() : 'Your';
      
      const notification = await notificationService.createNotification({
        userId: tutorId,
        userType: 'tutor',
        type: action === 'approve' ? 'profile_approved' : 'profile_rejected',
        title: action === 'approve' ? 'Profile Approved! 🎉' : 'Profile Needs Revision',
        message: action === 'approve' 
          ? 'Congratulations! Your profile has been approved. Students can now find and book sessions with you.'
          : `Your profile was not approved. ${reason || 'Please review and update your information, then submit again.'}`,
        data: {
          link: '/profile'
        }
      });
      
      // Emit real-time notification via socket
      if (io) {
        io.to(`notifications:${tutorId}`).emit('notification:new', notification);
      }
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
      // Build search conditions
      const conditions: string[] = [];
      
      if (search) {
        conditions.push(`(toLower(u.firstName) CONTAINS toLower($search) OR toLower(u.lastName) CONTAINS toLower($search) OR toLower(u.email) CONTAINS toLower($search))`);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Get all tutors with exam results
      const result = await session.run(`
        MATCH (u:User)
        ${whereClause}
        OPTIONAL MATCH (u)-[:TAKES]->(we:Exam {type: 'written', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(se:Exam {type: 'speaking', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(sp:Exam {type: 'speaking', status: 'processing'})
        RETURN u,
               collect(DISTINCT we.result) as writtenResults,
               collect(DISTINCT se.result) as speakingResults,
               count(DISTINCT sp) as processingCount
        ORDER BY u.createdAt DESC
      `, { search });

      // Process all tutors and filter by status in JS
      const allTutors: TutorListItem[] = [];
      
      for (const record of result.records) {
        const u = record.get('u').properties;
        const writtenResults = record.get('writtenResults') || [];
        const speakingResults = record.get('speakingResults') || [];
        const processingCount = record.get('processingCount')?.toNumber?.() ?? record.get('processingCount') ?? 0;
        
        const writtenPassed = writtenResults.some((r: string) => examPassed(r));
        const speakingPassed = speakingResults.some((r: string) => examPassed(r));
        const isProcessing = processingCount > 0;

        let tutorStatus: 'pending' | 'certified' | 'processing' | 'failed';
        if (writtenPassed && speakingPassed) {
          tutorStatus = 'certified';
        } else if (isProcessing) {
          tutorStatus = 'processing';
        } else {
          tutorStatus = 'pending';
        }

        // Filter by status if specified
        if (status !== 'all' && status !== 'suspended' && tutorStatus !== status) continue;
        
        // Check suspension status
        const suspendedUntil = u.suspendedUntil ? new Date(u.suspendedUntil) : null;
        const isSuspended = suspendedUntil ? suspendedUntil > new Date() : false;
        
        // Filter by suspended if specified
        if (status === 'suspended' && !isSuspended) continue;

        allTutors.push({
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
          rating: u.rating || 0,
          isSuspended,
          suspendedUntil: u.suspendedUntil || undefined,
          suspendedReason: u.suspendedReason || undefined,
          suspendedAt: u.suspendedAt || undefined
        });
      }

      const total = allTutors.length;
      const tutors = allTutors.slice(skip, skip + limit);

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
    status?: 'all' | 'active' | 'inactive' | 'suspended';
    search?: string;
  }): Promise<{ students: StudentListItem[]; total: number }> {
    const driver = getDriver();
    const session = driver.session();
    const { page = 1, limit = 20, status = 'all', search = '' } = params;
    const skip = (page - 1) * limit;

    try {
      // Students have their own Student label
      const conditions: string[] = [];
      
      if (search) {
        conditions.push(`(toLower(s.givenName) CONTAINS toLower($search) OR toLower(s.familyName) CONTAINS toLower($search) OR toLower(s.email) CONTAINS toLower($search))`);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Get students (no pagination first to filter)
      const result = await session.run(`
        MATCH (s:Student)
        ${whereClause}
        RETURN s
        ORDER BY s.createdAt DESC
      `, { search });

      const allStudents: StudentListItem[] = [];
      
      for (const record of result.records) {
        const s = record.get('s').properties;
        
        // Calculate if active (active in last 7 days)
        const lastActive = s.lastActive ? new Date(s.lastActive) : new Date(s.createdAt);
        const daysSinceActive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        const isActive = daysSinceActive <= 7;
        
        // Check suspension status
        const suspendedUntil = s.suspendedUntil ? new Date(s.suspendedUntil) : null;
        const isSuspended = suspendedUntil ? suspendedUntil > new Date() : false;
        
        // Filter by status
        if (status === 'suspended' && !isSuspended) continue;
        if (status === 'active' && (!isActive || isSuspended)) continue;
        if (status === 'inactive' && (isActive || isSuspended)) continue;

        allStudents.push({
          id: s.id,
          name: `${s.givenName || ''} ${s.familyName || ''}`.trim(),
          email: s.email,
          joinedAt: s.createdAt || new Date().toISOString(),
          totalSessions: s.totalSessions || 0,
          totalSpent: s.totalSpent || 0,
          status: isActive ? 'active' : 'inactive',
          lastActive: s.lastActive || s.createdAt || new Date().toISOString(),
          isSuspended,
          suspendedUntil: s.suspendedUntil || undefined,
          suspendedReason: s.suspendedReason || undefined,
          suspendedAt: s.suspendedAt || undefined
        });
      }

      const total = allStudents.length;
      const students = allStudents.slice(skip, skip + limit);

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
      // Get recent tutor registrations - User nodes are tutors
      // Use registeredAt field which is stored as timestamp()
      const tutorResult = await session.run(`
        MATCH (u:User)
        WHERE u.registeredAt IS NOT NULL
        RETURN u.id as id, u.firstName as firstName, u.lastName as lastName, u.registeredAt as timestamp, 'tutor_registered' as type
        ORDER BY u.registeredAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(Math.ceil(limit / 2)) });

      // Get recent student registrations - Students have their own label
      // Use signUpdate as a fallback since students don't have createdAt
      const studentResult = await session.run(`
        MATCH (s:Student)
        RETURN s.id as id, s.givenName as firstName, s.familyName as lastName, s.signUpdate as timestamp, 'student_joined' as type
        ORDER BY s.signUpdate DESC
        LIMIT $limit
      `, { limit: neo4j.int(Math.ceil(limit / 2)) });

      const activities: RecentActivity[] = [];

      // Process tutor registrations
      tutorResult.records.forEach(record => {
        const firstName = record.get('firstName') || '';
        const lastName = record.get('lastName') || '';
        const rawTimestamp = record.get('timestamp');
        
        // Handle Neo4j Integer timestamp (milliseconds since epoch)
        let timestamp: string;
        if (rawTimestamp && typeof rawTimestamp === 'object' && 'toNumber' in rawTimestamp) {
          timestamp = new Date(rawTimestamp.toNumber()).toISOString();
        } else if (rawTimestamp && typeof rawTimestamp === 'number') {
          timestamp = new Date(rawTimestamp).toISOString();
        } else if (rawTimestamp && typeof rawTimestamp === 'string') {
          timestamp = rawTimestamp;
        } else {
          timestamp = new Date().toISOString();
        }
        
        activities.push({
          id: record.get('id'),
          type: 'tutor_registered',
          message: `New tutor registered: ${firstName} ${lastName}`.trim(),
          timestamp,
          userId: record.get('id')
        });
      });

      // Process student registrations
      studentResult.records.forEach(record => {
        const firstName = record.get('firstName') || '';
        const lastName = record.get('lastName') || '';
        const rawTimestamp = record.get('timestamp');
        
        // Handle signUpdate (stored as Date.now() milliseconds)
        let timestamp: string;
        if (rawTimestamp && typeof rawTimestamp === 'object' && 'toNumber' in rawTimestamp) {
          timestamp = new Date(rawTimestamp.toNumber()).toISOString();
        } else if (rawTimestamp && typeof rawTimestamp === 'number') {
          timestamp = new Date(rawTimestamp).toISOString();
        } else if (rawTimestamp && typeof rawTimestamp === 'string') {
          timestamp = rawTimestamp;
        } else {
          timestamp = new Date().toISOString();
        }
        
        activities.push({
          id: record.get('id'),
          type: 'student_joined',
          message: `New student: ${firstName} ${lastName}`.trim(),
          timestamp,
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

  /**
   * Login admin user
   */
  async login(params: AdminLoginParams): Promise<AdminUser> {
    const { username, password } = params;
    const driver = getDriver();
    const session = driver.session();

    try {
      // Find admin user by username
      const result = await session.run(`
        MATCH (a:Admin {username: $username})
        RETURN a
      `, { username: username.toLowerCase() });

      if (result.records.length === 0) {
        throw new Error('Invalid username or password');
      }

      const record = result.records[0];
      if (!record) {
        throw new Error('Invalid username or password');
      }

      const admin = record.get('a').properties;

      // Verify password
      const isValidPassword = await compare(password, admin.password);
      if (!isValidPassword) {
        throw new Error('Invalid username or password');
      }

      return {
        id: admin.id,
        username: admin.username,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role || 'admin',
        createdAt: admin.createdAt,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get admin by ID
   */
  async getById(adminId: string): Promise<AdminUser | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (a:Admin {id: $adminId})
        RETURN a
      `, { adminId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const admin = record.get('a').properties;

      return {
        id: admin.id,
        username: admin.username,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role || 'admin',
        createdAt: admin.createdAt,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create an admin user (for initial setup)
   */
  async createAdmin(
    username: string, 
    password: string, 
    firstName?: string, 
    lastName?: string, 
    role: 'admin' | 'superadmin' = 'admin'
  ): Promise<AdminUser> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Check if admin already exists
      const existing = await session.run(`
        MATCH (a:Admin {username: $username})
        RETURN a
      `, { username: username.toLowerCase() });

      if (existing.records.length > 0) {
        throw new Error('Admin with this username already exists');
      }

      // Hash password
      const hashedPassword = await hash(password, 12);
      const adminId = `ADMIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // Create admin
      const result = await session.run(`
        CREATE (a:Admin {
          id: $id,
          username: $username,
          password: $password,
          firstName: $firstName,
          lastName: $lastName,
          role: $role,
          createdAt: $createdAt
        })
        RETURN a
      `, {
        id: adminId,
        username: username.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role,
        createdAt: now,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create admin');
      }

      const admin = record.get('a').properties;

      return {
        id: admin.id,
        username: admin.username,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        createdAt: admin.createdAt,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * List all admin users
   */
  async listAdmins(): Promise<AdminUser[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (a:Admin)
        RETURN a
        ORDER BY a.createdAt DESC
      `);

      return result.records.map(record => {
        const admin = record.get('a').properties;
        return {
          id: admin.id,
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role || 'admin',
          createdAt: admin.createdAt,
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Delete an admin by ID
   */
  async deleteAdmin(adminId: string): Promise<boolean> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (a:Admin {id: $adminId})
        DELETE a
        RETURN count(a) as deleted
      `, { adminId });

      const deleted = result.records[0]?.get('deleted');
      return deleted?.toNumber?.() > 0 || deleted > 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Update admin profile
   */
  async updateAdmin(
    adminId: string,
    updates: { firstName?: string; lastName?: string; role?: 'admin' | 'superadmin' }
  ): Promise<AdminUser | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const setClauses: string[] = [];
      const params: Record<string, unknown> = { adminId };

      if (updates.firstName !== undefined) {
        setClauses.push('a.firstName = $firstName');
        params.firstName = updates.firstName;
      }
      if (updates.lastName !== undefined) {
        setClauses.push('a.lastName = $lastName');
        params.lastName = updates.lastName;
      }
      if (updates.role !== undefined) {
        setClauses.push('a.role = $role');
        params.role = updates.role;
      }

      if (setClauses.length === 0) {
        return this.getById(adminId);
      }

      const result = await session.run(`
        MATCH (a:Admin {id: $adminId})
        SET ${setClauses.join(', ')}
        RETURN a
      `, params);

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const admin = record.get('a').properties;
      return {
        id: admin.id,
        username: admin.username,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role || 'admin',
        createdAt: admin.createdAt,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Change admin password
   */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get current admin with password
      const result = await session.run(`
        MATCH (a:Admin {id: $adminId})
        RETURN a
      `, { adminId });

      if (result.records.length === 0) {
        return { success: false, error: 'Admin not found' };
      }

      const record = result.records[0];
      if (!record) {
        return { success: false, error: 'Admin not found' };
      }

      const admin = record.get('a').properties;
      
      // Verify current password
      const isValid = await compare(currentPassword, admin.password);
      if (!isValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = await hash(newPassword, 12);

      // Update password
      await session.run(`
        MATCH (a:Admin {id: $adminId})
        SET a.password = $password
      `, { adminId, password: hashedPassword });

      return { success: true };
    } finally {
      await session.close();
    }
  }

  /**
   * Suspend a tutor
   */
  async suspendTutor(tutorId: string, reason: string, until: Date): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Update user suspension status and create history record
      await session.run(`
        MATCH (u:User {id: $tutorId})
        SET u.suspendedUntil = $until,
            u.suspendedReason = $reason,
            u.suspendedAt = datetime()
        CREATE (sh:SuspensionHistory {
          id: randomUUID(),
          action: 'suspended',
          reason: $reason,
          until: $until,
          createdAt: datetime(),
          targetType: 'tutor'
        })
        CREATE (u)-[:HAS_SUSPENSION_HISTORY]->(sh)
      `, {
        tutorId,
        until: until.toISOString(),
        reason
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Unsuspend a tutor
   */
  async unsuspendTutor(tutorId: string, adminId?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Remove suspension and create history record
      const logId = crypto.randomUUID();
      await session.run(`
        MATCH (u:User {id: $tutorId})
        CREATE (log:SuspensionLog {
          id: $logId,
          action: 'unsuspended',
          reason: 'Manually unsuspended by admin',
          previousSuspendedUntil: u.suspendedUntil,
          previousReason: u.suspendedReason,
          createdAt: datetime(),
          targetType: 'tutor'
        })
        CREATE (u)-[:HAS_SUSPENSION]->(log)
        ${adminId ? 'WITH u, log MATCH (a:Admin {id: $adminId}) CREATE (log)-[:UNSUSPENDED_BY]->(a)' : ''}
        WITH u
        REMOVE u.suspendedUntil, u.suspendedReason, u.suspendedAt
      `, { tutorId, logId, adminId });
    } finally {
      await session.close();
    }
  }

  /**
   * Suspend a student
   */
  async suspendStudent(studentId: string, reason: string, until: Date, adminId?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Update student suspension status and create history record
      const logId = crypto.randomUUID();
      await session.run(`
        MATCH (s:Student {id: $studentId})
        SET s.suspendedUntil = $until,
            s.suspendedReason = $reason,
            s.suspendedAt = datetime()
        CREATE (log:SuspensionLog {
          id: $logId,
          action: 'suspended',
          reason: $reason,
          until: $until,
          createdAt: datetime(),
          targetType: 'student'
        })
        CREATE (s)-[:HAS_SUSPENSION]->(log)
        ${adminId ? 'WITH log MATCH (a:Admin {id: $adminId}) CREATE (log)-[:SUSPENDED_BY]->(a)' : ''}
      `, {
        studentId,
        until: until.toISOString(),
        reason,
        logId,
        adminId
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Unsuspend a student
   */
  async unsuspendStudent(studentId: string, adminId?: string): Promise<void> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Remove suspension and create history record
      const logId = crypto.randomUUID();
      await session.run(`
        MATCH (s:Student {id: $studentId})
        CREATE (log:SuspensionLog {
          id: $logId,
          action: 'unsuspended',
          reason: 'Manually unsuspended by admin',
          previousSuspendedUntil: s.suspendedUntil,
          previousReason: s.suspendedReason,
          createdAt: datetime(),
          targetType: 'student'
        })
        CREATE (s)-[:HAS_SUSPENSION]->(log)
        ${adminId ? 'WITH s, log MATCH (a:Admin {id: $adminId}) CREATE (log)-[:UNSUSPENDED_BY]->(a)' : ''}
        WITH s
        REMOVE s.suspendedUntil, s.suspendedReason, s.suspendedAt
      `, { studentId, logId, adminId });
    } finally {
      await session.close();
    }
  }

  /**
   * Get suspension history for a user
   */
  async getSuspensionHistory(userId: string, userType: 'tutor' | 'student'): Promise<SuspensionHistoryItem[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const label = userType === 'tutor' ? 'User' : 'Student';
      const result = await session.run(`
        MATCH (u:${label} {id: $userId})-[:HAS_SUSPENSION_HISTORY]->(sh:SuspensionHistory)
        RETURN sh
        ORDER BY sh.createdAt DESC
      `, { userId });

      return result.records.map(record => {
        const sh = record.get('sh').properties;
        return {
          id: sh.id,
          action: sh.action,
          reason: sh.reason,
          until: sh.until,
          previousReason: sh.previousReason,
          previousSuspendedUntil: sh.previousSuspendedUntil,
          createdAt: sh.createdAt
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(period: string = 'week'): Promise<AnalyticsData> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Calculate date range based on period
      const now = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get tutor registration trend
      const tutorTrendResult = await session.run(`
        MATCH (u:User)
        WHERE u.createdAt >= $startDate
        RETURN date(u.createdAt) as day, count(u) as count
        ORDER BY day
      `, { startDate: startDate.toISOString() });

      const tutorTrend = tutorTrendResult.records.map(r => ({
        date: r.get('day')?.toString() || '',
        count: toNumber(r.get('count'))
      }));

      // Get student registration trend
      const studentTrendResult = await session.run(`
        MATCH (s:Student)
        WHERE s.createdAt >= $startDate
        RETURN date(s.createdAt) as day, count(s) as count
        ORDER BY day
      `, { startDate: startDate.toISOString() });

      const studentTrend = studentTrendResult.records.map(r => ({
        date: r.get('day')?.toString() || '',
        count: toNumber(r.get('count'))
      }));

      // Get exam pass rates
      const examResult = await session.run(`
        MATCH (e:Exam)
        WHERE e.createdAt >= $startDate AND e.status = 'completed'
        RETURN e.type as examType,
               count(e) as total,
               sum(CASE WHEN e.result CONTAINS '"passed":true' THEN 1 ELSE 0 END) as passed
      `, { startDate: startDate.toISOString() });

      const examStats = examResult.records.map(r => ({
        type: r.get('examType') || 'unknown',
        total: toNumber(r.get('total')),
        passed: toNumber(r.get('passed'))
      }));

      // Get suspension counts
      const suspensionResult = await session.run(`
        MATCH (log:SuspensionLog)
        WHERE log.createdAt >= datetime($startDate)
        RETURN log.action as action, log.targetType as targetType, count(log) as count
      `, { startDate: startDate.toISOString() });

      const suspensionStats = suspensionResult.records.map(r => ({
        action: r.get('action') || '',
        targetType: r.get('targetType') || '',
        count: toNumber(r.get('count'))
      }));

      // Get current counts
      const countsResult = await session.run(`
        OPTIONAL MATCH (u:User)
        WITH count(u) as tutorCount
        OPTIONAL MATCH (s:Student)
        WITH tutorCount, count(s) as studentCount
        OPTIONAL MATCH (u2:User) WHERE u2.suspendedUntil IS NOT NULL AND u2.suspendedUntil > datetime()
        WITH tutorCount, studentCount, count(u2) as suspendedTutors
        OPTIONAL MATCH (s2:Student) WHERE s2.suspendedUntil IS NOT NULL AND s2.suspendedUntil > datetime()
        RETURN tutorCount, studentCount, suspendedTutors, count(s2) as suspendedStudents
      `);

      const counts = countsResult.records[0];
      const totalTutors = counts ? toNumber(counts.get('tutorCount')) : 0;
      const totalStudents = counts ? toNumber(counts.get('studentCount')) : 0;
      const suspendedTutors = counts ? toNumber(counts.get('suspendedTutors')) : 0;
      const suspendedStudents = counts ? toNumber(counts.get('suspendedStudents')) : 0;

      return {
        period,
        tutorTrend,
        studentTrend,
        examStats,
        suspensionStats,
        summary: {
          totalTutors,
          totalStudents,
          suspendedTutors,
          suspendedStudents,
          newTutors: tutorTrend.reduce((sum, t) => sum + t.count, 0),
          newStudents: studentTrend.reduce((sum, s) => sum + s.count, 0)
        }
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get suspension analytics
   */
  async getSuspensionAnalytics(): Promise<SuspensionAnalytics> {
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get all suspension logs with details
      const result = await session.run(`
        MATCH (log:SuspensionLog)
        OPTIONAL MATCH (log)-[:SUSPENDED_BY]->(admin:Admin)
        RETURN log, admin.username as adminName
        ORDER BY log.createdAt DESC
        LIMIT 100
      `);

      const logs = result.records.map(r => {
        const log = r.get('log').properties;
        return {
          id: log.id,
          action: log.action,
          reason: log.reason,
          targetType: log.targetType,
          createdAt: log.createdAt?.toString() || '',
          adminName: r.get('adminName') || null
        };
      });

      // Get reason distribution
      const reasonResult = await session.run(`
        MATCH (log:SuspensionLog)
        WHERE log.action = 'suspended'
        RETURN log.reason as reason, count(log) as count
        ORDER BY count DESC
        LIMIT 10
      `);

      const reasonDistribution = reasonResult.records.map(r => ({
        reason: r.get('reason') || 'Unknown',
        count: toNumber(r.get('count'))
      }));

      // Get monthly trend
      const monthlyResult = await session.run(`
        MATCH (log:SuspensionLog)
        WHERE log.createdAt >= datetime() - duration('P6M')
        RETURN date(log.createdAt).month as month, date(log.createdAt).year as year,
               log.action as action, count(log) as count
        ORDER BY year, month
      `);

      const monthlyTrend = monthlyResult.records.map(r => ({
        month: toNumber(r.get('month')),
        year: toNumber(r.get('year')),
        action: r.get('action') || '',
        count: toNumber(r.get('count'))
      }));

      return {
        recentLogs: logs,
        reasonDistribution,
        monthlyTrend
      };
    } finally {
      await session.close();
    }
  }
}

interface AnalyticsData {
  period: string;
  tutorTrend: { date: string; count: number }[];
  studentTrend: { date: string; count: number }[];
  examStats: { type: string; total: number; passed: number }[];
  suspensionStats: { action: string; targetType: string; count: number }[];
  summary: {
    totalTutors: number;
    totalStudents: number;
    suspendedTutors: number;
    suspendedStudents: number;
    newTutors: number;
    newStudents: number;
  };
}

interface SuspensionAnalytics {
  recentLogs: {
    id: string;
    action: string;
    reason: string;
    targetType: string;
    createdAt: string;
    adminName: string | null;
  }[];
  reasonDistribution: { reason: string; count: number }[];
  monthlyTrend: { month: number; year: number; action: string; count: number }[];
}

import { getDriver } from '../../db/memgraph';
import neo4j from 'neo4j-driver';
import { hash, compare } from 'bcrypt-ts';
import type { 
  DashboardStats, 
  ExamStats, 
  PendingTutor, 
  TutorListItem,
  StudentListItem,
  RecentActivity,
  AdminUser,
  AdminLoginParams
} from './admin.interface';

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
      // Get all tutors with their exam results to determine certification status
      const result = await session.run(`
        MATCH (u:User)
        OPTIONAL MATCH (u)-[:TAKES]->(we:Exam {type: 'written', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(se:Exam {type: 'speaking', status: 'completed'})
        OPTIONAL MATCH (u)-[:TAKES]->(sp:Exam {type: 'speaking', status: 'processing'})
        RETURN u,
               collect(DISTINCT we.result) as writtenResults,
               collect(DISTINCT se.result) as speakingResults,
               count(DISTINCT sp) as processingCount
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(limit * 2) }); // Get more to filter

      const pendingTutors: PendingTutor[] = [];
      
      for (const record of result.records) {
        const u = record.get('u').properties;
        const writtenResults = record.get('writtenResults') || [];
        const speakingResults = record.get('speakingResults') || [];
        const processingCount = record.get('processingCount')?.toNumber?.() ?? record.get('processingCount') ?? 0;
        
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
          speakingExamPassed: speakingPassed
        });
        
        if (pendingTutors.length >= limit) break;
      }

      return pendingTutors;
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
        if (status !== 'all' && tutorStatus !== status) continue;

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
          rating: u.rating || 0
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
    status?: 'all' | 'active' | 'inactive';
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

      // Get total count
      const countResult = await session.run(`
        MATCH (s:Student)
        ${whereClause}
        RETURN count(s) as total
      `, { search });
      const total = countResult.records[0]?.get('total')?.toNumber?.() ?? 
                   countResult.records[0]?.get('total') ?? 0;

      // Get students
      const result = await session.run(`
        MATCH (s:Student)
        ${whereClause}
        RETURN s
        ORDER BY s.createdAt DESC
        SKIP $skip
        LIMIT $limit
      `, { search, skip: neo4j.int(skip), limit: neo4j.int(limit) });

      const students: StudentListItem[] = result.records.map(record => {
        const s = record.get('s').properties;
        
        // Calculate if active (active in last 7 days)
        const lastActive = s.lastActive ? new Date(s.lastActive) : new Date(s.createdAt);
        const daysSinceActive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        const isActive = daysSinceActive <= 7;

        return {
          id: s.id,
          name: `${s.givenName || ''} ${s.familyName || ''}`.trim(),
          email: s.email,
          joinedAt: s.createdAt || new Date().toISOString(),
          totalSessions: s.totalSessions || 0,
          totalSpent: s.totalSpent || 0,
          status: isActive ? 'active' : 'inactive',
          lastActive: s.lastActive || s.createdAt || new Date().toISOString()
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
      // Get recent tutor registrations - User nodes are tutors
      const tutorResult = await session.run(`
        MATCH (u:User)
        RETURN u.id as id, u.firstName as firstName, u.lastName as lastName, u.createdAt as timestamp, 'tutor_registered' as type
        ORDER BY u.createdAt DESC
        LIMIT $limit
      `, { limit: neo4j.int(Math.ceil(limit / 2)) });

      // Get recent student registrations - Students have their own label
      const studentResult = await session.run(`
        MATCH (s:Student)
        RETURN s.id as id, s.givenName as firstName, s.familyName as lastName, s.createdAt as timestamp, 'student_joined' as type
        ORDER BY s.createdAt DESC
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
}

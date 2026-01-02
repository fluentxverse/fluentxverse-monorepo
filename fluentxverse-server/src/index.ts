import Elysia from "elysia";
import { createServer } from "http";
import { swagger } from "@elysiajs/swagger";

import Auth from './routes/auth.route';
import Tutor from './routes/tutor.route';
import Schedule from './routes/schedule.route';
import Examination from "./routes/exam.route";
import Admin from './routes/admin.route';
import Interview from './routes/interview.route';
import Notification from './routes/notification.route';
import Inbox from './routes/inbox.route';
import Ticket from './routes/ticket.route';
import Lesson from './routes/lesson.route';
import { categoryRoute } from './routes/category.route';
import { mediaRoute } from './routes/media.route';
import { analyticsRoute } from './routes/analytics.route';
import { initDriver, getDriver } from './db/memgraph';
import { db } from './db/postgres';
import { initSocketServer } from './socket/socket.server';
import { startReminderService } from './services/notification.services/reminder.service';
import { NotificationService } from './services/notification.services/notification.service';
import { startSuspensionJob } from './services/admin.services/suspension.job';
import { initRedis, logRetentionCleanup, isRedisConnected } from './db/redis';
import cors from '@elysiajs/cors';
import cookie from '@elysiajs/cookie';
import Student from "./routes/student.route";
import Debug from './routes/debug.route';
import { logger, generateRequestId } from './utils/logger';

// Initialize databases (async)
const isProduction = process.env.NODE_ENV === 'production';

const initDatabases = async () => {
  // SECURITY: Require database credentials in production
  if (isProduction) {
    if (!process.env.MEMGRAPH_URI || !process.env.MEMGRAPH_PASSWORD) {
      console.error('❌ SECURITY: MEMGRAPH_URI and MEMGRAPH_PASSWORD required in production');
      process.exit(1);
    }
  }
  
  try {
    await initDriver(
      process.env.MEMGRAPH_URI || 'bolt://localhost:7687',
      process.env.MEMGRAPH_USER || 'fluentxverse',
      process.env.MEMGRAPH_PASSWORD || 'devpassword123!ChangeMe'
    );
  } catch (err) {
    console.error('❌ Failed to connect to Memgraph:', err);
    // Don't exit - some features can work without Memgraph
  }
};

// Start database initialization (will complete before suspension job runs)
const dbInitPromise = initDatabases();

// Initialize Redis cache
initRedis().catch(err => console.warn('Redis initialization skipped:', err));

// Bun SQL is auto-initialized on import (no need to call getPool)

// Build allowed origins from environment or use defaults for development
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  // Production domains
];

const envOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(o => o.trim())
  .filter(o => o.length > 0);

const allowedOrigins = envOrigins.length > 0 ? [...new Set([...envOrigins, ...defaultOrigins])] : defaultOrigins;

console.log('🌐 CORS allowed origins:', allowedOrigins);

// Initialize Elysia app
const app = new Elysia({ serve: {idleTimeout: 255 }}) 
  .use(swagger({
    documentation: {
      info: {
        title: 'FluentXVerse API',
        version: '1.0.0',
        description: 'API documentation for FluentXVerse - Language learning platform connecting tutors and students',
        contact: {
          name: 'FluentXVerse Team',
          url: 'https://fluentxverse.xyz'
        }
      },
      tags: [
        { name: 'Auth', description: 'Tutor authentication endpoints' },
        { name: 'Student', description: 'Student authentication and profile endpoints' },
        { name: 'Tutor', description: 'Tutor profile and management endpoints' },
        { name: 'Schedule', description: 'Booking and scheduling endpoints' },
        { name: 'Lesson', description: 'Lesson content and materials endpoints' },
        { name: 'Exam', description: 'Speaking examination endpoints' },
        { name: 'Interview', description: 'Tutor interview scheduling endpoints' },
        { name: 'Notification', description: 'User notification endpoints' },
        { name: 'Inbox', description: 'System messages and announcements' },
        { name: 'Ticket', description: 'NFT ticket management endpoints' },
        { name: 'Admin', description: 'Admin dashboard endpoints' },
        { name: 'Category', description: 'Lesson category management' },
        { name: 'Media', description: 'Media file management' },
        { name: 'Analytics', description: 'Platform analytics endpoints' }
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'tutorAuth',
            description: 'JWT token stored in httpOnly cookie'
          }
        }
      }
    },
    path: '/docs',
    exclude: ['/docs', '/docs/json', '/health'],
  }))
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      // In production, require an origin header for security
      // In development, allow requests with no origin (like curl) for testing
      if (!origin) {
        if (isProduction) {
          console.warn('⚠️ CORS blocked request with no origin (production mode)');
          return false;
        }
        return true; // Allow in development only
      }
      if (allowedOrigins.includes(origin)) return true;
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return false;
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }))
  .use(cookie())
  // Request logging middleware
  .onRequest(({ request, set }) => {
    const requestId = generateRequestId();
    (request as any).requestId = requestId;
    (request as any).startTime = Date.now();
    set.headers['X-Request-ID'] = requestId;
  })
  .onAfterHandle(({ request, set }) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    const path = new URL(request.url).pathname;
    
    // Skip logging for health checks and static assets
    if (path === '/health' || path.startsWith('/docs')) return;
    
    logger.response({
      method: request.method,
      path,
      statusCode: 200,
      duration,
      requestId: (request as any).requestId,
    });
  })
  .onError(({ request, error, set }) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    const path = new URL(request.url).pathname;
    
    logger.error('Request failed', error, {
      method: request.method,
      path,
      duration,
      requestId: (request as any).requestId,
      statusCode: (set as any).status || 500,
    });
  })
  // Security headers middleware
  .onAfterHandle(({ set }) => {
    // Prevent clickjacking attacks
    set.headers['X-Frame-Options'] = 'DENY';
    // Prevent MIME type sniffing
    set.headers['X-Content-Type-Options'] = 'nosniff';
    // Enable XSS filter in browsers
    set.headers['X-XSS-Protection'] = '1; mode=block';
    // Referrer policy for privacy
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    // Permissions policy - restrict sensitive features
    set.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';
    // Content Security Policy (adjust as needed for your app)
    if (isProduction) {
      set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
  })
  .use(Auth)
  .use(Tutor)
  .use(Schedule)
  .use(Student)
  .use(Debug)
  .use(Examination)
  .use(Admin)
  .use(Interview)
  .use(Notification)
  .use(Inbox)
  .use(Ticket)
  .use(Lesson)
  .use(categoryRoute)
  .use(mediaRoute)
  .use(analyticsRoute)
  // Simple health check for load balancers
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  // Detailed health check with dependency status
  .get('/health/detailed', async () => {
    const checks: Record<string, { status: 'ok' | 'degraded' | 'down'; latency?: number; error?: string }> = {};
    
    // Check PostgreSQL
    const pgStart = Date.now();
    try {
      await db`SELECT 1`;
      checks.postgres = { status: 'ok', latency: Date.now() - pgStart };
    } catch (err: any) {
      checks.postgres = { status: 'down', error: err.message };
    }
    
    // Check Memgraph
    const mgStart = Date.now();
    try {
      const driver = getDriver();
      const session = driver.session();
      await session.run('RETURN 1');
      await session.close();
      checks.memgraph = { status: 'ok', latency: Date.now() - mgStart };
    } catch (err: any) {
      checks.memgraph = { status: 'down', error: err.message };
    }
    
    // Check Redis
    checks.redis = {
      status: isRedisConnected() ? 'ok' : 'degraded',
      latency: 0
    };
    
    // Determine overall status
    const allOk = Object.values(checks).every(c => c.status === 'ok');
    const anyDown = Object.values(checks).some(c => c.status === 'down');
    
    return {
      status: allOk ? 'ok' : anyDown ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      checks
    };
  })


// Start HTTP server - listen on all interfaces for LAN access
.listen({ hostname: '0.0.0.0', port: 8765 }, () => {
  console.log(`✅ FluentXVerse HTTP server is running on port 8765`);
});


export type App = typeof app;

// Initialize Socket.IO server with the HTTP server
// @ts-ignore - Elysia's server has an underlying HTTP server
const httpServer = createServer();
const io = initSocketServer(httpServer);

// Attach Socket.IO to run alongside Elysia - listen on all interfaces for LAN access
httpServer.listen(8767, '0.0.0.0', async () => {
  console.log(`✅ Socket.IO server is running on port 8767`);
  
  // Wait for database initialization to complete before starting background jobs
  await dbInitPromise;
  
  // Start the session reminder service after socket is ready
  startReminderService();
  
  // Start the auto-unsuspend background job (now Memgraph is ready)
  startSuspensionJob();

  // Start daily notification retention cleanup (delete read > N days)
  const notificationService = new NotificationService();
  const daysToKeep = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '30', 10);
  console.log(`🧹 Notification retention enabled: keeping ${daysToKeep} days`);
  // Run once a day
  setInterval(async () => {
    try {
      const deleted = await notificationService.deleteOldNotifications(daysToKeep);
      if (deleted > 0) {
        console.log(`🧹 Deleted ${deleted} old notifications (> ${daysToKeep} days)`);
        await logRetentionCleanup(deleted);
      }
    } catch (err) {
      console.error('Error running notification retention cleanup:', err);
    }
  }, 24 * 60 * 60 * 1000);
  // Also run once on startup
  (async () => {
    try {
      const deleted = await notificationService.deleteOldNotifications(daysToKeep);
      if (deleted > 0) {
        console.log(`🧹 Startup cleanup deleted ${deleted} old notifications`);
        await logRetentionCleanup(deleted);
      }
    } catch {}
  })();
});


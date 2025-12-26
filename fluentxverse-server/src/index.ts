import Elysia from "elysia";
import { createServer } from "http";

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
import { initDriver } from './db/memgraph';
import { db } from './db/postgres';
import { initSocketServer } from './socket/socket.server';
import { startReminderService } from './services/notification.services/reminder.service';
import { NotificationService } from './services/notification.services/notification.service';
import { startSuspensionJob } from './services/admin.services/suspension.job';
import { initRedis, logRetentionCleanup } from './db/redis';
import cors from '@elysiajs/cors';
import cookie from '@elysiajs/cookie';
import Student from "./routes/student.route";
import Debug from './routes/debug.route';

// Initialize databases (async)
const initDatabases = async () => {
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
  'http://localhost:5178',
  // Production domains
  'https://student.fluentxverse.xyz',
  'https://tutor.fluentxverse.xyz',
  'https://dashboard.fluentxverse.xyz',
];

const envOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(o => o.trim())
  .filter(o => o.length > 0);

const allowedOrigins = envOrigins.length > 0 ? [...new Set([...envOrigins, ...defaultOrigins])] : defaultOrigins;

console.log('🌐 CORS allowed origins:', allowedOrigins);

// Initialize Elysia app
const app = new Elysia({ serve: {idleTimeout: 255 }}) 
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      if (!origin) return true; // Allow requests with no origin (like curl)
      if (allowedOrigins.includes(origin)) return true;
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return false;
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }))
  .use(cookie())
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
  // Health check endpoint for Docker/Podman
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))


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


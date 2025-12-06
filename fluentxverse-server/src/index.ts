import Elysia from "elysia";
import { createServer } from "http";

import Auth from './routes/auth.route';
import Tutor from './routes/tutor.route';
import Schedule from './routes/schedule.route';
import Examination from "./routes/exam.route";
import Admin from './routes/admin.route';
import { initDriver } from './db/memgraph';
import { getPool } from './db/postgres';
import { initSocketServer } from './socket/socket.server';
import cors from '@elysiajs/cors';
import cookie from '@elysiajs/cookie';
import Student from "./routes/student.route";
import Debug from './routes/debug.route';

// Initialize databases
initDriver(
  process.env.MEMGRAPH_URI || 'bolt://localhost:7687',
  process.env.MEMGRAPH_USER || 'fluentxverse',
  process.env.MEMGRAPH_PASSWORD || 'devpassword123!ChangeMe'
);

// Initialize PostgreSQL pool
getPool();

// Initialize Elysia app
const app = new Elysia({ serve: {idleTimeout: 255 }}) 
  .use(cors({
    // Allow common localhost variants for Vite dev servers + LAN access
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://192.168.0.102:5173',
      'http://192.168.0.102:5174',
      'http://192.168.0.102:5175',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  .use(cookie())
  .use(Auth)
  .use(Tutor)
  .use(Schedule)
  .use(Student)
  .use(Debug)
  .use(Examination)
  .use(Admin)



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
httpServer.listen(8767, '0.0.0.0', () => {
  console.log(`✅ Socket.IO server is running on port 8767`);
});


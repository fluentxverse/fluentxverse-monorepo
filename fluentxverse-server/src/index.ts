import Elysia from "elysia";
import { createServer } from "http";

import Auth from './routes/auth.route';
import Tutor from './routes/tutor.route';
import { initDriver } from './db/memgraph';
import { getPool } from './db/postgres';
import { initSocketServer } from './socket/socket.server';
import cors from '@elysiajs/cors';
import cookie from '@elysiajs/cookie';

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
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  }))
  .use(cookie())
  .use(Auth)
  .use(Tutor);

export type App = typeof app;

// Start HTTP server
const server = app.listen({ port: 8765 }, () => {
  console.log(`✅ FluentXVerse HTTP server is running on port 8765`);
});

// Initialize Socket.IO server with the HTTP server
// @ts-ignore - Elysia's server has an underlying HTTP server
const httpServer = createServer();
const io = initSocketServer(httpServer);

// Attach Socket.IO to run alongside Elysia
httpServer.listen(8766, () => {
  console.log(`✅ Socket.IO server is running on port 8766`);
});


import Elysia from "elysia";


import Auth from './routes/auth.route';
import { initDriver } from './db/memgraph';
import cors from '@elysiajs/cors';
import cookie from '@elysiajs/cookie';




// Initialize Elysia app
const app = new Elysia({ serve: {idleTimeout: 255 }}) 
  .use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
  }))
  .use(cookie())

  .use(Auth)
  initDriver(process.env.MEMGRAPH_URI || 'bolt://localhost:7687', process.env.MEMGRAPH_USER || 'fluentxverse', process.env.MEMGRAPH_PASSWORD || 'devpassword123!ChangeMe')


export type App = typeof app;


app.listen({ port: 8765 }, () => {
  console.log(`FluentXVerse HTTP server is running on 8765`);
});


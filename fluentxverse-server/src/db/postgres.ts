import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://fluentxverse_user:fluentxverse_pass@localhost:5432/fluentxverse',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      process.exit(-1);
    });

    console.log('✅ PostgreSQL connection pool initialized');
  }

  return pool;
};

export const query = async (text: string, params?: any[]) => {
  const pool = getPool();
  return pool.query(text, params);
};

export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool();
  return pool.connect();
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
};

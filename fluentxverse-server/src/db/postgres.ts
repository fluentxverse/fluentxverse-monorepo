import { SQL } from "bun";

// Create a single SQL instance using Bun's built-in postgres
const sql = new SQL({
  url: process.env.DATABASE_URL || 'postgresql://fluentxverse_user:fluentxverse_pass@localhost:5432/fluentxverse',
  max: 20,
  idleTimeout: 30,
  connectionTimeout: 2,
});

console.log('✅ Bun SQL (PostgreSQL) initialized');

/**
 * Execute a raw query with parameters (legacy compatibility)
 * For new code, use the sql tagged template directly
 */
export const query = async (text: string, params?: any[]) => {
  // Convert $1, $2, etc. placeholders to Bun SQL format
  // Bun SQL uses tagged templates, so we need to use sql.unsafe for dynamic queries
  const result = await sql.unsafe(text, params || []);
  return {
    rows: result,
    rowCount: result.length,
  };
};

/**
 * Get the SQL instance for tagged template queries
 * Usage: const users = await db`SELECT * FROM users WHERE id = ${userId}`;
 */
export const db = sql;

/**
 * Close the SQL connection pool
 */
export const closePool = async () => {
  await sql.close();
  console.log('Bun SQL connection pool closed');
};

// For backwards compatibility
export const getPool = () => {
  console.warn('getPool() is deprecated. Use db tagged template or query() instead.');
  return sql;
};

/**
 * Seed script to create the first super admin
 * Run with: bun run scripts/seed-admin.ts
 */

import { hash } from 'bcrypt-ts';
import { initDriver, getDriver, closeDriver } from '../src/db/memgraph';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || '';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || '';

async function seedAdmin() {
  console.log('🔧 Initializing database connection...');
  
  // Initialize Memgraph connection
  initDriver(
    process.env.MEMGRAPH_URI || '',
    process.env.MEMGRAPH_USER || '',
    process.env.MEMGRAPH_PASSWORD || ''
  );

  const driver = getDriver();
  const session = driver.session();

  try {
    // Check if admin already exists
    const existing = await session.run(`
      MATCH (a:Admin {username: $username})
      RETURN a
    `, { username: ADMIN_USERNAME.toLowerCase() });

    if (existing.records.length > 0) {
      console.log(`⚠️  Admin "${ADMIN_USERNAME}" already exists. Skipping...`);
      return;
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await hash(ADMIN_PASSWORD, 12);
    const adminId = `ADMIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Create admin
    console.log('📝 Creating super admin...');
    await session.run(`
      CREATE (a:Admin {
        id: $id,
        username: $username,
        password: $password,
        firstName: $firstName,
        lastName: $lastName,
        role: 'superadmin',
        createdAt: $createdAt
      })
      RETURN a
    `, {
      id: adminId,
      username: ADMIN_USERNAME.toLowerCase(),
      password: hashedPassword,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      createdAt: now,
    });

    console.log('✅ Super admin created successfully!');
    console.log('');
    console.log('📋 Admin Details:');
    console.log(`   Username: ${ADMIN_USERNAME}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role: superadmin`);
    console.log('');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
  }
}

seedAdmin();

import { Env } from '../src/types';

async function wipeDevDB() {
  // Ensure we're in development
  if (process.env.ENVIRONMENT !== 'development') {
    console.error('This script can only be run in development environment');
    process.exit(1);
  }

  try {
    // Get the development database binding
    const db = (globalThis as any).DB_DEV;
    if (!db) {
      console.error('DB_DEV is not available');
      process.exit(1);
    }

    console.log('Wiping development database...');

    // Delete all records from tables in the correct order (respecting foreign key constraints)
    await db.prepare('DELETE FROM verses').run();
    await db.prepare('DELETE FROM sessions').run();
    await db.prepare('DELETE FROM magic_links').run();
    await db.prepare('DELETE FROM users').run();

    console.log('Development database wiped successfully');
  } catch (error) {
    console.error('Error wiping development database:', error);
    process.exit(1);
  }
}

// Run the script
wipeDevDB(); 
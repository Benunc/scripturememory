import { Env } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

async function reinitDevDB() {
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

    console.log('Reinitializing development database...');

    // Read and execute the schema.sql file
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await db.prepare(statement).run();
    }

    console.log('Development database reinitialized successfully');
  } catch (error) {
    console.error('Error reinitializing development database:', error);
    process.exit(1);
  }
}

// Run the script
reinitDevDB(); 
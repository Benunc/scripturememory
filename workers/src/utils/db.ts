import { Env } from '../types';

export const getDB = (env: Env) => {
  // In production, use DB
  if (env.ENVIRONMENT === 'production') {
    if (!env.DB) {
      console.error('DB is not available in production environment');
      throw new Error('DB is not available in production environment');
    }
    return env.DB;
  }
  
  // In development, use DB
  if (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
    if (!env.DB) {
      console.error('DB is not available in development environment');
      throw new Error('DB is not available in development environment');
    }
    return env.DB;
  }
  
  console.error('No database binding available');
  throw new Error('No database binding available');
};

interface Session {
  user_id: number;
}

export const getUserId = async (token: string, env: Env): Promise<number | null> => {
  try {
    const db = getDB(env);
    const session = await db.prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
    ).bind(token, Date.now()).first() as Session | null;

    if (session) {
      // Extend session by 30 days from now
      const newExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      await db.prepare(
        'UPDATE sessions SET expires_at = ? WHERE token = ?'
      ).bind(newExpiry, token).run();
      
      return session.user_id;
    }

    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}; 
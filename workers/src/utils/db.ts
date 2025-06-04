import { Env } from '../types';

export const getDB = (env: Env) => env.DB;

interface Session {
  user_id: number;
}

export const getUserId = async (token: string, env: Env): Promise<number | null> => {
  try {
    const session = await getDB(env).prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
    ).bind(token, Date.now()).first() as Session | null;

    return session ? session.user_id : null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}; 
import { Env, Verse } from '../types';

// Helper to get the correct database binding
const getDB = (env: Env) => {
  return env.ENVIRONMENT === 'production' ? env.DB_PROD : env.DB_DEV;
};

// Helper to get user ID from session token
const getUserId = async (token: string, env: Env): Promise<number | null> => {
  const result = await getDB(env).prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first<{ user_id: number }>();
  return result?.user_id || null;
};

export const handleVerses = {
  // Get all verses for a user
  getVerses: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const verses = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(userId).all();

      return new Response(JSON.stringify(verses.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting verses:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Add a new verse
  addVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const verse = await request.json() as Verse;
      if (!verse.reference || !verse.text) {
        return new Response('Reference and text are required', { status: 400 });
      }

      // Check if verse already exists
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, verse.reference).first();

      if (existing) {
        return new Response('Verse already exists', { status: 409 });
      }

      // Insert new verse
      await getDB(env).prepare(
        'INSERT INTO verses (user_id, reference, text, translation, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, verse.reference, verse.text, verse.translation || 'NIV', Date.now()).run();

      return new Response('Verse added successfully', { status: 201 });
    } catch (error) {
      console.error('Error adding verse:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Update a verse
  updateVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response('Verse reference is required', { status: 400 });
      }

      const verse: Verse = await request.json();
      
      // Verify ownership
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE reference = ? AND user_id = ?'
      ).bind(reference, userId).first();

      if (!existing) {
        return new Response('Verse not found or unauthorized', { status: 404 });
      }

      // Only update fields that are provided
      const updates: string[] = [];
      const bindings: any[] = [];

      if (verse.text !== undefined) {
        updates.push('text = ?');
        bindings.push(verse.text);
      }

      if (verse.translation !== undefined) {
        updates.push('translation = ?');
        bindings.push(verse.translation);
      }

      if (verse.status !== undefined) {
        updates.push('status = ?');
        bindings.push(verse.status);
      }

      if (updates.length === 0) {
        return new Response('No updates provided', { status: 400 });
      }

      // Add reference and user_id to bindings
      bindings.push(reference, userId);

      await getDB(env).prepare(
        `UPDATE verses SET ${updates.join(', ')} WHERE reference = ? AND user_id = ?`
      ).bind(...bindings).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error updating verse:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Delete a verse
  deleteVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response('Verse reference is required', { status: 400 });
      }

      // Check if verse exists
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, reference).first();

      if (!existing) {
        return new Response('Verse not found', { status: 404 });
      }

      // Delete verse
      await getDB(env).prepare(
        'DELETE FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, reference).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error deleting verse:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}; 
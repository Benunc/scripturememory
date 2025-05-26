import { Env, Verse } from '../types';

// Helper to get the correct database binding
const getDB = (env: Env) => {
  return env.ENVIRONMENT === 'production' ? env.DB_PROD : env.DB_DEV;
};

// Helper to get user email from session token
const getUserEmail = async (token: string, env: Env): Promise<string | null> => {
  const result = await getDB(env).prepare(
    'SELECT email FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first<{ email: string }>();
  return result?.email || null;
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
      const email = await getUserEmail(token, env);
      
      if (!email) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const verses = await getDB(env).prepare(
        'SELECT * FROM verses WHERE email = ? ORDER BY created_at DESC'
      ).bind(email).all();

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
      const email = await getUserEmail(token, env);
      
      if (!email) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const verse = await request.json() as Verse;
      if (!verse.reference || !verse.text) {
        return new Response('Reference and text are required', { status: 400 });
      }

      // Check if verse already exists
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE email = ? AND reference = ?'
      ).bind(email, verse.reference).first();

      if (existing) {
        return new Response('Verse already exists', { status: 409 });
      }

      // Insert new verse
      await getDB(env).prepare(
        'INSERT INTO verses (email, reference, text, created_at) VALUES (?, ?, ?, ?)'
      ).bind(email, verse.reference, verse.text, Date.now()).run();

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
      const email = await getUserEmail(token, env);
      
      if (!email) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response('Verse reference is required', { status: 400 });
      }

      const verse: Verse = await request.json();
      
      if (!verse.text) {
        return new Response('Text is required', { status: 400 });
      }

      // Verify ownership
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE reference = ? AND email = ?'
      ).bind(reference, email).first();

      if (!existing) {
        return new Response('Verse not found or unauthorized', { status: 404 });
      }

      await getDB(env).prepare(
        'UPDATE verses SET text = ?, translation = ? WHERE reference = ? AND email = ?'
      ).bind(
        verse.text,
        verse.translation || 'NIV',
        reference,
        email
      ).run();

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
      const email = await getUserEmail(token, env);
      
      if (!email) {
        return new Response('Invalid or expired session', { status: 401 });
      }

      const { reference } = await request.json() as { reference: string };
      if (!reference) {
        return new Response('Reference is required', { status: 400 });
      }

      // Check if verse exists
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE email = ? AND reference = ?'
      ).bind(email, reference).first();

      if (!existing) {
        return new Response('Verse not found', { status: 404 });
      }

      // Delete verse
      await getDB(env).prepare(
        'DELETE FROM verses WHERE email = ? AND reference = ?'
      ).bind(email, reference).run();

      return new Response('Verse deleted successfully', { status: 200 });
    } catch (error) {
      console.error('Error deleting verse:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}; 
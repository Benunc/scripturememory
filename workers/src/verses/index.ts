import { Env, Verse } from '../types';

// Helper to get user email from session token
const getUserEmail = async (token: string, env: Env): Promise<string | null> => {
  const result = await env.DB.prepare(
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

      const verses = await env.DB.prepare(
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

      const verse: Verse = await request.json();
      
      if (!verse.reference || !verse.text) {
        return new Response('Reference and text are required', { status: 400 });
      }

      await env.DB.prepare(
        'INSERT INTO verses (email, reference, text, translation, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        email,
        verse.reference,
        verse.text,
        verse.translation || 'NIV',
        Date.now()
      ).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
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
      const existing = await env.DB.prepare(
        'SELECT * FROM verses WHERE reference = ? AND email = ?'
      ).bind(reference, email).first();

      if (!existing) {
        return new Response('Verse not found or unauthorized', { status: 404 });
      }

      await env.DB.prepare(
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

      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');

      if (!reference) {
        return new Response('Verse reference is required', { status: 400 });
      }

      // Verify ownership
      const existing = await env.DB.prepare(
        'SELECT * FROM verses WHERE reference = ? AND email = ?'
      ).bind(reference, email).first();

      if (!existing) {
        return new Response('Verse not found or unauthorized', { status: 404 });
      }

      await env.DB.prepare(
        'DELETE FROM verses WHERE reference = ? AND email = ?'
      ).bind(reference, email).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error deleting verse:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}; 
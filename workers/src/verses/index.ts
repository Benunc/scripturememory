import { Router } from 'itty-router';
import { Env, Verse, D1Result } from '../types';
import { getDB, getUserId } from '../utils/db';

// Points for different actions
const POINTS = {
  VERSE_ADDED: 10,         // Points for adding a new verse (limited to 3 per day)
  WORD_CORRECT: 1,         // Base points per correct word
  STREAK_MULTIPLIER: 1,    // 1x bonus per word in streak
  MASTERY_ACHIEVED: 500,   // Big bonus for mastering a verse
  DAILY_STREAK: 50,        // Bonus for maintaining daily streak
};

export const handleVerses = {
  // Get all verses for a user
  getVerses: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const verses = await getDB(env).prepare(
        `SELECT v.*, 
          CASE WHEN mv.verse_reference IS NOT NULL THEN 'mastered' ELSE v.status END as status
        FROM verses v
        LEFT JOIN mastered_verses mv ON v.reference = mv.verse_reference AND v.user_id = mv.user_id
        WHERE v.user_id = ? 
        ORDER BY v.created_at DESC`
      ).bind(userId).all();

      return new Response(JSON.stringify(verses.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting verses:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Add a new verse
  addVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { reference, text, translation, created_at } = await request.json() as Verse & { created_at?: number };
      
      if (!reference || !text || !translation) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      try {
        // Check if verse already exists
        const existingVerse = await db.prepare(`
          SELECT 1 FROM verses 
          WHERE user_id = ? AND reference = ?
        `).bind(userId, reference).first();

        if (existingVerse) {
          return new Response(JSON.stringify({ error: 'Verse already exists' }), { 
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Insert new verse
        await db.prepare(`
          INSERT INTO verses (
            user_id,
            reference,
            text,
            translation,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          userId,
          reference,
          text,
          translation,
          created_at || Date.now()
        ).run();

        // Award points for adding a verse
        await db.prepare(`
          INSERT INTO point_events (
            user_id,
            event_type,
            points,
            metadata,
            created_at
          ) VALUES (?, 'verse_added', ?, ?, ?)
        `).bind(
          userId,
          POINTS.VERSE_ADDED,
          JSON.stringify({ verse_reference: reference }),
          created_at || Date.now()
        ).run();

        // First check if user stats exist
        const stats = await db.prepare(`
          SELECT 1 FROM user_stats WHERE user_id = ?
        `).bind(userId).first();

        if (!stats) {
          // Create initial stats if they don't exist
          await db.prepare(`
            INSERT INTO user_stats (
              user_id,
              total_points,
              current_streak,
              longest_streak,
              verses_mastered,
              total_attempts,
              last_activity_date,
              created_at
            ) VALUES (?, ?, 1, 1, 0, 0, ?, ?)
          `).bind(userId, POINTS.VERSE_ADDED, created_at || Date.now(), created_at || Date.now()).run();
        } else {
          // Update existing stats
          await db.prepare(`
            UPDATE user_stats 
            SET total_points = total_points + ?,
                last_activity_date = ?
            WHERE user_id = ?
          `).bind(POINTS.VERSE_ADDED, created_at || Date.now(), userId).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'Verse added successfully' }), { 
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify({ success: true, message: 'Verse added successfully' }).length.toString()
          }
        });
      } catch (error) {
        console.error('Error adding verse:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Error adding verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update a verse
  updateVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Verse reference is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const verse: Verse = await request.json();
      
      // Verify ownership
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE reference = ? AND user_id = ?'
      ).bind(reference, userId).first();

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Verse not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
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
        return new Response(JSON.stringify({ error: 'No updates provided' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add reference and user_id to bindings
      bindings.push(reference, userId);

      await getDB(env).prepare(
        `UPDATE verses SET ${updates.join(', ')} WHERE reference = ? AND user_id = ?`
      ).bind(...bindings).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error updating verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Delete a verse
  deleteVerse: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get verse reference from URL
      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Missing verse reference' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Verify verse exists and belongs to user
      const verse = await db.prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, reference).first();

      if (!verse) {
        return new Response(JSON.stringify({ error: 'Verse not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Use D1's batch API for atomic operations
      await db.batch([
        // Delete mastery records
        db.prepare('DELETE FROM mastered_verses WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),
        db.prepare('DELETE FROM verse_mastery WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),

        // Delete progress records
        db.prepare('DELETE FROM word_progress WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),
        db.prepare('DELETE FROM verse_attempts WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),

        // Finally delete the verse
        db.prepare('DELETE FROM verses WHERE user_id = ? AND reference = ?').bind(userId, reference)
      ]);

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error deleting verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 
import { Router } from 'itty-router';
import { Env, WordProgress, VerseAttempt } from '../types';
import { getDB, getUserId } from '../utils/db';
import { updateMastery } from '../gamification';

export const handleProgress = {
  // Record word-by-word progress
  recordWordProgress: async (request: Request, env: Env): Promise<Response> => {
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

      const { verse_reference, word_index, word, is_correct } = await request.json() as WordProgress;
      
      if (!verse_reference || word_index === undefined || !word) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify verse exists and belongs to user
      const verse = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, verse_reference).first();

      if (!verse) {
        return new Response(JSON.stringify({ error: 'Verse not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Record word progress
      await getDB(env).prepare(`
        INSERT INTO word_progress (
          user_id, 
          verse_reference, 
          word_index, 
          word, 
          is_correct, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        verse_reference,
        word_index,
        word,
        is_correct ? 1 : 0,
        Date.now()
      ).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error recording word progress:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Record verse attempt
  recordVerseAttempt: async (request: Request, env: Env): Promise<Response> => {
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

      const { verse_reference, words_correct, total_words } = await request.json() as VerseAttempt;
      
      if (!verse_reference || words_correct === undefined || total_words === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify verse exists and belongs to user
      const verse = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, verse_reference).first();

      if (!verse) {
        return new Response(JSON.stringify({ error: 'Verse not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Record verse attempt
      await getDB(env).prepare(`
        INSERT INTO verse_attempts (
          user_id,
          verse_reference,
          attempt_date,
          words_correct,
          total_words,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        verse_reference,
        Date.now(),
        words_correct,
        total_words,
        Date.now()
      ).run();

      // Check for mastery
      await updateMastery(userId, verse_reference, env);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error recording verse attempt:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 
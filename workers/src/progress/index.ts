import { Router } from 'itty-router';
import { Env, WordProgress, VerseAttempt } from '../types';
import { getDB, getUserId } from '../utils/db';
import { updateMastery, updateStreak, updateVerseStreak, resetVerseStreak } from '../gamification';

// Point system constants
const POINTS = {
  VERSE_ADDED: 100,        // Big bonus for adding a new verse
  WORD_CORRECT: 1,         // Base points per correct word
  STREAK_MULTIPLIER: 1,    // 1x bonus per word in streak
  MASTERY_ACHIEVED: 500,   // Big bonus for mastering a verse
  DAILY_STREAK: 50,        // Bonus for maintaining daily streak
};

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

      const { verse_reference, word_index, word, is_correct, created_at } = await request.json() as WordProgress & { created_at?: number };
      
      if (!verse_reference || word_index === undefined || !word || is_correct === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle reset signal (special case for reset button)
      if (word_index === -1 && word === 'RESET' && !is_correct) {
        const db = getDB(env);
        // Reset the verse streak for this user and verse
        await db.prepare(`
          UPDATE user_stats 
          SET current_verse_streak = 0,
              current_verse_reference = ?
          WHERE user_id = ?
        `).bind(verse_reference, userId).run();

        // Also reset verse streak in the dedicated table
        await resetVerseStreak(userId, env, verse_reference);

        return new Response(JSON.stringify({ 
          success: true,
          streak_length: 0,
          points_earned: 0
        }), {
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

      const db = getDB(env);
      try {
        // Update streak before recording progress
        await updateStreak(userId, env, created_at);

        // Always record word progress for analytics - use UPSERT
        await db.prepare(`
          INSERT INTO word_progress (
            user_id, 
            verse_reference, 
            word_index, 
            word, 
            is_correct, 
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, verse_reference, word_index) 
          DO UPDATE SET
            word = excluded.word,
            is_correct = excluded.is_correct,
            created_at = excluded.created_at
        `).bind(
          userId,
          verse_reference,
          word_index,
          word,
          is_correct ? 1 : 0,
          created_at || Date.now()
        ).run();

        let streakLength = 0;
        let pointsEarned = 0;

        // Always award points for correct guesses
        if (is_correct) {
          // Get current verse streak from user_stats
          const stats = await db.prepare(`
            SELECT current_verse_streak, current_verse_reference, longest_word_guess_streak
            FROM user_stats 
            WHERE user_id = ?
          `).bind(userId).first() as { current_verse_streak: number, current_verse_reference: string, longest_word_guess_streak: number } | null;

          if (stats) {
            // If this is the same verse as the current streak, increment it
            if (stats.current_verse_reference === verse_reference) {
              streakLength = stats.current_verse_streak + 1;
            } else {
              // New verse, start streak at 1
              streakLength = 1;
            }
          } else {
            // First time user, start streak at 1
            streakLength = 1;
          }

          // Calculate points with streak multiplier
          const multiplier = 1 + ((streakLength - 1) * POINTS.STREAK_MULTIPLIER);
          pointsEarned = Math.round(POINTS.WORD_CORRECT * multiplier);

          // Check if this is a new longest word guess streak
          const currentLongest = stats?.longest_word_guess_streak || 0;
          const newLongest = Math.max(currentLongest, streakLength);

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
                created_at,
                current_verse_streak,
                current_verse_reference,
                longest_word_guess_streak
              ) VALUES (?, ?, 1, 1, 0, 0, ?, ?, ?, ?, ?)
            `).bind(
              userId, 
              pointsEarned, 
              created_at || Date.now(), 
              created_at || Date.now(),
              streakLength,
              verse_reference,
              newLongest
            ).run();
          } else {
            // Update existing stats
            await db.prepare(`
              UPDATE user_stats 
              SET total_points = total_points + ?,
                  last_activity_date = ?,
                  current_verse_streak = ?,
                  current_verse_reference = ?,
                  longest_word_guess_streak = ?
              WHERE user_id = ?
            `).bind(
              pointsEarned, 
              created_at || Date.now(),
              streakLength,
              verse_reference,
              newLongest,
              userId
            ).run();
          }

          // Update verse streak in the dedicated table
          await updateVerseStreak(db, userId, verse_reference, streakLength, newLongest > currentLongest);

          // Record point event
          await db.prepare(`
            INSERT INTO point_events (
              user_id,
              event_type,
              points,
              metadata,
              created_at
            ) VALUES (?, 'word_correct', ?, ?, ?)
          `).bind(
            userId,
            pointsEarned,
            JSON.stringify({ 
              verse_reference, 
              word_index, 
              word,
              streak_length: streakLength,
              multiplier: multiplier,
              is_new_longest: streakLength > currentLongest
            }),
            created_at || Date.now()
          ).run();
        } else {
          // Reset verse streak on incorrect guess
          await db.prepare(`
            UPDATE user_stats 
            SET current_verse_streak = 0,
                current_verse_reference = ?
            WHERE user_id = ?
          `).bind(verse_reference, userId).run();

          // Also reset verse streak in the dedicated table
          await resetVerseStreak(userId, env, verse_reference);
        }

        return new Response(JSON.stringify({ 
          success: true,
          streak_length: is_correct ? streakLength : 0,
          points_earned: is_correct ? pointsEarned : 0
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error recording word progress:', error);
        throw error;
      }
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

      const { verse_reference, words_correct, total_words, created_at } = await request.json() as VerseAttempt & { created_at?: number };
      
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

      const db = getDB(env);
      try {
        // Check 24-hour cooldown for perfect attempts
        const isPerfectAttempt = words_correct === total_words;
        if (isPerfectAttempt) {
          const lastPerfectAttempt = await db.prepare(`
            SELECT created_at
            FROM verse_attempts
            WHERE user_id = ? AND verse_reference = ? AND words_correct = total_words
            ORDER BY created_at DESC
            LIMIT 1
          `).bind(userId, verse_reference).first();

          if (lastPerfectAttempt) {
            const now = Date.now();
            const hoursSinceLastPerfect = (now - (lastPerfectAttempt.created_at as number)) / (1000 * 60 * 60);
            
            if (hoursSinceLastPerfect < 24) {
              const hoursRemaining = Math.ceil(24 - hoursSinceLastPerfect);
              return new Response(JSON.stringify({ 
                error: `24-hour cooldown active. You can make your next attempt in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}.` 
              }), { 
                status: 429,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
        }

        // Update streak before recording attempt
        await updateStreak(userId, env, created_at);

        // 1. Record verse attempt
        await db.prepare(`
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
          created_at || Date.now(),
          words_correct,
          total_words,
          created_at || Date.now()
        ).run();

        // 2. Award points for correct words
        const points = words_correct * POINTS.WORD_CORRECT;
        if (points > 0) {
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
              ) VALUES (?, ?, 1, 1, 0, 1, ?, ?)
            `).bind(userId, points, created_at || Date.now(), created_at || Date.now()).run();
          } else {
            // Update existing stats
            await db.prepare(`
              UPDATE user_stats 
              SET total_points = total_points + ?,
                  total_attempts = total_attempts + 1,
                  last_activity_date = ?
              WHERE user_id = ?
            `).bind(points, created_at || Date.now(), userId).run();
          }

          // Record point event
          await db.prepare(`
            INSERT INTO point_events (
              user_id,
              event_type,
              points,
              metadata,
              created_at
            ) VALUES (?, 'verse_attempt', ?, ?, ?)
          `).bind(
            userId,
            points,
            JSON.stringify({ verse_reference, words_correct, total_words }),
            created_at || Date.now()
          ).run();
        }

        // 3. Check for mastery
        await updateMastery(userId, verse_reference, env);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error recording verse attempt:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error recording verse attempt:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get mastery progress for a verse
  getMasteryProgress: async (request: Request, env: Env): Promise<Response> => {
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
      const verseReference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!verseReference) {
        return new Response(JSON.stringify({ error: 'Missing verse reference' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify verse exists and belongs to user
      const verse = await getDB(env).prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, verseReference).first();

      if (!verse) {
        return new Response(JSON.stringify({ error: 'Verse not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      try {
        // Get all attempts for this verse
        const attempts = await db.prepare(`
          SELECT 
            words_correct,
            total_words,
            created_at
          FROM verse_attempts
          WHERE user_id = ? AND verse_reference = ?
          ORDER BY created_at DESC
        `).bind(userId, verseReference).all();

        // Check if verse is mastered
        const masteredVerse = await db.prepare(`
          SELECT mastered_at
          FROM mastered_verses
          WHERE user_id = ? AND verse_reference = ?
        `).bind(userId, verseReference).first();

        // Calculate perfect attempts in a row
        let perfectAttemptsInRow = 0;
        let lastAttemptDate = null;
        let recordedAttempts = 0;

        if (attempts.results.length > 0) {
          recordedAttempts = attempts.results.length;
          lastAttemptDate = attempts.results[0].created_at;

          // Count consecutive perfect attempts from most recent
          for (const attempt of attempts.results) {
            if (attempt.words_correct === attempt.total_words) {
              perfectAttemptsInRow++;
            } else {
              break; // Stop counting when we hit a non-perfect attempt
            }
          }
        }

        return new Response(JSON.stringify({
          perfectAttemptsInRow,
          recordedAttempts,
          lastAttemptDate,
          totalAttempts: attempts.results.length,
          isMastered: !!masteredVerse,
          masteryDate: masteredVerse?.mastered_at
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error getting mastery progress:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error getting mastery progress:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Reset verse streak (for hints, show verse, start memorizing)
  resetVerseStreak: async (request: Request, env: Env): Promise<Response> => {
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

      const { verse_reference } = await request.json() as { verse_reference: string };
      
      if (!verse_reference) {
        return new Response(JSON.stringify({ error: 'Missing verse reference' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      
      // Reset the verse streak for this user
      await db.prepare(`
        UPDATE user_stats 
        SET current_verse_streak = 0,
            current_verse_reference = ?
        WHERE user_id = ?
      `).bind(verse_reference, userId).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Verse streak reset'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error resetting verse streak:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 
import { Router } from 'itty-router';
import { Env } from '../types';
import { getDB, getUserId } from '../utils/db';

// Point system constants
const POINTS = {
  VERSE_ADDED: 10,         // Points for adding a new verse (limited to 3 per day)
  WORD_CORRECT: 1,         // Base points per correct word
  STREAK_MULTIPLIER: 1,    // 1x bonus per word in streak
  MASTERY_ACHIEVED: 500,   // Big bonus for mastering a verse
  DAILY_STREAK: 50,        // Bonus for maintaining daily streak
};

// Mastery thresholds
const MASTERY = {
  MIN_ATTEMPTS: 5,         // Minimum attempts before mastery can be achieved
  MIN_ACCURACY: 0.95,      // 95% accuracy required for mastery
  CONSECUTIVE_CORRECT: 3,  // Number of consecutive correct attempts needed
};

interface PointEventRequest {
  event_type: string;
  points: number;
  metadata?: Record<string, unknown>;
}

interface UserStats {
  last_activity_date: number;
  current_streak: number;
  longest_streak: number;
  created_at: number;
}

interface VerseAttempt {
  verse_reference: string;
  words_correct: number;
  total_words: number;
}

// Helper function to update verse streak
export async function updateVerseStreak(db: any, userId: number, verseReference: string, streakLength: number, isNewLongest: boolean): Promise<void> {
  try {
    // Check if verse streak record exists
    const existingStreak = await db.prepare(`
      SELECT longest_guess_streak, current_guess_streak 
      FROM verse_streaks 
      WHERE user_id = ? AND verse_reference = ?
    `).bind(userId, verseReference).first();

    if (existingStreak) {
      // Update existing verse streak
      const currentLongest = existingStreak.longest_guess_streak || 0;
      const shouldUpdate = isNewLongest || streakLength > currentLongest;
      
      if (shouldUpdate) {
        const newLongest = Math.max(currentLongest, streakLength);
        await db.prepare(`
          UPDATE verse_streaks 
          SET longest_guess_streak = ?,
              current_guess_streak = ?,
              last_guess_date = ?,
              updated_at = ?
          WHERE user_id = ? AND verse_reference = ?
        `).bind(newLongest, streakLength, Date.now(), Date.now(), userId, verseReference).run();
      } else {
        // Just update current streak and timestamp
        await db.prepare(`
          UPDATE verse_streaks 
          SET current_guess_streak = ?,
              last_guess_date = ?,
              updated_at = ?
          WHERE user_id = ? AND verse_reference = ?
        `).bind(streakLength, Date.now(), Date.now(), userId, verseReference).run();
      }
    } else {
      // Create new verse streak record
      await db.prepare(`
        INSERT INTO verse_streaks (
          user_id,
          verse_reference,
          longest_guess_streak,
          current_guess_streak,
          last_guess_date,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, verseReference, streakLength, streakLength, Date.now(), Date.now(), Date.now()).run();
    }
  } catch (error) {
    console.error('Error updating verse streak:', error);
    // Don't throw - verse streak failure shouldn't break the main flow
  }
}

// Helper function to save verse streak (for when switching verses)
export async function saveVerseStreak(userId: number, env: Env, verseReference: string, streakLength: number): Promise<void> {
  try {
    const db = getDB(env);
    
    // Check if verse streak record exists
    const existingStreak = await db.prepare(`
      SELECT longest_guess_streak, current_guess_streak 
      FROM verse_streaks 
      WHERE user_id = ? AND verse_reference = ?
    `).bind(userId, verseReference).first();

    if (existingStreak) {
      // Update existing verse streak
      const currentLongest = (existingStreak.longest_guess_streak as number) || 0;
      const newLongest = Math.max(currentLongest, streakLength);
      
      await db.prepare(`
        UPDATE verse_streaks 
        SET longest_guess_streak = ?,
            current_guess_streak = ?,
            last_guess_date = ?,
            updated_at = ?
        WHERE user_id = ? AND verse_reference = ?
      `).bind(newLongest, streakLength, Date.now(), Date.now(), userId, verseReference).run();
    } else {
      // Create new verse streak record
      await db.prepare(`
        INSERT INTO verse_streaks (
          user_id,
          verse_reference,
          longest_guess_streak,
          current_guess_streak,
          last_guess_date,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, verseReference, streakLength, streakLength, Date.now(), Date.now(), Date.now()).run();
    }
  } catch (error) {
    console.error('Error saving verse streak:', error);
    // Don't throw - verse streak failure shouldn't break the main flow
  }
}

// Helper function to reset verse streak
export async function resetVerseStreak(userId: number, env: Env, verseReference: string): Promise<void> {
  try {
    const db = getDB(env);
    
    // Check if verse streak record exists
    const existingStreak = await db.prepare(`
      SELECT current_guess_streak 
      FROM verse_streaks 
      WHERE user_id = ? AND verse_reference = ?
    `).bind(userId, verseReference).first();

    if (existingStreak) {
      // Reset current streak to 0
      await db.prepare(`
        UPDATE verse_streaks 
        SET current_guess_streak = 0,
            updated_at = ?
        WHERE user_id = ? AND verse_reference = ?
      `).bind(Date.now(), userId, verseReference).run();
    }
  } catch (error) {
    console.error('Error resetting verse streak:', error);
    // Don't throw - verse streak failure shouldn't break the main flow
  }
}

// Helper function to check and update streak
export async function updateStreak(userId: number, env: Env, eventTimestamp?: number): Promise<void> {
  const db = getDB(env);
  
  // Get user's last activity date and streak info
  const stats = await db.prepare(`
    SELECT last_activity_date, current_streak, longest_streak 
    FROM user_stats 
    WHERE user_id = ?
  `).bind(userId).first() as UserStats | null;

  if (!stats) return;

  const lastActivity = new Date(stats.last_activity_date);
  const currentTime = eventTimestamp ? new Date(eventTimestamp) : new Date();
  const yesterday = new Date(currentTime);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // If this is the first activity (last_activity_date is the same as created_at)
  if (stats.last_activity_date === stats.created_at) {
    await db.prepare(`
      UPDATE user_stats 
      SET current_streak = 1,
          longest_streak = 1,
          last_activity_date = ?
      WHERE user_id = ?
    `).bind(eventTimestamp || Date.now(), userId).run();
    return;
  }

  // Reset streak if more than one day has passed
  if (lastActivity < yesterday) {
    await db.prepare(`
      UPDATE user_stats 
      SET current_streak = 0,
          last_activity_date = ?
      WHERE user_id = ?
    `).bind(eventTimestamp || Date.now(), userId).run();
    return;
  }

  // Check if we need to reset the streak counter for a new day
  // If the last activity was yesterday, we should reset the streak counter to 0
  // so that the next activity today will increment it properly
  if (lastActivity.getUTCDate() === yesterday.getUTCDate() && 
      lastActivity.getUTCMonth() === yesterday.getUTCMonth() && 
      lastActivity.getUTCFullYear() === yesterday.getUTCFullYear()) {
    // Reset streak counter to 0 for today, but keep the streak count
    await db.prepare(`
      UPDATE user_stats 
      SET current_streak = 0,
          last_activity_date = ?
      WHERE user_id = ?
    `).bind(eventTimestamp || Date.now(), userId).run();
    
    // Now increment the streak since we just reset it
    const newStreak = stats.current_streak + 1;
    const longestStreak = Math.max(newStreak, stats.longest_streak);

    await db.prepare(`
      UPDATE user_stats 
      SET current_streak = ?,
          longest_streak = ?,
          last_activity_date = ?
      WHERE user_id = ?
    `).bind(newStreak, longestStreak, eventTimestamp || Date.now(), userId).run();

    // Award points for maintaining streak
    if (newStreak > 1) {  // Only award points for streaks > 1 day
      await db.prepare(`
        INSERT INTO point_events (
          user_id,
          event_type,
          points,
          metadata,
          created_at
        ) VALUES (?, 'daily_streak', ?, ?, ?)
      `).bind(
        userId,
        POINTS.DAILY_STREAK,
        JSON.stringify({ streak_days: newStreak }),
        eventTimestamp || Date.now()
      ).run();

      // Update total points
      await db.prepare(`
        UPDATE user_stats 
        SET total_points = total_points + ?
        WHERE user_id = ?
      `).bind(POINTS.DAILY_STREAK, userId).run();
    }
    return;
  }

  // Check if we should increment the streak
  // We increment if:
  // 1. Last activity was today but we haven't incremented the streak for today yet
  const shouldIncrementStreak = 
    // Last activity was today but we haven't incremented for today yet
    (lastActivity.getUTCDate() === currentTime.getUTCDate() && 
     lastActivity.getUTCMonth() === currentTime.getUTCMonth() && 
     lastActivity.getUTCFullYear() === currentTime.getUTCFullYear() &&
     stats.current_streak === 0); // Only increment if streak is 0 (meaning we haven't counted today yet)

  if (shouldIncrementStreak) {
    const newStreak = stats.current_streak + 1;
    const longestStreak = Math.max(newStreak, stats.longest_streak);

    await db.prepare(`
      UPDATE user_stats 
      SET current_streak = ?,
          longest_streak = ?,
          last_activity_date = ?
      WHERE user_id = ?
    `).bind(newStreak, longestStreak, eventTimestamp || Date.now(), userId).run();

    // Award points for maintaining streak
    if (newStreak > 1) {  // Only award points for streaks > 1 day
      await db.prepare(`
        INSERT INTO point_events (
          user_id,
          event_type,
          points,
          metadata,
          created_at
        ) VALUES (?, 'daily_streak', ?, ?, ?)
      `).bind(
        userId,
        POINTS.DAILY_STREAK,
        JSON.stringify({ streak_days: newStreak }),
        eventTimestamp || Date.now()
      ).run();

      // Update total points
      await db.prepare(`
        UPDATE user_stats 
        SET total_points = total_points + ?
        WHERE user_id = ?
      `).bind(POINTS.DAILY_STREAK, userId).run();
    }
  } else {
    // Update last activity date without incrementing streak
    await db.prepare(`
      UPDATE user_stats 
      SET last_activity_date = ?
      WHERE user_id = ?
    `).bind(eventTimestamp || Date.now(), userId).run();
  }
}

// Helper function to check and update mastery
export async function updateMastery(userId: number, verseReference: string, env: Env): Promise<void> {
  const db = getDB(env);
  
  // Get all attempts for this verse
  const result = await db.prepare(`
    SELECT words_correct, total_words, created_at
    FROM verse_attempts
    WHERE user_id = ? AND verse_reference = ?
    ORDER BY created_at DESC
  `).bind(userId, verseReference).all();

  const attempts = result.results.map(row => ({
    verse_reference: verseReference,
    words_correct: row.words_correct as number,
    total_words: row.total_words as number
  }));

  
  if (attempts.length < MASTERY.MIN_ATTEMPTS) {
    return;
  }

  // Find the index where we have 3 consecutive perfect attempts
  let perfectAttemptsStart = -1;
  for (let i = 0; i <= attempts.length - MASTERY.CONSECUTIVE_CORRECT; i++) {
    const isConsecutive = attempts.slice(i, i + MASTERY.CONSECUTIVE_CORRECT).every(attempt => 
      attempt.words_correct === attempt.total_words
    );
    if (isConsecutive) {
      perfectAttemptsStart = i;
      break;
    }
  }


  if (perfectAttemptsStart === -1) {
    return;
  }

  // Calculate overall accuracy using all attempts up to and including the perfect attempts
  const accuracyAttempts = attempts.slice(0, perfectAttemptsStart + MASTERY.CONSECUTIVE_CORRECT);
  const totalCorrect = accuracyAttempts.reduce((sum, attempt) => sum + attempt.words_correct, 0);
  const totalWords = accuracyAttempts.reduce((sum, attempt) => sum + attempt.total_words, 0);
  const accuracy = totalCorrect / totalWords;

  
  if (accuracy < MASTERY.MIN_ACCURACY) {
    return;
  }

  // Check if verse is already mastered
  const isMastered = await db.prepare(`
    SELECT 1 FROM mastered_verses
    WHERE user_id = ? AND verse_reference = ?
  `).bind(userId, verseReference).first();

  if (isMastered) {
    return;
  }

  // Record mastery
  await db.prepare(`
    INSERT INTO mastered_verses (
      user_id,
      verse_reference,
      mastered_at,
      created_at
    ) VALUES (?, ?, ?, ?)
  `).bind(userId, verseReference, Date.now(), Date.now()).run();

  // Award points for mastery
  await db.prepare(`
    INSERT INTO point_events (
      user_id,
      event_type,
      points,
      metadata,
      created_at
    ) VALUES (?, 'mastery_achieved', ?, ?, ?)
  `).bind(
    userId,
    POINTS.MASTERY_ACHIEVED,
    JSON.stringify({ verse_reference: verseReference }),
    Date.now()
  ).run();

  // Update user stats
  await db.prepare(`
    UPDATE user_stats 
    SET verses_mastered = verses_mastered + 1,
        total_points = total_points + ?
    WHERE user_id = ?
  `).bind(POINTS.MASTERY_ACHIEVED, userId).run();

  
}

export const handleGamification = {
  // Get verse streaks for a user
  getVerseStreaks: async (request: Request, env: Env): Promise<Response> => {
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

      const db = getDB(env);
      
      // Get all verse streaks for the user
      const verseStreaks = await db.prepare(`
        SELECT 
          verse_reference,
          longest_guess_streak,
          current_guess_streak,
          last_guess_date
        FROM verse_streaks 
        WHERE user_id = ?
        ORDER BY longest_guess_streak DESC, last_guess_date DESC
      `).bind(userId).all();

      return new Response(JSON.stringify({
        verse_streaks: verseStreaks.results || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting verse streaks:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Save verse streak (for when switching verses)
  saveVerseStreak: async (request: Request, env: Env): Promise<Response> => {
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

      const { verse_reference, streak_length } = await request.json() as { verse_reference: string; streak_length: number };
      
      if (!verse_reference || typeof streak_length !== 'number') {
        return new Response(JSON.stringify({ error: 'Missing verse_reference or streak_length' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await saveVerseStreak(userId, env, verse_reference, streak_length);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error saving verse streak:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Reset verse streak
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
        return new Response(JSON.stringify({ error: 'Missing verse_reference' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await resetVerseStreak(userId, env, verse_reference);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error resetting verse streak:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Record point event
  recordPointEvent: async (request: Request, env: Env): Promise<Response> => {
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

      const { event_type, points, metadata, created_at } = await request.json() as PointEventRequest & { created_at?: number };
      
      if (!event_type || points === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update streak before recording points
      await updateStreak(userId, env, created_at);

      const db = getDB(env);
      try {
        // Record point event first
        await db.prepare(`
          INSERT INTO point_events (
            user_id,
            event_type,
            points,
            metadata,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          userId,
          event_type,
          points,
          metadata ? JSON.stringify(metadata) : null,
          created_at || Date.now()
        ).run();

        // Handle word_correct events - update longest word guess streak and verse streaks
        if (event_type === 'word_correct' && metadata?.streak_length && typeof metadata.streak_length === 'number') {
          const streakLength = metadata.streak_length;
          const verseReference = typeof metadata.verse_reference === 'string' ? metadata.verse_reference : null;
          
          // Update global longest word guess streak
          const currentStats = await db.prepare(`
            SELECT longest_word_guess_streak FROM user_stats WHERE user_id = ?
          `).bind(userId).first() as { longest_word_guess_streak: number } | null;
          
          const currentLongest = currentStats?.longest_word_guess_streak || 0;
          
          // Only update longest streak if:
          // 1. This is explicitly marked as a new longest streak, OR
          // 2. The streak length is actually greater than the current longest
          const isNewLongest = metadata.is_new_longest === true;
          const shouldUpdate = isNewLongest || streakLength > currentLongest;
          
          if (shouldUpdate) {
            const newLongest = Math.max(currentLongest, streakLength);
            await db.prepare(`
              UPDATE user_stats 
              SET longest_word_guess_streak = ?
              WHERE user_id = ?
            `).bind(newLongest, userId).run();
          }

          // Update verse streak if verse reference is provided
          if (verseReference) {
            await updateVerseStreak(db, userId, verseReference, streakLength, metadata.is_new_longest === true);
          }
        }

        // Then check if user stats exist
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
          `).bind(userId, points, Date.now(), Date.now()).run();
        } else {
          // Update existing stats
          await db.prepare(`
            UPDATE user_stats 
            SET total_points = total_points + ?,
                last_activity_date = ?
            WHERE user_id = ?
          `).bind(points, created_at || Date.now(), userId).run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error in point event:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error recording point event:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get user stats
  getUserStats: async (request: Request, env: Env): Promise<Response> => {
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

      // Get timestamp from request URL if provided
      const url = new URL(request.url);
      const timestamp = url.searchParams.get('timestamp');
      const eventTimestamp = timestamp ? parseInt(timestamp, 10) : Date.now();

      // Update streak before getting stats, using provided timestamp
      await updateStreak(userId, env, eventTimestamp);

      const db = getDB(env);
      try {
        // Get user stats
        const stats = await db.prepare(`
          SELECT * FROM user_stats WHERE user_id = ?
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
            ) VALUES (?, 0, 0, 0, 0, 0, ?, ?)
          `).bind(userId, Date.now(), Date.now()).run();

          return new Response(JSON.stringify({
            total_points: 0,
            current_streak: 0,
            longest_streak: 0,
            longest_word_guess_streak: 0,
            verses_mastered: 0,
            total_attempts: 0,
            perfect_attempts: 0,
            other_attempts: 0,
            verse_streaks: [],
            last_activity_date: Date.now(),
            points_breakdown: {
              verse_mastery: 0,
              word_guesses: 0,
              guess_streaks: 0,
              verse_additions: 0,
              daily_streaks: 0
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get points breakdown from point_events
        const pointsBreakdown = await db.prepare(`
          SELECT 
            SUM(CASE WHEN event_type = 'mastery_achieved' THEN points ELSE 0 END) as verse_mastery,
            SUM(CASE WHEN event_type IN ('word_correct', 'guess_streak') THEN points ELSE 0 END) as word_guesses,
            SUM(CASE WHEN event_type IN ('word_correct', 'guess_streak') AND json_extract(metadata, '$.streak_length') > 1 
              THEN points - 1 
              ELSE 0 END) as guess_streaks,
            SUM(CASE WHEN event_type = 'verse_added' THEN points ELSE 0 END) as verse_additions,
            SUM(CASE WHEN event_type = 'daily_streak' THEN points ELSE 0 END) as daily_streaks
          FROM point_events 
          WHERE user_id = ?
        `).bind(userId).first();

        // Get perfect and other attempts
        const attemptsBreakdown = await db.prepare(`
          SELECT 
            COUNT(CASE WHEN words_correct = total_words THEN 1 END) as perfect_attempts,
            COUNT(CASE WHEN words_correct < total_words THEN 1 END) as other_attempts
          FROM verse_attempts 
          WHERE user_id = ?
        `).bind(userId).first();

        // Get point history for the last 30 days
        const pointHistory = await db.prepare(`
          WITH RECURSIVE dates(date) AS (
            SELECT date('now', '-30 days')
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date('now')
          ),
          daily_points AS (
            SELECT 
              date(created_at/1000, 'unixepoch') as date,
              SUM(points) as points
            FROM point_events
            WHERE user_id = ?
            GROUP BY date(created_at/1000, 'unixepoch')
          )
          SELECT 
            dates.date,
            COALESCE(daily_points.points, 0) as points,
            SUM(COALESCE(daily_points.points, 0)) OVER (ORDER BY dates.date) as running_total
          FROM dates
          LEFT JOIN daily_points ON dates.date = daily_points.date
          ORDER BY dates.date
        `).bind(userId).all();

        // Get verse streaks data
        const verseStreaks = await db.prepare(`
          SELECT 
            verse_reference,
            longest_guess_streak,
            current_guess_streak,
            last_guess_date
          FROM verse_streaks 
          WHERE user_id = ?
          ORDER BY longest_guess_streak DESC, last_guess_date DESC
        `).bind(userId).all();

        return new Response(JSON.stringify({
          ...stats,
          perfect_attempts: attemptsBreakdown?.perfect_attempts || 0,
          other_attempts: attemptsBreakdown?.other_attempts || 0,
          verse_streaks: verseStreaks?.results || [],
          points_breakdown: pointsBreakdown || {
            verse_mastery: 0,
            word_guesses: 0,
            guess_streaks: 0,
            verse_additions: 0,
            daily_streaks: 0
          },
          point_history: pointHistory.results.map(row => ({
            date: row.date,
            points: row.points,
            running_total: row.running_total
          }))
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error getting user stats:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Error getting user stats:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get time-based user stats
  getTimeBasedStats: async (request: Request, env: Env): Promise<Response> => {
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
      const timeframe = (url.searchParams.get('timeframe') || 'all') as string;
      const targetUserId = url.searchParams.get('user_id') ? parseInt(url.searchParams.get('user_id')!, 10) : userId;

      // Update valid timeframes
      const validTimeframes = ['all', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'last_year', 'custom'];
      if (!validTimeframes.includes(timeframe)) {
        return new Response(JSON.stringify({ error: 'Invalid timeframe parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Calculate time boundaries
      const now = new Date();
      let startTime = 0;
      let endTime = Date.now();

      switch (timeframe) {
        case 'this_week': {
          const currentDay = now.getDay();
          const daysToSubtract = currentDay === 0 ? 0 : currentDay;
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract).getTime();
          break;
        }
        case 'last_week': {
          const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
          startTime = lastWeekStart.getTime();
          const lastWeekEnd = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate() + 6);
          endTime = lastWeekEnd.getTime();
          break;
        }
        case 'this_month':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          break;
        case 'last_month':
          startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
          endTime = new Date(now.getFullYear(), now.getMonth(), 0).getTime();
          break;
        case 'this_year':
          startTime = new Date(now.getFullYear(), 0, 1).getTime();
          break;
        case 'last_year':
          startTime = new Date(now.getFullYear() - 1, 0, 1).getTime();
          endTime = new Date(now.getFullYear(), 0, 0).getTime();
          break;
        case 'custom': {
          const startDate = url.searchParams.get('start_date');
          const endDate = url.searchParams.get('end_date');
          if (!startDate || !endDate) {
            return new Response(JSON.stringify({ error: 'Custom timeframe requires start_date and end_date parameters' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          const startTimestamp = new Date(startDate).getTime();
          const endTimestamp = new Date(endDate).getTime();
          if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
            return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD format' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (startTimestamp > endTimestamp) {
            return new Response(JSON.stringify({ error: 'Start date must be before end date' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          startTime = startTimestamp;
          endTime = endTimestamp;
          break;
        }
        case 'all':
        default:
          startTime = 0;
          break;
      }

      // Get points earned in timeframe
      let pointsResult;
      if (timeframe === 'all') {
        pointsResult = await db.prepare(`
          SELECT 
            SUM(points) as total_points,
            COUNT(*) as total_events,
            SUM(CASE WHEN event_type = 'mastery_achieved' THEN points ELSE 0 END) as mastery_points,
            SUM(CASE WHEN event_type IN ('word_correct', 'guess_streak') THEN points ELSE 0 END) as word_points,
            SUM(CASE WHEN event_type = 'verse_added' THEN points ELSE 0 END) as verse_points,
            SUM(CASE WHEN event_type = 'daily_streak' THEN points ELSE 0 END) as streak_points
          FROM point_events pe
          WHERE user_id = ?
        `).bind(targetUserId).first();
      } else {
        pointsResult = await db.prepare(`
          SELECT 
            SUM(points) as total_points,
            COUNT(*) as total_events,
            SUM(CASE WHEN event_type = 'mastery_achieved' THEN points ELSE 0 END) as mastery_points,
            SUM(CASE WHEN event_type IN ('word_correct', 'guess_streak') THEN points ELSE 0 END) as word_points,
            SUM(CASE WHEN event_type = 'verse_added' THEN points ELSE 0 END) as verse_points,
            SUM(CASE WHEN event_type = 'daily_streak' THEN points ELSE 0 END) as streak_points
          FROM point_events pe
          WHERE user_id = ? AND pe.created_at >= ? AND pe.created_at <= ?
        `).bind(targetUserId, startTime, endTime).first();
      }

      // Get verses mastered in timeframe
      let masteryResult;
      if (timeframe === 'all') {
        masteryResult = await db.prepare(`
          SELECT COUNT(*) as verses_mastered
          FROM mastered_verses mv2
          WHERE user_id = ?
        `).bind(targetUserId).first();
      } else {
        masteryResult = await db.prepare(`
          SELECT COUNT(*) as verses_mastered
          FROM mastered_verses mv2
          WHERE user_id = ? AND mv2.created_at >= ? AND mv2.created_at <= ?
        `).bind(targetUserId, startTime, endTime).first();
      }

      // Get verse attempts in timeframe
      let attemptsResult;
      if (timeframe === 'all') {
        attemptsResult = await db.prepare(`
          SELECT 
            COUNT(*) as total_attempts,
            COUNT(CASE WHEN words_correct = total_words THEN 1 END) as perfect_attempts,
            SUM(words_correct) as total_words_correct,
            SUM(total_words) as total_words_attempted
          FROM verse_attempts 
          WHERE user_id = ?
        `).bind(targetUserId).first();
      } else {
        attemptsResult = await db.prepare(`
          SELECT 
            COUNT(*) as total_attempts,
            COUNT(CASE WHEN words_correct = total_words THEN 1 END) as perfect_attempts,
            SUM(words_correct) as total_words_correct,
            SUM(total_words) as total_words_attempted
          FROM verse_attempts 
          WHERE user_id = ? AND created_at >= ? AND created_at <= ?
        `).bind(targetUserId, startTime, endTime).first();
      }

      // Get current streak (this is always current, not time-based)
      const currentStreak = await db.prepare(`
        SELECT current_streak, longest_streak
        FROM user_stats 
        WHERE user_id = ?
      `).bind(targetUserId).first();

      return new Response(JSON.stringify({
        timeframe,
        start_time: startTime,
        end_time: endTime,
        stats: {
          total_points: Number(pointsResult?.total_points) || 0,
          total_events: Number(pointsResult?.total_events) || 0,
          verses_mastered: Number(masteryResult?.verses_mastered) || 0,
          total_attempts: Number(attemptsResult?.total_attempts) || 0,
          perfect_attempts: Number(attemptsResult?.perfect_attempts) || 0,
          accuracy: attemptsResult?.total_words_attempted ? 
            (Number(attemptsResult.total_words_correct) / Number(attemptsResult.total_words_attempted)) : 0,
          current_streak: Number(currentStreak?.current_streak) || 0,
          longest_streak: Number(currentStreak?.longest_streak) || 0
        },
        breakdown: {
          mastery_points: Number(pointsResult?.mastery_points) || 0,
          word_points: Number(pointsResult?.word_points) || 0,
          verse_points: Number(pointsResult?.verse_points) || 0,
          streak_points: Number(pointsResult?.streak_points) || 0
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting time-based stats:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get time-based leaderboard for a group
  getTimeBasedLeaderboard: async (request: Request, env: Env): Promise<Response> => {
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
      const pathParts = url.pathname.split('/');
      const groupId: string = pathParts[3] ?? ''; // /gamification/leaderboard/{groupId}
      const timeframe = (url.searchParams.get('timeframe') || 'all') as string;
      const metric = (url.searchParams.get('metric') || 'points') as string;
      const direction = (url.searchParams.get('direction') || 'desc') as string;

      // Validate parameters
      const validTimeframes = ['all', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'last_year', 'custom'];
      const validMetrics = ['points', 'verses_mastered', 'longest_word_guess_streak'];
      const validDirections = ['asc', 'desc'];
      
      if (!validTimeframes.includes(timeframe)) {
        return new Response(JSON.stringify({ error: 'Invalid timeframe parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!validMetrics.includes(metric)) {
        return new Response(JSON.stringify({ error: 'Invalid metric parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!validDirections.includes(direction)) {
        return new Response(JSON.stringify({ error: 'Invalid direction parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!groupId) {
        return new Response(JSON.stringify({ error: 'Missing group ID' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user is a member of the group or super admin
      const isMember = await db.prepare(`
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      if (!isMember && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'You must be a member of this group to view the leaderboard' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check admin privileges
      const userRole = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      const isAdmin = userRole && ['leader', 'creator'].includes(userRole.role);
      const hasAdminPrivileges = isAdmin || isSuperAdmin;

      // Calculate time boundaries
      const now = new Date();
      let startTime = 0;
      let endTime = Date.now();

      switch (timeframe) {
        case 'this_week': {
          const currentDay = now.getDay();
          const daysToSubtract = currentDay === 0 ? 0 : currentDay;
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract).getTime();
          break;
        }
        case 'last_week': {
          const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
          startTime = lastWeekStart.getTime();
          const lastWeekEnd = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate() + 6);
          endTime = lastWeekEnd.getTime();
          break;
        }
        case 'this_month':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          break;
        case 'last_month':
          startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
          endTime = new Date(now.getFullYear(), now.getMonth(), 0).getTime();
          break;
        case 'this_year':
          startTime = new Date(now.getFullYear(), 0, 1).getTime();
          break;
        case 'last_year':
          startTime = new Date(now.getFullYear() - 1, 0, 1).getTime();
          endTime = new Date(now.getFullYear(), 0, 0).getTime();
          break;
        case 'custom': {
          const startDate = url.searchParams.get('start_date');
          const endDate = url.searchParams.get('end_date');
          if (!startDate || !endDate) {
            return new Response(JSON.stringify({ error: 'Custom timeframe requires start_date and end_date parameters' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          const startTimestamp = new Date(startDate).getTime();
          const endTimestamp = new Date(endDate).getTime();
          if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
            return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD format' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (startTimestamp > endTimestamp) {
            return new Response(JSON.stringify({ error: 'Start date must be before end date' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          startTime = startTimestamp;
          endTime = endTimestamp;
          break;
        }
        case 'all':
        default:
          startTime = 0;
          break;
      }

      // Build the leaderboard query based on metric
      let leaderboardQuery = '';
      let orderBy = '';

      switch (metric) {
        case 'points':
          if (timeframe === 'all') {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE(SUM(pe.points), 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id
                ), 0) as time_filtered_verses_mastered,
                COUNT(pe.id) as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          } else {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE(SUM(pe.points), 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id AND mv2.created_at >= ? AND mv2.created_at <= ?
                ), 0) as time_filtered_verses_mastered,
                COUNT(pe.id) as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id AND pe.created_at >= ? AND pe.created_at <= ?
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          }
          orderBy = `metric_value ${direction.toUpperCase()}`;
          break;
        case 'verses_mastered':
          if (timeframe === 'all') {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id
                ), 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id
                ), 0) as time_filtered_verses_mastered,
                0 as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          } else {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id AND mv2.created_at >= ? AND mv2.created_at <= ?
                ), 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id AND mv2.created_at >= ? AND mv2.created_at <= ?
                ), 0) as time_filtered_verses_mastered,
                0 as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id AND pe.created_at >= ? AND pe.created_at <= ?
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          }
          orderBy = `metric_value ${direction.toUpperCase()}`;
          break;
        case 'longest_word_guess_streak':
          if (timeframe === 'all') {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE(us.longest_word_guess_streak, 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id
                ), 0) as time_filtered_verses_mastered,
                0 as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          } else {
            leaderboardQuery = `
              SELECT 
                gm.user_id,
                gm.display_name,
                gm.is_public,
                u.email as member_email,
                COALESCE(us.longest_word_guess_streak, 0) as metric_value,
                COALESCE(SUM(pe.points), 0) as time_filtered_points,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM mastered_verses mv2 
                  WHERE mv2.user_id = gm.user_id AND mv2.created_at >= ? AND mv2.created_at <= ?
                ), 0) as time_filtered_verses_mastered,
                0 as total_events,
                us.total_points,
                us.verses_mastered,
                us.current_streak,
                us.longest_streak,
                us.longest_word_guess_streak
              FROM group_members gm
              LEFT JOIN users u ON gm.user_id = u.id
              LEFT JOIN point_events pe ON gm.user_id = pe.user_id AND pe.created_at >= ? AND pe.created_at <= ?
              LEFT JOIN user_stats us ON gm.user_id = us.user_id
              WHERE gm.group_id = ? AND gm.is_active = TRUE
              GROUP BY gm.user_id, gm.display_name, gm.is_public, u.email, us.total_points, us.verses_mastered, us.current_streak, us.longest_streak, us.longest_word_guess_streak
              ORDER BY metric_value ${direction.toUpperCase()}
            `;
          }
          orderBy = `metric_value ${direction.toUpperCase()}`;
          break;
      }

      let leaderboard;
      if (timeframe === 'all') {
        leaderboard = await db.prepare(leaderboardQuery).bind(groupId).all();
      } else {
        // For time-based queries, we need to bind the time parameters multiple times
        // since they appear in multiple subqueries
        if (metric === 'points') {
          leaderboard = await db.prepare(leaderboardQuery).bind(startTime, endTime, startTime, endTime, groupId).all();
        } else if (metric === 'longest_word_guess_streak') {
          leaderboard = await db.prepare(leaderboardQuery).bind(startTime, endTime, startTime, endTime, groupId).all();
        } else {
          leaderboard = await db.prepare(leaderboardQuery).bind(startTime, endTime, startTime, endTime, startTime, endTime, groupId).all();
        }
      }

      // Process results and add rankings
      const processedLeaderboard: any[] = [];
      let currentRank = 1;
      let lastValue = -1;

      // For ranking, we always want higher values to have better ranks
      // So we need to sort by metric_value in descending order for ranking, regardless of display order
      const sortedForRanking = [...leaderboard.results].sort((a, b) => {
        const aValue = Number(a.metric_value) || 0;
        const bValue = Number(b.metric_value) || 0;
        return bValue - aValue; // Always descending for ranking
      });

      // Create a map of user_id to rank
      const rankMap = new Map();
      let rank = 1;
      let lastRankValue = -1;

      for (const entry of sortedForRanking) {
        const currentValue = Number(entry.metric_value) || 0;
        
        // Handle ties (same rank for same values)
        if (currentValue !== lastRankValue) {
          rank = rankMap.size + 1;
        }
        
        rankMap.set(entry.user_id, rank);
        lastRankValue = currentValue;
      }

      // Now process the results in the requested sort order
      for (const entry of leaderboard.results) {
        const currentValue = Number(entry.metric_value) || 0;
        const userRank = rankMap.get(entry.user_id) || 1;

        processedLeaderboard.push({
          rank: userRank,
          user_id: Number(entry.user_id) || 0,
          display_name: hasAdminPrivileges ? 
            `${String(entry.member_email || 'Anonymous')} (${entry.display_name && entry.display_name !== 'null' ? String(entry.display_name) : 'Anonymous'})` : 
            (entry.is_public ? (typeof entry.display_name === 'string' && entry.display_name !== 'null' ? String(entry.display_name) : 'Anonymous') : 'Anonymous'),
          points: Number(entry.total_points) || 0,
          verses_mastered: Number(entry.verses_mastered) || 0,
          current_streak: Number(entry.current_streak) || 0,
          longest_streak: Number(entry.longest_streak) || 0,
          longest_word_guess_streak: Number(entry.longest_word_guess_streak) || 0,
          metric_value: currentValue,
          time_filtered_points: Number(entry.time_filtered_points as any) || 0,
          time_filtered_verses_mastered: Number(entry.time_filtered_verses_mastered as any) || 0,
          total_events: Number(entry.total_events) || 0,
          is_public: !!entry.is_public
        });
      }

      // Get metadata
      const totalMembers = await db.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE group_id = ? AND is_active = TRUE
      `).bind(groupId).first();

      const participatingMembers = processedLeaderboard.length;

      return new Response(JSON.stringify({ 
        success: true,
        leaderboard: processedLeaderboard,
        metadata: {
          total_members: totalMembers?.count || 0,
          participating_members: participatingMembers,
          metric,
          timeframe,
          start_time: startTime,
          end_time: endTime
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting time-based leaderboard:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 
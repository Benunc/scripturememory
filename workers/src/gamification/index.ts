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

// Helper function to check and update streak
export async function updateStreak(userId: number, env: Env, eventTimestamp?: number): Promise<void> {
  const db = getDB(env);
  
  // Get user's last activity date
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

  // Only increment streak if last activity was yesterday
  // This ensures we only count one activity per day
  if (lastActivity.getUTCDate() === yesterday.getUTCDate() && 
      lastActivity.getUTCMonth() === yesterday.getUTCMonth() && 
      lastActivity.getUTCFullYear() === yesterday.getUTCFullYear()) {
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
            verses_mastered: 0,
            total_attempts: 0,
            perfect_attempts: 0,
            other_attempts: 0,
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

        return new Response(JSON.stringify({
          ...stats,
          perfect_attempts: attemptsBreakdown?.perfect_attempts || 0,
          other_attempts: attemptsBreakdown?.other_attempts || 0,
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
  }
}; 
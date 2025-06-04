-- Migration: Update longest_streak values from 0 to 1
-- Description: Updates any user_stats records where longest_streak is 0 to be 1,
-- since these users have used the app at least once.

-- Update longest_streak to 1 where it's currently 0
UPDATE user_stats
SET longest_streak = 1
WHERE longest_streak = 0; 
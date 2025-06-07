-- Add verse streak tracking columns to user_stats
ALTER TABLE user_stats ADD COLUMN current_verse_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN current_verse_reference TEXT;

-- Add index for faster lookups
CREATE INDEX idx_user_stats_verse_streak ON user_stats(user_id, current_verse_reference); 
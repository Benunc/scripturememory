-- Add longest_word_guess_streak column to user_stats table
ALTER TABLE user_stats ADD COLUMN longest_word_guess_streak INTEGER NOT NULL DEFAULT 0;

-- Update existing records to have a default value
UPDATE user_stats SET longest_word_guess_streak = 0 WHERE longest_word_guess_streak IS NULL; 
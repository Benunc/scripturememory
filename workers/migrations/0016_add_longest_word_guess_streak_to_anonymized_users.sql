-- Add longest_word_guess_streak column to anonymized_users table
ALTER TABLE anonymized_users ADD COLUMN longest_word_guess_streak INTEGER NOT NULL DEFAULT 0; 
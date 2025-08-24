-- Create verse_streaks table for tracking individual verse guess streaks
CREATE TABLE IF NOT EXISTS verse_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  longest_guess_streak INTEGER NOT NULL DEFAULT 0,
  current_guess_streak INTEGER NOT NULL DEFAULT 0,
  last_guess_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, verse_reference)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_verse_streaks_user ON verse_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_verse_streaks_verse ON verse_streaks(verse_reference);
CREATE INDEX IF NOT EXISTS idx_verse_streaks_user_verse ON verse_streaks(user_id, verse_reference); 
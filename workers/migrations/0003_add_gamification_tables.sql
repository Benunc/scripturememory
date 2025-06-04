-- Add point_events table
CREATE TABLE IF NOT EXISTS point_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,  -- 'verse_added', 'word_correct', 'streak_bonus', 'mastery_achieved'
  points INTEGER NOT NULL,
  metadata TEXT,    -- JSON string for event-specific data
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Add verse_mastery table
CREATE TABLE IF NOT EXISTS verse_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_mastered_date INTEGER,
  days_mastered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (verse_reference) REFERENCES verses(reference) ON DELETE RESTRICT,
  UNIQUE(user_id, verse_reference)
);

-- Add user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  verses_mastered INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  last_activity_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_point_events_user_date ON point_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_point_events_type ON point_events(event_type);
CREATE INDEX IF NOT EXISTS idx_verse_mastery_user ON verse_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_verse_mastery_verse ON verse_mastery(verse_reference);
CREATE INDEX IF NOT EXISTS idx_user_stats_last_activity ON user_stats(last_activity_date); 
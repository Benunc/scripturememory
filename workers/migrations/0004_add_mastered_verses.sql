-- Add mastered_verses table to track when verses are first mastered
CREATE TABLE IF NOT EXISTS mastered_verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  mastered_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (verse_reference) REFERENCES verses(reference) ON DELETE RESTRICT,
  UNIQUE(user_id, verse_reference)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_mastered_verses_user ON mastered_verses(user_id);
CREATE INDEX IF NOT EXISTS idx_mastered_verses_verse ON mastered_verses(verse_reference);
CREATE INDEX IF NOT EXISTS idx_mastered_verses_date ON mastered_verses(mastered_at); 
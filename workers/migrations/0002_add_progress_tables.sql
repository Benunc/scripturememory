-- Add word_progress table
-- NOTE: verses.reference must be UNIQUE for this foreign key to work in SQLite
CREATE TABLE IF NOT EXISTS word_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  word_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  last_correct_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (verse_reference) REFERENCES verses(reference) ON DELETE RESTRICT,
  UNIQUE(user_id, verse_reference, word_index)
);

-- Add verse_attempts table
CREATE TABLE IF NOT EXISTS verse_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  attempt_date INTEGER NOT NULL,
  words_correct INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (verse_reference) REFERENCES verses(reference) ON DELETE RESTRICT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_word_progress_user_verse ON word_progress(user_id, verse_reference);
CREATE INDEX IF NOT EXISTS idx_word_progress_last_correct ON word_progress(last_correct_date);
CREATE INDEX IF NOT EXISTS idx_verse_attempts_user_date ON verse_attempts(user_id, attempt_date);
CREATE INDEX IF NOT EXISTS idx_verse_attempts_verse ON verse_attempts(verse_reference); 
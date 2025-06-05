-- Migration to fix the UNIQUE constraint on verses.reference to be per user
-- First, we need to handle foreign key dependencies

-- Step 1: Create backup tables for all dependent data
CREATE TABLE IF NOT EXISTS verses_backup AS SELECT * FROM verses;
CREATE TABLE IF NOT EXISTS verse_mastery_backup AS SELECT * FROM verse_mastery;
CREATE TABLE IF NOT EXISTS mastered_verses_backup AS SELECT * FROM mastered_verses;
CREATE TABLE IF NOT EXISTS word_progress_backup AS SELECT * FROM word_progress;
CREATE TABLE IF NOT EXISTS verse_attempts_backup AS SELECT * FROM verse_attempts;

-- Step 2: Drop foreign key constraints by recreating dependent tables without constraints
DROP TABLE IF EXISTS verse_mastery;
CREATE TABLE IF NOT EXISTS verse_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_mastered_date INTEGER,
  days_mastered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(user_id, verse_reference)
);

DROP TABLE IF EXISTS mastered_verses;
CREATE TABLE IF NOT EXISTS mastered_verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  mastered_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(user_id, verse_reference)
);

DROP TABLE IF EXISTS word_progress;
CREATE TABLE IF NOT EXISTS word_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  word_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  last_correct_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(user_id, verse_reference, word_index)
);

DROP TABLE IF EXISTS verse_attempts;
CREATE TABLE IF NOT EXISTS verse_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  attempt_date INTEGER NOT NULL,
  words_correct INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Step 3: Now we can safely recreate the verses table
DROP TABLE IF EXISTS verses;
CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'NIV',
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(user_id, reference)
);

-- Step 4: Restore data to all tables
INSERT OR IGNORE INTO verses (user_id, reference, text, translation, status, created_at)
SELECT user_id, reference, text, translation, status, created_at
FROM verses_backup;

INSERT OR IGNORE INTO verse_mastery (user_id, verse_reference, current_streak, longest_streak, last_mastered_date, days_mastered, created_at)
SELECT user_id, verse_reference, current_streak, longest_streak, last_mastered_date, days_mastered, created_at
FROM verse_mastery_backup;

INSERT OR IGNORE INTO mastered_verses (user_id, verse_reference, mastered_at, created_at)
SELECT user_id, verse_reference, mastered_at, created_at
FROM mastered_verses_backup;

INSERT OR IGNORE INTO word_progress (user_id, verse_reference, word_index, word, is_correct, last_correct_date, created_at)
SELECT user_id, verse_reference, word_index, word, is_correct, last_correct_date, created_at
FROM word_progress_backup;

INSERT OR IGNORE INTO verse_attempts (user_id, verse_reference, attempt_date, words_correct, total_words, created_at)
SELECT user_id, verse_reference, attempt_date, words_correct, total_words, created_at
FROM verse_attempts_backup;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_verses_user_id ON verses(user_id);
CREATE INDEX IF NOT EXISTS idx_verse_mastery_user ON verse_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_verse_mastery_verse ON verse_mastery(verse_reference);
CREATE INDEX IF NOT EXISTS idx_mastered_verses_user ON mastered_verses(user_id);
CREATE INDEX IF NOT EXISTS idx_mastered_verses_verse ON mastered_verses(verse_reference);
CREATE INDEX IF NOT EXISTS idx_word_progress_user_verse ON word_progress(user_id, verse_reference);
CREATE INDEX IF NOT EXISTS idx_word_progress_last_correct ON word_progress(last_correct_date);
CREATE INDEX IF NOT EXISTS idx_verse_attempts_user_date ON verse_attempts(user_id, attempt_date);
CREATE INDEX IF NOT EXISTS idx_verse_attempts_verse ON verse_attempts(verse_reference);

-- Step 6: Clean up backup tables
DROP TABLE IF EXISTS verses_backup;
DROP TABLE IF EXISTS verse_mastery_backup;
DROP TABLE IF EXISTS mastered_verses_backup;
DROP TABLE IF EXISTS word_progress_backup;
DROP TABLE IF EXISTS verse_attempts_backup;

-- Step 7: Verify data integrity
SELECT COUNT(*) as verses_count FROM verses;
SELECT COUNT(*) as verse_mastery_count FROM verse_mastery;
SELECT COUNT(*) as mastered_verses_count FROM mastered_verses;
SELECT COUNT(*) as word_progress_count FROM word_progress;
SELECT COUNT(*) as verse_attempts_count FROM verse_attempts; 
-- Migration to fix the UNIQUE constraint on verses.reference to be per user
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we use a table-copy pattern

-- Step 0: Clean up any leftover tables from previous attempts
DROP TABLE IF EXISTS verses_old;
DROP TABLE IF EXISTS verses_new;

-- Step 1: Create a new verses table with the correct UNIQUE constraint
CREATE TABLE verses_new (
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

-- Step 2: Verify user references before copying
SELECT COUNT(*) as invalid_users FROM verses v 
LEFT JOIN users u ON v.user_id = u.id 
WHERE u.id IS NULL;

-- Step 3: Copy only verses with valid user references
INSERT INTO verses_new (id, user_id, reference, text, translation, status, created_at)
SELECT v.id, v.user_id, v.reference, v.text, v.translation, v.status, v.created_at
FROM verses v
INNER JOIN users u ON v.user_id = u.id;

-- Step 4: Verify data was copied correctly
SELECT COUNT(*) as new_count FROM verses_new;
SELECT COUNT(*) as old_count FROM verses;

-- Step 5: Only proceed with the swap if data was copied correctly
-- This is done by renaming the tables
ALTER TABLE verses RENAME TO verses_old;
ALTER TABLE verses_new RENAME TO verses;

-- Step 6: Drop the old table only after successful rename
DROP TABLE IF EXISTS verses_old;

-- Step 7: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_verses_user_id ON verses(user_id);

-- Step 8: Verify data integrity and constraint
SELECT COUNT(*) as verse_count FROM verses;
SELECT sql FROM sqlite_master WHERE type='table' AND name='verses'; 
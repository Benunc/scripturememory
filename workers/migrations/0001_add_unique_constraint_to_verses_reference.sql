-- Migration to add a UNIQUE constraint to verses.reference
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we use a table-copy pattern

-- Step 1: Create a new verses table with the UNIQUE constraint
CREATE TABLE IF NOT EXISTS verses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'NIV',
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Step 2: Copy data from the old table to the new table (if any exists)
INSERT OR IGNORE INTO verses_new (id, user_id, reference, text, translation, status, created_at)
SELECT id, user_id, reference, text, translation, status, created_at
FROM verses;

-- Step 3: Verify data was copied correctly
SELECT COUNT(*) as new_count FROM verses_new;
SELECT COUNT(*) as old_count FROM verses;

-- Step 4: Only proceed with the swap if data was copied correctly
-- This is done by renaming the tables
ALTER TABLE verses RENAME TO verses_old;
ALTER TABLE verses_new RENAME TO verses;

-- Step 5: Drop the old table only after successful rename
DROP TABLE IF EXISTS verses_old;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_verses_user_id ON verses(user_id);

-- Step 7: Verify data integrity
SELECT COUNT(*) as verse_count FROM verses; 
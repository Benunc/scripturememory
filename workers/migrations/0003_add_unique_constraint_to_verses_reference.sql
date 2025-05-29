-- Migration to add a UNIQUE constraint to verses.reference
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we use a table-copy pattern

-- Step 1: Create a new verses table with the UNIQUE constraint
CREATE TABLE verses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'NIV',
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Step 2: Copy data from the old table to the new table
INSERT INTO verses_new (id, user_id, reference, text, translation, status, created_at)
SELECT id, user_id, reference, text, translation, status, created_at
FROM verses;

-- Step 3: Drop the old table
DROP TABLE verses;

-- Step 4: Rename the new table to the original name
ALTER TABLE verses_new RENAME TO verses;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_verses_user_id ON verses(user_id); 
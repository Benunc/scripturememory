-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_login_at INTEGER,
  -- Donation tracking fields
  has_donated BOOLEAN DEFAULT FALSE,
  total_donations INTEGER DEFAULT 0,  -- in cents
  donation_count INTEGER DEFAULT 0,
  last_donation_date INTEGER,
  last_donation_amount INTEGER,  -- in cents
  -- Optional: Additional user preferences
  preferred_translation TEXT DEFAULT 'NIV',
  notification_preferences JSON  -- For future use
);

-- Create magic_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Create verses table if it doesn't exist
CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'NIV',
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add gamification-related columns to users table if they don't exist
SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='has_donated') 
    THEN 'ALTER TABLE users ADD COLUMN has_donated BOOLEAN DEFAULT FALSE;'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='total_donations') 
    THEN 'ALTER TABLE users ADD COLUMN total_donations INTEGER DEFAULT 0;'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='donation_count') 
    THEN 'ALTER TABLE users ADD COLUMN donation_count INTEGER DEFAULT 0;'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='last_donation_date') 
    THEN 'ALTER TABLE users ADD COLUMN last_donation_date INTEGER;'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='last_donation_amount') 
    THEN 'ALTER TABLE users ADD COLUMN last_donation_amount INTEGER;'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='preferred_translation') 
    THEN 'ALTER TABLE users ADD COLUMN preferred_translation TEXT DEFAULT "NIV";'
END;

SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('users') WHERE name='notification_preferences') 
    THEN 'ALTER TABLE users ADD COLUMN notification_preferences JSON;'
END;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_has_donated ON users(has_donated);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verses_user_id ON verses(user_id); 
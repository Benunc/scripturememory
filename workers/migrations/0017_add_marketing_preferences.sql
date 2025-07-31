-- Add marketing preferences to users table
ALTER TABLE users ADD COLUMN marketing_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN marketing_opt_in_date INTEGER;
ALTER TABLE users ADD COLUMN marketing_opt_out_date INTEGER;

-- Add marketing preference to magic_links table
ALTER TABLE magic_links ADD COLUMN marketing_opt_in BOOLEAN DEFAULT FALSE;

-- Create marketing_events table for tracking
CREATE TABLE marketing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'opt_in', 'opt_out', 'email_sent', 'email_opened', 'email_clicked'
  email_list TEXT, -- 'updates', 'features', 'support'
  metadata TEXT, -- JSON for additional data
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_marketing_opt_in ON users(marketing_opt_in);
CREATE INDEX IF NOT EXISTS idx_marketing_events_user_id ON marketing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_event_type ON marketing_events(event_type); 
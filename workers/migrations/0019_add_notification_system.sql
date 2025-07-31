-- Add notification logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  user_id INTEGER,
  user_email TEXT,
  details TEXT NOT NULL, -- JSON string
  sent_at INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Add notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_by INTEGER,
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert default notification settings
INSERT OR IGNORE INTO notification_settings (notification_type, enabled) VALUES
  ('new_user', TRUE),
  ('verse_mastered', TRUE),
  ('guess_streak', TRUE),
  ('login_streak', TRUE),
  ('marketing_error', TRUE),
  ('system_error', TRUE);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id); 
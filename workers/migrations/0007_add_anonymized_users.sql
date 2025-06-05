-- Create table for anonymized user data
CREATE TABLE anonymized_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    verses_mastered INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    verses TEXT NOT NULL DEFAULT '[]',
    mastery_progress TEXT NOT NULL DEFAULT '[]',
    total_point_events INTEGER NOT NULL DEFAULT 0,
    total_word_progress INTEGER NOT NULL DEFAULT 0,
    total_verse_attempts INTEGER NOT NULL DEFAULT 0,
    total_mastered_verses INTEGER NOT NULL DEFAULT 0,
    total_verse_mastery INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT NOT NULL
);

-- Create index for querying by original user ID
CREATE INDEX idx_anonymized_users_original_id ON anonymized_users(original_user_id);

-- Create index for querying by deletion date
CREATE INDEX idx_anonymized_users_deleted_at ON anonymized_users(deleted_at); 
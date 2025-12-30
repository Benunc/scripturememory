-- Create family games table
CREATE TABLE IF NOT EXISTS family_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_code TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  auto_approve_participants BOOLEAN DEFAULT TRUE,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300,
  current_round INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Index to ensure no two active games have the same code
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_games_code_active 
  ON family_games(game_code) WHERE is_active = TRUE;

-- Create game rounds table (each round is a verse)
CREATE TABLE IF NOT EXISTS family_game_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  word_indices_to_hide TEXT NOT NULL,
  round_available_at INTEGER,
  round_soft_closed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_number)
);

-- Create game participants table (NO user_id for participants - just display names)
CREATE TABLE IF NOT EXISTS family_game_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  is_active BOOLEAN DEFAULT TRUE,
  last_activity INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  UNIQUE(game_id, participant_id),
  UNIQUE(game_id, display_name)
);

-- Create participant progress per round table
CREATE TABLE IF NOT EXISTS family_game_round_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  round_started_at INTEGER,
  round_ended_at INTEGER,
  current_word_index INTEGER DEFAULT 0,
  is_finished BOOLEAN DEFAULT FALSE,
  is_ready_for_next_round BOOLEAN DEFAULT FALSE,
  finished_reason TEXT,
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_id, participant_id)
);

-- Create word selections table (for scoring/tracking)
CREATE TABLE IF NOT EXISTS family_game_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  word_index INTEGER NOT NULL,
  selected_word TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INTEGER NOT NULL,
  streak_count INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  selected_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE
);

-- Create index for rate limiting checks
CREATE INDEX IF NOT EXISTS idx_family_game_selections_recent 
  ON family_game_selections(participant_id, selected_at);

-- Create game statistics table
CREATE TABLE IF NOT EXISTS family_game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  rounds_completed INTEGER DEFAULT 0,
  correct_selections INTEGER DEFAULT 0,
  incorrect_selections INTEGER DEFAULT 0,
  words_completed INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  average_time_per_word_ms INTEGER DEFAULT 0,
  total_time_ms INTEGER DEFAULT 0,
  accuracy_percentage REAL DEFAULT 0,
  rank INTEGER,
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE
);

-- Create round-specific statistics table
CREATE TABLE IF NOT EXISTS family_game_round_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  correct_selections INTEGER DEFAULT 0,
  incorrect_selections INTEGER DEFAULT 0,
  words_completed INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  accuracy_percentage REAL DEFAULT 0,
  time_taken_ms INTEGER DEFAULT 0,
  rank INTEGER,
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_id, participant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_games_code ON family_games(game_code);
CREATE INDEX IF NOT EXISTS idx_family_games_active ON family_games(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_family_games_status ON family_games(status);
CREATE INDEX IF NOT EXISTS idx_family_game_rounds_game ON family_game_rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_participants_game ON family_game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_participants_id ON family_game_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_family_game_round_progress_game ON family_game_round_progress(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_round_progress_round ON family_game_round_progress(round_id);
CREATE INDEX IF NOT EXISTS idx_family_game_selections_game ON family_game_selections(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_selections_round ON family_game_selections(round_id);
CREATE INDEX IF NOT EXISTS idx_family_game_selections_participant ON family_game_selections(participant_id);
CREATE INDEX IF NOT EXISTS idx_family_game_stats_game ON family_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_round_stats_game ON family_game_round_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_family_game_round_stats_round ON family_game_round_stats(round_id);



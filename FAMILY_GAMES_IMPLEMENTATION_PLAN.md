# Family Collaborative Memorization Games - Implementation Plan

## Overview

This plan outlines the implementation of a collaborative memorization feature for families. Multiple people can join a shared **game** on their phones and participate in accuracy-based challenges where they select words in verses. Each game consists of multiple **rounds** (verses). The creator selects which words to hide in each verse. Each participant works through rounds at their own pace with local device timers - the creator opens each round, then participants start when ready. No one can proceed to the next round until all active participants finish the current round.

### Key Features

- **Independent Local Timers**: Each participant starts their own round when ready, with a timer running on their device
- **Round Availability**: Creator "opens" each round, making it available for participants to start
- **Ready State Management**: Participants finish individually and are marked as "ready for next round"
- **Soft-Disconnect**: Creator or any participant can soft-disconnect others to advance group (allows rejoin)
- **Any Participant Can Advance**: If creator unavailable, any participant can open next round
- **Focused Gameplay**: During rounds, participants only see their own progress (no leaderboard distraction)
- **Between-Rounds Leaderboard**: Leaderboard appears between rounds, polls every 5 seconds

## Key Terminology

- **Game**: A collection of rounds that participants join and play together. Each game has a unique numeric `id` (permanent) and a 6-character `code` (temporal, reusable).
- **Round**: A single verse with creator-selected words to hide. Creator "opens" the round, then each participant starts when ready with their own local timer.
- **Participant**: A person who joins a game (no authentication required, just display name). Each participant gets a unique UUID stored in localStorage.
- **Creator**: The authenticated user who creates the game, selects verses, and chooses which word positions to hide.
- **Game Code**: 6-character alphanumeric code used to join games (e.g., "ABC123"). Can be reused after game expires, but not simultaneously.

## Architecture

**Update Strategy:**
- Game state stored in D1 database
- **Creators**: Poll game state every 1.5 seconds to see all participant updates
- **Participants**:
  - **During round**: No polling, no leaderboard - only see own progress from word selection responses
  - **Between rounds**: Poll every 5 seconds to see leaderboard and round availability
- No WebSocket infrastructure needed
- Simple, reliable, works with existing infrastructure

## Database Schema

### Migration: `0021_create_family_games.sql`

```sql
-- Family games table
CREATE TABLE family_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique game ID (numeric, sequential, never reused)
  game_code TEXT NOT NULL,              -- 6-character code (can be reused, but not simultaneously)
  created_by INTEGER NOT NULL,          -- User ID of authenticated creator only
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'completed', 'ended'
  auto_approve_participants BOOLEAN DEFAULT TRUE, -- Auto-approve or manual approval
  time_limit_seconds INTEGER NOT NULL DEFAULT 300, -- Time limit per round (default 5 minutes)
  current_round INTEGER,                -- Current active round number (1, 2, 3, etc.)
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,          -- Auto-cleanup after 1 hour
  is_active BOOLEAN DEFAULT TRUE,
  started_at INTEGER,                   -- When game actually started
  completed_at INTEGER,                 -- When all participants finished all rounds
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Index to ensure no two active games have the same code
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_games_code_active 
  ON family_games(game_code) WHERE is_active = TRUE;

-- Game rounds (each round is a verse)
CREATE TABLE family_game_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,        -- 1, 2, 3, etc.
  verse_reference TEXT NOT NULL,        -- Verse being memorized
  verse_text TEXT NOT NULL,             -- Full verse text (can be very long - whole chapters)
  word_indices_to_hide TEXT NOT NULL,   -- JSON array of objects: [{"index": 2, "type": "verb"}, {"index": 5, "type": "noun"}]
  round_available_at INTEGER,           -- When this round became available (creator/participant opened it)
  round_soft_closed_at INTEGER,         -- When round was soft-closed (allows catch-up)
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_number)
);

-- Game participants (NO user_id for participants - just display names)
CREATE TABLE family_game_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,       -- Unique ID for this participant (UUID, not user_id)
  display_name TEXT NOT NULL,          -- Name shown in game (enforced unique per game)
  is_approved BOOLEAN DEFAULT FALSE,   -- Creator must approve (or auto-approve)
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'left', 'soft_disconnected'
  joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  is_active BOOLEAN DEFAULT TRUE,
  last_activity INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  UNIQUE(game_id, participant_id),
  UNIQUE(game_id, display_name)  -- Enforce unique display names per game
);

-- Participant progress per round
CREATE TABLE family_game_round_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  round_started_at INTEGER,            -- When this participant started this round (local device time)
  round_ended_at INTEGER,               -- When this participant finished this round
  current_word_index INTEGER DEFAULT 0, -- Progress through selected words (index in word_indices_to_hide array)
  is_finished BOOLEAN DEFAULT FALSE,   -- Has this participant finished this round?
  is_ready_for_next_round BOOLEAN DEFAULT FALSE, -- Participant ready for next round (finished and waiting)
  finished_reason TEXT,                 -- 'completed', 'time_expired', 'left', 'soft_disconnected'
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_id, participant_id)
);

-- Word selections (for scoring/tracking)
CREATE TABLE family_game_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,       -- References participant, not user
  word_index INTEGER NOT NULL,         -- Which word in the verse they selected (actual verse position)
  selected_word TEXT NOT NULL,         -- The word they chose (capped at 100 chars)
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INTEGER NOT NULL,       -- Milliseconds since round started (for speed scoring)
  streak_count INTEGER DEFAULT 0,       -- Current streak of correct answers
  points_earned INTEGER DEFAULT 0,    -- Points for this selection (calculated)
  selected_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE
);

-- Index for rate limiting checks
CREATE INDEX IF NOT EXISTS idx_family_game_selections_recent 
  ON family_game_selections(participant_id, selected_at);

-- Game statistics (winners, scores, rounds completed)
CREATE TABLE family_game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,        -- Across all rounds
  rounds_completed INTEGER DEFAULT 0,    -- How many rounds they finished
  correct_selections INTEGER DEFAULT 0,  -- Total across all rounds
  incorrect_selections INTEGER DEFAULT 0, -- Total across all rounds
  words_completed INTEGER DEFAULT 0,      -- Total words across all rounds
  longest_streak INTEGER DEFAULT 0,      -- Longest consecutive correct answers (across all rounds)
  average_time_per_word_ms INTEGER DEFAULT 0, -- Average time per word
  total_time_ms INTEGER DEFAULT 0,        -- Total time across all rounds
  accuracy_percentage REAL DEFAULT 0,     -- (correct / total) * 100
  rank INTEGER,                           -- Final ranking (1 = winner)
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE
);

-- Round-specific statistics
CREATE TABLE family_game_round_stats (
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
  rank INTEGER,                           -- Ranking for this round
  FOREIGN KEY (game_id) REFERENCES family_games(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES family_game_rounds(id) ON DELETE CASCADE,
  UNIQUE(game_id, round_id, participant_id)
);

-- Indexes for performance
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
```

## Game Code Generation

Game codes are 6 characters and can be reused, but not simultaneously. The unique `id` (numeric, sequential) is the permanent identifier.

```typescript
async function generateUniqueGameCode(env: Env): Promise<string> {
  const db = getDB(env);
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code is currently in use by an active game
    const existing = await db.prepare(`
      SELECT id FROM family_games 
      WHERE game_code = ? AND is_active = TRUE
    `).bind(code).first();
    
    if (!existing) {
      return code; // Code is available
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique game code after multiple attempts');
}
```

## API Endpoints

### 1. Create Game (AUTH REQUIRED - Creator Only)
```http
POST /family-games/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "rounds": [
    {
      "roundNumber": 1,
      "verseReference": "John 3:16",
      "verseText": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
      "wordIndicesToHide": [
        {"index": 2, "type": "adverb"},
        {"index": 5, "type": "verb"},
        {"index": 8, "type": "noun"},
        {"index": 12, "type": "verb"},
        {"index": 15, "type": "noun"},
        {"index": 18, "type": "verb"},
        {"index": 22, "type": "adjective"}
      ]
    }
  ],
  "autoApproveParticipants": true,
  "timeLimitSeconds": 300
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "game": {
    "id": 123,
    "gameCode": "ABC123",
    "status": "waiting",
    "autoApproveParticipants": true,
    "timeLimitSeconds": 300,
    "rounds": [...],
    "createdAt": 1234567890,
    "expiresAt": 1234571490
  }
}
```

**Implementation Notes:**
- Validate word indices are within verse bounds
- Validate word types are valid: "noun", "adjective", "verb", "adverb", "other"
- Store `wordIndicesToHide` as JSON array of objects: `[{"index": 2, "type": "verb"}, ...]`
- Creator automatically added as first approved participant
- Game expires after 1 hour

---

### 2. Join Game (NO AUTHENTICATION REQUIRED)
```http
POST /family-games/:gameCode/join
Content-Type: application/json

{
  "displayName": "Mom"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "participantId": "uuid-here",
  "displayName": "Mom",  // May have "(2)" suffix if duplicate
  "game": {...}
}
```

**Implementation Notes:**
- Check if participant already exists (rejoin scenario) - return existing participantId
- Enforce unique display name (auto-add "(2)", "(3)" suffix if duplicate)
- **Display name validation**: Max 50 characters, only letters, numbers, and spaces allowed
- Store participantId in localStorage for future requests

---

### 3. Get Game State (Polling Endpoint - NO AUTH REQUIRED)
```http
GET /family-games/:gameCode/state
X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "game": {
    "id": 123,
    "gameCode": "ABC123",
    "status": "playing",
    "currentRound": 1,
    "timeLimitSeconds": 300,
    "rounds": [
      {
        "roundNumber": 1,
        "verseReference": "John 3:16",
        "verseText": "For God so loved the world...",
        "wordIndicesToHide": [
          {"index": 2, "type": "adverb"},
          {"index": 5, "type": "verb"},
          {"index": 8, "type": "noun"},
          {"index": 12, "type": "verb"},
          {"index": 15, "type": "noun"},
          {"index": 18, "type": "verb"},
          {"index": 22, "type": "adjective"}
        ],
        "roundStatus": "available",
        "roundAvailableAt": 1234567890,
        "participantsReady": 2,
        "totalActiveParticipants": 3,
        "participantsStarted": 3
      }
    ],
    "participants": [...],
    "leaderboard": [...]
  }
}
```

**Implementation Notes:**
- **Creators only**: Should poll every 1.5 seconds to see participant updates
- **Participants**: 
  - **During round**: No polling - only see their own progress
  - **Between rounds**: Poll every 5 seconds to see leaderboard and when next round opens
  - Call this endpoint when:
    - Page loads/refreshes
    - Between rounds (to see leaderboard and round availability)
    - After finishing a round (to see leaderboard)
- Updates `last_activity` timestamp for caller
- Round status: `"not_available"`, `"available"`
- **During round**: Participants don't need to call this endpoint - they only see their own progress

---

### 4. Open Round (Creator or Any Participant)
```http
POST /family-games/:gameCode/rounds/:roundNumber/open
Authorization: Bearer <token>  // OR X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "roundAvailableAt": 1234567890,
  "timeLimitSeconds": 300,
  "round": {...},
  "message": "Round 1 is now available! Participants can start when ready."
}
```

**Implementation Notes:**
- Creator OR any approved participant can open next round
- Check if all active (non-soft-disconnected) participants are ready for previous round
- Use transaction to: open new round + soft-close previous + update current_round

---

### 5. Start Round (Participant - NO AUTH REQUIRED)
```http
POST /family-games/:gameCode/rounds/:roundNumber/start
X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "roundStartedAt": 1234567890,  // Client uses this to start local timer
  "timeLimitSeconds": 300,
  "round": {...},
  "message": "Round 1 started! Your timer is running."
}
```

**Implementation Notes:**
- Participant starts their own round independently
- Records `round_started_at` in progress table (for reference, but timer is local)
- Client calculates timer from this timestamp

---

### 6. Select Word (NO AUTH REQUIRED)
```http
POST /family-games/:gameCode/rounds/:roundNumber/select-word
X-Participant-Id: <participantId>
Content-Type: application/json

{
  "selectedWord": "loved",
  "timeTakenMs": 2500  // Client calculates from local timer
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "isCorrect": true,
  "pointsEarned": 18,
  "streakCount": 3,
  "message": "Correct! Streak of 3!",
  "roundProgress": {
    "currentWordIndex": 3,
    "totalWords": 7,
    "wordsCompleted": 3,
    "points": 54,
    "streak": 3
  },
  "nextWordOptions": ["word1", "word2", "word3", "word4"],  // 4 options for next word (if not finished)
  "isRoundComplete": false  // true if participant finished all words in round
}
```

**Implementation Notes:**
- **During round**: Response includes ONLY participant's own progress (no leaderboard, no other participants)
- If participant completes round (`isRoundComplete: true`), they should navigate to between-rounds view
- If participant not finished, include `nextWordOptions` for next word selection
- No need to fetch other players' data during active gameplay

**Implementation Notes:**
- **Rate limiting**: Max 1 selection per 100ms per participant
- **Input validation**: `selectedWord` must be string, max 100 characters
- **Timer validation**: If `timeTakenMs >= timeLimitSeconds * 1000`, finish participant's round
- **Use transaction**: Record selection + update progress (atomic)
- If participant completes all words, mark as finished and ready for next round

---

### 7. Get Participant Round Progress (NO AUTH REQUIRED)
```http
GET /family-games/:gameCode/rounds/:roundNumber/progress
X-Participant-Id: <participantId>
```

**Implementation Notes:**
- Returns individual participant's progress for specific round
- Includes time remaining (calculated client-side from `roundStartedAt`)

---

### 8. Approve Participant (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/approve-participant
Authorization: Bearer <token>
Content-Type: application/json

{
  "participantId": "uuid-here",
  "approve": true
}
```

---

### 9. Start Game (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/start
Authorization: Bearer <token>
```

**Implementation Notes:**
- Changes game status from "waiting" to "playing"
- Sets `current_round = 1`
- Creator must then call `/rounds/1/open` to begin first round

---

### 10. Finish Round (NO AUTH REQUIRED - Called automatically)
```http
POST /family-games/:gameCode/rounds/:roundNumber/finish
X-Participant-Id: <participantId>
```

**Implementation Notes:**
- Called automatically when participant completes or time expires
- Sets `is_finished = true` and `is_ready_for_next_round = true`

---

### 11. Leave Game (NO AUTH REQUIRED)
```http
POST /family-games/:gameCode/leave
X-Participant-Id: <participantId>
```

**Implementation Notes:**
- Marks participant status as `"left"` and `is_active = false`
- If in a round, marks round progress as finished with reason `"left"`

---

### 12. Mark Participant Status (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/mark-participant
Authorization: Bearer <token>
Content-Type: application/json

{
  "participantId": "uuid-here",
  "status": "soft_disconnected"  // "active", "left", "soft_disconnected"
}
```

---

### 13. Soft-Disconnect Participant (Creator or Any Participant)
```http
POST /family-games/:gameCode/soft-disconnect
Authorization: Bearer <token>  // OR X-Participant-Id: <participantId>
Content-Type: application/json

{
  "participantId": "uuid-here"
}
```

**Implementation Notes:**
- Marks participant as `"soft_disconnected"` (allows rejoin)
- Sets `is_ready_for_next_round = true` so group can advance
- If participant reconnects/completes round, they're allowed back in

---

### 14. End Game (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/end
Authorization: Bearer <token>
```

## Scoring System

```typescript
function calculatePoints(
  isCorrect: boolean,
  timeTakenMs: number,
  streakCount: number,
  timeLimitMs: number
): number {
  if (!isCorrect) return 0;
  
  // Base points for correct answer
  let points = 10;
  
  // Speed bonus: faster = more points (up to +10 bonus)
  const averageTimePerWord = timeLimitMs / 20; // Assume ~20 words average
  const speedRatio = averageTimePerWord / timeTakenMs;
  const speedBonus = Math.min(10, Math.max(0, speedRatio * 10));
  points += speedBonus;
  
  // Streak multiplier: consecutive correct answers
  // Streak of 1 = no bonus, streak of 2+ = +2 per streak
  const streakBonus = Math.max(0, (streakCount - 1) * 2);
  points += streakBonus;
  
  return Math.round(points);
}
```

**Scoring Breakdown:**
- **Correct Answer**: 10 base points
- **Speed Bonus**: 0-10 points (faster = more points)
- **Streak Bonus**: +2 points per consecutive correct (after first)
- **Incorrect Answer**: 0 points, breaks streak

**Final Ranking:**
1. Total Points (primary)
2. Words Completed (tiebreaker)
3. Accuracy Percentage (tiebreaker)
4. Longest Streak (tiebreaker)

## Word Selection: Multiple Choice

**Implementation:**
- Show 4 word options below the verse
- One option is the correct next word
- Three are distractors generated based on word type selected during game creation
- Large touch targets for mobile
- Visual feedback: Green (correct), Red (incorrect)

**Word Type Selection (During Game Creation):**
- When creator selects a word to hide, they also select the word type:
  - Noun
  - Adjective
  - Verb
  - Adverb
  - Other (default)
- Word type stored with each hidden word in `word_indices_to_hide` as JSON array of objects: `[{"index": 2, "type": "verb"}, ...]`

**Distractor Generation (Server-Side):**
- For each hidden word, generate 3 distractors of the same word type
- **Algorithm:**
  1. Extract all words of the same type from the verse (excluding correct answer)
  2. If 3+ words of that type available, randomly select 3
  3. If fewer than 3 words of that type, fill remaining with:
     - Words from nearby positions in verse (regardless of type)
     - Common words of that type that might fit context
- Ensure distractors are different from correct answer
- Shuffle the 4 options (1 correct + 3 distractors) before sending to client

## Helper Functions

### `checkAllParticipantsReady(gameId, roundId, env)`
Checks if all active (non-soft-disconnected) participants are ready for next round.

### `ensureUniqueDisplayName(gameId, displayName, env)`
Ensures display name is unique per game, adding "(2)", "(3)", etc. if needed.

**Validation:**
- Max 50 characters
- Only letters, numbers, and spaces allowed
- Trim whitespace

### `getParticipantByDisplayName(gameId, displayName, env)`
Finds existing participant by display name (for rejoin scenario).

### `softDisconnectParticipant(gameId, roundId, participantId, env)`
Marks participant as soft-disconnected and ready for next round (allows rejoin).

### `generateUniqueGameCode(env)`
Generates unique 6-character game code (checks for active games with same code).

## Frontend Implementation

### State Persistence (localStorage)

```typescript
interface StoredParticipantData {
  gameCode: string;
  participantId: string;
  displayName: string;
  currentRound?: number;
  lastUpdated: number;
}

function storeParticipantData(data: StoredParticipantData) {
  localStorage.setItem(`family_game_${data.gameCode}`, JSON.stringify(data));
}

function getParticipantData(gameCode: string): StoredParticipantData | null {
  const stored = localStorage.getItem(`family_game_${gameCode}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// On page load/refresh, restore participant state
function restoreParticipantState(): StoredParticipantData | null {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('family_game_'));
  if (keys.length === 0) return null;
  
  const allData = keys.map(k => {
    try {
      return JSON.parse(localStorage.getItem(k) || '{}');
    } catch {
      return null;
    }
  }).filter(Boolean) as StoredParticipantData[];
  
  if (allData.length === 0) return null;
  return allData.sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
}
```

### State Management Hook (Creators Only - Polling)

```typescript
// For creators: Poll to see participant updates
function useFamilyGamePolling(gameCode: string, sessionToken: string) {
  const [state, setState] = useState<FamilyGameState | null>(null);
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (!gameCode || !isAuthenticated) return;
    
    const pollInterval = setInterval(async () => {
      const response = await fetch(`/api/family-games/${gameCode}/state`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json();
      setState(data.game);
    }, 1500); // Poll every 1.5 seconds
    
    return () => clearInterval(pollInterval);
  }, [gameCode, isAuthenticated, sessionToken]);
  
  return state;
}

// For participants: Poll between rounds only (every 5 seconds)
function useFamilyGameBetweenRounds(gameCode: string, participantId: string) {
  const [state, setState] = useState<FamilyGameState | null>(null);
  const [isBetweenRounds, setIsBetweenRounds] = useState(false);
  
  useEffect(() => {
    if (!gameCode || !participantId || !isBetweenRounds) return;
    
    const pollInterval = setInterval(async () => {
      const response = await fetch(`/api/family-games/${gameCode}/state`, {
        headers: {
          'X-Participant-Id': participantId
        }
      });
      const data = await response.json();
      setState(data.game);
    }, 5000); // Poll every 5 seconds between rounds
    
    return () => clearInterval(pollInterval);
  }, [gameCode, participantId, isBetweenRounds]);
  
  return { state, setIsBetweenRounds };
}

// For participants: Fetch state once (on page load, after finishing round)
async function fetchGameState(gameCode: string, participantId: string): Promise<FamilyGameState> {
  const response = await fetch(`/api/family-games/${gameCode}/state`, {
    headers: {
      'X-Participant-Id': participantId
    }
  });
  const data = await response.json();
  return data.game;
}
```

**Usage:**
- **Creators**: Use `useFamilyGamePolling` hook for continuous updates (poll every 1.5 seconds)
- **Participants**:
  - **During round**: No polling, no leaderboard - only see their own progress
    - Progress comes from word selection responses
    - Local timer shows time remaining
    - No need to fetch other players' data
  - **Between rounds**: Poll every 5 seconds to see:
    - Leaderboard (all participants' scores)
    - Round availability (when next round opens)
    - Other participants' status (who's ready, who's still playing)
  - **Page load/refresh**: Fetch state once on mount
  - **After finishing round**: Navigate to between-rounds view, start polling leaderboard

**Key Points**:
- During active gameplay, participants only see their own progress (simpler, less distraction)
- Leaderboard appears between rounds (when it matters most)
- Between rounds polling is less frequent (5 seconds) since updates are less critical

### Client-Side Timer Calculation

```typescript
// Calculate timer from server timestamp (local device timer)
const timeRemaining = Math.max(0, 
  (round.roundStartedAt + game.timeLimitSeconds * 1000) - Date.now()
);

// If timeRemaining <= 0, disable word selection immediately
// Fetch final state when timer expires
```

## Cleanup Job

Add scheduled worker (Cloudflare Cron Triggers) to clean up expired games:

```typescript
// In workers/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === '0 * * * *') { // Every hour
      const db = getDB(env);
      await db.prepare(`
        UPDATE family_games 
        SET is_active = FALSE 
        WHERE expires_at < ? AND is_active = TRUE
      `).bind(Date.now()).run();
    }
  }
};
```

## Implementation Phases

### Phase 1: Backend (Local Development & Testing)

**1.1 Database Migration**
- [ ] Create `0021_create_family_games.sql` migration file
- [ ] Test migration locally
- [ ] Verify all indexes created correctly

**1.2 Core Backend Endpoints**
- [ ] Implement `createGame` endpoint
  - [ ] Validate word indices with types: `[{"index": 2, "type": "verb"}, ...]`
  - [ ] Store word types in `word_indices_to_hide` JSON
- [ ] Implement `joinGame` endpoint
  - [ ] Rejoin logic (check existing participant by display name)
  - [ ] Unique display names (auto-add suffix)
  - [ ] Display name validation: max 50 chars, letters/numbers/spaces only
- [ ] Implement `getGameState` endpoint
- [ ] Add routes to main router

**1.3 Round Management**
- [ ] Implement `openRound` endpoint (creator or participant)
- [ ] Implement `startRound` endpoint (participant)
- [ ] Implement `selectWord` endpoint
  - [ ] Rate limiting: max 1 per 100ms per participant
  - [ ] Generate distractors based on word type from `word_indices_to_hide`
  - [ ] Return `nextWordOptions` in response (4 options for next word if not finished)
  - [ ] Return ONLY participant's own progress (no leaderboard, no other participants) - participants don't see others during round
  - [ ] Return `isRoundComplete` flag when participant finishes all words
  - [ ] Use transactions (record selection + update progress)
- [ ] Implement `finishRound` endpoint
- [ ] Implement `getRoundProgress` endpoint

**1.4 Participant Management**
- [ ] Implement `approveParticipant` endpoint
- [ ] Implement `startGame` endpoint
- [ ] Implement `leaveGame` endpoint
- [ ] Implement `markParticipant` endpoint
- [ ] Implement `softDisconnectParticipant` endpoint
- [ ] Implement `endGame` endpoint

**1.5 Helper Functions**
- [ ] Implement `generateUniqueGameCode`
- [ ] Implement `ensureUniqueDisplayName`
  - [ ] Validate: max 50 chars, letters/numbers/spaces only
  - [ ] Auto-add suffix if duplicate
- [ ] Implement `getParticipantByDisplayName`
- [ ] Implement `checkAllParticipantsReady`
- [ ] Implement `softDisconnectParticipant` helper
- [ ] Implement scoring calculation function
- [ ] Implement distractor generation function
  - [ ] Input: correct word, word index, word type, verse text, all verse words
  - [ ] Extract all words of same type from verse (excluding correct)
  - [ ] If 3+ words of type available, randomly select 3
  - [ ] If fewer than 3, fill with nearby words or common words of that type
  - [ ] Output: 3 distractors (shuffled with correct word = 4 total options)

**1.6 Database Transactions**
- [ ] Ensure all critical operations use transactions:
  - Word selection (record + update progress)
  - Round opening (open new + soft-close previous)
  - Participant finishing (mark finished + mark ready)

**1.7 Cleanup Job**
- [ ] Add scheduled worker for expired games

**1.8 Backend Testing**
- [ ] Create test script for all endpoints
- [ ] Test game creation with multiple rounds
- [ ] Test joining and rejoin flow
- [ ] Test round opening and starting
- [ ] Test word selection (correct/incorrect)
- [ ] Test rate limiting
- [ ] Test soft-disconnect
- [ ] Test transactions (race conditions)
- [ ] Test expired game handling

---

### Phase 2: Frontend (Local Development & Testing)

**2.1 Game Creation UI**
- [ ] Create `GameCreator` component
- [ ] Implement round builder (add/remove rounds)
- [ ] Implement verse selector (My Verses / Sample Verses / Add New)
  - [ ] Support unlimited verse length (whole chapters)
  - [ ] Handle long verses with scrolling/word wrapping
- [ ] Implement word selection interface
  - [ ] Tap words to hide
  - [ ] **Word type selector**: When word selected, show dropdown/buttons for type:
    - Noun
    - Adjective
    - Verb
    - Adverb
    - Other (default)
  - [ ] Store both word index and type: `{"index": 2, "type": "verb"}`
  - [ ] Show selected words with their types
- [ ] Implement verse preview (show selected words as blanks)
- [ ] Implement game settings (time limit, auto-approve toggle)

**2.2 Game Joining UI**
- [ ] Create `GameJoiner` component
- [ ] Implement game code input
- [ ] Implement display name input
  - [ ] Validate: max 50 characters, only letters/numbers/spaces
  - [ ] Show validation errors
- [ ] Implement rejoin flow (check localStorage on load)

**2.3 Game Waiting Room & Between Rounds**
- [ ] Create `GameWaitingRoom` component (before game starts)
- [ ] Create `BetweenRounds` component (between rounds during game)
- [ ] Show list of rounds
- [ ] Show list of participants with approval status (waiting room only)
- [ ] Creator controls (approve participants, start game, open next round)
- [ ] Participant view (waiting for approval/game start)
- [ ] **Between rounds view**:
  - [ ] Show leaderboard (all participants' scores across all rounds)
  - [ ] Show round-by-round breakdown
  - [ ] Show who's ready for next round
  - [ ] Show "Round X Available" when creator/participant opens next round
- [ ] **Creator**: Use polling hook to see participant updates (every 1.5 seconds)
- [ ] **Participant**: 
  - [ ] Waiting room: Fetch state on page load, no polling
  - [ ] Between rounds: Poll every 5 seconds to see leaderboard and round availability

**2.4 Game Round Interface (During Active Round)**
- [ ] Create `GameRoundInterface` component
- [ ] Implement round availability display
- [ ] Implement "Start Round" button (participant)
- [ ] Implement verse display with blanks
  - [ ] Handle long verses (scrolling, word wrapping)
- [ ] Implement multiple choice word selector
  - [ ] Display 4 options (1 correct + 3 distractors from server)
  - [ ] Large touch targets for mobile
  - [ ] Visual feedback: Green (correct), Red (incorrect)
- [ ] Implement local timer display (calculated from `roundStartedAt`)
  - [ ] Update every second using `setInterval`
  - [ ] Disable word selection when timer expires
- [ ] Implement progress indicators (participant's own progress only)
  - [ ] Current word position (e.g., "Word 5 of 25")
  - [ ] Current streak count
  - [ ] Total points earned this round
  - [ ] Words completed this round
- [ ] **NO leaderboard during round** - participants only see their own progress
- [ ] When round completes (all words or timer expires), navigate to between-rounds view

**2.5 State Management**
- [ ] Implement `useFamilyGamePolling` hook (creators only - poll every 1.5 seconds)
- [ ] Implement `useFamilyGameBetweenRounds` hook (participants - poll every 5 seconds between rounds only)
- [ ] Implement `fetchGameState` function (participants - fetch once on page load, after finishing round)
- [ ] Implement localStorage persistence functions
- [ ] Implement restore participant state on page load
- [ ] Implement client-side timer calculation
- [ ] **Participants during round**: 
  - [ ] No polling, no leaderboard
  - [ ] Update own progress from word selection responses only
  - [ ] Local timer updates every second
- [ ] **Participants between rounds**:
  - [ ] Poll every 5 seconds to see leaderboard and round availability
  - [ ] Show leaderboard with all participants' scores
  - [ ] Show who's ready for next round
- [ ] **Creators**: Continuous polling (every 1.5 seconds) to see all participant updates

**2.6 Participant Management UI**
- [ ] Creator: Soft-disconnect participant controls
- [ ] Creator or Participant: Open next round button
- [ ] Show "All participants ready" status

**2.7 Game Complete UI**
- [ ] Create `GameComplete` component
- [ ] Show final leaderboard
- [ ] Show personal stats
- [ ] Show round-by-round breakdown

**2.8 Mobile Optimization**
- [ ] Large touch targets for word selection
- [ ] Responsive layout for phones
- [ ] Portrait orientation optimized
- [ ] Minimal scrolling required

**2.9 Frontend Testing**
- [ ] Test game creation flow (multiple rounds, word selection with types)
- [ ] Test word type selection UI (dropdown/buttons for each hidden word)
- [ ] Test joining with game code
- [ ] Test display name validation (max 50 chars, letters/numbers/spaces only)
- [ ] Test rejoin after refresh
- [ ] Test round opening and starting
- [ ] Test word selection UI (multiple choice with type-based distractors)
- [ ] Test during round: NO leaderboard shown, only own progress
- [ ] Test between rounds: Leaderboard shown, polls every 5 seconds
- [ ] Test creator polling (sees participant updates every 1.5 seconds)
- [ ] Test participant between-rounds polling (every 5 seconds)
- [ ] Test local timer calculation (updates every second)
- [ ] Test timer expiration (disables word selection, navigates to between-rounds)
- [ ] Test round completion (navigates to between-rounds view)
- [ ] Test mobile responsiveness
- [ ] Test with 2-5 simultaneous users across multiple rounds
- [ ] Test long verses (whole chapters - scrolling, performance)

---

### Phase 3: Production Deployment

**3.1 Backend Deployment**
- [ ] Run database migration in production
- [ ] Deploy backend endpoints to Cloudflare Workers
- [ ] Verify cleanup job is scheduled
- [ ] Test all endpoints in production environment

**3.2 Frontend Deployment**
- [ ] Deploy frontend to production
- [ ] Verify localStorage persistence works in production
- [ ] Test end-to-end flow in production

**3.3 Production Testing**
- [ ] Test with multiple real devices
- [ ] Test network failure scenarios
- [ ] Test refresh/rejoin scenarios
- [ ] Monitor for errors and performance issues

---

## Implementation Decisions (RESOLVED)

### ✅ Distractor Generation
- **Decision**: During game creation, creator selects word type (noun, adjective, verb, other) for each hidden word
- **Implementation**: Store word type with each hidden word, generate distractors of same type
- **Storage**: `word_indices_to_hide` as JSON array of objects: `[{"index": 2, "type": "verb"}, ...]`

### ✅ Display Name Validation
- **Decision**: Max 50 characters, only letters, numbers, and spaces allowed
- **Implementation**: Validate on join, trim whitespace, enforce uniqueness with suffix

### ✅ Verse Text Length
- **Decision**: Unlimited length (can handle whole chapters)
- **Implementation**: No server-side limit, all processing server-side, frontend handles scrolling

### ✅ Polling Strategy
- **Decision**: 
  - **Creators only**: Poll every 1.5 seconds to see participant updates
  - **Participants**: No polling - updates received only when making requests or refreshing
- **Implementation**: Separate hooks/functions for creators vs participants

### ✅ Rate Limiting
- **Decision**: 100ms minimum between word selections per participant
- **Implementation**: Server-side check on each word selection endpoint call

---

## Security & Validation

1. **Game Code Validation**
   - Validate format (6 alphanumeric)
   - Check expiration
   - Verify user is participant for state access

2. **Rate Limiting**
   - Server-side: max 1 selection per 100ms per participant
   - Client-side: throttle polling (creators only) to max 1 request/second

3. **Input Validation**
   - Display names: trim, max 50 characters, only letters/numbers/spaces
   - Word selections: string, max 100 characters
   - Word indices: validate within verse bounds
   - Verse text: unlimited length (can handle whole chapters)
   - All database writes protected by participant ID or authentication

4. **Database Transactions**
   - All critical multi-step operations use transactions
   - Prevents race conditions and inconsistent state

5. **Privacy**
   - Games are temporary (1 hour max, auto-expire)
   - No permanent storage of game data
   - Display names only (no emails shown)


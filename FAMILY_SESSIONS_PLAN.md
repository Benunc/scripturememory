# Family Collaborative Memorization Games - Implementation Plan

## Overview

This plan outlines the implementation of a collaborative memorization feature designed for families. Multiple people in the same room can join a shared **game** on their phones and participate in accuracy-based challenges where they select words in verses. Each game consists of multiple **rounds**, where each round is a verse. The creator selects which words to hide in each verse (from 1 word up to all words). **Each participant works through rounds at their own pace with local device timers** - the creator opens each round, then participants start when ready. No one can proceed to the next round until all active participants finish the current round. Scoring rewards accuracy, speed, and consecutive correct answers (streaks). The goal is to create an engaging, collaborative experience focused on memorization accuracy while keeping technical complexity minimal.

### Key Features

- **Independent Local Timers**: Each participant starts their own round when ready, with a timer running on their device. No server-side timer synchronization needed - simpler and more resilient.
- **Round Availability**: Creator "opens" each round, making it available for participants to start. Participants can start when ready, working at their own pace.
- **Ready State Management**: Participants finish individually and are marked as "ready for next round". Creator can only open next round when all active participants are ready.
- **Participant Management**: Creator can mark participants as "left" or "disconnected" to handle connectivity issues or participants who leave without using the leave button.
- **Simplified Synchronization**: No shared timers, no server-side time management, no race conditions around timer expiration. Each device manages its own timer.

## Key Terminology

- **Game**: A collection of rounds that participants join and play together. Each game has a unique 6-character code (e.g., "ABC123").
- **Round**: A single verse with creator-selected words to hide (e.g., "Round 1: John 3:16"). Creator "opens" the round, then each participant starts when ready with their own local timer. No one can proceed to the next round until everyone finishes their current round.
- **Participant**: A person who joins a game (no authentication required, just display name). Each participant gets a unique UUID stored in localStorage.
- **Creator**: The authenticated user who creates the game, selects verses, and manually chooses which word positions to hide in each round.
- **Word Selection**: Creator manually selects which word positions to hide during game creation (from 1 word up to all words). Stored as JSON array of indices: `[2, 5, 8, 12]` in `family_game_rounds.word_indices_to_hide`.
- **Game Code**: 6-character alphanumeric code used to join games (e.g., "ABC123").

## Core Requirements

1. **Game Management**: Create temporary games that multiple users can join
2. **Rounds System**: Each game consists of multiple rounds (verses). Creator selects verses and which words to hide in each round
3. **Word Selection**: Creator manually selects which word positions to hide (from 1 word up to all words in the verse)
4. **Authentication**: Only game creator needs to be authenticated (existing user). Participants join with just a game code and display name (no authentication required)
5. **Separate Game Tables**: Use completely new, isolated database tables for game tracking (winners, progress, rounds completed, etc.) - separate from existing user/verse tables
6. **Real-Time Updates**: All participants see each other's progress and actions
7. **Independent Round Progression**: Creator opens each round, then participants start when ready with local device timers. Each participant works at their own pace. No one can proceed to the next round until all active participants finish the current round. Scoring rewards accuracy, speed, and consecutive correct answers (streaks).
8. **Mobile-Friendly**: Optimized for phone use in a room setting
9. **Simple Joining**: Easy way to join a game (e.g., game code)
10. **Temporary Nature**: Games are ephemeral - no permanent storage needed

## Architecture Options & Tradeoffs

### Option 1: Polling-Based (Simplest) ⭐ RECOMMENDED

**How it works:**
- Game state stored in D1 database
- Clients poll every 1-2 seconds for updates
- No WebSocket infrastructure needed

**Pros:**
- ✅ Uses existing D1 database (no new infrastructure)
- ✅ Works with current Cloudflare Workers setup
- ✅ Simple to implement and debug
- ✅ No connection management complexity
- ✅ Works reliably across all networks
- ✅ Easy to scale (stateless workers)

**Cons:**
- ⚠️ 1-2 second delay (acceptable for this use case)
- ⚠️ Slightly more API calls (but minimal impact)

**Technical Complexity:** Low

---

### Option 2: Cloudflare Durable Objects (Real-Time)

**How it works:**
- Each game is a Durable Object
- WebSocket connections to Durable Object
- Real-time bidirectional communication

**Pros:**
- ✅ True real-time updates (< 100ms latency)
- ✅ Efficient (only sends updates when needed)
- ✅ Built-in state management

**Cons:**
- ❌ Requires new Cloudflare feature (Durable Objects)
- ❌ More complex connection management
- ❌ Additional infrastructure to learn
- ❌ Potential for connection issues on mobile networks
- ❌ More complex error handling

**Technical Complexity:** Medium-High

---

### Option 3: External WebSocket Service (e.g., Pusher, Ably)

**How it works:**
- Use third-party service for real-time messaging
- Workers publish events to service
- Clients subscribe via service SDK

**Pros:**
- ✅ True real-time updates
- ✅ Managed infrastructure
- ✅ Good mobile SDKs

**Cons:**
- ❌ Additional cost (per message/connection)
- ❌ External dependency
- ❌ Additional complexity in codebase
- ❌ Privacy concerns (data goes through third party)

**Technical Complexity:** Medium

---

## Recommended Approach: Polling-Based (Option 1)

For a family game where 2-10 people are playing together, a 1-2 second polling interval provides a good balance between simplicity and user experience. The slight delay is acceptable for this collaborative memorization context.

### Why Polling Works Well Here:

1. **Game Duration**: Family games are typically 10-30 minutes (multiple rounds)
2. **Update Frequency**: Word selections happen every few seconds, not milliseconds
3. **Network Reliability**: Polling is more reliable on mobile networks than persistent WebSocket connections
4. **Simplicity**: Leverages existing infrastructure
5. **Cost**: No additional services or infrastructure needed

## Database Schema

### Migration: `0021_create_family_games.sql`

**Important**: These tables are completely separate from existing user/verse tables. Only the game creator's `user_id` is stored (for authentication), but participants are tracked by display name only (no user accounts required).

```sql
-- Family games table
CREATE TABLE family_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique game ID (numeric, sequential, never reused)
  game_code TEXT NOT NULL,              -- 6-character code (e.g., "ABC123") - can be reused, but not simultaneously
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
  word_indices_to_hide TEXT NOT NULL,   -- JSON array of word indices to hide: [0, 5, 12, 20]
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
  finished_reason TEXT,                 -- 'completed', 'time_expired', 'left', 'disconnected'
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
  selected_word TEXT NOT NULL,         -- The word they chose (capped at reasonable length, e.g., 100 chars)
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

### Game Code Generation

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

**Key Points:**
- Game `id` is the permanent, unique identifier (numeric, sequential, never reused)
- Game `code` is temporal, user-friendly, can be reused after game expires
- Two active games cannot have the same code (enforced by unique index)
- Previous game data is not modifiable when a new game uses a reused code (protected by `game_id`)

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
      "wordIndicesToHide": [2, 5, 8, 12, 15, 18, 22]  // Creator selects which word positions to hide
    },
    {
      "roundNumber": 2,
      "verseReference": "Philippians 4:13",
      "verseText": "I can do all this through him who gives me strength.",
      "wordIndicesToHide": [1, 3, 5, 7, 9]  // Different selection for round 2
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
    "rounds": [
      {
        "id": 1,
        "roundNumber": 1,
        "verseReference": "John 3:16",
        "verseText": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
        "wordIndicesToHide": [2, 5, 8, 12, 15, 18, 22],
        "totalWordsToSelect": 7
      },
      {
        "id": 2,
        "roundNumber": 2,
        "verseReference": "Philippians 4:13",
        "verseText": "I can do all this through him who gives me strength.",
        "wordIndicesToHide": [1, 3, 5, 7, 9],
        "totalWordsToSelect": 5
      }
    ],
    "createdAt": 1234567890,
    "expiresAt": 1234571490
  }
}
```

**Features:**
- **Authentication required** - must be logged in user
- Creates a new game with unique 6-character code
- **Multiple rounds**: Creator can add multiple verses (rounds) to the game
- **Word selection**: For each round, creator manually selects which word positions to hide
  - Can select 1 word up to all words
  - Word indices are 0-based (first word = 0, second word = 1, etc.)
  - Stored as JSON array: `[2, 5, 8, 12, 15, 18, 22]`
- Verse can be:
  - Selected from user's existing verses (pass `verseId` in round object)
  - Selected from sample verses (pass `sampleVerseId` in round object)
  - Manually entered (pass `verseReference` and `verseText` in round object)
- **All participants get the same rounds** - When participants join and start their game, they all receive the same rounds with the same word selections
- Creator automatically added as first approved participant
- Expires after 1 hour
- Returns game code for sharing
- Game starts in "waiting" status

**How Word Selection Works:**

1. **Creator selects verse** (e.g., "John 3:16" with full text)
2. **Creator selects words to hide** by clicking/tapping word positions:
   - Verse displayed: "For God so loved the world..."
   - Creator taps words: "so" (index 2), "loved" (index 5), "world" (index 8), etc.
   - Selected indices stored: `[2, 5, 8, 12, 15, 18, 22]`
3. **All participants see the same selection** - When they play, they all work through the same word positions
4. **Individual Progress**: Each participant works through the selected words independently:
   - Same word positions in same order
   - Each participant tracks their own `current_word_index` (position in the selected words array)
   - But they're all working on the same verse with the same words to select

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
  "game": {
    "id": 123,
    "gameCode": "ABC123",
    "status": "waiting",
    "rounds": [
      {
        "roundNumber": 1,
        "verseReference": "John 3:16"
      },
      {
        "roundNumber": 2,
        "verseReference": "Philippians 4:13"
      }
    ],
    "participants": [
      {
        "participantId": "uuid-1",
        "displayName": "Dad",
        "isApproved": true,
        "joinedAt": 1234567890
      },
      {
        "participantId": "uuid-2",
        "displayName": "Mom",
        "isApproved": false,
        "joinedAt": 1234567900
      }
    ]
  }
}
```

**Features:**
- **NO authentication required** - just game code and display name
- Validates game code
- Checks if game is active and not expired
- Generates unique `participantId` (UUID) for this participant
- Adds participant (pending approval if creator requires it)
- Returns `participantId` - store this in localStorage for future requests
- Returns current game state with rounds info

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
        "wordIndicesToHide": [2, 5, 8, 12, 15, 18, 22],
        "roundStatus": "available",
        "roundAvailableAt": 1234567890,
        "participantsReady": 2,
        "totalActiveParticipants": 3,
        "participantsStarted": 3
      },
      {
        "roundNumber": 2,
        "verseReference": "Philippians 4:13",
        "verseText": "I can do all this through him who gives me strength.",
        "wordIndicesToHide": [1, 3, 5, 7, 9],
        "roundStatus": "not_available"
      }
    ],
    "participants": [
      {
        "participantId": "uuid-1",
        "displayName": "Dad",
        "isApproved": true,
        "status": "active",
        "isActive": true,
        "lastActivity": 1234568000,
        "totalPoints": 45,
        "currentRound": 1,
        "roundProgress": 3,
        "roundFinished": false,
        "roundFinishedReason": null
      },
      {
        "participantId": "uuid-2",
        "displayName": "Mom",
        "isApproved": true,
        "status": "active",
        "isActive": true,
        "lastActivity": 1234568100,
        "totalPoints": 30,
        "currentRound": 1,
        "roundProgress": 2,
        "roundFinished": false,
        "roundFinishedReason": null
      },
      {
        "participantId": "uuid-3",
        "displayName": "Emma",
        "isApproved": true,
        "status": "disconnected",
        "isActive": false,
        "lastActivity": 1234567000,
        "totalPoints": 15,
        "currentRound": 1,
        "roundProgress": 1,
        "roundFinished": false,
        "roundFinishedReason": null
      }
    ],
    "leaderboard": [
      {
        "participantId": "uuid-1",
        "displayName": "Dad",
        "totalPoints": 45,
        "roundsCompleted": 0,
        "rank": 1
      },
      {
        "participantId": "uuid-2",
        "displayName": "Mom",
        "totalPoints": 30,
        "roundsCompleted": 0,
        "rank": 2
      }
    ]
  }
}
```

**Features:**
- **NO authentication required** - just participant ID in header
- Returns current game state
- Includes all rounds with verse info, word selections, and round status
- Round status: `"not_available"`, `"available"` (round opened, participants can start)
- Shows how many participants are ready for next round vs total active participants
- Shows how many participants have started the round
- Includes all participants with status (`"active"`, `"left"`, `"disconnected"`)
- Shows participant's round finish status and reason (`"completed"`, `"time_expired"`, `"left"`, `"disconnected"`)
- Includes current leaderboard (across all rounds)
- Updates `last_activity` timestamp for caller
- Clients should poll every 1-2 seconds

---

### 4. Open Round (Creator or Any Participant - AUTH for creator, participantId for others)
```http
POST /family-games/:gameCode/rounds/:roundNumber/open
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "roundAvailableAt": 1234567890,
  "timeLimitSeconds": 300,
  "round": {
    "roundNumber": 1,
    "verseReference": "John 3:16",
    "verseText": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    "wordIndicesToHide": [2, 5, 8, 12, 15, 18, 22],
    "totalWordsToSelect": 7
  },
  "message": "Round 1 is now available! Participants can start when ready."
}
```

**Features:**
- **Authentication OR participant ID required** - creator OR any participant can open next round
- Makes the round available for participants to start
- Records `round_available_at` timestamp in `family_game_rounds` (when round became available)
- Sets `current_round` in `family_games` table
- Returns round details including verse text and word selections
- Returns time limit so participants know their individual time limit
- **Does NOT start timers** - each participant starts their own timer when they click "Start Round"
- Cannot open next round until all active (non-soft-disconnected) participants are ready
- **Soft-closes previous round**: Sets `round_soft_closed_at` on previous round to allow catch-up
- If creator is unavailable, any participant can advance the group to next round

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
  "roundStartedAt": 1234567890,
  "timeLimitSeconds": 300,
  "round": {
    "roundNumber": 1,
    "verseReference": "John 3:16",
    "verseText": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    "wordIndicesToHide": [2, 5, 8, 12, 15, 18, 22],
    "totalWordsToSelect": 7
  },
  "message": "Round 1 started! Your timer is running."
}
```

**Features:**
- **NO authentication required** - just participant ID
- Participant starts their own round independently
- Records `round_started_at` timestamp in `family_game_round_progress` (local device time)
- Returns round details including verse text and word selections
- Returns time limit so client can start local countdown timer
- **Timer is local device only** - no server synchronization needed
- Participant can start whenever they're ready (after round is opened)
- Each participant has independent timer

---

### 6. Select Word (NO AUTH REQUIRED)
```http
POST /family-games/:gameCode/rounds/:roundNumber/select-word
X-Participant-Id: <participantId>
Content-Type: application/json

{
  "selectedWord": "loved",
  "timeTakenMs": 2500
}
```

**Response (200 OK - Correct)**
```json
{
  "success": true,
  "isCorrect": true,
  "pointsEarned": 18,
  "streakCount": 3,
  "message": "Correct! Streak of 3!",
  "roundProgress": {
    "roundNumber": 1,
    "currentWordIndex": 3,
    "wordsCompleted": 3,
    "correctCount": 3,
    "incorrectCount": 0,
    "currentStreak": 3,
    "longestStreak": 3,
    "timeRemainingMs": 277500,
    "roundPoints": 90
  },
  "gameProgress": {
    "totalPoints": 90,
    "roundsCompleted": 0,
    "currentRound": 1
  },
  "game": {
    "participants": [...],
    "leaderboard": [...]
  }
}
```

**Response (200 OK - Incorrect)**
```json
{
  "success": true,
  "isCorrect": false,
  "pointsEarned": 0,
  "streakCount": 0,
  "message": "Not quite. Try again!",
  "roundProgress": {
    "roundNumber": 1,
    "currentWordIndex": 2,  // Unchanged (they can try again)
    "wordsCompleted": 2,
    "correctCount": 2,
    "incorrectCount": 1,
    "currentStreak": 0,  // Streak broken
    "longestStreak": 2,
    "timeRemainingMs": 277500,
    "roundPoints": 60
  },
  "gameProgress": {
    "totalPoints": 60,
    "roundsCompleted": 0,
    "currentRound": 1
  },
  "game": {
    "participants": [...],
    "leaderboard": [...]
  }
}
```

**Features:**
- **NO authentication required** - just participant ID
- **Rate limiting**: Max 1 selection per 500ms per participant (prevents spam/rapid guessing)
- Validates that participant has started the round (check `round_progress.round_started_at`)
- **Client sends `timeTakenMs` calculated from local device timer** (server trusts client for timing)
- **Server validates participant's local timer hasn't expired:**
  - If `timeTakenMs >= timeLimitSeconds * 1000`, automatically finishes participant's round with `finished_reason = "time_expired"`
  - Returns error: "Your time expired"
- Validates word selection against participant's current position in the selected words array
- **Input validation**: `selectedWord` capped at 100 characters (reasonable limit)
- Records selection with `timeTakenMs` from client (for speed scoring)
- Advances participant's `current_word_index` (position in wordIndicesToHide array) if correct
- Calculates points based on:
  - Base points for correct answer
  - Speed bonus (faster = more points, based on client `timeTakenMs`)
  - Streak multiplier (consecutive correct = bonus)
- Updates participant's round progress
- **If participant completes all words:**
  - Automatically marks participant as finished with `finished_reason = "completed"`
  - Sets `is_ready_for_next_round = true`
  - Participant sees "Round complete! Waiting for others..."
- Returns participant's progress and updated leaderboard
- Each participant works at their own pace with their own timer
- **All database writes use transactions** to ensure atomicity

---

### 7. Get Participant Round Progress (NO AUTH REQUIRED)
```http
GET /family-games/:gameCode/rounds/:roundNumber/progress
X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "roundProgress": {
    "roundNumber": 1,
    "currentWordIndex": 3,
    "wordsCompleted": 3,
    "correctCount": 3,
    "incorrectCount": 0,
    "currentStreak": 3,
    "longestStreak": 3,
    "timeRemainingMs": 120000,
    "roundPoints": 90,
    "isFinished": false,
    "roundStartedAt": 1234567890
  },
  "gameProgress": {
    "totalPoints": 180,
    "roundsCompleted": 0,
    "currentRound": 1
  },
  "game": {
    "status": "playing",
    "timeLimitSeconds": 300,
    "leaderboard": [...]
  }
}
```

**Features:**
- **NO authentication required** - just participant ID
- Returns individual participant's progress for specific round
- Includes time remaining, current position in selected words, stats
- Includes overall game progress (total points, rounds completed)
- Used for client-side timer and progress display

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

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Participant approved"
}
```

**Features:**
- **Authentication required** - only game creator
- Approves or rejects pending participants
- Can also auto-approve all (configurable)

---

### 9. Start Game (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/start
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Game started - participants can now begin their rounds",
  "game": {
    "status": "playing",
    "startedAt": 1234567890,
    "timeLimitSeconds": 300,
    "totalRounds": 2
  }
}
```

**Features:**
- **Authentication required** - only game creator
- Changes game status from "waiting" to "playing"
- Sets `current_round = 1` (first round)
- Creator must then call `/rounds/1/start` to begin the first round
- After first round, creator starts subsequent rounds when all participants finish (or time expires)

---

### 10. Finish Round (NO AUTH REQUIRED - Called automatically)
```http
POST /family-games/:gameCode/rounds/:roundNumber/finish
X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Round finished!",
  "roundStats": {
    "roundNumber": 1,
    "points": 180,
    "wordsCompleted": 7,
    "correctCount": 7,
    "incorrectCount": 0,
    "longestStreak": 7,
    "accuracyPercentage": 100.0,
    "timeTakenMs": 120000
  },
  "gameProgress": {
    "totalPoints": 180,
    "roundsCompleted": 1,
    "totalRounds": 2
  }
}
```

**Features:**
- **NO authentication required** - just participant ID (called automatically)
- Called automatically when:
  - Participant completes all selected words in the round (`finished_reason = "completed"`)
  - Participant's local timer expires (checked on each word selection, `finished_reason = "time_expired"`)
  - Participant leaves game (`finished_reason = "left"`)
  - Participant is marked as disconnected (`finished_reason = "disconnected"`)
- Calculates round statistics for this participant
- Updates participant's `is_finished = true` and `is_ready_for_next_round = true` for this round
- Updates overall game leaderboard
- **This only affects the individual participant** - round doesn't "end" globally
- Creator can open next round when all active participants have `is_ready_for_next_round = true`
- Participants see "Round complete! Waiting for others..." if they finish early
- Participants see "Your time ran out!" if their local timer expires before they finish

---

### 11. Leave Game (NO AUTH REQUIRED)
```http
POST /family-games/:gameCode/leave
X-Participant-Id: <participantId>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Left game successfully"
}
```

**Features:**
- **NO authentication required** - just participant ID
- Marks participant status as `"left"` and `is_active = false`
- If participant is in a round, marks their round progress as finished with reason `"left"`
- Doesn't delete game (others can continue)
- Game auto-cleans up after expiration

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

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Participant status updated"
}
```

**Features:**
- **Authentication required** - only game creator
- Allows creator to mark participants as `"left"` or `"soft_disconnected"`
- `"soft_disconnected"` allows participant to rejoin if they reconnect
- If participant is in a round, marks their round progress as finished with appropriate reason
- Only active (non-soft-disconnected) participants count toward "all ready" check

---

### 13. End Game (Creator Only - AUTH REQUIRED)
```http
POST /family-games/:gameCode/end
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Game ended",
  "finalStats": {
    "leaderboard": [...],
    "totalRounds": 2,
    "gameDuration": 450000
  }
}
```

**Features:**
- **Authentication required** - only game creator
- Marks game as inactive/ended
- Calculates final statistics across all rounds
- All participants see game ended state with final results

## Frontend Implementation

### New Page: `/family-games`

**Route Structure:**
- `/family-games/create` - Creator view (requires auth)
- `/family-games/join` - Participant join view (no auth)
- `/family-games/:gameCode` - Game view (shared by all)

**Components:**

1. **GameCreator** (Authenticated users only)
   - Round creation interface:
     - Add Round button
     - For each round:
       - Verse selector (My Verses / Sample Verses / Add New)
       - Word selection interface (tap words to hide)
       - Preview of verse with selected words as blanks
     - Can add multiple rounds
   - Game settings:
     - Time limit per round
     - Auto-approve toggle
   - Creates game
   - Shows game code for sharing
   - QR code option (future enhancement)

2. **GameJoiner** (No authentication required)
   - Input for game code (6 characters)
   - Display name input (validation: 2-20 chars)
   - Join button
   - Shows "Waiting for approval" if manual approval

3. **GameWaitingRoom** (Shared view)
   - Shows list of rounds (verse references)
   - List of participants with approval status
   - Creator sees: "Start Game" button, approval controls
   - Participants see: "Waiting for game to start..."

4. **GameRoundInterface** (Shared view during gameplay)
   - Round selector (if multiple rounds)
   - Current round display:
     - Verse display with only selected words as blanks
     - Word selection interface (multiple choice)
     - Timer display
     - Progress indicators
   - Real-time leaderboard (across all rounds)
   - Participant list with scores
   - Creator sees: "End Game" button
   - Participants see: "Leave Game" button

5. **WordSelector** (Multiple Choice)
   - Shows 4 word options in large buttons
   - One correct, three distractors
   - Visual feedback (green/red)
   - Disabled state after selection (until next word)

6. **GameComplete** (Shared view)
   - Final leaderboard (across all rounds)
   - Personal stats (total points, rounds completed, etc.)
   - Round-by-round breakdown
   - "Leave Game" button

### State Management

```typescript
interface FamilyGameState {
  gameCode: string | null;
  status: 'waiting' | 'playing' | 'completed' | 'ended';
  rounds: GameRound[];
  currentRound: number | null;
  participants: Participant[];
  leaderboard: LeaderboardEntry[];
  isCreator: boolean;
  participantId: string | null; // For participants (stored in localStorage)
  userDisplayName: string;
}

interface GameRound {
  roundNumber: number;
  verseReference: string;
  verseText: string;
  wordIndicesToHide: number[];
  totalWordsToSelect: number;
}

interface Participant {
  participantId: string;
  displayName: string;
  isApproved: boolean;
  isActive: boolean;
  totalPoints: number;
  roundsCompleted: number;
  currentRound: number | null;
  roundProgress: number; // Progress in current round
  lastActivity: number;
}

interface RoundProgress {
  roundNumber: number;
  currentWordIndex: number; // Position in wordIndicesToHide array
  wordsCompleted: number;
  correctCount: number;
  incorrectCount: number;
  currentStreak: number;
  longestStreak: number;
  timeRemainingMs: number;
  roundPoints: number;
  isFinished: boolean;
  roundStartedAt: number;
}

// Polling hook (works for both creator and participants)
function useFamilyGame(gameCode: string, participantId?: string) {
  const [state, setState] = useState<FamilyGameState | null>(null);
  const { isAuthenticated, sessionToken } = useAuth();
  
  useEffect(() => {
    if (!gameCode) return;
    
    const pollInterval = setInterval(async () => {
      const headers: HeadersInit = {};
      
      // Add participant ID if available (for participants)
      if (participantId) {
        headers['X-Participant-Id'] = participantId;
      }
      
      // Add auth token if authenticated (for creator)
      if (isAuthenticated && sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const response = await fetch(`/api/family-games/${gameCode}/state`, {
        headers
      });
      const data = await response.json();
      setState(data.game);
    }, 1500); // Poll every 1.5 seconds
    
    return () => clearInterval(pollInterval);
  }, [gameCode, participantId, isAuthenticated, sessionToken]);
  
  return state;
}

// Store participant data in localStorage for persistence across refreshes
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

function clearParticipantData(gameCode: string) {
  localStorage.removeItem(`family_game_${gameCode}`);
}

// On page load/refresh, check localStorage and rejoin if needed
function restoreParticipantState(): StoredParticipantData | null {
  // Check all localStorage keys for family_game_*
  const keys = Object.keys(localStorage).filter(k => k.startsWith('family_game_'));
  if (keys.length === 0) return null;
  
  // Get most recent (by lastUpdated)
  const allData = keys.map(k => {
    try {
      return JSON.parse(localStorage.getItem(k) || '{}');
    } catch {
      return null;
    }
  }).filter(Boolean) as StoredParticipantData[];
  
  if (allData.length === 0) return null;
  
  // Return most recently updated
  return allData.sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
}
```

### Mobile Optimization

- Large touch targets for word selection
- Minimal scrolling required
- Clear visual hierarchy
- Responsive layout for phones
- Portrait orientation optimized

## Backend Implementation

### Router Configuration

Add to `workers/src/index.ts`:

```typescript
import { handleFamilyGames } from './family-games';

// Family games routes
router.post('/family-games/create', handleFamilyGames.createGame);
router.post('/family-games/:gameCode/join', handleFamilyGames.joinGame);
router.get('/family-games/:gameCode/state', handleFamilyGames.getGameState);
router.post('/family-games/:gameCode/rounds/:roundNumber/open', handleFamilyGames.openRound);
router.post('/family-games/:gameCode/rounds/:roundNumber/start', handleFamilyGames.startRound);
router.post('/family-games/:gameCode/rounds/:roundNumber/select-word', handleFamilyGames.selectWord);
router.get('/family-games/:gameCode/rounds/:roundNumber/progress', handleFamilyGames.getRoundProgress);
router.post('/family-games/:gameCode/rounds/:roundNumber/finish', handleFamilyGames.finishRound);
router.post('/family-games/:gameCode/approve-participant', handleFamilyGames.approveParticipant);
router.post('/family-games/:gameCode/start', handleFamilyGames.startGame);
router.post('/family-games/:gameCode/leave', handleFamilyGames.leaveGame);
router.post('/family-games/:gameCode/mark-participant', handleFamilyGames.markParticipant);
router.post('/family-games/:gameCode/soft-disconnect', handleFamilyGames.softDisconnectParticipant);
router.post('/family-games/:gameCode/end', handleFamilyGames.endGame);
```

### File: `workers/src/family-games/index.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

export const handleFamilyGames = {
  createGame: async (request: Request, env: Env): Promise<Response> => {
    // 1. Authenticate user (REQUIRED - only for creator)
    const authHeader = request.headers.get('Authorization');
    const userId = await getUserId(authHeader, env);
    if (!userId) return unauthorized();
    
    // 2. Parse request body
    const { rounds, autoApproveParticipants, timeLimitSeconds } = await request.json();
    
    // 3. Validate rounds
    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return badRequest('At least one round is required');
    }
    
    // 4. Validate each round
    for (const round of rounds) {
      if (!round.verseReference || !round.verseText) {
        return badRequest('Each round must have verse reference and text');
      }
      if (!round.wordIndicesToHide || !Array.isArray(round.wordIndicesToHide) || round.wordIndicesToHide.length === 0) {
        return badRequest('Each round must have at least one word selected to hide');
      }
      
      // Validate word indices are within verse bounds
      const verseWords = splitVerseIntoWords(round.verseText);
      for (const index of round.wordIndicesToHide) {
        if (index < 0 || index >= verseWords.length) {
          return badRequest(`Invalid word index ${index} for verse with ${verseWords.length} words`);
        }
      }
    }
    
    // 5. Generate unique game code
    const gameCode = generateGameCode();
    
    // 6. Create game in database
    const gameId = await createGame({
      gameCode,
      createdBy: userId,
      autoApproveParticipants: autoApproveParticipants ?? true,
      timeLimitSeconds: timeLimitSeconds ?? 300,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    }, env);
    
    // 7. Create rounds
    for (const round of rounds) {
      await createRound({
        gameId,
        roundNumber: round.roundNumber,
        verseReference: round.verseReference,
        verseText: round.verseText,
        wordIndicesToHide: JSON.stringify(round.wordIndicesToHide)
      }, env);
    }
    
    // 8. Add creator as first approved participant
    const creatorParticipantId = uuidv4();
    await addParticipant({
      gameId,
      participantId: creatorParticipantId,
      displayName: await getUserDisplayName(userId, env),
      isApproved: true
    }, env);
    
    // 9. Return game details
    return json({ success: true, game: { id: gameId, gameCode, ... } });
  },
  
  joinGame: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED
    const { displayName } = await request.json();
    const gameCode = getGameCodeFromUrl(request.url);
    
    // 2. Validate game code
    const game = await getGameByCode(gameCode, env);
    if (!game || !game.is_active || game.expires_at < Date.now()) {
      return badRequest('Invalid or expired game');
    }
    
    // 3. Check if participant already exists (rejoin scenario)
    const trimmedName = displayName.trim();
    const existingParticipant = await getParticipantByDisplayName(game.id, trimmedName, env);
    if (existingParticipant) {
      // Rejoin existing participant
      return json({ 
        success: true, 
        participantId: existingParticipant.participant_id,
        message: 'Rejoined existing game',
        game: await getGameState(game.id, null, env) 
      });
    }
    
    // 4. Enforce unique display name (add suffix if needed)
    const uniqueDisplayName = await ensureUniqueDisplayName(game.id, trimmedName, env);
    
    // 5. Generate unique participant ID
    const participantId = uuidv4();
    
    // 6. Add participant (pending approval if needed) - use transaction
    const isApproved = game.auto_approve_participants;
    await addParticipant({
      gameId: game.id,
      participantId,
      displayName: uniqueDisplayName,
      isApproved
    }, env);
    
    // 7. Return participant ID and game state
    return json({ 
      success: true, 
      participantId,
      displayName: uniqueDisplayName,  // Return actual name (may have suffix)
      game: await getGameState(game.id, null, env) 
    });
  },
  
  getGameState: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED - just participant ID
    const gameCode = getGameCodeFromUrl(request.url);
    const participantId = request.headers.get('X-Participant-Id');
    
    // 2. Get game
    const game = await getGameByCode(gameCode, env);
    if (!game) return notFound();
    
    // 3. Get all rounds
    const rounds = await getRounds(game.id, env);
    
    // 4. Get all active participants with scores
    const participants = await getParticipants(game.id, env);
    
    // 5. Calculate leaderboard (across all rounds)
    const leaderboard = await calculateLeaderboard(game.id, env);
    
    // 6. Update participant's last_activity if provided
    if (participantId) {
      await updateParticipantActivity(game.id, participantId, env);
    }
    
    // 7. Return complete state
    return json({
      success: true,
      game: {
        ...game,
        rounds,
        participants,
        leaderboard
      }
    });
  },
  
  openRound: async (request: Request, env: Env): Promise<Response> => {
    // 1. Check authentication OR participant ID
    const authHeader = request.headers.get('Authorization');
    const participantId = request.headers.get('X-Participant-Id');
    const userId = authHeader ? await getUserId(authHeader, env) : null;
    
    const gameCode = getGameCodeFromUrl(request.url);
    const roundNumber = getRoundNumberFromUrl(request.url);
    
    // 2. Get game
    const game = await getGameByCode(gameCode, env);
    if (!game || game.status !== 'playing') {
      return badRequest('Game not in playing status');
    }
    
    // 3. Verify user is creator OR participant is approved
    if (userId && game.created_by !== userId) {
      return forbidden('Only creator can open rounds');
    }
    if (!userId && participantId) {
      const participant = await getParticipant(game.id, participantId, env);
      if (!participant || !participant.is_approved) {
        return forbidden('Participant not approved');
      }
    }
    if (!userId && !participantId) {
      return unauthorized('Authentication or participant ID required');
    }
    
    // 4. Get round
    const round = await getRound(game.id, roundNumber, env);
    if (!round) return notFound('Round not found');
    
    // 5. Check if previous round is ready (if not first round)
    if (roundNumber > 1) {
      const previousRound = await getRound(game.id, roundNumber - 1, env);
      if (previousRound) {
        // Check if all active (non-soft-disconnected) participants are ready
        const allReady = await checkAllParticipantsReady(game.id, previousRound.id, env);
        if (!allReady) {
          return badRequest('All active participants must finish previous round before opening next round');
        }
      }
    }
    
    // 6. Check if round already opened
    if (round.round_available_at) {
      return badRequest('Round already opened');
    }
    
    // 7. Use transaction to open round and soft-close previous round
    const db = getDB(env);
    const roundAvailableAt = Date.now();
    
    await db.batch([
      // Open new round
      db.prepare(`
        UPDATE family_game_rounds 
        SET round_available_at = ? 
        WHERE id = ?
      `).bind(roundAvailableAt, round.id),
      
      // Soft-close previous round (if exists)
      ...(roundNumber > 1 ? [
        db.prepare(`
          UPDATE family_game_rounds 
          SET round_soft_closed_at = ? 
          WHERE game_id = ? AND round_number = ?
        `).bind(roundAvailableAt, game.id, roundNumber - 1)
      ] : []),
      
      // Update current round
      db.prepare(`
        UPDATE family_games 
        SET current_round = ? 
        WHERE id = ?
      `).bind(roundNumber, game.id)
    ]);
    
    return json({
      success: true,
      roundAvailableAt,
      timeLimitSeconds: game.time_limit_seconds,
      round: {
        roundNumber: round.round_number,
        verseReference: round.verse_reference,
        verseText: round.verse_text,
        wordIndicesToHide: JSON.parse(round.word_indices_to_hide),
        totalWordsToSelect: JSON.parse(round.word_indices_to_hide).length
      },
      message: `Round ${roundNumber} is now available! Participants can start when ready.`
    });
  },
  
  startRound: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED - just participant ID
    const gameCode = getGameCodeFromUrl(request.url);
    const roundNumber = getRoundNumberFromUrl(request.url);
    const participantId = request.headers.get('X-Participant-Id');
    if (!participantId) return unauthorized('Participant ID required');
    
    // 2. Get game
    const game = await getGameByCode(gameCode, env);
    if (!game || game.status !== 'playing') {
      return badRequest('Game not in playing status');
    }
    
    // 3. Get round
    const round = await getRound(game.id, roundNumber, env);
    if (!round) return notFound('Round not found');
    
    // 4. Check if round is available
    if (!round.round_available_at) {
      return badRequest('Round not available yet');
    }
    
    // 5. Verify participant is approved
    const participant = await getParticipant(game.id, participantId, env);
    if (!participant || !participant.is_approved) {
      return forbidden('Participant not approved');
    }
    
    // 6. Check if participant already started this round
    const existingProgress = await getRoundProgress(game.id, round.id, participantId, env);
    if (existingProgress && existingProgress.round_started_at) {
      return badRequest('Round already started by this participant');
    }
    
    // 7. Start participant's round (local timer starts on their device)
    const roundStartedAt = Date.now(); // Server records when they started (for reference, but timer is local)
    await startRoundProgress(game.id, round.id, participantId, roundStartedAt, env);
    
    return json({
      success: true,
      roundStartedAt, // Client uses this to start their local timer
      timeLimitSeconds: game.time_limit_seconds,
      round: {
        roundNumber: round.round_number,
        verseReference: round.verse_reference,
        verseText: round.verse_text,
        wordIndicesToHide: JSON.parse(round.word_indices_to_hide),
        totalWordsToSelect: JSON.parse(round.word_indices_to_hide).length
      },
      message: `Round ${roundNumber} started! Your timer is running.`
    });
  },
  
  selectWord: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED - just participant ID
    const gameCode = getGameCodeFromUrl(request.url);
    const roundNumber = getRoundNumberFromUrl(request.url);
    const participantId = request.headers.get('X-Participant-Id');
    if (!participantId) return unauthorized('Participant ID required');
    
    const { selectedWord, timeTakenMs } = await request.json();
    
    // 2. Rate limiting: Check if participant made selection too recently
    const db = getDB(env);
    const recentSelection = await db.prepare(`
      SELECT selected_at FROM family_game_selections
      WHERE participant_id = ?
      ORDER BY selected_at DESC
      LIMIT 1
    `).bind(participantId).first();
    
    if (recentSelection) {
      const timeSinceLastSelection = Date.now() - recentSelection.selected_at;
      if (timeSinceLastSelection < 500) {  // 500ms minimum between selections
        return badRequest('Rate limit: Please wait before selecting again');
      }
    }
    
    // 3. Input validation
    if (!selectedWord || typeof selectedWord !== 'string') {
      return badRequest('Invalid word selection');
    }
    if (selectedWord.length > 100) {
      return badRequest('Word selection too long');
    }
    
    // 4. Get game
    const game = await getGameByCode(gameCode, env);
    if (!game || game.status !== 'playing') {
      return badRequest('Game not in progress');
    }
    
    // 5. Get round
    const round = await getRound(game.id, roundNumber, env);
    if (!round) return notFound('Round not found');
    
    // 6. Get participant
    const participant = await getParticipant(game.id, participantId, env);
    if (!participant || !participant.is_approved) {
      return forbidden('Participant not approved');
    }
    
    // 7. Get round progress
    const roundProgress = await getRoundProgress(game.id, round.id, participantId, env);
    if (!roundProgress || !roundProgress.round_started_at) {
      return badRequest('Round not started yet');
    }
    
    // 8. Check if round finished
    if (roundProgress.is_finished) {
      return badRequest('Round already finished');
    }
    
    // 9. Check if participant's local timer expired (client sends timeTakenMs)
    const timeLimitMs = game.time_limit_seconds * 1000;
    if (timeTakenMs >= timeLimitMs) {
      // Participant's local timer expired - finish their round (use transaction)
      await db.batch([
        db.prepare(`
          UPDATE family_game_round_progress
          SET is_finished = TRUE, 
              is_ready_for_next_round = TRUE,
              finished_reason = 'time_expired',
              round_ended_at = ?
          WHERE game_id = ? AND round_id = ? AND participant_id = ?
        `).bind(Date.now(), game.id, round.id, participantId)
      ]);
      return badRequest('Your time expired');
    }
    
    // 8. Get word indices to hide
    const wordIndicesToHide = JSON.parse(round.word_indices_to_hide);
    const currentWordIndexInArray = roundProgress.current_word_index;
    
    // 9. Check if all words completed
    if (currentWordIndexInArray >= wordIndicesToHide.length) {
      await finishRound(game.id, round.id, participantId, env);
      return badRequest('Round already completed');
    }
    
    // 10. Get correct word at current position
    const verseWords = splitVerseIntoWords(round.verse_text);
    const correctWordIndex = wordIndicesToHide[currentWordIndexInArray];
    const correctWord = verseWords[correctWordIndex];
    
    // 11. Check if correct
    const isCorrect = normalizeWord(selectedWord) === normalizeWord(correctWord);
    
    // 12. Get current streak (for this round)
    const currentStreak = await getCurrentStreak(game.id, round.id, participantId, env);
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    
    // 13. Calculate points
    const pointsEarned = calculatePoints(
      isCorrect,
      timeTakenMs,
      newStreak,
      timeLimitMs
    );
    
    // 14. Record selection and update progress in transaction
    await db.batch([
      // Record selection
      db.prepare(`
        INSERT INTO family_game_selections 
        (game_id, round_id, participant_id, word_index, selected_word, is_correct, 
         time_taken_ms, streak_count, points_earned, selected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        game.id, round.id, participantId, correctWordIndex, 
        selectedWord.substring(0, 100), isCorrect, timeTakenMs, 
        newStreak, pointsEarned, Date.now()
      ),
      
      // Update progress if correct
      ...(isCorrect ? [
        db.prepare(`
          UPDATE family_game_round_progress
          SET current_word_index = current_word_index + 1
          WHERE game_id = ? AND round_id = ? AND participant_id = ?
        `).bind(game.id, round.id, participantId)
      ] : [])
    ]);
    
    // 15. Check if participant completed all words (after transaction)
    if (isCorrect) {
      const updatedProgress = await getRoundProgress(game.id, round.id, participantId, env);
      if (updatedProgress.current_word_index >= wordIndicesToHide.length) {
        // Participant finished - mark as completed and ready for next round (transaction)
        await db.batch([
          db.prepare(`
            UPDATE family_game_round_progress
            SET is_finished = TRUE,
                is_ready_for_next_round = TRUE,
                finished_reason = 'completed',
                round_ended_at = ?
            WHERE game_id = ? AND round_id = ? AND participant_id = ?
          `).bind(Date.now(), game.id, round.id, participantId)
        ]);
      }
    }
    
    // 16. Get updated progress
    const progress = await getRoundProgressData(game.id, round.id, participantId, game, round, env);
    
    // 17. Return result and updated state
    return json({
      success: true,
      isCorrect,
      pointsEarned,
      streakCount: newStreak,
      message: isCorrect 
        ? `Correct! Streak of ${newStreak}!`
        : 'Not quite. Try again!',
      roundProgress: progress.roundProgress,
      gameProgress: progress.gameProgress,
      game: await getGameState(game.id, participantId, env)
    });
  },
  
  finishRound: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED - just participant ID (called automatically)
    const gameCode = getGameCodeFromUrl(request.url);
    const roundNumber = getRoundNumberFromUrl(request.url);
    const participantId = request.headers.get('X-Participant-Id');
    if (!participantId) return unauthorized('Participant ID required');
    
    // 2. Get game and round
    const game = await getGameByCode(gameCode, env);
    const round = await getRound(game.id, roundNumber, env);
    const roundProgress = await getRoundProgress(game.id, round.id, participantId, env);
    
    if (!roundProgress || roundProgress.is_finished) {
      return badRequest('Round not started or already finished');
    }
    
    // 3. Finish participant's round and calculate stats
    await finishRoundProgress(game.id, round.id, participantId, 'completed', env);
    await markParticipantReadyForNextRound(game.id, round.id, participantId, env);
    const roundStats = await calculateRoundStats(game.id, round.id, participantId, env);
    const gameProgress = await getGameProgress(game.id, participantId, env);
    
    return json({
      success: true,
      message: 'Round finished! Waiting for others...',
      roundStats,
      gameProgress
    });
  },
  
  approveParticipant: async (request: Request, env: Env): Promise<Response> => {
    // 1. AUTHENTICATION REQUIRED - only creator
    const authHeader = request.headers.get('Authorization');
    const userId = await getUserId(authHeader, env);
    if (!userId) return unauthorized();
    
    const gameCode = getGameCodeFromUrl(request.url);
    const { participantId, approve } = await request.json();
    
    // 2. Verify user is game creator
    const game = await getGameByCode(gameCode, env);
    if (game.created_by !== userId) return forbidden();
    
    // 3. Update participant approval
    await updateParticipantApproval(game.id, participantId, approve, env);
    
    return json({ success: true });
  },
  
  startGame: async (request: Request, env: Env): Promise<Response> => {
    // 1. AUTHENTICATION REQUIRED - only creator
    const authHeader = request.headers.get('Authorization');
    const userId = await getUserId(authHeader, env);
    if (!userId) return unauthorized();
    
    const gameCode = getGameCodeFromUrl(request.url);
    
    // 2. Verify user is game creator
    const game = await getGameByCode(gameCode, env);
    if (game.created_by !== userId) return forbidden();
    
    // 3. Verify at least 1 other approved participant
    const participants = await getApprovedParticipants(game.id, env);
    if (participants.length < 2) {
      return badRequest('Need at least 2 players to start');
    }
    
    // 4. Start game
    await startGameStatus(game.id, env);
    
    return json({ success: true, message: 'Game started - you can now start Round 1' });
  },
  
  leaveGame: async (request: Request, env: Env): Promise<Response> => {
    // 1. NO AUTHENTICATION REQUIRED - just participant ID
    const gameCode = getGameCodeFromUrl(request.url);
    const participantId = request.headers.get('X-Participant-Id');
    
    // 2. Get game
    const game = await getGameByCode(gameCode, env);
    
    // 3. Mark participant as left
    await updateParticipantStatus(game.id, participantId, 'left', env);
    await deactivateParticipant(game.id, participantId, env);
    
    // 4. If participant is in a round, mark their round progress as finished
    if (game.current_round) {
      const round = await getRound(game.id, game.current_round, env);
      if (round && round.round_started_at) {
        const roundProgress = await getRoundProgress(game.id, round.id, participantId, env);
        if (roundProgress && !roundProgress.is_finished) {
          await finishRoundProgress(game.id, round.id, participantId, 'left', env);
          await markParticipantReadyForNextRound(game.id, round.id, participantId, env);
        }
      }
    }
    
    return json({ success: true });
  },
  
  markParticipant: async (request: Request, env: Env): Promise<Response> => {
    // 1. AUTHENTICATION REQUIRED - only creator
    const authHeader = request.headers.get('Authorization');
    const userId = await getUserId(authHeader, env);
    if (!userId) return unauthorized();
    
    const gameCode = getGameCodeFromUrl(request.url);
    const { participantId, status } = await request.json();
    
    // 2. Verify user is game creator
    const game = await getGameByCode(gameCode, env);
    if (game.created_by !== userId) return forbidden();
    
    // 3. Validate status
    if (!['active', 'left', 'soft_disconnected'].includes(status)) {
      return badRequest('Invalid status');
    }
    
    // 4. Update participant status
    await updateParticipantStatus(game.id, participantId, status, env);
    
    // 5. If marking as left/soft_disconnected and participant is in a round, finish their round
    if ((status === 'left' || status === 'soft_disconnected') && game.current_round) {
      const round = await getRound(game.id, game.current_round, env);
      if (round && round.round_available_at) {
        const roundProgress = await getRoundProgress(game.id, round.id, participantId, env);
        if (roundProgress && !roundProgress.is_finished) {
          await finishRoundProgress(game.id, round.id, participantId, status, env);
          await markParticipantReadyForNextRound(game.id, round.id, participantId, env);
        }
      }
    }
    
    return json({ success: true, message: 'Participant status updated' });
  },
  
  softDisconnectParticipant: async (request: Request, env: Env): Promise<Response> => {
    // 1. Check authentication OR participant ID
    const authHeader = request.headers.get('Authorization');
    const participantIdHeader = request.headers.get('X-Participant-Id');
    const userId = authHeader ? await getUserId(authHeader, env) : null;
    
    const gameCode = getGameCodeFromUrl(request.url);
    const { participantId } = await request.json();
    
    // 2. Get game
    const game = await getGameByCode(gameCode, env);
    if (!game) return notFound();
    
    // 3. Verify user is creator OR participant is approved
    if (userId && game.created_by !== userId) {
      // Creator can soft-disconnect anyone
    } else if (participantIdHeader) {
      // Participant can soft-disconnect others (to advance group)
      const requester = await getParticipant(game.id, participantIdHeader, env);
      if (!requester || !requester.is_approved) {
        return forbidden('Participant not approved');
      }
    } else {
      return unauthorized('Authentication or participant ID required');
    }
    
    // 4. Soft-disconnect the participant
    const currentRound = game.current_round ? await getRound(game.id, game.current_round, env) : null;
    await softDisconnectParticipant(game.id, currentRound?.id || null, participantId, env);
    
    return json({ 
      success: true, 
      message: 'Participant soft-disconnected. They can rejoin if they reconnect.' 
    });
  },
  
  endGame: async (request: Request, env: Env): Promise<Response> => {
    // 1. AUTHENTICATION REQUIRED - only creator
    const authHeader = request.headers.get('Authorization');
    const userId = await getUserId(authHeader, env);
    if (!userId) return unauthorized();
    
    const gameCode = getGameCodeFromUrl(request.url);
    
    // 2. Verify user is game creator
    const game = await getGameByCode(gameCode, env);
    if (game.created_by !== userId) return forbidden();
    
    // 3. Calculate final stats
    const finalStats = await calculateFinalStats(game.id, env);
    
    // 4. Mark game as ended
    await endGameStatus(game.id, env);
    
    return json({ success: true, finalStats });
  }
};
```

### Helper Functions

**`checkAllParticipantsReady(gameId, roundId, env)`**

Checks if all active (non-soft-disconnected) participants are ready for the next round:

```typescript
async function checkAllParticipantsReady(gameId: number, roundId: number, env: Env): Promise<boolean> {
  const db = getDB(env);
  
  // Get all active participants (status = 'active', not 'soft_disconnected')
  const activeParticipants = await db.prepare(`
    SELECT participant_id FROM family_game_participants
    WHERE game_id = ? AND status = 'active' AND is_active = TRUE
  `).bind(gameId).all();
  
  if (activeParticipants.length === 0) return false;
  
  // Get round progress for all active participants
  const allReady = await Promise.all(
    activeParticipants.results.map(async (p: any) => {
      const progress = await getRoundProgress(gameId, roundId, p.participant_id, env);
      return progress && progress.is_ready_for_next_round;
    })
  );
  
  // Return true if all active participants are ready
  return allReady.every(ready => ready === true);
}
```

**`ensureUniqueDisplayName(gameId, displayName, env)`**

Ensures display name is unique per game, adding "(2)", "(3)", etc. if needed:

```typescript
async function ensureUniqueDisplayName(gameId: number, displayName: string, env: Env): Promise<string> {
  const db = getDB(env);
  
  // Check if name exists
  const existing = await db.prepare(`
    SELECT display_name FROM family_game_participants
    WHERE game_id = ? AND display_name = ?
  `).bind(gameId, displayName).first();
  
  if (!existing) {
    return displayName; // Name is unique
  }
  
  // Find next available suffix
  let suffix = 2;
  let candidateName = `${displayName} (${suffix})`;
  
  while (true) {
    const exists = await db.prepare(`
      SELECT display_name FROM family_game_participants
      WHERE game_id = ? AND display_name = ?
    `).bind(gameId, candidateName).first();
    
    if (!exists) {
      return candidateName;
    }
    
    suffix++;
    candidateName = `${displayName} (${suffix})`;
  }
}
```

**`getParticipantByDisplayName(gameId, displayName, env)`**

Finds existing participant by display name (for rejoin scenario):

```typescript
async function getParticipantByDisplayName(
  gameId: number, 
  displayName: string, 
  env: Env
): Promise<any | null> {
  const db = getDB(env);
  return await db.prepare(`
    SELECT * FROM family_game_participants
    WHERE game_id = ? AND display_name = ?
  `).bind(gameId, displayName).first();
}
```

**`markParticipantReadyForNextRound(gameId, roundId, participantId, env)`**

Marks a participant as ready for the next round:

```typescript
async function markParticipantReadyForNextRound(
  gameId: number, 
  roundId: number, 
  participantId: string, 
  env: Env
) {
  const db = getDB(env);
  await db.prepare(`
    UPDATE family_game_round_progress
    SET is_ready_for_next_round = TRUE
    WHERE game_id = ? AND round_id = ? AND participant_id = ?
  `).bind(gameId, roundId, participantId).run();
}
```

**`getActiveParticipants(gameId, env)`**

Returns all participants with `status = 'active'` (not 'soft_disconnected') and `is_active = true`.

**`updateParticipantStatus(gameId, participantId, status, env)`**

Updates a participant's status to `'active'`, `'left'`, or `'soft_disconnected'` (allows rejoin).

**`softDisconnectParticipant(gameId, roundId, participantId, env)`**

Marks participant as soft-disconnected and ready for next round (allows rejoin):

```typescript
async function softDisconnectParticipant(
  gameId: number,
  roundId: number | null,
  participantId: string,
  env: Env
) {
  const db = getDB(env);
  
  await db.batch([
    // Update participant status
    db.prepare(`
      UPDATE family_game_participants
      SET status = 'soft_disconnected'
      WHERE game_id = ? AND participant_id = ?
    `).bind(gameId, participantId),
    
    // If in a round, mark as finished and ready
    ...(roundId ? [
      db.prepare(`
        UPDATE family_game_round_progress
        SET is_finished = TRUE,
            is_ready_for_next_round = TRUE,
            finished_reason = 'soft_disconnected',
            round_ended_at = ?
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
      `).bind(Date.now(), gameId, roundId, participantId)
    ] : [])
  ]);
}
```

**Note on Server-Side Processing for Long Verses:**

For very long verses (whole chapters), all processing happens server-side:
- Verse text stored in database (no size limit in D1)
- Word splitting, validation, and selection generation on server
- Client only receives:
  - Verse text (can be long, but browser can handle)
  - Word indices to hide (small JSON array)
  - Current progress (just numbers)
- No heavy computation on client - server does all word processing
- This allows handling chapters with 1000+ words without client performance issues

### Cleanup Job

Add a scheduled worker (Cloudflare Cron Triggers) to clean up expired games:

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

## Game Flow & User Experience

### Phase 1: Game Creation (Authenticated User Only)

**Creator's View:**
1. User navigates to "Family Games" page (must be logged in)
2. Sees option to "Create New Game"
3. **Round Creation Interface:**
   - **Add Round Button**: Click to add a new round (verse)
   - For each round:
     - **Verse Selection:**
       - **Tab 1: "My Verses"** - Shows user's existing verses
       - **Tab 2: "Sample Verses"** - Common verses (John 3:16, etc.)
       - **Tab 3: "Add New"** - Manual entry (reference + text)
     - **Word Selection Interface:**
       - Verse displayed with all words visible
       - Creator taps/selects which words to hide
       - Selected words highlighted or marked
       - Can select 1 word up to all words
       - Shows count: "7 words selected"
       - Can deselect words by tapping again
     - **Round Preview**: Shows verse with selected words as blanks
   - **Add Another Round**: Can add multiple rounds to the game
   - **Round List**: Shows all rounds with verse references
4. **Game Settings:**
   - Time limit per round (default: 5 minutes)
   - Toggle: "Auto-approve participants" (default: ON)
5. Clicks "Create Game"
6. **Game is created in "waiting" status**
7. Creator sees:
   - Large game code (e.g., "ABC123") - easy to read/share
   - QR code (future enhancement)
   - "Waiting for players..." message
   - List of rounds: "Round 1: John 3:16", "Round 2: Philippians 4:13"
   - List of participants (initially just creator, shown as "You")
   - "Approve Participants" panel (if manual approval enabled)
   - "Start Game" button (disabled until at least 1 other participant joins)

**Technical:**
- Game stored in `family_games` table with `status = 'waiting'`
- Rounds stored in `family_game_rounds` table with `word_indices_to_hide` JSON array
- Creator automatically added as approved participant

---

### Phase 2: Participants Join (No Authentication Required)

**Participant's View:**
1. Opens app (no login needed)
2. Sees "Join Family Game" option
3. Enters 6-character game code
4. Enters display name (e.g., "Mom", "Dad", "Emma")
5. Clicks "Join"
6. **If auto-approve is ON:**
   - Immediately sees waiting room
7. **If auto-approve is OFF:**
   - Sees "Waiting for approval..." message
   - Creator sees pending participant and can approve/reject

**Creator's View (during joining):**
- Sees new participants appear in list
- Can approve/reject each one
- Can toggle "Auto-approve all" setting
- "Start Game" button becomes enabled when at least 1 other participant is approved

**Technical:**
- Participant gets unique `participantId` (UUID) stored in localStorage
- Participant added to `family_game_participants` with `is_approved = true/false`
- Both creator and participants poll `/state` endpoint to see updates

---

### Phase 3: Game Starts (Creator Only)

**Creator's View:**
1. Sees at least 1 approved participant
2. Clicks "Start Game" button
3. Game status changes to "playing"
4. Creator sees "Open Round 1" button
5. Creator clicks "Open Round 1" to make the round available
6. **Round becomes available** - participants can start when ready

**All Participants' View (including creator):**
- See "Game Started - Ready to Begin!" message
- See list of rounds: "Round 1: John 3:16", "Round 2: Philippians 4:13"
- **When creator opens Round 1:**
  - Participants see "Round 1 Available - Click to Start" button
  - Each participant clicks "Start Round 1" when ready
  - **Local timer starts on their device** (e.g., 5:00, 4:59, 4:58...)
  - Verse with blanks appears
  - Participants work at their own pace
  - See other participants' progress in real-time

**Technical:**
- Game `status` changes from `'waiting'` to `'playing'`
- `started_at` timestamp set
- `current_round = 1` set
- Creator calls `/rounds/1/open` to make round available
- Round's `round_available_at` timestamp set
- Each participant calls `/rounds/1/start` independently when ready
- Each participant's `round_started_at` set in their progress record (local device time)
- Each participant works at their own pace with their own timer

---

### Phase 4: Independent Round Gameplay - Each Participant at Their Own Pace

**When Creator Opens Round 1:**

**Participant's View:**
1. Sees "Round 1 Available - Click to Start" button
2. Clicks "Start Round 1" when ready
3. **Local timer starts counting down** (e.g., 5:00, 4:59, 4:58...) - independent timer on their device
4. Verse appears with **only selected words hidden as blanks**
5. Example: If words at indices [2, 5, 8, 12] are selected:
   ```
   For God so ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____
   ```
6. Reference shown: "Round 1: John 3:16"
7. Word selection interface appears
8. **Participant works at their own pace** with their own timer
9. See other participants' progress in real-time (who's started, who's finished)

**How the Verse is Displayed (Individual Progress):**

Each participant sees their own progress through the selected words:

**Example: Round with words [2, 5, 8, 12, 15, 18, 22] selected**

**Initial State (current_word_index = 0, first word to select is at index 2):**
```
Round 1: John 3:16
Time Remaining: 4:52
Word 1 of 7

For God so ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____
```

**After 3 words correct (current_word_index = 3, selected words at indices 2, 5, 8):**
```
Round 1: John 3:16
Time Remaining: 4:35
Word 4 of 7 | Streak: 3 ✓ | Points: 75

For God so loved the world that ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____ ____
```

**After all selected words correct (current_word_index = 7, all selected words filled):**
```
Round 1: John 3:16
Time Remaining: 2:15
✓ Round Complete!

For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.

Round Score: 180 points
```

**Key Point:** Only the words selected by the creator are shown as blanks. All other words are visible to help with context.

**Word Selection Interface:**

**Multiple Choice (Recommended)**

Shows 4 word options below the verse:
```
Select the next word:

[  loved  ]  [  gave  ]  [  world  ]  [  that  ]
```

- One option is the correct next word
- Three are distractors (words from elsewhere in verse, or similar words)
- Large touch targets for mobile
- Visual feedback on selection:
  - **Green**: Correct answer
  - **Red**: Incorrect answer
  - **Yellow**: Already selected (can't select again until next word)

**Timer Display:**
- Large countdown timer at top
- Shows time remaining (MM:SS format)
- Turns red when < 30 seconds remaining
- Game auto-ends when timer reaches 0

**Progress Indicators:**
- Current word position (e.g., "Word 5 of 25")
- Current streak count
- Total points earned
- Accuracy percentage

---

### Phase 5: Word Selection Mechanics (Individual Progress)

**What Happens When a Participant Selects a Word:**

1. **Participant taps a word option**
2. **Client calculates time taken** (milliseconds since round started globally)
3. **Request sent to server** with:
   - `selectedWord`
   - `participantId`
   - `timeTakenMs`
4. **Server validates:**
   - Is game in "playing" status?
   - Is round currently active (round_started_at set)?
   - Has the round's shared timer expired? (if yes, reject and mark participant as time_expired)
   - Is participant's round already finished? (if yes, reject)
   - Is `selectedWord` the correct word at the current position in the selected words array?
5. **If CORRECT:**
   - Participant's `current_word_index` advances by 1
   - Streak count increments
   - Points calculated based on:
     - Base points (10)
     - Speed bonus (0-10 based on time)
     - Streak bonus (+2 per streak after first)
   - Selection recorded with points and streak
   - Participant sees updated progress
   - Leaderboard updates (all participants see this)
6. **If INCORRECT:**
   - Selection recorded with `is_correct = false`
   - Streak count resets to 0
   - Points awarded: 0
   - Participant's `current_word_index` stays the same
   - Participant can try again (same word, different options)
   - Time continues counting down

**Visual Feedback:**

**Correct Selection:**
- Word option turns green
- Message shows: "✓ Correct! +18 points (Streak: 5!)"
- Verse updates to show new word revealed
- Streak counter increments
- Points display updates
- Leaderboard updates (visible to all)

**Incorrect Selection:**
- Word option turns red
- Message shows: "Not quite. Try again! (Streak broken)"
- Verse stays the same (same word, new options generated)
- Streak counter resets to 0
- Participant can immediately try again
- Time continues counting down

**Participant's Local Timer Expired:**
- If participant finished before their timer expired: "Round complete! You finished in time."
- If participant did NOT finish: "⏰ Your time ran out!" message
- Participant's round ends (others may still be playing)
- Participant marked as ready for next round
- Creator can open next round when all participants are ready
- Final round stats calculated for this participant

---

### Phase 6: Round Completion & Synchronization

**When a Participant Completes All Selected Words in a Round:**

**Participant's View (When They Finish):**
- Complete verse displayed (all selected words filled)
- "✓ Round complete! Waiting for others..." message
- **Their timer stops** (others may still be playing with their own timers)
- Round stats calculated:
  - Round points
  - Words completed
  - Accuracy percentage
  - Longest streak
  - Time taken (from their local timer)
- Overall game progress shown (total points, rounds completed)
- **Marked as ready for next round** - `is_ready_for_next_round = true`
- Can see leaderboard and other participants' progress
- Shows: "2 of 3 participants ready" (example)

**When All Active Participants Are Ready:**

**Creator's View:**
- Sees "All participants ready! Open Round 2" button
- Can open next round

**All Participants' View:**
- See "All participants ready! Waiting for next round..."
- Creator can open next round when ready

**Technical:**
- Participant's round progress `is_finished` set to `true` for this round
- Participant's `is_ready_for_next_round` set to `true`
- `round_ended_at` timestamp set (when participant finished)
- `finished_reason` set: `"completed"`, `"time_expired"`, `"left"`, or `"disconnected"`
- Round stats calculated and stored in `family_game_round_stats`
- Overall game stats updated in `family_game_stats`
- Leaderboard updated (this participant's ranking)
- **Round remains "available"** - other participants can still be playing
- **Creator can open next round when all active participants have `is_ready_for_next_round = true`**
- Only active participants (status = "active") count toward "all ready" check

---

### Phase 7: Game Summary

**When All Participants Finish All Rounds (or Creator Ends Game):**

**All Participants See:**
- Final leaderboard with complete rankings (across all rounds)
- Personal stats:
  - Total points (across all rounds)
  - Rounds completed
  - Words completed (total across all rounds)
  - Correct/incorrect selections
  - Accuracy percentage
  - Longest streak
  - Average time per word
  - Final rank
- Round-by-round breakdown:
  - Points per round
  - Stats per round
  - Round rankings
- Option to "Leave Game"

**Creator's View:**
- Same as participants
- Can "End Game" to close it permanently (even if others still playing)
- Can view detailed statistics for all participants
- Can see round-by-round breakdown for all participants
- Game expires automatically after 1 hour

**Real-Time Leaderboard (During Gameplay):**

All participants can see a live leaderboard showing:
- Display name
- Total points (across all rounds)
- Rounds completed
- Current round progress
- Status (Playing / Finished)
- Rank (updates in real-time)

This allows participants to see how they're doing compared to others while playing across all rounds.

---

## UI Differences: Creator vs Participants

### Same UI Components (Shared Experience):

1. **Individual Verse Display** - Each person sees their own progress
   - Shows verse with blanks
   - Progressively reveals words based on their individual progress
   - Same reference and text, but different positions

2. **Word Selection Interface** - Identical for everyone
   - Same multiple choice options (but generated per word)
   - Same visual feedback
   - Same interaction model

3. **Leaderboard** - Identical for everyone (real-time)
   - Shows all participants
   - Real-time score updates
   - Shows current points, words completed, streak
   - Shows status (Playing / Finished)
   - Same rankings (updates as people play)

4. **Timer Display** - Individual for each participant
   - Each person has their own countdown timer
   - Shows time remaining
   - Starts when they click "Start My Game"

### Different UI Components (Role-Based):

**Creator Only:**
- "Approve Participants" panel (if manual approval enabled)
- "Start Game" button (only visible to creator)
- "Open Round X" button (only visible to creator - makes round available)
- "Mark Participant as Left/Disconnected" controls
- "End Game" button (only visible to creator)
- Game settings/controls (time limit, etc.)
- Sees "All participants ready!" when can open next round

**Participants Only:**
- "Start Round X" button (appears when round is available - starts their local timer)
- "Leave Game" button (creator can't leave, only end)
- See round status: "Round not available yet...", "Round available - Click to Start", "Playing...", "Round complete! Waiting for others...", "Your time ran out!", "All ready - waiting for next round"
- No approval controls
- No open/end controls
- Cannot open rounds (only creator can)

**Technical Implementation:**

The frontend determines what to show based on:
- **Creator**: Has `created_by` user_id matching their authenticated user_id
- **Participants**: Have `participantId` but no user account
- **Individual Progress**: Each participant tracks their own progress per round

```typescript
// Frontend logic
const isCreator = game.created_by === currentUserId;
const isParticipant = participantId !== null;
const participant = game.participants.find(p => p.participantId === participantId);

// Show creator controls only if isCreator
{isCreator && (
  <Button onClick={startGame}>Start Game</Button>
)}

// Show "Start Round" buttons for participants (after game starts)
{isParticipant && game.status === 'playing' && game.rounds.map(round => {
  const roundProgress = getRoundProgress(round.roundNumber, participantId);
  const hasStarted = roundProgress?.roundStartedAt;
  
  return !hasStarted && (
    <Button key={round.roundNumber} onClick={() => startRound(round.roundNumber)}>
      Start Round {round.roundNumber}
    </Button>
  );
})}

// Show round interface when participant has started a round
{isParticipant && currentRoundProgress?.roundStartedAt && (
  <RoundInterface 
    round={currentRound}
    currentWordIndex={currentRoundProgress.currentWordIndex}
    wordIndicesToHide={currentRound.wordIndicesToHide}
    timeRemaining={calculateTimeRemaining(currentRoundProgress.roundStartedAt, game.timeLimitSeconds)}
  />
)}
```

---

## Word Selection Logic

### Option A: Multiple Choice (Recommended for Families)

**How it works:**
- Show 4 word options
- One is correct, three are distractors
- Distractors are:
  - Words from nearby in the verse
  - Similar-sounding words
  - Common words that might fit

**Pros:**
- ✅ Easier for kids/families
- ✅ Faster selection (tap vs type)
- ✅ Less frustration
- ✅ Better for mobile

**Cons:**
- ⚠️ Slightly easier than typing
- ⚠️ Need to generate good distractors

---

### Option B: Text Input

**How it works:**
- User types the next word
- Validated against verse text

**Pros:**
- ✅ More challenging
- ✅ Tests actual memorization

**Cons:**
- ❌ Slower on mobile
- ❌ More typos/frustration
- ❌ Harder for kids

---

### Recommendation: Start with Multiple Choice

Multiple choice is more family-friendly and works better on mobile. Can add text input as an "advanced mode" later.

## Scoring System

The scoring system rewards **accuracy**, **speed**, and **consistency** (streaks). Points are calculated for each word selection:

### Base Scoring Formula

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
  // If they answer in less than 1/3 of average time, get max speed bonus
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

### Scoring Breakdown

- **Correct Answer**: 10 base points
- **Speed Bonus**: 0-10 points (faster = more points)
  - Answers in < 1 second: +10 points
  - Answers in 1-2 seconds: +7 points
  - Answers in 2-3 seconds: +5 points
  - Answers in 3-5 seconds: +3 points
  - Answers in > 5 seconds: +1 point
- **Streak Bonus**: +2 points per consecutive correct (after first)
  - Streak of 2: +2 points
  - Streak of 3: +4 points
  - Streak of 5: +8 points
  - Streak of 10: +18 points
- **Incorrect Answer**: 0 points, breaks streak

### Example Scoring

**Fast correct answer with streak:**
- Correct answer: 10 points
- Speed (1.2 seconds): +7 points
- Streak of 5: +8 points
- **Total: 25 points**

**Slow correct answer, no streak:**
- Correct answer: 10 points
- Speed (6 seconds): +1 point
- Streak of 1: +0 points
- **Total: 11 points**

**Incorrect answer:**
- **Total: 0 points** (streak broken)

### Final Ranking

Participants are ranked by:
1. **Total Points** (primary)
2. **Words Completed** (tiebreaker)
3. **Accuracy Percentage** (tiebreaker)
4. **Longest Streak** (tiebreaker)

## Implementation Steps

### Phase 1: Core Infrastructure
1. ✅ Create database migration (`0021_create_family_games.sql`)
2. ✅ Implement backend endpoints (create game, join game, get state)
3. ✅ Add routes to main router (`/family-games/*`)
4. ✅ Create test script

### Phase 2: Round Logic
1. ✅ Implement round creation (with word selection)
2. ✅ Implement round start endpoint
3. ✅ Implement word selection endpoint (per round)
4. ✅ Add word selection validation (against wordIndicesToHide)
5. ✅ Implement multiple choice word options
6. ✅ Add scoring system

### Phase 3: Frontend
1. ✅ Create game creator component (with round builder and word selector)
2. ✅ Create game joiner component
3. ✅ Create game interface component (round selector, round display)
4. ✅ Implement polling hook
5. ✅ Add mobile optimizations

### Phase 4: Polish
1. ✅ Add cleanup job for expired games
2. ✅ Add error handling
3. ✅ Add loading states
4. ✅ Add animations/feedback
5. ✅ Test with multiple devices and multiple rounds

## Testing Strategy

### Backend Tests
```bash
# test-family-games.sh
1. Create game with multiple rounds
2. Join game with multiple users
3. Get game state (polling)
4. Start rounds independently
5. Select words (correct and incorrect) in rounds
6. Complete rounds
7. Finish game
8. Leave game
9. End game
10. Test expired game handling
```

### Frontend Tests
- Test game creation flow (multiple rounds, word selection)
- Test joining with game code
- Test round selection and starting
- Test word selection UI
- Test polling updates
- Test mobile responsiveness
- Test with 2-5 simultaneous users across multiple rounds

## Security Considerations

1. **Game Code Validation**
   - Validate format (6 alphanumeric)
   - Check expiration
   - Verify user is participant for state access

2. **Rate Limiting**
   - Limit polling frequency (max 1 request/second per user) - client-side throttling
   - Limit word selections (max 1 per 500ms per participant) - server-side enforcement
   - Rate limit checked on each word selection endpoint call

3. **Input Validation**
   - Sanitize display names (trim, length limits)
   - Enforce unique display names per game (auto-add suffix if duplicate)
   - Validate word selections (string, max 100 characters)
   - Validate word indices are within verse bounds
   - Check game ownership for ending (creator only)
   - All database writes protected by participant ID or authentication
   - Non-authenticated participants can only write text strings (capped at reasonable length)

4. **Privacy**
   - Games are temporary (1 hour max, auto-expire)
   - No permanent storage of game data
   - Display names only (no emails shown)
   - Games quietly end after expiration - no special handling needed if all participants leave

5. **Persistence & Rejoin**
   - Participant data stored in localStorage (gameCode, participantId, displayName)
   - On page refresh, automatically restore participant state
   - Rejoin flow: if display name matches existing participant, return existing participantId
   - All game state stored server-side - client just needs gameCode + participantId to rejoin

6. **Soft-Disconnect & Catch-Up**
   - Creator or any participant can soft-disconnect others to advance group
   - Soft-disconnected participants can rejoin and catch up
   - Rounds are "soft-closed" when next round opens (allows catch-up)
   - If creator unavailable, any participant can open next round

7. **Database Transactions**
   - All critical multi-step operations use database transactions
   - Word selection: record selection + update progress (atomic)
   - Round opening: open new round + soft-close previous + update current_round (atomic)
   - Participant finishing: mark finished + mark ready (atomic)
   - Prevents race conditions and inconsistent state

## Difficulty & Word Selection

### Overview

The creator manually selects which words to hide in each round, providing complete control over difficulty. This eliminates the need for separate "difficulty modes" - the creator can make any round as easy (1 word) or hard (all words) as desired.

### How It Works

**Creator's Word Selection Interface:**

1. **Verse Display**: Verse is shown with all words visible
2. **Word Tapping**: Creator taps/selects words they want participants to fill in
3. **Visual Feedback**: Selected words are highlighted or marked
4. **Selection Count**: Shows "X words selected" counter
5. **Deselection**: Can tap again to deselect words
6. **Preview**: Shows verse with selected words as blanks

**Example Selection Process:**

```
Verse: "For God so loved the world that he gave his one and only Son..."

Creator taps:
- "so" (index 2) ✓
- "loved" (index 5) ✓
- "world" (index 8) ✓
- "gave" (index 12) ✓
- "believes" (index 18) ✓

Selected: [2, 5, 8, 12, 18]
Preview: "For God so ____ ____ ____ ____ ____ ____ ____ gave ____ ____ ____ ____ ____ ____ ____ believes ____ ____ ____ ____ ____ ____"
```

### Flexibility

**Easy Rounds:**
- Creator selects 1-3 words
- Great for beginners or young children
- Example: [5, 15] - only 2 words to memorize

**Normal Rounds:**
- Creator selects 5-10 words
- Balanced difficulty
- Example: [2, 5, 8, 12, 15, 18, 22] - 7 words

**Hard Rounds:**
- Creator selects most or all words
- Maximum challenge
- Example: [0, 1, 2, 3, 4, 5, ...] - all words

**Mixed Rounds:**
- Different difficulty per round
- Round 1: Easy (3 words)
- Round 2: Normal (8 words)
- Round 3: Hard (all words)

### Technical Implementation

**No Additional Complexity Required** - This is already the core design!

- Word selection UI: Part of game creation
- Word storage: `wordIndicesToHide` JSON array in `family_game_rounds`
- Word validation: Checks against `wordIndicesToHide` array
- Verse display: Shows only selected words as blanks
- Progress tracking: Uses `current_word_index` in selected words array

**Total Complexity: NONE** - Already implemented! ⭐

## Future Enhancements

1. **QR Code Sharing**
   - Generate QR code for game code
   - Easy joining by scanning

2. **Team Mode**
   - Split into teams
   - Team vs team competition across rounds

3. **Additional Input Modes**
   - Multiple choice (current implementation)
   - Text input (harder mode)
   - Voice input (future)

4. **Round Templates**
   - Save word selection patterns
   - Quick-create rounds with similar word selections
   - Pre-made round templates for common verses

5. **Replay Mode**
   - Save game results
   - Review performance later
   - Share game results with family

6. **Real-Time Upgrade**
   - If polling proves insufficient, upgrade to Durable Objects
   - Keep same API surface, swap implementation

## Success Metrics

1. **Performance**
   - Game creation: < 500ms
   - State polling: < 200ms
   - Word selection: < 300ms
   - Round start: < 200ms

2. **Reliability**
   - 99%+ uptime for active games
   - Graceful handling of network issues
   - Auto-cleanup of expired games

3. **User Experience**
   - Easy to create games with multiple rounds
   - Intuitive word selection interface
   - Easy to join games
   - Smooth updates (1-2 second delay acceptable)
   - Clear feedback on selections
   - Mobile-friendly interface

## Conclusion

The polling-based approach provides the best balance of simplicity and functionality for family collaborative memorization games. It leverages existing infrastructure, requires no new services, and provides a good user experience for this use case. The 1-2 second polling interval is acceptable for a collaborative game where word selections happen every few seconds.

The games/rounds structure with creator-selected words provides maximum flexibility - creators can make rounds as easy (1 word) or hard (all words) as they want, and can create multi-round games for extended play sessions.

If real-time becomes critical later, the system can be upgraded to Durable Objects while maintaining the same API surface and user experience.

---

## Technical Review Resolution Summary

This plan has been updated to address all critical technical issues identified in the technical review:

### ✅ Resolved Issues

**#1, #2, #3 - Race Conditions & Timer Synchronization (SOLVED)**
- Local device timers eliminate timer synchronization issues
- No shared timers = no race conditions around timer expiration
- Client-side timer management = simpler, more resilient

**#4 - Network Failures & Disconnection (ADDRESSED)**
- Removed auto-timeout (no polling to detect disconnection)
- Added "soft-disconnect" feature: creator or any participant can soft-disconnect others
- Soft-disconnected participants can rejoin and catch up
- No need to tell participant they disconnected - their device works fine
- Server just needs way to advance group without waiting

**#5 - Database Transactions (IMPLEMENTED)**
- All critical operations use database transactions:
  - Word selection: record + update progress (atomic)
  - Round opening: open new + soft-close previous + update current_round (atomic)
  - Participant finishing: mark finished + mark ready (atomic)
- Prevents race conditions and inconsistent state

**#6 - Refresh/Rejoin (IMPLEMENTED)**
- Participant data stored in localStorage (gameCode, participantId, displayName, currentRound)
- On page refresh, automatically restore participant state
- Rejoin flow: if display name matches existing participant, return existing participantId
- All game state stored server-side - client just needs gameCode + participantId

**#7 - All Participants Leave (ACCEPTED)**
- Games quietly expire after 1 hour
- No special handling needed
- Database writes protected by participant ID/authentication
- Non-authenticated participants can only write text strings (capped at reasonable length)

**#8 - Creator Leaves (ADDRESSED)**
- Any participant can open next round (not just creator)
- Rounds are "soft-closed" when next round opens (allows catch-up)
- If creator unavailable, any participant can advance the group
- No need for lots of connection checks - as long as any participant is active, game continues

**#9, #10 - Timer Expiration & Polling (MITIGATED)**
- Local timers eliminate timer expiration race conditions
- Polling performance acceptable for this use case
- No shared timer management needed

**#11 - Rate Limiting (IMPLEMENTED)**
- Server-side rate limiting: max 1 selection per 500ms per participant
- Prevents spam/rapid guessing
- Checked on each word selection endpoint call

**#12 - Game Code Collision (IMPLEMENTED)**
- Unique game `id` (numeric, sequential, never reused) - permanent identifier
- Game `code` (6 characters) - temporal, can be reused, but not simultaneously
- Unique index ensures no two active games have same code
- Previous game data not modifiable when code reused (protected by game_id)

**#13 - Long Verses (OPTIMIZED)**
- All processing happens server-side (word splitting, validation, selection generation)
- Client only receives verse text, word indices, and progress numbers
- No heavy computation on client
- Can handle whole chapters (1000+ words) without client performance issues

**#14 - Display Name Uniqueness (ENFORCED)**
- Unique constraint on `(game_id, display_name)`
- Auto-adds "(2)", "(3)", etc. suffix if duplicate
- `ensureUniqueDisplayName()` helper function handles this automatically

### Key Design Decisions

1. **Local Device Timers**: Eliminates all timer synchronization complexity
2. **Soft-Disconnect**: Allows group to advance without waiting, but participant can rejoin
3. **Any Participant Can Advance**: Creator doesn't need to be present for game to continue
4. **Soft-Close Rounds**: Previous rounds remain accessible for catch-up
5. **localStorage Persistence**: Simple rejoin flow using gameCode + participantId
6. **Database Transactions**: All critical operations are atomic
7. **Server-Side Processing**: Handles long verses without client performance issues
8. **Game Code Reuse**: Codes can be reused after expiration, but not simultaneously

These changes make the system simpler, more resilient, and better suited for multi-device family gameplay.


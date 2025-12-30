import { Env } from '../types';
import { getDB, getUserId } from '../utils/db';
import { getAllDistractorWords, getWordsByType, bibleWords, sillyWords } from './wordLists';

// Types
interface CreateGameRequest {
  creatorDisplayName: string;
  rounds: Array<{
    roundNumber: number;
    verseReference: string;
    verseText: string;
    wordIndicesToHide: Array<{ index: number; type: string }>;
  }>;
  autoApproveParticipants?: boolean;
  timeLimitSeconds?: number;
}

interface JoinGameRequest {
  displayName: string;
}

interface SelectWordRequest {
  selectedWord: string;
  timeTakenMs: number;
}

interface ApproveParticipantRequest {
  participantId: string;
  approve: boolean;
}

interface MarkParticipantRequest {
  participantId: string;
  status: 'active' | 'left' | 'soft_disconnected';
}

// Helper: Generate unique 6-character game code
async function generateUniqueGameCode(env: Env): Promise<string> {
  const db = getDB(env);
  let attempts = 0;
  const maxAttempts = 10;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  
  while (attempts < maxAttempts) {
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
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique game code after multiple attempts');
}

// Helper: Ensure unique display name (add suffix if duplicate)
async function ensureUniqueDisplayName(
  gameId: number,
  displayName: string,
  env: Env
): Promise<string> {
  if (!gameId || typeof gameId !== 'number') {
    throw new Error('gameId must be a valid number');
  }
  if (!displayName || typeof displayName !== 'string') {
    throw new Error('displayName must be a valid string');
  }
  
  const db = getDB(env);
  let finalName = displayName.trim();
  
  if (!finalName) {
    throw new Error('displayName cannot be empty');
  }
  
  let suffix = 1;
  
  // Check if name already exists
  const existing = await db.prepare(`
    SELECT display_name FROM family_game_participants
    WHERE game_id = ? AND display_name = ?
  `).bind(gameId, finalName).first();
  
  if (!existing) {
    return finalName;
  }
  
  // Try with suffix
  while (suffix < 100) {
    const candidateName = `${finalName} (${suffix})`;
    const check = await db.prepare(`
      SELECT display_name FROM family_game_participants
      WHERE game_id = ? AND display_name = ?
    `).bind(gameId, candidateName).first();
    
    if (!check) {
      return candidateName;
    }
    suffix++;
  }
  
  // Fallback: use UUID suffix
  return `${finalName} (${crypto.randomUUID().substring(0, 8)})`;
}

// Helper: Get participant by display name (for rejoin)
async function getParticipantByDisplayName(
  gameId: number,
  displayName: string,
  env: Env
): Promise<{ participant_id: string; display_name: string } | null> {
  if (gameId === undefined || gameId === null || typeof gameId !== 'number') {
    console.error('getParticipantByDisplayName: invalid gameId', { gameId, type: typeof gameId });
    return null;
  }
  
  if (!displayName || typeof displayName !== 'string') {
    console.error('getParticipantByDisplayName: invalid displayName', { displayName, type: typeof displayName });
    return null;
  }
  
  const db = getDB(env);
  const trimmedName = displayName.trim();
  if (!trimmedName) {
    return null;
  }
  
  // Final validation before bind - ensure both values are defined and correct types
  if (gameId === undefined || gameId === null || !Number.isInteger(gameId) || gameId <= 0) {
    console.error('getParticipantByDisplayName: gameId invalid before bind', { gameId, type: typeof gameId });
    return null;
  }
  
  if (trimmedName === undefined || trimmedName === null || typeof trimmedName !== 'string' || trimmedName.length === 0) {
    console.error('getParticipantByDisplayName: trimmedName invalid before bind', { trimmedName, type: typeof trimmedName });
    return null;
  }
  
  const participant = await db.prepare(`
    SELECT participant_id, display_name FROM family_game_participants
    WHERE game_id = ? AND display_name = ? AND is_active = TRUE
  `).bind(gameId, trimmedName).first() as { participant_id: string; display_name: string } | null;
  
  return participant;
}

// Helper: Check if all active participants are ready for next round
async function checkAllParticipantsReady(
  gameId: number,
  roundId: number,
  env: Env
): Promise<boolean> {
  const db = getDB(env);
  
  // Get count of active participants (not soft-disconnected, not left)
  const activeCount = await db.prepare(`
    SELECT COUNT(*) as count FROM family_game_participants
    WHERE game_id = ? AND status = 'active' AND is_active = TRUE
  `).bind(gameId).first() as { count: number };
  
  // Get count of ready participants
  const readyCount = await db.prepare(`
    SELECT COUNT(*) as count FROM family_game_round_progress
    WHERE game_id = ? AND round_id = ? AND is_ready_for_next_round = TRUE
  `).bind(gameId, roundId).first() as { count: number };
  
  return activeCount.count > 0 && readyCount.count >= activeCount.count;
}

// Helper: Check if all rounds are complete and mark game as completed if so
async function checkAndMarkGameComplete(
  gameId: number,
  env: Env
): Promise<boolean> {
  const db = getDB(env);
  
  // Get game info
  const game = await db.prepare(`
    SELECT id, status, current_round FROM family_games WHERE id = ?
  `).bind(gameId).first() as { id: number; status: string; current_round: number | null };
  
  if (!game || game.status !== 'playing') {
    return false; // Game already completed or not playing
  }
  
  // Get total number of rounds
  const totalRounds = await db.prepare(`
    SELECT COUNT(*) as count FROM family_game_rounds WHERE game_id = ?
  `).bind(gameId).first() as { count: number };
  
  if (totalRounds.count === 0) {
    return false; // No rounds, can't be complete
  }
  
  // Get the last round
  const lastRound = await db.prepare(`
    SELECT id, round_number FROM family_game_rounds 
    WHERE game_id = ? 
    ORDER BY round_number DESC 
    LIMIT 1
  `).bind(gameId).first() as { id: number; round_number: number };
  
  if (!lastRound) {
    return false;
  }
  
  // Check if all participants are ready for the last round
  const allReady = await checkAllParticipantsReady(gameId, lastRound.id, env);
  
  // Check if the last round is soft-closed or all participants finished it
  const lastRoundInfo = await db.prepare(`
    SELECT round_soft_closed_at FROM family_game_rounds WHERE id = ?
  `).bind(lastRound.id).first() as { round_soft_closed_at: number | null };
  
  const lastRoundFinished = lastRoundInfo?.round_soft_closed_at !== null;
  
  // Game is complete if:
  // 1. Current round is the last round (or beyond)
  // 2. All participants are ready for the last round
  // 3. Last round is soft-closed (round has been opened and then soft-closed)
  // IMPORTANT: We must also check that the round was actually opened (has round_available_at)
  // to prevent marking games as complete before they even start
  const lastRoundOpened = await db.prepare(`
    SELECT round_available_at FROM family_game_rounds WHERE id = ?
  `).bind(lastRound.id).first() as { round_available_at: number | null };
  
  const roundWasOpened = lastRoundOpened?.round_available_at !== null;
  
  const isComplete = (game.current_round === null || game.current_round >= lastRound.round_number) &&
                     allReady &&
                     lastRoundFinished &&
                     roundWasOpened; // Round must have been opened at some point
  
  if (isComplete) {
    // Mark game as completed
    await db.prepare(`
      UPDATE family_games
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).bind(Date.now(), gameId).run();
    
    return true;
  }
  
  return false;
}

// Helper: Calculate points for word selection
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

// Helper: Calculate and update game statistics for a participant
async function calculateAndUpdateStats(
  gameId: number,
  participantId: string,
  displayName: string,
  env: Env
): Promise<void> {
  const db = getDB(env);
  
  // Get all selections for this participant in this game
  const selections = await db.prepare(`
    SELECT 
      is_correct,
      points_earned,
      streak_count,
      time_taken_ms
    FROM family_game_selections
    WHERE game_id = ? AND participant_id = ?
    ORDER BY selected_at ASC
  `).bind(gameId, participantId).all();
  
  // Calculate stats
  let totalPoints = 0;
  let correctSelections = 0;
  let incorrectSelections = 0;
  let wordsCompleted = 0;
  let longestStreak = 0;
  let totalTimeMs = 0;
  let currentStreak = 0;
  
  for (const selection of selections.results as any[]) {
    totalPoints += selection.points_earned || 0;
    totalTimeMs += selection.time_taken_ms || 0;
    
    if (selection.is_correct) {
      correctSelections++;
      wordsCompleted++;
      currentStreak = (selection.streak_count as number) || 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      incorrectSelections++;
      currentStreak = 0;
    }
  }
  
  // Calculate rounds completed
  const roundsCompleted = await db.prepare(`
    SELECT COUNT(DISTINCT round_id) as count
    FROM family_game_round_progress
    WHERE game_id = ? AND participant_id = ? AND is_finished = TRUE
  `).bind(gameId, participantId).first() as { count: number };
  
  const roundsCompletedCount = roundsCompleted?.count || 0;
  
  // Calculate accuracy
  const totalSelections = correctSelections + incorrectSelections;
  const accuracyPercentage = totalSelections > 0 
    ? (correctSelections / totalSelections) * 100 
    : 0;
  
  const averageTimePerWord = wordsCompleted > 0 
    ? Math.round(totalTimeMs / wordsCompleted) 
    : 0;
  
  // Check if stats exist
  const existingStats = await db.prepare(`
    SELECT id FROM family_game_stats
    WHERE game_id = ? AND participant_id = ?
  `).bind(gameId, participantId).first();
  
  if (existingStats) {
    // Update existing stats
    await db.prepare(`
      UPDATE family_game_stats SET
        display_name = ?,
        total_points = ?,
        rounds_completed = ?,
        correct_selections = ?,
        incorrect_selections = ?,
        words_completed = ?,
        longest_streak = ?,
        average_time_per_word_ms = ?,
        total_time_ms = ?,
        accuracy_percentage = ?
      WHERE game_id = ? AND participant_id = ?
    `).bind(
      displayName,
      totalPoints, roundsCompletedCount, correctSelections,
      incorrectSelections, wordsCompleted, longestStreak,
      averageTimePerWord, totalTimeMs, accuracyPercentage,
      gameId, participantId
    ).run();
  } else {
    // Insert new stats
    await db.prepare(`
      INSERT INTO family_game_stats (
        game_id, participant_id, display_name,
        total_points, rounds_completed, correct_selections,
        incorrect_selections, words_completed, longest_streak,
        average_time_per_word_ms, total_time_ms, accuracy_percentage
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      gameId, participantId, displayName,
      totalPoints, roundsCompletedCount, correctSelections,
      incorrectSelections, wordsCompleted, longestStreak,
      averageTimePerWord, totalTimeMs, accuracyPercentage
    ).run();
  }
  
  // Update ranks
  await db.prepare(`
    UPDATE family_game_stats
    SET rank = (
      SELECT COUNT(*) + 1
      FROM family_game_stats s2
      WHERE s2.game_id = family_game_stats.game_id
        AND (s2.total_points > family_game_stats.total_points
          OR (s2.total_points = family_game_stats.total_points 
            AND s2.accuracy_percentage > family_game_stats.accuracy_percentage))
    )
    WHERE game_id = ?
  `).bind(gameId).run();
}

// Helper: Generate all word options for a round
// Returns an array of all words that will be shown as options (persistent for entire round)
function generateAllRoundOptions(
  verseWords: string[],
  wordIndicesToHide: Array<{ index: number; type: string }>
): string[] {
  const allOptions: string[] = [];
  const verseWordsLower = verseWords.map(w => w.toLowerCase().trim());
  
  // Calculate number of options: max(10, hiddenWords.length * 1.5 rounded up)
  const numOptions = Math.max(10, Math.ceil(wordIndicesToHide.length * 1.5));
  
  // 1. Add all hidden words FIRST (these are the correct words - must be included)
  // Use a Set to track what we've added (case-insensitive)
  const addedWordsLower = new Set<string>();
  const hiddenWords: string[] = [];
  
  for (const w of wordIndicesToHide) {
    if (w.index >= 0 && w.index < verseWords.length) {
      const word = verseWords[w.index].trim();
      if (word && !addedWordsLower.has(word.toLowerCase())) {
        hiddenWords.push(word);
        addedWordsLower.add(word.toLowerCase());
      }
    }
  }
  
  allOptions.push(...hiddenWords);
  
  // 2. Get distractor words (NOT in verse) - 50% silly, 50% bible words
  // We only use words from the word lists, never words from the verse that are visible
  const neededDistractors = numOptions - allOptions.length;
  
  if (neededDistractors > 0) {
    try {
      // Get all verse words (both hidden and visible) to exclude from distractors
      const allVerseWordsLower = new Set(verseWordsLower);
      
      // Get bible words and silly words separately
      // Create sets for faster lookup
      const bibleWordsSet = new Set([
        ...bibleWords.nouns,
        ...bibleWords.verbs,
        ...bibleWords.adjectives,
        ...bibleWords.adverbs
      ].map(w => w.toLowerCase()));
      
      const bibleWordsList: string[] = [];
      const sillyWordsList: string[] = [];
      
      // Separate bible words from silly words
      for (const word of getAllDistractorWords()) {
        const wLower = word.toLowerCase().trim();
        if (allVerseWordsLower.has(wLower) || addedWordsLower.has(wLower)) {
          continue; // Skip if in verse or already added
        }
        
        if (bibleWordsSet.has(wLower)) {
          bibleWordsList.push(word);
        } else if (sillyWords.includes(word)) {
          sillyWordsList.push(word);
        }
      }
      
      // Shuffle both lists
      const shuffledBible = [...bibleWordsList].sort(() => Math.random() - 0.5);
      const shuffledSilly = [...sillyWordsList].sort(() => Math.random() - 0.5);
      
      // Calculate 50/50 split
      const halfNeeded = Math.ceil(neededDistractors / 2);
      const bibleCount = Math.min(halfNeeded, shuffledBible.length);
      const sillyCount = Math.min(neededDistractors - bibleCount, shuffledSilly.length);
      
      // Add bible words
      for (let i = 0; i < bibleCount; i++) {
        const word = shuffledBible[i];
        allOptions.push(word);
        addedWordsLower.add(word.toLowerCase());
      }
      
      // Add silly words
      for (let i = 0; i < sillyCount; i++) {
        const word = shuffledSilly[i];
        allOptions.push(word);
        addedWordsLower.add(word.toLowerCase());
      }
      
      // If we still need more (because one list ran out), fill from the other
      const stillNeeded = neededDistractors - (bibleCount + sillyCount);
      if (stillNeeded > 0) {
        if (bibleCount < halfNeeded) {
          // Need more bible words
          const moreBible = shuffledBible.slice(bibleCount, bibleCount + stillNeeded);
          for (const word of moreBible) {
            if (!addedWordsLower.has(word.toLowerCase())) {
              allOptions.push(word);
              addedWordsLower.add(word.toLowerCase());
            }
          }
        } else {
          // Need more silly words
          const moreSilly = shuffledSilly.slice(sillyCount, sillyCount + stillNeeded);
          for (const word of moreSilly) {
            if (!addedWordsLower.has(word.toLowerCase())) {
              allOptions.push(word);
              addedWordsLower.add(word.toLowerCase());
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting distractor words:', error);
    }
  }
  
  // 4. Shuffle all options together (but ensure all hidden words are included)
  // Create a map to track hidden words so we don't lose them
  const hiddenWordsSet = new Set(hiddenWords.map(w => w.toLowerCase()));
  const otherOptions = allOptions.filter(w => !hiddenWordsSet.has(w.toLowerCase()));
  const shuffledOthers = [...otherOptions].sort(() => Math.random() - 0.5);
  
  // Combine: all hidden words + shuffled others
  const finalOptions = [...hiddenWords, ...shuffledOthers];
  
  // Shuffle the entire list one more time
  const finalShuffled = [...finalOptions].sort(() => Math.random() - 0.5);
  
  // Return exactly numOptions words (but ensure we have at least all hidden words)
  // If numOptions is less than hidden words, return all hidden words + some others
  if (finalShuffled.length <= numOptions) {
    return finalShuffled;
  }
  
  // Ensure all hidden words are in the result
  const result: string[] = [];
  const resultWordsLower = new Set<string>();
  
  // First, add all hidden words
  for (const word of hiddenWords) {
    if (!resultWordsLower.has(word.toLowerCase())) {
      result.push(word);
      resultWordsLower.add(word.toLowerCase());
    }
  }
  
  // Then add other words until we reach numOptions
  for (const word of finalShuffled) {
    if (result.length >= numOptions) break;
    if (!resultWordsLower.has(word.toLowerCase())) {
      result.push(word);
      resultWordsLower.add(word.toLowerCase());
    }
  }
  
  // Final shuffle to mix hidden words with others
  return [...result].sort(() => Math.random() - 0.5);
}

// Helper: Validate display name
function validateDisplayName(displayName: string): { valid: boolean; error?: string } {
  const trimmed = displayName.trim();
  
  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Display name is required' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Display name must be 50 characters or less' };
  }
  
  // Only letters, numbers, and spaces
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, and spaces' };
  }
  
  return { valid: true };
}

export const handleFamilyGames = {
  // Create game (AUTH REQUIRED - Creator only)
  createGame: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json() as CreateGameRequest;
      
      // Validation
      if (!body.creatorDisplayName || !body.creatorDisplayName.trim()) {
        return new Response(JSON.stringify({ error: 'Creator display name is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate display name
      const nameValidation = validateDisplayName(body.creatorDisplayName);
      if (!nameValidation.valid) {
        return new Response(JSON.stringify({ error: nameValidation.error }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!body.rounds || !Array.isArray(body.rounds) || body.rounds.length === 0) {
        return new Response(JSON.stringify({ error: 'At least one round is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate each round
      for (const round of body.rounds) {
        if (!round.verseReference || !round.verseText) {
          return new Response(JSON.stringify({ error: 'Each round must have verseReference and verseText' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (!round.wordIndicesToHide || !Array.isArray(round.wordIndicesToHide) || round.wordIndicesToHide.length === 0) {
          return new Response(JSON.stringify({ error: 'Each round must have at least one word to hide' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Validate word indices are within verse bounds
        const verseWords = round.verseText.trim().split(/\s+/);
        for (const word of round.wordIndicesToHide) {
          if (word.index < 0 || word.index >= verseWords.length) {
            return new Response(JSON.stringify({ 
              error: `Word index ${word.index} is out of bounds for verse (0-${verseWords.length - 1})` 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Validate word type
          const validTypes = ['noun', 'adjective', 'verb', 'adverb', 'other'];
          if (!validTypes.includes(word.type.toLowerCase())) {
            return new Response(JSON.stringify({ 
              error: `Invalid word type: ${word.type}. Must be one of: ${validTypes.join(', ')}` 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }

      const db = getDB(env);
      const gameCode = await generateUniqueGameCode(env);
      const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now
      
      // Create game
      const gameResult = await db.prepare(`
        INSERT INTO family_games (
          game_code, created_by, status, auto_approve_participants, 
          time_limit_seconds, created_at, expires_at
        )
        VALUES (?, ?, 'waiting', ?, ?, ?, ?)
      `).bind(
        gameCode,
        userId,
        body.autoApproveParticipants ?? true,
        body.timeLimitSeconds ?? 300,
        Date.now(),
        expiresAt
      ).run();
      
      const gameId = gameResult.meta.last_row_id;
      
      // Create rounds
      for (const round of body.rounds) {
        await db.prepare(`
          INSERT INTO family_game_rounds (
            game_id, round_number, verse_reference, verse_text, word_indices_to_hide
          )
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          gameId,
          round.roundNumber,
          round.verseReference,
          round.verseText,
          JSON.stringify(round.wordIndicesToHide)
        ).run();
      }
      
      // Add creator as first approved participant with their chosen display name
      const creatorParticipantId = crypto.randomUUID();
      const creatorDisplayName = body.creatorDisplayName.trim();
      
      // Ensure unique display name (in case creator picks a name that conflicts)
      const uniqueCreatorDisplayName = await ensureUniqueDisplayName(
        gameId,
        creatorDisplayName,
        env
      );
      
      await db.prepare(`
        INSERT INTO family_game_participants (
          game_id, participant_id, display_name, is_approved, status
        )
        VALUES (?, ?, ?, TRUE, 'active')
      `).bind(gameId, creatorParticipantId, uniqueCreatorDisplayName).run();
      
      // Get created game with rounds
      const game = await db.prepare(`
        SELECT * FROM family_games WHERE id = ?
      `).bind(gameId).first();
      
      const rounds = await db.prepare(`
        SELECT * FROM family_game_rounds WHERE game_id = ? ORDER BY round_number
      `).bind(gameId).all();
      
      return new Response(JSON.stringify({
        success: true,
        game: {
          id: gameId,
          gameCode,
          status: 'waiting',
          autoApproveParticipants: body.autoApproveParticipants ?? true,
          timeLimitSeconds: body.timeLimitSeconds ?? 300,
          rounds: rounds.results.map(r => ({
            roundNumber: r.round_number,
            verseReference: r.verse_reference,
            verseText: r.verse_text,
            wordIndicesToHide: JSON.parse(r.word_indices_to_hide as string)
          })),
          createdAt: game.created_at,
          expiresAt: game.expires_at,
          creatorParticipantId,
          creatorDisplayName: uniqueCreatorDisplayName
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error creating game:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Join game (NO AUTHENTICATION REQUIRED)
  joinGame: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const body = await request.json() as JoinGameRequest;
      
      // Validate request body
      if (!body || !body.displayName) {
        return new Response(JSON.stringify({ error: 'displayName is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate display name
      const nameValidation = validateDisplayName(body.displayName);
      if (!nameValidation.valid) {
        return new Response(JSON.stringify({ error: nameValidation.error }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first() as any;
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Extract and validate values - D1 returns column names as-is
      const gameId = game.id;
      const expiresAt = game.expires_at;
      const autoApproveParticipantsValue = game.auto_approve_participants;
      
      if (gameId === undefined || gameId === null || typeof gameId !== 'number') {
        console.error('Invalid game data:', { gameId, game });
        return new Response(JSON.stringify({ error: 'Invalid game data' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (expiresAt === undefined || expiresAt === null || typeof expiresAt !== 'number') {
        console.error('Invalid expires_at:', { expiresAt, game });
        return new Response(JSON.stringify({ error: 'Invalid game data' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if game is expired
      // D1 returns booleans as 0/1 (integers)
      const autoApproveParticipants = autoApproveParticipantsValue === 1 || autoApproveParticipantsValue === true;
      
      if (expiresAt < Date.now()) {
        return new Response(JSON.stringify({ error: 'Game has expired' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check for rejoin scenario (existing participant with same display name)
      // Double-check gameId is valid before calling helper
      if (!Number.isInteger(gameId) || gameId <= 0) {
        console.error('joinGame: gameId validation failed', { gameId, type: typeof gameId, game });
        return new Response(JSON.stringify({ error: 'Invalid game data' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const existingParticipant = await getParticipantByDisplayName(
        gameId,
        body.displayName,
        env
      );
      
      if (existingParticipant) {
        // Rejoin - return existing participant
        return new Response(JSON.stringify({
          success: true,
          participantId: existingParticipant.participant_id,
          displayName: existingParticipant.display_name,
          isRejoin: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // New participant - ensure unique display name
      const uniqueDisplayName = await ensureUniqueDisplayName(
        gameId,
        body.displayName,
        env
      );
      
      if (!uniqueDisplayName || uniqueDisplayName.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid display name' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const participantId = crypto.randomUUID();
      const isApproved = autoApproveParticipants === true;
      
      // Validate all values before binding
      if (!gameId || !participantId || !uniqueDisplayName) {
        return new Response(JSON.stringify({ error: 'Internal error: missing required values' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Insert participant
      await db.prepare(`
        INSERT INTO family_game_participants (
          game_id, participant_id, display_name, is_approved, status
        )
        VALUES (?, ?, ?, ?, 'active')
      `).bind(gameId, participantId, uniqueDisplayName, isApproved ? 1 : 0).run();
      
      return new Response(JSON.stringify({
        success: true,
        participantId,
        displayName: uniqueDisplayName,
        isRejoin: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error joining game:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get game state (Polling endpoint - NO AUTH REQUIRED for participants, AUTH for creators)
  getGameState: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      const authHeader = request.headers.get('Authorization');
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verify participant or creator
      let isCreator = false;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await getUserId(token, env);
        if (userId && userId === game.created_by) {
          isCreator = true;
        }
      }
      
      if (!isCreator && !participantId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Update last_activity if participant
      if (participantId) {
        await db.prepare(`
          UPDATE family_game_participants
          SET last_activity = ?
          WHERE game_id = ? AND participant_id = ?
        `).bind(Date.now(), game.id, participantId).run();
      }
      
      // Get rounds
      const rounds = await db.prepare(`
        SELECT * FROM family_game_rounds WHERE game_id = ? ORDER BY round_number
      `).bind(game.id).all();
      
      // Get participants
      const participants = await db.prepare(`
        SELECT * FROM family_game_participants 
        WHERE game_id = ? AND is_active = TRUE
        ORDER BY joined_at
      `).bind(game.id).all();
      
      // Check if game should be marked as completed
      await checkAndMarkGameComplete(game.id as number, env);
      
      // Re-fetch game to get updated status
      const updatedGame = await db.prepare(`
        SELECT * FROM family_games WHERE id = ?
      `).bind(game.id).first();
      
      if (updatedGame) {
        game.status = updatedGame.status as string;
        game.completed_at = updatedGame.completed_at as number | null;
      }
      
      // Calculate stats for all participants if not already calculated
      // This ensures leaderboard is always available
      for (const participant of participants.results) {
        await calculateAndUpdateStats(
          game.id as number,
          participant.participant_id as string,
          participant.display_name as string,
          env
        );
      }
      
      // Get leaderboard (for between rounds)
      const leaderboard = await db.prepare(`
        SELECT 
          participant_id,
          display_name,
          total_points,
          rounds_completed,
          words_completed,
          longest_streak,
          accuracy_percentage,
          rank
        FROM family_game_stats
        WHERE game_id = ?
        ORDER BY rank ASC, total_points DESC
      `).bind(game.id).all();
      
      // Format rounds with status and ready counts
      const formattedRounds = await Promise.all(rounds.results.map(async (round: any) => {
        // Determine round status
        // If round has been soft-closed, it's no longer available
        let roundStatus = 'not_available';
        if (round.round_soft_closed_at) {
          roundStatus = 'soft_closed';
        } else if (round.round_available_at) {
          roundStatus = 'available';
        }
        
        // Get actual count of participants ready for this round
        const readyResult = await db.prepare(`
          SELECT COUNT(*) as count FROM family_game_round_progress
          WHERE game_id = ? AND round_id = ? AND is_ready_for_next_round = TRUE
        `).bind(game.id, round.id).first() as { count: number };
        
        const readyCount = readyResult?.count || 0;
        
        return {
          roundNumber: round.round_number,
          verseReference: round.verse_reference,
          verseText: round.verse_text,
          wordIndicesToHide: JSON.parse(round.word_indices_to_hide as string),
          roundStatus,
          roundAvailableAt: round.round_available_at,
          roundSoftClosedAt: round.round_soft_closed_at,
          participantsReady: readyCount,
          totalActiveParticipants: participants.results.length,
          allRoundOptions: round.round_options ? JSON.parse(round.round_options as string) : null
        };
      }));
      
      return new Response(JSON.stringify({
        success: true,
        game: {
          id: game.id,
          gameCode: game.game_code,
          status: game.status,
          currentRound: game.current_round,
          timeLimitSeconds: game.time_limit_seconds,
          rounds: formattedRounds,
          participants: participants.results.map((p: any) => ({
            participantId: p.participant_id,
            displayName: p.display_name,
            isApproved: p.is_approved,
            status: p.status
          })),
          leaderboard: leaderboard.results
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting game state:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Open round (Creator or any participant)
  openRound: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode and roundNumber from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const gameCode = pathParts[2];
      const roundNumber = pathParts[4];
      
      if (!gameCode || !roundNumber) {
        return new Response(JSON.stringify({ error: 'Game code and round number are required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      const authHeader = request.headers.get('Authorization');
      const roundNum = parseInt(roundNumber);
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verify creator or participant
      let isCreator = false;
      let isParticipant = false;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await getUserId(token, env);
        if (userId && userId === game.created_by) {
          isCreator = true;
        }
      }
      
      if (participantId) {
        const participant = await db.prepare(`
          SELECT * FROM family_game_participants
          WHERE game_id = ? AND participant_id = ? AND is_approved = TRUE AND is_active = TRUE
        `).bind(game.id, participantId).first();
        if (participant) {
          isParticipant = true;
        }
      }
      
      if (!isCreator && !isParticipant) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get round
      const round = await db.prepare(`
        SELECT * FROM family_game_rounds
        WHERE game_id = ? AND round_number = ?
      `).bind(game.id, roundNum).first();
      
      if (!round) {
        return new Response(JSON.stringify({ error: 'Round not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // If not first round, check if all participants are ready for previous round
      if (roundNum > 1) {
        const previousRound = await db.prepare(`
          SELECT id FROM family_game_rounds
          WHERE game_id = ? AND round_number = ?
        `).bind(game.id, roundNum - 1).first();
        
        if (previousRound) {
          const allReady = await checkAllParticipantsReady(game.id as number, previousRound.id as number, env);
          if (!allReady) {
            return new Response(JSON.stringify({ error: 'Not all participants are ready for the next round' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Soft-close previous round
          await db.prepare(`
            UPDATE family_game_rounds
            SET round_soft_closed_at = ?
            WHERE id = ?
          `).bind(Date.now(), previousRound.id).run();
        }
      }
      
      // Open new round and update current_round atomically
      await db.batch([
        db.prepare(`
          UPDATE family_game_rounds
          SET round_available_at = ?
          WHERE id = ?
        `).bind(Date.now(), round.id),
        db.prepare(`
          UPDATE family_games
          SET current_round = ?
          WHERE id = ?
        `).bind(roundNum, game.id)
      ]);
      
      // Check if game should be marked as completed (after opening round)
      await checkAndMarkGameComplete(game.id as number, env);
      
      return new Response(JSON.stringify({
        success: true,
        roundAvailableAt: Date.now(),
        timeLimitSeconds: game.time_limit_seconds,
        message: `Round ${roundNum} is now available! Participants can start when ready.`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error opening round:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Start round (Participant - NO AUTH REQUIRED)
  startRound: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode and roundNumber from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const gameCode = pathParts[2];
      const roundNumber = pathParts[4];
      
      if (!gameCode || !roundNumber) {
        return new Response(JSON.stringify({ error: 'Game code and round number are required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      const roundNum = parseInt(roundNumber);
      
      if (!participantId) {
        return new Response(JSON.stringify({ error: 'Participant ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verify participant
      const participant = await db.prepare(`
        SELECT * FROM family_game_participants
        WHERE game_id = ? AND participant_id = ? AND is_approved = TRUE AND is_active = TRUE
      `).bind(game.id, participantId).first();
      
      if (!participant) {
        return new Response(JSON.stringify({ error: 'Participant not found or not approved' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get round
      const round = await db.prepare(`
        SELECT * FROM family_game_rounds
        WHERE game_id = ? AND round_number = ?
      `).bind(game.id, roundNum).first();
      
      if (!round) {
        return new Response(JSON.stringify({ error: 'Round not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!round.round_available_at) {
        return new Response(JSON.stringify({ error: 'Round is not available yet' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if already started
      const existingProgress = await db.prepare(`
        SELECT * FROM family_game_round_progress
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
      `).bind(game.id, round.id, participantId).first();
      
      const roundStartedAt = Date.now();
      
      if (existingProgress) {
        // Already started - return existing start time
        return new Response(JSON.stringify({
          success: true,
          roundStartedAt: existingProgress.round_started_at,
          timeLimitSeconds: game.time_limit_seconds,
          message: 'Round already started'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Generate all round options (if not already generated)
      // Sort wordIndicesToHide by index to ensure words are filled in verse order
      const wordIndicesToHide = (JSON.parse(round.word_indices_to_hide as string) as Array<{ index: number; type: string }>)
        .sort((a, b) => a.index - b.index);
      const verseWords = round.verse_text.split(/\s+/).filter(w => w.length > 0);
      
      let allRoundOptions: string[] = [];
      
      // Check if round_options already exists (column might not exist if migration hasn't run)
      try {
        if (round.round_options) {
          allRoundOptions = JSON.parse(round.round_options as string);
        }
      } catch (e) {
        // Column might not exist, ignore
      }
      
      // Generate options if not already loaded
      if (allRoundOptions.length === 0) {
        // Generate all options for the round
        allRoundOptions = generateAllRoundOptions(verseWords, wordIndicesToHide);
        
        // Store in round table for future use (if column exists)
        try {
          await db.prepare(`
            UPDATE family_game_rounds
            SET round_options = ?
            WHERE id = ?
          `).bind(JSON.stringify(allRoundOptions), round.id).run();
        } catch (e: any) {
          // Column might not exist yet - that's okay, we'll still return the options
          console.warn('Could not save round_options to database (column may not exist):', e.message);
        }
      }
      
      // Create progress record
      await db.prepare(`
        INSERT INTO family_game_round_progress (
          game_id, round_id, participant_id, round_started_at
        )
        VALUES (?, ?, ?, ?)
      `).bind(game.id, round.id, participantId, roundStartedAt).run();
      
      return new Response(JSON.stringify({
        success: true,
        roundStartedAt,
        timeLimitSeconds: game.time_limit_seconds,
        message: `Round ${roundNum} started! Your timer is running.`,
        allRoundOptions: allRoundOptions
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error starting round:', error);
      console.error('Error stack:', error.stack);
      return new Response(JSON.stringify({ 
        error: error.message || 'Internal Server Error',
        details: process.env.ENVIRONMENT === 'development' ? error.stack : undefined
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Select word (NO AUTH REQUIRED)
  selectWord: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode and roundNumber from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const gameCode = pathParts[2];
      const roundNumber = pathParts[4];
      
      if (!gameCode || !roundNumber) {
        return new Response(JSON.stringify({ error: 'Game code and round number are required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      const roundNum = parseInt(roundNumber);
      const body = await request.json() as SelectWordRequest;
      
      if (!participantId) {
        return new Response(JSON.stringify({ error: 'Participant ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Rate limiting: check last selection within 100ms
      const recentSelection = await db.prepare(`
        SELECT selected_at FROM family_game_selections
        WHERE participant_id = ?
        ORDER BY selected_at DESC
        LIMIT 1
      `).bind(participantId).first();
      
      if (recentSelection && (Date.now() - (recentSelection.selected_at as number)) < 100) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before selecting again.' }), { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (game.status !== 'playing') {
        return new Response(JSON.stringify({ error: 'Game is not in playing status' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get round
      const round = await db.prepare(`
        SELECT * FROM family_game_rounds
        WHERE game_id = ? AND round_number = ?
      `).bind(game.id, roundNum).first();
      
      if (!round) {
        return new Response(JSON.stringify({ error: 'Round not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get participant progress
      const progress = await db.prepare(`
        SELECT * FROM family_game_round_progress
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
      `).bind(game.id, round.id, participantId).first();
      
      if (!progress) {
        return new Response(JSON.stringify({ error: 'Round not started by participant' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (progress.is_finished) {
        return new Response(JSON.stringify({ error: 'Round already finished' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if timer expired
      const timeLimitMs = game.time_limit_seconds * 1000;
      if (body.timeTakenMs >= timeLimitMs) {
        // Finish round due to time expiration
        await db.batch([
          db.prepare(`
            UPDATE family_game_round_progress
            SET is_finished = TRUE, is_ready_for_next_round = TRUE, 
                round_ended_at = ?, finished_reason = 'time_expired'
            WHERE game_id = ? AND round_id = ? AND participant_id = ?
          `).bind(Date.now(), game.id, round.id, participantId)
        ]);
        
        return new Response(JSON.stringify({
          success: true,
          isCorrect: false,
          message: 'Time expired!',
          isRoundComplete: true,
          finishedReason: 'time_expired'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Parse word indices to hide
      // Sort by index to ensure words are filled in verse order (not selection order)
      const wordIndicesToHide = (JSON.parse(round.word_indices_to_hide as string) as Array<{ index: number; type: string }>)
        .sort((a, b) => a.index - b.index);
      const verseWords = round.verse_text.trim().split(/\s+/);
      
      // Get current word index in the sorted words array (tracks position in verse order)
      const currentWordIndex = progress.current_word_index || 0;
      
      if (currentWordIndex >= wordIndicesToHide.length) {
        // Already completed all words
        return new Response(JSON.stringify({
          success: true,
          isCorrect: false,
          message: 'All words already completed',
          isRoundComplete: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get the correct word (now in verse order)
      const correctWordIndex = wordIndicesToHide[currentWordIndex].index;
      const correctWord = verseWords[correctWordIndex];
      const selectedWordLower = body.selectedWord.trim().toLowerCase();
      const correctWordLower = correctWord.toLowerCase();
      
      // Determine selection status:
      // - "correct": exact match with current word
      // - "wrong_position": word is in verse but not the current correct word (yellow)
      // - "not_in_verse": word is not in verse at all (red)
      let selectionStatus: 'correct' | 'wrong_position' | 'not_in_verse';
      const isCorrect = selectedWordLower === correctWordLower;
      
      if (isCorrect) {
        selectionStatus = 'correct';
      } else {
        // Check if selected word is in the verse at all
        const isInVerse = verseWords.some(w => w.toLowerCase() === selectedWordLower);
        if (isInVerse) {
          selectionStatus = 'wrong_position';
        } else {
          selectionStatus = 'not_in_verse';
        }
      }
      
      // Get current streak
      const lastSelection = await db.prepare(`
        SELECT streak_count, is_correct FROM family_game_selections
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
        ORDER BY selected_at DESC
        LIMIT 1
      `).bind(game.id, round.id, participantId).first();
      
      let streakCount = 0;
      if (lastSelection && lastSelection.is_correct) {
        streakCount = (lastSelection.streak_count as number) + 1;
      } else if (isCorrect) {
        streakCount = 1;
      }
      
      // Calculate points (only for correct selections)
      const pointsEarned = calculatePoints(isCorrect, body.timeTakenMs, streakCount, timeLimitMs);
      
      // Update progress atomically (only advance if correct)
      const newWordIndex = isCorrect ? currentWordIndex + 1 : currentWordIndex;
      const isRoundComplete = newWordIndex >= wordIndicesToHide.length;
      
      // Only record selection if it's correct (for scoring)
      if (isCorrect) {
        await db.batch([
          // Record selection
          db.prepare(`
            INSERT INTO family_game_selections (
              game_id, round_id, participant_id, word_index, selected_word,
              is_correct, time_taken_ms, streak_count, points_earned
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            game.id, round.id, participantId, correctWordIndex,
            body.selectedWord.substring(0, 100), 1, body.timeTakenMs,
            streakCount, pointsEarned
          ),
          // Update progress
          db.prepare(`
            UPDATE family_game_round_progress
            SET current_word_index = ?, is_finished = ?, is_ready_for_next_round = ?,
                round_ended_at = ?, finished_reason = ?
            WHERE game_id = ? AND round_id = ? AND participant_id = ?
          `).bind(
            newWordIndex,
            isRoundComplete,
            isRoundComplete,
            isRoundComplete ? Date.now() : null,
            isRoundComplete ? 'completed' : null,
            game.id, round.id, participantId
          )
        ]);
      }
      
      // If round is complete, check if this is the last round and all participants are ready
      // If so, mark game as completed
      if (isRoundComplete) {
        // Get total number of rounds
        const totalRounds = await db.prepare(`
          SELECT COUNT(*) as count FROM family_game_rounds WHERE game_id = ?
        `).bind(game.id).first() as { count: number };
        
        // Check if this is the last round
        if (round.round_number >= totalRounds.count) {
          // Check if all participants are ready for this round
          const allReady = await checkAllParticipantsReady(game.id as number, round.id as number, env);
          if (allReady) {
            // Soft-close this round and mark game as completed
            await db.batch([
              db.prepare(`
                UPDATE family_game_rounds
                SET round_soft_closed_at = ?
                WHERE id = ?
              `).bind(Date.now(), round.id),
              db.prepare(`
                UPDATE family_games
                SET status = 'completed', completed_at = ?
                WHERE id = ?
              `).bind(Date.now(), game.id)
            ]);
          }
        }
      }
      
      // Get updated progress
      const updatedProgress = await db.prepare(`
        SELECT * FROM family_game_round_progress
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
      `).bind(game.id, round.id, participantId).first();
      
      // Get all round options (should already be stored in round)
      const roundWithOptions = await db.prepare(`
        SELECT round_options FROM family_game_rounds WHERE id = ?
      `).bind(round.id).first();
      
      const allRoundOptions = roundWithOptions?.round_options 
        ? JSON.parse(roundWithOptions.round_options as string)
        : [];
      
      // Calculate cumulative points
      const cumulativePoints = await db.prepare(`
        SELECT SUM(points_earned) as total FROM family_game_selections
        WHERE game_id = ? AND round_id = ? AND participant_id = ?
      `).bind(game.id, round.id, participantId).first() as { total: number | null };
      
      return new Response(JSON.stringify({
        success: true,
        isCorrect,
        selectionStatus, // 'correct' | 'wrong_position' | 'not_in_verse'
        message: isCorrect ? `Correct! Streak of ${streakCount}!` : selectionStatus === 'wrong_position' ? 'Wrong position!' : 'Not in verse!',
        isRoundComplete,
        allRoundOptions: allRoundOptions.length > 0 ? allRoundOptions : undefined,
        roundProgress: {
          currentWordIndex: newWordIndex,
          totalWords: wordIndicesToHide.length,
          wordsCompleted: newWordIndex,
          points: cumulativePoints?.total || 0,
          streak: isCorrect ? streakCount : 0
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error selecting word:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Approve participant (Creator only - AUTH REQUIRED)
  approveParticipant: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      const body = await request.json() as ApproveParticipantRequest;
      
      // Get game and verify creator
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND created_by = ? AND is_active = TRUE
      `).bind(gameCode, userId).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Update participant approval
      await db.prepare(`
        UPDATE family_game_participants
        SET is_approved = ?
        WHERE game_id = ? AND participant_id = ?
      `).bind(body.approve, game.id, body.participantId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: body.approve ? 'Participant approved' : 'Participant unapproved'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error approving participant:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Start game (Creator only - AUTH REQUIRED)
  startGame: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      
      // Get game and verify creator
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND created_by = ? AND is_active = TRUE
      `).bind(gameCode, userId).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (game.status !== 'waiting') {
        return new Response(JSON.stringify({ error: 'Game already started' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if at least one other participant is approved
      const participantCount = await db.prepare(`
        SELECT COUNT(*) as count FROM family_game_participants
        WHERE game_id = ? AND is_approved = TRUE AND is_active = TRUE
      `).bind(game.id).first() as { count: number };
      
      if (participantCount.count < 1) {
        return new Response(JSON.stringify({ error: 'At least one approved participant is required to start the game' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Start game
      await db.prepare(`
        UPDATE family_games
        SET status = 'playing', started_at = ?, current_round = 1
        WHERE id = ?
      `).bind(Date.now(), game.id).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Game started! You can now open Round 1.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error starting game:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Leave game (NO AUTH REQUIRED)
  leaveGame: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      
      if (!participantId) {
        return new Response(JSON.stringify({ error: 'Participant ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Mark participant as left
      await db.prepare(`
        UPDATE family_game_participants
        SET status = 'left', is_active = FALSE
        WHERE game_id = ? AND participant_id = ?
      `).bind(game.id, participantId).run();
      
      // If in a round, mark progress as finished with reason 'left'
      const currentRound = await db.prepare(`
        SELECT id FROM family_game_rounds
        WHERE game_id = ? AND round_number = ?
      `).bind(game.id, game.current_round).first();
      
      if (currentRound) {
        await db.prepare(`
          UPDATE family_game_round_progress
          SET is_finished = TRUE, is_ready_for_next_round = TRUE,
              round_ended_at = ?, finished_reason = 'left'
          WHERE game_id = ? AND round_id = ? AND participant_id = ?
        `).bind(Date.now(), game.id, currentRound.id, participantId).run();
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Left game successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error leaving game:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Soft-disconnect participant (Creator or any participant)
  softDisconnectParticipant: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const db = getDB(env);
      const participantId = request.headers.get('X-Participant-Id');
      const authHeader = request.headers.get('Authorization');
      const body = await request.json() as { participantId: string };
      
      // Get game
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND is_active = TRUE
      `).bind(gameCode).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or expired' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verify creator or participant
      let isCreator = false;
      let isParticipant = false;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await getUserId(token, env);
        if (userId && userId === game.created_by) {
          isCreator = true;
        }
      }
      
      if (participantId) {
        const participant = await db.prepare(`
          SELECT * FROM family_game_participants
          WHERE game_id = ? AND participant_id = ? AND is_approved = TRUE AND is_active = TRUE
        `).bind(game.id, participantId).first();
        if (participant) {
          isParticipant = true;
        }
      }
      
      if (!isCreator && !isParticipant) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Soft-disconnect the participant
      await db.prepare(`
        UPDATE family_game_participants
        SET status = 'soft_disconnected'
        WHERE game_id = ? AND participant_id = ?
      `).bind(game.id, body.participantId).run();
      
      // Mark as ready for next round if in a round
      const currentRound = await db.prepare(`
        SELECT id FROM family_game_rounds
        WHERE game_id = ? AND round_number = ?
      `).bind(game.id, game.current_round).first();
      
      if (currentRound) {
        await db.prepare(`
          UPDATE family_game_round_progress
          SET is_ready_for_next_round = TRUE, finished_reason = 'soft_disconnected'
          WHERE game_id = ? AND round_id = ? AND participant_id = ?
        `).bind(game.id, currentRound.id, body.participantId).run();
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Participant soft-disconnected. They can rejoin and catch up.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error soft-disconnecting participant:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // End game (Creator only - AUTH REQUIRED)
  endGame: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Extract gameCode from URL
      const url = new URL(request.url);
      const gameCode = url.pathname.split('/')[2];
      
      if (!gameCode) {
        return new Response(JSON.stringify({ error: 'Game code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      
      // Get game and verify creator
      const game = await db.prepare(`
        SELECT * FROM family_games 
        WHERE game_code = ? AND created_by = ? AND is_active = TRUE
      `).bind(gameCode, userId).first();
      
      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // End game
      await db.prepare(`
        UPDATE family_games
        SET status = 'ended', completed_at = ?, is_active = FALSE
        WHERE id = ?
      `).bind(Date.now(), game.id).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Game ended successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error ending game:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};


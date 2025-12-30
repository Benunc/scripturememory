import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import {
  getGameState,
  Game,
  openRound,
  startRound,
  selectWord,
  SelectWordResponse,
  startGame,
  approveParticipant,
  leaveGame,
  endGame
} from '../utils/api';
import { debug } from '../utils/debug';

export interface UseFamilyGameOptions {
  gameCode: string;
  participantId?: string;
  isCreator?: boolean;
  autoPoll?: boolean;
  pollingInterval?: number;
}

export interface UseFamilyGameReturn {
  game: Game | null;
  loading: boolean;
  error: string | null;
  refreshGame: () => Promise<void>;
  openNextRound: (roundNumber: number) => Promise<boolean>;
  startRoundForParticipant: (roundNumber: number) => Promise<{ success: boolean; allRoundOptions?: string[] } | null>;
  selectWordForParticipant: (roundNumber: number, selectedWord: string, timeTakenMs: number) => Promise<SelectWordResponse | null>;
  startGame: () => Promise<boolean>;
  approveParticipant: (participantId: string, approve: boolean) => Promise<boolean>;
  leaveGame: () => Promise<boolean>;
  endGame: () => Promise<boolean>;
}

export function useFamilyGame({
  gameCode,
  participantId,
  isCreator = false,
  autoPoll = true,
  pollingInterval = isCreator ? 5000 : 10000
}: UseFamilyGameOptions): UseFamilyGameReturn {
  const { token } = useAuthContext();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const gameCompleteRef = useRef(false);
  const gameRef = useRef<Game | null>(null); // Ref to track current game state for polling checks

  const fetchGameState = useCallback(async () => {
    if (isPollingRef.current) return;
    
    // Don't fetch if game is already marked as complete
    if (gameCompleteRef.current) {
      debug.log('family-game', 'Game is complete, skipping fetch');
      return;
    }
    
    try {
      isPollingRef.current = true;
      debug.log('family-game', `Fetching game state for ${gameCode}`, { isCreator, participantId });
      
      const result = await getGameState(gameCode, token || undefined, participantId);
      
      if (result.error) {
        setError(result.error);
        debug.error('family-game', 'Error fetching game state:', result.error);
      } else if (result.data) {
        const updatedGame = result.data.game;
        setGame(updatedGame);
        gameRef.current = updatedGame; // Update ref for polling checks
        setError(null);
        debug.log('family-game', 'Game state updated:', updatedGame);
        
        // Stop polling if game is complete - this is the authoritative check
        if (updatedGame.status === 'completed' || updatedGame.status === 'ended') {
          debug.log('family-game', 'Game is complete, stopping polling');
          gameCompleteRef.current = true;
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Also set isPollingRef to prevent any pending calls
          isPollingRef.current = false;
          return;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch game state';
      setError(errorMessage);
      debug.error('family-game', 'Exception fetching game state:', err);
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, [gameCode, token, participantId, isCreator]);

  const refreshGame = useCallback(async () => {
    setLoading(true);
    await fetchGameState();
  }, [fetchGameState]);

  // Polling logic
  useEffect(() => {
    if (!autoPoll || !gameCode) return;
    
    // Don't fetch if we don't have either token (for creator) or participantId (for participant)
    if (!isCreator && !participantId) {
      debug.log('family-game', 'Skipping fetch - no participantId and not creator');
      return;
    }
    
    if (isCreator && !token) {
      debug.log('family-game', 'Skipping fetch - creator but no token');
      return;
    }

    // For participants: check if we're in an active round - if so, DON'T start polling
    if (!isCreator && gameRef.current && gameRef.current.status === 'playing' && gameRef.current.currentRound) {
      const currentRound = gameRef.current.rounds.find(r => r.roundNumber === gameRef.current!.currentRound);
      if (currentRound && currentRound.roundStatus === 'available') {
        debug.log('family-game', 'Participant in active round - not starting polling');
        return; // Don't start polling for participants during active rounds
      }
    }

    // Initial fetch
    fetchGameState();

    // Set up polling
    if (isCreator) {
      // Creator polls every 5 seconds
      pollingRef.current = setInterval(() => {
        // Check if game is complete before fetching
        if (gameCompleteRef.current) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
        fetchGameState();
      }, pollingInterval);
    } else {
      // Participants only poll between rounds (not during active rounds)
      pollingRef.current = setInterval(() => {
        // Check if game is complete before fetching
        if (gameCompleteRef.current) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
        
        // Check current game state from ref to see if we're in an active round
        const currentGame = gameRef.current;
        if (currentGame && currentGame.status === 'playing' && currentGame.currentRound) {
          const currentRound = currentGame.rounds.find(r => r.roundNumber === currentGame.currentRound);
          if (currentRound && currentRound.roundStatus === 'available') {
            // Don't poll during active rounds - participants see only their own progress
            debug.log('family-game', 'Skipping poll - in active round');
            return;
          }
        }
        
        // Not in active round, proceed with fetch
        fetchGameState();
      }, pollingInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [autoPoll, gameCode, isCreator, token, participantId, pollingInterval]);

  const openNextRound = useCallback(async (roundNumber: number): Promise<boolean> => {
    try {
      const result = await openRound(gameCode, roundNumber, token || undefined, participantId);
      if (result.error) {
        setError(result.error);
        return false;
      }
      await fetchGameState();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open round');
      return false;
    }
  }, [gameCode, token, participantId, fetchGameState]);

  const startRoundForParticipant = useCallback(async (roundNumber: number): Promise<{ success: boolean; firstWordOptions?: string[] } | null> => {
    if (!participantId) {
      setError('Participant ID required');
      return null;
    }
    
    try {
      const result = await startRound(gameCode, roundNumber, participantId);
      if (result.error) {
        setError(result.error);
        return null;
      }
      await fetchGameState();
      return {
        success: true,
        allRoundOptions: result.data?.allRoundOptions
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start round');
      return null;
    }
  }, [gameCode, participantId, fetchGameState]);

  const selectWordForParticipant = useCallback(async (
    roundNumber: number,
    selectedWord: string,
    timeTakenMs: number
  ): Promise<SelectWordResponse | null> => {
    if (!participantId) {
      setError('Participant ID required');
      return null;
    }
    
    try {
      const result = await selectWord(gameCode, roundNumber, participantId, selectedWord, timeTakenMs);
      if (result.error) {
        setError(result.error);
        return null;
      }
      
      // Refresh game state after word selection
      await fetchGameState();
      
      return result.data || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select word');
      return null;
    }
  }, [gameCode, participantId, fetchGameState]);

  const handleStartGame = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setError('Authentication required');
      return false;
    }
    
    try {
      const result = await startGame(gameCode, token);
      if (result.error) {
        setError(result.error);
        return false;
      }
      await fetchGameState();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
      return false;
    }
  }, [gameCode, token, fetchGameState]);

  const handleApproveParticipant = useCallback(async (participantId: string, approve: boolean): Promise<boolean> => {
    if (!token) {
      setError('Authentication required');
      return false;
    }
    
    try {
      const result = await approveParticipant(gameCode, token, participantId, approve);
      if (result.error) {
        setError(result.error);
        return false;
      }
      await fetchGameState();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve participant');
      return false;
    }
  }, [gameCode, token, fetchGameState]);

  const handleLeaveGame = useCallback(async (): Promise<boolean> => {
    if (!participantId) {
      setError('Participant ID required');
      return false;
    }
    
    try {
      const result = await leaveGame(gameCode, participantId);
      if (result.error) {
        setError(result.error);
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave game');
      return false;
    }
  }, [gameCode, participantId]);

  const handleEndGame = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setError('Authentication required');
      return false;
    }
    
    try {
      const result = await endGame(gameCode, token);
      if (result.error) {
        setError(result.error);
        return false;
      }
      await fetchGameState();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end game');
      return false;
    }
  }, [gameCode, token, fetchGameState]);

  return {
    game,
    loading,
    error,
    refreshGame,
    openNextRound,
    startRoundForParticipant,
    selectWordForParticipant,
    startGame: handleStartGame,
    approveParticipant: handleApproveParticipant,
    leaveGame: handleLeaveGame,
    endGame: handleEndGame
  };
}


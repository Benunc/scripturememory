import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { debug } from '../utils/debug';
import { getApiUrl } from '../utils/api';

interface VerseStreak {
  verse_reference: string;
  longest_guess_streak: number;
  current_guess_streak: number;
  last_guess_date: number;
}

interface PointsContextType {
  points: number;
  longestWordGuessStreak: number;
  currentStreak: number;
  verseStreaks: VerseStreak[];
  currentVerseStreak: number;
  currentVerseReference: string | null;
  updatePoints: (points: number) => void;
  updateLongestWordGuessStreak: (streak: number) => void;
  updateCurrentStreak: (streak: number) => void;
  updateVerseStreak: (verseReference: string, streakLength: number) => void;
  resetVerseStreak: (verseReference: string) => Promise<void>;
  resetVerseStreakImmediate: (verseReference: string) => void;
  setCurrentVerse: (verseReference: string | null) => void;
  refreshPoints: () => Promise<void>;
  refreshVerseStreaks: () => Promise<void>;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const usePoints = () => {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
};

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [points, setPoints] = useState(() => {
    // Initialize from localStorage if available
    const storedPoints = localStorage.getItem('points');
    return storedPoints ? parseInt(storedPoints, 10) : 0;
  });
  const [longestWordGuessStreak, setLongestWordGuessStreak] = useState(() => {
    // Initialize from localStorage if available
    const storedStreak = localStorage.getItem('longest_word_guess_streak');
    return storedStreak ? parseInt(storedStreak, 10) : 0;
  });
  const [currentStreak, setCurrentStreak] = useState(() => {
    // Initialize from localStorage if available
    const storedStreak = localStorage.getItem('current_word_guess_streak');
    return storedStreak ? parseInt(storedStreak, 10) : 0;
  });
  const [verseStreaks, setVerseStreaks] = useState<VerseStreak[]>([]);
  const [currentVerseStreak, setCurrentVerseStreak] = useState(0);
  const [currentVerseReference, setCurrentVerseReference] = useState<string | null>(null);
  const { isAuthenticated } = useAuthContext();
  const [lastRefresh, setLastRefresh] = useState(0);
  const REFRESH_COOLDOWN = 5000; // 5 seconds between refreshes

  const refreshPoints = async () => {
    if (!isAuthenticated) return;

    const now = Date.now();
    if (now - lastRefresh < REFRESH_COOLDOWN) {
      debug.log('api', 'Skipping points refresh - in cooldown');
      return;
    }

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      debug.log('api', 'Fetching points...');
      const response = await fetch(`${getApiUrl()}/gamification/stats`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch points');
      }

      const data = await response.json();
      debug.log('api', 'Received points data:', data);
      const newPoints = data.total_points || 0;
      const newLongestWordGuessStreak = data.longest_word_guess_streak || 0;
      const newVerseStreaks = data.verse_streaks || [];
      setPoints(newPoints);
      
      // Merge verse streaks to preserve immediate frontend updates
      setVerseStreaks(prev => {
        const merged = [...prev];
        newVerseStreaks.forEach((serverStreak: any) => {
          const existingIndex = merged.findIndex(vs => vs.verse_reference === serverStreak.verse_reference);
          if (existingIndex >= 0) {
            // Merge server data with existing frontend data
            merged[existingIndex] = {
              ...merged[existingIndex],
              longest_guess_streak: Math.max(merged[existingIndex].longest_guess_streak, serverStreak.longest_guess_streak),
              last_guess_date: serverStreak.last_guess_date
            };
          } else {
            // Add new verse streak from server
            merged.push(serverStreak);
          }
        });
        return merged;
      });
      
      // Only update longest word guess streak if server value is higher
      if (newLongestWordGuessStreak > longestWordGuessStreak) {
        setLongestWordGuessStreak(newLongestWordGuessStreak);
        localStorage.setItem('longest_word_guess_streak', newLongestWordGuessStreak.toString());
      }
      
      localStorage.setItem('points', newPoints.toString());
      setLastRefresh(now);
    } catch (error) {
      debug.error('api', 'Error fetching points:', error);
    }
  };

  const updatePoints = (newPoints: number) => {
    // Update local state and localStorage immediately
    setPoints(newPoints);
    localStorage.setItem('points', newPoints.toString());
    
    // Then sync with server in the background
    void refreshPoints();
  };

  const updateLongestWordGuessStreak = (streak: number) => {
    setLongestWordGuessStreak(streak);
    localStorage.setItem('longest_word_guess_streak', streak.toString());
  };

  const updateCurrentStreak = (streak: number) => {
    setCurrentStreak(streak);
    localStorage.setItem('current_word_guess_streak', streak.toString());
  };

  const updateVerseStreak = (verseReference: string, streakLength: number) => {
    debug.log('api', `Updating verse streak for ${verseReference}: ${streakLength} words`);
    setVerseStreaks(prev => {
      const existingIndex = prev.findIndex(vs => vs.verse_reference === verseReference);
      if (existingIndex >= 0) {
        // Update existing verse streak
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newLongest = Math.max(existing.longest_guess_streak, streakLength);
        updated[existingIndex] = {
          ...existing,
          longest_guess_streak: newLongest,
          current_guess_streak: streakLength,
          last_guess_date: Date.now()
        };
        debug.log('api', `Updated existing verse streak: ${existing.longest_guess_streak} -> ${newLongest}`);
        return updated;
      } else {
        // Create new verse streak
        debug.log('api', `Creating new verse streak: ${streakLength} words`);
        return [...prev, {
          verse_reference: verseReference,
          longest_guess_streak: streakLength,
          current_guess_streak: streakLength,
          last_guess_date: Date.now()
        }];
      }
    });

    // Update current verse streak if this is the active verse
    if (currentVerseReference === verseReference) {
      setCurrentVerseStreak(streakLength);
    }
  };

  const resetVerseStreak = async (verseReference: string) => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) return;

      const response = await fetch(`${getApiUrl()}/gamification/verse-streaks/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ verse_reference: verseReference })
      });

      if (response.ok) {
        setVerseStreaks(prev => {
          const existingIndex = prev.findIndex(vs => vs.verse_reference === verseReference);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              current_guess_streak: 0
            };
            return updated;
          }
          return prev;
        });

        // Reset current verse streak if this is the active verse
        if (currentVerseReference === verseReference) {
          setCurrentVerseStreak(0);
        }
      }
    } catch (error) {
      debug.error('api', 'Error resetting verse streak:', error);
    }
  };

  // Immediate frontend reset without API call (for responsive UI)
  const resetVerseStreakImmediate = (verseReference: string) => {
    debug.log('api', `Resetting verse streak for ${verseReference}`);
    setVerseStreaks(prev => {
      const existingIndex = prev.findIndex(vs => vs.verse_reference === verseReference);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          current_guess_streak: 0
        };
        debug.log('api', `Reset current streak to 0 for ${verseReference}`);
        return updated;
      }
      return prev;
    });

    // Reset current verse streak if this is the active verse
    if (currentVerseReference === verseReference) {
      setCurrentVerseStreak(0);
    }
  };

  const setCurrentVerse = (verseReference: string | null) => {
    setCurrentVerseReference(verseReference);
    if (verseReference) {
      // Find the current streak for this verse
      const verseStreak = verseStreaks.find(vs => vs.verse_reference === verseReference);
      setCurrentVerseStreak(verseStreak?.current_guess_streak || 0);
    } else {
      setCurrentVerseStreak(0);
    }
  };

  const refreshVerseStreaks = async () => {
    if (!isAuthenticated) return;

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) return;

      const response = await fetch(`${getApiUrl()}/gamification/verse-streaks`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVerseStreaks(data.verse_streaks || []);
      }
    } catch (error) {
      debug.error('api', 'Error fetching verse streaks:', error);
    }
  };

  // Refresh points when component mounts and when auth state changes
  useEffect(() => {
    void refreshPoints();
    void refreshVerseStreaks();
    
    // Check if localStorage has a higher longest streak than server and update if needed
    const checkAndUpdateLongestStreak = async () => {
      if (!isAuthenticated) return;
      
      try {
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken) return;

        const storedStreak = parseInt(localStorage.getItem('longest_word_guess_streak') || '0', 10);
        if (storedStreak === 0) return; // No local streak to check

        // Get current server streak
        const response = await fetch(`${getApiUrl()}/gamification/stats`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverStreak = data.longest_word_guess_streak || 0;

        // If localStorage has a higher streak, update the server
        if (storedStreak > serverStreak) {
          debug.log('api', `Updating server longest streak from ${serverStreak} to ${storedStreak}`);
          await fetch(`${getApiUrl()}/gamification/points`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              event_type: 'word_correct',
              points: 0,
              metadata: {
                streak_length: storedStreak,
                is_new_longest: true
              },
              created_at: Date.now()
            })
          });
        }
      } catch (error) {
        debug.error('api', 'Error checking/updating longest streak on mount:', error);
      }
    };

    // Run the check after a short delay to ensure auth is ready
    setTimeout(() => {
      void checkAndUpdateLongestStreak();
    }, 1000);
  }, [isAuthenticated]);

  return (
    <PointsContext.Provider value={{ 
      points, 
      longestWordGuessStreak, 
      currentStreak, 
      verseStreaks,
      currentVerseStreak,
      currentVerseReference,
      updatePoints, 
      updateLongestWordGuessStreak, 
      updateCurrentStreak,
      updateVerseStreak,
      resetVerseStreak,
      resetVerseStreakImmediate,
      setCurrentVerse,
      refreshPoints,
      refreshVerseStreaks
    }}>
      {children}
    </PointsContext.Provider>
  );
}; 
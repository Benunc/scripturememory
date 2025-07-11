import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { debug } from '../utils/debug';
import { getApiUrl } from '../utils/api';

interface PointsContextType {
  points: number;
  longestWordGuessStreak: number;
  updatePoints: (points: number) => void;
  updateLongestWordGuessStreak: (streak: number) => void;
  refreshPoints: () => Promise<void>;
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
      setPoints(newPoints);
      
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

  // Refresh points when component mounts and when auth state changes
  useEffect(() => {
    void refreshPoints();
    
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
    <PointsContext.Provider value={{ points, longestWordGuessStreak, updatePoints, updateLongestWordGuessStreak, refreshPoints }}>
      {children}
    </PointsContext.Provider>
  );
}; 
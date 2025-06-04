import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { debug } from '../utils/debug';
import { getApiUrl } from '../utils/api';

interface PointsContextType {
  points: number;
  updatePoints: (points: number) => void;
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
  const { isAuthenticated } = useAuth();
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
      setPoints(newPoints);
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

  // Refresh points when component mounts and when auth state changes
  useEffect(() => {
    void refreshPoints();
  }, [isAuthenticated]);

  return (
    <PointsContext.Provider value={{ points, updatePoints, refreshPoints }}>
      {children}
    </PointsContext.Provider>
  );
}; 
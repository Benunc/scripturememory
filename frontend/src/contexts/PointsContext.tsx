import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { debug } from '../utils/debug';

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
  const [points, setPoints] = useState(0);
  const { isAuthenticated } = useAuth();

  const refreshPoints = async () => {
    if (!isAuthenticated) return;

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const response = await fetch('/api/gamification/stats', {
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
    } catch (error) {
      debug.error('api', 'Error fetching points:', error);
    }
  };

  const updatePoints = (newPoints: number) => {
    setPoints(newPoints);
    localStorage.setItem('points', newPoints.toString());
    // Add a delay before refreshing from server to allow backend to process
    setTimeout(() => {
      void refreshPoints();
    }, 1000); // 1 second delay
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
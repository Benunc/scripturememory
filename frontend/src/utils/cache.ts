// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Check if cached data is still valid
export const isCacheValid = (cachedData: any) => {
  if (!cachedData || !cachedData.timestamp) return false;
  return Date.now() - cachedData.timestamp < CACHE_DURATION;
};

// Get cached data
export const getCachedData = (cacheKey: string) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (isCacheValid(data)) {
        return data.data;
      }
    }
  } catch (error) {
    console.warn('Error reading from cache:', error);
  }
  return null;
};

// Set cached data
export const setCachedData = (cacheKey: string, data: any) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error writing to cache:', error);
  }
};

// Generate cache key for leaderboard
export const getLeaderboardCacheKey = (groupId: string, timeframe: string, metric: string, direction: string) => 
  `leaderboard_${groupId}_${timeframe}_${metric}_${direction}`;

// Clear all leaderboard cache for a group
export const clearLeaderboardCache = (groupId: string) => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`leaderboard_${groupId}_`)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing cache:', error);
  }
}; 
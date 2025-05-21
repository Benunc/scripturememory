import { getAccessToken as getGoogleToken } from './token';
import { debug, handleError } from './debug';

// Constants
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const SHEET_NAME = 'Verses';
const AUTHORIZED_USERS_SHEET = 'AuthorizedUsers';

interface AuthorizedUser {
  email: string;
  isAdmin?: boolean;
}

// Parse authorized users from environment variable
export const getAuthorizedUsers = (): AuthorizedUser[] => {
  try {
    const usersStr = import.meta.env.VITE_AUTHORIZED_USERS;
    if (!usersStr) return [];
    return JSON.parse(usersStr);
  } catch (error) {
    debug.error('auth', 'Error parsing authorized users:', error);
    return [];
  }
};

// Validate environment variables
export const validateEnvVariables = () => {
  const requiredVars = [
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_GOOGLE_SHEET_ID',
    'VITE_AUTHORIZED_USERS',
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Get access token from Google
export const getAccessToken = async (): Promise<string> => {
  try {
    const token = await getGoogleToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }
    return token;
  } catch (error) {
    debug.error('auth', 'Error getting access token:', error);
    throw error;
  }
};

// Fetch user email from Google
export const fetchUserEmail = async (): Promise<string> => {
  try {
    const token = await getAccessToken();
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return data.email;
  } catch (error) {
    debug.error('auth', 'Error fetching user email:', error);
    throw error;
  }
};

// Check if user is authorized
export const isUserAuthorized = async (email: string): Promise<boolean> => {
  try {
    const authorizedUsers = getAuthorizedUsers();
    return authorizedUsers.some(user => user.email === email);
  } catch (error) {
    debug.error('auth', 'Error checking user authorization:', error);
    return false;
  }
};

// Sanitize verse text
export const sanitizeVerseText = (text: string): string => {
  return text
    .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export const handleSignOut = async () => {
  try {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }
  } catch (error) {
    debug.error('auth', 'Error revoking token:', error);
  } finally {
    localStorage.clear();
  }
};

export const getUserTabs = (email: string): string[] => {
  const authorizedUsers = getAuthorizedUsers();
  const user = authorizedUsers.find(u => u.email === email);
  
  if (!user) return [];
  if (user.isAdmin) return ['*']; // Admin can access all tabs
  return [email.replace(/[^a-zA-Z0-9]/g, '_')]; // Regular users can only access their own tab
};

export const canAccessTab = (email: string, tabName: string): boolean => {
  const authorizedUsers = getAuthorizedUsers();
  const user = authorizedUsers.find(u => u.email === email);
  
  if (!user) return false;
  if (user.isAdmin) return true; // Admin can access any tab
  return tabName === email.replace(/[^a-zA-Z0-9]/g, '_'); // Regular users can only access their own tab
};

export const rateLimiter = {
  requests: new Map<string, number[]>(),
  maxRequests: 100,
  timeWindow: 60000, // 1 minute

  canMakeRequest: (userId: string): boolean => {
    const now = Date.now();
    const userRequests = rateLimiter.requests.get(userId) || [];
    // Remove old requests
    const recentRequests = userRequests.filter(time => now - time < rateLimiter.timeWindow);
    rateLimiter.requests.set(userId, recentRequests);
    return recentRequests.length < rateLimiter.maxRequests;
  },

  recordRequest: (userId: string) => {
    const now = Date.now();
    const userRequests = rateLimiter.requests.get(userId) || [];
    userRequests.push(now);
    rateLimiter.requests.set(userId, userRequests);
  }
};

export const revokeToken = async (): Promise<void> => {
  try {
    const auth2 = window.gapi.auth2.getAuthInstance();
    await auth2.signOut();
  } catch (error) {
    debug.error('auth', 'Error revoking token:', error);
    throw new Error(handleError.auth.notSignedIn().description);
  }
}; 
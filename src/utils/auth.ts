import { getAccessToken } from './token';

interface AuthorizedUser {
  email: string;
  isAdmin?: boolean;
}

// Parse authorized users from environment variable
const AUTHORIZED_USERS: Record<string, string[]> = (() => {
  try {
    // console.log('Raw VITE_AUTHORIZED_USERS:', import.meta.env.VITE_AUTHORIZED_USERS);
    const users = JSON.parse(import.meta.env.VITE_AUTHORIZED_USERS || '[]') as AuthorizedUser[];
    // console.log('Parsed users:', users);
    const result: Record<string, string[]> = {};
    
    users.forEach(user => {
      result[user.email] = user.isAdmin ? ['*'] : [user.email.replace(/[^a-zA-Z0-9]/g, '_')];
    });
    
    // console.log('Final AUTHORIZED_USERS mapping:', result);
    return result;
  } catch (error) {
    console.error('Error parsing authorized users:', error);
    return {};
  }
})();

// Check if a user is authorized
export const isUserAuthorized = (email: string): boolean => {
  // console.log('Checking authorization for:', email);
  // console.log('Available authorized users:', AUTHORIZED_USERS);
  const isAuthorized = email in AUTHORIZED_USERS;
  // console.log('Is authorized:', isAuthorized);
  return isAuthorized;
};

// Get the tabs a user is allowed to access
export const getUserTabs = (email: string): string[] => {
  // console.log('Getting tabs for:', email);
  const tabs = AUTHORIZED_USERS[email] || [];
  // console.log('Available tabs:', tabs);
  return tabs;
};

// Check if a user can access a specific tab
export const canAccessTab = (email: string, tabName: string): boolean => {
  const allowedTabs = getUserTabs(email);
  // If user has access to all tabs (admin), return true immediately
  if (allowedTabs.includes('*')) {
    return true;
  }
  return allowedTabs.includes(tabName);
};

// Fetch user email using Google API token
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
    // console.log('Google user info response:', data);
    // console.log('Email from Google:', data.email);
    return data.email;
  } catch (error) {
    console.error('Error fetching user email:', error);
    throw error;
  }
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
    console.error('Error revoking token:', error);
  } finally {
    // Clear all state and storage
    localStorage.clear();
    // Reset app state
  }
};

export const sanitizeVerseText = (text: string): string => {
  // Remove any HTML tags
  const sanitized = text.replace(/<[^>]*>/g, '');
  // Remove any script tags
  return sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

export const validateEnvVariables = () => {
  const required = ['VITE_GOOGLE_SHEET_ID', 'VITE_GOOGLE_CLIENT_ID'];
  const missing = required.filter(key => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
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
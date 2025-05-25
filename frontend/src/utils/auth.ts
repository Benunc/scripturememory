import { debug } from './debug';
import React from 'react';

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
  // No required variables for now since we're using relative URLs
  return;
};

// Sanitize verse text
export const sanitizeVerseText = (text: string): string => {
  return text
    .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export const handleSignOut = () => {
  localStorage.clear();
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

// Create an accessible mailto link
export const createMailtoLink = (email: string): React.ReactElement => {
  return React.createElement('a', {
    href: `mailto:${email}`,
    'aria-label': `Send email to ${email}`,
    style: { 
      textDecoration: 'none',
      color: 'inherit',
      borderBottom: '1px dotted currentColor'
    }
  }, email);
}; 
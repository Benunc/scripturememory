// Add type for Google client
declare global {
  interface Window {
    google: any;
    isAuthenticating?: boolean;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets'
];

// Constants for token management
const TOKEN_KEY = 'scripture_memory_token';
const TOKEN_EXPIRY_KEY = 'scripture_memory_token_expiry';
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes

// State variables for token management
let lastTokenCheck = 0;
let cachedToken: string | null = null;
let hasNoToken = false;
let isAuthenticating = false;
let tokenCheckTimeout: NodeJS.Timeout | null = null;

// Simple encryption key - in production, this should be stored securely
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-encryption-key';

// Encrypt token
const encryptToken = (token: string): string => {
  try {
    // Simple XOR encryption with the key
    const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
    const tokenBytes = new TextEncoder().encode(token);
    const encrypted = new Uint8Array(tokenBytes.length);
    
    for (let i = 0; i < tokenBytes.length; i++) {
      encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return btoa(String.fromCharCode(...encrypted));
  } catch (error) {
    console.error('Error encrypting token:', error);
    throw error;
  }
};

// Decrypt token
const decryptToken = (encryptedToken: string): string => {
  try {
    // Convert from base64
    const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
    const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
    const decrypted = new Uint8Array(encrypted.length);
    
    // XOR decrypt
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Error decrypting token:', error);
    return '';
  }
};

// Store token with expiry
export const storeToken = (token: string, expiryTime: number): void => {
  try {
    const encryptedToken = encryptToken(token);
    localStorage.setItem(TOKEN_KEY, encryptedToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    cachedToken = token;
    hasNoToken = false;
    console.log('Token stored successfully');
  } catch (error) {
    console.error('Error storing token:', error);
    throw error;
  }
};

// Get stored token
export const getStoredToken = (): string | null => {
  try {
    // Check if we have a cached token
    if (cachedToken) {
      const expiryTime = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
      if (Date.now() < expiryTime) {
        return cachedToken;
      }
      // Token expired, clear cache
      cachedToken = null;
    }

    // Check if we've already determined there's no token
    if (hasNoToken) {
      return null;
    }

    const encryptedToken = localStorage.getItem(TOKEN_KEY);
    if (!encryptedToken) {
      hasNoToken = true;
      return null;
    }

    const token = decryptToken(encryptedToken);
    if (!token) {
      hasNoToken = true;
      return null;
    }

    const expiryTime = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
    if (Date.now() >= expiryTime) {
      console.log('Token expired, removing from storage');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      hasNoToken = true;
      return null;
    }

    cachedToken = token;
    return token;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

// Check if token is valid
export const isTokenValid = (): boolean => {
  try {
    // Rate limit token checks
    const now = Date.now();
    if (now - lastTokenCheck < TOKEN_CHECK_INTERVAL) {
      console.log('Skipping token check - rate limited');
      return !!cachedToken;
    }
    lastTokenCheck = now;

    const token = getStoredToken();
    if (!token) {
      console.log('No token found');
      return false;
    }

    // Check if token is about to expire
    const expiryTime = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
    if (Date.now() + TOKEN_REFRESH_THRESHOLD >= expiryTime) {
      console.log('Token about to expire, refreshing...');
      return false; // Force token refresh
    }

    return true;
  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
};

// Clear stored token
export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  cachedToken = null;
  hasNoToken = true;
  if (tokenCheckTimeout) {
    clearTimeout(tokenCheckTimeout);
    tokenCheckTimeout = null;
  }
};

// Start periodic token validation
export const startTokenValidation = (): void => {
  if (tokenCheckTimeout) {
    clearTimeout(tokenCheckTimeout);
  }
  
  tokenCheckTimeout = setInterval(() => {
    const isValid = isTokenValid();
    if (!isValid) {
      console.log('Token validation failed, clearing state');
      clearStoredToken();
    }
  }, TOKEN_CHECK_INTERVAL);
};

// Stop periodic token validation
export const stopTokenValidation = (): void => {
  if (tokenCheckTimeout) {
    clearTimeout(tokenCheckTimeout);
    tokenCheckTimeout = null;
  }
};

// Get an access token using Google Identity Services
export const getAccessToken = async (): Promise<string> => {
  // Check if we have a valid token
  const storedToken = getStoredToken();
  if (storedToken) {
    return storedToken;
  }

  // Check if authentication is already in progress
  if (window.isAuthenticating) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const token = getStoredToken();
        if (token) {
          clearInterval(checkInterval);
          resolve(token);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Authentication timeout'));
      }, 30000);
    });
  }

  window.isAuthenticating = true;

  try {
    // Use Google Identity Services for authentication
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: (response: any) => {
          if (response.error) {
            window.isAuthenticating = false;
            reject(new Error(response.error));
            return;
          }
          
          const { access_token, expires_in } = response;
          const expiryTime = Date.now() + expires_in * 1000;
          
          storeToken(access_token, expiryTime);
          window.isAuthenticating = false;
          resolve(access_token);
        },
      });

      // Request token with popup
      client.requestAccessToken({ prompt: 'consent' });
    });
  } catch (error) {
    window.isAuthenticating = false;
    throw error;
  }
};

// Reset client state
export const resetClientState = (): void => {
  clearStoredToken();
  window.isAuthenticating = false;
}; 
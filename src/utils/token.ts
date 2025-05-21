// Add type for Google client
declare global {
  interface Window {
    google: any;
    isAuthenticating?: boolean;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// console.log('CLIENT_ID loaded:', CLIENT_ID ? 'present' : 'missing');

// Token management for user authentication
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let isAuthenticating = false;
let currentUserEmail: string | null = null;

// Add encryption utilities
const encryptToken = (token: string): string => {
  // console.log('Encrypting token');
  return btoa(token); // Simple base64 encoding for now
};

const decryptToken = (encryptedToken: string): string => {
  // console.log('Decrypting token');
  return atob(encryptedToken); // Simple base64 decoding for now
};

// Load token from localStorage on initialization
const loadStoredToken = (): { token: string | null; expiry: number | null } => {
  // console.log('Loading stored token');
  const storedToken = localStorage.getItem('google_access_token');
  const storedExpiry = localStorage.getItem('google_token_expiry');
  
  // console.log('Stored data:', {
  //   hasToken: !!storedToken,
  //   hasExpiry: !!storedExpiry,
  //   hasEmail: !!localStorage.getItem('user_email')
  // });

  if (!storedToken || !storedExpiry) {
    return { token: null, expiry: null };
  }

  try {
    const token = decryptToken(storedToken);
    // console.log('Token loaded successfully');
    return {
      token,
      expiry: parseInt(storedExpiry, 10)
    };
  } catch (error) {
    console.error('Error loading token:', error);
    return { token: null, expiry: null };
  }
};

// Initialize the Google Identity Services client
const initializeGoogleClient = () => {
  // console.log('Initializing Google client');
  return new Promise<void>((resolve) => {
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      // console.log('Google client script loaded');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // console.log('Google client script loaded');
      resolve();
    };
    document.body.appendChild(script);
  });
};

// Ensure the client is initialized
const ensureClientInitialized = async () => {
  const clientInitialized = !!window.google?.accounts?.oauth2;
  // console.log('Ensuring client initialized:', { clientInitialized });

  if (!clientInitialized) {
    await initializeGoogleClient();
    // console.log('Client initialized');
  }
};

// Check if the current token is still valid
const isTokenValid = (): boolean => {
  const { token, expiry } = loadStoredToken();
  const now = Date.now();
  const isValid = !!token && !!expiry && expiry > now;
  
  // console.log('Checking token validity:', {
  //   hasToken: !!token,
  //   hasExpiry: !!expiry,
  //   isValid
  // });
  
  return isValid;
};

// Get an access token using Google Identity Services
export const getAccessToken = async (): Promise<string> => {
  // console.log('Getting access token');
  
  // Check if we have a valid token
  if (isTokenValid()) {
    const { token } = loadStoredToken();
    // console.log('Using cached token');
    return token!;
  }

  // Check if authentication is already in progress
  if (window.isAuthenticating) {
    // console.log('Authentication already in progress');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isTokenValid()) {
          clearInterval(checkInterval);
          const { token } = loadStoredToken();
          resolve(token!);
        }
      }, 100);
    });
  }

  // console.log('Starting new authentication');
  window.isAuthenticating = true;

  try {
    await ensureClientInitialized();
    const token = await new Promise<string>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          // console.log('Received new access token');
          const { access_token, expires_in } = response;
          const expiry = Date.now() + (expires_in * 1000);
          
          // Store token and expiry
          localStorage.setItem('google_access_token', encryptToken(access_token));
          localStorage.setItem('google_token_expiry', expiry.toString());
          
          resolve(access_token);
        },
      });

      // console.log('Requesting access token');
      client.requestAccessToken();
    });

    return token;
  } finally {
    window.isAuthenticating = false;
  }
};

// Reset client state
export const resetClientState = () => {
  // console.log('Resetting client state');
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_expiry');
  localStorage.removeItem('user_email');
  window.isAuthenticating = false;
};

// Add type for Google OAuth response
interface GoogleOAuthResponse {
  access_token?: string;
  error?: string;
  expires_in?: number;
}

// Add type for Google OAuth error
interface GoogleOAuthError {
  message: string;
} 
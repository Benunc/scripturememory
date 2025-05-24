import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken, fetchUserEmail, isUserAuthorized } from '../utils/auth';
import { getStoredToken, storeToken, clearStoredToken, isTokenValid, startTokenValidation, stopTokenValidation } from '../utils/token';
import { debug, handleError } from '../utils/debug';
import { db } from '../utils/db';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedToken = useRef(false);
  const isInitialized = useRef(false);

  // Update auth state
  const updateAuthState = useCallback(async (email: string | null, authorized: boolean) => {
    debug.log('auth', 'Updating auth state:', { email, authorized });
    
    // Update all state synchronously
    setUserEmail(email);
    setIsAuthenticated(!!email);
    setIsAuthorized(authorized);
    setIsLoading(false);
    
    if (authorized) {
      debug.log('auth', 'Starting token validation');
      startTokenValidation();
    } else if (email) {
      debug.log('auth', 'User not authorized:', email);
      setError(handleError.auth.unauthorized(email).description);
    }
  }, []);

  // Initialize Google client
  const initializeGoogleClient = async () => {
    if (isInitialized.current) {
      debug.log('auth', 'Google client already initialized');
      return;
    }
    
    try {
      debug.log('auth', 'Initializing Google client...');
      // Load the Google Identity Services script
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // Wait for Google client to be available
      await new Promise<void>((resolve) => {
        const checkGoogleClient = () => {
          if (window.google?.accounts?.id) {
            resolve();
          } else {
            setTimeout(checkGoogleClient, 100);
          }
        };
        checkGoogleClient();
      });

      isInitialized.current = true;
      debug.log('auth', 'Google client initialized successfully');
    } catch (error) {
      debug.error('auth', 'Error initializing Google client:', error);
      throw error;
    }
  };

  // Check authentication status
  const checkAuth = async () => {
    if (hasCheckedToken.current) {
      debug.log('auth', 'Skipping token check - already checked');
      return;
    }

    try {
      debug.log('auth', 'Checking authentication status...');
      const token = getStoredToken();
      
      if (token) {
        debug.log('auth', 'Found stored token, validating...');
        const isValid = isTokenValid();
        
        if (isValid) {
          debug.log('auth', 'Token is valid, fetching user email...');
          const email = await fetchUserEmail();
          debug.log('auth', 'Fetched user email:', email);
          
          // Check if user is authorized before updating state
          const authorized = await isUserAuthorized(email);
          debug.log('auth', 'User authorization status:', authorized);
          
          // Update all state at once
          await updateAuthState(email, authorized);
        } else {
          debug.log('auth', 'Token is invalid, clearing state...');
          clearStoredToken();
          await updateAuthState(null, false);
          setError(handleError.auth.tokenExpired().description);
        }
      } else {
        debug.log('auth', 'No stored token found');
        await updateAuthState(null, false);
      }
    } catch (error) {
      debug.error('auth', 'Error checking auth:', error);
      setError(handleError.auth.notSignedIn().description);
      await updateAuthState(null, false);
    } finally {
      setIsLoading(false);
      hasCheckedToken.current = true;
    }
  };

  // Sign in
  const signIn = async () => {
    try {
      debug.log('auth', 'Starting sign in process...');
      setIsLoading(true);
      setError(null);
      
      // Initialize Google client first
      await initializeGoogleClient();
      
      // Get access token
      debug.log('auth', 'Getting access token...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }
      debug.log('auth', 'Got access token');

      // Store token with 1 hour expiry
      storeToken(token, Date.now() + 3600000);
      debug.log('auth', 'Stored token');
      
      // Fetch user email
      debug.log('auth', 'Fetching user email...');
      const email = await fetchUserEmail();
      debug.log('auth', 'Fetched user email:', email);
      
      // Check if user is authorized before updating state
      debug.log('auth', 'Checking user authorization...');
      const authorized = await isUserAuthorized(email);
      debug.log('auth', 'User authorization status:', authorized);
      
      // Update all state at once
      setUserEmail(email);
      setIsAuthenticated(true);
      setIsAuthorized(authorized);
      setIsLoading(false);
      
      if (authorized) {
        debug.log('auth', 'Starting token validation');
        startTokenValidation();
      } else {
        debug.log('auth', 'User not authorized:', email);
        setError(handleError.auth.unauthorized(email).description);
      }

      // Reset the token check flag to force a fresh check
      hasCheckedToken.current = false;
      debug.log('auth', 'Sign in process completed');
    } catch (error) {
      debug.error('auth', 'Error signing in:', error);
      setError(handleError.auth.notSignedIn().description);
      setUserEmail(null);
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    debug.log('auth', 'Starting sign out process...');
    try {
      // Clear local database first
      await db.clearDatabase();
      debug.log('auth', 'Local database cleared');
    } catch (error) {
      debug.error('auth', 'Error clearing local database:', error);
      // Continue with sign out even if clearing database fails
    }
    clearStoredToken();
    stopTokenValidation();
    await updateAuthState(null, false);
    hasCheckedToken.current = false;
    debug.log('auth', 'Sign out process completed');
  };

  // Check auth on mount
  useEffect(() => {
    debug.log('auth', 'useAuth hook mounted');
    checkAuth();
    return () => {
      debug.log('auth', 'useAuth hook unmounting');
      stopTokenValidation();
    };
  }, []);

  return {
    isAuthenticated,
    isAuthorized,
    userEmail,
    isLoading,
    error,
    signIn,
    signOut
  };
}; 
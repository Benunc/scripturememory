import { useState, useEffect, useRef } from 'react';
import { getAccessToken, fetchUserEmail, isUserAuthorized } from '../utils/auth';
import { getStoredToken, storeToken, clearStoredToken, isTokenValid, startTokenValidation, stopTokenValidation } from '../utils/token';
import { debug, handleError } from '../utils/debug';

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedToken = useRef(false);
  const isInitialized = useRef(false);

  // Initialize Google client
  const initializeGoogleClient = async () => {
    if (isInitialized.current) return;
    
    try {
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
      
      // Initialize Google Identity Services
      await initializeGoogleClient();
      
      // Check if user is already signed in with Google
      const token = getStoredToken();
      let email: string | null = null;
      
      if (token) {
        debug.log('auth', 'Found stored token, validating...');
        const isValid = isTokenValid();
        
        if (isValid) {
          debug.log('auth', 'Token is valid, fetching user email...');
          email = await fetchUserEmail();
        } else {
          debug.log('auth', 'Token is invalid, clearing state...');
          clearStoredToken();
        }
      }

      // If no valid token, try to get one from Google
      if (!email) {
        debug.log('auth', 'No valid token, checking Google sign-in status...');
        try {
          const response = await new Promise<GoogleCredentialResponse>((resolve, reject) => {
            window.google.accounts.id.initialize({
              client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
              callback: (response: GoogleCredentialResponse) => {
                if (response.credential) {
                  resolve(response);
                } else {
                  reject(new Error('No credential received'));
                }
              },
              auto_select: true,
              cancel_on_tap_outside: false
            });
            
            window.google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                reject(new Error('Sign-in prompt not displayed or skipped'));
              }
            });
          });

          if (response.credential) {
            const token = response.credential;
            storeToken(token, Date.now() + 3600000);
            email = await fetchUserEmail();
          }
        } catch (error) {
          debug.log('auth', 'No active Google sign-in found');
        }
      }

      if (email) {
        // Check if user is authorized before updating state
        const authorized = await isUserAuthorized(email);
        
        // Update all state at once to prevent race conditions
        setUserEmail(email);
        setIsAuthenticated(true);
        setIsAuthorized(authorized);
        
        if (authorized) {
          startTokenValidation();
        } else {
          setError(handleError.auth.unauthorized(email).description);
        }
      } else {
        debug.log('auth', 'No stored token or Google sign-in found');
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setUserEmail(null);
      }
    } catch (error) {
      debug.error('auth', 'Error checking auth:', error);
      setError(handleError.auth.notSignedIn().description);
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setUserEmail(null);
    } finally {
      setIsLoading(false);
      hasCheckedToken.current = true;
    }
  };

  // Sign in
  const signIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize Google client first
      await initializeGoogleClient();
      
      // Get access token
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      // Store token with 1 hour expiry
      storeToken(token, Date.now() + 3600000);
      
      // Fetch user email
      const email = await fetchUserEmail();
      
      // Check if user is authorized before updating state
      const authorized = await isUserAuthorized(email);
      
      // Update all state at once to prevent race conditions
      setUserEmail(email);
      setIsAuthenticated(true);
      setIsAuthorized(authorized);
      
      if (authorized) {
        startTokenValidation();
        // Force a re-render to trigger verse loading
        hasCheckedToken.current = false;
        await checkAuth();
      } else {
        setError(handleError.auth.unauthorized(email).description);
      }
    } catch (error) {
      debug.error('auth', 'Error signing in:', error);
      setError(handleError.auth.notSignedIn().description);
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setUserEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = () => {
    clearStoredToken();
    stopTokenValidation();
    setIsAuthenticated(false);
    setIsAuthorized(false);
    setUserEmail(null);
    hasCheckedToken.current = false;
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    return () => {
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
    signOut,
  };
}; 
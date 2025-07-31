import { useState, useEffect, useCallback } from 'react';
import { debug } from '../utils/debug';
import { getMagicLink, verifyMagicLink } from '../utils/api';
import { NavigateFunction } from 'react-router-dom';

export const useAuth = (navigate: NavigateFunction) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session
  const checkSession = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('session_token');
      const storedEmail = localStorage.getItem('user_email');
      
      if (storedToken && storedEmail) {
        setToken(storedToken);
        setUserEmail(storedEmail);
        setIsAuthenticated(true);
      }
    } catch (error) {
      debug.error('auth', 'Error checking session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    debug.log('auth', 'useAuth hook mounted');
    checkSession();
  }, [checkSession]);

  // Sign in with magic link
  const signIn = async (email: string, isRegistration: boolean, turnstileToken: string, verseSet?: string, groupCode?: string, marketingOptIn?: boolean, redirect?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await getMagicLink(email, isRegistration, turnstileToken, verseSet, groupCode, marketingOptIn, redirect);
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Store email temporarily
      localStorage.setItem('pending_email', email);
      
      // Show success message
      debug.log('auth', 'Magic link sent successfully');
    } catch (error) {
      debug.error('auth', 'Error sending magic link:', error);
      setError(error instanceof Error ? error.message : 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify magic link
  const verifyToken = async (magicToken: string) => {
    try {
      debug.log('auth', 'Starting token verification in useAuth');
      debug.log('auth', 'Current window location:', window.location.href);
      setIsLoading(true);
      setError(null);
      
      const response = await verifyMagicLink(magicToken);
      debug.log('auth', 'Verification response:', response);
      
      if (response.error) {
        debug.error('auth', 'Verification error:', response.error);
        throw new Error(response.error);
      }
      
      if (response.data) {
        debug.log('auth', 'Verification successful, setting session');
        const { token: sessionToken, email, redirect } = response.data;
        debug.log('auth', 'Session token:', sessionToken);
        debug.log('auth', 'Email:', email);
        debug.log('auth', 'Redirect URL:', redirect);
        
        // Store session
        localStorage.setItem('session_token', sessionToken);
        localStorage.setItem('user_email', email);
        
        // Force an immediate session check
        await checkSession();
        
        debug.log('auth', 'Session set successfully');
        
        // Navigate to redirect URL if provided
        if (redirect) {
          debug.log('auth', 'Redirecting to:', redirect);
          navigate(redirect);
        }
        
        return true;
      }
      
      debug.error('auth', 'No data received from verification');
      throw new Error('No data received from verification');
    } catch (error) {
      debug.error('auth', 'Error in verifyToken:', error);
      setError(error instanceof Error ? error.message : 'Failed to verify magic link');
      throw error; // Re-throw to be caught by the component
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = () => {
    // Clear all localStorage items
    localStorage.clear();
    
    // Reset state
    setToken(null);
    setUserEmail(null);
    setIsAuthenticated(false);

    // Navigate to root
    navigate('/');
  };

  return {
    isAuthenticated,
    userEmail,
    token,
    isLoading,
    error,
    signIn,
    signOut,
    verifyToken
  };
}; 
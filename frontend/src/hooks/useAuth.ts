import { useState, useEffect, useCallback } from 'react';
import { debug } from '../utils/debug';
import { getMagicLink, verifyMagicLink } from '../utils/api';

export const useAuth = () => {
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

  // Check for magic link token in URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token) {
      // If we have a token in the URL, verify it immediately
      verifyToken(token).then(() => {
        // If verification succeeds, redirect to the main page
        window.location.href = '/';
      }).catch((error) => {
        console.error('Error verifying token:', error);
        // If verification fails, show error and stay on the page
      });
    }
  }, []);

  // Sign in with magic link
  const signIn = async (email: string, isRegistration: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await getMagicLink(email, isRegistration);
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
      console.log('Starting token verification in useAuth');
      console.log('Current window location:', window.location.href);
      setIsLoading(true);
      setError(null);
      
      const response = await verifyMagicLink(magicToken);
      console.log('Verification response:', response);
      
      if (response.error) {
        console.error('Verification error:', response.error);
        throw new Error(response.error);
      }
      
      if (response.data) {
        console.log('Verification successful, setting session');
        const { token: sessionToken, email } = response.data;
        console.log('Session token:', sessionToken);
        console.log('Email:', email);
        
        // Store session
        localStorage.setItem('session_token', sessionToken);
        localStorage.setItem('user_email', email);
        
        setToken(sessionToken);
        setUserEmail(email);
        setIsAuthenticated(true);
        
        console.log('Session set successfully');
        return true;
      }
      
      console.error('No data received from verification');
      throw new Error('No data received from verification');
    } catch (error) {
      console.error('Error in verifyToken:', error);
      setError(error instanceof Error ? error.message : 'Failed to verify magic link');
      throw error; // Re-throw to be caught by the component
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = () => {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('pending_email');
    localStorage.removeItem('pending_token');
    setToken(null);
    setUserEmail(null);
    setIsAuthenticated(false);
  };

  // Check session on mount
  useEffect(() => {
    debug.log('auth', 'useAuth hook mounted');
    checkSession();
  }, [checkSession]);

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